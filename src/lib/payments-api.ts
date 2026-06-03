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
    "/api/finance/payments/overview",
    params,
    financeRequestOptions(signal)
  );
}

export function createCashInflow(
  body: CashRegisterMovementCreateRequest,
): Promise<CashRegisterMovementResponse> {
  return httpPost<CashRegisterMovementResponse>(
    "/api/finance/cash-register-movements",
    { ...body, type: "inflow" },
    financeRequestOptions()
  );
}

export function createCashOutflow(
  body: CashRegisterMovementCreateRequest,
): Promise<CashRegisterMovementResponse> {
  return httpPost<CashRegisterMovementResponse>(
    "/api/finance/cash-register-movements",
    { ...body, type: "outflow" },
    financeRequestOptions()
  );
}

export function createCashTransfer(
  body: CashRegisterTransferCreateRequest,
): Promise<CashRegisterMovementResponse[]> {
  return httpPost<CashRegisterMovementResponse[]>(
    "/api/finance/cash-register-transfers",
    {
      fromCashRegisterId: body.sourceCashRegisterId,
      toCashRegisterId: body.targetCashRegisterId,
      amount: body.amount,
      occurredDate: body.occurredDate,
      note: body.note,
    },
    financeRequestOptions()
  );
}
