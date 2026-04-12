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
