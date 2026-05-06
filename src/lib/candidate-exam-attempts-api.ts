import { httpDelete, httpGet, httpPost, httpPut } from "./http";
import type {
  CandidateExamAttemptResponse,
  CandidateExamAttemptUpsertRequest,
} from "./types";

export function listCandidateExamAttempts(
  candidateId: string,
  signal?: AbortSignal
): Promise<CandidateExamAttemptResponse[]> {
  return httpGet<CandidateExamAttemptResponse[]>(
    `/api/candidates/${candidateId}/exam-attempts`,
    undefined,
    { signal }
  );
}

export function createCandidateExamAttempt(
  candidateId: string,
  body: CandidateExamAttemptUpsertRequest
): Promise<CandidateExamAttemptResponse> {
  return httpPost<CandidateExamAttemptResponse>(
    `/api/candidates/${candidateId}/exam-attempts`,
    body
  );
}

export function updateCandidateExamAttempt(
  candidateId: string,
  id: string,
  body: CandidateExamAttemptUpsertRequest
): Promise<CandidateExamAttemptResponse> {
  return httpPut<CandidateExamAttemptResponse>(
    `/api/candidates/${candidateId}/exam-attempts/${id}`,
    body
  );
}

export function deleteCandidateExamAttempt(candidateId: string, id: string): Promise<void> {
  return httpDelete(`/api/candidates/${candidateId}/exam-attempts/${id}`);
}

export function chargeCandidateExamAttempt(
  candidateId: string,
  id: string
): Promise<CandidateExamAttemptResponse> {
  return httpPost<CandidateExamAttemptResponse>(
    `/api/candidates/${candidateId}/exam-attempts/${id}/charge`,
    {}
  );
}

export function markCandidateExamAttemptPaid(
  candidateId: string,
  id: string
): Promise<CandidateExamAttemptResponse> {
  return httpPost<CandidateExamAttemptResponse>(
    `/api/candidates/${candidateId}/exam-attempts/${id}/mark-paid`,
    {}
  );
}
