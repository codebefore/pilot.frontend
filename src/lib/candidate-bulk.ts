import { getCandidateById, updateCandidate } from "./candidates-api";
import { normalizeCandidateGender, type CandidateStatusValue } from "./status-maps";
import type { CandidateResponse, CandidateUpsertRequest } from "./types";

type CandidatePayloadOverrides = {
  status?: CandidateStatusValue;
  tags?: string[];
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
  return {
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    nationalId: candidate.nationalId,
    phoneNumber: candidate.phoneNumber,
    email: candidate.email,
    birthDate: candidate.birthDate,
    gender: normalizeCandidateGender(candidate.gender),
    licenseClass: candidate.licenseClass,
    existingLicenseType: candidate.existingLicenseType,
    existingLicenseIssuedAt: candidate.existingLicenseIssuedAt,
    existingLicenseNumber: candidate.existingLicenseNumber,
    existingLicenseIssuedProvince: candidate.existingLicenseIssuedProvince,
    existingLicensePre2016: candidate.existingLicensePre2016,
    examFeePaid: candidate.examFeePaid ?? false,
    status: overrides?.status ?? (candidate.status as CandidateStatusValue),
    tags: overrides?.tags ?? (candidate.tags?.map((tag) => tag.name) ?? []),
  };
}

/**
 * Merge new tag names into the candidate's existing list. Deduplicates using
 * a Turkish-lowercased key so "Acil" and "acil" collapse to one entry while
 * preserving the first-seen casing.
 */
export function mergeCandidateTags(candidate: CandidateResponse, additions: string[]): string[] {
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
