import { fireEvent, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../test/render-with-providers";
import { SettingsPage } from "./SettingsPage";

vi.mock("../components/settings/GeneralInstitutionSection", () => ({
  GeneralInstitutionSection: () => <div>General Section Mock</div>,
}));

vi.mock("../components/settings/VehiclesSettingsSection", () => ({
  VehiclesSettingsSection: () => <div>Vehicles Section Mock</div>,
}));

vi.mock("../components/settings/InstructorsSettingsSection", () => ({
  InstructorsSettingsSection: () => <div>Instructors Section Mock</div>,
}));

vi.mock("../components/settings/LicenseClassDefinitionsSettingsSection", () => ({
  LicenseClassDefinitionsSettingsSection: () => <div>License Classes Section Mock</div>,
}));

vi.mock("../components/settings/TrainingBranchesSettingsSection", () => ({
  TrainingBranchesSettingsSection: () => <div>Training Branches Section Mock</div>,
}));

vi.mock("../components/settings/ClassroomsSettingsSection", () => ({
  ClassroomsSettingsSection: () => <div>Classrooms Section Mock</div>,
}));

vi.mock("./DocumentTypesPage", () => ({
  DocumentTypesPage: () => <div>Document Types Section Mock</div>,
}));

vi.mock("./UsersPage", () => ({
  UsersPage: () => <div>Users Section Mock</div>,
}));

vi.mock("./PermissionsPage", () => ({
  PermissionsPage: () => <div>Permissions Section Mock</div>,
}));

vi.mock("./RoleEditorPage", () => ({
  RoleEditorPage: () => <div>Role Editor Section Mock</div>,
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

    expect(await screen.findByText("General Section Mock")).toBeInTheDocument();
  });

  it("navigates between section routes", async () => {
    renderSettingsPage();

    fireEvent.click(screen.getByRole("link", { name: /Araçlar/i }));
    expect(screen.getByText("Vehicles Section Mock")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Ehliyet Tipleri/i }));
    expect(screen.getByText("License Classes Section Mock")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Branşlar/i }));
    expect(screen.getByText("Training Branches Section Mock")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Derslikler/i }));
    expect(screen.getByText("Classrooms Section Mock")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Evrak Türleri/i }));
    expect(screen.getByText("Document Types Section Mock")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Eğitmenler/i }));
    expect(screen.getByText("Instructors Section Mock")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Kullanıcılar/i }));
    expect(screen.getByText("Users Section Mock")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Yetki Yönetimi/i }));
    expect(screen.getByText("Permissions Section Mock")).toBeInTheDocument();
  });
});
