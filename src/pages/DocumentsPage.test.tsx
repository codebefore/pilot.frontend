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

function checklistPageCalls() {
  return getDocumentChecklistMock.mock.calls.filter(
    ([params]) => params?.pageSize === 10
  );
}

function lastChecklistPageCall() {
  const calls = checklistPageCalls();
  return calls[calls.length - 1];
}

describe("DocumentsPage", () => {
  beforeEach(() => {
    getDocumentChecklistMock.mockReset();
    getDocumentChecklistMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
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
      {
        id: "t3",
        module: "candidate",
        key: "existing_license_copy",
        name: "Mevcut Ehliyet Fotokopisi",
        sortOrder: 3,
        isRequired: true,
        isActive: true,
        createdAtUtc: "2026-01-01T00:00:00Z",
        updatedAtUtc: "2026-01-01T00:00:00Z",
      },
    ]);
  });

  it("fetches the checklist by default without a status tab filter", async () => {
    renderPage();

    await waitFor(() => {
      expect(getDocumentChecklistMock).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 10,
        }),
        expect.any(AbortSignal)
      );
    });
    expect(checklistPageCalls()[0]?.[0]).not.toHaveProperty("candidateStatus");
    expect(checklistPageCalls()[0]?.[0]?.hasMissingDocuments).toBeUndefined();
  });

  it("sends the text search filter", async () => {
    renderPage();

    await waitFor(() => expect(getDocumentChecklistMock).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText("Aday ara (ad, TC)..."), {
      target: { value: "Ayse" },
    });

    await waitFor(() => {
      const lastPageCall = lastChecklistPageCall();
      expect(lastPageCall).toEqual([
        expect.objectContaining({
          search: "Ayse",
          page: 1,
        }),
        expect.any(AbortSignal),
      ]);
    });
  });

  it("does not send the document search query until the second character", async () => {
    renderPage();

    await waitFor(() => expect(checklistPageCalls()).toHaveLength(1));

    fireEvent.change(screen.getByPlaceholderText("Aday ara (ad, TC)..."), {
      target: { value: "A" },
    });

    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(checklistPageCalls()).toHaveLength(1);

    fireEvent.change(screen.getByPlaceholderText("Aday ara (ad, TC)..."), {
      target: { value: "Ay" },
    });

    await waitFor(() => {
      expect(checklistPageCalls()).toHaveLength(2);
      expect(lastChecklistPageCall()).toEqual([
        expect.objectContaining({
          search: "Ay",
          page: 1,
        }),
        expect.any(AbortSignal),
      ]);
    });
  });

  it("filters by missing and complete document tabs", async () => {
    renderPage();

    await waitFor(() => expect(checklistPageCalls()).toHaveLength(1));

    fireEvent.click(screen.getByRole("button", { name: /Eksik Evrak/i }));

    await waitFor(() => {
      expect(lastChecklistPageCall()).toEqual([
        expect.objectContaining({
          hasMissingDocuments: true,
          page: 1,
          pageSize: 10,
        }),
        expect.any(AbortSignal),
      ]);
    });

    fireEvent.click(screen.getByRole("button", { name: /Tam Evrak/i }));

    await waitFor(() => {
      expect(lastChecklistPageCall()).toEqual([
        expect.objectContaining({
          hasMissingDocuments: false,
          page: 1,
          pageSize: 10,
        }),
        expect.any(AbortSignal),
      ]);
    });
  });

  it("loads document types once for the upload modal", async () => {
    renderPage();
    await waitFor(() => expect(getDocumentTypesMock).toHaveBeenCalledTimes(1));
  });

  it("keeps bulk selection controls visible without a bulk selection toggle", async () => {
    getDocumentChecklistMock.mockResolvedValueOnce({
      items: [
        {
          candidateId: "cand-1",
          fullName: "Ayse Demir",
          phoneNumber: null,
          licenseClass: "B",
          hasExistingLicense: false,
          hasAdvancePayment: false,
          currentGroup: null,
          summary: {
            completedCount: 0,
            missingCount: 2,
            totalRequiredCount: 2,
          },
          missingDocumentKeys: ["national_id", "health_report"],
          missingDocumentNames: ["Nüfus Cüzdanı", "Sağlık Raporu"],
        },
      ],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
    });

    renderPage();

    await screen.findByText("Ayse Demir");

    expect(screen.queryByRole("button", { name: "Toplu Seçim" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gruba Aktar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Etiket Ekle" })).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Bu sayfadaki tüm adayları seç" })
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Ayse Demir seç" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Ayse Demir seç" }));
    fireEvent.click(screen.getByRole("button", { name: "Gruba Aktar" }));

    expect(screen.getByRole("button", { name: "Uygula" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "İptal" }));

    expect(screen.getByRole("button", { name: "Gruba Aktar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Etiket Ekle" })).toBeInTheDocument();
  });

  it("renders a sortable candidate header without triggering an extra fetch", async () => {
    renderPage();

    await waitFor(() => expect(checklistPageCalls()).toHaveLength(1));

    fireEvent.click(screen.getByRole("button", { name: /aday/i }));

    await waitFor(() => expect(checklistPageCalls()).toHaveLength(1));
  });

  it("renders required document types as check columns", async () => {
    getDocumentChecklistMock.mockResolvedValueOnce({
      items: [
        {
          candidateId: "cand-1",
          fullName: "Ayse Demir",
          phoneNumber: "05321234567",
          licenseClass: "B",
          hasExistingLicense: true,
          hasAdvancePayment: true,
          currentGroup: {
            groupId: "g1",
            title: "NİSAN 2026 - 1A",
            startDate: "2026-04-01",
            term: {
              id: "term-1",
              monthDate: "2026-04-01",
              sequence: 1,
              name: null,
            },
            assignedAtUtc: "2026-04-01T00:00:00Z",
          },
          summary: {
            completedCount: 1,
            missingCount: 2,
            totalRequiredCount: 3,
          },
          missingDocumentKeys: ["health_report", "existing_license_copy"],
          missingDocumentNames: ["Sağlık Raporu", "Mevcut Ehliyet Fotokopisi"],
        },
      ],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
    });

    renderPage();

    expect(await screen.findByLabelText("Nüfus Cüzdanı")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("NİSAN 2026 - 1A")).toBeInTheDocument();
    expect(screen.getByLabelText("Peşinat var")).toBeInTheDocument();
    expect(screen.getByLabelText("Sağlık Raporu")).toBeInTheDocument();
    expect(screen.getByLabelText("Nüfus Cüzdanı: var")).toBeInTheDocument();
    expect(screen.getByLabelText("Sağlık Raporu: yok, yukle")).toBeInTheDocument();
    expect(screen.getByLabelText("Mevcut Ehliyet Fotokopisi: yok, yukle")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "05321234567" })).toHaveAttribute(
      "href",
      "https://wa.me/905321234567"
    );
  });

  it("shows dash for existing license document when candidate has no existing license", async () => {
    getDocumentChecklistMock.mockResolvedValueOnce({
      items: [
        {
          candidateId: "cand-1",
          fullName: "Ayse Demir",
          phoneNumber: null,
          licenseClass: "B",
          hasExistingLicense: false,
          hasAdvancePayment: false,
          currentGroup: null,
          summary: {
            completedCount: 0,
            missingCount: 3,
            totalRequiredCount: 3,
          },
          missingDocumentKeys: [
            "national_id",
            "health_report",
            "existing_license_copy",
          ],
          missingDocumentNames: [
            "Nüfus Cüzdanı",
            "Sağlık Raporu",
            "Mevcut Ehliyet Fotokopisi",
          ],
        },
      ],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
    });

    renderPage();

    expect(
      await screen.findByLabelText("Mevcut Ehliyet Fotokopisi: gerekli değil")
    ).toHaveTextContent("-");
    expect(
      screen.queryByLabelText("Mevcut Ehliyet Fotokopisi: yok, yukle")
    ).not.toBeInTheDocument();
  });
});
