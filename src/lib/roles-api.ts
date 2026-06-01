import { getAuthApiBaseUrl } from "./api";
import { httpDelete, httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type {
  PermissionAreasResponse,
  RolePermissionResponse,
  RoleResponse,
  RoleUpsertRequest,
} from "./types";

interface GetRolesOptions {
  includeInactive?: boolean;
}

function authOptions(signal?: AbortSignal) {
  return { baseUrl: getAuthApiBaseUrl(), signal };
}

export function getRoles(
  options?: GetRolesOptions,
  signal?: AbortSignal
): Promise<RoleResponse[]> {
  const params: QueryParams = {
    includeInactive: options?.includeInactive ?? true,
  };
  return httpGet<RoleResponse[]>("/api/roles", params, authOptions(signal));
}

export function createRole(body: RoleUpsertRequest): Promise<RoleResponse> {
  return httpPost<RoleResponse>("/api/roles", body, authOptions());
}

export function updateRole(id: string, body: RoleUpsertRequest): Promise<RoleResponse> {
  return httpPut<RoleResponse>(`/api/roles/${id}`, body, authOptions());
}

export function deleteRole(id: string): Promise<void> {
  return httpDelete(`/api/roles/${id}`, undefined, authOptions());
}

export function getPermissionAreas(signal?: AbortSignal): Promise<PermissionAreasResponse> {
  return httpGet<PermissionAreasResponse>("/api/role-permissions/areas", undefined, authOptions(signal));
}

export function getRolePermissions(
  roleId: string,
  signal?: AbortSignal
): Promise<RolePermissionResponse[]> {
  return httpGet<RolePermissionResponse[]>(`/api/role-permissions/${roleId}`, undefined, authOptions(signal));
}

export function saveRolePermissions(
  roleId: string,
  permissions: RolePermissionResponse[]
): Promise<RolePermissionResponse[]> {
  return httpPut<RolePermissionResponse[]>(
    `/api/role-permissions/${roleId}`,
    { permissions },
    authOptions()
  );
}
