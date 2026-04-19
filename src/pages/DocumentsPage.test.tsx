import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DocumentsPage } from "./DocumentsPage";
import { renderWithProviders } from "../test/render-with-providers";

const getDocumentChecklistMock = vi.fn();
const getDocumentTypesMock = vi.fn();

vi.mock("../lib/documents-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/documents-api")>(
    "../lib/documents-api"
  );
  return {
    ...actual,
    getDocumentChecklist: (...args: Parameters<typeof actual.getDocumentChecklist>) =>
      getDocumentChecklistMock(...args),
    getDocumentTypes: (...args: Parameters<typeof actual.getDocumentTypes>) =>
      getDocumentTypesMock(...args),
    uploadDocument: vi.fn(),
  };
});

vi.mock("../components/modals/UploadDocumentModal", () => ({
  UploadDocumentModal: () => null,
}));

function renderPage() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/documents"]}>
      <DocumentsPage />
    </MemoryRouter>
  );
}

describe("DocumentsPage", () => {
  beforeEach(() => {
    getDocumentChecklistMock.mockReset();
    getDocumentChecklistMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      totalCount: 0,
      totalPages: 1,
    });

    getDocumentTypesMock.mockReset();
    getDocumentTypesMock.mockResolvedValue([
      {
        id: "t1",
        module: "candidate",
        key: "national_id",
        name: "Nüfus Cüzdanı",
        sortOrder: 1,
        isRequired: true,
        isActive: true,
        createdAtUtc: "2026-01-01T00:00:00Z",
        updatedAtUtc: "2026-01-01T00:00:00Z",
      },
      {
        id: "t2",
        module: "candidate",
        key: "health_report",
        name: "Sağlık Raporu",
        sortOrder: 2,
        isRequired: true,
        isActive: true,
        createdAtUtc: "2026-01-01T00:00:00Z",
        updatedAtUtc: "2026-01-01T00:00:00Z",
      },
    ]);
  });

  it("fetches the checklist by default without a tab status filter", async () => {
    renderPage();

    await waitFor(() => {
      expect(getDocumentChecklistMock).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 20,
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("sends the text search filter", async () => {
    renderPage();

    await waitFor(() => expect(getDocumentChecklistMock).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText("Aday ara (ad, TC)..."), {
      target: { value: "Ayse" },
    });

    await waitFor(() => {
      expect(getDocumentChecklistMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          search: "Ayse",
          page: 1,
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("does not send the document search query until the second character", async () => {
    renderPage();

    await waitFor(() => expect(getDocumentChecklistMock).toHaveBeenCalled());
    expect(getDocumentChecklistMock).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByPlaceholderText("Aday ara (ad, TC)..."), {
      target: { value: "A" },
    });

    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(getDocumentChecklistMock).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByPlaceholderText("Aday ara (ad, TC)..."), {
      target: { value: "Ay" },
    });

    await waitFor(() => {
      expect(getDocumentChecklistMock).toHaveBeenCalledTimes(2);
      expect(getDocumentChecklistMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          search: "Ay",
          page: 1,
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("loads document types once for the upload modal", async () => {
    renderPage();
    await waitFor(() => expect(getDocumentTypesMock).toHaveBeenCalledTimes(1));
  });

  it("renders a sortable candidate header without triggering an extra fetch", async () => {
    renderPage();

    await waitFor(() => expect(getDocumentChecklistMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /aday/i }));

    await waitFor(() => expect(getDocumentChecklistMock).toHaveBeenCalledTimes(1));
  });

  it("renders required document types as check columns", async () => {
    getDocumentChecklistMock.mockResolvedValueOnce({
      items: [
        {
          candidateId: "cand-1",
          fullName: "Ayse Demir",
          phoneNumber: "05321234567",
          licenseClass: "B",
          summary: {
            completedCount: 1,
            missingCount: 1,
            totalRequiredCount: 2,
          },
          missingDocumentKeys: ["health_report"],
          missingDocumentNames: ["Sağlık Raporu"],
        },
      ],
      page: 1,
      pageSize: 20,
      totalCount: 1,
      totalPages: 1,
    });

    renderPage();

    expect(await screen.findByLabelText("Nüfus Cüzdanı")).toBeInTheDocument();
    expect(screen.getByLabelText("Sağlık Raporu")).toBeInTheDocument();
    expect(screen.getByLabelText("Nüfus Cüzdanı: var")).toBeInTheDocument();
    expect(screen.getByLabelText("Sağlık Raporu: yok, yukle")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "0 532 123 45 67" })).toHaveAttribute(
      "href",
      "https://wa.me/905321234567"
    );
  });
});
