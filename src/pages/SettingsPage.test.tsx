import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../test/render-with-providers";
import { SettingsPage } from "./SettingsPage";

vi.mock("../components/settings/VehiclesSettingsSection", () => ({
  VehiclesSettingsSection: () => <div>Vehicles Section Mock</div>,
}));

function renderSettingsPage(initialPath = "/settings/general") {
  return renderWithProviders(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<SettingsPage />} path="/settings/*" />
      </Routes>
    </MemoryRouter>
  );
}

describe("SettingsPage", () => {
  it("redirects /settings to the general section", async () => {
    renderSettingsPage("/settings");

    expect(await screen.findByText("Kurum Bilgileri")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Sezer Surucu Kursu")).toBeInTheDocument();
  });

  it("enables save after a form change and disables it again after saving", async () => {
    renderSettingsPage();

    const saveButton = screen.getByRole("button", { name: "Kaydet" });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByDisplayValue("Sezer Surucu Kursu"), {
      target: { value: "Sezer Akademi" },
    });

    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(saveButton).toBeDisabled();
    });
  });

  it("navigates between section routes", async () => {
    renderSettingsPage();

    fireEvent.click(screen.getByRole("link", { name: /Entegrasyonlar/i }));
    expect(await screen.findByText("MEB Baglantisi")).toBeInTheDocument();
    expect(screen.getByDisplayValue("sezer_mtsk")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Araclar/i }));
    expect(screen.getByText("Vehicles Section Mock")).toBeInTheDocument();
  });
});
