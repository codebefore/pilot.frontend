export const MIGRATION_ACCESS_STORAGE_PREFIX = "pilot.migration.access";

const tokenKey = (storageKey: string) => `${storageKey}.token`;

export function buildMigrationAccessStorageKey(userId: string, institutionId: string): string {
  return `${MIGRATION_ACCESS_STORAGE_PREFIX}.${userId}.${institutionId}`;
}

export function readMigrationAccessExpiresAt(storageKey: string): string | null {
  const value = readSessionValue(storageKey);
  if (!value) return null;

  const expiresAt = new Date(value).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    clearMigrationAccess(storageKey);
    return null;
  }

  return value;
}

export function readMigrationAccessToken(storageKey: string): string | null {
  return readSessionValue(tokenKey(storageKey));
}

export function writeMigrationAccess(
  storageKey: string,
  expiresAtUtc: string,
  accessToken: string
): void {
  sessionStorage.setItem(storageKey, expiresAtUtc);
  sessionStorage.setItem(tokenKey(storageKey), accessToken);
  localStorage.removeItem(storageKey);
  localStorage.removeItem(tokenKey(storageKey));
}

export function clearMigrationAccess(storageKey: string): void {
  localStorage.removeItem(storageKey);
  localStorage.removeItem(tokenKey(storageKey));
  sessionStorage.removeItem(storageKey);
  sessionStorage.removeItem(tokenKey(storageKey));
}

export function clearAllMigrationAccess(): void {
  clearMatchingKeys(localStorage);
  clearMatchingKeys(sessionStorage);
}

function readSessionValue(key: string): string | null {
  const sessionValue = sessionStorage.getItem(key);
  if (sessionValue !== null) return sessionValue;

  const legacyValue = localStorage.getItem(key);
  if (legacyValue === null) return null;

  sessionStorage.setItem(key, legacyValue);
  localStorage.removeItem(key);
  return legacyValue;
}

function clearMatchingKeys(storage: Storage): void {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key === MIGRATION_ACCESS_STORAGE_PREFIX || key?.startsWith(`${MIGRATION_ACCESS_STORAGE_PREFIX}.`)) {
      storage.removeItem(key);
    }
  }
}
