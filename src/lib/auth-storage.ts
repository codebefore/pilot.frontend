const STORAGE_KEY = "pilot.auth";

export type AuthInstitution = {
  id: string;
  name: string;
  slug: string;
  roleName: string | null;
  isDefault: boolean;
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
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
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
  return readStoredAuthSession()?.accessToken ?? null;
}

export function notifyUnauthorized(): void {
  window.dispatchEvent(new Event("pilot:unauthorized"));
}

export function notifyInstitutionRequired(): void {
  window.dispatchEvent(new Event("pilot:institution-required"));
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
    typeof institution.isDefault === "boolean";
}

function isActiveInstitutionInMemberships(session: AuthSession): boolean {
  return (
    session.activeInstitution === null ||
    session.institutions.some((institution) => institution.id === session.activeInstitution?.id)
  );
}
