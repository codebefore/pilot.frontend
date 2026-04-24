import { httpDelete, httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type {
  RouteListResponse,
  RouteResponse,
  RouteUsageType,
  RouteUpsertRequest,
} from "./types";

export type RouteSortField =
  | "code"
  | "name"
  | "usageType"
  | "district"
  | "distanceKm"
  | "estimatedDurationMinutes"
  | "isActive";
export type RouteSortDirection = "asc" | "desc";
export type RouteActivityFilter = "active" | "inactive" | "all";

export interface GetRoutesOptions {
  search?: string;
  includeInactive?: boolean;
  activity?: RouteActivityFilter;
  usageType?: RouteUsageType;
  page?: number;
  pageSize?: number;
  sortBy?: RouteSortField;
  sortDir?: RouteSortDirection;
}

export function getRoutes(
  options?: GetRoutesOptions,
  signal?: AbortSignal
): Promise<RouteListResponse> {
  const params: QueryParams = {
    search: options?.search || undefined,
    includeInactive: options?.includeInactive ?? false,
    activity: options?.activity,
    usageType: options?.usageType,
    page: options?.page,
    pageSize: options?.pageSize,
    sortBy: options?.sortBy,
    sortDir: options?.sortDir,
  };

  return httpGet<RouteListResponse>("/api/routes", params, { signal });
}

export function createRoute(body: RouteUpsertRequest): Promise<RouteResponse> {
  return httpPost<RouteResponse>("/api/routes", body);
}

export function updateRoute(id: string, body: RouteUpsertRequest): Promise<RouteResponse> {
  return httpPut<RouteResponse>(`/api/routes/${id}`, body);
}

export function deleteRoute(id: string): Promise<void> {
  return httpDelete(`/api/routes/${id}`);
}
