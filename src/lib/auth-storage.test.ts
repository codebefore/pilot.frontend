import { beforeEach, describe, expect, it } from "vitest";

import {
  clearStoredAuthSession,
  readStoredAuthSession,
  updateStoredActiveInstitutionPermissions,
  updateStoredActiveInstitutionRoleName,
  updateStoredInstitutionName,
  updateStoredUserProfile,
  writeStoredAuthSession,
  type AuthSession,
} from "./auth-storage";

const validSession: AuthSession = {
  accessToken: "token-a",
  expiresAtUtc: new Date(Date.now() + 60_000).toISOString(),
  refreshToken: "refresh-a",
  refreshTokenExpiresAtUtc: new Date(Date.now() + 14 * 24 * 60 * 60_000).toISOString(),
  user: {
    id: "user-1",
    phone: "5551112233",
    name: "Test User",
    roleName: "Kurum Yöneticisi",
    isSuperAdmin: false,
  },
  institutions: [
    {
      id: "institution-1",
      name: "Pilot Kurum",
      roleName: "Kurum Yöneticisi",
      isDefault: true,
      permissions: { dashboard: "view", candidates: "full" },
    },
  ],
  activeInstitution: {
    id: "institution-1",
    name: "Pilot Kurum",
    roleName: "Kurum Yöneticisi",
    isDefault: true,
    permissions: { dashboard: "view", candidates: "full" },
  },
};

describe("auth storage", () => {
  beforeEach(() => {
    clearStoredAuthSession();
  });

  it("reads and writes the multi-tenant session shape", () => {
    writeStoredAuthSession(validSession);

    expect(readStoredAuthSession()).toEqual(validSession);
  });

  it("clears old sessions that do not contain institution state", () => {
    localStorage.setItem(
      "pilot.auth",
      JSON.stringify({
        accessToken: "legacy-token",
        expiresAtUtc: new Date(Date.now() + 60_000).toISOString(),
        user: validSession.user,
      })
    );

    expect(readStoredAuthSession()).toBeNull();
    expect(localStorage.getItem("pilot.auth")).toBeNull();
  });

  it("clears malformed stored sessions", () => {
    localStorage.setItem("pilot.auth", "{not-json");

    expect(readStoredAuthSession()).toBeNull();
    expect(localStorage.getItem("pilot.auth")).toBeNull();
  });

  it("clears sessions whose active institution is not in memberships", () => {
    writeStoredAuthSession({
      ...validSession,
      activeInstitution: {
        id: "missing-institution",
        name: "Missing Kurum",
        roleName: "Personel",
        isDefault: false,
        permissions: { candidates: "view" },
      },
    });

    expect(readStoredAuthSession()).toBeNull();
    expect(localStorage.getItem("pilot.auth")).toBeNull();
  });

  it("keeps sessions with expired access token while refresh token is valid", () => {
    writeStoredAuthSession({
      ...validSession,
      expiresAtUtc: new Date(Date.now() - 60_000).toISOString(),
    });

    expect(readStoredAuthSession()?.refreshToken).toBe("refresh-a");
  });

  it("updates the active institution name in the stored session", () => {
    writeStoredAuthSession(validSession);

    const updated = updateStoredInstitutionName("institution-1", "Yeni Kurum Adi");

    expect(updated?.activeInstitution?.name).toBe("Yeni Kurum Adi");
    expect(updated?.institutions[0]?.name).toBe("Yeni Kurum Adi");
    expect(readStoredAuthSession()?.activeInstitution?.name).toBe("Yeni Kurum Adi");
  });

  it("updates the current user profile in the stored session", () => {
    writeStoredAuthSession(validSession);

    const updated = updateStoredUserProfile("user-1", {
      name: "Yeni Kullanici",
      phone: "5550001122",
      roleName: "Personel",
      isSuperAdmin: true,
    });

    expect(updated?.user).toMatchObject({
      name: "Yeni Kullanici",
      phone: "5550001122",
      roleName: "Personel",
      isSuperAdmin: true,
    });
    expect(updated?.activeInstitution?.roleName).toBe("Personel");
    expect(updated?.institutions[0]?.roleName).toBe("Personel");
    expect(updated?.activeInstitution?.permissions).toEqual({});
    expect(updated?.institutions[0]?.permissions).toEqual({});
    expect(readStoredAuthSession()?.user.name).toBe("Yeni Kullanici");
  });

  it("preserves the current user role when the profile update omits role name", () => {
    writeStoredAuthSession(validSession);

    const updated = updateStoredUserProfile("user-1", {
      name: "Yeni Kullanici",
    });

    expect(updated?.user.roleName).toBe("Kurum Yöneticisi");
    expect(updated?.activeInstitution?.roleName).toBe("Kurum Yöneticisi");
    expect(updated?.activeInstitution?.permissions).toEqual(validSession.activeInstitution?.permissions);
  });

  it("clears the active institution role name when the current user's role is removed", () => {
    writeStoredAuthSession(validSession);

    const updated = updateStoredUserProfile("user-1", {
      roleName: null,
    });

    expect(updated?.user.roleName).toBeNull();
    expect(updated?.activeInstitution?.roleName).toBeNull();
    expect(updated?.institutions[0]?.roleName).toBeNull();
    expect(updated?.activeInstitution?.permissions).toEqual({});
    expect(updated?.institutions[0]?.permissions).toEqual({});
  });

  it("updates the active institution role name in the stored session", () => {
    writeStoredAuthSession(validSession);

    const updated = updateStoredActiveInstitutionRoleName("Kurum Yöneticisi", "Müdür");

    expect(updated?.user.roleName).toBe("Müdür");
    expect(updated?.activeInstitution?.roleName).toBe("Müdür");
    expect(updated?.institutions[0]?.roleName).toBe("Müdür");
  });

  it("updates the active institution permissions in the stored session", () => {
    writeStoredAuthSession(validSession);

    const updated = updateStoredActiveInstitutionPermissions("Kurum Yöneticisi", {
      dashboard: "full",
      payments: "view",
    });

    expect(updated?.activeInstitution?.permissions).toEqual({
      dashboard: "full",
      payments: "view",
    });
    expect(updated?.institutions[0]?.permissions).toEqual({
      dashboard: "full",
      payments: "view",
    });
  });

  it("clears sessions with expired refresh token", () => {
    writeStoredAuthSession({
      ...validSession,
      refreshTokenExpiresAtUtc: new Date(Date.now() - 60_000).toISOString(),
    });

    expect(readStoredAuthSession()).toBeNull();
    expect(localStorage.getItem("pilot.auth")).toBeNull();
  });

  it("clears sessions with invalid expiration dates", () => {
    writeStoredAuthSession({
      ...validSession,
      expiresAtUtc: "not-a-date",
    });

    expect(readStoredAuthSession()).toBeNull();
    expect(localStorage.getItem("pilot.auth")).toBeNull();
  });
});
