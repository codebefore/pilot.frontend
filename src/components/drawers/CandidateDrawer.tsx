import { useEffect, useState } from "react";

import {
  assignCandidateGroup,
  deleteCandidate,
  getCandidateById,
  removeActiveGroupAssignment,
  updateCandidate,
} from "../../lib/candidates-api";
import {
  getCandidateDocuments,
  getDocumentChecklist,
  getDocumentTypes,
} from "../../lib/documents-api";
import { getGroups } from "../../lib/groups-api";
import { useLanguage, useT } from "../../lib/i18n";
import { buildWhatsAppUrl, formatPhoneNumber } from "../../lib/phone";
import { buildGroupHeading, compareTermsDesc } from "../../lib/term-label";
import { getTerms } from "../../lib/terms-api";
import {
  CANDIDATE_MEB_SYNC_STATUS_OPTIONS,
  candidateExamResultLabel,
  candidateGenderLabel,
  CANDIDATE_GENDER_OPTIONS,
  candidateMebSyncStatusLabel,
  candidateStatusLabel,
  CANDIDATE_STATUS_OPTIONS,
  EXISTING_LICENSE_TYPE_OPTIONS,
  existingLicenseTypeLabel,
  formatDateTR,
  LICENSE_CLASS_OPTIONS,
  normalizeCandidateGender,
  normalizeCandidateExamResultValue,
  normalizeCandidateMebSyncStatusValue,
  normalizeCandidateStatusValue,
  TURKEY_PROVINCE_OPTIONS,
} from "../../lib/status-maps";
import type {
  CandidateResponse,
  CandidateUpsertRequest,
  DocumentResponse,
  DocumentTypeResponse,
  LicenseClass,
} from "../../lib/types";
import { ApiError } from "../../lib/http";
import { UploadDocumentModal } from "../modals/UploadDocumentModal";
import { WhatsAppIcon } from "../icons";
import { CandidateAvatar } from "../ui/CandidateAvatar";
import { CandidateTagsInput } from "../ui/CandidateTagsInput";
import { CustomSelect } from "../ui/CustomSelect";
import { Drawer, DrawerRow, DrawerSection } from "../ui/Drawer";
import { EditableRow } from "../ui/EditableRow";
import { LocalizedDateInput } from "../ui/LocalizedDateInput";
import type { SelectOption } from "../ui/EditableRow";
import { useToast } from "../ui/Toast";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ── Drawer ── */

type CandidateDrawerProps = {
  candidateId: string | null;
  onClose: () => void;
  onDeleted: () => void;
  onUpdated?: () => void;
};

const STATUS_OPTIONS: SelectOption[] = CANDIDATE_STATUS_OPTIONS;
const EXISTING_LICENSE_EDIT_OPTIONS: SelectOption[] = [
  { value: "", label: "— Belge Yok —" },
  ...EXISTING_LICENSE_TYPE_OPTIONS,
];
const BOOLEAN_OPTIONS: SelectOption[] = [
  { value: "true", label: "Evet" },
  { value: "false", label: "Hayir" },
];
const MEB_SYNC_STATUS_OPTIONS: SelectOption[] = CANDIDATE_MEB_SYNC_STATUS_OPTIONS;
const EXAM_FEE_OPTIONS: SelectOption[] = [
  { value: "true", label: "Ödendi" },
  { value: "false", label: "Ödenmedi" },
];
const EXAM_ATTEMPT_OPTIONS: SelectOption[] = [
  { value: "1", label: "1/4" },
  { value: "2", label: "2/4" },
  { value: "3", label: "3/4" },
  { value: "4", label: "4/4" },
];

type ExistingLicenseDraft = {
  enabled: boolean;
  type: string;
  issuedAt: string;
  number: string;
  issuedProvince: string;
  pre2016: boolean;
};

