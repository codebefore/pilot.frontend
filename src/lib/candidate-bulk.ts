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

export type CandidatePayloadOverrides = {
  status?: CandidateStatusValue;
  tags?: string[];
  mebExamDate?: string | null;
  mebExamResult?: string | null;
  eSinavAttemptCount?: number | null;
  drivingExamDate?: string | null;
  drivingExamScheduleId?: string | null;
  drivingExamAttemptCount?: number | null;
  graduationDate?: string | null;
};

type BulkCandidateUpdateResult = {
  successCount: number;
  failureCount: number;
  assignedCandidates: {
    candidate: CandidateResponse;
    attempt: CandidateExamAttemptResponse | null;
  }[];
};

/**
 * Round-trip a CandidateResponse back into an upsert payload. Optional
 * overrides let callers swap a subset of fields (e.g. bulk status change)
 * while leaving the rest untouched.
 */
export function buildCandidateUpdatePayload(
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
  const hasMebExamResultOverride =
    overrides !== undefined &&
    Object.prototype.hasOwnProperty.call(overrides, "mebExamResult");
  const hasESinavAttemptCountOverride =
    overrides !== undefined &&
    Object.prototype.hasOwnProperty.call(overrides, "eSinavAttemptCount");
  const hasDrivingExamAttemptCountOverride =
    overrides !== undefined &&
    Object.prototype.hasOwnProperty.call(overrides, "drivingExamAttemptCount");
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
    licenseClassDefinitionId: candidate.licenseClassDefinitionId ?? null,
    hasExistingLicense: candidate.hasExistingLicense ?? Boolean(candidate.existingLicenseType),
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
    mebExamResult: hasMebExamResultOverride ? overrides.mebExamResult : candidate.mebExamResult,
    eSinavAttemptCount: hasESinavAttemptCountOverride
      ? overrides.eSinavAttemptCount ?? 1
      : candidate.eSinavAttemptCount ?? 1,
    drivingExamAttemptCount: hasDrivingExamAttemptCountOverride
      ? overrides.drivingExamAttemptCount ?? 0
      : candidate.drivingExamAttemptCount ?? 1,
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

      let attempt: CandidateExamAttemptResponse | null = null;
      if (examScheduleId) {
        attempt = await upsertCandidateExamAttemptForSchedule(id, examType, examDate, examScheduleId, examTime);
      }
      const summaryOverrides = attempt
        ? examType === "e_sinav"
          ? { ...overrides, eSinavAttemptCount: attempt.attemptNumber }
          : { ...overrides, drivingExamAttemptCount: attempt.attemptNumber }
        : overrides;
      const updatedCandidate = await updateCandidate(id, buildCandidateUpdatePayload(candidate, summaryOverrides));
      return { candidate: updatedCandidate, attempt };
    })
  );

  const successCount = results.filter((result) => result.status === "fulfilled").length;
  return {
    successCount,
    failureCount: results.length - successCount,
    assignedCandidates: results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : []
    ),
  };
}

async function upsertCandidateExamAttemptForSchedule(
  candidateId: string,
  examType: CandidateExamDateType,
  examDate: string,
  examScheduleId: string,
  examTime?: string | null
): Promise<CandidateExamAttemptResponse> {
  const attemptExamType: CandidateExamType = examType === "e_sinav" ? "theory" : "practice";
  const attempts = await listCandidateExamAttempts(candidateId);
  const existing = findScheduleAttempt(attempts, attemptExamType, examScheduleId, examDate);
  const attemptNumber = existing?.attemptNumber ?? nextCandidateExamAttemptNumber(attempts, attemptExamType);
  const scheduledAt = examDateTimeUtc(examDate, examTime);
  const payload = {
    examType: attemptExamType,
    scheduledAt,
    examScheduleId,
    attemptNumber,
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
    return updateCandidateExamAttempt(candidateId, existing.id, payload);
  }

  return createCandidateExamAttempt(candidateId, payload);
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
      applicationDateOnly(attempt.scheduledAt) === examDate
    );
}

function nextCandidateExamAttemptNumber(
  attempts: CandidateExamAttemptResponse[],
  examType: CandidateExamType
): number {
  const maxAttemptNumber = candidateExamAttemptLimit(attempts, examType);
  const used = attempts
    .filter((attempt) => attempt.examType === examType)
    .map((attempt) => attempt.attemptNumber);
  for (let number = 1; number <= maxAttemptNumber; number += 1) {
    if (!used.includes(number)) return number;
  }
  throw new Error(`No remaining ${examType} exam attempts.`);
}

function candidateExamAttemptLimit(
  attempts: CandidateExamAttemptResponse[],
  examType: CandidateExamType
): number {
  if (examType !== "practice") return 4;
  return attempts.some((attempt) => attempt.examType === "practice" && attempt.examAttendanceStatus === "reported")
    ? 5
    : 4;
}

function examDateTimeUtc(examDate: string, examTime?: string | null): string {
  const time = examTime && /^\d{1,2}:\d{2}$/.test(examTime) ? examTime : "09:00";
  return new Date(`${examDate}T${time.padStart(5, "0")}:00+03:00`).toISOString();
}

function applicationDateOnly(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Istanbul",
    year: "numeric",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
