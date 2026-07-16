import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "../../test/render-with-providers";
import type { AuthUser } from "../../lib/auth-storage";
import { MigrationSettingsSection } from "./MigrationSettingsSection";

const tenantUser: AuthUser = {
  id: "tenant-user",
  phone: "5000000000",
  name: "Tenant User",
  roleName: "user",
  isSuperAdmin: false,
};

describe("MigrationSettingsSection permissions", () => {
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
});
