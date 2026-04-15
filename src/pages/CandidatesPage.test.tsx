import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CandidatesPage } from "./CandidatesPage";
import { renderWithProviders } from "../test/render-with-providers";

const getCandidatesMock = vi.fn();
const getCandidateByIdMock = vi.fn();
const updateCandidateMock = vi.fn();

vi.mock("../lib/candidates-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/candidates-api")>(
    "../lib/candidates-api"
  );
  return {
    ...actual,
    getCandidates: (...args: Parameters<typeof actual.getCandidates>) =>
      getCandidatesMock(...args),
    getCandidateById: (...args: Parameters<typeof actual.getCandidateById>) =>
      getCandidateByIdMock(...args),
    createCandidate: vi.fn(),
    updateCandidate: (...args: Parameters<typeof actual.updateCandidate>) =>
      updateCandidateMock(...args),
    deleteCandidate: vi.fn(),
    assignCandidateGroup: vi.fn(),
    removeActiveGroupAssignment: vi.fn(),
  };
});

vi.mock("../lib/documents-api", () => ({
  getDocumentChecklist: vi.fn().mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 1,
    totalCount: 0,
    totalPages: 1,
  }),
  getDocumentTypes: vi.fn().mockResolvedValue([]),
  uploadDocument: vi.fn(),
}));

vi.mock("../components/drawers/CandidateDrawer", () => ({
  CandidateDrawer: () => null,
}));

vi.mock("../components/modals/NewCandidateModal", () => ({
  NewCandidateModal: () => null,
}));

function renderPage() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/candidates"]}>
      <CandidatesPage />
    </MemoryRouter>
  );
}

