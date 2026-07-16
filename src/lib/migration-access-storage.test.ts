import { beforeEach, describe, expect, it } from "vitest";

import {
  buildMigrationAccessStorageKey,
  clearAllMigrationAccess,
  readMigrationAccessExpiresAt,
  readMigrationAccessToken,
  writeMigrationAccess,
} from "./migration-access-storage";

describe("migration access storage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("keeps approval only in the current browser session", () => {
    const key = buildMigrationAccessStorageKey("user-1", "institution-1");
    const expiresAtUtc = new Date(Date.now() + 60_000).toISOString();

    writeMigrationAccess(key, expiresAtUtc, "migration-token");

    expect(sessionStorage.getItem(key)).toBe(expiresAtUtc);
    expect(sessionStorage.getItem(`${key}.token`)).toBe("migration-token");
    expect(localStorage.getItem(key)).toBeNull();
    expect(readMigrationAccessExpiresAt(key)).toBe(expiresAtUtc);
    expect(readMigrationAccessToken(key)).toBe("migration-token");
  });

  it("migrates and removes legacy local-storage approval values", () => {
    const key = buildMigrationAccessStorageKey("user-1", "institution-1");
    const expiresAtUtc = new Date(Date.now() + 60_000).toISOString();
    localStorage.setItem(key, expiresAtUtc);
    localStorage.setItem(`${key}.token`, "legacy-token");

    expect(readMigrationAccessExpiresAt(key)).toBe(expiresAtUtc);
    expect(readMigrationAccessToken(key)).toBe("legacy-token");
    expect(localStorage.getItem(key)).toBeNull();
    expect(localStorage.getItem(`${key}.token`)).toBeNull();
  });

  it("clears approval values without touching unrelated preferences", () => {
    const key = buildMigrationAccessStorageKey("user-1", "institution-1");
    sessionStorage.setItem(key, "expiry");
    sessionStorage.setItem(`${key}.token`, "token");
    localStorage.setItem("pilot.theme", "pilot");

    clearAllMigrationAccess();

    expect(sessionStorage.getItem(key)).toBeNull();
    expect(sessionStorage.getItem(`${key}.token`)).toBeNull();
    expect(localStorage.getItem("pilot.theme")).toBe("pilot");
  });
});
