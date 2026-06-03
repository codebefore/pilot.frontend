import { getTrainingApiBaseUrl } from "./api";
import { httpDelete, httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type {
  TrainingLessonKind,
  TrainingLessonBulkDeleteResponse,
  TrainingLessonListResponse,
  TrainingLessonResponse,
  TrainingLessonUpsertRequest,
} from "./types";

const trainingRequestOptions = (signal?: AbortSignal) => ({
  baseUrl: getTrainingApiBaseUrl(),
  signal,
});

interface GetTrainingLessonsOptions {
  kind?: TrainingLessonKind;
  fromUtc?: string;
  toUtc?: string;
  candidateId?: string;
  groupId?: string;
}

export function getTrainingLessons(
  options?: GetTrainingLessonsOptions,
  signal?: AbortSignal
): Promise<TrainingLessonListResponse> {
  const params: QueryParams = {
    kind: options?.kind,
    fromUtc: options?.fromUtc,
    toUtc: options?.toUtc,
    candidateId: options?.candidateId,
    groupId: options?.groupId,
  };

  return httpGet<TrainingLessonListResponse>(
    "/api/training/lessons",
    params,
    trainingRequestOptions(signal)
  );
}

export function createTrainingLesson(
  body: TrainingLessonUpsertRequest
): Promise<TrainingLessonResponse> {
  return httpPost<TrainingLessonResponse>(
    "/api/training/lessons",
    body,
    trainingRequestOptions()
  );
}

export function updateTrainingLesson(
  id: string,
  body: TrainingLessonUpsertRequest
): Promise<TrainingLessonResponse> {
  return httpPut<TrainingLessonResponse>(
    `/api/training/lessons/${id}`,
    body,
    trainingRequestOptions()
  );
}

export function deleteTrainingLesson(id: string): Promise<void> {
  return httpDelete(`/api/training/lessons/${id}`, undefined, trainingRequestOptions());
}

export function deleteTrainingLessonsByGroup(
  groupId: string
): Promise<TrainingLessonBulkDeleteResponse> {
  return httpDelete<TrainingLessonBulkDeleteResponse>("/api/training/lessons/bulk", {
    groupId,
  }, trainingRequestOptions());
}

export function deleteTrainingLessonsByCandidate(
  candidateId: string
): Promise<TrainingLessonBulkDeleteResponse> {
  return httpDelete<TrainingLessonBulkDeleteResponse>("/api/training/lessons/bulk", {
    candidateId,
  }, trainingRequestOptions());
}
