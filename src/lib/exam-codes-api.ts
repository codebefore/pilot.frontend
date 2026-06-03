import { getTrainingApiBaseUrl } from "./api";
import { httpDelete, httpGet, httpPost, httpPut } from "./http";
import type { ExamCodeOption } from "./types";

const trainingRequestOptions = (signal?: AbortSignal) => ({
  baseUrl: getTrainingApiBaseUrl(),
  signal,
});

interface CreateExamCodeRequest {
  examType: "uygulama";
  code: string;
}

export function getExamCodes(
  examType: "uygulama",
  signal?: AbortSignal
): Promise<ExamCodeOption[]> {
  return httpGet<ExamCodeOption[]>(
    "/api/training/exam-codes",
    { examType },
    trainingRequestOptions(signal)
  );
}

export function createExamCode(body: CreateExamCodeRequest): Promise<ExamCodeOption> {
  return httpPost<ExamCodeOption>("/api/training/exam-codes", body, trainingRequestOptions());
}

export function deleteExamCode(id: string): Promise<void> {
  return httpDelete(`/api/training/exam-codes/${id}`, undefined, trainingRequestOptions());
}

export function updateExamCode(id: string, code: string): Promise<ExamCodeOption> {
  return httpPut<ExamCodeOption>(
    `/api/training/exam-codes/${id}`,
    { code },
    trainingRequestOptions()
  );
}
