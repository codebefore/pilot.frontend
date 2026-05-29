import type { ReactElement } from "react";
import { render } from "@testing-library/react";

import { AuthContext, type AuthContextValue } from "../lib/auth";
import type { AuthInstitution, AuthUser } from "../lib/auth-storage";
import { ToastProvider } from "../components/ui/Toast";
import { LanguageProvider } from "../lib/i18n";

type AuthOverride = Partial<AuthContextValue> | undefined;

const defaultUser: AuthUser = {
  id: "test-user",
  phone: "5000000000",
  name: "Test User",
  roleName: "super_admin",
  isSuperAdmin: true,
};

const defaultInstitution: AuthInstitution = {
  id: "test-institution",
  name: "Test Kurum",
  slug: "test-kurum",
  roleName: "super_admin",
  isDefault: true,
};

export function renderWithProviders(ui: ReactElement, options?: { auth?: AuthOverride }) {
  // Default test user has super-admin so management buttons render in the
  // settings tables; individual tests can override via `auth: { user: ... }`
  // (use `null` to test the read-only / unauthenticated state).
  const user = options?.auth && "user" in options.auth ? options.auth.user ?? null : defaultUser;
  const institutions = options?.auth?.institutions ?? (user ? [defaultInstitution] : []);
  const activeInstitution =
    "activeInstitution" in (options?.auth ?? {})
      ? options?.auth?.activeInstitution ?? null
      : user
        ? institutions[0] ?? null
        : null;
  const authValue: AuthContextValue = {
    user,
    accessToken: options?.auth?.accessToken ?? (user ? "test-token" : null),
    institutions,
    activeInstitution,
    hasInstitution: options?.auth?.hasInstitution ?? institutions.length > 0,
    institutionRequired: options?.auth?.institutionRequired ?? false,
    login: options?.auth?.login ?? (async () => {}),
    selectInstitution: options?.auth?.selectInstitution ?? (async () => {}),
    logout: options?.auth?.logout ?? (() => {}),
  };
  return render(
    <LanguageProvider>
      <ToastProvider>
        <AuthContext.Provider value={authValue}>{ui}</AuthContext.Provider>
      </ToastProvider>
    </LanguageProvider>
  );
}
