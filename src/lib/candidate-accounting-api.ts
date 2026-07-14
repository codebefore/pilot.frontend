import { getFinanceApiBaseUrl } from "./api";
import { httpDelete, httpGet, httpPost, httpPostBlob, httpPut } from "./http";
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

export function createCandidateAccountingInvoiceFullReturn(
  candidateId: string,
  invoiceId: string,
  body: { invoiceDate: string; reason: string }
): Promise<CandidateAccountingInvoiceResponse> {
  return httpPost<CandidateAccountingInvoiceResponse>(
    `/api/finance/candidates/${candidateId}/accounting/invoices/${invoiceId}/full-return`,
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

export interface CandidateEArchiveSubmissionResponse {
  id: string;
  invoiceId: string;
  candidateId: string;
  providerCode: string;
  environment: string;
  status: string;
  externalUuid: string | null;
  externalReference: string | null;
  canModify: boolean;
  signingStartedAtUtc?: string | null;
  signingAcknowledgedAtUtc?: string | null;
  lastError?: string | null;
  cancellationDate?: string | null;
  cancellationReason?: string | null;
  cancellationStartedAtUtc?: string | null;
  cancelledAtUtc?: string | null;
  cancelledByUserId?: string | null;
  cancelledByName?: string | null;
}

export function cancelCandidateEArchiveInvoice(
  candidateId: string,
  invoiceId: string,
  body: { cancellationDate: string; cancellationReason: string }
): Promise<CandidateEArchiveSubmissionResponse> {
  return httpPost<CandidateEArchiveSubmissionResponse>(
    `/api/finance/candidates/${candidateId}/accounting/invoices/${invoiceId}/e-archive-submission/cancel`,
    body,
    financeRequestOptions()
  );
}

export function createCandidateEArchiveSubmission(
  candidateId: string,
  invoiceId: string
): Promise<CandidateEArchiveSubmissionResponse> {
  return httpPost<CandidateEArchiveSubmissionResponse>(
    `/api/finance/candidates/${candidateId}/accounting/invoices/${invoiceId}/e-archive-submissions`,
    undefined,
    financeRequestOptions()
  );
}

export function getCandidateEArchiveSubmission(
  candidateId: string,
  invoiceId: string,
  signal?: AbortSignal
): Promise<CandidateEArchiveSubmissionResponse> {
  return httpGet<CandidateEArchiveSubmissionResponse>(
    `/api/finance/candidates/${candidateId}/accounting/invoices/${invoiceId}/e-archive-submission`,
    undefined,
    financeRequestOptions(signal)
  );
}

export function signCandidateEArchiveDraft(
  candidateId: string,
  invoiceId: string
): Promise<CandidateEArchiveSubmissionResponse> {
  return httpPost<CandidateEArchiveSubmissionResponse>(
    `/api/finance/candidates/${candidateId}/accounting/invoices/${invoiceId}/e-archive-submission/sign`,
    undefined,
    financeRequestOptions()
  );
}

export function downloadCandidateEArchivePdf(
  candidateId: string,
  invoiceId: string
): Promise<Blob> {
  return httpPostBlob(
    `/api/finance/candidates/${candidateId}/accounting/invoices/${invoiceId}/e-archive-submission/pdf`,
    undefined,
    financeRequestOptions()
  );
}

export interface CandidateEDocumentRecipientResponse {
  documentType: "e-invoice" | "e-archive";
  recipientAlias: string | null;
}

export function getCandidateEDocumentRecipient(
  candidateId: string,
  signal?: AbortSignal
): Promise<CandidateEDocumentRecipientResponse> {
  return httpGet<CandidateEDocumentRecipientResponse>(
    `/api/finance/candidates/${candidateId}/e-document-recipient`,
    undefined,
    financeRequestOptions(signal)
  );
}
