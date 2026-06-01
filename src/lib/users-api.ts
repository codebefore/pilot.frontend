import { getAuthApiBaseUrl } from "./api";
import { httpDelete, httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type { AppUserResponse, AppUserUpsertRequest } from "./types";

function authOptions(signal?: AbortSignal) {
  return { baseUrl: getAuthApiBaseUrl(), signal };
}

interface GetUsersOptions {
  includeInactive?: boolean;
  includeSuperAdmins?: boolean;
}

export function getUsers(
  options?: GetUsersOptions,
  signal?: AbortSignal
): Promise<AppUserResponse[]> {
  const params: QueryParams = {
    includeInactive: options?.includeInactive ?? true,
    includeSuperAdmins: options?.includeSuperAdmins ?? false,
  };
  return httpGet<AppUserResponse[]>("/api/users", params, authOptions(signal));
}

export function createUser(body: AppUserUpsertRequest): Promise<AppUserResponse> {
  return httpPost<AppUserResponse>("/api/users", body, authOptions());
}

export function updateUser(
  id: string,
  body: AppUserUpsertRequest
): Promise<AppUserResponse> {
  return httpPut<AppUserResponse>(`/api/users/${id}`, body, authOptions());
}

export function deleteUser(id: string): Promise<void> {
  return httpDelete(`/api/users/${id}`, undefined, authOptions());
}
