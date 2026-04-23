/* ── Pagination ── */

export interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  licenseClassCounts?: ExamScheduleLicenseClassCount[];
}

export type LicenseClass = "B" | "A2" | "C" | "D" | "E";

/* ── Candidates ── */

export interface CandidateGroupSummary {
  groupId: string;
  title: string;
  startDate: string | null;
  term: GroupTermRef;
  assignedAtUtc: string;
}

export interface CandidatePhotoSummary {
  documentId: string;
  kind: string;
}

export interface CandidateTag {
  id: string;
  name: string;
  usageCount?: number | null;
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
  mebSyncStatus?: string | null;
  mebExamDate?: string | null;
  drivingExamDate?: string | null;
  mebExamResult?: string | null;
  eSinavAttemptCount?: number | null;
  drivingExamAttemptCount?: number | null;
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
  mebSyncStatus?: string | null;
  mebExamDate?: string | null;
  drivingExamDate?: string | null;
  mebExamResult?: string | null;
  eSinavAttemptCount?: number | null;
  drivingExamAttemptCount?: number | null;
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

export interface ExamScheduleOption {
  id: string;
  examType: "e_sinav" | "direksiyon";
  date: string;
  time: string;
  capacity: number;
  candidateCount: number;
  licenseClassCounts?: ExamScheduleLicenseClassCount[];
}

export interface ExamScheduleLicenseClassCount {
  licenseClass: string;
  count: number;
}

export interface ExamScheduleSyncResponse {
  examType: "e_sinav" | "direksiyon";
  createdCount: number;
  dateCount: number;
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
  /** Active candidate counts broken down by license class. */
  licenseClassCounts: TermLicenseClassCount[];
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface TermLicenseClassCount {
  licenseClass: string;
  count: number;
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

export interface GroupLicenseClassCount {
  licenseClass: string;
  count: number;
}

export interface GroupResponse {
  id: string;
  title: string;
  term: GroupTermRef;
  capacity: number;
  assignedCandidateCount: number;
  activeCandidateCount: number;
  /** Active candidate counts broken down by license class. */
  licenseClassCounts: GroupLicenseClassCount[];
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

export interface GroupCreateRequest {
  groupNumber: number;
  groupBranch: string;
  termId: string;
  capacity: number;
  startDate: string;
  mebStatus?: string | null;
}

export interface GroupUpdateRequest {
  groupNumber?: number;
  groupBranch?: string;
  termId: string;
  capacity: number;
  startDate: string;
  mebStatus?: string | null;
}

/* ── Documents ── */

export type DocumentStatus = "missing" | "uploaded";

/** Backend-supported input types for a document metadata field. */
export type DocumentMetadataInputType = "text" | "date" | "select";

export interface DocumentMetadataFieldOption {
  value: string;
  label: string;
}

export interface DocumentMetadataField {
  key: string;
  label: string;
  inputType: DocumentMetadataInputType;
  isRequired: boolean;
  placeholder: string | null;
  options: DocumentMetadataFieldOption[];
}

export interface DocumentTypeResponse {
  id: string;
  module: string;
  key: string;
  name: string;
  sortOrder: number;
  isRequired: boolean;
  isActive: boolean;
  metadataFields: DocumentMetadataField[];
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
  metadataFields?: DocumentMetadataField[];
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
  metadata: Record<string, string | null>;
  uploadedAtUtc: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

/* ── Users & Roles ── */

export type PermissionLevel = "view" | "full";

export interface AppUserResponse {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  roleId: string | null;
  roleName: string | null;
  isSuperAdmin: boolean;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface AppUserUpsertRequest {
  fullName: string;
  email?: string | null;
  phone: string;
  roleId?: string | null;
  isActive: boolean;
}

export interface RoleResponse {
  id: string;
  name: string;
  isActive: boolean;
  userCount: number;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface RoleUpsertRequest {
  name: string;
  isActive: boolean;
}

export interface RolePermissionResponse {
  area: string;
  level: PermissionLevel;
}

export interface PermissionAreasResponse {
  areas: string[];
  levels: PermissionLevel[];
}

/* ── Stats ── */

export interface SidebarStatsResponse {
  candidates: { total: number; active: number };
  groups: { total: number };
  documents: { missingCount: number };
  mebJobs: { failed: number; manualReview: number };
}
