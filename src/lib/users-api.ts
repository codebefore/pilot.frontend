import { httpDelete, httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type { AppUserResponse, AppUserUpsertRequest } from "./types";

export interface GetUsersOptions {
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
  return httpGet<AppUserResponse[]>("/api/users", params, { signal });
}

export function createUser(body: AppUserUpsertRequest): Promise<AppUserResponse> {
  return httpPost<AppUserResponse>("/api/users", body);
}

export function updateUser(
  id: string,
  body: AppUserUpsertRequest
): Promise<AppUserResponse> {
  return httpPut<AppUserResponse>(`/api/users/${id}`, body);
}

export function deleteUser(id: string): Promise<void> {
  return httpDelete(`/api/users/${id}`);
}
