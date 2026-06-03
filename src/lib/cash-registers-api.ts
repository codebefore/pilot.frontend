import { getFinanceApiBaseUrl } from "./api";
import { httpDelete, httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type {
  CashRegisterListResponse,
  CashRegisterResponse,
  CashRegisterType,
  CashRegisterUpsertRequest,
} from "./types";

const financeRequestOptions = (signal?: AbortSignal) => ({
  baseUrl: getFinanceApiBaseUrl(),
  signal,
});

export type CashRegisterSortField = "name" | "type" | "isActive";
export type CashRegisterSortDirection = "asc" | "desc";
export type CashRegisterActivityFilter = "active" | "inactive" | "all";

interface GetCashRegistersOptions {
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

  return httpGet<CashRegisterListResponse>(
    "/api/finance/cash-registers",
    params,
    financeRequestOptions(signal)
  );
}

export function createCashRegister(body: CashRegisterUpsertRequest): Promise<CashRegisterResponse> {
  return httpPost<CashRegisterResponse>(
    "/api/finance/cash-registers",
    body,
    financeRequestOptions()
  );
}

export function updateCashRegister(
  id: string,
  body: CashRegisterUpsertRequest
): Promise<CashRegisterResponse> {
  return httpPut<CashRegisterResponse>(
    `/api/finance/cash-registers/${id}`,
    body,
    financeRequestOptions()
  );
}

export function deleteCashRegister(id: string): Promise<void> {
  return httpDelete(`/api/finance/cash-registers/${id}`, undefined, financeRequestOptions());
}
