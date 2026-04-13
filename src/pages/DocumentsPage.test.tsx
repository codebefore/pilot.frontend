import { fireEvent, screen, waitFor } from "@testing-library/react";
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

  it("fetches the missing checklist by default with backend-compatible params", async () => {
    renderWithProviders(<DocumentsPage />);

    await waitFor(() => {
      expect(getDocumentChecklistMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "missing",
          page: 1,
          pageSize: 20,
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("sends the selected document type filter", async () => {
    renderWithProviders(<DocumentsPage />);

    await waitFor(() => expect(getDocumentChecklistMock).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Belge Türü"), {
      target: { value: "t2" },
    });

    await waitFor(() => {
      expect(getDocumentChecklistMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          documentTypeId: "t2",
          status: "missing",
          page: 1,
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("loads document types once for the filter dropdown", async () => {
    renderWithProviders(<DocumentsPage />);
    await waitFor(() => expect(getDocumentTypesMock).toHaveBeenCalledTimes(1));
    // The type dropdown should now contain the two types from the mock.
    expect(await screen.findByRole("option", { name: "Nüfus Cüzdanı" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Sağlık Raporu" })).toBeInTheDocument();
  });
});
