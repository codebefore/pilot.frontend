import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { candidateKeys, useCandidates, useCandidateTags } from "../lib/queries/use-candidates";
import { useGroups } from "../lib/queries/use-groups";
import { useNavigate, useSearchParams } from "react-router-dom";

import { CandidateExamDateSidebar } from "../components/candidates/CandidateExamDateSidebar";
import { CandidateFilterPanel } from "../components/candidates/CandidateFilterPanel";
import { CandidateDrawer } from "../components/drawers/CandidateDrawer";
import { DownloadIcon, PlusIcon } from "../components/icons";
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
  termGroupTermFilterValue,
  type CandidateFilterState,
} from "../lib/candidate-filters";
import { formatLocalDateOnly, todayLocalDateOnly } from "../lib/date-only";
import {
  assignCandidatesToExamDate,
  applyStatusToCandidates,
  applyTagsToCandidates,
} from "../lib/candidate-bulk";
import {
  assignCandidateGroup,
  getCandidateById,
  createCandidateTag,
  type GetCandidatesParams,
  type CandidateSortField,
  type SortDirection,
} from "../lib/candidates-api";
import {
  chargeCandidateExamAttempt,
  updateCandidateExamAttempt,
} from "../lib/candidate-exam-attempts-api";
import { getGroups } from "../lib/groups-api";
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
import { ApiError, isAbortError } from "../lib/http";
import {
  buildLicenseClassTotalSummaryItems,
  formatLicenseClassTotalSummary,
} from "../lib/exam-schedule-summary";
import {
  DRIVING_EXAM_TIME_SLOT_LABELS,
  DRIVING_EXAM_TIME_SLOTS,
} from "../lib/driving-exam-time-slots";
import { setPracticeCandidateScope } from "../lib/practice-candidate-scope";
import { useLanguage, useT } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { canManageArea } from "../lib/permissions";
import {
  candidateExamResultLabel,
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
import { normalizeTextQuery } from "../lib/search";
import type { JobStatus } from "../types";
import type {
  CandidateExamFeeStatus,
  CandidateExamAttemptResponse,
  CandidateExamAttemptUpsertRequest,
  CandidateResponse,
  CandidateTag,
  ExamCodeOption,
  ExamScheduleLicenseClassCount,
  ExamScheduleOption,
  GroupResponse,
  InstructorResponse,
  LicenseClass,
  PagedResponse,
  VehicleResponse,
} from "../lib/types";
import {
  mergeLicenseClassOptionsWithValues,
  useLicenseClassOptions,
} from "../lib/use-license-class-options";
import { useColumnVisibility } from "../lib/use-column-visibility";

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

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const TEXT_DEBOUNCE_MS = 300;
const BULK_STATUS_OPTIONS = CANDIDATE_STATUS_OPTIONS;

type SortState = { field: CandidateSortField; direction: SortDirection } | null;
type CandidateColumnPageScope = "all" | "eSinav" | "uygulama";

function candidateListTabLabel(value: CandidateTab, t: ReturnType<typeof useT>): string {
  return value === "all" ? t("common.all") : candidateStatusLabel(value);
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
  | "eSinavTheoryExamFeeStatus"
  | "eSinavRightsExpiryDate"
  | "eSinavPoolStatus"
  | "drivingExamDate"
  | "drivingExamCode"
  | "drivingExamTime"
  | "drivingExamVehiclePlate"
  | "drivingExamInstructor"
  | "drivingExamAttemptCount"
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
    | "candidates.col.eSinavTheoryExamFeeStatus"
    | "candidates.col.eSinavRightsExpiryDate"
    | "candidates.col.eSinavPoolStatus"
    | "candidates.col.drivingExamDate"
    | "candidates.col.drivingExamCode"
    | "candidates.col.drivingExamTime"
    | "candidates.col.drivingExamVehiclePlate"
    | "candidates.col.drivingExamInstructor"
    | "candidates.col.drivingExamAttemptCount"
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
};

type ExamChargePromptState = {
  examType: CandidateExamDateType;
  rows: ExamChargeCandidateRow[];
};

function examChargeTitle(examType: CandidateExamDateType): string {
  return examType === "e_sinav" ? "E-Sınav borçlandırması" : "Direksiyon sınav borçlandırması";
}

function candidateFullName(candidate: CandidateResponse): string {
  return `${candidate.firstName} ${candidate.lastName}`.trim();
}

function buildExamAttemptPayload(
  attempt: CandidateExamAttemptResponse,
  fee: number
): CandidateExamAttemptUpsertRequest {
  return {
    examType: attempt.examType,
    scheduledAt: attempt.scheduledAt,
    attemptNumber: attempt.attemptNumber,
    score: attempt.score,
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
    <div className="cand-inline-edit-cell" onClick={(event) => event.stopPropagation()}>
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
  label: string;
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
    <div className="cand-inline-edit-cell" onClick={(event) => event.stopPropagation()}>
      {editing ? (
        <CustomSelect
          aria-label={ariaLabel}
          className="cand-inline-edit-select"
          disabled={disabled}
          onBlur={onCancel}
          onChange={(event) => onSave(event.target.value)}
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
  if (status === "charged") return t("candidatesPage.examFee.charged");
  return t("candidatesPage.examFee.pending");
}

function examFeeStatusPill(status: CandidateExamFeeStatus | null | undefined): JobStatus {
  if (status === "paid") return "success";
  if (status === "charged") return "warning";
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

type CandidateExamStage = "eSinav" | "practice";
type CandidateUnifiedExamStatus = "havuz" | "randevulu" | "basarisiz" | "basarili";

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
  return candidate.educationPlan?.requiresTheoryExam === false ||
    hasPassedExamResult(candidate.mebExamResult) ||
    candidate.status === "graduated";
}

function candidateUnifiedExamStage(candidate: CandidateResponse): CandidateExamStage {
  return candidateUsesPracticeStage(candidate) ? "practice" : "eSinav";
}

function candidateUnifiedExamStatus(candidate: CandidateResponse): {
  stage: CandidateExamStage;
  status: CandidateUnifiedExamStatus;
} {
  const stage = candidateUnifiedExamStage(candidate);
  if (stage === "eSinav") {
    if (hasFailedExamResult(candidate.mebExamResult)) return { stage, status: "basarisiz" };
    return { stage, status: candidate.mebExamDate ? "randevulu" : "havuz" };
  }

  if (candidate.status === "graduated") return { stage, status: "basarili" };
  if (candidate.drivingExamDate) return { stage, status: "randevulu" };
  if ((candidate.drivingExamAttemptCount ?? 1) > 1) return { stage, status: "basarisiz" };
  return { stage, status: "havuz" };
}

function examStageLabel(stage: CandidateExamStage, t: ReturnType<typeof useT>): string {
  return stage === "practice" ? t("candidatesPage.examStage.practice") : t("candidatesPage.examStage.eSinav");
}

function examStatusLabel(status: CandidateUnifiedExamStatus, t: ReturnType<typeof useT>): string {
  if (status === "randevulu") return t("candidatesPage.examStatus.scheduled");
  if (status === "basarisiz") return t("candidatesPage.examStatus.failed");
  if (status === "basarili") return t("candidatesPage.examStatus.passed");
  return t("candidatesPage.examStatus.pool");
}

function examStatusPill(status: CandidateUnifiedExamStatus): "queued" | "running" | "failed" | "success" {
  if (status === "randevulu") return "running";
  if (status === "basarisiz") return "failed";
  if (status === "basarili") return "success";
  return "queued";
}

function CandidateUnifiedExamAttemptPill({ candidate }: { candidate: CandidateResponse }) {
  const t = useT();
  const stage = candidateUnifiedExamStage(candidate);
  const value = stage === "practice"
    ? candidate.drivingExamAttemptCount
    : candidate.eSinavAttemptCount;
  const attempt = Math.min(Math.max(value ?? 1, 1), 4);
  const status = attempt >= 4 ? "failed" : attempt >= 2 ? "manual" : "success";
  return (
    <StatusPill
      label={`${examStageLabel(stage, t)} ${attempt}/4`}
      status={status}
    />
  );
}

function CandidateUnifiedExamStatusPill({ candidate }: { candidate: CandidateResponse }) {
  const t = useT();
  const { stage, status } = candidateUnifiedExamStatus(candidate);
  const stageLabel = examStageLabel(stage, t);
  const statusLabel = examStatusLabel(status, t);
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

function ExamAttemptPill({ value }: { value: number | null | undefined }) {
  const attempt = Math.min(Math.max(value ?? 1, 1), 4);
  const status = attempt >= 4 ? "failed" : attempt >= 2 ? "manual" : "success";
  return <StatusPill label={`${attempt}/4`} status={status} />;
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
      <CandidateAvatar candidate={c} className="cand-avatar-cell" />
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
    renderCell: (c) => formatOptionalText(c.phoneNumber),
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
    sortField: "groupTitle",
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
    renderCell: (c) => formatDateTR(c.mebExamDate),
    skeletonWidth: 88,
  },
  {
    id: "eSinavAttemptCount",
    pageScope: "eSinav",
    labelKey: "candidates.col.eSinavAttemptCount",
    renderCell: (c, pageScope) =>
      pageScope === "eSinav"
        ? <ExamAttemptPill value={c.eSinavAttemptCount} />
        : <CandidateUnifiedExamAttemptPill candidate={c} />,
    skeletonWidth: 104,
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
    renderCell: (c) => <CandidateUnifiedExamStatusPill candidate={c} />,
    skeletonWidth: 128,
  },
  {
    id: "drivingExamDate",
    pageScope: "uygulama",
    labelKey: "candidates.col.drivingExamDate",
    renderCell: (c) => formatDateTR(c.drivingExamDate),
    skeletonWidth: 88,
  },
  {
    id: "drivingExamCode",
    pageScope: "uygulama",
    labelKey: "candidates.col.drivingExamCode",
    renderCell: (c) => formatOptionalText(c.drivingExamCode),
    skeletonWidth: 88,
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
    renderCell: (c) => <ExamAttemptPill value={c.drivingExamAttemptCount} />,
    skeletonWidth: 64,
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
    headerClassName: "cand-money-th",
    cellClassName: "cand-money-td",
    renderCell: (c) => <span className="cand-money">{formatCurrencyTRY(c.totalFee)}</span>,
    skeletonWidth: 88,
  },
  {
    id: "totalPaid",
    labelKey: "candidates.col.totalPaid",
    headerClassName: "cand-money-th",
    cellClassName: "cand-money-td",
    renderCell: (c) => <span className="cand-money">{formatCurrencyTRY(c.totalPaid)}</span>,
    skeletonWidth: 88,
  },
  {
    id: "totalDebt",
    labelKey: "candidates.col.totalDebt",
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
    sortField: "missingDocumentCount",
    renderCell: (c) => (
      <CandidateDocumentBadge
        loadMissingDocumentNames={async () => {
          const result = await getDocumentChecklist({
            status: "missing",
            search: c.nationalId,
            page: 1,
            pageSize: 1,
          });
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
    sortField: "missingDocumentCount",
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
    "status",
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
    "status",
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
    "status",
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
    "status",
    "graduationDate",
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
    "status",
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
    "eSinavTheoryExamFeeStatus",
    "eSinavRightsExpiryDate",
  ],
  basarisiz: [
    "photo",
    "name",
    "licenseClass",
    "group",
    "eSinavAttemptCount",
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
    "drivingExamFeeStatus",
  ],
  basarisiz: [
    "photo",
    "name",
    "licenseClass",
    "group",
    "drivingExamAttemptCount",
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
  showLicenseClassTotalSummary?: boolean;
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
  showBulkPracticeTrainingAction?: boolean;
  showFiltersAction?: boolean;
  showTabs?: boolean;
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
  columnStorageKey = "candidates.columns.v18",
  defaultVisibleColumnIds: defaultVisibleColumnIdsProp,
  columnLabelOverrides,
  showCreateCandidateAction = true,
  showBulkGroupAction = true,
  showBulkStatusAction = true,
  showBulkPracticeTrainingAction = true,
  showFiltersAction = true,
  showTabs = true,
  defaultTab = DEFAULT_TAB,
  groupColumnMode = "group",
  examDateSidebar,
  tabConfig,
}: CandidatesPageProps = {}) {
  const t = useT();
  const { lang } = useLanguage();
  const { user, permissions } = useAuth();
  const canManageCandidates = canManageArea(user, permissions, "candidates");
  const canManageGroups = canManageArea(user, permissions, "groups");
  const noPermissionTitle = t("common.noPermission");
  const { options: licenseClassOptions } = useLicenseClassOptions();
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
        if ((tab === "graduated" || tab === "dropped") && column.id === "eSinavAttemptCount") {
          return false;
        }
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
  const [sort, setSort] = useState<SortState>(null);
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
  const [selectedDrivingExamCode, setSelectedDrivingExamCode] = useState("");
  const [examDateTabNeutral, setExamDateTabNeutral] = useState(false);
  const [examSidebarTab, setExamSidebarTab] = useState<"dates" | "codes">("dates");
  const [editingPracticeCell, setEditingPracticeCell] = useState<{
    candidateId: string;
    field: "time" | "vehicle" | "instructor";
  } | null>(null);
  const [savingPracticeCandidateId, setSavingPracticeCandidateId] = useState<string | null>(null);

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
  const practiceVehicles: VehicleResponse[] = practiceVehiclesQuery.data?.items ?? [];

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
  const examDateOptionsLoading = !!examScheduleOptionsParams && examDateOptionsQuery.isFetching;

  // Tag catalog for the filter bar. Tag mutations from within this page do
  // optimistic queryClient.setQueryData updates; cross-page mutations
  // invalidate via candidateKeys.tags() in the use-candidates mutation hooks.
  const allTagsQuery = useCandidateTags("", 200, true, false);
  const allTags: CandidateTag[] = allTagsQuery.data ?? [];

  // Group catalog for the "Grup" column header filter.
  const headerGroupCatalogQuery = useGroups({ pageSize: 200 }, true, false);
  const headerGroupCatalog: GroupResponse[] = headerGroupCatalogQuery.data?.items ?? [];

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
  const effectiveColumnStorageKey =
    showTabs && !defaultVisibleColumnIdsProp && TAB_KEYS.includes(tab as CandidateTab)
      ? `${columnStorageKey}.${tab}`
      : columnStorageKey;
  const {
    visibleIds,
    isVisible,
    toggle: toggleColumn,
    reset: resetColumns,
  } = useColumnVisibility(
    effectiveColumnStorageKey,
    orderedAvailableColumnIds,
    defaultVisibleColumnIdsProp
      ? scopedDefaultVisibleColumnIds
      : scopedDefaultVisibleColumnIds.length > 0
        ? scopedDefaultVisibleColumnIds
        : undefined,
    { allowEmpty: lockedVisibleColumnIds.length > 0 }
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

  const savePracticeAttemptField = async (
    candidate: CandidateResponse,
    patch: { time?: string; vehicleId?: string; instructorId?: string }
  ) => {
    if (!canManageCandidates) return;
    if (!candidate.drivingExamAttemptId || !candidate.drivingExamAttemptRowVersion) {
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
    if (!scheduledAt) {
      showToast(t("candidates.toast.examTimeUpdateFailed"), "error");
      return;
    }

    setSavingPracticeCandidateId(candidate.id);
    try {
      const updated = await updateCandidateExamAttempt(candidate.id, candidate.drivingExamAttemptId, {
        examType: "practice",
        scheduledAt,
        attemptNumber: candidate.drivingExamAttemptCount ?? 1,
        score: null,
        expiresAt: null,
        examScheduleId: candidate.drivingExamScheduleId ?? null,
        vehicleId: patch.vehicleId !== undefined ? patch.vehicleId || null : candidate.drivingExamVehicleId ?? null,
        vehiclePlate: patch.vehicleId !== undefined ? vehicle?.plateNumber ?? null : candidate.drivingExamVehiclePlate ?? null,
        instructorId: patch.instructorId !== undefined ? patch.instructorId || null : candidate.drivingExamInstructorId ?? null,
        instructorFullName: patch.instructorId !== undefined
          ? instructor ? instructorFullName(instructor) : null
          : candidate.drivingExamInstructorFullName ?? null,
        examAttendanceStatus: candidate.drivingExamAttendanceStatus ?? null,
        examResultStatus: candidate.drivingExamResultStatus ?? null,
        fee: candidate.drivingExamFee ?? 0,
        feeStatus: candidate.drivingExamFeeStatus ?? "pending",
        rowVersion: candidate.drivingExamAttemptRowVersion,
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
                        drivingExamFee: updated.fee,
                        drivingExamFeeStatus: updated.feeStatus,
                        drivingExamAttemptRowVersion: updated.rowVersion,
                      }
                    : item
                ),
              }
            : current
      );
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
        if (columnPageScope === "uygulama" && col.id === "drivingExamTime") {
          return {
            ...col,
            renderCell: (candidate: CandidateResponse) => (
              <DrivingExamTimeCell
                candidate={candidate}
                editing={editingPracticeCell?.candidateId === candidate.id && editingPracticeCell.field === "time"}
                disabled={savingPracticeCandidateId === candidate.id || !canManageCandidates}
                disabledTitle={!canManageCandidates ? noPermissionTitle : undefined}
                onEdit={() => setEditingPracticeCell({ candidateId: candidate.id, field: "time" })}
                onCancel={() => setEditingPracticeCell(null)}
                onSave={(time) => savePracticeAttemptField(candidate, { time })}
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
                  label: vehicle.plateNumber,
                }))}
                editing={editingPracticeCell?.candidateId === candidate.id && editingPracticeCell.field === "vehicle"}
                disabled={savingPracticeCandidateId === candidate.id || !canManageCandidates}
                disabledTitle={!canManageCandidates ? noPermissionTitle : undefined}
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
                disabledTitle={!canManageCandidates ? noPermissionTitle : undefined}
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
      groupColumnMode,
      lang,
      licenseClassLabelByCode,
      practiceInstructors,
      practiceVehicles,
      savePracticeAttemptField,
      savingPracticeCandidateId,
      tab,
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
      : columnPageScope === "uygulama" && col.id === "drivingExamDate" && tab === "basarisiz"
        ? t("candidatesPage.col.lastExamDate")
      : columnPageScope === "uygulama" && col.id === "drivingExamCode"
        ? t("candidatesPage.col.lastExamCode")
        : null) ??
    columnLabelOverrides?.[col.id] ??
    ((col.id === "group" && groupColumnMode === "term")
      ? t("candidates.col.term")
      : t(col.labelKey));
  const visibleBulkStatusOptions = useMemo(
    () => BULK_STATUS_OPTIONS,
    []
  );
  const headerPeriodGroupOptions = useMemo(() => {
    const terms = Array.from(
      new Map(headerGroupCatalog.map((group) => [group.term.id, group.term])).values()
    ).sort(compareTermsDesc);
    return [
      ...terms.map((term) => ({
        value: termGroupTermFilterValue(term.id),
        label: buildTermLabel(term, terms, lang),
      })),
      ...headerGroupCatalog.map((group) => ({
        value: termGroupGroupFilterValue(group.id),
        label: buildGroupHeading(group.title, group.term, terms, lang),
      })),
    ];
  }, [headerGroupCatalog, lang]);

  const pickerOptions: ColumnOption[] = resolvedColumns
    .filter((col) => !col.pickerHidden && !forcedVisibleColumnIds.has(col.id))
    .sort((left, right) => availableColumnIds.indexOf(left.id) - availableColumnIds.indexOf(right.id))
    .map((col) => ({
      id: col.id,
      label: getColumnLabel(col),
    }));
  const selectedCount = selectedCandidateIds.size;
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
      ? { eSinavDate: selectedExamDate }
      : { drivingExamDate: selectedExamDate };
  }, [examDateSidebar, isDrivingExamCodeTabActive, selectedDrivingExamCode, selectedExamDate]);
  const displayedExamDateOptions = useMemo(
    () => sortExamDateOptionsNewestFirst(examDateOptions),
    [examDateOptions]
  );
  const showLicenseClassSummary =
    !!examDateSidebar?.showLicenseClassTotalSummary &&
    (examSidebarTab === "dates" || !!selectedDrivingExamCode);
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
    setSelectedExamDate("");
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
    return {
      search: normalizeTextQuery(debouncedSearch),
      ...tabParams,
      tags: activeTags.length > 0 ? activeTags : undefined,
      ...filtersToQuery(debouncedFilters),
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

  const candidatesQuery = useCandidates(candidatesRequestParams, true, false);
  const candidates = candidatesQuery.data?.items ?? [];
  const totalPages = candidatesQuery.data?.totalPages ?? 1;
  const loading = candidatesQuery.isLoading;
  const candidateLicenseClassCounts: ExamScheduleLicenseClassCount[] =
    candidatesQuery.isError ? [] : candidatesQuery.data?.licenseClassCounts ?? [];
  const compactLicenseClassOptions = useMemo(
    () =>
      mergeLicenseClassOptionsWithValues(licenseClassOptions, [
        ...filters.licenseClasses,
        ...candidates.map((candidate) => candidate.licenseClass),
        ...candidateLicenseClassCounts.map((item) => item.licenseClass),
      ]).map((option) => ({
        value: option.value,
        label: option.value,
      })),
    [candidateLicenseClassCounts, candidates, filters.licenseClasses, licenseClassOptions]
  );
  const getColumnFilterControl = (col: CandidateColumnDef) =>
    buildCandidateColumnFilterControl(
      col.id,
      filters,
      handleFilterChange,
      compactLicenseClassOptions,
      headerPeriodGroupOptions,
      t,
      lang
    );
  const licenseClassTotalSummary = useMemo(
    () =>
      showLicenseClassSummary
        ? formatLicenseClassTotalSummary(candidateLicenseClassCounts)
        : "",
    [candidateLicenseClassCounts, showLicenseClassSummary]
  );
  const licenseClassTotalSummaryItems = useMemo(
    () =>
      showLicenseClassSummary
        ? buildLicenseClassTotalSummaryItems(candidateLicenseClassCounts)
        : [],
    [candidateLicenseClassCounts, showLicenseClassSummary]
  );

  useEffect(() => {
    if (candidatesQuery.isError && !isAbortError(candidatesQuery.error)) {
      showToast(t("candidates.toast.loadFailed"), "error");
    }
  }, [candidatesQuery.error, candidatesQuery.isError, showToast, t]);

  const invalidateCandidates = () => {
    void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
  };
  const refreshAll = () => {
    invalidateCandidates();
    void queryClient.invalidateQueries({ queryKey: candidateKeys.tags("") });
    void queryClient.invalidateQueries({ queryKey: ["groups", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["examCodes"] });
    void queryClient.invalidateQueries({ queryKey: ["candidates", "examScheduleOptions"] });
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

    if (!displayedExamDateOptions.some((option) => option.date === selectedExamDate)) {
      setSelectedExamDate("");
    }
  }, [
    displayedExamDateOptions,
    examDateOptionsLoading,
    examDateSidebar,
    selectedExamDate,
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
      if (selectedExamDate === option.date) {
        setSelectedExamDate("");
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
    const errorCode = error instanceof ApiError ? error.errorCode : undefined;
    if (errorCode === "examScheduleDatePassed") {
      return t("candidates.toast.examScheduleDeletePastDate");
    }
    if (errorCode === "examScheduleHasCandidates") {
      return t("candidates.toast.examScheduleDeleteHasCandidates");
    }
    return fallback;
  };

  const handleExamDateEdit = async (option: ExamScheduleOption, date: string, time?: string) => {
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
        capacity: option.capacity,
      });
      if (selectedExamDate === option.date) {
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
    if (examDateSidebar && value === "havuz") {
      setSelectedExamDate("");
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

  const handleExamDateSelect = (value: string) => {
    if (value) {
      setSelectedDrivingExamCode("");
    }
    const neutral = Boolean(value && isPastIsoDate(value));
    setExamDateTabNeutral(neutral);
    if (value && examDateSidebar && tab === "havuz" && !neutral) {
      setTab("randevulu");
    }
    setPage(1);
    setSelectedExamDate(value);
  };

  const handleExamCodeSelect = (value: string) => {
    setSelectedExamDate("");
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

    const normalized = name.toLocaleLowerCase("tr-TR");
    const existing = allTags.find(
      (tag) => tag.name.toLocaleLowerCase("tr-TR") === normalized
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

  const handleSubmitNew = () => {
    setModalOpen(false);
    setPage(1);
    refreshAll();
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
      candidate.nationalId,
      formatOptionalText(candidate.phoneNumber),
      formatDateTR(candidate.birthDate),
      formatOptionalText(candidateGenderLabel(candidate.gender)),
      candidate.licenseClass,
      groupColumnMode === "term"
        ? formatCandidateTerm(candidate, lang)
        : formatGroupWithTerm(candidate, lang),
      formatDateTR(candidate.mebExamDate),
      `${candidate.eSinavAttemptCount ?? 1}/4`,
      formatDateTR(candidate.drivingExamDate),
      `${candidate.drivingExamAttemptCount ?? 1}/4`,
      candidate.documentSummary?.completedCount ?? 0,
      candidate.documentSummary?.missingCount ?? 0,
      candidateMebSyncStatusLabel(candidate.mebSyncStatus),
      candidateExamResultLabel(candidate.mebExamResult),
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

  const openPracticeTrainingForSelected = () => {
    if (!canManageCandidates) return;
    if (selectedCandidateIds.size === 0) {
      showToast(t("candidates.toast.selectAtLeastOne"), "error");
      return;
    }
    // localStorage'a yaz, sonra uygulama sayfasına yönlendir.
    // İlk seçili aday QA'da default seçili gelir; diğerleri scope'ta
    // toggle olarak listelenir.
    const ids = Array.from(selectedCandidateIds);
    setPracticeCandidateScope(ids);
    navigate(`/training/uygulama?candidateId=${encodeURIComponent(ids[0])}`);
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
      const result = await getGroups({ pageSize: 100 });
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
      displayedExamDateOptions.some((option) => option.date === selectedExamDate)
        ? displayedExamDateOptions.find((option) => option.date === selectedExamDate)?.id ?? ""
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

      const chargeRows = result.assignedCandidates.flatMap(({ candidate, attempt }) =>
        attempt ? [{ candidate, attempt, fee: String(attempt.fee ?? 0) }] : []
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
    const prepared = examChargePrompt.rows.map((row) => ({
      ...row,
      amount: Number(row.fee),
    }));
    if (prepared.some((row) => !Number.isFinite(row.amount) || row.amount < 0)) {
      showToast("Sınav ücreti 0 veya daha büyük olmalı", "error");
      return;
    }

    setExamChargeSaving(true);
    try {
      await Promise.all(
        prepared.map(async (row) => {
          const updatedAttempt = await updateCandidateExamAttempt(
            row.candidate.id,
            row.attempt.id,
            buildExamAttemptPayload(row.attempt, row.amount)
          );
          await chargeCandidateExamAttempt(row.candidate.id, updatedAttempt.id);
        })
      );
      showToast(`${prepared.length} aday için sınav borçlandırması yapıldı`);
      setExamChargePrompt(null);
      setExamChargeModalOpen(false);
      refreshAll();
    } catch {
      showToast("Sınav borçlandırması yapılamadı", "error");
    } finally {
      setExamChargeSaving(false);
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
        {licenseClassTotalSummary ? (
          <span
            aria-label={t("candidates.aria.licenseClassSummary")}
            className="tag-filter-summary-chip tag-filter-license-summary"
          >
            {licenseClassTotalSummaryItems.map((item, index) => (
              <Fragment key={item.licenseClass}>
                {index > 0 ? " " : null}
                <span className="tag-filter-license-summary-item">
                  <span className="tag-filter-license-summary-class">{item.licenseClass}</span>
                  <span className="tag-filter-license-summary-count">({item.count})</span>
                </span>
              </Fragment>
            ))}
          </span>
        ) : null}
      </div>

      <div className="table-wrap spaced">
        <table className="data-table cand-table">
          <thead>
            <tr>
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
              {visibleColumns.map((col) => {
                const label = getColumnLabel(col);
                const filterControl = getColumnFilterControl(col);
                return col.sortField ? (
                  <SortableTh
                    className={col.headerClassName}
                    filterControl={filterControl}
                    key={col.id}
                    field={col.sortField}
                    label={label}
                    onToggle={handleSortToggle}
                    sort={sort}
                  />
                ) : (
                  <th aria-label={label} className={col.headerClassName} key={col.id}>
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
                    <td className="cand-select-td" />
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
                  colSpan={visibleColumns.length + 2}
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
                  {visibleColumns.map((col) => {
                    const opensDrawer = col.id === "photo" || col.id === "name";
                    return (
                      <td
                        className={`${col.cellClassName ?? ""} cand-row-cell${
                          opensDrawer ? " cand-row-cell--drawer" : ""
                        }`}
                        key={col.id}
                        onClick={() =>
                          opensDrawer ? openDrawer(c.id) : navigate(`/candidates/${c.id}`)
                        }
                        title={opensDrawer ? t("candidates.title.quickPreview") : t("candidates.title.goToDetail")}
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
          tabs={resolvedTabConfig.tabs}
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
    <>
      <PageToolbar
        actions={
          <>
              {showFiltersAction ? (
                <label className="switch-toggle cand-filters-switch">
                  <input
                    aria-controls="cand-filters-panel"
                    aria-label={t("candidates.filters.button")}
                    checked={filtersOpen}
                    onChange={(event) => setFiltersOpen(event.target.checked)}
                    type="checkbox"
                  />
                  <span className="switch-toggle-control" aria-hidden="true" />
                  <span>{t("candidates.filters.button")}</span>
                  {activeFilterCount > 0 && !filtersOpen && (
                    <span className="cand-filters-badge">{activeFilterCount}</span>
                  )}
                </label>
              ) : null}
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
                        <option data-secondary={option.examCode ?? undefined} key={option.id} value={option.id}>
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
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={!canManageCandidates}
                        onClick={openBulkExamDateAction}
                        title={!canManageCandidates ? noPermissionTitle : undefined}
                        type="button"
                      >
                        {t("candidates.bulk.setExamDate")}
                      </button>
                    ) : null}
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
                    {showBulkPracticeTrainingAction ? (
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={!canManageCandidates}
                        onClick={openPracticeTrainingForSelected}
                        title={!canManageCandidates ? noPermissionTitle : undefined}
                        type="button"
                      >
                        {t("candidates.bulk.practiceTraining")}
                      </button>
                    ) : null}
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
        />
      ) : null}
      {examDateSidebar ? (
        <div className="candidates-layout">
          <CandidateExamDateSidebar
            actions={[
              {
                label: t("candidatesPage.action.addExamDate"),
                onClick: handleExamDateAddClick,
                disabled: !canManageGroups,
                title: !canManageGroups ? noPermissionTitle : undefined,
              },
            ]}
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
                setExamDateTabNeutral(false);
              }
            }}
            options={displayedExamDateOptions}
            selectedCode={selectedDrivingExamCode}
            selectedDate={selectedExamDate}
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
              disabled={examChargeSaving}
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
              </tr>
            </thead>
            <tbody>
              {examChargePrompt?.rows.map((row) => (
                <tr key={row.candidate.id}>
                  <td>{candidateFullName(row.candidate)}</td>
                  <td>{formatNationalId(row.candidate.nationalId)}</td>
                  <td>{formatOptionalText(row.candidate.phoneNumber)}</td>
                  <td>
                    <input
                      aria-label={`${candidateFullName(row.candidate)} sınav ücreti`}
                      className="exam-charge-fee-input"
                      min="0"
                      onChange={(event) => updateExamChargeFee(row.candidate.id, event.target.value)}
                      step="0.01"
                      type="number"
                      value={row.fee}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
      {examDateSidebar ? (
        <NewExamScheduleModal
          canManage={canManageCandidates}
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
          canManage={canManageCandidates}
          onClose={() => setExamCodeModalOpen(false)}
          onSaved={() => {
            setExamCodeModalOpen(false);
            refreshAll();
          }}
          open={examCodeModalOpen}
        />
      ) : null}
    </>
  );
}

type SortableThProps = {
  field: CandidateSortField;
  filterControl?: React.ReactNode;
  label: string;
  sort: SortState;
  onToggle: (field: CandidateSortField) => void;
  className?: string;
};

function SortableTh({
  field,
  filterControl,
  label,
  sort,
  onToggle,
  className,
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
    <th aria-sort={ariaSort} className={thClassName}>
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
  lang: "tr" | "en"
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
          setFilter("termIds", parsed.termIds);
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

  if (columnId === "documents" || columnId === "missingDocuments") {
    return (
      <TableHeaderFilter
        active={filters.hasMissingDocuments !== ""}
        onChange={(value) =>
          setFilter("hasMissingDocuments", value as CandidateFilterState["hasMissingDocuments"])
        }
        options={[
          { value: "", label: t("common.all") },
          { value: "true", label: lang === "tr" ? "Eksik var" : "Missing" },
          { value: "false", label: lang === "tr" ? "Eksik yok" : "Complete" },
        ]}
        title={t("candidates.filters.hasMissingDocuments")}
        value={filters.hasMissingDocuments}
      />
    );
  }

  return null;
}
