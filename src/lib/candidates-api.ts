import { httpDelete, httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type {
  CandidateGenderValue,
  CandidateGroupAssignmentResponse,
  CandidateResponse,
  CandidateTag,
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
export type ESinavTabValue = "havuz" | "basarisiz" | "randevulu";

export interface GetCandidatesParams extends QueryParams {
  search?: string;
  status?: string;
  eSinavTab?: ESinavTabValue;
  groupId?: string;
  groupTitle?: string;
  groupStartDateFrom?: string;
  groupStartDateTo?: string;
  hasActiveGroup?: boolean;
  hasMissingDocuments?: boolean;
  hasPhoto?: boolean;
  hasMebExamResult?: boolean;
  examFeePaid?: boolean;
  licenseClass?: LicenseClass;
  firstName?: string;
  lastName?: string;
  nationalId?: string;
  phoneNumber?: string;
  email?: string;
  /** Query param is strict canonical English — map legacy values first. */
  gender?: CandidateGenderValue;
  birthDateFrom?: string;
  birthDateTo?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  updatedAtFrom?: string;
  updatedAtTo?: string;
  missingDocumentCountMin?: number;
  missingDocumentCountMax?: number;
  /**
   * Filter candidates by one or more tag names. Sent as repeated query
   * params (?tags=A&tags=B) — backend reads as `string[] tags`.
   * Multi-tag semantics on backend: AND (candidates must carry every tag).
   */
  tags?: readonly string[];
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

export function searchCandidateTags(
  search?: string,
  limit = 20,
  signal?: AbortSignal
): Promise<CandidateTag[]> {
  return httpGet<CandidateTag[]>(
    "/api/candidates/tags",
    { search: search?.trim() || undefined, limit },
    { signal }
  );
}

export function createCandidateTag(name: string): Promise<CandidateTag> {
  return httpPost<CandidateTag>("/api/candidates/tags", { name });
}

export function updateCandidateTag(id: string, name: string): Promise<CandidateTag> {
  return httpPut<CandidateTag>(`/api/candidates/tags/${id}`, { name });
}

export function deleteCandidateTag(id: string): Promise<void> {
  return httpDelete(`/api/candidates/tags/${id}`);
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
