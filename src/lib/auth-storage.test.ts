import { beforeEach, describe, expect, it } from "vitest";

import {
  clearStoredAuthSession,
  readStoredAuthSession,
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
      slug: "pilot-kurum",
      roleName: "Kurum Yöneticisi",
      isDefault: true,
      permissions: { dashboard: "view", candidates: "full" },
    },
  ],
  activeInstitution: {
    id: "institution-1",
    name: "Pilot Kurum",
    slug: "pilot-kurum",
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
        slug: "missing-kurum",
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
