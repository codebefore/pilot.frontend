import { httpGet, httpPost } from "./http";
import type { JobStatus } from "../types";

type MebbisJobStatus =
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
  queuePublishedAtUtc?: string | null;
  queuePublishLastAttemptAtUtc?: string | null;
  queuePublishAttemptCount?: number;
  queuePublishError?: string | null;
  startedAtUtc: string | null;
  completedAtUtc: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
};

type MebbisJobListResponse = {
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

type MebbisJobStepListResponse = {
  items: MebbisJobStepResponse[];
};

export type MebbisJobQueueStatusResponse = {
  streamsEnabled: boolean;
  streamName: string;
  consumerGroupName: string;
  publishRetryEnabled: boolean;
  pendingJobCount: number;
  activeJobCount: number;
  unpublishedPendingCount: number;
  publishErrorCount: number;
  activeExtensionClientCount: number;
  healthyExtensionClientCount: number;
  extensionHeartbeatFreshSeconds: number;
  lastExtensionSeenAtUtc: string | null;
  lastExtensionDisplayName: string | null;
  lastPublishedAtUtc: string | null;
  lastPublishAttemptAtUtc: string | null;
  redisPendingMessageCount: number | null;
  redisConsumerCount: number | null;
  redisLowestPendingMessageId: string | null;
  redisHighestPendingMessageId: string | null;
  redisError: string | null;
  healthStatus: "healthy" | "warning" | "danger" | string;
  healthMessage: string;
};

export type MebbisJobQueueRetryResponse = {
  retriedCount: number;
  retriedAtUtc: string;
};

export async function listMebbisJobs(limit = 100): Promise<MebbisJobResponse[]> {
  const response = await httpGet<MebbisJobListResponse>("/api/mebbis/jobs", {
    limit,
  });
  return response.items;
}

export async function getMebbisJob(jobId: string): Promise<MebbisJobResponse> {
  return httpGet<MebbisJobResponse>(`/api/mebbis/jobs/${jobId}`);
}

export async function listMebbisJobSteps(jobId: string): Promise<MebbisJobStepResponse[]> {
  const response = await httpGet<MebbisJobStepListResponse>(`/api/mebbis/jobs/${jobId}/steps`);
  return response.items;
}

export async function getMebbisJobQueueStatus(): Promise<MebbisJobQueueStatusResponse> {
  return httpGet<MebbisJobQueueStatusResponse>("/api/mebbis/jobs/queue/status");
}

export async function retryMebbisJobQueuePublishes(
  limit = 100
): Promise<MebbisJobQueueRetryResponse> {
  return httpPost<MebbisJobQueueRetryResponse>("/api/mebbis/jobs/queue/retry", { limit });
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

export async function createCandidateSyncJob(candidateId: string): Promise<MebbisJobResponse> {
  return httpPost<MebbisJobResponse>(
    `/api/mebbis/jobs/candidates/${candidateId}/sync`,
    {}
  );
}

export async function createTheoryScheduleSyncJob(groupId: string): Promise<MebbisJobResponse> {
  return httpPost<MebbisJobResponse>(
    `/api/mebbis/jobs/groups/${groupId}/theory-schedule-sync`,
    {}
  );
}

export async function createTheoryScheduleImportJob(groupId: string): Promise<MebbisJobResponse> {
  return httpPost<MebbisJobResponse>(
    `/api/mebbis/jobs/groups/${groupId}/theory-schedule-import`,
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
    case "theory_schedule_sync":
      return "Teorik Ders Programı Aktarımı";
    case "theory_schedule_import":
      return "Teorik Ders Programı Çekme";
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
