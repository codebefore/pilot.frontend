import type { CandidateGenderValue, LicenseClass } from "./types";
import { normalizeTextQuery } from "./search";

/** Tri-state select value: empty (all), "true" (yes), "false" (no). */
export type TriState = "" | "true" | "false";

/**
 * Extended filter state for the Filtreler sidebar. All fields are stored as
 * strings/empty strings for straightforward input binding; the
 * `filtersToQuery` helper below converts them into typed query params.
 */
export type CandidateFilterState = {
  firstName: string;
  lastName: string;
  nationalId: string;
  motherName: string;
  fatherName: string;
  phoneNumber: string;
  email: string;
  licenseClass: LicenseClass | "";
  /** Canonical gender value or empty string (= "Tümü"). Never free text. */
  gender: CandidateGenderValue | "";
  groupId: string;
  hasActiveGroup: TriState;
  hasPhoto: TriState;
  hasExamResult: TriState;
  examFeePaid: TriState;
  initialPaymentReceived: TriState;
  hasMissingDocuments: TriState;
  /** "" (Tümü) | "passed" | "failed" — backend tolerates synonyms. */
  mebExamResult: "" | "passed" | "failed";
  /** Empty string = no filter; otherwise an existing-license catalog code. */
  existingLicenseType: string;
  birthDateFrom: string;
  birthDateTo: string;
  mebExamDateFrom: string;
  mebExamDateTo: string;
  drivingExamDateFrom: string;
  drivingExamDateTo: string;
  createdAtFrom: string;
  createdAtTo: string;
  updatedAtFrom: string;
  updatedAtTo: string;
  missingDocumentCountMin: string;
  missingDocumentCountMax: string;
};

export const EMPTY_CANDIDATE_FILTERS: CandidateFilterState = {
  firstName: "",
  lastName: "",
  nationalId: "",
  motherName: "",
  fatherName: "",
  phoneNumber: "",
  email: "",
  licenseClass: "",
  gender: "",
  groupId: "",
  hasActiveGroup: "",
  hasPhoto: "",
  hasExamResult: "",
  examFeePaid: "",
  initialPaymentReceived: "",
  hasMissingDocuments: "",
  mebExamResult: "",
  existingLicenseType: "",
  birthDateFrom: "",
  birthDateTo: "",
  mebExamDateFrom: "",
  mebExamDateTo: "",
  drivingExamDateFrom: "",
  drivingExamDateTo: "",
  createdAtFrom: "",
  createdAtTo: "",
  updatedAtFrom: "",
  updatedAtTo: "",
  missingDocumentCountMin: "",
  missingDocumentCountMax: "",
};

function triToBool(value: TriState): boolean | undefined {
  if (value === "") return undefined;
  return value === "true";
}

/**
 * Convert the UI-facing filter state into the backend query-param shape.
 * Empty strings become `undefined` so they are not serialized onto the URL.
 */
export function filtersToQuery(filters: CandidateFilterState) {
  const numericOrUndefined = (value: string): number | undefined => {
    if (value === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  return {
    firstName: normalizeTextQuery(filters.firstName),
    lastName: normalizeTextQuery(filters.lastName),
    nationalId: normalizeTextQuery(filters.nationalId),
    motherName: normalizeTextQuery(filters.motherName),
    fatherName: normalizeTextQuery(filters.fatherName),
    phoneNumber: normalizeTextQuery(filters.phoneNumber),
    email: normalizeTextQuery(filters.email),
    licenseClass: filters.licenseClass || undefined,
    gender: filters.gender || undefined,
    groupId: filters.groupId || undefined,
    hasActiveGroup: triToBool(filters.hasActiveGroup),
    hasPhoto: triToBool(filters.hasPhoto),
    hasExamResult: triToBool(filters.hasExamResult),
    examFeePaid: triToBool(filters.examFeePaid),
    initialPaymentReceived: triToBool(filters.initialPaymentReceived),
    hasMissingDocuments: triToBool(filters.hasMissingDocuments),
    mebExamResult: filters.mebExamResult || undefined,
    existingLicenseType: filters.existingLicenseType || undefined,
    birthDateFrom: filters.birthDateFrom || undefined,
    birthDateTo: filters.birthDateTo || undefined,
    mebExamDateFrom: filters.mebExamDateFrom || undefined,
    mebExamDateTo: filters.mebExamDateTo || undefined,
    drivingExamDateFrom: filters.drivingExamDateFrom || undefined,
    drivingExamDateTo: filters.drivingExamDateTo || undefined,
    createdAtFrom: filters.createdAtFrom || undefined,
    createdAtTo: filters.createdAtTo || undefined,
    updatedAtFrom: filters.updatedAtFrom || undefined,
    updatedAtTo: filters.updatedAtTo || undefined,
    missingDocumentCountMin: numericOrUndefined(filters.missingDocumentCountMin),
    missingDocumentCountMax: numericOrUndefined(filters.missingDocumentCountMax),
  };
}

export function countActiveCandidateFilters(filters: CandidateFilterState): number {
  const query = filtersToQuery(filters);

  return Object.values(query).reduce<number>((sum, value) => {
    if (value === undefined) return sum;
    return sum + 1;
  }, 0);
}
