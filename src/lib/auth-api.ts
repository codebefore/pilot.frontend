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

export type LoginResponse = {
  accessToken: string;
  expiresAtUtc: string;
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

export function changePassword(body: ChangePasswordRequest): Promise<void> {
  return httpPost<void>("/api/auth/password", body);
}
