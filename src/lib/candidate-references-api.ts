import { getCandidateApiBaseUrl } from "./api";
import { httpDelete, httpGet, httpPost, httpPut } from "./http";

const candidateRequestOptions = (signal?: AbortSignal) => ({
  baseUrl: getCandidateApiBaseUrl(),
  signal,
});

export interface CandidateReferenceResponse {
  id: string;
  kind?: CandidateReferenceKind;
  name: string;
  vehicleIds?: string[];
  displayOrder: number;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

interface CandidateReferenceListResponse {
  items: CandidateReferenceResponse[];
}

export type CandidateReferenceKind = "reference" | "route";

interface CandidateReferenceUpsertRequest {
  kind?: CandidateReferenceKind;
  name: string;
  vehicleIds?: string[];
  displayOrder: number;
  isActive: boolean;
  rowVersion?: number;
}

export async function getCandidateReferences(
  options: { includeInactive?: boolean; kind?: CandidateReferenceKind } = {},
  signal?: AbortSignal
): Promise<CandidateReferenceResponse[]> {
  const params = new URLSearchParams();
  if (options.kind) {
    params.set("kind", options.kind);
  }
  if (options.includeInactive) {
    params.set("includeInactive", "true");
  }
  const query = params.toString();
  const url = query ? `/api/candidate-references?${query}` : "/api/candidate-references";
  const response = await httpGet<CandidateReferenceListResponse>(
    url,
    undefined,
    candidateRequestOptions(signal)
  );
  return response.items;
}

export function createCandidateReference(
  body: CandidateReferenceUpsertRequest
): Promise<CandidateReferenceResponse> {
  return httpPost<CandidateReferenceResponse>(
    "/api/candidate-references",
    body,
    candidateRequestOptions()
  );
}

export function updateCandidateReference(
  id: string,
  body: CandidateReferenceUpsertRequest
): Promise<CandidateReferenceResponse> {
  return httpPut<CandidateReferenceResponse>(
    `/api/candidate-references/${id}`,
    body,
    candidateRequestOptions()
  );
}

export function deleteCandidateReference(id: string): Promise<void> {
  return httpDelete(`/api/candidate-references/${id}`, undefined, candidateRequestOptions());
}
