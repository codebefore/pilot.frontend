import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CandidateDrawer } from "./CandidateDrawer";
import { renderWithProviders } from "../../test/render-with-providers";

const getCandidateByIdMock = vi.fn();
const updateCandidateMock = vi.fn();

function getHiddenSelect(ariaLabel: string) {
  return document.querySelector(
    `select[aria-label="${ariaLabel}"]`
  ) as HTMLSelectElement | null;
}

vi.mock("../../lib/candidates-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/candidates-api")>("../../lib/candidates-api");
  return {
    ...actual,
    getCandidateById: (...args: Parameters<typeof actual.getCandidateById>) => getCandidateByIdMock(...args),
    updateCandidate: (...args: Parameters<typeof actual.updateCandidate>) => updateCandidateMock(...args),
    assignCandidateGroup: vi.fn(),
    removeActiveGroupAssignment: vi.fn(),
    deleteCandidate: vi.fn(),
  };
});

vi.mock("../../lib/groups-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/groups-api")>("../../lib/groups-api");
  return {
    ...actual,
    getGroups: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 100, totalCount: 0, totalPages: 0 }),
  };
});

vi.mock("../../lib/terms-api", () => ({
  getTerms: vi.fn().mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 200,
    totalCount: 0,
    totalPages: 0,
  }),
  getTermById: vi.fn(),
  createTerm: vi.fn(),
  updateTerm: vi.fn(),
  deleteTerm: vi.fn(),
}));

vi.mock("../../lib/documents-api", () => ({
  getDocumentChecklist: vi.fn().mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 1,
    totalCount: 0,
    totalPages: 1,
  }),
  getDocumentTypes: vi.fn().mockResolvedValue([]),
  getCandidateDocuments: vi.fn().mockResolvedValue([]),
  uploadDocument: vi.fn(),
}));

