import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent, type ReactNode, type ThHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { candidateKeys, useCandidates, useCandidateTags } from "../lib/queries/use-candidates";
import { groupKeys } from "../lib/queries/use-groups";
import { useMebbisSessionGuard } from "../lib/queries/use-mebbis-session";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { CandidateExamDateSidebar } from "../components/candidates/CandidateExamDateSidebar";
import { CandidateFilterPanel } from "../components/candidates/CandidateFilterPanel";
import { CandidateDrawer } from "../components/drawers/CandidateDrawer";
import { DownloadIcon, FilterIcon, PlusIcon } from "../components/icons";
import { PageTabs, PageToolbar } from "../components/layout/PageToolbar";
import { CandidateTagManagerModal } from "../components/modals/CandidateTagManagerModal";
import { NewCandidateModal } from "../components/modals/NewCandidateModal";
import { NewExamCodeModal } from "../components/modals/NewExamCodeModal";
import { NewExamScheduleModal } from "../components/modals/NewExamScheduleModal";
import { CandidateDocumentBadge } from "../components/ui/CandidateDocumentBadge";
import { CandidateAvatar } from "../components/ui/CandidateAvatar";
import { CandidateTagsInput, tagColorIndex } from "../components/ui/CandidateTagsInput";
import { ColumnPicker, type ColumnOption } from "../components/ui/ColumnPicker";
import { CustomSelect } from "../components/ui/CustomSelect";
import { LocalizedDateInput } from "../components/ui/LocalizedDateInput";
import { LocalizedTimeInput } from "../components/ui/LocalizedTimeInput";
import { Modal } from "../components/ui/Modal";
import { Pagination } from "../components/ui/Pagination";
import { CheckboxListPopover } from "../components/ui/CheckboxListPopover";
import { SearchInput } from "../components/ui/SearchInput";
import { StatusPill } from "../components/ui/StatusPill";
import { TableHeaderFilter } from "../components/ui/TableHeaderFilter";
import { useToast } from "../components/ui/Toast";
import {
  EMPTY_CANDIDATE_FILTERS,
  combineTermGroupFilterValues,
  countActiveCandidateFilters,
  filtersToQuery,
  splitTermGroupFilterValues,
  termGroupGroupFilterValue,
  type CandidateFilterState,
} from "../lib/candidate-filters";
import { formatLocalDateOnly, todayLocalDateOnly } from "../lib/date-only";
import {
  buildGroupCode,
  resolveGroupCodeParts,
  type GroupCodeParts,
} from "../lib/group-code";
import { formatPhoneDisplay } from "../lib/phone";
import {
  assignCandidatesToExamDate,
  applyStatusToCandidates,
  applyTagsToCandidates,
  buildCandidateUpdatePayload,
} from "../lib/candidate-bulk";
import {
  assignCandidateGroup,
  getCandidateById,
  getCandidates,
  createCandidateTag,
  updateCandidate,
  type GetCandidatesParams,
  type CandidateSortField,
  type SortDirection,
} from "../lib/candidates-api";
import {
  chargeCandidateExamAttempt,
  createUnscheduledCandidateExamAttemptCharge,
  listCandidateExamAttempts,
  markCandidateExamAttemptSelfPaid,
  updateCandidateExamAttempt,
} from "../lib/candidate-exam-attempts-api";
import { getCandidateAccounting } from "../lib/candidate-accounting-api";
import { getAllGroups, getGroups } from "../lib/groups-api";
import { getDocumentChecklist } from "../lib/documents-api";
import { getVehicles } from "../lib/vehicles-api";
import { getInstructors } from "../lib/instructors-api";
import {
  deleteExamSchedule,
  getExamScheduleOptions,
  updateExamSchedule,
  type CandidateExamDateType,
} from "../lib/exam-schedules-api";
import { deleteExamCode, getExamCodes, updateExamCode } from "../lib/exam-codes-api";
import { getLicenseClassFeeMatrix } from "../lib/license-class-fee-matrix-api";
import { createDrivingExamResultSyncJob, createESinavExamResultSyncJob, getMebbisJob } from "../lib/mebbis-jobs-api";
import { ApiError, isAbortError } from "../lib/http";
import {
  DRIVING_EXAM_TIME_SLOT_LABELS,
  DRIVING_EXAM_TIME_SLOTS,
} from "../lib/driving-exam-time-slots";
import { useLanguage, useT } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { canManageArea } from "../lib/permissions";
import {
  candidateGenderLabel,
  candidateMebSyncStatusLabel,
  candidateMebSyncStatusToPill,
  CANDIDATE_GENDER_OPTIONS,
  CANDIDATE_STATUS_OPTIONS,
  candidateStatusLabel,
  candidateStatusToPill,
  existingLicenseTypeLabel,
  formatDateTR,
  type CandidateStatusValue,
} from "../lib/status-maps";
import { buildGroupHeading, buildTermLabel, compareTermsDesc } from "../lib/term-label";
import { formatNationalId } from "../lib/national-id";
import { normalizeSearchComparable, normalizeTextQuery } from "../lib/search";
import type { JobStatus } from "../types";
import type {
  CandidateExamFeeStatus,
  CandidateExamAttemptResponse,
  CandidateExamAttemptUpsertRequest,
  CandidateExamType,
  CandidateAccountingSummaryResponse,
  CandidateResponse,
  CandidateTag,
  ExamCodeOption,
  ExamScheduleOption,
  GroupResponse,
  InstructorResponse,
  LicenseClass,
  LicenseClassFeeMatrixResponse,
  PagedResponse,
  VehicleResponse,
} from "../lib/types";
import {
  mergeLicenseClassOptionsWithValues,
  useLicenseClassFilterOptions,
} from "../lib/use-license-class-options";
import { useColumnVisibility } from "../lib/use-column-visibility";
import { candidateHasExistingLicense } from "./CandidateDetailPage.helpers";

type CandidateTab = "all" | CandidateStatusValue;
type BulkActionMode = "status" | "tags" | "export" | "examDate" | "group" | null;
type CandidateListTabKey = string;

const TAB_KEYS: CandidateTab[] = [
  "all",
  "pre_registered",
  "active",
  "parked",
  "graduated",
  "dropped",
];
const DEFAULT_TAB: CandidateTab = "active";

const DEFAULT_PAGE_SIZE = 100;
const PAGE_SIZE_OPTIONS = [10, 20, 25, 50, 100];
const TEXT_DEBOUNCE_MS = 300;
const BULK_STATUS_OPTIONS = CANDIDATE_STATUS_OPTIONS;
const MEBBIS_EXAM_RESULT_POLL_INTERVAL_MS = 1000;
const MEBBIS_EXAM_RESULT_POLL_TIMEOUT_MS = 30 * 60 * 1000;
const MEBBIS_EXAM_RESULT_REFRESH_DELAYS_MS = [0, 1500, 4000, 8000];

type SortState = { field: CandidateSortField; direction: SortDirection } | null;
type CandidateColumnPageScope = "all" | "eSinav" | "uygulama";

const COLUMN_DRAG_MIME_TYPE = "application/x-pilot-candidate-column";
const CANDIDATE_SORT_STORAGE_VERSION = "v20";
const DEFAULT_CANDIDATE_SORT: SortState = { field: "groupSortCode", direction: "desc" };
const CANDIDATE_SORT_FIELDS = new Set<CandidateSortField>([
  "createdAtUtc",
  "groupSortCode",
  "name",
  "nationalId",
  "licenseClass",
  "status",
  "groupTitle",
  "eSinavDate",
  "drivingExamDate",
  "examAttemptCount",
  "drivingExamAttemptCount",
  "drivingExamAttendanceStatus",
  "examStatus",
  "totalFee",
  "totalPaid",
  "totalDebt",
]);

function candidateListTabLabel(value: CandidateTab, t: ReturnType<typeof useT>): string {
  return value === "all" ? t("common.all") : candidateStatusLabel(value);
}

function defaultCandidateSortForScope(
  _pageScope: CandidateColumnPageScope,
  _tab: CandidateListTabKey
): SortState {
  return DEFAULT_CANDIDATE_SORT;
}

function getGroupOptionSortCode(group: GroupResponse, parts: GroupCodeParts): number {
  if (typeof group.groupSortCode === "number") return group.groupSortCode;

  const [year, month] = group.term.monthDate.split("-").map(Number);
  const groupNumber = Number(parts.groupNumber);
  const branchCode = parts.groupBranch.charCodeAt(0) - 64;
  if (![year, month, groupNumber, branchCode].every(Number.isFinite)) return 0;

  return year * 10000 + month * 100 + groupNumber * 10 + branchCode;
}

function readCandidateSort(storageKey: string, fallback: SortState): SortState {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { field?: unknown; direction?: unknown } | null;
    if (
      parsed &&
      typeof parsed.field === "string" &&
      typeof parsed.direction === "string" &&
      (parsed.direction === "asc" || parsed.direction === "desc")
    ) {
      if (!CANDIDATE_SORT_FIELDS.has(parsed.field as CandidateSortField)) {
        return fallback;
      }
      return { field: parsed.field as CandidateSortField, direction: parsed.direction };
    }
  } catch {
    // Ignore corrupt or inaccessible localStorage and fall back to the page default.
  }
  return fallback;
}

function writeCandidateSort(storageKey: string, sort: SortState): void {
  try {
    if (sort) {
      window.localStorage.setItem(storageKey, JSON.stringify(sort));
    } else {
      window.localStorage.removeItem(storageKey);
    }
  } catch {
    // localStorage can be unavailable in private contexts; sorting still works in memory.
  }
}

export type CandidateColumnId =
  | "photo"
  | "name"
  | "nationalId"
  | "motherName"
  | "fatherName"
  | "referenceName"
  | "phoneNumber"
  | "birthDate"
  | "gender"
  | "existingLicenseType"
  | "licenseClass"
  | "group"
  | "groupStartDate"
  | "eSinavDate"
  | "eSinavAttemptCount"
  | "eSinavScore"
  | "eSinavTheoryExamFeeStatus"
  | "eSinavRightsExpiryDate"
  | "eSinavPoolStatus"
  | "drivingExamDate"
  | "drivingExamCode"
  | "drivingExamTime"
  | "drivingExamVehiclePlate"
  | "drivingExamInstructor"
  | "drivingExamAttemptCount"
  | "drivingExamAttendanceStatus"
  | "drivingExamResultStatus"
  | "drivingExamFeeStatus"
  | "graduationDate"
  | "terminationReason"
  | "terminationDate"
  | "totalFee"
  | "totalPaid"
  | "totalDebt"
  | "documents"
  | "missingDocuments"
  | "mebSyncStatus"
  | "status"
  | "createdAtUtc"
  | "updatedAtUtc";

const REMOVED_CANDIDATE_COLUMN_IDS = new Set<CandidateColumnId>([
  "eSinavDate",
  "drivingExamDate",
  "drivingExamAttemptCount",
  "missingDocuments",
]);

type CandidateColumnDef = {
  id: CandidateColumnId;
  pageScope?: CandidateColumnPageScope;
  pickerHidden?: boolean;
  /** i18n key for the header + picker label. */
  labelKey: "candidates.col.name"
    | "candidates.col.photo"
    | "candidates.col.nationalId"
    | "candidates.col.motherName"
    | "candidates.col.fatherName"
    | "candidates.col.referenceName"
    | "candidates.col.phoneNumber"
    | "candidates.col.birthDate"
    | "candidates.col.gender"
    | "candidates.col.existingLicenseType"
    | "candidates.col.licenseClass"
    | "candidates.col.group"
    | "candidates.col.groupStartDate"
    | "candidates.col.eSinavDate"
    | "candidates.col.eSinavAttemptCount"
    | "candidates.col.eSinavScore"
    | "candidates.col.eSinavTheoryExamFeeStatus"
    | "candidates.col.eSinavRightsExpiryDate"
    | "candidates.col.eSinavPoolStatus"
    | "candidates.col.drivingExamDate"
    | "candidates.col.drivingExamCode"
    | "candidates.col.drivingExamTime"
    | "candidates.col.drivingExamVehiclePlate"
    | "candidates.col.drivingExamInstructor"
    | "candidates.col.drivingExamAttemptCount"
    | "candidates.col.drivingExamAttendanceStatus"
    | "candidates.col.drivingExamResultStatus"
    | "candidates.col.drivingExamFeeStatus"
    | "candidates.col.graduationDate"
    | "candidates.col.terminationReason"
    | "candidates.col.terminationDate"
    | "candidates.col.totalFee"
    | "candidates.col.totalPaid"
    | "candidates.col.totalDebt"
    | "candidates.col.documents"
    | "candidates.col.missingDocuments"
    | "candidates.col.mebSyncStatus"
    | "candidates.col.status"
    | "candidates.col.createdAtUtc"
    | "candidates.col.updatedAtUtc";
  headerLabel?: React.ReactNode;
  /** When set, this column is sortable via the given backend field. */
  sortField?: CandidateSortField;
  headerClassName?: string;
  cellClassName?: string;
  renderCell: (c: CandidateResponse, pageScope: CandidateColumnPageScope) => React.ReactNode;
  /** Approximate skeleton width in pixels (used while loading). */
  skeletonWidth: number;
};

function formatOptionalText(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

function formatDrivingExamCodeWithCapacity(
  candidate: CandidateResponse,
  examScheduleById: Map<string, ExamScheduleOption>
): string {
  const code = candidate.drivingExamCode?.trim();
  if (!code) return "—";

  const schedule = candidate.drivingExamScheduleId
    ? examScheduleById.get(candidate.drivingExamScheduleId)
    : undefined;
  return schedule ? `${code} (${schedule.candidateCount}/${schedule.capacity})` : code;
}

function formatCurrencyTRY(amount: number | null | undefined): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(amount ?? 0);
}

type ExamChargeCandidateRow = {
  candidate: CandidateResponse;
  attempt: CandidateExamAttemptResponse;
  fee: string;
  duplicateReason?: string;
};

type ExamChargePromptState = {
  examType: CandidateExamDateType;
  rows: ExamChargeCandidateRow[];
};

type UnscheduledExamChargeRow = {
  candidate: CandidateResponse;
  fee: string;
  selected: boolean;
  duplicateReason?: string;
};

type UnscheduledExamChargePromptState = {
  examType: CandidateExamType;
  dueDate: string;
  description: string;
  rows: UnscheduledExamChargeRow[];
};

function examChargeTitle(examType: CandidateExamDateType): string {
  return examType === "e_sinav" ? "E-Sınav borçlandırması" : "Direksiyon sınav borçlandırması";
}

function unscheduledExamChargeTitle(examType: CandidateExamType): string {
  return examType === "theory" ? "Tarihsiz e-sınav borçlandırması" : "Tarihsiz direksiyon sınav borçlandırması";
}

function examDateTypeFromCandidateExamType(examType: CandidateExamType): CandidateExamDateType {
  return examType === "theory" ? "e_sinav" : "uygulama";
}

function accountingTypeFromCandidateExamType(examType: CandidateExamType): "teorik_sinav" | "direksiyon_sinav" {
  return examType === "theory" ? "teorik_sinav" : "direksiyon_sinav";
}

