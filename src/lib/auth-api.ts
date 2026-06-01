import { httpPost } from "./http";
import type { AuthInstitution } from "./auth-storage";
import { getAuthApiBaseUrl } from "./api";

type LoginRequest = {
  phone: string;
};

type VerifyLoginCodeRequest = {
  phone: string;
  code: string;
};

export type LoginCodeResponse = {
  phone: string;
  expiresAtUtc: string;
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

function authRequestOptions() {
  return { baseUrl: getAuthApiBaseUrl() };
}

export function requestLoginCode(body: LoginRequest): Promise<LoginCodeResponse> {
  return httpPost<LoginCodeResponse>("/api/auth/login/request-code", body, authRequestOptions());
}

export function verifyLoginCode(body: VerifyLoginCodeRequest): Promise<LoginResponse> {
  return httpPost<LoginResponse>("/api/auth/login/verify-code", body, authRequestOptions());
}

export function selectInstitution(institutionId: string): Promise<LoginResponse> {
  return httpPost<LoginResponse>(
    `/api/auth/institutions/${institutionId}/select`,
    {},
    authRequestOptions()
  );
}

export function refreshSession(body: RefreshTokenRequest): Promise<LoginResponse> {
  return httpPost<LoginResponse>("/api/auth/refresh", body, authRequestOptions());
}

export function logoutSession(body: LogoutRequest): Promise<void> {
  return httpPost<void>("/api/auth/logout", body, authRequestOptions());
}
