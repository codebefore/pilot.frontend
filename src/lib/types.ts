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

export interface CandidateEducationPlan {
  licenseClassDefinitionId: string | null;
  certificateProgramId: string | null;
  requiresTheoryExam: boolean;
  requiresPracticeExam: boolean;
  theoryLessonHours: number | null;
  simulatorLessonHours: number | null;
  practiceLessonHours: number | null;
}

export type CandidateContactType = "phone" | "email" | "address" | "other";

export interface CandidateContactResponse {
  id: string;
  type: CandidateContactType;
  label: string | null;
  value: string;
  isPrimary: boolean;
  displayOrder: number;
}

export interface CandidateContactUpsertRequest {
  id?: string | null;
  type: CandidateContactType;
  label?: string | null;
  value: string;
  isPrimary: boolean;
}

export interface CandidateResponse {
  id: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  identitySerialNumber: string | null;
  motherName: string | null;
  fatherName: string | null;
  phoneNumber: string | null;
  email: string | null;
  address: string | null;
  birthDate: string | null;
  gender: CandidateGenderValue | null;
  licenseClass: LicenseClass;
  certificateProgramId?: string | null;
  existingLicenseType: string | null;
  existingLicenseIssuedAt: string | null;
  existingLicenseNumber: string | null;
  existingLicenseIssuedProvince: string | null;
  existingLicensePre2016: boolean;
  educationPlan?: CandidateEducationPlan | null;
  status: string;
  mebSyncStatus?: string | null;
  mebExamDate?: string | null;
  drivingExamDate?: string | null;
  mebExamResult?: string | null;
  eSinavAttemptCount?: number | null;
  drivingExamAttemptCount?: number | null;
  examFeePaid?: boolean;
  initialPaymentReceived?: boolean;
  currentGroup: CandidateGroupSummary | null;
  documentSummary: CandidateDocumentSummaryResponse | null;
  photo?: CandidatePhotoSummary | null;
  contacts?: CandidateContactResponse[];
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
  identitySerialNumber?: string | null;
  motherName?: string | null;
  fatherName?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  address?: string | null;
  birthDate?: string | null;
  /** Write-boundary is strict: only canonical English (or null / omitted). */
  gender?: CandidateGenderValue | null;
  licenseClass: LicenseClass;
  certificateProgramId?: string | null;
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
  initialPaymentReceived?: boolean;
  contacts?: CandidateContactUpsertRequest[];
  /** Names only — backend resolves or creates tags by name. */
  tags?: string[];
  reuseFromCandidateId?: string | null;
  documentIdsToCopy?: string[];
  /** Required for updates; omitted on create. */
  rowVersion?: number;
}

export type CandidateChargeSourceType = "manual" | "matrix";
export type CandidateBillingStatus = "active" | "cancelled";
export type CandidatePaymentMethod = "cash" | "bank_transfer" | "credit_card" | "mail_order" | "other";
export type CandidateAccountingType = "kurs" | "teorik_sinav" | "direksiyon_sinav" | "diger";

export interface AccountingCashRegisterSummaryResponse {
  id: string;
  name: string;
  type: CashRegisterType;
}

