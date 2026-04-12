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
  status: string;
  startDate: string | null;
  assignedAtUtc: string;
}

export interface CandidateResponse {
  id: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  phoneNumber: string | null;
  email: string | null;
  birthDate: string | null;
  gender: string | null;
  licenseClass: LicenseClass;
  status: string;
  currentGroup: CandidateGroupSummary | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface CandidateUpsertRequest {
  firstName: string;
  lastName: string;
  nationalId: string;
  phoneNumber?: string | null;
  email?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  licenseClass: LicenseClass;
  status: string;
}

export interface CandidateGroupAssignmentResponse {
  assignmentId: string;
  candidateId: string;
  groupId: string;
  groupTitle: string;
  groupStatus: string;
  groupStartDate: string | null;
  assignedAtUtc: string;
  removedAtUtc: string | null;
  isActive: boolean;
}

/* ── Groups ── */

export interface GroupResponse {
  id: string;
  title: string;
  status: string;
  licenseClass: LicenseClass;
  termName: string | null;
  capacity: number;
  assignedCandidateCount: number;
  activeCandidateCount: number;
  startDate: string | null;
  endDate: string | null;
  mebStatus: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface GroupCandidateResponse {
  candidateId: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  phoneNumber: string | null;
  email: string | null;
  status: string;
  assignedAtUtc: string;
}

export interface GroupDetailResponse extends GroupResponse {
  activeCandidates: GroupCandidateResponse[];
}

export interface GroupUpsertRequest {
  title: string;
  status: string;
  licenseClass: LicenseClass;
  termName?: string | null;
  capacity: number;
  assignedCandidateCount: number;
  startDate?: string | null;
  endDate?: string | null;
  mebStatus?: string | null;
}

/* ── Documents ── */

/** Canonical status of a document / checklist entry (backend values). */
export type DocumentStatus = "missing" | "pending" | "approved" | "rejected" | "expiring_soon";

/** How urgent the missing/expiring document is. */
export type DocumentUrgency = "normal" | "soon" | "urgent";

/** Catalog entry describing a document type required for candidates. */
export interface DocumentTypeResponse {
  id: string;
  /** Canonical English code, e.g. "national_id". */
  code: string;
  /** Localized display name as served by the backend. */
  name: string;
  /** Whether the document is mandatory for every candidate. */
  required: boolean;
  /** Optional scope limiting the type to specific license classes. */
  licenseClassScope: LicenseClass[] | null;
}

/**
 * A single entry in the candidate document checklist. Represents one
 * (candidate, documentType) pair and reflects whether it has been uploaded.
 */
export interface DocumentChecklistEntry {
  candidateId: string;
  candidateFullName: string;
  nationalId: string;
  licenseClass: LicenseClass;
  documentTypeId: string;
  documentTypeCode: string;
  documentTypeName: string;
  required: boolean;
  status: DocumentStatus;
  urgency: DocumentUrgency;
  dueDate: string | null;
  documentId: string | null;
  uploadedAtUtc: string | null;
}

/** Uploaded document record returned by the upload endpoint. */
export interface DocumentResponse {
  id: string;
  candidateId: string;
  documentTypeId: string;
  documentTypeCode: string;
  documentTypeName: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  note: string | null;
  uploadedAtUtc: string;
}
