import { httpDelete, httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type {
  FeeListResponse,
  FeeResponse,
  FeeType,
  FeeUpsertRequest,
} from "./types";

export type FeeSortField = "feeType" | "amount" | "isActive";
export type FeeSortDirection = "asc" | "desc";
export type FeeActivityFilter = "active" | "inactive" | "all";

export interface GetFeesOptions {
  search?: string;
  activity?: FeeActivityFilter;
  feeType?: FeeType;
  licenseClassId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: FeeSortField;
  sortDir?: FeeSortDirection;
}

export function getFees(
  options?: GetFeesOptions,
  signal?: AbortSignal
): Promise<FeeListResponse> {
  const params: QueryParams = {
    search: options?.search || undefined,
    activity: options?.activity,
    feeType: options?.feeType,
    licenseClassId: options?.licenseClassId,
    page: options?.page,
    pageSize: options?.pageSize,
    sortBy: options?.sortBy,
    sortDir: options?.sortDir,
  };

  return httpGet<FeeListResponse>("/api/fees", params, { signal });
}

export function createFee(body: FeeUpsertRequest): Promise<FeeResponse> {
  return httpPost<FeeResponse>("/api/fees", body);
}

export function updateFee(id: string, body: FeeUpsertRequest): Promise<FeeResponse> {
  return httpPut<FeeResponse>(`/api/fees/${id}`, body);
}

export function deleteFee(id: string): Promise<void> {
  return httpDelete(`/api/fees/${id}`);
}
