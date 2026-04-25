import { httpDelete, httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type {
  TrainingLessonKind,
  TrainingLessonListResponse,
  TrainingLessonResponse,
  TrainingLessonUpsertRequest,
} from "./types";

export interface GetTrainingLessonsOptions {
  kind?: TrainingLessonKind;
  fromUtc?: string;
  toUtc?: string;
}

export function getTrainingLessons(
  options?: GetTrainingLessonsOptions,
  signal?: AbortSignal
): Promise<TrainingLessonListResponse> {
  const params: QueryParams = {
    kind: options?.kind,
    fromUtc: options?.fromUtc,
    toUtc: options?.toUtc,
  };

  return httpGet<TrainingLessonListResponse>("/api/training-lessons", params, { signal });
}

export function createTrainingLesson(
  body: TrainingLessonUpsertRequest
): Promise<TrainingLessonResponse> {
  return httpPost<TrainingLessonResponse>("/api/training-lessons", body);
}

export function updateTrainingLesson(
  id: string,
  body: TrainingLessonUpsertRequest
): Promise<TrainingLessonResponse> {
  return httpPut<TrainingLessonResponse>(`/api/training-lessons/${id}`, body);
}

export function deleteTrainingLesson(id: string): Promise<void> {
  return httpDelete(`/api/training-lessons/${id}`);
}
