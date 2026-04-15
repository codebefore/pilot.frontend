/* ── Pagination ── */

export interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export type LicenseClass = "B" | "A2" | "C" | "D" | "E";

/* ── Candidates ── */

export interface CandidateGroupSummary {
  groupId: string;
  title: string;
  startDate: string | null;
  assignedAtUtc: string;
}

export interface CandidatePhotoSummary {
  documentId: string;
  kind: string;
}

export interface CandidateTag {
  id: string;
  name: string;
}

export interface CandidateResponse {
  id: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  phoneNumber: string | null;
  email: string | null;
  birthDate: string | null;
  gender: CandidateGenderValue | null;
  licenseClass: LicenseClass;
  existingLicenseType: string | null;
  existingLicenseIssuedAt: string | null;
  existingLicenseNumber: string | null;
  existingLicenseIssuedProvince: string | null;
  existingLicensePre2016: boolean;
  status: string;
  mebExamResult?: string | null;
  examFeePaid?: boolean;
  currentGroup: CandidateGroupSummary | null;
  documentSummary: CandidateDocumentSummaryResponse | null;
  photo?: CandidatePhotoSummary | null;
  tags?: CandidateTag[];
  createdAtUtc: string;
  updatedAtUtc: string;
}

/**
 * Canonical gender values accepted by the backend. See `status-maps.ts` for
 * the label map + `normalizeCandidateGender` helper that maps legacy strings
 * onto this set.
 */
export type CandidateGenderValue = "female" | "male" | "unspecified";

export interface CandidateUpsertRequest {
  firstName: string;
  lastName: string;
  nationalId: string;
  phoneNumber?: string | null;
  email?: string | null;
  birthDate?: string | null;
  /** Write-boundary is strict: only canonical English (or null / omitted). */
  gender?: CandidateGenderValue | null;
  licenseClass: LicenseClass;
  existingLicenseType?: string | null;
  existingLicenseIssuedAt?: string | null;
  existingLicenseNumber?: string | null;
  existingLicenseIssuedProvince?: string | null;
  existingLicensePre2016?: boolean;
  status: string;
  examFeePaid?: boolean;
  /** Names only — backend resolves or creates tags by name. */
  tags?: string[];
}

export interface CandidateGroupAssignmentResponse {
  assignmentId: string;
  candidateId: string;
  groupId: string;
  groupTitle: string;
  groupStartDate: string | null;
  assignedAtUtc: string;
  removedAtUtc: string | null;
  isActive: boolean;
}

/* ── Terms ── */

export interface TermResponse {
  id: string;
  /** ISO date representing the first of the month this term belongs to. */
  monthDate: string;
  /** 1-based ordinal within the month when multiple terms share a month. */
  sequence: number;
  /** Optional free-form label, e.g. "Ek Donem". */
  name: string | null;
  groupCount: number;
  activeCandidateCount: number;
  createdAtUtc: string;
  updatedAtUtc: string;
}

/** Embedded term reference on a group payload. */
export interface GroupTermRef {
  id: string;
  monthDate: string;
  sequence: number;
  name: string | null;
}

export interface CreateTermRequest {
  monthDate: string;
  name?: string | null;
}

export interface UpdateTermRequest {
  monthDate?: string;
  name?: string | null;
}

/* ── Groups ── */

export interface GroupResponse {
  id: string;
  title: string;
  licenseClass: LicenseClass;
  term: GroupTermRef;
  capacity: number;
  assignedCandidateCount: number;
  activeCandidateCount: number;
  startDate: string | null;
  mebStatus: string | null;
  candidatePreview?: GroupCandidatePreview[];
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface GroupCandidatePreview {
  candidateId: string;
  firstName: string;
  lastName: string;
  photo?: CandidatePhotoSummary | null;
}

export interface GroupCandidateResponse {
  candidateId: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  phoneNumber: string | null;
  email: string | null;
  photo?: CandidatePhotoSummary | null;
  status: string;
  assignedAtUtc: string;
}

export interface GroupDetailResponse extends GroupResponse {
  activeCandidates: GroupCandidateResponse[];
}

export interface GroupUpsertRequest {
  title: string;
  licenseClass: LicenseClass;
  termId: string;
  capacity: number;
  startDate: string;
  mebStatus?: string | null;
}

/* ── Documents ── */

export type DocumentStatus = "missing" | "uploaded";

export interface DocumentTypeResponse {
  id: string;
  module: string;
  key: string;
  name: string;
  sortOrder: number;
  isRequired: boolean;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface DocumentTypeUpsertRequest {
  module: string;
  key: string;
  name: string;
  sortOrder: number;
  isRequired: boolean;
  isActive: boolean;
}

export interface CandidateDocumentSummaryResponse {
  completedCount: number;
  missingCount: number;
  totalRequiredCount: number;
}

export interface DocumentChecklistEntry {
  candidateId: string;
  fullName: string;
  phoneNumber: string | null;
  licenseClass: LicenseClass;
  summary: CandidateDocumentSummaryResponse;
  photo?: CandidatePhotoSummary | null;
  missingDocumentKeys: string[];
  missingDocumentNames: string[];
}

export interface DocumentResponse {
  id: string;
  candidateId: string;
  documentTypeId: string;
  documentTypeKey: string;
  documentTypeName: string;
  originalFileName: string;
  contentType: string;
  fileSizeBytes: number;
  note: string | null;
  uploadedAtUtc: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

/* ── Stats ── */

export interface SidebarStatsResponse {
  candidates: { total: number; active: number };
  groups: { total: number };
  documents: { missingCount: number };
  mebJobs: { failed: number; manualReview: number };
}
