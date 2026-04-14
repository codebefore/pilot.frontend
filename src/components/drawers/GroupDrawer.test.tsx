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
    getCandidates: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 }),
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
    mebStatus: "created",
    createdAtUtc: "2026-04-12T10:00:00Z",
    updatedAtUtc: "2026-04-12T10:00:00Z",
    activeCandidates: [],
    ...overrides,
  };
}

describe("GroupDrawer", () => {
  beforeEach(() => {
    getGroupByIdMock.mockReset();
  });

  it("shows candidate add action when group loads", async () => {
    getGroupByIdMock.mockResolvedValue(buildGroup());
    renderWithProviders(<GroupDrawer groupId="group-1" onClose={() => {}} />);
    expect(await screen.findByRole("button", { name: "Aday Ekle" })).toBeInTheDocument();
  });

  it("still shows candidate add action when meb status is closed", async () => {
    getGroupByIdMock.mockResolvedValue(buildGroup({ mebStatus: "closed" }));
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
});
