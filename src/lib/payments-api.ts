import { getFinanceApiBaseUrl } from "./api";
import { httpGet, httpPost } from "./http";
import type {
  CashRegisterMovementCreateRequest,
  CashRegisterMovementResponse,
  CashRegisterTransferCreateRequest,
  PaymentsOverviewResponse,
} from "./types";

const financeRequestOptions = (signal?: AbortSignal) => ({
  baseUrl: getFinanceApiBaseUrl(),
  signal,
});

type PaymentsOverviewParams = {
  fromDate?: string;
  statsMonth?: string;
  toDate?: string;
};

export function getPaymentsOverview(
  params?: PaymentsOverviewParams,
  signal?: AbortSignal,
): Promise<PaymentsOverviewResponse> {
  return httpGet<PaymentsOverviewResponse>(
    "/api/payments/overview",
    params,
    financeRequestOptions(signal)
  );
}

export function createCashInflow(
  body: CashRegisterMovementCreateRequest,
): Promise<CashRegisterMovementResponse> {
  return httpPost<CashRegisterMovementResponse>(
    "/api/payments/cash-movements/inflow",
    body,
    financeRequestOptions()
  );
}

export function createCashOutflow(
  body: CashRegisterMovementCreateRequest,
): Promise<CashRegisterMovementResponse> {
  return httpPost<CashRegisterMovementResponse>(
    "/api/payments/cash-movements/outflow",
    body,
    financeRequestOptions()
  );
}

export function createCashTransfer(
  body: CashRegisterTransferCreateRequest,
): Promise<CashRegisterMovementResponse[]> {
  return httpPost<CashRegisterMovementResponse[]>(
    "/api/payments/cash-movements/transfer",
    body,
    financeRequestOptions()
  );
}
