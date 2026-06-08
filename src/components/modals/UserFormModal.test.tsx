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
      phone: "5551234567",
      mebbisUsername: null,
      hasMebbisPassword: false,
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
          phone: "5551234567",
          mebbisUsername: "ada.mebbis",
          hasMebbisPassword: true,
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
    expect(screen.getByLabelText("MEBBİS Şifresi")).toHaveValue("********");
  });

  it("keeps the existing MEBBIS password when the mask is unchanged", async () => {
    const onSaved = vi.fn();
    updateUserMock.mockResolvedValue({
      id: "user-1",
      fullName: "Ada Yilmaz",
      phone: "5551234567",
      mebbisUsername: "ada.mebbis",
      hasMebbisPassword: true,
      roleId: null,
      roleName: null,
      isSuperAdmin: false,
      isActive: true,
      createdAtUtc: "2026-04-01T00:00:00Z",
      updatedAtUtc: "2026-04-01T00:00:00Z",
    });

    renderWithProviders(
      <UserFormModal
        editing={{
          id: "user-1",
          fullName: "Ada Yilmaz",
          phone: "5551234567",
          mebbisUsername: "ada.mebbis",
          hasMebbisPassword: true,
          roleId: null,
          roleName: null,
          isSuperAdmin: false,
          isActive: true,
          createdAtUtc: "2026-04-01T00:00:00Z",
          updatedAtUtc: "2026-04-01T00:00:00Z",
        }}
        onClose={() => {}}
        onSaved={onSaved}
        open
        roles={[]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith("user-1", {
        fullName: "Ada Yilmaz",
        phone: "5551234567",
        mebbisUsername: "ada.mebbis",
        mebbisPassword: null,
        roleId: null,
        isActive: true,
      });
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("puts the current phone into the edit input", async () => {
    const onSaved = vi.fn();
    updateUserMock.mockResolvedValue({
      id: "user-1",
      fullName: "Ada Yilmaz",
      phone: "5551234567",
      mebbisUsername: null,
      hasMebbisPassword: false,
      roleId: null,
      roleName: null,
      isSuperAdmin: false,
      isActive: true,
      createdAtUtc: "2026-04-01T00:00:00Z",
      updatedAtUtc: "2026-04-01T00:00:00Z",
    });

    renderWithProviders(
      <UserFormModal
        editing={{
          id: "user-1",
          fullName: "Ada Yilmaz",
          phone: "5551234567",
          mebbisUsername: null,
          hasMebbisPassword: false,
          roleId: null,
          roleName: null,
          isSuperAdmin: false,
          isActive: true,
          createdAtUtc: "2026-04-01T00:00:00Z",
          updatedAtUtc: "2026-04-01T00:00:00Z",
        }}
        onClose={() => {}}
        onSaved={onSaved}
        open
        roles={[]}
      />
    );

    const phoneInput = screen.getByPlaceholderText("5XX XXX XX XX") as HTMLInputElement;
    expect(phoneInput).toHaveValue("5551234567");

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith("user-1", {
        fullName: "Ada Yilmaz",
        phone: "5551234567",
        mebbisUsername: null,
        mebbisPassword: null,
        roleId: null,
        isActive: true,
      });
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("submits without email and requires phone when creating a user", async () => {
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
    fireEvent.change(screen.getByPlaceholderText("5XX XXX XX XX"), {
      target: { value: "5551234567" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(createUserMock).toHaveBeenCalledWith({
        fullName: "Kemal Can",
        phone: "5551234567",
        mebbisUsername: null,
        mebbisPassword: null,
        roleId: null,
        isActive: true,
      });
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("limits user phone input to 10 digits", async () => {
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
    const phoneInput = screen.getByPlaceholderText("5XX XXX XX XX");
    fireEvent.change(phoneInput, {
      target: { value: "555 123 45 6789" },
    });

    expect(phoneInput).toHaveValue("5551234567");

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(createUserMock).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: "5551234567",
        })
      );
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

  it("does not submit when opened without manage permission", async () => {
    renderWithProviders(
      <UserFormModal
        canManage={false}
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
    fireEvent.change(screen.getByPlaceholderText("5XX XXX XX XX"), {
      target: { value: "5551234567" },
    });

    const saveButton = screen.getByRole("button", { name: "Kaydet" });
    expect(saveButton).toBeDisabled();
    expect(saveButton).toHaveAttribute("title", "Yetkiniz yok.");

    const form = document.querySelector("form");
    if (!form) throw new Error("form not found");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(createUserMock).not.toHaveBeenCalled();
    });
    expect(updateUserMock).not.toHaveBeenCalled();
  });
});