export interface CandidateAccountingMovementResponse {
  id: string;
  candidateId: string;
  type: CandidateAccountingType;
  number: string;
  description: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  refundedAmount: number;
  remainingAmount: number;
  status: CandidateBillingStatus;
  lastPaymentMethod: CandidatePaymentMethod | null;
  lastPaidAtUtc: string | null;
  cancelledAtUtc: string | null;
  cancellationReason: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

export interface CandidateAccountingPaymentAllocationResponse {
  id: string;
  movementId: string;
  movementNumber: string;
  amount: number;
}

export interface CandidateAccountingPaymentResponse {
  id: string;
  candidateId: string;
  type: CandidateAccountingType;
  paymentMethod: CandidatePaymentMethod;
  cashRegisterId: string | null;
  cashRegister: AccountingCashRegisterSummaryResponse | null;
  amount: number;
  refundedAmount: number;
  paidAtUtc: string;
  note: string | null;
  status: CandidateBillingStatus;
  cancelledAtUtc: string | null;
  cancellationReason: string | null;
  allocations: CandidateAccountingPaymentAllocationResponse[];
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

export interface CandidateAccountingRefundResponse {
  id: string;
  candidateId: string;
  paymentId: string;
  type: CandidateAccountingType;
  cashRegisterId: string | null;
  cashRegister: AccountingCashRegisterSummaryResponse | null;
  amount: number;
  refundedAtUtc: string;
  note: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface CandidateAccountingInvoiceResponse {
  id: string;
  candidateId: string;
  invoiceNo: string;
  invoiceType: string;
  invoiceDate: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  notes: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

export interface CandidateAccountingFeeSuggestionResponse {
  type: CandidateAccountingType;
  feeType: string;
  feeId: string;
  amount: number;
  description: string;
}

export interface CandidateAccountingSummaryResponse {
  candidateId: string;
  movements: CandidateAccountingMovementResponse[];
  payments: CandidateAccountingPaymentResponse[];
  refunds: CandidateAccountingRefundResponse[];
  invoices: CandidateAccountingInvoiceResponse[];
  feeSuggestions: CandidateAccountingFeeSuggestionResponse[];
  totalMovementAmount: number;
  totalPaid: number;
  totalRefunded: number;
  balance: number;
  invoiceTotal: number;
}

export interface CandidateAccountingMovementCreateRequest {
  type: CandidateAccountingType;
  dueDate: string;
  amount: number;
  description: string;
}

export interface CandidateAccountingPaymentCreateRequest {
  type: CandidateAccountingType;
  paymentMethod: CandidatePaymentMethod;
  cashRegisterId?: string | null;
  amount: number;
  paidAtUtc?: string | null;
  note?: string | null;
}

export interface CandidateAccountingRefundCreateRequest {
  amount?: number | null;
  refundedAtUtc?: string | null;
  note?: string | null;
}

export interface CandidateAccountingInvoiceUpsertRequest {
  invoiceNo: string;
  invoiceType: string;
  invoiceDate: string;
  subtotal: number;
  vatRate: number;
  notes?: string | null;
  rowVersion?: number;
}

export interface SuggestedCandidateChargeResponse {
  sourceType: CandidateChargeSourceType;
  certificateProgramId: string;
  feeYear: number;
  description: string;
  sourceLicenseClass: string;
  sourceLicenseDisplayName: string;
  sourceLicensePre2016: boolean;
  targetLicenseClass: string;
  targetLicenseDisplayName: string;
  theoryLessonHours: number;
  practiceLessonHours: number;
  amount: number;
}

export interface CandidateChargeResponse {
  id: string;
  candidateId: string;
  sourceType: CandidateChargeSourceType;
  sourceReferenceId: string | null;
  feeYear: number | null;
  description: string;
  amount: number;
  chargedAtUtc: string;
  status: CandidateBillingStatus;
  cancelledAtUtc: string | null;
  cancellationReason: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

export interface CandidatePaymentResponse {
  id: string;
  candidateId: string;
  candidateChargeId: string | null;
  candidatePaymentInstallmentId: string | null;
  amount: number;
  paymentMethod: CandidatePaymentMethod;
  paidAtUtc: string;
  note: string | null;
  status: CandidateBillingStatus;
  cancelledAtUtc: string | null;
  cancellationReason: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

export type CandidatePaymentInstallmentStatus = "active" | "cancelled";
export type CandidatePaymentInstallmentPaymentStatus =
  | "pending"
  | "partial"
  | "paid"
  | "overdue"
  | "cancelled";

export interface CandidatePaymentInstallmentResponse {
  id: string;
  candidateId: string;
  sequence: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  description: string;
  status: CandidatePaymentInstallmentStatus;
  paymentStatus: CandidatePaymentInstallmentPaymentStatus;
  cancelledAtUtc: string | null;
  cancellationReason: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

export interface CandidateBillingSummaryResponse {
  candidateId: string;
  suggestedCharge: SuggestedCandidateChargeResponse | null;
  charges: CandidateChargeResponse[];
  payments: CandidatePaymentResponse[];
  installments: CandidatePaymentInstallmentResponse[];
  totalDebt: number;
  totalPaid: number;
  balance: number;
}

export interface CandidateChargeCreateRequest {
  sourceType: CandidateChargeSourceType;
  sourceReferenceId?: string | null;
  feeYear?: number | null;
  description: string;
  amount: number;
  chargedAtUtc?: string | null;
}

export interface CandidatePaymentCreateRequest {
  candidateChargeId?: string | null;
  candidatePaymentInstallmentId?: string | null;
  amount: number;
  paymentMethod: CandidatePaymentMethod;
  paidAtUtc?: string | null;
  note?: string | null;
}

export interface CandidatePaymentPlanCreateRequest {
  downPaymentAmount: number;
  installmentCount: number;
  firstDueDate: string;
}

export interface PaymentsOverviewResponse {
  summary: PaymentsOverviewSummaryResponse;
  payments: PaymentMovementResponse[];
  installments: PaymentInstallmentOverviewResponse[];
  charges: PaymentChargeOverviewResponse[];
}

export interface PaymentsOverviewSummaryResponse {
  todayCollected: number;
  monthCollected: number;
  activeBalance: number;
  overdueInstallmentTotal: number;
  cancelledPaymentTotal: number;
}

export interface PaymentCandidateSummaryResponse {
  id: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  licenseClass: string;
}

export interface PaymentMovementResponse {
  id: string;
  candidate: PaymentCandidateSummaryResponse;
  candidatePaymentInstallmentId: string | null;
  installmentDescription: string | null;
  cashRegisterId: string | null;
  cashRegister: AccountingCashRegisterSummaryResponse | null;
  amount: number;
  paymentMethod: CandidatePaymentMethod;
  paidAtUtc: string;
  note: string | null;
  status: CandidateBillingStatus;
  cancelledAtUtc: string | null;
  cancellationReason: string | null;
}

export interface PaymentInstallmentOverviewResponse {
  id: string;
  candidate: PaymentCandidateSummaryResponse;
  sequence: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  description: string;
  status: CandidatePaymentInstallmentStatus;
  paymentStatus: CandidatePaymentInstallmentPaymentStatus;
  cancelledAtUtc: string | null;
  cancellationReason: string | null;
}

export interface PaymentChargeOverviewResponse {
  id: string;
  candidate: PaymentCandidateSummaryResponse;
  sourceType: CandidateChargeSourceType;
  description: string;
  amount: number;
  chargedAtUtc: string;
  status: CandidateBillingStatus;
  cancelledAtUtc: string | null;
  cancellationReason: string | null;
}

export interface CandidateReusableDocumentResponse {
  id: string;
  documentTypeId: string;
  documentTypeKey: string;
  documentTypeName: string;
  originalFileName: string | null;
  isPhysicallyAvailable: boolean;
  hasFile: boolean;
  note: string | null;
  uploadedAtUtc: string;
}

export interface CandidateReuseSourceResponse {
  id: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  phoneNumber: string | null;
  email: string | null;
  address: string | null;
  birthDate: string | null;
  gender: CandidateGenderValue | null;
  licenseClass: LicenseClass;
  existingLicenseType: string | null;
  existingLicenseIssuedAt: string | null;
  existingLicenseNumber: string | null;
  existingLicenseIssuedProvince: string | null;
  existingLicensePre2016: boolean;
  status: string;
  createdAtUtc: string;
  documents: CandidateReusableDocumentResponse[];
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
  insuranceStartDate: string | null;
  insuranceEndDate: string | null;
  inspectionStartDate: string | null;
  inspectionEndDate: string | null;
  cascoStartDate: string | null;
  cascoEndDate: string | null;
  accidentNotes: string | null;
  otherDetails: string | null;
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
  insuranceStartDate?: string | null;
  insuranceEndDate?: string | null;
  inspectionStartDate?: string | null;
  inspectionEndDate?: string | null;
  cascoStartDate?: string | null;
  cascoEndDate?: string | null;
  accidentNotes?: string | null;
  otherDetails?: string | null;
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
  assignedVehicleId?: string | null;
  notes?: string | null;
  /** Required for updates; omitted on create. */
  rowVersion?: number;
}

/* ── Instructor Assignments ── */

export interface InstructorAssignmentDocument {
  id: string;
  name: string;
  description: string | null;
  originalFileName: string | null;
  contentType: string | null;
  fileSizeBytes: number | null;
  uploadedAtUtc: string;
}

export interface InstructorAssignment {
  id: string;
  instructorId: string;
  sequenceNumber: number;
  role: InstructorRole;
  employmentType: InstructorEmploymentType;
  branches: InstructorBranch[];
  licenseClassCodes: LicenseClass[];
  weeklyLessonHours: number | null;
  mebPermitNo: string | null;
  contractStartDate: string;
  contractEndDate: string | null;
  documents: InstructorAssignmentDocument[];
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

export interface InstructorAssignmentUpsertRequest {
  role: InstructorRole;
  employmentType: InstructorEmploymentType;
  branches: InstructorBranch[];
  licenseClassCodes: LicenseClass[];
  weeklyLessonHours: number | null;
  mebPermitNo: string | null;
  contractStartDate: string;
  contractEndDate: string | null;
  /** Required for updates; omit on create. */
  rowVersion?: number;
}

export interface InstructorCreateRequest extends InstructorUpsertRequest {
  initialAssignment: InstructorAssignmentUpsertRequest;
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
  hasExistingLicense: boolean;
  existingLicenseType: string | null;
  existingLicensePre2016: boolean;
  requiresTheoryExam: boolean;
  requiresPracticeExam: boolean;
  theoryLessonHours: number | null;
  simulatorLessonHours: number | null;
  directPracticeLessonHours: number | null;
  displayOrder: number;
  isActive: boolean;
  notes: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

export interface LicenseClassDefinitionListSummaryResponse {
  activeCount: number;
}

export interface LicenseClassDefinitionListResponse
  extends PagedResponse<LicenseClassDefinitionResponse> {
  summary: LicenseClassDefinitionListSummaryResponse;
}

export interface LicenseClassDefinitionUpsertRequest {
  code: string;
  name?: string;
  category: LicenseClassDefinitionCategory;
  minimumAge?: number | null;
  hasExistingLicense: boolean;
  existingLicenseType?: string | null;
  existingLicensePre2016: boolean;
  requiresTheoryExam: boolean;
  requiresPracticeExam: boolean;
  theoryLessonHours?: number | null;
  simulatorLessonHours?: number | null;
  directPracticeLessonHours?: number | null;
  displayOrder: number;
  isActive: boolean;
  notes?: string | null;
  /** Required for updates; omitted on create. */
  rowVersion?: number;
}

/* ── Certificate Programs ── */

export interface CertificateProgramResponse {
  id: string;
  code: string;
  sourceLicenseClass: string;
  sourceLicenseDisplayName: string;
  sourceLicensePre2016: boolean;
  targetLicenseClass: string;
  targetLicenseDisplayName: string;
  minimumAge: number;
  theoryLessonHours: number;
  practiceLessonHours: number;
  displayOrder: number;
  isActive: boolean;
  notes: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

export interface CertificateProgramListSummaryResponse {
  activeCount: number;
  inactiveCount: number;
}

export interface CertificateProgramListResponse extends PagedResponse<CertificateProgramResponse> {
  summary: CertificateProgramListSummaryResponse;
}

export interface CertificateProgramUpsertRequest {
  code: string;
  sourceLicenseClass: string;
  sourceLicenseDisplayName: string;
  sourceLicensePre2016: boolean;
  targetLicenseClass: string;
  targetLicenseDisplayName: string;
  minimumAge: number;
  theoryLessonHours: number;
  practiceLessonHours: number;
  displayOrder: number;
  isActive: boolean;
  notes?: string | null;
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
  classroomId: string | null;
  classroomName: string | null;
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

export interface TrainingLessonBulkDeleteResponse {
  deletedCount: number;
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
  classroomId?: string | null;
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
  currentGroup?: CandidateGroupSummary | null;
  hasAdvancePayment: boolean;
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
  /** Dosya yüklenmediyse null. */
  originalFileName: string | null;
  /** Dosya yüklenmediyse null. */
  contentType: string | null;
  /** Dosya yüklenmediyse null. */
  fileSizeBytes: number | null;
  /** Kullanıcı "fiziksel evrak elde var" işaretledi. */
  isPhysicallyAvailable: boolean;
  /** Yüklenmiş bir dosya mevcut mu. */
  hasFile: boolean;
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
  mebbisUsername: string | null;
  hasMebbisPassword: boolean;
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
  mebbisUsername?: string | null;
  mebbisPassword?: string | null;
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

/* ── Classrooms ── */

export interface ClassroomBranchSummary {
  id: string;
  code: string;
  name: string;
  colorHex: string;
}

export interface ClassroomResponse {
  id: string;
  name: string;
  capacity: number;
  isActive: boolean;
  notes: string | null;
  branches: ClassroomBranchSummary[];
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

export interface ClassroomListSummaryResponse {
  activeCount: number;
  inactiveCount: number;
}

export interface ClassroomListResponse extends PagedResponse<ClassroomResponse> {
  summary: ClassroomListSummaryResponse;
}

export interface ClassroomUpsertRequest {
  name: string;
  capacity: number;
  isActive: boolean;
  notes?: string | null;
  branchIds: string[];
  /** Required for updates; omitted on create. */
  rowVersion?: number;
}

/* ── Cash Registers ── */

export type CashRegisterType = "cash" | "bank_transfer" | "credit_card" | "mail_order";

export interface CashRegisterResponse {
  id: string;
  name: string;
  type: CashRegisterType;
  isActive: boolean;
  notes: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

export interface CashRegisterListSummaryResponse {
  activeCount: number;
  inactiveCount: number;
}

export interface CashRegisterListResponse extends PagedResponse<CashRegisterResponse> {
  summary: CashRegisterListSummaryResponse;
}

export interface CashRegisterUpsertRequest {
  name: string;
  type: CashRegisterType;
  isActive: boolean;
  notes?: string | null;
  /** Required for updates; omitted on create. */
  rowVersion?: number;
}

/* ── Fees ── */

export type FeeType =
  | "theory_lesson"
  | "practice_lesson"
  | "theory_exam"
  | "practice_exam"
  | "failed_practice_exam"
  | "mebbis";

export interface FeeLicenseClassSummary {
  id: string;
  code: string;
  name: string;
  hasExistingLicense: boolean;
  existingLicenseType: string | null;
  existingLicensePre2016: boolean;
}

export interface FeeResponse {
  id: string;
  feeType: FeeType;
  amount: number;
  isActive: boolean;
  notes: string | null;
  licenseClasses: FeeLicenseClassSummary[];
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

export interface FeeListSummaryResponse {
  activeCount: number;
  inactiveCount: number;
}

export interface FeeListResponse extends PagedResponse<FeeResponse> {
  summary: FeeListSummaryResponse;
}

export interface FeeUpsertRequest {
  feeType: FeeType;
  amount: number;
  isActive: boolean;
  notes?: string | null;
  licenseClassIds: string[];
  /** Required for updates; omitted on create. */
  rowVersion?: number;
}

export interface CertificateProgramFeeProgramResponse {
  id: string;
  code: string;
  sourceLicenseClass: string;
  sourceLicenseDisplayName: string;
  sourceLicensePre2016: boolean;
  targetLicenseClass: string;
  targetLicenseDisplayName: string;
  minimumAge: number;
  theoryLessonHours: number;
  practiceLessonHours: number;
  courseFee: number | null;
  mebbisFee: number | null;
  failureRetryFee: number | null;
  privateLessonFee: number | null;
  educationFee: number | null;
  otherFee1: number | null;
  yearFeeRowVersion: number | null;
}

export interface CertificateProgramFeeProgramUpsertRequest {
  certificateProgramId: string;
  courseFee?: number | null;
  mebbisFee?: number | null;
  failureRetryFee?: number | null;
  privateLessonFee?: number | null;
  educationFee?: number | null;
  otherFee1?: number | null;
  rowVersion?: number | null;
}

export interface CertificateProgramFeeRowResponse {
  id: string | null;
  year: number;
  program: CertificateProgramFeeProgramResponse;
  lessonType: "theory" | "practice";
  lessonHours: number;
  vatIncludedHourlyRate: number | null;
  vatExcludedHourlyRate: number | null;
  lessonFee: number | null;
  vatAmount: number | null;
  contractTheoryExamFee: number | null;
  contractPracticeExamFee: number | null;
  institutionTheoryExamFee: number | null;
  institutionPracticeExamFee: number | null;
  rowVersion: number | null;
}

export interface CertificateProgramFeeMatrixResponse {
  year: number;
  vatRate: number;
  rows: CertificateProgramFeeRowResponse[];
}

export interface CertificateProgramFeeRowUpsertRequest {
  certificateProgramId: string;
  lessonType: "theory" | "practice";
  vatIncludedHourlyRate?: number | null;
  contractTheoryExamFee?: number | null;
  contractPracticeExamFee?: number | null;
  institutionTheoryExamFee?: number | null;
  institutionPracticeExamFee?: number | null;
  rowVersion?: number | null;
}

export interface CertificateProgramFeeMatrixUpsertRequest {
  rows: CertificateProgramFeeRowUpsertRequest[];
  programs?: CertificateProgramFeeProgramUpsertRequest[];
}

export interface CertificateProgramFeeBulkApplyRequest {
  targetLicenseClass?: string | null;
  certificateProgramIds?: string[] | null;
  lessonType?: "theory" | "practice" | null;
  field: string;
  value?: number | null;
}

/* ── Stats ── */

export interface SidebarStatsResponse {
  candidates: { total: number; active: number };
  groups: { total: number };
  documents: { missingCount: number };
  mebJobs: { failed: number; manualReview: number };
  payments: { dueToday: number };
}
