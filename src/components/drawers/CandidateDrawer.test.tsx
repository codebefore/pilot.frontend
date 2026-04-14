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

    await screen.findByText("Ada Yilmaz");

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
});
