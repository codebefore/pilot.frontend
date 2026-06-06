import { getCandidateById, updateCandidate } from "./candidates-api";
import {
  createCandidateExamAttempt,
  listCandidateExamAttempts,
  updateCandidateExamAttempt,
} from "./candidate-exam-attempts-api";
import type { CandidateExamDateType } from "./exam-schedules-api";
import { normalizeCandidateGender, type CandidateStatusValue } from "./status-maps";
import type {
  CandidateExamAttemptResponse,
  CandidateExamType,
  CandidateResponse,
  CandidateUpsertRequest,
} from "./types";

type CandidatePayloadOverrides = {
  status?: CandidateStatusValue;
  tags?: string[];
  mebExamDate?: string | null;
  drivingExamDate?: string | null;
  drivingExamScheduleId?: string | null;
  graduationDate?: string | null;
};

type BulkCandidateUpdateResult = {
  successCount: number;
  failureCount: number;
};

/**
 * Round-trip a CandidateResponse back into an upsert payload. Optional
 * overrides let callers swap a subset of fields (e.g. bulk status change)
 * while leaving the rest untouched.
 */
function buildCandidateUpdatePayload(
  candidate: CandidateResponse,
  overrides?: CandidatePayloadOverrides
): CandidateUpsertRequest {
  const hasMebExamDateOverride =
    overrides !== undefined &&
    Object.prototype.hasOwnProperty.call(overrides, "mebExamDate");
  const hasDrivingExamDateOverride =
    overrides !== undefined &&
    Object.prototype.hasOwnProperty.call(overrides, "drivingExamDate");
  const hasDrivingExamScheduleOverride =
    overrides !== undefined &&
    Object.prototype.hasOwnProperty.call(overrides, "drivingExamScheduleId");
  const hasGraduationDateOverride =
    overrides !== undefined &&
    Object.prototype.hasOwnProperty.call(overrides, "graduationDate");

  return {
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    nationalId: candidate.nationalId,
    referenceName: candidate.referenceName,
    phoneNumber: candidate.phoneNumber,
    birthDate: candidate.birthDate,
    gender: normalizeCandidateGender(candidate.gender),
    licenseClass: candidate.licenseClass,
    existingLicenseType: candidate.existingLicenseType,
    existingLicenseIssuedAt: candidate.existingLicenseIssuedAt,
    existingLicenseNumber: candidate.existingLicenseNumber,
    existingLicenseIssuedProvince: candidate.existingLicenseIssuedProvince,
    existingLicensePre2016: candidate.existingLicensePre2016,
    mebSyncStatus: candidate.mebSyncStatus,
    mebExamDate: hasMebExamDateOverride ? overrides.mebExamDate : candidate.mebExamDate,
    drivingExamDate: hasDrivingExamDateOverride
      ? overrides.drivingExamDate
      : candidate.drivingExamDate,
    drivingExamScheduleId: hasDrivingExamScheduleOverride
      ? overrides.drivingExamScheduleId
      : undefined,
    graduationDate: hasGraduationDateOverride
      ? overrides.graduationDate
      : candidate.graduationDate,
    mebExamResult: candidate.mebExamResult,
    eSinavAttemptCount: candidate.eSinavAttemptCount ?? 1,
    drivingExamAttemptCount: candidate.drivingExamAttemptCount ?? 1,
    status: overrides?.status ?? (candidate.status as CandidateStatusValue),
    terminationReason: candidate.terminationReason,
    terminationDate: candidate.terminationDate,
    tags: overrides?.tags ?? (candidate.tags?.map((tag) => tag.name) ?? []),
    rowVersion: candidate.rowVersion,
  };
}

/**
 * Merge new tag names into the candidate's existing list. Deduplicates using
 * a Turkish-lowercased key so "Acil" and "acil" collapse to one entry while
 * preserving the first-seen casing.
 */
function mergeCandidateTags(candidate: CandidateResponse, additions: string[]): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  const pushUnique = (name: string) => {
    const normalized = name
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase("tr-TR");
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    merged.push(name.trim().replace(/\s+/g, " "));
  };

  for (const existing of candidate.tags?.map((tag) => tag.name) ?? []) {
    pushUnique(existing);
  }

  for (const addition of additions) {
    pushUnique(addition);
  }

  return merged;
}

async function resolveCandidate(
  candidateId: string,
  cache: Map<string, CandidateResponse> | undefined
): Promise<CandidateResponse> {
  return cache?.get(candidateId) ?? (await getCandidateById(candidateId));
}

/**
 * Update the status of many candidates in parallel. Callers may pass a cache
 * of already-fetched CandidateResponse objects to skip per-row GETs.
 */
