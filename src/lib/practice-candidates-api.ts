import { getTrainingApiBaseUrl } from "./api";
import { httpGet, type QueryParams } from "./http";
import type { PagedResponse } from "./types";

const trainingRequestOptions = (signal?: AbortSignal) => ({
  baseUrl: getTrainingApiBaseUrl(),
  signal,
});

export type PracticeCandidateTab = "all" | "havuz" | "basarisiz" | "randevulu";
export type PracticeCandidateSortField =
  | "name"
  | "licenseClass"
  | "groupTitle"
  | "theoryExamDate"
  | "drivingExamDate"
  | "attemptNumber"
  | "progress"
  | "lastPracticeLessonAt";
export type PracticeCandidateSortDirection = "asc" | "desc";

export type PracticeCandidateListItem = {
  candidateId: string;
  registrationNumber: string;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  gender?: string | null;
  photo?: {
    documentId: string;
    kind: string;
  } | null;
  licenseClass: string;
  existingLicenseType?: string | null;
  groupId: string | null;
  groupTitle: string | null;
  attemptNumber: number;
  maxAttemptCount: number;
  attemptSlotLabel: string;
  practiceRoundNumber: number;
  totalAttemptNumber: number;
  completedPracticeHours: number;
  targetPracticeHours: number;
  remainingPracticeHours: number;
  lastPracticeLessonAt: string | null;
  tabStatus: Exclude<PracticeCandidateTab, "all">;
};

export type PracticeCandidateTabCounts = {
  all: number;
  havuz: number;
  basarisiz: number;
  randevulu: number;
};

export type PracticeCandidateFilterOptions = {
  licenseClasses: string[];
  groups: {
    id: string;
    title: string;
  }[];
};

export type PracticeCandidateListResponse = PagedResponse<PracticeCandidateListItem> & {
  tabCounts: PracticeCandidateTabCounts;
  filterOptions: PracticeCandidateFilterOptions;
};

export interface GetPracticeCandidatesParams extends QueryParams {
  tab?: PracticeCandidateTab;
  search?: string;
  licenseClasses?: readonly string[];
  groupIds?: readonly string[];
  attemptNumbers?: readonly number[];
  sortBy?: PracticeCandidateSortField;
  sortDir?: PracticeCandidateSortDirection;
  page?: number;
  pageSize?: number;
}

export function getPracticeCandidates(
  params?: GetPracticeCandidatesParams,
  signal?: AbortSignal
): Promise<PracticeCandidateListResponse> {
  return httpGet<PracticeCandidateListResponse>(
    "/api/training/practice-candidates",
    params,
    trainingRequestOptions(signal)
  );
}
