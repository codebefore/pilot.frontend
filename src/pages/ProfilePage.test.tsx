import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { changePassword } from "../lib/auth-api";
import { renderWithProviders } from "../test/render-with-providers";
import { ProfilePage } from "./ProfilePage";

vi.mock("../lib/auth-api", () => ({
  changePassword: vi.fn(),
}));

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.mocked(changePassword).mockReset();
  });

  it("changes password and logs out after success", async () => {
    const logout = vi.fn();
    vi.mocked(changePassword).mockResolvedValue(undefined);

    renderWithProviders(<ProfilePage />, { auth: { logout } });

    fireEvent.change(screen.getByLabelText("Mevcut şifre"), { target: { value: "old-secret" } });
    fireEvent.change(screen.getByLabelText("Yeni şifre"), { target: { value: "new-secret" } });
    fireEvent.change(screen.getByLabelText("Yeni şifre tekrar"), { target: { value: "new-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Şifreyi Güncelle" }));

    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: "old-secret",
        newPassword: "new-secret",
      })
    );
    await waitFor(() => expect(logout).toHaveBeenCalled());
  });

  it("shows validation error when password confirmation does not match", () => {
    renderWithProviders(<ProfilePage />);

    fireEvent.change(screen.getByLabelText("Mevcut şifre"), { target: { value: "old-secret" } });
    fireEvent.change(screen.getByLabelText("Yeni şifre"), { target: { value: "new-secret" } });
    fireEvent.change(screen.getByLabelText("Yeni şifre tekrar"), { target: { value: "other-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Şifreyi Güncelle" }));

    expect(screen.getByText("Yeni şifreler eşleşmiyor")).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });
});
