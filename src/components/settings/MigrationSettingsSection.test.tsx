import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/render-with-providers";
import type { AuthUser } from "../../lib/auth-storage";
import { buildMigrationAccessStorageKey, writeMigrationAccess } from "../../lib/migration-access-storage";
import { MigrationSettingsSection } from "./MigrationSettingsSection";

vi.mock("./WenntecImportPanel", () => ({
  WenntecImportPanel: () => <div>Muhasebe aktarım paneli</div>,
}));

vi.mock("./WenntecContactImportPanel", () => ({
  WenntecContactImportPanel: () => <div>Aday iletişim aktarım paneli</div>,
}));

const tenantUser: AuthUser = {
  id: "tenant-user",
  phone: "5000000000",
  name: "Tenant User",
  roleName: "user",
  isSuperAdmin: false,
};

describe("MigrationSettingsSection permissions", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("shows only Wenntec to a payments-only user", () => {
    renderWithProviders(<MigrationSettingsSection />, {
      auth: { user: tenantUser, permissions: { payments: "full" } },
    });

    expect(screen.getByRole("tab", { name: "Wenntec" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "MEBBİS" })).not.toBeInTheDocument();
  });

  it("does not expose Wenntec to a MEBBIS-only user", () => {
    renderWithProviders(<MigrationSettingsSection />, {
      auth: { user: tenantUser, permissions: { mebjobs: "full" } },
    });

    expect(screen.getByRole("tab", { name: "MEBBIS" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Wenntec" })).not.toBeInTheDocument();
  });

  it("separates accounting and candidate contact imports into Wenntec tabs", () => {
    writeMigrationAccess(
      buildMigrationAccessStorageKey("tenant-user", "test-institution"),
      new Date(Date.now() + 60_000).toISOString(),
      "migration-token",
    );
    renderWithProviders(<MigrationSettingsSection />, {
      auth: { user: tenantUser, permissions: { payments: "full", candidates: "full" } },
    });

    expect(screen.getByRole("tab", { name: /Muhasebe Verileri/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Muhasebe aktarım paneli")).toBeInTheDocument();
    expect(screen.queryByText("Aday iletişim aktarım paneli")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Aday İletişim Bilgileri/ }));
    expect(screen.getByText("Aday iletişim aktarım paneli")).toBeInTheDocument();
    expect(screen.queryByText("Muhasebe aktarım paneli")).not.toBeInTheDocument();
  });
});
