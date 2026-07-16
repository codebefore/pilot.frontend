import { httpPost } from "./http";
import type { AuthInstitution } from "./auth-storage";
import { getAuthApiBaseUrl } from "./api";

export type LoginChannel = "whatsapp" | "sms";

type LoginRequest = {
  phone: string;
  channel?: LoginChannel;
};

type VerifyLoginCodeRequest = {
  phone: string;
  code: string;
};

export type LoginCodeResponse = {
  phone: string;
  expiresAtUtc: string;
};

export type MigrationAccessCodeResponse = {
  expiresAtUtc: string;
  recipientCount: number;
};

export type MigrationAccessVerifyResponse = {
  expiresAtUtc: string;
  accessToken: string;
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
  // Drop `channel` when undefined so the request stays byte-for-byte compatible
  // with backends that haven't shipped channel support yet.
  const payload: LoginRequest = body.channel
    ? { phone: body.phone, channel: body.channel }
    : { phone: body.phone };
  return httpPost<LoginCodeResponse>("/api/auth/login/request-code", payload, authRequestOptions());
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

export function requestMigrationAccessCode(): Promise<MigrationAccessCodeResponse> {
  return httpPost<MigrationAccessCodeResponse>(
    "/api/auth/migration-access/request-code",
    {},
    authRequestOptions()
  );
}

export function verifyMigrationAccessCode(code: string): Promise<MigrationAccessVerifyResponse> {
  return httpPost<MigrationAccessVerifyResponse>(
    "/api/auth/migration-access/verify-code",
    { code },
    authRequestOptions()
  );
}
