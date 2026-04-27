import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../test/render-with-providers";
import { SettingsPage } from "./SettingsPage";

vi.mock("../components/settings/VehiclesSettingsSection", () => ({
  VehiclesSettingsSection: () => <div>Vehicles Section Mock</div>,
}));

vi.mock("../components/settings/InstructorsSettingsSection", () => ({
  InstructorsSettingsSection: () => <div>Instructors Section Mock</div>,
}));

vi.mock("../components/settings/LicenseClassDefinitionsSettingsSection", () => ({
  LicenseClassDefinitionsSettingsSection: () => <div>License Classes Section Mock</div>,
}));

vi.mock("../components/settings/RoutesSettingsSection", () => ({
  RoutesSettingsSection: () => <div>Routes Section Mock</div>,
}));

vi.mock("../components/settings/AreasSettingsSection", () => ({
  AreasSettingsSection: () => <div>Areas Section Mock</div>,
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
    expect(await screen.findByText("MEB Bağlantısı")).toBeInTheDocument();
    expect(screen.getByDisplayValue("sezer_mtsk")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Araçlar/i }));
    expect(screen.getByText("Vehicles Section Mock")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Ehliyet Tipleri/i }));
    expect(screen.getByText("License Classes Section Mock")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Eğitmenler/i }));
    expect(screen.getByText("Instructors Section Mock")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Güzergahlar/i }));
    expect(screen.getByText("Routes Section Mock")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Alanlar/i }));
    expect(screen.getByText("Areas Section Mock")).toBeInTheDocument();
  });
});
