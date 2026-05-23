import { httpDelete, httpGet, httpPost, httpPut } from "./http";
import type { ExamCodeOption } from "./types";

interface CreateExamCodeRequest {
  examType: "uygulama";
  code: string;
}

export function getExamCodes(
  examType: "uygulama",
  signal?: AbortSignal
): Promise<ExamCodeOption[]> {
  return httpGet<ExamCodeOption[]>("/api/exam-codes", { examType }, { signal });
}

export function createExamCode(body: CreateExamCodeRequest): Promise<ExamCodeOption> {
  return httpPost<ExamCodeOption>("/api/exam-codes", body);
}

export function deleteExamCode(id: string): Promise<void> {
  return httpDelete(`/api/exam-codes/${id}`);
}

export function updateExamCode(id: string, code: string): Promise<ExamCodeOption> {
  return httpPut<ExamCodeOption>(`/api/exam-codes/${id}`, { code });
}
