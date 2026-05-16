import { Fragment, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { CandidateAvatar } from "../components/ui/CandidateAvatar";
import { TrainingCalendar } from "../components/training/TrainingCalendar";
import { EditableRow } from "../components/ui/EditableRow";
import { CustomSelect } from "../components/ui/CustomSelect";
import { ColumnPicker, type ColumnOption } from "../components/ui/ColumnPicker";
import { LocalizedDateInput } from "../components/ui/LocalizedDateInput";
import { Modal } from "../components/ui/Modal";
import { TableHeaderFilter } from "../components/ui/TableHeaderFilter";
import type { SelectOption } from "../components/ui/EditableRow";
import { useToast } from "../components/ui/Toast";
import {
  assignCandidateGroup,
  deleteCandidate,
  getCandidateById,
  removeActiveGroupAssignment,
  setCandidateSecondPracticeRound,
  setCandidateTheoryExemption,
  updateCandidate,
  updateCandidateExistingLicense,
} from "../lib/candidates-api";
import {
  cancelCandidateAccountingMovement,
  cancelCandidateAccountingPayment,
  createCandidateAccountingInvoice,
  createCandidateAccountingMovement,
  createCandidateAccountingPayment,
  createCandidateAccountingRefund,
  deleteCandidateAccountingInvoice,
  getCandidateAccounting,
  updateCandidateAccountingInvoice,
} from "../lib/candidate-accounting-api";
import {
  chargeCandidateExamAttempt,
  createCandidateExamAttempt,
  deleteCandidateExamAttempt,
  listCandidateExamAttempts,
  markCandidateExamAttemptSelfPaid,
  updateCandidateExamAttempt,
} from "../lib/candidate-exam-attempts-api";
import { getCashRegisters } from "../lib/cash-registers-api";
import { getCertificateProgramFeeMatrix } from "../lib/certificate-program-fee-matrix-api";
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
import { buildBranchHelpers } from "../lib/training-branches";
import { buildTermLabel } from "../lib/term-label";
import { ApiError } from "../lib/http";
import {
  createAuthorizedObjectUrl,
  downloadAuthorizedFile,
  openAuthorizedFile,
  printAuthorizedFile,
} from "../lib/authorized-files";
import {
  useInitialLicenseClassOptions,
  useExistingLicenseTypeOptions,
} from "../lib/use-license-class-options";
import {
  deleteCandidateDocument,
  getCandidateDocumentDownloadUrl,
  getCandidateDocuments,
  getDocumentTypes,
  updateCandidateDocument,
  updateCandidateDocumentMebbisTransfer,
  uploadDocument,
} from "../lib/documents-api";
import { createCandidateSyncJob } from "../lib/mebbis-jobs-api";
import {
  CANDIDATE_GENDER_OPTIONS,
  candidateGenderLabel,
  candidateStatusLabel,
  candidateStatusToPill,
  existingLicenseTypeLabel,
  TURKEY_PROVINCE_OPTIONS,
  formatDateTR,
  normalizeCandidateGender,
} from "../lib/status-maps";
import { StatusPill } from "../components/ui/StatusPill";
import type {
  CandidateResponse,
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
  CandidatePaymentMethod,
  CashRegisterResponse,
  CertificateProgramFeeRowResponse,
  LicenseClassDefinitionResponse,
  DocumentMetadataField,
  DocumentResponse,
  DocumentTypeResponse,
  InstructorResponse,
  TrainingBranchDefinitionResponse,
  VehicleResponse,
} from "../lib/types";

type TabKey =
  | "general"
  | "license"
  | "training"
  | "documents"
  | "payments";

const TABS: { key: TabKey; label: string }[] = [
  { key: "general", label: "Genel" },
  { key: "license", label: "Kayıt Bilgileri" },
  { key: "training", label: "Eğitim ve Sınavlar" },
  { key: "documents", label: "Evraklar" },
  { key: "payments", label: "Muhasebe" },
];

const HERO_DOCUMENT_KEYS = ["identity_card", "existing_license_copy", "application_form"] as const;
type HeroDocumentKey = (typeof HERO_DOCUMENT_KEYS)[number];

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

function calculateAge(birthDateIso: string | null): number | null {
  if (!birthDateIso) return null;
  const birthDate = new Date(birthDateIso);
  if (Number.isNaN(birthDate.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDelta = now.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
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
    email: candidate.email,
    address: candidate.address,
    birthDate: candidate.birthDate,
    gender: normalizeCandidateGender(candidate.gender),
    licenseClass: candidate.licenseClass,
    certificateProgramId: candidate.certificateProgramId ?? null,
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
    examFeePaid: candidate.examFeePaid,
    initialPaymentReceived: candidate.initialPaymentReceived,
    contacts: buildCandidateContactPayload(candidate),
    tags: candidate.tags?.map((tag) => tag.name) ?? [],
    rowVersion: candidate.rowVersion,
    ...patch,
  };
}

const CONTACT_TYPE_OPTIONS: SelectOption[] = [
  { value: "phone", label: "Telefon" },
  { value: "email", label: "E-posta" },
  { value: "address", label: "Adres" },
  { value: "other", label: "Diğer" },
];

function contactTypeLabel(type: CandidateContactType): string {
  return CONTACT_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? "Diğer";
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
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
    });
  };

  push("phone", "Telefon", candidate.phoneNumber);
  push("email", "E-posta", candidate.email);
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const { candidateId } = useParams<{ candidateId: string }>();
  const [candidate, setCandidate] = useState<CandidateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [documents, setDocuments] = useState<DocumentResponse[] | null>(null);
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeResponse[] | null>(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [accounting, setAccounting] = useState<CandidateAccountingSummaryResponse | null>(null);
  const [accountingLoading, setAccountingLoading] = useState(false);
  const [accountingError, setAccountingError] = useState<string | null>(null);
  const [movementSaving, setMovementSaving] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [invoiceSaving, setInvoiceSaving] = useState(false);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (
      tab === "general" ||
      tab === "license" ||
      tab === "training" ||
      tab === "documents" ||
      tab === "payments"
    ) {
      setActiveTab(tab);
    } else if (tab === "exams") {
      setActiveTab("training");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!candidateId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    getCandidateById(candidateId, controller.signal)
      .then((data) => setCandidate(data))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Aday bilgileri yüklenemedi");
        showToast("Aday bilgileri yüklenemedi", "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [candidateId, showToast]);

  const age = useMemo(() => calculateAge(candidate?.birthDate ?? null), [candidate]);

  // Lazy-load documents + types when the Evraklar tab is first opened.
  useEffect(() => {
    if (activeTab !== "documents") return;
    if (!candidateId) return;
    if (documents !== null && documentTypes !== null) return;

    const controller = new AbortController();
    setDocumentsLoading(true);
    setDocumentsError(null);

    Promise.all([
      getCandidateDocuments(candidateId, controller.signal),
      getDocumentTypes({ module: "candidate", includeInactive: false }, controller.signal),
    ])
      .then(([docs, types]) => {
        setDocuments(docs);
        setDocumentTypes(types);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setDocumentsError("Evraklar yüklenemedi");
      })
      .finally(() => {
        if (!controller.signal.aborted) setDocumentsLoading(false);
      });

    return () => controller.abort();
  }, [activeTab, candidateId, documents, documentTypes]);

  // Lazy-load candidate accounting when the Muhasebe tab is first opened.
  useEffect(() => {
    if (activeTab !== "payments") return;
    if (!candidateId) return;
    if (accounting !== null) return;

    const controller = new AbortController();
    setAccountingLoading(true);
    setAccountingError(null);

    getCandidateAccounting(candidateId, controller.signal)
      .then((response) => setAccounting(response))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setAccountingError("Muhasebe bilgileri yüklenemedi");
      })
      .finally(() => {
        if (!controller.signal.aborted) setAccountingLoading(false);
      });

    return () => controller.abort();
  }, [activeTab, accounting, candidateId]);

  const refreshAccounting = async () => {
    if (!candidateId) return;
    const response = await getCandidateAccounting(candidateId);
    setAccounting(response);
  };

  const openAccountingPayment = (movementId: string) => {
    setActiveTab("payments");
    setSearchParams({
      tab: "payments",
      action: "payment",
      movementId,
    });
    void refreshAccounting().catch(() => {
      showToast("Muhasebe bilgileri yüklenemedi", "error");
    });
  };

  const handleCreateMovement = async (
    type: CandidateAccountingType,
    dueDate: string,
    amount: number,
    description: string
  ) => {
    if (!candidate || movementSaving) return;
    setMovementSaving(true);
    try {
      await createCandidateAccountingMovement(candidate.id, { type, dueDate, amount, description });
      await refreshAccounting();
      showToast("Borçlandırma eklendi");
    } catch (error) {
      showToast(accountingErrorMessage(error, "Borçlandırma eklenemedi"), "error");
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
      showToast("Ödeme kaydedildi");
    } catch (error) {
      showToast(accountingErrorMessage(error, "Ödeme kaydedilemedi"), "error");
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleCancelMovement = async (movementId: string) => {
    if (!candidate) return;
    try {
      await cancelCandidateAccountingMovement(candidate.id, movementId, "Borçlandırma iptal edildi.");
      await refreshAccounting();
      showToast("Borçlandırma iptal edildi");
    } catch (error) {
      showToast(accountingErrorMessage(error, "Borçlandırma iptal edilemedi"), "error");
    }
  };

  const handleCancelPayment = async (paymentId: string, cancellationReason: string) => {
    if (!candidate) return;
    try {
      await cancelCandidateAccountingPayment(candidate.id, paymentId, cancellationReason);
      await refreshAccounting();
      showToast("Ödeme iptal edildi");
    } catch (error) {
      showToast(accountingErrorMessage(error, "Ödeme iptal edilemedi"), "error");
    }
  };

  const handleRefundPayment = async (paymentId: string, amount: number | null, note: string | null) => {
    if (!candidate) return;
    try {
      await createCandidateAccountingRefund(candidate.id, paymentId, { amount, note });
      await refreshAccounting();
      showToast("İade kaydedildi");
    } catch (error) {
      showToast(accountingErrorMessage(error, "İade kaydedilemedi"), "error");
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
      showToast(invoice ? "Fatura güncellendi" : "Fatura eklendi");
    } catch (error) {
      showToast(accountingErrorMessage(error, "Fatura kaydedilemedi"), "error");
    } finally {
      setInvoiceSaving(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!candidate) return;
    try {
      await deleteCandidateAccountingInvoice(candidate.id, invoiceId);
      await refreshAccounting();
      showToast("Fatura silindi");
    } catch (error) {
      showToast(accountingErrorMessage(error, "Fatura silinemedi"), "error");
    }
  };

  return (
    <div className="candidate-detail">
      <div className="instructor-detail-breadcrumb">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate("/candidates")}
          type="button"
        >
          ← Aday listesine dön
        </button>
      </div>

      {loading && (
        <div className="instructor-detail-card">
          <span className="skeleton" style={{ width: 240, height: 24 }} />
        </div>
      )}

      {!loading && error && (
        <div className="instructor-detail-card instructor-detail-error">{error}</div>
      )}

      {!loading && !error && candidate && (
        <>
          <CandidateHero candidate={candidate} age={age} />
          <SecondPracticeRoundBanner
            candidate={candidate}
            onCandidateUpdated={setCandidate}
          />

          <nav className="candidate-detail-tabs" role="tablist">
            {TABS.map((tab) => {
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
                  onClick={() => setActiveTab(tab.key)}
                  role="tab"
                  type="button"
                >
                  {tab.label}
                  {docInfo}
                </button>
              );
            })}
          </nav>

          <div className="candidate-detail-tab-panel">
            {activeTab === "general" && (
              <GeneralTab
                age={age}
                candidate={candidate}
                onSaved={(updated) => setCandidate(updated)}
              />
            )}
            {activeTab === "license" && (
              <LicenseInfoTab
                age={age}
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
                  candidate={candidate}
                  onAccountingChanged={refreshAccounting}
                  onOpenAccountingPayment={openAccountingPayment}
                  onTheoryExemptChanged={(value) =>
                    setCandidate((prev) =>
                      prev ? { ...prev, isTheoryExempt: value } : prev
                    )
                  }
                />
                <TrainingTab candidate={candidate} />
              </>
            )}
            {activeTab === "documents" && (
              <DocumentsTab
                candidateId={candidate.id}
                documents={documents}
                documentTypes={documentTypes}
                loading={documentsLoading}
                error={documentsError}
                onRefresh={async () => {
                  if (!candidateId) return;
                  try {
                    const docs = await getCandidateDocuments(candidateId);
                    setDocuments(docs);
                  } catch {
                    /* swallow — toast already shown by tab */
                  }
                }}
                onDeleted={() => navigate("/candidates")}
              />
            )}
            {activeTab === "payments" && (
              <AccountingTab
                accounting={accounting}
                accountingError={accountingError}
                accountingLoading={accountingLoading}
                candidate={candidate}
                invoiceSaving={invoiceSaving}
                movementSaving={movementSaving}
                onCancelMovement={(movementId) => void handleCancelMovement(movementId)}
                onCancelPayment={(paymentId, cancellationReason) =>
                  void handleCancelPayment(paymentId, cancellationReason)
                }
                onCreateMovement={(type, dueDate, amount, description) =>
                  void handleCreateMovement(type, dueDate, amount, description)
                }
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
function vehicleTypeForLicenseClass(licenseClass: string): string | null {
  const key = licenseClass.trim().toUpperCase().replace(/[\s_-]/g, "");
  if (!key) return null;
  if (key === "M" || key.startsWith("A") || key.startsWith("B1")) return "Motosiklet";
  if (key.startsWith("BENGELLI")) return "Engelli Otomobil";
  if (key.startsWith("BE")) return "Römorklu Otomobil";
  if (key.startsWith("B")) return "Otomobil";
  if (key.startsWith("CE") || key.startsWith("C1E")) return "Römorklu Kamyon";
  if (key.startsWith("C")) return "Kamyon";
  if (key.startsWith("DE") || key.startsWith("D1E")) return "Römorklu Otobüs";
  if (key.startsWith("D")) return "Otobüs";
  if (key.startsWith("F")) return "Traktör";
  if (key === "G") return "İş Makinesi";
  return null;
}

function CandidateHero({
  candidate,
  age,
}: {
  candidate: CandidateResponse;
  age: number | null;
}) {
  const statusLabel = candidateStatusLabel(candidate.status);
  const statusPill = candidateStatusToPill(candidate.status);
  const fullName = `${candidate.firstName} ${candidate.lastName}`;
  const existingLicense = candidate.existingLicenseType
    ? existingLicenseTypeLabel(candidate.existingLicenseType)
    : null;
  const licenseTransitionLabel = existingLicense
    ? `${existingLicense}'den ${candidate.licenseClass}`
    : candidate.licenseClass;
  const vehicleTypeLabel = vehicleTypeForLicenseClass(candidate.licenseClass);
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
  const paymentLabel = candidate.initialPaymentReceived
    ? "Kayıt ödendi"
    : candidate.examFeePaid
    ? "Sınav ücreti ödendi"
    : "Ödeme bekleniyor";
  const accountingLine = candidate.totalFee > 0 ? "Muhasebe Kaydı Var" : "Muhasebe Kaydı Yok";
  const debtLine = candidate.totalDebt > 0
    ? `Borcu: ${formatCurrencyTRY(candidate.totalDebt)}`
    : "Borcu Yok";
  const statusLine = [
    candidate.examStageLabel,
    candidate.appointmentStatusLabel,
    paymentLabel,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

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
          <span>{candidate.nationalId}</span>
          <span aria-hidden="true" className="candidate-detail-hero-sep">·</span>
          {age != null ? (
            <>
              <span>{age} yaş</span>
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
          {statusLine ? <span>{statusLine}</span> : null}
          <HeroBadges candidate={candidate} />
        </div>
        <div className="candidate-detail-hero-meta candidate-detail-hero-meta--accounting">
          <span>{accountingLine}</span>
          <span aria-hidden="true" className="candidate-detail-hero-sep">·</span>
          <span>{debtLine}</span>
        </div>
      </div>
    </header>
  );
}

function HeroBadges({ candidate }: { candidate: CandidateResponse }) {
  // Compact filigran rozetleri — adayın iş kuralı bypass'larını ve aktif
  // round'unu görsel olarak işaretler. Senaryo diyagramında "Direk Geçiş
  // Filigran" notuna karşılık gelir.
  const badges: { key: string; label: string; tone: "info" | "primary" }[] = [];
  // Direksiyon'a geçiş yolu (priority): operatör onayı (Muaf) > otomatik
  // tespit (Mevcut Ehliyet). E-Sınav puanı resolver tarafından
  // MebExamResult üzerinden değerlendirilir, hero'da ayrı rozet yok.
  if (candidate.isTheoryExempt) {
    badges.push({ key: "exempt", label: "Muaf", tone: "info" });
  } else if (candidate.existingLicenseType) {
    badges.push({
      key: "existing-license",
      label: `Mevcut Ehliyet (${candidate.existingLicenseType})`,
      tone: "info",
    });
  }
  if (candidate.secondPracticeRoundEnabled) {
    badges.push({ key: "second-round", label: "2. Aşama", tone: "primary" });
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
  candidate,
  onCandidateUpdated,
}: {
  candidate: CandidateResponse;
  onCandidateUpdated: (next: CandidateResponse) => void;
}) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [confirmingDrop, setConfirmingDrop] = useState(false);
  const enabled = candidate.secondPracticeRoundEnabled === true;
  const canToggle = candidate.canToggleSecondPracticeRound === true;

  if (!enabled && !canToggle) {
    return null;
  }

  const toggleSecondRound = async (next: boolean) => {
    setSaving(true);
    try {
      const updated = await setCandidateSecondPracticeRound(
        candidate.id,
        next,
        candidate.rowVersion
      );
      onCandidateUpdated(updated);
      showToast(next ? "2. Direksiyon Aşaması açıldı" : "2. Direksiyon Aşaması kapatıldı");
    } catch (error) {
      showToast(secondPracticeRoundErrorMessage(error), "error");
    } finally {
      setSaving(false);
      setConfirmingDrop(false);
    }
  };

  const markDropped = async () => {
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const updated = await updateCandidateField(candidate, {
        status: "dropped",
        terminationDate: today,
      });
      onCandidateUpdated(updated);
      showToast("Aday dosyası yakıldı olarak işaretlendi");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Dosya yakıldı işaretlenemedi";
      showToast(message, "error");
    } finally {
      setSaving(false);
      setConfirmingDrop(false);
    }
  };

  return (
    <div className={`candidate-second-round-banner${enabled ? " is-on" : ""}`}>
      <div className="candidate-second-round-banner-body">
        <strong>2. Direksiyon Aşaması</strong>
        <span>
          {enabled
            ? "Aday ek 4 sınav hakkı ile devam ediyor."
            : "Aday 1. round'daki 4 hakkı tamamladı ve başarısız oldu. 2. Aşamayı açın veya dosyayı yakın."}
        </span>
      </div>
      {enabled ? (
        <button
          className="btn btn-secondary"
          disabled={saving || !canToggle}
          onClick={() => toggleSecondRound(false)}
          type="button"
          title={!canToggle ? "2. aşamada sınav kaydı mevcut, kapatılamaz." : undefined}
        >
          Kapat
        </button>
      ) : confirmingDrop ? (
        <div className="candidate-second-round-banner-confirm" role="group">
          <span>Adayın dosyasını yakmak istediğinize emin misiniz?</span>
          <button
            className="btn btn-danger"
            disabled={saving}
            onClick={markDropped}
            type="button"
          >
            Evet, yak
          </button>
          <button
            className="btn btn-tertiary"
            disabled={saving}
            onClick={() => setConfirmingDrop(false)}
            type="button"
          >
            Vazgeç
          </button>
        </div>
      ) : (
        <div className="candidate-second-round-banner-actions">
          <button
            className="btn btn-secondary"
            disabled={saving}
            onClick={() => setConfirmingDrop(true)}
            type="button"
          >
            Dosya Yakıldı
          </button>
          <button
            className="btn btn-primary"
            disabled={saving}
            onClick={() => toggleSecondRound(true)}
            type="button"
          >
            2. Aşamayı Aç
          </button>
        </div>
      )}
    </div>
  );
}

function GeneralTab({ candidate }: {
  candidate: CandidateResponse;
  age: number | null;
  onSaved: (updated: CandidateResponse) => void;
}) {
  return (
    <div className="candidate-detail-tab-content">
      <CandidateTimeline candidate={candidate} />
    </div>
  );
}

function CandidateTimeline({ candidate }: { candidate: CandidateResponse }) {
  const events = candidate.timeline ?? [];
  const futureSteps = buildFutureStages(candidate);

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
          dateLabel: "Şu an",
          title: candidate.examStageLabel,
          detail: candidate.appointmentStatusLabel ?? null,
        }]
      : []),
    ...[...events].reverse().map<TimelineRow>((event, index) => ({
      key: `${event.kind}-${event.occurredAtUtc}-${index}`,
      kind: "event",
      tone: event.tone,
      dateLabel: formatTimelineDate(event.occurredAtUtc),
      title: event.title,
      detail: event.detail,
    })),
  ];

  if (rows.length === 0) {
    return (
      <div className="instructor-detail-card">
        <h3 className="candidate-timeline-card-title">Aday Yolculuğu</h3>
        <div className="instructor-detail-empty">
          Bu aday için henüz olay kaydı yok.
        </div>
      </div>
    );
  }

  return (
    <div className="instructor-detail-card">
      <h3 className="candidate-timeline-card-title">Aday Yolculuğu</h3>
      <ol className="candidate-timeline">
        {(() => {
          let sideIndex = 0;
          return rows.map((row) => {
            const isCentered = row.title === "Mezun";
            const side = isCentered ? null : sideIndex++ % 2 === 0 ? "left" : "right";
            const itemClass = [
              "candidate-timeline-item",
              isCentered ? "is-centered" : `side-${side}`,
              row.kind === "current" ? "is-current" : "",
              row.kind === "future" ? "is-future" : "",
              row.kind === "event" ? `tone-${row.tone}` : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <li key={row.key} className={itemClass}>
                <div className="candidate-timeline-content">
                  <div className="candidate-timeline-title">{row.title}</div>
                  {row.detail ? (
                    <div className="candidate-timeline-detail">{row.detail}</div>
                  ) : null}
                </div>
                <div className="candidate-timeline-axis">
                  <span className="candidate-timeline-marker" aria-hidden="true" />
                  <span className="candidate-timeline-date">{row.dateLabel}</span>
                </div>
              </li>
            );
          });
        })()}
      </ol>
    </div>
  );
}

function buildFutureStages(candidate: CandidateResponse): string[] {
  const stage = candidate.examStageLabel;
  if (!stage || stage === "Mezun" || stage === "Dosya Yakıldı") return [];
  if (stage === "E-Sınav Aşamasında") return ["Direksiyon Aşaması", "Mezun"];
  if (stage === "Direksiyon Aşamasında" || stage === "2. Direksiyon Aşaması") return ["Mezun"];
  return [];
}

function formatTimelineDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function CandidateContactsEditor({
  candidate,
  onSave,
}: {
  candidate: CandidateResponse;
  onSave: (patch: Partial<CandidateUpsertRequest>, message: string) => Promise<void>;
}) {
  const { showToast } = useToast();
  const [drafts, setDrafts] = useState<Array<{ id: string; type: CandidateContactType }>>([]);
  const contacts = buildCandidateContacts(candidate);

  const validateContactValue = (type: CandidateContactType, value: string): boolean => {
    if (type !== "email" || isValidEmail(value)) {
      return true;
    }

    showToast("Geçerli bir e-posta adresi girin.", "error");
    return false;
  };

  const saveContacts = async (
    nextContacts: CandidateContactUpsertRequest[],
    message: string
  ) => {
    const firstPhone = nextContacts.find((contact) => contact.type === "phone")?.value ?? null;
    const firstEmail = nextContacts.find((contact) => contact.type === "email")?.value ?? null;
    const firstAddress = nextContacts.find((contact) => contact.type === "address")?.value ?? null;

    await onSave(
      {
        contacts: nextContacts,
        phoneNumber: firstPhone,
        email: firstEmail,
        address: firstAddress,
      },
      message
    );
  };

  const updateContactValue = async (contact: CandidateContactResponse, value: string) => {
    const normalizedValue = value.trim();
    if (!normalizedValue) return;
    if (!validateContactValue(contact.type, normalizedValue)) {
      throw new Error("invalid email");
    }

    const nextContacts = contacts.map((item) =>
      item === contact
        ? {
            id: item.id || null,
            type: item.type,
            label: contactTypeLabel(item.type),
            value: normalizedValue,
            isPrimary: item.isPrimary,
          }
        : {
            id: item.id || null,
            type: item.type,
            label: item.label,
            value: item.value,
            isPrimary: item.isPrimary,
          }
    );
    await saveContacts(nextContacts, "İletişim bilgisi güncellendi");
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
      }));
    await saveContacts(nextContacts, "İletişim bilgisi silindi");
  };

  const createContact = async (draftId: string, type: CandidateContactType, value: string) => {
    const normalizedValue = value.trim();
    if (!normalizedValue) return;
    if (!validateContactValue(type, normalizedValue)) {
      throw new Error("invalid email");
    }

    const nextContacts = [
      ...contacts.map((contact) => ({
        id: contact.id || null,
        type: contact.type,
        label: contact.label,
        value: contact.value,
        isPrimary: contact.isPrimary,
      })),
      {
        id: null,
        type,
        label: contactTypeLabel(type),
        value: normalizedValue,
        isPrimary: !contacts.some((item) => item.type === type),
      },
    ];

    await saveContacts(nextContacts, "İletişim bilgisi eklendi");
    setDrafts((current) => current.filter((draft) => draft.id !== draftId));
  };

  const addDraft = (type: CandidateContactType) => {
    setDrafts((current) => [
      ...current,
      { id: `${type}-${Date.now()}-${current.length}`, type },
    ]);
  };

  const contactLabelCounts: Partial<Record<CandidateContactType, number>> = {};
  return (
    <div className="candidate-detail-contacts">
      <div className="candidate-contact-toolbar">
        {CONTACT_KINDS.map((kind) => (
          <button
            className="btn btn-secondary btn-sm"
            key={kind.type}
            onClick={() => addDraft(kind.type)}
            type="button"
          >
            Yeni {kind.singular}
          </button>
        ))}
      </div>
      <div className="candidate-contact-list">
        {contacts.length === 0 && drafts.length === 0 ? (
          <div className="instructor-detail-empty">İletişim bilgisi yok.</div>
        ) : null}
        {contacts.map((contact, index) => {
          contactLabelCounts[contact.type] = (contactLabelCounts[contact.type] ?? 0) + 1;
          const label = `${contactTypeLabel(contact.type)} ${contactLabelCounts[contact.type]}`;

          return (
            <div className="candidate-contact-value-row" key={`${contact.id || contact.type}-${index}`}>
              <EditableRow
                displayValue={contact.value}
                inputType={contactInputType(contact.type)}
                inputValue={contact.value}
                label={label}
                onSave={(value) => updateContactValue(contact, value)}
              />
              <button
                className="btn btn-danger btn-sm"
                onClick={() => void deleteContact(contact)}
                type="button"
              >
                Sil
              </button>
            </div>
          );
        })}
        {drafts.map((draft) => (
          <CandidateContactDraftRow
            draftId={draft.id}
            inputType={contactInputType(draft.type)}
            key={draft.id}
            label={`Yeni ${contactTypeLabel(draft.type)}`}
            onCancel={(draftId) =>
              setDrafts((current) => current.filter((item) => item.id !== draftId))
            }
            onCreate={(value) => createContact(draft.id, draft.type, value)}
          />
        ))}
      </div>
    </div>
  );
}