describe("CandidateDrawer", () => {
  beforeEach(() => {
    getCandidateByIdMock.mockReset();
    updateCandidateMock.mockReset();

    getCandidateByIdMock.mockResolvedValue({
      id: "candidate-1",
      firstName: "Ada",
      lastName: "Yilmaz",
      nationalId: "11111111111",
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
      createdAtUtc: "2026-04-12T10:00:00Z",
      updatedAtUtc: "2026-04-12T10:00:00Z",
    });

    updateCandidateMock.mockResolvedValue({
      id: "candidate-1",
      firstName: "Ada",
      lastName: "Yilmaz",
      nationalId: "11111111111",
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
      status: "graduated",
      currentGroup: null,
      documentSummary: null,
      createdAtUtc: "2026-04-12T10:00:00Z",
      updatedAtUtc: "2026-04-12T10:10:00Z",
    });
  });

  it("saves only canonical english candidate status values", async () => {
    renderWithProviders(
      <CandidateDrawer
        candidateId="candidate-1"
        onClose={() => {}}
        onDeleted={() => {}}
      />
    );

    await screen.findByRole("heading", { name: "Ada Yilmaz" });

    const statusLabel = screen.getAllByText("Durum").find(
      (node) => node.classList.contains("label")
    );
    const statusRow = statusLabel?.closest(".drawer-row");
    expect(statusRow).not.toBeNull();
    fireEvent.click(statusRow!.querySelector('button[title="Düzenle"]') as HTMLButtonElement);

    const statusSelect = await screen.findByDisplayValue("Aktif");
    fireEvent.change(statusSelect, { target: { value: "graduated" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateCandidateMock).toHaveBeenCalledWith(
        "candidate-1",
        expect.objectContaining({
          status: "graduated",
        })
      );
    });
  });

  it("saves canonical english gender values and renders the Turkish label", async () => {
    getCandidateByIdMock.mockResolvedValue({
      id: "candidate-1",
      firstName: "Ada",
      lastName: "Yilmaz",
      nationalId: "11111111111",
      phoneNumber: null,
      email: null,
      birthDate: null,
      // Canonical value from the backend — must render as "Kadın".
      gender: "female",
      licenseClass: "B",
      existingLicenseType: null,
      existingLicenseIssuedAt: null,
      existingLicenseNumber: null,
      existingLicenseIssuedProvince: null,
      existingLicensePre2016: false,
      status: "active",
      currentGroup: null,
      documentSummary: null,
      createdAtUtc: "2026-04-12T10:00:00Z",
      updatedAtUtc: "2026-04-12T10:00:00Z",
    });

    renderWithProviders(
      <CandidateDrawer
        candidateId="candidate-1"
        onClose={() => {}}
        onDeleted={() => {}}
      />
    );

    await screen.findByRole("heading", { name: "Ada Yilmaz" });

    // Turkish label is rendered for the canonical "female" value.
    expect(screen.getByText("Kadın")).toBeInTheDocument();

    const genderLabel = screen
      .getAllByText("Cinsiyet")
      .find((node) => node.classList.contains("label"));
    const genderRow = genderLabel?.closest(".drawer-row");
    expect(genderRow).not.toBeNull();
    fireEvent.click(
      genderRow!.querySelector('button[title="Düzenle"]') as HTMLButtonElement
    );

    const genderSelect = await screen.findByDisplayValue("Kadın");
    fireEvent.change(genderSelect, { target: { value: "male" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateCandidateMock).toHaveBeenCalledWith(
        "candidate-1",
        expect.objectContaining({
          gender: "male",
        })
      );
    });
  });

  it("renders the group row as group plus term month", async () => {
    getCandidateByIdMock.mockResolvedValue({
      id: "candidate-1",
      firstName: "Ada",
      lastName: "Yilmaz",
      nationalId: "11111111111",
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
      currentGroup: {
        groupId: "group-1",
        title: "1B",
        startDate: "2026-04-02",
        term: {
          id: "term-2",
          monthDate: "2026-04-01",
          sequence: 2,
          name: null,
        },
        assignedAtUtc: "2026-04-01T10:00:00Z",
      },
      documentSummary: null,
      createdAtUtc: "2026-04-12T10:00:00Z",
      updatedAtUtc: "2026-04-12T10:00:00Z",
    });

    renderWithProviders(
      <CandidateDrawer
        candidateId="candidate-1"
        onClose={() => {}}
        onDeleted={() => {}}
      />
    );

    expect(await screen.findByText("NİSAN 2026 / 2 - 1B")).toBeInTheDocument();
  });

  it("renders candidate profile photo in the drawer when available", async () => {
    getCandidateByIdMock.mockResolvedValue({
      id: "candidate-1",
      firstName: "Ada",
      lastName: "Yilmaz",
      nationalId: "11111111111",
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
      photo: {
        documentId: "doc-1",
        kind: "biometric_photo",
      },
      createdAtUtc: "2026-04-12T10:00:00Z",
      updatedAtUtc: "2026-04-12T10:00:00Z",
    });

    renderWithProviders(
      <CandidateDrawer
        candidateId="candidate-1"
        onClose={() => {}}
        onDeleted={() => {}}
      />
    );

    const image = await screen.findByRole("img", { name: "Ada Yilmaz" });
    expect(image).toHaveAttribute(
      "src",
      "http://127.0.0.1:5080/api/candidates/candidate-1/documents/doc-1/download"
    );
  });

  it("shows formatted phone number under the name and links it to WhatsApp", async () => {
    getCandidateByIdMock.mockResolvedValue({
      id: "candidate-1",
      firstName: "Ada",
      lastName: "Yilmaz",
      nationalId: "11111111111",
      phoneNumber: "05321234567",
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
      createdAtUtc: "2026-04-12T10:00:00Z",
      updatedAtUtc: "2026-04-12T10:00:00Z",
    });

    renderWithProviders(
      <CandidateDrawer
        candidateId="candidate-1"
        onClose={() => {}}
        onDeleted={() => {}}
      />
    );

    const whatsappLink = await screen.findByRole("link", { name: "0 532 123 45 67" });
    expect(whatsappLink).toHaveAttribute("href", "https://wa.me/905321234567");
  });

  it("saves existing license fields as one grouped payload", async () => {
    updateCandidateMock.mockResolvedValue({
      id: "candidate-1",
      firstName: "Ada",
      lastName: "Yilmaz",
      nationalId: "11111111111",
      phoneNumber: null,
      email: null,
      birthDate: null,
      gender: null,
      licenseClass: "B",
      existingLicenseType: "b_auto",
      existingLicenseIssuedAt: "2018-03-04",
      existingLicenseNumber: "12345",
      existingLicenseIssuedProvince: "Ankara",
      existingLicensePre2016: true,
      status: "active",
      currentGroup: null,
      documentSummary: null,
      createdAtUtc: "2026-04-12T10:00:00Z",
      updatedAtUtc: "2026-04-12T10:10:00Z",
    });

    renderWithProviders(
      <CandidateDrawer
        candidateId="candidate-1"
        onClose={() => {}}
        onDeleted={() => {}}
      />
    );

    await screen.findByRole("heading", { name: "Ada Yilmaz" });
    expect(screen.queryByLabelText("Mevcut Belge")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Mevcut sürücü belgesi var" })
    );
    await waitFor(() => {
      expect(getHiddenSelect("Mevcut Belge")).not.toBeNull();
    });

    const existingLicenseTypeSelect = getHiddenSelect("Mevcut Belge");
    fireEvent.change(existingLicenseTypeSelect!, {
      target: { value: "b_auto" },
    });
    const existingLicenseIssuedAtInput = document.querySelector(
      'input[type="date"]'
    );
    expect(existingLicenseIssuedAtInput).not.toBeNull();
    fireEvent.change(existingLicenseIssuedAtInput!, {
      target: { value: "2018-03-04" },
    });
    fireEvent.change(screen.getByLabelText("Belge No"), {
      target: { value: " 12345 " },
    });

    const existingLicenseProvinceSelect = getHiddenSelect("Belge Veriliş İli");
    expect(existingLicenseProvinceSelect).not.toBeNull();
    fireEvent.change(existingLicenseProvinceSelect!, {
      target: { value: "Ankara" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "2016 Ocak öncesi" }));
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateCandidateMock).toHaveBeenCalledWith(
        "candidate-1",
        expect.objectContaining({
          existingLicenseType: "b_auto",
          existingLicenseIssuedAt: "2018-03-04",
          existingLicenseNumber: "12345",
          existingLicenseIssuedProvince: "Ankara",
          existingLicensePre2016: true,
        })
      );
    });
  });
});
