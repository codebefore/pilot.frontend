import { useEffect, useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

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
import { todayLocalDateOnly } from "../../lib/date-only";
import { getGroupById, getGroups } from "../../lib/groups-api";
import { useLanguage, useT, type TranslationKey } from "../../lib/i18n";
import { buildWhatsAppUrl } from "../../lib/phone";
import { candidateKeys } from "../../lib/queries/use-candidates";
import { groupKeys } from "../../lib/queries/use-groups";
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
  existingLicenseTypeLabel,
  formatDateTR,
  normalizeCandidateGender,
  normalizeCandidateExamResultValue,
  normalizeCandidateMebSyncStatusValue,
  normalizeCandidateStatusValue,
  TURKEY_PROVINCE_OPTIONS,
} from "../../lib/status-maps";
import {
  findLicenseClassDefinitionIdForSelection,
  useActiveLicenseClassDefinitions,
  useCandidateLicenseClassOptions,
  useExistingLicenseTypeOptions,
} from "../../lib/use-license-class-options";
import type {
  CandidateGroupAssignmentResponse,
  CandidateResponse,
  CandidateUpsertRequest,
  DocumentResponse,
  DocumentTypeResponse,
  LicenseClass,
} from "../../lib/types";
import { ApiError, type ApiValidationError } from "../../lib/http";
import { WhatsAppIcon } from "../icons";
import { CandidateAvatar } from "../ui/CandidateAvatar";
import { CandidateTagsInput } from "../ui/CandidateTagsInput";
import { CustomSelect } from "../ui/CustomSelect";
import { Drawer, DrawerRow, DrawerSection } from "../ui/Drawer";
import { PageLoadError } from "../ui/PageLoadError";
import { EditableRow } from "../ui/EditableRow";
import { LocalizedDateInput } from "../ui/LocalizedDateInput";
import { PanelListSkeleton } from "../ui/Skeleton";
import type { SelectOption } from "../ui/EditableRow";
import { useToast } from "../ui/Toast";

