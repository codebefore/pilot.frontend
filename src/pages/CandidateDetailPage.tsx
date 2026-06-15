import { Fragment, useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { JobStatus } from "../types";
import { candidateKeys } from "../lib/queries/use-candidates";
import { groupKeys, useGroup } from "../lib/queries/use-groups";
import { todayLocalDateOnly } from "../lib/date-only";

import { CandidateAvatar } from "../components/ui/CandidateAvatar";
import { CandidateNotesPanel } from "../components/candidates/CandidateNotesPanel";
import { CameraIcon, CheckIcon, PencilIcon, ScannerIcon, TrashIcon, UploadCloudIcon, XIcon } from "../components/icons";
import { DocumentScannerModal } from "../components/modals/DocumentScannerModal";
import { TrainingCalendar } from "../components/training/TrainingCalendar";
import { CandidateTagsInput } from "../components/ui/CandidateTagsInput";
import { EditableRow } from "../components/ui/EditableRow";
import { CustomSelect } from "../components/ui/CustomSelect";
import { ColumnPicker, type ColumnOption } from "../components/ui/ColumnPicker";
import { LocalizedDateInput } from "../components/ui/LocalizedDateInput";
import { LocalizedTimeInput } from "../components/ui/LocalizedTimeInput";
import { Modal } from "../components/ui/Modal";
import { PanelListSkeleton, SettingsTableSkeleton, SkeletonLine } from "../components/ui/Skeleton";
import { TableHeaderFilter } from "../components/ui/TableHeaderFilter";
import type { SelectOption } from "../components/ui/EditableRow";
import { useToast } from "../components/ui/Toast";
import { PageLoadError } from "../components/ui/PageLoadError";
import {
  assignCandidateGroup,
  deleteCandidate,
  getCandidateById,
  removeActiveGroupAssignment,
  setCandidateRegistrationDate,
  setCandidateRegistrationNumber,
  setCandidateSecondPracticeRound,
  setCandidateTheoryExemption,
  updateCandidate,
  updateCandidateExistingLicense,
} from "../lib/candidates-api";
import {
  buildCandidateUpdatePayload as buildBulkCandidateUpdatePayload,
  type CandidatePayloadOverrides,
} from "../lib/candidate-bulk";
import { getExamScheduleOptions } from "../lib/exam-schedules-api";
import {
  cancelCandidateAccountingMovement,
  cancelCandidateAccountingPayment,
  createCandidateAccountingInvoice,
  createCandidateAccountingMovement,
  createCandidateAccountingMovements,
  createCandidateAccountingPayment,
  createCandidateAccountingRefund,
  deleteCandidateAccountingInvoice,
  getCandidateAccounting,
  updateCandidateAccountingInvoice,
} from "../lib/candidate-accounting-api";
import { getCandidateReferences } from "../lib/candidate-references-api";
import {
  chargeCandidateExamAttempt,
  createCandidateExamAttempt,
  deleteCandidateExamAttempt,
  listCandidateExamAttempts,
  markCandidateExamAttemptSelfPaid,
  updateCandidateExamAttempt,
} from "../lib/candidate-exam-attempts-api";
import {
  createCandidateKCertificate,
  deleteCandidateKCertificate,
  listCandidateKCertificates,
} from "../lib/candidate-k-certificates-api";
import { getCashRegisters } from "../lib/cash-registers-api";
import { getLicenseClassFeeMatrix } from "../lib/license-class-fee-matrix-api";
import { getLicenseClassDefinitions } from "../lib/license-class-definitions-api";
import { getInstructors } from "../lib/instructors-api";
import { getGroupById, getGroups } from "../lib/groups-api";
import { getTrainingBranchDefinitions } from "../lib/training-branch-definitions-api";
import { getTrainingLessons } from "../lib/training-lessons-api";
import { getVehicles } from "../lib/vehicles-api";
import {
  trainingLessonToCalendarEvent,
  type TrainingCalendarEvent,
} from "../lib/training-calendar";
import { useColumnVisibility } from "../lib/use-column-visibility";
import { useAuth } from "../lib/auth";
import { canManageArea, canViewArea } from "../lib/permissions";
import { buildBranchHelpers } from "../lib/training-branches";
import {
  DEFAULT_DRIVING_EXAM_TIME,
  DRIVING_EXAM_TIME_SLOTS,
} from "../lib/driving-exam-time-slots";
import { buildTermLabel } from "../lib/term-label";
import { ApiError } from "../lib/http";
import { formatNationalId } from "../lib/national-id";
import {
  createAuthorizedObjectUrl,
  downloadAuthorizedFile,
  printAuthorizedFile,
} from "../lib/authorized-files";
import {
  findLicenseClassDefinitionIdForSelection,
  useActiveLicenseClassDefinitions,
  useCandidateLicenseClassOptions,
  useExistingLicenseTypeOptions,
} from "../lib/use-license-class-options";
import {
  analyzeCandidateDocumentOcr,
  deleteCandidateDocument,
  getCandidateDocumentDownloadUrl,
  getCandidateDocuments,
  getDocumentTypes,
  updateCandidateDocument,
  updateCandidateDocumentMebbisTransfer,
  uploadDocument,
} from "../lib/documents-api";
import { createCandidateSyncJob, getMebbisJob } from "../lib/mebbis-jobs-api";
import {
  CANDIDATE_GENDER_OPTIONS,
  CANDIDATE_STATUS_OPTIONS,
  candidateGenderLabel,
  candidateStatusLabel,
  candidateStatusToPill,
  existingLicenseTypeLabel,
  TURKEY_PROVINCE_OPTIONS,
  formatDateTR,
  normalizeCandidateExamResultValue,
  normalizeCandidateGender,
} from "../lib/status-maps";
import { toTurkishUpperCase } from "../lib/text-format";
import { StatusPill } from "../components/ui/StatusPill";
import type {
  CandidateResponse,
  CandidateGroupAssignmentResponse,
  CandidateContactResponse,
  CandidateContactType,
  CandidateContactUpsertRequest,
  CandidateExistingLicenseRequest,
  CandidateUpsertRequest,
  CandidateAccountingInvoiceResponse,
  CandidateAccountingSummaryResponse,
  CandidateAccountingType,
  CandidateExamAttemptResponse,
  CandidateExamFeeStatus,
  CandidateExamType,
  CandidateKCertificateResponse,
  CandidatePaymentMethod,
  CashRegisterResponse,
  LicenseClassFeeRowResponse,
  LicenseClassDefinitionResponse,
  CandidateDocumentOcrSuggestionResponse,
  DocumentMetadataField,
  DocumentResponse,
  DocumentTypeResponse,
  ExamScheduleOption,
  InstructorResponse,
  TrainingBranchDefinitionResponse,
  TrainingLessonResponse,
  VehicleResponse,
} from "../lib/types";
import { useT, type TranslationKey } from "../lib/i18n";
import {
  addDays,
  addHours,
  buildFutureStages,
  calculateAge,
  dateOnlyAt,
  formatTimelineDate,
  hasExistingLicenseValue,
  isExistingLicenseCopyType,
  normalizeLicenseOptionKey,
  nowDateTimeLocal,
  todayIsoDate,
  vehicleTypeForLicenseClass,
} from "./CandidateDetailPage.helpers";

const INVOICE_TYPE_OPTIONS = ["Satış", "İade", "İptal"];

type TabKey =
  | "general"
  | "license"
  | "training"
  | "documents"
  | "payments";

const TABS: { key: TabKey; labelKey: TranslationKey }[] = [
  { key: "general", labelKey: "candidateDetail.tab.general" },
  { key: "license", labelKey: "candidateDetail.tab.license" },
  { key: "documents", labelKey: "candidateDetail.tab.documents" },
  { key: "training", labelKey: "candidateDetail.tab.training" },
  { key: "payments", labelKey: "candidateDetail.tab.payments" },
];

const HERO_DOCUMENT_KEYS = ["application_form", "identity_card", "existing_license_copy"] as const;
type HeroDocumentKey = (typeof HERO_DOCUMENT_KEYS)[number];

const candidateTargetFeeMatrixKey = (year: number, targetLicenseClass: string) =>
  ["finance", "license-class-fee-matrix", year, targetLicenseClass] as const;

function notifyMebbisJobQueued(jobId: string, jobType: string): void {
  const delays = [0, 250, 1000, 2500];
  for (const delay of delays) {
    window.setTimeout(() => {
      window.postMessage(
        {
          type: "pilot:mebbis-job-queued",
          jobId,
          jobType,
        },
        window.location.origin
      );
    }, delay);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function buildCandidateUpdatePayload(
  candidate: CandidateResponse,
  patch: Partial<CandidateUpsertRequest>
): CandidateUpsertRequest {
  return {
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    nationalId: candidate.nationalId,
    identitySerialNumber: candidate.identitySerialNumber,
    motherName: candidate.motherName,
    fatherName: candidate.fatherName,
    phoneNumber: candidate.phoneNumber,
    address: candidate.address,
    birthDate: candidate.birthDate,
    birthPlace: candidate.birthPlace,
    gender: normalizeCandidateGender(candidate.gender),
    licenseClass: candidate.licenseClass,
    hasExistingLicense: candidate.hasExistingLicense ?? hasExistingLicenseValue(candidate.existingLicenseType),
    existingLicenseType: candidate.existingLicenseType,
    existingLicenseIssuedAt: candidate.existingLicenseIssuedAt,
    existingLicenseNumber: candidate.existingLicenseNumber,
    existingLicenseIssuedProvince: candidate.existingLicenseIssuedProvince,
    existingLicensePre2016: candidate.existingLicensePre2016,
    status: candidate.status,
    mebSyncStatus: candidate.mebSyncStatus,
    mebExamDate: candidate.mebExamDate,
    drivingExamDate: candidate.drivingExamDate,
    mebExamResult: candidate.mebExamResult,
    eSinavAttemptCount: candidate.eSinavAttemptCount,
    drivingExamAttemptCount: candidate.drivingExamAttemptCount,
    contacts: buildCandidateContactPayload(candidate),
    tags: candidate.tags?.map((tag) => tag.name) ?? [],
    rowVersion: candidate.rowVersion,
    ...patch,
  };
}

const CONTACT_TYPE_LABEL_KEYS: Record<CandidateContactType, TranslationKey> = {
  phone: "candidateDetail.contactType.phone",
  address: "candidateDetail.contactType.address",
  other: "candidateDetail.contactType.other",
};

async function loadReferenceOptions(
  currentValue: string | null,
  t: ReturnType<typeof useT>,
  signal?: AbortSignal,
): Promise<SelectOption[]> {
  const items = await getCandidateReferences(undefined, signal);
  const options: SelectOption[] = [
    { value: "", label: "—" },
    ...items.map((item) => ({ value: item.name, label: item.name })),
  ];
  if (currentValue && !items.some((item) => item.name === currentValue)) {
    options.push({ value: currentValue, label: t("candidateDetail.reference.inactive", { name: currentValue }) });
  }
  return options;
}

function contactTypeLabel(type: CandidateContactType, t: ReturnType<typeof useT>): string {
  return t(CONTACT_TYPE_LABEL_KEYS[type] ?? "candidateDetail.contactType.other");
}


function buildCandidateContacts(candidate: CandidateResponse): CandidateContactResponse[] {
  if (candidate.contacts && candidate.contacts.length > 0) {
    return [...candidate.contacts].sort((a, b) => a.displayOrder - b.displayOrder);
  }

  const contacts: CandidateContactResponse[] = [];
  const push = (type: CandidateContactType, label: string, value: string | null) => {
    if (!value?.trim()) return;
    contacts.push({
      id: "",
      type,
      label,
      value,
      isPrimary: true,
      displayOrder: contacts.length,
      ownerName: null,
    });
  };

  push("phone", "Telefon", candidate.phoneNumber);
  push("address", "Adres", candidate.address);
  return contacts;
}

function buildCandidateContactPayload(candidate: CandidateResponse): CandidateContactUpsertRequest[] {
  return buildCandidateContacts(candidate).map((contact) => ({
    id: contact.id || null,
    type: contact.type,
    label: contact.label,
    value: contact.value,
    isPrimary: contact.isPrimary,
    ownerName: contact.ownerName,
  }));
}

async function updateCandidateField(
  candidate: CandidateResponse,
  patch: Partial<CandidateUpsertRequest>
): Promise<CandidateResponse> {
  return updateCandidate(candidate.id, buildCandidateUpdatePayload(candidate, patch));
}

export function CandidateDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const { user, permissions } = useAuth();
  const canManageCandidates = canManageArea(user, permissions, "candidates");
  const canViewDocuments = canViewArea(user, permissions, "documents");
  const canViewPayments = canViewArea(user, permissions, "payments");
  const canManagePayments = canManageArea(user, permissions, "payments");
  const canManageDocuments = canManageArea(user, permissions, "documents");
  const canManageMebJobs = canManageArea(user, permissions, "mebjobs");
  const canManageTraining = canManageArea(user, permissions, "training");
  const { candidateId } = useParams<{ candidateId: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [movementSaving, setMovementSaving] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [invoiceSaving, setInvoiceSaving] = useState(false);

  // ── Fetch 1: candidate detail ────────────────────────────────────────────
  const {
    data: candidate = null,
    isLoading: loading,
    isError: isErrorCandidate,
    refetch: refetchCandidate,
  } = useQuery({
    queryKey: candidateId ? candidateKeys.detail(candidateId) : candidateKeys.detail("__missing__"),
    queryFn: ({ signal }) => getCandidateById(candidateId as string, signal),
    enabled: Boolean(candidateId),
    staleTime: 0,
  });
  const error = isErrorCandidate ? t("candidateDetail.error.candidateLoad") : null;
  // setCandidate is used in handlers that mutate and get back a fresh object;
  // bridge to queryClient.setQueryData so the RQ cache stays in sync.
  const setCandidate = (
    updater: CandidateResponse | null | ((prev: CandidateResponse | null) => CandidateResponse | null)
  ) => {
    if (!candidateId) return;
    let nextCandidate: CandidateResponse | null = null;
    if (typeof updater === "function") {
      const prev = queryClient.getQueryData<CandidateResponse>(candidateKeys.detail(candidateId)) ?? null;
      const next = updater(prev);
      if (next !== null) {
        nextCandidate = next;
        queryClient.setQueryData(candidateKeys.detail(candidateId), next);
      }
    } else if (updater !== null) {
      nextCandidate = updater;
      queryClient.setQueryData(candidateKeys.detail(candidateId), updater);
    }
    if (nextCandidate !== null) {
      void queryClient.invalidateQueries({ queryKey: candidateKeys.detail(candidateId) });
      void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: ["candidates", "documents", candidateId] });
      void queryClient.invalidateQueries({ queryKey: ["candidates", "accounting", candidateId] });
      void queryClient.invalidateQueries({ queryKey: ["documents", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["documents", "tabCount"] });
      void queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: groupKeys.details() });
      void queryClient.invalidateQueries({ queryKey: ["training", "groups"] });
      void queryClient.invalidateQueries({ queryKey: ["training", "lessons"] });
      void queryClient.invalidateQueries({ queryKey: ["payments"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  };

  // ── Fetch 2: documents + document types (lazy: only when documents tab is open) ──
  const {
    data: documents = null,
    isLoading: documentsLoading,
    isError: isErrorDocuments,
  } = useQuery({
    queryKey: candidateId ? ["candidates", "documents", candidateId] : ["candidates", "documents", "__missing__"],
    queryFn: ({ signal }) => getCandidateDocuments(candidateId as string, signal),
    enabled: Boolean(candidateId) && activeTab === "documents",
    staleTime: 0,
  });
  const {
    data: documentTypes = null,
    isLoading: documentTypesLoading,
    isError: isErrorDocumentTypes,
  } = useQuery({
    queryKey: ["documentTypes", "candidate"],
    queryFn: ({ signal }) => getDocumentTypes({ module: "candidate", includeInactive: false }, signal),
    enabled: activeTab === "documents",
  });
  const documentsError = (isErrorDocuments || isErrorDocumentTypes) ? t("candidateDetail.error.documentsLoad") : null;
  const combinedDocumentsLoading = documentsLoading || documentTypesLoading;

  // ── Fetch 3: candidate accounting ───────────────────────────────────────
  const {
    data: accounting = null,
    isLoading: accountingLoading,
    isError: isErrorAccounting,
  } = useQuery({
    queryKey: candidateId ? ["candidates", "accounting", candidateId] : ["candidates", "accounting", "__missing__"],
    queryFn: ({ signal }) => getCandidateAccounting(candidateId as string, signal),
    enabled: Boolean(candidateId),
    staleTime: 0,
  });
  const accountingError = isErrorAccounting ? t("candidateDetail.error.accountingLoad") : null;
  const returnState = location.state as { returnLabel?: string; returnTo?: string } | null;
  const breadcrumbLabel = returnState?.returnLabel ?? "← Aday listesine dön";
  const breadcrumbTarget = returnState?.returnTo ?? "/candidates";

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (
      tab === "general" ||
      tab === "license" ||
      tab === "training" ||
      (tab === "documents" && canViewDocuments) ||
      (tab === "payments" && canViewPayments)
    ) {
      setActiveTab(tab);
    } else if (tab === "exams") {
      setActiveTab("training");
    }
  }, [canViewDocuments, canViewPayments, searchParams]);

  useEffect(() => {
    if ((activeTab === "documents" && !canViewDocuments) || (activeTab === "payments" && !canViewPayments)) {
      setActiveTab("general");
      setSearchParams({ tab: "general" }, { replace: true });
    }
  }, [activeTab, canViewDocuments, canViewPayments, setSearchParams]);

  const age = useMemo(() => calculateAge(candidate?.birthDate ?? null), [candidate]);

  const refreshAccounting = async () => {
    if (!candidateId) return;
    await queryClient.invalidateQueries({ queryKey: ["candidates", "accounting", candidateId] });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.detail(candidateId) });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: ["payments"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const openAccountingPayment = (movementId: string) => {
    setActiveTab("payments");
    setSearchParams({
      tab: "payments",
      action: "payment",
      movementId,
    });
    void refreshAccounting().catch(() => {
      showToast(t("candidateDetail.error.accountingLoad"), "error");
    });
  };

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  const handleCreateMovement = async (
    type: CandidateAccountingType,
    dueDate: string,
    amount: number,
    description: string
  ) => {
    if (!canManagePayments) return;
    if (!candidate || movementSaving) return;
    setMovementSaving(true);
    try {
      await createCandidateAccountingMovement(candidate.id, { type, dueDate, amount, description });
      await refreshAccounting();
      showToast(t("candidateDetail.accounting.toast.movementAdded"));
    } catch (error) {
      showToast(accountingErrorMessage(error, t("candidateDetail.accounting.toast.movementAddFailed"), t), "error");
    } finally {
      setMovementSaving(false);
    }
  };

  const handleCreateMovements = async (
    movements: Array<{
      type: CandidateAccountingType;
      dueDate: string;
      amount: number;
      description: string;
    }>
  ) => {
    if (!canManagePayments) return;
    if (!candidate || movementSaving || movements.length === 0) return;
    setMovementSaving(true);
    try {
      await createCandidateAccountingMovements(candidate.id, { movements });
      await refreshAccounting();
      showToast(t("candidateDetail.accounting.toast.installmentPlanCreated"));
    } catch (error) {
      showToast(accountingErrorMessage(error, t("candidateDetail.accounting.toast.installmentPlanFailed"), t), "error");
    } finally {
      setMovementSaving(false);
    }
  };

  const handleCreatePayment = async (
    type: CandidateAccountingType,
    amount: number,
    paymentMethod: CandidatePaymentMethod,
    cashRegisterId: string | null,
    paidAtUtc: string,
    note: string | null,
    movementId: string | null = null,
  ) => {
    if (!canManagePayments) return;
    if (!candidate || paymentSaving) return;
    setPaymentSaving(true);
    try {
      await createCandidateAccountingPayment(candidate.id, {
        type,
        amount,
        movementId,
        paymentMethod,
        cashRegisterId,
        paidAtUtc,
        note,
      });
      await refreshAccounting();
      showToast(t("candidateDetail.accounting.toast.paymentRecorded"));
    } catch (error) {
      showToast(accountingErrorMessage(error, t("candidateDetail.accounting.toast.paymentRecordFailed"), t), "error");
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleCancelMovement = async (movementId: string, cancellationReason: string) => {
    if (!canManagePayments) return;
    if (!candidate) return;
    try {
      await cancelCandidateAccountingMovement(candidate.id, movementId, cancellationReason);
      await refreshAccounting();
      showToast(t("candidateDetail.accounting.toast.movementCancelled"));
    } catch (error) {
      showToast(accountingErrorMessage(error, t("candidateDetail.accounting.toast.movementCancelFailed"), t), "error");
    }
  };

  const handleCancelPayment = async (paymentId: string, cancellationReason: string) => {
    if (!canManagePayments) return;
    if (!candidate) return;
    try {
      await cancelCandidateAccountingPayment(candidate.id, paymentId, cancellationReason);
      await refreshAccounting();
      showToast(t("candidateDetail.accounting.toast.paymentCancelled"));
    } catch (error) {
      showToast(accountingErrorMessage(error, t("candidateDetail.accounting.toast.paymentCancelFailed"), t), "error");
    }
  };

  const handleRefundPayment = async (paymentId: string, amount: number | null, note: string | null) => {
    if (!canManagePayments) return;
    if (!candidate) return;
    try {
      await createCandidateAccountingRefund(candidate.id, paymentId, { amount, note });
      await refreshAccounting();
      showToast(t("candidateDetail.accounting.toast.refundRecorded"));
    } catch (error) {
      showToast(accountingErrorMessage(error, t("candidateDetail.accounting.toast.refundFailed"), t), "error");
    }
  };

  const handleSaveInvoice = async (
    invoice: CandidateAccountingInvoiceResponse | null,
    payload: {
      invoiceNo: string;
      invoiceType: string;
      invoiceDate: string;
      subtotal: number;
      vatRate: number;
      notes?: string | null;
    }
  ) => {
    if (!canManagePayments) return;
    if (!candidate || invoiceSaving) return;
    setInvoiceSaving(true);
    try {
      if (invoice) {
        await updateCandidateAccountingInvoice(candidate.id, invoice.id, {
          ...payload,
          rowVersion: invoice.rowVersion,
        });
      } else {
        await createCandidateAccountingInvoice(candidate.id, payload);
      }
      await refreshAccounting();
      showToast(t(invoice ? "candidateDetail.accounting.toast.invoiceUpdated" : "candidateDetail.accounting.toast.invoiceAdded"));
    } catch (error) {
      showToast(accountingErrorMessage(error, t("candidateDetail.accounting.toast.invoiceSaveFailed"), t), "error");
    } finally {
      setInvoiceSaving(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!canManagePayments) return;
    if (!candidate) return;
    try {
      await deleteCandidateAccountingInvoice(candidate.id, invoiceId);
      await refreshAccounting();
      showToast("Fatura silindi");
    } catch (error) {
      showToast(accountingErrorMessage(error, t("candidateDetail.accounting.toast.invoiceDeleteFailed"), t), "error");
    }
  };

  return (
    <div className="candidate-detail">
      <div className="instructor-detail-breadcrumb">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate(breadcrumbTarget)}
          type="button"
        >
          {breadcrumbLabel}
        </button>
      </div>

      {loading && (
        <div className="instructor-detail-card">
          <span className="skeleton" style={{ width: 240, height: 24 }} />
        </div>
      )}

      {!loading && error && (
        <PageLoadError
          title={t("candidateDetail.error.candidateLoad")}
          description={t("candidateDetail.error.candidateLoadDescription")}
          onRetry={() => void refetchCandidate()}
        />
      )}

      {!loading && !error && candidate && (
        <>
          <CandidateHero candidate={candidate} age={age} accounting={accounting} />
          <SecondPracticeRoundBanner
            canManageCandidates={canManageCandidates}
            candidate={candidate}
            onCandidateUpdated={setCandidate}
          />

          <nav className="candidate-detail-tabs" role="tablist">
            {TABS.filter((tab) =>
              tab.key === "documents" ? canViewDocuments : tab.key === "payments" ? canViewPayments : true
            ).map((tab) => {
              const summary = candidate.documentSummary;
              const docInfo =
                tab.key === "documents" && summary
                  ? ` (${summary.completedCount} / ${summary.totalRequiredCount})`
                  : "";
              return (
                <button
                  aria-selected={activeTab === tab.key}
                  className={`candidate-detail-tab${activeTab === tab.key ? " active" : ""}`}
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  role="tab"
                  type="button"
                >
                  {t(tab.labelKey)}
                  {docInfo}
                </button>
              );
            })}
          </nav>

          <div className="candidate-detail-tab-panel">
            {activeTab === "general" && (
              <GeneralTab
                age={age}
                canManageCandidates={canManageCandidates}
                candidate={candidate}
                onSaved={(updated) => setCandidate(updated)}
              />
            )}
            {activeTab === "license" && (
              <LicenseInfoTab
                age={age}
                canManageCandidates={canManageCandidates}
                candidate={candidate}
                onSaved={(updated) => setCandidate(updated)}
                onTheoryExemptChanged={(value) =>
                  setCandidate((prev) =>
                    prev ? { ...prev, isTheoryExempt: value } : prev
                  )
                }
              />
            )}
            {activeTab === "training" && (
              <>
                <CandidateExamAttemptsSection
                  canManageCandidates={canManageCandidates}
                  candidate={candidate}
                  onAccountingChanged={refreshAccounting}
                  onCandidateUpdated={setCandidate}
                  onOpenAccountingPayment={openAccountingPayment}
                  onTheoryExemptChanged={(value) =>
                    setCandidate((prev) =>
                      prev ? { ...prev, isTheoryExempt: value } : prev
                    )
                  }
                />
                <CandidateKCertificateSection canManageCandidates={canManageCandidates} candidate={candidate} />
                <TrainingTab candidate={candidate} canManageTraining={canManageTraining} />
              </>
            )}
            {activeTab === "documents" && (
              <DocumentsTab
                canManageCandidates={canManageCandidates}
                canManageDocuments={canManageDocuments}
                canManageMebJobs={canManageMebJobs}
                candidate={candidate}
                candidateId={candidate.id}
                documents={documents}
                documentTypes={documentTypes}
                loading={combinedDocumentsLoading}
                error={documentsError}
                onRefresh={async () => {
                  if (!candidateId) return;
                  await Promise.all([
                    queryClient.invalidateQueries({
                      queryKey: ["candidates", "documents", candidateId],
                    }),
                    queryClient.invalidateQueries({ queryKey: candidateKeys.detail(candidateId) }),
                    queryClient.invalidateQueries({ queryKey: candidateKeys.lists() }),
                    queryClient.invalidateQueries({ queryKey: ["documents", "list"] }),
                    queryClient.invalidateQueries({ queryKey: ["documents", "tabCount"] }),
                    queryClient.invalidateQueries({ queryKey: ["notifications", "list"] }),
                    queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
                  ]);
                }}
                onDeleted={() => navigate(breadcrumbTarget)}
              />
            )}
            {activeTab === "payments" && (
              <AccountingTab
                accounting={accounting}
                accountingError={accountingError}
                accountingLoading={accountingLoading}
                canManagePayments={canManagePayments}
                candidate={candidate}
                invoiceSaving={invoiceSaving}
                movementSaving={movementSaving}
                onCancelMovement={(movementId, cancellationReason) =>
                  void handleCancelMovement(movementId, cancellationReason)
                }
                onCancelPayment={(paymentId, cancellationReason) =>
                  void handleCancelPayment(paymentId, cancellationReason)
                }
                onCreateMovement={(type, dueDate, amount, description) =>
                  void handleCreateMovement(type, dueDate, amount, description)
                }
                onCreateMovements={handleCreateMovements}
                onCreatePayment={(type, amount, method, cashRegisterId, paidAtUtc, note, movementId) =>
                  void handleCreatePayment(type, amount, method, cashRegisterId, paidAtUtc, note, movementId)
                }
                onDeleteInvoice={(invoiceId) => void handleDeleteInvoice(invoiceId)}
                onRefundPayment={(paymentId, amount, note) =>
                  void handleRefundPayment(paymentId, amount, note)
                }
                onSaveInvoice={(invoice, payload) => void handleSaveInvoice(invoice, payload)}
                paymentSaving={paymentSaving}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Map the target license class code to a coarse vehicle category label so the
// hero can show e.g. "B'den A2 (Otomobil)" without an extra API lookup.
function CandidateHero({
  candidate,
  age,
  accounting,
}: {
  candidate: CandidateResponse;
  age: number | null;
  accounting: CandidateAccountingSummaryResponse | null;
}) {
  const t = useT();
  const statusLabel = candidateStatusLabel(candidate.status);
  const statusPill = candidateStatusToPill(candidate.status);
  const fullName = `${candidate.firstName} ${candidate.lastName}`;
  const candidateHasExistingLicense =
    candidate.hasExistingLicense ?? hasExistingLicenseValue(candidate.existingLicenseType);
  const existingLicense = candidateHasExistingLicense && candidate.existingLicenseType
    ? existingLicenseTypeLabel(candidate.existingLicenseType)
    : null;
  const licenseTransitionLabel = existingLicense
    ? `${existingLicense}'den ${candidate.licenseClass}`
    : candidate.licenseClass;
  const vehicleTypeLabel = vehicleTypeForLicenseClass(candidate.licenseClass, t);
  const termLabel = candidate.currentGroup?.term
    ? buildTermLabel(candidate.currentGroup.term, []).toLocaleUpperCase("tr-TR")
    : null;
  const groupTitle = candidate.currentGroup?.title
    ? candidate.currentGroup.title.toLocaleUpperCase("tr-TR")
    : null;
  const groupHeading = groupTitle ?? termLabel;
  const groupLine = [
    licenseTransitionLabel + (vehicleTypeLabel ? ` (${vehicleTypeLabel})` : ""),
    groupHeading,
  ]
    .filter(Boolean)
    .join(" · ");
  const accountingStatus = computeAccountingStatus(accounting);
  const heroStageLabel =
    candidate.status === "dropped" && candidate.examStageLabel === "Dosya Yakıldı"
      ? null
      : candidate.examStageLabel;
  const stageTone = stagePillTone(heroStageLabel ?? null);
  const appointmentTone = appointmentPillTone(candidate.appointmentStatusLabel ?? null);
  const showDrivingExamAttempts = isCandidateInDrivingStage(candidate);
  const examStatusLabel = candidateHeroExamStatusLabel(candidate);
  const examStatusPill = examStatusPillStatus(examStatusLabel);
  const attemptValue = showDrivingExamAttempts
    ? candidate.drivingExamAttemptCount
    : candidate.eSinavAttemptCount;
  const attemptPill = examStatusPill === "success"
    ? "success"
    : examAttemptPillStatus(attemptValue);
  const attemptSummary = showDrivingExamAttempts
    ? {
        label: "Direksiyon",
        value: `${candidate.drivingExamAttemptCount ?? 1}/4`,
      }
    : {
        label: "E-Sınav Hakkı",
        value: `${candidate.eSinavAttemptCount ?? 1}/4`,
      };

  return (
    <header className="candidate-detail-hero">
      <CandidateAvatar
        candidate={candidate}
        className="candidate-detail-hero-avatar"
        size={96}
      />

      <div className="candidate-detail-hero-body">
        <h2 className="candidate-detail-hero-name">{fullName}</h2>
        <div className="candidate-detail-hero-meta candidate-detail-hero-meta--identity">
          <span>{formatNationalId(candidate.nationalId)}</span>
          <span aria-hidden="true" className="candidate-detail-hero-sep">·</span>
          {age != null ? (
            <>
              <span>{t("candidateDetail.hero.ageSuffix", { age })}</span>
              <span aria-hidden="true" className="candidate-detail-hero-sep">·</span>
            </>
          ) : null}
          {candidate.gender ? (
            <>
              <span>{candidateGenderLabel(candidate.gender)}</span>
              <span aria-hidden="true" className="candidate-detail-hero-sep">·</span>
            </>
          ) : null}
          <span>İstanbul</span>
        </div>
        <div className="candidate-detail-hero-meta candidate-detail-hero-meta--group">
          <span>{groupLine || "—"}</span>
          {candidate.tags?.length ? (
            <span className="candidate-detail-hero-tags">
              {candidate.tags.map((tag) => `#${tag.name}`).join(" ")}
            </span>
          ) : null}
        </div>
        <div className="candidate-detail-hero-meta candidate-detail-hero-meta--status">
          <StatusPill label={statusLabel} status={statusPill} />
          <span className={`candidate-detail-hero-mini-pill job-status-pill pill-${attemptPill}`}>
            <span className="dot" />
            <span>{attemptSummary.label}</span>
            <strong>{attemptSummary.value}</strong>
          </span>
          <span className={`candidate-detail-hero-mini-pill job-status-pill pill-${examStatusPill}`}>
            <span className="dot" />
            <strong>{examStatusLabel}</strong>
          </span>
          {heroStageLabel ? (
            <span className={`candidate-detail-hero-stage-pill tone-${stageTone}`}>
              {heroStageLabel}
            </span>
          ) : null}
          {candidate.appointmentStatusLabel ? (
            <span className={`candidate-detail-hero-stage-pill tone-${appointmentTone}`}>
              {candidate.appointmentStatusLabel}
            </span>
          ) : null}
          <HeroBadges candidate={candidate} />
        </div>
        <div className="candidate-detail-hero-meta candidate-detail-hero-meta--accounting">
          <span className={`candidate-detail-hero-accounting-pill tone-${accountingStatus.tone}`}>
            {t(accountingStatus.labelKey)}
          </span>
        </div>
      </div>
    </header>
  );
}

function isCandidateInDrivingStage(candidate: CandidateResponse): boolean {
  const theoryResult = normalizeCandidateExamResultValue(candidate.mebExamResult);
  return (
    candidate.isTheoryExempt === true ||
    (candidate.hasExistingLicense ?? hasExistingLicenseValue(candidate.existingLicenseType)) ||
    theoryResult === "passed" ||
    Boolean(candidate.drivingExamDate) ||
    Boolean(candidate.drivingExamResultStatus) ||
    (candidate.drivingExamAttemptCount ?? 0) > 0
  );
}

function candidateHeroExamStatusLabel(candidate: CandidateResponse): string {
  if (isCandidateInDrivingStage(candidate)) {
    switch (candidate.drivingExamResultStatus) {
      case "passed":
        return "Direksiyon Başarılı";
      case "failed":
        return "Direksiyon Başarısız";
      default:
        return candidate.drivingExamDate ? "Direksiyon Randevulu" : "Direksiyon Havuz";
    }
  }

  switch (normalizeCandidateExamResultValue(candidate.mebExamResult)) {
    case "failed":
      return "E-Sınav Başarısız";
    default:
      return candidate.mebExamDate ? "E-Sınav Randevulu" : "E-Sınav Havuz";
  }
}

function examStatusPillStatus(label: string): JobStatus {
  const normalized = label.toLocaleLowerCase("tr-TR");
  if (normalized.includes("başarısız")) return "failed";
  if (normalized.includes("başarılı")) return "success";
  if (normalized.includes("randevulu")) return "running";
  return "queued";
}

function examAttemptPillStatus(value: number | null | undefined): JobStatus {
  const attempt = Math.min(Math.max(value ?? 1, 1), 4);
  if (attempt >= 4) return "failed";
  if (attempt >= 2) return "manual";
  return "success";
}

type AccountingStatus = {
  labelKey: TranslationKey;
  tone: "neutral" | "info" | "success" | "danger";
};

function computeAccountingStatus(accounting: CandidateAccountingSummaryResponse | null): AccountingStatus {
  if (!accounting) {
    return { labelKey: "candidateDetail.hero.accounting.noRecord", tone: "neutral" };
  }

  const courseMovements = accounting.movements.filter((movement) => movement.type === "kurs");
  const activeCourseMovements = courseMovements.filter((movement) => movement.status === "active");
  const courseTotal = activeCourseMovements.reduce((sum, movement) => sum + movement.amount, 0);
  const courseRemaining = activeCourseMovements.reduce((sum, movement) => sum + movement.remainingAmount, 0);

  if (courseTotal <= 0) {
    return { labelKey: "candidateDetail.hero.accounting.noRecord", tone: "neutral" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const hasOverdue = activeCourseMovements.some((movement) => {
    if (movement.remainingAmount <= 0) return false;
    const due = new Date(movement.dueDate);
    return !Number.isNaN(due.getTime()) && due < today;
  });
  if (hasOverdue) return { labelKey: "candidateDetail.hero.accounting.overdue", tone: "danger" };

  if (courseRemaining <= 0) {
    return { labelKey: "candidateDetail.hero.accounting.completed", tone: "success" };
  }
  return { labelKey: "candidateDetail.hero.accounting.inProgress", tone: "info" };
}

type PillTone = "neutral" | "info" | "success" | "warning" | "danger";

function stagePillTone(label: string | null): PillTone {
  switch (label) {
    case "Mezun":
      return "success";
    case "Dosya Yakıldı":
      return "danger";
    case "2. Direksiyon Aşaması":
      return "warning";
    case "E-Sınav Aşamasında":
    case "Direksiyon Aşamasında":
      return "info";
    default:
      return "neutral";
  }
}

function appointmentPillTone(label: string | null): PillTone {
  if (!label) return "neutral";
  // "Havuz/Başarısız ..." — son deneme başarısız, kritik
  if (label.startsWith("Havuz/Başarısız")) return "danger";
  // "(4/4)" veya raporlu hakla "(5/5)" — son hak; warning
  if (/\((4\/4|5\/5)\)/.test(label)) return "warning";
  // "Randevulu (...)" — tarih atanmış, pozitif akış
  if (label.startsWith("Randevulu")) return "info";
  // "Havuz (n/4)" — bekleme
  return "neutral";
}

function HeroBadges({ candidate }: { candidate: CandidateResponse }) {
  const t = useT();
  // Compact filigran rozetleri — adayın iş kuralı bypass'larını ve aktif
  // round'unu görsel olarak işaretler. Senaryo diyagramında "Direk Geçiş
  // Filigran" notuna karşılık gelir.
  const badges: { key: string; label: string; tone: "info" | "primary" }[] = [];
  // Direksiyon'a geçiş yolu (priority): operatör onayı (Muaf) > otomatik
  // tespit (Mevcut Ehliyet). E-Sınav puanı resolver tarafından
  // MebExamResult üzerinden değerlendirilir, hero'da ayrı rozet yok.
  if (candidate.isTheoryExempt) {
    badges.push({ key: "exempt", label: t("candidateDetail.hero.badge.exempt"), tone: "info" });
  } else if (candidate.hasExistingLicense ?? hasExistingLicenseValue(candidate.existingLicenseType)) {
    badges.push({
      key: "existing-license",
      label: candidate.existingLicenseType
        ? t("candidateDetail.hero.badge.existingLicenseWithType", { type: candidate.existingLicenseType })
        : t("candidateDetail.hero.badge.existingLicense"),
      tone: "info",
    });
  }
  if (candidate.secondPracticeRoundEnabled) {
    badges.push({ key: "second-round", label: t("candidateDetail.hero.badge.secondRound"), tone: "primary" });
  }
  if (badges.length === 0) return null;
  return (
    <span className="candidate-detail-hero-badges">
      {badges.map((badge) => (
        <span
          key={badge.key}
          className={`candidate-detail-hero-badge tone-${badge.tone}`}
        >
          {badge.label}
        </span>
      ))}
    </span>
  );
}

function SecondPracticeRoundBanner({
  canManageCandidates,
  candidate,
  onCandidateUpdated,
}: {
  canManageCandidates: boolean;
  candidate: CandidateResponse;
  onCandidateUpdated: (next: CandidateResponse) => void;
}) {
  const { showToast } = useToast();
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [confirmingDrop, setConfirmingDrop] = useState(false);
  const enabled = candidate.secondPracticeRoundEnabled === true;
  const canToggle = candidate.canToggleSecondPracticeRound === true;
  const noPermissionTitle = t("common.noPermission");

  if (!enabled && !canToggle) {
    return null;
  }

  const toggleSecondRound = async (next: boolean) => {
    if (!canManageCandidates) return;
    setSaving(true);
    try {
      const updated = await setCandidateSecondPracticeRound(
        candidate.id,
        next,
        candidate.rowVersion
      );
      onCandidateUpdated(updated);
      showToast(t(next ? "candidateDetail.secondRound.toast.opened" : "candidateDetail.secondRound.toast.closed"));
    } catch (error) {
      showToast(secondPracticeRoundErrorMessage(error, t), "error");
    } finally {
      setSaving(false);
      setConfirmingDrop(false);
    }
  };

  const markDropped = async () => {
    if (!canManageCandidates) return;
    setSaving(true);
    try {
      const today = todayLocalDateOnly();
      const updated = await updateCandidateField(candidate, {
        status: "dropped",
        terminationDate: today,
      });
      onCandidateUpdated(updated);
      showToast(t("candidateDetail.secondRound.toast.markedBurned"));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("candidateDetail.secondRound.error.burnFailed");
      showToast(message, "error");
    } finally {
      setSaving(false);
      setConfirmingDrop(false);
    }
  };

  return (
    <div className={`candidate-second-round-banner${enabled ? " is-on" : ""}`}>
      <div className="candidate-second-round-banner-body">
        <strong>{t("candidateDetail.secondRound.title")}</strong>
        <span>
          {enabled
            ? t("candidateDetail.secondRound.activeText")
            : t("candidateDetail.secondRound.inactiveText")}
        </span>
      </div>
      {enabled ? (
        <button
          className="btn btn-secondary"
          disabled={saving || !canToggle || !canManageCandidates}
          onClick={() => toggleSecondRound(false)}
          type="button"
          title={
            !canManageCandidates
              ? noPermissionTitle
              : !canToggle
                ? t("candidateDetail.secondRound.cannotCloseTitle")
                : undefined
          }
        >
          {t("candidateDetail.secondRound.close")}
        </button>
      ) : confirmingDrop ? (
        <div className="candidate-second-round-banner-confirm" role="group">
          <span>{t("candidateDetail.secondRound.confirmBurn")}</span>
          <button
            className="btn btn-danger"
            disabled={saving || !canManageCandidates}
            onClick={markDropped}
            title={!canManageCandidates ? noPermissionTitle : undefined}
            type="button"
          >
            {t("candidateDetail.secondRound.yesBurn")}
          </button>
          <button
            className="btn btn-tertiary"
            disabled={saving}
            onClick={() => setConfirmingDrop(false)}
            type="button"
          >
            {t("common.cancel")}
          </button>
        </div>
      ) : (
        <div className="candidate-second-round-banner-actions">
          <button
            className="btn btn-secondary"
            disabled={saving || !canManageCandidates}
            onClick={() => setConfirmingDrop(true)}
            title={!canManageCandidates ? noPermissionTitle : undefined}
            type="button"
          >
            {t("candidateDetail.secondRound.burnFile")}
          </button>
          <button
            className="btn btn-primary"
            disabled={saving || !canManageCandidates}
            onClick={() => toggleSecondRound(true)}
            title={!canManageCandidates ? noPermissionTitle : undefined}
            type="button"
          >
            {t("candidateDetail.secondRound.openRound")}
          </button>
        </div>
      )}
    </div>
  );
}

function GeneralTab({ candidate, canManageCandidates, onSaved }: {
  candidate: CandidateResponse;
  age: number | null;
  canManageCandidates: boolean;
  onSaved: (updated: CandidateResponse) => void;
}) {
  const { showToast } = useToast();
  const t = useT();
  const [tagsSaving, setTagsSaving] = useState(false);
  const noPermissionTitle = t("common.noPermission");

  const saveGeneralField = async (
    patch: Partial<CandidateUpsertRequest>,
    message = t("candidateDetail.general.toast.candidateUpdated")
  ) => {
    if (!canManageCandidates) return;
    try {
      const updated = await updateCandidateField(candidate, patch);
      onSaved(updated);
      showToast(message);
    } catch {
      showToast(t("candidateDetail.general.toast.candidateUpdateFailed"), "error");
      throw new Error("save failed");
    }
  };

  const saveCandidateStatus = async (value: string) => {
    const nextStatus = value.trim();
    const today = todayLocalDateOnly();
    await saveGeneralField(
      nextStatus === "dropped"
        ? {
            status: nextStatus,
            terminationDate: candidate.terminationDate ?? today,
          }
        : {
            status: nextStatus,
            terminationDate: null,
            terminationReason: null,
          },
      t("candidateDetail.general.toast.statusUpdated")
    );
  };

  const saveRegistrationNumber = async (value: string) => {
    if (!canManageCandidates) return;
    const trimmed = value.trim();
    if (!trimmed) {
      showToast(t("candidateDetail.license.toast.registrationNumberEmpty"), "error");
      throw new Error("registration number empty");
    }
    try {
      await setCandidateRegistrationNumber(candidate.id, trimmed, candidate.rowVersion);
      const refreshed = await getCandidateById(candidate.id);
      onSaved(refreshed);
      showToast(t("candidateDetail.license.toast.registrationNumberUpdated"));
    } catch {
      showToast(t("candidateDetail.license.toast.registrationNumberFailed"), "error");
      throw new Error("save failed");
    }
  };

  const saveRegistrationDate = async (value: string) => {
    if (!canManageCandidates) return;
    if (!value) {
      showToast(t("candidateDetail.license.toast.registrationDateEmpty"), "error");
      throw new Error("registration date empty");
    }
    try {
      await setCandidateRegistrationDate(candidate.id, value, candidate.rowVersion);
      const refreshed = await getCandidateById(candidate.id);
      onSaved(refreshed);
      showToast(t("candidateDetail.license.toast.registrationDateUpdated"));
    } catch {
      showToast(t("candidateDetail.license.toast.registrationDateFailed"), "error");
      throw new Error("save failed");
    }
  };

  const saveTags = async (names: string[]) => {
    if (!canManageCandidates) return;
    setTagsSaving(true);
    try {
      const updated = await updateCandidateField(candidate, { tags: names });
      onSaved(updated);
      showToast(t("candidateDetail.general.toast.tagsUpdated"));
    } catch {
      showToast(t("candidateDetail.general.toast.tagsUpdateFailed"), "error");
    } finally {
      setTagsSaving(false);
    }
  };

  return (
    <div className="candidate-detail-tab-content">
      <div className="candidate-general-grid">
        <div className="candidate-general-grid-col">
          <section className="instructor-detail-card">
            <h3 className="candidate-detail-section-title">{t("candidateDetail.general.section.candidateInfo")}</h3>
            <div className="candidate-detail-edit-list">
              <EditableRow
                disabled={!canManageCandidates}
                disabledTitle={noPermissionTitle}
                displayValue={candidateStatusLabel(candidate.status)}
                inputValue={candidate.status}
                label={t("candidateDetail.general.field.status")}
                options={CANDIDATE_STATUS_OPTIONS}
                onSave={saveCandidateStatus}
              />
              {candidate.status === "dropped" ? (
                <EditableRow
                  disabled={!canManageCandidates}
                  disabledTitle={noPermissionTitle}
                  displayValue={candidate.terminationReason ?? ""}
                  inputValue={candidate.terminationReason ?? ""}
                  label={t("candidateDetail.general.field.dropReason")}
                  onSave={(value) =>
                    saveGeneralField(
                      { terminationReason: value.trim() || null },
                      t("candidateDetail.general.toast.dropReasonUpdated")
                    )
                  }
                />
              ) : null}
              <EditableRow
                disabled={!canManageCandidates}
                disabledTitle={noPermissionTitle}
                displayValue={formatDateTR(candidate.createdAtUtc)}
                inputType="date"
                inputValue={candidate.createdAtUtc.slice(0, 10)}
                label={t("candidateDetail.license.field.registrationDate")}
                onSave={saveRegistrationDate}
              />
              <EditableRow
                disabled={!canManageCandidates}
                disabledTitle={noPermissionTitle}
                displayValue={candidateMebbisStatusLabel(candidate.mebSyncStatus)}
                inputValue={candidate.mebSyncStatus ?? "not_synced"}
                label={t("candidateDetail.license.field.mebbisStatus")}
                options={[
                  { value: "not_synced", label: "Gönderilmedi" },
                  { value: "synced", label: "Gönderildi" },
                ]}
                onSave={(value) =>
                  saveGeneralField({ mebSyncStatus: value || "not_synced" }, t("candidateDetail.license.toast.mebbisStatusUpdated"))
                }
              />
              <EditableRow
                disabled={!canManageCandidates}
                disabledTitle={noPermissionTitle}
                displayValue={candidate.registrationNumber}
                inputValue={candidate.registrationNumber}
                label={t("candidateDetail.license.field.candidateNumber")}
                onSave={saveRegistrationNumber}
              />
            </div>
          </section>

          <section className="instructor-detail-card">
            <h3 className="candidate-detail-section-title">{t("candidateDetail.license.section.reference")}</h3>
            <div className="candidate-detail-edit-list">
              <EditableRow
                disabled={!canManageCandidates}
                disabledTitle={noPermissionTitle}
                displayValue={candidate.referenceName ?? ""}
                inputValue={candidate.referenceName ?? ""}
                label={t("candidateDetail.license.field.reference")}
                loadOptions={(signal) => loadReferenceOptions(candidate.referenceName, t, signal)}
                onSave={(value) =>
                  saveGeneralField(
                    { referenceName: value.trim() || null },
                    t("candidateDetail.license.toast.referenceUpdated"),
                  )
                }
              />
            </div>
          </section>

          <section className="instructor-detail-card">
            <h3 className="candidate-detail-section-title">{t("candidateDetail.general.section.tags")}</h3>
            <CandidateTagsInput
              ariaLabel={t("candidateDetail.general.tagsAriaLabel")}
              disabled={tagsSaving || !canManageCandidates}
              disabledTitle={!canManageCandidates ? noPermissionTitle : undefined}
              onChange={(names) => {
                void saveTags(names);
              }}
              value={candidate.tags?.map((tag) => tag.name) ?? []}
            />
          </section>
        </div>
        <div className="candidate-general-grid-col">
          <CandidateNotesPanel candidateId={candidate.id} />
          <CandidateTimeline candidate={candidate} />
        </div>
        <div className="candidate-general-grid-col">
          <section className="instructor-detail-card">
            <CandidateContactsEditor
              canManageCandidates={canManageCandidates}
              candidate={candidate}
              title={t("candidateDetail.license.section.contacts")}
              onSave={saveGeneralField}
            />
          </section>

          <section className="instructor-detail-card candidate-whatsapp-card">
            <div className="candidate-whatsapp-card-head">
              <div>
                <h3 className="candidate-detail-section-title">{t("candidateDetail.general.section.whatsapp")}</h3>
                <p>{t("candidateDetail.general.whatsappTeaser")}</p>
              </div>
              <span className="candidate-whatsapp-badge">{t("common.comingSoon")}</span>
            </div>
            <div className="candidate-whatsapp-preview" aria-hidden="true">
              <span className="candidate-whatsapp-avatar skeleton" />
              <div className="candidate-whatsapp-lines">
                <span className="skeleton candidate-whatsapp-line long" />
                <span className="skeleton candidate-whatsapp-line medium" />
                <span className="skeleton candidate-whatsapp-line short" />
              </div>
            </div>
            <div className="candidate-whatsapp-preview is-reply" aria-hidden="true">
              <div className="candidate-whatsapp-lines">
                <span className="skeleton candidate-whatsapp-line medium" />
                <span className="skeleton candidate-whatsapp-line short" />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function CandidateTimeline({ candidate }: { candidate: CandidateResponse }) {
  const t = useT();
  const events = (candidate.timeline ?? []).filter(isCandidateJourneyEvent);
  const futureSteps = buildFutureStages(candidate, t);
  const documentStage = buildDocumentJourneyStage(candidate, t);

  type TimelineRow =
    | { key: string; kind: "event"; tone: string; dateLabel: string; title: string; detail: string | null }
    | { key: string; kind: "current"; tone: "current"; dateLabel: string; title: string; detail: string | null }
    | { key: string; kind: "future"; tone: "future"; dateLabel: string; title: string; detail: null };

  // Newest at the top: future stages first (final goal on top), then "Şu an",
  // then past events in reverse-chronological order.
  const rows: TimelineRow[] = [
    ...[...futureSteps].reverse().map<TimelineRow>((label) => ({
      key: `future-${label}`,
      kind: "future",
      tone: "future",
      dateLabel: "—",
      title: label,
      detail: null,
    })),
    ...(candidate.examStageLabel
      ? [{
          key: "current",
          kind: "current" as const,
          tone: "current" as const,
          dateLabel: t("candidateDetail.timeline.now"),
          title: candidate.examStageLabel,
          detail: candidate.appointmentStatusLabel ?? null,
        }]
      : []),
    ...(documentStage ? [documentStage] : []),
    ...[...events].reverse().map<TimelineRow>((event, index) => ({
      key: `${event.kind}-${event.occurredAtUtc}-${index}`,
      kind: "event",
      tone: event.tone,
      dateLabel: formatTimelineDate(event.occurredAtUtc),
      title: event.title,
      detail: event.detail,
    })),
  ];

  const header = (
    <div className="candidate-timeline-card-header">
      <h3 className="candidate-timeline-card-title">
        {t("candidateDetail.timeline.titleTimeline")}
      </h3>
    </div>
  );

  if (rows.length === 0) {
    return (
      <div className="instructor-detail-card">
        {header}
        <div className="instructor-detail-empty">
          {t("candidateDetail.timeline.empty")}
        </div>
      </div>
    );
  }

  return (
    <div className="instructor-detail-card">
      {header}
      <ol className="candidate-timeline">
        {rows.map((row) => {
          const itemClass = [
            "candidate-timeline-item",
            row.kind === "current" ? "is-current" : "",
            row.kind === "future" ? "is-future" : "",
            row.kind === "event" ? `tone-${row.tone}` : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <li key={row.key} className={itemClass}>
              <div className="candidate-timeline-axis">
                <span className="candidate-timeline-date">{row.dateLabel}</span>
                <span className="candidate-timeline-marker" aria-hidden="true" />
              </div>
              <div className="candidate-timeline-content">
                <div className="candidate-timeline-title">{row.title}</div>
                {row.detail ? (
                  <div className="candidate-timeline-detail">{row.detail}</div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const CANDIDATE_JOURNEY_EVENT_KINDS = new Set([
  "registered",
  "existing_license_updated",
  "theory_exemption_set",
  "second_practice_round_toggled",
  "k_certificate_added",
  "k_certificate_removed",
  "mebbis_sync",
  "candidate_deleted",
]);

function isCandidateJourneyEvent(event: NonNullable<CandidateResponse["timeline"]>[number]): boolean {
  return CANDIDATE_JOURNEY_EVENT_KINDS.has(event.kind);
}

function buildDocumentJourneyStage(
  candidate: CandidateResponse,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): {
  key: string;
  kind: "event";
  tone: string;
  dateLabel: string;
  title: string;
  detail: string | null;
} | null {
  const summary = candidate.documentSummary;
  if (!summary || summary.totalRequiredCount <= 0) return null;

  const completed = summary.missingCount === 0;
  return {
    key: "documents-stage",
    kind: "event",
    tone: completed ? "success" : "warning",
    dateLabel: t("candidateDetail.timeline.now"),
    title: t(
      completed
        ? "candidateDetail.timeline.documents.complete"
        : "candidateDetail.timeline.documents.waiting"
    ),
    detail: t("documents.summary", {
      completedCount: summary.completedCount,
      totalRequiredCount: summary.totalRequiredCount,
    }),
  };
}

function CandidateContactsEditor({
  canManageCandidates,
  candidate,
  title,
  onSave,
}: {
  canManageCandidates: boolean;
  candidate: CandidateResponse;
  title: string;
  onSave: (patch: Partial<CandidateUpsertRequest>, message: string) => Promise<void>;
}) {
  const t = useT();
  const [drafts, setDrafts] = useState<Array<{ id: string; type: CandidateContactType }>>([]);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const newMenuRef = useRef<HTMLDivElement | null>(null);
  const contacts = buildCandidateContacts(candidate);
  const noPermissionTitle = t("common.noPermission");

  const saveContacts = async (
    nextContacts: CandidateContactUpsertRequest[],
    message: string
  ) => {
    const firstPhone = nextContacts.find((contact) => contact.type === "phone")?.value ?? null;
    const firstAddress = nextContacts.find((contact) => contact.type === "address")?.value ?? null;

    await onSave(
      {
        contacts: nextContacts,
        phoneNumber: firstPhone,
        address: firstAddress,
      },
      message
    );
  };

  const updateContact = async (
    contact: CandidateContactResponse,
    value: string,
    ownerName: string | null
  ) => {
    const normalizedValue = value.trim();
    if (!normalizedValue) return;
    const normalizedOwnerName = ownerName?.trim() || null;

    const nextContacts = contacts.map((item) =>
      item === contact
        ? {
            id: item.id || null,
            type: item.type,
            label: contactTypeLabel(item.type, t),
            value: normalizedValue,
            isPrimary: item.isPrimary,
            ownerName: item.type === "phone" ? normalizedOwnerName : null,
          }
        : {
            id: item.id || null,
            type: item.type,
            label: item.label,
            value: item.value,
            isPrimary: item.isPrimary,
            ownerName: item.ownerName,
        }
    );
    await saveContacts(nextContacts, t("candidateDetail.contacts.toast.updated"));
  };

  const deleteContact = async (contact: CandidateContactResponse) => {
    const nextContacts = contacts
      .filter((item) => item !== contact)
      .map((item) => ({
        id: item.id || null,
        type: item.type,
        label: item.label,
        value: item.value,
        isPrimary: item.isPrimary,
        ownerName: item.ownerName,
      }));
    await saveContacts(nextContacts, t("candidateDetail.contacts.toast.deleted"));
  };

  const createContact = async (
    draftId: string,
    type: CandidateContactType,
    value: string,
    ownerName: string | null,
  ) => {
    const normalizedValue = value.trim();
    if (!normalizedValue) return;

    const nextContacts = [
      ...contacts.map((contact) => ({
        id: contact.id || null,
        type: contact.type,
        label: contact.label,
        value: contact.value,
        isPrimary: contact.isPrimary,
        ownerName: contact.ownerName,
      })),
      {
        id: null,
        type,
        label: contactTypeLabel(type, t),
        value: normalizedValue,
        isPrimary: !contacts.some((item) => item.type === type),
        ownerName: type === "phone" ? ownerName : null,
      },
    ];

    await saveContacts(nextContacts, t("candidateDetail.contacts.toast.added"));
    setDrafts((current) => current.filter((draft) => draft.id !== draftId));
  };

  const addDraft = (type: CandidateContactType) => {
    if (!canManageCandidates) return;
    setDrafts((current) => [
      ...current,
      { id: `${type}-${Date.now()}-${current.length}`, type },
    ]);
    setNewMenuOpen(false);
  };

  useEffect(() => {
    if (!newMenuOpen) return;
    const handlePointerDown = (event: globalThis.MouseEvent) => {
      if (newMenuRef.current?.contains(event.target as Node)) return;
      setNewMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [newMenuOpen]);

  const contactLabelCounts: Partial<Record<CandidateContactType, number>> = {};
  return (
    <div className="candidate-detail-contacts">
      <div className="candidate-contact-header">
        <h3 className="candidate-detail-section-title">{title}</h3>
        <div className="candidate-contact-toolbar" ref={newMenuRef}>
          <button
            aria-expanded={newMenuOpen}
            aria-haspopup="menu"
            className="btn btn-secondary btn-sm"
            disabled={!canManageCandidates}
            onClick={() => setNewMenuOpen((current) => !current)}
            title={!canManageCandidates ? noPermissionTitle : undefined}
            type="button"
          >
            Yeni
          </button>
          {newMenuOpen ? (
            <div className="candidate-contact-new-popover" role="menu">
              {CONTACT_KINDS.map((kind) => (
                <button
                  className="candidate-contact-new-option"
                  key={kind.type}
                  onClick={() => addDraft(kind.type)}
                  role="menuitem"
                  type="button"
                >
                  {t(kind.singularKey)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="candidate-contact-list">
        {contacts.length === 0 && drafts.length === 0 ? (
          <div className="instructor-detail-empty">{t("candidateDetail.contacts.empty")}</div>
        ) : null}
        {contacts.map((contact, index) => {
          contactLabelCounts[contact.type] = (contactLabelCounts[contact.type] ?? 0) + 1;
          const label = `${contactTypeLabel(contact.type, t)} ${contactLabelCounts[contact.type]}`;

          return (
            <CandidateContactRow
              contact={contact}
              key={`${contact.id || contact.type}-${index}`}
              label={label}
              canManageCandidates={canManageCandidates}
              onDelete={() => deleteContact(contact)}
              onSave={(value, ownerName) => updateContact(contact, value, ownerName)}
            />
          );
        })}
        {drafts.map((draft) => (
          <CandidateContactDraftRow
            draftId={draft.id}
            inputType={contactInputType(draft.type)}
            isPhone={draft.type === "phone"}
            canManageCandidates={canManageCandidates}
            key={draft.id}
            label={t("candidateDetail.contacts.newKind", { singular: contactTypeLabel(draft.type, t) })}
            onCancel={(draftId) =>
              setDrafts((current) => current.filter((item) => item.id !== draftId))
            }
            onCreate={(value, ownerName) => createContact(draft.id, draft.type, value, ownerName)}
          />
        ))}
      </div>
    </div>
  );
}

const CONTACT_KINDS: Array<{
  type: CandidateContactType;
  singularKey: TranslationKey;
  inputType: "text" | "tel" | "textarea";
}> = [
  { type: "phone", singularKey: "candidateDetail.contacts.type.phone", inputType: "tel" },
  { type: "address", singularKey: "candidateDetail.contacts.type.address", inputType: "textarea" },
];

function contactInputType(type: CandidateContactType): "text" | "tel" | "textarea" {
  return CONTACT_KINDS.find((kind) => kind.type === type)?.inputType ?? "text";
}

function normalizeContactPhone(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

function isValidContactPhone(value: string): boolean {
  return /^5\d{9}$/.test(value);
}

function CandidateContactRow({
  contact,
  label,
  canManageCandidates,
  onSave,
  onDelete,
}: {
  contact: CandidateContactResponse;
  label: string;
  canManageCandidates: boolean;
  onSave: (value: string, ownerName: string | null) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const t = useT();
  const [value, setValue] = useState(contact.value);
  const [ownerName, setOwnerName] = useState(contact.ownerName ?? "");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const trimmedValue = value.trim();
  const isPhone = contact.type === "phone";
  const isInvalidPhone = isPhone && trimmedValue.length > 0 && !isValidContactPhone(trimmedValue);
  const validationMessage = error ?? (isInvalidPhone ? t("candidateDetail.contacts.error.phoneInvalid") : null);
  const noPermissionTitle = t("common.noPermission");
  const unchanged =
    trimmedValue === contact.value &&
    (!isPhone || ownerName.trim() === (contact.ownerName ?? ""));

  useEffect(() => {
    setValue(contact.value);
    setOwnerName(contact.ownerName ?? "");
  }, [contact.ownerName, contact.value]);

  const save = async () => {
    if (!canManageCandidates || !trimmedValue || saving || unchanged) return;
    if (isInvalidPhone) {
      setError(t("candidateDetail.contacts.error.phoneInvalid"));
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmedValue, isPhone ? ownerName.trim() || null : null);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`candidate-contact-row ${isPhone ? "is-phone" : "is-address"}`}>
      {isPhone ? (
        <div className="candidate-contact-field candidate-contact-owner-field">
          {editing ? (
            <input
              aria-label={t("candidateDetail.contacts.ownerLabel")}
              className="form-input-sm"
              disabled={saving}
              onChange={(event) => setOwnerName(event.target.value)}
              placeholder={t("candidateDetail.contacts.ownerLabel")}
              type="text"
              value={ownerName}
            />
          ) : (
            <strong className="candidate-contact-read-value">{ownerName.trim() || "—"}</strong>
          )}
        </div>
      ) : null}
      <div className="candidate-contact-field candidate-contact-value-field">
        {editing ? (
          contactInputType(contact.type) === "textarea" ? (
            <textarea
              aria-label={label}
              className="form-textarea-sm"
              disabled={saving}
              onChange={(event) => setValue(event.target.value)}
              value={value}
            />
          ) : (
            <input
              aria-label={label}
              className="form-input-sm"
              disabled={saving}
              inputMode={isPhone ? "tel" : undefined}
              maxLength={isPhone ? 10 : undefined}
              onChange={(event) => {
                setValue(isPhone ? normalizeContactPhone(event.target.value) : event.target.value);
                if (error) setError(null);
              }}
              placeholder={isPhone ? "5XX XXX XX XX" : undefined}
              type={contactInputType(contact.type)}
              value={value}
            />
          )
        ) : (
          <strong className="candidate-contact-read-value">{value.trim() || "—"}</strong>
        )}
      </div>
      <div className="candidate-contact-row-actions">
        {editing ? (
          <>
            <button
              aria-label={t("common.save")}
              className="icon-btn icon-btn-confirm"
              disabled={!trimmedValue || isInvalidPhone || saving || unchanged || !canManageCandidates}
              onClick={() => void save()}
              title={!canManageCandidates ? noPermissionTitle : t("common.save")}
              type="button"
            >
              <CheckIcon size={13} />
            </button>
            <button
              aria-label={t("common.cancel")}
              className="icon-btn"
              disabled={saving}
              onClick={() => {
                setValue(contact.value);
                setOwnerName(contact.ownerName ?? "");
                setError(null);
                setEditing(false);
              }}
              title={t("common.cancel")}
              type="button"
            >
              <XIcon size={13} />
            </button>
          </>
        ) : (
          <button
            aria-label={t("common.edit")}
            className="icon-btn candidate-contact-edit-trigger"
            disabled={!canManageCandidates}
            onClick={() => setEditing(true)}
            title={!canManageCandidates ? noPermissionTitle : t("common.edit")}
            type="button"
          >
            <PencilIcon size={12} />
          </button>
        )}
        <button
          aria-label={t("common.delete")}
          className="icon-btn candidate-contact-delete-trigger"
          disabled={saving || !canManageCandidates}
          onClick={() => void onDelete()}
          title={!canManageCandidates ? noPermissionTitle : t("common.delete")}
          type="button"
        >
          <TrashIcon size={12} />
        </button>
      </div>
      {validationMessage ? <span className="candidate-contact-validation">{validationMessage}</span> : null}
    </div>
  );
}

function CandidateContactDraftRow({
  draftId,
  label,
  inputType,
  isPhone,
  canManageCandidates,
  onCreate,
  onCancel,
}: {
  draftId: string;
  label: string;
  inputType: "text" | "tel" | "textarea";
  isPhone: boolean;
  canManageCandidates: boolean;
  onCreate: (value: string, ownerName: string | null) => Promise<void>;
  onCancel: (draftId: string) => void;
}) {
  const t = useT();
  const [value, setValue] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const trimmedValue = value.trim();
  const isInvalidPhone = isPhone && trimmedValue.length > 0 && !isValidContactPhone(trimmedValue);
  const validationMessage = error ?? (isInvalidPhone ? t("candidateDetail.contacts.error.phoneInvalid") : null);
  const noPermissionTitle = t("common.noPermission");

  const save = async () => {
    if (!canManageCandidates || !trimmedValue || saving) return;
    if (isInvalidPhone) {
      setError(t("candidateDetail.contacts.error.phoneInvalid"));
      return;
    }

    setSaving(true);
    try {
      await onCreate(trimmedValue, ownerName.trim() || null);
      setError(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`candidate-contact-draft-row ${isPhone ? "is-phone" : "is-address"}`}>
      {isPhone ? (
        <label className="candidate-contact-field candidate-contact-owner-field">
          <input
            aria-label={t("candidateDetail.contacts.ownerAriaPhone")}
            className="form-input-sm"
            disabled={saving}
            onChange={(event) => setOwnerName(event.target.value)}
            placeholder={t("candidateDetail.contacts.ownerPlaceholder")}
            type="text"
            value={ownerName}
          />
        </label>
      ) : null}
      <label className="candidate-contact-field candidate-contact-value-field">
        {inputType === "textarea" ? (
          <textarea
            aria-label={label}
            className="form-textarea-sm"
            disabled={saving}
            onChange={(event) => {
              setValue(event.target.value);
              if (error) setError(null);
            }}
            value={value}
          />
        ) : (
          <input
            aria-label={label}
            className="form-input-sm"
            disabled={saving}
            inputMode={isPhone ? "tel" : undefined}
            maxLength={isPhone ? 10 : undefined}
            onChange={(event) => {
              setValue(isPhone ? normalizeContactPhone(event.target.value) : event.target.value);
              if (error) setError(null);
            }}
            placeholder={isPhone ? "5XX XXX XX XX" : undefined}
            type={inputType}
            value={value}
          />
        )}
      </label>
      <div className="candidate-contact-row-actions">
        <button
          aria-label={t("common.save")}
          className="icon-btn icon-btn-confirm"
          disabled={!trimmedValue || isInvalidPhone || saving || !canManageCandidates}
          onClick={() => void save()}
          title={!canManageCandidates ? noPermissionTitle : t("common.save")}
          type="button"
        >
          <CheckIcon size={13} />
        </button>
        <button
          aria-label={t("common.cancel")}
          className="icon-btn"
          disabled={saving}
          onClick={() => onCancel(draftId)}
          title={t("common.cancel")}
          type="button"
        >
          <XIcon size={13} />
        </button>
      </div>
      {validationMessage ? <span className="candidate-contact-validation">{validationMessage}</span> : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="drawer-row">
      <span className="label">{label}</span>
      <span className="value">{value}</span>
    </div>
  );
}

function candidateMebbisStatusLabel(status: string | null | undefined): string {
  return status === "synced" ? "Gönderildi" : "Gönderilmedi";
}

function buildCandidateExamEvents(
  candidate: CandidateResponse,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
): TrainingCalendarEvent[] {
  const candidateName = `${candidate.firstName} ${candidate.lastName}`.trim();
  const theoryLabel = t("candidateDetail.exam.event.theory");
  const practiceLabel = t("candidateDetail.exam.event.practice");
  const base = {
    instructorId: "exam",
    instructorName: t("candidateDetail.exam.event.instructorName"),
    groupId: candidate.currentGroup?.groupId ?? null,
    termName: candidate.currentGroup?.term?.name ?? "-",
    licenseClass: candidate.licenseClass,
    candidateCount: 1,
    candidateName,
    candidateId: candidate.id,
    status: "planned" as const,
  };
  const events: TrainingCalendarEvent[] = [];

  if (candidate.mebExamDate) {
    const start = dateOnlyAt(candidate.mebExamDate, 9);
    events.push({
      ...base,
      id: `candidate-${candidate.id}-meb-exam`,
      title: theoryLabel,
      start,
      end: addHours(start, 1),
      kind: "teorik",
      groupName: theoryLabel,
      notes: theoryLabel,
    });
  }

  if (candidate.drivingExamDate) {
    const start = dateOnlyAt(candidate.drivingExamDate, 10);
    events.push({
      ...base,
      id: `candidate-${candidate.id}-driving-exam`,
      title: practiceLabel,
      start,
      end: addHours(start, 1),
      kind: "uygulama",
      groupName: practiceLabel,
      notes: practiceLabel,
    });
  }

  return events;
}

type ExistingLicenseRuleOption = SelectOption & {
  existingLicenseType: string;
  displayOrder: number;
};

function encodeExistingLicenseSelection(
  existingLicenseType: string | null | undefined,
  _existingLicensePre2016: boolean
): string {
  if (!existingLicenseType) return "";
  return encodeURIComponent(existingLicenseType.trim());
}

function decodeExistingLicenseSelection(value: string): {
  existingLicenseType: string | null;
  existingLicensePre2016: boolean;
} {
  if (!value) {
    return { existingLicenseType: null, existingLicensePre2016: false };
  }

  const existingLicenseType = decodeURIComponent(value).trim() || null;
  return {
    existingLicenseType,
    existingLicensePre2016: false,
  };
}

function buildExistingLicenseOptionsFromDefinitions(
  definitions: LicenseClassDefinitionResponse[],
  targetLicenseClass: string,
  currentExistingLicenseType: string | null,
  currentExistingLicensePre2016: boolean,
  configuredExistingLicenseTypeOptions: SelectOption[]
): SelectOption[] {
  const targetKey = normalizeLicenseOptionKey(targetLicenseClass);
  const byValue = new Map<string, ExistingLicenseRuleOption>();

  for (const definition of definitions) {
    if (!definition.existingLicenseType) continue;
    if (normalizeLicenseOptionKey(definition.code) !== targetKey) continue;

    const value = encodeExistingLicenseSelection(
      definition.existingLicenseType,
      false
    );
    const baseLabel = existingLicenseTypeLabel(
      definition.existingLicenseType,
      configuredExistingLicenseTypeOptions
    );
    byValue.set(value, {
      value,
      label: baseLabel,
      existingLicenseType: definition.existingLicenseType,
      displayOrder: definition.displayOrder,
    });
  }

  const currentValue = encodeExistingLicenseSelection(
    currentExistingLicenseType,
    currentExistingLicensePre2016
  );
  if (currentExistingLicenseType && !byValue.has(currentValue)) {
    const baseLabel = existingLicenseTypeLabel(
      currentExistingLicenseType,
      configuredExistingLicenseTypeOptions
    );
    byValue.set(currentValue, {
      value: currentValue,
      label: baseLabel,
      existingLicenseType: currentExistingLicenseType,
      displayOrder: Number.MAX_SAFE_INTEGER,
    });
  }

  return [...byValue.values()]
    .sort(
      (a, b) =>
        a.displayOrder - b.displayOrder ||
        a.label.localeCompare(b.label, "tr")
    )
    .map(({ value, label }) => ({ value, label }));
}

function formatExistingLicenseSelectionLabel(
  existingLicenseType: string | null | undefined,
  _existingLicensePre2016: boolean,
  configuredExistingLicenseTypeOptions: SelectOption[]
): string {
  if (!existingLicenseType) return "";
  const label = existingLicenseTypeLabel(
    existingLicenseType,
    configuredExistingLicenseTypeOptions
  );
  return label;
}

function applyGroupAssignmentToCandidate(
  candidate: CandidateResponse,
  assignment: CandidateGroupAssignmentResponse,
  group: Awaited<ReturnType<typeof getGroupById>>
): CandidateResponse {
  return {
    ...candidate,
    currentGroup: {
      groupId: assignment.groupId,
      title: assignment.groupTitle || group.title,
      startDate: assignment.groupStartDate ?? group.startDate,
      term: group.term,
      assignedAtUtc: assignment.assignedAtUtc,
    },
  };
}

function LicenseInfoTab({
  age,
  canManageCandidates,
  candidate,
  onSaved,
  onTheoryExemptChanged,
}: {
  age: number | null;
  canManageCandidates: boolean;
  candidate: CandidateResponse;
  onSaved: (updated: CandidateResponse) => void;
  onTheoryExemptChanged?: (value: boolean) => void;
}) {
  const { showToast } = useToast();
  const t = useT();
  const noPermissionTitle = t("common.noPermission");
  const { options: licenseClassOptions } = useCandidateLicenseClassOptions(
    candidate.existingLicenseType ?? "",
    candidate.hasExistingLicense ?? hasExistingLicenseValue(candidate.existingLicenseType)
  );
  const { items: activeLicenseClassDefinitions } = useActiveLicenseClassDefinitions();
  const licenseClassLabel = useMemo(
    () =>
      licenseClassOptions.find((option) => option.value === candidate.licenseClass)
        ?.label ?? candidate.licenseClass,
    [licenseClassOptions, candidate.licenseClass]
  );
  // ── Fetch 4: current group detail (for capacity) ────────────────────────
  const { data: currentGroupData } = useGroup(candidate.currentGroup?.groupId ?? null);
  const groupCapacity = currentGroupData
    ? { filled: currentGroupData.activeCandidateCount, capacity: currentGroupData.capacity }
    : null;

  const loadGroupOptions = async (signal?: AbortSignal): Promise<SelectOption[]> => {
    const response = await getGroups({ pageSize: 200 }, signal);
    return [
      { value: "", label: t("candidateDetail.license.unassignedOption") },
      ...response.items.map((group) => ({
        value: group.id,
        label: `${group.title}${group.startDate ? ` · ${formatDateTR(group.startDate)}` : ""}`,
      })),
    ];
  };

  const saveGroup = async (groupId: string) => {
    if (!canManageCandidates) return;
    try {
      if (!groupId) {
        await removeActiveGroupAssignment(candidate.id);
        onSaved({ ...candidate, currentGroup: null });
      } else {
        const [assignment, group] = await Promise.all([
          assignCandidateGroup(candidate.id, groupId),
          getGroupById(groupId),
        ]);
        onSaved(applyGroupAssignmentToCandidate(candidate, assignment, group));
      }

      showToast(t(groupId ? "candidateDetail.license.toast.groupAssigned" : "candidateDetail.license.toast.groupRemoved"));
    } catch {
      showToast(t("candidateDetail.license.toast.groupSaveFailed"), "error");
      throw new Error("save failed");
    }
  };
  const { options: configuredExistingLicenseTypeOptions } = useExistingLicenseTypeOptions();
  const hasLicense = candidate.hasExistingLicense ?? hasExistingLicenseValue(candidate.existingLicenseType);
  const [licenseType, setLicenseType] = useState(
    encodeExistingLicenseSelection(
      candidate.existingLicenseType,
      candidate.existingLicensePre2016
    )
  );
  const [licenseNumber, setLicenseNumber] = useState(candidate.existingLicenseNumber ?? "");
  const [issuedAt, setIssuedAt] = useState(
    candidate.existingLicenseIssuedAt ?? (hasLicense ? "" : todayIsoDate())
  );
  const [issuedProvince, setIssuedProvince] = useState(
    candidate.existingLicenseIssuedProvince ?? ""
  );
  const [licenseFieldsOpen, setLicenseFieldsOpen] = useState(
    candidate.hasExistingLicense ?? hasExistingLicenseValue(candidate.existingLicenseType)
  );
  const [existingLicenseToggleSaving, setExistingLicenseToggleSaving] = useState(false);

  useEffect(() => {
    setLicenseType(
      encodeExistingLicenseSelection(
        candidate.existingLicenseType,
        candidate.existingLicensePre2016
      )
    );
    setLicenseNumber(candidate.existingLicenseNumber ?? "");
    setIssuedAt(
      candidate.existingLicenseIssuedAt ?? (hasLicense ? "" : todayIsoDate())
    );
    setIssuedProvince(candidate.existingLicenseIssuedProvince ?? "");
    setLicenseFieldsOpen(candidate.hasExistingLicense ?? hasExistingLicenseValue(candidate.existingLicenseType));
  }, [candidate]);

  // ── Fetch 5: license class definitions (for existing-license options) ───
  const {
    data: licenseClassDefinitionsData,
    isLoading: existingLicenseOptionsLoading,
  } = useQuery({
    queryKey: ["licenseClassDefinitions", "active"],
    queryFn: ({ signal }) =>
      getLicenseClassDefinitions(
        {
          activity: "active",
          includeInstitutionContext: false,
          page: 1,
          pageSize: 1000,
          sortBy: "displayOrder",
          sortDir: "asc",
        },
        signal
      ),
  });
  const existingLicenseOptions = useMemo(
    () =>
      licenseClassDefinitionsData
        ? buildExistingLicenseOptionsFromDefinitions(
            licenseClassDefinitionsData.items,
            candidate.licenseClass,
            candidate.existingLicenseType,
            candidate.existingLicensePre2016,
            configuredExistingLicenseTypeOptions
          )
        : [],
    [
      licenseClassDefinitionsData,
      candidate.licenseClass,
      candidate.existingLicenseType,
      candidate.existingLicensePre2016,
      configuredExistingLicenseTypeOptions,
    ]
  );

  useEffect(() => {
    if (existingLicenseOptionsLoading || !licenseType) return;
    if (existingLicenseOptions.some((option) => option.value === licenseType)) return;
    setLicenseType("");
  }, [existingLicenseOptions, existingLicenseOptionsLoading, licenseType]);

  const saveApplicationField = async (
    patch: Partial<CandidateUpsertRequest>,
    message = t("candidateDetail.license.toast.applicationUpdated")
  ) => {
    if (!canManageCandidates) return;
    try {
      const updated = await updateCandidateField(candidate, patch);
      onSaved(updated);
      showToast(message);
    } catch {
      showToast(t("candidateDetail.license.toast.applicationUpdateFailed"), "error");
      throw new Error("save failed");
    }
  };

  const [exemptSaving, setExemptSaving] = useState(false);
  const hasExistingLicense = candidate.hasExistingLicense ?? hasExistingLicenseValue(candidate.existingLicenseType);
  const hasExistingLicenseDraft = hasExistingLicense || licenseFieldsOpen;
  const isTheoryExempt = hasExistingLicenseDraft || (candidate.isTheoryExempt ?? false);
  const toggleTheoryExempt = async () => {
    if (!canManageCandidates) return;
    if (hasExistingLicenseDraft) return;
    const next = !isTheoryExempt;
    setExemptSaving(true);
    try {
      await setCandidateTheoryExemption(candidate.id, next);
      onTheoryExemptChanged?.(next);
    } catch {
      showToast(t("candidateDetail.license.toast.exemptionFailed"), "error");
    } finally {
      setExemptSaving(false);
    }
  };

  const buildExistingLicenseRequest = (
    patch: Partial<CandidateUpsertRequest>
  ): CandidateExistingLicenseRequest => {
    const nextTypeRaw =
      patch.existingLicenseType !== undefined
        ? patch.existingLicenseType
        : encodeExistingLicenseSelection(
            candidate.existingLicenseType,
            candidate.existingLicensePre2016
          );
    const { existingLicenseType: nextType } = decodeExistingLicenseSelection(nextTypeRaw ?? "");
    const nextHasExistingLicense =
      patch.hasExistingLicense ?? candidate.hasExistingLicense ?? hasExistingLicenseValue(candidate.existingLicenseType);
    const licenseSelectionChanged =
      patch.licenseClass !== undefined ||
      patch.hasExistingLicense !== undefined ||
      patch.existingLicenseType !== undefined;
    const resolveDefinitionId = (
      sourceLicenseClass: string | null,
      hasExistingLicense: boolean
    ) =>
      findLicenseClassDefinitionIdForSelection(
        activeLicenseClassDefinitions,
        candidate.licenseClass,
        sourceLicenseClass,
        hasExistingLicense
      ) ?? (licenseSelectionChanged ? null : candidate.licenseClassDefinitionId ?? null);

    // Explicitly picking "— Belge Yok —" from the type dropdown clears every
    // field; partial saves of other fields (without a type yet) keep going.
    if (patch.hasExistingLicense === false || (patch.existingLicenseType !== undefined && !nextType)) {
      return {
        hasExistingLicense: false,
        existingLicenseType: null,
        existingLicenseIssuedAt: null,
        existingLicenseNumber: null,
        existingLicenseIssuedProvince: null,
        existingLicensePre2016: false,
        licenseClassDefinitionId: resolveDefinitionId(null, false),
        rowVersion: candidate.rowVersion,
      };
    }

    const nextNumber =
      patch.existingLicenseNumber !== undefined
        ? patch.existingLicenseNumber?.trim() || null
        : candidate.existingLicenseNumber;
    const nextIssuedAt =
      patch.existingLicenseIssuedAt !== undefined
        ? patch.existingLicenseIssuedAt || null
        : candidate.existingLicenseIssuedAt;
    const nextProvince =
      patch.existingLicenseIssuedProvince !== undefined
        ? patch.existingLicenseIssuedProvince?.trim() || null
        : candidate.existingLicenseIssuedProvince;

    return {
      hasExistingLicense: nextHasExistingLicense || !!nextType,
      existingLicenseType: nextType,
      existingLicenseIssuedAt: nextIssuedAt,
      existingLicenseNumber: nextNumber,
      existingLicenseIssuedProvince: nextProvince,
      existingLicensePre2016: false,
      licenseClassDefinitionId: resolveDefinitionId(nextType, nextHasExistingLicense || !!nextType),
      rowVersion: candidate.rowVersion,
    };
  };

  const saveExistingLicenseField = async (
    patch: Partial<CandidateUpsertRequest>,
    message = t("candidateDetail.license.toast.existingLicenseUpdated")
  ) => {
    if (!canManageCandidates) return;
    try {
      const updated = await updateCandidateExistingLicense(
        candidate.id,
        buildExistingLicenseRequest(patch)
      );
      onSaved(updated);
      showToast(message);
    } catch {
      showToast(t("candidateDetail.license.toast.existingLicenseFailed"), "error");
      throw new Error("save failed");
    }
  };

  const resetExistingLicenseDraft = () => {
    setLicenseType("");
    setLicenseNumber("");
    setIssuedAt(todayIsoDate());
    setIssuedProvince("");
  };

  const handleToggleExistingLicense = async (checked: boolean) => {
    if (existingLicenseToggleSaving) return;
    if (checked) {
      if (!issuedAt) {
        setIssuedAt(todayIsoDate());
      }
      setLicenseFieldsOpen(true);
      setExistingLicenseToggleSaving(true);
      try {
        await saveExistingLicenseField(
          { hasExistingLicense: true },
          t("candidateDetail.license.toast.existingLicenseMarked")
        );
      } catch {
        setLicenseFieldsOpen(false);
      } finally {
        setExistingLicenseToggleSaving(false);
      }
      return;
    }

    setLicenseFieldsOpen(false);
    resetExistingLicenseDraft();

    if (hasLicense) {
      setExistingLicenseToggleSaving(true);
      try {
        await saveExistingLicenseField(
          {
            existingLicenseType: null,
            existingLicenseIssuedAt: null,
            existingLicenseNumber: null,
            existingLicenseIssuedProvince: null,
            existingLicensePre2016: false,
            hasExistingLicense: false,
          },
          t("candidateDetail.license.toast.existingLicenseCleared")
        );
      } catch {
        setLicenseFieldsOpen(true);
        setLicenseType(
          encodeExistingLicenseSelection(
            candidate.existingLicenseType,
            candidate.existingLicensePre2016
          )
        );
        setLicenseNumber(candidate.existingLicenseNumber ?? "");
        setIssuedAt(
          candidate.existingLicenseIssuedAt ?? (hasLicense ? "" : todayIsoDate())
        );
        setIssuedProvince(candidate.existingLicenseIssuedProvince ?? "");
      } finally {
        setExistingLicenseToggleSaving(false);
      }
    }
  };

  return (
    <div className="candidate-detail-tab-content candidate-detail-license-grid">
      <div className="candidate-detail-license-column">
        <section className="instructor-detail-card candidate-detail-license-card">
          <h3 className="candidate-detail-section-title">{t("candidateDetail.license.section.identity")}</h3>
          <div className="candidate-detail-edit-list">
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={noPermissionTitle}
              displayValue={candidate.firstName}
              inputValue={candidate.firstName}
              label={t("common.field.firstName")}
              transform={toTurkishUpperCase}
              onSave={(value) => saveApplicationField({ firstName: value.trim() }, t("candidateDetail.license.toast.firstNameUpdated"))}
            />
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={noPermissionTitle}
              displayValue={candidate.lastName}
              inputValue={candidate.lastName}
              label={t("common.field.lastName")}
              transform={toTurkishUpperCase}
              onSave={(value) => saveApplicationField({ lastName: value.trim() }, t("candidateDetail.license.toast.lastNameUpdated"))}
            />
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={noPermissionTitle}
              displayValue={candidate.nationalId}
              inputType="tel"
              inputValue={candidate.nationalId}
              label={t("common.field.nationalId")}
              onSave={(value) => saveApplicationField({ nationalId: value.trim() }, t("candidateDetail.license.toast.nationalIdUpdated"))}
            />
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={noPermissionTitle}
              displayValue={candidate.identitySerialNumber ?? ""}
              inputValue={candidate.identitySerialNumber ?? ""}
              label={t("common.field.identitySerialNumber")}
              onSave={(value) =>
                saveApplicationField({ identitySerialNumber: value.trim() || null }, t("candidateDetail.license.toast.identitySerialUpdated"))
              }
            />
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={noPermissionTitle}
              displayValue={candidate.motherName ?? ""}
              inputValue={candidate.motherName ?? ""}
              label={t("common.field.motherName")}
              transform={toTurkishUpperCase}
              onSave={(value) => saveApplicationField({ motherName: value.trim() || null }, t("candidateDetail.license.toast.motherNameUpdated"))}
            />
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={noPermissionTitle}
              displayValue={candidate.fatherName ?? ""}
              inputValue={candidate.fatherName ?? ""}
              label={t("common.field.fatherName")}
              transform={toTurkishUpperCase}
              onSave={(value) => saveApplicationField({ fatherName: value.trim() || null }, t("candidateDetail.license.toast.fatherNameUpdated"))}
            />
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={noPermissionTitle}
              displayValue={candidateGenderLabel(candidate.gender)}
              inputValue={normalizeCandidateGender(candidate.gender) ?? ""}
              label={t("common.field.gender")}
              options={CANDIDATE_GENDER_OPTIONS}
              onSave={(value) =>
                saveApplicationField({ gender: normalizeCandidateGender(value) }, t("candidateDetail.license.toast.genderUpdated"))
              }
            />
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={noPermissionTitle}
              displayValue={formatDateTR(candidate.birthDate)}
              inputType="date"
              inputValue={candidate.birthDate ?? ""}
              label={t("common.field.birthDate")}
              onSave={(value) => saveApplicationField({ birthDate: value || null }, t("candidateDetail.license.toast.birthDateUpdated"))}
            />
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={noPermissionTitle}
              displayValue={candidate.birthPlace ?? ""}
              inputValue={candidate.birthPlace ?? ""}
              label={t("common.field.birthPlace")}
              onSave={(value) =>
                saveApplicationField({ birthPlace: value.trim() || null }, t("candidateDetail.license.toast.birthPlaceUpdated"))
              }
            />
            <Field label={t("common.field.age")} value={age != null ? String(age) : "—"} />
          </div>
        </section>

      </div>

      <div className="candidate-detail-license-column">
        <section className="instructor-detail-card candidate-detail-license-card">
          <h3 className="candidate-detail-section-title">{t("candidateDetail.license.section.application")}</h3>
          <div className="candidate-detail-edit-list">
            <EditableRow
              className="candidate-detail-license-class-row"
              disabled={!canManageCandidates}
              disabledTitle={noPermissionTitle}
              displayValue={licenseClassLabel}
              inputValue={candidate.licenseClass}
              label={t("common.field.licenseClass")}
              options={licenseClassOptions}
              onSave={(value) =>
                saveApplicationField(
                  {
                    licenseClass: value as CandidateResponse["licenseClass"],
                    licenseClassDefinitionId:
                      licenseClassOptions.find((option) => option.value === value)?.licenseClassDefinitionId ?? null,
                  },
                  t("candidateDetail.license.toast.licenseTypeUpdated")
                )
              }
            />
          </div>

          <div className="instructor-detail-section-header" style={{ marginTop: 24 }}>
            <span className="form-label" style={{ margin: 0 }}>
              {t("candidateDetail.license.theoryExemption")}
            </span>
            <label
              className="switch-toggle switch-toggle-knob-right"
              title={hasExistingLicenseDraft
                ? t("candidateDetail.license.autoExemptByLicense")
                : t("candidateDetail.license.exemptText")}
            >
              <input
                checked={isTheoryExempt}
                disabled={exemptSaving || hasExistingLicenseDraft || !canManageCandidates}
                onChange={toggleTheoryExempt}
                title={!canManageCandidates ? noPermissionTitle : undefined}
                type="checkbox"
              />
              <span>{isTheoryExempt ? t("candidateDetail.license.exempt") : t("candidateDetail.license.notExempt")}</span>
              <span aria-hidden="true" className="switch-toggle-control" />
            </label>
          </div>

          <div className="instructor-detail-section-header" style={{ marginTop: 24 }}>
            <span className="form-label" style={{ margin: 0 }}>
              {t("candidateDetail.license.existingLicense")}
            </span>
            <label className="switch-toggle switch-toggle-knob-right">
              <input
                checked={licenseFieldsOpen}
                disabled={existingLicenseToggleSaving || !canManageCandidates}
                onChange={(event) => handleToggleExistingLicense(event.target.checked)}
                title={!canManageCandidates ? noPermissionTitle : undefined}
                type="checkbox"
              />
              <span>{licenseFieldsOpen ? t("candidateDetail.license.hasIt") : t("candidateDetail.license.noneIt")}</span>
              <span aria-hidden="true" className="switch-toggle-control" />
            </label>
          </div>

          <div className="candidate-detail-edit-list">
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={noPermissionTitle}
              displayValue={
                hasLicense
                  ? formatExistingLicenseSelectionLabel(
                      candidate.existingLicenseType,
                      candidate.existingLicensePre2016,
                      configuredExistingLicenseTypeOptions
                    )
                  : ""
              }
              inputValue={
                hasLicense
                  ? encodeExistingLicenseSelection(
                      candidate.existingLicenseType,
                      candidate.existingLicensePre2016
                    )
                  : licenseType
              }
              label={t("candidateDetail.license.existingLicenseField")}
              options={[
                { value: "", label: t("candidateDetail.license.noLicenseOption") },
                ...existingLicenseOptions,
              ]}
              onSave={(value) =>
                saveExistingLicenseField(
                  { existingLicenseType: value || null },
                  value ? t("candidateDetail.license.toast.existingLicenseToggled") : t("candidateDetail.license.toast.existingLicenseCleared")
                )
              }
            />
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={noPermissionTitle}
              displayValue={hasLicense ? formatDateTR(candidate.existingLicenseIssuedAt) : formatDateTR(issuedAt)}
              inputType="date"
              inputValue={hasLicense ? candidate.existingLicenseIssuedAt ?? "" : issuedAt}
              inputLang="tr-TR"
              label={t("candidateDetail.license.field.documentDate")}
              onSave={(value) =>
                saveExistingLicenseField({ existingLicenseIssuedAt: value || null })
              }
            />
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={noPermissionTitle}
              displayValue={hasLicense ? candidate.existingLicenseNumber ?? "" : licenseNumber}
              inputValue={hasLicense ? candidate.existingLicenseNumber ?? "" : licenseNumber}
              label={t("candidateDetail.license.field.documentNumber")}
              onSave={(value) =>
                saveExistingLicenseField({ existingLicenseNumber: value || null })
              }
            />
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={noPermissionTitle}
              displayValue={hasLicense ? candidate.existingLicenseIssuedProvince ?? "" : issuedProvince}
              inputValue={hasLicense ? candidate.existingLicenseIssuedProvince ?? "" : issuedProvince}
              label={t("candidateDetail.license.field.documentIssueProvince")}
              options={TURKEY_PROVINCE_OPTIONS}
              onSave={(value) =>
                saveExistingLicenseField({ existingLicenseIssuedProvince: value || null })
              }
            />
            {!existingLicenseOptionsLoading && existingLicenseOptions.length === 0 ? (
              <div className="form-subsection-note" style={{ marginTop: 8 }}>
                {t("candidateDetail.license.noExistingLicenseDefinition")}
              </div>
            ) : null}
          </div>
        </section>

      </div>

      <div className="candidate-detail-license-column">
        <section className="instructor-detail-card candidate-detail-license-card">
          <h3 className="candidate-detail-section-title">{t("candidateDetail.license.section.group")}</h3>
          <div className="candidate-detail-edit-list">
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={noPermissionTitle}
              displayValue={candidate.currentGroup?.title ?? t("candidateDetail.license.unassigned")}
              inputValue={candidate.currentGroup?.groupId ?? ""}
              label={t("candidateDetail.license.field.activeGroup")}
              loadOptions={loadGroupOptions}
              onSave={saveGroup}
            />
            <Field
              label={t("candidateDetail.license.field.term")}
              value={
                candidate.currentGroup?.term
                  ? buildTermLabel(candidate.currentGroup.term, [])
                  : "—"
              }
            />
            <Field
              label={t("candidateDetail.license.field.groupStart")}
              value={formatDateTR(candidate.currentGroup?.startDate ?? null)}
            />
            <Field
              label="Kontenjan"
              value={
                groupCapacity
                  ? `${groupCapacity.filled}/${groupCapacity.capacity}`
                  : "—"
              }
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function formatCurrencyTRY(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateTimeTR(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function renderFinanceDateTime(value: string | null | undefined): ReactNode {
  const parts = financeDateTimeParts(value);
  if (!parts) return "—";
  if (!parts.time) return parts.date;
  return (
    <span className="finance-date-time">
      <span className="finance-date-time-date">{parts.date}</span>
      <span className="finance-date-time-time">{parts.time}</span>
    </span>
  );
}

function financeDateTimeParts(value: string | null | undefined): { date: string; time?: string } | null {
  if (!value) return null;
  if (!value.includes("T")) return { date: formatDateTR(value) };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: formatDateTR(value) };
  const parts = new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Istanbul",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return {
    date: `${part("day")}.${part("month")}.${part("year")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

function fromDateTimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}

function fromApplicationDateTimeLocalValue(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return fromDateTimeLocalValue(value);
  const [, year, month, day, hour, minute] = match;
  return new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) - 3,
    Number(minute)
  )).toISOString();
}

function toDateTimeLocalValue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return combineDateAndTimeLocal(todayIsoDate(), "00:00");
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Istanbul",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function datePartFromDateTimeLocal(value: string): string {
  return value.slice(0, 10) || todayIsoDate();
}

function timePartFromDateTimeLocal(value: string): string {
  return value.slice(11, 16) || "00:00";
}

function combineDateAndTimeLocal(date: string, time: string): string {
  return `${date || todayIsoDate()}T${time || "00:00"}`;
}

function nextCandidateExamAttemptNumber(
  attempts: CandidateExamAttemptResponse[],
  examType: CandidateExamType,
  attendanceStatus?: CandidateExamAttemptResponse["examAttendanceStatus"] | ""
): number {
  const maxAttemptNumber = candidateExamAttemptLimit(attempts, examType, attendanceStatus);
  const used = attempts
    .filter((attempt) => attempt.examType === examType)
    .map((attempt) => attempt.attemptNumber);
  for (let number = 1; number <= maxAttemptNumber; number += 1) {
    if (!used.includes(number)) return number;
  }
  return maxAttemptNumber + 1;
}

function candidateExamAttemptLimit(
  attempts: CandidateExamAttemptResponse[],
  examType: CandidateExamType,
  attendanceStatus?: CandidateExamAttemptResponse["examAttendanceStatus"] | ""
): number {
  if (examType !== "practice") return 4;
  const hasReportedAttempt =
    attendanceStatus === "reported" ||
    attempts.some((attempt) => attempt.examType === "practice" && attempt.examAttendanceStatus === "reported");
  return hasReportedAttempt ? 5 : 4;
}

function suggestedCandidateExamFee(
  row: LicenseClassFeeRowResponse | undefined,
  examType: CandidateExamType,
  attemptNumber: number
): number | null {
  if (examType === "theory") return row?.institutionTheoryExamFee ?? null;
  if (attemptNumber > 1) return row?.program.failureRetryFee ?? null;
  return row?.institutionPracticeExamFee ?? null;
}

const THEORY_RIGHTS_EXPIRY_DAYS = 120;

function parseISODateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function addDaysToISODate(value: string | null | undefined, days: number): string {
  const date = parseISODateOnly(value);
  if (!date) return "";
  date.setDate(date.getDate() + days);
  return toDateOnlyValue(date);
}

function dateOnlyInTurkey(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Istanbul",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function compareDateOnly(left: string, right: string): number {
  return left.localeCompare(right);
}

function daysUntilISODate(value: string): number {
  const target = parseISODateOnly(value);
  if (!target) return 0;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function formatRemainingDayCount(days: number): string {
  return days >= 0 ? `${days} gün` : `${Math.abs(days)} gün geçti`;
}

function theoryRightsExpiryKind(days: number): "normal" | "warning" | "danger" {
  if (days < 0) return "danger";
  if (days <= 10) return "warning";
  return "normal";
}

function addMonthsToISODate(value: string, months: number): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "";
  const targetMonth = month - 1 + months;
  const lastDayOfTargetMonth = new Date(year, targetMonth + 1, 0).getDate();
  return toDateOnlyValue(new Date(year, targetMonth, Math.min(day, lastDayOfTargetMonth)));
}

function toDateOnlyValue(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildCoursePaymentPlanMovements(
  totalAmount: number,
  installmentCount: number,
  firstDueDate: string,
  customDueDates: Record<number, string> = {}
): Array<{
  type: CandidateAccountingType;
  dueDate: string;
  amount: number;
  description: string;
}> {
  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / installmentCount);

  return Array.from({ length: installmentCount }, (_, index) => {
    const cents =
      index === installmentCount - 1
        ? totalCents - baseCents * (installmentCount - 1)
        : baseCents;

    return {
      type: "kurs",
      dueDate: customDueDates[index] ?? addMonthsToISODate(firstDueDate, index),
      amount: cents / 100,
      description: `Ödeme planı ${index + 1}/${installmentCount}`,
    };
  });
}

function parseMoneyInput(value: string): number | null {
  const raw = value.trim().replace(/\s/g, "");
  if (!raw) return null;
  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");
  const normalized = hasComma && hasDot
    ? raw.lastIndexOf(",") > raw.lastIndexOf(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.replace(/,/g, "")
    : hasComma
      ? raw.replace(",", ".")
    : hasDot && /^\d{1,3}(\.\d{3})+$/.test(raw)
      ? raw.replace(/\./g, "")
      : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function secondPracticeRoundErrorMessage(
  error: unknown,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
): string {
  if (error instanceof ApiError) {
    const codes = Object.values(error.validationErrorCodes ?? {}).flat();
    for (const entry of codes) {
      if (entry.code === "candidate.validation.secondPracticeRoundNotEligible") {
        return t("candidateDetail.secondRound.error.notEligible");
      }
      if (entry.code === "candidate.validation.secondPracticeRoundHasAttempts") {
        return t("candidateDetail.secondRound.cannotCloseTitle");
      }
      if (entry.code === "candidate.validation.concurrencyConflict") {
        return t("candidateDetail.exam.toast.conflictRefresh");
      }
    }
  }
  return t("candidateDetail.secondRound.error.updateFailed");
}

function examAttemptCreateErrorMessage(
  error: unknown,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
): string {
  if (error instanceof ApiError) {
    const codes = Object.values(error.validationErrorCodes ?? {}).flat();
    for (const entry of codes) {
      if (entry.code === "candidateExamAttemptFailedCandidateNeedsTraining") {
        return t("candidateDetail.exam.error.needsTraining");
      }
      if (entry.code === "candidateExamAttemptAttemptLimitReached") {
        return t("candidateDetail.exam.error.attemptLimitReached");
      }
    }
  }
  return t("candidateDetail.exam.error.attemptCreateFailed");
}

function accountingErrorMessage(
  error: unknown,
  fallback: string,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
): string {
  if (!(error instanceof ApiError)) return fallback;
  const messages = Object.values(error.validationErrors ?? {}).flat();
  const firstMessage = messages[0];
  if (!firstMessage) return fallback;

  if (firstMessage.includes("open balance")) return t("candidateDetail.accounting.error.openBalanceExceeded");
  if (firstMessage.includes("Cash register is required")) return t("candidateDetail.accounting.error.cashRegisterRequired");
  if (firstMessage.includes("Cash register type")) return t("candidateDetail.accounting.error.cashRegisterMismatch");
  if (firstMessage.includes("Paid movement") || firstMessage.includes("Paid debt")) {
    return t("candidateDetail.accounting.error.paidCannotDelete");
  }
  if (firstMessage.includes("Refund amount")) return t("candidateDetail.accounting.error.refundExceeded");
  if (firstMessage.includes("Cancellation reason")) return t("candidateDetail.accounting.error.cancellationReasonRequired");
  return firstMessage;
}

function paymentMethodLabelKey(method: CandidatePaymentMethod): TranslationKey {
  if (method === "cash") return "candidateDetail.accounting.method.cash";
  if (method === "credit_card") return "candidateDetail.accounting.method.creditCard";
  if (method === "bank_transfer") return "candidateDetail.accounting.method.bankTransfer";
  if (method === "mail_order") return "candidateDetail.accounting.method.mailOrder";
  return "candidateDetail.accounting.method.other";
}

function paymentMethodLabel(method: CandidatePaymentMethod): string {
  if (method === "cash") return "Nakit";
  if (method === "credit_card") return "Kredi Kartı";
  if (method === "bank_transfer") return "Havale/EFT";
  if (method === "mail_order") return "Mail Order";
  return "Diğer";
}

function accountingTypeLabelKey(type: CandidateAccountingType): TranslationKey {
  if (type === "kurs") return "candidateDetail.accounting.type.course";
  if (type === "teorik_sinav") return "candidateDetail.accounting.type.theoryExam";
  if (type === "direksiyon_sinav") return "candidateDetail.accounting.type.practiceExam";
  return "candidateDetail.accounting.type.other";
}

function accountingTypeLabel(type: CandidateAccountingType): string {
  if (type === "kurs") return "Kurs";
  if (type === "teorik_sinav") return "Teorik Sınavı";
  if (type === "direksiyon_sinav") return "Direksiyon Sınavı";
  return "Diğer";
}

function accountingPaymentDisplayTypeLabel(type: CandidateAccountingType): string {
  if (type === "teorik_sinav") return "E-Sınav";
  if (type === "direksiyon_sinav") return "Direksiyon";
  return accountingTypeLabel(type);
}

function accountingMovementStatus(
  movement: CandidateAccountingSummaryResponse["movements"][number]
): { className: string } {
  return {
    className: movement.status === "cancelled" ? "status-cancelled" : "status-open",
  };
}

function accountingMovementStatusLabelKey(
  movement: CandidateAccountingSummaryResponse["movements"][number]
): TranslationKey {
  return movement.status === "cancelled"
    ? "candidateDetail.accounting.movement.cancelled"
    : "candidateDetail.accounting.movement.debt";
}

function refundShareForMovement(
  payment: CandidateAccountingSummaryResponse["payments"][number],
  movementId: string,
  refundAmount: number
): number {
  const grossAllocated = payment.allocations.reduce((sum, item) => sum + item.amount, 0);
  if (grossAllocated <= 0) return 0;

  let distributedRefund = 0;
  for (let index = 0; index < payment.allocations.length; index += 1) {
    const allocation = payment.allocations[index];
    const allocationRefund =
      index === payment.allocations.length - 1
        ? Math.round((refundAmount - distributedRefund) * 100) / 100
        : Math.round((refundAmount * allocation.amount / grossAllocated) * 100) / 100;
    distributedRefund += allocationRefund;
    if (allocation.movementId === movementId) return allocationRefund;
  }

  return 0;
}

const ACCOUNTING_TYPES: CandidateAccountingType[] = [
  "kurs",
  "teorik_sinav",
  "direksiyon_sinav",
  "diger",
];

const ACCOUNTING_SECTION_DEFINITIONS: Array<{
  id: "course" | "exam" | "other";
  titleKey: TranslationKey;
  detailKey: TranslationKey;
  types: CandidateAccountingType[];
}> = [
  {
    id: "course",
    titleKey: "candidateDetail.accounting.section.coursePayment",
    detailKey: "candidateDetail.accounting.section.coursePaymentDetail",
    types: ["kurs"],
  },
  {
    id: "exam",
    titleKey: "candidateDetail.accounting.section.examFees",
    detailKey: "candidateDetail.accounting.section.examFeesDetail",
    types: ["teorik_sinav", "direksiyon_sinav"],
  },
  {
    id: "other",
    titleKey: "candidateDetail.accounting.section.otherPayments",
    detailKey: "candidateDetail.accounting.section.otherPaymentsDetail",
    types: ["diger"],
  },
];

const PAYMENT_METHODS: CandidatePaymentMethod[] = [
  "cash",
  "bank_transfer",
  "credit_card",
  "mail_order",
  "other",
];

function cashRegisterTypeForMethod(method: CandidatePaymentMethod) {
  return method === "other" ? null : method;
}

type AccountingLedgerColumnId =
  | "type"
  | "description"
  | "dueDate"
  | "amount"
  | "paidAmount"
  | "remainingAmount"
  | "number"
  | "receiptNumber"
  | "method"
  | "cashRegister"
  | "refundedAmount"
  | "paidAt"
  | "createdAt"
  | "actions";

type AccountingLedgerSortField = Exclude<AccountingLedgerColumnId, "actions">;
type AccountingLedgerFilterKey = "kind" | "status" | "method" | "cashRegister";
type AccountingLedgerSortState = {
  field: AccountingLedgerSortField;
  direction: "asc" | "desc";
} | null;

type AccountingLedgerFilters = Record<AccountingLedgerFilterKey, string>;

const ACCOUNTING_LEDGER_COLUMNS: Array<{
  id: AccountingLedgerColumnId;
  labelKey: TranslationKey;
  sortField?: AccountingLedgerSortField;
  locked?: boolean;
}> = [
  { id: "type", labelKey: "candidateDetail.accounting.col.type", sortField: "type", locked: true },
  { id: "dueDate", labelKey: "candidateDetail.accounting.col.dueDate", sortField: "dueDate" },
  { id: "amount", labelKey: "candidateDetail.accounting.col.amount", sortField: "amount" },
  { id: "paidAmount", labelKey: "candidateDetail.accounting.col.paid", sortField: "paidAmount" },
  { id: "remainingAmount", labelKey: "candidateDetail.accounting.col.remaining", sortField: "remainingAmount" },
  { id: "paidAt", labelKey: "candidateDetail.accounting.col.paymentDate", sortField: "paidAt" },
  { id: "receiptNumber", labelKey: "candidateDetail.accounting.col.receiptNumber", sortField: "receiptNumber" },
  { id: "method", labelKey: "candidateDetail.accounting.col.method", sortField: "method" },
  { id: "cashRegister", labelKey: "candidateDetail.accounting.col.cashRegister", sortField: "cashRegister" },
  { id: "description", labelKey: "candidateDetail.accounting.col.description", sortField: "description" },
  { id: "actions", labelKey: "candidateDetail.accounting.col.actions", locked: true },
  { id: "refundedAmount", labelKey: "candidateDetail.accounting.col.refund", sortField: "refundedAmount" },
  { id: "number", labelKey: "candidateDetail.accounting.col.number", sortField: "number" },
  { id: "createdAt", labelKey: "candidateDetail.accounting.col.createdAt", sortField: "createdAt" },
];

const DEFAULT_ACCOUNTING_LEDGER_VISIBLE_COLUMNS: AccountingLedgerColumnId[] = [
  "type",
  "dueDate",
  "amount",
  "paidAt",
  "receiptNumber",
  "method",
  "cashRegister",
  "description",
  "actions",
];

const DEFAULT_ACCOUNTING_LEDGER_FILTERS: AccountingLedgerFilters = {
  kind: "hideCancelled",
  status: "all",
  method: "all",
  cashRegister: "all",
};

function AccountingTab({
  accounting,
  accountingLoading,
  accountingError,
  canManagePayments,
  candidate,
  movementSaving,
  paymentSaving,
  invoiceSaving,
  onCreateMovement,
  onCreateMovements,
  onCreatePayment,
  onCancelMovement,
  onCancelPayment,
  onRefundPayment,
  onSaveInvoice,
  onDeleteInvoice,
}: {
  accounting: CandidateAccountingSummaryResponse | null;
  accountingLoading: boolean;
  accountingError: string | null;
  canManagePayments: boolean;
  candidate: CandidateResponse;
  movementSaving: boolean;
  paymentSaving: boolean;
  invoiceSaving: boolean;
  onCreateMovement: (
    type: CandidateAccountingType,
    dueDate: string,
    amount: number,
    description: string
  ) => void;
  onCreateMovements: (
    movements: Array<{
      type: CandidateAccountingType;
      dueDate: string;
      amount: number;
      description: string;
    }>
  ) => void | Promise<void>;
  onCreatePayment: (
    type: CandidateAccountingType,
    amount: number,
    method: CandidatePaymentMethod,
    cashRegisterId: string | null,
    paidAtUtc: string,
    note: string | null,
    movementId: string | null
  ) => void;
  onCancelMovement: (movementId: string, cancellationReason: string) => void;
  onCancelPayment: (paymentId: string, cancellationReason: string) => void;
  onRefundPayment: (paymentId: string, amount: number | null, note: string | null) => void;
  onSaveInvoice: (
    invoice: CandidateAccountingInvoiceResponse | null,
    payload: {
      invoiceNo: string;
      invoiceType: string;
      invoiceDate: string;
      subtotal: number;
      vatRate: number;
      notes?: string | null;
    }
  ) => void;
  onDeleteInvoice: (invoiceId: string) => void;
}) {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const handledAccountingQueryRef = useRef("");
  const [cashRegisters, setCashRegisters] = useState<CashRegisterResponse[]>([]);
  const [debtModal, setDebtModal] = useState<{
    open: boolean;
    type: CandidateAccountingType;
    amount: string;
    dueDate: string;
    description: string;
  }>({
    open: false,
    type: "kurs",
    amount: "",
    dueDate: todayIsoDate(),
    description: "",
  });
  const [paymentPlanModal, setPaymentPlanModal] = useState<{
    open: boolean;
    amount: string;
    installmentCount: string;
    dueDate: string;
    customDueDates: Record<number, string>;
    previewOpen: boolean;
  }>({
    open: false,
    amount: "",
    installmentCount: "4",
    dueDate: todayIsoDate(),
    customDueDates: {},
    previewOpen: false,
  });
  const [paymentModal, setPaymentModal] = useState<{
    open: boolean;
    type: CandidateAccountingType;
    amount: string;
    method: CandidatePaymentMethod;
    cashRegisterId: string;
    paidAtUtc: string;
    note: string;
    movementId: string;
  }>({
    open: false,
    type: "kurs",
    amount: "",
    method: "cash",
    cashRegisterId: "",
    paidAtUtc: nowDateTimeLocal(),
    note: "",
    movementId: "",
  });
  const [invoiceModal, setInvoiceModal] = useState<{
    open: boolean;
    invoice: CandidateAccountingInvoiceResponse | null;
    invoiceNo: string;
    invoiceType: string;
    invoiceDate: string;
    subtotal: string;
    vatRate: string;
    notes: string;
  }>({
    open: false,
    invoice: null,
    invoiceNo: "",
    invoiceType: "Satış",
    invoiceDate: todayIsoDate(),
    subtotal: "",
    vatRate: "20",
    notes: "",
  });
  const [receiptPayment, setReceiptPayment] =
    useState<CandidateAccountingSummaryResponse["payments"][number] | null>(null);
  const [cancelPayment, setCancelPayment] =
    useState<CandidateAccountingSummaryResponse["payments"][number] | null>(null);
  const [cancelMovement, setCancelMovement] =
    useState<CandidateAccountingSummaryResponse["movements"][number] | null>(null);
  const [refundPayment, setRefundPayment] =
    useState<CandidateAccountingSummaryResponse["payments"][number] | null>(null);
  const [paymentCancelReason, setPaymentCancelReason] = useState("");
  const [movementCancelReason, setMovementCancelReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundNote, setRefundNote] = useState("");
  const [sectionSummaryOpen, setSectionSummaryOpen] = useState(false);
  const [feeSuggestionsOpen, setFeeSuggestionsOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getCashRegisters({ activity: "active", page: 1, pageSize: 200 }, controller.signal)
      .then((response) => setCashRegisters(response.items))
      .catch(() => {
        /* Kasa yoksa ödeme formu zaten kayıt engeller. */
      });
    return () => controller.abort();
  }, []);

  const allMovements = accounting?.debts ?? accounting?.movements ?? [];
  const activeMovements = allMovements.filter((item) => item.status === "active");
  const payments = accounting?.payments ?? [];
  const feeSuggestions = accounting?.feeSuggestions ?? [];
  const primaryCourseFeeSuggestion = feeSuggestions.find(
    (suggestion) => suggestion.feeType === "license_class_matrix_course_fee"
  );
  const totalDebtAmount = activeMovements.reduce((sum, item) => sum + item.remainingAmount, 0);
  const courseFeeMovements = activeMovements.filter((item) => item.type === "kurs");
  const courseFeeSummary = {
    totalAmount: courseFeeMovements.reduce((sum, item) => sum + item.amount, 0),
    paidAmount: courseFeeMovements.reduce((sum, item) => sum + item.paidAmount, 0),
    remainingAmount: courseFeeMovements.reduce((sum, item) => sum + item.remainingAmount, 0),
  };
  const theoryExamDebtAmount = activeMovements
    .filter((item) => item.type === "teorik_sinav")
    .reduce((sum, item) => sum + item.remainingAmount, 0);
  const practiceExamDebtAmount = activeMovements
    .filter((item) => item.type === "direksiyon_sinav")
    .reduce((sum, item) => sum + item.remainingAmount, 0);
  const otherFeeDebtAmount = activeMovements
    .filter((item) => item.type === "diger")
    .reduce((sum, item) => sum + item.remainingAmount, 0);
  const sectionMovements = (types: CandidateAccountingType[]) =>
    allMovements.filter((item) => types.includes(item.type));
  const sectionSummaries = ACCOUNTING_SECTION_DEFINITIONS.map((section) => {
    const movements = sectionMovements(section.types);

    return {
      ...section,
      movementCount: movements.length,
      totalAmount: movements.reduce((sum, item) => sum + item.amount, 0),
      paidAmount: movements.reduce((sum, item) => sum + item.paidAmount, 0),
      refundedAmount: movements.reduce((sum, item) => sum + item.refundedAmount, 0),
      remainingAmount: movements.reduce((sum, item) => sum + item.remainingAmount, 0),
    };
  });
  const invoiceSummary = {
    count: accounting?.invoices.length ?? 0,
    subtotal: accounting?.invoices.reduce((sum, item) => sum + item.subtotal, 0) ?? 0,
    vatAmount: accounting?.invoices.reduce((sum, item) => sum + item.vatAmount, 0) ?? 0,
    totalAmount: accounting?.invoices.reduce((sum, item) => sum + item.totalAmount, 0) ?? 0,
  };
  const typeOpenBalance = (type: CandidateAccountingType) =>
    activeMovements
      .filter((item) => item.type === type)
      .reduce((sum, item) => sum + item.remainingAmount, 0);

  const availableCashRegisters = cashRegisters.filter((register) => {
    const expected = cashRegisterTypeForMethod(paymentModal.method);
    return expected !== null && register.type === expected;
  });
  const parsedDebtAmount = parseMoneyInput(debtModal.amount);
  const parsedPaymentPlanAmount = parseMoneyInput(paymentPlanModal.amount);
  const paymentPlanInstallmentCount = Number(paymentPlanModal.installmentCount);
  const parsedPaymentAmount = parseMoneyInput(paymentModal.amount);
  const paymentNeedsRegister = cashRegisterTypeForMethod(paymentModal.method) !== null;
  const paymentTargetMovement = paymentModal.movementId
    ? activeMovements.find((item) => item.id === paymentModal.movementId)
    : null;
  const paymentOpenBalance = paymentTargetMovement?.remainingAmount ?? typeOpenBalance(paymentModal.type);
  const canSaveDebt =
    canManagePayments &&
    Boolean(debtModal.dueDate) &&
    parsedDebtAmount != null &&
    parsedDebtAmount > 0 &&
    !movementSaving;
  const hasValidPaymentPlan =
    Boolean(paymentPlanModal.dueDate) &&
    parsedPaymentPlanAmount != null &&
    parsedPaymentPlanAmount > 0 &&
    Number.isInteger(paymentPlanInstallmentCount) &&
    paymentPlanInstallmentCount > 0 &&
    paymentPlanInstallmentCount <= 36 &&
    Math.round(parsedPaymentPlanAmount * 100) >= paymentPlanInstallmentCount;
  const paymentPlanPreviewMovements =
    hasValidPaymentPlan && parsedPaymentPlanAmount != null
      ? buildCoursePaymentPlanMovements(
          parsedPaymentPlanAmount,
          paymentPlanInstallmentCount,
          paymentPlanModal.dueDate,
          paymentPlanModal.customDueDates
        )
      : [];
  const canSavePaymentPlan =
    canManagePayments &&
    hasValidPaymentPlan &&
    paymentPlanModal.previewOpen &&
    !movementSaving;
  const canSavePayment =
    canManagePayments &&
    parsedPaymentAmount != null &&
    parsedPaymentAmount > 0 &&
    parsedPaymentAmount <= paymentOpenBalance &&
    (!paymentNeedsRegister || Boolean(paymentModal.cashRegisterId)) &&
    !paymentSaving;
  const invoiceSubtotal = parseMoneyInput(invoiceModal.subtotal);
  const invoiceVatRate = Number(invoiceModal.vatRate);
  const invoiceVatAmount =
    invoiceSubtotal != null ? Math.round((invoiceSubtotal * invoiceVatRate / 100) * 100) / 100 : 0;
  const invoiceTotal = invoiceSubtotal != null ? invoiceSubtotal + invoiceVatAmount : 0;
  const canSaveInvoice =
    canManagePayments &&
    Boolean(invoiceModal.invoiceNo.trim()) &&
    Boolean(invoiceModal.invoiceType.trim()) &&
    Boolean(invoiceModal.invoiceDate) &&
    invoiceSubtotal != null &&
    invoiceSubtotal > 0 &&
    !invoiceSaving;

  const openDebtModal = (
    type: CandidateAccountingType = "kurs",
    amount = "",
    description = ""
  ) => {
    if (!canManagePayments) return;
    setDebtModal({
      open: true,
      type,
      amount,
      dueDate: todayIsoDate(),
      description,
    });
  };
  const openPaymentPlanModal = (amount?: number) => {
    if (!canManagePayments) return;
    const defaultAmount =
      amount ??
      primaryCourseFeeSuggestion?.amount ??
      (candidate.totalFee > 0 ? candidate.totalFee : courseFeeSummary.totalAmount);
    setPaymentPlanModal({
      open: true,
      amount: defaultAmount > 0 ? String(defaultAmount) : "",
      installmentCount: "4",
      dueDate: todayIsoDate(),
      customDueDates: {},
      previewOpen: false,
    });
  };
  const selectPaymentMethod = (method: CandidatePaymentMethod) => {
    const firstRegister = cashRegisters.find((register) => register.type === cashRegisterTypeForMethod(method));
    setPaymentModal((current) => ({
      ...current,
      method,
      cashRegisterId: firstRegister?.id ?? "",
    }));
  };
  const openPaymentModal = (
    type: CandidateAccountingType = "kurs",
    amount = "",
    movementId = ""
  ) => {
    if (!canManagePayments) return;
    const defaultMethod: CandidatePaymentMethod = "cash";
    const firstRegister = cashRegisters.find((register) => register.type === defaultMethod);
    const movementDescription = movementId
      ? activeMovements.find((item) => item.id === movementId)?.description ?? ""
      : "";
    setPaymentModal({
      open: true,
      type,
      amount,
      method: defaultMethod,
      cashRegisterId: firstRegister?.id ?? "",
      paidAtUtc: nowDateTimeLocal(),
      note: movementDescription,
      movementId,
    });
  };
  const openInvoiceModal = (
    invoice: CandidateAccountingInvoiceResponse | null = null,
    amount?: number
  ) => {
    if (!canManagePayments) return;
    setInvoiceModal({
      open: true,
      invoice,
      invoiceNo: invoice?.invoiceNo ?? "",
      invoiceType: invoice?.invoiceType ?? "Satış",
      invoiceDate: invoice?.invoiceDate ?? todayIsoDate(),
      subtotal: invoice ? String(invoice.subtotal) : amount ? String(amount) : "",
      vatRate: invoice ? String(invoice.vatRate) : "20",
      notes: invoice?.notes ?? "",
    });
  };
  const openRefundModal = (payment: CandidateAccountingSummaryResponse["payments"][number]) => {
    if (!canManagePayments) return;
    setRefundPayment(payment);
    setRefundAmount(String(Math.max(0, payment.amount - payment.refundedAmount)));
    setRefundNote("");
  };
  const openCancelMovementModal = (movement: CandidateAccountingSummaryResponse["movements"][number]) => {
    if (!canManagePayments) return;
    setCancelMovement(movement);
    setMovementCancelReason("");
  };
  const noPermissionTitle = "Yetkiniz yok.";
  useEffect(() => {
    if (!accounting) return;
    const queryKey = searchParams.toString();
    if (!queryKey || handledAccountingQueryRef.current === queryKey) return;

    const paymentId = searchParams.get("paymentId");
    if (paymentId) {
      const payment = accounting.payments.find((item) => item.id === paymentId);
      if (payment) {
        handledAccountingQueryRef.current = queryKey;
        setReceiptPayment(payment);
        setSearchParams({ tab: "payments" }, { replace: true });
      }
      return;
    }

    if (searchParams.get("action") === "payment") {
      const movementId = searchParams.get("movementId") ?? searchParams.get("installmentId");
      const movement = accounting.movements.find(
        (item) => item.id === movementId && item.status === "active" && item.remainingAmount > 0
      );
      if (movement) {
        handledAccountingQueryRef.current = queryKey;
        openPaymentModal(movement.type, String(movement.remainingAmount), movement.id);
        setSearchParams({ tab: "payments" }, { replace: true });
      }
    }
  }, [accounting, searchParams, setSearchParams]);

  return (
    <div className="candidate-detail-tab-content">
      <section className="instructor-detail-card">
        <h3 className="candidate-detail-section-title">{t("candidateDetail.accounting.section.summary")}</h3>
        {accountingLoading ? (
          <div aria-busy="true" className="candidate-fee-summary-shell">
            <div className="candidate-fee-summary-group">
              <SkeletonLine height={16} width={140} />
              <div className="candidate-finance-summary-grid candidate-course-fee-summary-cards">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div className="candidate-finance-summary-card" key={index}>
                    <SkeletonLine height={12} width={72} />
                    <SkeletonLine height={24} width={96 + index * 12} />
                  </div>
                ))}
              </div>
            </div>
            <div className="candidate-fee-summary-column candidate-fee-summary-debt-column">
              <div className="candidate-fee-summary-group">
                <SkeletonLine height={16} width={132} />
                <div className="candidate-finance-summary-grid candidate-exam-debt-summary-cards">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div className="candidate-finance-summary-card" key={index}>
                      <SkeletonLine height={12} width={88} />
                      <SkeletonLine height={24} width={104} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : accountingError ? (
          <div className="instructor-detail-error">{accountingError}</div>
        ) : accounting ? (
          <>
            <div className="candidate-fee-summary-shell">
              <div className="candidate-fee-summary-group">
                <h4 className="candidate-fee-summary-title">{t("candidateDetail.accounting.summary.courseFee")}</h4>
                <div className="candidate-finance-summary-grid candidate-course-fee-summary-cards">
                  <div className="candidate-finance-summary-card">
                    <span className="candidate-detail-stat-label">{t("candidateDetail.accounting.summary.fee")}</span>
                    <strong>{formatCurrencyTRY(courseFeeSummary.totalAmount)}</strong>
                  </div>
                  <div className="candidate-finance-summary-card">
                    <span className="candidate-detail-stat-label">{t("candidateDetail.accounting.summary.paid")}</span>
                    <strong>{formatCurrencyTRY(courseFeeSummary.paidAmount)}</strong>
                  </div>
                  <div className="candidate-finance-summary-card is-balance">
                    <span className="candidate-detail-stat-label">Kalan</span>
                    <strong>{formatCurrencyTRY(courseFeeSummary.remainingAmount)}</strong>
                  </div>
                </div>
              </div>
              <div className="candidate-fee-summary-column candidate-fee-summary-debt-column">
                <div className="candidate-fee-summary-group">
                  <h4 className="candidate-fee-summary-title">{t("candidateDetail.accounting.summary.examDebts")}</h4>
                  <div className="candidate-finance-summary-grid candidate-exam-debt-summary-cards">
                    <div className="candidate-finance-summary-card">
                      <span className="candidate-detail-stat-label">{t("candidateDetail.accounting.summary.theoryDebt")}</span>
                      <strong>{formatCurrencyTRY(theoryExamDebtAmount)}</strong>
                    </div>
                    <div className="candidate-finance-summary-card">
                      <span className="candidate-detail-stat-label">{t("candidateDetail.accounting.summary.drivingDebt")}</span>
                      <strong>{formatCurrencyTRY(practiceExamDebtAmount)}</strong>
                    </div>
                  </div>
                </div>
                <div className="candidate-finance-summary-grid candidate-fee-summary-single-card">
                  <div className="candidate-finance-summary-card">
                    <span className="candidate-detail-stat-label">{t("candidateDetail.accounting.summary.otherDebt")}</span>
                    <strong>{formatCurrencyTRY(otherFeeDebtAmount)}</strong>
                  </div>
                </div>
                <div className="candidate-finance-summary-grid candidate-fee-summary-single-card">
                  <div className="candidate-finance-summary-card is-balance">
                    <span className="candidate-detail-stat-label">{t("candidateDetail.accounting.summary.totalDebt")}</span>
                    <strong>{formatCurrencyTRY(totalDebtAmount)}</strong>
                  </div>
                </div>
              </div>
            </div>
            <div className="candidate-accounting-section-summary-shell">
              <button
                aria-expanded={sectionSummaryOpen}
                className="candidate-accounting-section-summary-toggle"
                onClick={() => setSectionSummaryOpen((current) => !current)}
                type="button"
              >
                <span>
                  <strong>Detaylı özet</strong>
                  <em>Kurs, sınav, diğer ve fatura kırılımı</em>
                </span>
                <span aria-hidden="true">{sectionSummaryOpen ? t("candidateDetail.accounting.summary.collapse") : t("candidateDetail.accounting.summary.expand")}</span>
              </button>
              {sectionSummaryOpen ? (
                <div className="candidate-accounting-section-summary" aria-label={t("candidateDetail.accounting.summary.sectionAria")}>
                  {sectionSummaries.map((section) => (
                    <div className="candidate-accounting-section-summary-row" key={section.id}>
                      <div className="candidate-accounting-section-summary-title">
                        <strong>{t(section.titleKey)}</strong>
                        <span>
                          {t(section.detailKey)} · {t("candidateDetail.accounting.section.movementCount", { count: section.movementCount })}
                        </span>
                      </div>
                      <div className="candidate-accounting-section-summary-metrics">
                        <span>
                          <em>Borç</em>
                          <strong>{formatCurrencyTRY(section.totalAmount)}</strong>
                        </span>
                        <span>
                          <em>Tahsil</em>
                          <strong>{formatCurrencyTRY(section.paidAmount)}</strong>
                        </span>
                        <span>
                          <em>İade</em>
                          <strong>{formatCurrencyTRY(section.refundedAmount)}</strong>
                        </span>
                        <span className={section.remainingAmount > 0 ? "is-balance" : undefined}>
                          <em>Kalan</em>
                          <strong>{formatCurrencyTRY(section.remainingAmount)}</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="candidate-accounting-section-summary-row">
                    <div className="candidate-accounting-section-summary-title">
                      <strong>Faturalar</strong>
                      <span>
                        Manuel fatura kayıtları · {invoiceSummary.count} fatura
                      </span>
                    </div>
                    <div className="candidate-accounting-section-summary-metrics">
                      <span>
                        <em>Matrah</em>
                        <strong>{formatCurrencyTRY(invoiceSummary.subtotal)}</strong>
                      </span>
                      <span>
                        <em>KDV</em>
                        <strong>{formatCurrencyTRY(invoiceSummary.vatAmount)}</strong>
                      </span>
                      <span className="is-balance">
                        <em>Toplam</em>
                        <strong>{formatCurrencyTRY(invoiceSummary.totalAmount)}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </section>

      <section className="candidate-finance-action-bar">
        <div className="candidate-finance-action-meta">
          <span>Hızlı işlemler</span>
          <strong>Borçlandırma ekle, ödeme al veya fatura kaydet</strong>
        </div>
        <div className="candidate-finance-action-buttons">
          <button
            className="btn btn-primary"
            disabled={!canManagePayments}
            onClick={() => openPaymentPlanModal()}
            title={!canManagePayments ? noPermissionTitle : undefined}
            type="button"
          >
            Ödeme Planı Oluştur
          </button>
          <button
            className="btn btn-primary"
            disabled={!canManagePayments}
            onClick={() => openDebtModal()}
            title={!canManagePayments ? noPermissionTitle : undefined}
            type="button"
          >
            Borç Ekle
          </button>
          {feeSuggestions.length ? (
            <button
              className="btn btn-secondary"
              disabled={!canManagePayments}
              onClick={() => setFeeSuggestionsOpen((value) => !value)}
              title={!canManagePayments ? noPermissionTitle : undefined}
              type="button"
            >
              {feeSuggestionsOpen ? t("candidateDetail.accounting.feeSuggestionsHide") : t("candidateDetail.accounting.feeSuggestionsShow")}
            </button>
          ) : null}
          <button
            className="btn btn-secondary"
            disabled={!canManagePayments}
            onClick={() => openPaymentModal()}
            title={!canManagePayments ? noPermissionTitle : undefined}
            type="button"
          >
            Ödeme Al
          </button>
          <button
            className="btn btn-secondary"
            disabled={!canManagePayments}
            onClick={() => openInvoiceModal()}
            title={!canManagePayments ? noPermissionTitle : undefined}
            type="button"
          >
            Fatura Ekle
          </button>
        </div>
      </section>

      {feeSuggestionsOpen && feeSuggestions.length ? (
        <section className="instructor-detail-card candidate-finance-suggestion">
          <div className="candidate-finance-suggestion-meta">
            {feeSuggestions.map((suggestion) => (
              <button
                className="btn btn-secondary btn-sm"
                disabled={!canManagePayments}
                key={`${suggestion.feeType}:${suggestion.feeId}`}
                onClick={() =>
                  openDebtModal(
                    suggestion.type,
                    String(suggestion.amount),
                    suggestion.description
                  )
                }
                title={!canManagePayments ? noPermissionTitle : undefined}
                type="button"
              >
                {suggestion.description} · {formatCurrencyTRY(suggestion.amount)}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <AccountingMovementSection
        movements={sectionMovements(["kurs"])}
        onCancelMovement={openCancelMovementModal}
        onCancelPayment={(payment) => {
          if (!canManagePayments) return;
          setCancelPayment(payment);
          setPaymentCancelReason("");
        }}
        onCreateInvoice={(amount) => openInvoiceModal(null, amount)}
        onOpenReceipt={(payment) => setReceiptPayment(payment)}
        onOpenRefund={openRefundModal}
        onPay={(movement) => openPaymentModal(movement.type, String(movement.remainingAmount), movement.id)}
        canManagePayments={canManagePayments}
        payments={payments}
        refunds={accounting?.refunds ?? []}
        title={t("candidateDetail.accounting.section.coursePayment")}
      />
      <AccountingMovementSection
        movements={sectionMovements(["teorik_sinav", "direksiyon_sinav"])}
        onCancelMovement={openCancelMovementModal}
        onCancelPayment={(payment) => {
          if (!canManagePayments) return;
          setCancelPayment(payment);
          setPaymentCancelReason("");
        }}
        onCreateInvoice={(amount) => openInvoiceModal(null, amount)}
        onOpenReceipt={(payment) => setReceiptPayment(payment)}
        onOpenRefund={openRefundModal}
        onPay={(movement) => openPaymentModal(movement.type, String(movement.remainingAmount), movement.id)}
        canManagePayments={canManagePayments}
        payments={payments}
        refunds={accounting?.refunds ?? []}
        title={t("candidateDetail.accounting.section.examFees")}
      />
      <AccountingMovementSection
        movements={sectionMovements(["diger"])}
        onCancelMovement={openCancelMovementModal}
        onCancelPayment={(payment) => {
          if (!canManagePayments) return;
          setCancelPayment(payment);
          setPaymentCancelReason("");
        }}
        onCreateInvoice={(amount) => openInvoiceModal(null, amount)}
        onOpenReceipt={(payment) => setReceiptPayment(payment)}
        onOpenRefund={openRefundModal}
        onPay={(movement) => openPaymentModal(movement.type, String(movement.remainingAmount), movement.id)}
        canManagePayments={canManagePayments}
        payments={payments}
        refunds={accounting?.refunds ?? []}
        title={t("candidateDetail.accounting.section.otherPayments")}
      />

      <section className="instructor-detail-card candidate-finance-workspace-card">
        <h3 className="candidate-detail-section-title">{t("candidateDetail.accounting.section.invoices")}</h3>
        {accounting?.invoices.length ? (
          <table className="data-table candidate-detail-fee-table candidate-accounting-invoice-table">
            <thead>
              <tr>
                <th>Fatura No</th>
                <th>Fatura Tipi</th>
                <th>Fatura Tarihi</th>
                <th>Tutar</th>
                <th>KDV</th>
                <th>Toplam Tutar</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {accounting.invoices.map((invoice) => (
                <tr className={invoiceRowClassName(invoice.invoiceType)} key={invoice.id}>
                  <td>{invoice.invoiceNo}</td>
                  <td>{invoice.invoiceType}</td>
                  <td>{formatDateTR(invoice.invoiceDate)}</td>
                  <td>{formatCurrencyTRY(invoice.subtotal)}</td>
                  <td>%{invoice.vatRate} · {formatCurrencyTRY(invoice.vatAmount)}</td>
                  <td>{formatCurrencyTRY(invoice.totalAmount)}</td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={!canManagePayments}
                      onClick={() => openInvoiceModal(invoice)}
                      title={!canManagePayments ? noPermissionTitle : undefined}
                      type="button"
                    >
                      Düzenle
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={!canManagePayments}
                      onClick={() => onDeleteInvoice(invoice.id)}
                      title={!canManagePayments ? noPermissionTitle : undefined}
                      type="button"
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="instructor-detail-empty">{t("candidateDetail.accounting.invoicesEmpty")}</div>
        )}
      </section>

      <Modal
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setPaymentPlanModal((current) => ({ ...current, open: false }))} type="button">
              Vazgeç
            </button>
            <button
              className="btn btn-secondary"
              disabled={!canManagePayments || !hasValidPaymentPlan}
              onClick={() => setPaymentPlanModal((current) => ({ ...current, previewOpen: true }))}
              type="button"
            >
              Önizleme
            </button>
            <button
              className="btn btn-primary"
              disabled={!canSavePaymentPlan}
              onClick={() => {
                if (!canSavePaymentPlan || parsedPaymentPlanAmount == null) return;
                const movementsToCreate = buildCoursePaymentPlanMovements(
                  parsedPaymentPlanAmount,
                  paymentPlanInstallmentCount,
                  paymentPlanModal.dueDate,
                  paymentPlanModal.customDueDates
                );
                void onCreateMovements(movementsToCreate);
                setPaymentPlanModal((current) => ({ ...current, open: false }));
              }}
              type="button"
            >
              {movementSaving ? t("common.saving") : t("candidateDetail.accounting.create")}
            </button>
          </>
        }
        onClose={() => setPaymentPlanModal((current) => ({ ...current, open: false }))}
        open={paymentPlanModal.open}
        title={t("candidateDetail.accounting.modal.installmentPlan")}
      >
        <div className="candidate-accounting-modal-form candidate-payment-plan-modal-form">
          <label className="form-group">
            <span className="form-label">{t("candidateDetail.accounting.summary.courseFee")}</span>
            <input
              className="form-input"
              disabled={!canManagePayments}
              inputMode="decimal"
              onChange={(event) =>
                setPaymentPlanModal((current) => ({
                  ...current,
                  amount: event.target.value,
                  customDueDates: {},
                  previewOpen: false,
                }))
              }
              placeholder="0,00"
              value={paymentPlanModal.amount}
            />
          </label>
          <label className="form-group">
            <span className="form-label">{t("candidateDetail.accounting.field.installmentCount")}</span>
            <input
              className="form-input"
              disabled={!canManagePayments}
              inputMode="numeric"
              min={1}
              max={36}
              onChange={(event) =>
                setPaymentPlanModal((current) => ({
                  ...current,
                  installmentCount: event.target.value,
                  customDueDates: {},
                  previewOpen: false,
                }))
              }
              type="number"
              value={paymentPlanModal.installmentCount}
            />
          </label>
          <label className="form-group">
            <span className="form-label">{t("candidateDetail.accounting.field.firstDueDate")}</span>
            <LocalizedDateInput
              className="form-input"
              disabled={!canManagePayments}
              onChange={(dueDate) =>
                setPaymentPlanModal((current) => ({
                  ...current,
                  dueDate,
                  customDueDates: {},
                  previewOpen: false,
                }))
              }
              value={paymentPlanModal.dueDate}
            />
          </label>
        </div>
        {paymentPlanModal.previewOpen ? (
          paymentPlanPreviewMovements.length ? (
            <div className="candidate-payment-plan-preview">
              <div className="candidate-payment-plan-preview-header">
                <strong>Vade Listesi</strong>
                <span>{paymentPlanPreviewMovements.length} taksit</span>
              </div>
              <table className="data-table candidate-payment-plan-preview-table">
                <thead>
                  <tr>
                    <th>Taksit</th>
                    <th>Vade Tarihi</th>
                    <th>Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentPlanPreviewMovements.map((movement, index) => (
                    <tr key={`${movement.dueDate}:${index}`}>
                      <td>{index + 1}. Taksit</td>
                      <td>
                        <LocalizedDateInput
                          ariaLabel={`${index + 1}. taksit vade tarihi`}
                          className="candidate-payment-plan-date-input"
                          disabled={!canManagePayments}
                          onChange={(dueDate) =>
                            setPaymentPlanModal((current) => ({
                              ...current,
                              customDueDates: {
                                ...current.customDueDates,
                                [index]: dueDate,
                              },
                            }))
                          }
                          size="sm"
                          value={movement.dueDate}
                        />
                      </td>
                      <td>{formatCurrencyTRY(movement.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="instructor-detail-error">{t("candidateDetail.accounting.previewHint")}</div>
          )
        ) : null}
      </Modal>

      <Modal
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDebtModal((current) => ({ ...current, open: false }))} type="button">
              Vazgeç
            </button>
            <button
              className="btn btn-primary"
              disabled={!canSaveDebt}
              onClick={() => {
                if (!canSaveDebt || parsedDebtAmount == null) return;
                onCreateMovement(debtModal.type, debtModal.dueDate, parsedDebtAmount, debtModal.description.trim());
                setDebtModal((current) => ({ ...current, open: false }));
              }}
              title={!canManagePayments ? noPermissionTitle : undefined}
              type="button"
            >
              {movementSaving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </>
        }
        onClose={() => setDebtModal((current) => ({ ...current, open: false }))}
        open={debtModal.open}
        title={t("candidateDetail.accounting.modal.addDebt")}
      >
        <AccountingTypePicker
          disabled={!canManagePayments}
          onChange={(type) => setDebtModal((current) => ({ ...current, type }))}
          value={debtModal.type}
        />
        <div className="candidate-accounting-modal-form">
          <label className="form-group">
            <span className="form-label">Vade Tarihi</span>
            <LocalizedDateInput className="form-input" disabled={!canManagePayments} onChange={(dueDate) => setDebtModal((current) => ({ ...current, dueDate }))} value={debtModal.dueDate} />
          </label>
          <label className="form-group">
            <span className="form-label">Tutar</span>
            <input className="form-input" disabled={!canManagePayments} inputMode="decimal" onChange={(event) => setDebtModal((current) => ({ ...current, amount: event.target.value }))} placeholder="0,00" value={debtModal.amount} />
          </label>
          <label className="form-group">
            <span className="form-label">{t("candidateDetail.accounting.field.description")}</span>
            <input className="form-input" disabled={!canManagePayments} onChange={(event) => setDebtModal((current) => ({ ...current, description: event.target.value }))} placeholder={t("candidateDetail.accounting.placeholder.installmentExample")} value={debtModal.description} />
          </label>
        </div>
      </Modal>

      <Modal
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setPaymentModal((current) => ({ ...current, open: false }))} type="button">
              Vazgeç
            </button>
            <button
              className="btn btn-primary"
              disabled={!canSavePayment}
              onClick={() => {
                if (!canSavePayment || parsedPaymentAmount == null) return;
                onCreatePayment(
                  paymentModal.type,
                  parsedPaymentAmount,
                  paymentModal.method,
                  paymentModal.cashRegisterId || null,
                  fromApplicationDateTimeLocalValue(paymentModal.paidAtUtc),
                  paymentModal.note.trim() || null,
                  paymentModal.movementId || null
                );
                setPaymentModal((current) => ({ ...current, open: false }));
              }}
              title={!canManagePayments ? noPermissionTitle : undefined}
              type="button"
            >
              {paymentSaving ? t("common.saving") : t("candidateDetail.accounting.savePayment")}
            </button>
          </>
        }
        onClose={() => setPaymentModal((current) => ({ ...current, open: false }))}
        open={paymentModal.open}
        title={t("candidateDetail.accounting.modal.collectPayment")}
      >
        <AccountingTypePicker
          disabled={!canManagePayments}
          onChange={(type) => setPaymentModal((current) => ({ ...current, type, movementId: "" }))}
          value={paymentModal.type}
        />
        <div className="candidate-accounting-modal-form">
          <div className="form-group">
            <span className="form-label">{t("candidateDetail.accounting.field.method")}</span>
            <PaymentMethodPicker
              onChange={selectPaymentMethod}
              disabled={!canManagePayments}
              value={paymentModal.method}
            />
          </div>
          <div className="form-group">
            <span className="form-label">Kasa</span>
            <CashRegisterPicker
              disabled={!canManagePayments || !paymentNeedsRegister}
              onChange={(cashRegisterId) => setPaymentModal((current) => ({ ...current, cashRegisterId }))}
              registers={availableCashRegisters}
              value={paymentModal.cashRegisterId}
            />
          </div>
          <label className="form-group">
            <span className="form-label">Tutar</span>
            <input className="form-input" disabled={!canManagePayments} inputMode="decimal" onChange={(event) => setPaymentModal((current) => ({ ...current, amount: event.target.value }))} placeholder="0,00" value={paymentModal.amount} />
          </label>
          <label className="form-group">
            <span className="form-label">{t("candidateDetail.accounting.field.paymentDate")}</span>
            <LocalizedDateInput
              className="form-input"
              disabled={!canManagePayments}
              onChange={(date) =>
                setPaymentModal((current) => ({
                  ...current,
                  paidAtUtc: combineDateAndTimeLocal(date, timePartFromDateTimeLocal(current.paidAtUtc)),
                }))
              }
              value={datePartFromDateTimeLocal(paymentModal.paidAtUtc)}
            />
          </label>
          <label className="form-group">
            <span className="form-label">{t("candidateDetail.accounting.field.paymentTime")}</span>
            <LocalizedTimeInput
              ariaLabel={t("candidateDetail.accounting.aria.paymentTime")}
              className="form-input"
              disabled={!canManagePayments}
              onChange={(time) =>
                setPaymentModal((current) => ({
                  ...current,
                  paidAtUtc: combineDateAndTimeLocal(datePartFromDateTimeLocal(current.paidAtUtc), time),
                }))
              }
              value={timePartFromDateTimeLocal(paymentModal.paidAtUtc)}
            />
          </label>
          <label className="form-group">
            <span className="form-label">{t("candidateDetail.accounting.field.description")}</span>
            <input className="form-input" disabled={!canManagePayments} onChange={(event) => setPaymentModal((current) => ({ ...current, note: event.target.value }))} placeholder={t("candidateDetail.accounting.placeholder.paymentNote")} value={paymentModal.note} />
          </label>
        </div>
      </Modal>

      <Modal
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setInvoiceModal((current) => ({ ...current, open: false }))} type="button">
              Vazgeç
            </button>
            <button
              className="btn btn-primary"
              disabled={!canSaveInvoice}
              onClick={() => {
                if (!canSaveInvoice || invoiceSubtotal == null) return;
                onSaveInvoice(invoiceModal.invoice, {
                  invoiceNo: invoiceModal.invoiceNo.trim(),
                  invoiceType: invoiceModal.invoiceType.trim(),
                  invoiceDate: invoiceModal.invoiceDate,
                  subtotal: invoiceSubtotal,
                  vatRate: invoiceVatRate,
                  notes: invoiceModal.notes.trim() || null,
                });
                setInvoiceModal((current) => ({ ...current, open: false }));
              }}
              title={!canManagePayments ? noPermissionTitle : undefined}
              type="button"
            >
              {invoiceSaving ? "Kaydediliyor..." : "Fatura Kaydet"}
            </button>
          </>
        }
        onClose={() => setInvoiceModal((current) => ({ ...current, open: false }))}
        open={invoiceModal.open}
        title={invoiceModal.invoice ? t("candidateDetail.accounting.modal.editInvoice") : t("candidateDetail.accounting.modal.addInvoice")}
      >
        <div className="candidate-accounting-modal-form">
          <label className="form-group">
            <span className="form-label">Fatura No</span>
            <input className="form-input" disabled={!canManagePayments} onChange={(event) => setInvoiceModal((current) => ({ ...current, invoiceNo: event.target.value }))} placeholder="Fatura No" value={invoiceModal.invoiceNo} />
          </label>
          <label className="form-group">
            <span className="form-label">Fatura Tipi</span>
            <CustomSelect
              className="form-select"
              disabled={!canManagePayments}
              onChange={(event) => setInvoiceModal((current) => ({ ...current, invoiceType: event.target.value }))}
              value={invoiceModal.invoiceType}
            >
              {INVOICE_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </CustomSelect>
          </label>
          <label className="form-group">
            <span className="form-label">Fatura Tarihi</span>
            <LocalizedDateInput className="form-input" disabled={!canManagePayments} onChange={(invoiceDate) => setInvoiceModal((current) => ({ ...current, invoiceDate }))} value={invoiceModal.invoiceDate} />
          </label>
          <label className="form-group">
            <span className="form-label">Tutar</span>
            <input className="form-input" disabled={!canManagePayments} inputMode="decimal" onChange={(event) => setInvoiceModal((current) => ({ ...current, subtotal: event.target.value }))} placeholder="0,00" value={invoiceModal.subtotal} />
          </label>
          <label className="form-group">
            <span className="form-label">{t("candidateDetail.accounting.field.vatRate")}</span>
	            <CustomSelect className="form-select" disabled={!canManagePayments} onChange={(event) => setInvoiceModal((current) => ({ ...current, vatRate: event.target.value }))} value={invoiceModal.vatRate}>
	              <option value="0">%0</option>
	              <option value="1">%1</option>
	              <option value="10">%10</option>
	              <option value="20">%20</option>
	            </CustomSelect>
          </label>
          <label className="form-group">
            <span className="form-label">KDV / Toplam</span>
            <input className="form-input" readOnly value={`KDV ${formatCurrencyTRY(invoiceVatAmount)} · Toplam ${formatCurrencyTRY(invoiceTotal)}`} />
          </label>
          <label className="form-group">
            <span className="form-label">Not</span>
            <input className="form-input" disabled={!canManagePayments} onChange={(event) => setInvoiceModal((current) => ({ ...current, notes: event.target.value }))} placeholder="Fatura notu" value={invoiceModal.notes} />
          </label>
        </div>
      </Modal>

      <AccountingReceiptModal
        candidate={candidate}
        onClose={() => setReceiptPayment(null)}
        payment={receiptPayment}
      />

      <Modal
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setCancelMovement(null)} type="button">{t("common.cancel")}</button>
            <button
              className="btn btn-primary"
              disabled={!canManagePayments || movementCancelReason.trim().length < 3}
              onClick={() => {
                if (!canManagePayments) return;
                if (!cancelMovement) return;
                onCancelMovement(cancelMovement.id, movementCancelReason.trim());
                setCancelMovement(null);
              }}
              title={!canManagePayments ? noPermissionTitle : undefined}
              type="button"
            >
              Sil
            </button>
          </>
        }
        onClose={() => setCancelMovement(null)}
        open={Boolean(cancelMovement)}
        title={t("candidateDetail.accounting.modal.deleteDebt")}
      >
        <div className="candidate-accounting-modal-form">
          <label className="form-group">
            <span className="form-label">{t("candidateDetail.accounting.field.deleteDescription")}</span>
            <textarea
              className="form-input"
              disabled={!canManagePayments}
              onChange={(event) => setMovementCancelReason(event.target.value)}
              placeholder={t("candidateDetail.accounting.placeholder.deleteReason")}
              rows={3}
              value={movementCancelReason}
            />
          </label>
        </div>
      </Modal>

      <Modal
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setCancelPayment(null)} type="button">{t("common.cancel")}</button>
            <button
              className="btn btn-primary"
              disabled={!canManagePayments || paymentCancelReason.trim().length < 3}
              onClick={() => {
                if (!canManagePayments) return;
                if (!cancelPayment) return;
                onCancelPayment(cancelPayment.id, paymentCancelReason.trim());
                setCancelPayment(null);
              }}
              title={!canManagePayments ? noPermissionTitle : undefined}
              type="button"
            >
              İptal Et
            </button>
          </>
        }
        onClose={() => setCancelPayment(null)}
        open={Boolean(cancelPayment)}
        title={t("candidateDetail.accounting.modal.cancelPayment")}
      >
        <div className="candidate-accounting-modal-form">
          <label className="form-group">
            <span className="form-label">{t("candidateDetail.accounting.field.cancelReason")}</span>
            <textarea className="form-input" disabled={!canManagePayments} onChange={(event) => setPaymentCancelReason(event.target.value)} placeholder={t("candidateDetail.accounting.placeholder.cancelReason")} rows={3} value={paymentCancelReason} />
          </label>
        </div>
      </Modal>

      <Modal
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setRefundPayment(null)} type="button">{t("common.cancel")}</button>
            <button
              className="btn btn-primary"
              disabled={!canManagePayments || (parseMoneyInput(refundAmount) ?? 0) <= 0 || refundNote.trim().length < 3}
              onClick={() => {
                if (!canManagePayments) return;
                if (!refundPayment) return;
                onRefundPayment(refundPayment.id, parseMoneyInput(refundAmount), refundNote.trim());
                setRefundPayment(null);
              }}
              title={!canManagePayments ? noPermissionTitle : undefined}
              type="button"
            >
              İade Et
            </button>
          </>
        }
        onClose={() => setRefundPayment(null)}
        open={Boolean(refundPayment)}
        title={t("candidateDetail.accounting.modal.refund")}
      >
        <div className="candidate-accounting-modal-form">
          <label className="form-group">
            <span className="form-label">{t("candidateDetail.accounting.field.refundAmount")}</span>
            <input className="form-input" disabled={!canManagePayments} inputMode="decimal" onChange={(event) => setRefundAmount(event.target.value)} placeholder="0,00" value={refundAmount} />
          </label>
          <label className="form-group">
            <span className="form-label">{t("candidateDetail.accounting.field.description")}</span>
            <textarea className="form-input" disabled={!canManagePayments} onChange={(event) => setRefundNote(event.target.value)} placeholder={t("candidateDetail.accounting.placeholder.refundNote")} rows={3} value={refundNote} />
          </label>
        </div>
      </Modal>
    </div>
  );
}

function AccountingTypePicker({
  disabled = false,
  value,
  onChange,
}: {
  disabled?: boolean;
  value: CandidateAccountingType;
  onChange: (value: CandidateAccountingType) => void;
}) {
  const t = useT();
  return (
    <div className="candidate-accounting-type-picker">
      {ACCOUNTING_TYPES.map((type) => (
        <button
          className={value === type ? "candidate-accounting-type active" : "candidate-accounting-type"}
          disabled={disabled}
          key={type}
          onClick={() => onChange(type)}
          type="button"
        >
          {t(accountingTypeLabelKey(type))}
        </button>
      ))}
    </div>
  );
}

function PaymentMethodPicker({
  disabled = false,
  value,
  onChange,
}: {
  disabled?: boolean;
  value: CandidatePaymentMethod;
  onChange: (value: CandidatePaymentMethod) => void;
}) {
  const t = useT();
  return (
    <div className="candidate-accounting-type-picker candidate-accounting-method-picker">
      {PAYMENT_METHODS.map((method) => (
        <button
          className={value === method ? "candidate-accounting-type active" : "candidate-accounting-type"}
          disabled={disabled}
          key={method}
          onClick={() => onChange(method)}
          type="button"
        >
          {t(paymentMethodLabelKey(method))}
        </button>
      ))}
    </div>
  );
}

function CashRegisterPicker({
  disabled,
  registers,
  value,
  onChange,
}: {
  disabled: boolean;
  registers: CashRegisterResponse[];
  value: string;
  onChange: (value: string) => void;
}) {
  if (disabled) {
    return (
      <div className="candidate-accounting-type-picker candidate-accounting-register-picker is-disabled">
        <button className="candidate-accounting-type active" disabled type="button">
          Kasa gerekmiyor
        </button>
      </div>
    );
  }

  if (registers.length === 0) {
    return (
      <div className="candidate-accounting-type-picker candidate-accounting-register-picker is-disabled">
        <button className="candidate-accounting-type" disabled type="button">
          Uygun kasa yok
        </button>
      </div>
    );
  }

  return (
    <div className="candidate-accounting-type-picker candidate-accounting-register-picker">
      {registers.map((register) => (
        <button
          className={value === register.id ? "candidate-accounting-type active" : "candidate-accounting-type"}
          key={register.id}
          onClick={() => onChange(register.id)}
          type="button"
        >
          {register.name}
        </button>
      ))}
    </div>
  );
}

function AccountingMovementSection({
  title,
  movements,
  payments,
  refunds,
  canManagePayments,
  onPay,
  onCancelMovement,
  onCancelPayment,
  onCreateInvoice,
  onOpenReceipt,
  onOpenRefund,
}: {
  title: string;
  movements: CandidateAccountingSummaryResponse["movements"];
  payments: CandidateAccountingSummaryResponse["payments"];
  refunds: CandidateAccountingSummaryResponse["refunds"];
  canManagePayments: boolean;
  onPay: (movement: CandidateAccountingSummaryResponse["movements"][number]) => void;
  onCancelMovement: (movement: CandidateAccountingSummaryResponse["movements"][number]) => void;
  onCancelPayment: (payment: CandidateAccountingSummaryResponse["payments"][number]) => void;
  onCreateInvoice: (amount: number) => void;
  onOpenReceipt: (payment: CandidateAccountingSummaryResponse["payments"][number]) => void;
  onOpenRefund: (payment: CandidateAccountingSummaryResponse["payments"][number]) => void;
}) {
  const t = useT();
  const columnPickerOptions = useMemo<ColumnOption[]>(
    () =>
      ACCOUNTING_LEDGER_COLUMNS.map((column) => ({
        id: column.id,
        label: t(column.labelKey),
        locked: column.locked,
      })),
    [t],
  );
  const [openActionMenu, setOpenActionMenu] = useState<{
    movementId: string;
    top: number;
    left: number;
  } | null>(null);
  const [sort, setSort] = useState<AccountingLedgerSortState>(null);
  const [filters, setFilters] = useState<AccountingLedgerFilters>(DEFAULT_ACCOUNTING_LEDGER_FILTERS);
  const [showDeletedDebts, setShowDeletedDebts] = useState(false);
  useEffect(() => {
    const stalePrefixes = [
      "candidate-accounting-ledger-columns:",
      "candidate-accounting-ledger-columns:v2:",
      "candidate-accounting-ledger-columns:v3:",
      "candidate-accounting-ledger-columns:v4:",
    ];
    for (const prefix of stalePrefixes) {
      localStorage.removeItem(`${prefix}${title}`);
    }
  }, [title]);
  const { isVisible, toggle: toggleColumn } = useColumnVisibility(
    `candidate-accounting-ledger-columns:v5:${title}`,
    ACCOUNTING_LEDGER_COLUMNS.map((column) => column.id),
    DEFAULT_ACCOUNTING_LEDGER_VISIBLE_COLUMNS
  );
  const visibleColumns = ACCOUNTING_LEDGER_COLUMNS.filter((column) => isVisible(column.id));

  const toggleActionMenu = (
    movementId: string,
    event: MouseEvent<HTMLButtonElement>
  ) => {
    if (openActionMenu?.movementId === movementId) {
      setOpenActionMenu(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    setOpenActionMenu({
      movementId,
      top: rect.bottom + 6,
      left: Math.max(8, Math.min(window.innerWidth - 148, rect.right - 132)),
    });
  };

  const closeActionMenu = () => setOpenActionMenu(null);

  useEffect(() => {
    if (!openActionMenu) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        setOpenActionMenu(null);
        return;
      }

      if (
        target.closest(".candidate-accounting-actions-menu") ||
        target.closest(".candidate-accounting-actions-trigger")
      ) {
        return;
      }

      setOpenActionMenu(null);
    };
    const close = () => setOpenActionMenu(null);
    document.addEventListener("pointerdown", closeOnOutsideClick, true);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick, true);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [openActionMenu]);

  const handleSortToggle = (field: AccountingLedgerSortField) => {
    setSort((current) => {
      if (!current || current.field !== field) return { field, direction: "asc" };
      if (current.direction === "asc") return { field, direction: "desc" };
      return null;
    });
  };

  const setFilter = (key: AccountingLedgerFilterKey, value: string) => {
    if (key === "kind") {
      setShowDeletedDebts(value !== "hideCancelled");
    }
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const toggleDeletedDebts = (checked: boolean) => {
    setShowDeletedDebts(checked);
    setFilters((current) => ({
      ...current,
      kind: checked ? "all" : "hideCancelled",
    }));
  };

  const cashRegisterFilterOptions = useMemo(() => {
    const names = new Set<string>();
    for (const payment of payments) {
      if (payment.cashRegister?.name) names.add(payment.cashRegister.name);
    }
    for (const refund of refunds) {
      if (refund.cashRegister?.name) names.add(refund.cashRegister.name);
    }

    return [
      { value: "all", label: t("candidateDetail.accounting.filterAll") },
      ...[...names].sort((a, b) => a.localeCompare(b, "tr")).map((name) => ({
        value: name,
        label: name,
      })),
    ];
  }, [payments, refunds, t]);

  const visibleMovements = useMemo(
    () => (showDeletedDebts ? movements : movements.filter((movement) => movement.status !== "cancelled")),
    [movements, showDeletedDebts],
  );

  const sortedMovements = useMemo(() => {
    if (!sort) return visibleMovements;

    return [...visibleMovements].sort((left, right) => {
      const result = compareAccountingSortValues(
        accountingMovementSortValue(left, payments, sort.field),
        accountingMovementSortValue(right, payments, sort.field)
      );
      return sort.direction === "asc" ? result : -result;
    });
  }, [visibleMovements, payments, sort]);

  const hasActiveFilters = Object.entries(filters).some(
    ([key, value]) => value !== DEFAULT_ACCOUNTING_LEDGER_FILTERS[key as AccountingLedgerFilterKey]
  );

  return (
    <section className="instructor-detail-card candidate-finance-workspace-card">
      <h3 className="candidate-detail-section-title">{title}</h3>
      {movements.length === 0 ? (
        <div className="instructor-detail-empty">{t("candidateDetail.accounting.movementsEmpty")}</div>
      ) : (
        <table className="data-table candidate-detail-fee-table candidate-accounting-ledger-table">
          <thead>
            <tr>
              {visibleColumns.map((column) => {
                const filterControl = buildAccountingLedgerFilterControl(
                  column.id,
                  filters,
                  setFilter,
                  cashRegisterFilterOptions,
                  t
                );
                return column.sortField ? (
                  <AccountingSortableTh
                    className={`candidate-accounting-col-${column.id}`}
                    field={column.sortField}
                    filterControl={filterControl}
                    key={column.id}
                    label={t(column.labelKey)}
                    onToggle={handleSortToggle}
                    sort={sort}
                  />
                ) : (
                  <th className={`candidate-accounting-col-${column.id}`} key={column.id}>
                    <div className="sortable-th-shell">
                      <span>{t(column.labelKey)}</span>
                      {filterControl ? <div className="sortable-th-filter">{filterControl}</div> : null}
                    </div>
                  </th>
                );
              })}
              <th className="col-picker-th">
                <ColumnPicker
                  columns={columnPickerOptions}
                  footer={
                    <label className="column-picker-toggle">
                      <input
                        checked={showDeletedDebts}
                        onChange={(event) => toggleDeletedDebts(event.target.checked)}
                        type="checkbox"
                      />
                      <span>{t("candidateDetail.accounting.showDeletedDebts")}</span>
                    </label>
                  }
                  isVisible={isVisible}
                  onToggle={toggleColumn}
                  triggerTitle={t("candidateDetail.accounting.columnsTriggerTitle")}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedMovements.flatMap((movement) => {
              if (filters.kind === "hideCancelled" && movement.status === "cancelled") {
                return [];
              }

              const relatedPayments = payments
                .filter((item) =>
                  item.allocations.some((allocation) => allocation.movementId === movement.id)
                )
                .sort((left, right) => left.paidAtUtc.localeCompare(right.paidAtUtc));
              const hasPaymentHistory = relatedPayments.length > 0 || movement.paidAmount > 0 || movement.refundedAmount > 0;
              const status = accountingMovementStatus(movement);
              const canPay = movement.status === "active" && movement.remainingAmount > 0;
              const netPaidAmount = Math.max(0, movement.paidAmount - movement.refundedAmount);
              const canCancelMovement = movement.status === "active" && (!hasPaymentHistory || netPaidAmount <= 0);
              const displayDebtAmount = movement.status === "active" ? movement.remainingAmount : movement.amount;
              const canCreateInvoice = movement.status === "active" && displayDebtAmount > 0;
              const transactionParentClass = movement.status === "cancelled" ? "parent-cancelled" : "";
              const debtMatches =
                displayDebtAmount > 0 && accountingMovementPassesFilters(movement, filters);
              const childRows = relatedPayments.flatMap((item) => {
                const allocation = item.allocations.find((entry) => entry.movementId === movement.id);
                if (!allocation) return [];

                const paymentMatches = accountingPaymentPassesFilters(item, filters);
                const relatedRefunds = refunds
                  .filter((refund) => refund.paymentId === item.id)
                  .map((refund) => ({
                    refund,
                    amount: refundShareForMovement(item, movement.id, refund.amount),
                  }))
                  .filter(({ refund, amount }) =>
                    amount > 0 && accountingRefundPassesFilters(item, refund, filters)
                  );

                return [
                  ...(paymentMatches ? [{ kind: "payment" as const, item, allocation }] : []),
                  ...relatedRefunds.map(({ refund, amount }) => ({
                    kind: "refund" as const,
                    item,
                    refund,
                    amount,
                  })),
                ];
              });

              if (!debtMatches && childRows.length === 0) return [];

              return [
                <Fragment key={movement.id}>
                  {debtMatches ? (
                    <tr className={`candidate-accounting-movement-row ${status.className}`}>
                      {visibleColumns.map((column) => (
                        <td
                          className={accountingLedgerCellClassName(column.id)}
                          key={column.id}
                        >
                          {renderAccountingMovementCell({
                            columnId: column.id,
                            movement,
                            displayDebtAmount,
                            status,
                            canPay,
                            canCancelMovement,
                            canCreateInvoice,
                            canManagePayments,
                            openActionMenu,
                            toggleActionMenu,
                            closeActionMenu,
                            onPay,
                            onCreateInvoice,
                            onCancelMovement,
                            t,
                          })}
                        </td>
                      ))}
                      <td className="col-picker-td" />
                    </tr>
                  ) : null}
                  {childRows.map((row) => {
                    if (row.kind === "payment") {
                      return (
                        <tr
                          className={`candidate-accounting-transaction-row ${
                            row.item.status === "cancelled" ? "status-cancelled" : "status-paid"
                          } ${transactionParentClass}`}
                          key={`payment:${row.item.id}:${movement.id}`}
                        >
                          {visibleColumns.map((column) => (
                            <td className={accountingLedgerCellClassName(column.id)} key={column.id}>
                              {renderAccountingPaymentCell({
                                columnId: column.id,
                                movement,
                                payment: row.item,
                                allocation: row.allocation,
                                canManagePayments,
                                openActionMenu,
                                toggleActionMenu,
                                closeActionMenu,
                                onOpenReceipt,
                                onOpenRefund,
                                onCancelPayment,
                                t,
                              })}
                            </td>
                          ))}
                          <td className="col-picker-td" />
                        </tr>
                      );
                    }

                    return (
                      <tr className={`candidate-accounting-transaction-row status-refunded ${transactionParentClass}`} key={`refund:${row.refund.id}:${movement.id}`}>
                        {visibleColumns.map((column) => (
                          <td className={accountingLedgerCellClassName(column.id)} key={column.id}>
                            {renderAccountingRefundCell({
                              columnId: column.id,
                              movement,
                              payment: row.item,
                              refund: row.refund,
                              amount: row.amount,
                              t,
                            })}
                          </td>
                        ))}
                        <td className="col-picker-td" />
                      </tr>
                    );
                  })}
                </Fragment>,
              ];
            })}
            {hasActiveFilters && sortedMovements.length > 0 ? (
              <tr className="candidate-accounting-filter-note-row">
                <td className="data-table-empty" colSpan={visibleColumns.length + 1}>
                  Filtreler aktif. Eşleşmeyen borçlandırmalar gizlendi.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      )}
    </section>
  );
}

function AccountingSortableTh({
  className,
  field,
  filterControl,
  label,
  sort,
  onToggle,
}: {
  className?: string;
  field: AccountingLedgerSortField;
  filterControl?: ReactNode;
  label: string;
  sort: AccountingLedgerSortState;
  onToggle: (field: AccountingLedgerSortField) => void;
}) {
  const isActive = sort?.field === field;
  const direction = isActive ? sort.direction : null;
  const indicator = direction === "asc" ? "▲" : direction === "desc" ? "▼" : "↕";
  const ariaSort = isActive
    ? direction === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <th
      aria-sort={ariaSort}
      className={[isActive ? "sortable-th active" : "sortable-th", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="sortable-th-shell">
        <button className="sortable-th-btn" onClick={() => onToggle(field)} type="button">
          <span>{label}</span>
          <span aria-hidden="true" className="sortable-th-indicator">
            {indicator}
          </span>
        </button>
        {filterControl ? <div className="sortable-th-filter">{filterControl}</div> : null}
      </div>
    </th>
  );
}

function buildAccountingLedgerFilterControl(
  columnId: AccountingLedgerColumnId,
  filters: AccountingLedgerFilters,
  setFilter: (key: AccountingLedgerFilterKey, value: string) => void,
  cashRegisterOptions: Array<{ value: string; label: string }>,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
) {
  if (columnId === "type") {
    return (
      <TableHeaderFilter
        active={filters.kind !== DEFAULT_ACCOUNTING_LEDGER_FILTERS.kind}
        onChange={(value) => setFilter("kind", value)}
        options={[
          { value: "all", label: t("candidateDetail.accounting.filterAll") },
          { value: "hideCancelled", label: t("candidateDetail.accounting.filter.hideCancelled") },
        ]}
        title={t("candidateDetail.accounting.filter.rowType")}
        value={filters.kind}
      />
    );
  }

  if (columnId === "method") {
    return (
      <TableHeaderFilter
        active={filters.method !== DEFAULT_ACCOUNTING_LEDGER_FILTERS.method}
        onChange={(value) => setFilter("method", value)}
        options={[
          { value: "all", label: t("candidateDetail.accounting.filterAll") },
          ...PAYMENT_METHODS.map((method) => ({
            value: method,
            label: t(paymentMethodLabelKey(method)),
          })),
        ]}
        title={t("candidateDetail.accounting.filter.paymentMethod")}
        value={filters.method}
      />
    );
  }

  if (columnId === "cashRegister") {
    return (
      <TableHeaderFilter
        active={filters.cashRegister !== DEFAULT_ACCOUNTING_LEDGER_FILTERS.cashRegister}
        onChange={(value) => setFilter("cashRegister", value)}
        options={cashRegisterOptions}
        title="Kasa"
        value={filters.cashRegister}
      />
    );
  }

  return null;
}

function accountingLedgerCellClassName(columnId: AccountingLedgerColumnId) {
  return [
    `candidate-accounting-col-${columnId}`,
    columnId === "actions" ? "candidate-accounting-actions-cell" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function accountingMovementPassesFilters(
  movement: CandidateAccountingSummaryResponse["movements"][number],
  filters: AccountingLedgerFilters
) {
  if (filters.kind === "hideCancelled" && movement.status === "cancelled") return false;
  if (filters.status === "active" && movement.status !== "active") return false;
  if (filters.status === "cancelled" && movement.status !== "cancelled") return false;
  if (filters.method !== "all") return false;
  if (filters.cashRegister !== "all") return false;

  return true;
}

function accountingPaymentPassesFilters(
  payment: CandidateAccountingSummaryResponse["payments"][number],
  filters: AccountingLedgerFilters
) {
  if (filters.kind === "hideCancelled" && payment.status === "cancelled") return false;
  if (filters.status === "active" && payment.status !== "active") return false;
  if (filters.status === "cancelled" && payment.status !== "cancelled") return false;
  if (filters.method !== "all" && payment.paymentMethod !== filters.method) return false;
  if (filters.cashRegister !== "all" && payment.cashRegister?.name !== filters.cashRegister) {
    return false;
  }

  return true;
}

function accountingRefundPassesFilters(
  payment: CandidateAccountingSummaryResponse["payments"][number],
  refund: CandidateAccountingSummaryResponse["refunds"][number],
  filters: AccountingLedgerFilters
) {
  if (filters.status === "cancelled") return false;
  if (filters.method !== "all") return false;

  const registerName = refund.cashRegister?.name ?? payment.cashRegister?.name;
  if (filters.cashRegister !== "all" && registerName !== filters.cashRegister) {
    return false;
  }

  return true;
}

function accountingMovementSortValue(
  movement: CandidateAccountingSummaryResponse["movements"][number],
  payments: CandidateAccountingSummaryResponse["payments"],
  field: AccountingLedgerSortField
) {
  const relatedPayment = payments.find((payment) =>
    payment.status === "active" &&
    payment.allocations.some((allocation) => allocation.movementId === movement.id)
  );

  switch (field) {
    case "type":
      return accountingTypeLabel(movement.type);
    case "description":
      return movement.description;
    case "dueDate":
      return movement.dueDate;
    case "amount":
      return movement.amount;
    case "paidAmount":
      return movement.paidAmount;
    case "remainingAmount":
      return movement.remainingAmount;
    case "number":
      return movement.number;
    case "receiptNumber":
      return relatedPayment?.number ?? "";
    case "method":
      return movement.lastPaymentMethod ? paymentMethodLabel(movement.lastPaymentMethod) : "";
    case "cashRegister":
      return relatedPayment?.cashRegister?.name ?? "";
    case "refundedAmount":
      return movement.refundedAmount;
    case "paidAt":
      return movement.lastPaidAtUtc ?? "";
    case "createdAt":
      return movement.createdAtUtc;
    default:
      return "";
  }
}

function compareAccountingSortValues(left: string | number, right: string | number) {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left).localeCompare(String(right), "tr", {
    numeric: true,
    sensitivity: "base",
  });
}

function invoiceRowClassName(invoiceType: string) {
  const normalized = invoiceType
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i");

  if (normalized.includes("iade") || normalized.includes("refund")) {
    return "candidate-accounting-invoice-row status-refunded";
  }

  if (normalized.includes("iptal") || normalized.includes("cancel")) {
    return "candidate-accounting-invoice-row status-cancelled";
  }

  return "candidate-accounting-invoice-row status-sale";
}

function renderAccountingMovementCell({
  columnId,
  movement,
  displayDebtAmount,
  status,
  canPay,
  canCancelMovement,
  canCreateInvoice,
  canManagePayments,
  openActionMenu,
  toggleActionMenu,
  closeActionMenu,
  onPay,
  onCreateInvoice,
  onCancelMovement,
  t,
}: {
  columnId: AccountingLedgerColumnId;
  movement: CandidateAccountingSummaryResponse["movements"][number];
  displayDebtAmount: number;
  status: { className: string };
  canPay: boolean;
  canCancelMovement: boolean;
  canCreateInvoice: boolean;
  canManagePayments: boolean;
  openActionMenu: { movementId: string; top: number; left: number } | null;
  toggleActionMenu: (movementId: string, event: MouseEvent<HTMLButtonElement>) => void;
  closeActionMenu: () => void;
  onPay: (movement: CandidateAccountingSummaryResponse["movements"][number]) => void;
  onCreateInvoice: (amount: number) => void;
  onCancelMovement: (movement: CandidateAccountingSummaryResponse["movements"][number]) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}) {
  if (columnId === "type") {
    return (
      <div className="candidate-accounting-type-cell">
        <span>{t(accountingTypeLabelKey(movement.type))}</span>
        <span className={`candidate-finance-installment-status ${status.className}`}>
          {t(accountingMovementStatusLabelKey(movement))}
        </span>
      </div>
    );
  }
  if (columnId === "description") return movement.description;
  if (columnId === "dueDate") return formatDateTR(movement.dueDate);
  if (columnId === "amount") return formatCurrencyTRY(displayDebtAmount);
  if (columnId === "paidAmount") return "—";
  if (columnId === "remainingAmount") return formatCurrencyTRY(displayDebtAmount);
  if (columnId === "number") return movement.number;
  if (columnId === "receiptNumber") return "—";
  if (columnId === "method") {
    return "—";
  }
  if (columnId === "cashRegister") return "—";
  if (columnId === "refundedAmount") {
    return "—";
  }
  if (columnId === "paidAt") {
    return renderFinanceDateTime(movement.createdAtUtc);
  }
  if (columnId === "createdAt") return renderFinanceDateTime(movement.createdAtUtc);

  if (!canPay && !canCreateInvoice && !canCancelMovement) {
    return "—";
  }

  const menuKey = `movement:${movement.id}`;
  return (
    <>
      <button
        className="candidate-accounting-actions-trigger"
        disabled={!canManagePayments}
        onClick={(event) => toggleActionMenu(menuKey, event)}
        title={!canManagePayments ? "Yetkiniz yok." : undefined}
        type="button"
      >
        İşlemler
      </button>
      {openActionMenu?.movementId === menuKey ? (
        <div
          className="candidate-accounting-actions-menu"
          style={{ left: openActionMenu.left, top: openActionMenu.top }}
        >
          {canPay ? (
            <button className="candidate-accounting-action" disabled={!canManagePayments} onClick={() => { closeActionMenu(); onPay(movement); }} title={!canManagePayments ? t("common.noPermission") : undefined} type="button">{t("candidateDetail.accounting.action.pay")}</button>
          ) : null}
          {canCreateInvoice ? (
            <button className="candidate-accounting-action" disabled={!canManagePayments} onClick={() => { closeActionMenu(); onCreateInvoice(displayDebtAmount); }} title={!canManagePayments ? t("common.noPermission") : undefined} type="button">{t("candidateDetail.accounting.action.invoice")}</button>
          ) : null}
          {canCancelMovement ? (
            <button className="candidate-accounting-action is-danger" disabled={!canManagePayments} onClick={() => { closeActionMenu(); onCancelMovement(movement); }} title={!canManagePayments ? t("common.noPermission") : undefined} type="button">{t("common.delete")}</button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function renderAccountingPaymentCell({
  columnId,
  movement,
  payment,
  allocation,
  canManagePayments,
  openActionMenu,
  toggleActionMenu,
  closeActionMenu,
  onOpenReceipt,
  onOpenRefund,
  onCancelPayment,
  t,
}: {
  columnId: AccountingLedgerColumnId;
  movement: CandidateAccountingSummaryResponse["movements"][number];
  payment: CandidateAccountingSummaryResponse["payments"][number];
  allocation: CandidateAccountingSummaryResponse["payments"][number]["allocations"][number];
  canManagePayments: boolean;
  openActionMenu: { movementId: string; top: number; left: number } | null;
  toggleActionMenu: (movementId: string, event: MouseEvent<HTMLButtonElement>) => void;
  closeActionMenu: () => void;
  onOpenReceipt: (payment: CandidateAccountingSummaryResponse["payments"][number]) => void;
  onOpenRefund: (payment: CandidateAccountingSummaryResponse["payments"][number]) => void;
  onCancelPayment: (payment: CandidateAccountingSummaryResponse["payments"][number]) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}) {
  if (columnId === "type") {
    if (payment.status === "cancelled") {
      return (
        <div className="candidate-accounting-type-cell">
          <span>{t("candidateDetail.accounting.payment.status.cancelled")}</span>
          <span className="candidate-finance-installment-status status-cancelled">{t("candidateDetail.accounting.payment.status.paymentCancellation")}</span>
        </div>
      );
    }

    return (
      <div className="candidate-accounting-type-cell">
        <span>{accountingPaymentDisplayTypeLabel(movement.type)}</span>
        <span className="candidate-finance-installment-status status-paid">{t("candidateDetail.accounting.payment.status.collection")}</span>
      </div>
    );
  }
  if (columnId === "description") return payment.status === "cancelled"
    ? payment.cancellationReason || t("candidateDetail.accounting.paymentCancellation")
    : payment.note || "—";
  if (columnId === "dueDate") return formatDateTR(movement.dueDate);
  if (columnId === "amount") return formatCurrencyTRY(allocation.amount);
  if (columnId === "paidAmount") return payment.status === "cancelled" ? "—" : formatCurrencyTRY(allocation.amount);
  if (columnId === "remainingAmount") {
    return payment.status === "cancelled" ? formatCurrencyTRY(allocation.amount) : "—";
  }
  if (columnId === "number") return movement.number;
  if (columnId === "receiptNumber") return payment.number ?? "—";
  if (columnId === "method") return payment.status === "cancelled" ? t("candidateDetail.accounting.payment.status.cancelled") : t(paymentMethodLabelKey(payment.paymentMethod));
  if (columnId === "cashRegister") return payment.cashRegister?.name ?? "—";
  if (columnId === "refundedAmount") {
    return payment.status === "active" && payment.refundedAmount > 0
      ? formatCurrencyTRY(refundShareForMovement(payment, movement.id, payment.refundedAmount))
      : "—";
  }
  if (columnId === "paidAt") return renderFinanceDateTime(payment.cancelledAtUtc ?? payment.paidAtUtc);
  if (columnId === "createdAt") return renderFinanceDateTime(payment.createdAtUtc);

  if (payment.status === "cancelled") return "—";

  const rowKey = `payment:${payment.id}:${movement.id}`;
  const refundableAmount = payment.amount - payment.refundedAmount;
  const isCancellable = payment.refundedAmount <= 0;
  return (
    <>
      <button
        className="candidate-accounting-actions-trigger"
        onClick={(event) => toggleActionMenu(rowKey, event)}
        type="button"
      >
        {t("candidateDetail.accounting.col.actions")}
      </button>
      {openActionMenu?.movementId === rowKey ? (
        <div
          className="candidate-accounting-actions-menu"
          style={{ left: openActionMenu.left, top: openActionMenu.top }}
        >
          <button className="candidate-accounting-action" onClick={() => { closeActionMenu(); onOpenReceipt(payment); }} type="button">{t("candidateDetail.accounting.action.receipt")}</button>
          {refundableAmount > 0 ? (
            <button className="candidate-accounting-action" disabled={!canManagePayments} onClick={() => { closeActionMenu(); onOpenRefund(payment); }} title={!canManagePayments ? t("common.noPermission") : undefined} type="button">{t("candidateDetail.accounting.action.refund")}</button>
          ) : null}
          {isCancellable ? (
            <button className="candidate-accounting-action is-danger" disabled={!canManagePayments} onClick={() => { closeActionMenu(); onCancelPayment(payment); }} title={!canManagePayments ? t("common.noPermission") : undefined} type="button">{t("candidateDetail.accounting.action.cancel")}</button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function renderAccountingRefundCell({
  columnId,
  movement,
  payment,
  refund,
  amount,
  t,
}: {
  columnId: AccountingLedgerColumnId;
  movement: CandidateAccountingSummaryResponse["movements"][number];
  payment: CandidateAccountingSummaryResponse["payments"][number];
  refund: CandidateAccountingSummaryResponse["refunds"][number];
  amount: number;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}) {
  if (columnId === "type") {
    return (
      <div className="candidate-accounting-type-cell">
        <span>{t("candidateDetail.accounting.action.refund")}</span>
        <span className="candidate-finance-installment-status status-refunded">{t("candidateDetail.accounting.action.cashOut")}</span>
      </div>
    );
  }
  if (columnId === "description") return refund.note || t("candidateDetail.accounting.action.refund");
  if (columnId === "dueDate") return formatDateTR(movement.dueDate);
  if (columnId === "amount") return formatCurrencyTRY(amount);
  if (columnId === "paidAmount") return "—";
  if (columnId === "remainingAmount") return formatCurrencyTRY(amount);
  if (columnId === "number") return movement.number;
  if (columnId === "receiptNumber") return payment.number ?? "—";
  if (columnId === "method") return t("candidateDetail.accounting.action.refund");
  if (columnId === "cashRegister") return refund.cashRegister?.name ?? payment.cashRegister?.name ?? "—";
  if (columnId === "refundedAmount") return formatCurrencyTRY(amount);
  if (columnId === "paidAt") return renderFinanceDateTime(refund.refundedAtUtc);
  if (columnId === "createdAt") return renderFinanceDateTime(refund.createdAtUtc);
  return "—";
}

function AccountingReceiptModal({
  candidate,
  payment,
  onClose,
}: {
  candidate: CandidateResponse;
  payment: CandidateAccountingSummaryResponse["payments"][number] | null;
  onClose: () => void;
}) {
  const t = useT();
  if (!payment) return null;
  const receiptNumber = payment.number?.trim() || payment.id.slice(0, 8).toLocaleUpperCase("tr-TR");

  return (
    <Modal
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} type="button">{t("common.close")}</button>
          <button className="btn btn-primary" onClick={() => window.print()} type="button">{t("candidateDetail.accounting.action.print")}</button>
        </>
      }
      onClose={onClose}
      open={Boolean(payment)}
      title={t("candidateDetail.accounting.receipt.title")}
    >
      <div className="candidate-payment-receipt">
        <div className="candidate-payment-receipt-head">
          <div>
            <strong>{t("candidateDetail.accounting.receipt.brand")}</strong>
            <span>{t("candidateDetail.accounting.receipt.title")}</span>
          </div>
          <div className="candidate-payment-receipt-no">
            #{receiptNumber}
          </div>
        </div>
        <div className="candidate-payment-receipt-amount">{formatCurrencyTRY(payment.amount)}</div>
        <dl className="candidate-payment-receipt-grid">
          <div><dt>{t("payments.col.receiptNumber")}</dt><dd>{receiptNumber}</dd></div>
          <div><dt>{t("common.field.candidate")}</dt><dd>{candidate.firstName} {candidate.lastName}</dd></div>
          <div><dt>{t("common.field.nationalId")}</dt><dd>{formatNationalId(candidate.nationalId)}</dd></div>
          <div><dt>{t("candidateDetail.accounting.col.type")}</dt><dd>{t(accountingTypeLabelKey(payment.type))}</dd></div>
          <div><dt>{t("candidateDetail.accounting.field.paymentDate")}</dt><dd>{renderFinanceDateTime(payment.paidAtUtc)}</dd></div>
          <div><dt>{t("candidateDetail.accounting.field.method")}</dt><dd>{t(paymentMethodLabelKey(payment.paymentMethod))}</dd></div>
          <div><dt>{t("candidateDetail.accounting.col.cashRegister")}</dt><dd>{payment.cashRegister?.name ?? "—"}</dd></div>
          <div><dt>{t("candidateDetail.accounting.field.description")}</dt><dd>{payment.note ?? "—"}</dd></div>
        </dl>
        <div className="candidate-payment-receipt-footer">
          <span>{t("candidateDetail.accounting.receipt.collector")}</span>
          <span>{t("candidateDetail.accounting.receipt.signature")}</span>
        </div>
      </div>
    </Modal>
  );
}

const EXAM_ATTEMPT_TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = String(Math.floor(index / 2)).padStart(2, "0");
  const minute = index % 2 === 0 ? "00" : "30";
  return `${hour}:${minute}`;
});

function examAttemptTimeOptions(selectedTime: string): string[] {
  return [...new Set([selectedTime, ...EXAM_ATTEMPT_TIME_OPTIONS])]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

function examScheduleDateTimeLocal(schedule: ExamScheduleOption): string {
  const scheduleTime = schedule.time.slice(0, 5);
  const time = scheduleTime === "00:00" ? DEFAULT_DRIVING_EXAM_TIME : scheduleTime;
  return combineDateAndTimeLocal(schedule.date, time);
}

function formatExamScheduleOptionLabel(schedule: ExamScheduleOption): string {
  return formatDateTR(schedule.date);
}

function formatExamScheduleOptionSecondary(schedule: ExamScheduleOption): string | undefined {
  return schedule.examCode ?? undefined;
}

function buildCandidateExamSummaryOverrides(
  attempts: CandidateExamAttemptResponse[]
): CandidatePayloadOverrides {
  const theoryAttempts = attempts.filter((attempt) => attempt.examType === "theory");
  const practiceAttempts = attempts.filter((attempt) => attempt.examType === "practice");
  const latestTheory = latestExamAttempt(theoryAttempts);
  const latestPractice = latestExamAttempt(practiceAttempts);

  return {
    mebExamDate: latestTheory ? attemptDateOnly(latestTheory) : null,
    mebExamResult: latestTheory ? theoryExamResult(latestTheory) : null,
    eSinavAttemptCount: latestTheory?.attemptNumber ?? 1,
    drivingExamDate: latestPractice ? attemptDateOnly(latestPractice) : null,
    drivingExamScheduleId: latestPractice?.examScheduleId ?? null,
    drivingExamAttemptCount: latestPractice?.attemptNumber ?? 0,
  };
}

function latestExamAttempt(
  attempts: CandidateExamAttemptResponse[]
): CandidateExamAttemptResponse | undefined {
  return [...attempts].sort((left, right) => {
    if (right.attemptNumber !== left.attemptNumber) {
      return right.attemptNumber - left.attemptNumber;
    }
    return Date.parse(right.scheduledAt) - Date.parse(left.scheduledAt);
  })[0];
}

function attemptDateOnly(attempt: CandidateExamAttemptResponse): string {
  return attempt.scheduledAt.slice(0, 10);
}

function theoryExamResult(attempt: CandidateExamAttemptResponse): "passed" | "failed" | null {
  if (attempt.score == null) {
    return null;
  }

  return attempt.score >= 70 ? "passed" : "failed";
}

function CandidateExamAttemptsSection({
  canManageCandidates,
  candidate,
  onAccountingChanged,
  onCandidateUpdated,
  onOpenAccountingPayment,
  onTheoryExemptChanged,
}: {
  canManageCandidates: boolean;
  candidate: CandidateResponse;
  onAccountingChanged?: () => Promise<void> | void;
  onCandidateUpdated?: (candidate: CandidateResponse) => void;
  onOpenAccountingPayment?: (movementId: string) => void;
  onTheoryExemptChanged?: (value: boolean) => void;
}) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const t = useT();
  const noPermissionTitle = t("common.noPermission");
  const [exemptSaving, setExemptSaving] = useState(false);
  const isTheoryExempt = candidate.isTheoryExempt ?? false;
  const hasExistingLicense = candidate.hasExistingLicense ?? hasExistingLicenseValue(candidate.existingLicenseType);
  const toggleTheoryExempt = async () => {
    if (!canManageCandidates) return;
    if (hasExistingLicense) return;
    const next = !isTheoryExempt;
    setExemptSaving(true);
    try {
      await setCandidateTheoryExemption(candidate.id, next);
      onTheoryExemptChanged?.(next);
    } catch {
      showToast(t("candidateDetail.license.toast.exemptionFailed"), "error");
    } finally {
      setExemptSaving(false);
    }
  };
  const [attempts, setAttempts] = useState<CandidateExamAttemptResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editingAttempt, setEditingAttempt] = useState<CandidateExamAttemptResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [rowSavingId, setRowSavingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<VehicleResponse[]>([]);
  const [instructors, setInstructors] = useState<InstructorResponse[]>([]);
  const [practiceSchedules, setPracticeSchedules] = useState<ExamScheduleOption[]>([]);
  const [form, setForm] = useState({
    examType: "theory" as CandidateExamType,
    scheduledAt: combineDateAndTimeLocal(todayIsoDate(), "00:00"),
    examScheduleId: "",
    vehicleId: "",
    instructorId: "",
    examAttendanceStatus: "" as "" | "attended" | "absent" | "reported",
    examResultStatus: "" as "" | "passed" | "failed",
    score: "",
    fee: "",
  });
  const [suggestedFee, setSuggestedFee] = useState<number | null>(null);
  const [feeTouched, setFeeTouched] = useState(false);
  const theoryAttempts = attempts.filter((attempt) => attempt.examType === "theory");
  const practiceAttempts = attempts.filter((attempt) => attempt.examType === "practice");
  const editingFeeLocked = Boolean(editingAttempt && editingAttempt.fee !== 0);
  const theoryRightsExpiryDate = addDaysToISODate(
    candidate.currentGroup?.startDate,
    THEORY_RIGHTS_EXPIRY_DAYS
  );
  const theoryRightsRemainingDays = theoryRightsExpiryDate
    ? daysUntilISODate(theoryRightsExpiryDate)
    : null;
  const hasPassedTheoryExam =
    normalizeCandidateExamResultValue(candidate.mebExamResult) === "passed" ||
    theoryAttempts.some((attempt) => (attempt.score ?? -1) >= 70);
  const theoryRightsExpiryBadgeKind =
    theoryRightsRemainingDays === null ? "normal" : theoryRightsExpiryKind(theoryRightsRemainingDays);

  const reload = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await listCandidateExamAttempts(candidate.id, signal);
      setAttempts(response);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(t("candidateDetail.exam.toast.attemptsLoadFailed"));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    getVehicles({ activity: "active", page: 1, pageSize: 500 }, controller.signal)
      .then((response) => setVehicles(response.items))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setVehicles([]);
      });
    getInstructors({ activity: "active", page: 1, pageSize: 500 }, controller.signal)
      .then((response) => setInstructors(response.items))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setInstructors([]);
      });
    getExamScheduleOptions({ examType: "uygulama" }, controller.signal)
      .then((response) => setPracticeSchedules(response))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setPracticeSchedules([]);
      });
    return () => controller.abort();
  }, [candidate.id]);

  const examAttemptFeeMatrixYear = new Date(form.scheduledAt).getFullYear();
  const examAttemptFeeMatrixQuery = useQuery({
    enabled:
      addOpen &&
      Boolean(candidate.licenseClassDefinitionId) &&
      Boolean(candidate.licenseClass) &&
      Boolean(form.scheduledAt) &&
      Number.isFinite(examAttemptFeeMatrixYear),
    gcTime: 60 * 60 * 1000,
    queryKey: candidateTargetFeeMatrixKey(examAttemptFeeMatrixYear, candidate.licenseClass),
    queryFn: ({ signal }) =>
      getLicenseClassFeeMatrix(
        examAttemptFeeMatrixYear,
        { targetLicenseClass: candidate.licenseClass },
        signal
      ),
    staleTime: 60 * 60 * 1000,
  });

  useEffect(() => {
    if (!addOpen || !candidate.licenseClassDefinitionId || !examAttemptFeeMatrixQuery.data) {
      setSuggestedFee(null);
      return;
    }

    const row = examAttemptFeeMatrixQuery.data.rows.find(
      (item) =>
        item.program.id === candidate.licenseClassDefinitionId &&
        item.lessonType === form.examType
    );
    const attemptNumber = nextCandidateExamAttemptNumber(attempts, form.examType);
    const value = suggestedCandidateExamFee(row, form.examType, attemptNumber);
    setSuggestedFee(value ?? null);
    setForm((current) => {
      if (feeTouched || editingAttempt) return current;
      const nextFee = value != null ? String(value) : "";
      return current.fee === nextFee ? current : { ...current, fee: nextFee };
    });
  }, [
    addOpen,
    attempts,
    candidate.licenseClassDefinitionId,
    editingAttempt,
    examAttemptFeeMatrixQuery.data,
    feeTouched,
    form.examType,
  ]);

  useEffect(() => {
    if (examAttemptFeeMatrixQuery.isError) {
      setSuggestedFee(null);
    }
  }, [examAttemptFeeMatrixQuery.isError]);

  const nextAttemptNumber = (
    examType: CandidateExamType,
    attendanceStatus?: CandidateExamAttemptResponse["examAttendanceStatus"] | ""
  ) => {
    return nextCandidateExamAttemptNumber(attempts, examType, attendanceStatus);
  };

  const openAddForm = (examType: CandidateExamType = "theory") => {
    if (!canManageCandidates) return;
    const defaultPracticeSchedule = examType === "practice" ? practiceSchedules[0] : null;
    setEditingAttempt(null);
    setFeeTouched(false);
    setForm({
      examType,
      scheduledAt: defaultPracticeSchedule
        ? examScheduleDateTimeLocal(defaultPracticeSchedule)
        : combineDateAndTimeLocal(todayIsoDate(), "00:00"),
      examScheduleId: defaultPracticeSchedule?.id ?? "",
      vehicleId: "",
      instructorId: "",
      examAttendanceStatus: "",
      examResultStatus: "",
      score: "",
      fee: "",
    });
    setAddOpen(true);
  };

  const openEditForm = (attempt: CandidateExamAttemptResponse) => {
    if (!canManageCandidates) return;
    setEditingAttempt(attempt);
    setFeeTouched(true);
    setDeleteConfirmId(null);
    setForm({
      examType: attempt.examType,
      scheduledAt: toDateTimeLocalValue(attempt.scheduledAt),
      examScheduleId: attempt.examScheduleId ?? "",
      vehicleId: attempt.vehicleId ?? "",
      instructorId: attempt.instructorId ?? "",
      examAttendanceStatus: (attempt.examAttendanceStatus ?? "") as "" | "attended" | "absent" | "reported",
      examResultStatus: (attempt.examResultStatus ?? "") as "" | "passed" | "failed",
      score: attempt.score == null ? "" : String(attempt.score),
      fee: String(attempt.fee),
    });
    setAddOpen(true);
  };

  const closeAttemptForm = () => {
    setAddOpen(false);
    setEditingAttempt(null);
  };

  const syncCandidateExamSummary = async (nextAttempts: CandidateExamAttemptResponse[]) => {
    try {
      const updated = await updateCandidate(
        candidate.id,
        buildBulkCandidateUpdatePayload(candidate, buildCandidateExamSummaryOverrides(nextAttempts))
      );
      onCandidateUpdated?.(updated);
    } catch {
      showToast("Aday sınav özeti güncellenemedi.", "error");
    }
  };

  const invalidateExamAttemptDependents = () => {
    void queryClient.invalidateQueries({ queryKey: candidateKeys.detail(candidate.id) });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: [...candidateKeys.all, "examScheduleOptions"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const saveAttempt = async () => {
    if (!canManageCandidates) return;
    const fee = editingFeeLocked ? editingAttempt?.fee ?? 0 : parseMoneyInput(form.fee) ?? 0;
    const maxAttemptNumber = candidateExamAttemptLimit(attempts, form.examType, form.examAttendanceStatus);
    const attemptNumber = editingAttempt?.attemptNumber ?? nextAttemptNumber(form.examType, form.examAttendanceStatus);
    if (attemptNumber > maxAttemptNumber) {
      showToast(`Bu sınav tipi için ${maxAttemptNumber} hak dolmuş.`, "error");
      return;
    }
    if (!form.scheduledAt) {
      showToast(t("candidateDetail.exam.toast.examDateTimeRequired"), "error");
      return;
    }
    if (form.examType === "practice" && !form.examScheduleId) {
      showToast(t("candidateDetail.exam.toast.practiceDateRequired"), "error");
      return;
    }
    if (form.examType === "practice" && form.examAttendanceStatus !== "attended" && form.examResultStatus) {
      showToast(t("candidateDetail.exam.toast.resultOnlyWhenAttempted"), "error");
      return;
    }
    const trimmedScore = form.score.trim();
    let scoreValue: number | null = null;
    if (form.examType === "theory" && trimmedScore !== "") {
      if (!/^\d{1,3}$/.test(trimmedScore)) {
        showToast(t("candidateDetail.exam.toast.scoreInteger"), "error");
        return;
      }
      const parsedScore = Number.parseInt(trimmedScore, 10);
      if (parsedScore > 100) {
        showToast(t("candidateDetail.exam.toast.scoreRange"), "error");
        return;
      }
      scoreValue = parsedScore;
    }

    setSaving(true);
    try {
      const vehicle = vehicles.find((item) => item.id === form.vehicleId);
      const instructor = instructors.find((item) => item.id === form.instructorId);
      const isPractice = form.examType === "practice";
      const payload = {
        examType: form.examType,
        scheduledAt: fromDateTimeLocalValue(form.scheduledAt),
        examScheduleId: isPractice ? form.examScheduleId : null,
        attemptNumber,
        score: scoreValue,
        expiresAt: null,
        vehicleId: isPractice ? vehicle?.id ?? null : null,
        vehiclePlate: isPractice ? vehicle?.plateNumber ?? null : null,
        instructorId: isPractice ? instructor?.id ?? null : null,
        instructorFullName: isPractice && instructor ? `${instructor.firstName} ${instructor.lastName}` : null,
        examAttendanceStatus: isPractice ? form.examAttendanceStatus || null : null,
        examResultStatus: isPractice && form.examAttendanceStatus === "attended" ? form.examResultStatus || null : null,
        fee,
        feeStatus: editingAttempt?.feeStatus ?? "pending",
        rowVersion: editingAttempt?.rowVersion,
      };
      const saved = editingAttempt
        ? await updateCandidateExamAttempt(candidate.id, editingAttempt.id, payload)
        : await createCandidateExamAttempt(candidate.id, payload);
      const nextAttempts = (editingAttempt
        ? attempts.map((item) => (item.id === saved.id ? saved : item))
        : [...attempts, saved]
      ).sort(compareExamAttempts);
      setAttempts(nextAttempts);
      await syncCandidateExamSummary(nextAttempts);
      invalidateExamAttemptDependents();
      if (editingAttempt && !editingFeeLocked && fee !== editingAttempt.fee) {
        try {
          await onAccountingChanged?.();
        } catch {
          showToast(t("candidateDetail.exam.toast.financeUpdateFailed"), "error");
        }
      }
      closeAttemptForm();
      showToast(editingAttempt
        ? t("candidateDetail.exam.toast.examInfoUpdated")
        : isPractice ? t("candidateDetail.exam.toast.newPracticeAdded") : t("candidateDetail.exam.toast.newTheoryAdded"));
    } catch (error) {
      const message = error instanceof ApiError && error.status === 409
        ? t("candidateDetail.exam.toast.conflictRefresh")
        : editingAttempt
          ? t("candidateDetail.exam.toast.examInfoUpdateFailed")
          : examAttemptCreateErrorMessage(error, t);
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const chargeAttempt = async (attempt: CandidateExamAttemptResponse) => {
    setRowSavingId(attempt.id);
    try {
      const updated = await chargeCandidateExamAttempt(candidate.id, attempt.id);
      setAttempts((items) => items.map((item) => item.id === updated.id ? updated : item));
      invalidateExamAttemptDependents();
      try {
        await onAccountingChanged?.();
      } catch {
        showToast(t("candidateDetail.exam.toast.financeUpdateFailed"), "error");
      }
      showToast(t("candidateDetail.exam.toast.theoryFeeBilled"));
    } catch {
      showToast(t("candidateDetail.exam.toast.billingFailed"), "error");
    } finally {
      setRowSavingId(null);
    }
  };

  const updateAttemptScore = async (
    attempt: CandidateExamAttemptResponse,
    nextScore: number | null
  ): Promise<boolean> => {
    if (!canManageCandidates) return false;
    setRowSavingId(attempt.id);
    try {
      // PUT endpoint full upsert kabul ediyor — score dışında her şeyi
      // mevcut response'tan ayna olarak yansıt.
      const updated = await updateCandidateExamAttempt(candidate.id, attempt.id, {
        examType: attempt.examType,
        scheduledAt: attempt.scheduledAt,
        attemptNumber: attempt.attemptNumber,
        score: nextScore,
        expiresAt: attempt.expiresAt ?? null,
        examScheduleId: attempt.examScheduleId ?? null,
        vehicleId: attempt.vehicleId ?? null,
        vehiclePlate: attempt.vehiclePlate ?? null,
        instructorId: attempt.instructorId ?? null,
        instructorFullName: attempt.instructorFullName ?? null,
        examAttendanceStatus: attempt.examAttendanceStatus ?? null,
        examResultStatus: attempt.examResultStatus ?? null,
        fee: attempt.fee,
        feeStatus: attempt.feeStatus,
        rowVersion: attempt.rowVersion,
      });
      const nextAttempts = attempts.map((item) => (item.id === updated.id ? updated : item));
      setAttempts(nextAttempts);
      await syncCandidateExamSummary(nextAttempts);
      invalidateExamAttemptDependents();
      showToast(nextScore == null ? "Puan silindi" : `Puan kaydedildi (${nextScore})`);
      return true;
    } catch (error) {
      const message = error instanceof ApiError && error.status === 409
        ? t("candidateDetail.exam.toast.conflictRefresh")
        : "Puan kaydedilemedi.";
      showToast(message, "error");
      return false;
    } finally {
      setRowSavingId(null);
    }
  };

  const updatePracticeAttemptStatus = async (
    attempt: CandidateExamAttemptResponse,
    nextAttendanceStatus: CandidateExamAttemptResponse["examAttendanceStatus"],
    nextResultStatus: CandidateExamAttemptResponse["examResultStatus"]
  ): Promise<boolean> => {
    if (!canManageCandidates) return false;
    setRowSavingId(attempt.id);
    try {
      const updated = await updateCandidateExamAttempt(candidate.id, attempt.id, {
        examType: attempt.examType,
        scheduledAt: attempt.scheduledAt,
        attemptNumber: attempt.attemptNumber,
        score: attempt.score,
        expiresAt: attempt.expiresAt ?? null,
        examScheduleId: attempt.examScheduleId ?? null,
        vehicleId: attempt.vehicleId ?? null,
        vehiclePlate: attempt.vehiclePlate ?? null,
        instructorId: attempt.instructorId ?? null,
        instructorFullName: attempt.instructorFullName ?? null,
        examAttendanceStatus: nextAttendanceStatus,
        examResultStatus: nextAttendanceStatus === "attended" ? nextResultStatus : null,
        fee: attempt.fee,
        feeStatus: attempt.feeStatus,
        rowVersion: attempt.rowVersion,
      });
      const nextAttempts = attempts.map((item) => (item.id === updated.id ? updated : item));
      setAttempts(nextAttempts);
      await syncCandidateExamSummary(nextAttempts);
      invalidateExamAttemptDependents();
      showToast(t("candidateDetail.exam.toast.practiceStatusUpdated"));
      return true;
    } catch (error) {
      const message = error instanceof ApiError && error.status === 409
        ? t("candidateDetail.exam.toast.conflictRefresh")
        : t("candidateDetail.exam.toast.practiceStatusUpdateFailed");
      showToast(message, "error");
      return false;
    } finally {
      setRowSavingId(null);
    }
  };

  const markSelfPaid = async (attempt: CandidateExamAttemptResponse) => {
    setRowSavingId(attempt.id);
    try {
      const updated = await markCandidateExamAttemptSelfPaid(candidate.id, attempt.id);
      setAttempts((items) => items.map((item) => item.id === updated.id ? updated : item));
      invalidateExamAttemptDependents();
      showToast(t("candidateDetail.exam.toast.selfPaidMarked"));
    } catch {
      showToast(t("candidateDetail.exam.toast.selfPaidFailed"), "error");
    } finally {
      setRowSavingId(null);
    }
  };

  const payAttempt = async (attempt: CandidateExamAttemptResponse) => {
    if (attempt.accountingMovementId) {
      onOpenAccountingPayment?.(attempt.accountingMovementId);
      return;
    }

    setRowSavingId(attempt.id);
    try {
      const updated = await chargeCandidateExamAttempt(candidate.id, attempt.id);
      setAttempts((items) => items.map((item) => item.id === updated.id ? updated : item));
      invalidateExamAttemptDependents();
      if (!updated.accountingMovementId) {
        showToast(t("candidateDetail.exam.toast.noOpenBalance"), "error");
        return;
      }

      onOpenAccountingPayment?.(updated.accountingMovementId);
    } catch {
      showToast(t("candidateDetail.exam.toast.debtCreateFailed"), "error");
    } finally {
      setRowSavingId(null);
    }
  };


  const confirmDelete = async (attempt: CandidateExamAttemptResponse) => {
    if (!canManageCandidates) return;
    setRowSavingId(attempt.id);
    try {
      await deleteCandidateExamAttempt(candidate.id, attempt.id);
      const nextAttempts = attempts.filter((item) => item.id !== attempt.id);
      setAttempts(nextAttempts);
      await syncCandidateExamSummary(nextAttempts);
      invalidateExamAttemptDependents();
      setDeleteConfirmId(null);
      showToast(t("candidateDetail.exam.toast.attemptDeleted"));
    } catch (error) {
      if (error instanceof ApiError && error.errorCode === "candidateExamAttemptHasAccountingMovement") {
        setDeleteConfirmId(null);
        showToast(t("candidateDetail.exam.toast.hasFinanceRecord"), "error");
      } else {
        showToast(t("candidateDetail.exam.toast.attemptDeleteFailed"), "error");
      }
    } finally {
      setRowSavingId(null);
    }
  };

  return (
    <>
      <section
        className={`instructor-detail-card candidate-exam-attempts-section${isTheoryExempt ? " is-exempt" : ""}`}
        data-muaf={isTheoryExempt ? "true" : undefined}
      >
        <div className="candidate-exam-attempts-head">
          <div className="candidate-exam-attempts-title-group">
            <h3 className="candidate-detail-section-title">{t("candidateDetail.exam.section.theory")}</h3>
            {!loading && !hasPassedTheoryExam && theoryRightsExpiryDate && theoryRightsRemainingDays !== null ? (
              <span
                className={`candidate-exam-rights-expiry ${theoryRightsExpiryBadgeKind}`}
                title={`Grup başlangıç tarihinden itibaren ${THEORY_RIGHTS_EXPIRY_DAYS}. gün`}
              >
                Hakların yanacağı tarih:
                <strong>{formatDateTR(theoryRightsExpiryDate)}</strong>
                <span>{formatRemainingDayCount(theoryRightsRemainingDays)}</span>
              </span>
            ) : null}
          </div>
          {!loading && !error ? (
            <div className="candidate-exam-attempts-head-actions">
              <label
                className="switch-toggle candidate-exam-attempts-muaf-toggle"
                title={hasExistingLicense
                  ? t("candidateDetail.license.autoExemptByLicense")
                  : t("candidateDetail.license.exemptText")}
              >
                <input
                  type="checkbox"
                  checked={isTheoryExempt}
                  disabled={exemptSaving || hasExistingLicense || !canManageCandidates}
                  onChange={toggleTheoryExempt}
                />
                <span className="switch-toggle-control" aria-hidden="true" />
                <span>Muaf</span>
              </label>
              <button
                className="btn btn-primary btn-sm candidate-exam-add-button"
                disabled={!canManageCandidates}
                onClick={() => openAddForm("theory")}
                title={!canManageCandidates ? noPermissionTitle : undefined}
                type="button"
              >
                Yeni
              </button>
            </div>
          ) : null}
        </div>
        {loading ? (
          <div className="table-wrap spaced candidate-exam-attempts-table-wrap">
            <table className="data-table cand-table candidate-exam-attempts-table">
              <tbody>
                <SettingsTableSkeleton columns={[132, 54, 64, 92, 92, 64]} rows={4} />
              </tbody>
            </table>
          </div>
        ) : error ? (
          <div className="instructor-detail-error">{error}</div>
        ) : (
          <div className="table-wrap spaced candidate-exam-attempts-table-wrap">
            <table className="data-table cand-table candidate-exam-attempts-table">
              <thead>
                <tr>
                  <th>Tarih-saat</th>
                  <th>Hak</th>
                  <th>Puan</th>
                  <th>Sınav ücreti</th>
                  <th>Ücret Durumu</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {theoryAttempts.length === 0 ? (
                  <tr>
                    <td className="data-table-empty" colSpan={6}>{t("candidateDetail.exam.emptyTheory")}</td>
                  </tr>
                ) : theoryAttempts.map((attempt) => (
                  <CandidateExamAttemptRow
                    attempt={attempt}
                    attemptLimit={candidateExamAttemptLimit(attempts, attempt.examType)}
                    disabled={rowSavingId === attempt.id || !canManageCandidates}
                    deleteConfirmOpen={deleteConfirmId === attempt.id}
                    key={attempt.id}
                    onCharge={() => chargeAttempt(attempt)}
                    onCancelDelete={() => setDeleteConfirmId(null)}
                    onConfirmDelete={() => void confirmDelete(attempt)}
                    onEdit={() => openEditForm(attempt)}
                    onRequestDelete={() => setDeleteConfirmId(attempt.id)}
                    onPay={() => void payAttempt(attempt)}
                    onSelfPaid={() => markSelfPaid(attempt)}
                    onScoreSave={(nextScore) => updateAttemptScore(attempt, nextScore)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="instructor-detail-card candidate-exam-attempts-section">
        <div className="candidate-exam-attempts-head">
          <h3 className="candidate-detail-section-title">{t("candidateDetail.exam.section.practice")}</h3>
          {!loading && !error ? (
            <button
              className="btn btn-primary btn-sm candidate-exam-add-button"
              disabled={!canManageCandidates}
              onClick={() => openAddForm("practice")}
              title={!canManageCandidates ? noPermissionTitle : undefined}
              type="button"
            >
              Yeni
            </button>
          ) : null}
        </div>
        {loading ? (
          <div className="table-wrap spaced candidate-exam-attempts-table-wrap">
            <table className="data-table cand-table candidate-exam-attempts-table candidate-exam-attempts-table--practice">
              <tbody>
                <SettingsTableSkeleton columns={[132, 86, 138, 54, 94, 94, 92, 64]} rows={4} />
              </tbody>
            </table>
          </div>
        ) : error ? (
          <div className="instructor-detail-error">{error}</div>
        ) : (
          <div className="table-wrap spaced candidate-exam-attempts-table-wrap">
            <table className="data-table cand-table candidate-exam-attempts-table candidate-exam-attempts-table--practice">
              <thead>
                <tr>
                  <th>Tarih-saat</th>
                  <th>Plaka</th>
                  <th>Usta Öğretici</th>
                  <th>Hak</th>
                  <th>Sınav Durumu</th>
                  <th>Sınav Sonucu</th>
                  <th>Sınav Ücreti</th>
                  <th>Ücret Durumu</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {practiceAttempts.length === 0 ? (
                  <tr>
                    <td className="data-table-empty" colSpan={9}>{t("candidateDetail.exam.emptyPractice")}</td>
                  </tr>
                ) : practiceAttempts.map((attempt) => (
                  <CandidatePracticeExamAttemptRow
                    attempt={attempt}
                    attemptLimit={candidateExamAttemptLimit(attempts, attempt.examType)}
                    disabled={rowSavingId === attempt.id || !canManageCandidates}
                    deleteConfirmOpen={deleteConfirmId === attempt.id}
                    key={attempt.id}
                    onCharge={() => chargeAttempt(attempt)}
                    onCancelDelete={() => setDeleteConfirmId(null)}
                    onConfirmDelete={() => void confirmDelete(attempt)}
                    onEdit={() => openEditForm(attempt)}
                    onPay={() => void payAttempt(attempt)}
                    onRequestDelete={() => setDeleteConfirmId(attempt.id)}
                    onSelfPaid={() => markSelfPaid(attempt)}
                    onStatusSave={(nextAttendanceStatus, nextResultStatus) =>
                      updatePracticeAttemptStatus(attempt, nextAttendanceStatus, nextResultStatus)
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        footer={
          <>
            <button className="btn btn-secondary" disabled={saving} onClick={closeAttemptForm} type="button">
              Vazgeç
            </button>
            <button
              className="btn btn-primary"
              disabled={saving || !canManageCandidates}
              onClick={saveAttempt}
              title={!canManageCandidates ? noPermissionTitle : undefined}
              type="button"
            >
              Kaydet
            </button>
          </>
        }
        onClose={closeAttemptForm}
        open={addOpen}
        title={editingAttempt
          ? form.examType === "practice" ? t("candidateDetail.exam.editPractice") : t("candidateDetail.exam.editTheory")
          : form.examType === "practice" ? t("candidateDetail.exam.newPractice") : t("candidateDetail.exam.newTheory")}
      >
        <div className="candidate-exam-attempt-form">
          <label>
            <span>Sınav tipi</span>
            <CustomSelect
              className="form-select"
              disabled={!!editingAttempt}
              value={form.examType}
              onChange={(event) => {
                const nextExamType = event.target.value as CandidateExamType;
                const defaultPracticeSchedule = nextExamType === "practice" ? practiceSchedules[0] : null;
                setFeeTouched(false);
                setForm((current) => ({
                  ...current,
                  examType: nextExamType,
                  scheduledAt: defaultPracticeSchedule
                    ? examScheduleDateTimeLocal(defaultPracticeSchedule)
                    : current.scheduledAt,
                  examScheduleId: defaultPracticeSchedule?.id ?? "",
                  vehicleId: "",
                  instructorId: "",
                  examAttendanceStatus: "",
                  examResultStatus: "",
                  score: "",
                  fee: "",
                }));
              }}
            >
              <option value="theory">Teorik</option>
              <option value="practice">Direksiyon</option>
            </CustomSelect>
          </label>
          <label>
            <span>Hak</span>
            <input
              readOnly
              value={`${Math.min(
                editingAttempt?.attemptNumber ?? nextAttemptNumber(form.examType, form.examAttendanceStatus),
                candidateExamAttemptLimit(attempts, form.examType, form.examAttendanceStatus)
              )}/${candidateExamAttemptLimit(attempts, form.examType, form.examAttendanceStatus)}`}
            />
          </label>
          {form.examType === "practice" ? (
            <>
              <label>
                <span>Sınav tarihi</span>
                <CustomSelect
                  className="form-select"
                  onChange={(event) => {
                    const schedule = practiceSchedules.find((item) => item.id === event.target.value) ?? null;
                    setForm((current) => ({
                      ...current,
                      examScheduleId: schedule?.id ?? "",
                      scheduledAt: schedule
                        ? combineDateAndTimeLocal(
                            schedule.date,
                            timePartFromDateTimeLocal(current.scheduledAt) === "00:00"
                              ? DEFAULT_DRIVING_EXAM_TIME
                              : timePartFromDateTimeLocal(current.scheduledAt)
                          )
                        : current.scheduledAt,
                    }));
                  }}
                  value={form.examScheduleId}
                >
                  <option value="">—</option>
                  {practiceSchedules.map((schedule) => (
                    <option
                      data-secondary={formatExamScheduleOptionSecondary(schedule)}
                      key={schedule.id}
                      value={schedule.id}
                    >
                      {formatExamScheduleOptionLabel(schedule)}
                    </option>
                  ))}
                </CustomSelect>
              </label>
              <label>
                <span>Saat</span>
                <LocalizedTimeInput
                  ariaLabel={t("candidateDetail.exam.aria.practiceTime")}
                  className="form-input"
                  onChange={(time) =>
                    setForm((current) => ({
                      ...current,
                      scheduledAt: combineDateAndTimeLocal(datePartFromDateTimeLocal(current.scheduledAt), time),
                    }))
                  }
                  timeOptions={DRIVING_EXAM_TIME_SLOTS}
                  value={timePartFromDateTimeLocal(form.scheduledAt)}
                />
              </label>
            </>
          ) : (
            <>
              <label>
                <span>Tarih</span>
                <LocalizedDateInput
                  className="form-input"
                  lang="tr-TR"
                  onChange={(date) =>
                    setForm((current) => ({
                      ...current,
                      scheduledAt: combineDateAndTimeLocal(date, timePartFromDateTimeLocal(current.scheduledAt)),
                    }))
                  }
                  value={datePartFromDateTimeLocal(form.scheduledAt)}
                />
              </label>
              <label>
                <span>Saat</span>
                <CustomSelect
                  className="form-select"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      scheduledAt: combineDateAndTimeLocal(
                        datePartFromDateTimeLocal(current.scheduledAt),
                        event.target.value
                      ),
                    }))
                  }
                  value={timePartFromDateTimeLocal(form.scheduledAt)}
                >
                  {examAttemptTimeOptions(timePartFromDateTimeLocal(form.scheduledAt)).map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </CustomSelect>
              </label>
            </>
          )}
          {form.examType === "practice" ? (
            <>
              <label>
                <span>Plaka</span>
                <CustomSelect
                  className="form-select"
                  onChange={(event) => setForm((current) => ({ ...current, vehicleId: event.target.value }))}
                  value={form.vehicleId}
                >
                  <option value="">—</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.plateNumber}
                    </option>
                  ))}
                </CustomSelect>
              </label>
              <label>
                <span>Usta öğretici</span>
                <CustomSelect
                  className="form-select"
                  onChange={(event) => setForm((current) => ({ ...current, instructorId: event.target.value }))}
                  value={form.instructorId}
                >
                  <option value="">—</option>
                  {instructors.map((instructor) => (
                    <option key={instructor.id} value={instructor.id}>
                      {instructor.firstName} {instructor.lastName}
                    </option>
                  ))}
                </CustomSelect>
              </label>
              <label>
                <span>Sınav durumu</span>
                <CustomSelect
                  className="form-select"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      examAttendanceStatus: event.target.value as "" | "attended" | "absent" | "reported",
                      examResultStatus: event.target.value === "attended" ? current.examResultStatus : "",
                    }))
                  }
                  value={form.examAttendanceStatus}
                >
                  <option value="">—</option>
                  <option value="attended">Girdi</option>
                  <option value="absent">Girmedi</option>
                  <option value="reported">Raporlu</option>
                </CustomSelect>
              </label>
              <label>
                <span>Sınav sonucu</span>
                <CustomSelect
                  className="form-select"
                  disabled={form.examAttendanceStatus !== "attended"}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      examResultStatus: event.target.value as "" | "passed" | "failed",
                    }))
                  }
                  value={form.examResultStatus}
                >
                  <option value="">—</option>
                  <option value="passed">{t("candidateDetail.exam.passed")}</option>
                  <option value="failed">{t("candidateDetail.exam.failed")}</option>
                </CustomSelect>
              </label>
            </>
          ) : null}
          <label>
            <span>
              Sınav ücreti{suggestedFee != null ? ` (${formatCurrencyTRY(suggestedFee)})` : ""}
            </span>
            <input
              disabled={editingFeeLocked}
              min="0"
              readOnly={editingFeeLocked}
              type="number"
              value={form.fee}
              onChange={(event) => {
                if (editingFeeLocked) return;
                setFeeTouched(true);
                setForm((current) => ({ ...current, fee: event.target.value }));
              }}
            />
            {editingFeeLocked ? <em>Ücreti olan sınavlarda tutar değiştirilemez.</em> : null}
          </label>
          {form.examType === "theory" ? (
            <label>
              <span>Puan (0-100, opsiyonel)</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="—"
                value={form.score}
                onChange={(event) => {
                  // Sadece rakam + 3 hane sınırı; "70.5" / "75abc" silent
                  // kabul etmesin diye onChange'te filtrele.
                  const next = event.target.value.replace(/[^\d]/g, "").slice(0, 3);
                  setForm((current) => ({ ...current, score: next }));
                }}
              />
            </label>
          ) : null}
        </div>
      </Modal>

    </>
  );
}

function CandidateExamAttemptRow({
  attempt,
  attemptLimit,
  disabled,
  deleteConfirmOpen,
  onCharge,
  onCancelDelete,
  onConfirmDelete,
  onEdit,
  onPay,
  onRequestDelete,
  onSelfPaid,
  onScoreSave,
}: {
  attempt: CandidateExamAttemptResponse;
  attemptLimit: number;
  disabled: boolean;
  deleteConfirmOpen: boolean;
  onCharge: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onEdit: () => void;
  onPay: () => void;
  onRequestDelete: () => void;
  onSelfPaid: () => void;
  onScoreSave: (nextScore: number | null) => Promise<boolean>;
}) {
  const t = useT();
  return (
    <tr>
      <td>{formatDateTimeTR(attempt.scheduledAt)}</td>
      <td>{attempt.attemptNumber}/{attemptLimit}</td>
      <td>
        <EditableScoreCell
          score={attempt.score}
          disabled={disabled}
          onSave={onScoreSave}
        />
      </td>
      <td>
        <div className="candidate-exam-fee-cell">
          <strong>{formatCurrencyTRY(attempt.fee)}</strong>
        </div>
      </td>
      <td>
        <ExamFeeStatusCell
          attempt={attempt}
          disabled={disabled}
          onCharge={onCharge}
          onPay={onPay}
          onSelfPaid={onSelfPaid}
          showSelfPaid
        />
      </td>
      <td>
        <div className="candidate-exam-row-actions">
          <button
            aria-label={t("candidateDetail.exam.aria.editExam")}
            className="candidate-exam-row-action"
            disabled={disabled}
            onClick={onEdit}
            type="button"
          >
            <PencilIcon size={14} />
          </button>
          <InlineDeleteConfirm
            disabled={disabled}
            open={deleteConfirmOpen}
            onCancel={onCancelDelete}
            onConfirm={onConfirmDelete}
            onRequest={onRequestDelete}
          />
        </div>
      </td>
    </tr>
  );
}

function ExamFeeStatusCell({
  attempt,
  disabled,
  onCharge,
  onPay,
  onSelfPaid,
  showSelfPaid = false,
}: {
  attempt: CandidateExamAttemptResponse;
  disabled: boolean;
  onCharge: () => void;
  onPay: () => void;
  onSelfPaid: () => void;
  showSelfPaid?: boolean;
}) {
  const t = useT();
  const statusLabelKey = feeStatusLabelKey(attempt.feeStatus);
  const hasFee = attempt.fee > 0;
  return (
    <div className="candidate-exam-fee-status">
      {statusLabelKey ? (
        <span className={`candidate-exam-pill ${feeStatusKind(attempt.feeStatus)}`}>
          {t(statusLabelKey)}
        </span>
      ) : null}
      {attempt.feeStatus === "pending" ? (
        <>
          {hasFee ? (
            <button className="btn btn-secondary btn-sm" disabled={disabled} onClick={onCharge} type="button">
              Borçlandır
            </button>
          ) : null}
          {showSelfPaid ? (
            <button className="btn btn-secondary btn-sm" disabled={disabled} onClick={onSelfPaid} type="button">
              Kendi ödedi
            </button>
          ) : null}
        </>
      ) : attempt.feeStatus === "charged" || attempt.feeStatus === "partially_paid" ? (
        <button
          className="btn btn-secondary btn-sm"
          disabled={disabled}
          onClick={onPay}
          type="button"
        >
          Öde
        </button>
      ) : attempt.paidAt ? (
        <small>{formatDateTR(attempt.paidAt)}</small>
      ) : null}
    </div>
  );
}

function CandidatePracticeExamAttemptRow({
  attempt,
  attemptLimit,
  disabled,
  deleteConfirmOpen,
  onCharge,
  onCancelDelete,
  onConfirmDelete,
  onEdit,
  onPay,
  onRequestDelete,
  onSelfPaid,
  onStatusSave,
}: {
  attempt: CandidateExamAttemptResponse;
  attemptLimit: number;
  disabled: boolean;
  deleteConfirmOpen: boolean;
  onCharge: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onEdit: () => void;
  onPay: () => void;
  onRequestDelete: () => void;
  onSelfPaid: () => void;
  onStatusSave: (
    nextAttendanceStatus: CandidateExamAttemptResponse["examAttendanceStatus"],
    nextResultStatus: CandidateExamAttemptResponse["examResultStatus"]
  ) => Promise<boolean>;
}) {
  const t = useT();
  const attendanceStatus = attempt.examAttendanceStatus ?? "";
  const resultStatus = attempt.examResultStatus ?? "";
  return (
    <tr>
      <td>{formatDateTimeTR(attempt.scheduledAt)}</td>
      <td>{attempt.vehiclePlate ?? "—"}</td>
      <td>{attempt.instructorFullName ?? "—"}</td>
      <td>{attempt.attemptNumber}/{attemptLimit}</td>
      <td>
        <CustomSelect
          aria-label={t("candidateDetail.exam.aria.examStatus")}
          className="candidate-exam-inline-select"
          disabled={disabled}
          onChange={(event) => {
            const nextAttendanceStatus = (event.target.value || null) as CandidateExamAttemptResponse["examAttendanceStatus"];
            const nextResultStatus = nextAttendanceStatus === "attended" ? attempt.examResultStatus : null;
            void onStatusSave(nextAttendanceStatus, nextResultStatus);
          }}
          value={attendanceStatus}
        >
          <option value="">—</option>
          <option value="attended">Girdi</option>
          <option value="absent">Girmedi</option>
          <option value="reported">Raporlu</option>
        </CustomSelect>
      </td>
      <td>
        <CustomSelect
          aria-label={t("candidateDetail.exam.aria.examResult")}
          className="candidate-exam-inline-select"
          disabled={disabled || attempt.examAttendanceStatus !== "attended"}
          onChange={(event) => {
            const nextResultStatus = (event.target.value || null) as CandidateExamAttemptResponse["examResultStatus"];
            void onStatusSave(attempt.examAttendanceStatus, nextResultStatus);
          }}
          value={resultStatus}
        >
          <option value="">—</option>
          <option value="passed">{t("candidateDetail.exam.passed")}</option>
          <option value="failed">{t("candidateDetail.exam.failed")}</option>
        </CustomSelect>
      </td>
      <td>
        <div className="candidate-exam-fee-cell">
          <strong>{formatCurrencyTRY(attempt.fee)}</strong>
        </div>
      </td>
      <td>
        <ExamFeeStatusCell
          attempt={attempt}
          disabled={disabled}
          onCharge={onCharge}
          onPay={onPay}
          onSelfPaid={onSelfPaid}
        />
      </td>
      <td>
        <div className="candidate-exam-row-actions">
          <button
            aria-label={t("candidateDetail.exam.aria.editExam")}
            className="candidate-exam-row-action"
            disabled={disabled}
            onClick={onEdit}
            type="button"
          >
            <PencilIcon size={14} />
          </button>
          <InlineDeleteConfirm
            disabled={disabled}
            open={deleteConfirmOpen}
            onCancel={onCancelDelete}
            onConfirm={onConfirmDelete}
            onRequest={onRequestDelete}
          />
        </div>
      </td>
    </tr>
  );
}

function EditableScoreCell({
  score,
  disabled,
  onSave,
}: {
  score: number | null;
  disabled: boolean;
  onSave: (nextScore: number | null) => Promise<boolean>;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(score != null ? String(score) : "");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { showToast } = useToast();
  const scoreStatus = getScoreStatus(score);

  useEffect(() => {
    if (!editing) {
      setDraft(score != null ? String(score) : "");
    }
  }, [editing, score]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = async () => {
    const raw = draft.trim();
    let nextScore: number | null;
    if (raw === "") {
      nextScore = null;
    } else if (!/^\d{1,3}$/.test(raw)) {
      showToast(t("candidateDetail.exam.toast.scoreInteger"), "error");
      setDraft(score != null ? String(score) : "");
      setEditing(false);
      return;
    } else {
      const parsed = Number.parseInt(raw, 10);
      if (parsed > 100) {
        showToast(t("candidateDetail.exam.toast.scoreRange"), "error");
        setDraft(score != null ? String(score) : "");
        setEditing(false);
        return;
      }
      nextScore = parsed;
    }
    if (nextScore === score) {
      setEditing(false);
      return;
    }
    const ok = await onSave(nextScore);
    if (ok) {
      setEditing(false);
    } else {
      // Hata sonrası eski değere dön
      setDraft(score != null ? String(score) : "");
      setEditing(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        className="candidate-exam-score-cell candidate-exam-score-cell--button"
        disabled={disabled}
        onClick={() => setEditing(true)}
        title={t("candidateDetail.exam.scoreEditTooltip")}
      >
        <span>{score ?? "—"}</span>
        {scoreStatus ? (
          <span className={`candidate-exam-pill ${scoreStatus.kind}`}>{t(scoreStatus.labelKey)}</span>
        ) : null}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      className="candidate-exam-score-input"
      type="text"
      inputMode="numeric"
      placeholder="—"
      value={draft}
      onChange={(event) => {
        const next = event.target.value.replace(/[^\d]/g, "").slice(0, 3);
        setDraft(next);
      }}
      onBlur={() => void commit()}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          setDraft(score != null ? String(score) : "");
          setEditing(false);
        }
      }}
    />
  );
}

function InlineDeleteConfirm({
  disabled,
  open,
  onCancel,
  onConfirm,
  onRequest,
}: {
  disabled: boolean;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onRequest: () => void;
}) {
  if (!open) {
    return (
      <button
        aria-label="Sil"
        className="icon-btn candidate-exam-delete-trigger"
        disabled={disabled}
        onClick={onRequest}
        title="Sil"
        type="button"
      >
        <TrashIcon size={13} />
      </button>
    );
  }

  return (
    <div className="candidate-inline-delete-confirm">
      <span>Emin misin?</span>
      <button className="btn btn-secondary btn-sm" disabled={disabled} onClick={onCancel} type="button">
        Vazgeç
      </button>
      <button className="btn btn-danger btn-sm" disabled={disabled} onClick={onConfirm} type="button">
        Sil
      </button>
    </div>
  );
}

function compareExamAttempts(a: CandidateExamAttemptResponse, b: CandidateExamAttemptResponse): number {
  return a.examType.localeCompare(b.examType) || a.attemptNumber - b.attemptNumber;
}

function getScoreStatus(score: number | null): { labelKey: TranslationKey; kind: "success" | "danger" } | null {
  if (score == null) return null;
  return score >= 70
    ? { labelKey: "candidateDetail.exam.result.pass", kind: "success" }
    : { labelKey: "candidateDetail.exam.result.fail", kind: "danger" };
}

function feeStatusLabelKey(status: CandidateExamFeeStatus): TranslationKey | null {
  if (status === "paid") return "candidateDetail.exam.feeStatus.paid";
  if (status === "partially_paid") return "candidateDetail.exam.feeStatus.partiallyPaid";
  if (status === "partially_refunded") return "candidateDetail.exam.feeStatus.partiallyRefunded";
  if (status === "refunded") return "candidateDetail.exam.feeStatus.refunded";
  if (status === "cancelled") return "candidateDetail.exam.feeStatus.cancelled";
  if (status === "charged") return "candidateDetail.exam.feeStatus.charged";
  return null;
}

function feeStatusKind(status: CandidateExamFeeStatus): "success" | "warning" | "danger" {
  if (status === "paid" || status === "refunded" || status === "cancelled") return "success";
  if (status === "charged" || status === "partially_paid" || status === "partially_refunded") return "warning";
  return "danger";
}

type KCertificateRow = {
  id: string;
  startDate: string;
  expiryDate: string;
  lastLessonEndDate: string;
  documentNumber: string;
  persisted?: boolean;
};

function kCertificateStatus(
  row: KCertificateRow,
  latestDrivingExamDate: string | null | undefined
): "valid" | "invalid" {
  const examDate = latestDrivingExamDate ? latestDrivingExamDate.slice(0, 10) : "";
  if (compareDateOnly(row.expiryDate, row.lastLessonEndDate) < 0) return "invalid";
  if (examDate && compareDateOnly(row.expiryDate, examDate) < 0) return "invalid";
  return "valid";
}

function buildKCertificateRows(
  lessons: TrainingLessonResponse[],
  candidateRegistrationNumber: string,
  candidateId: string
): KCertificateRow[] {
  const sortedLessons = [...lessons]
    .filter((lesson) => lesson.kind === "uygulama")
    .sort((left, right) => new Date(left.startAtUtc).getTime() - new Date(right.startAtUtc).getTime());
  const rows: KCertificateRow[] = [];
  const candidateNumber = candidateRegistrationNumber.trim() || candidateId.slice(0, 8);

  for (const lesson of sortedLessons) {
    const lessonStartDate = dateOnlyInTurkey(lesson.startAtUtc);
    const lessonEndDate = dateOnlyInTurkey(lesson.endAtUtc);
    if (!lessonStartDate || !lessonEndDate) continue;

    const current = rows.length > 0 ? rows[rows.length - 1] : undefined;
    if (!current || compareDateOnly(lessonStartDate, current.expiryDate) > 0) {
      rows.push({
        id: lesson.id,
        startDate: lessonStartDate,
        expiryDate: addDaysToISODate(lessonStartDate, 180),
        lastLessonEndDate: lessonEndDate,
        documentNumber: `K-${candidateNumber}-${rows.length + 1}`,
      });
      continue;
    }

    if (compareDateOnly(lessonEndDate, current.lastLessonEndDate) > 0) {
      current.lastLessonEndDate = lessonEndDate;
    }
  }

  return rows;
}

function nextKCertificateRow(
  previousRow: KCertificateRow,
  candidateRegistrationNumber: string,
  candidateId: string,
  sequence: number
): KCertificateRow {
  const candidateNumber = candidateRegistrationNumber.trim() || candidateId.slice(0, 8);
  const startDate = previousRow.expiryDate;
  return {
    id: "",
    startDate,
    expiryDate: addDaysToISODate(startDate, 180),
    lastLessonEndDate: previousRow.lastLessonEndDate,
    documentNumber: `K-${candidateNumber}-${sequence}`,
  };
}

function kCertificateResponseToRow(certificate: CandidateKCertificateResponse): KCertificateRow {
  return {
    id: certificate.id,
    startDate: certificate.startDate,
    expiryDate: certificate.expiryDate,
    lastLessonEndDate: certificate.lastLessonEndDate,
    documentNumber: certificate.documentNumber,
    persisted: true,
  };
}

function CandidateKCertificateSection({
  canManageCandidates,
  candidate,
}: {
  canManageCandidates: boolean;
  candidate: CandidateResponse;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const [lessons, setLessons] = useState<TrainingLessonResponse[]>([]);
  const renewSavingRef = useRef(false);
  const [hiddenRowIds, setHiddenRowIds] = useState<string[]>([]);
  const [persistedRows, setPersistedRows] = useState<KCertificateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noPermissionTitle = t("common.noPermission");

  const invalidateKCertificateDependents = () => {
    void queryClient.invalidateQueries({ queryKey: candidateKeys.detail(candidate.id) });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: ["training", "lessons"] });
    void queryClient.invalidateQueries({ queryKey: ["documents", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["documents", "tabCount"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  useEffect(() => {
    const controller = new AbortController();
    const from = new Date(2000, 0, 1);
    const to = addDays(new Date(), 365);
    to.setHours(23, 59, 59, 999);

    setLoading(true);
    setError(null);
    Promise.all([
      getTrainingLessons(
        {
          kind: "uygulama",
          candidateId: candidate.id,
          fromUtc: from.toISOString(),
          toUtc: to.toISOString(),
        },
        controller.signal
      ),
      listCandidateKCertificates(candidate.id, controller.signal),
    ])
      .then(([lessonResponse, certificateResponse]) => {
        setLessons(lessonResponse.items);
        setPersistedRows(certificateResponse.map(kCertificateResponseToRow));
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setLessons([]);
        setError(t("candidateDetail.kCertificate.loadError"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [candidate.id]);

  const rows = useMemo(
    () => buildKCertificateRows(lessons, candidate.registrationNumber, candidate.id),
    [candidate.id, candidate.registrationNumber, lessons]
  );
  const visibleBaseRows = useMemo(
    () => rows.filter((row) => !hiddenRowIds.includes(row.id)),
    [hiddenRowIds, rows]
  );
  const visibleRows = useMemo(
    () => [...visibleBaseRows, ...persistedRows.filter((row) => !hiddenRowIds.includes(row.id))],
    [hiddenRowIds, persistedRows, visibleBaseRows]
  );
  const displayRows = useMemo(() => [...visibleRows].reverse(), [visibleRows]);

  const renewKCertificate = async () => {
    if (!canManageCandidates) return;
    if (renewSavingRef.current) return;
    const previousRow = visibleRows[visibleRows.length - 1];
    if (!previousRow) return;
    const nextRow = nextKCertificateRow(
      previousRow,
      candidate.registrationNumber,
      candidate.id,
      visibleRows.length + 1
    );

    renewSavingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const created = await createCandidateKCertificate(candidate.id, {
        documentNumber: nextRow.documentNumber,
        startDate: nextRow.startDate,
        expiryDate: nextRow.expiryDate,
        lastLessonEndDate: nextRow.lastLessonEndDate,
      });
      setPersistedRows((current) => [...current, kCertificateResponseToRow(created)]);
      invalidateKCertificateDependents();
    } catch {
      setError("K belgesi yenilenemedi.");
    } finally {
      renewSavingRef.current = false;
      setSaving(false);
    }
  };

  const deleteKCertificateRow = async (row: KCertificateRow) => {
    if (!canManageCandidates) return;
    if (row.persisted) {
      setSaving(true);
      try {
        await deleteCandidateKCertificate(candidate.id, row.id);
        setPersistedRows((current) => current.filter((item) => item.id !== row.id));
        invalidateKCertificateDependents();
      } catch {
        setError("K belgesi silinemedi.");
      } finally {
        setSaving(false);
      }
      return;
    }
    setHiddenRowIds((current) => [...current, row.id]);
  };

  const printKCertificates = () => {
    window.print();
  };

  return (
    <section className="instructor-detail-card candidate-k-certificate-section">
      <div className="candidate-k-certificate-head">
        <h3 className="candidate-detail-section-title">{t("candidateDetail.exam.section.kCertificate")}</h3>
        <div className="candidate-k-certificate-actions">
          <button
            className="btn btn-secondary btn-sm"
            disabled={saving || visibleRows.length === 0 || !canManageCandidates}
            onClick={() => void renewKCertificate()}
            title={!canManageCandidates ? noPermissionTitle : undefined}
            type="button"
          >
            Yenile
          </button>
          <button
            className="btn btn-secondary btn-sm"
            disabled={saving || visibleRows.length === 0}
            onClick={printKCertificates}
            type="button"
          >
            Yazdır
          </button>
        </div>
      </div>

      {error ? <div className="instructor-detail-error">{error}</div> : null}
      <div className="table-wrap candidate-k-certificate-table-wrap">
        <table className="data-table candidate-k-certificate-table">
          <thead>
            <tr>
              <th>Belge No</th>
              <th>K Belgesi Başlangıç Tarihi</th>
              <th>K Belgesi Bitiş Tarihi</th>
              <th>Son Ders Bitiş Tarihi</th>
              <th>Durum</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SettingsTableSkeleton columns={[100, 132, 132, 132, 74, 64]} rows={4} />
            ) : visibleRows.length === 0 ? (
              <tr>
                <td className="data-table-empty" colSpan={6}>
                  Adaya yazılmış direksiyon dersi bulunmuyor.
                </td>
              </tr>
            ) : (
              displayRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.documentNumber || "—"}</td>
                  <td>{formatDateTR(row.startDate)}</td>
                  <td>{formatDateTR(row.expiryDate)}</td>
                  <td>{formatDateTR(row.lastLessonEndDate)}</td>
                  <td>
                    {kCertificateStatus(row, candidate.drivingExamDate) === "valid" ? (
                      <span className="candidate-exam-pill success">{t("candidateDetail.kCertificate.valid")}</span>
                    ) : (
                      <span className="candidate-exam-pill danger">{t("candidateDetail.kCertificate.invalid")}</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={saving || !canManageCandidates}
                      onClick={() => void deleteKCertificateRow(row)}
                      title={!canManageCandidates ? noPermissionTitle : undefined}
                      type="button"
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatFileSize(bytes: number | null): string | null {
  if (bytes == null || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type CandidateDocumentStatus = "uploaded" | "physical" | "missing";
type CandidateDocumentFilter = "all" | "missing" | "available" | "mebbis";
type CandidateDocumentChecklistStatus = "done" | "missing" | "not_applicable";
type CandidateDocumentChecklistItem = {
  label: string;
  status: CandidateDocumentChecklistStatus;
  value?: string;
};
const PHOTO_DOCUMENT_TYPE_KEYS = ["biometric_photo", "webcam_photo"] as const;
const CONTRACT_DOCUMENT_TYPE_KEYS = ["contract_front", "contract_back"] as const;
const CONTRACT_GROUP_DOCUMENT_TYPE_KEYS = [
  "contract_front",
  "contract_back",
  "signature_sample",
] as const;
const A4_DOCUMENT_TYPE_KEYS = [
  "education_certificate",
  "health_report",
  "criminal_record",
] as const;
const PRINTABLE_DOCUMENT_TYPE_KEYS = [
  "signature_sample",
  "contract_front",
  "contract_back",
  "application_form",
] as const;

const HEALTH_REPORT_FOREIGN_LANGUAGES: Array<{ value: string; labelKey: TranslationKey }> = [
  { value: "arabic", labelKey: "candidateDetail.documents.healthReport.language.arabic" },
  { value: "chinese", labelKey: "candidateDetail.documents.healthReport.language.chinese" },
  { value: "english", labelKey: "candidateDetail.documents.healthReport.language.english" },
  { value: "german", labelKey: "candidateDetail.documents.healthReport.language.german" },
  { value: "french", labelKey: "candidateDetail.documents.healthReport.language.french" },
  { value: "persian", labelKey: "candidateDetail.documents.healthReport.language.persian" },
  { value: "russian", labelKey: "candidateDetail.documents.healthReport.language.russian" },
  { value: "spanish", labelKey: "candidateDetail.documents.healthReport.language.spanish" },
];

const HEALTH_REPORT_DISABILITY_OPTIONS: Array<{ value: string; labelKey: TranslationKey }> = [
  { value: "none", labelKey: "candidateDetail.documents.healthReport.disability.none" },
  { value: "orthopedic_hands", labelKey: "candidateDetail.documents.healthReport.disability.orthopedicHands" },
  { value: "orthopedic_legs", labelKey: "candidateDetail.documents.healthReport.disability.orthopedicLegs" },
  { value: "hearing_speech", labelKey: "candidateDetail.documents.healthReport.disability.hearingSpeech" },
  { value: "vision_one_eye", labelKey: "candidateDetail.documents.healthReport.disability.visionOneEye" },
  { value: "vision_low", labelKey: "candidateDetail.documents.healthReport.disability.visionLow" },
  { value: "chronic_illness", labelKey: "candidateDetail.documents.healthReport.disability.chronicIllness" },
];

const HEALTH_REPORT_META_KEYS = {
  foreignLanguage: "foreign_language",
  disability: "disability",
  needsTranslator: "needs_translator",
  needsSignLanguageTranslator: "needs_sign_language_translator",
} as const;

const HEALTH_REPORT_EXTRA_KEYS = new Set<string>([
  HEALTH_REPORT_META_KEYS.foreignLanguage,
  HEALTH_REPORT_META_KEYS.disability,
  HEALTH_REPORT_META_KEYS.needsTranslator,
  HEALTH_REPORT_META_KEYS.needsSignLanguageTranslator,
]);

function isPhotoDocumentType(type: DocumentTypeResponse): boolean {
  return PHOTO_DOCUMENT_TYPE_KEYS.includes(
    type.key as (typeof PHOTO_DOCUMENT_TYPE_KEYS)[number]
  );
}

function isPrintableDocumentType(type: DocumentTypeResponse): boolean {
  return PRINTABLE_DOCUMENT_TYPE_KEYS.includes(
    type.key as (typeof PRINTABLE_DOCUMENT_TYPE_KEYS)[number]
  );
}

function isContractDocumentType(type: DocumentTypeResponse): boolean {
  return CONTRACT_DOCUMENT_TYPE_KEYS.includes(
    type.key as (typeof CONTRACT_DOCUMENT_TYPE_KEYS)[number]
  );
}

function isSignatureDocumentType(type: DocumentTypeResponse): boolean {
  return type.key === "signature_sample";
}

function isA4DocumentType(type: DocumentTypeResponse): boolean {
  return A4_DOCUMENT_TYPE_KEYS.includes(
    type.key as (typeof A4_DOCUMENT_TYPE_KEYS)[number]
  );
}

function isPreviewableImage(upload: DocumentResponse | null): boolean {
  return !!upload?.hasFile && !!upload.contentType?.startsWith("image/");
}

function getCandidateDocumentStatus(upload: DocumentResponse | null): CandidateDocumentStatus {
  if (!upload) return "missing";
  if (upload.hasFile) return "uploaded";
  return upload.isPhysicallyAvailable ? "physical" : "missing";
}

function isDocumentAvailableForChecklist(upload: DocumentResponse | null | undefined): boolean {
  return upload !== null && upload !== undefined && (upload.hasFile || upload.isPhysicallyAvailable);
}

function getDocumentMetadataValue(
  uploadsByKey: Map<string, DocumentResponse>,
  documentKey: string,
  metadataKey: string
): string | null {
  const value = uploadsByKey.get(documentKey)?.metadata?.[metadataKey];
  return value?.trim() || null;
}

function getDocumentMetadataDisplayValue(
  documentTypes: DocumentTypeResponse[],
  documentKey: string,
  metadataKey: string,
  value: string | null
): string | null {
  if (!value) return null;
  const field = documentTypes
    .find((type) => type.key === documentKey)
    ?.metadataFields.find((item) => item.key === metadataKey);
  if (field?.inputType === "date") return formatDateTR(value);
  return field?.options.find((option) => option.value === value)?.label ?? value;
}

function buildCandidateDocumentChecklistItems({
  candidate,
  contractFee,
  documentTypes,
  t,
  uploadsByKey,
}: {
  candidate: CandidateResponse;
  contractFee: number | null;
  documentTypes: DocumentTypeResponse[];
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  uploadsByKey: Map<string, DocumentResponse>;
}): CandidateDocumentChecklistItem[] {
  const hasExistingLicense =
    candidate.hasExistingLicense ?? hasExistingLicenseValue(candidate.existingLicenseType);
  const valueItem = (label: string, value: string | null | undefined): CandidateDocumentChecklistItem => ({
    label,
    status: value?.trim() ? "done" : "missing",
    value: value?.trim() || undefined,
  });
  const documentItem = (
    label: string,
    key: string,
    options?: { notApplicable?: boolean; value?: string | null }
  ): CandidateDocumentChecklistItem => {
    if (options?.notApplicable) {
      return { label, status: "not_applicable", value: options.value ?? t("candidateDetail.documents.checklistItem.notRequired") };
    }
    const upload = uploadsByKey.get(key);
    return {
      label,
      status: isDocumentAvailableForChecklist(upload) ? "done" : "missing",
      value: isDocumentAvailableForChecklist(upload) ? "Var" : undefined,
    };
  };
  const metadataItem = (
    label: string,
    documentKey: string,
    metadataKey: string
  ): CandidateDocumentChecklistItem => {
    const rawValue = getDocumentMetadataValue(uploadsByKey, documentKey, metadataKey);
    return {
      label,
      status: rawValue ? "done" : "missing",
      value: getDocumentMetadataDisplayValue(documentTypes, documentKey, metadataKey, rawValue) ?? undefined,
    };
  };

  const contractFrontAvailable = isDocumentAvailableForChecklist(uploadsByKey.get("contract_front"));
  const contractBackAvailable = isDocumentAvailableForChecklist(uploadsByKey.get("contract_back"));

  const noExistingLicenseValue = t("candidateDetail.documents.checklistItem.noExistingLicense");
  return [
    valueItem(t("candidateDetail.documents.checklistItem.nationalId"), candidate.nationalId),
    valueItem(t("candidateDetail.documents.checklistItem.identitySerialNumber"), candidate.identitySerialNumber),
    valueItem(t("candidateDetail.documents.checklistItem.birthDate"), candidate.birthDate ? formatDateTR(candidate.birthDate) : null),
    valueItem(t("candidateDetail.documents.checklistItem.fatherName"), candidate.fatherName),
    documentItem(t("candidateDetail.documents.checklistItem.identityCopy"), "identity_card"),
    valueItem(t("candidateDetail.documents.checklistItem.requestedLicenseType"), candidate.licenseClass),
    hasExistingLicense
      ? valueItem(
          t("candidateDetail.documents.checklistItem.existingLicenseType"),
          candidate.existingLicenseType
            ? existingLicenseTypeLabel(candidate.existingLicenseType)
            : null
        )
      : { label: t("candidateDetail.documents.checklistItem.existingLicenseType"), status: "not_applicable", value: noExistingLicenseValue },
    hasExistingLicense
      ? valueItem(t("candidateDetail.documents.checklistItem.existingLicenseNumber"), candidate.existingLicenseNumber)
      : { label: t("candidateDetail.documents.checklistItem.existingLicenseNumber"), status: "not_applicable", value: noExistingLicenseValue },
    documentItem(t("candidateDetail.documents.checklistItem.existingLicenseCopy"), "existing_license_copy", {
      notApplicable: !hasExistingLicense,
      value: noExistingLicenseValue,
    }),
    {
      label: t("candidateDetail.documents.checklistItem.contractFee"),
      status: contractFee != null && contractFee > 0 ? "done" : "missing",
      value: contractFee != null && contractFee > 0 ? formatCurrencyTRY(contractFee) : undefined,
    },
    {
      label: t("candidateDetail.documents.checklistItem.contract"),
      status: contractFrontAvailable && contractBackAvailable ? "done" : "missing",
      value:
        contractFrontAvailable && contractBackAvailable
          ? t("candidateDetail.documents.checklistItem.contractBothSides")
          : contractFrontAvailable || contractBackAvailable
            ? t("candidateDetail.documents.checklistItem.contractMissingSide")
            : undefined,
    },
    metadataItem(t("candidateDetail.documents.checklistItem.contractDate"), "contract_back", "contract_date"),
    documentItem(t("candidateDetail.documents.checklistItem.signatureSample"), "signature_sample"),
    documentItem(t("candidateDetail.documents.checklistItem.applicationForm"), "application_form"),
    documentItem(t("candidateDetail.documents.checklistItem.biometricPhoto"), "biometric_photo"),
    documentItem(t("candidateDetail.documents.checklistItem.webcamPhoto"), "webcam_photo"),
    documentItem(t("candidateDetail.documents.checklistItem.educationCertificate"), "education_certificate"),
    metadataItem(t("candidateDetail.documents.checklistItem.educationInstitution"), "education_certificate", "issuing_institution"),
    metadataItem(t("candidateDetail.documents.checklistItem.educationType"), "education_certificate", "certificate_type"),
    metadataItem(t("candidateDetail.documents.checklistItem.educationDate"), "education_certificate", "issued_on"),
    metadataItem(t("candidateDetail.documents.checklistItem.educationNumber"), "education_certificate", "document_number"),
    documentItem(t("candidateDetail.documents.checklistItem.healthReport"), "health_report"),
    metadataItem(t("candidateDetail.documents.checklistItem.healthInstitution"), "health_report", "issuing_institution"),
    metadataItem(t("candidateDetail.documents.checklistItem.healthDate"), "health_report", "issued_on"),
    metadataItem(t("candidateDetail.documents.checklistItem.healthNumber"), "health_report", "document_number"),
    documentItem(t("candidateDetail.documents.checklistItem.criminalRecord"), "criminal_record"),
    metadataItem(t("candidateDetail.documents.checklistItem.criminalInstitution"), "criminal_record", "issuing_institution"),
    metadataItem(t("candidateDetail.documents.checklistItem.criminalDate"), "criminal_record", "issued_on"),
    metadataItem(t("candidateDetail.documents.checklistItem.criminalNumber"), "criminal_record", "document_number"),
  ];
}

function buildDocumentMetadataValues(
  fields: ReadonlyArray<DocumentMetadataField>,
  upload: DocumentResponse | null,
  defaults?: Record<string, string>
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    values[field.key] = upload?.metadata?.[field.key] ?? defaults?.[field.key] ?? "";
  }
  return values;
}

function candidateFeeMatrixYear(candidate: CandidateResponse): number {
  const createdAt = new Date(candidate.createdAtUtc);
  return Number.isFinite(createdAt.getTime()) ? createdAt.getFullYear() : new Date().getFullYear();
}

function normalizeFeeProgramLicenseKey(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/Ç/g, "C")
    .replace(/Ğ/g, "G")
    .replace(/İ/g, "I")
    .replace(/Ö/g, "O")
    .replace(/Ş/g, "S")
    .replace(/[\s_-]/g, "");
}

function findCandidateFeeMatrixRow(
  rows: LicenseClassFeeRowResponse[],
  candidate: CandidateResponse
): LicenseClassFeeRowResponse | undefined {
  if (candidate.licenseClassDefinitionId) {
    const byRuleId = rows.find((item) => item.program.id === candidate.licenseClassDefinitionId);
    if (byRuleId) return byRuleId;
  }

  const hasExistingLicense =
    candidate.hasExistingLicense ?? hasExistingLicenseValue(candidate.existingLicenseType);
  const targetKey = normalizeFeeProgramLicenseKey(candidate.licenseClass);
  const sourceKey =
    hasExistingLicense && candidate.existingLicenseType
      ? normalizeFeeProgramLicenseKey(candidate.existingLicenseType)
      : "YOK";

  return (
    rows.find(
      (item) =>
        normalizeFeeProgramLicenseKey(item.program.targetLicenseClass) === targetKey &&
        normalizeFeeProgramLicenseKey(item.program.sourceLicenseClass) === sourceKey
    )
  );
}

function DocumentsTab({
  canManageCandidates,
  canManageDocuments,
  canManageMebJobs,
  candidate,
  candidateId,
  documents,
  documentTypes,
  loading,
  error,
  onRefresh,
  onDeleted,
}: {
  canManageCandidates: boolean;
  canManageDocuments: boolean;
  canManageMebJobs: boolean;
  candidate: CandidateResponse;
  candidateId: string;
  documents: DocumentResponse[] | null;
  documentTypes: DocumentTypeResponse[] | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
  onDeleted: () => void;
}) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const noPermissionTitle = "Yetkiniz yok.";
  const t = useT();
  const [statusFilter, setStatusFilter] = useState<CandidateDocumentFilter>("all");
  const [candidateSyncQueuing, setCandidateSyncQueuing] = useState(false);
  const [candidateSyncRunning, setCandidateSyncRunning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const contractBackFeeMatrixYear = candidateFeeMatrixYear(candidate);
  const contractBackFeeMatrixQuery = useQuery({
    enabled: Boolean(candidate.licenseClass),
    gcTime: 60 * 60 * 1000,
    queryKey: candidateTargetFeeMatrixKey(contractBackFeeMatrixYear, candidate.licenseClass),
    queryFn: ({ signal }) =>
      getLicenseClassFeeMatrix(
        contractBackFeeMatrixYear,
        { targetLicenseClass: candidate.licenseClass },
        signal
      ),
    staleTime: 60 * 60 * 1000,
  });

  const contractBackMebbisFeeDefault = useMemo(() => {
    if (!contractBackFeeMatrixQuery.data) return null;
    const row = findCandidateFeeMatrixRow(contractBackFeeMatrixQuery.data.rows, candidate);
    const fee = row?.program.mebbisFee;
    return fee != null ? String(fee) : null;
  }, [
    candidate.licenseClassDefinitionId,
    candidate.existingLicenseType,
    candidate.hasExistingLicense,
    candidate.licenseClass,
    contractBackFeeMatrixQuery.data,
  ]);

  const contractBackMetadataDefaults = useMemo(
    () =>
      contractBackMebbisFeeDefault
        ? { institution_mebbis_fee: contractBackMebbisFeeDefault }
        : undefined,
    [contractBackMebbisFeeDefault]
  );

  const handleDeleteCandidate = async () => {
    if (!canManageCandidates) return;
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteCandidate(candidateId);
      showToast("Aday silindi");
      void queryClient.invalidateQueries({ queryKey: candidateKeys.detail(candidateId) });
      void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: ["candidates", "documents", candidateId] });
      void queryClient.invalidateQueries({ queryKey: ["candidates", "accounting", candidateId] });
      void queryClient.invalidateQueries({ queryKey: ["documents", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["documents", "tabCount"] });
      void queryClient.invalidateQueries({ queryKey: ["payments"] });
      void queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: groupKeys.details() });
      void queryClient.invalidateQueries({ queryKey: ["training", "groups"] });
      void queryClient.invalidateQueries({ queryKey: ["training", "lessons"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onDeleted();
    } catch {
      showToast("Aday silinemedi", "error");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="instructor-detail-card">
        <PanelListSkeleton rows={5} />
      </div>
    );
  }
  if (error) {
    return <div className="instructor-detail-card instructor-detail-error">{error}</div>;
  }
  if (!documents || !documentTypes) return null;

  // Group uploads by their docTypeKey for fast lookup. Each type can have at
  // most one canonical upload (latest one if duplicates exist).
  const uploadsByKey = new Map<string, DocumentResponse>();
  for (const doc of documents) {
    const existing = uploadsByKey.get(doc.documentTypeKey);
    if (!existing || doc.uploadedAtUtc > existing.uploadedAtUtc) {
      uploadsByKey.set(doc.documentTypeKey, doc);
    }
  }

  const sortedTypes = [...documentTypes].sort((a, b) => a.sortOrder - b.sortOrder);
  const hasExistingLicenseInfo =
    candidate.hasExistingLicense ?? hasExistingLicenseValue(candidate.existingLicenseType);
  const isNotApplicable = (type: DocumentTypeResponse) =>
    isExistingLicenseCopyType(type) && !hasExistingLicenseInfo;
  const heroTypes = HERO_DOCUMENT_KEYS
    .map((key) => sortedTypes.find((t) => t.key === key))
    .filter((t): t is DocumentTypeResponse => t !== undefined);
  const photoTypes = PHOTO_DOCUMENT_TYPE_KEYS
    .map((key) => sortedTypes.find((t) => t.key === key))
    .filter((t): t is DocumentTypeResponse => t !== undefined);
  const contractTypes = CONTRACT_GROUP_DOCUMENT_TYPE_KEYS
    .map((key) => sortedTypes.find((t) => t.key === key))
    .filter((t): t is DocumentTypeResponse => t !== undefined);
  const a4DocumentTypes = A4_DOCUMENT_TYPE_KEYS
    .map((key) => sortedTypes.find((t) => t.key === key))
    .filter((t): t is DocumentTypeResponse => t !== undefined);
  const requiredTypes = sortedTypes.filter(
    (t) =>
      t.isRequired &&
      !HERO_DOCUMENT_KEYS.includes(t.key as HeroDocumentKey) &&
      !A4_DOCUMENT_TYPE_KEYS.includes(t.key as (typeof A4_DOCUMENT_TYPE_KEYS)[number]) &&
      !PHOTO_DOCUMENT_TYPE_KEYS.includes(t.key as (typeof PHOTO_DOCUMENT_TYPE_KEYS)[number]) &&
      !CONTRACT_GROUP_DOCUMENT_TYPE_KEYS.includes(
        t.key as (typeof CONTRACT_GROUP_DOCUMENT_TYPE_KEYS)[number]
      )
  );
  const optionalTypes = sortedTypes.filter(
    (t) =>
      !t.isRequired &&
      !A4_DOCUMENT_TYPE_KEYS.includes(t.key as (typeof A4_DOCUMENT_TYPE_KEYS)[number]) &&
      !PHOTO_DOCUMENT_TYPE_KEYS.includes(t.key as (typeof PHOTO_DOCUMENT_TYPE_KEYS)[number]) &&
      !CONTRACT_GROUP_DOCUMENT_TYPE_KEYS.includes(
        t.key as (typeof CONTRACT_GROUP_DOCUMENT_TYPE_KEYS)[number]
      )
  );
  const statusCounts = sortedTypes.reduce(
    (acc, type) => {
      if (isNotApplicable(type)) return acc;
      const upload = uploadsByKey.get(type.key) ?? null;
      const status = getCandidateDocumentStatus(upload);
      if (status === "missing") {
        acc.missing += 1;
      } else {
        acc.available += 1;
      }
      if (upload?.isMebbisTransferred) {
        acc.mebbis += 1;
      }
      return acc;
    },
    { available: 0, mebbis: 0, missing: 0 }
  );
  const filterOptions: { key: CandidateDocumentFilter; label: string; count: number }[] = [
    { key: "all", label: t("candidateDetail.documents.filter.all"), count: sortedTypes.length },
    { key: "missing", label: t("candidateDetail.documents.filter.missing"), count: statusCounts.missing },
    { key: "available", label: t("candidateDetail.documents.filter.available"), count: statusCounts.available },
    { key: "mebbis", label: t("candidateDetail.documents.filter.mebbis"), count: statusCounts.mebbis },
  ];
  const matchesFilter = (type: DocumentTypeResponse) => {
    if (isNotApplicable(type)) return statusFilter === "all";
    if (statusFilter === "all") return true;
    const upload = uploadsByKey.get(type.key) ?? null;
    const status = getCandidateDocumentStatus(upload);
    if (statusFilter === "missing") return status === "missing";
    if (statusFilter === "available") return status !== "missing";
    if (statusFilter === "mebbis") return upload?.isMebbisTransferred === true;
    return true;
  };
  const filteredRequiredTypes = requiredTypes.filter(matchesFilter);
  const filteredOptionalTypes = optionalTypes.filter(matchesFilter);
  const filteredA4DocumentTypes = a4DocumentTypes.filter(matchesFilter);
  const hasRequiredDocumentTypes = requiredTypes.length + a4DocumentTypes.length > 0;
  const contractFee = parseMoneyInput(
    getDocumentMetadataValue(uploadsByKey, "contract_back", "institution_mebbis_fee") ??
      contractBackMebbisFeeDefault ??
      ""
  );
  const documentChecklistItems = buildCandidateDocumentChecklistItems({
    candidate,
    contractFee,
    documentTypes,
    t,
    uploadsByKey,
  });
  const completedChecklistCount = documentChecklistItems.filter((item) => item.status === "done").length;
  const actionableChecklistCount = documentChecklistItems.filter((item) => item.status !== "not_applicable").length;
  const handleQueueCandidateSync = async () => {
    if (!canManageMebJobs) return;
    if (candidateSyncQueuing || candidateSyncRunning) return;
    setCandidateSyncQueuing(true);
    try {
      const job = await createCandidateSyncJob(candidateId);
      notifyMebbisJobQueued(job.id, job.jobType);
      void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      showToast(t("candidateDetail.documents.toast.termSyncQueued"));
      setCandidateSyncQueuing(false);
      setCandidateSyncRunning(true);

      for (let attempt = 0; attempt < 60; attempt += 1) {
        if (attempt > 0) {
          await delay(5000);
        }
        const latestJob = await getMebbisJob(job.id);
        if (latestJob.status === "succeeded") {
          for (let refreshAttempt = 0; refreshAttempt < 5; refreshAttempt += 1) {
            if (refreshAttempt > 0) {
              await delay(1500);
            }
            await onRefresh();
          }
          showToast(t("candidateDetail.documents.toast.termSyncCompleted"));
          return;
        }
        if (["failed", "needs_manual_action", "cancelled"].includes(latestJob.status)) {
          showToast(t("candidateDetail.documents.toast.termSyncNeedsReview"), "error");
          return;
        }
      }

      showToast(t("candidateDetail.documents.toast.termSyncStillRunning"));
    } catch {
      showToast(t("candidateDetail.documents.toast.termSyncFailed"), "error");
    } finally {
      setCandidateSyncQueuing(false);
      setCandidateSyncRunning(false);
    }
  };

  return (
    <div className="candidate-detail-tab-content">
      <div className="candidate-detail-doc-top-grid">
        <section className="instructor-detail-card candidate-detail-doc-overview">
          <div className="candidate-detail-doc-overview-head">
            <div>
              <h3 className="candidate-detail-section-title">Evrak Durumu</h3>
            </div>
          </div>
          <div className="candidate-detail-doc-filters" role="tablist" aria-label="Evrak durum filtresi">
            {filterOptions.map((option) => (
              <button
                aria-selected={statusFilter === option.key}
                className={`candidate-detail-doc-filter${statusFilter === option.key ? " active" : ""}`}
                key={option.key}
                onClick={() => setStatusFilter(option.key)}
                role="tab"
                type="button"
              >
                <span>{option.label}</span>
                <strong>{option.count}</strong>
              </button>
            ))}
            <button
              className="candidate-detail-doc-filter candidate-detail-doc-checklist-button"
              onClick={() => setChecklistOpen(true)}
              type="button"
            >
              <span>Checklist</span>
              <strong>{completedChecklistCount}/{actionableChecklistCount}</strong>
            </button>
          </div>
        </section>

        <section className="instructor-detail-card candidate-detail-doc-actions-card">
          <div className="candidate-detail-doc-actions-column">
            <h3 className="candidate-detail-section-title">{t("candidateDetail.documents.section.actions")}</h3>
            {confirmDelete ? (
              <div className="candidate-detail-doc-actions-bar">
                <span className="candidate-detail-doc-actions-confirm">
                  Aday silinsin mi? Bu işlem geri alınamaz.
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={deleting}
                  onClick={() => setConfirmDelete(false)}
                  type="button"
                >
                  Vazgeç
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  disabled={deleting || !canManageCandidates}
                  onClick={handleDeleteCandidate}
                  title={!canManageCandidates ? noPermissionTitle : undefined}
                  type="button"
                >
                  {deleting ? "Siliniyor..." : "Evet, Sil"}
                </button>
              </div>
            ) : (
              <>
                <div className="candidate-detail-doc-actions-bar">
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={candidateSyncQueuing || candidateSyncRunning || !canManageMebJobs}
                    onClick={handleQueueCandidateSync}
                    title={!canManageMebJobs ? noPermissionTitle : undefined}
                    type="button"
                  >
                    {candidateSyncQueuing
                      ? t("candidateDetail.documents.button.queuing")
                      : candidateSyncRunning
                        ? t("candidateDetail.documents.button.syncing")
                        : t("candidateDetail.documents.button.enrollTerm")}
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled
                    type="button"
                    title={t("common.comingSoon")}
                  >
                    Döneme Kaydet ve Aktar
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={!canManageCandidates}
                    onClick={() => setConfirmDelete(true)}
                    title={!canManageCandidates ? noPermissionTitle : undefined}
                    type="button"
                  >
                    Aday Sil
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      <CandidateDocumentChecklistModal
        items={documentChecklistItems}
        onClose={() => setChecklistOpen(false)}
        open={checklistOpen}
      />

      {heroTypes.length > 0 && (
        <div className="candidate-detail-doc-hero-grid">
          {heroTypes.map((type) => (
            <HeroDocumentCard
              canManageDocuments={canManageDocuments}
              candidateId={candidateId}
              key={type.id}
              notApplicable={isNotApplicable(type)}
              onRefresh={onRefresh}
              type={type}
              upload={uploadsByKey.get(type.key) ?? null}
            />
          ))}
        </div>
      )}

      {photoTypes.length > 0 && (
        <ul className="candidate-detail-doc-list candidate-detail-doc-photo-grid">
          {photoTypes.filter(matchesFilter).map((type) => (
            <DocRow
              canManageDocuments={canManageDocuments}
              candidateId={candidateId}
              key={type.id}
              onRefresh={onRefresh}
              type={type}
              upload={uploadsByKey.get(type.key) ?? null}
            />
          ))}
        </ul>
      )}

      {contractTypes.length > 0 && (
        <ul className="candidate-detail-doc-list candidate-detail-doc-contract-grid">
          {contractTypes.filter(matchesFilter).map((type) => (
            <DocRow
              canManageDocuments={canManageDocuments}
              candidateId={candidateId}
              defaultMetadataValues={type.key === "contract_back" ? contractBackMetadataDefaults : undefined}
              key={type.id}
              onRefresh={onRefresh}
              type={type}
              upload={uploadsByKey.get(type.key) ?? null}
            />
          ))}
        </ul>
      )}

      {filteredA4DocumentTypes.length > 0 ? (
        <ul className="candidate-detail-doc-list candidate-detail-doc-a4-grid">
          {filteredA4DocumentTypes.map((type) => (
            <DocRow
              canManageDocuments={canManageDocuments}
              candidateId={candidateId}
              key={type.id}
              onRefresh={onRefresh}
              type={type}
              upload={uploadsByKey.get(type.key) ?? null}
            />
          ))}
        </ul>
      ) : null}

      {filteredRequiredTypes.length > 0 ? (
        <ul className="candidate-detail-doc-list">
          {filteredRequiredTypes.map((type) => (
            <DocRow
              canManageDocuments={canManageDocuments}
              candidateId={candidateId}
              key={type.id}
              onRefresh={onRefresh}
              type={type}
              upload={uploadsByKey.get(type.key) ?? null}
            />
          ))}
        </ul>
      ) : hasRequiredDocumentTypes && filteredA4DocumentTypes.length === 0 ? (
        <div className="instructor-detail-empty">Bu filtrede zorunlu evrak yok.</div>
      ) : null}

      {optionalTypes.length > 0 && (
        <section className="instructor-detail-card">
          <h3 className="candidate-detail-section-title">{t("candidateDetail.documents.section.other")}</h3>
          {filteredOptionalTypes.length === 0 ? (
            <div className="instructor-detail-empty">{t("candidateDetail.documents.emptyOtherFilter")}</div>
          ) : (
            <ul className="candidate-detail-doc-list">
              {filteredOptionalTypes.map((type) => (
                <DocRow
                  canManageDocuments={canManageDocuments}
                  candidateId={candidateId}
                  key={type.id}
                  onRefresh={onRefresh}
                  type={type}
                  upload={uploadsByKey.get(type.key) ?? null}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function CandidateDocumentChecklistModal({
  items,
  open,
  onClose,
}: {
  items: CandidateDocumentChecklistItem[];
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const completedCount = items.filter((item) => item.status === "done").length;
  const missingCount = items.filter((item) => item.status === "missing").length;
  const notApplicableCount = items.filter((item) => item.status === "not_applicable").length;

  return (
    <Modal
      footer={
        <button className="btn btn-secondary" onClick={onClose} type="button">
          {t("common.close")}
        </button>
      }
      onClose={onClose}
      open={open}
      title={t("candidateDetail.documents.checklist.title")}
    >
      <div className="candidate-detail-doc-checklist-modal">
        <div className="candidate-detail-doc-checklist-stats" aria-label={t("candidateDetail.documents.checklist.summaryAria")}>
          <span className="candidate-detail-doc-checklist-stat done">{t("candidateDetail.documents.checklist.doneCount", { count: completedCount })}</span>
          <span className="candidate-detail-doc-checklist-stat missing">{t("candidateDetail.documents.checklist.missingCount", { count: missingCount })}</span>
          {notApplicableCount > 0 ? (
            <span className="candidate-detail-doc-checklist-stat not-applicable">
              {t("candidateDetail.documents.checklist.notApplicableCount", { count: notApplicableCount })}
            </span>
          ) : null}
        </div>
        <ul className="candidate-detail-doc-checklist candidate-detail-doc-checklist--modal">
          {items.map((item) => (
            <li
              className={`candidate-detail-doc-checklist-item status-${item.status}`}
              key={item.label}
            >
              <span className="candidate-detail-doc-checklist-mark" aria-hidden="true">
                {item.status === "done" ? "✓" : item.status === "not_applicable" ? "–" : "!"}
              </span>
              <span className="candidate-detail-doc-checklist-text">
                <strong>{item.label}</strong>
                {item.value ? <em>{item.value}</em> : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}

function HeroDocumentCard({
  canManageDocuments,
  candidateId,
  notApplicable = false,
  type,
  upload,
  onRefresh,
}: {
  canManageDocuments: boolean;
  candidateId: string;
  notApplicable?: boolean;
  type: DocumentTypeResponse;
  upload: DocumentResponse | null;
  onRefresh: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const t = useT();
  const noPermissionTitle = t("common.noPermission");
  const isAvailable = !notApplicable && upload !== null && (upload.hasFile || upload.isPhysicallyAvailable);
  const [saving, setSaving] = useState(false);

  const setAvailable = async () => {
    if (!canManageDocuments) return;
    if (notApplicable) return;
    if (saving || isAvailable) return;
    setSaving(true);
    try {
      if (upload) {
        await updateCandidateDocument(candidateId, upload.id, {
          isPhysicallyAvailable: true,
          uploadedAtUtc: new Date().toISOString(),
        });
      } else {
        await uploadDocument({
          candidateId,
          documentTypeId: type.id,
          file: null,
          isPhysicallyAvailable: true,
        });
      }
      await onRefresh();
    } catch {
      showToast(`${type.name} işaretlenemedi`, "error");
    } finally {
      setSaving(false);
    }
  };

  const setUnavailable = async () => {
    if (!canManageDocuments) return;
    if (notApplicable) return;
    if (saving || !isAvailable) return;
    if (!upload) return;
    setSaving(true);
    try {
      if (upload.hasFile) {
        await updateCandidateDocument(candidateId, upload.id, {
          isPhysicallyAvailable: false,
        });
      } else {
        await deleteCandidateDocument(candidateId, upload.id);
      }
      await onRefresh();
    } catch {
      showToast(`${type.name} güncellenemedi`, "error");
    } finally {
      setSaving(false);
    }
  };

  const deliveredAt = isAvailable && upload?.uploadedAtUtc ? formatDateTR(upload.uploadedAtUtc) : "—";
  const itemClass = `candidate-detail-doc-hero-item${notApplicable ? " is-not-applicable" : ""}`;

  return (
    <div
      className={itemClass}
      tabIndex={notApplicable ? 0 : undefined}
      title={notApplicable ? t("candidateDetail.documents.hero.existingLicenseHint") : undefined}
    >
      {notApplicable ? (
        <span className="candidate-detail-doc-hero-tooltip" role="tooltip">
          {t("candidateDetail.documents.hero.existingLicenseHint")}
        </span>
      ) : null}
      <div className="candidate-detail-doc-hero-head">
        <div className="candidate-detail-doc-hero-title">{type.name}</div>
        <div className="candidate-detail-doc-hero-date">
          <span>{t("candidateDetail.documents.hero.deliveryDate")}</span>
          <strong>{deliveredAt}</strong>
        </div>
      </div>
      <button
        type="button"
        className={`candidate-detail-doc-hero-switch${isAvailable ? " on" : " off"}`}
        role="switch"
        aria-checked={isAvailable}
        aria-label={notApplicable ? t("candidateDetail.documents.hero.notApplicableAria", { type: type.name }) : t("candidateDetail.documents.hero.statusAria", { type: type.name })}
        disabled={saving || notApplicable || !canManageDocuments}
        onClick={isAvailable ? setUnavailable : setAvailable}
        title={
          !canManageDocuments
            ? noPermissionTitle
            : notApplicable
              ? t("candidateDetail.documents.hero.existingLicenseHint")
              : undefined
        }
      >
        <span className="candidate-detail-doc-hero-switch-track-label">
          {isAvailable ? t("candidateDetail.license.hasIt") : t("candidateDetail.license.noneIt")}
        </span>
        <span className="candidate-detail-doc-hero-switch-thumb" aria-hidden="true" />
      </button>
    </div>
  );
}

function HealthReportExtraFields({
  canManageDocuments,
  candidateId,
  documentTypeId,
  upload,
  onRefresh,
}: {
  canManageDocuments: boolean;
  candidateId: string;
  documentTypeId: string;
  upload: DocumentResponse | null;
  onRefresh: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const t = useT();
  const noPermissionTitle = t("common.noPermission");
  const [saving, setSaving] = useState(false);

  const meta = upload?.metadata ?? {};
  const foreignLanguage = (meta[HEALTH_REPORT_META_KEYS.foreignLanguage] ?? "") as string;
  const disability = (meta[HEALTH_REPORT_META_KEYS.disability] ?? "none") as string;
  const needsTranslator = meta[HEALTH_REPORT_META_KEYS.needsTranslator] === "yes";
  const needsSignLanguageTranslator =
    meta[HEALTH_REPORT_META_KEYS.needsSignLanguageTranslator] === "yes";

  const storedDisability = meta[HEALTH_REPORT_META_KEYS.disability];

  const persist = async (nextMetadata: Record<string, string>) => {
    if (!canManageDocuments) return;
    if (saving) return;
    setSaving(true);
    try {
      const merged: Record<string, string> = {};
      for (const [key, value] of Object.entries(meta)) {
        if (value != null && value !== "") merged[key] = String(value);
      }
      for (const [key, value] of Object.entries(nextMetadata)) {
        if (value === "") delete merged[key];
        else merged[key] = value;
      }
      if (upload) {
        await updateCandidateDocument(candidateId, upload.id, { metadata: merged });
      } else {
        await uploadDocument({
          candidateId,
          documentTypeId,
          file: null,
          isPhysicallyAvailable: true,
          metadata: merged,
        });
      }
      await onRefresh();
    } catch {
      showToast(t("candidateDetail.documents.healthReport.toast.saveFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!upload) return;
    if (storedDisability != null && storedDisability !== "") return;
    void persist({ [HEALTH_REPORT_META_KEYS.disability]: "none" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upload?.id, storedDisability]);

  return (
    <div className="candidate-detail-doc-health-extras">
      <div className="candidate-detail-doc-health-extras-grid">
        <label className="candidate-detail-doc-metadata-field">
          <span>{t("candidateDetail.documents.healthReport.languageLabel")}</span>
          <CustomSelect
            aria-label={t("candidateDetail.documents.healthReport.languageLabel")}
            className="form-select"
            disabled={saving || !canManageDocuments}
            onChange={(event) =>
              persist({ [HEALTH_REPORT_META_KEYS.foreignLanguage]: event.target.value })
            }
            title={!canManageDocuments ? noPermissionTitle : undefined}
            value={foreignLanguage}
          >
            <option value="">{t("candidateDetail.documents.healthReport.selectPlaceholder")}</option>
            {HEALTH_REPORT_FOREIGN_LANGUAGES.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </CustomSelect>
        </label>
        <label className="candidate-detail-doc-metadata-field">
          <span>{t("candidateDetail.documents.healthReport.disabilityLabel")}</span>
          <CustomSelect
            aria-label={t("candidateDetail.documents.healthReport.disabilityLabel")}
            className="form-select"
            disabled={saving || !canManageDocuments}
            onChange={(event) =>
              persist({ [HEALTH_REPORT_META_KEYS.disability]: event.target.value })
            }
            title={!canManageDocuments ? noPermissionTitle : undefined}
            value={disability}
          >
            <option value="">{t("candidateDetail.documents.healthReport.selectPlaceholder")}</option>
            {HEALTH_REPORT_DISABILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </CustomSelect>
        </label>
      </div>
      <label className="candidate-detail-doc-health-toggle">
        <span>{t("candidateDetail.documents.healthReport.translatorNeed")}</span>
        <span className="switch-toggle">
          <input
            checked={needsTranslator}
            disabled={saving || !canManageDocuments}
            onChange={(event) =>
              persist({
                [HEALTH_REPORT_META_KEYS.needsTranslator]: event.target.checked ? "yes" : "no",
              })
            }
            type="checkbox"
          />
          <span className="switch-toggle-control" aria-hidden="true" />
        </span>
      </label>
      <label className="candidate-detail-doc-health-toggle">
        <span>{t("candidateDetail.documents.healthReport.signLanguageNeed")}</span>
        <span className="switch-toggle">
          <input
            checked={needsSignLanguageTranslator}
            disabled={saving || !canManageDocuments}
            onChange={(event) =>
              persist({
                [HEALTH_REPORT_META_KEYS.needsSignLanguageTranslator]: event.target.checked
                  ? "yes"
                  : "no",
              })
            }
            type="checkbox"
          />
          <span className="switch-toggle-control" aria-hidden="true" />
        </span>
      </label>
    </div>
  );
}

function DocLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="doc-lightbox-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        aria-label="Kapat"
        className="doc-lightbox-close"
        onClick={onClose}
        type="button"
      >
        ×
      </button>
      <img alt={alt} className="doc-lightbox-image" src={src} />
    </div>,
    document.body
  );
}

function StateChip({
  on,
  onLabel,
  offLabel,
}: {
  on: boolean;
  onLabel: string;
  offLabel: string;
}) {
  return (
    <span className={`candidate-detail-doc-state-chip${on ? " on" : " off"}`}>
      <span className="candidate-detail-doc-state-chip-icon" aria-hidden="true">
        {on ? "✓" : "✕"}
      </span>
      <span>{on ? onLabel : offLabel}</span>
    </span>
  );
}

type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type UploadPopoverPosition = {
  left: number;
  top: number;
  width: number;
};

type CropDragMode = "move" | "nw" | "ne" | "sw" | "se";

const MIN_CROP_SIZE = 12;
const UPLOAD_POPOVER_MARGIN = 12;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function defaultCropRect(): CropRect {
  return { x: 10, y: 10, width: 80, height: 80 };
}

function createCapturedFileName(): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "");
  return `evrak-${stamp}.jpg`;
}

function toJpegFileName(fileName: string): string {
  const baseName = fileName.replace(/\.[^.]+$/, "").trim() || "evrak";
  return `${baseName}.jpg`;
}

function drawVideoFrameToFile(video: HTMLVideoElement): Promise<File> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (width <= 0 || height <= 0) {
    return Promise.reject(new Error("camera-frame-not-ready"));
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return Promise.reject(new Error("canvas-not-supported"));
  context.drawImage(video, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("capture-failed"));
          return;
        }
        resolve(new File([blob], createCapturedFileName(), { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  });
}

function cropImageFile(file: File, image: HTMLImageElement, crop: CropRect): Promise<File> {
  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;
  const sourceX = Math.round((crop.x / 100) * naturalWidth);
  const sourceY = Math.round((crop.y / 100) * naturalHeight);
  const sourceWidth = Math.round((crop.width / 100) * naturalWidth);
  const sourceHeight = Math.round((crop.height / 100) * naturalHeight);
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return Promise.reject(new Error("invalid-crop"));
  }

  const canvas = document.createElement("canvas");
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  const context = canvas.getContext("2d");
  if (!context) return Promise.reject(new Error("canvas-not-supported"));
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("crop-failed"));
          return;
        }
        resolve(new File([blob], toJpegFileName(file.name), { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  });
}

function isCropSupportedUpload(file: File): boolean {
  return file.type === "image/jpeg" || file.type === "image/png";
}

function CandidateDocumentUploadPopover({
  anchorRef,
  busy,
  initialFile,
  initialSource,
  inputId,
  onClose,
  onRequestScanner,
  onUpload,
  open,
  uploading,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  busy: boolean;
  initialFile?: File | null;
  initialSource?: "camera" | "scanner" | "file";
  inputId: string;
  onClose: () => void;
  onRequestScanner: () => void;
  onUpload: (file: File) => Promise<void>;
  open: boolean;
  uploading: boolean;
}) {
  const t = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cropViewportRef = useRef<HTMLDivElement>(null);
  const cropImageRef = useRef<HTMLImageElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dragRef = useRef<{
    mode: CropDragMode;
    startX: number;
    startY: number;
    startCrop: CropRect;
  } | null>(null);
  const [mode, setMode] = useState<"menu" | "camera" | "crop">("menu");
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [captureSource, setCaptureSource] = useState<"camera" | "scanner" | "file">("camera");
  const [crop, setCrop] = useState<CropRect>(() => defaultCropRect());
  const [cropSaving, setCropSaving] = useState(false);
  const [position, setPosition] = useState<UploadPopoverPosition | null>(null);

  const stopCamera = () => {
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const clearCapture = () => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    setCapturedFile(null);
    setCrop(defaultCropRect());
  };

  const closeAll = () => {
    stopCamera();
    clearCapture();
    setMode("menu");
    setCameraError(null);
    onClose();
  };

  const startCamera = async (facing: "environment" | "user" = cameraFacing) => {
    setMode("camera");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Bu cihazda kamera desteklenmiyor.");
      return;
    }
    stopCamera();
    clearCapture();
    setCameraLoading(true);
    setCameraError(null);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      stopCamera();
      setCameraError(t("candidateDetail.documents.upload.cameraError"));
    } finally {
      setCameraLoading(false);
    }
  };

  const openCropForFile = (file: File, source: "camera" | "scanner" | "file") => {
    stopCamera();
    clearCapture();
    const url = URL.createObjectURL(file);
    setCapturedFile(file);
    setCapturedUrl(url);
    setCaptureSource(source);
    setCrop(defaultCropRect());
    setMode("crop");
  };

  const handleSelectedFile = async (
    file: File,
    source: "camera" | "scanner" | "file" = "file",
  ): Promise<boolean> => {
    if (!isCropSupportedUpload(file)) {
      await onUpload(file);
      return true;
    }
    openCropForFile(file, source);
    return false;
  };

  const updatePosition = () => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const preferredWidth = mode === "menu" ? 300 : 460;
    const width = Math.min(preferredWidth, viewportWidth - UPLOAD_POPOVER_MARGIN * 2);
    const estimatedHeight = mode === "menu" ? 132 : 500;
    const left = clampNumber(
      rect.right - width,
      UPLOAD_POPOVER_MARGIN,
      Math.max(UPLOAD_POPOVER_MARGIN, viewportWidth - width - UPLOAD_POPOVER_MARGIN),
    );
    const belowTop = rect.bottom + 8;
    const aboveTop = rect.top - estimatedHeight - 8;
    const top =
      belowTop + estimatedHeight <= viewportHeight - UPLOAD_POPOVER_MARGIN
        ? belowTop
        : clampNumber(aboveTop, UPLOAD_POPOVER_MARGIN, Math.max(UPLOAD_POPOVER_MARGIN, viewportHeight - estimatedHeight - UPLOAD_POPOVER_MARGIN));
    setPosition({ left, top, width });
  };

  useEffect(() => {
    if (!open) {
      stopCamera();
      clearCapture();
      setMode("menu");
      setCameraError(null);
      return;
    }

    const handlePointerDown = (event: globalThis.MouseEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      if (target && anchorRef.current?.contains(target)) return;
      closeAll();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAll();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    updatePosition();
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, capturedUrl, mode]);

  useEffect(() => {
    if (!open || !initialFile) return;
    void handleSelectedFile(initialFile, initialSource ?? "file");
  }, [initialFile, initialSource, open]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    };
  }, [capturedUrl]);

  const handleCapture = async () => {
    if (!videoRef.current) return;
    try {
      const file = await drawVideoFrameToFile(videoRef.current);
      const url = URL.createObjectURL(file);
      stopCamera();
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
      setCapturedFile(file);
      setCapturedUrl(url);
      setCaptureSource("camera");
      setCrop(defaultCropRect());
      setMode("crop");
    } catch {
      setCameraError(t("candidateDetail.documents.upload.photoError"));
    }
  };

  const switchCamera = () => {
    const next = cameraFacing === "environment" ? "user" : "environment";
    setCameraFacing(next);
    void startCamera(next);
  };

  const retryCamera = () => {
    if (captureSource === "scanner") {
      clearCapture();
      setMode("menu");
      onRequestScanner();
      return;
    }

    clearCapture();
    void startCamera(cameraFacing);
  };

  const handleCropPointerDown = (
    event: ReactPointerEvent<HTMLElement>,
    dragMode: CropDragMode,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      mode: dragMode,
      startX: event.clientX,
      startY: event.clientY,
      startCrop: crop,
    };
  };

  const handleCropPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const viewport = cropViewportRef.current;
    if (!drag || !viewport) return;
    const rect = viewport.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dx = ((event.clientX - drag.startX) / rect.width) * 100;
    const dy = ((event.clientY - drag.startY) / rect.height) * 100;
    const start = drag.startCrop;
    let next = { ...start };

    if (drag.mode === "move") {
      next.x = clampNumber(start.x + dx, 0, 100 - start.width);
      next.y = clampNumber(start.y + dy, 0, 100 - start.height);
    } else {
      const left = start.x;
      const top = start.y;
      const right = start.x + start.width;
      const bottom = start.y + start.height;
      const nextLeft = drag.mode.includes("w") ? clampNumber(left + dx, 0, right - MIN_CROP_SIZE) : left;
      const nextRight = drag.mode.includes("e") ? clampNumber(right + dx, left + MIN_CROP_SIZE, 100) : right;
      const nextTop = drag.mode.includes("n") ? clampNumber(top + dy, 0, bottom - MIN_CROP_SIZE) : top;
      const nextBottom = drag.mode.includes("s") ? clampNumber(bottom + dy, top + MIN_CROP_SIZE, 100) : bottom;
      next = {
        x: nextLeft,
        y: nextTop,
        width: nextRight - nextLeft,
        height: nextBottom - nextTop,
      };
    }
    setCrop(next);
  };

  const handleCropPointerUp = () => {
    dragRef.current = null;
  };

  const uploadCropped = async () => {
    if (!capturedFile || !cropImageRef.current || cropSaving) return;
    setCropSaving(true);
    try {
      const file = await cropImageFile(capturedFile, cropImageRef.current, crop);
      await onUpload(file);
      closeAll();
    } finally {
      setCropSaving(false);
    }
  };

  if (!open || !position) return null;

  return createPortal(
    <div
      className={`candidate-doc-upload-popover mode-${mode}`}
      ref={rootRef}
      role="dialog"
      aria-label={t("candidateDetail.documents.upload.triggerAria")}
      style={{ left: position.left, top: position.top, width: position.width }}
    >
      <input
        accept="application/pdf,image/jpeg,image/png"
        disabled={busy}
        hidden
        id={inputId}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (file) {
            const uploaded = await handleSelectedFile(file);
            if (uploaded) closeAll();
          }
          event.target.value = "";
        }}
        type="file"
      />
      {mode === "menu" ? (
        <>
          <div className="candidate-doc-upload-popover-head">
            <div>
              <div className="candidate-doc-upload-popover-title">{t("candidateDetail.documents.upload.title")}</div>
              <div className="candidate-doc-upload-popover-subtitle">{t("candidateDetail.documents.upload.subtitle")}</div>
            </div>
            <button aria-label="Kapat" className="candidate-doc-upload-popover-close" onClick={closeAll} type="button">
              ×
            </button>
          </div>
          <div className="candidate-doc-upload-popover-actions">
            <button
              className={`candidate-doc-upload-option${busy ? " is-disabled" : ""}`}
              disabled={busy}
              onClick={() => document.getElementById(inputId)?.click()}
              type="button"
            >
              <span className="candidate-doc-upload-option-icon" aria-hidden="true">
                <UploadCloudIcon size={15} />
              </span>
              <span>
                <strong>{t("candidateDetail.documents.upload.fileSelect")}</strong>
                <small>{t("candidateDetail.documents.upload.fileTypes")}</small>
              </span>
            </button>
            <button
              className="candidate-doc-upload-option"
              disabled={busy}
              onClick={onRequestScanner}
              type="button"
            >
              <span className="candidate-doc-upload-option-icon" aria-hidden="true">
                <ScannerIcon size={15} />
              </span>
              <span>
                <strong>{t("candidateDetail.documents.upload.scanner")}</strong>
                <small>{t("candidateDetail.documents.upload.scannerHint")}</small>
              </span>
            </button>
            <button
              className="candidate-doc-upload-option"
              disabled={busy}
              onClick={() => void startCamera("environment")}
              type="button"
            >
              <span className="candidate-doc-upload-option-icon" aria-hidden="true">
                <CameraIcon size={15} />
              </span>
              <span>
                <strong>{t("candidateDetail.documents.upload.camera")}</strong>
                <small>{t("candidateDetail.documents.upload.cameraHint")}</small>
              </span>
            </button>
          </div>
        </>
      ) : null}

      {mode === "camera" ? (
        <div className="candidate-doc-camera-panel">
          <div className="candidate-doc-upload-popover-head">
            <div className="candidate-doc-upload-popover-title">{t("candidateDetail.documents.upload.camera")}</div>
            <button aria-label="Kapat" className="candidate-doc-upload-popover-close" onClick={closeAll} type="button">
              ×
            </button>
          </div>
          <div className="candidate-doc-camera-frame">
            {cameraLoading ? <span>{t("candidateDetail.documents.upload.cameraLoading")}</span> : null}
            {cameraError ? <span>{cameraError}</span> : null}
            <video
              autoPlay
              muted
              playsInline
              ref={videoRef}
              className={cameraError || cameraLoading ? "is-hidden" : ""}
            />
          </div>
          <div className="candidate-doc-camera-actions">
            <button className="btn btn-secondary btn-sm" onClick={switchCamera} type="button">
              Kamera Değiştir
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={cameraLoading || Boolean(cameraError)}
              onClick={handleCapture}
              type="button"
            >
              Çek
            </button>
            <button className="btn btn-secondary btn-sm" onClick={closeAll} type="button">
              İptal
            </button>
          </div>
        </div>
      ) : null}

      {mode === "crop" && capturedUrl ? (
        <div className="candidate-doc-crop-panel">
          <div className="candidate-doc-upload-popover-head">
            <div>
              <div className="candidate-doc-upload-popover-title">{t("candidateDetail.documents.upload.cropTitle")}</div>
              <div className="candidate-doc-upload-popover-subtitle">{t("candidateDetail.documents.upload.cropSubtitle")}</div>
            </div>
            <button aria-label="Kapat" className="candidate-doc-upload-popover-close" onClick={closeAll} type="button">
              ×
            </button>
          </div>
          <div
            className="candidate-doc-crop-stage"
            onPointerMove={handleCropPointerMove}
            onPointerUp={handleCropPointerUp}
            onPointerCancel={handleCropPointerUp}
          >
            <div className="candidate-doc-crop-viewport" ref={cropViewportRef}>
              <img alt={t("candidateDetail.documents.upload.capturedAlt")} ref={cropImageRef} src={capturedUrl} />
              <div
                className="candidate-doc-crop-box"
                onPointerDown={(event) => handleCropPointerDown(event, "move")}
                style={{
                  left: `${crop.x}%`,
                  top: `${crop.y}%`,
                  width: `${crop.width}%`,
                  height: `${crop.height}%`,
                }}
              >
                {(["nw", "ne", "sw", "se"] as CropDragMode[]).map((handle) => (
                  <span
                    className={`candidate-doc-crop-handle ${handle}`}
                    key={handle}
                    onPointerDown={(event) => handleCropPointerDown(event, handle)}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="candidate-doc-camera-actions">
            <button className="btn btn-secondary btn-sm" onClick={retryCamera} type="button">
              {captureSource === "scanner" ? "Yeniden Tara" : "Tekrar Çek"}
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={cropSaving || uploading}
              onClick={() => void uploadCropped()}
              type="button"
            >
              {cropSaving || uploading ? t("candidateDetail.documents.loading") : t("candidateDetail.documents.upload.cropAndUpload")}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={closeAll} type="button">
              İptal
            </button>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

function CandidateDocumentOcrReviewModal({
  fields,
  onApply,
  onClose,
  saving,
  suggestion,
  typeName,
  values,
}: {
  fields: DocumentMetadataField[];
  onApply: (values: Record<string, string>) => Promise<void>;
  onClose: () => void;
  saving: boolean;
  suggestion: CandidateDocumentOcrSuggestionResponse;
  typeName: string;
  values: Record<string, string>;
}) {
  const t = useT();
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    const next = { ...values };
    for (const [key, value] of Object.entries(suggestion.metadata ?? {})) {
      if (value != null && String(value).trim() !== "") {
        next[key] = String(value);
      }
    }
    setDraft(next);
  }, [suggestion, values]);

  const setDraftValue = (key: string, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const confidenceLabel =
    suggestion.confidence != null ? `%${Math.round(suggestion.confidence * 100)}` : t("candidateDetail.documents.ocr.confidenceUnknown");
  const hasSuggestions = Object.values(suggestion.metadata ?? {}).some(
    (value) => value != null && String(value).trim() !== ""
  );

  return (
    <Modal
      footer={
        <>
          <button className="btn btn-secondary" disabled={saving} onClick={onClose} type="button">
            {t("common.cancel")}
          </button>
          <button
            className="btn btn-primary"
            disabled={saving || fields.length === 0}
            onClick={() => void onApply(draft)}
            type="button"
          >
            {saving ? t("candidateDetail.documents.ocr.applying") : t("candidateDetail.documents.ocr.apply")}
          </button>
        </>
      }
      onClose={onClose}
      open
      title={`${typeName} OCR`}
    >
      <div className="candidate-doc-ocr-review">
        <div className="candidate-doc-ocr-summary">
          <span>{t("candidateDetail.documents.ocr.confidence")}</span>
          <strong>{confidenceLabel}</strong>
        </div>
        {!hasSuggestions ? (
          <div className="candidate-doc-ocr-empty">
            {t("candidateDetail.documents.ocr.empty")}
          </div>
        ) : null}
        {suggestion.warnings.length > 0 ? (
          <ul className="candidate-doc-ocr-warnings">
            {suggestion.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
        <div className="candidate-doc-ocr-fields">
          {fields.map((field) => {
            const value = draft[field.key] ?? "";
            const suggested = suggestion.metadata?.[field.key];
            return (
              <label className="candidate-detail-doc-metadata-field" key={field.key}>
                <span>
                  {field.label}
                  {suggested ? <em className="candidate-doc-ocr-suggested">OCR</em> : null}
                </span>
                {field.inputType === "date" ? (
                  <LocalizedDateInput
                    ariaLabel={field.label}
                    className="form-input"
                    lang="tr-TR"
                    onChange={(next) => setDraftValue(field.key, next)}
                    placeholder={field.placeholder ?? ""}
                    size="sm"
                    value={value}
                  />
                ) : field.inputType === "select" ? (
                  <CustomSelect
                    aria-label={field.label}
                    className="form-select"
                    onChange={(event) => setDraftValue(field.key, event.target.value)}
                    value={value}
                  >
                    <option value="">{field.placeholder ?? t("candidateDetail.documents.healthReport.selectPlaceholder")}</option>
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </CustomSelect>
                ) : (
                  <input
                    aria-label={field.label}
                    className="form-input"
                    onChange={(event) => setDraftValue(field.key, event.target.value)}
                    placeholder={field.placeholder ?? ""}
                    type="text"
                    value={value}
                  />
                )}
              </label>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

function DocRow({
  canManageDocuments,
  candidateId,
  defaultMetadataValues,
  type,
  upload,
  onRefresh,
}: {
  canManageDocuments: boolean;
  candidateId: string;
  defaultMetadataValues?: Record<string, string>;
  type: DocumentTypeResponse;
  upload: DocumentResponse | null;
  onRefresh: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const t = useT();
  const noPermissionTitle = t("common.noPermission");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [markingPhysical, setMarkingPhysical] = useState(false);
  const [markingMebbis, setMarkingMebbis] = useState(false);
  const [metadataSaving, setMetadataSaving] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrSuggestion, setOcrSuggestion] = useState<CandidateDocumentOcrSuggestionResponse | null>(null);
  const [metadataValues, setMetadataValues] = useState<Record<string, string>>({});
  const [metadataErrors, setMetadataErrors] = useState<Record<string, string>>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [uploadPopoverOpen, setUploadPopoverOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedFile, setScannedFile] = useState<File | null>(null);
  const uploadTriggerRef = useRef<HTMLButtonElement>(null);

  const metadataFields = useMemo(
    () =>
      type.key === "health_report"
        ? (type.metadataFields ?? []).filter((field) => !HEALTH_REPORT_EXTRA_KEYS.has(field.key))
        : type.metadataFields ?? [],
    [type.key, type.metadataFields]
  );
  const status = getCandidateDocumentStatus(upload);
  const fileSize = upload?.fileSizeBytes != null ? formatFileSize(upload.fileSizeBytes) : null;
  const uploadedDate = upload?.uploadedAtUtc && status !== "missing" ? formatDateTR(upload.uploadedAtUtc) : null;
  const isPhotoType = isPhotoDocumentType(type);
  const isContractType = isContractDocumentType(type);
  const isSignatureType = isSignatureDocumentType(type);
  const isA4Type = isA4DocumentType(type);
  const showsImagePreview = isPhotoType || isContractType || isSignatureType || isA4Type;
  const isPrintableType = isPrintableDocumentType(type);
  const isMebbisTransferred = upload?.isMebbisTransferred ?? false;
  const fileUrl = upload?.hasFile ? getCandidateDocumentDownloadUrl(candidateId, upload.id) : null;
  const inlineFileUrl = upload?.hasFile
    ? getCandidateDocumentDownloadUrl(candidateId, upload.id, { inline: true })
    : null;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    setMetadataValues(buildDocumentMetadataValues(metadataFields, upload, defaultMetadataValues));
    setMetadataErrors({});
  }, [defaultMetadataValues, metadataFields, upload]);

  useEffect(() => {
    if (!showsImagePreview || !isPreviewableImage(upload) || !fileUrl) {
      setPreviewUrl(null);
      return;
    }

    const controller = new AbortController();
    let objectUrl: string | null = null;
    createAuthorizedObjectUrl(fileUrl, controller.signal)
      .then((url) => {
        objectUrl = url;
        if (!controller.signal.aborted) setPreviewUrl(url);
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setPreviewUrl(null);
        }
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setPreviewUrl(null);
    };
  }, [fileUrl, showsImagePreview, upload]);

  const setMetadataValue = (key: string, value: string) => {
    setMetadataValues((current) => ({ ...current, [key]: value }));
    if (metadataErrors[key]) {
      setMetadataErrors((current) => {
        const { [key]: _, ...rest } = current;
        return rest;
      });
    }
  };

  const buildMetadataPayload = (): Record<string, string> => {
    const payload: Record<string, string> = {};
    for (const field of metadataFields) {
      const value = (metadataValues[field.key] ?? "").trim();
      if (value) payload[field.key] = value;
    }
    return payload;
  };

  const validateMetadata = (source?: Record<string, string>): boolean => {
    const values = source ?? metadataValues;
    const nextErrors: Record<string, string> = {};
    for (const field of metadataFields) {
      const value = (values[field.key] ?? "").trim();
      if (field.isRequired && !value) {
        nextErrors[field.key] = `${field.label} gerekli`;
      }
    }
    setMetadataErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleUpload = async (file: File): Promise<boolean> => {
    if (!canManageDocuments) return false;
    if (uploading) return false;
    setUploading(true);
    try {
      await uploadDocument({
        candidateId,
        documentTypeId: type.id,
        file,
        metadata: buildMetadataPayload(),
      });
      await onRefresh();
      showToast(t("candidateDetail.documents.row.toast.uploaded", { name: type.name }));
      return true;
    } catch {
      showToast(t("candidateDetail.documents.row.toast.uploadFailed", { name: type.name }), "error");
      return false;
    } finally {
      setUploading(false);
    }
  };

  const handleMarkPhysical = async () => {
    if (!canManageDocuments) return;
    if (markingPhysical) return;
    setMarkingPhysical(true);
    try {
      await uploadDocument({
        candidateId,
        documentTypeId: type.id,
        file: null,
        isPhysicallyAvailable: true,
        metadata: buildMetadataPayload(),
      });
      await onRefresh();
      showToast(t("candidateDetail.documents.row.toast.physicalMarked", { name: type.name }));
    } catch {
      showToast(t("candidateDetail.documents.row.toast.markFailed", { name: type.name }), "error");
    } finally {
      setMarkingPhysical(false);
    }
  };

  const handleMarkMissing = async () => {
    if (!canManageDocuments) return;
    if (!upload || deleting) return;
    setDeleting(true);
    try {
      await deleteCandidateDocument(candidateId, upload.id);
      await onRefresh();
      showToast(t("candidateDetail.documents.row.toast.markedMissing", { name: type.name }));
      setConfirmingDelete(false);
    } catch {
      showToast(t("candidateDetail.documents.row.toast.updateFailed", { name: type.name }), "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleDelete = async () => {
    if (!canManageDocuments) return;
    if (!upload || deleting) return;
    setDeleting(true);
    try {
      await deleteCandidateDocument(candidateId, upload.id);
      await onRefresh();
      showToast(`"${type.name}" silindi`);
      setConfirmingDelete(false);
    } catch {
      showToast(`"${type.name}" silinemedi`, "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleMebbisToggle = async (checked: boolean) => {
    if (!canManageDocuments) return;
    if (markingMebbis || checked === isMebbisTransferred) return;
    setMarkingMebbis(true);
    try {
      await updateCandidateDocumentMebbisTransfer(candidateId, type.id, checked);
      await onRefresh();
      showToast(checked ? t("candidateDetail.documents.row.toast.mebbisMarked", { name: type.name }) : t("candidateDetail.documents.row.toast.mebbisRemoved", { name: type.name }));
    } catch {
      showToast(`"${type.name}" Mebbis durumu kaydedilemedi`, "error");
    } finally {
      setMarkingMebbis(false);
    }
  };

  const handleDownloadFile = async () => {
    if (!fileUrl) return;
    try {
      await downloadAuthorizedFile(fileUrl, upload?.originalFileName ?? type.name);
    } catch {
      showToast(`"${type.name}" indirilemedi`, "error");
    }
  };

  const handlePrint = async () => {
    if (!inlineFileUrl) return;
    try {
      await printAuthorizedFile(inlineFileUrl, type.name);
    } catch {
      showToast(t("candidateDetail.documents.row.toast.printFailed", { name: type.name }), "error");
    }
  };

  const handleSaveMetadata = async (override?: Record<string, string>): Promise<boolean> => {
    if (!canManageDocuments) return false;
    if (metadataSaving) return false;
    const source = override ?? metadataValues;
    const payload: Record<string, string> = {};
    for (const field of metadataFields) {
      const value = (source[field.key] ?? "").trim();
      if (value) payload[field.key] = value;
    }
    setMetadataSaving(true);
    try {
      if (upload) {
        await updateCandidateDocument(candidateId, upload.id, { metadata: payload });
      } else {
        await uploadDocument({
          candidateId,
          documentTypeId: type.id,
          file: null,
          isPhysicallyAvailable: true,
          metadata: payload,
        });
      }
      await onRefresh();
      return true;
    } catch {
      showToast(`"${type.name}" bilgileri kaydedilemedi`, "error");
      return false;
    } finally {
      setMetadataSaving(false);
    }
  };

  const handleAnalyzeOcr = async () => {
    if (!upload?.hasFile || ocrLoading) return;
    setOcrLoading(true);
    try {
      const suggestion = await analyzeCandidateDocumentOcr(candidateId, upload.id);
      setOcrSuggestion(suggestion);
    } catch {
      showToast(t("candidateDetail.documents.row.toast.ocrReadFailed", { name: type.name }), "error");
    } finally {
      setOcrLoading(false);
    }
  };

  const handleApplyOcr = async (nextValues: Record<string, string>) => {
    if (!canManageDocuments) return;
    if (!validateMetadata(nextValues)) return;
    const saved = await handleSaveMetadata(nextValues);
    if (!saved) return;
    setMetadataValues(nextValues);
    setOcrSuggestion(null);
    showToast(t("candidateDetail.documents.row.toast.ocrApplied", { name: type.name }));
  };

  const inputId = `doc-upload-${type.id}`;
  const busy = uploading || deleting || markingPhysical || markingMebbis || metadataSaving || ocrLoading;
  const canUploadFile = status !== "uploaded";
  const canDeleteFile = !!upload?.hasFile;
  const hasDocumentAvailable = status !== "missing";
  const canAnalyzeOcr = !!upload?.hasFile && metadataFields.length > 0;

  return (
    <li className={`candidate-detail-doc-row status-${status}${showsImagePreview ? " is-photo" : ""}`}>
      <div className={`candidate-detail-doc-status-marker ${status}`} aria-hidden="true" />
      <div className="candidate-detail-doc-main">
        {showsImagePreview ? (
          <div
            className={`candidate-detail-doc-photo-preview${
              isContractType || isA4Type ? " is-a4" : ""
            }${isSignatureType ? " is-square" : ""}`}
          >
            {previewUrl ? (
              <button
                aria-label={`${type.name} büyük görüntüle`}
                className="candidate-detail-doc-photo-preview-btn"
                onClick={() => setLightboxOpen(true)}
                type="button"
              >
                <img alt={`${type.name} önizleme`} src={previewUrl} />
              </button>
            ) : status === "missing" ? (
              <span>
                {isPhotoType
                  ? t("candidateDetail.documents.row.emptyPhoto")
                  : isSignatureType
                  ? t("candidateDetail.documents.row.emptySignature")
                  : t("candidateDetail.documents.row.notUploaded")}
              </span>
            ) : status === "physical" ? (
              <span>
                {isPhotoType
                  ? t("candidateDetail.documents.row.photoOnHand")
                  : isSignatureType
                  ? t("candidateDetail.documents.row.signatureOnHand")
                  : t("candidateDetail.documents.row.documentOnHand")}
              </span>
            ) : (
              <span>{t("candidateDetail.documents.row.previewNotSupported")}</span>
            )}
          </div>
        ) : null}
        <div className="candidate-detail-doc-side">
        <div className="candidate-detail-doc-title-row">
          <div className="candidate-detail-doc-name">{type.name}</div>
          <div className="candidate-detail-doc-state-chips">
            <StateChip on={hasDocumentAvailable} onLabel="Var" offLabel="Yok" />
            <StateChip on={!!upload?.hasFile} onLabel={t("candidateDetail.documents.row.state.uploaded")} offLabel={t("candidateDetail.documents.row.state.notUploaded")} />
            <StateChip
              on={isMebbisTransferred}
              onLabel={t("candidateDetail.documents.row.state.mebbisTransferred")}
              offLabel={t("candidateDetail.documents.row.state.mebbisNotTransferred")}
            />
          </div>
          {uploadedDate ? (
            <div className="candidate-detail-doc-delivered-date">
              <span>{t("candidateDetail.documents.hero.deliveryDate")}</span>
              <strong>{uploadedDate}</strong>
            </div>
          ) : null}
        </div>
        {upload?.note ? (
          <div className="candidate-detail-doc-note">{upload.note}</div>
        ) : null}
        {!showsImagePreview ? (
          <div className="candidate-detail-doc-file">
            {status === "missing"
              ? t("candidateDetail.documents.row.markedMissing")
              : upload?.originalFileName ?? "Evrak elde var."}
          </div>
        ) : null}
        {status !== "missing" && !showsImagePreview ? (
          <div className="candidate-detail-doc-meta">
            {fileSize ? <span>{fileSize}</span> : null}
          </div>
        ) : null}
        {metadataFields.length > 0 ? (
          <div className="candidate-detail-doc-metadata-fields">
            {metadataFields.map((field) => {
              const value = metadataValues[field.key] ?? "";
              const error = metadataErrors[field.key];
              const label = field.isRequired ? `${field.label} *` : field.label;

              return (
                <label
                  className="candidate-detail-doc-metadata-field"
                  data-field-key={field.key}
                  key={field.key}
                >
                  <span>{label}</span>
                  {field.inputType === "date" ? (
                    <LocalizedDateInput
                      ariaLabel={field.label}
                      className={error ? "form-input error" : "form-input"}
                      disabled={!canManageDocuments}
                      lang="tr-TR"
                      onChange={(next) => {
                        setMetadataValue(field.key, next);
                        void handleSaveMetadata({ ...metadataValues, [field.key]: next });
                      }}
                      placeholder={field.placeholder ?? ""}
                      size="sm"
                      value={value}
                    />
                  ) : field.inputType === "select" ? (
                    <CustomSelect
                      aria-label={field.label}
                      className={error ? "form-select error" : "form-select"}
                      disabled={!canManageDocuments}
                      onChange={(event) => {
                        const next = event.target.value;
                        setMetadataValue(field.key, next);
                        void handleSaveMetadata({ ...metadataValues, [field.key]: next });
                      }}
                      value={value}
                    >
                      <option value="">{field.placeholder ?? t("candidateDetail.documents.healthReport.selectPlaceholder")}</option>
                      {field.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </CustomSelect>
                  ) : (
                    <input
                      aria-label={field.label}
                      className={error ? "form-input error" : "form-input"}
                      disabled={!canManageDocuments}
                      onBlur={(event) => {
                        const next = event.target.value;
                        if (next === (upload?.metadata?.[field.key] ?? "")) return;
                        void handleSaveMetadata({ ...metadataValues, [field.key]: next });
                      }}
                      onChange={(event) => setMetadataValue(field.key, event.target.value)}
                      placeholder={field.placeholder ?? ""}
                      type="text"
                      value={value}
                    />
                  )}
                  {error ? <em>{error}</em> : null}
                </label>
              );
            })}
          </div>
        ) : null}
        {type.key === "health_report" ? (
          <HealthReportExtraFields
            canManageDocuments={canManageDocuments}
            candidateId={candidateId}
            documentTypeId={type.id}
            upload={upload}
            onRefresh={onRefresh}
          />
        ) : null}
        </div>
      </div>
      <div className="candidate-detail-doc-actions">
        {!isMebbisTransferred ? (
          <button
            className="btn btn-sm btn-primary"
            disabled={busy || status === "missing" || !canManageDocuments}
            onClick={() => handleMebbisToggle(true)}
            title={!canManageDocuments ? noPermissionTitle : undefined}
            type="button"
          >
            {markingMebbis ? "Kaydediliyor..." : "Mebbis Aktar"}
          </button>
        ) : null}

        {fileUrl ? (
          <button
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={handleDownloadFile}
            type="button"
          >
            İndir
          </button>
        ) : null}

        {fileUrl && isPrintableType ? (
          <button
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={handlePrint}
            type="button"
          >
            Yazdır
          </button>
        ) : null}

        {canAnalyzeOcr ? (
          <button
            className="btn btn-secondary btn-sm"
            disabled={busy || !canManageDocuments}
            onClick={handleAnalyzeOcr}
            title={!canManageDocuments ? noPermissionTitle : undefined}
            type="button"
          >
            {ocrLoading ? "Okunuyor..." : "OCR"}
          </button>
        ) : null}

        {canUploadFile ? (
          <div className="candidate-detail-doc-upload-wrap">
            <button
              aria-expanded={uploadPopoverOpen}
              className="btn btn-secondary btn-sm"
              disabled={busy || !canManageDocuments}
              onClick={() => {
                if (!canManageDocuments) return;
                setUploadPopoverOpen((current) => !current);
              }}
              ref={uploadTriggerRef}
              title={!canManageDocuments ? noPermissionTitle : undefined}
              type="button"
            >
              {uploading ? t("candidateDetail.documents.loading") : t("candidateDetail.documents.row.upload")}
            </button>
            <CandidateDocumentUploadPopover
              anchorRef={uploadTriggerRef}
              busy={busy}
              initialFile={scannedFile}
              initialSource={scannedFile ? "scanner" : undefined}
              inputId={inputId}
              onClose={() => {
                setUploadPopoverOpen(false);
                setScannedFile(null);
              }}
              onRequestScanner={() => {
                setUploadPopoverOpen(false);
                setScannerOpen(true);
              }}
              onUpload={async (file) => {
                const uploaded = await handleUpload(file);
                if (!uploaded) throw new Error("upload-failed");
                setScannedFile(null);
              }}
              open={uploadPopoverOpen}
              uploading={uploading}
            />
            <DocumentScannerModal
              onClose={() => setScannerOpen(false)}
              onScanned={(file) => {
                setScannedFile(file);
                setScannerOpen(false);
                setUploadPopoverOpen(true);
              }}
              open={scannerOpen}
            />
          </div>
        ) : null}

        <button
          type="button"
          className={`candidate-detail-doc-hero-switch${hasDocumentAvailable ? " on" : " off"}`}
          role="switch"
          aria-checked={hasDocumentAvailable}
          aria-label={`${type.name} var yok durumu`}
          disabled={busy || upload?.hasFile || !canManageDocuments}
          onClick={hasDocumentAvailable ? handleMarkMissing : handleMarkPhysical}
          title={!canManageDocuments ? noPermissionTitle : undefined}
        >
          <span className="candidate-detail-doc-hero-switch-track-label">
            {hasDocumentAvailable ? "Var" : "Yok"}
          </span>
          <span className="candidate-detail-doc-hero-switch-thumb" aria-hidden="true" />
        </button>

        {canDeleteFile ? (
          confirmingDelete ? (
            <div className="candidate-detail-doc-confirm">
              <span>{t("candidateDetail.documents.row.deleteConfirm")}</span>
              <button
                className="btn btn-danger btn-sm"
                disabled={busy || !canManageDocuments}
                onClick={handleDelete}
                title={!canManageDocuments ? noPermissionTitle : undefined}
                type="button"
              >
                {deleting ? "Siliniyor..." : "Evet"}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() => setConfirmingDelete(false)}
                type="button"
              >
                Vazgeç
              </button>
            </div>
          ) : (
            <button
              className="btn btn-danger btn-sm"
              disabled={busy || !canManageDocuments}
              onClick={() => {
                if (!canManageDocuments) return;
                setConfirmingDelete(true);
              }}
              title={!canManageDocuments ? noPermissionTitle : undefined}
              type="button"
            >
              Sil
            </button>
          )
        ) : null}
      </div>
      {previewUrl && lightboxOpen ? (
        <DocLightbox
          alt={type.name}
          onClose={() => setLightboxOpen(false)}
          src={previewUrl}
        />
      ) : null}
      {ocrSuggestion ? (
        <CandidateDocumentOcrReviewModal
          fields={metadataFields}
          onApply={handleApplyOcr}
          onClose={() => setOcrSuggestion(null)}
          saving={metadataSaving}
          suggestion={ocrSuggestion}
          typeName={type.name}
          values={metadataValues}
        />
      ) : null}
    </li>
  );
}

function TrainingTab({
  candidate,
  canManageTraining,
}: {
  candidate: CandidateResponse;
  canManageTraining: boolean;
}) {
  const navigate = useNavigate();
  const t = useT();
  const noPermissionTitle = t("common.noPermission");
  const [calendarEvents, setCalendarEvents] = useState<TrainingCalendarEvent[]>([]);
  const [calendarBranches, setCalendarBranches] = useState<TrainingBranchDefinitionResponse[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const branchHelpers = useMemo(
    () => buildBranchHelpers(calendarBranches),
    [calendarBranches]
  );
  const calendarFocusDate = useMemo(() => {
    const dateIso =
      candidate.mebExamDate ??
      candidate.drivingExamDate ??
      candidate.currentGroup?.startDate ??
      null;
    return dateIso ? dateOnlyAt(dateIso, 9) : null;
  }, [candidate.currentGroup?.startDate, candidate.drivingExamDate, candidate.mebExamDate]);

  useEffect(() => {
    const controller = new AbortController();
    const now = new Date();
    const from = addDays(now, -90);
    from.setHours(0, 0, 0, 0);
    const to = addDays(now, 180);
    to.setHours(23, 59, 59, 999);

    setCalendarLoading(true);
    setCalendarError(null);

    Promise.all([
      getTrainingLessons(
        {
          kind: "uygulama",
          candidateId: candidate.id,
          fromUtc: from.toISOString(),
          toUtc: to.toISOString(),
        },
        controller.signal
      ),
      candidate.currentGroup?.groupId
        ? getTrainingLessons(
            {
              kind: "teorik",
              groupId: candidate.currentGroup.groupId,
              fromUtc: from.toISOString(),
              toUtc: to.toISOString(),
            },
            controller.signal
          )
        : Promise.resolve({ items: [] }),
      getTrainingBranchDefinitions(
        { activity: "active", page: 1, pageSize: 100 },
        controller.signal
      ),
    ])
      .then(([practiceResult, theoryResult, branchResult]) => {
        const lessonEvents = [
          ...practiceResult.items,
          ...theoryResult.items,
        ].map(trainingLessonToCalendarEvent);
        setCalendarEvents([
          ...lessonEvents,
          ...buildCandidateExamEvents(candidate, t),
        ]);
        setCalendarBranches(branchResult.items);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setCalendarError(t("candidateDetail.training.loadError"));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCalendarLoading(false);
        }
      });

    return () => controller.abort();
  }, [
    candidate.id,
    candidate.firstName,
    candidate.lastName,
    candidate.licenseClass,
    candidate.currentGroup?.groupId,
    candidate.currentGroup?.term?.name,
    candidate.mebExamDate,
    candidate.drivingExamDate,
  ]);

  return (
    <div className="candidate-detail-tab-content candidate-detail-training-layout">
      <section className="instructor-detail-card candidate-detail-calendar-card">
        <div className="instructor-detail-section-header">
          <h3 className="candidate-detail-section-title">{t("candidateDetail.training.title")}</h3>
          <button
            className="btn btn-primary btn-sm"
            disabled={!canManageTraining}
            onClick={() => {
              if (!canManageTraining) return;
              navigate(`/training/uygulama?assignCandidateId=${encodeURIComponent(candidate.id)}`);
            }}
            title={!canManageTraining ? noPermissionTitle : undefined}
            type="button"
          >
            {t("candidateDetail.training.scheduleDriving")}
          </button>
        </div>
        {calendarError ? (
          <div className="instructor-detail-error">{calendarError}</div>
        ) : (
          <>
            <div className="form-subsection-note" style={{ marginBottom: 10 }}>
              {t("candidateDetail.training.hint")}
            </div>
            {calendarLoading ? (
              <PanelListSkeleton rows={3} />
            ) : null}
            <div className="candidate-detail-calendar-wrap">
              <TrainingCalendar
                branchHelpers={branchHelpers}
                events={calendarEvents}
                focusDate={calendarFocusDate}
                initialView="agenda"
                kind="uygulama"
                readOnly
              />
            </div>
          </>
        )}
      </section>

    </div>
  );
}
