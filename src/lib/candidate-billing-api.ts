import { httpDelete, httpGet, httpPost } from "./http";
import type {
  CandidateBillingSummaryResponse,
  CandidateChargeCreateRequest,
  CandidateChargeResponse,
  CandidatePaymentCreateRequest,
  CandidatePaymentPlanCreateRequest,
  CandidatePaymentResponse,
} from "./types";

export function getCandidateBilling(
  candidateId: string,
  signal?: AbortSignal
): Promise<CandidateBillingSummaryResponse> {
  return httpGet<CandidateBillingSummaryResponse>(
    `/api/candidates/${candidateId}/billing`,
    undefined,
    { signal }
  );
}

export function createCandidateCharge(
  candidateId: string,
  body: CandidateChargeCreateRequest
): Promise<CandidateChargeResponse> {
  return httpPost<CandidateChargeResponse>(
    `/api/candidates/${candidateId}/billing/charges`,
    body
  );
}

export function createCandidateSuggestedCharge(
  candidateId: string
): Promise<CandidateChargeResponse> {
  return httpPost<CandidateChargeResponse>(
    `/api/candidates/${candidateId}/billing/charges/suggested`,
    {}
  );
}

export function cancelCandidateCharge(
  candidateId: string,
  chargeId: string,
  cancellationReason: string
): Promise<void> {
  return httpDelete(`/api/candidates/${candidateId}/billing/charges/${chargeId}`, {
    cancellationReason,
  });
}

export function createCandidatePayment(
  candidateId: string,
  body: CandidatePaymentCreateRequest
): Promise<CandidatePaymentResponse> {
  return httpPost<CandidatePaymentResponse>(
    `/api/candidates/${candidateId}/billing/payments`,
    body
  );
}

export function createCandidatePaymentPlan(
  candidateId: string,
  body: CandidatePaymentPlanCreateRequest
): Promise<CandidateBillingSummaryResponse> {
  return httpPost<CandidateBillingSummaryResponse>(
    `/api/candidates/${candidateId}/billing/payment-plan`,
    body
  );
}

export function cancelCandidatePayment(
  candidateId: string,
  paymentId: string,
  cancellationReason: string
): Promise<void> {
  return httpDelete(`/api/candidates/${candidateId}/billing/payments/${paymentId}`, {
    cancellationReason,
  });
}
