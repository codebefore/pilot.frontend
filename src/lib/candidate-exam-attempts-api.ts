import { getTrainingApiBaseUrl } from "./api";
import { httpDelete, httpGet, httpPost, httpPut } from "./http";
import type {
  CandidateExamAttemptResponse,
  CandidateExamAttemptUpsertRequest,
} from "./types";

function trainingOptions(signal?: AbortSignal) {
  return { baseUrl: getTrainingApiBaseUrl(), signal };
}

export function listCandidateExamAttempts(
  candidateId: string,
  signal?: AbortSignal
): Promise<CandidateExamAttemptResponse[]> {
  return httpGet<CandidateExamAttemptResponse[]>(
    `/api/candidates/${candidateId}/exam-attempts`,
    undefined,
    trainingOptions(signal)
  );
}

export function createCandidateExamAttempt(
  candidateId: string,
  body: CandidateExamAttemptUpsertRequest
): Promise<CandidateExamAttemptResponse> {
  return httpPost<CandidateExamAttemptResponse>(
    `/api/candidates/${candidateId}/exam-attempts`,
    body,
    trainingOptions()
  );
}

export function updateCandidateExamAttempt(
  candidateId: string,
  id: string,
  body: CandidateExamAttemptUpsertRequest
): Promise<CandidateExamAttemptResponse> {
  return httpPut<CandidateExamAttemptResponse>(
    `/api/candidates/${candidateId}/exam-attempts/${id}`,
    body,
    trainingOptions()
  );
}

export function deleteCandidateExamAttempt(candidateId: string, id: string): Promise<void> {
  return httpDelete(`/api/candidates/${candidateId}/exam-attempts/${id}`, undefined, trainingOptions());
}

export function chargeCandidateExamAttempt(
  candidateId: string,
  id: string
): Promise<CandidateExamAttemptResponse> {
  return httpPost<CandidateExamAttemptResponse>(
    `/api/candidates/${candidateId}/exam-attempts/${id}/charge`,
    {},
    trainingOptions()
  );
}

export function markCandidateExamAttemptSelfPaid(
  candidateId: string,
  id: string
): Promise<CandidateExamAttemptResponse> {
  return httpPost<CandidateExamAttemptResponse>(
    `/api/candidates/${candidateId}/exam-attempts/${id}/mark-self-paid`,
    {},
    trainingOptions()
  );
}
