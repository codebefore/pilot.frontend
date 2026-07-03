import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GroupDrawer } from "./GroupDrawer";
import { renderWithProviders } from "../../test/render-with-providers";
import { ApiError } from "../../lib/http";

const navigateMock = vi.hoisted(() => vi.fn());
const getGroupByIdMock = vi.fn();
const deleteGroupMock = vi.fn();
const getCandidatesMock = vi.fn();
const getCandidateDocumentsMock = vi.fn();
const updateGroupMock = vi.fn();
const assignCandidateGroupMock = vi.fn();
const removeActiveGroupAssignmentMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

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

vi.mock("../../lib/documents-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/documents-api")>("../../lib/documents-api");
  return {
    ...actual,
    getCandidateDocuments: (...args: Parameters<typeof actual.getCandidateDocuments>) =>
      getCandidateDocumentsMock(...args),
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
    getCandidateDocumentsMock.mockReset();
    updateGroupMock.mockReset();
    assignCandidateGroupMock.mockReset();
    removeActiveGroupAssignmentMock.mockReset();
    navigateMock.mockReset();
    getCandidatesMock.mockResolvedValue({ items: [], page: 1, pageSize: 100, totalCount: 0, totalPages: 0 });
    getCandidateDocumentsMock.mockResolvedValue([]);
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

  it("keeps group mutation panels closed when actions are disabled", async () => {
    getGroupByIdMock.mockResolvedValue(buildGroup());
    renderWithProviders(
      <GroupDrawer groupId="group-1" canManageGroups={false} onClose={() => {}} />
    );

    const deleteButton = await screen.findByRole("button", { name: "Grup Sil" });
    const addCandidateButton = screen.getByRole("button", { name: "Aday Ekle" });

    expect(deleteButton).toBeDisabled();
    expect(deleteButton).toHaveAttribute("title", "Yetkiniz yok.");
    expect(addCandidateButton).toBeDisabled();
    expect(addCandidateButton).toHaveAttribute("title", "Yetkiniz yok.");

    fireEvent.click(deleteButton);
    fireEvent.click(addCandidateButton);

    expect(screen.queryByRole("button", { name: "Evet, Sil" })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("İsim, TC veya telefon ara...")).not.toBeInTheDocument();
    expect(deleteGroupMock).not.toHaveBeenCalled();
    expect(assignCandidateGroupMock).not.toHaveBeenCalled();
  });

  it("still shows candidate add action when meb status is sent", async () => {
    getGroupByIdMock.mockResolvedValue(buildGroup({ mebStatus: "sent" }));
    renderWithProviders(<GroupDrawer groupId="group-1" onClose={() => {}} />);
    expect(await screen.findByRole("button", { name: "Aday Ekle" })).toBeInTheDocument();
  });

  it("renders MEB transfer count summary in the drawer details", async () => {
    getGroupByIdMock.mockResolvedValue(buildGroup({
      mebStatus: "sent",
      activeCandidates: [
        {
          candidateId: "candidate-synced",
          firstName: "Ayse",
          lastName: "Yilmaz",
          nationalId: "12345678901",
          phoneNumber: null,
          status: "active",
          mebSyncStatus: "synced",
          assignedAtUtc: "2026-04-12T10:00:00Z",
        },
        {
          candidateId: "candidate-waiting",
          firstName: "Mehmet",
          lastName: "Demir",
          nationalId: "12345678902",
          phoneNumber: null,
          status: "active",
          mebSyncStatus: "not_synced",
          assignedAtUtc: "2026-04-12T10:00:00Z",
        },
      ],
    }));
    getCandidateDocumentsMock.mockImplementation((candidateId: string) => {
      if (candidateId === "candidate-synced") {
        return Promise.resolve([
          {
            id: "doc-1",
            candidateId,
            documentTypeId: "doc-type-1",
            documentTypeKey: "health_report",
            documentTypeName: "Sağlık Raporu",
            originalFileName: null,
            contentType: null,
            fileSizeBytes: null,
            isPhysicallyAvailable: true,
            isMebbisTransferred: true,
            hasFile: false,
            note: null,
            metadata: {},
            uploadedAtUtc: "2026-04-12T10:00:00Z",
            createdAtUtc: "2026-04-12T10:00:00Z",
            updatedAtUtc: "2026-04-12T10:00:00Z",
          },
        ]);
      }
      return Promise.resolve([]);
    });

    renderWithProviders(<GroupDrawer groupId="group-1" onClose={() => {}} />);

    expect(await screen.findByText("NİSAN 2026 - 1A")).toBeInTheDocument();
    expect(screen.getByText("MEB Durumu")).toBeInTheDocument();
    expect(await screen.findByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("Ayse Yilmaz").closest(".candidate-list-row"))
      .toHaveClass("is-mebbis-transferred");
    expect(screen.getByText("Mehmet Demir").closest(".candidate-list-row"))
      .not.toHaveClass("is-mebbis-transferred");
    expect(screen.queryByText("Gönderildi")).not.toBeInTheDocument();
    expect(screen.queryByText("Gönderilmedi")).not.toBeInTheDocument();
    expect(updateGroupMock).not.toHaveBeenCalled();
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

  it("blocks group deletion when an assigned candidate was sent to MEBBIS", async () => {
    getGroupByIdMock.mockResolvedValue(buildGroup({
      activeCandidates: [
        {
          candidateId: "candidate-1",
          firstName: "Ayse",
          lastName: "Demir",
          nationalId: "10000000146",
          phoneNumber: null,
          photo: null,
          status: "active",
          mebSyncStatus: "synced",
          assignedAtUtc: "2026-04-12T10:00:00Z",
        },
      ],
    }));
    deleteGroupMock.mockResolvedValue(undefined);

    renderWithProviders(<GroupDrawer groupId="group-1" onClose={() => {}} />);

    fireEvent.click(await screen.findByRole("button", { name: "Grup Sil" }));
    fireEvent.click(screen.getByRole("button", { name: "Evet, Sil" }));

    expect(
      await screen.findByText("MEBBIS'e gönderilmiş aday bulunan grup silinemez.")
    ).toBeInTheDocument();
    expect(deleteGroupMock).not.toHaveBeenCalled();
  });

  it("checks all group candidate pages before deleting", async () => {
    getGroupByIdMock.mockResolvedValue(buildGroup({ activeCandidateCount: 101 }));
    getCandidatesMock
      .mockResolvedValueOnce({
        items: Array.from({ length: 100 }, (_, index) => ({
          id: `candidate-${index + 1}`,
          mebSyncStatus: "not_synced",
        })),
        page: 1,
        pageSize: 100,
        totalCount: 101,
        totalPages: 2,
      })
      .mockResolvedValueOnce({
        items: [{ id: "candidate-101", mebSyncStatus: "synced" }],
        page: 2,
        pageSize: 100,
        totalCount: 101,
        totalPages: 2,
      });
    deleteGroupMock.mockResolvedValue(undefined);

    renderWithProviders(<GroupDrawer groupId="group-1" onClose={() => {}} />);

    fireEvent.click(await screen.findByRole("button", { name: "Grup Sil" }));
    fireEvent.click(screen.getByRole("button", { name: "Evet, Sil" }));

    expect(
      await screen.findByText("MEBBIS'e gönderilmiş aday bulunan grup silinemez.")
    ).toBeInTheDocument();
    expect(getCandidatesMock).toHaveBeenCalledWith(
      expect.objectContaining({ groupIds: ["group-1"], page: 2, pageSize: 100 })
    );
    expect(deleteGroupMock).not.toHaveBeenCalled();
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
    fireEvent.change(screen.getByPlaceholderText("İsim, TC veya telefon ara..."), {
      target: { value: "A" },
    });

    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(getCandidatesMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Sonuç bulunamadı.")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("İsim, TC veya telefon ara..."), {
      target: { value: "Ay" },
    });

    await waitFor(() => {
      expect(getCandidatesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          search: "Ay",
          pageSize: 100,
        }),
        expect.any(AbortSignal)
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
            nationalId: "10000000146",
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
          nationalId: "10000000146",
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
      pageSize: 100,
      totalCount: 1,
      totalPages: 1,
    });

    renderWithProviders(<GroupDrawer groupId="group-1" onClose={() => {}} />);

    fireEvent.click(await screen.findByRole("button", { name: "Aday Ekle" }));
    fireEvent.change(screen.getByPlaceholderText("İsim, TC veya telefon ara..."), {
      target: { value: "Ay" },
    });

    const candidateButton = await screen.findByRole("button", { name: /Ayse Demir/ });
    fireEvent.click(candidateButton);

    await waitFor(() => {
      expect(assignCandidateGroupMock).toHaveBeenCalledWith("candidate-transfer", "group-1");
      expect(getGroupByIdMock).toHaveBeenCalledTimes(2);
    });
  });

  it("shows assigned candidates with an avatar and opens candidate detail when clicked", async () => {
    getGroupByIdMock.mockResolvedValue(buildGroup({
      activeCandidates: [
        {
          candidateId: "candidate-1",
          firstName: "Ayse",
          lastName: "Demir",
          nationalId: "10000000146",
          phoneNumber: null,
          photo: null,
          status: "active",
          assignedAtUtc: "2026-04-12T10:00:00Z",
        },
      ],
    }));

    renderWithProviders(<GroupDrawer groupId="group-1" onClose={() => {}} />);

    const candidateButton = await screen.findByRole("button", { name: /Ayse Demir/ });
    expect(screen.getByText("AD")).toBeInTheDocument();

    fireEvent.click(candidateButton);

    expect(navigateMock).toHaveBeenCalledWith("/candidates/candidate-1");
  });

  it("asks for confirmation before removing an assigned candidate", async () => {
    const groupWithCandidate = buildGroup({
      activeCandidates: [
        {
          candidateId: "candidate-1",
          firstName: "Ayse",
          lastName: "Demir",
          nationalId: "10000000146",
          phoneNumber: null,
          photo: null,
          status: "active",
          assignedAtUtc: "2026-04-12T10:00:00Z",
        },
      ],
    });
    getGroupByIdMock.mockResolvedValue(groupWithCandidate);

    renderWithProviders(<GroupDrawer groupId="group-1" onClose={() => {}} />);

    fireEvent.click(await screen.findByTitle("Gruptan Çıkar"));

    const popover = screen.getByRole("alertdialog", {
      name: "Aday gruptan çıkarılsın mı?",
    });
    expect(within(popover).getByText("Ayse Demir gruptan çıkarılsın mı?")).toBeInTheDocument();
    expect(removeActiveGroupAssignmentMock).not.toHaveBeenCalled();

    fireEvent.click(within(popover).getByRole("button", { name: "Vazgeç" }));
    expect(screen.queryByRole("alertdialog", { name: "Aday gruptan çıkarılsın mı?" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Gruptan Çıkar"));
    fireEvent.click(
      within(
        screen.getByRole("alertdialog", {
          name: "Aday gruptan çıkarılsın mı?",
        })
      ).getByRole("button", { name: "Evet, çıkar" })
    );

    await waitFor(() => {
      expect(removeActiveGroupAssignmentMock).toHaveBeenCalledWith("candidate-1");
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
