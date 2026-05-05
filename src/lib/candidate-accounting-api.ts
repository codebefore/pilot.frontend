import { httpDelete, httpGet, httpPost, httpPut } from "./http";
import type {
  CandidateAccountingInvoiceResponse,
  CandidateAccountingInvoiceUpsertRequest,
  CandidateAccountingMovementCreateRequest,
  CandidateAccountingMovementResponse,
  CandidateAccountingPaymentCreateRequest,
  CandidateAccountingPaymentResponse,
  CandidateAccountingRefundCreateRequest,
  CandidateAccountingRefundResponse,
  CandidateAccountingSummaryResponse,
} from "./types";

export function getCandidateAccounting(
  candidateId: string,
  signal?: AbortSignal
): Promise<CandidateAccountingSummaryResponse> {
  return httpGet<CandidateAccountingSummaryResponse>(
    `/api/candidates/${candidateId}/accounting`,
    undefined,
    { signal }
  );
}

export function createCandidateAccountingMovement(
  candidateId: string,
  body: CandidateAccountingMovementCreateRequest
): Promise<CandidateAccountingMovementResponse> {
  return httpPost<CandidateAccountingMovementResponse>(
    `/api/candidates/${candidateId}/accounting/movements`,
    body
  );
}

export function cancelCandidateAccountingMovement(
  candidateId: string,
  movementId: string,
  cancellationReason?: string
): Promise<void> {
  return httpDelete(`/api/candidates/${candidateId}/accounting/movements/${movementId}`, {
    cancellationReason,
  });
}

export function createCandidateAccountingPayment(
  candidateId: string,
  body: CandidateAccountingPaymentCreateRequest
): Promise<CandidateAccountingPaymentResponse> {
  return httpPost<CandidateAccountingPaymentResponse>(
    `/api/candidates/${candidateId}/accounting/payments`,
    body
  );
}

export function cancelCandidateAccountingPayment(
  candidateId: string,
  paymentId: string,
  cancellationReason: string
): Promise<void> {
  return httpDelete(`/api/candidates/${candidateId}/accounting/payments/${paymentId}`, {
    cancellationReason,
  });
}

export function createCandidateAccountingRefund(
  candidateId: string,
  paymentId: string,
  body: CandidateAccountingRefundCreateRequest
): Promise<CandidateAccountingRefundResponse> {
  return httpPost<CandidateAccountingRefundResponse>(
    `/api/candidates/${candidateId}/accounting/payments/${paymentId}/refunds`,
    body
  );
}

export function createCandidateAccountingInvoice(
  candidateId: string,
  body: CandidateAccountingInvoiceUpsertRequest
): Promise<CandidateAccountingInvoiceResponse> {
  return httpPost<CandidateAccountingInvoiceResponse>(
    `/api/candidates/${candidateId}/accounting/invoices`,
    body
  );
}

export function updateCandidateAccountingInvoice(
  candidateId: string,
  invoiceId: string,
  body: CandidateAccountingInvoiceUpsertRequest
): Promise<CandidateAccountingInvoiceResponse> {
  return httpPut<CandidateAccountingInvoiceResponse>(
    `/api/candidates/${candidateId}/accounting/invoices/${invoiceId}`,
    body
  );
}

export function deleteCandidateAccountingInvoice(
  candidateId: string,
  invoiceId: string
): Promise<void> {
  return httpDelete(`/api/candidates/${candidateId}/accounting/invoices/${invoiceId}`);
}