function buildExistingLicenseDraft(candidate: CandidateResponse | null): ExistingLicenseDraft {
  return {
    enabled: !!candidate?.existingLicenseType,
    type: candidate?.existingLicenseType ?? "",
    issuedAt: candidate?.existingLicenseIssuedAt ?? "",
    number: candidate?.existingLicenseNumber ?? "",
    issuedProvince: candidate?.existingLicenseIssuedProvince ?? "",
    pre2016: candidate?.existingLicensePre2016 ?? false,
  };
}

export function CandidateDrawer({
  candidateId,
  onClose,
  onDeleted,
  onUpdated,
}: CandidateDrawerProps) {
  const { showToast } = useToast();
  const { lang } = useLanguage();
  const t = useT();
  const dateInputLang = lang === "tr" ? "tr-TR" : undefined;
  const today = todayISO();
  const [candidate, setCandidate] = useState<CandidateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [missingDocs, setMissingDocs] = useState<string[] | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<DocumentResponse[] | null>(null);
  const [docTypesForMetadata, setDocTypesForMetadata] = useState<DocumentTypeResponse[]>([]);
  const [existingLicenseDraft, setExistingLicenseDraft] = useState<ExistingLicenseDraft>(
    buildExistingLicenseDraft(null)
  );
  const [existingLicenseSaving, setExistingLicenseSaving] = useState(false);
  const [existingLicenseError, setExistingLicenseError] = useState<string | null>(null);

  useEffect(() => {
    if (!candidateId) {
      setCandidate(null);
      setConfirmDelete(false);
      setMissingDocs(null);
      setExistingLicenseDraft(buildExistingLicenseDraft(null));
      setExistingLicenseError(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    getCandidateById(candidateId, controller.signal)
      .then((data) => setCandidate(data))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setCandidate(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [candidateId]);

  useEffect(() => {
    setExistingLicenseDraft(buildExistingLicenseDraft(candidate));
    setExistingLicenseError(null);
  }, [candidate]);

  // Lazy-load missing document names from the checklist endpoint. Skipped when
  // the candidate has no missing documents to keep the drawer fast.
  useEffect(() => {
    if (!candidate || !candidate.documentSummary) {
      setMissingDocs(null);
      return;
    }
    if (candidate.documentSummary.missingCount === 0) {
      setMissingDocs([]);
      return;
    }
    const controller = new AbortController();
    getDocumentChecklist(
      { status: "missing", search: candidate.nationalId, page: 1, pageSize: 1 },
      controller.signal
    )
      .then((result) => setMissingDocs(result.items[0]?.missingDocumentNames ?? []))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setMissingDocs(null);
      });
    return () => controller.abort();
  }, [candidate]);

  // Load the candidate's uploaded documents + the matching document type
  // catalog so metadata values can be rendered against their human labels
  // (and select values mapped back to their option labels).
  useEffect(() => {
    if (!candidateId) {
      setUploadedDocs(null);
      return;
    }
    const controller = new AbortController();
    Promise.all([
      getCandidateDocuments(candidateId, controller.signal),
      getDocumentTypes({ includeInactive: true }, controller.signal),
    ])
      .then(([docs, types]) => {
        setUploadedDocs(docs);
        setDocTypesForMetadata(types);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setUploadedDocs([]);
      });
    return () => controller.abort();
  }, [candidateId]);

  const saveField = async (patch: Partial<CandidateUpsertRequest>) => {
    if (!candidate || !candidateId) return;
    try {
      const updated = await updateCandidate(candidateId, {
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        nationalId: candidate.nationalId,
        phoneNumber: candidate.phoneNumber,
        email: candidate.email,
        birthDate: candidate.birthDate,
        gender: normalizeCandidateGender(candidate.gender),
        licenseClass: candidate.licenseClass,
        existingLicenseType: candidate.existingLicenseType,
        existingLicenseIssuedAt: candidate.existingLicenseIssuedAt,
        existingLicenseNumber: candidate.existingLicenseNumber,
        existingLicenseIssuedProvince: candidate.existingLicenseIssuedProvince,
        existingLicensePre2016: candidate.existingLicensePre2016,
        mebSyncStatus: candidate.mebSyncStatus,
        mebExamDate: candidate.mebExamDate,
        drivingExamDate: candidate.drivingExamDate,
        mebExamResult: candidate.mebExamResult,
        eSinavAttemptCount: candidate.eSinavAttemptCount ?? 1,
        drivingExamAttemptCount: candidate.drivingExamAttemptCount ?? 1,
        status: normalizeCandidateStatusValue(candidate.status),
        examFeePaid: candidate.examFeePaid ?? false,
        tags: candidate.tags?.map((tag) => tag.name) ?? [],
        ...patch,
      });
      setCandidate(updated);
      onUpdated?.();
    } catch (error) {
      const validationMessage =
        error instanceof ApiError
          ? Object.values(error.validationErrors ?? {})[0]?.[0]
          : null;
      showToast(validationMessage ?? "Değişiklik kaydedilemedi", "error");
      throw new Error("save failed");
    }
  };

  const eSinavAttemptCount = candidate?.eSinavAttemptCount ?? 1;
  const isESinavAttemptLimitReached =
    eSinavAttemptCount >= 4 &&
    normalizeCandidateExamResultValue(candidate?.mebExamResult) === "failed";

  const buildExistingLicensePatch = (
    patch: Partial<CandidateUpsertRequest>
  ): Partial<CandidateUpsertRequest> | null => {
    if (!candidate) return null;

    const nextTypeRaw =
      patch.existingLicenseType !== undefined
        ? patch.existingLicenseType
        : candidate.existingLicenseType;
    const nextType = nextTypeRaw && nextTypeRaw.trim().length > 0 ? nextTypeRaw : null;

    if (!nextType) {
      return {
        existingLicenseType: null,
        existingLicenseIssuedAt: null,
        existingLicenseNumber: null,
        existingLicenseIssuedProvince: null,
        existingLicensePre2016: false,
      };
    }

    const nextIssuedAt =
      patch.existingLicenseIssuedAt !== undefined
        ? patch.existingLicenseIssuedAt
        : candidate.existingLicenseIssuedAt;
    const nextNumberRaw =
      patch.existingLicenseNumber !== undefined
        ? patch.existingLicenseNumber
        : candidate.existingLicenseNumber;
    const nextProvinceRaw =
      patch.existingLicenseIssuedProvince !== undefined
        ? patch.existingLicenseIssuedProvince
        : candidate.existingLicenseIssuedProvince;
    const nextNumber = nextNumberRaw?.trim() || null;
    const nextProvince = nextProvinceRaw?.trim() || null;
    const nextPre2016 =
      patch.existingLicensePre2016 !== undefined
        ? patch.existingLicensePre2016
        : candidate.existingLicensePre2016;

    if (!nextIssuedAt) {
      showToast("Belge tarihi zorunlu.", "error");
      throw new Error("existing license issuedAt required");
    }

    if (!nextNumber) {
      showToast("Belge numarasi zorunlu.", "error");
      throw new Error("existing license number required");
    }

    if (!nextProvince) {
      showToast("Belge verilis ili zorunlu.", "error");
      throw new Error("existing license province required");
    }

    return {
      existingLicenseType: nextType,
      existingLicenseIssuedAt: nextIssuedAt,
      existingLicenseNumber: nextNumber,
      existingLicenseIssuedProvince: nextProvince,
      existingLicensePre2016: nextPre2016 ?? false,
    };
  };

  const saveExistingLicenseField = async (
    patch: Partial<CandidateUpsertRequest>,
    successMessage = "Mevcut surucu belgesi guncellendi"
  ) => {
    const payload = buildExistingLicensePatch(patch);
    if (!payload) return;

    try {
      await saveField(payload);
      showToast(successMessage);
    } catch {
      throw new Error("existing license save failed");
    }
  };

  const existingLicenseDirty =
    existingLicenseDraft.enabled !== !!candidate?.existingLicenseType ||
    existingLicenseDraft.type !== (candidate?.existingLicenseType ?? "") ||
    existingLicenseDraft.issuedAt !== (candidate?.existingLicenseIssuedAt ?? "") ||
    existingLicenseDraft.number !== (candidate?.existingLicenseNumber ?? "") ||
    existingLicenseDraft.issuedProvince !== (candidate?.existingLicenseIssuedProvince ?? "") ||
    existingLicenseDraft.pre2016 !== (candidate?.existingLicensePre2016 ?? false);

  const saveExistingLicense = async () => {
    if (!candidate) return;

    if (existingLicenseDraft.enabled) {
      if (!existingLicenseDraft.type) {
        setExistingLicenseError("Mevcut belge seçilmeli.");
        return;
      }
      if (!existingLicenseDraft.issuedAt) {
        setExistingLicenseError("Belge tarihi zorunlu.");
        return;
      }
      if (!existingLicenseDraft.number.trim()) {
        setExistingLicenseError("Belge numarası zorunlu.");
        return;
      }
      if (!existingLicenseDraft.issuedProvince.trim()) {
        setExistingLicenseError("Belge veriliş ili zorunlu.");
        return;
      }
    }

    setExistingLicenseSaving(true);
    setExistingLicenseError(null);

    try {
      await saveField({
        existingLicenseType: existingLicenseDraft.enabled ? existingLicenseDraft.type : null,
        existingLicenseIssuedAt: existingLicenseDraft.enabled ? existingLicenseDraft.issuedAt : null,
        existingLicenseNumber: existingLicenseDraft.enabled
          ? existingLicenseDraft.number.trim()
          : null,
        existingLicenseIssuedProvince: existingLicenseDraft.enabled
          ? existingLicenseDraft.issuedProvince.trim()
          : null,
        existingLicensePre2016: existingLicenseDraft.enabled
          ? existingLicenseDraft.pre2016
          : false,
      });
      showToast("Mevcut sürücü belgesi güncellendi");
    } catch {
      setExistingLicenseError("Değişiklik kaydedilemedi.");
    } finally {
      setExistingLicenseSaving(false);
    }
  };

  const saveGroup = async (groupId: string) => {
    if (!candidateId) return;
    try {
      if (!groupId) {
        await removeActiveGroupAssignment(candidateId);
      } else {
        await assignCandidateGroup(candidateId, groupId);
      }
      const updated = await getCandidateById(candidateId);
      setCandidate(updated);
      onUpdated?.();
    } catch {
      showToast("Grup ataması kaydedilemedi", "error");
      throw new Error("save failed");
    }
  };

  const loadGroupOptions = async (): Promise<SelectOption[]> => {
    const [groupsResult, termsResult] = await Promise.all([
      getGroups({ pageSize: 100 }),
      getTerms({ pageSize: 200 }).catch(() => ({ items: [] })),
    ]);
    const sortedTerms = [...termsResult.items].sort(compareTermsDesc);
    return [
      { value: "", label: "— Atanmamış —" },
      ...groupsResult.items.map((g) => {
        const termContext = sortedTerms.length > 0 ? sortedTerms : [g.term];
        return {
          value: g.id,
          label: buildGroupHeading(g.title, g.term, termContext, lang),
        };
      }),
    ];
  };

  const handleDeleteConfirm = async () => {
    if (!candidateId) return;
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

  if (!candidateId) return null;

  const title = loading
    ? "Aday Detayı"
    : candidate
    ? `${candidate.firstName} ${candidate.lastName}`
    : "Aday Detayı";

  const actions = confirmDelete ? (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
      <span style={{ fontSize: 13, color: "var(--gray-600)", flex: 1 }}>Emin misiniz?</span>
      <button className="btn btn-secondary btn-sm" disabled={deleting} onClick={() => setConfirmDelete(false)} type="button">Vazgeç</button>
      <button className="btn btn-danger btn-sm" disabled={deleting} onClick={handleDeleteConfirm} type="button">
        {deleting ? "Siliniyor..." : "Evet, Sil"}
      </button>
    </div>
  ) : (
    <button className="btn btn-danger btn-sm" disabled={loading} onClick={() => setConfirmDelete(true)} type="button">Aday Sil</button>
  );

  const whatsappUrl = buildWhatsAppUrl(candidate?.phoneNumber);
  const profileContactText = formatPhoneNumber(candidate?.phoneNumber);

  return (
    <Drawer actions={actions} onClose={onClose} open title={title}>
      {loading ? (
        <div style={{ padding: "24px 0", textAlign: "center", color: "var(--gray-500)", fontSize: 13 }}>
          Yükleniyor...
        </div>
      ) : candidate ? (
        <>
          <div className="drawer-profile-summary">
            <button
              aria-label={candidate.photo ? "Profil resmini değiştir" : "Profil resmi yükle"}
              className="drawer-profile-avatar-button"
              onClick={() => setUploadOpen(true)}
              type="button"
            >
              <CandidateAvatar candidate={candidate} className="drawer-profile-avatar" size={64} />
            </button>
            <div className="drawer-profile-meta">
              <div className="drawer-profile-name">
                {candidate.firstName} {candidate.lastName}
              </div>
              {whatsappUrl ? (
                <a
                  className="drawer-profile-subtitle drawer-profile-link"
                  href={whatsappUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <WhatsAppIcon size={14} />
                  {profileContactText}
                </a>
              ) : (
                <div className="drawer-profile-subtitle">{profileContactText}</div>
              )}
            </div>
          </div>

          <DrawerSection title="Kişisel Bilgiler">
            <EditableRow
              displayValue={candidate.firstName}
              inputValue={candidate.firstName}
              label="Ad"
              onSave={(v) => saveField({ firstName: v })}
            />
            <EditableRow
              displayValue={candidate.lastName}
              inputValue={candidate.lastName}
              label="Soyad"
              onSave={(v) => saveField({ lastName: v })}
            />
            <EditableRow
              displayValue={candidate.nationalId}
              inputType="tel"
              inputValue={candidate.nationalId}
              label="TC Kimlik"
              onSave={(v) => saveField({ nationalId: v })}
            />
            <EditableRow
              displayValue={formatDateTR(candidate.birthDate)}
              inputLang={dateInputLang}
              inputType="date"
              inputValue={candidate.birthDate ?? ""}
              label="Doğum Tarihi"
              onSave={(v) => saveField({ birthDate: v || null })}
            />
            <EditableRow
              displayValue={candidateGenderLabel(candidate.gender)}
              inputValue={normalizeCandidateGender(candidate.gender) ?? ""}
              label="Cinsiyet"
              options={CANDIDATE_GENDER_OPTIONS}
              onSave={(v) =>
                saveField({
                  gender: normalizeCandidateGender(v),
                })
              }
            />
            <EditableRow
              displayValue={candidate.phoneNumber ?? ""}
              inputType="tel"
              inputValue={candidate.phoneNumber ?? ""}
              label="Telefon"
              onSave={(v) => saveField({ phoneNumber: v || null })}
            />
            <EditableRow
              displayValue={candidate.email ?? ""}
              inputType="email"
              inputValue={candidate.email ?? ""}
              label="E-posta"
              onSave={(v) => saveField({ email: v || null })}
            />
          </DrawerSection>

          <DrawerSection title={t("candidates.tags.label")}>
            <div className="drawer-form">
              <CandidateTagsInput
                ariaLabel={t("candidates.tags.label")}
                onChange={(names) => {
                  void saveField({ tags: names });
                }}
                value={candidate.tags?.map((tag) => tag.name) ?? []}
              />
            </div>
          </DrawerSection>

          <DrawerSection title="Kayıt Bilgileri">
            <EditableRow
              displayValue={candidate.licenseClass}
              inputValue={candidate.licenseClass}
              label="Ehliyet Tipi"
              options={LICENSE_CLASS_OPTIONS}
              onSave={(v) => saveField({ licenseClass: v as LicenseClass })}
            />
            <EditableRow
              displayValue={
                candidate.currentGroup
                  ? buildGroupHeading(
                      candidate.currentGroup.title,
                      candidate.currentGroup.term,
                      [candidate.currentGroup.term],
                      lang
                    )
                  : "Atanmamış"
              }
              inputValue={candidate.currentGroup?.groupId ?? ""}
              label="Dönem"
              loadOptions={loadGroupOptions}
              onSave={saveGroup}
            />
            <DrawerRow label="Kayıt Tarihi">{formatDateTR(candidate.createdAtUtc)}</DrawerRow>
          </DrawerSection>

          <DrawerSection title="Mevcut Sürücü Belgesi">
            {candidate.existingLicenseType ? (
              <>
                <EditableRow
                  displayValue={existingLicenseTypeLabel(candidate.existingLicenseType)}
                  inputValue={candidate.existingLicenseType}
                  label="Mevcut Belge"
                  options={EXISTING_LICENSE_EDIT_OPTIONS}
                  onSave={(value) =>
                    saveExistingLicenseField(
                      { existingLicenseType: value || null },
                      value ? "Mevcut surucu belgesi guncellendi" : "Mevcut surucu belgesi kaldirildi"
                    )
                  }
                />
                <EditableRow
                  displayValue={formatDateTR(candidate.existingLicenseIssuedAt)}
                  inputLang={dateInputLang}
                  inputType="date"
                  inputValue={candidate.existingLicenseIssuedAt ?? ""}
                  label="Belge Tarihi"
                  onSave={(value) =>
                    saveExistingLicenseField({ existingLicenseIssuedAt: value || null })
                  }
                />
                <EditableRow
                  displayValue={candidate.existingLicenseNumber ?? ""}
                  inputValue={candidate.existingLicenseNumber ?? ""}
                  label="Belge No"
                  onSave={(value) =>
                    saveExistingLicenseField({ existingLicenseNumber: value || null })
                  }
                />
                <EditableRow
                  displayValue={candidate.existingLicenseIssuedProvince ?? ""}
                  inputValue={candidate.existingLicenseIssuedProvince ?? ""}
                  label="Belge Veriliş İli"
                  options={TURKEY_PROVINCE_OPTIONS}
                  onSave={(value) =>
                    saveExistingLicenseField({
                      existingLicenseIssuedProvince: value || null,
                    })
                  }
                />
                <EditableRow
                  displayValue={candidate.existingLicensePre2016 ? "Evet" : "Hayir"}
                  inputValue={candidate.existingLicensePre2016 ? "true" : "false"}
                  label="2016 Ocak Öncesi"
                  options={BOOLEAN_OPTIONS}
                  onSave={(value) =>
                    saveExistingLicenseField({ existingLicensePre2016: value === "true" })
                  }
                />
              </>
            ) : (
              <div className="drawer-form">
                <label className="switch-toggle">
                  <input
                    aria-label="Mevcut sürücü belgesi var"
                    checked={existingLicenseDraft.enabled}
                    onChange={(event) => {
                      const enabled = event.target.checked;
                      setExistingLicenseError(null);
                      setExistingLicenseDraft((current) => ({
                        ...current,
                        enabled,
                        ...(enabled
                          ? {}
                          : {
                              type: "",
                              issuedAt: "",
                              number: "",
                              issuedProvince: "",
                              pre2016: false,
                            }),
                      }));
                    }}
                    type="checkbox"
                  />
                  <span className="switch-toggle-control" aria-hidden="true" />
                  <span>Mevcut sürücü belgesi var</span>
                </label>

                {existingLicenseDraft.enabled && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Mevcut Belge</label>
                      <CustomSelect
                        aria-label="Mevcut Belge"
                        className="form-select"
                        onChange={(event) =>
                          setExistingLicenseDraft((current) => ({
                            ...current,
                            type: event.target.value,
                          }))
                        }
                        value={existingLicenseDraft.type}
                      >
                        <option value="">Belge seçin</option>
                        {EXISTING_LICENSE_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </CustomSelect>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Belge Tarihi</label>
                      <LocalizedDateInput
                        ariaLabel="Belge Tarihi"
                        defaultOnOpen={today}
                        lang={dateInputLang}
                        onChange={(value) =>
                          setExistingLicenseDraft((current) => ({
                            ...current,
                            issuedAt: value,
                          }))
                        }
                        value={existingLicenseDraft.issuedAt}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Belge No</label>
                      <input
                        aria-label="Belge No"
                        className="form-input"
                        onChange={(event) =>
                          setExistingLicenseDraft((current) => ({
                            ...current,
                            number: event.target.value,
                          }))
                        }
                        placeholder="Örn. ABC-12345"
                        value={existingLicenseDraft.number}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Belge Veriliş İli</label>
                      <CustomSelect
                        aria-label="Belge Veriliş İli"
                        className="form-select"
                        onChange={(event) =>
                          setExistingLicenseDraft((current) => ({
                            ...current,
                            issuedProvince: event.target.value,
                          }))
                        }
                        value={existingLicenseDraft.issuedProvince}
                      >
                        <option value="">İl seçin</option>
                        {TURKEY_PROVINCE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </CustomSelect>
                    </div>

                    <div className="form-group">
                      <label className="switch-toggle">
                        <input
                          checked={existingLicenseDraft.pre2016}
                          onChange={(event) =>
                            setExistingLicenseDraft((current) => ({
                              ...current,
                              pre2016: event.target.checked,
                            }))
                          }
                          type="checkbox"
                        />
                        <span className="switch-toggle-control" aria-hidden="true" />
                        <span>2016 Ocak öncesi</span>
                      </label>
                    </div>
                  </>
                )}

                {existingLicenseError && (
                  <div className="drawer-form-error">{existingLicenseError}</div>
                )}

                {existingLicenseDirty && (
                  <div className="drawer-form-actions">
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={existingLicenseSaving}
                      onClick={saveExistingLicense}
                      type="button"
                    >
                      {existingLicenseSaving ? "Kaydediliyor..." : "Kaydet"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </DrawerSection>

          <DrawerSection title="Durum">
            <EditableRow
              displayValue={candidateStatusLabel(candidate.status)}
              inputValue={normalizeCandidateStatusValue(candidate.status)}
              label="Durum"
              options={STATUS_OPTIONS}
              onSave={(v) => saveField({ status: v })}
            />
            <EditableRow
              displayValue={candidateMebSyncStatusLabel(candidate.mebSyncStatus)}
              inputValue={normalizeCandidateMebSyncStatusValue(candidate.mebSyncStatus) ?? "not_synced"}
              label="Mebbis"
              options={MEB_SYNC_STATUS_OPTIONS}
              onSave={(value) => saveField({ mebSyncStatus: value || null })}
            />
            <EditableRow
              displayValue={formatDateTR(candidate.mebExamDate)}
              disabled={isESinavAttemptLimitReached}
              disabledTitle="4 hak doldu"
              inputLang={dateInputLang}
              inputType="date"
              inputValue={candidate.mebExamDate ?? ""}
              label="E-Sınav Tarihi"
              onSave={(value) => saveField({ mebExamDate: value || null })}
            />
            <EditableRow
              displayValue={formatDateTR(candidate.drivingExamDate)}
              inputLang={dateInputLang}
              inputType="date"
              inputValue={candidate.drivingExamDate ?? ""}
              label="Uygulama Tarihi"
              onSave={(value) => saveField({ drivingExamDate: value || null })}
            />
            <EditableRow
              displayValue={`${candidate.eSinavAttemptCount ?? 1}/4`}
              inputValue={String(candidate.eSinavAttemptCount ?? 1)}
              label="E-Sınav Hakkı"
              options={EXAM_ATTEMPT_OPTIONS}
              onSave={(value) => saveField({ eSinavAttemptCount: Number(value) })}
            />
            <EditableRow
              displayValue={`${candidate.drivingExamAttemptCount ?? 1}/4`}
              inputValue={String(candidate.drivingExamAttemptCount ?? 1)}
              label="Uygulama Hakkı"
              options={EXAM_ATTEMPT_OPTIONS}
              onSave={(value) => saveField({ drivingExamAttemptCount: Number(value) })}
            />
            <DrawerRow label="Sınav Sonucu">{candidateExamResultLabel(candidate.mebExamResult)}</DrawerRow>
          </DrawerSection>

          <DrawerSection title="Evrak Durumu">
            {candidate.documentSummary ? (
              <>
                <DrawerRow
                  label="Tamamlanan"
                  tone={
                    candidate.documentSummary.totalRequiredCount > 0 &&
                    candidate.documentSummary.completedCount ===
                      candidate.documentSummary.totalRequiredCount
                      ? "brand"
                      : "danger"
                  }
                >
                  {candidate.documentSummary.completedCount} /{" "}
                  {candidate.documentSummary.totalRequiredCount}
                </DrawerRow>
                {missingDocs && missingDocs.length > 0 && (
                  <div className="drawer-row-list">
                    <ul className="drawer-list">
                      {missingDocs.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <>
                <DrawerRow label="Tamamlanan">—</DrawerRow>
              </>
            )}
          </DrawerSection>

          {uploadedDocs && uploadedDocs.length > 0 && (
            <DrawerSection title="Yüklenen Evraklar">
              {uploadedDocs.map((doc) => {
                const docType = docTypesForMetadata.find((dt) => dt.id === doc.documentTypeId);
                const metadataEntries = Object.entries(doc.metadata ?? {}).filter(
                  ([, value]) => value !== null && value !== ""
                );

                return (
                  <div className="drawer-doc-item" key={doc.id}>
                    <DrawerRow label={doc.documentTypeName}>{doc.originalFileName}</DrawerRow>
                    {metadataEntries.length > 0 && (
                      <ul className="drawer-list drawer-doc-metadata">
                        {metadataEntries.map(([key, rawValue]) => {
                          const fieldDef = docType?.metadataFields.find((f) => f.key === key);
                          const value = rawValue ?? "";
                          const displayValue =
                            fieldDef?.inputType === "select"
                              ? fieldDef.options.find((o) => o.value === value)?.label ?? value
                              : fieldDef?.inputType === "date"
                              ? formatDateTR(value)
                              : value;
                          return (
                            <li key={key}>
                              <span className="drawer-doc-metadata-label">
                                {fieldDef?.label ?? key}:
                              </span>{" "}
                              {displayValue}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </DrawerSection>
          )}

          <DrawerSection title="Muhasebe">
            <EditableRow
              displayValue={candidate.examFeePaid ? "Ödendi" : "Ödenmedi"}
              inputValue={candidate.examFeePaid ? "true" : "false"}
              label="Sınav Ücreti"
              options={EXAM_FEE_OPTIONS}
              onSave={(value) => saveField({ examFeePaid: value === "true" })}
            />
            <DrawerRow label="Toplam Ücret">—</DrawerRow>
            <DrawerRow label="Ödenen">—</DrawerRow>
            <DrawerRow label="Kalan Bakiye">—</DrawerRow>
          </DrawerSection>
        </>
      ) : (
        <div style={{ padding: "24px 0", textAlign: "center", color: "var(--gray-500)", fontSize: 13 }}>
          Aday bilgisi yüklenemedi.
        </div>
      )}

      <UploadDocumentModal
        candidateId={candidate ? candidateId : null}
        candidateName={candidate ? `${candidate.firstName} ${candidate.lastName}` : undefined}
        lockedDocumentTypeKey="biometric_photo"
        onClose={() => setUploadOpen(false)}
        onUploaded={async () => {
          setUploadOpen(false);
          showToast(candidate?.photo ? "Profil resmi güncellendi" : "Profil resmi yüklendi");
          // Refresh the in-drawer candidate so documentSummary + missing list
          // reflect the upload immediately.
          if (candidateId) {
            try {
              const fresh = await getCandidateById(candidateId);
              setCandidate(fresh);
            } catch {
              /* swallow — parent refresh will still run */
            }
          }
          onUpdated?.();
        }}
        open={uploadOpen}
        title={candidate?.photo ? "Profil Resmini Değiştir" : "Profil Resmi Yükle"}
      />
    </Drawer>
  );
}
