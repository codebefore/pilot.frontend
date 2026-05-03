import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { CandidateAvatar } from "../components/ui/CandidateAvatar";
import { TrainingCalendar } from "../components/training/TrainingCalendar";
import { EditableRow } from "../components/ui/EditableRow";
import { LocalizedDateInput } from "../components/ui/LocalizedDateInput";
import { Modal } from "../components/ui/Modal";
import type { SelectOption } from "../components/ui/EditableRow";
import { useToast } from "../components/ui/Toast";
import {
  assignCandidateGroup,
  getCandidateById,
  removeActiveGroupAssignment,
  updateCandidate,
} from "../lib/candidates-api";
import {
  cancelCandidateCharge,
  cancelCandidatePayment,
  createCandidatePayment,
  createCandidatePaymentPlan,
  createCandidateSuggestedCharge,
  getCandidateBilling,
} from "../lib/candidate-billing-api";
import { getCertificatePrograms } from "../lib/certificate-programs-api";
import { getGroups } from "../lib/groups-api";
import { getTrainingBranchDefinitions } from "../lib/training-branch-definitions-api";
import { getTrainingLessons } from "../lib/training-lessons-api";
import {
  trainingLessonToCalendarEvent,
  type TrainingCalendarEvent,
} from "../lib/training-calendar";
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
  CandidateBillingSummaryResponse,
  CandidatePaymentInstallmentResponse,
  CandidatePaymentInstallmentPaymentStatus,
  CandidatePaymentMethod,
  CandidatePaymentResponse,
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
  { key: "payments", label: "Tahsilat" },
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
  const [billing, setBilling] = useState<CandidateBillingSummaryResponse | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [chargeSaving, setChargeSaving] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentPlanSaving, setPaymentPlanSaving] = useState(false);

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

  // Lazy-load candidate billing when the Tahsilat tab is first opened.
  useEffect(() => {
    if (activeTab !== "payments") return;
    if (!candidateId) return;
    if (billing !== null) return;

    const controller = new AbortController();
    setBillingLoading(true);
    setBillingError(null);

    getCandidateBilling(candidateId, controller.signal)
      .then((response) => setBilling(response))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setBillingError("Tahsilat bilgileri yüklenemedi");
      })
      .finally(() => {
        if (!controller.signal.aborted) setBillingLoading(false);
      });

    return () => controller.abort();
  }, [activeTab, billing, candidateId]);

  const refreshBilling = async () => {
    if (!candidateId) return;
    const response = await getCandidateBilling(candidateId);
    setBilling(response);
  };

  const handleCreateSuggestedCharge = async () => {
    if (!candidate || chargeSaving) return;
    setChargeSaving(true);
    try {
      await createCandidateSuggestedCharge(candidate.id);
      await refreshBilling();
      showToast("Borçlandırma oluşturuldu");
    } catch (error) {
      showToast(billingErrorMessage(error, "Borçlandırma oluşturulamadı"), "error");
    } finally {
      setChargeSaving(false);
    }
  };

  const handleCreatePayment = async (
    amount: number,
    paymentMethod: CandidatePaymentMethod,
    note: string | null,
    installmentId: string | null
  ) => {
    if (!candidate || paymentSaving) return;
    setPaymentSaving(true);
    try {
      await createCandidatePayment(candidate.id, {
        amount,
        paymentMethod,
        candidatePaymentInstallmentId: installmentId,
        note,
      });
      await refreshBilling();
      showToast("Tahsilat kaydedildi");
    } catch (error) {
      showToast(billingErrorMessage(error, "Tahsilat kaydedilemedi"), "error");
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleCreatePaymentPlan = async (
    downPaymentAmount: number,
    installmentCount: number,
    firstDueDate: string
  ) => {
    if (!candidate || paymentPlanSaving) return;
    setPaymentPlanSaving(true);
    try {
      const response = await createCandidatePaymentPlan(candidate.id, {
        downPaymentAmount,
        installmentCount,
        firstDueDate,
      });
      setBilling(response);
      showToast("Ödeme planı oluşturuldu");
    } catch (error) {
      showToast(billingErrorMessage(error, "Ödeme planı oluşturulamadı"), "error");
    } finally {
      setPaymentPlanSaving(false);
    }
  };

  const handleCancelCharge = async (chargeId: string, cancellationReason: string) => {
    if (!candidate) return;
    try {
      await cancelCandidateCharge(candidate.id, chargeId, cancellationReason);
      await refreshBilling();
      showToast("Borçlandırma iptal edildi");
    } catch (error) {
      showToast(billingErrorMessage(error, "Borçlandırma iptal edilemedi"), "error");
    }
  };

  const handleCancelPayment = async (paymentId: string, cancellationReason: string) => {
    if (!candidate) return;
    try {
      await cancelCandidatePayment(candidate.id, paymentId, cancellationReason);
      await refreshBilling();
      showToast("Tahsilat iptal edildi");
    } catch (error) {
      showToast(billingErrorMessage(error, "Tahsilat iptal edilemedi"), "error");
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
          <CandidateQuickStats candidate={candidate} />

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
              <PaymentsTab
                billing={billing}
                billingError={billingError}
                billingLoading={billingLoading}
                candidate={candidate}
                chargeSaving={chargeSaving}
                onCancelCharge={(chargeId, cancellationReason) =>
                  void handleCancelCharge(chargeId, cancellationReason)
                }
                onCancelPayment={(paymentId, cancellationReason) =>
                  void handleCancelPayment(paymentId, cancellationReason)
                }
                onCreatePayment={(amount, method, note, installmentId) =>
                  void handleCreatePayment(amount, method, note, installmentId)
                }
                onCreatePaymentPlan={(downPaymentAmount, installmentCount, firstDueDate) =>
                  void handleCreatePaymentPlan(downPaymentAmount, installmentCount, firstDueDate)
                }
                onCreateSuggestedCharge={() => void handleCreateSuggestedCharge()}
                paymentPlanSaving={paymentPlanSaving}
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
          <span className="candidate-detail-hero-chip">Sınıf {candidate.licenseClass}</span>
          {candidate.currentGroup ? (
            <span className="candidate-detail-hero-chip">
              {candidate.currentGroup.title}
            </span>
          ) : null}
          {candidate.tags?.map((tag) => (
            <span className="candidate-detail-hero-tag" key={tag.id}>
              #{tag.name}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}

function CandidateQuickStats({ candidate }: { candidate: CandidateResponse }) {
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
    <div className="candidate-detail-stats">
      <Stat label="Ehliyet Sınıfı" value={candidate.licenseClass} />
      <Stat label="Aktif Grup" value={groupLabel} />
      <Stat
        label="Evraklar"
        value={docLabel}
        sub={summary?.missingCount ? `${summary.missingCount} eksik` : undefined}
      />
      <Stat label="Kayıt Ücreti" value={paymentLabel} />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="candidate-detail-stat">
      <div className="candidate-detail-stat-label">{label}</div>
      <div className="candidate-detail-stat-value">{value}</div>
      {sub ? <div className="candidate-detail-stat-sub">{sub}</div> : null}
    </div>
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

function billingErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  const messages = Object.values(error.validationErrors ?? {}).flat();
  const firstMessage = messages[0];
  if (!firstMessage) return fallback;

  if (firstMessage.includes("active balance")) return "Tahsilat kalan bakiyeyi aşamaz.";
  if (firstMessage.includes("selected installment")) return "Tahsilat seçilen taksitin kalan tutarını aşamaz.";
  if (firstMessage.includes("collected payments exceed active debt")) {
    return "Bu borç iptal edilirse tahsilatlar aktif borcu aşar. Önce ilgili tahsilatı iptal edin.";
  }
  if (firstMessage.includes("Cancellation reason")) return "İptal sebebi zorunlu.";
  return firstMessage;
}

function paymentMethodLabel(method: CandidatePaymentMethod): string {
  if (method === "cash") return "Nakit";
  if (method === "card") return "Kart";
  if (method === "bank_transfer") return "Havale/EFT";
  return "Diğer";
}

function installmentPaymentStatusLabel(status: CandidatePaymentInstallmentPaymentStatus): string {
  if (status === "paid") return "Ödendi";
  if (status === "partial") return "Kısmi";
  if (status === "overdue") return "Gecikti";
  if (status === "cancelled") return "İptal";
  return "Bekliyor";
}

function PaymentsTab({
  billing,
  billingLoading,
  billingError,
  candidate,
  chargeSaving,
  paymentSaving,
  paymentPlanSaving,
  onCreateSuggestedCharge,
  onCreatePaymentPlan,
  onCreatePayment,
  onCancelCharge,
  onCancelPayment,
}: {
  billing: CandidateBillingSummaryResponse | null;
  billingLoading: boolean;
  billingError: string | null;
  candidate: CandidateResponse;
  chargeSaving: boolean;
  paymentSaving: boolean;
  paymentPlanSaving: boolean;
  onCreateSuggestedCharge: () => void;
  onCreatePaymentPlan: (
    downPaymentAmount: number,
    installmentCount: number,
    firstDueDate: string
  ) => void;
  onCreatePayment: (
    amount: number,
    method: CandidatePaymentMethod,
    note: string | null,
    installmentId: string | null
  ) => void;
  onCancelCharge: (chargeId: string, cancellationReason: string) => void;
  onCancelPayment: (paymentId: string, cancellationReason: string) => void;
}) {
  const [searchParams] = useSearchParams();
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<CandidatePaymentMethod>("cash");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentInstallmentId, setPaymentInstallmentId] = useState("");
  const [downPaymentAmount, setDownPaymentAmount] = useState("");
  const [installmentCount, setInstallmentCount] = useState("4");
  const [firstDueDate, setFirstDueDate] = useState(todayIsoDate());
  const [showCancelledInstallments, setShowCancelledInstallments] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<CandidatePaymentResponse | null>(null);
  const [activeBillingAction, setActiveBillingAction] = useState<"payment" | "plan" | null>(null);
  const [cancelTarget, setCancelTarget] = useState<
    | { type: "charge"; id: string; label: string }
    | { type: "payment"; id: string; label: string }
    | null
  >(null);

  useEffect(() => {
    if (searchParams.get("action") !== "payment") return;
    setActiveBillingAction("payment");
    const installmentId = searchParams.get("installmentId");
    if (installmentId) {
      setPaymentInstallmentId(installmentId);
    }
  }, [searchParams]);
  const activeCharges = billing?.charges.filter((item) => item.status === "active") ?? [];
  const activePayments = billing?.payments.filter((item) => item.status === "active") ?? [];
  const activeInstallments = billing?.installments.filter((item) => item.status === "active") ?? [];
  const visibleInstallments =
    billing?.installments.filter((item) => showCancelledInstallments || item.status === "active") ?? [];
  const installmentById = new Map(
    (billing?.installments ?? []).map((installment) => [installment.id, installment])
  );
  const cancelledInstallmentCount =
    billing?.installments.filter((item) => item.status === "cancelled").length ?? 0;
  const suggestedAlreadyCharged = Boolean(
    billing?.suggestedCharge &&
      activeCharges.some(
        (charge) =>
          charge.sourceType === "matrix" &&
          charge.sourceReferenceId === billing.suggestedCharge?.certificateProgramId &&
          charge.feeYear === billing.suggestedCharge?.feeYear
      )
  );
  const parsedPaymentAmount = parseMoneyInput(paymentAmount);
  const canSubmitPayment =
    parsedPaymentAmount != null && parsedPaymentAmount > 0 && !paymentSaving;
  const parsedDownPaymentAmount = parseMoneyInput(downPaymentAmount) ?? 0;
  const parsedInstallmentCount = Number.parseInt(installmentCount, 10);
  const canCreatePaymentPlan =
    Boolean(billing) &&
    billing!.balance > 0 &&
    parsedDownPaymentAmount >= 0 &&
    parsedDownPaymentAmount < billing!.balance &&
    Number.isInteger(parsedInstallmentCount) &&
    parsedInstallmentCount >= 1 &&
    parsedInstallmentCount <= 24 &&
    Boolean(firstDueDate) &&
    !paymentPlanSaving;

  const submitPayment = () => {
    if (!canSubmitPayment || parsedPaymentAmount == null) return;
    onCreatePayment(
      parsedPaymentAmount,
      paymentMethod,
      paymentNote.trim() || null,
      paymentInstallmentId || null
    );
    setPaymentAmount("");
    setPaymentNote("");
    setPaymentInstallmentId("");
  };
  const selectInstallmentForPayment = (installmentId: string) => {
    const installment = activeInstallments.find((item) => item.id === installmentId);
    setPaymentInstallmentId(installmentId);
    setActiveBillingAction("payment");
    if (!installment) return;

    setPaymentAmount(String(installment.remainingAmount));
    setPaymentNote(`${installment.description} tahsilatı`);
  };
  const submitPaymentPlan = () => {
    if (!canCreatePaymentPlan) return;
    onCreatePaymentPlan(parsedDownPaymentAmount, parsedInstallmentCount, firstDueDate);
  };
  const suggestedProgramLabel =
    billing?.suggestedCharge?.sourceLicenseDisplayName &&
    billing.suggestedCharge.targetLicenseDisplayName
      ? `${billing.suggestedCharge.sourceLicenseDisplayName}${
          billing.suggestedCharge.sourceLicensePre2016 ? " (2016 öncesi)" : ""
        } -> ${billing.suggestedCharge.targetLicenseDisplayName}`
      : billing?.suggestedCharge?.description ?? null;

  return (
    <div className="candidate-detail-tab-content">
      <section className="instructor-detail-card">
        <h3 className="candidate-detail-section-title">Cari Özet</h3>
        {billingLoading ? (
          <div className="instructor-detail-empty">Tahsilat bilgileri yükleniyor...</div>
        ) : billingError ? (
          <div className="instructor-detail-error">{billingError}</div>
        ) : billing ? (
          <div className="candidate-billing-summary-grid">
            <div className="candidate-billing-summary-card is-suggested">
              <span className="candidate-detail-stat-label">Matrix Tutarı</span>
              <strong>
                {billing.suggestedCharge
                  ? formatCurrencyTRY(billing.suggestedCharge.amount)
                  : "—"}
              </strong>
            </div>
            <div className="candidate-billing-summary-card">
              <span className="candidate-detail-stat-label">Kesinleşmiş Borç</span>
              <strong>{formatCurrencyTRY(billing.totalDebt)}</strong>
            </div>
            <div className="candidate-billing-summary-card">
              <span className="candidate-detail-stat-label">Tahsil Edilen</span>
              <strong>{formatCurrencyTRY(billing.totalPaid)}</strong>
            </div>
            <div className="candidate-billing-summary-card is-balance">
              <span className="candidate-detail-stat-label">Kalan Bakiye</span>
              <strong>{formatCurrencyTRY(billing.balance)}</strong>
            </div>
            {billing.totalDebt === 0 && billing.suggestedCharge ? (
              <div className="candidate-billing-summary-note">
                Matrix önerisi henüz borçlandırılmadığı için kesinleşmiş borç 0 görünüyor.
              </div>
            ) : null}
            {!billing.suggestedCharge ? (
              <div className="candidate-billing-summary-note">
                Bu aday için matrixte pozitif sözleşme tutarı bulunamadı.
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="candidate-billing-action-bar">
        <div className="candidate-billing-action-meta">
          <span>Hızlı işlemler</span>
          {billing?.suggestedCharge ? (
            <strong>
              Matrix: {formatCurrencyTRY(billing.suggestedCharge.amount)}
              {suggestedProgramLabel ? ` · ${suggestedProgramLabel}` : ""}
            </strong>
          ) : (
            <strong>Matrix önerisi yok</strong>
          )}
        </div>
        <div className="candidate-billing-action-buttons">
          {billing?.suggestedCharge ? (
            <button
              className="btn btn-primary"
              disabled={chargeSaving || suggestedAlreadyCharged}
              onClick={onCreateSuggestedCharge}
              type="button"
            >
              {chargeSaving
                ? "Borçlandırılıyor..."
                : suggestedAlreadyCharged
                ? "Borçlandırıldı"
                : "Borçlandır"}
            </button>
          ) : null}
          <button
            className={`btn ${
              activeBillingAction === "payment" ? "btn-primary" : "btn-secondary"
            }`}
            onClick={() =>
              setActiveBillingAction((current) => (current === "payment" ? null : "payment"))
            }
            type="button"
          >
            Tahsilat Gir
          </button>
          <button
            className={`btn ${activeBillingAction === "plan" ? "btn-primary" : "btn-secondary"}`}
            onClick={() =>
              setActiveBillingAction((current) => (current === "plan" ? null : "plan"))
            }
            type="button"
          >
            Ödeme Planı
          </button>
        </div>
      </section>

      {activeBillingAction ? (
        <section className="candidate-billing-active-panel">
          <div className="candidate-billing-active-panel-head">
            <div>
              <span>Aktif İşlem</span>
              <h3>
                {activeBillingAction === "payment" ? "Tahsilat Al" : "Ödeme Planı Oluştur"}
              </h3>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setActiveBillingAction(null)}
              type="button"
            >
              Kapat
            </button>
          </div>
          {activeBillingAction === "payment" ? (
            <div className="candidate-billing-payment-form">
              <input
                className="form-input"
                inputMode="decimal"
                onChange={(event) => setPaymentAmount(event.target.value)}
                placeholder="Tutar"
                value={paymentAmount}
              />
              <select
                className="form-select"
                onChange={(event) => setPaymentMethod(event.target.value as CandidatePaymentMethod)}
                value={paymentMethod}
              >
                <option value="cash">Nakit</option>
                <option value="card">Kart</option>
                <option value="bank_transfer">Havale/EFT</option>
                <option value="other">Diğer</option>
              </select>
              <input
                className="form-input"
                onChange={(event) => setPaymentNote(event.target.value)}
                placeholder="Açıklama"
                value={paymentNote}
              />
              <select
                className="form-select"
                onChange={(event) => {
                  const nextInstallmentId = event.target.value;
                  if (!nextInstallmentId) {
                    setPaymentInstallmentId("");
                    return;
                  }
                  selectInstallmentForPayment(nextInstallmentId);
                }}
                value={paymentInstallmentId}
              >
                <option value="">Taksit seçilmedi</option>
                {activeInstallments.map((installment) => (
                  <option key={installment.id} value={installment.id}>
                    {installment.description} · {formatDateTR(installment.dueDate)} ·{" "}
                    {formatCurrencyTRY(installment.remainingAmount)}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-primary"
                disabled={!canSubmitPayment}
                onClick={submitPayment}
                type="button"
              >
                {paymentSaving ? "Kaydediliyor..." : "Tahsilat Kaydet"}
              </button>
            </div>
          ) : billing && billing.balance > 0 ? (
            <div className="candidate-billing-plan-form">
              <input
                className="form-input"
                inputMode="decimal"
                onChange={(event) => setDownPaymentAmount(event.target.value)}
                placeholder="Peşinat"
                value={downPaymentAmount}
              />
              <input
                className="form-input"
                inputMode="numeric"
                max={24}
                min={1}
                onChange={(event) => setInstallmentCount(event.target.value)}
                placeholder="Taksit sayısı"
                type="number"
                value={installmentCount}
              />
              <LocalizedDateInput
                className="form-input"
                defaultOnOpen={todayIsoDate()}
                onChange={setFirstDueDate}
                placeholder="İlk vade"
                value={firstDueDate}
              />
              <button
                className="btn btn-primary"
                disabled={!canCreatePaymentPlan}
                onClick={submitPaymentPlan}
                type="button"
              >
                {paymentPlanSaving ? "Oluşturuluyor..." : "Plan Oluştur"}
              </button>
              {activeInstallments.length > 0 ? (
                <div className="candidate-billing-plan-warning">
                  Yeni plan oluşturulursa mevcut aktif plan iptal edilir.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="instructor-detail-empty">Planlanacak aktif bakiye yok.</div>
          )}
        </section>
      ) : null}

      <div className="candidate-billing-workspace">
        <section className="instructor-detail-card candidate-billing-workspace-card">
          <h3 className="candidate-detail-section-title">Ödeme Planı</h3>
          {cancelledInstallmentCount > 0 ? (
            <label className="candidate-billing-history-toggle">
              <input
                checked={showCancelledInstallments}
                onChange={(event) => setShowCancelledInstallments(event.target.checked)}
                type="checkbox"
              />
              <span>İptal edilenleri göster</span>
            </label>
          ) : null}
          {visibleInstallments.length === 0 ? (
            <div className="candidate-billing-plan-empty">Aktif ödeme planı yok.</div>
          ) : (
            <table className="data-table candidate-detail-fee-table candidate-billing-plan-table">
              <thead>
                <tr>
                  <th>Taksit</th>
                  <th>Vade</th>
                  <th>Tutar</th>
                  <th>Ödenen</th>
                  <th>Kalan</th>
                  <th>Durum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleInstallments.map((installment) => (
                  <tr
                    className={
                      installment.status === "cancelled"
                        ? "candidate-billing-installment-row-cancelled"
                        : undefined
                    }
                    key={installment.id}
                  >
                    <td>{installment.description}</td>
                    <td>{formatDateTR(installment.dueDate)}</td>
                    <td>{formatCurrencyTRY(installment.amount)}</td>
                    <td>{formatCurrencyTRY(installment.paidAmount)}</td>
                    <td>{formatCurrencyTRY(installment.remainingAmount)}</td>
                    <td>
                      <span
                        className={`candidate-billing-installment-status status-${installment.paymentStatus}`}
                      >
                        {installmentPaymentStatusLabel(installment.paymentStatus)}
                      </span>
                    </td>
                    <td>
                      {installment.status === "active" && installment.remainingAmount > 0 ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => selectInstallmentForPayment(installment.id)}
                          type="button"
                        >
                          Öde
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="instructor-detail-card candidate-billing-workspace-card">
          <h3 className="candidate-detail-section-title">Tahsilatlar</h3>
          {activePayments.length === 0 ? (
            <div className="instructor-detail-empty">Tahsilat kaydı yok.</div>
          ) : (
            <table className="data-table candidate-detail-fee-table">
              <thead>
                <tr>
                  <th>Tutar</th>
                  <th>Yöntem</th>
                  <th>Taksit</th>
                  <th>Tarih</th>
                  <th>Açıklama</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {activePayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatCurrencyTRY(payment.amount)}</td>
                    <td>{paymentMethodLabel(payment.paymentMethod)}</td>
                    <td>
                      {payment.candidatePaymentInstallmentId
                        ? installmentById.get(payment.candidatePaymentInstallmentId)?.description ??
                          "Taksit"
                        : "—"}
                    </td>
                    <td>{formatDateTR(payment.paidAtUtc)}</td>
                    <td>{payment.note ?? "—"}</td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setReceiptPayment(payment)}
                        type="button"
                      >
                        Makbuz
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() =>
                          setCancelTarget({
                            type: "payment",
                            id: payment.id,
                            label: `${formatCurrencyTRY(payment.amount)} tahsilat`,
                          })
                        }
                        type="button"
                      >
                        İptal
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="instructor-detail-card candidate-billing-charges-card">
        <h3 className="candidate-detail-section-title">Borçlandırmalar</h3>
        {activeCharges.length === 0 ? (
          <div className="instructor-detail-empty">Aktif borçlandırma yok.</div>
        ) : (
          <table className="data-table candidate-detail-fee-table">
            <thead>
              <tr>
                <th>Açıklama</th>
                <th>Tutar</th>
                <th>Tarih</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {activeCharges.map((charge) => (
                <tr key={charge.id}>
                  <td>{charge.description}</td>
                  <td>{formatCurrencyTRY(charge.amount)}</td>
                  <td>{formatDateTR(charge.chargedAtUtc)}</td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        setCancelTarget({
                          type: "charge",
                          id: charge.id,
                          label: charge.description,
                        })
                      }
                      type="button"
                    >
                      İptal
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <PaymentReceiptModal
        candidate={candidate}
        installment={
          receiptPayment?.candidatePaymentInstallmentId
            ? installmentById.get(receiptPayment.candidatePaymentInstallmentId) ?? null
            : null
        }
        onClose={() => setReceiptPayment(null)}
        payment={receiptPayment}
      />
      <BillingCancelModal
        onClose={() => setCancelTarget(null)}
        onConfirm={(reason) => {
          if (!cancelTarget) return;
          if (cancelTarget.type === "charge") {
            onCancelCharge(cancelTarget.id, reason);
          } else {
            onCancelPayment(cancelTarget.id, reason);
          }
          setCancelTarget(null);
        }}
        target={cancelTarget}
      />
    </div>
  );
}

function BillingCancelModal({
  target,
  onClose,
  onConfirm,
}: {
  target:
    | { type: "charge"; id: string; label: string }
    | { type: "payment"; id: string; label: string }
    | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (target) setReason("");
  }, [target]);

  if (!target) return null;

  const title = target.type === "charge" ? "Borçlandırmayı İptal Et" : "Tahsilatı İptal Et";
  const canConfirm = reason.trim().length >= 3;

  return (
    <Modal
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} type="button">
            Vazgeç
          </button>
          <button
            className="btn btn-primary"
            disabled={!canConfirm}
            onClick={() => onConfirm(reason.trim())}
            type="button"
          >
            İptal Et
          </button>
        </>
      }
      onClose={onClose}
      open={Boolean(target)}
      title={title}
    >
      <div className="candidate-billing-cancel-modal">
        <div className="candidate-billing-cancel-target">{target.label}</div>
        <label className="form-field">
          <span>İptal sebebi</span>
          <textarea
            className="form-input"
            onChange={(event) => setReason(event.target.value)}
            placeholder="Örn. Yanlış tutar girildi"
            rows={3}
            value={reason}
          />
        </label>
      </div>
    </Modal>
  );
}

function PaymentReceiptModal({
  candidate,
  installment,
  payment,
  onClose,
}: {
  candidate: CandidateResponse;
  installment: CandidatePaymentInstallmentResponse | null;
  payment: CandidatePaymentResponse | null;
  onClose: () => void;
}) {
  if (!payment) return null;

  return (
    <Modal
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} type="button">
            Kapat
          </button>
          <button className="btn btn-primary" onClick={() => window.print()} type="button">
            Yazdır
          </button>
        </>
      }
      onClose={onClose}
      open={Boolean(payment)}
      title="Tahsilat Makbuzu"
    >
      <div className="candidate-payment-receipt">
        <div className="candidate-payment-receipt-head">
          <div>
            <strong>Pilot Sürücü Kursu</strong>
            <span>Tahsilat Makbuzu</span>
          </div>
          <div className="candidate-payment-receipt-no">
            #{payment.id.slice(0, 8).toLocaleUpperCase("tr-TR")}
          </div>
        </div>
        <div className="candidate-payment-receipt-amount">
          {formatCurrencyTRY(payment.amount)}
        </div>
        <dl className="candidate-payment-receipt-grid">
          <div>
            <dt>Aday</dt>
            <dd>{candidate.firstName} {candidate.lastName}</dd>
          </div>
          <div>
            <dt>TC Kimlik No</dt>
            <dd>{candidate.nationalId}</dd>
          </div>
          <div>
            <dt>Ödeme Tarihi</dt>
            <dd>{formatDateTR(payment.paidAtUtc)}</dd>
          </div>
          <div>
            <dt>Ödeme Yöntemi</dt>
            <dd>{paymentMethodLabel(payment.paymentMethod)}</dd>
          </div>
          <div>
            <dt>Bağlı Taksit</dt>
            <dd>{installment ? installment.description : "—"}</dd>
          </div>
          <div>
            <dt>Açıklama</dt>
            <dd>{payment.note ?? "—"}</dd>
          </div>
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
