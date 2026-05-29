import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../test/render-with-providers";
import { UsersPage } from "./UsersPage";

const getUsersMock = vi.fn();
const deleteUserMock = vi.fn();
const getRolesMock = vi.fn();

vi.mock("../lib/users-api", () => ({
  getUsers: (...args: unknown[]) => getUsersMock(...args),
  deleteUser: (...args: unknown[]) => deleteUserMock(...args),
  createUser: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("../lib/roles-api", () => ({
  getRoles: (...args: unknown[]) => getRolesMock(...args),
}));

describe("UsersPage", () => {
  beforeEach(() => {
    localStorage.clear();
    getUsersMock.mockReset();
    deleteUserMock.mockReset();
    getRolesMock.mockReset();

    getUsersMock.mockResolvedValue([
      {
        id: "user-1",
        fullName: "Ada Yilmaz",
        phone: "5551234567",
        roleId: "role-1",
        roleName: "Patron",
        isSuperAdmin: false,
        isActive: true,
        createdAtUtc: "2026-04-01T00:00:00Z",
        updatedAtUtc: "2026-04-01T00:00:00Z",
      },
    ]);
    getRolesMock.mockResolvedValue([
      {
        id: "role-1",
        name: "Patron",
        isActive: true,
        userCount: 1,
        createdAtUtc: "2026-04-01T00:00:00Z",
        updatedAtUtc: "2026-04-01T00:00:00Z",
      },
    ]);
    deleteUserMock.mockResolvedValue(undefined);
  });

  it("deletes a user with inline confirmation", async () => {
    renderWithProviders(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>
    );

    const row = await screen.findByText("Ada Yilmaz");
    const tableRow = row.closest("tr");
    expect(tableRow).not.toBeNull();

    fireEvent.click(within(tableRow as HTMLElement).getByRole("button", { name: "Sil" }));

    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(
      within(tableRow as HTMLElement).getByRole("button", { name: "Vazgeç" })
    ).toBeInTheDocument();

    fireEvent.click(within(tableRow as HTMLElement).getByRole("button", { name: "Sil" }));

    await waitFor(() => {
      expect(deleteUserMock).toHaveBeenCalledWith("user-1");
    });
    await waitFor(() => {
      expect(screen.queryByText("Ada Yilmaz")).not.toBeInTheDocument();
    });
  });

  it("does not expose email as a user column", async () => {
    renderWithProviders(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>
    );

    await screen.findByText("Ada Yilmaz");

    expect(screen.queryByRole("columnheader", { name: "E-posta" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Telefon" })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Sütunlar"));
    const picker = document.querySelector(".column-picker-menu") as HTMLElement | null;
    expect(picker).not.toBeNull();
    if (!picker) {
      throw new Error("column picker menu not found");
    }
    expect(within(picker).queryByLabelText("E-posta")).not.toBeInTheDocument();
  });
});
