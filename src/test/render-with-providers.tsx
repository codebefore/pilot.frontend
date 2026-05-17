import type { ReactElement } from "react";
import { render } from "@testing-library/react";

import { AuthContext } from "../lib/auth";
import type { AuthUser } from "../lib/auth-storage";
import { ToastProvider } from "../components/ui/Toast";
import { LanguageProvider } from "../lib/i18n";

type AuthOverride = { user?: AuthUser | null } | undefined;

const defaultUser: AuthUser = {
  id: "test-user",
  phone: "5000000000",
  name: "Test User",
  roleName: "super_admin",
  isSuperAdmin: true,
};

export function renderWithProviders(ui: ReactElement, options?: { auth?: AuthOverride }) {
  // Default test user has super-admin so management buttons render in the
  // settings tables; individual tests can override via `auth: { user: ... }`
  // (use `null` to test the read-only / unauthenticated state).
  const user = options?.auth && "user" in options.auth ? options.auth.user ?? null : defaultUser;
  const authValue = {
    user,
    accessToken: user ? "test-token" : null,
    login: async () => {},
    logout: () => {},
  };
  return render(
    <LanguageProvider>
      <ToastProvider>
        <AuthContext.Provider value={authValue}>{ui}</AuthContext.Provider>
      </ToastProvider>
    </LanguageProvider>
  );
}
