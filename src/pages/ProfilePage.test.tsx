import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "../test/render-with-providers";
import { ProfilePage } from "./ProfilePage";

describe("ProfilePage", () => {
  it("shows profile identity without password controls", () => {
    renderWithProviders(<ProfilePage />);

    expect(screen.getAllByText("Test User")).toHaveLength(2);
    expect(screen.getByText("Telefon")).toBeInTheDocument();
    expect(screen.queryByText("Şifreyi Güncelle")).not.toBeInTheDocument();
  });

  it("shows theme selection as the second profile tab", () => {
    renderWithProviders(<ProfilePage />);

    fireEvent.click(screen.getByRole("button", { name: "Tema" }));

    expect(screen.getByText("Tema Seçimi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pilot/ })).toHaveAttribute("aria-pressed", "true");
  });
});
