import { getMebbisApiBaseUrl } from "./api";
import { httpGet, httpPost } from "./http";
import type { TranslationKey, useT } from "./i18n";
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

export type MebbisExtensionClientResponse = {
  id: string;
  institutionId: string;
  userId: string | null;
  displayName: string;
  status: string;
  lastSeenAtUtc: string | null;
  lastKnownMebbisUrl: string | null;
  lastKnownMebbisUser: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  revokedAtUtc: string | null;
  rowVersion: number;
};

export type MebbisExtensionPairResponse = {
  client: MebbisExtensionClientResponse;
  apiToken: string;
};

const mebbisRequestOptions = (signal?: AbortSignal) => ({
  baseUrl: getMebbisApiBaseUrl(),
  signal,
});

export async function listMebbisJobs(limit = 100, signal?: AbortSignal): Promise<MebbisJobResponse[]> {
  const response = await httpGet<MebbisJobListResponse>("/api/mebbis/jobs", {
    limit,
  }, mebbisRequestOptions(signal));
  return response.items;
}

export async function getMebbisJob(
  jobId: string,
  signal?: AbortSignal
): Promise<MebbisJobResponse> {
  return httpGet<MebbisJobResponse>(
    `/api/mebbis/jobs/${jobId}`,
    undefined,
    mebbisRequestOptions(signal)
  );
}

export async function listMebbisJobSteps(
  jobId: string,
  signal?: AbortSignal
): Promise<MebbisJobStepResponse[]> {
  const response = await httpGet<MebbisJobStepListResponse>(
    `/api/mebbis/jobs/${jobId}/steps`,
    undefined,
    mebbisRequestOptions(signal)
  );
  return response.items;
}

export async function getMebbisJobQueueStatus(
  signal?: AbortSignal
): Promise<MebbisJobQueueStatusResponse> {
  return httpGet<MebbisJobQueueStatusResponse>(
    "/api/mebbis/jobs/queue/status",
    undefined,
    mebbisRequestOptions(signal)
  );
}

export async function retryMebbisJobQueuePublishes(
  limit = 100
): Promise<MebbisJobQueueRetryResponse> {
  return httpPost<MebbisJobQueueRetryResponse>(
    "/api/mebbis/jobs/queue/retry",
    { limit },
    mebbisRequestOptions()
  );
}

export async function pairMebbisExtensionClient(
  displayName: string
): Promise<MebbisExtensionPairResponse> {
  return httpPost<MebbisExtensionPairResponse>(
    "/api/mebbis/extension-clients/pair",
    { displayName },
    mebbisRequestOptions()
  );
}

export async function cancelMebbisJob(jobId: string): Promise<MebbisJobResponse> {
  return httpPost<MebbisJobResponse>(
    `/api/mebbis/jobs/${jobId}/cancel`,
    {},
    mebbisRequestOptions()
  );
}

export async function createCandidateLookupJob(candidateId: string): Promise<MebbisJobResponse> {
  return httpPost<MebbisJobResponse>(
    `/api/mebbis/jobs/candidates/${candidateId}/lookup`,
    {},
    mebbisRequestOptions()
  );
}

export async function createCandidateSyncJob(candidateId: string): Promise<MebbisJobResponse> {
  return httpPost<MebbisJobResponse>(
    `/api/mebbis/jobs/candidates/${candidateId}/sync`,
    {},
    mebbisRequestOptions()
  );
}

export async function createCandidateSyncByNationalIdJob(
  nationalId: string,
  candidateStatusHint?: string
): Promise<MebbisJobResponse> {
  return httpPost<MebbisJobResponse>(
    "/api/mebbis/jobs/candidates/sync-by-national-id",
    candidateStatusHint ? { nationalId, candidateStatusHint } : { nationalId },
    mebbisRequestOptions()
  );
}

export async function createCandidateNationalIdImportJob(): Promise<MebbisJobResponse> {
  return httpPost<MebbisJobResponse>(
    "/api/mebbis/jobs/candidates/national-ids/import",
    {},
    mebbisRequestOptions()
  );
}

export async function createTheoryScheduleSyncJob(groupId: string): Promise<MebbisJobResponse> {
  return httpPost<MebbisJobResponse>(
    `/api/mebbis/jobs/groups/${groupId}/theory-schedule-sync`,
    {},
    mebbisRequestOptions()
  );
}

export async function createTheoryScheduleImportJob(groupId: string): Promise<MebbisJobResponse> {
  return httpPost<MebbisJobResponse>(
    `/api/mebbis/jobs/groups/${groupId}/theory-schedule-import`,
    {},
    mebbisRequestOptions()
  );
}

export async function createGroupInventoryImportJob(): Promise<MebbisJobResponse> {
  return httpPost<MebbisJobResponse>(
    "/api/mebbis/jobs/groups/import",
    {},
    mebbisRequestOptions()
  );
}

export async function createInstitutionInventoryImportJob(): Promise<MebbisJobResponse> {
  return httpPost<MebbisJobResponse>(
    "/api/mebbis/jobs/institution/import",
    {},
    mebbisRequestOptions()
  );
}

export async function createLicenseClassInventoryImportJob(): Promise<MebbisJobResponse> {
  return httpPost<MebbisJobResponse>(
    "/api/mebbis/jobs/license-classes/import",
    {},
    mebbisRequestOptions()
  );
}

export async function createClassroomInventoryImportJob(): Promise<MebbisJobResponse> {
  return httpPost<MebbisJobResponse>(
    "/api/mebbis/jobs/classrooms/import",
    {},
    mebbisRequestOptions()
  );
}

export async function createVehicleInventoryImportJob(): Promise<MebbisJobResponse> {
  return httpPost<MebbisJobResponse>(
    "/api/mebbis/jobs/vehicles/import",
    {},
    mebbisRequestOptions()
  );
}

export async function createInstructorInventoryImportJob(): Promise<MebbisJobResponse> {
  return httpPost<MebbisJobResponse>(
    "/api/mebbis/jobs/instructors/import",
    {},
    mebbisRequestOptions()
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

export function mebbisJobTypeLabel(jobType: string, t: ReturnType<typeof useT>): string {
  const keyMap: Record<string, TranslationKey> = {
    session_check: "mebbisJobType.sessionCheck",
    candidate_lookup: "mebbisJobType.candidateLookup",
    candidate_sync: "mebbisJobType.candidateSync",
    candidate_national_id_import: "mebbisJobType.candidateNationalIdImport",
    candidate_exam_result_sync: "mebbisJobType.candidateExamResultSync",
    instructor_permit_create: "mebbisJobType.instructorPermitCreate",
    theory_schedule_sync: "mebbisJobType.theoryScheduleSync",
    theory_schedule_import: "mebbisJobType.theoryScheduleImport",
    group_inventory_import: "mebbisJobType.groupInventoryImport",
    classroom_inventory_import: "mebbisJobType.classroomInventoryImport",
    vehicle_inventory_import: "mebbisJobType.vehicleInventoryImport",
    instructor_inventory_import: "mebbisJobType.instructorInventoryImport",
  };
  const key = keyMap[jobType];
  return key ? t(key) : jobType;
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
