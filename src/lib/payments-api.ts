import { getFinanceApiBaseUrl } from "./api";
import { getCandidatePhotosByCandidateIds } from "./documents-api";
import { httpGet, httpPost } from "./http";
import type {
  CashRegisterMovementCreateRequest,
  CashRegisterMovementResponse,
  PaymentCandidateSummaryResponse,
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
  return getPaymentsOverviewWithoutCandidatePhotos(params, signal)
    .then((response) => enrichPaymentsOverviewWithCandidatePhotos(response, signal));
}

export function getPaymentsOverviewWithoutCandidatePhotos(
  params?: PaymentsOverviewParams,
  signal?: AbortSignal,
): Promise<PaymentsOverviewResponse> {
  return httpGet<PaymentsOverviewResponse>(
    "/api/finance/payments/overview",
    params,
    financeRequestOptions(signal)
  );
}

export async function enrichPaymentsOverviewWithCandidatePhotos(
  response: PaymentsOverviewResponse,
  signal?: AbortSignal
): Promise<PaymentsOverviewResponse> {
  const candidates = collectPaymentCandidates(response);
  if (candidates.length === 0) {
    return response;
  }

  const candidateIds = [...new Set(candidates.map((candidate) => candidate.id).filter(Boolean))];
  if (candidateIds.length === 0) {
    return response;
  }

  const overviewItems = await getCandidatePhotosByCandidateIds(candidateIds, signal).catch(() => null);
  if (!overviewItems) {
    return response;
  }

  const photoByCandidateId = new Map(
    overviewItems.map((item) => [item.candidateId, item.photo ?? null])
  );
  return {
    ...response,
    payments: (response.payments ?? []).map((payment) => ({
      ...payment,
      candidate: withCandidatePhoto(payment.candidate, photoByCandidateId),
    })),
    refunds: response.refunds?.map((refund) => ({
      ...refund,
      candidate: withCandidatePhoto(refund.candidate, photoByCandidateId),
    })),
    invoices: response.invoices?.map((invoice) => ({
      ...invoice,
      candidate: withCandidatePhoto(invoice.candidate, photoByCandidateId),
    })),
    installments: (response.installments ?? []).map((installment) => ({
      ...installment,
      candidate: withCandidatePhoto(installment.candidate, photoByCandidateId),
    })),
  };
}

function collectPaymentCandidates(response: PaymentsOverviewResponse): PaymentCandidateSummaryResponse[] {
  return [
    ...(response.payments ?? []).map((item) => item.candidate),
    ...(response.refunds ?? []).map((item) => item.candidate),
    ...(response.invoices ?? []).map((item) => item.candidate),
    ...(response.installments ?? []).map((item) => item.candidate),
  ].filter(Boolean);
}

function withCandidatePhoto(
  candidate: PaymentCandidateSummaryResponse,
  photoByCandidateId: Map<string, PaymentCandidateSummaryResponse["photo"]>
): PaymentCandidateSummaryResponse {
  return photoByCandidateId.has(candidate.id)
    ? { ...candidate, photo: photoByCandidateId.get(candidate.id) ?? null }
    : candidate;
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
      occurredAtUtc: body.occurredAtUtc,
      note: body.note,
    },
    financeRequestOptions()
  );
}
