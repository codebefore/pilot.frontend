import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import {
  logoutSession,
  requestLoginCode as requestLoginCodeApi,
  selectInstitution as selectInstitutionApi,
  type LoginChannel,
  type LoginResponse,
  type LoginCodeResponse,
  verifyLoginCode,
} from "./auth-api";

export type { LoginChannel };
import {
  AUTH_STORAGE_KEY,
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
  permissions: Record<string, "view" | "full">;
  hasInstitution: boolean;
  institutionRequired: boolean;
  requestLoginCode: (phone: string, channel?: LoginChannel) => Promise<LoginCodeResponse>;
  login: (phone: string, code: string) => Promise<void>;
  selectInstitution: (institutionId: string) => Promise<void>;
  logout: () => void;
};

// Exported for tests so a deterministic value can be supplied without
// running the real provider's effects (storage reads, event listeners).
export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
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
      queryClient.clear();
      setInstitutionRequired(false);
      setSession(null);
    };
    window.addEventListener("pilot:unauthorized", onUnauthorized);
    return () => window.removeEventListener("pilot:unauthorized", onUnauthorized);
  }, [queryClient]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || event.key !== AUTH_STORAGE_KEY) return;

      const nextSession = readStoredAuthSession();
      queryClient.clear();
      setSession(nextSession);
      setInstitutionRequired(!!nextSession && !nextSession.activeInstitution);
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [queryClient]);

  useEffect(() => {
    const onInstitutionRequired = () => setInstitutionRequired(true);
    window.addEventListener("pilot:institution-required", onInstitutionRequired);
    return () => window.removeEventListener("pilot:institution-required", onInstitutionRequired);
  }, [queryClient, session]);

  useEffect(() => {
    const onSessionRefreshed = (event: Event) => {
      const refreshedSession = (event as CustomEvent<AuthSession>).detail;
      if (refreshedSession) {
        clearQueryCacheForSessionChange(queryClient, session, refreshedSession);
        setSession(refreshedSession);
        setInstitutionRequired(!refreshedSession.activeInstitution);
      }
    };
    window.addEventListener("pilot:session-refreshed", onSessionRefreshed);
    return () => window.removeEventListener("pilot:session-refreshed", onSessionRefreshed);
  }, [queryClient, session]);

  const requestLoginCode = async (phone: string, channel?: LoginChannel) => {
    if (!phone) throw new Error("Telefon gerekli");
    return requestLoginCodeApi({ phone, channel });
  };

  const login = async (phone: string, code: string) => {
    if (!phone || !code) throw new Error("Telefon ve doğrulama kodu gerekli");
    const response = await verifyLoginCode({ phone, code });
    const nextSession = mapLoginResponse(response);
    queryClient.clear();
    setSession(nextSession);
    setInstitutionRequired(!response.activeInstitution);
  };

  const selectInstitution = async (institutionId: string) => {
    if (!institutionId) return;
    const response = await selectInstitutionApi(institutionId);
    const nextSession = mapLoginResponse(response);
    clearQueryCacheForSessionChange(queryClient, session, nextSession);
    setSession(nextSession);
    setInstitutionRequired(!response.activeInstitution);
    if (session?.activeInstitution?.id !== nextSession.activeInstitution?.id) {
      writeStoredAuthSession(nextSession);
      reloadCurrentPage();
    }
  };

  const logout = () => {
    const refreshToken = getStoredRefreshToken();
    if (refreshToken) {
      void logoutSession({ refreshToken }).catch(() => undefined);
    }
    queryClient.clear();
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
        permissions: session?.activeInstitution?.permissions ?? {},
        hasInstitution: (session?.institutions.length ?? 0) > 0,
        institutionRequired,
        requestLoginCode,
        login,
        selectInstitution,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function clearQueryCacheForSessionChange(
  queryClient: ReturnType<typeof useQueryClient>,
  currentSession: AuthSession | null,
  nextSession: AuthSession
) {
  if (
    currentSession?.user.id !== nextSession.user.id ||
    currentSession?.activeInstitution?.id !== nextSession.activeInstitution?.id
  ) {
    queryClient.clear();
  }
}

export function reloadCurrentPage() {
  window.location.reload();
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
