/* ── Pagination ── */

export interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  licenseClassCounts?: ExamScheduleLicenseClassCount[];
}

export type LicenseClass = string;

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
  rowVersion: number;
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
  /** Required for updates; omitted on create. */
  rowVersion?: number;
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
  examType: "e_sinav" | "uygulama";
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
  examType: "e_sinav" | "uygulama";
  createdCount: number;
  dateCount: number;
}

/* ── Vehicles ── */

export type VehicleStatus = "idle" | "in_use" | "maintenance";
export type VehicleTransmissionType = "manual" | "automatic";
export type VehicleType =
  | "automobile"
  | "motorcycle"
  | "minibus"
  | "bus"
  | "pickup"
  | "truck"
  | "trailer"
  | "work_machine"
  | "tir";
export type VehicleOwnershipType = "owned" | "leased";
export type VehicleFuelType = "gasoline" | "diesel" | "lpg" | "electric" | "hybrid";
export type VehicleOdometerUnit = "km" | "hour";

export interface VehicleResponse {
  id: string;
  plateNumber: string;
  brand: string;
  model: string | null;
  modelYear: number | null;
  color: string | null;
  status: VehicleStatus;
  isActive: boolean;
  transmissionType: VehicleTransmissionType;
  vehicleType: VehicleType;
  licenseClass: LicenseClass;
  ownershipType: VehicleOwnershipType;
  fuelType: VehicleFuelType | null;
  odometerValue: number | null;
  odometerUnit: VehicleOdometerUnit;
  notes: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

export interface VehicleListSummaryResponse {
  activeCount: number;
  inUseCount: number;
  maintenanceCount: number;
  idleCount: number;
}

export interface VehicleListResponse extends PagedResponse<VehicleResponse> {
  summary: VehicleListSummaryResponse;
}

export interface VehicleUpsertRequest {
  plateNumber: string;
  brand: string;
  model?: string | null;
  modelYear?: number | null;
  color?: string | null;
  status: VehicleStatus;
  isActive: boolean;
  transmissionType: VehicleTransmissionType;
  vehicleType: VehicleType;
  licenseClass: LicenseClass;
  ownershipType: VehicleOwnershipType;
  fuelType?: VehicleFuelType | null;
  odometerValue?: number | null;
  odometerUnit: VehicleOdometerUnit;
  notes?: string | null;
  /** Required for updates; omitted on create. */
  rowVersion?: number;
}

/* ── Instructors ── */

export type InstructorRole =
  | "founder"
  | "manager"
  | "assistant_manager"
  | "master_instructor"
  | "specialist_instructor"
  | "psychologist"
  | "office_staff"
  | "track_responsible"
  | "accounting"
  | "other";
export type InstructorEmploymentType = "salaried" | "hourly" | "other";
export type InstructorBranch = string;

export interface TrainingBranchDefinitionResponse {
  id: string;
  code: string;
  name: string;
  totalLessonHourLimit: number | null;
  colorHex: string;
  displayOrder: number;
  isActive: boolean;
  notes: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

export interface TrainingBranchDefinitionListSummaryResponse {
  activeCount: number;
  limitedCount: number;
}

export interface TrainingBranchDefinitionListResponse
  extends PagedResponse<TrainingBranchDefinitionResponse> {
  summary: TrainingBranchDefinitionListSummaryResponse;
}

export interface TrainingBranchDefinitionUpsertRequest {
  code: string;
  name: string;
  totalLessonHourLimit?: number | null;
  colorHex: string;
  displayOrder: number;
  isActive: boolean;
  notes?: string | null;
  rowVersion?: number;
}

export interface InstructorResponse {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  nationalId: string | null;
  phoneNumber: string | null;
  email: string | null;
  isActive: boolean;
  role: InstructorRole;
  employmentType: InstructorEmploymentType;
  branches: InstructorBranch[];
  licenseClassCodes: LicenseClass[];
  weeklyLessonHours: number | null;
  mebbisPermitNo: string | null;
  assignedVehicleId: string | null;
  notes: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

export interface InstructorListSummaryResponse {
  activeCount: number;
  masterInstructorCount: number;
  specialistInstructorCount: number;
  practiceBranchCount: number;
}

export interface InstructorListResponse extends PagedResponse<InstructorResponse> {
  summary: InstructorListSummaryResponse;
}

export interface InstructorUpsertRequest {
  code?: string | null;
  firstName: string;
  lastName: string;
  nationalId?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  isActive: boolean;
  role: InstructorRole;
  employmentType: InstructorEmploymentType;
  branches: InstructorBranch[];
  licenseClassCodes: LicenseClass[];
  weeklyLessonHours?: number | null;
  mebbisPermitNo?: string | null;
  assignedVehicleId?: string | null;
  notes?: string | null;
  /** Required for updates; omitted on create. */
  rowVersion?: number;
}

/* ── Routes ── */

export type RouteUsageType = "practice" | "exam" | "practice_and_exam";

export interface RouteResponse {
  id: string;
  code: string;
  name: string;
  usageType: RouteUsageType;
  district: string | null;
  startLocation: string | null;
  endLocation: string | null;
  distanceKm: number | null;
  estimatedDurationMinutes: number | null;
  isActive: boolean;
  notes: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

export interface RouteListSummaryResponse {
  activeCount: number;
  practiceRouteCount: number;
  examRouteCount: number;
}

export interface RouteListResponse extends PagedResponse<RouteResponse> {
  summary: RouteListSummaryResponse;
}

export interface RouteUpsertRequest {
  code: string;
  name: string;
  usageType: RouteUsageType;
  district?: string | null;
  startLocation?: string | null;
  endLocation?: string | null;
  distanceKm?: number | null;
  estimatedDurationMinutes?: number | null;
  isActive: boolean;
  notes?: string | null;
  /** Required for updates; omitted on create. */
  rowVersion?: number;
}

/* ── License Class Definitions ── */

export type LicenseClassDefinitionCategory =
  | "motorcycle"
  | "automobile"
  | "heavy_vehicle"
  | "bus"
  | "tractor"
  | "work_machine"
  | "other";

export interface LicenseClassDefinitionResponse {
  id: string;
  code: string;
  name: string;
  category: LicenseClassDefinitionCategory;
  minimumAge: number | null;
  isAutomatic: boolean;
  isDisabled: boolean;
  isNewGeneration: boolean;
  requiresTheoryExam: boolean;
  requiresPracticeExam: boolean;
  theoryLessonHours: number | null;
  contractLessonHours: number | null;
  directPracticeLessonHours: number | null;
  upgradePracticeLessonHours: number | null;
  courseFee: number | null;
  mebbisFee: number | null;
  theoryExamFee: number | null;
  practiceExamFirstFee: number | null;
  practiceExamRepeatFee: number | null;
  additionalPracticeLessonFee: number | null;
  otherFee: number | null;
  displayOrder: number;
  isActive: boolean;
  notes: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

export interface LicenseClassDefinitionListSummaryResponse {
  activeCount: number;
  automaticCount: number;
  disabledCount: number;
  pricedCount: number;
}

export interface LicenseClassDefinitionListResponse
  extends PagedResponse<LicenseClassDefinitionResponse> {
  summary: LicenseClassDefinitionListSummaryResponse;
}

export interface LicenseClassDefinitionUpsertRequest {
  code: string;
  name: string;
  category: LicenseClassDefinitionCategory;
  minimumAge?: number | null;
  isAutomatic: boolean;
  isDisabled: boolean;
  isNewGeneration: boolean;
  requiresTheoryExam: boolean;
  requiresPracticeExam: boolean;
  theoryLessonHours?: number | null;
  contractLessonHours?: number | null;
  directPracticeLessonHours?: number | null;
  upgradePracticeLessonHours?: number | null;
  courseFee?: number | null;
  mebbisFee?: number | null;
  theoryExamFee?: number | null;
  practiceExamFirstFee?: number | null;
  practiceExamRepeatFee?: number | null;
  additionalPracticeLessonFee?: number | null;
  otherFee?: number | null;
  displayOrder: number;
  isActive: boolean;
  notes?: string | null;
  /** Required for updates; omitted on create. */
  rowVersion?: number;
}

/* ── Areas ── */

export type AreaType =
  | "classroom"
  | "practice_track"
  | "exam_area"
  | "office"
  | "storage"
  | "psychotechnic_room"
  | "src_training_room"
  | "other";

export interface AreaResponse {
  id: string;
  code: string;
  name: string;
  areaType: AreaType;
  capacity: number | null;
  district: string | null;
  address: string | null;
  isActive: boolean;
  notes: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

export interface AreaListSummaryResponse {
  activeCount: number;
  classroomCount: number;
  practiceTrackCount: number;
  examAreaCount: number;
}

export interface AreaListResponse extends PagedResponse<AreaResponse> {
  summary: AreaListSummaryResponse;
}

export interface AreaUpsertRequest {
  code: string;
  name: string;
  areaType: AreaType;
  capacity?: number | null;
  district?: string | null;
  address?: string | null;
  isActive: boolean;
  notes?: string | null;
  /** Required for updates; omitted on create. */
  rowVersion?: number;
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
  rowVersion: number;
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
  rowVersion?: number;
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
  rowVersion: number;
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
  rowVersion?: number;
}

/* ── Training Lessons ── */

export type TrainingLessonKind = "teorik" | "uygulama";
export type TrainingLessonStatus = "planned" | "completed";

export interface TrainingLessonLicenseClassCount {
  licenseClass: string;
  count: number;
}

export interface TrainingLessonResponse {
  id: string;
  kind: TrainingLessonKind;
  status: TrainingLessonStatus;
  startAtUtc: string;
  endAtUtc: string;
  instructorId: string;
  instructorName: string;
  groupId: string | null;
  groupTitle: string | null;
  termName: string | null;
  licenseClassCounts: TrainingLessonLicenseClassCount[];
  candidateId: string | null;
  candidateName: string | null;
  vehicleId: string | null;
  vehiclePlate: string | null;
  areaId: string | null;
  areaName: string | null;
  routeId: string | null;
  routeName: string | null;
  branchCode: string | null;
  licenseClass: LicenseClass | null;
  practiceEducationType: PracticeEducationType | null;
  candidateCount: number;
  notes: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

/** MEBBİS `cmbEgitimTuru` karşılığı — uygulama (direksiyon) derslerinde
 *  zorunlu, teorik derslerde null. Backend canonical English. */
export type PracticeEducationType =
  | "normal"
  | "makeup"
  | "second_practice"
  | "failed_candidate";

export interface TrainingLessonListResponse {
  items: TrainingLessonResponse[];
}

export interface TrainingLessonUpsertRequest {
  kind: TrainingLessonKind;
  status: TrainingLessonStatus;
  startAtUtc: string;
  endAtUtc: string;
  instructorId: string;
  groupId?: string | null;
  candidateId?: string | null;
  vehicleId?: string | null;
  areaId?: string | null;
  routeId?: string | null;
  branchCode?: string | null;
  licenseClass?: LicenseClass | null;
  practiceEducationType?: PracticeEducationType | null;
  notes?: string | null;
  rowVersion?: number;
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
