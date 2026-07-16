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

vi.mock("../components/settings/LicenseClassFeeMatrixSettingsSection", () => ({
  LicenseClassFeeMatrixSettingsSection: ({ mode }: { mode: string }) => (
    <div>Fee Matrix {mode} Mock</div>
  ),
}));

vi.mock("../components/settings/TrainingBranchesSettingsSection", () => ({
  TrainingBranchesSettingsSection: () => <div>Training Branches Section Mock</div>,
}));

vi.mock("../components/settings/ClassroomsSettingsSection", () => ({
  ClassroomsSettingsSection: () => <div>Classrooms Section Mock</div>,
}));

vi.mock("../components/settings/ReferencesSettingsSection", () => ({
  ReferencesSettingsSection: ({ variant = "references" }: { variant?: string }) => (
    <div>{variant === "routes" ? "Routes Section Mock" : "References Section Mock"}</div>
  ),
}));

vi.mock("../components/settings/MigrationSettingsSection", () => ({
  MigrationSettingsSection: () => <div>Migration Section Mock</div>,
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

function renderSettingsPage(
  initialPath = "/settings/general",
  auth?: NonNullable<Parameters<typeof renderWithProviders>[1]>["auth"]
) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<SettingsPage />} path="/settings/*" />
      </Routes>
    </MemoryRouter>,
    { auth }
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

    fireEvent.click(screen.getByRole("link", { name: /Güzergahlar/i }));
    expect(screen.getByText("Routes Section Mock")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Derslikler/i }));
    expect(screen.getByText("Classrooms Section Mock")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Evrak Türleri/i }));
    expect(screen.getByText("Document Types Section Mock")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Personel/i }));
    expect(screen.getByText("Instructors Section Mock")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Kullanıcılar/i }));
    expect(screen.getByText("Users Section Mock")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Migration/i }));
    expect(screen.getByText("Migration Section Mock")).toBeInTheDocument();
  });

  it("opens the default fees nav item on institution fees", async () => {
    renderSettingsPage();

    fireEvent.click(screen.getByRole("link", { name: /Varsayılan Ücretler/i }));

    expect(screen.getByText("Fee Matrix institution Mock")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Kurum Ayarları" })).not.toBeInTheDocument();
  });

  it("redirects the legacy fees route to institution fees", async () => {
    renderSettingsPage("/settings/definitions/fees");

    expect(await screen.findByText("Fee Matrix institution Mock")).toBeInTheDocument();
  });

  it("renders contract fees as a fullscreen fees route", async () => {
    renderSettingsPage("/settings/definitions/fees/contract");

    expect(await screen.findByText("Fee Matrix contract Mock")).toBeInTheDocument();
    expect(screen.queryByText("Kurum Ayarları")).not.toBeInTheDocument();
  });

  it("redirects the legacy permissions route to the users permissions tab", async () => {
    renderSettingsPage("/settings/definitions/permissions");

    expect(await screen.findByText("Users Section Mock")).toBeInTheDocument();
  });

  it("redirects unauthorized settings routes to the first permitted section", async () => {
    renderSettingsPage("/settings/general", {
      user: {
        id: "training-user",
        phone: "5000000001",
        name: "Training User",
        roleName: "Eğitim",
        isSuperAdmin: false,
      },
      permissions: { training: "view" },
    });

    expect(await screen.findByText("Instructors Section Mock")).toBeInTheDocument();
    expect(screen.queryByText("General Section Mock")).not.toBeInTheDocument();
  });

  it("shows only settings nav links allowed by the active permissions", async () => {
    renderSettingsPage("/settings/definitions/instructors", {
      user: {
        id: "training-user",
        phone: "5000000001",
        name: "Training User",
        roleName: "Eğitim",
        isSuperAdmin: false,
      },
      permissions: { training: "view" },
    });

    expect(await screen.findByText("Instructors Section Mock")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Personel/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Araçlar/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Branşlar/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Derslikler/i })).toBeInTheDocument();

    expect(screen.queryByRole("link", { name: /Genel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Kullanıcılar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Evrak Türleri/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Finans Ayarları/i })).not.toBeInTheDocument();
  });

  it("allows candidate users to access reference definitions without general settings permission", async () => {
    renderSettingsPage("/settings/definitions/references", {
      user: {
        id: "candidate-user",
        phone: "5000000002",
        name: "Candidate User",
        roleName: "Aday",
        isSuperAdmin: false,
      },
      permissions: { candidates: "view" },
    });

    expect(await screen.findByText("References Section Mock")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Referanslar/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Güzergahlar/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Genel/i })).not.toBeInTheDocument();
  });

  it("allows payments users to access migration settings", async () => {
    renderSettingsPage("/settings/definitions/migration", {
      user: {
        id: "payments-user",
        phone: "5000000004",
        name: "Payments User",
        roleName: "Muhasebe",
        isSuperAdmin: false,
      },
      permissions: { payments: "full" },
    });

    expect(await screen.findByText("Migration Section Mock")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Migration/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Genel/i })).not.toBeInTheDocument();
  });

  it("hides document type settings from non-super-admin document users", async () => {
    renderSettingsPage("/settings/definitions/document-types", {
      user: {
        id: "document-user",
        phone: "5000000003",
        name: "Document User",
        roleName: "Evrak",
        isSuperAdmin: false,
      },
      permissions: { documents: "full", settings: "view" },
    });

    expect(await screen.findByText("General Section Mock")).toBeInTheDocument();
    expect(screen.queryByText("Document Types Section Mock")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Evrak Türleri/i })).not.toBeInTheDocument();
  });
});
