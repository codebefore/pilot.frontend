import { httpDelete, httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type {
  CandidateGroupAssignmentResponse,
  CandidateResponse,
  CandidateUpsertRequest,
  LicenseClass,
  PagedResponse,
} from "./types";

/** Backend-supported sort fields for GET /api/candidates. */
export type CandidateSortField =
  | "createdAtUtc"
  | "name"
  | "nationalId"
  | "licenseClass"
  | "status"
  | "groupTitle"
  | "missingDocumentCount";

export type SortDirection = "asc" | "desc";

export interface GetCandidatesParams extends QueryParams {
  search?: string;
  status?: string;
  groupId?: string;
  hasActiveGroup?: boolean;
  hasMissingDocuments?: boolean;
  licenseClass?: LicenseClass;
  sortBy?: CandidateSortField;
  sortDir?: SortDirection;
  page?: number;
  pageSize?: number;
}

export function getCandidates(
  params?: GetCandidatesParams,
  signal?: AbortSignal
): Promise<PagedResponse<CandidateResponse>> {
  return httpGet<PagedResponse<CandidateResponse>>("/api/candidates", params, { signal });
}

export function getCandidateById(
  id: string,
  signal?: AbortSignal
): Promise<CandidateResponse> {
  return httpGet<CandidateResponse>(`/api/candidates/${id}`, undefined, { signal });
}

export function createCandidate(
  body: CandidateUpsertRequest
): Promise<CandidateResponse> {
  return httpPost<CandidateResponse>("/api/candidates", body);
}

export function updateCandidate(
  id: string,
  body: CandidateUpsertRequest
): Promise<CandidateResponse> {
  return httpPut<CandidateResponse>(`/api/candidates/${id}`, body);
}

export function deleteCandidate(id: string): Promise<void> {
  return httpDelete(`/api/candidates/${id}`);
}

export function removeActiveGroupAssignment(candidateId: string): Promise<void> {
  return httpDelete(`/api/candidates/${candidateId}/group-assignments/active`);
}

export function assignCandidateGroup(
  candidateId: string,
  groupId: string
): Promise<CandidateGroupAssignmentResponse> {
  return httpPost<CandidateGroupAssignmentResponse>(
    `/api/candidates/${candidateId}/group-assignments`,
    { groupId }
  );
}
