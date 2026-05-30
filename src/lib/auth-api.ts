import { httpPost } from "./http";
import type { AuthInstitution } from "./auth-storage";

type LoginRequest = {
  phone: string;
  password: string;
};

type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

type RefreshTokenRequest = {
  refreshToken: string;
};

type LogoutRequest = {
  refreshToken: string | null;
};

export type LoginResponse = {
  accessToken: string;
  expiresAtUtc: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
  user: {
    id: string;
    fullName: string;
    phone: string | null;
    roleName: string | null;
    isSuperAdmin: boolean;
  };
  institutions: AuthInstitution[];
  activeInstitution: AuthInstitution | null;
};

export function loginWithPassword(body: LoginRequest): Promise<LoginResponse> {
  return httpPost<LoginResponse>("/api/auth/login", body);
}

export function selectInstitution(institutionId: string): Promise<LoginResponse> {
  return httpPost<LoginResponse>(`/api/auth/institutions/${institutionId}/select`, {});
}

export function refreshSession(body: RefreshTokenRequest): Promise<LoginResponse> {
  return httpPost<LoginResponse>("/api/auth/refresh", body);
}

export function changePassword(body: ChangePasswordRequest): Promise<void> {
  return httpPost<void>("/api/auth/password", body);
}

export function logoutSession(body: LogoutRequest): Promise<void> {
  return httpPost<void>("/api/auth/logout", body);
}
