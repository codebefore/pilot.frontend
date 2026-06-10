import { getTrainingApiBaseUrl } from "./api";
import { httpGet, type QueryParams } from "./http";
import type { PagedResponse } from "./types";

const trainingRequestOptions = (signal?: AbortSignal) => ({
  baseUrl: getTrainingApiBaseUrl(),
  signal,
});

export type PracticeCandidateTab = "all" | "havuz" | "basarisiz" | "randevulu";

export type PracticeCandidateListItem = {
  candidateId: string;
  registrationNumber: string;
  fullName: string;
  licenseClass: string;
  groupId: string | null;
  groupTitle: string | null;
  attemptNumber: number;
  maxAttemptCount: number;
  attemptSlotLabel: string;
  completedPracticeHours: number;
  targetPracticeHours: number;
  remainingPracticeHours: number;
  lastPracticeLessonAt: string | null;
  tabStatus: Exclude<PracticeCandidateTab, "all">;
};

export interface GetPracticeCandidatesParams extends QueryParams {
  tab?: PracticeCandidateTab;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function getPracticeCandidates(
  params?: GetPracticeCandidatesParams,
  signal?: AbortSignal
): Promise<PagedResponse<PracticeCandidateListItem>> {
  return httpGet<PagedResponse<PracticeCandidateListItem>>(
    "/api/training/practice-candidates",
    params,
    trainingRequestOptions(signal)
  );
}
