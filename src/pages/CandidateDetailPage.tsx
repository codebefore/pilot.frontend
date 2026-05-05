import { Fragment, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
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
  getCandidateById,
  removeActiveGroupAssignment,
  updateCandidate,
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
import { getCashRegisters } from "../lib/cash-registers-api";
import { getCertificatePrograms } from "../lib/certificate-programs-api";
import { getGroups } from "../lib/groups-api";
import { getTrainingBranchDefinitions } from "../lib/training-branch-definitions-api";
import { getTrainingLessons } from "../lib/training-lessons-api";
import {
  trainingLessonToCalendarEvent,
  type TrainingCalendarEvent,
} from "../lib/training-calendar";
import { useColumnVisibility } from "../lib/use-column-visibility";
import { buildBranchHelpers } from "../lib/training-branches";
import { buildTermLabel } from "../lib/term-label";
import { ApiError } from "../lib/http";
import { useLicenseClassOptions } from "../lib/use-license-class-options";
import {
  deleteCandidateDocument,
  getCandidateDocumentDownloadUrl,
  getCandidateDocuments,
  getDocumentTypes,
  uploadDocument,
} from "../lib/documents-api";
import {
  CANDIDATE_GENDER_OPTIONS,
  CANDIDATE_MEB_SYNC_STATUS_OPTIONS,
  candidateExamResultLabel,
  candidateGenderLabel,
  candidateMebSyncStatusLabel,
  candidateMebSyncStatusToPill,
  candidateStatusLabel,
  candidateStatusToPill,
  EXISTING_LICENSE_TYPE_OPTIONS,
  existingLicenseTypeLabel,
  TURKEY_PROVINCE_OPTIONS,
  formatDateTR,
  normalizeCandidateGender,
  normalizeCandidateExamResultValue,
  normalizeCandidateMebSyncStatusValue,
} from "../lib/status-maps";
import { StatusPill } from "../components/ui/StatusPill";
import type {
  CandidateResponse,
  CandidateContactResponse,
  CandidateContactType,
  CandidateContactUpsertRequest,
  CandidateUpsertRequest,
  CandidateAccountingInvoiceResponse,
  CandidateAccountingSummaryResponse,
  CandidateAccountingType,
  CandidatePaymentMethod,
  CashRegisterResponse,
  CertificateProgramResponse,
  DocumentResponse,
  DocumentTypeResponse,
  TrainingBranchDefinitionResponse,
} from "../lib/types";

type TabKey =
  | "general"
  | "license"
  | "training"
  | "exams"
  | "documents"
  | "payments";

const TABS: { key: TabKey; label: string }[] = [
  { key: "general", label: "Genel" },
  { key: "license", label: "Ehliyet Bilgileri" },
  { key: "training", label: "Eğitim" },
  { key: "exams", label: "Sınavlar" },
  { key: "documents", label: "Evraklar" },
  { key: "payments", label: "Muhasebe" },
];

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
  const [searchParams] = useSearchParams();
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
      tab === "exams" ||
      tab === "documents" ||
      tab === "payments"
    ) {
      setActiveTab(tab);
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
      showToast("Hareket eklendi");
    } catch (error) {
      showToast(accountingErrorMessage(error, "Hareket eklenemedi"), "error");
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
  ) => {
    if (!candidate || paymentSaving) return;
    setPaymentSaving(true);
    try {
      await createCandidateAccountingPayment(candidate.id, {
        type,
        amount,
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
      await cancelCandidateAccountingMovement(candidate.id, movementId, "Hareket iptal edildi.");
      await refreshAccounting();
      showToast("Hareket iptal edildi");
    } catch (error) {
      showToast(accountingErrorMessage(error, "Hareket iptal edilemedi"), "error");
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

          <nav className="candidate-detail-tabs" role="tablist">
            {TABS.map((tab) => (
              <button
                aria-selected={activeTab === tab.key}
                className={`candidate-detail-tab${activeTab === tab.key ? " active" : ""}`}
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            ))}
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
                candidate={candidate}
                onSaved={(updated) => setCandidate(updated)}
              />
            )}
            {activeTab === "training" && (
              <TrainingTab
                candidate={candidate}
                onChanged={(updatedCandidate) => {
                  if (updatedCandidate) setCandidate(updatedCandidate);
                }}
              />
            )}
            {activeTab === "exams" && (
              <ExamsTab
                candidate={candidate}
                onSaved={(updated) => setCandidate(updated)}
              />
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
                onCreatePayment={(type, amount, method, cashRegisterId, paidAtUtc, note) =>
                  void handleCreatePayment(type, amount, method, cashRegisterId, paidAtUtc, note)
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
  const summary = candidate.documentSummary;
  const docLabel = summary
    ? `${summary.completedCount} / ${summary.totalRequiredCount}`
    : "—";
  const groupLabel = candidate.currentGroup?.title ?? "Atanmamış";
  const paymentLabel = candidate.initialPaymentReceived
    ? "Ödendi"
    : candidate.examFeePaid
    ? "Sınav ücreti ödendi"
    : "Bekliyor";

  return (
    <header className="candidate-detail-hero">
      <CandidateAvatar
        candidate={candidate}
        className="candidate-detail-hero-avatar"
        size={96}
      />

      <div className="candidate-detail-hero-body">
        <h2 className="candidate-detail-hero-name">{fullName}</h2>
        <div className="candidate-detail-hero-meta">
          <span>TC: {candidate.nationalId}</span>
          {age != null ? <span>{age} yaş</span> : null}
          {candidate.gender ? <span>{candidateGenderLabel(candidate.gender)}</span> : null}
        </div>
        <div className="candidate-detail-hero-badges">
          <StatusPill label={statusLabel} status={statusPill} />
          {candidate.tags?.map((tag) => (
            <span className="candidate-detail-hero-tag" key={tag.id}>
              #{tag.name}
            </span>
          ))}
        </div>
        <div className="candidate-detail-hero-facts">
          <HeroFact label="Ehliyet Sınıfı" value={candidate.licenseClass} />
          <HeroFact label="Aktif Grup" value={groupLabel} />
          <HeroFact
            label="Evraklar"
            value={docLabel}
            sub={summary?.missingCount ? `${summary.missingCount} eksik` : undefined}
          />
          <HeroFact label="Kayıt Ücreti" value={paymentLabel} />
        </div>
      </div>
    </header>
  );
}

function HeroFact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <span className="candidate-detail-hero-fact">
      <span className="candidate-detail-hero-fact-label">{label}</span>
      <span className="candidate-detail-hero-fact-value">{value}</span>
      {sub ? <span className="candidate-detail-hero-fact-sub">{sub}</span> : null}
    </span>
  );
}

function GeneralTab({
  candidate,
  age,
  onSaved,
}: {
  candidate: CandidateResponse;
  age: number | null;
  onSaved: (updated: CandidateResponse) => void;
}) {
  const { showToast } = useToast();
  const saveField = async (patch: Partial<CandidateUpsertRequest>, message: string) => {
    try {
      const updated = await updateCandidateField(candidate, patch);
      onSaved(updated);
      showToast(message);
    } catch {
      showToast("Bilgiler kaydedilemedi", "error");
      throw new Error("save failed");
    }
  };

  return (
    <div className="candidate-detail-tab-content candidate-detail-general-grid">
      <section className="instructor-detail-card">
        <h3 className="candidate-detail-section-title">Kimlik Bilgileri</h3>
        <div className="candidate-detail-edit-list">
          <EditableRow
            displayValue={candidate.firstName}
            inputValue={candidate.firstName}
            label="Ad"
            onSave={(value) => saveField({ firstName: value.trim() }, "Ad güncellendi")}
          />
          <EditableRow
            displayValue={candidate.lastName}
            inputValue={candidate.lastName}
            label="Soyad"
            onSave={(value) => saveField({ lastName: value.trim() }, "Soyad güncellendi")}
          />
          <EditableRow
            displayValue={candidate.nationalId}
            inputType="tel"
            inputValue={candidate.nationalId}
            label="TC Kimlik No"
            onSave={(value) => saveField({ nationalId: value.trim() }, "TC kimlik güncellendi")}
          />
          <EditableRow
            displayValue={candidate.identitySerialNumber ?? ""}
            inputValue={candidate.identitySerialNumber ?? ""}
            label="Kimlik Seri No"
            onSave={(value) =>
              saveField({ identitySerialNumber: value.trim() || null }, "Kimlik seri no güncellendi")
            }
          />
          <EditableRow
            displayValue={candidate.motherName ?? ""}
            inputValue={candidate.motherName ?? ""}
            label="Anne Adı"
            onSave={(value) => saveField({ motherName: value.trim() || null }, "Anne adı güncellendi")}
          />
          <EditableRow
            displayValue={candidate.fatherName ?? ""}
            inputValue={candidate.fatherName ?? ""}
            label="Baba Adı"
            onSave={(value) => saveField({ fatherName: value.trim() || null }, "Baba adı güncellendi")}
          />
          <EditableRow
            displayValue={candidateGenderLabel(candidate.gender)}
            inputValue={normalizeCandidateGender(candidate.gender) ?? ""}
            label="Cinsiyet"
            options={CANDIDATE_GENDER_OPTIONS}
            onSave={(value) =>
              saveField({ gender: normalizeCandidateGender(value) }, "Cinsiyet güncellendi")
            }
          />
          <EditableRow
            displayValue={formatDateTR(candidate.birthDate)}
            inputType="date"
            inputValue={candidate.birthDate ?? ""}
            label="Doğum Tarihi"
            onSave={(value) => saveField({ birthDate: value || null }, "Doğum tarihi güncellendi")}
          />
          <Field label="Yaş" value={age != null ? String(age) : "—"} />
        </div>
      </section>

      <section className="instructor-detail-card">
        <h3 className="candidate-detail-section-title">İletişim</h3>
        <CandidateContactsEditor candidate={candidate} onSave={saveField} />
      </section>
    </div>
  );
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

function formatHours(value: number | null | undefined): string {
  return value != null ? `${value} sa` : "—";
}

function numericHours(value: number | null | undefined): number {
  return value ?? 0;
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

function optionForCertificateProgramSource(program: CertificateProgramResponse): SelectOption {
  const sourceKeys = [
    normalizeLicenseOptionKey(program.sourceLicenseClass),
    normalizeLicenseOptionKey(program.sourceLicenseDisplayName),
  ];

  const matched = EXISTING_LICENSE_TYPE_OPTIONS.find((option) => {
    const optionKeys = [
      normalizeLicenseOptionKey(option.value),
      normalizeLicenseOptionKey(option.label),
    ];
    return optionKeys.some((key) => sourceKeys.includes(key));
  });

  return {
    value: matched?.value ?? program.sourceLicenseClass,
    label: matched?.label ?? program.sourceLicenseDisplayName,
  };
}

function buildExistingLicenseOptionsFromPrograms(
  programs: CertificateProgramResponse[],
  currentExistingLicenseType: string | null
): SelectOption[] {
  const byValue = new Map<string, SelectOption>();

  for (const program of programs) {
    if (normalizeLicenseOptionKey(program.sourceLicenseClass) === "YOK") continue;
    const option = optionForCertificateProgramSource(program);
    byValue.set(option.value, option);
  }

  if (currentExistingLicenseType && !byValue.has(currentExistingLicenseType)) {
    byValue.set(currentExistingLicenseType, {
      value: currentExistingLicenseType,
      label: existingLicenseTypeLabel(currentExistingLicenseType),
    });
  }

  return [...byValue.values()].sort((a, b) => a.label.localeCompare(b.label, "tr"));
}

function LicenseInfoTab({
  candidate,
  onSaved,
}: {
  candidate: CandidateResponse;
  onSaved: (updated: CandidateResponse) => void;
}) {
  const { showToast } = useToast();
  const { options: licenseClassOptions } = useLicenseClassOptions();
  const [licenseType, setLicenseType] = useState(candidate.existingLicenseType ?? "");
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
  const [existingLicensePrograms, setExistingLicensePrograms] = useState<CertificateProgramResponse[]>([]);
  const [existingLicenseOptions, setExistingLicenseOptions] = useState<SelectOption[]>([]);
  const [existingLicenseOptionsLoading, setExistingLicenseOptionsLoading] = useState(false);
  const hasLicense = !!candidate.existingLicenseType;

  useEffect(() => {
    setLicenseType(candidate.existingLicenseType ?? "");
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

    getCertificatePrograms(
      {
        activity: "active",
        targetLicenseClass: candidate.licenseClass,
        page: 1,
        pageSize: 1000,
        sortBy: "source",
        sortDir: "asc",
      },
      controller.signal
    )
      .then((response) => {
        setExistingLicensePrograms(response.items);
        setExistingLicenseOptions(
          buildExistingLicenseOptionsFromPrograms(
            response.items,
            candidate.existingLicenseType
          )
        );
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setExistingLicensePrograms([]);
        setExistingLicenseOptions([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setExistingLicenseOptionsLoading(false);
        }
      });

    return () => controller.abort();
  }, [candidate.existingLicenseType, candidate.licenseClass]);

  useEffect(() => {
    if (existingLicenseOptionsLoading || !licenseType) return;
    if (existingLicenseOptions.some((option) => option.value === licenseType)) return;
    setLicenseType("");
  }, [existingLicenseOptions, existingLicenseOptionsLoading, licenseType]);

  const findCertificateProgramForExistingLicense = (
    existingLicenseType: string
  ): CertificateProgramResponse | null => {
    const selectedKey = normalizeLicenseOptionKey(
      existingLicenseTypeLabel(existingLicenseType)
    );

    return existingLicensePrograms.find((program) => {
      if (program.sourceLicensePre2016) return false;
      if (normalizeLicenseOptionKey(program.sourceLicenseClass) === "YOK") return false;

      const option = optionForCertificateProgramSource(program);
      return (
        option.value === existingLicenseType ||
        normalizeLicenseOptionKey(option.label) === selectedKey ||
        normalizeLicenseOptionKey(program.sourceLicenseClass) === selectedKey ||
        normalizeLicenseOptionKey(program.sourceLicenseDisplayName) === selectedKey
      );
    }) ?? null;
  };

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

  const buildExistingLicensePatch = (
    patch: Partial<CandidateUpsertRequest>
  ): Partial<CandidateUpsertRequest> => {
    const nextTypeRaw =
      patch.existingLicenseType !== undefined
        ? patch.existingLicenseType
        : candidate.existingLicenseType;
    const nextType = nextTypeRaw?.trim() || null;

    if (!nextType) {
      return {
        certificateProgramId: null,
        existingLicenseType: null,
        existingLicenseNumber: null,
        existingLicenseIssuedAt: null,
        existingLicenseIssuedProvince: null,
        existingLicensePre2016: false,
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

    if (!nextNumber || !nextIssuedAt || !nextProvince) {
      showToast("Belge türü, tarih, numara ve il birlikte girilmeli.", "error");
      throw new Error("existing license required fields missing");
    }

    const certificateProgram = findCertificateProgramForExistingLicense(nextType);
    if (!certificateProgram) {
      showToast("Bu ehliyet tipi için seçilen mevcut belgeyle geçiş tanımlı değil.", "error");
      throw new Error("certificate program missing");
    }

    return {
      certificateProgramId: certificateProgram.id,
      existingLicenseType: nextType,
      existingLicenseNumber: nextNumber,
      existingLicenseIssuedAt: nextIssuedAt,
      existingLicenseIssuedProvince: nextProvince,
      existingLicensePre2016: false,
    };
  };

  const saveExistingLicenseField = async (
    patch: Partial<CandidateUpsertRequest>,
    message = "Ehliyet bilgileri güncellendi"
  ) => {
    try {
      const updated = await updateCandidateField(candidate, buildExistingLicensePatch(patch));
      onSaved(updated);
      showToast(message);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === "existing license required fields missing" ||
          error.message === "certificate program missing")
      ) {
        throw error;
      }
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
      </section>

      <section className="instructor-detail-card">
        <div className="instructor-detail-section-header">
          <h3 className="candidate-detail-section-title" style={{ margin: 0 }}>
            Mevcut Sürücü Belgesi
          </h3>
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

        {licenseFieldsOpen ? (
          <div className="candidate-detail-edit-list">
            <EditableRow
              displayValue={
                hasLicense ? existingLicenseTypeLabel(candidate.existingLicenseType) : ""
              }
              inputValue={hasLicense ? candidate.existingLicenseType ?? "" : licenseType}
              label="Mevcut Belge"
              options={[
                { value: "", label: "— Belge Yok —" },
                ...existingLicenseOptions,
              ]}
              onSave={(value) =>
                hasLicense
                  ? saveExistingLicenseField(
                      { existingLicenseType: value || null },
                      value ? "Mevcut sürücü belgesi güncellendi" : "Mevcut sürücü belgesi kaldırıldı"
                    )
                  : Promise.resolve(setLicenseType(value))
              }
            />
            <EditableRow
              displayValue={hasLicense ? formatDateTR(candidate.existingLicenseIssuedAt) : formatDateTR(issuedAt)}
              inputType="date"
              inputValue={hasLicense ? candidate.existingLicenseIssuedAt ?? "" : issuedAt}
              inputLang="tr-TR"
              label="Belge Tarihi"
              onSave={(value) =>
                hasLicense
                  ? saveExistingLicenseField({ existingLicenseIssuedAt: value || null })
                  : Promise.resolve(setIssuedAt(value || todayIsoDate()))
              }
            />
            <EditableRow
              displayValue={hasLicense ? candidate.existingLicenseNumber ?? "" : licenseNumber}
              inputValue={hasLicense ? candidate.existingLicenseNumber ?? "" : licenseNumber}
              label="Belge No"
              onSave={(value) =>
                hasLicense
                  ? saveExistingLicenseField({ existingLicenseNumber: value || null })
                  : Promise.resolve(setLicenseNumber(value))
              }
            />
            <EditableRow
              displayValue={hasLicense ? candidate.existingLicenseIssuedProvince ?? "" : issuedProvince}
              inputValue={hasLicense ? candidate.existingLicenseIssuedProvince ?? "" : issuedProvince}
              label="Belge Veriliş İli"
              options={TURKEY_PROVINCE_OPTIONS}
              onSave={(value) =>
                hasLicense
                  ? saveExistingLicenseField({ existingLicenseIssuedProvince: value || null })
                  : Promise.resolve(setIssuedProvince(value))
              }
            />
            {!existingLicenseOptionsLoading && existingLicenseOptions.length === 0 ? (
              <div className="form-subsection-note" style={{ marginTop: 8 }}>
                Bu ehliyet tipi için mevcut sürücü belgesiyle geçiş tanımlı değil.
              </div>
            ) : null}
            {!hasLicense ? (
              <div className="candidate-detail-license-actions">
              <button
                className="btn btn-primary"
                disabled={
                  existingLicenseOptions.length === 0 ||
                  !licenseType ||
                  !licenseNumber.trim() ||
                  !issuedAt ||
                  !issuedProvince.trim()
                }
                onClick={() =>
                  void saveExistingLicenseField(
                    {
                      existingLicenseType: licenseType || null,
                      existingLicenseIssuedAt: issuedAt || null,
                      existingLicenseNumber: licenseNumber.trim() || null,
                      existingLicenseIssuedProvince: issuedProvince.trim() || null,
                    },
                    "Mevcut sürücü belgesi eklendi"
                  )
                }
                type="button"
              >
                Mevcut belgeyi kaydet
              </button>
            </div>
            ) : null}
          </div>
        ) : (
          <div className="instructor-detail-empty">
            Adayda mevcut bir sürücü belgesi yok.
          </div>
        )}
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

function parseMoneyInput(value: string): number | null {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function accountingErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  const messages = Object.values(error.validationErrors ?? {}).flat();
  const firstMessage = messages[0];
  if (!firstMessage) return fallback;

  if (firstMessage.includes("open balance")) return "Ödeme seçilen türdeki açık bakiyeyi aşamaz.";
  if (firstMessage.includes("Cash register is required")) return "Bu ödeme yöntemi için kasa seçilmeli.";
  if (firstMessage.includes("Cash register type")) return "Seçilen kasa ödeme yöntemiyle uyumlu değil.";
  if (firstMessage.includes("Paid movement")) return "Ödeme alınmış hareket silinemez. Önce iade/iptal işlemi yapın.";
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
    detail: "Kurs hareketleri",
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
    detail: "Diğer hareketler",
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
    note: string | null
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
  }>({
    open: false,
    type: "kurs",
    amount: "",
    method: "cash",
    cashRegisterId: "",
    paidAtUtc: todayIsoDate(),
    note: "",
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

  useEffect(() => {
    const controller = new AbortController();
    getCashRegisters({ activity: "active", page: 1, pageSize: 200 }, controller.signal)
      .then((response) => setCashRegisters(response.items))
      .catch(() => {
        /* Kasa yoksa ödeme formu zaten kayıt engeller. */
      });
    return () => controller.abort();
  }, []);

  const allMovements = accounting?.movements ?? [];
  const activeMovements = allMovements.filter((item) => item.status === "active");
  const activePayments = accounting?.payments.filter((item) => item.status === "active") ?? [];
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
  const canSaveDebt =
    Boolean(debtModal.description.trim()) &&
    Boolean(debtModal.dueDate) &&
    parsedDebtAmount != null &&
    parsedDebtAmount > 0 &&
    !movementSaving;
  const canSavePayment =
    parsedPaymentAmount != null &&
    parsedPaymentAmount > 0 &&
    parsedPaymentAmount <= typeOpenBalance(paymentModal.type) &&
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
  const openPaymentModal = (type: CandidateAccountingType = "kurs", amount = "") => {
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
        openPaymentModal(movement.type, String(movement.remainingAmount));
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
                <strong>{formatCurrencyTRY(accounting.totalMovementAmount)}</strong>
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
                          {section.detail} · {section.movementCount} hareket
                        </span>
                      </div>
                      <div className="candidate-accounting-section-summary-metrics">
                        <span>
                          <em>Hareket</em>
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
          <strong>Hareket ekle, ödeme al veya fatura kaydet</strong>
        </div>
        <div className="candidate-billing-action-buttons">
          <button className="btn btn-primary" onClick={() => openDebtModal()} type="button">
            Borç Ekle
          </button>
          <button className="btn btn-secondary" onClick={() => openPaymentModal()} type="button">
            Ödeme Al
          </button>
          <button className="btn btn-secondary" onClick={() => openInvoiceModal()} type="button">
            Fatura Ekle
          </button>
        </div>
      </section>

      {accounting?.feeSuggestions.length ? (
        <section className="instructor-detail-card candidate-billing-suggestion">
          <div className="candidate-billing-suggestion-title">Ücret önerileri</div>
          <div className="candidate-billing-suggestion-meta">
            {accounting.feeSuggestions.map((suggestion) => (
              <button
                className="btn btn-secondary btn-sm"
                key={suggestion.feeId}
                onClick={() =>
                  openDebtModal(
                    suggestion.type,
                    String(suggestion.amount),
                    suggestion.description
                  )
                }
                type="button"
              >
                {accountingTypeLabel(suggestion.type)} · {formatCurrencyTRY(suggestion.amount)}
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
        onPay={(movement) => openPaymentModal(movement.type, String(movement.remainingAmount))}
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
        onPay={(movement) => openPaymentModal(movement.type, String(movement.remainingAmount))}
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
        onPay={(movement) => openPaymentModal(movement.type, String(movement.remainingAmount))}
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
                  paymentModal.note.trim() || null
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
          onChange={(type) => setPaymentModal((current) => ({ ...current, type }))}
          value={paymentModal.type}
        />
        <div className="candidate-accounting-modal-form">
          <label className="form-group">
            <span className="form-label">Yöntem</span>
	            <CustomSelect
	              className="form-select"
	              onChange={(event) => {
	                const method = event.target.value as CandidatePaymentMethod;
                const firstRegister = cashRegisters.find((register) => register.type === cashRegisterTypeForMethod(method));
                setPaymentModal((current) => ({
                  ...current,
                  method,
                  cashRegisterId: firstRegister?.id ?? "",
                }));
              }}
              value={paymentModal.method}
            >
	              {PAYMENT_METHODS.map((method) => (
	                <option key={method} value={method}>{paymentMethodLabel(method)}</option>
	              ))}
	            </CustomSelect>
          </label>
          <label className="form-group">
            <span className="form-label">Kasa</span>
	            <CustomSelect
	              className="form-select"
	              disabled={!paymentNeedsRegister}
	              onChange={(event) => setPaymentModal((current) => ({ ...current, cashRegisterId: event.target.value }))}
              value={paymentModal.cashRegisterId}
            >
              <option value="">{paymentNeedsRegister ? "Kasa seç" : "Kasa gerekmiyor"}</option>
	              {availableCashRegisters.map((register) => (
	                <option key={register.id} value={register.id}>{register.name}</option>
	              ))}
	            </CustomSelect>
          </label>
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

    const close = () => setOpenActionMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);

    return () => {
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
        <div className="instructor-detail-empty">Hareket kaydı yok.</div>
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
              const relatedPayments = payments.filter((item) =>
                item.allocations.some((allocation) => allocation.movementId === movement.id)
              );
              const payment = relatedPayments[0] ?? null;
              const hasPaymentHistory = relatedPayments.length > 0 || movement.paidAmount > 0 || movement.refundedAmount > 0;
              const status = accountingMovementStatus(movement);
              const canPay = movement.status === "active" && movement.remainingAmount > 0 && relatedPayments.length === 0;
              const canCancelMovement = movement.status === "active" && !hasPaymentHistory;
              const canCreateInvoice = movement.status === "active";
              const movementMatches = accountingMovementPassesFilters(movement, payment, filters);
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

              if (!movementMatches && childRows.length === 0) return [];

              return [
                <Fragment key={movement.id}>
                  <tr className={`candidate-accounting-movement-row ${status.className}`}>
                    {visibleColumns.map((column) => (
                      <td
                        className={accountingLedgerCellClassName(column.id)}
                        key={column.id}
                      >
                        {renderAccountingMovementCell({
                          columnId: column.id,
                          movement,
                          payment,
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
                </Fragment>,
              ];
            })}
            {hasActiveFilters && sortedMovements.length > 0 ? (
              <tr className="candidate-accounting-filter-note-row">
                <td className="data-table-empty" colSpan={visibleColumns.length + 1}>
                  Filtreler aktif. Eşleşmeyen hareketler gizlendi.
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
          { value: "payment", label: "Ödeme" },
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
  payment: CandidateAccountingSummaryResponse["payments"][number] | null,
  filters: AccountingLedgerFilters
) {
  if (filters.kind !== "all" && filters.kind !== "debt") return false;
  if (filters.status === "active" && movement.status !== "active") return false;
  if (filters.status === "cancelled" && movement.status !== "cancelled") return false;
  if (filters.method !== "all" && movement.lastPaymentMethod !== filters.method) return false;
  if (filters.cashRegister !== "all" && payment?.cashRegister?.name !== filters.cashRegister) {
    return false;
  }

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
  payment,
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
  payment: CandidateAccountingSummaryResponse["payments"][number] | null;
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
  if (columnId === "amount") return formatCurrencyTRY(movement.amount);
  if (columnId === "paidAmount") return formatCurrencyTRY(movement.paidAmount);
  if (columnId === "remainingAmount") return formatCurrencyTRY(movement.remainingAmount);
  if (columnId === "number") return movement.number;
  if (columnId === "method") {
    return movement.lastPaymentMethod ? paymentMethodLabel(movement.lastPaymentMethod) : "—";
  }
  if (columnId === "cashRegister") return payment?.cashRegister?.name ?? "—";
  if (columnId === "refundedAmount") {
    return formatCurrencyTRY(movement.refundedAmount);
  }
  if (columnId === "paidAt") {
    return movement.lastPaidAtUtc ? formatDateTR(movement.lastPaidAtUtc) : "—";
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
            <button className="candidate-accounting-action" onClick={() => { closeActionMenu(); onCreateInvoice(movement.amount); }} type="button">Fatura</button>
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
        <span>Tahsilat</span>
        <span className="candidate-billing-installment-status status-paid">Ödeme</span>
      </div>
    );
  }
  if (columnId === "description") return payment.note || "Ödeme hareketi";
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
  if (columnId === "description") return refund.note || "İade hareketi";
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

const EXAM_RESULT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "—" },
  { value: "passed", label: "Başarılı" },
  { value: "failed", label: "Başarısız" },
];

const EXAM_ATTEMPT_OPTIONS: SelectOption[] = [
  { value: "1", label: "1/4" },
  { value: "2", label: "2/4" },
  { value: "3", label: "3/4" },
  { value: "4", label: "4/4" },
];

function ExamsTab({
  candidate,
  onSaved,
}: {
  candidate: CandidateResponse;
  onSaved: (updated: CandidateResponse) => void;
}) {
  const { showToast } = useToast();

  const saveField = async (patch: Partial<CandidateUpsertRequest>, message: string) => {
    try {
      const updated = await updateCandidateField(candidate, patch);
      onSaved(updated);
      showToast(message);
    } catch {
      showToast("Sınav bilgileri kaydedilemedi", "error");
      throw new Error("save failed");
    }
  };

  const mebSyncLabel = candidateMebSyncStatusLabel(candidate.mebSyncStatus);
  const mebSyncTone = candidateMebSyncStatusToPill(candidate.mebSyncStatus);

  return (
    <div className="candidate-detail-tab-content">
      <section className="instructor-detail-card">
        <h3 className="candidate-detail-section-title">MEB Senkronizasyonu</h3>
        <div className="candidate-detail-edit-list">
          <div className="candidate-detail-meb-sync">
            <StatusPill label={mebSyncLabel} status={mebSyncTone} />
            {candidate.mebSyncStatus ? (
              <span className="candidate-detail-meb-sync-meta">
                Son durum: {candidate.mebSyncStatus}
              </span>
            ) : null}
          </div>
          <EditableRow
            displayValue={candidateMebSyncStatusLabel(candidate.mebSyncStatus)}
            inputValue={normalizeCandidateMebSyncStatusValue(candidate.mebSyncStatus) ?? "not_synced"}
            label="Senkron Durumu"
            options={CANDIDATE_MEB_SYNC_STATUS_OPTIONS}
            onSave={(value) => saveField({ mebSyncStatus: value || null }, "Senkron durumu güncellendi")}
          />
        </div>
      </section>

      <div className="candidate-detail-grid-cards">
        <section className="instructor-detail-card candidate-detail-exam-card">
          <div className="candidate-detail-exam-head">
            <h3 className="candidate-detail-section-title" style={{ margin: 0 }}>
              E-Sınav (Teorik)
            </h3>
            {candidate.mebExamResult ? (
              <StatusPill
                label={candidateExamResultLabel(candidate.mebExamResult)}
                status={
                  normalizeCandidateExamResultValue(candidate.mebExamResult) === "passed"
                    ? "success"
                    : normalizeCandidateExamResultValue(candidate.mebExamResult) === "failed"
                    ? "failed"
                    : "queued"
                }
              />
            ) : null}
          </div>
          <div className="candidate-detail-edit-list">
            <EditableRow
              displayValue={candidate.mebExamDate ? formatDateTR(candidate.mebExamDate) : "Planlanmadı"}
              inputType="date"
              inputValue={candidate.mebExamDate ?? ""}
              label="Tarih"
              onSave={(value) => saveField({ mebExamDate: value || null }, "E-Sınav tarihi güncellendi")}
            />
            <EditableRow
              displayValue={`${candidate.eSinavAttemptCount ?? 1}/4`}
              inputValue={String(candidate.eSinavAttemptCount ?? 1)}
              label="Deneme Sayısı"
              options={EXAM_ATTEMPT_OPTIONS}
              onSave={(value) => saveField({ eSinavAttemptCount: Number(value) }, "E-Sınav hakkı güncellendi")}
            />
            <EditableRow
              displayValue={candidateExamResultLabel(candidate.mebExamResult)}
              inputValue={normalizeCandidateExamResultValue(candidate.mebExamResult) ?? ""}
              label="Sonuç"
              options={EXAM_RESULT_OPTIONS}
              onSave={(value) => saveField({ mebExamResult: value || null }, "E-Sınav sonucu güncellendi")}
            />
          </div>
        </section>

        <section className="instructor-detail-card candidate-detail-exam-card">
          <div className="candidate-detail-exam-head">
            <h3 className="candidate-detail-section-title" style={{ margin: 0 }}>
              Uygulama Sınavı
            </h3>
          </div>
          <div className="candidate-detail-edit-list">
            <EditableRow
              displayValue={candidate.drivingExamDate ? formatDateTR(candidate.drivingExamDate) : "Planlanmadı"}
              inputType="date"
              inputValue={candidate.drivingExamDate ?? ""}
              label="Tarih"
              onSave={(value) => saveField({ drivingExamDate: value || null }, "Uygulama sınav tarihi güncellendi")}
            />
            <EditableRow
              displayValue={`${candidate.drivingExamAttemptCount ?? 1}/4`}
              inputValue={String(candidate.drivingExamAttemptCount ?? 1)}
              label="Deneme Sayısı"
              options={EXAM_ATTEMPT_OPTIONS}
              onSave={(value) => saveField({ drivingExamAttemptCount: Number(value) }, "Uygulama hakkı güncellendi")}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number | null): string | null {
  if (bytes == null || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type CandidateDocumentStatus = "uploaded" | "physical" | "missing";
type CandidateDocumentFilter = "all" | CandidateDocumentStatus;

function getCandidateDocumentStatus(upload: DocumentResponse | null): CandidateDocumentStatus {
  if (!upload) return "missing";
  return upload.hasFile ? "uploaded" : "physical";
}

function candidateDocumentStatusLabel(status: CandidateDocumentStatus): string {
  if (status === "uploaded") return "Yüklendi";
  if (status === "physical") return "Fiziksel";
  return "Eksik";
}

function DocumentsTab({
  candidateId,
  documents,
  documentTypes,
  loading,
  error,
  onRefresh,
}: {
  candidateId: string;
  documents: DocumentResponse[] | null;
  documentTypes: DocumentTypeResponse[] | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
}) {
  const [statusFilter, setStatusFilter] = useState<CandidateDocumentFilter>("all");

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
  const requiredTypes = sortedTypes.filter((t) => t.isRequired);
  const optionalTypes = sortedTypes.filter((t) => !t.isRequired);

  const completedCount = requiredTypes.filter((t) => uploadsByKey.has(t.key)).length;
  const statusCounts = sortedTypes.reduce(
    (acc, type) => {
      const status = getCandidateDocumentStatus(uploadsByKey.get(type.key) ?? null);
      acc[status] += 1;
      return acc;
    },
    { uploaded: 0, physical: 0, missing: 0 }
  );
  const filterOptions: { key: CandidateDocumentFilter; label: string; count: number }[] = [
    { key: "all", label: "Tümü", count: sortedTypes.length },
    { key: "missing", label: "Eksik", count: statusCounts.missing },
    { key: "uploaded", label: "Yüklendi", count: statusCounts.uploaded },
    { key: "physical", label: "Fiziksel", count: statusCounts.physical },
  ];
  const matchesFilter = (type: DocumentTypeResponse) => {
    if (statusFilter === "all") return true;
    return getCandidateDocumentStatus(uploadsByKey.get(type.key) ?? null) === statusFilter;
  };
  const filteredRequiredTypes = requiredTypes.filter(matchesFilter);
  const filteredOptionalTypes = optionalTypes.filter(matchesFilter);

  return (
    <div className="candidate-detail-tab-content">
      <section className="instructor-detail-card candidate-detail-doc-overview">
        <div className="candidate-detail-doc-summary-grid">
          <div className="candidate-detail-doc-summary-item is-missing">
            <span className="candidate-detail-stat-label">Eksik</span>
            <strong>{statusCounts.missing}</strong>
          </div>
          <div className="candidate-detail-doc-summary-item is-uploaded">
            <span className="candidate-detail-stat-label">Yüklendi</span>
            <strong>{statusCounts.uploaded}</strong>
          </div>
          <div className="candidate-detail-doc-summary-item is-physical">
            <span className="candidate-detail-stat-label">Fiziksel</span>
            <strong>{statusCounts.physical}</strong>
          </div>
          <div className="candidate-detail-doc-summary-item">
            <span className="candidate-detail-stat-label">Zorunlu</span>
            <strong>{completedCount} / {requiredTypes.length}</strong>
          </div>
          <div className="candidate-detail-doc-summary-item">
            <span className="candidate-detail-stat-label">Toplam</span>
            <strong>{sortedTypes.length}</strong>
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

      <section className="instructor-detail-card">
        <h3 className="candidate-detail-section-title">Zorunlu Evraklar</h3>
        {requiredTypes.length === 0 ? (
          <div className="instructor-detail-empty">Tanımlı zorunlu evrak yok.</div>
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const status = getCandidateDocumentStatus(upload);
  const statusLabel = candidateDocumentStatusLabel(status);
  const fileSize = upload?.fileSizeBytes != null ? formatFileSize(upload.fileSizeBytes) : null;
  const uploadedDate = upload?.uploadedAtUtc ? formatDateTR(upload.uploadedAtUtc) : null;

  const handleUpload = async (file: File) => {
    if (uploading) return;
    setUploading(true);
    try {
      await uploadDocument({
        candidateId,
        documentTypeId: type.id,
        file,
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
      });
      await onRefresh();
      showToast(`"${type.name}" fiziksel olarak işaretlendi`);
    } catch {
      showToast(`"${type.name}" işaretlenemedi`, "error");
    } finally {
      setMarkingPhysical(false);
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

  const inputId = `doc-upload-${type.id}`;
  const busy = uploading || deleting || markingPhysical;

  return (
    <li className={`candidate-detail-doc-row status-${status}`}>
      <div className={`candidate-detail-doc-status-marker ${status}`} aria-hidden="true" />
      <div className="candidate-detail-doc-main">
        <div className="candidate-detail-doc-title-row">
          <div className="candidate-detail-doc-name">{type.name}</div>
          <span className={`candidate-detail-doc-badge ${status}`}>{statusLabel}</span>
          {type.isRequired ? (
            <span className="candidate-detail-doc-required">Zorunlu</span>
          ) : null}
        </div>
        {upload?.note ? (
          <div className="candidate-detail-doc-note">{upload.note}</div>
        ) : null}
        <div className="candidate-detail-doc-file">
          {status === "missing"
            ? "Henüz yüklenmedi veya fiziksel teslim işaretlenmedi."
            : upload?.originalFileName ?? "Fiziksel evrak elde var."}
        </div>
        {status !== "missing" ? (
          <div className="candidate-detail-doc-meta">
            {fileSize ? <span>{fileSize}</span> : null}
            {uploadedDate ? <span>{uploadedDate}</span> : null}
          </div>
        ) : null}
      </div>
      <div className="candidate-detail-doc-actions">
        {upload?.hasFile ? (
          <a
            className="btn btn-secondary btn-sm"
            href={getCandidateDocumentDownloadUrl(candidateId, upload.id)}
            rel="noopener noreferrer"
            target="_blank"
          >
            İndir
          </a>
        ) : null}

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
          {uploading
            ? "Yükleniyor..."
            : status === "uploaded"
            ? "Yenile"
            : "Dosya Yükle"}
        </label>

        {status === "missing" ? (
          <button
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={handleMarkPhysical}
            type="button"
          >
            {markingPhysical ? "İşaretleniyor..." : "Fiziksel"}
          </button>
        ) : null}

        {upload ? (
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
    </li>
  );
}

function TrainingTab({
  candidate,
  onChanged,
}: {
  candidate: CandidateResponse;
  onChanged: (updated: CandidateResponse | null) => void;
}) {
  const { showToast } = useToast();
  const [calendarEvents, setCalendarEvents] = useState<TrainingCalendarEvent[]>([]);
  const [calendarBranches, setCalendarBranches] = useState<TrainingBranchDefinitionResponse[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const plan = candidate.educationPlan;
  const branchHelpers = useMemo(
    () => buildBranchHelpers(calendarBranches),
    [calendarBranches]
  );
  const completedHoursByKind = useMemo(() => {
    return calendarEvents.reduce(
      (acc, event) => {
        if (event.id.includes("-exam") || event.status !== "completed") return acc;
        const hours = Math.max(0, event.end.getTime() - event.start.getTime()) / 36e5;
        if (event.kind === "teorik") {
          acc.theory += hours;
        } else {
          acc.practice += hours;
        }
        return acc;
      },
      { theory: 0, practice: 0 }
    );
  }, [calendarEvents]);
  const progressRows = plan
    ? [
        {
          label: "Teorik",
          planned: numericHours(plan.theoryLessonHours),
          completed: completedHoursByKind.theory,
          required: plan.requiresTheoryExam || numericHours(plan.theoryLessonHours) > 0,
        },
        {
          label: "Simülatör",
          planned: numericHours(plan.simulatorLessonHours),
          completed: 0,
          required: numericHours(plan.simulatorLessonHours) > 0,
        },
        {
          label: "Direksiyon",
          planned: numericHours(plan.practiceLessonHours),
          completed: completedHoursByKind.practice,
          required: plan.requiresPracticeExam || numericHours(plan.practiceLessonHours) > 0,
        },
      ]
    : [];
  const plannedTotalHours = progressRows.reduce((sum, row) => sum + row.planned, 0);
  const completedTotalHours = progressRows.reduce((sum, row) => sum + row.completed, 0);
  const remainingTotalHours = Math.max(plannedTotalHours - completedTotalHours, 0);
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
      onChanged(updated);
      showToast(groupId ? "Grup atandı" : "Aktif grup ataması kapatıldı");
    } catch {
      showToast("Grup ataması kaydedilemedi", "error");
      throw new Error("save failed");
    }
  };

  return (
    <div className="candidate-detail-tab-content candidate-detail-training-layout">
      <div className="candidate-detail-training-top">
        <section className="instructor-detail-card">
          <h3 className="candidate-detail-section-title">Eğitim Özeti</h3>
          {plan ? (
            <>
              <div className="instructor-detail-summary-grid">
                <Field label="Ehliyet Tipi" value={candidate.licenseClass} />
                <Field
                  label="Sertifika Programı"
                  value={plan.certificateProgramId ? "Varyasyon bazlı" : "Standart kural"}
                />
                <Field label="Toplam Saat" value={formatHours(plannedTotalHours)} />
                <Field label="Kalan Saat" value={formatHours(remainingTotalHours)} />
                <Field
                  label="Teorik Eğitim"
                  value={plan.requiresTheoryExam ? "Gerekli" : "Muaf / Gerekli değil"}
                />
                <Field
                  label="Direksiyon Eğitimi"
                  value={plan.requiresPracticeExam ? "Gerekli" : "Muaf / Gerekli değil"}
                />
              </div>
              <div className="form-subsection-note" style={{ marginTop: 8 }}>
                Eğitim planı seçilen sertifika programından türetilir; doğrudan düzenlenmez.
              </div>
            </>
          ) : (
            <div className="instructor-detail-empty">
              Bu aday için eğitim planı tanımlanmamış.
            </div>
          )}
        </section>

        <section className="instructor-detail-card">
          <h3 className="candidate-detail-section-title">Grup Yönetimi</h3>
          <div className="candidate-detail-edit-list">
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
          </div>
          <div className="form-subsection-note" style={{ marginTop: 8 }}>
            Yeni bir grup seçildiğinde mevcut aktif atama otomatik kapatılır. Boş seçim aktif atamayı kaldırır.
          </div>
        </section>
      </div>

      <section className="instructor-detail-card candidate-detail-calendar-card">
        <h3 className="candidate-detail-section-title">Aday Takvimi</h3>
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

      <section className="instructor-detail-card">
        <h3 className="candidate-detail-section-title">Ders İlerlemesi</h3>
        {plan ? (
          <>
            <table className="data-table candidate-detail-training-progress-table">
              <thead>
                <tr>
                  <th>Eğitim</th>
                  <th>Durum</th>
                  <th>Planlanan</th>
                  <th>Tamamlanan</th>
                  <th>Kalan</th>
                </tr>
              </thead>
              <tbody>
                {progressRows.map((row) => {
                  const completed = row.completed;
                  const remaining = Math.max(row.planned - completed, 0);
                  return (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td>{row.required ? "Gerekli" : "Muaf"}</td>
                      <td>{formatHours(row.planned)}</td>
                      <td>{formatHours(completed)}</td>
                      <td>{formatHours(remaining)}</td>
                    </tr>
                  );
                })}
                <tr className="candidate-detail-training-progress-total">
                  <td>Toplam</td>
                  <td>—</td>
                  <td>{formatHours(plannedTotalHours)}</td>
                  <td>{formatHours(completedTotalHours)}</td>
                  <td>{formatHours(remainingTotalHours)}</td>
                </tr>
              </tbody>
            </table>
            <div className="form-subsection-note" style={{ marginTop: 8 }}>
              Tamamlanan saatler ders gerçekleşmeleri bağlandığında otomatik hesaplanacak.
            </div>
          </>
        ) : (
          <div className="instructor-detail-empty">
            Bu aday için eğitim planı tanımlanmamış.
          </div>
        )}
      </section>
    </div>
  );
}
