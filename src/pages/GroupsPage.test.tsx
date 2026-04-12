import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GroupsPage } from "./GroupsPage";
import { renderWithProviders } from "../test/render-with-providers";

const getGroupsMock = vi.fn();

vi.mock("../lib/groups-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/groups-api")>("../lib/groups-api");
  return {
    ...actual,
    getGroups: (...args: Parameters<typeof actual.getGroups>) => getGroupsMock(...args),
    getGroupById: vi.fn(),
    updateGroup: vi.fn(),
  };
});

vi.mock("../components/modals/NewGroupModal", () => ({
  NewGroupModal: () => null,
}));

vi.mock("../components/drawers/GroupDrawer", () => ({
  GroupDrawer: () => null,
}));

describe("GroupsPage", () => {
  beforeEach(() => {
    getGroupsMock.mockReset();
    getGroupsMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 12,
      totalCount: 0,
      totalPages: 1,
    });
  });

  it("sends canonical english status and mebStatus filters", async () => {
    renderWithProviders(<GroupsPage />);

    await waitFor(() => {
      expect(getGroupsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "active",
          page: 1,
          pageSize: 12,
        }),
        expect.any(AbortSignal)
      );
    });

    fireEvent.change(screen.getByLabelText("MEB Durumu"), {
      target: { value: "created" },
    });

    await waitFor(() => {
      expect(getGroupsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "active",
          mebStatus: "created",
          page: 1,
          pageSize: 12,
        }),
        expect.any(AbortSignal)
      );
    });
  });
});
