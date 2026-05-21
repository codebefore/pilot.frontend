import { httpPost } from "./http";

type LoginRequest = {
  phone: string;
  password: string;
};

type LoginResponse = {
  accessToken: string;
  expiresAtUtc: string;
  user: {
    id: string;
    fullName: string;
    phone: string | null;
    roleName: string | null;
    isSuperAdmin: boolean;
  };
};

export function loginWithPassword(body: LoginRequest): Promise<LoginResponse> {
  return httpPost<LoginResponse>("/api/auth/login", body);
}
