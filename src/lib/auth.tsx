import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import {
  loginWithPassword,
  logoutSession,
  selectInstitution as selectInstitutionApi,
  type LoginResponse,
} from "./auth-api";
import {
  clearStoredAuthSession,
  getStoredRefreshToken,
  readStoredAuthSession,
  writeStoredAuthSession,
  type AuthInstitution,
  type AuthSession,
  type AuthUser,
} from "./auth-storage";

export type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  institutions: AuthInstitution[];
  activeInstitution: AuthInstitution | null;
  hasInstitution: boolean;
  institutionRequired: boolean;
  login: (phone: string, password: string) => Promise<void>;
  selectInstitution: (institutionId: string) => Promise<void>;
  logout: () => void;
};

// Exported for tests so a deterministic value can be supplied without
// running the real provider's effects (storage reads, event listeners).
export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredAuthSession());
  const [institutionRequired, setInstitutionRequired] = useState(
    () => !!session && !session.activeInstitution
  );

  useEffect(() => {
    if (session) writeStoredAuthSession(session);
    else clearStoredAuthSession();
  }, [session]);

  useEffect(() => {
    const onUnauthorized = () => {
      setInstitutionRequired(false);
      setSession(null);
    };
    window.addEventListener("pilot:unauthorized", onUnauthorized);
    return () => window.removeEventListener("pilot:unauthorized", onUnauthorized);
  }, []);

  useEffect(() => {
    const onInstitutionRequired = () => setInstitutionRequired(true);
    window.addEventListener("pilot:institution-required", onInstitutionRequired);
    return () => window.removeEventListener("pilot:institution-required", onInstitutionRequired);
  }, []);

  useEffect(() => {
    const onSessionRefreshed = (event: Event) => {
      const refreshedSession = (event as CustomEvent<AuthSession>).detail;
      if (refreshedSession) {
        setSession(refreshedSession);
        setInstitutionRequired(!refreshedSession.activeInstitution);
      }
    };
    window.addEventListener("pilot:session-refreshed", onSessionRefreshed);
    return () => window.removeEventListener("pilot:session-refreshed", onSessionRefreshed);
  }, []);

  const login = async (phone: string, password: string) => {
    if (!phone || !password) throw new Error("Telefon ve şifre gerekli");
    const response = await loginWithPassword({ phone, password });
    setSession(mapLoginResponse(response));
    setInstitutionRequired(!response.activeInstitution);
  };

  const selectInstitution = async (institutionId: string) => {
    if (!institutionId) return;
    const response = await selectInstitutionApi(institutionId);
    setSession(mapLoginResponse(response));
    setInstitutionRequired(!response.activeInstitution);
  };

  const logout = () => {
    const refreshToken = getStoredRefreshToken();
    if (refreshToken) {
      void logoutSession({ refreshToken }).catch(() => undefined);
    }
    setInstitutionRequired(false);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        accessToken: session?.accessToken ?? null,
        institutions: session?.institutions ?? [],
        activeInstitution: session?.activeInstitution ?? null,
        hasInstitution: (session?.institutions.length ?? 0) > 0,
        institutionRequired,
        login,
        selectInstitution,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }
  return <>{children}</>;
}

function mapLoginResponse(response: LoginResponse): AuthSession {
  return {
    accessToken: response.accessToken,
    expiresAtUtc: response.expiresAtUtc,
    refreshToken: response.refreshToken,
    refreshTokenExpiresAtUtc: response.refreshTokenExpiresAtUtc,
    user: {
      id: response.user.id,
      phone: response.user.phone,
      name: response.user.fullName,
      roleName: response.activeInstitution?.roleName ?? response.user.roleName,
      isSuperAdmin: response.user.isSuperAdmin,
    },
    institutions: response.institutions,
    activeInstitution: response.activeInstitution,
  };
}