function activeExamDebtExists(
  accounting: CandidateAccountingSummaryResponse,
  examType: CandidateExamType
): boolean {
  const accountingType = accountingTypeFromCandidateExamType(examType);
  return accounting.movements.some((movement) =>
    movement.type === accountingType &&
    movement.status === "active" &&
    movement.remainingAmount > 0
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function examAttemptHasAccountingCharge(attempt: CandidateExamAttemptResponse): boolean {
  return (
    attempt.fee > 0 &&
    attempt.accountingMovementId !== null &&
    attempt.feeStatus !== "pending" &&
    attempt.feeStatus !== "cancelled" &&
    attempt.feeStatus !== "refunded"
  );
}

function examChargeFeeYear(date: string): number {
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : new Date().getFullYear();
}

function normalizeLicenseClassCode(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleUpperCase("tr-TR");
}

function defaultExamChargeFee(
  candidate: CandidateResponse,
  examType: CandidateExamDateType,
  feeMatrix: LicenseClassFeeMatrixResponse | null | undefined,
  fallbackFee: number | null | undefined
): number {
  const candidateLicenseClass = normalizeLicenseClassCode(candidate.licenseClass);
  const matchingRows = feeMatrix?.rows.filter(
    (item) =>
      normalizeLicenseClassCode(item.program.targetLicenseClass) === candidateLicenseClass ||
      normalizeLicenseClassCode(item.program.targetLicenseDisplayName) === candidateLicenseClass
  ) ?? [];
  const matrixFee = examType === "e_sinav"
    ? matchingRows.find((row) => row.institutionTheoryExamFee != null)?.institutionTheoryExamFee
    : matchingRows.find((row) => row.institutionPracticeExamFee != null)?.institutionPracticeExamFee;

  return matrixFee ?? fallbackFee ?? 0;
}

function candidateFullName(candidate: CandidateResponse): string {
  return `${candidate.firstName} ${candidate.lastName}`.trim();
}

function buildExamAttemptPayload(
  attempt: CandidateExamAttemptResponse,
  fee: number,
  score = attempt.score
): CandidateExamAttemptUpsertRequest {
  return {
    examType: attempt.examType,
    scheduledAt: attempt.scheduledAt ?? "",
    attemptNumber: attempt.attemptNumber,
    score,
    expiresAt: attempt.expiresAt,
    examScheduleId: attempt.examScheduleId,
    examCode: attempt.examCode,
    vehicleId: attempt.vehicleId,
    vehiclePlate: attempt.vehiclePlate,
    instructorId: attempt.instructorId,
    instructorFullName: attempt.instructorFullName,
    examAttendanceStatus: attempt.examAttendanceStatus,
    examResultStatus: attempt.examResultStatus,
    fee,
    feeStatus: attempt.feeStatus,
    rowVersion: attempt.rowVersion,
  };
}

function debtToneClass(amount: number | null | undefined): string {
  const value = amount ?? 0;
  if (value > 0) return " is-debt";
  if (value < 0) return " is-credit";
  return " is-clear";
}

function formatGroupWithTerm(candidate: CandidateResponse, lang: "tr" | "en"): string {
  if (!candidate.currentGroup) return "—";
  return buildGroupHeading(
    candidate.currentGroup.title,
    candidate.currentGroup.term,
    [candidate.currentGroup.term],
    lang
  );
}

function formatCandidateTerm(candidate: CandidateResponse, lang: "tr" | "en"): string {
  if (!candidate.currentGroup) return "—";
  return buildTermLabel(candidate.currentGroup.term, [candidate.currentGroup.term], lang);
}

const ESINAV_RIGHTS_EXPIRY_DAYS = 120;

function parseISODateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function toDateOnlyValue(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysToISODate(value: string | null | undefined, days: number): string | null {
  const date = parseISODateOnly(value);
  if (!date) return null;
  date.setDate(date.getDate() + days);
  return toDateOnlyValue(date);
}

function daysUntilISODate(value: string | null | undefined): number | null {
  const target = parseISODateOnly(value);
  if (!target) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function formatRemainingDayCount(days: number): string {
  return days >= 0 ? `${days} gün kaldı` : `${Math.abs(days)} gün geçti`;
}

function remainingDayTone(days: number): "normal" | "warning" | "danger" {
  if (days < 0) return "danger";
  if (days <= 10) return "warning";
  return "normal";
}

function CandidateDateWithRemaining({
  date,
  showRemaining = true,
}: {
  date: string | null | undefined;
  showRemaining?: boolean;
}) {
  const days = showRemaining ? daysUntilISODate(date) : null;
  if (!date) return "—";
  return (
    <span className={`cand-date-with-remaining${days === null ? "" : ` ${remainingDayTone(days)}`}`}>
      <span>{formatDateTR(date)}</span>
      {days !== null ? <small>{formatRemainingDayCount(days)}</small> : null}
    </span>
  );
}

function CandidateESinavRightsExpiryCell({ candidate }: { candidate: CandidateResponse }) {
  const expiryDate = addDaysToISODate(candidate.currentGroup?.startDate, ESINAV_RIGHTS_EXPIRY_DAYS);
  const days = daysUntilISODate(expiryDate);
  if (!expiryDate || days === null) return "—";
  return <CandidateDateWithRemaining date={expiryDate} />;
}

function drivingExamTimeValue(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Istanbul",
  }).format(date);
}

function formatDrivingExamTime(value: string | null | undefined): string {
  const time = drivingExamTimeValue(value);
  return DRIVING_EXAM_TIME_SLOT_LABELS.get(time) ?? time;
}

function drivingExamDateTimeIso(date: string | null | undefined, time: string): string {
  const day = date?.slice(0, 10);
  return day && /^\d{2}:\d{2}$/.test(time)
    ? new Date(`${day}T${time}:00+03:00`).toISOString()
    : "";
}

function instructorFullName(instructor: InstructorResponse): string {
  return `${instructor.firstName} ${instructor.lastName}`.trim();
}

function vehicleDisplayName(vehicle: VehicleResponse | null | undefined): string | null {
  if (!vehicle) return null;
  const primary = vehicle.plateNumber.trim();
  if (primary) return primary;
  const name = [vehicle.brand, vehicle.model].filter(Boolean).join(" ").trim();
  return name || null;
}

function isExamVehicle(vehicle: VehicleResponse): boolean {
  return !vehicle.isSimulator;
}

function DrivingExamTimeCell({
  candidate,
  editing,
  disabled,
  disabledTitle,
  onEdit,
  onCancel,
  onSave,
}: {
  candidate: CandidateResponse;
  editing: boolean;
  disabled: boolean;
  disabledTitle?: string;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (time: string) => void;
}) {
  const t = useT();
  const value = drivingExamTimeValue(candidate.drivingExamScheduledAt);
  const label = value === "—" ? "—" : DRIVING_EXAM_TIME_SLOT_LABELS.get(value) ?? value;
  if (!candidate.drivingExamAttemptId) return "—";
  return (
    <div
      className="cand-inline-edit-cell"
      onClick={(event) => event.stopPropagation()}
      title={disabled ? disabledTitle : undefined}
    >
      {editing ? (
        <LocalizedTimeInput
          ariaLabel={t("candidatesPage.aria.examTime")}
          className="cand-inline-edit-input"
          disabled={disabled}
          onBlur={onCancel}
          onChange={onSave}
          size="sm"
          timeOptions={DRIVING_EXAM_TIME_SLOTS}
          value={value === "—" ? "" : value}
        />
      ) : (
        <button
          className="cand-inline-edit-trigger"
          disabled={disabled}
          onClick={onEdit}
          title={disabled ? disabledTitle : undefined}
          type="button"
        >
          {label}
        </button>
      )}
    </div>
  );
}

function DrivingExamSelectCell({
  value,
  label,
  options,
  editing,
  disabled,
  disabledTitle,
  ariaLabel,
  onEdit,
  onCancel,
  onSave,
}: {
  value: string;
  label: ReactNode;
  options: { value: string; label: string }[];
  editing: boolean;
  disabled: boolean;
  disabledTitle?: string;
  ariaLabel: string;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (value: string) => void;
}) {
  return (
    <div
      className="cand-inline-edit-cell"
      onClick={(event) => event.stopPropagation()}
      title={disabled ? disabledTitle : undefined}
    >
      {editing ? (
        <CustomSelect
          autoFocus
          aria-label={ariaLabel}
          className="cand-inline-edit-select"
          disabled={disabled}
          onBlur={onCancel}
          onChange={(event) => onSave(event.target.value)}
          openOnFocus
          size="sm"
          value={value}
        >
          <option value="">—</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </CustomSelect>
      ) : (
        <button
          className="cand-inline-edit-trigger"
          disabled={disabled}
          onClick={onEdit}
          title={disabled ? disabledTitle : undefined}
          type="button"
        >
          {label}
        </button>
      )}
    </div>
  );
}

function examFeeStatusLabel(status: CandidateExamFeeStatus | null | undefined, t: ReturnType<typeof useT>): string {
  if (status === "paid") return t("candidatesPage.examFee.paid");
  if (status === "partially_paid") return t("candidatesPage.examFee.partiallyPaid");
  if (status === "partially_refunded") return t("candidatesPage.examFee.partiallyRefunded");
  if (status === "refunded") return t("candidatesPage.examFee.refunded");
  if (status === "cancelled") return t("candidatesPage.examFee.cancelled");
  if (status === "charged") return t("candidatesPage.examFee.charged");
  return t("candidatesPage.examFee.pending");
}

function examFeeStatusPill(status: CandidateExamFeeStatus | null | undefined): JobStatus {
  if (status === "paid" || status === "refunded" || status === "cancelled") return "success";
  if (status === "charged" || status === "partially_paid" || status === "partially_refunded") return "warning";
  return "queued";
}

function CandidateExamFeeStatusPill({ status }: { status: CandidateExamFeeStatus | null | undefined }) {
  const t = useT();
  return (
    <StatusPill
      label={examFeeStatusLabel(status, t)}
      status={examFeeStatusPill(status)}
    />
  );
}

function drivingExamAttendanceLabel(status: CandidateResponse["drivingExamAttendanceStatus"]): string {
  if (status === "attended") return "Girdi";
  if (status === "absent") return "Girmedi";
  if (isReportedAttendanceStatus(status)) return "Raporlu";
  return "—";
}

function drivingExamAttendancePill(status: CandidateResponse["drivingExamAttendanceStatus"]): JobStatus {
  if (status === "attended") return "success";
  if (isReportedAttendanceStatus(status)) return "manual";
  if (status === "absent") return "failed";
  return "queued";
}

function isReportedAttendanceStatus(status: string | null | undefined): boolean {
  return status?.trim().toLowerCase() === "reported";
}

function DrivingExamAttendancePill({
  status,
}: {
  status: CandidateResponse["drivingExamAttendanceStatus"];
}) {
  return (
    <StatusPill
      label={drivingExamAttendanceLabel(status)}
      status={drivingExamAttendancePill(status)}
    />
  );
}

function drivingExamResultLabel(
  status: CandidateResponse["drivingExamResultStatus"],
  t: ReturnType<typeof useT>
): string {
  if (status === "passed") return t("candidateDetail.exam.passed");
  if (status === "failed") return t("candidateDetail.exam.failed");
  return "—";
}

function drivingExamResultPill(status: CandidateResponse["drivingExamResultStatus"]): JobStatus {
  if (status === "passed") return "success";
  if (status === "failed") return "failed";
  return "queued";
}

function DrivingExamResultPill({
  status,
}: {
  status: CandidateResponse["drivingExamResultStatus"];
}) {
  const t = useT();
  return (
    <StatusPill
      label={drivingExamResultLabel(status, t)}
      status={drivingExamResultPill(status)}
    />
  );
}

function hasFailedExamResult(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLocaleLowerCase("tr-TR");
  return normalized.includes("failed") ||
    normalized.includes("basarisiz") ||
    normalized.includes("başarısız");
}

function hasPassedExamResult(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLocaleLowerCase("tr-TR");
  return normalized.includes("passed") ||
    normalized.includes("basarili") ||
    normalized.includes("başarılı");
}

function theoryExamResultFromScore(score: number | null | undefined): "passed" | "failed" | null {
  if (score == null) return null;
  return score >= 70 ? "passed" : "failed";
}

function eSinavScoreStatus(score: number | null | undefined): {
  labelKey: "candidateDetail.exam.result.pass" | "candidateDetail.exam.result.fail";
  kind: "success" | "danger";
} | null {
  if (score == null) return null;
  return score >= 70
    ? { labelKey: "candidateDetail.exam.result.pass", kind: "success" }
    : { labelKey: "candidateDetail.exam.result.fail", kind: "danger" };
}

function latestExamAttempt(
  attempts: CandidateExamAttemptResponse[],
  examType: CandidateExamType
): CandidateExamAttemptResponse | undefined {
  return attempts
    .filter((attempt) =>
      attempt.examType === examType &&
      (attempt.schedulingStatus ?? "scheduled") === "scheduled" &&
      Boolean(attempt.scheduledAt)
    )
    .sort((left, right) => {
      if (right.attemptNumber !== left.attemptNumber) {
        return right.attemptNumber - left.attemptNumber;
      }
      return Date.parse(right.scheduledAt ?? "") - Date.parse(left.scheduledAt ?? "");
    })[0];
}

type CandidateExamStage = "eSinav" | "practice";
type CandidateUnifiedExamStatus = "havuz" | "randevulu" | "basarisiz" | "basarili" | "parked" | "graduated" | "dropped";

function todayISO(): string {
  return todayLocalDateOnly();
}

function isPastIsoDate(value: string): boolean {
  return value < todayISO();
}

function omitExamTabFilter(params: Partial<GetCandidatesParams>): Partial<GetCandidatesParams> {
  const { eSinavTab: _eSinavTab, drivingExamTab: _drivingExamTab, ...rest } = params;
  return rest;
}

function candidateUsesPracticeStage(candidate: CandidateResponse): boolean {
  return candidate.isTheoryExempt === true ||
    candidateHasExistingLicense(candidate) ||
    candidate.educationPlan?.requiresTheoryExam === false ||
    hasPassedExamResult(candidate.mebExamResult) ||
    candidate.status === "graduated" ||
    Boolean(candidate.drivingExamDate) ||
    Boolean(candidate.drivingExamResultStatus) ||
    (candidate.drivingExamAttemptCount ?? 0) > 0;
}

function candidateUnifiedExamStage(candidate: CandidateResponse): CandidateExamStage {
  return candidateUsesPracticeStage(candidate) ? "practice" : "eSinav";
}

function candidateUnifiedExamStatus(candidate: CandidateResponse): {
  stage: CandidateExamStage;
  status: CandidateUnifiedExamStatus;
} {
  const stage = candidateUnifiedExamStage(candidate);
  if (candidate.status === "dropped" || candidate.status === "parked" || candidate.status === "graduated") {
    return { stage, status: candidate.status };
  }

  if (stage === "eSinav") {
    if (hasFailedExamResult(candidate.mebExamResult)) return { stage, status: "basarisiz" };
    return { stage, status: candidate.mebExamDate ? "randevulu" : "havuz" };
  }

  if (candidate.drivingExamResultStatus === "passed") return { stage, status: "basarili" };
  if (candidate.drivingExamResultStatus === "failed") return { stage, status: "basarisiz" };
  if (candidate.drivingExamDate) return { stage, status: "randevulu" };
  if ((candidate.drivingExamAttemptCount ?? 1) > 1) return { stage, status: "basarisiz" };
  return { stage, status: "havuz" };
}

function examStageLabel(stage: CandidateExamStage, t: ReturnType<typeof useT>): string {
  return stage === "practice" ? t("candidatesPage.examStage.practice") : t("candidatesPage.examStage.eSinav");
}

function examStatusLabel(status: CandidateUnifiedExamStatus, t: ReturnType<typeof useT>): string {
  if (status === "dropped") return candidateStatusLabel("dropped");
  if (status === "parked") return candidateStatusLabel("parked");
  if (status === "graduated") return candidateStatusLabel("graduated");
  if (status === "randevulu") return t("candidatesPage.examStatus.scheduled");
  if (status === "basarisiz") return t("candidatesPage.examStatus.failed");
  if (status === "basarili") return t("candidatesPage.examStatus.passed");
  return t("candidatesPage.examStatus.pool");
}

function examStatusPill(status: CandidateUnifiedExamStatus): JobStatus {
  if (status === "dropped" || status === "parked" || status === "graduated") return candidateStatusToPill(status);
  if (status === "randevulu") return "running";
  if (status === "basarisiz") return "failed";
  if (status === "basarili") return "success";
  return "queued";
}

function CandidateUnifiedExamAttemptPill({ candidate }: { candidate: CandidateResponse }) {
  const t = useT();
  if (candidate.status === "dropped" || candidate.status === "parked" || candidate.status === "graduated") {
    return (
      <StatusPill
        label={candidateStatusLabel(candidate.status)}
        status={candidateStatusToPill(candidate.status)}
      />
    );
  }

  const stage = candidateUnifiedExamStage(candidate);
  const value = stage === "practice"
    ? candidate.drivingExamAttemptCount
    : candidate.eSinavAttemptCount;
  const maxAttempt = candidateExamAttemptDisplayLimit(candidate, stage);
  const attempt = Math.min(Math.max(value ?? 1, 1), maxAttempt);
  const status = attempt >= maxAttempt ? "failed" : attempt >= 2 ? "manual" : "success";
  return (
    <StatusPill
      label={`${examStageLabel(stage, t)} ${attempt}/${maxAttempt}`}
      status={status}
    />
  );
}

function CandidateUnifiedExamStatusPill({ candidate }: { candidate: CandidateResponse }) {
  const t = useT();
  const { stage, status } = candidateUnifiedExamStatus(candidate);
  const stageLabel = examStageLabel(stage, t);
  const statusLabel = examStatusLabel(status, t);
  if (status === "dropped" || status === "parked" || status === "graduated") {
    return (
      <span title={statusLabel}>
        <StatusPill
          label={statusLabel}
          status={examStatusPill(status)}
        />
      </span>
    );
  }

  const title =
    status === "randevulu"
      ? t("candidatesPage.examTitle.scheduled", { stage: stageLabel })
      : status === "basarisiz"
        ? t("candidatesPage.examTitle.failed", { stage: stageLabel })
        : status === "basarili"
          ? t("candidatesPage.examTitle.passed", { stage: stageLabel })
          : t("candidatesPage.examTitle.pool", { stage: stageLabel });
  return (
    <span title={title}>
      <StatusPill
        label={`${stageLabel} ${statusLabel}`}
        status={examStatusPill(status)}
      />
    </span>
  );
}

function candidateUnifiedExamStatusExportLabel(candidate: CandidateResponse, t: ReturnType<typeof useT>): string {
  const { stage, status } = candidateUnifiedExamStatus(candidate);
  const statusLabel = examStatusLabel(status, t);
  if (status === "dropped" || status === "parked" || status === "graduated") return statusLabel;
  return `${examStageLabel(stage, t)} ${statusLabel}`;
}

function ExamAttemptPill({
  value,
  maxAttempt = 4,
}: {
  value: number | null | undefined;
  maxAttempt?: number;
}) {
  const attempt = Math.min(Math.max(value ?? 1, 1), maxAttempt);
  const status = attempt >= maxAttempt ? "failed" : attempt >= 2 ? "manual" : "success";
  return <StatusPill label={`${attempt}/${maxAttempt}`} status={status} />;
}

function candidateExamAttemptDisplayLimit(
  candidate: CandidateResponse,
  stage: CandidateExamStage
): number {
  if (stage !== "practice") return 4;
  return candidate.hasReportedPracticeAttempt ||
    isReportedAttendanceStatus(candidate.drivingExamAttendanceStatus) ||
    (candidate.drivingExamAttemptCount ?? 0) > 4
    ? 5
    : 4;
}

type CandidateAttemptFilterStage = "e_sinav" | "direksiyon";
type CandidateAttemptFilterOption = {
  value: CandidateFilterState["examAttemptCount"][number];
  label: string;
};

function candidateAttemptFilterStageLabel(stage: CandidateAttemptFilterStage): string {
  return stage === "e_sinav" ? "E-sınav" : "Direksiyon";
}

function candidateAttemptFilterValue(
  stage: CandidateAttemptFilterStage,
  attempt: number
): CandidateFilterState["examAttemptCount"][number] {
  return `${stage}_${attempt}` as CandidateFilterState["examAttemptCount"][number];
}

function candidateAttemptFilterOption(
  stage: CandidateAttemptFilterStage,
  attempt: number,
  limit: number
): CandidateAttemptFilterOption {
  return {
    value: candidateAttemptFilterValue(stage, attempt),
    label: `${candidateAttemptFilterStageLabel(stage)} ${attempt}/${limit}`,
  };
}

function parseCandidateAttemptFilterValue(
  value: CandidateFilterState["examAttemptCount"][number]
): { stage: CandidateAttemptFilterStage; attempt: number; limit: number } | null {
  const match = value.match(/^(e_sinav|direksiyon)_([1-5])$/);
  if (!match) return null;
  const stage = match[1] as CandidateAttemptFilterStage;
  const attempt = Number(match[2]);
  return {
    stage,
    attempt,
    limit: stage === "e_sinav" ? 4 : Math.max(4, attempt),
  };
}

function candidateAttemptFilterOptions(
  selectedValues: CandidateFilterState["examAttemptCount"],
  columnId: CandidateColumnId,
  pageScope: CandidateColumnPageScope
): CandidateAttemptFilterOption[] {
  const options = new Map<CandidateFilterState["examAttemptCount"][number], CandidateAttemptFilterOption>();

  for (const value of selectedValues) {
    const parsed = parseCandidateAttemptFilterValue(value);
    if (parsed) {
      options.set(value, candidateAttemptFilterOption(parsed.stage, parsed.attempt, parsed.limit));
    }
  }

  const stages: { stage: CandidateAttemptFilterStage; limit: number }[] =
    pageScope === "all"
      ? [
          { stage: "e_sinav", limit: 4 },
          { stage: "direksiyon", limit: 4 },
        ]
      : columnId === "drivingExamAttemptCount"
        ? [{ stage: "direksiyon", limit: 4 }]
        : [{ stage: "e_sinav", limit: 4 }];

  for (const { stage, limit } of stages) {
    for (let attempt = 1; attempt <= limit; attempt += 1) {
      const option = candidateAttemptFilterOption(stage, attempt, limit);
        options.set(option.value, option);
    }
  }

  return Array.from(options.values()).sort(
    (a, b) => {
      const parsedA = parseCandidateAttemptFilterValue(a.value);
      const parsedB = parseCandidateAttemptFilterValue(b.value);
      if (!parsedA || !parsedB) return a.label.localeCompare(b.label, "tr");
      if (parsedA.stage !== parsedB.stage) return parsedA.stage === "e_sinav" ? -1 : 1;
      return parsedA.attempt - parsedB.attempt;
    }
  );
}

function EditableESinavScoreCell({
  disabled,
  disabledTitle,
  score,
  onSave,
}: {
  disabled: boolean;
  disabledTitle?: string;
  score: number | null | undefined;
  onSave: (nextScore: number | null) => Promise<boolean>;
}) {
  const t = useT();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(score == null ? "" : String(score));
  const scoreStatus = eSinavScoreStatus(score);

  useEffect(() => {
    if (!editing) {
      setDraft(score == null ? "" : String(score));
    }
  }, [editing, score]);

  const commit = async () => {
    const raw = draft.trim();
    let nextScore: number | null;
    if (raw === "") {
      nextScore = null;
    } else if (!/^\d{1,3}$/.test(raw)) {
      showToast(t("candidateDetail.exam.toast.scoreInteger"), "error");
      setDraft(score == null ? "" : String(score));
      setEditing(false);
      return;
    } else {
      const parsed = Number.parseInt(raw, 10);
      if (parsed > 100) {
        showToast(t("candidateDetail.exam.toast.scoreRange"), "error");
        setDraft(score == null ? "" : String(score));
        setEditing(false);
        return;
      }
      nextScore = parsed;
    }

    if (nextScore === (score ?? null)) {
      setEditing(false);
      return;
    }

    const ok = await onSave(nextScore);
    if (ok) {
      setEditing(false);
    } else {
      setDraft(score == null ? "" : String(score));
      setEditing(false);
    }
  };

  return (
    <div className="cand-inline-edit-cell" onClick={(event) => event.stopPropagation()}>
      {editing ? (
        <input
          autoFocus
          className="candidate-exam-score-input"
          inputMode="numeric"
          onBlur={() => void commit()}
          onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, "").slice(0, 3))}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              setDraft(score == null ? "" : String(score));
              setEditing(false);
            }
          }}
          placeholder="—"
          type="text"
          value={draft}
        />
      ) : (
        <button
          className="cand-inline-edit-trigger candidate-exam-score-cell candidate-exam-score-cell--button"
          disabled={disabled}
          onClick={() => setEditing(true)}
          title={disabled ? disabledTitle : t("candidateDetail.exam.scoreEditTooltip")}
          type="button"
        >
          <span>{score ?? "—"}</span>
          {scoreStatus ? (
            <span className={`candidate-exam-pill ${scoreStatus.kind}`}>{t(scoreStatus.labelKey)}</span>
          ) : null}
        </button>
      )}
    </div>
  );
}

function sortExamDateOptionsNewestFirst(options: ExamScheduleOption[]): ExamScheduleOption[] {
  return [...options].sort((left, right) => {
    const dateCompare = right.date.localeCompare(left.date);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return right.time.localeCompare(left.time);
  });
}

function formatBulkExamDateOptionLabel(
  option: ExamScheduleOption,
  showTime = true
): string {
  return showTime && option.time
    ? `${formatDateTR(option.date)} ${option.time}`
    : formatDateTR(option.date);
}

function columnAvailableOnPage(
  column: Pick<CandidateColumnDef, "pageScope">,
  pageScope: CandidateColumnPageScope
): boolean {
  return pageScope === "all" || !column.pageScope || column.pageScope === pageScope;
}