export async function applyStatusToCandidates(
  candidateIds: string[],
  status: CandidateStatusValue,
  cache?: Map<string, CandidateResponse>
): Promise<void> {
  await Promise.all(
    candidateIds.map(async (id) => {
      const candidate = await resolveCandidate(id, cache);
      await updateCandidate(id, buildCandidateUpdatePayload(candidate, { status }));
    })
  );
}

/**
 * Merge the supplied tag names into each candidate's tag list and save.
 */
export async function applyTagsToCandidates(
  candidateIds: string[],
  tags: string[],
  cache?: Map<string, CandidateResponse>
): Promise<void> {
  await Promise.all(
    candidateIds.map(async (id) => {
      const candidate = await resolveCandidate(id, cache);
      await updateCandidate(
        id,
        buildCandidateUpdatePayload(candidate, {
          tags: mergeCandidateTags(candidate, tags),
        })
      );
    })
  );
}

/**
 * Assign the selected candidates to the requested exam date. Reuses the
 * existing candidate update boundary so backend business rules stay in force.
 */
export async function assignCandidatesToExamDate(
  candidateIds: string[],
  examType: CandidateExamDateType,
  examDate: string,
  examScheduleId?: string | null,
  examTime?: string | null,
  cache?: Map<string, CandidateResponse>
): Promise<BulkCandidateUpdateResult> {
  const results = await Promise.allSettled(
    candidateIds.map(async (id) => {
      const candidate = await resolveCandidate(id, cache);
      const overrides =
        examType === "e_sinav"
          ? { mebExamDate: examDate }
          : { drivingExamDate: examDate, drivingExamScheduleId: examScheduleId ?? null };

      await updateCandidate(id, buildCandidateUpdatePayload(candidate, overrides));
      if (examScheduleId) {
        await upsertCandidateExamAttemptForSchedule(id, examType, examDate, examScheduleId, examTime);
      }
    })
  );

  const successCount = results.filter((result) => result.status === "fulfilled").length;
  return {
    successCount,
    failureCount: results.length - successCount,
  };
}

async function upsertCandidateExamAttemptForSchedule(
  candidateId: string,
  examType: CandidateExamDateType,
  examDate: string,
  examScheduleId: string,
  examTime?: string | null
) {
  const attemptExamType: CandidateExamType = examType === "e_sinav" ? "theory" : "practice";
  const attempts = await listCandidateExamAttempts(candidateId);
  const existing = findScheduleAttempt(attempts, attemptExamType, examScheduleId, examDate);
  const scheduledAt = examDateTimeUtc(examDate, examTime);
  const payload = {
    examType: attemptExamType,
    scheduledAt,
    examScheduleId,
    attemptNumber: existing?.attemptNumber,
    score: attemptExamType === "theory" ? existing?.score ?? null : null,
    expiresAt: null,
    vehicleId: attemptExamType === "practice" ? existing?.vehicleId ?? null : null,
    vehiclePlate: attemptExamType === "practice" ? existing?.vehiclePlate ?? null : null,
    instructorId: attemptExamType === "practice" ? existing?.instructorId ?? null : null,
    instructorFullName: attemptExamType === "practice" ? existing?.instructorFullName ?? null : null,
    examAttendanceStatus: attemptExamType === "practice" ? existing?.examAttendanceStatus ?? null : null,
    examResultStatus: attemptExamType === "practice" ? existing?.examResultStatus ?? null : null,
    fee: existing?.fee ?? 0,
    feeStatus: existing?.feeStatus ?? "pending",
    rowVersion: existing?.rowVersion,
  };

  if (existing) {
    await updateCandidateExamAttempt(candidateId, existing.id, payload);
  } else {
    await createCandidateExamAttempt(candidateId, payload);
  }
}

function findScheduleAttempt(
  attempts: CandidateExamAttemptResponse[],
  examType: CandidateExamType,
  examScheduleId: string,
  examDate: string
): CandidateExamAttemptResponse | undefined {
  return attempts.find((attempt) => attempt.examType === examType && attempt.examScheduleId === examScheduleId)
    ?? attempts.find((attempt) =>
      attempt.examType === examType &&
      !attempt.examScheduleId &&
      attempt.scheduledAt.slice(0, 10) === examDate
    );
}

function examDateTimeUtc(examDate: string, examTime?: string | null): string {
  const time = examTime && /^\d{1,2}:\d{2}$/.test(examTime) ? examTime : "09:00";
  return `${examDate}T${time.padStart(5, "0")}:00.000Z`;
}
