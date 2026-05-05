const STORAGE_KEY = "pilot.auth";

export type AuthUser = {
  id: string;
  email: string | null;
  name: string;
  roleName: string | null;
  isSuperAdmin: boolean;
};

export type AuthSession = {
  accessToken: string;
  expiresAtUtc: string;
  user: AuthUser;
};

export function readStoredAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthSession;
    if (!session.accessToken || !session.expiresAtUtc || !session.user) return null;
    if (new Date(session.expiresAtUtc).getTime() <= Date.now()) {
      clearStoredAuthSession();
      return null;
    }
    return session;
  } catch {
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
