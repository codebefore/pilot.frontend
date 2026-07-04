import { getCandidateApiBaseUrl, getTrainingApiBaseUrl } from "./api";
import { getDocumentChecklistByCandidateIds } from "./documents-api";
import { httpDelete, httpGet, httpPatch, httpPost, httpPut, type QueryParams } from "./http";
import type {
  CandidateExistingLicenseRequest,
  CandidateGenderValue,
  CandidateGroupAssignmentResponse,
  CandidateResponse,
  CandidateReuseSourceResponse,
  CandidateTag,
  CandidateUpsertRequest,
  DocumentChecklistEntry,
  LicenseClass,
  PagedResponse,
} from "./types";

const candidateRequestOptions = (signal?: AbortSignal) => ({
  baseUrl: getCandidateApiBaseUrl(),
  signal,
});

const trainingRequestOptions = (signal?: AbortSignal) => ({
  baseUrl: getTrainingApiBaseUrl(),
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
  | "groupCreatedAtUtc"
  | "eSinavDate"
  | "drivingExamDate"
  | "examAttemptCount"
  | "drivingExamAttemptCount"
  | "drivingExamAttendanceStatus"
  | "examStatus"
  | "totalFee"
  | "totalPaid"
  | "totalDebt";

export type SortDirection = "asc" | "desc";
export type CandidateExamTabValue = "havuz" | "basarisiz" | "randevulu";
export type ESinavTabValue = CandidateExamTabValue;

export type DeleteInstitutionCandidatesResponse = {
  deletedCount: number;
};

export interface GetCandidatesParams extends QueryParams {
  search?: string;
  status?: string;
  eSinavTab?: ESinavTabValue;
  drivingExamTab?: CandidateExamTabValue;
  eSinavDate?: string;
  drivingExamDate?: string;
  eSinavScheduleId?: string;
  drivingExamScheduleId?: string;
  drivingExamCode?: string;
  groupIds?: readonly string[];
  termIds?: readonly string[];
  existingLicenseTypes?: readonly string[];
  groupStartDateFrom?: string;
  groupStartDateTo?: string;
  hasExamResult?: boolean;
  mebExamResult?: string;
  examStatus?: readonly string[];
  examAttemptCount?: readonly string[];
  drivingExamAttendanceStatus?: string;
  licenseClasses?: readonly LicenseClass[];
  firstName?: string;
  lastName?: string;
  nationalId?: string;
  motherName?: string;
  fatherName?: string;
  phoneNumber?: string;
  /** Query param is strict canonical English — map legacy values first. */
  gender?: CandidateGenderValue;
  birthDateFrom?: string;
  birthDateTo?: string;
  mebExamDateFrom?: string;
  mebExamDateTo?: string;
  drivingExamDateFrom?: string;
  drivingExamDateTo?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  updatedAtFrom?: string;
  updatedAtTo?: string;
  totalFeeMin?: number;
  totalFeeMax?: number;
  totalPaidMin?: number;
  totalPaidMax?: number;
  totalDebtMin?: number;
  totalDebtMax?: number;
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
  return httpGet<PagedResponse<CandidateResponse>>(
    "/api/candidates",
    params,
    candidateRequestOptions(signal)
  ).then((response) => enrichCandidatesWithDocumentOverview(response, signal));
}

async function enrichCandidatesWithDocumentOverview(
  response: PagedResponse<CandidateResponse>,
  signal?: AbortSignal
): Promise<PagedResponse<CandidateResponse>> {
  if (response.items.length === 0) {
    return response;
  }

  const overviewItems = await getDocumentChecklistByCandidateIds(
    response.items.map((candidate) => candidate.id),
    signal
  ).catch(
    () => null
  );
  if (!overviewItems) {
    return response;
  }

  const overviewByCandidateId = new Map(overviewItems.map((item) => [item.candidateId, item]));

  return {
    ...response,
    items: response.items.map((candidate) =>
      mergeCandidateWithDocumentOverview(candidate, overviewByCandidateId.get(candidate.id))
    ),
  };
}

async function enrichCandidateWithDocumentOverview(
  candidate: CandidateResponse,
  signal?: AbortSignal
): Promise<CandidateResponse> {
  if (!candidate.id) {
    return candidate;
  }

  const overviewItems = await getDocumentChecklistByCandidateIds([candidate.id], signal).catch(() => null);

  return mergeCandidateWithDocumentOverview(candidate, overviewItems?.[0]);
}

function mergeCandidateWithDocumentOverview(
  candidate: CandidateResponse,
  item: DocumentChecklistEntry | undefined
): CandidateResponse {
  return item
    ? {
        ...candidate,
        documentSummary: item.summary,
        photo: item.photo ?? null,
      }
    : candidate;
}

export function getCandidateById(
  id: string,
  signal?: AbortSignal
): Promise<CandidateResponse> {
  return httpGet<CandidateResponse>(
    `/api/candidates/${id}`,
    undefined,
    candidateRequestOptions(signal)
  ).then((candidate) => enrichCandidateWithDocumentOverview(candidate, signal));
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
  ).then((candidate) => enrichCandidateWithDocumentOverview(candidate));
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
  ).then((candidate) => enrichCandidateWithDocumentOverview(candidate));
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

export function deleteInstitutionCandidates(): Promise<DeleteInstitutionCandidatesResponse> {
  return httpDelete<DeleteInstitutionCandidatesResponse>(
    "/api/candidates",
    undefined,
    candidateRequestOptions()
  );
}

export function removeActiveGroupAssignment(candidateId: string): Promise<void> {
  return httpDelete(
    `/api/training/candidates/${candidateId}/group-assignments/active`,
    undefined,
    trainingRequestOptions()
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
    `/api/training/candidates/${candidateId}/group-assignments`,
    { groupId },
    trainingRequestOptions()
  );
}
