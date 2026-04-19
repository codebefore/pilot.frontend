import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/render-with-providers";
import { UserFormModal } from "./UserFormModal";

const createUserMock = vi.fn();
const updateUserMock = vi.fn();

vi.mock("../../lib/users-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/users-api")>("../../lib/users-api");
  return {
    ...actual,
    createUser: (...args: Parameters<typeof actual.createUser>) => createUserMock(...args),
    updateUser: (...args: Parameters<typeof actual.updateUser>) => updateUserMock(...args),
  };
});

describe("UserFormModal", () => {
  beforeEach(() => {
    createUserMock.mockReset();
    updateUserMock.mockReset();
    createUserMock.mockResolvedValue({
      id: "user-2",
      fullName: "Kemal Can",
      email: null,
      phone: "5551234567",
      roleId: null,
      roleName: null,
      isSuperAdmin: false,
      isActive: true,
      createdAtUtc: "2026-04-01T00:00:00Z",
      updatedAtUtc: "2026-04-01T00:00:00Z",
    });
  });

  it("shows the current role as selected in edit mode", () => {
    renderWithProviders(
      <UserFormModal
        editing={{
          id: "user-1",
          fullName: "Ada Yilmaz",
          email: "ada@example.com",
          phone: "5551234567",
          roleId: "role-2",
          roleName: "Patron",
          isSuperAdmin: false,
          isActive: true,
          createdAtUtc: "2026-04-01T00:00:00Z",
          updatedAtUtc: "2026-04-01T00:00:00Z",
        }}
        onClose={() => {}}
        onSaved={() => {}}
        open
        roles={[
          {
            id: "role-1",
            name: "Müdür",
            isActive: true,
            userCount: 0,
            createdAtUtc: "2026-04-01T00:00:00Z",
            updatedAtUtc: "2026-04-01T00:00:00Z",
          },
          {
            id: "role-2",
            name: "Patron",
            isActive: true,
            userCount: 1,
            createdAtUtc: "2026-04-01T00:00:00Z",
            updatedAtUtc: "2026-04-01T00:00:00Z",
          },
        ]}
      />
    );

    expect(screen.getByRole("button", { name: "Patron" })).toBeInTheDocument();
  });

  it("submits null email and requires phone when creating a user", async () => {
    const onSaved = vi.fn();

    renderWithProviders(
      <UserFormModal
        editing={null}
        onClose={() => {}}
        onSaved={onSaved}
        open
        roles={[]}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Ad Soyad"), {
      target: { value: "Kemal Can" },
    });
    fireEvent.change(screen.getByPlaceholderText("5XXXXXXXXX"), {
      target: { value: "5551234567" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(createUserMock).toHaveBeenCalledWith({
        fullName: "Kemal Can",
        email: null,
        phone: "5551234567",
        roleId: null,
        isActive: true,
      });
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("shows a validation error when phone is missing", async () => {
    renderWithProviders(
      <UserFormModal
        editing={null}
        onClose={() => {}}
        onSaved={() => {}}
        open
        roles={[]}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Ad Soyad"), {
      target: { value: "Kemal Can" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    expect(await screen.findByText("Zorunlu alan")).toBeInTheDocument();
    expect(createUserMock).not.toHaveBeenCalled();
  });
});
