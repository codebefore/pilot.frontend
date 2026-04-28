import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GroupDrawer } from "./GroupDrawer";
import { renderWithProviders } from "../../test/render-with-providers";
import { ApiError } from "../../lib/http";

const getGroupByIdMock = vi.fn();
const deleteGroupMock = vi.fn();
const getCandidatesMock = vi.fn();
const updateGroupMock = vi.fn();
const assignCandidateGroupMock = vi.fn();
const removeActiveGroupAssignmentMock = vi.fn();

vi.mock("../../lib/groups-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/groups-api")>("../../lib/groups-api");
  return {
    ...actual,
    getGroupById: (...args: Parameters<typeof actual.getGroupById>) => getGroupByIdMock(...args),
    updateGroup: (...args: Parameters<typeof actual.updateGroup>) => updateGroupMock(...args),
    deleteGroup: (...args: [string]) => deleteGroupMock(...args),
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

vi.mock("../../lib/candidates-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/candidates-api")>("../../lib/candidates-api");
  return {
    ...actual,
    getCandidates: (...args: Parameters<typeof actual.getCandidates>) => getCandidatesMock(...args),
    assignCandidateGroup: (...args: Parameters<typeof actual.assignCandidateGroup>) =>
      assignCandidateGroupMock(...args),
    removeActiveGroupAssignment: (...args: Parameters<typeof actual.removeActiveGroupAssignment>) =>
      removeActiveGroupAssignmentMock(...args),
  };
});

function buildGroup(overrides: Record<string, unknown> = {}) {
  return {
    id: "group-1",
    title: "1A",
    term: {
      id: "term-1",
      monthDate: "2026-04-01",
      sequence: 1,
      name: null,
    },
    capacity: 20,
    assignedCandidateCount: 1,
    activeCandidateCount: 0,
    startDate: "2026-04-10",
    mebStatus: "sent",
    createdAtUtc: "2026-04-12T10:00:00Z",
    updatedAtUtc: "2026-04-12T10:00:00Z",
    rowVersion: 1,
    activeCandidates: [],
    ...overrides,
  };
}