const CONTACT_KINDS: Array<{
  type: CandidateContactType;
  singular: string;
  inputType: "text" | "tel" | "email" | "textarea";
}> = [
  { type: "phone", singular: "Telefon", inputType: "tel" },
  { type: "email", singular: "E-posta", inputType: "email" },
  { type: "address", singular: "Adres", inputType: "textarea" },
];

function contactInputType(type: CandidateContactType): "text" | "tel" | "email" | "textarea" {
  return CONTACT_KINDS.find((kind) => kind.type === type)?.inputType ?? "text";
}

function CandidateContactDraftRow({
  draftId,
  label,
  inputType,
  onCreate,
  onCancel,
}: {
  draftId: string;
  label: string;
  inputType: "text" | "tel" | "email" | "textarea";
  onCreate: (value: string) => Promise<void>;
  onCancel: (draftId: string) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const trimmedValue = value.trim();
  const isEmail = inputType === "email";

  const save = async () => {
    if (!trimmedValue || saving) return;
    if (isEmail && !isValidEmail(trimmedValue)) {
      setError("Geçerli bir e-posta adresi girin.");
      return;
    }

    setSaving(true);
    try {
      await onCreate(trimmedValue);
      setError(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="drawer-row editable-row candidate-contact-draft-row">
      <span className="label">{label}</span>
      <span className="editable-row-edit">
        {inputType === "textarea" ? (
          <textarea
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
            className="form-input-sm"
            disabled={saving}
            onChange={(event) => {
              setValue(event.target.value);
              if (error) setError(null);
            }}
            type={inputType}
            value={value}
          />
        )}
        <button
          className="btn btn-primary btn-sm"
          disabled={!trimmedValue || saving}
          onClick={() => void save()}
          type="button"
        >
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </button>
        <button
          className="btn btn-secondary btn-sm"
          disabled={saving}
          onClick={() => onCancel(draftId)}
          type="button"
        >
          Vazgeç
        </button>
      </span>
      {error ? <span className="candidate-contact-validation">{error}</span> : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="assignment-field">
      <span className="assignment-field-label">{label}</span>
      <span className="assignment-field-value">{value}</span>
    </div>
  );
}

function todayIsoDate(): string {
  const date = new Date();
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addHours(date: Date, hours: number): Date {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}

function dateOnlyAt(dateIso: string, hour: number): Date {
  const [year, month, day] = dateIso.split("-").map((part) => parseInt(part, 10));
  return new Date(year, month - 1, day, hour, 0, 0, 0);
}

function buildCandidateExamEvents(candidate: CandidateResponse): TrainingCalendarEvent[] {
  const candidateName = `${candidate.firstName} ${candidate.lastName}`.trim();
  const base = {
    instructorId: "exam",
    instructorName: "Sınav",
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
      title: "E-Sınav",
      start,
      end: addHours(start, 1),
      kind: "teorik",
      groupName: "E-Sınav",
      notes: "E-Sınav",
    });
  }

  if (candidate.drivingExamDate) {
    const start = dateOnlyAt(candidate.drivingExamDate, 10);
    events.push({
      ...base,
      id: `candidate-${candidate.id}-driving-exam`,
      title: "Direksiyon Sınavı",
      start,
      end: addHours(start, 1),
      kind: "uygulama",
      groupName: "Direksiyon Sınavı",
      notes: "Direksiyon Sınavı",
    });
  }

  return events;
}

function normalizeLicenseOptionKey(value: string): string {
  return value
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/Ç/g, "C")
    .replace(/Ğ/g, "G")
    .replace(/İ/g, "I")
    .replace(/Ö/g, "O")
    .replace(/Ş/g, "S")
    .replace(/Ü/g, "U")
    .replace(/OTOMATIK/g, "AUTO")
    .replace(/YENI\s*NESIL/g, "NEWGEN")
    .replace(/ENGELLI/g, "DISABLED")
    .replace(/[^A-Z0-9]/g, "");
}

type ExistingLicenseRuleOption = SelectOption & {
  existingLicenseType: string;
  existingLicensePre2016: boolean;
  displayOrder: number;
};

function encodeExistingLicenseSelection(
  existingLicenseType: string | null | undefined,
  existingLicensePre2016: boolean
): string {
  if (!existingLicenseType) return "";
  return `${encodeURIComponent(existingLicenseType.trim().toLowerCase())}|${
    existingLicensePre2016 ? "1" : "0"
  }`;
}

function decodeExistingLicenseSelection(value: string): {
  existingLicenseType: string | null;
  existingLicensePre2016: boolean;
} {
  if (!value) {
    return { existingLicenseType: null, existingLicensePre2016: false };
  }

  const [encodedType = "", encodedPre2016 = "0"] = value.split("|");
  const existingLicenseType = decodeURIComponent(encodedType).trim() || null;
  return {
    existingLicenseType,
    existingLicensePre2016: existingLicenseType ? encodedPre2016 === "1" : false,
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
    if (!definition.hasExistingLicense || !definition.existingLicenseType) continue;
    if (normalizeLicenseOptionKey(definition.code) !== targetKey) continue;

    const value = encodeExistingLicenseSelection(
      definition.existingLicenseType,
      definition.existingLicensePre2016
    );
    const baseLabel = existingLicenseTypeLabel(
      definition.existingLicenseType,
      configuredExistingLicenseTypeOptions
    );
    byValue.set(value, {
      value,
      label: definition.existingLicensePre2016
        ? `${baseLabel} (2016 öncesi)`
        : baseLabel,
      existingLicenseType: definition.existingLicenseType,
      existingLicensePre2016: definition.existingLicensePre2016,
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
      label: currentExistingLicensePre2016
        ? `${baseLabel} (2016 öncesi)`
        : baseLabel,
      existingLicenseType: currentExistingLicenseType,
      existingLicensePre2016: currentExistingLicensePre2016,
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
  existingLicensePre2016: boolean,
  configuredExistingLicenseTypeOptions: SelectOption[]
): string {
  if (!existingLicenseType) return "";
  const label = existingLicenseTypeLabel(
    existingLicenseType,
    configuredExistingLicenseTypeOptions
  );
  return existingLicensePre2016 ? `${label} (2016 öncesi)` : label;
}

function LicenseInfoTab({
  age,
  candidate,
  onSaved,
  onTheoryExemptChanged,
}: {
  age: number | null;
  candidate: CandidateResponse;
  onSaved: (updated: CandidateResponse) => void;
  onTheoryExemptChanged?: (value: boolean) => void;
}) {
  const { showToast } = useToast();
  const { options: licenseClassOptions } = useInitialLicenseClassOptions();
  const [groupCapacity, setGroupCapacity] = useState<{
    filled: number;
    capacity: number;
  } | null>(null);

  // Pull the active group separately to surface its capacity/utilisation, since
  // the candidate response only carries summary fields (no counts).
  useEffect(() => {
    const groupId = candidate.currentGroup?.groupId;
    if (!groupId) {
      setGroupCapacity(null);
      return;
    }
    const controller = new AbortController();
    getGroupById(groupId, controller.signal)
      .then((group) =>
        setGroupCapacity({ filled: group.activeCandidateCount, capacity: group.capacity })
      )
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setGroupCapacity(null);
      });
    return () => controller.abort();
  }, [candidate.currentGroup?.groupId]);

  const loadGroupOptions = async (): Promise<SelectOption[]> => {
    const response = await getGroups({ pageSize: 200 });
    return [
      { value: "", label: "— Atanmamış —" },
      ...response.items.map((group) => ({
        value: group.id,
        label: `${group.title}${group.startDate ? ` · ${formatDateTR(group.startDate)}` : ""}`,
      })),
    ];
  };

  const saveGroup = async (groupId: string) => {
    try {
      if (!groupId) {
        await removeActiveGroupAssignment(candidate.id);
      } else {
        await assignCandidateGroup(candidate.id, groupId);
      }

      const updated = await getCandidateById(candidate.id);
      onSaved(updated);
      showToast(groupId ? "Grup atandı" : "Aktif grup ataması kapatıldı");
    } catch {
      showToast("Grup ataması kaydedilemedi", "error");
      throw new Error("save failed");
    }
  };
  const { options: configuredExistingLicenseTypeOptions } = useExistingLicenseTypeOptions();
  const [licenseType, setLicenseType] = useState(
    encodeExistingLicenseSelection(
      candidate.existingLicenseType,
      candidate.existingLicensePre2016
    )
  );
  const [licenseNumber, setLicenseNumber] = useState(candidate.existingLicenseNumber ?? "");
  const [issuedAt, setIssuedAt] = useState(
    candidate.existingLicenseIssuedAt ?? (candidate.existingLicenseType ? "" : todayIsoDate())
  );
  const [issuedProvince, setIssuedProvince] = useState(
    candidate.existingLicenseIssuedProvince ?? ""
  );
  const [licenseFieldsOpen, setLicenseFieldsOpen] = useState(
    !!candidate.existingLicenseType
  );
  const [existingLicenseOptions, setExistingLicenseOptions] = useState<SelectOption[]>([]);
  const [existingLicenseOptionsLoading, setExistingLicenseOptionsLoading] = useState(false);
  const hasLicense = !!candidate.existingLicenseType;

  useEffect(() => {
    setLicenseType(
      encodeExistingLicenseSelection(
        candidate.existingLicenseType,
        candidate.existingLicensePre2016
      )
    );
    setLicenseNumber(candidate.existingLicenseNumber ?? "");
    setIssuedAt(
      candidate.existingLicenseIssuedAt ?? (candidate.existingLicenseType ? "" : todayIsoDate())
    );
    setIssuedProvince(candidate.existingLicenseIssuedProvince ?? "");
    setLicenseFieldsOpen(!!candidate.existingLicenseType);
  }, [candidate]);

  useEffect(() => {
    const controller = new AbortController();
    setExistingLicenseOptionsLoading(true);

    getLicenseClassDefinitions(
      {
        activity: "active",
        page: 1,
        pageSize: 1000,
        sortBy: "displayOrder",
        sortDir: "asc",
      },
      controller.signal
    )
      .then((definitionResponse) => {
        setExistingLicenseOptions(
          buildExistingLicenseOptionsFromDefinitions(
            definitionResponse.items,
            candidate.licenseClass,
            candidate.existingLicenseType,
            candidate.existingLicensePre2016,
            configuredExistingLicenseTypeOptions
          )
        );
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setExistingLicenseOptions([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setExistingLicenseOptionsLoading(false);
        }
      });

    return () => controller.abort();
  }, [
    candidate.existingLicensePre2016,
    candidate.existingLicenseType,
    candidate.licenseClass,
    configuredExistingLicenseTypeOptions,
  ]);

  useEffect(() => {
    if (existingLicenseOptionsLoading || !licenseType) return;
    if (existingLicenseOptions.some((option) => option.value === licenseType)) return;
    setLicenseType("");
  }, [existingLicenseOptions, existingLicenseOptionsLoading, licenseType]);

  const saveApplicationField = async (
    patch: Partial<CandidateUpsertRequest>,
    message = "Başvuru bilgileri güncellendi"
  ) => {
    try {
      const updated = await updateCandidateField(candidate, patch);
      onSaved(updated);
      showToast(message);
    } catch {
      showToast("Başvuru bilgileri kaydedilemedi", "error");
      throw new Error("save failed");
    }
  };

  const [exemptSaving, setExemptSaving] = useState(false);
  const isTheoryExempt = candidate.isTheoryExempt ?? false;
  const toggleTheoryExempt = async () => {
    const next = !isTheoryExempt;
    setExemptSaving(true);
    try {
      await setCandidateTheoryExemption(candidate.id, next);
      onTheoryExemptChanged?.(next);
    } catch {
      showToast("Muafiyet durumu güncellenemedi.", "error");
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
    const {
      existingLicenseType: nextType,
      existingLicensePre2016: nextPre2016,
    } = decodeExistingLicenseSelection(nextTypeRaw ?? "");

    // Explicitly picking "— Belge Yok —" from the type dropdown clears every
    // field; partial saves of other fields (without a type yet) keep going.
    if (patch.existingLicenseType !== undefined && !nextType) {
      return {
        existingLicenseType: null,
        existingLicenseIssuedAt: null,
        existingLicenseNumber: null,
        existingLicenseIssuedProvince: null,
        existingLicensePre2016: false,
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
      existingLicenseType: nextType,
      existingLicenseIssuedAt: nextIssuedAt,
      existingLicenseNumber: nextNumber,
      existingLicenseIssuedProvince: nextProvince,
      existingLicensePre2016: nextPre2016,
      rowVersion: candidate.rowVersion,
    };
  };

  const saveExistingLicenseField = async (
    patch: Partial<CandidateUpsertRequest>,
    message = "Ehliyet bilgileri güncellendi"
  ) => {
    try {
      const updated = await updateCandidateExistingLicense(
        candidate.id,
        buildExistingLicenseRequest(patch)
      );
      onSaved(updated);
      showToast(message);
    } catch {
      showToast("Ehliyet bilgileri kaydedilemedi", "error");
      throw new Error("save failed");
    }
  };

  const handleToggleExistingLicense = (checked: boolean) => {
    if (checked) {
      if (!issuedAt) {
        setIssuedAt(todayIsoDate());
      }
      setLicenseFieldsOpen(true);
      return;
    }

    setLicenseFieldsOpen(false);

    if (!hasLicense) {
      setLicenseType("");
      setLicenseNumber("");
      setIssuedAt(todayIsoDate());
      setIssuedProvince("");
    }
  };

  return (
    <div className="candidate-detail-tab-content candidate-detail-license-grid">
      <section className="instructor-detail-card">
        <h3 className="candidate-detail-section-title">Başvuru Bilgileri</h3>
        <div className="candidate-detail-edit-list">
          <EditableRow
            displayValue={candidate.licenseClass}
            inputValue={candidate.licenseClass}
            label="Ehliyet Tipi"
            options={licenseClassOptions}
            onSave={(value) =>
              saveApplicationField(
                {
                  licenseClass: value as CandidateResponse["licenseClass"],
                  certificateProgramId: null,
                  existingLicenseType: null,
                  existingLicenseNumber: null,
                  existingLicenseIssuedAt: null,
                  existingLicenseIssuedProvince: null,
                  existingLicensePre2016: false,
                },
                "Ehliyet tipi güncellendi"
              )
            }
          />
        </div>

        <div className="instructor-detail-section-header" style={{ marginTop: 24 }}>
          <span className="form-label" style={{ margin: 0 }}>
            Teori Muafiyeti
          </span>
          <label className="switch-toggle" title="Aday teori sınavından muaf">
            <input
              checked={isTheoryExempt}
              disabled={exemptSaving}
              onChange={toggleTheoryExempt}
              type="checkbox"
            />
            <span aria-hidden="true" className="switch-toggle-control" />
            <span>{isTheoryExempt ? "Muaf" : "Değil"}</span>
          </label>
        </div>

        <div className="instructor-detail-section-header" style={{ marginTop: 24 }}>
          <span className="form-label" style={{ margin: 0 }}>
            Mevcut Sürücü Belgesi
          </span>
          <label className="switch-toggle">
            <input
              checked={licenseFieldsOpen}
              onChange={(event) => handleToggleExistingLicense(event.target.checked)}
              type="checkbox"
            />
            <span aria-hidden="true" className="switch-toggle-control" />
            <span>{licenseFieldsOpen ? "Var" : "Yok"}</span>
          </label>
        </div>

        <div className="candidate-detail-edit-list">
            <EditableRow
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
              label="Mevcut Belge"
              options={[
                { value: "", label: "— Belge Yok —" },
                ...existingLicenseOptions,
              ]}
              onSave={(value) =>
                saveExistingLicenseField(
                  { existingLicenseType: value || null },
                  value ? "Mevcut sürücü belgesi güncellendi" : "Mevcut sürücü belgesi kaldırıldı"
                )
              }
            />
            <EditableRow
              displayValue={hasLicense ? formatDateTR(candidate.existingLicenseIssuedAt) : formatDateTR(issuedAt)}
              inputType="date"
              inputValue={hasLicense ? candidate.existingLicenseIssuedAt ?? "" : issuedAt}
              inputLang="tr-TR"
              label="Belge Tarihi"
              onSave={(value) =>
                saveExistingLicenseField({ existingLicenseIssuedAt: value || null })
              }
            />
            <EditableRow
              displayValue={hasLicense ? candidate.existingLicenseNumber ?? "" : licenseNumber}
              inputValue={hasLicense ? candidate.existingLicenseNumber ?? "" : licenseNumber}
              label="Belge No"
              onSave={(value) =>
                saveExistingLicenseField({ existingLicenseNumber: value || null })
              }
            />
            <EditableRow
              displayValue={hasLicense ? candidate.existingLicenseIssuedProvince ?? "" : issuedProvince}
              inputValue={hasLicense ? candidate.existingLicenseIssuedProvince ?? "" : issuedProvince}
              label="Belge Veriliş İli"
              options={TURKEY_PROVINCE_OPTIONS}
              onSave={(value) =>
                saveExistingLicenseField({ existingLicenseIssuedProvince: value || null })
              }
            />
            {!existingLicenseOptionsLoading && existingLicenseOptions.length === 0 ? (
              <div className="form-subsection-note" style={{ marginTop: 8 }}>
                Bu ehliyet tipi için mevcut sürücü belgesi gerektiren tanım yok.
              </div>
            ) : null}
          </div>
      </section>

      <section className="instructor-detail-card">
        <h3 className="candidate-detail-section-title">Grup / Dönem Bilgileri</h3>
        <div className="candidate-detail-edit-list">
          <Field label="Kayıt Tarihi" value={formatDateTR(candidate.createdAtUtc)} />
          <EditableRow
            displayValue={candidate.currentGroup?.title ?? "Atanmamış"}
            inputValue={candidate.currentGroup?.groupId ?? ""}
            label="Aktif Grup"
            loadOptions={loadGroupOptions}
            onSave={saveGroup}
          />
          <Field
            label="Dönem"
            value={
              candidate.currentGroup?.term
                ? buildTermLabel(candidate.currentGroup.term, [])
                : "—"
            }
          />
          <Field
            label="Grup Başlangıcı"
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
        <div className="form-subsection-note" style={{ marginTop: 8 }}>
          Yeni bir grup seçildiğinde mevcut aktif atama otomatik kapatılır. Boş seçim aktif atamayı kaldırır.
        </div>
      </section>

      <section className="instructor-detail-card">
        <h3 className="candidate-detail-section-title">Kimlik Bilgileri</h3>
        <div className="candidate-detail-edit-list">
          <EditableRow
            displayValue={candidate.firstName}
            inputValue={candidate.firstName}
            label="Ad"
            onSave={(value) => saveApplicationField({ firstName: value.trim() }, "Ad güncellendi")}
          />
          <EditableRow
            displayValue={candidate.lastName}
            inputValue={candidate.lastName}
            label="Soyad"
            onSave={(value) => saveApplicationField({ lastName: value.trim() }, "Soyad güncellendi")}
          />
          <EditableRow
            displayValue={candidate.nationalId}
            inputType="tel"
            inputValue={candidate.nationalId}
            label="TC Kimlik No"
            onSave={(value) => saveApplicationField({ nationalId: value.trim() }, "TC kimlik güncellendi")}
          />
          <EditableRow
            displayValue={candidate.identitySerialNumber ?? ""}
            inputValue={candidate.identitySerialNumber ?? ""}
            label="Kimlik Seri No"
            onSave={(value) =>
              saveApplicationField({ identitySerialNumber: value.trim() || null }, "Kimlik seri no güncellendi")
            }
          />
          <EditableRow
            displayValue={candidate.motherName ?? ""}
            inputValue={candidate.motherName ?? ""}
            label="Anne Adı"
            onSave={(value) => saveApplicationField({ motherName: value.trim() || null }, "Anne adı güncellendi")}
          />
          <EditableRow
            displayValue={candidate.fatherName ?? ""}
            inputValue={candidate.fatherName ?? ""}
            label="Baba Adı"
            onSave={(value) => saveApplicationField({ fatherName: value.trim() || null }, "Baba adı güncellendi")}
          />
          <EditableRow
            displayValue={candidateGenderLabel(candidate.gender)}
            inputValue={normalizeCandidateGender(candidate.gender) ?? ""}
            label="Cinsiyet"
            options={CANDIDATE_GENDER_OPTIONS}
            onSave={(value) =>
              saveApplicationField({ gender: normalizeCandidateGender(value) }, "Cinsiyet güncellendi")
            }
          />
          <EditableRow
            displayValue={formatDateTR(candidate.birthDate)}
            inputType="date"
            inputValue={candidate.birthDate ?? ""}
            label="Doğum Tarihi"
            onSave={(value) => saveApplicationField({ birthDate: value || null }, "Doğum tarihi güncellendi")}
          />
          <Field label="Yaş" value={age != null ? String(age) : "—"} />
        </div>
      </section>

      <section className="instructor-detail-card">
        <h3 className="candidate-detail-section-title">İletişim</h3>
        <CandidateContactsEditor candidate={candidate} onSave={saveApplicationField} />
      </section>
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

function fromDateTimeLocalValue(value: string): string {
  return new Date(value).toISOString();
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
  examType: CandidateExamType
): number {
  const used = attempts
    .filter((attempt) => attempt.examType === examType)
    .map((attempt) => attempt.attemptNumber);
  for (let number = 1; number <= 4; number += 1) {
    if (!used.includes(number)) return number;
  }
  return 5;
}

function suggestedCandidateExamFee(
  row: CertificateProgramFeeRowResponse | undefined,
  examType: CandidateExamType,
  attemptNumber: number
): number | null {
  if (examType === "theory") return row?.institutionTheoryExamFee ?? null;
  if (attemptNumber > 1) return row?.program.failureRetryFee ?? null;
  return row?.institutionPracticeExamFee ?? null;
}

function suggestedFeeLookupKeyForAttempt(attempt: CandidateExamAttemptResponse): string {
  const year = new Date(attempt.scheduledAt).getFullYear();
  if (attempt.examType === "practice" && attempt.attemptNumber > 1) {
    return `${year}:practice:retry`;
  }
  return `${year}:${attempt.examType}`;
}

const THEORY_EXAM_EXPIRY_DAYS = 45;

function addDaysToISODate(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return toDateOnlyValue(date);
}

function toDateOnlyValue(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function secondPracticeRoundErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const codes = Object.values(error.validationErrorCodes ?? {}).flat();
    for (const entry of codes) {
      if (entry.code === "candidate.validation.secondPracticeRoundNotEligible") {
        return "Aday henüz 2. Direksiyon Aşamasına uygun değil (1. round 4/4 ve başarısız olmalı).";
      }
      if (entry.code === "candidate.validation.secondPracticeRoundHasAttempts") {
        return "2. aşamada sınav kaydı mevcut, kapatılamaz.";
      }
      if (entry.code === "candidate.validation.concurrencyConflict") {
        return "Bilgiler başka bir kullanıcı tarafından güncellendi. Sayfayı yenileyin.";
      }
    }
  }
  return "2. Direksiyon Aşaması güncellenemedi.";
}

function examAttemptCreateErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const codes = Object.values(error.validationErrorCodes ?? {}).flat();
    for (const entry of codes) {
      if (entry.code === "candidateExamAttemptFailedCandidateNeedsTraining") {
        return "Aday geçen sınavda başarısız oldu. Yeni randevudan önce en az 2 saat uygulama eğitimi planlanmalı.";
      }
      if (entry.code === "candidateExamAttemptAttemptLimitReached") {
        return "Aday bu round için 4 sınav hakkını tamamladı.";
      }
    }
  }
  return "Sınav denemesi eklenemedi.";
}

function accountingErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  const messages = Object.values(error.validationErrors ?? {}).flat();
  const firstMessage = messages[0];
  if (!firstMessage) return fallback;

  if (firstMessage.includes("open balance")) return "Ödeme seçilen türdeki açık bakiyeyi aşamaz.";
  if (firstMessage.includes("Cash register is required")) return "Bu ödeme yöntemi için kasa seçilmeli.";
  if (firstMessage.includes("Cash register type")) return "Seçilen kasa ödeme yöntemiyle uyumlu değil.";
  if (firstMessage.includes("Paid movement") || firstMessage.includes("Paid debt")) {
    return "Ödeme alınmış borçlandırma silinemez. Önce iade/iptal işlemi yapın.";
  }
  if (firstMessage.includes("Refund amount")) return "İade tutarı iade edilebilir tutarı aşamaz.";
  if (firstMessage.includes("Cancellation reason")) return "İptal sebebi zorunlu.";
  return firstMessage;
}

function paymentMethodLabel(method: CandidatePaymentMethod): string {
  if (method === "cash") return "Nakit";
  if (method === "credit_card") return "Kredi Kartı";
  if (method === "bank_transfer") return "Havale/EFT";
  if (method === "mail_order") return "Mail Order";
  return "Diğer";
}

function accountingTypeLabel(type: CandidateAccountingType): string {
  if (type === "kurs") return "Kurs";
  if (type === "teorik_sinav") return "Teorik Sınavı";
  if (type === "direksiyon_sinav") return "Direksiyon Sınavı";
  return "Diğer";
}

function accountingMovementStatus(
  movement: CandidateAccountingSummaryResponse["movements"][number]
): { className: string; label: string } {
  if (movement.status === "cancelled") {
    return { className: "status-cancelled", label: "İptal" };
  }

  return { className: "status-open", label: "Borç" };
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
  title: string;
  detail: string;
  types: CandidateAccountingType[];
}> = [
  {
    id: "course",
    title: "Kurs Ödemesi",
    detail: "Kurs borçlandırmaları",
    types: ["kurs"],
  },
  {
    id: "exam",
    title: "Sınav Ücretleri",
    detail: "Teorik + direksiyon",
    types: ["teorik_sinav", "direksiyon_sinav"],
  },
  {
    id: "other",
    title: "Diğer Ödemeler",
    detail: "Diğer borçlandırmalar",
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
  | "method"
  | "cashRegister"
  | "refundedAmount"
  | "paidAt"
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
  label: string;
  sortField?: AccountingLedgerSortField;
  locked?: boolean;
}> = [
  { id: "type", label: "Tür", sortField: "type", locked: true },
  { id: "description", label: "Açıklama", sortField: "description" },
  { id: "dueDate", label: "Vade Tarihi", sortField: "dueDate" },
  { id: "amount", label: "Tutar", sortField: "amount" },
  { id: "paidAmount", label: "Ödenen", sortField: "paidAmount" },
  { id: "remainingAmount", label: "Kalan", sortField: "remainingAmount" },
  { id: "number", label: "No", sortField: "number" },
  { id: "method", label: "Yöntem", sortField: "method" },
  { id: "cashRegister", label: "Kasa", sortField: "cashRegister" },
  { id: "refundedAmount", label: "İade", sortField: "refundedAmount" },
  { id: "paidAt", label: "Ödeme Tarihi", sortField: "paidAt" },
  { id: "actions", label: "İşlemler", locked: true },
];

const ACCOUNTING_LEDGER_COLUMN_OPTIONS: ColumnOption[] = ACCOUNTING_LEDGER_COLUMNS.map((column) => ({
  id: column.id,
  label: column.label,
  locked: column.locked,
}));

const DEFAULT_ACCOUNTING_LEDGER_VISIBLE_COLUMNS: AccountingLedgerColumnId[] = [
  "type",
  "description",
  "dueDate",
  "amount",
  "paidAmount",
  "remainingAmount",
  "number",
  "method",
  "cashRegister",
  "refundedAmount",
  "paidAt",
  "actions",
];

const DEFAULT_ACCOUNTING_LEDGER_FILTERS: AccountingLedgerFilters = {
  kind: "all",
  status: "all",
  method: "all",
  cashRegister: "all",
};

function AccountingTab({
  accounting,
  accountingLoading,
  accountingError,
  candidate,
  movementSaving,
  paymentSaving,
  invoiceSaving,
  onCreateMovement,
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
  onCreatePayment: (
    type: CandidateAccountingType,
    amount: number,
    method: CandidatePaymentMethod,
    cashRegisterId: string | null,
    paidAtUtc: string,
    note: string | null,
    movementId: string | null
  ) => void;
  onCancelMovement: (movementId: string) => void;
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
    paidAtUtc: todayIsoDate(),
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
  const [refundPayment, setRefundPayment] =
    useState<CandidateAccountingSummaryResponse["payments"][number] | null>(null);
  const [paymentCancelReason, setPaymentCancelReason] = useState("");
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
  const activePayments = accounting?.payments.filter((item) => item.status === "active") ?? [];
  const feeSuggestions = accounting?.feeSuggestions ?? [];
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
  const parsedPaymentAmount = parseMoneyInput(paymentModal.amount);
  const paymentNeedsRegister = cashRegisterTypeForMethod(paymentModal.method) !== null;
  const paymentTargetMovement = paymentModal.movementId
    ? activeMovements.find((item) => item.id === paymentModal.movementId)
    : null;
  const paymentOpenBalance = paymentTargetMovement?.remainingAmount ?? typeOpenBalance(paymentModal.type);
  const canSaveDebt =
    Boolean(debtModal.description.trim()) &&
    Boolean(debtModal.dueDate) &&
    parsedDebtAmount != null &&
    parsedDebtAmount > 0 &&
    !movementSaving;
  const canSavePayment =
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
    setDebtModal({
      open: true,
      type,
      amount,
      dueDate: todayIsoDate(),
      description,
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
    const defaultMethod: CandidatePaymentMethod = "cash";
    const firstRegister = cashRegisters.find((register) => register.type === defaultMethod);
    setPaymentModal({
      open: true,
      type,
      amount,
      method: defaultMethod,
      cashRegisterId: firstRegister?.id ?? "",
      paidAtUtc: todayIsoDate(),
      note: "",
      movementId,
    });
  };
  const openInvoiceModal = (
    invoice: CandidateAccountingInvoiceResponse | null = null,
    amount?: number
  ) => {
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
    setRefundPayment(payment);
    setRefundAmount(String(Math.max(0, payment.amount - payment.refundedAmount)));
    setRefundNote("");
  };
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
        <h3 className="candidate-detail-section-title">Muhasebe Özeti</h3>
        {accountingLoading ? (
          <div className="instructor-detail-empty">Muhasebe bilgileri yükleniyor...</div>
        ) : accountingError ? (
          <div className="instructor-detail-error">{accountingError}</div>
        ) : accounting ? (
          <>
            <div className="candidate-billing-summary-grid">
              <div className="candidate-billing-summary-card">
                <span className="candidate-detail-stat-label">Toplam Borç</span>
                <strong>{formatCurrencyTRY(accounting.totalDebtAmount ?? accounting.totalMovementAmount)}</strong>
              </div>
              <div className="candidate-billing-summary-card">
                <span className="candidate-detail-stat-label">Tahsil Edilen</span>
                <strong>{formatCurrencyTRY(accounting.totalPaid)}</strong>
              </div>
              <div className="candidate-billing-summary-card is-balance">
                <span className="candidate-detail-stat-label">Kalan Bakiye</span>
                <strong>{formatCurrencyTRY(accounting.balance)}</strong>
              </div>
              <div className="candidate-billing-summary-card">
                <span className="candidate-detail-stat-label">İade / Fatura</span>
                <strong>
                  {formatCurrencyTRY(accounting.totalRefunded)} / {formatCurrencyTRY(accounting.invoiceTotal)}
                </strong>
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
                <span aria-hidden="true">{sectionSummaryOpen ? "Kapat" : "Aç"}</span>
              </button>
              {sectionSummaryOpen ? (
                <div className="candidate-accounting-section-summary" aria-label="Bölüm bazlı muhasebe özeti">
                  {sectionSummaries.map((section) => (
                    <div className="candidate-accounting-section-summary-row" key={section.id}>
                      <div className="candidate-accounting-section-summary-title">
                        <strong>{section.title}</strong>
                        <span>
                          {section.detail} · {section.movementCount} borçlandırma
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

      <section className="candidate-billing-action-bar">
        <div className="candidate-billing-action-meta">
          <span>Hızlı işlemler</span>
          <strong>Borçlandırma ekle, ödeme al veya fatura kaydet</strong>
        </div>
        <div className="candidate-billing-action-buttons">
          <button className="btn btn-primary" onClick={() => openDebtModal()} type="button">
            Borç Ekle
          </button>
          {feeSuggestions.length ? (
            <button
              className="btn btn-secondary"
              onClick={() => setFeeSuggestionsOpen((value) => !value)}
              type="button"
            >
              {feeSuggestionsOpen ? "Önerileri Gizle" : "Ücret Önerileri"}
            </button>
          ) : null}
          <button className="btn btn-secondary" onClick={() => openPaymentModal()} type="button">
            Ödeme Al
          </button>
          <button className="btn btn-secondary" onClick={() => openInvoiceModal()} type="button">
            Fatura Ekle
          </button>
        </div>
      </section>

      {feeSuggestionsOpen && feeSuggestions.length ? (
        <section className="instructor-detail-card candidate-billing-suggestion">
          <div className="candidate-billing-suggestion-meta">
            {feeSuggestions.map((suggestion) => (
              <button
                className="btn btn-secondary btn-sm"
                disabled={movementSaving}
                key={`${suggestion.feeType}:${suggestion.feeId}`}
                onClick={() =>
                  onCreateMovement(
                    suggestion.type,
                    todayIsoDate(),
                    suggestion.amount,
                    suggestion.description
                  )
                }
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
        onCancelMovement={onCancelMovement}
        onCancelPayment={(payment) => {
          setCancelPayment(payment);
          setPaymentCancelReason("");
        }}
        onCreateInvoice={(amount) => openInvoiceModal(null, amount)}
        onOpenReceipt={(payment) => setReceiptPayment(payment)}
        onOpenRefund={openRefundModal}
        onPay={(movement) => openPaymentModal(movement.type, String(movement.remainingAmount), movement.id)}
        payments={activePayments}
        refunds={accounting?.refunds ?? []}
        title="Kurs Ödemesi"
      />
      <AccountingMovementSection
        movements={sectionMovements(["teorik_sinav", "direksiyon_sinav"])}
        onCancelMovement={onCancelMovement}
        onCancelPayment={(payment) => {
          setCancelPayment(payment);
          setPaymentCancelReason("");
        }}
        onCreateInvoice={(amount) => openInvoiceModal(null, amount)}
        onOpenReceipt={(payment) => setReceiptPayment(payment)}
        onOpenRefund={openRefundModal}
        onPay={(movement) => openPaymentModal(movement.type, String(movement.remainingAmount), movement.id)}
        payments={activePayments}
        refunds={accounting?.refunds ?? []}
        title="Sınav Ücretleri"
      />
      <AccountingMovementSection
        movements={sectionMovements(["diger"])}
        onCancelMovement={onCancelMovement}
        onCancelPayment={(payment) => {
          setCancelPayment(payment);
          setPaymentCancelReason("");
        }}
        onCreateInvoice={(amount) => openInvoiceModal(null, amount)}
        onOpenReceipt={(payment) => setReceiptPayment(payment)}
        onOpenRefund={openRefundModal}
        onPay={(movement) => openPaymentModal(movement.type, String(movement.remainingAmount), movement.id)}
        payments={activePayments}
        refunds={accounting?.refunds ?? []}
        title="Diğer Ödemeler"
      />

      <section className="instructor-detail-card candidate-billing-workspace-card">
        <h3 className="candidate-detail-section-title">Faturalar</h3>
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
                    <button className="btn btn-secondary btn-sm" onClick={() => openInvoiceModal(invoice)} type="button">
                      Düzenle
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => onDeleteInvoice(invoice.id)} type="button">
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="instructor-detail-empty">Fatura kaydı yok.</div>
        )}
      </section>

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
              type="button"
            >
              {movementSaving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </>
        }
        onClose={() => setDebtModal((current) => ({ ...current, open: false }))}
        open={debtModal.open}
        title="Borç Ekle"
      >
        <AccountingTypePicker
          onChange={(type) => setDebtModal((current) => ({ ...current, type }))}
          value={debtModal.type}
        />
        <div className="candidate-accounting-modal-form">
          <label className="form-group">
            <span className="form-label">Vade Tarihi</span>
            <LocalizedDateInput className="form-input" onChange={(dueDate) => setDebtModal((current) => ({ ...current, dueDate }))} value={debtModal.dueDate} />
          </label>
          <label className="form-group">
            <span className="form-label">Tutar</span>
            <input className="form-input" inputMode="decimal" onChange={(event) => setDebtModal((current) => ({ ...current, amount: event.target.value }))} placeholder="0,00" value={debtModal.amount} />
          </label>
          <label className="form-group">
            <span className="form-label">Açıklama</span>
            <input className="form-input" onChange={(event) => setDebtModal((current) => ({ ...current, description: event.target.value }))} placeholder="1. taksit, ilk ödeme..." value={debtModal.description} />
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
                  paymentModal.paidAtUtc,
                  paymentModal.note.trim() || null,
                  paymentModal.movementId || null
                );
                setPaymentModal((current) => ({ ...current, open: false }));
              }}
              type="button"
            >
              {paymentSaving ? "Kaydediliyor..." : "Ödeme Kaydet"}
            </button>
          </>
        }
        onClose={() => setPaymentModal((current) => ({ ...current, open: false }))}
        open={paymentModal.open}
        title="Ödeme Al"
      >
        <AccountingTypePicker
          onChange={(type) => setPaymentModal((current) => ({ ...current, type, movementId: "" }))}
          value={paymentModal.type}
        />
        <div className="candidate-accounting-modal-form">
          <div className="form-group">
            <span className="form-label">Yöntem</span>
            <PaymentMethodPicker
              onChange={selectPaymentMethod}
              value={paymentModal.method}
            />
          </div>
          <div className="form-group">
            <span className="form-label">Kasa</span>
            <CashRegisterPicker
              disabled={!paymentNeedsRegister}
              onChange={(cashRegisterId) => setPaymentModal((current) => ({ ...current, cashRegisterId }))}
              registers={availableCashRegisters}
              value={paymentModal.cashRegisterId}
            />
          </div>
          <label className="form-group">
            <span className="form-label">Tutar</span>
            <input className="form-input" inputMode="decimal" onChange={(event) => setPaymentModal((current) => ({ ...current, amount: event.target.value }))} placeholder="0,00" value={paymentModal.amount} />
          </label>
          <label className="form-group">
            <span className="form-label">Ödeme Tarihi</span>
            <LocalizedDateInput className="form-input" onChange={(paidAtUtc) => setPaymentModal((current) => ({ ...current, paidAtUtc }))} value={paymentModal.paidAtUtc} />
          </label>
          <label className="form-group">
            <span className="form-label">Açıklama</span>
            <input className="form-input" onChange={(event) => setPaymentModal((current) => ({ ...current, note: event.target.value }))} placeholder="Ödeme açıklaması" value={paymentModal.note} />
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
              type="button"
            >
              {invoiceSaving ? "Kaydediliyor..." : "Fatura Kaydet"}
            </button>
          </>
        }
        onClose={() => setInvoiceModal((current) => ({ ...current, open: false }))}
        open={invoiceModal.open}
        title={invoiceModal.invoice ? "Fatura Düzenle" : "Fatura Ekle"}
      >
        <div className="candidate-accounting-modal-form">
          <label className="form-group">
            <span className="form-label">Fatura No</span>
            <input className="form-input" onChange={(event) => setInvoiceModal((current) => ({ ...current, invoiceNo: event.target.value }))} placeholder="Fatura No" value={invoiceModal.invoiceNo} />
          </label>
          <label className="form-group">
            <span className="form-label">Fatura Tipi</span>
            <input className="form-input" onChange={(event) => setInvoiceModal((current) => ({ ...current, invoiceType: event.target.value }))} placeholder="Satış" value={invoiceModal.invoiceType} />
          </label>
          <label className="form-group">
            <span className="form-label">Fatura Tarihi</span>
            <LocalizedDateInput className="form-input" onChange={(invoiceDate) => setInvoiceModal((current) => ({ ...current, invoiceDate }))} value={invoiceModal.invoiceDate} />
          </label>
          <label className="form-group">
            <span className="form-label">Tutar</span>
            <input className="form-input" inputMode="decimal" onChange={(event) => setInvoiceModal((current) => ({ ...current, subtotal: event.target.value }))} placeholder="0,00" value={invoiceModal.subtotal} />
          </label>
          <label className="form-group">
            <span className="form-label">KDV Oranı</span>
	            <CustomSelect className="form-select" onChange={(event) => setInvoiceModal((current) => ({ ...current, vatRate: event.target.value }))} value={invoiceModal.vatRate}>
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
            <input className="form-input" onChange={(event) => setInvoiceModal((current) => ({ ...current, notes: event.target.value }))} placeholder="Fatura notu" value={invoiceModal.notes} />
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
            <button className="btn btn-secondary" onClick={() => setCancelPayment(null)} type="button">Vazgeç</button>
            <button
              className="btn btn-primary"
              disabled={paymentCancelReason.trim().length < 3}
              onClick={() => {
                if (!cancelPayment) return;
                onCancelPayment(cancelPayment.id, paymentCancelReason.trim());
                setCancelPayment(null);
              }}
              type="button"
            >
              İptal Et
            </button>
          </>
        }
        onClose={() => setCancelPayment(null)}
        open={Boolean(cancelPayment)}
        title="Ödemeyi İptal Et"
      >
        <div className="candidate-accounting-modal-form">
          <label className="form-group">
            <span className="form-label">İptal Sebebi</span>
            <textarea className="form-input" onChange={(event) => setPaymentCancelReason(event.target.value)} placeholder="İptal sebebi" rows={3} value={paymentCancelReason} />
          </label>
        </div>
      </Modal>

      <Modal
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setRefundPayment(null)} type="button">Vazgeç</button>
            <button
              className="btn btn-primary"
              disabled={(parseMoneyInput(refundAmount) ?? 0) <= 0}
              onClick={() => {
                if (!refundPayment) return;
                onRefundPayment(refundPayment.id, parseMoneyInput(refundAmount), refundNote.trim() || null);
                setRefundPayment(null);
              }}
              type="button"
            >
              İade Et
            </button>
          </>
        }
        onClose={() => setRefundPayment(null)}
        open={Boolean(refundPayment)}
        title="İade Kaydet"
      >
        <div className="candidate-accounting-modal-form">
          <label className="form-group">
            <span className="form-label">İade Tutarı</span>
            <input className="form-input" inputMode="decimal" onChange={(event) => setRefundAmount(event.target.value)} placeholder="0,00" value={refundAmount} />
          </label>
          <label className="form-group">
            <span className="form-label">Açıklama</span>
            <input className="form-input" onChange={(event) => setRefundNote(event.target.value)} placeholder="İade açıklaması" value={refundNote} />
          </label>
        </div>
      </Modal>
    </div>
  );
}

function AccountingTypePicker({
  value,
  onChange,
}: {
  value: CandidateAccountingType;
  onChange: (value: CandidateAccountingType) => void;
}) {
  return (
    <div className="candidate-accounting-type-picker">
      {ACCOUNTING_TYPES.map((type) => (
        <button
          className={value === type ? "candidate-accounting-type active" : "candidate-accounting-type"}
          key={type}
          onClick={() => onChange(type)}
          type="button"
        >
          {accountingTypeLabel(type)}
        </button>
      ))}
    </div>
  );
}

function PaymentMethodPicker({
  value,
  onChange,
}: {
  value: CandidatePaymentMethod;
  onChange: (value: CandidatePaymentMethod) => void;
}) {
  return (
    <div className="candidate-accounting-type-picker candidate-accounting-method-picker">
      {PAYMENT_METHODS.map((method) => (
        <button
          className={value === method ? "candidate-accounting-type active" : "candidate-accounting-type"}
          key={method}
          onClick={() => onChange(method)}
          type="button"
        >
          {paymentMethodLabel(method)}
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
  onPay: (movement: CandidateAccountingSummaryResponse["movements"][number]) => void;
  onCancelMovement: (movementId: string) => void;
  onCancelPayment: (payment: CandidateAccountingSummaryResponse["payments"][number]) => void;
  onCreateInvoice: (amount: number) => void;
  onOpenReceipt: (payment: CandidateAccountingSummaryResponse["payments"][number]) => void;
  onOpenRefund: (payment: CandidateAccountingSummaryResponse["payments"][number]) => void;
}) {
  const [openActionMenu, setOpenActionMenu] = useState<{
    movementId: string;
    top: number;
    left: number;
  } | null>(null);
  const [sort, setSort] = useState<AccountingLedgerSortState>(null);
  const [filters, setFilters] = useState<AccountingLedgerFilters>(DEFAULT_ACCOUNTING_LEDGER_FILTERS);
  const { isVisible, toggle: toggleColumn } = useColumnVisibility(
    `candidate-accounting-ledger-columns:${title}`,
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
    setFilters((current) => ({ ...current, [key]: value }));
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
      { value: "all", label: "Tümü" },
      ...[...names].sort((a, b) => a.localeCompare(b, "tr")).map((name) => ({
        value: name,
        label: name,
      })),
    ];
  }, [payments, refunds]);

  const sortedMovements = useMemo(() => {
    if (!sort) return movements;

    return [...movements].sort((left, right) => {
      const result = compareAccountingSortValues(
        accountingMovementSortValue(left, payments, sort.field),
        accountingMovementSortValue(right, payments, sort.field)
      );
      return sort.direction === "asc" ? result : -result;
    });
  }, [movements, payments, sort]);

  const hasActiveFilters = Object.entries(filters).some(
    ([key, value]) => value !== DEFAULT_ACCOUNTING_LEDGER_FILTERS[key as AccountingLedgerFilterKey]
  );

  return (
    <section className="instructor-detail-card candidate-billing-workspace-card">
      <h3 className="candidate-detail-section-title">{title}</h3>
      {movements.length === 0 ? (
        <div className="instructor-detail-empty">Borçlandırma kaydı yok.</div>
      ) : (
        <table className="data-table candidate-detail-fee-table candidate-accounting-ledger-table">
          <thead>
            <tr>
              {visibleColumns.map((column) => {
                const filterControl = buildAccountingLedgerFilterControl(
                  column.id,
                  filters,
                  setFilter,
                  cashRegisterFilterOptions
                );
                return column.sortField ? (
                  <AccountingSortableTh
                    className={`candidate-accounting-col-${column.id}`}
                    field={column.sortField}
                    filterControl={filterControl}
                    key={column.id}
                    label={column.label}
                    onToggle={handleSortToggle}
                    sort={sort}
                  />
                ) : (
                  <th className={`candidate-accounting-col-${column.id}`} key={column.id}>
                    <div className="sortable-th-shell">
                      <span>{column.label}</span>
                      {filterControl ? <div className="sortable-th-filter">{filterControl}</div> : null}
                    </div>
                  </th>
                );
              })}
              <th className="col-picker-th">
                <ColumnPicker
                  columns={ACCOUNTING_LEDGER_COLUMN_OPTIONS}
                  isVisible={isVisible}
                  onToggle={toggleColumn}
                  triggerTitle="Sütunlar"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedMovements.flatMap((movement) => {
              const relatedPayments = payments
                .filter((item) =>
                  item.allocations.some((allocation) => allocation.movementId === movement.id)
                )
                .sort((left, right) => left.paidAtUtc.localeCompare(right.paidAtUtc));
              const hasPaymentHistory = relatedPayments.length > 0 || movement.paidAmount > 0 || movement.refundedAmount > 0;
              const status = accountingMovementStatus(movement);
              const canPay = movement.status === "active" && movement.remainingAmount > 0;
              const canCancelMovement = movement.status === "active" && !hasPaymentHistory;
              const displayDebtAmount = movement.status === "active" ? movement.remainingAmount : movement.amount;
              const canCreateInvoice = movement.status === "active" && displayDebtAmount > 0;
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
                  {childRows.map((row) => {
                    if (row.kind === "payment") {
                      return (
                        <tr className="candidate-accounting-transaction-row status-paid" key={`payment:${row.item.id}:${movement.id}`}>
                          {visibleColumns.map((column) => (
                            <td className={accountingLedgerCellClassName(column.id)} key={column.id}>
                              {renderAccountingPaymentCell({
                                columnId: column.id,
                                movement,
                                payment: row.item,
                                allocation: row.allocation,
                                openActionMenu,
                                toggleActionMenu,
                                closeActionMenu,
                                onOpenReceipt,
                                onOpenRefund,
                                onCancelPayment,
                              })}
                            </td>
                          ))}
                          <td className="col-picker-td" />
                        </tr>
                      );
                    }

                    return (
                      <tr className="candidate-accounting-transaction-row status-refunded" key={`refund:${row.refund.id}:${movement.id}`}>
                        {visibleColumns.map((column) => (
                          <td className={accountingLedgerCellClassName(column.id)} key={column.id}>
                            {renderAccountingRefundCell({
                              columnId: column.id,
                              movement,
                              payment: row.item,
                              refund: row.refund,
                              amount: row.amount,
                            })}
                          </td>
                        ))}
                        <td className="col-picker-td" />
                      </tr>
                    );
                  })}
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
                            openActionMenu,
                            toggleActionMenu,
                            closeActionMenu,
                            onPay,
                            onCreateInvoice,
                            onCancelMovement,
                          })}
                        </td>
                      ))}
                      <td className="col-picker-td" />
                    </tr>
                  ) : null}
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
  cashRegisterOptions: Array<{ value: string; label: string }>
) {
  if (columnId === "type") {
    return (
      <TableHeaderFilter
        active={filters.kind !== DEFAULT_ACCOUNTING_LEDGER_FILTERS.kind}
        onChange={(value) => setFilter("kind", value)}
        options={[
          { value: "all", label: "Tümü" },
          { value: "debt", label: "Borç" },
          { value: "payment", label: "Ödendi" },
          { value: "refund", label: "İade" },
        ]}
        title="Satır tipi"
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
          { value: "all", label: "Tümü" },
          ...PAYMENT_METHODS.map((method) => ({
            value: method,
            label: paymentMethodLabel(method),
          })),
        ]}
        title="Ödeme yöntemi"
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

  if (columnId === "actions") {
    return (
      <TableHeaderFilter
        active={filters.status !== DEFAULT_ACCOUNTING_LEDGER_FILTERS.status}
        onChange={(value) => setFilter("status", value)}
        options={[
          { value: "all", label: "Tümü" },
          { value: "active", label: "Aktif" },
          { value: "cancelled", label: "İptal" },
        ]}
        title="Durum"
        value={filters.status}
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
  if (filters.kind !== "all" && filters.kind !== "debt") return false;
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
  if (filters.kind !== "all" && filters.kind !== "payment") return false;
  if (filters.status === "cancelled") return false;
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
  if (filters.kind !== "all" && filters.kind !== "refund") return false;
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
    case "method":
      return movement.lastPaymentMethod ? paymentMethodLabel(movement.lastPaymentMethod) : "";
    case "cashRegister":
      return relatedPayment?.cashRegister?.name ?? "";
    case "refundedAmount":
      return movement.refundedAmount;
    case "paidAt":
      return movement.lastPaidAtUtc ?? "";
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
  openActionMenu,
  toggleActionMenu,
  closeActionMenu,
  onPay,
  onCreateInvoice,
  onCancelMovement,
}: {
  columnId: AccountingLedgerColumnId;
  movement: CandidateAccountingSummaryResponse["movements"][number];
  displayDebtAmount: number;
  status: { className: string; label: string };
  canPay: boolean;
  canCancelMovement: boolean;
  canCreateInvoice: boolean;
  openActionMenu: { movementId: string; top: number; left: number } | null;
  toggleActionMenu: (movementId: string, event: MouseEvent<HTMLButtonElement>) => void;
  closeActionMenu: () => void;
  onPay: (movement: CandidateAccountingSummaryResponse["movements"][number]) => void;
  onCreateInvoice: (amount: number) => void;
  onCancelMovement: (movementId: string) => void;
}) {
  if (columnId === "type") {
    return (
      <div className="candidate-accounting-type-cell">
        <span>{accountingTypeLabel(movement.type)}</span>
        <span className={`candidate-billing-installment-status ${status.className}`}>
          {status.label}
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
  if (columnId === "method") {
    return "—";
  }
  if (columnId === "cashRegister") return "—";
  if (columnId === "refundedAmount") {
    return "—";
  }
  if (columnId === "paidAt") {
    return "—";
  }

  const menuKey = `movement:${movement.id}`;
  return (
    <>
      <button
        className="candidate-accounting-actions-trigger"
        onClick={(event) => toggleActionMenu(menuKey, event)}
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
            <button className="candidate-accounting-action" onClick={() => { closeActionMenu(); onPay(movement); }} type="button">Öde</button>
          ) : null}
          {canCreateInvoice ? (
            <button className="candidate-accounting-action" onClick={() => { closeActionMenu(); onCreateInvoice(displayDebtAmount); }} type="button">Fatura</button>
          ) : null}
          {canCancelMovement ? (
            <button className="candidate-accounting-action is-danger" onClick={() => { closeActionMenu(); onCancelMovement(movement.id); }} type="button">Sil</button>
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
  openActionMenu,
  toggleActionMenu,
  closeActionMenu,
  onOpenReceipt,
  onOpenRefund,
  onCancelPayment,
}: {
  columnId: AccountingLedgerColumnId;
  movement: CandidateAccountingSummaryResponse["movements"][number];
  payment: CandidateAccountingSummaryResponse["payments"][number];
  allocation: CandidateAccountingSummaryResponse["payments"][number]["allocations"][number];
  openActionMenu: { movementId: string; top: number; left: number } | null;
  toggleActionMenu: (movementId: string, event: MouseEvent<HTMLButtonElement>) => void;
  closeActionMenu: () => void;
  onOpenReceipt: (payment: CandidateAccountingSummaryResponse["payments"][number]) => void;
  onOpenRefund: (payment: CandidateAccountingSummaryResponse["payments"][number]) => void;
  onCancelPayment: (payment: CandidateAccountingSummaryResponse["payments"][number]) => void;
}) {
  if (columnId === "type") {
    return (
      <div className="candidate-accounting-type-cell">
        <span>Ödendi</span>
        <span className="candidate-billing-installment-status status-paid">Tahsilat</span>
      </div>
    );
  }
  if (columnId === "description") return payment.note || "Ödeme";
  if (columnId === "dueDate") return formatDateTR(payment.paidAtUtc);
  if (columnId === "amount") return formatCurrencyTRY(allocation.amount);
  if (columnId === "paidAmount") return formatCurrencyTRY(allocation.amount);
  if (columnId === "remainingAmount") return "—";
  if (columnId === "number") return movement.number;
  if (columnId === "method") return paymentMethodLabel(payment.paymentMethod);
  if (columnId === "cashRegister") return payment.cashRegister?.name ?? "—";
  if (columnId === "refundedAmount") {
    return payment.refundedAmount > 0
      ? formatCurrencyTRY(refundShareForMovement(payment, movement.id, payment.refundedAmount))
      : "—";
  }
  if (columnId === "paidAt") return formatDateTR(payment.paidAtUtc);

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
        İşlemler
      </button>
      {openActionMenu?.movementId === rowKey ? (
        <div
          className="candidate-accounting-actions-menu"
          style={{ left: openActionMenu.left, top: openActionMenu.top }}
        >
          <button className="candidate-accounting-action" onClick={() => { closeActionMenu(); onOpenReceipt(payment); }} type="button">Makbuz</button>
          {refundableAmount > 0 ? (
            <button className="candidate-accounting-action" onClick={() => { closeActionMenu(); onOpenRefund(payment); }} type="button">İade</button>
          ) : null}
          {isCancellable ? (
            <button className="candidate-accounting-action is-danger" onClick={() => { closeActionMenu(); onCancelPayment(payment); }} type="button">İptal</button>
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
}: {
  columnId: AccountingLedgerColumnId;
  movement: CandidateAccountingSummaryResponse["movements"][number];
  payment: CandidateAccountingSummaryResponse["payments"][number];
  refund: CandidateAccountingSummaryResponse["refunds"][number];
  amount: number;
}) {
  if (columnId === "type") {
    return (
      <div className="candidate-accounting-type-cell">
        <span>İade</span>
        <span className="candidate-billing-installment-status status-refunded">Kasa çıkışı</span>
      </div>
    );
  }
  if (columnId === "description") return refund.note || "İade";
  if (columnId === "dueDate") return formatDateTR(refund.refundedAtUtc);
  if (columnId === "amount") return formatCurrencyTRY(amount);
  if (columnId === "paidAmount") return "—";
  if (columnId === "remainingAmount") return formatCurrencyTRY(amount);
  if (columnId === "number") return movement.number;
  if (columnId === "method") return "İade";
  if (columnId === "cashRegister") return refund.cashRegister?.name ?? payment.cashRegister?.name ?? "—";
  if (columnId === "refundedAmount") return formatCurrencyTRY(amount);
  if (columnId === "paidAt") return formatDateTR(refund.refundedAtUtc);
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
  if (!payment) return null;

  return (
    <Modal
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} type="button">Kapat</button>
          <button className="btn btn-primary" onClick={() => window.print()} type="button">Yazdır</button>
        </>
      }
      onClose={onClose}
      open={Boolean(payment)}
      title="Ödeme Makbuzu"
    >
      <div className="candidate-payment-receipt">
        <div className="candidate-payment-receipt-head">
          <div>
            <strong>Pilot Sürücü Kursu</strong>
            <span>Ödeme Makbuzu</span>
          </div>
          <div className="candidate-payment-receipt-no">
            #{payment.id.slice(0, 8).toLocaleUpperCase("tr-TR")}
          </div>
        </div>
        <div className="candidate-payment-receipt-amount">{formatCurrencyTRY(payment.amount)}</div>
        <dl className="candidate-payment-receipt-grid">
          <div><dt>Aday</dt><dd>{candidate.firstName} {candidate.lastName}</dd></div>
          <div><dt>TC Kimlik No</dt><dd>{candidate.nationalId}</dd></div>
          <div><dt>Tür</dt><dd>{accountingTypeLabel(payment.type)}</dd></div>
          <div><dt>Ödeme Tarihi</dt><dd>{formatDateTR(payment.paidAtUtc)}</dd></div>
          <div><dt>Ödeme Yöntemi</dt><dd>{paymentMethodLabel(payment.paymentMethod)}</dd></div>
          <div><dt>Kasa</dt><dd>{payment.cashRegister?.name ?? "—"}</dd></div>
          <div><dt>Açıklama</dt><dd>{payment.note ?? "—"}</dd></div>
        </dl>
        <div className="candidate-payment-receipt-footer">
          <span>Tahsil eden</span>
          <span>İmza</span>
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

function CandidateExamAttemptsSection({
  candidate,
  onAccountingChanged,
  onOpenAccountingPayment,
  onTheoryExemptChanged,
}: {
  candidate: CandidateResponse;
  onAccountingChanged?: () => Promise<void> | void;
  onOpenAccountingPayment?: (movementId: string) => void;
  onTheoryExemptChanged?: (value: boolean) => void;
}) {
  const { showToast } = useToast();
  const [exemptSaving, setExemptSaving] = useState(false);
  const isTheoryExempt = candidate.isTheoryExempt ?? false;
  const toggleTheoryExempt = async () => {
    const next = !isTheoryExempt;
    setExemptSaving(true);
    try {
      await setCandidateTheoryExemption(candidate.id, next);
      onTheoryExemptChanged?.(next);
    } catch {
      showToast("Muafiyet durumu güncellenemedi.", "error");
    } finally {
      setExemptSaving(false);
    }
  };
  const [attempts, setAttempts] = useState<CandidateExamAttemptResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rowSavingId, setRowSavingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<VehicleResponse[]>([]);
  const [instructors, setInstructors] = useState<InstructorResponse[]>([]);
  const [form, setForm] = useState({
    examType: "theory" as CandidateExamType,
    scheduledAt: combineDateAndTimeLocal(todayIsoDate(), "00:00"),
    expiresAt: "",
    vehicleId: "",
    instructorId: "",
    examAttendanceStatus: "" as "" | "attended" | "absent",
    examResultStatus: "" as "" | "passed" | "failed",
    score: "",
    fee: "",
  });
  const [suggestedFee, setSuggestedFee] = useState<number | null>(null);
  const [feeTouched, setFeeTouched] = useState(false);
  const [suggestedFeesByKey, setSuggestedFeesByKey] = useState<Record<string, number | null>>({});
  const theoryAttempts = attempts.filter((attempt) => attempt.examType === "theory");
  const practiceAttempts = attempts.filter((attempt) => attempt.examType === "practice");
  const theoryExpiryDate = addDaysToISODate(
    datePartFromDateTimeLocal(form.scheduledAt),
    THEORY_EXAM_EXPIRY_DAYS
  );

  const reload = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await listCandidateExamAttempts(candidate.id, signal);
      setAttempts(response);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError("E-sınav denemeleri yüklenemedi.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    getVehicles({ activity: "active", page: 1, pageSize: 500 }, controller.signal)
      .then((response) => setVehicles(response.items))
      .catch(() => setVehicles([]));
    getInstructors({ activity: "active", page: 1, pageSize: 500 }, controller.signal)
      .then((response) => setInstructors(response.items))
      .catch(() => setInstructors([]));
    return () => controller.abort();
  }, [candidate.id]);

  useEffect(() => {
    if (!candidate.certificateProgramId || !form.scheduledAt) {
      setSuggestedFee(null);
      return;
    }
    const controller = new AbortController();
    const year = new Date(form.scheduledAt).getFullYear();
    getCertificateProgramFeeMatrix(year, { targetLicenseClass: candidate.licenseClass }, controller.signal)
      .then((matrix) => {
        const row = matrix.rows.find(
          (item) =>
            item.program.id === candidate.certificateProgramId &&
            item.lessonType === form.examType
        );
        const attemptNumber = nextCandidateExamAttemptNumber(attempts, form.examType);
        const value = suggestedCandidateExamFee(row, form.examType, attemptNumber);
        setSuggestedFee(value ?? null);
        setForm((current) =>
          feeTouched || current.fee
            ? current
            : { ...current, fee: value != null ? String(value) : "" }
        );
      })
      .catch((err) => {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setSuggestedFee(null);
        }
      });
    return () => controller.abort();
  }, [
    attempts,
    candidate.certificateProgramId,
    candidate.licenseClass,
    feeTouched,
    form.examType,
    form.scheduledAt,
  ]);

  useEffect(() => {
    if (!candidate.certificateProgramId || attempts.length === 0) {
      setSuggestedFeesByKey({});
      return;
    }
    const controller = new AbortController();
    const years = [...new Set(attempts.map((attempt) => new Date(attempt.scheduledAt).getFullYear()))];
    Promise.all(
      years.map((year) =>
        getCertificateProgramFeeMatrix(year, { targetLicenseClass: candidate.licenseClass }, controller.signal)
          .then((matrix) => {
            const theoryRow = matrix.rows.find(
              (row) => row.program.id === candidate.certificateProgramId && row.lessonType === "theory"
            );
            const practiceRow = matrix.rows.find(
              (row) => row.program.id === candidate.certificateProgramId && row.lessonType === "practice"
            );
            return {
              year,
              theory: theoryRow?.institutionTheoryExamFee ?? null,
              practice: practiceRow?.institutionPracticeExamFee ?? null,
              practiceRetry: practiceRow?.program.failureRetryFee ?? null,
            };
          })
      )
    )
      .then((items) => {
        const next: Record<string, number | null> = {};
        for (const item of items) {
          next[`${item.year}:theory`] = item.theory;
          next[`${item.year}:practice`] = item.practice;
          next[`${item.year}:practice:retry`] = item.practiceRetry;
        }
        setSuggestedFeesByKey(next);
      })
      .catch((err) => {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setSuggestedFeesByKey({});
        }
      });
    return () => controller.abort();
  }, [attempts, candidate.certificateProgramId, candidate.licenseClass]);

  const nextAttemptNumber = (examType: CandidateExamType) => {
    return nextCandidateExamAttemptNumber(attempts, examType);
  };

  const openAddForm = (examType: CandidateExamType = "theory") => {
    setFeeTouched(false);
    setForm({
      examType,
      scheduledAt: combineDateAndTimeLocal(todayIsoDate(), "00:00"),
      expiresAt: "",
      vehicleId: "",
      instructorId: "",
      examAttendanceStatus: "",
      examResultStatus: "",
      score: "",
      fee: "",
    });
    setAddOpen(true);
  };

  const createAttempt = async () => {
    const fee = parseMoneyInput(form.fee) ?? 0;
    const attemptNumber = nextAttemptNumber(form.examType);
    if (attemptNumber > 4) {
      showToast("Bu sınav tipi için 4 hak dolmuş.", "error");
      return;
    }
    if (!form.scheduledAt) {
      showToast("Sınav tarih-saati zorunlu.", "error");
      return;
    }
    if (form.examType === "practice" && !form.vehicleId) {
      showToast("Direksiyon sınavı için plaka seçilmeli.", "error");
      return;
    }
    if (form.examType === "practice" && !form.instructorId) {
      showToast("Direksiyon sınavı için usta öğretici seçilmeli.", "error");
      return;
    }
    if (form.examType === "practice" && form.examAttendanceStatus !== "attended" && form.examResultStatus) {
      showToast("Sınav sonucu sadece aday sınava girdiyse seçilebilir.", "error");
      return;
    }
    // Score 0..100 opsiyonel; boş ise null gönderilir.
    const trimmedScore = form.score.trim();
    let scoreValue: number | null = null;
    if (trimmedScore !== "") {
      if (!/^\d{1,3}$/.test(trimmedScore)) {
        showToast("Puan sadece 0-100 arası tam sayı olmalı.", "error");
        return;
      }
      const parsedScore = Number.parseInt(trimmedScore, 10);
      if (parsedScore > 100) {
        showToast("Puan 0-100 arası olmalı.", "error");
        return;
      }
      scoreValue = parsedScore;
    }

    setSaving(true);
    try {
      const vehicle = vehicles.find((item) => item.id === form.vehicleId);
      const instructor = instructors.find((item) => item.id === form.instructorId);
      const isPractice = form.examType === "practice";
      const created = await createCandidateExamAttempt(candidate.id, {
        examType: form.examType,
        scheduledAt: fromDateTimeLocalValue(form.scheduledAt),
        attemptNumber,
        score: scoreValue,
        expiresAt: isPractice
          ? form.expiresAt
            ? new Date(`${form.expiresAt}T00:00:00`).toISOString()
            : null
          : null,
        vehicleId: isPractice ? vehicle?.id ?? null : null,
        vehiclePlate: isPractice ? vehicle?.plateNumber ?? null : null,
        instructorId: isPractice ? instructor?.id ?? null : null,
        instructorFullName: isPractice && instructor ? `${instructor.firstName} ${instructor.lastName}` : null,
        examAttendanceStatus: isPractice ? form.examAttendanceStatus || null : null,
        examResultStatus: isPractice && form.examAttendanceStatus === "attended" ? form.examResultStatus || null : null,
        fee,
        feeStatus: "pending",
      });
      setAttempts((items) => [...items, created].sort(compareExamAttempts));
      setAddOpen(false);
      showToast("Yeni e-sınav denemesi eklendi");
    } catch (error) {
      showToast(examAttemptCreateErrorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };

  const chargeAttempt = async (attempt: CandidateExamAttemptResponse) => {
    setRowSavingId(attempt.id);
    try {
      const updated = await chargeCandidateExamAttempt(candidate.id, attempt.id);
      setAttempts((items) => items.map((item) => item.id === updated.id ? updated : item));
      try {
        await onAccountingChanged?.();
      } catch {
        showToast("Muhasebe bilgileri güncellenemedi.", "error");
      }
      showToast("E-sınav ücreti borçlandırıldı");
    } catch {
      showToast("Borçlandırma yapılamadı.", "error");
    } finally {
      setRowSavingId(null);
    }
  };

  const updateAttemptScore = async (
    attempt: CandidateExamAttemptResponse,
    nextScore: number | null
  ): Promise<boolean> => {
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
      setAttempts((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      showToast(nextScore == null ? "Puan silindi" : `Puan kaydedildi (${nextScore})`);
      return true;
    } catch (error) {
      const message = error instanceof ApiError && error.status === 409
        ? "Bilgiler başka biri tarafından güncellendi. Sayfayı yenileyin."
        : "Puan kaydedilemedi.";
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
      showToast("Sınav ücreti kendi ödedi olarak işaretlendi");
    } catch {
      showToast("Kendi ödedi işaretlenemedi.", "error");
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
      if (!updated.accountingMovementId) {
        showToast("Ödenecek muhasebe borcu bulunamadı.", "error");
        return;
      }

      onOpenAccountingPayment?.(updated.accountingMovementId);
    } catch {
      showToast("Muhasebe borcu oluşturulamadı.", "error");
    } finally {
      setRowSavingId(null);
    }
  };


  const confirmDelete = async (attempt: CandidateExamAttemptResponse) => {
    setRowSavingId(attempt.id);
    try {
      await deleteCandidateExamAttempt(candidate.id, attempt.id);
      setAttempts((items) => items.filter((item) => item.id !== attempt.id));
      setDeleteConfirmId(null);
      showToast("E-sınav denemesi silindi");
    } catch (error) {
      if (error instanceof ApiError && error.errorCode === "candidateExamAttemptHasAccountingMovement") {
        setDeleteConfirmId(null);
        showToast("Bu sınav için ödeme/borç kaydı bulunuyor. Önce ödemeyi iade edin veya borcu iptal edin.", "error");
      } else {
        showToast("E-sınav denemesi silinemedi.", "error");
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
          <h3 className="candidate-detail-section-title">E-Sınav</h3>
          {!loading && !error ? (
            <div className="candidate-exam-attempts-head-actions">
              <label
                className="switch-toggle candidate-exam-attempts-muaf-toggle"
                title="Aday teori sınavından muaf"
              >
                <input
                  type="checkbox"
                  checked={isTheoryExempt}
                  disabled={exemptSaving}
                  onChange={toggleTheoryExempt}
                />
                <span className="switch-toggle-control" aria-hidden="true" />
                <span>Muaf</span>
              </label>
              <button className="btn btn-primary btn-sm candidate-exam-add-button" onClick={() => openAddForm("theory")} type="button">
                Yeni
              </button>
            </div>
          ) : null}
        </div>
        {loading ? (
          <div className="instructor-detail-empty">Yükleniyor...</div>
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
                  <th>Hakkın yanacağı tarih</th>
                  <th>Sınav ücreti</th>
                  <th>Ücret Durumu</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {theoryAttempts.length === 0 ? (
                  <tr>
                    <td className="data-table-empty" colSpan={7}>Henüz e-sınav denemesi yok.</td>
                  </tr>
                ) : theoryAttempts.map((attempt) => (
                  <CandidateExamAttemptRow
                    attempt={attempt}
                    disabled={rowSavingId === attempt.id}
                    deleteConfirmOpen={deleteConfirmId === attempt.id}
                    key={attempt.id}
                    onCharge={() => chargeAttempt(attempt)}
                    onCancelDelete={() => setDeleteConfirmId(null)}
                    onConfirmDelete={() => void confirmDelete(attempt)}
                    onRequestDelete={() => setDeleteConfirmId(attempt.id)}
                    onPay={() => void payAttempt(attempt)}
                    onSelfPaid={() => markSelfPaid(attempt)}
                    onScoreSave={(nextScore) => updateAttemptScore(attempt, nextScore)}
                    suggestedFee={suggestedFeesByKey[suggestedFeeLookupKeyForAttempt(attempt)] ?? null}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="instructor-detail-card candidate-exam-attempts-section">
        <div className="candidate-exam-attempts-head">
          <h3 className="candidate-detail-section-title">Direksiyon</h3>
          {!loading && !error ? (
            <button className="btn btn-primary btn-sm candidate-exam-add-button" onClick={() => openAddForm("practice")} type="button">
              Yeni
            </button>
          ) : null}
        </div>
        {loading ? (
          <div className="instructor-detail-empty">Yükleniyor...</div>
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
                  <th>Puan</th>
                  <th>Sınav Ücreti</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {practiceAttempts.length === 0 ? (
                  <tr>
                    <td className="data-table-empty" colSpan={9}>Henüz direksiyon sınavı yok.</td>
                  </tr>
                ) : practiceAttempts.map((attempt) => (
                  <CandidatePracticeExamAttemptRow
                    attempt={attempt}
                    disabled={rowSavingId === attempt.id}
                    deleteConfirmOpen={deleteConfirmId === attempt.id}
                    key={attempt.id}
                    onCancelDelete={() => setDeleteConfirmId(null)}
                    onConfirmDelete={() => void confirmDelete(attempt)}
                    onRequestDelete={() => setDeleteConfirmId(attempt.id)}
                    onScoreSave={(nextScore) => updateAttemptScore(attempt, nextScore)}
                    suggestedFee={suggestedFeesByKey[suggestedFeeLookupKeyForAttempt(attempt)] ?? null}
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
            <button className="btn btn-secondary" disabled={saving} onClick={() => setAddOpen(false)} type="button">
              Vazgeç
            </button>
            <button className="btn btn-primary" disabled={saving} onClick={createAttempt} type="button">
              Kaydet
            </button>
          </>
        }
        onClose={() => setAddOpen(false)}
        open={addOpen}
        title={form.examType === "practice" ? "Yeni direksiyon sınavı" : "Yeni e-sınav"}
      >
        <div className="candidate-exam-attempt-form">
          <label>
            <span>Sınav tipi</span>
            <CustomSelect
              className="form-select"
              value={form.examType}
              onChange={(event) => {
                setFeeTouched(false);
                setForm((current) => ({
                  ...current,
                  examType: event.target.value as CandidateExamType,
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
          <label>
            <span>Hak</span>
            <input readOnly value={`${Math.min(nextAttemptNumber(form.examType), 4)}/4`} />
          </label>
          {form.examType === "theory" ? (
            <label>
              <span>Yanma tarihi</span>
              <input
                className="form-input"
                readOnly
                title={`Sınav tarihinden ${THEORY_EXAM_EXPIRY_DAYS} gün sonrası otomatik hesaplanır.`}
                value={formatDateTR(theoryExpiryDate)}
              />
            </label>
          ) : (
            <label>
              <span>Yanma tarihi</span>
              <LocalizedDateInput
                className="form-input"
                lang="tr-TR"
                onChange={(expiresAt) => setForm((current) => ({ ...current, expiresAt }))}
                value={form.expiresAt}
              />
            </label>
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
                      examAttendanceStatus: event.target.value as "" | "attended" | "absent",
                      examResultStatus: event.target.value === "attended" ? current.examResultStatus : "",
                    }))
                  }
                  value={form.examAttendanceStatus}
                >
                  <option value="">—</option>
                  <option value="attended">Girdi</option>
                  <option value="absent">Girmedi</option>
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
                  <option value="passed">Başarılı</option>
                  <option value="failed">Başarısız</option>
                </CustomSelect>
              </label>
            </>
          ) : null}
          <label>
            <span>
              Sınav ücreti{suggestedFee != null ? ` (${formatCurrencyTRY(suggestedFee)})` : ""}
            </span>
            <input
              min="0"
              type="number"
              value={form.fee}
              onChange={(event) => {
                setFeeTouched(true);
                setForm((current) => ({ ...current, fee: event.target.value }));
              }}
            />
          </label>
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
        </div>
      </Modal>

    </>
  );
}

function CandidateExamAttemptRow({
  attempt,
  disabled,
  deleteConfirmOpen,
  onCharge,
  onCancelDelete,
  onConfirmDelete,
  onPay,
  onRequestDelete,
  onSelfPaid,
  onScoreSave,
  suggestedFee,
}: {
  attempt: CandidateExamAttemptResponse;
  disabled: boolean;
  deleteConfirmOpen: boolean;
  onCharge: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onPay: () => void;
  onRequestDelete: () => void;
  onSelfPaid: () => void;
  onScoreSave: (nextScore: number | null) => Promise<boolean>;
  suggestedFee: number | null;
}) {
  const expiry = getExpiryDisplay(attempt.expiresAt);

  return (
    <tr>
      <td>{formatDateTimeTR(attempt.scheduledAt)}</td>
      <td>{attempt.attemptNumber}/4</td>
      <td>
        <EditableScoreCell
          score={attempt.score}
          disabled={disabled}
          onSave={onScoreSave}
        />
      </td>
      <td>
        {attempt.expiresAt ? (
          <div className={`candidate-exam-expiry ${expiry.kind}`}>
            <span>{formatDateTR(attempt.expiresAt)}</span>
            <small>{expiry.label}</small>
          </div>
        ) : "—"}
      </td>
      <td>
        <div className="candidate-exam-fee-cell">
          {suggestedFee != null && suggestedFee !== attempt.fee ? (
            <>
              <em>{formatCurrencyTRY(suggestedFee)}</em>
              <strong>{formatCurrencyTRY(attempt.fee)}</strong>
            </>
          ) : (
            <strong>{formatCurrencyTRY(attempt.fee)}</strong>
          )}
        </div>
      </td>
      <td>
        <div className="candidate-exam-fee-status">
          <span className={`candidate-exam-pill ${feeStatusKind(attempt.feeStatus)}`}>
            {feeStatusLabel(attempt.feeStatus)}
          </span>
          {attempt.feeStatus === "pending" ? (
            <>
              <button className="btn btn-secondary btn-sm" disabled={disabled} onClick={onCharge} type="button">
                Borçlandır
              </button>
              <button className="btn btn-secondary btn-sm" disabled={disabled} onClick={onSelfPaid} type="button">
                Kendi ödedi
              </button>
            </>
          ) : attempt.feeStatus === "charged" ? (
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
      </td>
      <td>
        <InlineDeleteConfirm
          disabled={disabled}
          open={deleteConfirmOpen}
          onCancel={onCancelDelete}
          onConfirm={onConfirmDelete}
          onRequest={onRequestDelete}
        />
      </td>
    </tr>
  );
}

function CandidatePracticeExamAttemptRow({
  attempt,
  disabled,
  deleteConfirmOpen,
  onCancelDelete,
  onConfirmDelete,
  onRequestDelete,
  onScoreSave,
  suggestedFee,
}: {
  attempt: CandidateExamAttemptResponse;
  disabled: boolean;
  deleteConfirmOpen: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onRequestDelete: () => void;
  onScoreSave: (nextScore: number | null) => Promise<boolean>;
  suggestedFee: number | null;
}) {
  return (
    <tr>
      <td>{formatDateTimeTR(attempt.scheduledAt)}</td>
      <td>{attempt.vehiclePlate ?? "—"}</td>
      <td>{attempt.instructorFullName ?? "—"}</td>
      <td>{attempt.attemptNumber}/4</td>
      <td>{practiceAttendanceLabel(attempt.examAttendanceStatus)}</td>
      <td>{practiceResultLabel(attempt.examResultStatus)}</td>
      <td>
        <EditableScoreCell
          score={attempt.score}
          disabled={disabled}
          onSave={onScoreSave}
        />
      </td>
      <td>
        <div className="candidate-exam-fee-cell">
          {suggestedFee != null && suggestedFee !== attempt.fee ? (
            <>
              <em>{formatCurrencyTRY(suggestedFee)}</em>
              <strong>{formatCurrencyTRY(attempt.fee)}</strong>
            </>
          ) : (
            <strong>{formatCurrencyTRY(attempt.fee)}</strong>
          )}
        </div>
      </td>
      <td>
        <InlineDeleteConfirm
          disabled={disabled}
          open={deleteConfirmOpen}
          onCancel={onCancelDelete}
          onConfirm={onConfirmDelete}
          onRequest={onRequestDelete}
        />
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
      showToast("Puan sadece 0-100 arası tam sayı olmalı", "error");
      setDraft(score != null ? String(score) : "");
      setEditing(false);
      return;
    } else {
      const parsed = Number.parseInt(raw, 10);
      if (parsed > 100) {
        showToast("Puan 0-100 arası olmalı", "error");
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
        title="Puanı düzenlemek için tıkla"
      >
        <span>{score ?? "—"}</span>
        {scoreStatus ? (
          <span className={`candidate-exam-pill ${scoreStatus.kind}`}>{scoreStatus.label}</span>
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
      <button className="btn btn-danger btn-sm" disabled={disabled} onClick={onRequest} type="button">
        Sil
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

function getScoreStatus(score: number | null): { label: string; kind: "success" | "danger" } | null {
  if (score == null) return null;
  return score >= 70 ? { label: "Geçti", kind: "success" } : { label: "Kaldı", kind: "danger" };
}

function getExpiryDisplay(expiresAt: string | null): { label: string; kind: "normal" | "warning" | "danger" } {
  if (!expiresAt) return { label: "—", kind: "normal" };
  const today = new Date(todayIsoDate());
  const expires = new Date(expiresAt);
  const days = Math.ceil((expires.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { label: "Süresi doldu", kind: "danger" };
  if (days < 30) return { label: `${days} gün kaldı`, kind: "warning" };
  return { label: `${days} gün kaldı`, kind: "normal" };
}

function feeStatusLabel(status: CandidateExamFeeStatus): string {
  if (status === "paid") return "Yatırıldı";
  if (status === "charged") return "Borçlandırıldı";
  return "Hayır";
}

function feeStatusKind(status: CandidateExamFeeStatus): "success" | "warning" | "danger" {
  if (status === "paid") return "success";
  if (status === "charged") return "warning";
  return "danger";
}

function practiceAttendanceLabel(status: CandidateExamAttemptResponse["examAttendanceStatus"]): string {
  if (status === "attended") return "Girdi";
  if (status === "absent") return "Girmedi";
  return "—";
}

function practiceResultLabel(status: CandidateExamAttemptResponse["examResultStatus"]): string {
  if (status === "passed") return "Başarılı";
  if (status === "failed") return "Başarısız";
  return "—";
}

function formatFileSize(bytes: number | null): string | null {
  if (bytes == null || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type CandidateDocumentStatus = "uploaded" | "physical" | "missing";
type CandidateDocumentFilter = "all" | "missing" | "available" | "mebbis";
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

const HEALTH_REPORT_FOREIGN_LANGUAGES: Array<{ value: string; label: string }> = [
  { value: "arabic", label: "Arapça" },
  { value: "chinese", label: "Çince" },
  { value: "english", label: "İngilizce" },
  { value: "german", label: "Almanca" },
  { value: "french", label: "Fransızca" },
  { value: "persian", label: "Farsça" },
  { value: "russian", label: "Rusça" },
  { value: "spanish", label: "İspanyolca" },
];

const HEALTH_REPORT_DISABILITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "none", label: "Engeli Yok" },
  {
    value: "orthopedic_hands",
    label: "Ortopedik Engelli (Ellerini ve/veya Kollarını Kullanamıyor)",
  },
  {
    value: "orthopedic_legs",
    label: "Ortopedik Engelli (Yürüyemiyor ve/veya Ayaklarında Problem Var)",
  },
  { value: "hearing_speech", label: "İşitme, Dil veya Konuşma Engelli" },
  { value: "vision_one_eye", label: "Görme Engelli (Bir Gözü Görmüyor)" },
  { value: "vision_low", label: "Görme Engelli (Büyüteç Yardımı İle Görebiliyor)" },
  { value: "chronic_illness", label: "Süreğen Hastalığı Var" },
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

function buildDocumentMetadataValues(
  fields: ReadonlyArray<DocumentMetadataField>,
  upload: DocumentResponse | null
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    values[field.key] = upload?.metadata?.[field.key] ?? "";
  }
  return values;
}

function DocumentsTab({
  candidateId,
  documents,
  documentTypes,
  loading,
  error,
  onRefresh,
  onDeleted,
}: {
  candidateId: string;
  documents: DocumentResponse[] | null;
  documentTypes: DocumentTypeResponse[] | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
  onDeleted: () => void;
}) {
  const { showToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<CandidateDocumentFilter>("all");
  const [bulkMebbisLoading, setBulkMebbisLoading] = useState(false);
  const [candidateSyncQueuing, setCandidateSyncQueuing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteCandidate = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteCandidate(candidateId);
      showToast("Aday silindi");
      onDeleted();
    } catch {
      showToast("Aday silinemedi", "error");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="instructor-detail-card instructor-detail-empty">Yükleniyor...</div>;
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
  const heroTypes = HERO_DOCUMENT_KEYS
    .map((key) => sortedTypes.find((t) => t.key === key))
    .filter((t): t is DocumentTypeResponse => t !== undefined);
  const photoTypes = PHOTO_DOCUMENT_TYPE_KEYS
    .map((key) => sortedTypes.find((t) => t.key === key))
    .filter((t): t is DocumentTypeResponse => t !== undefined);
  const contractTypes = CONTRACT_GROUP_DOCUMENT_TYPE_KEYS
    .map((key) => sortedTypes.find((t) => t.key === key))
    .filter((t): t is DocumentTypeResponse => t !== undefined);
  const requiredTypes = sortedTypes.filter(
    (t) =>
      t.isRequired &&
      !HERO_DOCUMENT_KEYS.includes(t.key as HeroDocumentKey) &&
      !PHOTO_DOCUMENT_TYPE_KEYS.includes(t.key as (typeof PHOTO_DOCUMENT_TYPE_KEYS)[number]) &&
      !CONTRACT_GROUP_DOCUMENT_TYPE_KEYS.includes(
        t.key as (typeof CONTRACT_GROUP_DOCUMENT_TYPE_KEYS)[number]
      )
  );
  const optionalTypes = sortedTypes.filter(
    (t) =>
      !t.isRequired &&
      !PHOTO_DOCUMENT_TYPE_KEYS.includes(t.key as (typeof PHOTO_DOCUMENT_TYPE_KEYS)[number]) &&
      !CONTRACT_GROUP_DOCUMENT_TYPE_KEYS.includes(
        t.key as (typeof CONTRACT_GROUP_DOCUMENT_TYPE_KEYS)[number]
      )
  );
  const statusCounts = sortedTypes.reduce(
    (acc, type) => {
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
    { key: "all", label: "Tümü", count: sortedTypes.length },
    { key: "missing", label: "Eksik", count: statusCounts.missing },
    { key: "available", label: "Yüklü", count: statusCounts.available },
    { key: "mebbis", label: "Mebbis", count: statusCounts.mebbis },
  ];
  const matchesFilter = (type: DocumentTypeResponse) => {
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
  const pendingMebbisTypes = sortedTypes.filter((type) => {
    const upload = uploadsByKey.get(type.key) ?? null;
    return getCandidateDocumentStatus(upload) !== "missing" && upload?.isMebbisTransferred !== true;
  });

  const handleBulkMebbisTransfer = async () => {
    if (bulkMebbisLoading || pendingMebbisTypes.length === 0) return;
    setBulkMebbisLoading(true);
    try {
      const results = await Promise.allSettled(
        pendingMebbisTypes.map((type) =>
          updateCandidateDocumentMebbisTransfer(candidateId, type.id, true)
        )
      );
      const successCount = results.filter((result) => result.status === "fulfilled").length;
      const failureCount = results.length - successCount;
      await onRefresh();
      if (failureCount > 0 && successCount > 0) {
        showToast(`${successCount} evrak Mebbis işaretlendi, ${failureCount} evrak işaretlenemedi`, "error");
      } else if (failureCount > 0) {
        showToast("Evraklar Mebbis işaretlenemedi", "error");
      } else {
        showToast(`${successCount} evrak Mebbis işaretlendi`);
      }
    } catch {
      showToast("Evraklar Mebbis işaretlenemedi", "error");
    } finally {
      setBulkMebbisLoading(false);
    }
  };

  const handleQueueCandidateSync = async () => {
    if (candidateSyncQueuing) return;
    setCandidateSyncQueuing(true);
    try {
      const job = await createCandidateSyncJob(candidateId);
      notifyMebbisJobQueued(job.id, job.jobType);
      showToast("Aday dönem kaydı kuyruğa alındı");
    } catch {
      showToast("Aday dönem kaydı kuyruğa alınamadı", "error");
    } finally {
      setCandidateSyncQueuing(false);
    }
  };

  return (
    <div className="candidate-detail-tab-content">
      <section className="instructor-detail-card candidate-detail-doc-actions-card">
        <div className="candidate-detail-doc-actions-grid">
          <div className="candidate-detail-doc-actions-column">
            <h3 className="candidate-detail-section-title">Aday Kontrol</h3>
            <ul className="candidate-detail-doc-checklist">
              {[
                "Tüm zorunlu evraklar yüklü",
                "Biyometrik ve webcam fotoğrafları tamam",
                "Ehliyet sınıfı ve mevcut belge bilgisi girildi",
                "Aktif gruba atandı",
                "Kayıt ücreti tahsil edildi",
              ].map((item) => (
                <li key={item} className="candidate-detail-doc-checklist-item">
                  <span className="candidate-detail-doc-checklist-mark" aria-hidden="true">
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="candidate-detail-doc-actions-column">
            <h3 className="candidate-detail-section-title">İşlemler</h3>
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
                  disabled={deleting}
                  onClick={handleDeleteCandidate}
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
                    disabled={bulkMebbisLoading || pendingMebbisTypes.length === 0}
                    onClick={handleBulkMebbisTransfer}
                    type="button"
                  >
                    {bulkMebbisLoading ? "İşaretleniyor..." : "Mebbis İşaretle"}
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={candidateSyncQueuing}
                    onClick={handleQueueCandidateSync}
                    type="button"
                  >
                    {candidateSyncQueuing ? "Kuyruğa alınıyor..." : "Döneme Kaydet"}
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled
                    type="button"
                    title="Yakında"
                  >
                    Döneme Kaydet ve Aktar
                  </button>
                </div>
                <button
                  className="btn btn-danger btn-sm candidate-detail-doc-actions-delete"
                  onClick={() => setConfirmDelete(true)}
                  type="button"
                >
                  Aday Sil
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="instructor-detail-card candidate-detail-doc-overview">
        <div className="candidate-detail-doc-overview-head">
          <div>
            <h3 className="candidate-detail-section-title">Evrak Durumu</h3>
            <p className="candidate-detail-doc-overview-note">
              {pendingMebbisTypes.length > 0
                ? `${pendingMebbisTypes.length} evrak Mebbis işareti bekliyor.`
                : "Mebbis işareti bekleyen evrak yok."}
            </p>
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
        </div>
      </section>

      {contractTypes.length > 0 && (
        <section className="instructor-detail-card">
          <h3 className="candidate-detail-section-title">Sözleşme</h3>
          <ul className="candidate-detail-doc-list candidate-detail-doc-contract-grid">
            {contractTypes.filter(matchesFilter).map((type) => (
              <DocRow
                candidateId={candidateId}
                key={type.id}
                onRefresh={onRefresh}
                type={type}
                upload={uploadsByKey.get(type.key) ?? null}
              />
            ))}
          </ul>
        </section>
      )}

      {heroTypes.length > 0 && (
        <section className="instructor-detail-card candidate-detail-doc-hero-card">
          <h3 className="candidate-detail-section-title">Zorunlu Evraklar</h3>
          <div className="candidate-detail-doc-hero-grid">
            {heroTypes.map((type) => (
              <HeroDocumentCard
                candidateId={candidateId}
                key={type.id}
                onRefresh={onRefresh}
                type={type}
                upload={uploadsByKey.get(type.key) ?? null}
              />
            ))}
          </div>
        </section>
      )}

      {photoTypes.length > 0 && (
        <section className="instructor-detail-card">
          <h3 className="candidate-detail-section-title">Fotoğraflar</h3>
          <ul className="candidate-detail-doc-list candidate-detail-doc-photo-grid">
            {photoTypes.filter(matchesFilter).map((type) => (
              <DocRow
                candidateId={candidateId}
                key={type.id}
                onRefresh={onRefresh}
                type={type}
                upload={uploadsByKey.get(type.key) ?? null}
              />
            ))}
          </ul>
        </section>
      )}

      <section className="instructor-detail-card">
        <h3 className="candidate-detail-section-title">Diğer Zorunlu Evraklar</h3>
        {requiredTypes.length === 0 ? (
          <div className="instructor-detail-empty">Tanımlı diğer zorunlu evrak yok.</div>
        ) : filteredRequiredTypes.length === 0 ? (
          <div className="instructor-detail-empty">Bu filtrede zorunlu evrak yok.</div>
        ) : (
          <ul className="candidate-detail-doc-list">
            {filteredRequiredTypes.map((type) => (
              <DocRow
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

      {optionalTypes.length > 0 && (
        <section className="instructor-detail-card">
          <h3 className="candidate-detail-section-title">Diğer Evraklar</h3>
          {filteredOptionalTypes.length === 0 ? (
            <div className="instructor-detail-empty">Bu filtrede diğer evrak yok.</div>
          ) : (
            <ul className="candidate-detail-doc-list">
              {filteredOptionalTypes.map((type) => (
                <DocRow
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

function HeroDocumentCard({
  candidateId,
  type,
  upload,
  onRefresh,
}: {
  candidateId: string;
  type: DocumentTypeResponse;
  upload: DocumentResponse | null;
  onRefresh: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const isAvailable = upload !== null && (upload.hasFile || upload.isPhysicallyAvailable);
  const [saving, setSaving] = useState(false);

  const setAvailable = async () => {
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

  return (
    <div className="candidate-detail-doc-hero-item">
      <div className="candidate-detail-doc-hero-head">
        <div className="candidate-detail-doc-hero-title">{type.name}</div>
        <div className="candidate-detail-doc-hero-date">
          <span>Teslim Tarihi</span>
          <strong>{deliveredAt}</strong>
        </div>
      </div>
      <button
        type="button"
        className={`candidate-detail-doc-hero-switch${isAvailable ? " on" : " off"}`}
        role="switch"
        aria-checked={isAvailable}
        aria-label={`${type.name} durumu`}
        disabled={saving}
        onClick={isAvailable ? setUnavailable : setAvailable}
      >
        <span className="candidate-detail-doc-hero-switch-track-label">
          {isAvailable ? "Var" : "Yok"}
        </span>
        <span className="candidate-detail-doc-hero-switch-thumb" aria-hidden="true" />
      </button>
    </div>
  );
}

function HealthReportExtraFields({
  candidateId,
  upload,
  onRefresh,
}: {
  candidateId: string;
  upload: DocumentResponse | null;
  onRefresh: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);

  const meta = upload?.metadata ?? {};
  const foreignLanguage = (meta[HEALTH_REPORT_META_KEYS.foreignLanguage] ?? "") as string;
  const disability = (meta[HEALTH_REPORT_META_KEYS.disability] ?? "none") as string;
  const needsTranslator = meta[HEALTH_REPORT_META_KEYS.needsTranslator] === "yes";
  const needsSignLanguageTranslator =
    meta[HEALTH_REPORT_META_KEYS.needsSignLanguageTranslator] === "yes";

  const disabled = !upload;
  const storedDisability = meta[HEALTH_REPORT_META_KEYS.disability];

  const persist = async (nextMetadata: Record<string, string>) => {
    if (saving || !upload) return;
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
      await updateCandidateDocument(candidateId, upload.id, { metadata: merged });
      await onRefresh();
    } catch {
      showToast("Sağlık raporu bilgileri kaydedilemedi", "error");
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
      {disabled ? (
        <div className="candidate-detail-doc-health-extras-hint">
          Bilgileri girebilmek için önce "Var" işaretleyip Kurum, Belge Tarihi ve Belge Sayısı'nı kaydedin.
        </div>
      ) : null}
      <div className="candidate-detail-doc-health-extras-grid">
        <label className="candidate-detail-doc-metadata-field">
          <span>E-Sınav Yabancı Dil Seçimi</span>
          <CustomSelect
            aria-label="E-Sınav Yabancı Dil Seçimi"
            className="form-select"
            disabled={saving || disabled}
            onChange={(event) =>
              persist({ [HEALTH_REPORT_META_KEYS.foreignLanguage]: event.target.value })
            }
            value={foreignLanguage}
          >
            <option value="">Seçin...</option>
            {HEALTH_REPORT_FOREIGN_LANGUAGES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </CustomSelect>
        </label>
        <label className="candidate-detail-doc-metadata-field">
          <span>Özür Durumu</span>
          <CustomSelect
            aria-label="Özür Durumu"
            className="form-select"
            disabled={saving || disabled}
            onChange={(event) =>
              persist({ [HEALTH_REPORT_META_KEYS.disability]: event.target.value })
            }
            value={disability}
          >
            <option value="">Seçin...</option>
            {HEALTH_REPORT_DISABILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </CustomSelect>
        </label>
      </div>
      <label className="candidate-detail-doc-health-toggle">
        <span>Okutman ve/veya yazman (Tercüman) ihtiyacı</span>
        <span className="switch-toggle">
          <input
            checked={needsTranslator}
            disabled={saving || disabled}
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
        <span>İşaret dilini bilen tercüman ihtiyacı</span>
        <span className="switch-toggle">
          <input
            checked={needsSignLanguageTranslator}
            disabled={saving || disabled}
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

function DocRow({
  candidateId,
  type,
  upload,
  onRefresh,
}: {
  candidateId: string;
  type: DocumentTypeResponse;
  upload: DocumentResponse | null;
  onRefresh: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [markingPhysical, setMarkingPhysical] = useState(false);
  const [markingMebbis, setMarkingMebbis] = useState(false);
  const [metadataSaving, setMetadataSaving] = useState(false);
  const [metadataValues, setMetadataValues] = useState<Record<string, string>>({});
  const [metadataErrors, setMetadataErrors] = useState<Record<string, string>>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
    setMetadataValues(buildDocumentMetadataValues(metadataFields, upload));
    setMetadataErrors({});
  }, [metadataFields, upload]);

  useEffect(() => {
    if (!showsImagePreview || !isPreviewableImage(upload) || !fileUrl) {
      setPreviewUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    createAuthorizedObjectUrl(fileUrl)
      .then((url) => {
        objectUrl = url;
        if (!cancelled) setPreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl(null);
      });

    return () => {
      cancelled = true;
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

  const handleUpload = async (file: File) => {
    if (uploading) return;
    if (!validateMetadata()) return;
    setUploading(true);
    try {
      await uploadDocument({
        candidateId,
        documentTypeId: type.id,
        file,
        metadata: buildMetadataPayload(),
      });
      await onRefresh();
      showToast(`"${type.name}" yüklendi`);
    } catch {
      showToast(`"${type.name}" yüklenemedi`, "error");
    } finally {
      setUploading(false);
    }
  };

  const handleMarkPhysical = async () => {
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
      showToast(`"${type.name}" fiziksel olarak işaretlendi`);
    } catch {
      showToast(`"${type.name}" işaretlenemedi`, "error");
    } finally {
      setMarkingPhysical(false);
    }
  };

  const handleMarkMissing = async () => {
    if (!upload || deleting) return;
    setDeleting(true);
    try {
      await deleteCandidateDocument(candidateId, upload.id);
      await onRefresh();
      showToast(`"${type.name}" yok olarak işaretlendi`);
      setConfirmingDelete(false);
    } catch {
      showToast(`"${type.name}" güncellenemedi`, "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleDelete = async () => {
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
    if (markingMebbis || checked === isMebbisTransferred) return;
    setMarkingMebbis(true);
    try {
      await updateCandidateDocumentMebbisTransfer(candidateId, type.id, checked);
      await onRefresh();
      showToast(checked ? `"${type.name}" Mebbis işaretlendi` : `"${type.name}" Mebbis kaldırıldı`);
    } catch {
      showToast(`"${type.name}" Mebbis durumu kaydedilemedi`, "error");
    } finally {
      setMarkingMebbis(false);
    }
  };

  const handleOpenFile = async () => {
    if (!inlineFileUrl) return;
    try {
      await openAuthorizedFile(inlineFileUrl);
    } catch {
      showToast(`"${type.name}" görüntülenemedi`, "error");
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
      showToast(`"${type.name}" yazdırılamadı`, "error");
    }
  };

  const handleSaveMetadata = async (override?: Record<string, string>) => {
    if (!upload || metadataSaving) return;
    const source = override ?? metadataValues;
    if (!validateMetadata(source)) return;
    const payload: Record<string, string> = {};
    for (const field of metadataFields) {
      const value = (source[field.key] ?? "").trim();
      if (value) payload[field.key] = value;
    }
    setMetadataSaving(true);
    try {
      await updateCandidateDocument(candidateId, upload.id, { metadata: payload });
      await onRefresh();
    } catch {
      showToast(`"${type.name}" bilgileri kaydedilemedi`, "error");
    } finally {
      setMetadataSaving(false);
    }
  };

  const inputId = `doc-upload-${type.id}`;
  const busy = uploading || deleting || markingPhysical || markingMebbis || metadataSaving;
  const canUploadFile = status !== "uploaded";
  const canDeleteFile = !!upload?.hasFile;
  const hasDocumentAvailable = status !== "missing";

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
                  ? "Henüz fotoğraf yok."
                  : isSignatureType
                  ? "Henüz imza yok."
                  : "Henüz yüklenmedi."}
              </span>
            ) : status === "physical" ? (
              <span>
                {isPhotoType
                  ? "Fotoğraf elde var."
                  : isSignatureType
                  ? "İmza elde var."
                  : "Evrak elde var."}
              </span>
            ) : (
              <span>Önizleme desteklenmiyor.</span>
            )}
          </div>
        ) : null}
        <div className="candidate-detail-doc-side">
        <div className="candidate-detail-doc-title-row">
          <div className="candidate-detail-doc-name">{type.name}</div>
          <div className="candidate-detail-doc-state-chips">
            <StateChip on={hasDocumentAvailable} onLabel="Var" offLabel="Yok" />
            <StateChip on={!!upload?.hasFile} onLabel="Yüklendi" offLabel="Yüklenmedi" />
            <StateChip
              on={isMebbisTransferred}
              onLabel="Mebbis Aktarıldı"
              offLabel="Mebbis Aktarılmadı"
            />
          </div>
          {uploadedDate && !isContractType ? (
            <div className="candidate-detail-doc-delivered-date">
              <span>Teslim Tarihi</span>
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
              ? "Evrak yok olarak işaretli."
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
                      onChange={(event) => {
                        const next = event.target.value;
                        setMetadataValue(field.key, next);
                        void handleSaveMetadata({ ...metadataValues, [field.key]: next });
                      }}
                      value={value}
                    >
                      <option value="">{field.placeholder ?? "Seçin..."}</option>
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
            candidateId={candidateId}
            upload={upload}
            onRefresh={onRefresh}
          />
        ) : null}
        </div>
      </div>
      <div className="candidate-detail-doc-actions">
        <button
          className={`btn btn-sm ${isMebbisTransferred ? "btn-secondary" : "btn-primary"}`}
          disabled={busy || status === "missing"}
          onClick={() => handleMebbisToggle(!isMebbisTransferred)}
          type="button"
        >
          {markingMebbis
            ? "Kaydediliyor..."
            : isMebbisTransferred
            ? "Mebbis Kaldır"
            : "Mebbis Aktar"}
        </button>

        {inlineFileUrl ? (
          <button
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={handleOpenFile}
            type="button"
          >
            Görüntüle
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

        {canUploadFile ? (
          <>
            {/* Hidden input + label-as-button = native, accessible upload trigger. */}
            <input
              accept="application/pdf,image/jpeg,image/png"
              disabled={busy}
              hidden
              id={inputId}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleUpload(file);
                event.target.value = "";
              }}
              type="file"
            />
            <label
              aria-disabled={busy}
              className={`btn btn-secondary btn-sm${busy ? " is-disabled" : ""}`}
              htmlFor={inputId}
              style={busy ? { pointerEvents: "none", opacity: 0.6 } : undefined}
            >
              {uploading ? "Yükleniyor..." : "Dosya Yükle"}
            </label>
          </>
        ) : null}

        <button
          type="button"
          className={`candidate-detail-doc-hero-switch${hasDocumentAvailable ? " on" : " off"}`}
          role="switch"
          aria-checked={hasDocumentAvailable}
          aria-label={`${type.name} var yok durumu`}
          disabled={busy || upload?.hasFile}
          onClick={hasDocumentAvailable ? handleMarkMissing : handleMarkPhysical}
        >
          <span className="candidate-detail-doc-hero-switch-track-label">
            {hasDocumentAvailable ? "Var" : "Yok"}
          </span>
          <span className="candidate-detail-doc-hero-switch-thumb" aria-hidden="true" />
        </button>

        {canDeleteFile ? (
          confirmingDelete ? (
            <div className="candidate-detail-doc-confirm">
              <span>Silinsin mi?</span>
              <button
                className="btn btn-danger btn-sm"
                disabled={busy}
                onClick={handleDelete}
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
              disabled={busy}
              onClick={() => setConfirmingDelete(true)}
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
    </li>
  );
}

function TrainingTab({
  candidate,
}: {
  candidate: CandidateResponse;
}) {
  const navigate = useNavigate();
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
          ...buildCandidateExamEvents(candidate),
        ]);
        setCalendarBranches(branchResult.items);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setCalendarError("Aday takvimi yüklenemedi.");
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
          <h3 className="candidate-detail-section-title">Aday Takvimi</h3>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate(`/training/uygulama?candidateId=${encodeURIComponent(candidate.id)}`)}
            type="button"
          >
            Direksiyon Programı Yap
          </button>
        </div>
        {calendarError ? (
          <div className="instructor-detail-error">{calendarError}</div>
        ) : (
          <>
            <div className="form-subsection-note" style={{ marginBottom: 10 }}>
              Adayın direksiyon dersleri, aktif grubundaki teorik dersleri ve sınav tarihleri birlikte gösterilir.
            </div>
            {calendarLoading ? (
              <div className="instructor-detail-empty">Takvim yükleniyor...</div>
            ) : null}
            <div className="candidate-detail-calendar-wrap">
              <TrainingCalendar
                branchHelpers={branchHelpers}
                events={calendarEvents}
                focusDate={calendarFocusDate}
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
