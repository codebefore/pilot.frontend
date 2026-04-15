import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GroupDrawer } from "./GroupDrawer";
import { renderWithProviders } from "../../test/render-with-providers";
import { ApiError } from "../../lib/http";

const getGroupByIdMock = vi.fn();
const deleteGroupMock = vi.fn();
const getCandidatesMock = vi.fn();

vi.mock("../../lib/groups-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/groups-api")>("../../lib/groups-api");
  return {
    ...actual,
    getGroupById: (...args: Parameters<typeof actual.getGroupById>) => getGroupByIdMock(...args),
    updateGroup: vi.fn(),
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
    assignCandidateGroup: vi.fn(),
    removeActiveGroupAssignment: vi.fn(),
  };
});

function buildGroup(overrides: Record<string, unknown> = {}) {
  return {
    id: "group-1",
    title: "1A",
    licenseClass: "B",
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
    activeCandidates: [],
    ...overrides,
  };
}

describe("GroupDrawer", () => {
  beforeEach(() => {
    deleteGroupMock.mockReset();
    getGroupByIdMock.mockReset();
    getCandidatesMock.mockReset();
    getCandidatesMock.mockResolvedValue({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 });
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

  it("keeps arbitrary group names in the drawer title", async () => {
    getGroupByIdMock.mockResolvedValue(buildGroup({ title: "B Sinifi - Hizlandirilmis" }));
    renderWithProviders(<GroupDrawer groupId="group-1" onClose={() => {}} />);
    expect(
      await screen.findByRole("heading", { name: /B Sinifi - Hizlandirilmis/ })
    ).toBeInTheDocument();
  });

  it("deduplicates a legacy term suffix in the drawer title", async () => {
    getGroupByIdMock.mockResolvedValue(
      buildGroup({ title: "1C Sinifi - Nisan 2026", licenseClass: "C" })
    );
    renderWithProviders(<GroupDrawer groupId="group-1" onClose={() => {}} />);
    expect(
      await screen.findByRole("heading", { name: "1C Sinifi — Nisan 2026 - (C)" })
    ).toBeInTheDocument();
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
});