describe("CandidatesPage tabs", () => {
  beforeEach(() => {
    localStorage.clear();
    getCandidatesMock.mockReset();
    getCandidateByIdMock.mockReset();
    updateCandidateMock.mockReset();
    getCandidatesMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      totalCount: 0,
      totalPages: 1,
    });
  });

  it("defaults to the 'active' tab and sends status='active'", async () => {
    renderPage();

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenCalled();
    });

    const callArgs = getCandidatesMock.mock.calls[0]?.[0];
    expect(callArgs).toMatchObject({ status: "active", page: 1, pageSize: 10 });
  });

  it("renders exactly the 5 canonical candidate status tabs", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    expect(screen.getByRole("button", { name: "Tum" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Onkayit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aktif" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Park" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mezun" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dosya Yakan" })).toBeInTheDocument();

    // Legacy tabs must not exist anymore.
    expect(screen.queryByRole("button", { name: "Tüm Adaylar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tamamlanan" })).not.toBeInTheDocument();
  });

  it("does not send status when the Tum tab is selected", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Tum" }));

    await waitFor(() => {
      const lastCall = getCandidatesMock.mock.calls[getCandidatesMock.mock.calls.length - 1]?.[0];
      expect(lastCall.status).toBeUndefined();
      expect(lastCall.page).toBe(1);
      expect(lastCall.pageSize).toBe(10);
    });
  });

  it("shows status by default and still lets the user hide it from the picker", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    expect(screen.getByRole("columnheader", { name: /Durum/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sütunlar" }));
    fireEvent.click(screen.getByLabelText("Durum"));

    await waitFor(() => {
      expect(screen.queryByRole("columnheader", { name: /Durum/i })).not.toBeInTheDocument();
    });
  });

  it("sends status='pre_registered' when the Onkayit tab is selected", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Onkayit" }));

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "pre_registered",
          page: 1,
          pageSize: 10,
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("sends status='graduated' when the Mezun tab is selected", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Mezun" }));

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "graduated",
          page: 1,
          pageSize: 10,
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("sends status='dropped' when the Dosya Yakan tab is selected", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Dosya Yakan" }));

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "dropped",
          page: 1,
          pageSize: 10,
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("renders only the search input and tabs; other filters are removed", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    // The search input is still there.
    expect(screen.getByPlaceholderText("Aday ara... (ad, soyad, TC)")).toBeInTheDocument();

    // Removed filter dropdowns should no longer be rendered.
    expect(screen.queryByLabelText("Lisans Sınıfı")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Grup Durumu")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Evrak")).not.toBeInTheDocument();

    // And the clear-filters button should not be present either.
    expect(screen.queryByRole("button", { name: /Filtreleri Temizle/i })).not.toBeInTheDocument();
  });

  it("keeps optional candidate columns hidden by default but lists them in the picker", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    expect(screen.queryByText("Telefon")).not.toBeInTheDocument();
    expect(screen.queryByText("E-posta")).not.toBeInTheDocument();
    expect(screen.queryByText("Kayıt Tarihi")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sütunlar" }));

    expect(screen.getByText("Telefon")).toBeInTheDocument();
    expect(screen.getByText("E-posta")).toBeInTheDocument();
    expect(screen.getByText("Kayıt Tarihi")).toBeInTheDocument();
    expect(screen.getByText("Güncelleme Tarihi")).toBeInTheDocument();
    expect(screen.getByText("Ehliyet Tipi")).toBeInTheDocument();
  });

  it("renders the group column with the term month in the same cell", async () => {
    getCandidatesMock.mockResolvedValue({
      items: [
        {
          id: "cand-1",
          firstName: "Ayse",
          lastName: "Demir",
          nationalId: "12345678901",
          phoneNumber: null,
          email: null,
          birthDate: null,
          gender: null,
          licenseClass: "B",
          status: "active",
          currentGroup: {
            groupId: "group-1",
            title: "1B",
            startDate: "2026-04-02",
            assignedAtUtc: "2026-04-01T10:00:00Z",
          },
          documentSummary: {
            completedCount: 1,
            missingCount: 0,
            totalRequiredCount: 1,
          },
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
        },
      ],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
    });

    renderPage();

    expect(await screen.findByText("1B-Nisan 2026")).toBeInTheDocument();
  });

  it("renders biometric photo when present and initials fallback otherwise", async () => {
    getCandidatesMock.mockResolvedValue({
      items: [
        {
          id: "cand-1",
          firstName: "Ayse",
          lastName: "Demir",
          nationalId: "12345678901",
          phoneNumber: null,
          email: null,
          birthDate: null,
          gender: null,
          licenseClass: "B",
          existingLicenseType: null,
          existingLicenseIssuedAt: null,
          existingLicenseNumber: null,
          existingLicenseIssuedProvince: null,
          existingLicensePre2016: false,
          status: "active",
          currentGroup: null,
          documentSummary: {
            completedCount: 1,
            missingCount: 0,
            totalRequiredCount: 1,
          },
          photo: {
            documentId: "doc-1",
            kind: "biometric_photo",
          },
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
        },
        {
          id: "cand-2",
          firstName: "Mehmet",
          lastName: "Kaya",
          nationalId: "12345678902",
          phoneNumber: null,
          email: null,
          birthDate: null,
          gender: null,
          licenseClass: "B",
          existingLicenseType: null,
          existingLicenseIssuedAt: null,
          existingLicenseNumber: null,
          existingLicenseIssuedProvince: null,
          existingLicensePre2016: false,
          status: "active",
          currentGroup: null,
          documentSummary: {
            completedCount: 0,
            missingCount: 1,
            totalRequiredCount: 1,
          },
          photo: null,
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
        },
      ],
      page: 1,
      pageSize: 10,
      totalCount: 2,
      totalPages: 1,
    });

    renderPage();

    const image = await screen.findByRole("img", { name: "Ayse Demir" });
    expect(image).toHaveAttribute(
      "src",
      "http://127.0.0.1:5080/api/candidates/cand-1/documents/doc-1/download"
    );
    expect(screen.getByText("MK")).toBeInTheDocument();
  });

  it("keeps bulk selection hidden until toggled from the toolbar", async () => {
    getCandidatesMock.mockResolvedValue({
      items: [
        {
          id: "cand-1",
          firstName: "Ayse",
          lastName: "Demir",
          nationalId: "12345678901",
          phoneNumber: null,
          email: null,
          birthDate: null,
          gender: null,
          licenseClass: "B",
          existingLicenseType: null,
          existingLicenseIssuedAt: null,
          existingLicenseNumber: null,
          existingLicenseIssuedProvince: null,
          existingLicensePre2016: false,
          status: "active",
          currentGroup: null,
          documentSummary: null,
          mebExamResult: null,
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
        },
      ],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
    });

    renderPage();

    await screen.findByText("Ayse Demir");
    expect(
      screen.queryByRole("checkbox", { name: "Bu sayfadaki tüm adayları seç" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Toplu Seçim" }));

    expect(screen.queryByRole("button", { name: "Yeni Aday" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dışa Aktar" })).not.toBeInTheDocument();
    expect(screen.getByText("0 seçili")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Bu sayfadaki tüm adayları seç" })
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Ayse Demir seç" })).toBeInTheDocument();
  });

  it("selects visible rows with the bulk selection header checkbox", async () => {
    getCandidatesMock.mockResolvedValue({
      items: [
        {
          id: "cand-1",
          firstName: "Ayse",
          lastName: "Demir",
          nationalId: "12345678901",
          phoneNumber: null,
          email: null,
          birthDate: null,
          gender: null,
          licenseClass: "B",
          existingLicenseType: null,
          existingLicenseIssuedAt: null,
          existingLicenseNumber: null,
          existingLicenseIssuedProvince: null,
          existingLicensePre2016: false,
          status: "active",
          currentGroup: null,
          documentSummary: null,
          mebExamResult: null,
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
        },
        {
          id: "cand-2",
          firstName: "Mehmet",
          lastName: "Kaya",
          nationalId: "12345678902",
          phoneNumber: null,
          email: null,
          birthDate: null,
          gender: null,
          licenseClass: "B",
          existingLicenseType: null,
          existingLicenseIssuedAt: null,
          existingLicenseNumber: null,
          existingLicenseIssuedProvince: null,
          existingLicensePre2016: false,
          status: "active",
          currentGroup: null,
          documentSummary: null,
          mebExamResult: "passed",
          createdAtUtc: "2026-04-01T10:00:00Z",
          updatedAtUtc: "2026-04-02T10:00:00Z",
        },
      ],
      page: 1,
      pageSize: 10,
      totalCount: 2,
      totalPages: 1,
    });

    renderPage();

    await screen.findByText("Ayse Demir");
    fireEvent.click(screen.getByRole("button", { name: "Toplu Seçim" }));

    const selectAll = screen.getByRole("checkbox", {
      name: "Bu sayfadaki tüm adayları seç",
    });

    fireEvent.click(selectAll);

    expect(screen.getByRole("checkbox", { name: "Ayse Demir seç" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Mehmet Kaya seç" })).toBeChecked();
  });

  it("applies bulk status update to selected candidates", async () => {
    const candidates = [
      {
        id: "cand-1",
        firstName: "Ayse",
        lastName: "Demir",
        nationalId: "12345678901",
        phoneNumber: null,
        email: null,
        birthDate: null,
        gender: null,
        licenseClass: "B",
        existingLicenseType: null,
        existingLicenseIssuedAt: null,
        existingLicenseNumber: null,
        existingLicenseIssuedProvince: null,
        existingLicensePre2016: false,
        status: "active",
        currentGroup: null,
        documentSummary: null,
        mebExamResult: null,
        createdAtUtc: "2026-04-01T10:00:00Z",
        updatedAtUtc: "2026-04-02T10:00:00Z",
      },
    ];

    getCandidatesMock.mockResolvedValue({
      items: candidates,
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
    });
    updateCandidateMock.mockResolvedValue(candidates[0]);

    renderPage();

    await screen.findByText("Ayse Demir");
    fireEvent.click(screen.getByRole("button", { name: "Toplu Seçim" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Ayse Demir seç" }));
    fireEvent.change(screen.getByLabelText("Toplu durum seç"), {
      target: { value: "parked" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Durumu Uygula" }));

    await waitFor(() => {
      expect(updateCandidateMock).toHaveBeenCalledWith(
        "cand-1",
        expect.objectContaining({
          status: "parked",
        })
      );
    });
  });
});

describe("CandidatesPage sorting", () => {
  beforeEach(() => {
    localStorage.clear();
    getCandidatesMock.mockReset();
    getCandidatesMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      totalCount: 0,
      totalPages: 1,
    });
  });

  it("does not send sort params on initial load", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    const callArgs = getCandidatesMock.mock.calls[0]?.[0];
    expect(callArgs.sortBy).toBeUndefined();
    expect(callArgs.sortDir).toBeUndefined();
  });

  it("cycles Ad Soyad header through asc → desc → unsorted", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    const header = screen.getByRole("button", { name: /Ad Soyad/ });

    // First click → ascending.
    fireEvent.click(header);
    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sortBy: "name",
          sortDir: "asc",
          page: 1,
        }),
        expect.any(AbortSignal)
      );
    });

    // Second click → descending.
    fireEvent.click(header);
    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sortBy: "name",
          sortDir: "desc",
          page: 1,
        }),
        expect.any(AbortSignal)
      );
    });

    // Third click → unsorted (no sort params).
    fireEvent.click(header);
    await waitFor(() => {
      const lastCall =
        getCandidatesMock.mock.calls[getCandidatesMock.mock.calls.length - 1]?.[0];
      expect(lastCall.sortBy).toBeUndefined();
      expect(lastCall.sortDir).toBeUndefined();
    });
  });

  it("sends sort params together with the active tab filter", async () => {
    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    // Switch away from the default "active" tab to prove sort+tab coexist.
    fireEvent.click(screen.getByRole("button", { name: "Mezun" }));
    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "graduated" }),
        expect.any(AbortSignal)
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /Grup/ }));
    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "graduated",
          sortBy: "groupTitle",
          sortDir: "asc",
          page: 1,
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("resets page to 1 when a new sort is applied", async () => {
    getCandidatesMock.mockResolvedValue({
      items: [],
      page: 2,
      pageSize: 10,
      totalCount: 25,
      totalPages: 3,
    });

    renderPage();
    await waitFor(() => expect(getCandidatesMock).toHaveBeenCalled());

    // Navigate to page 2.
    fireEvent.click(screen.getByRole("button", { name: /Sonraki/ }));
    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
        expect.any(AbortSignal)
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /TC Kimlik/ }));
    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sortBy: "nationalId",
          sortDir: "asc",
          page: 1,
        }),
        expect.any(AbortSignal)
      );
    });
  });
});
