import { httpDelete, httpGet, httpPost, httpPut } from "./http";

export interface CandidateReferenceResponse {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

interface CandidateReferenceListResponse {
  items: CandidateReferenceResponse[];
}

export interface CandidateReferenceUpsertRequest {
  name: string;
  displayOrder: number;
  isActive: boolean;
  rowVersion?: number;
}

export async function getCandidateReferences(
  options: { includeInactive?: boolean } = {}
): Promise<CandidateReferenceResponse[]> {
  const params = new URLSearchParams();
  if (options.includeInactive) {
    params.set("includeInactive", "true");
  }
  const query = params.toString();
  const url = query ? `/api/candidate-references?${query}` : "/api/candidate-references";
  const response = await httpGet<CandidateReferenceListResponse>(url);
  return response.items;
}

export function createCandidateReference(
  body: CandidateReferenceUpsertRequest
): Promise<CandidateReferenceResponse> {
  return httpPost<CandidateReferenceResponse>("/api/candidate-references", body);
}

export function updateCandidateReference(
  id: string,
  body: CandidateReferenceUpsertRequest
): Promise<CandidateReferenceResponse> {
  return httpPut<CandidateReferenceResponse>(`/api/candidate-references/${id}`, body);
}

export function deleteCandidateReference(id: string): Promise<void> {
  return httpDelete(`/api/candidate-references/${id}`);
}
