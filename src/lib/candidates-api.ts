import { getCandidateApiBaseUrl } from "./api";
import { httpDelete, httpGet, httpPatch, httpPost, httpPut, type QueryParams } from "./http";
import type {
  CandidateExistingLicenseRequest,
  CandidateGenderValue,
  CandidateGroupAssignmentResponse,
  CandidateResponse,
  CandidateReuseSourceResponse,
  CandidateTag,
  CandidateUpsertRequest,
  ExamScheduleOption,
  LicenseClass,
  PagedResponse,
} from "./types";

const candidateRequestOptions = (signal?: AbortSignal) => ({
  baseUrl: getCandidateApiBaseUrl(),
  signal,
});

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
export type CandidateExamTabValue = "havuz" | "basarisiz" | "randevulu";
export type ESinavTabValue = CandidateExamTabValue;
export type CandidateExamDateType = "e_sinav" | "uygulama";
export type CandidateListTabValue = "active_period" | "unassigned" | "completed";

export interface GetCandidatesParams extends QueryParams {
  search?: string;
  status?: string;
  candidateTab?: CandidateListTabValue;
  eSinavTab?: ESinavTabValue;
  drivingExamTab?: CandidateExamTabValue;
  eSinavDate?: string;
  drivingExamDate?: string;
  drivingExamCode?: string;
  groupIds?: readonly string[];
  termIds?: readonly string[];
  existingLicenseTypes?: readonly string[];
  groupTitle?: string;
  groupStartDateFrom?: string;
  groupStartDateTo?: string;
  hasMissingDocuments?: boolean;
  hasPhoto?: boolean;
  hasExamResult?: boolean;
  licenseClasses?: readonly LicenseClass[];
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

interface GetExamScheduleOptionsParams
  extends Omit<GetCandidatesParams, "page" | "pageSize" | "sortBy" | "sortDir"> {
  examType: CandidateExamDateType;
}

export function getCandidates(
  params?: GetCandidatesParams,
  signal?: AbortSignal
): Promise<PagedResponse<CandidateResponse>> {
  return httpGet<PagedResponse<CandidateResponse>>(
    "/api/candidates",
    params,
    candidateRequestOptions(signal)
  );
}

export function getExamScheduleOptions(
  params: GetExamScheduleOptionsParams,
  signal?: AbortSignal
): Promise<ExamScheduleOption[]> {
  return httpGet<ExamScheduleOption[]>("/api/candidates/exam-date-options", params, {
    ...candidateRequestOptions(signal),
  });
}

export function getCandidateById(
  id: string,
  signal?: AbortSignal
): Promise<CandidateResponse> {
  return httpGet<CandidateResponse>(
    `/api/candidates/${id}`,
    undefined,
    candidateRequestOptions(signal)
  );
}

export function getCandidateReuseSources(
  nationalId: string,
  signal?: AbortSignal
): Promise<CandidateReuseSourceResponse[]> {
  return httpGet<CandidateReuseSourceResponse[]>(
    "/api/candidates/reuse-sources",
    { nationalId },
    candidateRequestOptions(signal)
  );
}

export function createCandidate(
  body: CandidateUpsertRequest
): Promise<CandidateResponse> {
  return httpPost<CandidateResponse>("/api/candidates", body, candidateRequestOptions());
}

export function updateCandidate(
  id: string,
  body: CandidateUpsertRequest
): Promise<CandidateResponse> {
  return httpPut<CandidateResponse>(
    `/api/candidates/${id}`,
    body,
    candidateRequestOptions()
  );
}

export function setCandidateTheoryExemption(
  id: string,
  isTheoryExempt: boolean
): Promise<void> {
  return httpPatch<void>(
    `/api/candidates/${id}/theory-exemption`,
    { isTheoryExempt },
    candidateRequestOptions()
  );
}

export function setCandidateRegistrationNumber(
  id: string,
  registrationNumber: string,
  rowVersion: number
): Promise<void> {
  return httpPatch<void>(
    `/api/candidates/${id}/registration-number`,
    { registrationNumber, rowVersion },
    candidateRequestOptions()
  );
}

export function setCandidateRegistrationDate(
  id: string,
  registrationDate: string,
  rowVersion: number
): Promise<void> {
  return httpPatch<void>(
    `/api/candidates/${id}/registration-date`,
    { registrationDate, rowVersion },
    candidateRequestOptions()
  );
}

export function updateCandidateExistingLicense(
  id: string,
  body: CandidateExistingLicenseRequest
): Promise<CandidateResponse> {
  return httpPut<CandidateResponse>(
    `/api/candidates/${id}/existing-license`,
    body,
    candidateRequestOptions()
  );
}

export function setCandidateSecondPracticeRound(
  id: string,
  enabled: boolean,
  rowVersion: number
): Promise<CandidateResponse> {
  return httpPatch<CandidateResponse>(
    `/api/candidates/${id}/second-practice-round`,
    { enabled, rowVersion },
    candidateRequestOptions()
  );
}

export function deleteCandidate(id: string): Promise<void> {
  return httpDelete(`/api/candidates/${id}`, undefined, candidateRequestOptions());
}

export function removeActiveGroupAssignment(candidateId: string): Promise<void> {
  return httpDelete(
    `/api/candidates/${candidateId}/group-assignments/active`,
    undefined,
    candidateRequestOptions()
  );
}

export function searchCandidateTags(
  search?: string,
  limit = 20,
  signal?: AbortSignal
): Promise<CandidateTag[]> {
  return httpGet<CandidateTag[]>(
    "/api/candidates/tags",
    { search: search?.trim() || undefined, limit },
    candidateRequestOptions(signal)
  );
}

export function createCandidateTag(name: string): Promise<CandidateTag> {
  return httpPost<CandidateTag>(
    "/api/candidates/tags",
    { name },
    candidateRequestOptions()
  );
}

export function updateCandidateTag(id: string, name: string): Promise<CandidateTag> {
  return httpPut<CandidateTag>(
    `/api/candidates/tags/${id}`,
    { name },
    candidateRequestOptions()
  );
}

export function deleteCandidateTag(id: string): Promise<void> {
  return httpDelete(`/api/candidates/tags/${id}`, undefined, candidateRequestOptions());
}

export function assignCandidateGroup(
  candidateId: string,
  groupId: string
): Promise<CandidateGroupAssignmentResponse> {
  return httpPost<CandidateGroupAssignmentResponse>(
    `/api/candidates/${candidateId}/group-assignments`,
    { groupId },
    candidateRequestOptions()
  );
}
