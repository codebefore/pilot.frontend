import { httpGet, httpPost } from "./http";
import type { JobStatus } from "../types";

export type MebbisJobStatus =
  | "pending"
  | "leased"
  | "running"
  | "retry"
  | "succeeded"
  | "failed"
  | "needs_manual_action"
  | "cancelled";

export type MebbisJobResponse = {
  id: string;
  jobType: string;
  entityType: string | null;
  entityId: string | null;
  status: MebbisJobStatus | string;
  priority: number;
  payloadJson: string | null;
  resultJson: string | null;
  errorMessage: string | null;
  attemptCount: number;
  maxAttemptCount: number;
  nextAttemptAtUtc: string | null;
  leaseOwnerClientId: string | null;
  leaseExpiresAtUtc: string | null;
  startedAtUtc: string | null;
  completedAtUtc: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
};

export type MebbisJobListResponse = {
  items: MebbisJobResponse[];
};

export type MebbisJobStepResponse = {
  id: string;
  jobId: string;
  extensionClientId: string | null;
  stepName: string;
  status: string;
  message: string | null;
  dataJson: string | null;
  screenshotReference: string | null;
  createdAtUtc: string;
};

export type MebbisJobStepListResponse = {
  items: MebbisJobStepResponse[];
};

export async function listMebbisJobs(limit = 100): Promise<MebbisJobResponse[]> {
  const response = await httpGet<MebbisJobListResponse>("/api/mebbis/jobs", {
    limit,
  });
  return response.items;
}

export async function listMebbisJobSteps(jobId: string): Promise<MebbisJobStepResponse[]> {
  const response = await httpGet<MebbisJobStepListResponse>(`/api/mebbis/jobs/${jobId}/steps`);
  return response.items;
}

export async function cancelMebbisJob(jobId: string): Promise<MebbisJobResponse> {
  return httpPost<MebbisJobResponse>(`/api/mebbis/jobs/${jobId}/cancel`, {});
}

export async function createCandidateLookupJob(candidateId: string): Promise<MebbisJobResponse> {
  return httpPost<MebbisJobResponse>(
    `/api/mebbis/jobs/candidates/${candidateId}/lookup`,
    {}
  );
}

export function mapMebbisStatusToJobStatus(status: string): JobStatus {
  switch (status) {
    case "succeeded":
      return "success";
    case "leased":
    case "running":
      return "running";
    case "pending":
      return "queued";
    case "retry":
      return "failed";
    case "needs_manual_action":
      return "manual";
    case "failed":
    case "cancelled":
    default:
      return "failed";
  }
}

export function mebbisJobTypeLabel(jobType: string): string {
  switch (jobType) {
    case "session_check":
      return "Oturum Kontrolü";
    case "candidate_lookup":
      return "Aday Durum Görüntüleme";
    case "candidate_sync":
      return "Aday Senkronizasyonu";
    case "candidate_exam_result_sync":
      return "Aday Sınav Sonucu";
    case "instructor_permit_create":
      return "Eğitmen İzin Oluşturma";
    default:
      return jobType;
  }
}

export function parseJobPayload(job: MebbisJobResponse): Record<string, unknown> {
  if (!job.payloadJson) {
    return {};
  }

  try {
    return JSON.parse(job.payloadJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}
