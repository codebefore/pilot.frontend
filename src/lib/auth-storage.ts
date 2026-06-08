export const AUTH_STORAGE_KEY = "pilot.auth";

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
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
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
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredAuthSession(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function updateStoredInstitutionName(institutionId: string, name: string): AuthSession | null {
  const normalizedName = name.trim();
  if (!institutionId || !normalizedName) return readStoredAuthSession();

  const session = readStoredAuthSession();
  if (!session) return null;

  let changed = false;
  const institutions = session.institutions.map((institution) => {
    if (institution.id !== institutionId || institution.name === normalizedName) {
      return institution;
    }
    changed = true;
    return { ...institution, name: normalizedName };
  });
  const activeInstitution =
    session.activeInstitution?.id === institutionId && session.activeInstitution.name !== normalizedName
      ? { ...session.activeInstitution, name: normalizedName }
      : session.activeInstitution;
  if (activeInstitution !== session.activeInstitution) {
    changed = true;
  }
  if (!changed) return session;

  const nextSession = { ...session, institutions, activeInstitution };
  writeStoredAuthSession(nextSession);
  notifySessionRefreshed(nextSession);
  return nextSession;
}

export function updateStoredUserProfile(
  userId: string,
  profile: {
    name?: string | null;
    phone?: string | null;
    roleName?: string | null;
    isSuperAdmin?: boolean;
  }
): AuthSession | null {
  const session = readStoredAuthSession();
  if (!session || session.user.id !== userId) return session;

  const normalizedName = profile.name?.trim();
  const normalizedRoleName = profile.roleName?.trim() || null;
  const nextUser = {
    ...session.user,
    name: normalizedName || session.user.name,
    phone: profile.phone ?? session.user.phone,
    roleName: normalizedRoleName,
    isSuperAdmin: profile.isSuperAdmin ?? session.user.isSuperAdmin,
  };
  if (
    nextUser.name === session.user.name &&
    nextUser.phone === session.user.phone &&
    nextUser.roleName === session.user.roleName &&
    nextUser.isSuperAdmin === session.user.isSuperAdmin
  ) {
    return session;
  }

  const nextSession = { ...session, user: nextUser };
  writeStoredAuthSession(nextSession);
  notifySessionRefreshed(nextSession);
  return nextSession;
}

export function updateStoredActiveInstitutionRoleName(
  previousRoleName: string | null | undefined,
  nextRoleName: string | null | undefined
): AuthSession | null {
  const session = readStoredAuthSession();
  const previousName = previousRoleName?.trim();
  const normalizedNextName = nextRoleName?.trim() || null;
  if (!session || !previousName || !normalizedNextName) return session;
  if (session.activeInstitution?.roleName !== previousName && session.user.roleName !== previousName) {
    return session;
  }

  let changed = false;
  const institutions = session.institutions.map((institution) => {
    if (institution.id !== session.activeInstitution?.id || institution.roleName !== previousName) {
      return institution;
    }
    changed = true;
    return { ...institution, roleName: normalizedNextName };
  });
  const activeInstitution =
    session.activeInstitution?.roleName === previousName
      ? { ...session.activeInstitution, roleName: normalizedNextName }
      : session.activeInstitution;
  if (activeInstitution !== session.activeInstitution) changed = true;
  const user =
    session.user.roleName === previousName
      ? { ...session.user, roleName: normalizedNextName }
      : session.user;
  if (user !== session.user) changed = true;
  if (!changed) return session;

  const nextSession = { ...session, user, institutions, activeInstitution };
  writeStoredAuthSession(nextSession);
  notifySessionRefreshed(nextSession);
  return nextSession;
}

export function updateStoredActiveInstitutionPermissions(
  roleName: string | null | undefined,
  permissions: Record<string, "view" | "full">
): AuthSession | null {
  const session = readStoredAuthSession();
  const normalizedRoleName = roleName?.trim();
  if (!session || !session.activeInstitution || !normalizedRoleName) return session;
  if (session.activeInstitution.roleName !== normalizedRoleName) return session;

  const institutions = session.institutions.map((institution) =>
    institution.id === session.activeInstitution?.id
      ? { ...institution, permissions }
      : institution
  );
  const activeInstitution = { ...session.activeInstitution, permissions };
  const nextSession = { ...session, institutions, activeInstitution };
  writeStoredAuthSession(nextSession);
  notifySessionRefreshed(nextSession);
  return nextSession;
}

export function getStoredAccessToken(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Partial<AuthSession>;
    return typeof session.accessToken === "string" ? session.accessToken : null;
  } catch {
    return null;
  }
}

export function getStoredRefreshToken(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Partial<AuthSession>;
    return typeof session.refreshToken === "string" ? session.refreshToken : null;
  } catch {
    return null;
  }
}

export function getStoredActiveInstitutionId(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
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
