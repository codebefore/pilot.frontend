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
  code?: string;
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
    code: options?.code || undefined,
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

export async function getLicenseClassDefinition(
  id: string,
  signal?: AbortSignal
): Promise<LicenseClassDefinitionResponse> {
  // Backend has no GET-by-id endpoint yet; pull from the list and find.
  const response = await httpGet<LicenseClassDefinitionListResponse>(
    "/api/license-class-definitions",
    { activity: "all", page: 1, pageSize: 500 },
    { signal }
  );
  const found = response.items.find((item) => item.id === id);
  if (!found) {
    throw new Error(`License class definition not found: ${id}`);
  }
  return found;
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
