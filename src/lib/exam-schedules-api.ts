import { httpPost } from "./http";
import type { ExamScheduleOption, ExamScheduleSyncResponse } from "./types";

export interface CreateExamScheduleRequest {
  examType: "e_sinav" | "uygulama";
  date: string;
  time?: string;
  capacity: number;
}

export function createExamSchedule(
  body: CreateExamScheduleRequest
): Promise<ExamScheduleOption> {
  return httpPost<ExamScheduleOption>("/api/exam-schedules", body);
}

export function syncExamSchedules(
  examType: "e_sinav" | "uygulama"
): Promise<ExamScheduleSyncResponse> {
  return httpPost<ExamScheduleSyncResponse>("/api/exam-schedules/sync", { examType });
}
