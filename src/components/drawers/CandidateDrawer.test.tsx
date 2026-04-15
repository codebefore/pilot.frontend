import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CandidateDrawer } from "./CandidateDrawer";
import { renderWithProviders } from "../../test/render-with-providers";

const getCandidateByIdMock = vi.fn();
const updateCandidateMock = vi.fn();

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
        onStartMebJob={() => {}}
        onTakePayment={() => {}}
      />
    );

    await screen.findByRole("heading", { name: "Ada Yilmaz" });

    const editButtons = screen.getAllByRole("button", { name: "Düzenle" });
    fireEvent.click(editButtons[editButtons.length - 1]!);

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
        onStartMebJob={() => {}}
        onTakePayment={() => {}}
      />
    );

    expect(await screen.findByText("1B-Nisan 2026")).toBeInTheDocument();
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
        onStartMebJob={() => {}}
        onTakePayment={() => {}}
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
        onStartMebJob={() => {}}
        onTakePayment={() => {}}
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
        onStartMebJob={() => {}}
        onTakePayment={() => {}}
      />
    );

    await screen.findByRole("heading", { name: "Ada Yilmaz" });

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Mevcut sürücü belgesi var" })
    );
    await screen.findByLabelText("Mevcut Belge");
    fireEvent.change(screen.getByLabelText("Mevcut Belge"), {
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
    fireEvent.change(screen.getByLabelText("Belge Veriliş İli"), {
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
