import { httpDelete, httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type {
  AreaListResponse,
  AreaResponse,
  AreaType,
  AreaUpsertRequest,
} from "./types";

export type AreaSortField =
  | "code"
  | "name"
  | "areaType"
  | "capacity"
  | "district"
  | "isActive";
export type AreaSortDirection = "asc" | "desc";
export type AreaActivityFilter = "active" | "inactive" | "all";

export interface GetAreasOptions {
  search?: string;
  includeInactive?: boolean;
  activity?: AreaActivityFilter;
  areaType?: AreaType;
  page?: number;
  pageSize?: number;
  sortBy?: AreaSortField;
  sortDir?: AreaSortDirection;
}

export function getAreas(
  options?: GetAreasOptions,
  signal?: AbortSignal
): Promise<AreaListResponse> {
  const params: QueryParams = {
    search: options?.search || undefined,
    includeInactive: options?.includeInactive ?? false,
    activity: options?.activity,
    areaType: options?.areaType,
    page: options?.page,
    pageSize: options?.pageSize,
    sortBy: options?.sortBy,
    sortDir: options?.sortDir,
  };

  return httpGet<AreaListResponse>("/api/areas", params, { signal });
}

export function createArea(body: AreaUpsertRequest): Promise<AreaResponse> {
  return httpPost<AreaResponse>("/api/areas", body);
}

export function updateArea(id: string, body: AreaUpsertRequest): Promise<AreaResponse> {
  return httpPut<AreaResponse>(`/api/areas/${id}`, body);
}

export function deleteArea(id: string): Promise<void> {
  return httpDelete(`/api/areas/${id}`);
}
