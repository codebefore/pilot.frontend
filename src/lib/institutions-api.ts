import { getPlatformApiBaseUrl } from "./api";
import { httpDelete, httpGet, httpPost, httpPut } from "./http";

export type InstitutionResponse = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  memberCount: number;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type InstitutionCreateRequest = {
  name: string;
  slug: string | null;
  isActive: boolean;
};

export type InstitutionCreateResponse = {
  institution: InstitutionResponse;
  firstAdmin: null;
};

export type InstitutionUpdateRequest = InstitutionCreateRequest;

export type InstitutionMemberResponse = {
  id: string;
  userId: string;
  fullName: string;
  phone: string | null;
  roleId: string | null;
  roleName: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type InstitutionMemberCreateRequest = {
  fullName: string;
  phone: string;
  roleId: string | null;
  isActive: boolean;
};

export type InstitutionFounderCreateRequest = {
  fullName: string;
  phone: string;
  isActive: boolean;
};

export type InstitutionRoleResponse = {
  id: string;
  name: string;
  isActive: boolean;
  userCount: number;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type InstitutionRoleCreateRequest = {
  name: string;
  isActive: boolean;
};

export type InstitutionRolePermissionResponse = {
  area: string;
  level: "view" | "full";
};

export function getInstitutions(
  params: { includeInactive?: boolean } = {},
  signal?: AbortSignal
): Promise<InstitutionResponse[]> {
  return httpGet<InstitutionResponse[]>(
    "/api/institutions",
    { includeInactive: params.includeInactive ?? true },
    { baseUrl: getPlatformApiBaseUrl(), signal }
  );
}

export function createInstitution(
  body: InstitutionCreateRequest
): Promise<InstitutionCreateResponse> {
  return httpPost<InstitutionCreateResponse>("/api/institutions", body, {
    baseUrl: getPlatformApiBaseUrl(),
  });
}

export function updateInstitution(
  id: string,
  body: InstitutionUpdateRequest
): Promise<InstitutionResponse> {
  return httpPut<InstitutionResponse>(`/api/institutions/${id}`, body, {
    baseUrl: getPlatformApiBaseUrl(),
  });
}

export function deleteInstitution(id: string): Promise<void> {
  return httpDelete(`/api/institutions/${id}`, undefined, {
    baseUrl: getPlatformApiBaseUrl(),
  });
}

export function createInstitutionRole(
  institutionId: string,
  body: InstitutionRoleCreateRequest
): Promise<InstitutionRoleResponse> {
  return httpPost<InstitutionRoleResponse>(
    `/api/institutions/${institutionId}/roles`,
    body,
    { baseUrl: getPlatformApiBaseUrl() }
  );
}

export function saveInstitutionRolePermissions(
  institutionId: string,
  roleId: string,
  permissions: InstitutionRolePermissionResponse[]
): Promise<InstitutionRolePermissionResponse[]> {
  return httpPut<InstitutionRolePermissionResponse[]>(
    `/api/institutions/${institutionId}/roles/${roleId}/permissions`,
    { permissions },
    { baseUrl: getPlatformApiBaseUrl() }
  );
}

export function createInstitutionMember(
  institutionId: string,
  body: InstitutionMemberCreateRequest
): Promise<InstitutionMemberResponse> {
  return httpPost<InstitutionMemberResponse>(
    `/api/institutions/${institutionId}/members`,
    body,
    { baseUrl: getPlatformApiBaseUrl() }
  );
}

export function createInstitutionFounder(
  institutionId: string,
  body: InstitutionFounderCreateRequest
): Promise<InstitutionMemberResponse> {
  return httpPost<InstitutionMemberResponse>(
    `/api/institutions/${institutionId}/founder`,
    body,
    { baseUrl: getPlatformApiBaseUrl() }
  );
}
