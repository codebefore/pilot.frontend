import { getTrainingApiBaseUrl } from "./api";
import { httpDelete, httpPost, httpPut } from "./http";
import type { ExamScheduleOption, ExamScheduleSyncResponse } from "./types";

const trainingRequestOptions = (signal?: AbortSignal) => ({
  baseUrl: getTrainingApiBaseUrl(),
  signal,
});

interface CreateExamScheduleRequest {
  examType: "e_sinav" | "uygulama";
  date: string;
  examCodeId?: string | null;
  time?: string;
  capacity: number;
}

export function createExamSchedule(
  body: CreateExamScheduleRequest
): Promise<ExamScheduleOption> {
  return httpPost<ExamScheduleOption>(
    "/api/exam-schedules",
    body,
    trainingRequestOptions()
  );
}

export function syncExamSchedules(
  examType: "e_sinav" | "uygulama"
): Promise<ExamScheduleSyncResponse> {
  return httpPost<ExamScheduleSyncResponse>(
    "/api/exam-schedules/sync",
    { examType },
    trainingRequestOptions()
  );
}

export function deleteExamSchedule(id: string): Promise<void> {
  return httpDelete(`/api/exam-schedules/${id}`, undefined, trainingRequestOptions());
}

export function updateExamSchedule(
  id: string,
  body: CreateExamScheduleRequest
): Promise<ExamScheduleOption> {
  return httpPut<ExamScheduleOption>(
    `/api/exam-schedules/${id}`,
    body,
    trainingRequestOptions()
  );
}
