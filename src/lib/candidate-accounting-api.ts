import { getFinanceApiBaseUrl } from "./api";
import { httpDelete, httpGet, httpPost, httpPut } from "./http";
import type {
  CandidateAccountingInvoiceResponse,
  CandidateAccountingInvoiceUpsertRequest,
  CandidateAccountingMovementBulkCreateRequest,
  CandidateAccountingMovementCreateRequest,
  CandidateAccountingMovementResponse,
  CandidateAccountingPaymentCreateRequest,
  CandidateAccountingPaymentResponse,
  CandidateAccountingRefundCreateRequest,
  CandidateAccountingRefundResponse,
  CandidateAccountingSummaryResponse,
} from "./types";

const financeRequestOptions = (signal?: AbortSignal) => ({
  baseUrl: getFinanceApiBaseUrl(),
  signal,
});

export function getCandidateAccounting(
  candidateId: string,
  signal?: AbortSignal
): Promise<CandidateAccountingSummaryResponse> {
  return httpGet<CandidateAccountingSummaryResponse>(
    `/api/finance/candidates/${candidateId}/summary`,
    undefined,
    financeRequestOptions(signal)
  );
}

export function createCandidateAccountingMovement(
  candidateId: string,
  body: CandidateAccountingMovementCreateRequest
): Promise<CandidateAccountingMovementResponse> {
  return httpPost<CandidateAccountingMovementResponse>(
    `/api/finance/candidates/${candidateId}/accounting/debts`,
    body,
    financeRequestOptions()
  );
}

export function createCandidateAccountingMovements(
  candidateId: string,
  body: CandidateAccountingMovementBulkCreateRequest
): Promise<CandidateAccountingMovementResponse[]> {
  return httpPost<CandidateAccountingMovementResponse[]>(
    `/api/finance/candidates/${candidateId}/accounting/debts/bulk`,
    body,
    financeRequestOptions()
  );
}

export function cancelCandidateAccountingMovement(
  candidateId: string,
  movementId: string,
  cancellationReason?: string
): Promise<void> {
  return httpDelete(
    `/api/finance/candidates/${candidateId}/accounting/debts/${movementId}`,
    { cancellationReason },
    financeRequestOptions()
  );
}

export function createCandidateAccountingPayment(
  candidateId: string,
  body: CandidateAccountingPaymentCreateRequest
): Promise<CandidateAccountingPaymentResponse> {
  return httpPost<CandidateAccountingPaymentResponse>(
    `/api/finance/candidates/${candidateId}/accounting/payments`,
    body,
    financeRequestOptions()
  );
}

export function cancelCandidateAccountingPayment(
  candidateId: string,
  paymentId: string,
  cancellationReason: string
): Promise<void> {
  return httpDelete(
    `/api/finance/candidates/${candidateId}/accounting/payments/${paymentId}`,
    { cancellationReason },
    financeRequestOptions()
  );
}

export function createCandidateAccountingRefund(
  candidateId: string,
  paymentId: string,
  body: CandidateAccountingRefundCreateRequest
): Promise<CandidateAccountingRefundResponse> {
  return httpPost<CandidateAccountingRefundResponse>(
    `/api/finance/candidates/${candidateId}/accounting/payments/${paymentId}/refunds`,
    body,
    financeRequestOptions()
  );
}

export function createCandidateAccountingInvoice(
  candidateId: string,
  body: CandidateAccountingInvoiceUpsertRequest
): Promise<CandidateAccountingInvoiceResponse> {
  return httpPost<CandidateAccountingInvoiceResponse>(
    `/api/finance/candidates/${candidateId}/accounting/invoices`,
    body,
    financeRequestOptions()
  );
}

export function updateCandidateAccountingInvoice(
  candidateId: string,
  invoiceId: string,
  body: CandidateAccountingInvoiceUpsertRequest
): Promise<CandidateAccountingInvoiceResponse> {
  return httpPut<CandidateAccountingInvoiceResponse>(
    `/api/finance/candidates/${candidateId}/accounting/invoices/${invoiceId}`,
    body,
    financeRequestOptions()
  );
}

export function deleteCandidateAccountingInvoice(
  candidateId: string,
  invoiceId: string
): Promise<void> {
  return httpDelete(
    `/api/finance/candidates/${candidateId}/accounting/invoices/${invoiceId}`,
    undefined,
    financeRequestOptions()
  );
}
