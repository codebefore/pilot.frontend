import { httpPost } from "./http";

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  expiresAtUtc: string;
  user: {
    id: string;
    fullName: string;
    email: string | null;
    roleName: string | null;
    isSuperAdmin: boolean;
  };
};

export function loginWithPassword(body: LoginRequest): Promise<LoginResponse> {
  return httpPost<LoginResponse>("/api/auth/login", body);
}
