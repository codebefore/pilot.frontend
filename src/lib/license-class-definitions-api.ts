import { httpDelete, httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type {
  LicenseClassDefinitionCategory,
  LicenseClassDefinitionListResponse,
  LicenseClassDefinitionResponse,
  LicenseClassDefinitionUpsertRequest,
} from "./types";

export type LicenseClassDefinitionSortField =
  | "code"
  | "name"
  | "category"
  | "minimumAge"
  | "displayOrder"
  | "isActive";
export type LicenseClassDefinitionSortDirection = "asc" | "desc";
export type LicenseClassDefinitionActivityFilter = "active" | "inactive" | "all";

export interface GetLicenseClassDefinitionsOptions {
  search?: string;
  includeInactive?: boolean;
  activity?: LicenseClassDefinitionActivityFilter;
  category?: LicenseClassDefinitionCategory;
  page?: number;
  pageSize?: number;
  sortBy?: LicenseClassDefinitionSortField;
  sortDir?: LicenseClassDefinitionSortDirection;
}

export function getLicenseClassDefinitions(
  options?: GetLicenseClassDefinitionsOptions,
  signal?: AbortSignal
): Promise<LicenseClassDefinitionListResponse> {
  const params: QueryParams = {
    search: options?.search || undefined,
    includeInactive: options?.includeInactive ?? false,
    activity: options?.activity,
    category: options?.category,
    page: options?.page,
    pageSize: options?.pageSize,
    sortBy: options?.sortBy,
    sortDir: options?.sortDir,
  };

  return httpGet<LicenseClassDefinitionListResponse>(
    "/api/license-class-definitions",
    params,
    { signal }
  );
}

export function createLicenseClassDefinition(
  body: LicenseClassDefinitionUpsertRequest
): Promise<LicenseClassDefinitionResponse> {
  return httpPost<LicenseClassDefinitionResponse>("/api/license-class-definitions", body);
}

export function updateLicenseClassDefinition(
  id: string,
  body: LicenseClassDefinitionUpsertRequest
): Promise<LicenseClassDefinitionResponse> {
  return httpPut<LicenseClassDefinitionResponse>(
    `/api/license-class-definitions/${id}`,
    body
  );
}

export function deleteLicenseClassDefinition(id: string): Promise<void> {
  return httpDelete(`/api/license-class-definitions/${id}`);
}