const CANDIDATE_COLUMNS: CandidateColumnDef[] = [
  {
    id: "photo",
    labelKey: "candidates.col.photo",
    headerLabel: "",
    headerClassName: "cand-photo-th",
    cellClassName: "cand-photo-td",
    renderCell: (c) => (
      <CandidateAvatar candidate={c} className="cand-avatar-cell" previewOnClick />
    ),
    skeletonWidth: 36,
  },
  {
    id: "name",
    labelKey: "candidates.col.name",
    sortField: "name",
    renderCell: (c) => (
      <span className="cand-name">
        {c.firstName} {c.lastName}
      </span>
    ),
    skeletonWidth: 140,
  },
  {
    id: "nationalId",
    labelKey: "candidates.col.nationalId",
    sortField: "nationalId",
    renderCell: (c) => <span className="cand-tc">{formatNationalId(c.nationalId)}</span>,
    skeletonWidth: 96,
  },
  {
    id: "motherName",
    labelKey: "candidates.col.motherName",
    renderCell: (c) => formatOptionalText(c.motherName),
    skeletonWidth: 96,
  },
  {
    id: "fatherName",
    labelKey: "candidates.col.fatherName",
    renderCell: (c) => formatOptionalText(c.fatherName),
    skeletonWidth: 96,
  },
  {
    id: "referenceName",
    labelKey: "candidates.col.referenceName",
    renderCell: (c) => formatOptionalText(c.referenceName),
    skeletonWidth: 96,
  },
  {
    id: "phoneNumber",
    labelKey: "candidates.col.phoneNumber",
    renderCell: (c) => formatPhoneDisplay(c.phoneNumber),
    skeletonWidth: 110,
  },
  {
    id: "birthDate",
    labelKey: "candidates.col.birthDate",
    renderCell: (c) => formatDateTR(c.birthDate),
    skeletonWidth: 88,
  },
  {
    id: "gender",
    labelKey: "candidates.col.gender",
    renderCell: (c) => formatOptionalText(candidateGenderLabel(c.gender)),
    skeletonWidth: 72,
  },
  {
    id: "existingLicenseType",
    labelKey: "candidates.col.existingLicenseType",
    renderCell: (c) => formatOptionalText(existingLicenseTypeLabel(c.existingLicenseType)),
    skeletonWidth: 104,
  },
  {
    id: "licenseClass",
    labelKey: "candidates.col.licenseClass",
    sortField: "licenseClass",
    renderCell: (c) => c.licenseClass,
    skeletonWidth: 56,
  },
  {
    id: "group",
    labelKey: "candidates.col.group",
    sortField: "groupSortCode",
    renderCell: (c) => formatGroupWithTerm(c, "tr"),
    skeletonWidth: 110,
  },
  {
    id: "groupStartDate",
    labelKey: "candidates.col.groupStartDate",
    renderCell: (c) => formatDateTR(c.currentGroup?.startDate),
    skeletonWidth: 88,
  },
  {
    id: "eSinavDate",
    pageScope: "eSinav",
    labelKey: "candidates.col.eSinavDate",
    sortField: "eSinavDate",
    renderCell: (c) => formatDateTR(c.mebExamDate),
    skeletonWidth: 88,
  },
  {
    id: "eSinavAttemptCount",
    pageScope: "eSinav",
    labelKey: "candidates.col.eSinavAttemptCount",
    sortField: "examAttemptCount",
    renderCell: (c, pageScope) =>
      pageScope === "eSinav"
        ? <ExamAttemptPill value={c.eSinavAttemptCount} />
        : <CandidateUnifiedExamAttemptPill candidate={c} />,
    skeletonWidth: 104,
  },
  {
    id: "eSinavScore",
    pageScope: "eSinav",
    labelKey: "candidates.col.eSinavScore",
    renderCell: (c) => c.eSinavScore == null ? "—" : String(c.eSinavScore),
    skeletonWidth: 48,
  },
  {
    id: "eSinavTheoryExamFeeStatus",
    pageScope: "eSinav",
    labelKey: "candidates.col.eSinavTheoryExamFeeStatus",
    renderCell: (c) => (
      <CandidateExamFeeStatusPill status={c.eSinavTheoryExamFeeStatus} />
    ),
    skeletonWidth: 118,
  },
  {
    id: "eSinavRightsExpiryDate",
    pageScope: "eSinav",
    labelKey: "candidates.col.eSinavRightsExpiryDate",
    renderCell: (c) => <CandidateESinavRightsExpiryCell candidate={c} />,
    skeletonWidth: 132,
  },
  {
    id: "eSinavPoolStatus",
    labelKey: "candidates.col.eSinavPoolStatus",
    sortField: "examStatus",
    renderCell: (c) => <CandidateUnifiedExamStatusPill candidate={c} />,
    skeletonWidth: 128,
  },
  {
    id: "drivingExamDate",
    pageScope: "uygulama",
    labelKey: "candidates.col.drivingExamDate",
    sortField: "drivingExamDate",
    headerClassName: "cand-driving-exam-date-th",
    cellClassName: "cand-driving-exam-date-td",
    renderCell: (c) => formatDateTR(c.drivingExamDate),
    skeletonWidth: 112,
  },
  {
    id: "drivingExamCode",
    pageScope: "uygulama",
    labelKey: "candidates.col.drivingExamCode",
    headerClassName: "cand-driving-exam-code-th",
    cellClassName: "cand-driving-exam-code-td",
    renderCell: (c) => formatOptionalText(c.drivingExamCode),
    skeletonWidth: 132,
  },
  {
    id: "drivingExamTime",
    pageScope: "uygulama",
    labelKey: "candidates.col.drivingExamTime",
    renderCell: (c) => formatDrivingExamTime(c.drivingExamScheduledAt),
    skeletonWidth: 72,
  },
  {
    id: "drivingExamVehiclePlate",
    pageScope: "uygulama",
    labelKey: "candidates.col.drivingExamVehiclePlate",
    renderCell: (c) => formatOptionalText(c.drivingExamVehiclePlate),
    skeletonWidth: 96,
  },
  {
    id: "drivingExamInstructor",
    pageScope: "uygulama",
    labelKey: "candidates.col.drivingExamInstructor",
    renderCell: (c) => formatOptionalText(c.drivingExamInstructorFullName),
    skeletonWidth: 120,
  },
  {
    id: "drivingExamAttemptCount",
    pageScope: "uygulama",
    labelKey: "candidates.col.drivingExamAttemptCount",
    sortField: "drivingExamAttemptCount",
    renderCell: (c) => (
      <ExamAttemptPill
        value={c.drivingExamAttemptCount}
        maxAttempt={candidateExamAttemptDisplayLimit(c, "practice")}
      />
    ),
    skeletonWidth: 64,
  },
  {
    id: "drivingExamAttendanceStatus",
    pageScope: "uygulama",
    labelKey: "candidates.col.drivingExamAttendanceStatus",
    sortField: "drivingExamAttendanceStatus",
    renderCell: (c) => <DrivingExamAttendancePill status={c.drivingExamAttendanceStatus} />,
    skeletonWidth: 88,
  },
  {
    id: "drivingExamResultStatus",
    pageScope: "uygulama",
    labelKey: "candidates.col.drivingExamResultStatus",
    renderCell: (c) => <DrivingExamResultPill status={c.drivingExamResultStatus} />,
    skeletonWidth: 88,
  },
  {
    id: "drivingExamFeeStatus",
    pageScope: "uygulama",
    labelKey: "candidates.col.drivingExamFeeStatus",
    renderCell: (c) => <CandidateExamFeeStatusPill status={c.drivingExamFeeStatus} />,
    skeletonWidth: 118,
  },
  {
    id: "graduationDate",
    labelKey: "candidates.col.graduationDate",
    renderCell: (c) => formatDateTR(c.graduationDate),
    skeletonWidth: 88,
  },
  {
    id: "terminationReason",
    labelKey: "candidates.col.terminationReason",
    cellClassName: "cand-truncate-td",
    renderCell: (c) => {
      const value = formatOptionalText(c.terminationReason);
      return (
        <span className="cand-truncate" title={value === "—" ? undefined : value}>
          {value}
        </span>
      );
    },
    skeletonWidth: 120,
  },
  {
    id: "terminationDate",
    labelKey: "candidates.col.terminationDate",
    renderCell: (c) => formatDateTR(c.terminationDate),
    skeletonWidth: 88,
  },
  {
    id: "totalFee",
    labelKey: "candidates.col.totalFee",
    sortField: "totalFee",
    headerClassName: "cand-money-th",
    cellClassName: "cand-money-td",
    renderCell: (c) => <span className="cand-money">{formatCurrencyTRY(c.totalFee)}</span>,
    skeletonWidth: 88,
  },
  {
    id: "totalPaid",
    labelKey: "candidates.col.totalPaid",
    sortField: "totalPaid",
    headerClassName: "cand-money-th",
    cellClassName: "cand-money-td",
    renderCell: (c) => <span className="cand-money">{formatCurrencyTRY(c.totalPaid)}</span>,
    skeletonWidth: 88,
  },
  {
    id: "totalDebt",
    labelKey: "candidates.col.totalDebt",
    sortField: "totalDebt",
    headerClassName: "cand-money-th",
    cellClassName: "cand-money-td",
    renderCell: (c) => (
      <span className={`cand-money cand-debt${debtToneClass(c.totalDebt)}`}>
        {formatCurrencyTRY(c.totalDebt)}
      </span>
    ),
    skeletonWidth: 88,
  },
  {
    id: "documents",
    labelKey: "candidates.col.documents",
    renderCell: (c) => (
      <CandidateDocumentBadge
        loadMissingDocumentNames={async (signal) => {
          const result = await getDocumentChecklist({
            status: "missing",
            search: c.nationalId ?? undefined,
            page: 1,
            pageSize: 1,
          }, signal);
          return result.items[0]?.missingDocumentNames ?? [];
        }}
        summary={c.documentSummary}
      />
    ),
    skeletonWidth: 48,
  },
  {
    id: "missingDocuments",
    labelKey: "candidates.col.missingDocuments",
    renderCell: (c) => c.documentSummary?.missingCount ?? 0,
    skeletonWidth: 48,
  },
  {
    id: "mebSyncStatus",
    labelKey: "candidates.col.mebSyncStatus",
    renderCell: (c) => (
      <StatusPill
        label={candidateMebSyncStatusLabel(c.mebSyncStatus)}
        status={candidateMebSyncStatusToPill(c.mebSyncStatus)}
      />
    ),
    skeletonWidth: 72,
  },
  {
    id: "status",
    labelKey: "candidates.col.status",
    sortField: "status",
    renderCell: (c) => (
      <StatusPill
        label={candidateStatusLabel(c.status)}
        status={candidateStatusToPill(c.status)}
      />
    ),
    skeletonWidth: 64,
  },
  {
    id: "createdAtUtc",
    labelKey: "candidates.col.createdAtUtc",
    sortField: "createdAtUtc",
    renderCell: (c) => formatDateTR(c.createdAtUtc),
    skeletonWidth: 88,
  },
  {
    id: "updatedAtUtc",
    labelKey: "candidates.col.updatedAtUtc",
    renderCell: (c) => formatDateTR(c.updatedAtUtc),
    skeletonWidth: 88,
  },
];

const DEFAULT_VISIBLE_CANDIDATE_COLUMN_IDS: CandidateColumnId[] = [
  "photo",
  "name",
  "licenseClass",
  "group",
  "status",
  "documents",
  "mebSyncStatus",
];

const GENERAL_CANDIDATE_COLUMN_PICKER_IDS: CandidateColumnId[] = [
  "photo",
  "name",
  "existingLicenseType",
  "licenseClass",
  "group",
  "status",
  "eSinavAttemptCount",
  "eSinavPoolStatus",
  "totalFee",
  "totalPaid",
  "totalDebt",
  "referenceName",
  "nationalId",
  "phoneNumber",
  "birthDate",
  "motherName",
  "fatherName",
  "gender",
  "createdAtUtc",
  "groupStartDate",
  "graduationDate",
  "terminationDate",
  "terminationReason",
  "updatedAtUtc",
  "documents",
  "mebSyncStatus",
];

const DEFAULT_VISIBLE_CANDIDATE_COLUMN_IDS_BY_TAB: Record<CandidateTab, CandidateColumnId[]> = {
  all: [
    "photo",
    "name",
    "licenseClass",
    "group",
    "status",
    "eSinavAttemptCount",
    "eSinavPoolStatus",
    "totalFee",
    "totalPaid",
    "totalDebt",
    "referenceName",
  ],
  pre_registered: [
    "photo",
    "name",
    "phoneNumber",
    "licenseClass",
    "documents",
    "group",
    "groupStartDate",
    "totalFee",
    "totalPaid",
    "totalDebt",
    "referenceName",
  ],
  active: [
    "photo",
    "name",
    "licenseClass",
    "group",
    "eSinavAttemptCount",
    "eSinavPoolStatus",
    "totalFee",
    "totalPaid",
    "totalDebt",
    "referenceName",
  ],
  parked: [
    "photo",
    "name",
    "licenseClass",
    "group",
    "eSinavAttemptCount",
    "eSinavPoolStatus",
    "totalFee",
    "totalPaid",
    "totalDebt",
    "referenceName",
  ],
  graduated: [
    "photo",
    "name",
    "licenseClass",
    "group",
    "graduationDate",
    "eSinavAttemptCount",
    "eSinavPoolStatus",
    "totalFee",
    "totalPaid",
    "totalDebt",
    "referenceName",
  ],
  dropped: [
    "photo",
    "name",
    "licenseClass",
    "group",
    "terminationReason",
    "terminationDate",
    "eSinavPoolStatus",
    "totalFee",
    "totalPaid",
    "totalDebt",
    "referenceName",
  ],
};

const ESINAV_LOCKED_VISIBLE_COLUMN_IDS_BY_TAB: Record<string, CandidateColumnId[]> = {
  havuz: [
    "photo",
    "name",
    "licenseClass",
    "group",
    "eSinavAttemptCount",
    "eSinavScore",
    "eSinavTheoryExamFeeStatus",
    "eSinavRightsExpiryDate",
  ],
  basarisiz: [
    "photo",
    "name",
    "licenseClass",
    "group",
    "eSinavAttemptCount",
    "eSinavScore",
    "eSinavTheoryExamFeeStatus",
    "eSinavDate",
    "eSinavRightsExpiryDate",
  ],
  randevulu: [
    "photo",
    "name",
    "licenseClass",
    "group",
    "eSinavAttemptCount",
    "eSinavScore",
    "eSinavTheoryExamFeeStatus",
    "eSinavDate",
    "eSinavRightsExpiryDate",
  ],
};

const ESINAV_OPTIONAL_COLUMN_IDS: CandidateColumnId[] = [
  "existingLicenseType",
  "nationalId",
  "phoneNumber",
  "totalFee",
  "totalPaid",
  "totalDebt",
];

const DRIVING_LOCKED_VISIBLE_COLUMN_IDS_BY_TAB: Record<string, CandidateColumnId[]> = {
  havuz: [
    "photo",
    "name",
    "licenseClass",
    "group",
    "drivingExamAttemptCount",
    "drivingExamAttendanceStatus",
    "drivingExamResultStatus",
    "drivingExamFeeStatus",
  ],
  basarisiz: [
    "photo",
    "name",
    "licenseClass",
    "group",
    "drivingExamAttemptCount",
    "drivingExamAttendanceStatus",
    "drivingExamResultStatus",
    "drivingExamFeeStatus",
    "drivingExamDate",
    "drivingExamCode",
  ],
  randevulu: [
    "photo",
    "name",
    "licenseClass",
    "group",
    "drivingExamAttemptCount",
    "drivingExamAttendanceStatus",
    "drivingExamResultStatus",
    "drivingExamFeeStatus",
    "drivingExamTime",
    "drivingExamVehiclePlate",
    "drivingExamInstructor",
    "drivingExamCode",
  ],
};

const DRIVING_OPTIONAL_COLUMN_IDS: CandidateColumnId[] = [
  "existingLicenseType",
  "nationalId",
  "phoneNumber",
  "totalFee",
  "totalPaid",
  "totalDebt",
];

function eSinavLockedVisibleColumnIds(tab: CandidateListTabKey): CandidateColumnId[] {
  return ESINAV_LOCKED_VISIBLE_COLUMN_IDS_BY_TAB[tab] ?? ESINAV_LOCKED_VISIBLE_COLUMN_IDS_BY_TAB.havuz;
}

function drivingLockedVisibleColumnIds(tab: CandidateListTabKey): CandidateColumnId[] {
  return DRIVING_LOCKED_VISIBLE_COLUMN_IDS_BY_TAB[tab] ?? DRIVING_LOCKED_VISIBLE_COLUMN_IDS_BY_TAB.havuz;
}

type ExamDateSidebarConfig = {
  title: string;
  examType: CandidateExamDateType;
  field: "eSinavDate" | "drivingExamDate";
  showTime?: boolean;
  showLicenseClassInHeader?: boolean;
  summaryMode?: "capacity" | "candidateCount" | "licenseClass";
};

type CandidatesPageProps = {
  title?: string;
  columnStorageKey?: string;
  defaultVisibleColumnIds?: CandidateColumnId[];
  columnLabelOverrides?: Partial<Record<CandidateColumnId, string>>;
  showCreateCandidateAction?: boolean;
  showBulkGroupAction?: boolean;
  showBulkStatusAction?: boolean;
  showFiltersAction?: boolean;
  showTabs?: boolean;
  showTabCounts?: boolean;
  defaultTab?: CandidateTab;
  groupColumnMode?: "group" | "term";
  examDateSidebar?: ExamDateSidebarConfig;
  tabConfig?: {
    tabs: { key: CandidateListTabKey; label: string }[];
    defaultTab: CandidateListTabKey;
    buildParams: (tab: CandidateListTabKey) => Partial<GetCandidatesParams>;
  };
};

