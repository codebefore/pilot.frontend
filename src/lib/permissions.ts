import type { AuthUser } from "./auth-storage";

export type PermissionLevel = "view" | "full";
export type PermissionMap = Record<string, PermissionLevel>;

export const settingsPermissionAreas = [
  "settings",
  "candidates",
  "users",
  "permissions",
  "training",
  "payments",
  "documents",
  "documentTypes",
  "mebjobs",
] as const;

export function canViewArea(
  user: AuthUser | null,
  permissions: PermissionMap,
  area: string
): boolean {
  if (user?.isSuperAdmin) return true;
  return permissions[area] === "view" || permissions[area] === "full";
}

export function canManageArea(
  user: AuthUser | null,
  permissions: PermissionMap,
  area: string
): boolean {
  if (user?.isSuperAdmin) return true;
  return permissions[area] === "full";
}

export function canViewAnyArea(
  user: AuthUser | null,
  permissions: PermissionMap,
  areas: readonly string[]
): boolean {
  return areas.some((area) => canViewArea(user, permissions, area));
}

export function firstAllowedTenantPath(
  user: AuthUser | null,
  permissions: PermissionMap
): string | null {
  const candidates = [
    { path: "/", areas: ["dashboard"] },
    { path: "/candidates", areas: ["candidates"] },
    { path: "/documents", areas: ["documents"] },
    { path: "/groups", areas: ["groups"] },
    { path: "/exams/e-sinav", areas: ["groups"] },
    { path: "/training/teorik", areas: ["training"] },
    { path: "/payments/balances", areas: ["payments"] },
    { path: "/meb-jobs", areas: ["mebjobs"] },
    { path: "/settings", areas: settingsPermissionAreas },
  ] as const;

  return candidates.find((candidate) => canViewAnyArea(user, permissions, candidate.areas))?.path ?? null;
}
