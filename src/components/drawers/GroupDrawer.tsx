import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import {
  assignCandidateGroup,
  getCandidates,
  removeActiveGroupAssignment,
} from "../../lib/candidates-api";
import { getCandidateDocuments } from "../../lib/documents-api";
import { deleteGroup, getGroupById, updateGroup } from "../../lib/groups-api";
import {
  parseGroupTitle,
  GROUP_BRANCH_VALUES,
  GROUP_NUMBER_VALUES,
} from "../../lib/group-code";
import { ApiError } from "../../lib/http";
import { getGroupValidationToastMessage } from "../../lib/group-validation";
import { useLanguage, useT } from "../../lib/i18n";
import { getLicenseClassDefinitions } from "../../lib/license-class-definitions-api";
import { formatNationalId } from "../../lib/national-id";
import { candidateKeys } from "../../lib/queries/use-candidates";
import { groupKeys } from "../../lib/queries/use-groups";
import { normalizeTextQuery } from "../../lib/search";
import {
  formatDateTR,
  normalizeCandidateMebSyncStatusValue,
  normalizeGroupMebStatusValue,
} from "../../lib/status-maps";
import { buildGroupHeading, compareTermsDesc } from "../../lib/term-label";
import { getTerms } from "../../lib/terms-api";
import { getTrainingLessons } from "../../lib/training-lessons-api";
import type {
  GroupDetailResponse,
  GroupUpdateRequest,
  TermResponse,
  TrainingLessonResponse,
} from "../../lib/types";
import { CheckIcon, PencilIcon, PlusIcon, XIcon } from "../icons";
import { Drawer, DrawerRow, DrawerSection } from "../ui/Drawer";
import { PageLoadError } from "../ui/PageLoadError";
import { CustomSelect } from "../ui/CustomSelect";
import { CandidateAvatar } from "../ui/CandidateAvatar";
import { EditableRow } from "../ui/EditableRow";
import { PanelListSkeleton } from "../ui/Skeleton";
import { useToast } from "../ui/Toast";

type GroupDrawerProps = {
  groupId: string | null;
  canManageGroups?: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  onDeleted?: () => void;
};

type RemoveCandidateConfirmation = {
  candidateId: string;
  name: string;
};

type MebbisDocumentTransferSummary = {
  transferredCount: number;
  totalCount: number;
  loading: boolean;
  transferredCandidateIds: Set<string>;
};

type TheoryEducationSummary = {
  scheduledHours: number;
  requiredHours: number | null;
  loading: boolean;
};

function formatLessonHours(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function getTrainingLessonDurationHours(lesson: TrainingLessonResponse): number {
  const start = Date.parse(lesson.startAtUtc);
  const end = Date.parse(lesson.endAtUtc);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }

  return Math.round(((end - start) / 3_600_000) * 100) / 100;
}

