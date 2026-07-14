import { getFinanceApiBaseUrl } from "./api";
import {
  httpDelete,
  httpGet,
  httpPost,
  httpPut,
  type QueryParams,
} from "./http";
import type {
  CashMovementCategoryListResponse,
  CashMovementCategoryResponse,
  CashMovementCategoryUpsertRequest,
  CashMovementDirection,
} from "./types";

const financeRequestOptions = (signal?: AbortSignal) => ({
  baseUrl: getFinanceApiBaseUrl(),
  signal,
});

export function getCashMovementCategories(
  options?: {
    search?: string;
    activity?: "active" | "inactive" | "all";
    direction?: CashMovementDirection;
    page?: number;
    pageSize?: number;
  },
  signal?: AbortSignal,
): Promise<CashMovementCategoryListResponse> {
  const params: QueryParams = {
    search: options?.search,
    activity: options?.activity,
    direction: options?.direction,
    page: options?.page,
    pageSize: options?.pageSize,
  };
  return httpGet<CashMovementCategoryListResponse>(
    "/api/finance/cash-movement-categories",
    params,
    financeRequestOptions(signal),
  );
}

export function createCashMovementCategory(
  body: CashMovementCategoryUpsertRequest,
): Promise<CashMovementCategoryResponse> {
  return httpPost<CashMovementCategoryResponse>(
    "/api/finance/cash-movement-categories",
    body,
    financeRequestOptions(),
  );
}

export function updateCashMovementCategory(
  id: string,
  body: CashMovementCategoryUpsertRequest,
): Promise<CashMovementCategoryResponse> {
  return httpPut<CashMovementCategoryResponse>(
    `/api/finance/cash-movement-categories/${id}`,
    body,
    financeRequestOptions(),
  );
}

export function deleteCashMovementCategory(id: string): Promise<void> {
  return httpDelete(
    `/api/finance/cash-movement-categories/${id}`,
    undefined,
    financeRequestOptions(),
  );
}
