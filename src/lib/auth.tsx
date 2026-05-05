import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { loginWithPassword } from "./auth-api";
import {
  clearStoredAuthSession,
  readStoredAuthSession,
  writeStoredAuthSession,
  type AuthSession,
  type AuthUser,
} from "./auth-storage";

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredAuthSession());

  useEffect(() => {
    if (session) writeStoredAuthSession(session);
    else clearStoredAuthSession();
  }, [session]);

  useEffect(() => {
    const onUnauthorized = () => setSession(null);
    window.addEventListener("pilot:unauthorized", onUnauthorized);
    return () => window.removeEventListener("pilot:unauthorized", onUnauthorized);
  }, []);

  const login = async (email: string, password: string) => {
    if (!email || !password) throw new Error("E-posta ve şifre gerekli");
    const response = await loginWithPassword({ email, password });
    setSession({
      accessToken: response.accessToken,
      expiresAtUtc: response.expiresAtUtc,
      user: {
        id: response.user.id,
        email: response.user.email,
        name: response.user.fullName,
        roleName: response.user.roleName,
        isSuperAdmin: response.user.isSuperAdmin,
      },
    });
  };

  const logout = () => setSession(null);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        accessToken: session?.accessToken ?? null,
        login,
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
