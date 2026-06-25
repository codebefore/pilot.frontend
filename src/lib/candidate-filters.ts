import type { CandidateGenderValue, LicenseClass } from "./types";
import { normalizeTextQuery } from "./search";

/** Tri-state select value: empty (all), "true" (yes), "false" (no). */
export type TriState = "" | "true" | "false";
export type CandidateExamStatusFilterValue =
  | "havuz"
  | "randevulu"
  | "e_sinav_randevulu"
  | "direksiyon_randevulu"
  | "basarisiz"
  | "basarili"
  | "parked"
  | "graduated"
  | "dropped";
export type CandidateExamAttemptCountFilterValue = "1" | "2" | "3" | "4" | "5";

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
  licenseClasses: LicenseClass[];
  /** Canonical gender value or empty string (= "Tümü"). Never free text. */
  gender: CandidateGenderValue | "";
  groupIds: string[];
  termIds: string[];
  hasPhoto: TriState;
  hasExamResult: TriState;
  hasMissingDocuments: TriState;
  /** "" (Tümü) | "passed" | "failed" — backend tolerates synonyms. */
  mebExamResult: "" | "passed" | "failed";
  /** Unified visible exam status in the candidates table. */
  examStatus: CandidateExamStatusFilterValue[];
  examAttemptCount: CandidateExamAttemptCountFilterValue[];
  drivingExamAttendanceStatus: "" | "attended" | "absent" | "reported";
  /** Empty array = no filter; otherwise existing-license catalog codes. */
  existingLicenseTypes: string[];
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
  totalFeeMin: string;
  totalFeeMax: string;
  totalPaidMin: string;
  totalPaidMax: string;
  totalDebtMin: string;
  totalDebtMax: string;
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
  licenseClasses: [],
  gender: "",
  groupIds: [],
  termIds: [],
  hasPhoto: "",
  hasExamResult: "",
  hasMissingDocuments: "",
  mebExamResult: "",
  examStatus: [],
  examAttemptCount: [],
  drivingExamAttendanceStatus: "",
  existingLicenseTypes: [],
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
  totalFeeMin: "",
  totalFeeMax: "",
  totalPaidMin: "",
  totalPaidMax: "",
  totalDebtMin: "",
  totalDebtMax: "",
  missingDocumentCountMin: "",
  missingDocumentCountMax: "",
};

const TERM_GROUP_FILTER_TERM_PREFIX = "term:";
const TERM_GROUP_FILTER_GROUP_PREFIX = "group:";

export function combineTermGroupFilterValues(
  filters: Pick<CandidateFilterState, "termIds" | "groupIds">,
): string[] {
  return [
    ...filters.termIds.map((id) => `${TERM_GROUP_FILTER_TERM_PREFIX}${id}`),
    ...filters.groupIds.map((id) => `${TERM_GROUP_FILTER_GROUP_PREFIX}${id}`),
  ];
}

export function splitTermGroupFilterValues(values: string[]): {
  termIds: string[];
  groupIds: string[];
} {
  return values.reduce(
    (result, value) => {
      if (value.startsWith(TERM_GROUP_FILTER_TERM_PREFIX)) {
        result.termIds.push(value.slice(TERM_GROUP_FILTER_TERM_PREFIX.length));
      } else if (value.startsWith(TERM_GROUP_FILTER_GROUP_PREFIX)) {
        result.groupIds.push(value.slice(TERM_GROUP_FILTER_GROUP_PREFIX.length));
      }
      return result;
    },
    { termIds: [] as string[], groupIds: [] as string[] },
  );
}

export function termGroupTermFilterValue(termId: string): string {
  return `${TERM_GROUP_FILTER_TERM_PREFIX}${termId}`;
}

export function termGroupGroupFilterValue(groupId: string): string {
  return `${TERM_GROUP_FILTER_GROUP_PREFIX}${groupId}`;
}

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
    licenseClasses:
      filters.licenseClasses.length > 0 ? filters.licenseClasses : undefined,
    gender: filters.gender || undefined,
    groupIds: filters.groupIds.length > 0 ? filters.groupIds : undefined,
    termIds: filters.termIds.length > 0 ? filters.termIds : undefined,
    hasPhoto: triToBool(filters.hasPhoto),
    hasExamResult: triToBool(filters.hasExamResult),
    hasMissingDocuments: triToBool(filters.hasMissingDocuments),
    mebExamResult: filters.mebExamResult || undefined,
    examStatus: filters.examStatus.length > 0 ? filters.examStatus : undefined,
    examAttemptCount:
      filters.examAttemptCount.length > 0
        ? filters.examAttemptCount
            .map((value) => numericOrUndefined(value))
            .filter((value): value is number => value !== undefined)
        : undefined,
    drivingExamAttendanceStatus: filters.drivingExamAttendanceStatus || undefined,
    existingLicenseTypes:
      filters.existingLicenseTypes.length > 0 ? filters.existingLicenseTypes : undefined,
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
    totalFeeMin: numericOrUndefined(filters.totalFeeMin),
    totalFeeMax: numericOrUndefined(filters.totalFeeMax),
    totalPaidMin: numericOrUndefined(filters.totalPaidMin),
    totalPaidMax: numericOrUndefined(filters.totalPaidMax),
    totalDebtMin: numericOrUndefined(filters.totalDebtMin),
    totalDebtMax: numericOrUndefined(filters.totalDebtMax),
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
