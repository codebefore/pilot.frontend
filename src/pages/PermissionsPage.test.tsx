import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PermissionsPage } from "./PermissionsPage";
import { renderWithProviders } from "../test/render-with-providers";

const getRolesMock = vi.fn();
const getPermissionAreasMock = vi.fn();
const getRolePermissionsMock = vi.fn();
const saveRolePermissionsMock = vi.fn();
const deleteRoleMock = vi.fn();

vi.mock("../lib/roles-api", () => ({
  getRoles: (...args: unknown[]) => getRolesMock(...args),
  getPermissionAreas: (...args: unknown[]) => getPermissionAreasMock(...args),
  getRolePermissions: (...args: unknown[]) => getRolePermissionsMock(...args),
  saveRolePermissions: (...args: unknown[]) => saveRolePermissionsMock(...args),
  deleteRole: (...args: unknown[]) => deleteRoleMock(...args),
  createRole: vi.fn(),
  updateRole: vi.fn(),
}));

describe("PermissionsPage", () => {
  beforeEach(() => {
    getRolesMock.mockReset();
    getPermissionAreasMock.mockReset();
    getRolePermissionsMock.mockReset();
    saveRolePermissionsMock.mockReset();
    deleteRoleMock.mockReset();

    getRolesMock.mockResolvedValue([
      {
        id: "role-1",
        name: "Patron",
        isActive: true,
        userCount: 1,
        createdAtUtc: "2026-01-01T00:00:00Z",
        updatedAtUtc: "2026-01-01T00:00:00Z",
      },
      {
        id: "role-2",
        name: "Müdür",
        isActive: true,
        userCount: 0,
        createdAtUtc: "2026-01-02T00:00:00Z",
        updatedAtUtc: "2026-01-02T00:00:00Z",
      },
    ]);
    getPermissionAreasMock.mockResolvedValue({
      areas: ["users"],
      levels: ["view", "full"],
    });
    getRolePermissionsMock.mockImplementation((roleId: string) =>
      Promise.resolve(
        roleId === "role-1"
          ? [{ area: "users", level: "full" }]
          : [{ area: "users", level: "view" }]
      )
    );
    saveRolePermissionsMock.mockResolvedValue([]);
    deleteRoleMock.mockResolvedValue(undefined);
  });

  it("allows switching roles from the side list", async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/permissions"]}>
        <PermissionsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getRolesMock).toHaveBeenCalled();
      expect(getPermissionAreasMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(getRolePermissionsMock).toHaveBeenCalledWith(
        "role-2",
        expect.any(AbortSignal)
      );
    });

    const patronRoleButton = await screen.findByRole("button", { name: "Patron rolü" });
    fireEvent.click(patronRoleButton);

    await waitFor(() => {
      expect(getRolePermissionsMock).toHaveBeenLastCalledWith(
        "role-1",
        expect.any(AbortSignal)
      );
    });

    expect(patronRoleButton).toHaveAttribute("aria-pressed", "true");
  });

  it("deletes the selected role with inline confirmation", async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/permissions"]}>
        <PermissionsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getRolePermissionsMock).toHaveBeenCalledWith(
        "role-2",
        expect.any(AbortSignal)
      );
    });

    const deleteButton = await screen.findByRole("button", { name: "Sil" });
    fireEvent.click(deleteButton);

    expect(deleteRoleMock).not.toHaveBeenCalled();
    expect(
      screen.getByText(/"Müdür" silinsin mi\?/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sil" }));

    await waitFor(() => {
      expect(deleteRoleMock).toHaveBeenCalledWith("role-2");
    });
  });
});
