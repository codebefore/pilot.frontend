import { describe, expect, it } from "vitest";

import {
  canManageArea,
  canViewAnyArea,
  canViewArea,
  firstAllowedTenantPath,
  settingsPermissionAreas,
  type PermissionMap,
} from "./permissions";
import type { AuthUser } from "./auth-storage";

const regularUser: AuthUser = {
  id: "user-1",
  phone: "5000000001",
  name: "Regular User",
  roleName: "Personel",
  isSuperAdmin: false,
};

const superAdmin: AuthUser = {
  ...regularUser,
  id: "super-admin",
  roleName: "super_admin",
  isSuperAdmin: true,
};

describe("permissions", () => {
  it("allows view access for view and full levels", () => {
    const permissions: PermissionMap = {
      candidates: "view",
      payments: "full",
    };

    expect(canViewArea(regularUser, permissions, "candidates")).toBe(true);
    expect(canViewArea(regularUser, permissions, "payments")).toBe(true);
    expect(canViewArea(regularUser, permissions, "documents")).toBe(false);
  });

  it("allows management access only for full level", () => {
    const permissions: PermissionMap = {
      candidates: "view",
      payments: "full",
    };

    expect(canManageArea(regularUser, permissions, "candidates")).toBe(false);
    expect(canManageArea(regularUser, permissions, "payments")).toBe(true);
    expect(canManageArea(regularUser, permissions, "documents")).toBe(false);
  });

  it("treats super admin as allowed for every area", () => {
    expect(canViewArea(superAdmin, {}, "unknown")).toBe(true);
    expect(canManageArea(superAdmin, {}, "unknown")).toBe(true);
    expect(canViewAnyArea(superAdmin, {}, ["dashboard", "payments"])).toBe(true);
  });

  it("finds any viewable area from a list", () => {
    expect(canViewAnyArea(regularUser, { training: "view" }, ["payments", "training"])).toBe(true);
    expect(canViewAnyArea(regularUser, { training: "view" }, ["payments", "documents"])).toBe(false);
  });

  it("returns the first allowed tenant path in navigation priority order", () => {
    expect(firstAllowedTenantPath(regularUser, { documents: "view", candidates: "view" })).toBe("/candidates");
    expect(firstAllowedTenantPath(regularUser, { payments: "view" })).toBe("/payments/balances");
    expect(firstAllowedTenantPath(regularUser, { training: "view" })).toBe("/training/teorik");
    expect(firstAllowedTenantPath(regularUser, { candidates: "view" })).toBe("/candidates");
    expect(firstAllowedTenantPath(regularUser, { users: "view" })).toBe("/settings");
    expect(firstAllowedTenantPath(regularUser, {})).toBeNull();
  });

  it("allows settings shell access for candidate-owned reference definitions", () => {
    expect(settingsPermissionAreas).toContain("candidates");
    expect(canViewAnyArea(regularUser, { candidates: "view" }, settingsPermissionAreas)).toBe(true);
  });
});
