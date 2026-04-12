import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GroupDrawer } from "./GroupDrawer";
import { renderWithProviders } from "../../test/render-with-providers";

const getGroupByIdMock = vi.fn();

vi.mock("../../lib/groups-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/groups-api")>("../../lib/groups-api");
  return {
    ...actual,
    getGroupById: (...args: Parameters<typeof actual.getGroupById>) => getGroupByIdMock(...args),
    updateGroup: vi.fn(),
  };
});

vi.mock("../../lib/candidates-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/candidates-api")>("../../lib/candidates-api");
  return {
    ...actual,
    getCandidates: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 }),
    assignCandidateGroup: vi.fn(),
    removeActiveGroupAssignment: vi.fn(),
  };
});

describe("GroupDrawer", () => {
  beforeEach(() => {
    getGroupByIdMock.mockReset();
  });

  it("shows candidate add action for active groups", async () => {
    getGroupByIdMock.mockResolvedValue({
      id: "group-1",
      title: "B Sinifi - Nisan 2026",
      status: "active",
      licenseClass: "B",
      termName: "Nisan 2026",
      capacity: 20,
      assignedCandidateCount: 1,
      activeCandidateCount: 0,
      startDate: "2026-04-10",
      endDate: "2026-05-10",
      mebStatus: "created",
      createdAtUtc: "2026-04-12T10:00:00Z",
      updatedAtUtc: "2026-04-12T10:00:00Z",
      activeCandidates: [],
    });

    renderWithProviders(<GroupDrawer groupId="group-1" onClose={() => {}} />);

    expect(await screen.findByRole("button", { name: "Aday Ekle" })).toBeInTheDocument();
  });

  it("hides candidate add action for completed groups", async () => {
    getGroupByIdMock.mockResolvedValue({
      id: "group-1",
      title: "B Sinifi - Nisan 2026",
      status: "completed",
      licenseClass: "B",
      termName: "Nisan 2026",
      capacity: 20,
      assignedCandidateCount: 1,
      activeCandidateCount: 0,
      startDate: "2026-04-10",
      endDate: "2026-05-10",
      mebStatus: "closed",
      createdAtUtc: "2026-04-12T10:00:00Z",
      updatedAtUtc: "2026-04-12T10:00:00Z",
      activeCandidates: [],
    });

    renderWithProviders(<GroupDrawer groupId="group-1" onClose={() => {}} />);

    await screen.findByText("B Sinifi - Nisan 2026");
    expect(screen.queryByRole("button", { name: "Aday Ekle" })).not.toBeInTheDocument();
  });
});