describe("GroupDrawer", () => {
  beforeEach(() => {
    deleteGroupMock.mockReset();
    getGroupByIdMock.mockReset();
    getCandidatesMock.mockReset();
    updateGroupMock.mockReset();
    assignCandidateGroupMock.mockReset();
    removeActiveGroupAssignmentMock.mockReset();
    getCandidatesMock.mockResolvedValue({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 });
    assignCandidateGroupMock.mockResolvedValue({
      id: "assignment-1",
      candidateId: "candidate-transfer",
      groupId: "group-1",
      groupTitle: "1A",
      startDate: "2026-04-10",
      assignedAtUtc: "2026-04-12T10:00:00Z",
      removedAtUtc: null,
      isActive: true,
    });
    removeActiveGroupAssignmentMock.mockResolvedValue(undefined);
  });

  it("shows candidate add action when group loads", async () => {
    getGroupByIdMock.mockResolvedValue(buildGroup());
    renderWithProviders(<GroupDrawer groupId="group-1" onClose={() => {}} />);
    expect(await screen.findByRole("button", { name: "Aday Ekle" })).toBeInTheDocument();
  });

  it("still shows candidate add action when meb status is sent", async () => {
    getGroupByIdMock.mockResolvedValue(buildGroup({ mebStatus: "sent" }));
    renderWithProviders(<GroupDrawer groupId="group-1" onClose={() => {}} />);
    expect(await screen.findByRole("button", { name: "Aday Ekle" })).toBeInTheDocument();
  });

  it("renders the group code with the term label in the drawer title", async () => {
    getGroupByIdMock.mockResolvedValue(buildGroup({ title: "2B" }));
    renderWithProviders(<GroupDrawer groupId="group-1" onClose={() => {}} />);
    expect(
      await screen.findByRole("heading", { name: "NİSAN 2026 - 2B" })
    );
  });

  it("shows delete action and deletes the group after confirmation", async () => {
    const onDeleted = vi.fn();
    getGroupByIdMock.mockResolvedValue(buildGroup());
    deleteGroupMock.mockResolvedValue(undefined);

    renderWithProviders(<GroupDrawer groupId="group-1" onClose={() => {}} onDeleted={onDeleted} />);

    fireEvent.click(await screen.findByRole("button", { name: "Grup Sil" }));
    fireEvent.click(screen.getByRole("button", { name: "Evet, Sil" }));

    await waitFor(() => {
      expect(deleteGroupMock).toHaveBeenCalledWith("group-1");
      expect(onDeleted).toHaveBeenCalled();
    });
  });

  it("shows backend validation error when the group cannot be deleted", async () => {
    getGroupByIdMock.mockResolvedValue(buildGroup());
    deleteGroupMock.mockRejectedValue(
      new ApiError(400, "Bad Request", {
        group: ["Group cannot be deleted while it still has active candidates."],
      })
    );

    renderWithProviders(<GroupDrawer groupId="group-1" onClose={() => {}} />);

    fireEvent.click(await screen.findByRole("button", { name: "Grup Sil" }));
    fireEvent.click(screen.getByRole("button", { name: "Evet, Sil" }));

    expect(
      await screen.findByText("Group cannot be deleted while it still has active candidates.")
    ).toBeInTheDocument();
  });

  it("does not search candidates until the second character in the add-candidate search", async () => {
    getGroupByIdMock.mockResolvedValue(buildGroup());
    renderWithProviders(<GroupDrawer groupId="group-1" onClose={() => {}} />);

    fireEvent.click(await screen.findByRole("button", { name: "Aday Ekle" }));
    fireEvent.change(screen.getByPlaceholderText("İsim veya TC ara..."), {
      target: { value: "A" },
    });

    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(getCandidatesMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Sonuç bulunamadı.")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("İsim veya TC ara..."), {
      target: { value: "Ay" },
    });

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          search: "Ay",
          pageSize: 20,
        })
      );
    });
  });

  it("adds a searched candidate to the group through the transfer endpoint", async () => {
    getGroupByIdMock
      .mockResolvedValueOnce(buildGroup())
      .mockResolvedValueOnce(buildGroup({
        activeCandidates: [
          {
            candidateId: "candidate-transfer",
            firstName: "Ayse",
            lastName: "Demir",
            nationalId: "22222222222",
            assignedAtUtc: "2026-04-12T10:00:00Z",
          },
        ],
      }));
    getCandidatesMock.mockResolvedValue({
      items: [
        {
          id: "candidate-transfer",
          firstName: "Ayse",
          lastName: "Demir",
          nationalId: "22222222222",
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
            groupId: "old-group",
            title: "1B",
            startDate: "2026-03-10",
            term: {
              id: "term-old",
              monthDate: "2026-03-01",
              sequence: 1,
              name: null,
            },
            assignedAtUtc: "2026-03-01T10:00:00Z",
          },
          documentSummary: null,
          createdAtUtc: "2026-04-12T10:00:00Z",
          updatedAtUtc: "2026-04-12T10:00:00Z",
          rowVersion: 1,
        },
      ],
      page: 1,
      pageSize: 20,
      totalCount: 1,
      totalPages: 1,
    });

    renderWithProviders(<GroupDrawer groupId="group-1" onClose={() => {}} />);

    fireEvent.click(await screen.findByRole("button", { name: "Aday Ekle" }));
    fireEvent.change(screen.getByPlaceholderText("İsim veya TC ara..."), {
      target: { value: "Ay" },
    });

    const candidateButton = await screen.findByRole("button", { name: /Ayse Demir/ });
    fireEvent.click(candidateButton);

    await waitFor(() => {
      expect(assignCandidateGroupMock).toHaveBeenCalledWith("candidate-transfer", "group-1");
      expect(getGroupByIdMock).toHaveBeenCalledTimes(2);
    });
  });

  it("updates the group title from selected number and branch", async () => {
    updateGroupMock.mockResolvedValue(buildGroup({ title: "3C" }));
    getGroupByIdMock.mockResolvedValue(buildGroup({ title: "1A" }));

    renderWithProviders(<GroupDrawer groupId="group-1" onClose={() => {}} />);

    const editButtons = await screen.findAllByTitle("Düzenle");
    fireEvent.click(editButtons[0]!);

    const selects = document.body.querySelectorAll("select");
    fireEvent.change(selects[0]!, { target: { value: "3" } });
    fireEvent.change(selects[1]!, { target: { value: "C" } });
    fireEvent.click(screen.getByTitle("Kaydet"));

    await waitFor(() => {
      expect(updateGroupMock).toHaveBeenCalledWith(
        "group-1",
        expect.objectContaining({
          groupNumber: 3,
          groupBranch: "C",
          rowVersion: 1,
        })
      );
    });
  });

  it("does not offer title code editing for legacy group titles", async () => {
    getGroupByIdMock.mockResolvedValue(buildGroup({ title: "B Sinifi - Hizlandirilmis" }));

    renderWithProviders(<GroupDrawer groupId="group-1" onClose={() => {}} />);

    const titleValue = await screen.findByText("B Sinifi - Hizlandirilmis");
    const titleRow = titleValue.closest(".drawer-row");
    expect(titleRow).not.toBeNull();
    expect(within(titleRow as HTMLElement).queryByTitle("Düzenle")).not.toBeInTheDocument();
  });
});
