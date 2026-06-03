const STORAGE_KEY = "pilot.auth";

export type AuthInstitution = {
  id: string;
  name: string;
  slug: string;
  roleName: string | null;
  isDefault: boolean;
  permissions: Record<string, "view" | "full">;
};

export type AuthUser = {
  id: string;
  phone: string | null;
  name: string;
  roleName: string | null;
  isSuperAdmin: boolean;
};

export type AuthSession = {
  accessToken: string;
  expiresAtUtc: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
  user: AuthUser;
  institutions: AuthInstitution[];
  activeInstitution: AuthInstitution | null;
};

export function readStoredAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthSession;
    if (
      !session.accessToken ||
      !session.expiresAtUtc ||
      !session.refreshToken ||
      !session.refreshTokenExpiresAtUtc ||
      !isAuthUser(session.user) ||
      !Array.isArray(session.institutions) ||
      !session.institutions.every(isAuthInstitution) ||
      (session.activeInstitution !== null && !isAuthInstitution(session.activeInstitution)) ||
      !isActiveInstitutionInMemberships(session)
    ) {
      clearStoredAuthSession();
      return null;
    }
    const expiresAt = new Date(session.expiresAtUtc).getTime();
    const refreshExpiresAt = new Date(session.refreshTokenExpiresAtUtc).getTime();
    if (!Number.isFinite(expiresAt) || !Number.isFinite(refreshExpiresAt) || refreshExpiresAt <= Date.now()) {
      clearStoredAuthSession();
      return null;
    }
    return session;
  } catch {
    clearStoredAuthSession();
    return null;
  }
}

export function writeStoredAuthSession(session: AuthSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredAuthSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getStoredAccessToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Partial<AuthSession>;
    return typeof session.accessToken === "string" ? session.accessToken : null;
  } catch {
    return null;
  }
}

export function getStoredRefreshToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Partial<AuthSession>;
    return typeof session.refreshToken === "string" ? session.refreshToken : null;
  } catch {
    return null;
  }
}

export function getStoredActiveInstitutionId(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Partial<AuthSession>;
    return typeof session.activeInstitution?.id === "string" ? session.activeInstitution.id : null;
  } catch {
    return null;
  }
}

export function notifyUnauthorized(): void {
  window.dispatchEvent(new Event("pilot:unauthorized"));
}

export function notifyInstitutionRequired(): void {
  window.dispatchEvent(new Event("pilot:institution-required"));
}

export function notifySessionRefreshed(session: AuthSession): void {
  window.dispatchEvent(new CustomEvent<AuthSession>("pilot:session-refreshed", { detail: session }));
}

function isAuthUser(value: unknown): value is AuthUser {
  const user = value as Partial<AuthUser> | null;
  return !!user &&
    typeof user.id === "string" &&
    typeof user.name === "string" &&
    (user.phone === null || typeof user.phone === "string") &&
    (user.roleName === null || typeof user.roleName === "string") &&
    typeof user.isSuperAdmin === "boolean";
}

function isAuthInstitution(value: unknown): value is AuthInstitution {
  const institution = value as Partial<AuthInstitution> | null;
  return !!institution &&
    typeof institution.id === "string" &&
    typeof institution.name === "string" &&
    typeof institution.slug === "string" &&
    (institution.roleName === null || typeof institution.roleName === "string") &&
    typeof institution.isDefault === "boolean" &&
    isPermissions(institution.permissions);
}

function isPermissions(value: unknown): value is Record<string, "view" | "full"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((level) => level === "view" || level === "full");
}

function isActiveInstitutionInMemberships(session: AuthSession): boolean {
  return (
    session.activeInstitution === null ||
    session.institutions.some((institution) => institution.id === session.activeInstitution?.id)
  );
}
