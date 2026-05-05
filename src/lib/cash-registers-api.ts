import { httpDelete, httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type {
  CashRegisterListResponse,
  CashRegisterResponse,
  CashRegisterType,
  CashRegisterUpsertRequest,
} from "./types";

export type CashRegisterSortField = "name" | "type" | "isActive";
export type CashRegisterSortDirection = "asc" | "desc";
export type CashRegisterActivityFilter = "active" | "inactive" | "all";

export interface GetCashRegistersOptions {
  search?: string;
  activity?: CashRegisterActivityFilter;
  type?: CashRegisterType | "all";
  page?: number;
  pageSize?: number;
  sortBy?: CashRegisterSortField;
  sortDir?: CashRegisterSortDirection;
}

export function getCashRegisters(
  options?: GetCashRegistersOptions,
  signal?: AbortSignal
): Promise<CashRegisterListResponse> {
  const params: QueryParams = {
    search: options?.search || undefined,
    activity: options?.activity,
    type: options?.type && options.type !== "all" ? options.type : undefined,
    page: options?.page,
    pageSize: options?.pageSize,
    sortBy: options?.sortBy,
    sortDir: options?.sortDir,
  };

  return httpGet<CashRegisterListResponse>("/api/cash-registers", params, { signal });
}

export function createCashRegister(body: CashRegisterUpsertRequest): Promise<CashRegisterResponse> {
  return httpPost<CashRegisterResponse>("/api/cash-registers", body);
}

export function updateCashRegister(
  id: string,
  body: CashRegisterUpsertRequest
): Promise<CashRegisterResponse> {
  return httpPut<CashRegisterResponse>(`/api/cash-registers/${id}`, body);
}

export function deleteCashRegister(id: string): Promise<void> {
  return httpDelete(`/api/cash-registers/${id}`);
}
