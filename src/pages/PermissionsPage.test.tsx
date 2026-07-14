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
      {
        id: "role-3",
        name: "Pasif Rol",
        isActive: false,
        userCount: 0,
        createdAtUtc: "2026-01-03T00:00:00Z",
        updatedAtUtc: "2026-01-03T00:00:00Z",
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
      <MemoryRouter initialEntries={["/settings/definitions/permissions"]}>
        <PermissionsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getRolesMock).toHaveBeenCalledWith(
        { includeInactive: false },
        expect.any(AbortSignal)
      );
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
    expect(screen.queryByRole("button", { name: "Pasif Rol rolü" })).not.toBeInTheDocument();
  });

  it("shows dashboard as Kokpit and renders subpages with their parent page", async () => {
    getPermissionAreasMock.mockResolvedValue({
      areas: ["payments", "dashboard", "documents", "groups", "candidates", "users"],
      levels: ["view", "full"],
    });
    getRolePermissionsMock.mockResolvedValue([
      { area: "dashboard", level: "view" },
      { area: "payments", level: "full" },
    ]);

    renderWithProviders(
      <MemoryRouter initialEntries={["/settings/definitions/permissions"]}>
        <PermissionsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(document.querySelectorAll(".permissions-row-title").length).toBeGreaterThan(0);
    });

    const labels = Array.from(document.querySelectorAll(".permissions-row-title")).map(
      (item) => item.textContent
    );

    expect(labels).toEqual([
      "Kokpit",
      "Bildirimler",
      "Adaylar",
      "Aday Detayı",
      "Dönemler",
      "E-Sınav",
      "Direksiyon",
      "Evrak Kontrol",
      "Tahsilatlar",
      "Bakiyeler",
      "Kasalar",
      "Faturalar",
      "İstatistikler",
      "Kullanıcılar",
      "Referanslar",
      "Güzergahlar",
      "Varsayılan Ücretler",
      "Finans Ayarları",
    ]);

    const eSinavRow = Array.from(document.querySelectorAll(".permissions-row"))
      .find((row) => row.querySelector(".permissions-row-title")?.textContent === "E-Sınav");
    expect(eSinavRow?.querySelector(".permissions-row-parent")).toHaveTextContent("Sınavlar");

    const dashboardRow = Array.from(document.querySelectorAll(".permissions-row"))
      .find((row) => row.querySelector(".permissions-row-title")?.textContent === "Kokpit");
    expect(dashboardRow?.querySelector(".permissions-row-parent")).toBeNull();

    const candidatesRow = Array.from(document.querySelectorAll(".permissions-row"))
      .find((row) => row.querySelector(".permissions-row-title")?.textContent === "Adaylar");
    expect(candidatesRow?.querySelector(".permissions-row-parent")).toBeNull();

    const candidateDetailRow = Array.from(document.querySelectorAll(".permissions-row"))
      .find((row) => row.querySelector(".permissions-row-title")?.textContent === "Aday Detayı");
    expect(candidateDetailRow?.querySelector(".permissions-row-parent")).toHaveTextContent("Adaylar");

    const notificationsRow = Array.from(document.querySelectorAll(".permissions-row"))
      .find((row) => row.querySelector(".permissions-row-title")?.textContent === "Bildirimler");
    expect(notificationsRow?.querySelector(".permissions-row-parent")).toHaveTextContent("Kokpit");

    const collectionsRow = Array.from(document.querySelectorAll(".permissions-row"))
      .find((row) => row.querySelector(".permissions-row-title")?.textContent === "Tahsilatlar");
    expect(collectionsRow?.querySelector(".permissions-row-parent")).toHaveTextContent("Finans");

    const usersRow = Array.from(document.querySelectorAll(".permissions-row"))
      .find((row) => row.querySelector(".permissions-row-title")?.textContent === "Kullanıcılar");
    expect(usersRow?.querySelector(".permissions-row-parent")).toHaveTextContent("Kurum Ayarları");
  });

  it("deletes the selected role with inline confirmation", async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/settings/definitions/permissions"]}>
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

  it("keeps role mutation actions disabled for permissions view-only users", async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/settings/definitions/permissions"]}>
        <PermissionsPage />
      </MemoryRouter>,
      {
        auth: {
          user: {
            id: "permissions-viewer",
            phone: "5073737262",
            name: "Permissions Viewer",
            roleName: "Yetki İzleme",
            isSuperAdmin: false,
          },
          permissions: { permissions: "view" },
        },
      }
    );

    await waitFor(() => {
      expect(getRolePermissionsMock).toHaveBeenCalledWith(
        "role-2",
        expect.any(AbortSignal)
      );
    });

    const newButton = screen.getByRole("button", { name: /Yeni Rol/i });
    const editButton = screen.getByRole("button", { name: "Rolü Düzenle" });
    const deleteButton = screen.getByRole("button", { name: "Sil" });

    for (const button of [newButton, editButton, deleteButton]) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("title", "Yetkiniz yok.");
      fireEvent.click(button);
    }

    expect(screen.queryByText(/"Müdür" silinsin mi\?/i)).not.toBeInTheDocument();
    expect(deleteRoleMock).not.toHaveBeenCalled();
  });
});