export function GroupDrawer({ groupId, canManageGroups = true, onClose, onUpdated, onDeleted }: GroupDrawerProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const t = useT();
  const { lang } = useLanguage();
  const dateInputLang = lang === "tr" ? "tr-TR" : undefined;
  const [group, setGroup] = useState<GroupDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [terms, setTerms] = useState<TermResponse[]>([]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; firstName: string; lastName: string; nationalId: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [removeCandidateConfirm, setRemoveCandidateConfirm] = useState<RemoveCandidateConfirmation | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mebbisDocumentTransferSummary, setMebbisDocumentTransferSummary] =
    useState<MebbisDocumentTransferSummary>({
      transferredCount: 0,
      totalCount: 0,
      loading: false,
      transferredCandidateIds: new Set(),
    });
  const [theoryEducationSummary, setTheoryEducationSummary] =
    useState<TheoryEducationSummary>({
      scheduledHours: 0,
      requiredHours: null,
      loading: false,
    });
  const [mebStatusConfirm, setMebStatusConfirm] = useState<{
    resolve: (confirmed: boolean) => void;
  } | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mebStatusConfirmResolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  const invalidateGroupDrawerDependents = () => {
    void queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: groupKeys.details() });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
    void queryClient.invalidateQueries({ queryKey: ["documents", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["documents", "tabCount"] });
    void queryClient.invalidateQueries({ queryKey: ["training", "groups"] });
    void queryClient.invalidateQueries({ queryKey: ["training", "lessons"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  useEffect(() => {
    if (!groupId) {
      setGroup(null);
      setSearchOpen(false);
      setSearchQuery("");
      setSearchResults([]);
      setRemoveCandidateConfirm(null);
      setConfirmDelete(false);
      setMebStatusConfirm((current) => {
        current?.resolve(false);
        mebStatusConfirmResolveRef.current = null;
        return null;
      });
      setLoadError(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    getGroupById(groupId, controller.signal)
      .then((data) => setGroup(data))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setGroup(null);
        setLoadError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [groupId, reloadKey]);

  useEffect(() => {
    return () => {
      mebStatusConfirmResolveRef.current?.(false);
      mebStatusConfirmResolveRef.current = null;
    };
  }, []);

  useEffect(() => {
    const activeCandidates = group?.activeCandidates ?? [];
    const totalCount = activeCandidates.length;
    if (!groupId || totalCount === 0) {
      setMebbisDocumentTransferSummary({
        transferredCount: 0,
        totalCount,
        loading: false,
        transferredCandidateIds: new Set(),
      });
      return;
    }

    const controller = new AbortController();
    setMebbisDocumentTransferSummary({
      transferredCount: 0,
      totalCount,
      loading: true,
      transferredCandidateIds: new Set(),
    });

    void Promise.all(
      activeCandidates.map(async (candidate) => {
        try {
          const documents = await getCandidateDocuments(candidate.candidateId, controller.signal);
          return {
            candidateId: candidate.candidateId,
            isTransferred: documents.some((document) => document.isMebbisTransferred),
          };
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            return {
              candidateId: candidate.candidateId,
              isTransferred: false,
            };
          }
          return {
            candidateId: candidate.candidateId,
            isTransferred: false,
          };
        }
      })
    ).then((results) => {
      if (controller.signal.aborted) return;
      const transferredCandidateIds = new Set(
        results
          .filter((result) => result.isTransferred)
          .map((result) => result.candidateId)
      );
      setMebbisDocumentTransferSummary({
        transferredCount: transferredCandidateIds.size,
        totalCount,
        loading: false,
        transferredCandidateIds,
      });
    });

    return () => controller.abort();
  }, [group, groupId]);

  useEffect(() => {
    if (!groupId || !group) {
      setTheoryEducationSummary({
        scheduledHours: 0,
        requiredHours: null,
        loading: false,
      });
      return;
    }

    const controller = new AbortController();
    setTheoryEducationSummary((current) => ({
      ...current,
      loading: true,
    }));

    void Promise.all([
      getTrainingLessons({ kind: "teorik", groupId }, controller.signal),
      getLicenseClassDefinitions({ activity: "all", page: 1, pageSize: 500 }, controller.signal),
    ]).then(([lessons, definitions]) => {
      if (controller.signal.aborted) return;

      const scheduledHours = lessons.items.reduce(
        (total, lesson) => total + getTrainingLessonDurationHours(lesson),
        0
      );
      const groupLicenseClasses = group.licenseClassCounts?.map((entry) => entry.licenseClass) ?? [];
      const requiredHours = groupLicenseClasses
        .map((licenseClass) => definitions.items.find((definition) => definition.code === licenseClass)?.theoryLessonHours ?? null)
        .filter((value): value is number => typeof value === "number");

      setTheoryEducationSummary({
        scheduledHours,
        requiredHours: requiredHours.length > 0 ? Math.max(...requiredHours) : null,
        loading: false,
      });
    }).catch((error) => {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        return;
      }

      setTheoryEducationSummary({
        scheduledHours: 0,
        requiredHours: null,
        loading: false,
      });
    });

    return () => controller.abort();
  }, [group, groupId]);

  // Load term catalog lazily so the term selector can build the correct
  // "Nisan 2026 / 2" style labels and so the user can reassign the group to
  // another term.
  useEffect(() => {
    if (!groupId) return;
    const controller = new AbortController();
    getTerms({ pageSize: 200 }, controller.signal)
      .then((result) => setTerms(result.items))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setTerms([]);
      });
    return () => controller.abort();
  }, [groupId]);

  const sortedTerms = useMemo(() => [...terms].sort(compareTermsDesc), [terms]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const controller = new AbortController();
    const normalizedSearchQuery = normalizeTextQuery(searchQuery);
    if (!normalizedSearchQuery) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const result = await getCandidates(
          { search: normalizedSearchQuery, pageSize: 100 },
          controller.signal
        );
        const activeCandidateIds = new Set(group?.activeCandidates.map((c) => c.candidateId) ?? []);
        setSearchResults(
          result.items
            .filter((c) => !activeCandidateIds.has(c.id))
            .map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, nationalId: c.nationalId }))
        );
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setSearchResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      controller.abort();
    };
  }, [searchQuery, group]);

  const refreshGroup = async () => {
    if (!groupId) return;
    const updated = await getGroupById(groupId);
    setGroup(updated);
    invalidateGroupDrawerDependents();
    onUpdated?.();
  };

  const requestMebStatusSentConfirmation = () =>
    new Promise<boolean>((resolve) => {
      mebStatusConfirmResolveRef.current = resolve;
      setMebStatusConfirm({ resolve });
    });

  const closeMebStatusConfirm = (confirmed: boolean) => {
    mebStatusConfirmResolveRef.current?.(confirmed);
    mebStatusConfirmResolveRef.current = null;
    setMebStatusConfirm(null);
  };

  const saveField = async (patch: Partial<GroupUpdateRequest>) => {
    if (!canManageGroups) return;
    if (!group || !groupId || !group.startDate) return;
    const nextMebStatus = patch.mebStatus ? normalizeGroupMebStatusValue(patch.mebStatus) : undefined;
    const currentMebStatus = normalizeGroupMebStatusValue(group.mebStatus);
    if (nextMebStatus === "sent" && currentMebStatus !== "sent") {
      const confirmed = await requestMebStatusSentConfirmation();
      if (!confirmed) {
        return;
      }
    }

    try {
      const updated = await updateGroup(groupId, {
        termId: group.term.id,
        capacity: group.capacity,
        startDate: group.startDate,
        mebStatus: normalizeGroupMebStatusValue(group.mebStatus),
        rowVersion: group.rowVersion,
        ...patch,
      });
      setGroup({ ...updated, activeCandidates: group.activeCandidates });
      invalidateGroupDrawerDependents();
      onUpdated?.();
    } catch (error) {
      // 409 on RowVersion means someone else updated this group while the
      // drawer was open. Our cached `group.rowVersion` is stale — surface
      // via i18n, refresh the list, and force a reopen.
      if (error instanceof ApiError) {
        const concurrencyCode = "group.validation.concurrencyConflict";
        const hasConcurrency = error.validationErrorCodes
          ? Object.values(error.validationErrorCodes).some((codes) =>
              codes.some((entry) => entry.code === concurrencyCode)
            )
          : false;
        if (error.status === 409 && hasConcurrency) {
          showToast(t(concurrencyCode), "error");
          onUpdated?.();
          throw new Error("save failed");
        }
      }
      showToast(getGroupValidationToastMessage(error, t) ?? t("groupDrawer.toast.saveFailed"), "error");
      throw new Error("save failed");
    }
  };

  const openCandidateDetail = (candidateId: string) => {
    navigate(`/candidates/${candidateId}`);
  };

  const handleRemoveCandidate = async (candidate: { candidateId: string; firstName: string; lastName: string }) => {
    if (!canManageGroups) return;
    if (!groupId) return;
    const candidateName = `${candidate.firstName} ${candidate.lastName}`.trim();
    setRemoveCandidateConfirm({
      candidateId: candidate.candidateId,
      name: candidateName,
    });
  };

  const confirmRemoveCandidate = async () => {
    if (!canManageGroups) return;
    if (!groupId || !removeCandidateConfirm) return;
    const { candidateId } = removeCandidateConfirm;
    setRemoving(candidateId);
    try {
      await removeActiveGroupAssignment(candidateId);
      setRemoveCandidateConfirm(null);
      await refreshGroup();
    } catch {
      showToast(t("groupDrawer.toast.removeCandidateFailed"), "error");
    } finally {
      setRemoving(null);
    }
  };

  const handleAddCandidate = async (candidateId: string) => {
    if (!canManageGroups) return;
    if (!groupId) return;
    setAdding(candidateId);
    try {
      await assignCandidateGroup(candidateId, groupId);
      setSearchQuery("");
      setSearchResults([]);
      await refreshGroup();
    } catch {
      showToast(t("groupDrawer.toast.addCandidateFailed"), "error");
    } finally {
      setAdding(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!canManageGroups) return;
    if (!groupId) return;
    setDeleting(true);
    try {
      const alreadySyncedInGroup =
        group?.activeCandidates.some(
          (candidate) => normalizeCandidateMebSyncStatusValue(candidate.mebSyncStatus) === "synced"
        ) ?? false;
      if (alreadySyncedInGroup) {
        showToast(t("groupDrawer.toast.groupDeleteBlockedMebbisCandidate"), "error");
        setConfirmDelete(false);
        return;
      }

      const groupCandidates = await loadAllGroupCandidates(groupId);
      const hasMebbisSyncedCandidate = groupCandidates.items.some(
        (candidate) => normalizeCandidateMebSyncStatusValue(candidate.mebSyncStatus) === "synced"
      );

      if (hasMebbisSyncedCandidate) {
        showToast(t("groupDrawer.toast.groupDeleteBlockedMebbisCandidate"), "error");
        setConfirmDelete(false);
        return;
      }

      await deleteGroup(groupId);
      showToast(t("groupDrawer.toast.groupDeleted"));
      invalidateGroupDrawerDependents();
      onDeleted?.();
    } catch (error) {
      showToast(
        getGroupValidationToastMessage(error, t) ?? t("groupDrawer.toast.groupDeleteFailed"),
        "error"
      );
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  if (!groupId) return null;

  const canEdit = canManageGroups;
  const noPermissionTitle = t("common.noPermission");

  const title = loading
    ? t("groupDrawer.title")
    : group
    ? buildGroupHeading(group.title, group.term, sortedTerms, lang)
    : t("groupDrawer.title");
  const effectiveSearchQuery = normalizeTextQuery(searchQuery);
  const mebbisCandidateSummary = mebbisDocumentTransferSummary.loading
    ? `.../${mebbisDocumentTransferSummary.totalCount}`
    : `${mebbisDocumentTransferSummary.transferredCount}/${mebbisDocumentTransferSummary.totalCount}`;
  const theoryEducationSummaryText = theoryEducationSummary.loading
    ? `.../${theoryEducationSummary.requiredHours === null ? "-" : formatLessonHours(theoryEducationSummary.requiredHours)}`
    : `${formatLessonHours(theoryEducationSummary.scheduledHours)}/${theoryEducationSummary.requiredHours === null ? "-" : formatLessonHours(theoryEducationSummary.requiredHours)}`;

  const actions = confirmDelete ? (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
      <span style={{ fontSize: 13, color: "var(--gray-600)", flex: 1 }}>{t("groupDrawer.confirm.areYouSure")}</span>
      <button
        className="btn btn-secondary btn-sm"
        disabled={deleting}
        onClick={() => setConfirmDelete(false)}
        type="button"
      >
        {t("common.cancel")}
      </button>
      <button
        className="btn btn-danger btn-sm"
        disabled={deleting || !canManageGroups}
        onClick={handleDeleteConfirm}
        title={!canManageGroups ? noPermissionTitle : undefined}
        type="button"
      >
        {deleting ? t("groupDrawer.confirm.deleting") : t("groupDrawer.confirm.yesDelete")}
      </button>
    </div>
  ) : (
    <button
      className="btn btn-danger btn-sm"
      disabled={loading || !canManageGroups}
      onClick={() => {
        if (!canManageGroups) return;
        setConfirmDelete(true);
      }}
      title={!canManageGroups ? noPermissionTitle : undefined}
      type="button"
    >
      {t("groupDrawer.action.deleteGroup")}
    </button>
  );

  return (
    <>
    <Drawer actions={actions} onClose={onClose} open title={title}>
      {loading ? (
        <PanelListSkeleton rows={5} />
      ) : group ? (
        <>
          <DrawerSection title={t("groupDrawer.section.info")}>
            <GroupCodeEditableRow
              title={group.title}
              disabled={!canManageGroups}
              disabledTitle={noPermissionTitle}
              onSave={(groupNumber, groupBranch) =>
                saveField({
                  groupNumber: Number(groupNumber),
                  groupBranch,
                })
              }
            />
            <EditableRow
              displayValue={String(group.capacity)}
              inputType="number"
              inputValue={String(group.capacity)}
              label={t("groupDrawer.field.capacity")}
              disabled={!canManageGroups}
              disabledTitle={noPermissionTitle}
              onSave={(v) => saveField({ capacity: Number(v) })}
            />
            <EditableRow
              displayValue={formatDateTR(group.startDate)}
              inputLang={dateInputLang}
              inputType="date"
              inputValue={group.startDate ?? ""}
              label={t("groupDrawer.field.startDate")}
              disabled={!canManageGroups}
              disabledTitle={noPermissionTitle}
              onSave={(v) => saveField({ startDate: v })}
            />
            <DrawerRow label="MEB Durumu">{mebbisCandidateSummary}</DrawerRow>
            <DrawerRow label="Teorik Eğitimi">{theoryEducationSummaryText}</DrawerRow>
          </DrawerSection>

          <DrawerSection title={`Adaylar (${group.activeCandidates.length} / ${group.capacity})`}>
            {group.activeCandidates.length === 0 ? (
              <div className="drawer-empty-hint">{t("groupDrawer.empty.noCandidates")}</div>
            ) : (
              group.activeCandidates.map((c) => (
                <div
                  key={c.candidateId}
                  className={[
                    "drawer-row candidate-list-row",
                    mebbisDocumentTransferSummary.transferredCandidateIds.has(c.candidateId)
                      ? "is-mebbis-transferred"
                      : "",
                  ].filter(Boolean).join(" ")}
                >
                  <div className="candidate-list-person">
                    <CandidateAvatar
                      candidate={{
                        id: c.candidateId,
                        firstName: c.firstName,
                        lastName: c.lastName,
                        photo: c.photo ?? null,
                      }}
                      previewOnClick
                      size={32}
                    />
                    <button
                      className="candidate-list-text"
                      onClick={() => openCandidateDetail(c.candidateId)}
                      type="button"
                    >
                      <span className="candidate-name">{c.firstName} {c.lastName}</span>
                    </button>
                  </div>
                  <div className="group-candidate-remove-anchor">
                    <button
                      className="icon-btn"
                      disabled={removing === c.candidateId || !canEdit}
                      onClick={() => handleRemoveCandidate(c)}
                      title={!canEdit ? noPermissionTitle : t("groupDrawer.action.removeFromGroup")}
                      type="button"
                    >
                      <XIcon size={13} />
                    </button>
                    {removeCandidateConfirm?.candidateId === c.candidateId ? (
                      <div
                        aria-labelledby={`group-remove-candidate-confirm-title-${c.candidateId}`}
                        className="group-candidate-remove-popover"
                        role="alertdialog"
                      >
                        <div
                          className="group-candidate-remove-title"
                          id={`group-remove-candidate-confirm-title-${c.candidateId}`}
                        >
                          {t("groupDrawer.confirm.removeCandidateTitle")}
                        </div>
                        <p className="group-candidate-remove-message">
                          {t("groupDrawer.confirm.removeCandidate", { name: removeCandidateConfirm.name })}
                        </p>
                        <div className="group-candidate-remove-actions">
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={removing !== null}
                            onClick={() => setRemoveCandidateConfirm(null)}
                            type="button"
                          >
                            {t("common.cancel")}
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            disabled={removing !== null || !canManageGroups}
                            onClick={() => void confirmRemoveCandidate()}
                            type="button"
                          >
                            {removing !== null
                              ? t("groupDrawer.confirm.removingCandidate")
                              : t("groupDrawer.confirm.confirmRemoveCandidate")}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}

            <div className="candidate-search-add">
              {!searchOpen ? (
                <button
                  className="btn btn-secondary btn-sm candidate-add-btn"
                  disabled={!canEdit}
                  onClick={() => {
                    if (!canEdit) return;
                    setSearchOpen(true);
                  }}
                  title={!canEdit ? noPermissionTitle : undefined}
                  type="button"
                >
                  <PlusIcon size={12} />
                  Aday Ekle
                </button>
              ) : (
                <div className="candidate-search-panel">
                  <div className="candidate-search-row">
                    <input
                      autoFocus
                      className="form-input-sm"
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t("groupDrawer.search.placeholder")}
                      type="text"
                      value={searchQuery}
                    />
                    <button
                      className="icon-btn"
                      onClick={() => {
                        setSearchOpen(false);
                        setSearchQuery("");
                        setSearchResults([]);
                      }}
                      type="button"
                    >
                      <XIcon size={13} />
                    </button>
                  </div>
                  {searchLoading && (
                    <div className="candidate-search-hint">{t("groupDrawer.search.searching")}</div>
                  )}
                  {!searchLoading && searchResults.length > 0 && (
                    <ul className="candidate-search-results">
                      {searchResults.map((c) => (
                        <li key={c.id}>
                          <button
                            disabled={adding === c.id || !canEdit}
                            onClick={() => handleAddCandidate(c.id)}
                            title={!canEdit ? noPermissionTitle : undefined}
                            type="button"
                          >
                            <span className="candidate-name">{c.firstName} {c.lastName}</span>
                            <span className="candidate-tc">{formatNationalId(c.nationalId)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!searchLoading && effectiveSearchQuery && searchResults.length === 0 && (
                    <div className="candidate-search-hint">{t("groupDrawer.search.noResult")}</div>
                  )}
                </div>
              )}
            </div>
          </DrawerSection>
        </>
      ) : loadError ? (
        <PageLoadError
          variant="card"
          title={t("groupDrawer.error.loadTitle")}
          description={t("groupDrawer.error.loadDescription")}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : null}
    </Drawer>
    {mebStatusConfirm !== null ? (
      <div
        aria-labelledby="group-meb-confirm-title"
        className="group-meb-confirm-popover"
        role="alertdialog"
      >
        <div className="group-meb-confirm-title" id="group-meb-confirm-title">
          {t("groupDrawer.confirm.mebStatusSentTitle")}
        </div>
        <p className="group-meb-confirm-message">
          {t("groupDrawer.confirm.mebStatusSentActivatesCandidates")}
        </p>
        <div className="group-meb-confirm-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => closeMebStatusConfirm(false)}
            type="button"
          >
            {t("common.cancel")}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => closeMebStatusConfirm(true)}
            type="button"
          >
            {t("groupDrawer.confirm.activateCandidates")}
          </button>
        </div>
      </div>
    ) : null}
    </>
  );
}

async function loadAllGroupCandidates(groupId: string) {
  const pageSize = 100;
  const firstPage = await getCandidates({ groupIds: [groupId], page: 1, pageSize });
  const items = [...firstPage.items];
  const effectivePageSize = firstPage.pageSize || pageSize;
  const totalCount = firstPage.totalCount ?? items.length;
  let page = firstPage.page || 1;

  while (items.length < totalCount) {
    const nextPage = page + 1;
    const response = await getCandidates({ groupIds: [groupId], page: nextPage, pageSize });
    if (response.items.length === 0) break;
    items.push(...response.items);
    page = response.page || nextPage;

    if (response.items.length < effectivePageSize) break;
  }

  return {
    ...firstPage,
    items,
  };
}

type GroupCodeEditableRowProps = {
  title: string;
  disabled?: boolean;
  disabledTitle?: string;
  onSave: (groupNumber: string, groupBranch: string) => Promise<void>;
};

function GroupCodeEditableRow({ title, disabled = false, disabledTitle, onSave }: GroupCodeEditableRowProps) {
  const t = useT();
  const initialCode = parseGroupTitle(title);
  const [editing, setEditing] = useState(false);
  const [groupNumber, setGroupNumber] = useState(initialCode?.groupNumber ?? GROUP_NUMBER_VALUES[0]);
  const [groupBranch, setGroupBranch] = useState(initialCode?.groupBranch ?? GROUP_BRANCH_VALUES[0]);
  const [saving, setSaving] = useState(false);
  const isEditable = initialCode !== null;

  useEffect(() => {
    const next = parseGroupTitle(title);
    if (!next) {
      setEditing(false);
      return;
    }

    setGroupNumber(next.groupNumber);
    setGroupBranch(next.groupBranch);
  }, [title]);

  const startEdit = () => {
    if (disabled) return;
    const next = parseGroupTitle(title);
    if (!next) {
      return;
    }

    setGroupNumber(next.groupNumber);
    setGroupBranch(next.groupBranch);
    setEditing(true);
  };

  const cancel = () => {
    const next = parseGroupTitle(title);
    if (!next) {
      setEditing(false);
      return;
    }

    setGroupNumber(next.groupNumber);
    setGroupBranch(next.groupBranch);
    setEditing(false);
  };

  const save = async () => {
    const currentCode = parseGroupTitle(title);
    if (
      currentCode?.groupNumber === groupNumber &&
      currentCode.groupBranch === groupBranch.trim().toUpperCase()
    ) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onSave(groupNumber, groupBranch);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="drawer-row editable-row">
      {!editing && <span className="label">{t("groupDrawer.field.label")}</span>}
      {editing ? (
        <span className="editable-row-edit">
          <CustomSelect
            className="form-select-sm"
            disabled={saving}
            onChange={(event) => setGroupNumber(event.target.value)}
            value={groupNumber}
          >
            {GROUP_NUMBER_VALUES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </CustomSelect>
          <CustomSelect
            className="form-select-sm"
            disabled={saving}
            onChange={(event) => setGroupBranch(event.target.value)}
            value={groupBranch}
          >
            {GROUP_BRANCH_VALUES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </CustomSelect>
          <button
            className="icon-btn icon-btn-confirm"
            disabled={saving}
            onClick={save}
            title={t("groupDrawer.action.saveTitle")}
            type="button"
          >
            <CheckIcon size={13} />
          </button>
          <button
            className="icon-btn"
            disabled={saving}
            onClick={cancel}
            title={t("common.cancel")}
            type="button"
          >
            <XIcon size={13} />
          </button>
        </span>
      ) : (
        <span className="editable-row-view">
          <span className="value">{title || "—"}</span>
          {isEditable ? (
            <button
              className="icon-btn edit-trigger"
              disabled={disabled}
              onClick={startEdit}
              title={disabled ? disabledTitle : t("common.edit")}
              type="button"
            >
              <PencilIcon size={12} />
            </button>
          ) : null}
        </span>
      )}
    </div>
  );
}