function formatOptionalText(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
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

/* ── Drawer ── */

type CandidateDrawerProps = {
  candidateId: string | null;
  canManageCandidates?: boolean;
  onClose: () => void;
  onDeleted: () => void;
  onUpdated?: () => void;
};

const STATUS_OPTIONS: SelectOption[] = CANDIDATE_STATUS_OPTIONS;
const MEB_SYNC_STATUS_OPTIONS: SelectOption[] = CANDIDATE_MEB_SYNC_STATUS_OPTIONS;
const E_SINAV_ATTEMPT_OPTIONS: SelectOption[] = [
  { value: "1", label: "1/4" },
  { value: "2", label: "2/4" },
  { value: "3", label: "3/4" },
  { value: "4", label: "4/4" },
];
const DRIVING_ATTEMPT_OPTIONS: SelectOption[] = [
  { value: "1", label: "1/5" },
  { value: "2", label: "2/5" },
  { value: "3", label: "3/5" },
  { value: "4", label: "4/5" },
  { value: "5", label: "5/5" },
];

function formatLessonHours(value: number | null | undefined): string {
  return value === null || value === undefined ? "-" : `${value} saat`;
}

function drivingAttemptDisplayLimit(candidate: CandidateResponse): number {
  return candidate.hasReportedPracticeAttempt ||
    candidate.drivingExamAttendanceStatus === "reported" ||
    (candidate.drivingExamAttemptCount ?? 0) > 4
    ? 5
    : 4;
}

type ExistingLicenseDraft = {
  enabled: boolean;
  type: string;
  issuedAt: string;
  number: string;
  issuedProvince: string;
};

/**
 * Translate the first structured validation error the server returned and
 * return the resolved message. Unknown codes fall back to the server's
 * English message; returns null when no code map was supplied.
 */
function pickFirstCodedMessage(
  codes: Record<string, ApiValidationError[]> | undefined,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): string | null {
  if (!codes) return null;
  for (const fieldErrors of Object.values(codes)) {
    const first = fieldErrors[0];
    if (!first) continue;
    return t(first.code as TranslationKey, first.params);
  }
  return null;
}

function buildExistingLicenseDraft(candidate: CandidateResponse | null): ExistingLicenseDraft {
  const enabled = candidate?.hasExistingLicense ?? !!candidate?.existingLicenseType;
  return {
    enabled,
    type: candidate?.existingLicenseType ?? "",
    issuedAt: candidate?.existingLicenseIssuedAt ?? "",
    number: candidate?.existingLicenseNumber ?? "",
    issuedProvince: candidate?.existingLicenseIssuedProvince ?? "",
  };
}

export function CandidateDrawer({
  candidateId,
  canManageCandidates = true,
  onClose,
  onDeleted,
  onUpdated,
}: CandidateDrawerProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const t = useT();
  const existingLicenseSelectId = useId();
  const licenseDateInputId = useId();
  const licenseNumberInputId = useId();
  const issuedProvinceSelectId = useId();
  const [candidate, setCandidate] = useState<CandidateResponse | null>(null);
  const { options: licenseClassOptions } = useCandidateLicenseClassOptions(
    candidate?.existingLicenseType ?? "",
    candidate?.hasExistingLicense ?? !!candidate?.existingLicenseType
  );
  const { items: activeLicenseClassDefinitions } = useActiveLicenseClassDefinitions(!!candidate);
  const { options: existingLicenseTypeOptions } = useExistingLicenseTypeOptions();
  const dateInputLang = lang === "tr" ? "tr-TR" : undefined;
  const today = todayLocalDateOnly();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [missingDocs, setMissingDocs] = useState<string[] | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<DocumentResponse[] | null>(null);
  const existingLicenseEditOptions: SelectOption[] = [
    { value: "", label: "— Belge Yok —" },
    ...existingLicenseTypeOptions,
    ...(candidate?.existingLicenseType &&
    !existingLicenseTypeOptions.some((option) => option.value === candidate.existingLicenseType)
      ? [
          {
            value: candidate.existingLicenseType,
            label: existingLicenseTypeLabel(candidate.existingLicenseType, existingLicenseTypeOptions),
          },
        ]
      : []),
  ];
  const [docTypesForMetadata, setDocTypesForMetadata] = useState<DocumentTypeResponse[]>([]);
  const [existingLicenseDraft, setExistingLicenseDraft] = useState<ExistingLicenseDraft>(
    buildExistingLicenseDraft(null)
  );
  const [existingLicenseSaving, setExistingLicenseSaving] = useState(false);
  const [existingLicenseError, setExistingLicenseError] = useState<string | null>(null);
  const educationPlan = candidate?.educationPlan ?? null;
  const candidateHasExistingLicense =
    candidate?.hasExistingLicense ?? !!candidate?.existingLicenseType;
  const noPermissionTitle = t("common.noPermission");
  const candidateEditDisabledTitle = !canManageCandidates ? noPermissionTitle : undefined;

  const invalidateCandidateDrawerDependents = () => {
    void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
    void queryClient.invalidateQueries({ queryKey: [...candidateKeys.all, "examScheduleOptions"] });
    void queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: groupKeys.details() });
    void queryClient.invalidateQueries({ queryKey: ["documents", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["documents", "tabCount"] });
    void queryClient.invalidateQueries({ queryKey: ["payments"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  useEffect(() => {
    if (!candidateId) {
      setCandidate(null);
      setConfirmDelete(false);
      setMissingDocs(null);
      setExistingLicenseDraft(buildExistingLicenseDraft(null));
      setExistingLicenseError(null);
      setLoadError(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    getCandidateById(candidateId, controller.signal)
      .then((data) => setCandidate(data))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setCandidate(null);
        setLoadError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [candidateId, reloadKey]);

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
  }, [candidateId, reloadKey]);

  const saveField = async (patch: Partial<CandidateUpsertRequest>) => {
    if (!canManageCandidates) return;
    if (!candidate || !candidateId) return;
    try {
      const updated = await updateCandidate(candidateId, {
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        nationalId: candidate.nationalId,
        referenceName: candidate.referenceName,
        phoneNumber: candidate.phoneNumber,
        birthDate: candidate.birthDate,
        birthPlace: candidate.birthPlace,
        gender: normalizeCandidateGender(candidate.gender),
        licenseClass: candidate.licenseClass,
        licenseClassDefinitionId: candidate.licenseClassDefinitionId ?? null,
        hasExistingLicense: candidate.hasExistingLicense ?? !!candidate.existingLicenseType,
        existingLicenseType: candidate.existingLicenseType,
        existingLicenseIssuedAt: candidate.existingLicenseIssuedAt,
        existingLicenseNumber: candidate.existingLicenseNumber,
        existingLicenseIssuedProvince: candidate.existingLicenseIssuedProvince,
        existingLicensePre2016: candidate.existingLicensePre2016,
        mebSyncStatus: candidate.mebSyncStatus,
        mebExamDate: candidate.mebExamDate,
        drivingExamDate: candidate.drivingExamDate,
        graduationDate: candidate.graduationDate,
        mebExamResult: candidate.mebExamResult,
        eSinavAttemptCount: candidate.eSinavAttemptCount ?? 1,
        drivingExamAttemptCount: candidate.drivingExamAttemptCount ?? 1,
        status: normalizeCandidateStatusValue(candidate.status),
        terminationReason: candidate.terminationReason,
        terminationDate: candidate.terminationDate,
        tags: candidate.tags?.map((tag) => tag.name) ?? [],
        rowVersion: candidate.rowVersion,
        ...patch,
      });
      setCandidate(updated);
      invalidateCandidateDrawerDependents();
      onUpdated?.();
    } catch (error) {
      if (error instanceof ApiError) {
        // 409 on RowVersion means someone else updated this candidate while
        // we held the drawer open. Our cached `candidate.rowVersion` is stale
        // — surface the conflict via i18n, refresh the list, and force the
        // caller to reopen.
        const concurrencyCode = "candidate.validation.concurrencyConflict";
        const hasConcurrency = error.validationErrorCodes
          ? Object.values(error.validationErrorCodes).some((codes) =>
              codes.some((entry) => entry.code === concurrencyCode)
            )
          : false;
        if (error.status === 409 && hasConcurrency) {
          showToast(t(concurrencyCode as TranslationKey), "error");
          onUpdated?.();
          throw new Error("save failed");
        }

        // Prefer structured codes when present so {values}/{min}/{max} etc.
        // interpolate cleanly; fall back to the server's English `errors`
        // message, and finally to a generic banner.
        const codedMessage = pickFirstCodedMessage(error.validationErrorCodes, t);
        const fallbackMessage = Object.values(error.validationErrors ?? {})[0]?.[0];
        showToast(
          codedMessage ?? fallbackMessage ?? t("candidate.validation.generic"),
          "error"
        );
        throw new Error("save failed");
      }
      showToast(t("candidate.validation.generic"), "error");
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
    const nextHasExistingLicense =
      patch.hasExistingLicense ?? candidate.hasExistingLicense ?? !!candidate.existingLicenseType;
    const nextLicenseClass = patch.licenseClass ?? candidate.licenseClass;
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
        nextLicenseClass,
        sourceLicenseClass,
        hasExistingLicense
      ) ?? (licenseSelectionChanged ? null : candidate.licenseClassDefinitionId ?? null);

    if (!nextHasExistingLicense) {
      return {
        hasExistingLicense: false,
        existingLicenseType: null,
        licenseClassDefinitionId: resolveDefinitionId(null, false),
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
    if (!nextType) {
      return {
        hasExistingLicense: true,
        existingLicenseType: null,
        licenseClassDefinitionId: resolveDefinitionId(null, false),
        existingLicenseIssuedAt: nextIssuedAt ?? null,
        existingLicenseNumber: nextNumber,
        existingLicenseIssuedProvince: nextProvince,
        existingLicensePre2016: false,
      };
    }

    if (!nextIssuedAt) {
      showToast(t("candidateDrawer.toast.licenseDateMissing"), "error");
      throw new Error("existing license issuedAt required");
    }

    if (!nextNumber) {
      showToast(t("candidateDrawer.toast.licenseNumberMissing"), "error");
      throw new Error("existing license number required");
    }

    if (!nextProvince) {
      showToast(t("candidateDrawer.toast.licenseProvinceMissing"), "error");
      throw new Error("existing license province required");
    }

    return {
      hasExistingLicense: true,
      existingLicenseType: nextType,
      licenseClassDefinitionId: resolveDefinitionId(nextType, true),
      existingLicenseIssuedAt: nextIssuedAt,
      existingLicenseNumber: nextNumber,
      existingLicenseIssuedProvince: nextProvince,
      existingLicensePre2016: false,
    };
  };

  const saveExistingLicenseField = async (
    patch: Partial<CandidateUpsertRequest>,
    successMessage = t("candidateDrawer.toast.existingLicenseUpdated")
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
    existingLicenseDraft.enabled !== candidateHasExistingLicense ||
    existingLicenseDraft.type !== (candidate?.existingLicenseType ?? "") ||
    existingLicenseDraft.issuedAt !== (candidate?.existingLicenseIssuedAt ?? "") ||
    existingLicenseDraft.number !== (candidate?.existingLicenseNumber ?? "") ||
    existingLicenseDraft.issuedProvince !== (candidate?.existingLicenseIssuedProvince ?? "");

  const saveExistingLicense = async () => {
    if (!canManageCandidates) return;
    if (!candidate) return;

    if (existingLicenseDraft.enabled) {
      if (!existingLicenseDraft.type) {
        setExistingLicenseError(t("candidateDrawer.error.existingLicenseRequired"));
        return;
      }
      if (!existingLicenseDraft.issuedAt) {
        setExistingLicenseError(t("candidateDrawer.error.licenseDateRequired"));
        return;
      }
      if (!existingLicenseDraft.number.trim()) {
        setExistingLicenseError(t("candidateDrawer.error.licenseNumberRequired"));
        return;
      }
      if (!existingLicenseDraft.issuedProvince.trim()) {
        setExistingLicenseError(t("candidateDrawer.error.licenseProvinceRequired"));
        return;
      }
    }

    setExistingLicenseSaving(true);
    setExistingLicenseError(null);

    try {
      await saveField({
        hasExistingLicense: existingLicenseDraft.enabled,
        existingLicenseType: existingLicenseDraft.enabled ? existingLicenseDraft.type : null,
        licenseClassDefinitionId: findLicenseClassDefinitionIdForSelection(
          activeLicenseClassDefinitions,
          candidate.licenseClass,
          existingLicenseDraft.enabled ? existingLicenseDraft.type : null,
          existingLicenseDraft.enabled
        ),
        existingLicenseIssuedAt: existingLicenseDraft.enabled ? existingLicenseDraft.issuedAt : null,
        existingLicenseNumber: existingLicenseDraft.enabled
          ? existingLicenseDraft.number.trim()
          : null,
        existingLicenseIssuedProvince: existingLicenseDraft.enabled
          ? existingLicenseDraft.issuedProvince.trim()
          : null,
        existingLicensePre2016: false,
      });
      showToast(t("candidateDrawer.toast.existingLicenseUpdated"));
    } catch {
      setExistingLicenseError(t("candidateDrawer.error.saveFailed"));
    } finally {
      setExistingLicenseSaving(false);
    }
  };

  const saveGroup = async (groupId: string) => {
    if (!canManageCandidates) return;
    if (!candidateId) return;
    try {
      if (!groupId) {
        await removeActiveGroupAssignment(candidateId);
        setCandidate((current) => current ? { ...current, currentGroup: null } : current);
      } else {
        const [assignment, group] = await Promise.all([
          assignCandidateGroup(candidateId, groupId),
          getGroupById(groupId),
        ]);
        setCandidate((current) =>
          current ? applyGroupAssignmentToCandidate(current, assignment, group) : current
        );
      }
      invalidateCandidateDrawerDependents();
      onUpdated?.();
    } catch {
      showToast(t("candidateDrawer.toast.groupAssignFailed"), "error");
      throw new Error("save failed");
    }
  };

  const loadGroupOptions = async (signal?: AbortSignal): Promise<SelectOption[]> => {
    const [groupsResult, termsResult] = await Promise.all([
      getGroups({ pageSize: 100 }, signal),
      getTerms({ pageSize: 200 }, signal).catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw error;
        }
        return { items: [] };
      }),
    ]);
    const sortedTerms = [...termsResult.items].sort(compareTermsDesc);
    return [
      { value: "", label: t("candidateDrawer.boolean.unassigned") },
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
    if (!canManageCandidates) return;
    if (!candidateId) return;
    setDeleting(true);
    try {
      await deleteCandidate(candidateId);
      showToast(t("candidateDrawer.toast.candidateDeleted"));
      invalidateCandidateDrawerDependents();
      onDeleted();
    } catch {
      showToast(t("candidateDrawer.toast.candidateDeleteFailed"), "error");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  if (!candidateId) return null;

  const title = loading
    ? t("candidateDrawer.title")
    : candidate
    ? `${candidate.firstName} ${candidate.lastName}`
    : t("candidateDrawer.title");

  const actions = confirmDelete ? (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
      <span style={{ fontSize: 13, color: "var(--gray-600)", flex: 1 }}>{t("groupDrawer.confirm.areYouSure")}</span>
      <button className="btn btn-secondary btn-sm" disabled={deleting} onClick={() => setConfirmDelete(false)} type="button">{t("common.cancel")}</button>
      <button
        className="btn btn-danger btn-sm"
        disabled={deleting || !canManageCandidates}
        onClick={handleDeleteConfirm}
        title={candidateEditDisabledTitle}
        type="button"
      >
        {deleting ? t("candidateDrawer.confirm.deleting") : t("candidateDrawer.confirm.yesDelete")}
      </button>
    </div>
  ) : (
    <button
      className="btn btn-danger btn-sm"
      disabled={loading || !canManageCandidates}
      onClick={() => {
        if (!canManageCandidates) return;
        setConfirmDelete(true);
      }}
      title={candidateEditDisabledTitle}
      type="button"
    >
      {t("candidateDrawer.action.deleteCandidate")}
    </button>
  );

  const whatsappUrl = buildWhatsAppUrl(candidate?.phoneNumber);
  const profileContactText = candidate?.phoneNumber?.trim() || "—";

  return (
    <Drawer actions={actions} onClose={onClose} open title={title}>
      {loading ? (
        <PanelListSkeleton rows={6} />
      ) : candidate ? (
        <>
          <div className="drawer-profile-summary">
            <span className="drawer-profile-avatar-shell">
              <CandidateAvatar candidate={candidate} className="drawer-profile-avatar" size={64} />
            </span>
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

          <DrawerSection title={t("candidateDrawer.section.personal")}>
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={candidateEditDisabledTitle}
              displayValue={candidate.firstName}
              inputValue={candidate.firstName}
              label={t("common.field.firstName")}
              onSave={(v) => saveField({ firstName: v })}
            />
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={candidateEditDisabledTitle}
              displayValue={candidate.lastName}
              inputValue={candidate.lastName}
              label={t("common.field.lastName")}
              onSave={(v) => saveField({ lastName: v })}
            />
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={candidateEditDisabledTitle}
              displayValue={candidate.nationalId}
              inputType="tel"
              inputValue={candidate.nationalId}
              label={t("common.field.nationalId")}
              onSave={(v) => saveField({ nationalId: v })}
            />
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={candidateEditDisabledTitle}
              displayValue={formatDateTR(candidate.birthDate)}
              inputLang={dateInputLang}
              inputType="date"
              inputValue={candidate.birthDate ?? ""}
              label={t("candidateDrawer.field.birthDate")}
              onSave={(v) => saveField({ birthDate: v || null })}
            />
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={candidateEditDisabledTitle}
              displayValue={candidateGenderLabel(candidate.gender)}
              inputValue={normalizeCandidateGender(candidate.gender) ?? ""}
              label={t("common.field.gender")}
              options={CANDIDATE_GENDER_OPTIONS}
              onSave={(v) =>
                saveField({
                  gender: normalizeCandidateGender(v),
                })
              }
            />
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={candidateEditDisabledTitle}
              displayValue={candidate.phoneNumber ?? ""}
              inputType="tel"
              inputValue={candidate.phoneNumber ?? ""}
              label={t("common.field.phone")}
              onSave={(v) => saveField({ phoneNumber: v || null })}
            />
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={candidateEditDisabledTitle}
              displayValue={formatOptionalText(candidate.referenceName)}
              inputValue={candidate.referenceName ?? ""}
              label={t("newCandidate.field.reference")}
              onSave={(v) => saveField({ referenceName: v || null })}
            />
          </DrawerSection>

          <DrawerSection title={t("candidates.tags.label")}>
            <div className="drawer-form">
              <CandidateTagsInput
                ariaLabel={t("candidates.tags.label")}
                disabled={!canManageCandidates}
                disabledTitle={candidateEditDisabledTitle}
                onChange={(names) => {
                  void saveField({ tags: names });
                }}
                value={candidate.tags?.map((tag) => tag.name) ?? []}
              />
            </div>
          </DrawerSection>

          <DrawerSection title={t("candidateDrawer.section.registration")}>
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={candidateEditDisabledTitle}
              displayValue={candidate.licenseClass}
              inputValue={candidate.licenseClass}
              label={t("common.field.licenseClass")}
              options={licenseClassOptions}
              onSave={(v) =>
                saveField({
                  licenseClass: v as LicenseClass,
                  licenseClassDefinitionId:
                    licenseClassOptions.find((option) => option.value === v)?.licenseClassDefinitionId ?? null,
                })
              }
            />
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={candidateEditDisabledTitle}
              displayValue={
                candidate.currentGroup
                  ? buildGroupHeading(
                      candidate.currentGroup.title,
                      candidate.currentGroup.term,
                      [candidate.currentGroup.term],
                      lang
                    )
                  : t("candidateDrawer.assignment.unassigned")
              }
              inputValue={candidate.currentGroup?.groupId ?? ""}
              label={t("candidateDrawer.field.term")}
              loadOptions={loadGroupOptions}
              onSave={saveGroup}
            />
            <DrawerRow label={t("candidateDrawer.field.registrationDate")}>{formatDateTR(candidate.createdAtUtc)}</DrawerRow>
          </DrawerSection>

          <DrawerSection title={t("candidateDrawer.section.existingLicense")}>
            {candidateHasExistingLicense ? (
              <>
                <EditableRow
                  disabled={!canManageCandidates}
                  disabledTitle={candidateEditDisabledTitle}
                  displayValue={
                    candidate.existingLicenseType
                      ? existingLicenseTypeLabel(
                          candidate.existingLicenseType,
                          existingLicenseTypeOptions
                        )
                      : t("candidateDrawer.empty.noLicenseSelected")
                  }
                  inputValue={candidate.existingLicenseType ?? ""}
                  label={t("candidateDrawer.field.existingLicense")}
                  options={existingLicenseEditOptions}
                  onSave={(value) =>
                    saveExistingLicenseField(
                      { hasExistingLicense: !!value, existingLicenseType: value || null },
                      value ? t("candidateDrawer.toast.existingLicenseUpdated") : t("candidateDrawer.toast.existingLicenseRemoved")
                    )
                  }
                />
                <EditableRow
                  disabled={!canManageCandidates}
                  disabledTitle={candidateEditDisabledTitle}
                  displayValue={formatDateTR(candidate.existingLicenseIssuedAt)}
                  inputLang={dateInputLang}
                  inputType="date"
                  inputValue={candidate.existingLicenseIssuedAt ?? ""}
                  label={t("candidateDrawer.field.licenseDate")}
                  onSave={(value) =>
                    saveExistingLicenseField({ existingLicenseIssuedAt: value || null })
                  }
                />
                <EditableRow
                  disabled={!canManageCandidates}
                  disabledTitle={candidateEditDisabledTitle}
                  displayValue={candidate.existingLicenseNumber ?? ""}
                  inputValue={candidate.existingLicenseNumber ?? ""}
                  label={t("candidateDrawer.field.licenseNumber")}
                  onSave={(value) =>
                    saveExistingLicenseField({ existingLicenseNumber: value || null })
                  }
                />
                <EditableRow
                  disabled={!canManageCandidates}
                  disabledTitle={candidateEditDisabledTitle}
                  displayValue={candidate.existingLicenseIssuedProvince ?? ""}
                  inputValue={candidate.existingLicenseIssuedProvince ?? ""}
                  label={t("candidateDrawer.field.issuedProvince")}
                  options={TURKEY_PROVINCE_OPTIONS}
                  onSave={(value) =>
                    saveExistingLicenseField({
                      existingLicenseIssuedProvince: value || null,
                    })
                  }
                />
              </>
            ) : (
              <div className="drawer-form">
                <label className="switch-toggle">
                  <input
                    aria-label={t("candidateDrawer.aria.hasExistingLicense")}
                    checked={existingLicenseDraft.enabled}
                    disabled={!canManageCandidates}
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
                            }),
                      }));
                    }}
                    type="checkbox"
                  />
                  <span className="switch-toggle-control" aria-hidden="true" />
                  <span>{t("candidateDrawer.label.hasExistingLicense")}</span>
                </label>

                {existingLicenseDraft.enabled && (
                  <>
                    <div className="form-group">
                      <label className="form-label" htmlFor={existingLicenseSelectId}>{t("candidateDrawer.field.existingLicense")}</label>
                      <CustomSelect
                        id={existingLicenseSelectId}
                        aria-label={t("candidateDrawer.field.existingLicense")}
                        className="form-select"
                        disabled={!canManageCandidates}
                        onChange={(event) =>
                          setExistingLicenseDraft((current) => ({
                            ...current,
                            type: event.target.value,
                          }))
                        }
                        value={existingLicenseDraft.type}
                      >
                        <option value="">{t("candidateDrawer.placeholder.selectLicense")}</option>
                        {existingLicenseTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </CustomSelect>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor={licenseDateInputId}>{t("candidateDrawer.field.licenseDate")}</label>
                      <LocalizedDateInput
                        ariaLabel={t("candidateDrawer.field.licenseDate")}
                        defaultOnOpen={today}
                        id={licenseDateInputId}
                        disabled={!canManageCandidates}
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
                      <label className="form-label" htmlFor={licenseNumberInputId}>{t("candidateDrawer.field.licenseNumber")}</label>
                      <input
                        id={licenseNumberInputId}
                        aria-label={t("candidateDrawer.field.licenseNumber")}
                        className="form-input"
                        disabled={!canManageCandidates}
                        onChange={(event) =>
                          setExistingLicenseDraft((current) => ({
                            ...current,
                            number: event.target.value,
                          }))
                        }
                        placeholder={t("candidateDrawer.placeholder.licenseNumber")}
                        value={existingLicenseDraft.number}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor={issuedProvinceSelectId}>{t("candidateDrawer.field.issuedProvince")}</label>
                      <CustomSelect
                        id={issuedProvinceSelectId}
                        aria-label={t("candidateDrawer.field.issuedProvince")}
                        className="form-select"
                        disabled={!canManageCandidates}
                        onChange={(event) =>
                          setExistingLicenseDraft((current) => ({
                            ...current,
                            issuedProvince: event.target.value,
                          }))
                        }
                        value={existingLicenseDraft.issuedProvince}
                      >
                        <option value="">{t("candidateDrawer.placeholder.selectProvince")}</option>
                        {TURKEY_PROVINCE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </CustomSelect>
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
                      disabled={existingLicenseSaving || !canManageCandidates}
                      onClick={saveExistingLicense}
                      title={candidateEditDisabledTitle}
                      type="button"
                    >
                      {existingLicenseSaving ? t("common.saving") : t("common.save")}
                    </button>
                  </div>
                )}
              </div>
            )}
          </DrawerSection>

          {educationPlan && (
            <DrawerSection title={t("candidateDrawer.section.educationPlan")}>
              <DrawerRow label={t("candidateDrawer.field.theoryLesson")}>
                {educationPlan.requiresTheoryExam ? formatLessonHours(educationPlan.theoryLessonHours) : t("candidateDrawer.exam.exempt")}
              </DrawerRow>
              <DrawerRow label={t("candidateDrawer.field.simulator")}>{formatLessonHours(educationPlan.simulatorLessonHours)}</DrawerRow>
              <DrawerRow label={t("candidateDrawer.field.driving")}>{formatLessonHours(educationPlan.practiceLessonHours)}</DrawerRow>
              <DrawerRow label={t("candidateDrawer.field.drivingExam")}>
                {educationPlan.requiresPracticeExam ? t("candidateDrawer.exam.required") : t("candidateDrawer.exam.exempt")}
              </DrawerRow>
            </DrawerSection>
          )}

          <DrawerSection title={t("candidateDrawer.section.status")}>
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={candidateEditDisabledTitle}
              displayValue={candidateStatusLabel(candidate.status)}
              inputValue={normalizeCandidateStatusValue(candidate.status)}
              label={t("candidateDrawer.field.status")}
              options={STATUS_OPTIONS}
              onSave={(v) => saveField({ status: v })}
            />
            {normalizeCandidateStatusValue(candidate.status) === "dropped" ? (
              <>
                <EditableRow
                  disabled={!canManageCandidates}
                  disabledTitle={candidateEditDisabledTitle}
                  displayValue={formatOptionalText(candidate.terminationReason)}
                  inputValue={candidate.terminationReason ?? ""}
                  label={t("candidateDrawer.field.terminationReason")}
                  onSave={(value) => saveField({ terminationReason: value || null })}
                />
                <EditableRow
                  disabled={!canManageCandidates}
                  disabledTitle={candidateEditDisabledTitle}
                  displayValue={formatDateTR(candidate.terminationDate)}
                  inputLang={dateInputLang}
                  inputType="date"
                  inputValue={candidate.terminationDate ?? ""}
                  label={t("candidateDrawer.field.terminationDate")}
                  onSave={(value) => saveField({ terminationDate: value || null })}
                />
              </>
            ) : null}
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={candidateEditDisabledTitle}
              displayValue={candidateMebSyncStatusLabel(candidate.mebSyncStatus)}
              inputValue={normalizeCandidateMebSyncStatusValue(candidate.mebSyncStatus) ?? "not_synced"}
              label={t("candidateDrawer.field.mebbis")}
              options={MEB_SYNC_STATUS_OPTIONS}
              onSave={(value) => saveField({ mebSyncStatus: value || null })}
            />
            <EditableRow
              displayValue={formatDateTR(candidate.mebExamDate)}
              disabled={isESinavAttemptLimitReached || !canManageCandidates}
              disabledTitle={!canManageCandidates ? noPermissionTitle : t("candidateDrawer.disabled.attemptsExhausted")}
              inputLang={dateInputLang}
              inputType="date"
              inputValue={candidate.mebExamDate ?? ""}
              label={t("candidateDrawer.field.eExamDate")}
              onSave={(value) => saveField({ mebExamDate: value || null })}
            />
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={candidateEditDisabledTitle}
              displayValue={formatDateTR(candidate.drivingExamDate)}
              inputLang={dateInputLang}
              inputType="date"
              inputValue={candidate.drivingExamDate ?? ""}
              label={t("candidateDrawer.field.drivingDate")}
              onSave={(value) => saveField({ drivingExamDate: value || null })}
            />
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={candidateEditDisabledTitle}
              displayValue={formatDateTR(candidate.graduationDate)}
              inputLang={dateInputLang}
              inputType="date"
              inputValue={candidate.graduationDate ?? ""}
              label={t("candidateDrawer.field.graduationDate")}
              onSave={(value) => saveField({ graduationDate: value || null })}
            />
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={candidateEditDisabledTitle}
              displayValue={`${candidate.eSinavAttemptCount ?? 1}/4`}
              inputValue={String(candidate.eSinavAttemptCount ?? 1)}
              label={t("candidateDrawer.field.eExamAttempts")}
              options={E_SINAV_ATTEMPT_OPTIONS}
              onSave={(value) => saveField({ eSinavAttemptCount: Number(value) })}
            />
            <EditableRow
              disabled={!canManageCandidates}
              disabledTitle={candidateEditDisabledTitle}
              displayValue={`${candidate.drivingExamAttemptCount ?? 1}/${drivingAttemptDisplayLimit(candidate)}`}
              inputValue={String(candidate.drivingExamAttemptCount ?? 1)}
              label={t("candidateDrawer.field.drivingAttempts")}
              options={drivingAttemptDisplayLimit(candidate) === 5 ? DRIVING_ATTEMPT_OPTIONS : E_SINAV_ATTEMPT_OPTIONS}
              onSave={(value) => saveField({ drivingExamAttemptCount: Number(value) })}
            />
            <DrawerRow label={t("candidateDrawer.field.examResult")}>{candidateExamResultLabel(candidate.mebExamResult)}</DrawerRow>
          </DrawerSection>

          <DrawerSection title={t("candidateDrawer.section.documents")}>
            {candidate.documentSummary ? (
              <>
                <DrawerRow
                  label={t("candidateDrawer.field.completed")}
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
                <DrawerRow label={t("candidateDrawer.field.completed")}>—</DrawerRow>
              </>
            )}
          </DrawerSection>

          {uploadedDocs && uploadedDocs.length > 0 && (
            <DrawerSection title={t("candidateDrawer.section.uploadedDocs")}>
              {uploadedDocs.map((doc) => {
                const docType = docTypesForMetadata.find((dt) => dt.id === doc.documentTypeId);
                const metadataEntries = Object.entries(doc.metadata ?? {}).filter(
                  ([, value]) => value !== null && value !== ""
                );

                return (
                  <div className="drawer-doc-item" key={doc.id}>
                    <DrawerRow label={doc.documentTypeName}>
                      {doc.hasFile ? (
                        doc.originalFileName
                      ) : (
                        <span className="document-physical-badge">
                          {t("documents.physicallyAvailable")}
                        </span>
                      )}
                    </DrawerRow>
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

        </>
      ) : loadError ? (
        <PageLoadError
          variant="card"
          title={t("candidateDrawer.error.loadTitle")}
          description={t("candidateDrawer.error.loadDescription")}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : null}

    </Drawer>
  );
}