export function CandidatesPage({
  title,
  columnStorageKey = "candidates.columns.v20",
  defaultVisibleColumnIds: defaultVisibleColumnIdsProp,
  columnLabelOverrides,
  showCreateCandidateAction = true,
  showBulkGroupAction = true,
  showBulkStatusAction = true,
  showFiltersAction = true,
  showTabs = true,
  showTabCounts = false,
  defaultTab = DEFAULT_TAB,
  groupColumnMode = "group",
  examDateSidebar,
  tabConfig,
}: CandidatesPageProps = {}) {
  const t = useT();
  const location = useLocation();
  const { lang } = useLanguage();
  const { user, permissions } = useAuth();
  const canManageCandidates = canManageArea(user, permissions, "candidates");
  const canManageGroups = canManageArea(user, permissions, "groups");
  const canManageMebJobs = canManageArea(user, permissions, "mebjobs");
  const mebbisSessionGuard = useMebbisSessionGuard();
  const noPermissionTitle = t("common.noPermission");
  const { options: licenseClassOptions } = useLicenseClassFilterOptions();
  const columnPageScope: CandidateColumnPageScope =
    examDateSidebar?.field === "eSinavDate"
      ? "eSinav"
      : examDateSidebar?.field === "drivingExamDate"
        ? "uygulama"
        : "all";
  const defaultTabs = useMemo(
    () =>
      TAB_KEYS.map((key) => ({
        key,
        label: candidateListTabLabel(key, t),
      })),
    []
  );
  const resolvedTabConfig = useMemo(
    () =>
      tabConfig ?? {
        tabs: defaultTabs,
        defaultTab,
        buildParams: (tab: CandidateListTabKey): Partial<GetCandidatesParams> => ({
          status: tab === "all" ? undefined : tab,
        }),
      },
    [defaultTab, defaultTabs, tabConfig]
  );

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tab, setTab] = useState<CandidateListTabKey>(resolvedTabConfig.defaultTab);
  const lockedVisibleColumnIds = useMemo<CandidateColumnId[]>(
    () =>
      examDateSidebar?.field === "eSinavDate"
        ? eSinavLockedVisibleColumnIds(tab)
        : examDateSidebar?.field === "drivingExamDate"
          ? drivingLockedVisibleColumnIds(tab)
          : [],
    [examDateSidebar?.field, tab]
  );
  const forcedVisibleColumnIds = useMemo<Set<CandidateColumnId>>(
    () =>
      new Set(
        lockedVisibleColumnIds.filter(
          (id) =>
            !REMOVED_CANDIDATE_COLUMN_IDS.has(id) ||
            (id === "eSinavDate" && columnPageScope === "eSinav") ||
            (id === "drivingExamDate" && columnPageScope === "uygulama") ||
            (id === "drivingExamAttemptCount" && columnPageScope === "uygulama")
        )
      ),
    [columnPageScope, lockedVisibleColumnIds]
  );
  const lockedVisibleColumnOrder = useMemo(() => {
    const order = new Map<CandidateColumnId, number>();
    lockedVisibleColumnIds.forEach((id, index) => order.set(id, index));
    return order;
  }, [lockedVisibleColumnIds]);
  const availableColumnIds = useMemo(
    () => {
      const eSinavAllowedColumnIds =
        columnPageScope === "eSinav"
          ? new Set([...eSinavLockedVisibleColumnIds(tab), ...ESINAV_OPTIONAL_COLUMN_IDS])
          : null;
      const drivingAllowedColumnIds =
        columnPageScope === "uygulama"
          ? new Set([...drivingLockedVisibleColumnIds(tab), ...DRIVING_OPTIONAL_COLUMN_IDS])
          : null;
      const ids = CANDIDATE_COLUMNS.filter((column) => {
        if (!columnAvailableOnPage(column, columnPageScope)) return false;
        if (
          REMOVED_CANDIDATE_COLUMN_IDS.has(column.id) &&
          !(column.id === "eSinavDate" && columnPageScope === "eSinav") &&
          !(column.id === "drivingExamDate" && columnPageScope === "uygulama") &&
          !(column.id === "drivingExamAttemptCount" && columnPageScope === "uygulama")
        ) {
          return false;
        }
        if (eSinavAllowedColumnIds && !eSinavAllowedColumnIds.has(column.id)) return false;
        if (drivingAllowedColumnIds && !drivingAllowedColumnIds.has(column.id)) return false;
        return true;
      }).map((column) => column.id);
      if (eSinavAllowedColumnIds) {
        return [...eSinavLockedVisibleColumnIds(tab), ...ESINAV_OPTIONAL_COLUMN_IDS].filter((id) => ids.includes(id));
      }
      if (drivingAllowedColumnIds) {
        return [...drivingLockedVisibleColumnIds(tab), ...DRIVING_OPTIONAL_COLUMN_IDS].filter((id) => ids.includes(id));
      }
      return ids;
    },
    [columnPageScope, tab]
  );
  const defaultSort = useMemo(
    () => defaultCandidateSortForScope(columnPageScope, tab),
    [columnPageScope, tab]
  );
  const sortStorageKey = useMemo(
    () => [
      "candidates.sort",
      CANDIDATE_SORT_STORAGE_VERSION,
      columnPageScope,
      tab,
      user?.id ? `user.${user.id}` : null,
    ].filter(Boolean).join("."),
    [columnPageScope, tab, user?.id]
  );
  const hasHydratedSortStorage = useRef(false);
  const pendingSortStorageHydrationKey = useRef<string | null>(null);
  const [sort, setSort] = useState<SortState>(() =>
    readCandidateSort(
      [
        "candidates.sort",
        CANDIDATE_SORT_STORAGE_VERSION,
        columnPageScope,
        resolvedTabConfig.defaultTab,
        user?.id ? `user.${user.id}` : null,
      ].filter(Boolean).join("."),
      defaultCandidateSortForScope(columnPageScope, resolvedTabConfig.defaultTab)
    )
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [examScheduleModalOpen, setExamScheduleModalOpen] = useState(false);
  const [examCodeModalOpen, setExamCodeModalOpen] = useState(false);
  const [deletingExamScheduleId, setDeletingExamScheduleId] = useState<string | null>(null);
  const [editingExamScheduleId, setEditingExamScheduleId] = useState<string | null>(null);
  const [deletingExamCodeId, setDeletingExamCodeId] = useState<string | null>(null);
  const [editingExamCodeId, setEditingExamCodeId] = useState<string | null>(null);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [bulkActionMode, setBulkActionMode] = useState<BulkActionMode>(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [bulkStatusValue, setBulkStatusValue] = useState<"" | CandidateStatusValue>("");
  const [bulkTagValues, setBulkTagValues] = useState<string[]>([]);
  const [bulkExamDateValue, setBulkExamDateValue] = useState("");
  const [bulkGroupId, setBulkGroupId] = useState("");
  const [bulkGroupOptions, setBulkGroupOptions] = useState<GroupResponse[]>([]);
  const [bulkGroupLoading, setBulkGroupLoading] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkExporting, setBulkExporting] = useState(false);
  const [examChargePrompt, setExamChargePrompt] = useState<ExamChargePromptState | null>(null);
  const [examChargeModalOpen, setExamChargeModalOpen] = useState(false);
  const [examChargeSaving, setExamChargeSaving] = useState(false);
  const [unscheduledExamChargePrompt, setUnscheduledExamChargePrompt] =
    useState<UnscheduledExamChargePromptState | null>(null);
  const [unscheduledExamChargeLoading, setUnscheduledExamChargeLoading] = useState(false);
  const [unscheduledExamChargeSaving, setUnscheduledExamChargeSaving] = useState(false);
  const isDrivingExamRandevuluTab = examDateSidebar?.examType === "uygulama" && tab === "randevulu";
  const canShowUnscheduledExamChargeAction = !isDrivingExamRandevuluTab;
  const showUnscheduledExamChargePrompt = Boolean(unscheduledExamChargePrompt) && canShowUnscheduledExamChargeAction;
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagDraft, setNewTagDraft] = useState("");
  const newTagInputRef = useRef<HTMLInputElement | null>(null);
  const [filters, setFilters] = useState<CandidateFilterState>(
    EMPTY_CANDIDATE_FILTERS
  );
  const [debouncedFilters, setDebouncedFilters] = useState<CandidateFilterState>(
    EMPTY_CANDIDATE_FILTERS
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = countActiveCandidateFilters(filters);
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedId = searchParams.get("selected");
  const [selectedExamDate, setSelectedExamDate] = useState("");
  const [selectedExamScheduleId, setSelectedExamScheduleId] = useState("");
  const [selectedDrivingExamCode, setSelectedDrivingExamCode] = useState("");
  const [examDateTabNeutral, setExamDateTabNeutral] = useState(false);
  const [examSidebarTab, setExamSidebarTab] = useState<"dates" | "codes">("dates");
  const [editingPracticeCell, setEditingPracticeCell] = useState<{
    candidateId: string;
    field: "time" | "vehicle" | "instructor" | "attendance" | "result";
  } | null>(null);
  const [savingESinavScoreCandidateId, setSavingESinavScoreCandidateId] = useState<string | null>(null);
  const [savingPracticeCandidateId, setSavingPracticeCandidateId] = useState<string | null>(null);
  const [mebbisExamResultSyncRunning, setMebbisExamResultSyncRunning] = useState(false);
  const [draggedColumnId, setDraggedColumnId] = useState<CandidateColumnId | null>(null);

  /* ── React Query — side data (independent of candidate list query) ── */

  const examCodesQuery = useQuery({
    queryKey: ["examCodes", "uygulama"],
    queryFn: ({ signal }) => getExamCodes("uygulama", signal),
    enabled: examDateSidebar?.examType === "uygulama",
  });
  const examCodeOptions: ExamCodeOption[] = examCodesQuery.data ?? [];

  const practiceVehiclesEnabled =
    examDateSidebar?.examType === "uygulama" && !!selectedExamDate;
  const practiceVehiclesQuery = useQuery({
    queryKey: ["vehicles", "list", { activity: "active", page: 1, pageSize: 500 }],
    queryFn: ({ signal }) =>
      getVehicles({ activity: "active", page: 1, pageSize: 500 }, signal),
    enabled: practiceVehiclesEnabled,
  });
  const practiceVehicles: VehicleResponse[] = (practiceVehiclesQuery.data?.items ?? []).filter(isExamVehicle);

  const practiceInstructorsQuery = useQuery({
    queryKey: ["instructors", "list", { activity: "active", page: 1, pageSize: 500 }],
    queryFn: ({ signal }) =>
      getInstructors({ activity: "active", page: 1, pageSize: 500 }, signal),
    enabled: practiceVehiclesEnabled,
  });
  const practiceInstructors: InstructorResponse[] =
    practiceInstructorsQuery.data?.items ?? [];

  const examScheduleOptionsParams = useMemo(
    () =>
      examDateSidebar
        ? {
            examType: examDateSidebar.examType,
          }
        : null,
    [examDateSidebar?.examType]
  );
  const examDateOptionsQuery = useQuery({
    queryKey: ["candidates", "examScheduleOptions", examScheduleOptionsParams],
    queryFn: ({ signal }) => getExamScheduleOptions(examScheduleOptionsParams!, signal),
    enabled: !!examScheduleOptionsParams,
  });
  const examDateOptions: ExamScheduleOption[] = useMemo(
    () => sortExamDateOptionsNewestFirst(examDateOptionsQuery.data ?? []),
    [examDateOptionsQuery.data]
  );
  const examScheduleById = useMemo(
    () => new Map(examDateOptions.map((option) => [option.id, option])),
    [examDateOptions]
  );
  const examDateOptionsLoading = !!examScheduleOptionsParams && examDateOptionsQuery.isFetching;

  // Tag catalog for the filter bar. Tag mutations from within this page do
  // optimistic queryClient.setQueryData updates; cross-page mutations
  // invalidate via candidateKeys.tags() in the use-candidates mutation hooks.
  const allTagsQuery = useCandidateTags("", 200, true);
  const allTags: CandidateTag[] = allTagsQuery.data ?? [];

  // Group catalog for the "Grup" column header filter.
  const headerGroupCatalogQuery = useQuery({
    queryKey: [...groupKeys.lists(), "all-for-candidate-filter"],
    queryFn: ({ signal }) => getAllGroups(undefined, signal),
  });
  const headerGroupCatalog: GroupResponse[] = headerGroupCatalogQuery.data ?? [];

  const defaultVisibleColumnIds = useMemo<CandidateColumnId[]>(() => {
    if (defaultVisibleColumnIdsProp) return defaultVisibleColumnIdsProp;
    if (TAB_KEYS.includes(tab as CandidateTab)) {
      return DEFAULT_VISIBLE_CANDIDATE_COLUMN_IDS_BY_TAB[tab as CandidateTab];
    }
    return DEFAULT_VISIBLE_CANDIDATE_COLUMN_IDS;
  }, [defaultVisibleColumnIdsProp, tab]);
  const scopedDefaultVisibleColumnIds = useMemo(
    () => defaultVisibleColumnIds.filter((id) => availableColumnIds.includes(id)),
    [availableColumnIds, defaultVisibleColumnIds]
  );
  const orderedAvailableColumnIds = useMemo(
    () => [
      ...scopedDefaultVisibleColumnIds,
      ...availableColumnIds.filter((id) => !scopedDefaultVisibleColumnIds.includes(id)),
    ],
    [availableColumnIds, scopedDefaultVisibleColumnIds]
  );
  const sharedColumnStorageKey =
    showTabs && !defaultVisibleColumnIdsProp && TAB_KEYS.includes(tab as CandidateTab)
      ? `${columnStorageKey}.${tab}`
      : columnStorageKey;
  const userColumnStorageKey = user?.id
    ? `${sharedColumnStorageKey}.user.${user.id}`
    : sharedColumnStorageKey;
  const {
    visibleIds,
    isVisible,
    toggle: toggleColumn,
    reset: resetColumns,
    reorder: reorderColumns,
  } = useColumnVisibility(
    userColumnStorageKey,
    orderedAvailableColumnIds,
    defaultVisibleColumnIdsProp
      ? scopedDefaultVisibleColumnIds
      : scopedDefaultVisibleColumnIds.length > 0
        ? scopedDefaultVisibleColumnIds
        : undefined,
    {
      allowEmpty: lockedVisibleColumnIds.length > 0,
      fallbackStorageKey: user?.id ? sharedColumnStorageKey : undefined,
      removeStorageOnReset: Boolean(user?.id),
      deferInitialPersist: Boolean(user?.id),
    }
  );
  const currentTabLabel = useMemo(
    () => resolvedTabConfig.tabs.find((item) => item.key === tab)?.label ?? t("candidates.columns.button"),
    [resolvedTabConfig.tabs, tab, t]
  );

  const licenseClassLabelByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of licenseClassOptions) {
      map.set(option.value, option.label);
    }
    return map;
  }, [licenseClassOptions]);

  const saveESinavScore = async (
    candidate: CandidateResponse,
    nextScore: number | null
  ): Promise<boolean> => {
    if (!canManageCandidates) return false;
    if (!candidate.eSinavAttemptId) {
      showToast("E-sınav kaydı bulunamadı.", "error");
      return false;
    }

    setSavingESinavScoreCandidateId(candidate.id);
    try {
      const attempts = await listCandidateExamAttempts(candidate.id);
      const latestAttempt = attempts.find((attempt) => attempt.id === candidate.eSinavAttemptId);
      if (!latestAttempt) {
        showToast("E-sınav kaydı bulunamadı.", "error");
        return false;
      }

      const updated = await updateCandidateExamAttempt(
        candidate.id,
        latestAttempt.id,
        buildExamAttemptPayload(latestAttempt, latestAttempt.fee, nextScore)
      );
      const nextAttempts = attempts.map((attempt) => attempt.id === updated.id ? updated : attempt);
      const latestTheory = latestExamAttempt(nextAttempts, "theory");
      const nextSummary = {
        mebExamDate: latestTheory?.scheduledAt?.slice(0, 10) ?? null,
        mebExamResult: theoryExamResultFromScore(latestTheory?.score),
        eSinavAttemptCount: latestTheory?.attemptNumber ?? 1,
      };
      const updatedCandidate = await updateCandidate(
        candidate.id,
        buildCandidateUpdatePayload(candidate, nextSummary)
      );

      queryClient.setQueriesData<PagedResponse<CandidateResponse>>(
        { queryKey: candidateKeys.lists() },
        (current) =>
          current
            ? {
                ...current,
                items: current.items.map((item) =>
                  item.id === candidate.id
                    ? {
                        ...item,
                        ...updatedCandidate,
                        mebExamDate: updated.scheduledAt?.slice(0, 10) ?? null,
                        mebExamResult: theoryExamResultFromScore(updated.score),
                        eSinavAttemptCount: updated.attemptNumber,
                        eSinavAttemptId: updated.id,
                        eSinavScore: updated.score ?? null,
                      }
                    : item
                ),
              }
            : current
      );
      void queryClient.invalidateQueries({ queryKey: candidateKeys.lists(), refetchType: "none" });
      void queryClient.invalidateQueries({ queryKey: candidateKeys.detail(candidate.id) });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      showToast(nextScore == null ? "Puan silindi" : `Puan kaydedildi (${nextScore})`);
      return true;
    } catch (error) {
      const message = error instanceof ApiError && error.status === 409
        ? t("candidateDetail.exam.toast.conflictRefresh")
        : "Puan kaydedilemedi.";
      showToast(message, "error");
      return false;
    } finally {
      setSavingESinavScoreCandidateId(null);
    }
  };

  const savePracticeAttemptField = async (
    candidate: CandidateResponse,
    patch: {
      time?: string;
      vehicleId?: string;
      instructorId?: string;
      attendanceStatus?: CandidateResponse["drivingExamAttendanceStatus"];
      resultStatus?: CandidateResponse["drivingExamResultStatus"];
    }
  ) => {
    if (!canManageCandidates) return;
    if (!candidate.drivingExamAttemptId) {
      showToast(t("candidates.toast.appointmentNotFound"), "error");
      return;
    }

    const vehicle = patch.vehicleId !== undefined
      ? practiceVehicles.find((item) => item.id === patch.vehicleId)
      : undefined;
    const instructor = patch.instructorId !== undefined
      ? practiceInstructors.find((item) => item.id === patch.instructorId)
      : undefined;
    const scheduledAt = patch.time
      ? drivingExamDateTimeIso(candidate.drivingExamDate, patch.time)
      : candidate.drivingExamScheduledAt;
    if (patch.time && !scheduledAt) {
      showToast(t("candidates.toast.examTimeUpdateFailed"), "error");
      return;
    }

    setSavingPracticeCandidateId(candidate.id);
    try {
      const attempts = await listCandidateExamAttempts(candidate.id);
      const latestAttempt = attempts.find((attempt) => attempt.id === candidate.drivingExamAttemptId);
      if (!latestAttempt) {
        showToast(t("candidates.toast.appointmentNotFound"), "error");
        return;
      }
      const nextScheduledAt = patch.time ? scheduledAt ?? latestAttempt.scheduledAt : latestAttempt.scheduledAt;
      if (!nextScheduledAt) {
        showToast(t("candidates.toast.examTimeUpdateFailed"), "error");
        return;
      }
      const nextAttendanceStatus = patch.attendanceStatus !== undefined
        ? patch.attendanceStatus
        : latestAttempt.examAttendanceStatus;
      const nextResultStatus = patch.resultStatus !== undefined
        ? patch.resultStatus
        : latestAttempt.examResultStatus;
      const updated = await updateCandidateExamAttempt(candidate.id, candidate.drivingExamAttemptId, {
        examType: "practice",
        scheduledAt: nextScheduledAt,
        attemptNumber: latestAttempt.attemptNumber,
        score: null,
        expiresAt: latestAttempt.expiresAt,
        examScheduleId: latestAttempt.examScheduleId ?? candidate.drivingExamScheduleId ?? null,
        vehicleId: patch.vehicleId !== undefined ? patch.vehicleId || null : candidate.drivingExamVehicleId ?? null,
        vehiclePlate: patch.vehicleId !== undefined ? vehicleDisplayName(vehicle) : candidate.drivingExamVehiclePlate ?? null,
        instructorId: patch.instructorId !== undefined ? patch.instructorId || null : candidate.drivingExamInstructorId ?? null,
        instructorFullName: patch.instructorId !== undefined
          ? instructor ? instructorFullName(instructor) : null
          : candidate.drivingExamInstructorFullName ?? null,
        examAttendanceStatus: nextAttendanceStatus,
        examResultStatus: nextAttendanceStatus === "attended" ? nextResultStatus : null,
        fee: latestAttempt.fee,
        feeStatus: latestAttempt.feeStatus,
        rowVersion: latestAttempt.rowVersion,
      });

      queryClient.setQueriesData<PagedResponse<CandidateResponse>>(
        { queryKey: candidateKeys.lists() },
        (current) =>
          current
            ? {
                ...current,
                items: current.items.map((item) =>
                  item.id === candidate.id
                    ? {
                        ...item,
                        drivingExamScheduledAt: updated.scheduledAt,
                        drivingExamDate: item.drivingExamDate,
                        drivingExamVehicleId: updated.vehicleId,
                        drivingExamVehiclePlate: updated.vehiclePlate,
                        drivingExamInstructorId: updated.instructorId,
                        drivingExamInstructorFullName: updated.instructorFullName,
                        drivingExamAttendanceStatus: updated.examAttendanceStatus,
                        drivingExamResultStatus: updated.examResultStatus,
                        hasReportedPracticeAttempt:
                          item.hasReportedPracticeAttempt || isReportedAttendanceStatus(updated.examAttendanceStatus),
                        drivingExamFee: updated.fee,
                        drivingExamFeeStatus: updated.feeStatus,
                        drivingExamAttemptRowVersion: updated.rowVersion,
                      }
                    : item
                ),
              }
            : current
      );
      void queryClient.invalidateQueries({ queryKey: candidateKeys.lists(), refetchType: "none" });
      void queryClient.invalidateQueries({ queryKey: candidateKeys.detail(candidate.id) });
      void queryClient.invalidateQueries({ queryKey: [...candidateKeys.all, "examScheduleOptions"] });
      void queryClient.invalidateQueries({ queryKey: ["training", "lessons"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setEditingPracticeCell(null);
      showToast(t("candidates.toast.appointmentUpdated"));
    } catch (error) {
      const message = error instanceof ApiError && error.status === 409
        ? t("candidates.toast.conflictRefresh")
        : t("candidates.toast.appointmentUpdateFailed");
      showToast(message, "error");
    } finally {
      setSavingPracticeCandidateId(null);
    }
  };

  const resolvedColumns = useMemo(
    () =>
      CANDIDATE_COLUMNS.filter((column) =>
        columnAvailableOnPage(column, columnPageScope) && availableColumnIds.includes(column.id)
      ).map((col) => {
        if (col.id === "group") {
          return {
            ...col,
            renderCell: (candidate: CandidateResponse) =>
              groupColumnMode === "term"
                ? formatCandidateTerm(candidate, lang)
                : formatGroupWithTerm(candidate, lang),
          };
        }
        if (col.id === "licenseClass") {
          return {
            ...col,
            renderCell: (candidate: CandidateResponse) =>
              licenseClassLabelByCode.get(candidate.licenseClass) ?? candidate.licenseClass,
          };
        }
        if (columnPageScope === "eSinav" && col.id === "eSinavDate") {
          return {
            ...col,
            renderCell: (candidate: CandidateResponse) =>
              tab === "randevulu"
                ? <CandidateDateWithRemaining date={candidate.mebExamDate} />
                : formatDateTR(candidate.mebExamDate),
          };
        }
        if (columnPageScope === "eSinav" && col.id === "eSinavScore") {
          return {
            ...col,
            renderCell: (candidate: CandidateResponse) => (
              <EditableESinavScoreCell
                disabled={
                  savingESinavScoreCandidateId === candidate.id ||
                  !canManageCandidates ||
                  !candidate.eSinavAttemptId
                }
                disabledTitle={
                  !canManageCandidates
                    ? noPermissionTitle
                    : !candidate.eSinavAttemptId
                      ? "E-sınav kaydı bulunamadı"
                      : undefined
                }
                onSave={(nextScore) => saveESinavScore(candidate, nextScore)}
                score={candidate.eSinavScore}
              />
            ),
          };
        }
        if (columnPageScope === "uygulama" && col.id === "drivingExamTime") {
          return {
            ...col,
            renderCell: (candidate: CandidateResponse) => (
              <DrivingExamTimeCell
                candidate={candidate}
                editing={editingPracticeCell?.candidateId === candidate.id && editingPracticeCell.field === "time"}
                disabled={savingPracticeCandidateId === candidate.id || !canManageCandidates}
                disabledTitle={
                  savingPracticeCandidateId === candidate.id
                    ? t("common.saving")
                    : !canManageCandidates
                      ? noPermissionTitle
                      : undefined
                }
                onEdit={() => setEditingPracticeCell({ candidateId: candidate.id, field: "time" })}
                onCancel={() => setEditingPracticeCell(null)}
                onSave={(time) => savePracticeAttemptField(candidate, { time })}
              />
            ),
          };
        }
        if (columnPageScope === "uygulama" && col.id === "drivingExamCode") {
          return {
            ...col,
            renderCell: (candidate: CandidateResponse) =>
              formatDrivingExamCodeWithCapacity(candidate, examScheduleById),
          };
        }
        if (columnPageScope === "uygulama" && col.id === "drivingExamAttendanceStatus") {
          return {
            ...col,
            renderCell: (candidate: CandidateResponse) => (
              <DrivingExamSelectCell
                value={candidate.drivingExamAttendanceStatus ?? ""}
                label={
                  <StatusPill
                    label={drivingExamAttendanceLabel(candidate.drivingExamAttendanceStatus)}
                    status={drivingExamAttendancePill(candidate.drivingExamAttendanceStatus)}
                  />
                }
                options={[
                  { value: "attended", label: "Girdi" },
                  { value: "absent", label: "Girmedi" },
                  { value: "reported", label: "Raporlu" },
                ]}
                editing={editingPracticeCell?.candidateId === candidate.id && editingPracticeCell.field === "attendance"}
                disabled={
                  savingPracticeCandidateId === candidate.id ||
                  !canManageCandidates ||
                  !candidate.drivingExamAttemptId
                }
                disabledTitle={
                  savingPracticeCandidateId === candidate.id
                    ? t("common.saving")
                    : !canManageCandidates
                      ? noPermissionTitle
                      : undefined
                }
                ariaLabel={t("candidateDetail.exam.aria.examStatus")}
                onEdit={() => setEditingPracticeCell({ candidateId: candidate.id, field: "attendance" })}
                onCancel={() => setEditingPracticeCell(null)}
                onSave={(value) =>
                  savePracticeAttemptField(candidate, {
                    attendanceStatus: (value || null) as CandidateResponse["drivingExamAttendanceStatus"],
                  })
                }
              />
            ),
          };
        }
        if (columnPageScope === "uygulama" && col.id === "drivingExamResultStatus") {
          return {
            ...col,
            renderCell: (candidate: CandidateResponse) => (
              <DrivingExamSelectCell
                value={candidate.drivingExamResultStatus ?? ""}
                label={
                  <StatusPill
                    label={drivingExamResultLabel(candidate.drivingExamResultStatus, t)}
                    status={drivingExamResultPill(candidate.drivingExamResultStatus)}
                  />
                }
                options={[
                  { value: "passed", label: t("candidateDetail.exam.passed") },
                  { value: "failed", label: t("candidateDetail.exam.failed") },
                ]}
                editing={editingPracticeCell?.candidateId === candidate.id && editingPracticeCell.field === "result"}
                disabled={
                  savingPracticeCandidateId === candidate.id ||
                  !canManageCandidates ||
                  !candidate.drivingExamAttemptId ||
                  candidate.drivingExamAttendanceStatus !== "attended"
                }
                disabledTitle={
                  savingPracticeCandidateId === candidate.id
                    ? t("common.saving")
                    : !canManageCandidates
                      ? noPermissionTitle
                      : undefined
                }
                ariaLabel={t("candidateDetail.exam.aria.examResult")}
                onEdit={() => setEditingPracticeCell({ candidateId: candidate.id, field: "result" })}
                onCancel={() => setEditingPracticeCell(null)}
                onSave={(value) =>
                  savePracticeAttemptField(candidate, {
                    resultStatus: (value || null) as CandidateResponse["drivingExamResultStatus"],
                  })
                }
              />
            ),
          };
        }
        if (columnPageScope === "uygulama" && col.id === "drivingExamVehiclePlate") {
          return {
            ...col,
            renderCell: (candidate: CandidateResponse) => (
              <DrivingExamSelectCell
                value={candidate.drivingExamVehicleId ?? ""}
                label={candidate.drivingExamVehiclePlate ?? "—"}
                options={practiceVehicles.map((vehicle) => ({
                  value: vehicle.id,
                  label: vehicleDisplayName(vehicle) ?? "—",
                }))}
                editing={editingPracticeCell?.candidateId === candidate.id && editingPracticeCell.field === "vehicle"}
                disabled={savingPracticeCandidateId === candidate.id || !canManageCandidates}
                disabledTitle={
                  savingPracticeCandidateId === candidate.id
                    ? t("common.saving")
                    : !canManageCandidates
                      ? noPermissionTitle
                      : undefined
                }
                ariaLabel={t("candidates.aria.plate")}
                onEdit={() => setEditingPracticeCell({ candidateId: candidate.id, field: "vehicle" })}
                onCancel={() => setEditingPracticeCell(null)}
                onSave={(vehicleId) => savePracticeAttemptField(candidate, { vehicleId })}
              />
            ),
          };
        }
        if (columnPageScope === "uygulama" && col.id === "drivingExamInstructor") {
          return {
            ...col,
            renderCell: (candidate: CandidateResponse) => (
              <DrivingExamSelectCell
                value={candidate.drivingExamInstructorId ?? ""}
                label={candidate.drivingExamInstructorFullName ?? "—"}
                options={practiceInstructors.map((instructor) => ({
                  value: instructor.id,
                  label: instructorFullName(instructor),
                }))}
                editing={editingPracticeCell?.candidateId === candidate.id && editingPracticeCell.field === "instructor"}
                disabled={savingPracticeCandidateId === candidate.id || !canManageCandidates}
                disabledTitle={
                  savingPracticeCandidateId === candidate.id
                    ? t("common.saving")
                    : !canManageCandidates
                      ? noPermissionTitle
                      : undefined
                }
                ariaLabel={t("candidates.aria.instructor")}
                onEdit={() => setEditingPracticeCell({ candidateId: candidate.id, field: "instructor" })}
                onCancel={() => setEditingPracticeCell(null)}
                onSave={(instructorId) => savePracticeAttemptField(candidate, { instructorId })}
              />
            ),
          };
        }
        return col;
      }),
    [
      availableColumnIds,
      columnPageScope,
      editingPracticeCell,
      examScheduleById,
      groupColumnMode,
      lang,
      licenseClassLabelByCode,
      noPermissionTitle,
      practiceInstructors,
      practiceVehicles,
      saveESinavScore,
      savePracticeAttemptField,
      savingESinavScoreCandidateId,
      savingPracticeCandidateId,
      tab,
      t,
    ]
  );
  const visibleColumnOrder = useMemo(() => {
    const order = new Map<CandidateColumnId, number>();
    visibleIds.forEach((id, index) => {
      order.set(id as CandidateColumnId, index);
    });
    return order;
  }, [visibleIds]);
  const visibleColumns = resolvedColumns.filter(
    (col) => forcedVisibleColumnIds.has(col.id) || isVisible(col.id)
  ).sort(
    (left, right) => {
      const leftLockedOrder = lockedVisibleColumnOrder.get(left.id);
      const rightLockedOrder = lockedVisibleColumnOrder.get(right.id);
      if (leftLockedOrder !== undefined && rightLockedOrder !== undefined) {
        return leftLockedOrder - rightLockedOrder;
      }
      if (leftLockedOrder !== undefined) return -1;
      if (rightLockedOrder !== undefined) return 1;
      return (
        (visibleColumnOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (visibleColumnOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER)
      );
    }
  );
  const getColumnLabel = (col: CandidateColumnDef) =>
    (columnPageScope === "eSinav" && col.id === "eSinavDate"
      ? tab === "basarisiz"
        ? t("candidatesPage.col.lastExamDate")
        : tab === "randevulu"
          ? t("candidatesPage.col.scheduledExamDate")
          : t(col.labelKey)
      : columnPageScope === "eSinav" && col.id === "eSinavTheoryExamFeeStatus"
        ? t("candidates.col.examFeeStatus")
      : columnPageScope === "uygulama" && col.id === "drivingExamDate" && tab === "basarisiz"
        ? t("candidatesPage.col.lastExamDate")
      : columnPageScope === "uygulama" && col.id === "drivingExamCode"
        ? t("candidatesPage.col.lastExamCode")
      : columnPageScope === "uygulama" && col.id === "drivingExamFeeStatus"
        ? t("candidates.col.examFeeStatus")
        : null) ??
    columnLabelOverrides?.[col.id] ??
    ((col.id === "group" && groupColumnMode === "term")
      ? t("candidates.col.term")
      : t(col.labelKey));
  const isColumnReorderable = (id: CandidateColumnId) => !forcedVisibleColumnIds.has(id);
  const startColumnDrag = (event: DragEvent<HTMLTableCellElement>, id: CandidateColumnId) => {
    if (!isColumnReorderable(id)) {
      event.preventDefault();
      return;
    }
    setDraggedColumnId(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(COLUMN_DRAG_MIME_TYPE, id);
  };
  const dragOverColumn = (event: DragEvent<HTMLTableCellElement>, id: CandidateColumnId) => {
    if (!draggedColumnId || draggedColumnId === id || !isColumnReorderable(id)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };
  const dropColumn = (event: DragEvent<HTMLTableCellElement>, id: CandidateColumnId) => {
    const sourceId = event.dataTransfer.getData(COLUMN_DRAG_MIME_TYPE) as CandidateColumnId;
    if (!sourceId || sourceId === id || !isColumnReorderable(sourceId) || !isColumnReorderable(id)) {
      setDraggedColumnId(null);
      return;
    }
    event.preventDefault();
    reorderColumns(sourceId, id);
    setDraggedColumnId(null);
  };
  const endColumnDrag = () => setDraggedColumnId(null);
  const columnDragHandlers = (id: CandidateColumnId) => ({
    draggable: isColumnReorderable(id),
    onDragStart: (event: DragEvent<HTMLTableCellElement>) => startColumnDrag(event, id),
    onDragOver: (event: DragEvent<HTMLTableCellElement>) => dragOverColumn(event, id),
    onDrop: (event: DragEvent<HTMLTableCellElement>) => dropColumn(event, id),
    onDragEnd: endColumnDrag,
  });
  const visibleBulkStatusOptions = useMemo(
    () => BULK_STATUS_OPTIONS,
    []
  );
  const headerPeriodGroupOptions = useMemo(() => {
    const terms = Array.from(
      new Map(headerGroupCatalog.map((group) => [group.term.id, group.term])).values()
    ).sort(compareTermsDesc);
    return headerGroupCatalog
      .map((group) => ({
        group,
        parts: resolveGroupCodeParts({
          groupNumber: group.groupNumber,
          groupBranch: group.groupBranch,
          title: group.title,
        }),
      }))
      .filter(
        (value): value is { group: GroupResponse; parts: GroupCodeParts } =>
          value.parts !== null
      )
      .sort((a, b) => {
        const sortCodeCompare =
          getGroupOptionSortCode(b.group, b.parts) - getGroupOptionSortCode(a.group, a.parts);
        if (sortCodeCompare !== 0) return sortCodeCompare;
        const termCompare = compareTermsDesc(a.group.term, b.group.term);
        if (termCompare !== 0) return termCompare;
        return buildGroupCode(a.parts.groupNumber, a.parts.groupBranch).localeCompare(
          buildGroupCode(b.parts.groupNumber, b.parts.groupBranch),
          lang
        );
      })
      .map(({ group, parts }) => ({
        value: termGroupGroupFilterValue(group.id),
        label: `${buildTermLabel(group.term, terms, lang)} - ${buildGroupCode(
          parts.groupNumber,
          parts.groupBranch
        )}`,
      }));
  }, [headerGroupCatalog, lang]);

  const pickerOptions: ColumnOption[] = resolvedColumns
    .filter((col) => {
      if (col.pickerHidden || forcedVisibleColumnIds.has(col.id)) return false;
      if (columnPageScope !== "all") return true;
      return GENERAL_CANDIDATE_COLUMN_PICKER_IDS.includes(col.id);
    })
    .sort((left, right) => {
      if (columnPageScope === "all") {
        return (
          GENERAL_CANDIDATE_COLUMN_PICKER_IDS.indexOf(left.id) -
          GENERAL_CANDIDATE_COLUMN_PICKER_IDS.indexOf(right.id)
        );
      }
      return availableColumnIds.indexOf(left.id) - availableColumnIds.indexOf(right.id);
    })
    .map((col) => ({
      id: col.id,
      label: getColumnLabel(col),
    }));
  const selectedCount = selectedCandidateIds.size;
  const selectionColumnVisible = true;
  const isDrivingExamCodeTabActive =
    examDateSidebar?.examType === "uygulama" && examSidebarTab === "codes";
  const shouldDimBlockedLatestCodeRows =
    examDateSidebar?.examType === "uygulama" &&
    !selectedExamDate &&
    !selectedDrivingExamCode &&
    activeTags.length === 0 &&
    activeFilterCount === 0 &&
    !normalizeTextQuery(search);
  const examDateFilterParams = useMemo<Partial<GetCandidatesParams>>(() => {
    if (isDrivingExamCodeTabActive && selectedDrivingExamCode) {
      return { drivingExamCode: selectedDrivingExamCode };
    }
    if (isDrivingExamCodeTabActive || !examDateSidebar || !selectedExamDate) {
      return {};
    }

    return examDateSidebar.field === "eSinavDate"
      ? {
          eSinavDate: selectedExamDate,
          eSinavScheduleId: selectedExamScheduleId || undefined,
        }
      : {
          drivingExamDate: selectedExamDate,
          drivingExamScheduleId: selectedExamScheduleId || undefined,
        };
  }, [
    examDateSidebar,
    isDrivingExamCodeTabActive,
    selectedDrivingExamCode,
    selectedExamDate,
    selectedExamScheduleId,
  ]);
  const displayedExamDateOptions = useMemo(
    () => sortExamDateOptionsNewestFirst(examDateOptions),
    [examDateOptions]
  );
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, TEXT_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [search]);

  // Debounce the full filter object: text inputs (firstName, nationalId, ...)
  // trigger this at every keystroke, so we coalesce them before kicking off a
  // backend fetch. Tri-state selects and date pickers pay the same 300 ms tax
  // but that's imperceptible for discrete controls.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedFilters(filters);
    }, TEXT_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    setTab(resolvedTabConfig.defaultTab);
  }, [resolvedTabConfig.defaultTab]);

  useEffect(() => {
    if (hasHydratedSortStorage.current) {
      pendingSortStorageHydrationKey.current = sortStorageKey;
    } else {
      hasHydratedSortStorage.current = true;
    }
    setSort(readCandidateSort(sortStorageKey, defaultSort));
  }, [defaultSort, sortStorageKey]);

  useEffect(() => {
    if (pendingSortStorageHydrationKey.current === sortStorageKey) {
      pendingSortStorageHydrationKey.current = null;
      return;
    }
    writeCandidateSort(sortStorageKey, sort);
  }, [sort, sortStorageKey]);

  useEffect(() => {
    setSelectedExamDate("");
    setSelectedExamScheduleId("");
    setSelectedDrivingExamCode("");
    setExamDateTabNeutral(false);
    setExamSidebarTab("dates");
  }, [examDateSidebar?.field]);

  const candidatesRequestParams = useMemo<GetCandidatesParams>(() => {
    const builtTabParams = resolvedTabConfig.buildParams(tab);
    const tabParams = isDrivingExamCodeTabActive
      ? {}
      : examDateTabNeutral
        ? omitExamTabFilter(builtTabParams)
        : builtTabParams;
    const {
      hasPhoto: _hasPhoto,
      hasMissingDocuments: _hasMissingDocuments,
      missingDocumentCountMin: _missingDocumentCountMin,
      missingDocumentCountMax: _missingDocumentCountMax,
      ...candidateFilterParams
    } = filtersToQuery(debouncedFilters);
    return {
      search: normalizeTextQuery(debouncedSearch),
      ...tabParams,
      tags: activeTags.length > 0 ? activeTags : undefined,
      ...candidateFilterParams,
      ...examDateFilterParams,
      sortBy: sort?.field,
      sortDir: sort?.direction,
      page,
      pageSize,
    };
  }, [
    activeTags,
    debouncedFilters,
    debouncedSearch,
    examDateTabNeutral,
    examDateFilterParams,
    isDrivingExamCodeTabActive,
    page,
    pageSize,
    resolvedTabConfig,
    sort,
    tab,
  ]);

  const tabCountBaseRequestParams = useMemo<GetCandidatesParams>(() => {
    const {
      hasPhoto: _hasPhoto,
      hasMissingDocuments: _hasMissingDocuments,
      missingDocumentCountMin: _missingDocumentCountMin,
      missingDocumentCountMax: _missingDocumentCountMax,
      ...candidateFilterParams
    } = filtersToQuery(debouncedFilters);
    return {
      search: normalizeTextQuery(debouncedSearch),
      tags: activeTags.length > 0 ? activeTags : undefined,
      ...candidateFilterParams,
      page: 1,
      pageSize: 1,
    };
  }, [
    activeTags,
    debouncedFilters,
    debouncedSearch,
  ]);

  const candidatesQuery = useCandidates(candidatesRequestParams, true);
  const tabCountsQuery = useQuery({
    queryKey: [
      "candidate-tab-counts",
      columnStorageKey,
      resolvedTabConfig.tabs.map((item) => item.key),
      tabCountBaseRequestParams,
    ],
    enabled: showTabCounts && showTabs && !isDrivingExamCodeTabActive,
    queryFn: async ({ signal }) => {
      const entries = await Promise.all(
        resolvedTabConfig.tabs.map(async (tabOption) => {
          const response = await getCandidates(
            {
              ...tabCountBaseRequestParams,
              ...resolvedTabConfig.buildParams(tabOption.key),
              page: 1,
              pageSize: 1,
            },
            signal
          );
          return [tabOption.key, response.totalCount ?? response.items.length] as const;
        })
      );

      return Object.fromEntries(entries) as Record<CandidateListTabKey, number>;
    },
  });
  const candidates = candidatesQuery.data?.items ?? [];
  const totalPages =
    candidatesQuery.data?.totalPages ??
    Math.max(1, Math.ceil((candidatesQuery.data?.totalCount ?? 0) / (candidatesQuery.data?.pageSize || pageSize)));
  const loading = candidatesQuery.isLoading;
  const tabsWithCounts = useMemo(
    () =>
      resolvedTabConfig.tabs.map((tabOption) => ({
        ...tabOption,
        count: tabCountsQuery.data?.[tabOption.key],
      })),
    [resolvedTabConfig.tabs, tabCountsQuery.data]
  );
  const compactLicenseClassOptions = useMemo(
    () =>
      mergeLicenseClassOptionsWithValues(licenseClassOptions, [
        ...filters.licenseClasses,
        ...candidates.map((candidate) => candidate.licenseClass),
      ]).map((option) => ({
        value: option.value,
        label: option.value,
      })),
    [candidates, filters.licenseClasses, licenseClassOptions]
  );
  const getColumnFilterControl = (col: CandidateColumnDef) =>
    buildCandidateColumnFilterControl(
      col.id,
      filters,
      handleFilterChange,
      compactLicenseClassOptions,
      headerPeriodGroupOptions,
      t,
      getColumnLabel(col),
      columnPageScope
    );
  useEffect(() => {
    if (candidatesQuery.isError && !isAbortError(candidatesQuery.error)) {
      showToast(t("candidates.toast.loadFailed"), "error");
    }
  }, [candidatesQuery.error, candidatesQuery.isError, showToast, t]);

  const invalidateCandidates = () => {
    void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const refreshAll = () => {
    invalidateCandidates();
    void queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.tags("") });
    void queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: ["examCodes"] });
    void queryClient.invalidateQueries({ queryKey: [...candidateKeys.all, "examScheduleOptions"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
  };
  const allVisibleSelected =
    candidates.length > 0 && candidates.every((candidate) => selectedCandidateIds.has(candidate.id));

  // If any of the active filter tags disappear (deleted or renamed elsewhere),
  // drop them so the candidate list is not stuck filtered-to-nothing.
  useEffect(() => {
    if (activeTags.length === 0) return;
    const known = new Set(allTags.map((tag) => tag.name));
    const filtered = activeTags.filter((name) => known.has(name));
    if (filtered.length !== activeTags.length) {
      setActiveTags(filtered);
    }
  }, [activeTags, allTags]);

  useEffect(() => {
    if (!examDateSidebar || !selectedExamDate || examDateOptionsLoading) {
      return;
    }

    const selectedOptionStillExists = selectedExamScheduleId
      ? displayedExamDateOptions.some((option) => option.id === selectedExamScheduleId)
      : displayedExamDateOptions.some((option) => option.date === selectedExamDate);
    if (!selectedOptionStillExists) {
      setSelectedExamDate("");
      setSelectedExamScheduleId("");
    }
  }, [
    displayedExamDateOptions,
    examDateOptionsLoading,
    examDateSidebar,
    selectedExamDate,
    selectedExamScheduleId,
  ]);

  useEffect(() => {
    if (!selectedDrivingExamCode) return;
    if (!examCodeOptions.some((option) => option.code === selectedDrivingExamCode)) {
      setSelectedDrivingExamCode("");
    }
  }, [examCodeOptions, selectedDrivingExamCode]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleExamDateAddClick = () => {
    if (!canManageGroups) return;
    setExamScheduleModalOpen(true);
  };

  const handleExamCodeAddClick = () => {
    if (!canManageGroups) return;
    setExamCodeModalOpen(true);
  };

  const handleExamDateDelete = async (option: ExamScheduleOption) => {
    if (!canManageGroups) return;
    if (deletingExamScheduleId) {
      return;
    }

    setDeletingExamScheduleId(option.id);
    try {
      await deleteExamSchedule(option.id);
      if (selectedExamScheduleId === option.id) {
        setSelectedExamDate("");
        setSelectedExamScheduleId("");
      }
      refreshAll();
      showToast(t("candidates.toast.examScheduleDeleted"));
    } catch (error) {
      const errorCode = error instanceof ApiError ? error.errorCode : undefined;
      const message = errorCode === "examScheduleDatePassed"
        ? t("candidates.toast.examScheduleDeletePastDate")
        : errorCode === "examScheduleHasCandidates"
          ? t("candidates.toast.examScheduleDeleteHasCandidates")
          : t("candidates.toast.examScheduleDeleteFailed");
      showToast(message, "error");
    } finally {
      setDeletingExamScheduleId(null);
    }
  };

  const examScheduleMutationErrorMessage = (error: unknown, fallback: string) => {
    if (!(error instanceof ApiError)) {
      return fallback;
    }

    const firstValidationMessage = Object.values(error.validationErrors ?? {})[0]?.[0];
    if (firstValidationMessage) {
      return firstValidationMessage;
    }

    const errorCode = error.errorCode;
    if (errorCode === "examScheduleDatePassed") {
      return t("candidates.toast.examScheduleDeletePastDate");
    }
    if (errorCode === "examScheduleHasCandidates") {
      return t("candidates.toast.examScheduleDeleteHasCandidates");
    }
    return fallback;
  };

  const handleExamDateEdit = async (
    option: ExamScheduleOption,
    date: string,
    time?: string,
    capacity?: number
  ) => {
    if (!canManageGroups) return;
    if (editingExamScheduleId) {
      return;
    }

    setEditingExamScheduleId(option.id);
    try {
      await updateExamSchedule(option.id, {
        examType: option.examType,
        date,
        examCodeId: option.examCodeId ?? null,
        time: option.examType === "e_sinav" ? (time ?? option.time) : undefined,
        capacity: capacity ?? option.capacity,
      });
      if (selectedExamScheduleId === option.id) {
        setSelectedExamDate(date);
      }
      refreshAll();
      showToast(t("candidates.toast.examDateUpdated"));
    } catch (error) {
      showToast(examScheduleMutationErrorMessage(error, t("candidates.toast.examDateUpdateFailed")), "error");
    } finally {
      setEditingExamScheduleId(null);
    }
  };

  const handleSelectedExamDateMebbisResultSync = async () => {
    if (!canManageMebJobs || mebbisExamResultSyncRunning) return;
    if (!examDateSidebar || !["eSinavDate", "drivingExamDate"].includes(examDateSidebar.field) || !selectedExamDate) {
      showToast("Önce bir sınav tarihi seçmelisin.", "error");
      return;
    }
    if (!(await mebbisSessionGuard.ensureSessionAsync())) return;

    setMebbisExamResultSyncRunning(true);
    try {
      const selectedExamSchedule = displayedExamDateOptions.find((option) => option.id === selectedExamScheduleId);
      const isDrivingExam = examDateSidebar.field === "drivingExamDate";
      const job = isDrivingExam
        ? await createDrivingExamResultSyncJob(selectedExamDate)
        : await createESinavExamResultSyncJob(selectedExamDate, selectedExamSchedule?.time);
      window.dispatchEvent(new CustomEvent("pilot:mebbis-job-queued", {
        detail: { jobId: job.id, jobType: job.jobType }
      }));

      void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "queue", "status"] });
      const examLabel = isDrivingExam ? "direksiyon" : "e-sınav";
      showToast(`${formatDateTR(selectedExamDate)} ${examLabel} sonuç sorgulama işi kuyruğa alındı.`);
      const startedAt = Date.now();
      while (Date.now() - startedAt < MEBBIS_EXAM_RESULT_POLL_TIMEOUT_MS) {
        await delay(MEBBIS_EXAM_RESULT_POLL_INTERVAL_MS);
        const latestJob = await getMebbisJob(job.id);
        if (latestJob.status === "succeeded") {
          for (const refreshDelay of MEBBIS_EXAM_RESULT_REFRESH_DELAYS_MS) {
            window.setTimeout(() => {
              void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
              void queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
              void queryClient.invalidateQueries({ queryKey: [...candidateKeys.all, "examScheduleOptions"] });
              void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
              void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "queue", "status"] });
              void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
              void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
            }, refreshDelay);
          }
          showToast(`${formatDateTR(selectedExamDate)} ${examLabel} sonuçları güncellendi.`);
          return;
        }
        if (["failed", "needs_manual_action", "cancelled"].includes(latestJob.status)) {
          void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
          void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "queue", "status"] });
          const terminalMessage = latestJob.errorMessage || `MEBBİS ${examLabel} sonucu sorgulama manuel kontrol gerektiriyor.`;
          showToast(terminalMessage, "error");
          return;
        }
      }
      showToast(`MEBBİS ${examLabel} sonucu sorgulama işi devam ediyor.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "MEBBİS sınav sonucu çekme işi oluşturulamadı.";
      showToast(message, "error");
    } finally {
      setMebbisExamResultSyncRunning(false);
    }
  };

  const handleExamCodeDelete = async (option: ExamCodeOption) => {
    if (!canManageGroups) return;
    if (deletingExamCodeId) {
      return;
    }

    setDeletingExamCodeId(option.id);
    try {
      await deleteExamCode(option.id);
      if (selectedDrivingExamCode === option.code) {
        setSelectedDrivingExamCode("");
      }
      refreshAll();
      showToast(t("candidates.toast.examCodeDeleted"));
    } catch (error) {
      const errorCode = error instanceof ApiError ? error.errorCode : undefined;
      showToast(
        errorCode === "examCodeHasSchedules" || errorCode === "examCodeHasCandidates"
          ? t("candidates.toast.examCodeInUse")
          : t("candidates.toast.examCodeDeleteFailed"),
        "error"
      );
    } finally {
      setDeletingExamCodeId(null);
    }
  };

  const handleExamCodeEdit = async (option: ExamCodeOption, code: string) => {
    if (!canManageGroups) return;
    if (editingExamCodeId) {
      return;
    }

    setEditingExamCodeId(option.id);
    try {
      await updateExamCode(option.id, code);
      if (selectedDrivingExamCode === option.code) {
        setSelectedDrivingExamCode(code);
      }
      refreshAll();
      showToast(t("candidates.toast.examCodeUpdated"));
    } catch (error) {
      const errorCode = error instanceof ApiError ? error.errorCode : undefined;
      showToast(
        errorCode === "examCodeHasSchedules" || errorCode === "examCodeHasCandidates"
          ? t("candidates.toast.examCodeUpdateFailed")
          : t("candidates.toast.examCodeUpdateFailed"),
        "error"
      );
    } finally {
      setEditingExamCodeId(null);
    }
  };

  const handleTabChange = (value: CandidateListTabKey) => {
    setExamDateTabNeutral(false);
    if (examDateSidebar) {
      setSelectedExamDate("");
      setSelectedExamScheduleId("");
      setSelectedDrivingExamCode("");
    }
    setTab(value);
    setPage(1);
  };

  const handleTagFilterToggle = (name: string) => {
    setPage(1);
    setActiveTags((current) =>
      current.includes(name)
        ? current.filter((value) => value !== name)
        : [...current, name]
    );
  };

  const handleFilterChange = <K extends keyof CandidateFilterState>(
    key: K,
    value: CandidateFilterState[K]
  ) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handleExamDateSelect = (option: ExamScheduleOption | null) => {
    const value = option?.date ?? "";
    if (value) {
      setSelectedDrivingExamCode("");
    }
    setExamDateTabNeutral(Boolean(value));
    setPage(1);
    setSelectedExamDate(value);
    setSelectedExamScheduleId(option?.id ?? "");
  };

  const examDateSidebarActions = (() => {
    if (!examDateSidebar) return [];
    return [
      {
        label: t("candidatesPage.action.addExamDate"),
        onClick: handleExamDateAddClick,
        disabled: !canManageGroups,
        title: !canManageGroups ? noPermissionTitle : undefined,
      },
    ];
  })();

  const showMebbisExamResultSyncAction = examDateSidebar?.field === "eSinavDate" || examDateSidebar?.field === "drivingExamDate";
  const mebbisExamResultSyncTitle = !canManageMebJobs
    ? noPermissionTitle
    : !selectedExamDate
      ? "Önce bir sınav tarihi seç"
      : mebbisSessionGuard.disabled
        ? mebbisSessionGuard.message
        : undefined;

  const handleExamCodeSelect = (value: string) => {
    setSelectedExamDate("");
    setSelectedExamScheduleId("");
    setExamDateTabNeutral(false);
    setSelectedDrivingExamCode(value);
    setPage(1);
  };

  const clearAllFilters = () => {
    setPage(1);
    setFilters(EMPTY_CANDIDATE_FILTERS);
    setDebouncedFilters(EMPTY_CANDIDATE_FILTERS);
    setActiveTags([]);
    setSelectedExamDate("");
    setSelectedExamScheduleId("");
  };

  const openAddTagInput = () => {
    if (!canManageCandidates) return;
    setNewTagDraft("");
    setIsAddingTag(true);
    window.setTimeout(() => newTagInputRef.current?.focus(), 0);
  };

  const closeAddTagInput = () => {
    if (isCreatingTag) return;
    setIsAddingTag(false);
    setNewTagDraft("");
  };

  const upsertTagCatalog = (tag: CandidateTag) => {
    queryClient.setQueryData<CandidateTag[]>(candidateKeys.tags(""), (current) => {
      const list = current ?? [];
      const next = list.some((item) => item.id === tag.id || item.name === tag.name)
        ? list.map((item) => (item.id === tag.id || item.name === tag.name ? tag : item))
        : [...list, tag];
      return next.slice().sort((left, right) => left.name.localeCompare(right.name, "tr"));
    });
  };

  const removeTagFromCatalog = (tagId: string) => {
    queryClient.setQueryData<CandidateTag[]>(candidateKeys.tags(""), (current) =>
      (current ?? []).filter((tag) => tag.id !== tagId)
    );
  };

  const handleTagRenamed = (previousTag: CandidateTag, nextTag: CandidateTag) => {
    removeTagFromCatalog(previousTag.id);
    upsertTagCatalog(nextTag);
    setActiveTags((current) => {
      const mapped = current.map((name) => (name === previousTag.name ? nextTag.name : name));
      return mapped.filter((name, index) => mapped.indexOf(name) === index);
    });
    refreshAll();
  };

  const handleTagDeleted = (tag: CandidateTag) => {
    removeTagFromCatalog(tag.id);
    setActiveTags((current) => current.filter((name) => name !== tag.name));
    refreshAll();
  };

  const commitNewTag = async () => {
    if (!canManageCandidates) return;
    const name = newTagDraft.trim();
    if (!name) {
      closeAddTagInput();
      return;
    }

    const normalized = normalizeSearchComparable(name);
    const existing = allTags.find(
      (tag) => normalizeSearchComparable(tag.name) === normalized
    );
    if (existing) {
      setActiveTags((current) =>
        current.includes(existing.name) ? current : [...current, existing.name]
      );
      setPage(1);
      setIsAddingTag(false);
      setNewTagDraft("");
      return;
    }

    setIsCreatingTag(true);
    try {
      const createdTag = await createCandidateTag(name);
      upsertTagCatalog(createdTag);
      setActiveTags((current) =>
        current.includes(createdTag.name) ? current : [...current, createdTag.name]
      );
      setPage(1);
      setIsAddingTag(false);
      setNewTagDraft("");
    } catch {
      showToast(t("candidates.toast.tagCreateFailed"), "error");
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleNewTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void commitNewTag();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeAddTagInput();
    }
  };

  useEffect(() => {
    if (
      bulkStatusValue &&
      !visibleBulkStatusOptions.some((option) => option.value === bulkStatusValue)
    ) {
      setBulkStatusValue("");
    }
  }, [bulkStatusValue, visibleBulkStatusOptions]);

  /**
   * Cycle the sort state for a clicked header:
   *   unsorted -> asc -> desc -> unsorted
   * Always resets pagination to page 1 so the first row of the newly sorted
   * result set is visible.
   */
  const handleSortToggle = (field: CandidateSortField) => {
    setPage(1);
    setSort((current) => {
      if (!current || current.field !== field) {
        return { field, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { field, direction: "desc" };
      }
      return null;
    });
  };

  const openDrawer = (id: string) => setSearchParams({ selected: id });
  const closeDrawer = () => setSearchParams({});
  const detailReturnState = useMemo(
    () => ({
      returnLabel: title ? `← ${title} sayfasına dön` : "← Aday listesine dön",
      returnTo: `${location.pathname}${location.search}`,
    }),
    [location.pathname, location.search, title]
  );

  const handleSubmitNew = (candidate: CandidateResponse) => {
    setModalOpen(false);
    setPage(1);
    refreshAll();
    navigate(`/candidates/${candidate.id}?tab=documents`, { state: detailReturnState });
  };

  const exportCandidatesToCsv = (rowsToExport: CandidateResponse[]) => {
    const groupColumnHeader =
      groupColumnMode === "term" ? t("candidates.col.term") : t("candidates.col.group");
    const headers = [
      t("candidates.col.name"),
      t("candidates.col.nationalId"),
      t("candidates.col.phoneNumber"),
      t("candidates.col.birthDate"),
      t("candidates.col.gender"),
      t("candidates.col.licenseClass"),
      groupColumnHeader,
      t("candidates.col.eSinavDate"),
      t("candidates.col.eSinavAttemptCount"),
      t("candidates.col.drivingExamDate"),
      t("candidates.col.drivingExamAttemptCount"),
      t("candidates.csv.completedDocuments"),
      t("candidates.col.missingDocuments"),
      t("candidates.col.mebSyncStatus"),
      t("candidates.csv.examResult"),
      t("candidates.col.status"),
      t("candidates.col.createdAtUtc"),
    ] as const;

    const rows = rowsToExport.map((candidate): readonly (string | number)[] => [
      `${candidate.firstName} ${candidate.lastName}`.trim(),
      candidate.nationalId ?? "",
      formatPhoneDisplay(candidate.phoneNumber),
      formatDateTR(candidate.birthDate),
      formatOptionalText(candidateGenderLabel(candidate.gender)),
      candidate.licenseClass,
      groupColumnMode === "term"
        ? formatCandidateTerm(candidate, lang)
        : formatGroupWithTerm(candidate, lang),
      formatDateTR(candidate.mebExamDate),
      `${candidate.eSinavAttemptCount ?? 1}/4`,
      formatDateTR(candidate.drivingExamDate),
      `${candidate.drivingExamAttemptCount ?? 1}/${candidateExamAttemptDisplayLimit(candidate, "practice")}`,
      candidate.documentSummary?.completedCount ?? 0,
      candidate.documentSummary?.missingCount ?? 0,
      candidateMebSyncStatusLabel(candidate.mebSyncStatus),
      candidateUnifiedExamStatusExportLabel(candidate, t),
      candidateStatusLabel(candidate.status),
      formatDateTR(candidate.createdAtUtc),
    ]);

    const escapeCsvValue = (value: string | number) => {
      const text = String(value);
      if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
        return `"${text.replace(/"/g, "\"\"")}"`;
      }
      return text;
    };

    const csvLines = [
      headers.join(","),
      ...rows.map((row) => row.map((value) => escapeCsvValue(value)).join(",")),
    ];

    const blob = new Blob(["\uFEFF" + csvLines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `adaylar-${formatLocalDateOnly(new Date())}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const downloadSelectedCandidatesCsv = async () => {
    if (selectedCandidateIds.size === 0) {
      return;
    }

    setBulkExporting(true);

    try {
      const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
      const selectedIds = Array.from(selectedCandidateIds);
      const selectedCandidates = await Promise.all(
        selectedIds.map(
          async (candidateId) => candidateById.get(candidateId) ?? (await getCandidateById(candidateId))
        )
      );

      exportCandidatesToCsv(selectedCandidates);
      setBulkActionMode(null);
    } catch {
      showToast(t("candidates.toast.bulkExportFailed"), "error");
    } finally {
      setBulkExporting(false);
    }
  };

  const toggleCandidateSelection = (candidateId: string) => {
    setSelectedCandidateIds((current) => {
      const next = new Set(current);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);
      return next;
    });
  };

  const toggleVisibleCandidateSelection = () => {
    setSelectedCandidateIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const candidate of candidates) {
          next.delete(candidate.id);
        }
      } else {
        for (const candidate of candidates) {
          next.add(candidate.id);
        }
      }
      return next;
    });
  };

  const openBulkStatusAction = () => {
    if (!canManageCandidates) return;
    if (selectedCandidateIds.size === 0) {
      showToast(t("candidates.toast.selectAtLeastOne"), "error");
      return;
    }
    setBulkActionMode("status");
  };

  const openBulkTagAction = () => {
    if (!canManageCandidates) return;
    if (selectedCandidateIds.size === 0) {
      showToast(t("candidates.toast.selectAtLeastOne"), "error");
      return;
    }
    setBulkActionMode("tags");
  };

  const openBulkExportAction = () => {
    if (selectedCandidateIds.size === 0) {
      showToast(t("candidates.toast.selectAtLeastOne"), "error");
      return;
    }
    setBulkActionMode("export");
  };

  const prepareUnscheduledExamChargePrompt = async (examType: CandidateExamType) => {
    if (!canManageCandidates) return;
    if (isDrivingExamRandevuluTab) return;
    if (selectedCandidateIds.size === 0) {
      showToast(t("candidates.toast.selectAtLeastOne"), "error");
      return;
    }

    setUnscheduledExamChargeLoading(true);
    try {
      const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
      const selectedIds = Array.from(selectedCandidateIds);
      const selectedCandidates = await Promise.all(
        selectedIds.map(
          async (candidateId) => candidateById.get(candidateId) ?? (await getCandidateById(candidateId))
        )
      );
      const feeYear = new Date().getFullYear();
      const feeMatrix = await queryClient.fetchQuery({
        queryKey: ["finance", "license-class-fee-matrix", feeYear],
        queryFn: ({ signal }) => getLicenseClassFeeMatrix(feeYear, undefined, signal),
        staleTime: 5 * 60 * 1000,
      }).catch(() => null);
      const examDateType = examDateTypeFromCandidateExamType(examType);
      const rows = await Promise.all(selectedCandidates.map(async (candidate): Promise<UnscheduledExamChargeRow> => {
        const [attemptsResult, accountingResult] = await Promise.allSettled([
          listCandidateExamAttempts(candidate.id),
          getCandidateAccounting(candidate.id),
        ]);
        const hasPendingAttempt =
          attemptsResult.status === "fulfilled" &&
          attemptsResult.value.some((attempt) =>
            attempt.examType === examType &&
            attempt.schedulingStatus === "pending_schedule"
          );
        const hasActiveDebt =
          accountingResult.status === "fulfilled" &&
          activeExamDebtExists(accountingResult.value, examType);
        const duplicateReason = hasPendingAttempt
          ? "Planlanmamış sınav borcu var"
          : hasActiveDebt
            ? "Aktif sınav borcu var"
            : undefined;

        return {
          candidate,
          fee: String(defaultExamChargeFee(candidate, examDateType, feeMatrix, 0)),
          selected: !duplicateReason,
          duplicateReason,
        };
      }));

      setUnscheduledExamChargePrompt({
        examType,
        dueDate: todayLocalDateOnly(),
        description: unscheduledExamChargeTitle(examType),
        rows,
      });
      setBulkActionMode(null);
    } catch {
      showToast("Sınav borçlandırma listesi hazırlanamadı", "error");
    } finally {
      setUnscheduledExamChargeLoading(false);
    }
  };

  const openUnscheduledExamChargeAction = () => {
    const examType: CandidateExamType = examDateSidebar?.examType === "uygulama" ? "practice" : "theory";
    void prepareUnscheduledExamChargePrompt(examType);
  };

  const openBulkGroupAction = async () => {
    if (!canManageGroups) return;
    if (selectedCandidateIds.size === 0) {
      showToast(t("candidates.toast.selectAtLeastOne"), "error");
      return;
    }

    setBulkActionMode("group");
    setBulkGroupId("");
    if (bulkGroupOptions.length > 0) return;

    setBulkGroupLoading(true);
    try {
      const result = await getGroups({ pageSize: 200 });
      setBulkGroupOptions(result.items);
    } catch {
      showToast(t("candidates.toast.bulkGroupFailed"), "error");
    } finally {
      setBulkGroupLoading(false);
    }
  };

  const openBulkExamDateAction = () => {
    if (!canManageCandidates) return;
    if (selectedCandidateIds.size === 0) {
      showToast(t("candidates.toast.selectAtLeastOne"), "error");
      return;
    }

    if (!examDateSidebar) {
      return;
    }

    if (displayedExamDateOptions.length === 0) {
      showToast(t("candidates.toast.selectExamDateFirst"), "error");
      return;
    }

    setBulkExamDateValue(
      displayedExamDateOptions.some((option) => option.id === selectedExamScheduleId)
        ? selectedExamScheduleId
        : ""
    );
    setBulkActionMode("examDate");
  };

  const cancelBulkAction = () => {
    setBulkActionMode(null);
    setBulkStatusValue("");
    setBulkTagValues([]);
    setBulkExamDateValue("");
    setBulkGroupId("");
  };

  const applyBulkStatusChange = async () => {
    if (!canManageCandidates) return;
    if (!bulkStatusValue || selectedCandidateIds.size === 0) {
      return;
    }

    setBulkSaving(true);

    try {
      const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
      const selectedIds = Array.from(selectedCandidateIds);

      await applyStatusToCandidates(selectedIds, bulkStatusValue, candidateById);

      showToast(`${selectedIds.length} aday güncellendi`);
      setBulkActionMode(null);
      setSelectedCandidateIds(new Set());
      setBulkStatusValue("");
      refreshAll();
    } catch {
      showToast(t("candidates.toast.bulkStatusFailed"), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const applyBulkTagChange = async () => {
    if (!canManageCandidates) return;
    if (bulkTagValues.length === 0 || selectedCandidateIds.size === 0) {
      return;
    }

    setBulkSaving(true);

    try {
      const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
      const selectedIds = Array.from(selectedCandidateIds);

      await applyTagsToCandidates(selectedIds, bulkTagValues, candidateById);

      showToast(`${selectedIds.length} adaya etiket eklendi`);
      setBulkActionMode(null);
      setSelectedCandidateIds(new Set());
      setBulkTagValues([]);
      refreshAll();
    } catch {
      showToast(t("candidates.toast.bulkTagFailed"), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const applyBulkExamDateChange = async () => {
    if (!canManageCandidates) return;
    if (!examDateSidebar || !bulkExamDateValue || selectedCandidateIds.size === 0) {
      return;
    }

    setBulkSaving(true);

    try {
      const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
      const selectedIds = Array.from(selectedCandidateIds);
      const selectedSchedule = displayedExamDateOptions.find((option) => option.id === bulkExamDateValue);
      if (!selectedSchedule) {
        showToast(t("candidates.toast.bulkExamFailed"), "error");
        return;
      }
      const assignedExamDate = selectedSchedule.date;
      const result = await assignCandidatesToExamDate(
        selectedIds,
        examDateSidebar.examType,
        assignedExamDate,
        selectedSchedule.id,
        selectedSchedule.time,
        candidateById
      );

      if (result.successCount === 0) {
        showToast(t("candidates.toast.bulkExamFailed"), "error");
        return;
      }

      if (result.failureCount === 0) {
        showToast(`${result.successCount} aday sınava aktarıldı`);
      } else {
        showToast(
          `${result.successCount} aday sınava aktarıldı, ${result.failureCount} aday aktarılamadı`,
          "error"
        );
      }

      const feeYear = examChargeFeeYear(assignedExamDate);
      const feeMatrix = await queryClient.fetchQuery({
        queryKey: ["finance", "license-class-fee-matrix", feeYear],
        queryFn: ({ signal }) => getLicenseClassFeeMatrix(feeYear, undefined, signal),
        staleTime: 5 * 60 * 1000,
      }).catch(() => null);

      const chargeRows = result.assignedCandidates.flatMap(({ candidate, attempt }) =>
        attempt
          ? [{
              candidate,
              attempt,
              fee: String(defaultExamChargeFee(candidate, examDateSidebar.examType, feeMatrix, attempt.fee)),
              duplicateReason: examAttemptHasAccountingCharge(attempt) ? "Sınav borçlandırması var" : undefined,
            }]
          : []
      );
      if (chargeRows.length > 0) {
        setExamChargePrompt({
          examType: examDateSidebar.examType,
          rows: chargeRows,
        });
        setExamChargeModalOpen(false);
      }

      setBulkActionMode(null);
      setSelectedCandidateIds(new Set());
      setBulkExamDateValue("");
      setSelectedExamDate(assignedExamDate);
      setSelectedExamScheduleId(selectedSchedule.id);
      const neutral = isPastIsoDate(assignedExamDate);
      setExamDateTabNeutral(neutral);
      if (!neutral) {
        setTab("randevulu");
      }
      setPage(1);
      refreshAll();
    } catch {
      showToast(t("candidates.toast.bulkExamFailed"), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const closeExamChargePrompt = () => {
    if (examChargeSaving) return;
    setExamChargePrompt(null);
    setExamChargeModalOpen(false);
  };

  const openExamChargeModal = () => {
    setExamChargeModalOpen(true);
  };

  const updateExamChargeFee = (candidateId: string, value: string) => {
    setExamChargePrompt((current) => {
      if (!current) return current;
      return {
        ...current,
        rows: current.rows.map((row) =>
          row.candidate.id === candidateId ? { ...row, fee: value } : row
        ),
      };
    });
  };

  const saveExamCharges = async () => {
    if (!examChargePrompt || examChargeSaving) return;
    const allowZeroAmount = examChargePrompt.examType === "e_sinav";
    const prepared = examChargePrompt.rows
      .filter((row) => !row.duplicateReason)
      .map((row) => ({
        ...row,
        amount: row.fee.trim() === "" ? 0 : Number(row.fee),
      }));
    if (prepared.length === 0) {
      showToast("Borçlandırılacak aday yok", "error");
      return;
    }
    if (prepared.some((row) => !Number.isFinite(row.amount) || row.amount < 0 || (!allowZeroAmount && row.amount <= 0))) {
      showToast(allowZeroAmount ? "Sınav ücreti 0 veya daha büyük olmalı" : "Sınav ücreti 0'dan büyük olmalı", "error");
      return;
    }

    setExamChargeSaving(true);
    try {
      const chargeResults = await Promise.all(
        prepared.map(async (row) => {
          const latestAttempts = await listCandidateExamAttempts(row.candidate.id);
          const latestAttempt = latestAttempts.find((attempt) => attempt.id === row.attempt.id) ?? row.attempt;
          if (examAttemptHasAccountingCharge(latestAttempt)) {
            return false;
          }
          const updatedAttempt = await updateCandidateExamAttempt(
            row.candidate.id,
            latestAttempt.id,
            buildExamAttemptPayload(latestAttempt, row.amount)
          );
          if (row.amount > 0) {
            await chargeCandidateExamAttempt(row.candidate.id, updatedAttempt.id);
            return "charged" as const;
          }
          await markCandidateExamAttemptSelfPaid(row.candidate.id, updatedAttempt.id);
          return "selfPaid" as const;
        })
      );
      const chargedCount = chargeResults.filter((result) => result === "charged").length;
      const selfPaidCount = chargeResults.filter((result) => result === "selfPaid").length;
      const messages = [
        chargedCount > 0 ? `${chargedCount} aday için sınav borçlandırması yapıldı` : null,
        selfPaidCount > 0 ? `${selfPaidCount} aday kendi ödedi olarak işaretlendi` : null,
      ].filter(Boolean);
      showToast(messages.length > 0 ? messages.join(", ") : "Sınav ücreti kaydedildi");
      setExamChargePrompt(null);
      setExamChargeModalOpen(false);
      refreshAll();
    } catch {
      showToast("Sınav borçlandırması yapılamadı", "error");
    } finally {
      setExamChargeSaving(false);
    }
  };

  const closeUnscheduledExamChargePrompt = () => {
    if (unscheduledExamChargeSaving) return;
    setUnscheduledExamChargePrompt(null);
  };

  const updateUnscheduledExamChargeFee = (candidateId: string, value: string) => {
    setUnscheduledExamChargePrompt((current) => {
      if (!current) return current;
      return {
        ...current,
        rows: current.rows.map((row) =>
          row.candidate.id === candidateId ? { ...row, fee: value } : row
        ),
      };
    });
  };

  const toggleUnscheduledExamChargeRow = (candidateId: string) => {
    setUnscheduledExamChargePrompt((current) => {
      if (!current) return current;
      return {
        ...current,
        rows: current.rows.map((row) =>
          row.candidate.id === candidateId && !row.duplicateReason ? { ...row, selected: !row.selected } : row
        ),
      };
    });
  };

  const saveUnscheduledExamCharges = async () => {
    if (!unscheduledExamChargePrompt || unscheduledExamChargeSaving) return;
    if (isDrivingExamRandevuluTab) {
      setUnscheduledExamChargePrompt(null);
      return;
    }
    const allowZeroAmount = unscheduledExamChargePrompt.examType === "theory";
    const prepared = unscheduledExamChargePrompt.rows
      .filter((row) => row.selected && !row.duplicateReason)
      .map((row) => ({
        ...row,
        amount: row.fee.trim() === "" ? 0 : Number(row.fee),
      }));
    if (prepared.length === 0) {
      showToast("Borçlandırılacak aday seçilmedi", "error");
      return;
    }
    if (prepared.some((row) => !Number.isFinite(row.amount) || row.amount < 0 || (!allowZeroAmount && row.amount <= 0))) {
      showToast(allowZeroAmount ? "Sınav ücreti 0 veya daha büyük olmalı" : "Sınav ücreti 0'dan büyük olmalı", "error");
      return;
    }

    setUnscheduledExamChargeSaving(true);
    try {
      const results = await Promise.allSettled(prepared.map((row) =>
        createUnscheduledCandidateExamAttemptCharge(row.candidate.id, {
          examType: unscheduledExamChargePrompt.examType,
          dueDate: unscheduledExamChargePrompt.dueDate,
          fee: row.amount,
          description: unscheduledExamChargePrompt.description.trim(),
        })
      ));
      const successCount = results.filter((result) => result.status === "fulfilled").length;
      const failureCount = results.length - successCount;
      const chargedCount = results.filter(
        (result) => result.status === "fulfilled" && result.value.feeStatus === "charged"
      ).length;
      const selfPaidCount = results.filter(
        (result) => result.status === "fulfilled" && result.value.feeStatus === "paid"
      ).length;
      if (successCount === 0) {
        showToast("Sınav borçlandırması yapılamadı", "error");
        return;
      }

      const successMessages = [
        chargedCount > 0 ? `${chargedCount} aday için sınav borçlandırması yapıldı` : null,
        selfPaidCount > 0 ? `${selfPaidCount} aday kendi ödedi olarak işaretlendi` : null,
      ].filter(Boolean);
      showToast(
        [
          successMessages.length > 0 ? successMessages.join(", ") : `${successCount} aday için sınav borçlandırması yapıldı`,
          failureCount > 0 ? `${failureCount} adayda hata oluştu` : null,
        ].filter(Boolean).join(", "),
        failureCount === 0 ? undefined : "error");
      setUnscheduledExamChargePrompt(null);
      setSelectedCandidateIds(new Set());
      refreshAll();
    } catch {
      showToast("Sınav borçlandırması yapılamadı", "error");
    } finally {
      setUnscheduledExamChargeSaving(false);
    }
  };

  const applyBulkGroupChange = async () => {
    if (!canManageGroups) return;
    if (!bulkGroupId || selectedCandidateIds.size === 0) {
      return;
    }

    setBulkSaving(true);

    try {
      const selectedIds = Array.from(selectedCandidateIds);
      await Promise.all(
        selectedIds.map((candidateId) => assignCandidateGroup(candidateId, bulkGroupId))
      );

      showToast(`${selectedIds.length} aday gruba aktarıldı`);
      setBulkActionMode(null);
      setSelectedCandidateIds(new Set());
      setBulkGroupId("");
      refreshAll();
    } catch {
      showToast(t("candidates.toast.bulkGroupFailed"), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const candidateListContent = (
    <>
      <div className="tag-filter-bar" role="toolbar" aria-label={t("candidates.tags.label")}>
        {allTags.map((tag) => {
          const isActive = activeTags.includes(tag.name);
          return (
            <button
              aria-pressed={isActive}
              className={`tag-filter-chip color-${tagColorIndex(tag.name)}${
                isActive ? " active" : ""
              }`}
              key={tag.id}
              onClick={() => handleTagFilterToggle(tag.name)}
              type="button"
            >
              {tag.name}
            </button>
          );
        })}
        {isAddingTag ? (
          <input
            aria-label={t("candidates.tags.newFilterPlaceholder")}
            className="tag-filter-new-input"
            disabled={isCreatingTag || !canManageCandidates}
            title={!canManageCandidates ? noPermissionTitle : undefined}
            onBlur={() => {
              void commitNewTag();
            }}
            onChange={(event) => setNewTagDraft(event.target.value)}
            onKeyDown={handleNewTagKeyDown}
            placeholder={t("candidates.tags.newFilterPlaceholder")}
            ref={newTagInputRef}
            type="text"
            value={newTagDraft}
          />
        ) : (
          <button
            aria-label={t("candidates.tags.addFilter")}
            className="tag-filter-add"
            disabled={!canManageCandidates}
            onClick={openAddTagInput}
            title={!canManageCandidates ? noPermissionTitle : undefined}
            type="button"
          >
            + {t("candidates.tags.addFilter")}
          </button>
        )}
        <button
          className="tag-filter-manage"
          disabled={!canManageCandidates}
          onClick={() => {
            if (!canManageCandidates) return;
            setTagManagerOpen(true);
          }}
          title={!canManageCandidates ? noPermissionTitle : undefined}
          type="button"
        >
          {t("candidates.bulk.manageTags")}
        </button>
      </div>

      <div className="table-wrap spaced">
        <table className="data-table cand-table">
          <thead>
            <tr>
              {selectionColumnVisible ? (
                <th className="cand-select-th">
                  <label className="cand-select-control switch-toggle">
                    <input
                      aria-label={t("candidates.aria.selectAllOnPage")}
                      checked={allVisibleSelected}
                      onChange={toggleVisibleCandidateSelection}
                      type="checkbox"
                    />
                    <span className="switch-toggle-control" aria-hidden="true" />
                  </label>
                </th>
              ) : null}
              {visibleColumns.map((col) => {
                const label = getColumnLabel(col);
                const filterControl = getColumnFilterControl(col);
                const dragHandlers = columnDragHandlers(col.id);
                const dragClassName = [
                  col.headerClassName,
                  dragHandlers.draggable ? "cand-column-draggable" : null,
                  draggedColumnId === col.id ? "cand-column-dragging" : null,
                ].filter(Boolean).join(" ");
                return col.sortField ? (
                  <SortableTh
                    className={dragClassName}
                    dragHandlers={dragHandlers}
                    filterControl={filterControl}
                    key={col.id}
                    field={col.sortField}
                    label={label}
                    onToggle={handleSortToggle}
                    sort={sort}
                  />
                ) : (
                  <th
                    aria-label={label}
                    className={dragClassName}
                    key={col.id}
                    {...dragHandlers}
                  >
                    <div className="sortable-th-shell">
                      <span>{col.headerLabel ?? label}</span>
                      {filterControl ? (
                        <div className="sortable-th-filter">{filterControl}</div>
                      ) : null}
                    </div>
                  </th>
                );
              })}
              <th className="col-picker-th">
                <ColumnPicker
                  columns={pickerOptions}
                  isVisible={isVisible}
                  menuTitle={`${currentTabLabel} kolonları`}
                  onReset={resetColumns}
                  onToggle={toggleColumn}
                  resetLabel={t("candidates.resetLabel")}
                  triggerTitle={t("candidates.columns.button")}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <>
                {Array.from({ length: Math.min(pageSize, 10) }, (_, i) => (
                  <tr key={i} style={{ pointerEvents: "none" }}>
                    {selectionColumnVisible ? <td className="cand-select-td" /> : null}
                    {visibleColumns.map((col) => (
                      <td className={col.cellClassName} key={col.id}>
                        <span
                          className="skeleton"
                          style={{ width: `${col.skeletonWidth + (i * 11) % 24}px` }}
                        />
                      </td>
                    ))}
                    <td className="col-picker-td" />
                  </tr>
                ))}
              </>
            ) : candidates.length === 0 ? (
              <tr>
                <td
                  className="data-table-empty"
                  colSpan={visibleColumns.length + (selectionColumnVisible ? 2 : 1)}
                >
                  {t("candidates.empty.noMatches")}
                </td>
              </tr>
            ) : (
              candidates.map((c) => (
                <tr
                  className={
                    shouldDimBlockedLatestCodeRows && c.isBlockedForLatestDrivingExamCode
                      ? "cand-row--blocked-latest-code"
                      : undefined
                  }
                  key={c.id}
                >
                  {selectionColumnVisible ? (
                    <td
                      className="cand-select-td"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <label className="cand-select-control switch-toggle">
                        <input
                          aria-label={t("candidates.aria.selectCandidate", {
                            name: `${c.firstName} ${c.lastName}`,
                          })}
                          checked={selectedCandidateIds.has(c.id)}
                          onChange={() => toggleCandidateSelection(c.id)}
                          onClick={(event) => event.stopPropagation()}
                          type="checkbox"
                        />
                        <span className="switch-toggle-control" aria-hidden="true" />
                      </label>
                    </td>
                  ) : null}
                  {visibleColumns.map((col) => {
                    const opensDetail = col.id === "photo" || col.id === "name";
                    return (
                      <td
                        className={`${col.cellClassName ?? ""} cand-row-cell${
                          opensDetail ? "" : " cand-row-cell--drawer"
                        }`}
                        key={col.id}
                        onClick={() =>
                          opensDetail
                            ? navigate(`/candidates/${c.id}`, { state: detailReturnState })
                            : openDrawer(c.id)
                        }
                        title={opensDetail ? t("candidates.title.goToDetail") : t("candidates.title.quickPreview")}
                      >
                        {col.renderCell(c, columnPageScope)}
                      </td>
                    );
                  })}
                  <td className="col-picker-td" />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        disabled={loading}
        onChange={setPage}
        onPageSizeChange={(nextSize) => {
          setPageSize(nextSize);
          setPage(1);
        }}
        page={page}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        totalPages={totalPages}
      />
    </>
  );

  const tabsSearchRow = (
    <div className={showTabs && !isDrivingExamCodeTabActive ? "tabs-search-row" : "tabs-search-row no-tabs"}>
      {showTabs && !isDrivingExamCodeTabActive && (
        <PageTabs
          active={examDateTabNeutral ? "" : tab}
          onChange={handleTabChange}
          tabs={tabsWithCounts}
        />
      )}
      <div className="search-box">
        <SearchInput
          onChange={handleSearchChange}
          placeholder={t("candidates.searchPlaceholder")}
          value={search}
        />
      </div>
    </div>
  );

  return (
    <div className="candidates-page">
      <PageToolbar
        actions={
          <>
              <div className="candidate-bulk-toolbar">
                {selectedCount > 0 ? (
                  <span className="candidate-bulk-count">{t("candidates.selectedCount", { count: selectedCount })}</span>
                ) : null}
                {bulkActionMode === "status" ? (
                  <>
                    <CustomSelect
                      aria-label={t("candidates.aria.bulkStatusSelect")}
                      onChange={(event) =>
                        setBulkStatusValue(event.target.value as "" | CandidateStatusValue)
                      }
                      size="sm"
                      value={bulkStatusValue}
                    >
                      <option value="">{t("candidates.bulk.statusPlaceholder")}</option>
                      {visibleBulkStatusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </CustomSelect>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={selectedCount === 0 || !bulkStatusValue || bulkSaving || !canManageCandidates}
                      onClick={applyBulkStatusChange}
                      title={!canManageCandidates ? noPermissionTitle : undefined}
                      type="button"
                    >
                      {bulkSaving ? t("candidates.bulk.applying") : t("candidates.bulk.apply")}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={bulkSaving}
                      onClick={cancelBulkAction}
                      type="button"
                    >
                      {t("candidates.bulk.cancel")}
                    </button>
                  </>
                ) : bulkActionMode === "tags" ? (
                  <>
                    <CandidateTagsInput
                      ariaLabel={t("candidates.aria.bulkTagSelect")}
                      className="candidate-bulk-tags-input"
                      onChange={setBulkTagValues}
                      placeholder={t("candidates.bulk.tagSearchPlaceholder")}
                      value={bulkTagValues}
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={selectedCount === 0 || bulkTagValues.length === 0 || bulkSaving || !canManageCandidates}
                      onClick={applyBulkTagChange}
                      title={!canManageCandidates ? noPermissionTitle : undefined}
                      type="button"
                    >
                      {bulkSaving ? t("candidates.bulk.adding") : t("candidates.bulk.apply")}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={bulkSaving}
                      onClick={cancelBulkAction}
                      type="button"
                    >
                      {t("candidates.bulk.cancel")}
                    </button>
                  </>
                ) : bulkActionMode === "export" ? (
                  <>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={selectedCount === 0 || bulkExporting}
                      onClick={downloadSelectedCandidatesCsv}
                      type="button"
                    >
                      {bulkExporting ? t("candidates.bulk.exporting") : t("candidates.bulk.exportCsv")}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setBulkActionMode(null)}
                      type="button"
                    >
                      {t("candidates.bulk.close")}
                    </button>
                  </>
                ) : bulkActionMode === "examDate" ? (
                  <>
                    <CustomSelect
                      aria-label={t("candidates.aria.bulkExamDateSelect")}
                      onChange={(event) => setBulkExamDateValue(event.target.value)}
                      size="sm"
                      value={bulkExamDateValue}
                    >
                      <option value="">{t("candidates.bulk.datePlaceholder")}</option>
                      {displayedExamDateOptions.map((option) => (
                        <option
                          data-secondary={option.examCode ?? undefined}
                          key={option.id}
                          value={option.id}
                        >
                          {formatBulkExamDateOptionLabel(option, examDateSidebar?.showTime)}
                        </option>
                      ))}
                    </CustomSelect>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={selectedCount === 0 || !bulkExamDateValue || bulkSaving || !canManageCandidates}
                      onClick={applyBulkExamDateChange}
                      title={!canManageCandidates ? noPermissionTitle : undefined}
                      type="button"
                    >
                      {bulkSaving ? t("candidates.bulk.assigning") : t("candidates.bulk.apply")}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={bulkSaving}
                      onClick={cancelBulkAction}
                      type="button"
                    >
                      {t("candidates.bulk.cancel")}
                    </button>
                  </>
                ) : bulkActionMode === "group" ? (
                  <>
                    <CustomSelect
                      aria-label={t("candidates.aria.bulkGroupSelect")}
                      disabled={bulkGroupLoading}
                      onChange={(event) => setBulkGroupId(event.target.value)}
                      size="sm"
                      value={bulkGroupId}
                    >
                      <option value="">
                        {bulkGroupLoading
                          ? t("candidates.bulk.loadingGroups")
                          : t("candidates.bulk.groupPlaceholder")}
                      </option>
                      {bulkGroupOptions.map((group) => (
                        <option key={group.id} value={group.id}>
                          {buildGroupHeading(group.title, group.term, [group.term], lang)}
                        </option>
                      ))}
                    </CustomSelect>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={selectedCount === 0 || !bulkGroupId || bulkSaving || !canManageGroups}
                      onClick={applyBulkGroupChange}
                      title={!canManageGroups ? noPermissionTitle : undefined}
                      type="button"
                    >
                      {bulkSaving ? t("candidates.bulk.assigning") : t("candidates.bulk.apply")}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={bulkSaving}
                      onClick={cancelBulkAction}
                      type="button"
                    >
                      {t("candidates.bulk.cancel")}
                    </button>
                  </>
                ) : (
                  <>
                    {examDateSidebar ? (
                      <>
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={!canManageCandidates}
                          onClick={openBulkExamDateAction}
                          title={!canManageCandidates ? noPermissionTitle : undefined}
                          type="button"
                        >
                          {t("candidates.bulk.setExamDate")}
                        </button>
                        {showMebbisExamResultSyncAction ? (
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={!canManageMebJobs || mebbisExamResultSyncRunning || !selectedExamDate}
                            onClick={handleSelectedExamDateMebbisResultSync}
                            title={mebbisExamResultSyncTitle}
                            type="button"
                          >
                            {mebbisExamResultSyncRunning ? "Sorgulanıyor" : "Sonuç Sorgulama"}
                          </button>
                        ) : null}
                        {canShowUnscheduledExamChargeAction ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={
                              selectedCount === 0 ||
                              !canManageCandidates ||
                              unscheduledExamChargeLoading
                            }
                            onClick={openUnscheduledExamChargeAction}
                            title={!canManageCandidates ? noPermissionTitle : undefined}
                            type="button"
                          >
                            {unscheduledExamChargeLoading ? "Hazırlanıyor" : "Sınav borçlandır"}
                          </button>
                        ) : null}
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={!canManageCandidates}
                          onClick={openBulkTagAction}
                          title={!canManageCandidates ? noPermissionTitle : undefined}
                          type="button"
                        >
                          {t("candidates.bulk.addTag")}
                        </button>
                        {showBulkStatusAction ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={!canManageCandidates}
                            onClick={openBulkStatusAction}
                            title={!canManageCandidates ? noPermissionTitle : undefined}
                            type="button"
                          >
                            {t("candidates.bulk.changeStatus")}
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <>
                        {showBulkGroupAction ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={!canManageGroups}
                            onClick={openBulkGroupAction}
                            title={!canManageGroups ? noPermissionTitle : undefined}
                            type="button"
                          >
                            {t("candidates.bulk.assignGroup")}
                          </button>
                        ) : null}
                        {showBulkStatusAction ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={!canManageCandidates}
                            onClick={openBulkStatusAction}
                            title={!canManageCandidates ? noPermissionTitle : undefined}
                            type="button"
                          >
                            {t("candidates.bulk.changeStatus")}
                          </button>
                        ) : null}
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={!canManageCandidates}
                          onClick={openBulkTagAction}
                          title={!canManageCandidates ? noPermissionTitle : undefined}
                          type="button"
                        >
                          {t("candidates.bulk.addTag")}
                        </button>
                        {canShowUnscheduledExamChargeAction ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={
                              selectedCount === 0 ||
                              !canManageCandidates ||
                              unscheduledExamChargeLoading
                            }
                            onClick={openUnscheduledExamChargeAction}
                            title={!canManageCandidates ? noPermissionTitle : undefined}
                            type="button"
                          >
                            {unscheduledExamChargeLoading ? "Hazırlanıyor" : "Sınav borçlandır"}
                          </button>
                        ) : null}
                        {showFiltersAction ? (
                          <button
                            aria-controls="cand-filters-panel"
                            aria-expanded={filtersOpen}
                            className={filtersOpen ? "btn btn-secondary btn-sm active cand-filters-button" : "btn btn-secondary btn-sm cand-filters-button"}
                            onClick={() => setFiltersOpen((current) => !current)}
                            type="button"
                          >
                            <span>{t("candidates.filters.button")}</span>
                            {activeFilterCount > 0 && !filtersOpen && (
                              <span className="cand-filters-badge">{activeFilterCount}</span>
                            )}
                          </button>
                        ) : null}
                      </>
                    )}
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={openBulkExportAction}
                      type="button"
                    >
                      <DownloadIcon size={14} />
                      {t("candidates.bulk.export")}
                    </button>
                  </>
                )}
              </div>
              {showCreateCandidateAction ? (
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!canManageCandidates}
                  onClick={() => {
                    if (!canManageCandidates) return;
                    setModalOpen(true);
                  }}
                  title={!canManageCandidates ? noPermissionTitle : undefined}
                  type="button"
                >
                  <PlusIcon size={14} />
                  {t("candidates.newCandidate")}
                </button>
              ) : null}
            </>
        }
        title={title ?? t("candidates.headerTitleDefault")}
      />

      {showFiltersAction ? (
        <CandidateFilterPanel
          activeFilterCount={activeFilterCount}
          filters={filters}
          hasAnyActiveFilter={activeFilterCount > 0 || activeTags.length > 0}
          onChange={handleFilterChange}
          onClearAll={clearAllFilters}
          onClose={() => setFiltersOpen(false)}
          open={filtersOpen}
          showDocumentFilters={false}
        />
      ) : null}
      {examDateSidebar ? (
        <div className="candidates-layout">
          <CandidateExamDateSidebar
            actions={examDateSidebarActions}
            canManageMutations={canManageGroups}
            deletingOptionId={deletingExamScheduleId}
            deletingCodeId={deletingExamCodeId}
            editingOptionId={editingExamScheduleId}
            editingCodeId={editingExamCodeId}
            codeOptions={examDateSidebar.examType === "uygulama" ? examCodeOptions : undefined}
            onCodeAdd={examDateSidebar.examType === "uygulama" ? handleExamCodeAddClick : undefined}
            onCodeDelete={examDateSidebar.examType === "uygulama" ? handleExamCodeDelete : undefined}
            onCodeEdit={examDateSidebar.examType === "uygulama" ? handleExamCodeEdit : undefined}
            onCodeSelect={examDateSidebar.examType === "uygulama" ? handleExamCodeSelect : undefined}
            onDelete={handleExamDateDelete}
            onEdit={handleExamDateEdit}
            onSelect={handleExamDateSelect}
            onSidebarTabChange={(nextTab) => {
              setExamSidebarTab(nextTab);
              setPage(1);
              if (nextTab === "dates") {
                setSelectedDrivingExamCode("");
              } else {
                setSelectedExamDate("");
                setSelectedExamScheduleId("");
                setExamDateTabNeutral(false);
              }
            }}
            options={displayedExamDateOptions}
            selectedCode={selectedDrivingExamCode}
            selectedOptionId={selectedExamScheduleId}
            showLicenseClassInHeader={examDateSidebar.showLicenseClassInHeader}
            showTime={examDateSidebar.showTime}
            summaryMode={examDateSidebar.summaryMode}
            title={examDateSidebar.title}
          />
          <div className="candidates-main">
            {tabsSearchRow}
            {candidateListContent}
          </div>
        </div>
      ) : (
        <>
          {tabsSearchRow}
          {candidateListContent}
        </>
      )}

      <CandidateDrawer
        candidateId={selectedId}
        canManageCandidates={canManageCandidates}
        onClose={closeDrawer}
        onDeleted={() => {
          closeDrawer();
          refreshAll();
        }}
        onUpdated={() => refreshAll()}
      />

      {showCreateCandidateAction ? (
        <NewCandidateModal
          canManage={canManageCandidates}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSubmitNew}
          open={modalOpen}
        />
      ) : null}
      <CandidateTagManagerModal
        canManage={canManageCandidates}
        onClose={() => setTagManagerOpen(false)}
        onDeleted={handleTagDeleted}
        onRenamed={handleTagRenamed}
        open={tagManagerOpen}
        tags={allTags}
      />
      <Modal
        footer={
          <>
            <button
              className="btn btn-secondary"
              disabled={unscheduledExamChargeSaving}
              onClick={closeUnscheduledExamChargePrompt}
              type="button"
            >
              Vazgeç
            </button>
            <button
              className="btn btn-primary"
              disabled={
                unscheduledExamChargeSaving ||
                !unscheduledExamChargePrompt?.rows.some((row) => row.selected)
              }
              onClick={saveUnscheduledExamCharges}
              type="button"
            >
              {unscheduledExamChargeSaving ? "Kaydediliyor" : "Borçlandır"}
            </button>
          </>
        }
        onClose={closeUnscheduledExamChargePrompt}
        open={showUnscheduledExamChargePrompt}
        title={unscheduledExamChargePrompt
          ? unscheduledExamChargeTitle(unscheduledExamChargePrompt.examType)
          : "Sınav borçlandır"}
      >
        {unscheduledExamChargePrompt ? (
          <div className="exam-charge-table-wrap">
            <div className="candidate-exam-attempt-form">
              <label>
                <span>Vade tarihi</span>
                <LocalizedDateInput
                  ariaLabel="Vade tarihi"
                  className="form-input"
                  disabled={unscheduledExamChargeSaving}
                  lang="tr-TR"
                  onChange={(dueDate) =>
                    setUnscheduledExamChargePrompt((current) =>
                      current ? { ...current, dueDate } : current
                    )
                  }
                  value={unscheduledExamChargePrompt.dueDate}
                />
              </label>
            </div>
            <table className="exam-charge-table">
              <thead>
                <tr>
                  <th>Seç</th>
                  <th>Ad Soyad</th>
                  <th>TC</th>
                  <th>Telefon</th>
                  <th>Ücret</th>
                  <th>Uyarı</th>
                </tr>
              </thead>
              <tbody>
                {unscheduledExamChargePrompt.rows.map((row) => (
                  <tr
                    className={row.duplicateReason ? "exam-charge-table-row-warning" : undefined}
                    key={row.candidate.id}
                  >
                    <td>
                      <label className="cand-select-control switch-toggle">
                        <input
                          aria-label={`${candidateFullName(row.candidate)} seç`}
                          checked={!row.duplicateReason && row.selected}
                          disabled={unscheduledExamChargeSaving || Boolean(row.duplicateReason)}
                          onChange={() => toggleUnscheduledExamChargeRow(row.candidate.id)}
                          type="checkbox"
                        />
                        <span className="switch-toggle-control" aria-hidden="true" />
                      </label>
                    </td>
                    <td>{candidateFullName(row.candidate)}</td>
                    <td>{formatNationalId(row.candidate.nationalId)}</td>
                    <td>{formatPhoneDisplay(row.candidate.phoneNumber)}</td>
	                    <td>
	                      <input
	                        aria-label={`${candidateFullName(row.candidate)} sınav ücreti`}
	                        className={[
	                          "exam-charge-fee-input",
	                          Number(row.fee) < 0 || (unscheduledExamChargePrompt.examType !== "theory" && Number(row.fee) <= 0)
                              ? "exam-charge-fee-input-invalid"
                              : null,
	                        ].filter(Boolean).join(" ")}
	                        min="0"
	                        onChange={(event) => updateUnscheduledExamChargeFee(row.candidate.id, event.target.value)}
	                        step="0.01"
                        type="number"
                        value={row.fee}
                      />
                    </td>
                    <td>{row.duplicateReason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Modal>
      {examChargePrompt && !examChargeModalOpen ? (
        <div
          aria-label="Sınav borçlandırması yapılsın mı?"
          className="exam-charge-popover"
          role="dialog"
        >
          <div className="exam-charge-popover-title">Sınav borçlandırması yapılsın mı?</div>
          <p className="exam-charge-confirm-text">
            {`${examChargePrompt.rows.length} aday için ${examChargeTitle(examChargePrompt.examType).toLocaleLowerCase("tr-TR")} hazırlanabilir.`}
          </p>
          <div className="exam-charge-popover-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={closeExamChargePrompt}
              type="button"
            >
              Hayır
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={openExamChargeModal}
              type="button"
            >
              Evet
            </button>
          </div>
        </div>
      ) : null}
      <Modal
        footer={
          <>
            <button
              className="btn btn-secondary"
              disabled={examChargeSaving}
              onClick={closeExamChargePrompt}
              type="button"
            >
              Vazgeç
            </button>
            <button
              className="btn btn-primary"
              disabled={examChargeSaving || !examChargePrompt?.rows.some((row) => !row.duplicateReason)}
              onClick={saveExamCharges}
              type="button"
            >
              {examChargeSaving ? "Kaydediliyor" : "Kaydet"}
            </button>
          </>
        }
        onClose={closeExamChargePrompt}
        open={Boolean(examChargePrompt) && examChargeModalOpen}
        title={examChargePrompt ? examChargeTitle(examChargePrompt.examType) : "Sınav borçlandırması"}
      >
        <div className="exam-charge-table-wrap">
          <table className="exam-charge-table">
            <thead>
              <tr>
                <th>Ad Soyad</th>
                <th>TC</th>
                <th>Telefon</th>
                <th>Ücret</th>
                <th>Uyarı</th>
              </tr>
            </thead>
            <tbody>
              {examChargePrompt?.rows.map((row) => (
                <tr
                  className={row.duplicateReason ? "exam-charge-table-row-warning" : undefined}
                  key={row.candidate.id}
                >
                  <td>{candidateFullName(row.candidate)}</td>
                  <td>{formatNationalId(row.candidate.nationalId)}</td>
                  <td>{formatPhoneDisplay(row.candidate.phoneNumber)}</td>
                  <td>
                    <input
                      aria-label={`${candidateFullName(row.candidate)} sınav ücreti`}
                      className={[
                        "exam-charge-fee-input",
                        Number(row.fee) < 0 || (examChargePrompt.examType !== "e_sinav" && Number(row.fee) <= 0)
                          ? "exam-charge-fee-input-invalid"
                          : null,
                      ].filter(Boolean).join(" ")}
                      disabled={examChargeSaving || Boolean(row.duplicateReason)}
                      min="0"
                      onChange={(event) => updateExamChargeFee(row.candidate.id, event.target.value)}
                      step="0.01"
                      type="number"
                      value={row.fee}
                    />
                  </td>
                  <td>{row.duplicateReason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
      {examDateSidebar ? (
        <NewExamScheduleModal
          canManage={canManageGroups}
          examCodes={examDateSidebar.examType === "uygulama" ? examCodeOptions : undefined}
          examType={examDateSidebar.examType}
          onClose={() => setExamScheduleModalOpen(false)}
          onSaved={() => {
            setExamScheduleModalOpen(false);
            refreshAll();
          }}
          open={examScheduleModalOpen}
        />
      ) : null}
      {examDateSidebar?.examType === "uygulama" ? (
        <NewExamCodeModal
          canManage={canManageGroups}
          onClose={() => setExamCodeModalOpen(false)}
          onSaved={() => {
            setExamCodeModalOpen(false);
            refreshAll();
          }}
          open={examCodeModalOpen}
        />
      ) : null}
    </div>
  );
}

type SortableThProps = {
  field: CandidateSortField;
  filterControl?: React.ReactNode;
  label: string;
  sort: SortState;
  onToggle: (field: CandidateSortField) => void;
  className?: string;
  dragHandlers?: ThHTMLAttributes<HTMLTableCellElement>;
};

function SortableTh({
  field,
  filterControl,
  label,
  sort,
  onToggle,
  className,
  dragHandlers,
}: SortableThProps) {
  const isActive = sort?.field === field;
  const direction = isActive ? sort!.direction : null;
  const indicator = direction === "asc" ? "▲" : direction === "desc" ? "▼" : "↕";
  const ariaSort: React.AriaAttributes["aria-sort"] = isActive
    ? direction === "asc"
      ? "ascending"
      : "descending"
    : "none";
  const thClassName = [isActive ? "sortable-th active" : "sortable-th", className]
    .filter(Boolean)
    .join(" ");
  return (
    <th aria-sort={ariaSort} className={thClassName} {...dragHandlers}>
      <div className="sortable-th-shell">
        <button
          className="sortable-th-btn"
          onClick={() => onToggle(field)}
          type="button"
        >
          <span>{label}</span>
          <span className="sortable-th-indicator" aria-hidden="true">
            {indicator}
          </span>
        </button>
        {filterControl ? <div className="sortable-th-filter">{filterControl}</div> : null}
      </div>
    </th>
  );
}

const FILTER_MENU_VIEWPORT_GAP = 8;
const FILTER_MENU_TRIGGER_GAP = 6;

function NumberRangeHeaderFilter({
  active,
  max,
  maxPlaceholder = "Maks",
  min,
  minPlaceholder = "Min",
  onApply,
  onClear,
  title,
}: {
  active: boolean;
  max: string;
  maxPlaceholder?: string;
  min: string;
  minPlaceholder?: string;
  onApply: (min: string, max: string) => void;
  onClear: () => void;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [draftMin, setDraftMin] = useState(min);
  const [draftMax, setDraftMax] = useState(max);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setDraftMin(min);
      setDraftMax(max);
    }
  }, [max, min, open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const triggerRect = trigger.getBoundingClientRect();
      const measuredWidth = menuRef.current?.offsetWidth ?? 220;
      const measuredHeight = menuRef.current?.offsetHeight ?? 180;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const maxLeft = Math.max(FILTER_MENU_VIEWPORT_GAP, viewportWidth - measuredWidth - FILTER_MENU_VIEWPORT_GAP);
      const left = Math.min(
        Math.max(triggerRect.right - measuredWidth, FILTER_MENU_VIEWPORT_GAP),
        maxLeft
      );

      const preferredBelowTop = triggerRect.bottom + FILTER_MENU_TRIGGER_GAP;
      const preferredAboveTop = triggerRect.top - measuredHeight - FILTER_MENU_TRIGGER_GAP;
      const fitsBelow = preferredBelowTop + measuredHeight <= viewportHeight - FILTER_MENU_VIEWPORT_GAP;
      const fitsAbove = preferredAboveTop >= FILTER_MENU_VIEWPORT_GAP;

      let top = preferredBelowTop;
      if (!fitsBelow && fitsAbove) {
        top = preferredAboveTop;
      } else if (!fitsBelow) {
        top = Math.max(FILTER_MENU_VIEWPORT_GAP, viewportHeight - measuredHeight - FILTER_MENU_VIEWPORT_GAP);
      }

      setMenuPos({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onApply(draftMin.trim(), draftMax.trim());
    setOpen(false);
  };

  return (
    <div className={open ? "table-header-filter open" : "table-header-filter"} ref={ref}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={title}
        className={`table-header-filter-trigger${active ? " active" : ""}`}
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        title={title}
        type="button"
      >
        <FilterIcon size={12} />
      </button>

      {open
        ? createPortal(
            <div
              className="table-header-filter-menu table-header-filter-text-menu"
              ref={menuRef}
              role="dialog"
              style={menuPos ? { top: menuPos.top, left: menuPos.left } : undefined}
            >
              <div className="table-header-filter-title">{title}</div>
              <form className="table-header-filter-form" onSubmit={submit}>
                <input
                  autoFocus
                  className="table-header-filter-input"
                  inputMode="decimal"
                  onChange={(event) => setDraftMin(event.target.value)}
                  placeholder={minPlaceholder}
                  step="any"
                  type="number"
                  value={draftMin}
                />
                <input
                  className="table-header-filter-input"
                  inputMode="decimal"
                  onChange={(event) => setDraftMax(event.target.value)}
                  placeholder={maxPlaceholder}
                  step="any"
                  type="number"
                  value={draftMax}
                />
                <div className="table-header-filter-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      onClear();
                      setOpen(false);
                    }}
                    type="button"
                  >
                    Temizle
                  </button>
                  <button className="btn btn-primary btn-sm" type="submit">
                    Uygula
                  </button>
                </div>
              </form>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function buildCandidateColumnFilterControl(
  columnId: CandidateColumnId,
  filters: CandidateFilterState,
  setFilter: <K extends keyof CandidateFilterState>(
    key: K,
    value: CandidateFilterState[K]
  ) => void,
  licenseClassOptions: { value: string; label: string }[],
  periodGroupOptions: { value: string; label: string }[],
  t: ReturnType<typeof useT>,
  columnLabel: string,
  pageScope: CandidateColumnPageScope
) {
  if (columnId === "licenseClass") {
    return (
      <CheckboxListPopover
        onChange={(next) => setFilter("licenseClasses", next as LicenseClass[])}
        options={licenseClassOptions}
        placeholder={t("candidates.col.licenseClass")}
        searchable={licenseClassOptions.length > 8}
        title={t("candidates.col.licenseClass")}
        triggerVariant="icon"
        values={filters.licenseClasses}
      />
    );
  }

  if (columnId === "gender") {
    return (
      <TableHeaderFilter
        active={filters.gender !== ""}
        onChange={(value) => setFilter("gender", value as CandidateFilterState["gender"])}
        options={[
          { value: "", label: t("common.all") },
          ...CANDIDATE_GENDER_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          })),
        ]}
        title={t("candidates.col.gender")}
        value={filters.gender}
      />
    );
  }

  if (columnId === "group") {
    const values = combineTermGroupFilterValues(filters);
    return (
      <CheckboxListPopover
        onChange={(next) => {
          const parsed = splitTermGroupFilterValues(next);
          setFilter("termIds", []);
          setFilter("groupIds", parsed.groupIds);
        }}
        options={periodGroupOptions}
        placeholder={t("candidates.filters.periodGroupIds")}
        searchable={periodGroupOptions.length > 8}
        title={t("candidates.filters.periodGroupIds")}
        triggerVariant="icon"
        values={values}
      />
    );
  }

  if (columnId === "eSinavAttemptCount" || columnId === "drivingExamAttemptCount") {
    const attemptOptions = candidateAttemptFilterOptions(
      filters.examAttemptCount,
      columnId,
      pageScope
    );
    return (
      <CheckboxListPopover
        onChange={(next) => setFilter("examAttemptCount", next as CandidateFilterState["examAttemptCount"])}
        options={attemptOptions}
        placeholder={columnLabel}
        triggerVariant="icon"
        title={columnLabel}
        values={filters.examAttemptCount}
      />
    );
  }

  if (columnId === "eSinavPoolStatus") {
    return (
      <CheckboxListPopover
        onChange={(next) => setFilter("examStatus", next as CandidateFilterState["examStatus"])}
        options={[
          { value: "e_sinav_havuz", label: "E-Sınav Havuz" },
          { value: "e_sinav_basarisiz", label: "E-Sınav Başarısız" },
          { value: "e_sinav_randevulu", label: "E-Sınav Randevulu" },
          { value: "direksiyon_havuz", label: "Direksiyon Havuz" },
          { value: "direksiyon_basarisiz", label: "Direksiyon Başarısız" },
          { value: "direksiyon_randevulu", label: "Direksiyon Randevulu" },
          { value: "parked", label: candidateStatusLabel("parked") },
          { value: "graduated", label: candidateStatusLabel("graduated") },
          { value: "dropped", label: candidateStatusLabel("dropped") },
        ]}
        placeholder={columnLabel}
        triggerVariant="icon"
        title={columnLabel}
        values={filters.examStatus}
      />
    );
  }

  if (columnId === "drivingExamAttendanceStatus") {
    return (
      <TableHeaderFilter
        active={filters.drivingExamAttendanceStatus !== ""}
        onChange={(value) =>
          setFilter(
            "drivingExamAttendanceStatus",
            value as CandidateFilterState["drivingExamAttendanceStatus"]
          )
        }
        options={[
          { value: "", label: t("common.all") },
          { value: "attended", label: "Girdi" },
          { value: "absent", label: "Girmedi" },
          { value: "reported", label: "Raporlu" },
        ]}
        title={columnLabel}
        value={filters.drivingExamAttendanceStatus}
      />
    );
  }

  if (columnId === "totalFee" || columnId === "totalPaid" || columnId === "totalDebt") {
    const minKey = `${columnId}Min` as "totalFeeMin" | "totalPaidMin" | "totalDebtMin";
    const maxKey = `${columnId}Max` as "totalFeeMax" | "totalPaidMax" | "totalDebtMax";
    return (
      <NumberRangeHeaderFilter
        active={filters[minKey] !== "" || filters[maxKey] !== ""}
        max={filters[maxKey]}
        min={filters[minKey]}
        onApply={(min, max) => {
          setFilter(minKey, min);
          setFilter(maxKey, max);
        }}
        onClear={() => {
          setFilter(minKey, "");
          setFilter(maxKey, "");
        }}
        title={columnLabel}
      />
    );
  }

  return null;
}
