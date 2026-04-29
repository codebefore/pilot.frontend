import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RoleEditorPage } from "./RoleEditorPage";
import { renderWithProviders } from "../test/render-with-providers";

const createRoleMock = vi.fn();
const getRolesMock = vi.fn();
const updateRoleMock = vi.fn();

vi.mock("../lib/roles-api", () => ({
  createRole: (...args: unknown[]) => createRoleMock(...args),
  getRoles: (...args: unknown[]) => getRolesMock(...args),
  updateRole: (...args: unknown[]) => updateRoleMock(...args),
}));

describe("RoleEditorPage", () => {
  beforeEach(() => {
    createRoleMock.mockReset();
    getRolesMock.mockReset();
    updateRoleMock.mockReset();

    createRoleMock.mockResolvedValue({
      id: "role-9",
      name: "Operasyon",
      isActive: true,
      userCount: 0,
      createdAtUtc: "2026-01-01T00:00:00Z",
      updatedAtUtc: "2026-01-01T00:00:00Z",
    });
  });

  it("creates a role and navigates back to permissions", async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/settings/definitions/permissions/roles/new"]}>
        <Routes>
          <Route
            element={<RoleEditorPage />}
            path="/settings/definitions/permissions/roles/new"
          />
          <Route element={<div>Permissions home</div>} path="/settings/definitions/permissions" />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText("Örn. Eğitim Koordinatörü"), {
      target: { value: "Operasyon" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(createRoleMock).toHaveBeenCalledWith({
        name: "Operasyon",
        isActive: true,
      });
    });
  });
});
