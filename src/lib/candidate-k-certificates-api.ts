import { httpDelete, httpGet, httpPost } from "./http";
import type {
  CandidateKCertificateCreateRequest,
  CandidateKCertificateResponse,
} from "./types";

export function listCandidateKCertificates(
  candidateId: string,
  signal?: AbortSignal
): Promise<CandidateKCertificateResponse[]> {
  return httpGet<CandidateKCertificateResponse[]>(
    `/api/candidates/${candidateId}/k-certificates`,
    undefined,
    { signal }
  );
}

export function createCandidateKCertificate(
  candidateId: string,
  body: CandidateKCertificateCreateRequest
): Promise<CandidateKCertificateResponse> {
  return httpPost<CandidateKCertificateResponse>(
    `/api/candidates/${candidateId}/k-certificates`,
    body
  );
}

export function deleteCandidateKCertificate(
  candidateId: string,
  id: string
): Promise<void> {
  return httpDelete(`/api/candidates/${candidateId}/k-certificates/${id}`);
}
