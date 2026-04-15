import { useEffect, useMemo, useState, type ReactNode } from "react";

import { GroupDrawer } from "../components/drawers/GroupDrawer";
import { GridIcon, ListIcon, PlusIcon } from "../components/icons";
import { PageToolbar } from "../components/layout/PageToolbar";
import { NewGroupModal } from "../components/modals/NewGroupModal";
import { NewTermModal } from "../components/modals/NewTermModal";
import { CandidateAvatar } from "../components/ui/CandidateAvatar";
import { ColumnPicker, type ColumnOption } from "../components/ui/ColumnPicker";
import { CustomSelect } from "../components/ui/CustomSelect";
import { Pagination } from "../components/ui/Pagination";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";
import { getGroups } from "../lib/groups-api";
import { ApiError } from "../lib/http";
import { useLanguage, useT } from "../lib/i18n";
import {
  formatDateTR,
  groupMebStatusLabel,
  groupMebStatusToPill,
} from "../lib/status-maps";
import {
  buildGroupHeading,
  buildTermLabel,
  compareTermsDesc,
  pickDefaultTermId,
} from "../lib/term-label";
import { deleteTerm, getTerms } from "../lib/terms-api";
import type { GroupResponse, TermResponse } from "../lib/types";
import { useColumnVisibility } from "../lib/use-column-visibility";

type GroupViewMode = "cards" | "list";
type GroupColumnId =
  | "name"
  | "licenseClass"
  | "capacity"
  | "activeCandidates"
  | "startDate"
  | "mebStatus"
  | "createdAtUtc"
  | "updatedAtUtc";

type GroupColumnDef = {
  id: GroupColumnId;
  labelKey:
    | "groups.table.name"
    | "groups.table.licenseClass"
    | "groups.table.capacity"
    | "groups.table.activeCandidates"
    | "groups.table.startDate"
    | "groups.table.mebStatus"
    | "groups.table.createdAtUtc"
    | "groups.table.updatedAtUtc";
  headerClassName?: string;
  cellClassName?: string;
  skeletonWidth: number;
  renderCell: (group: GroupResponse, sortedTerms: TermResponse[], lang: "tr" | "en") => ReactNode;
};

const PAGE_SIZE = 12;
const GROUP_COLUMNS: GroupColumnDef[] = [
  {
    id: "name",
    labelKey: "groups.table.name",
    cellClassName: "group-table-name",
    skeletonWidth: 190,
    renderCell: (group, sortedTerms, lang) =>
      buildGroupHeading(group.title, group.term, sortedTerms, lang, group.licenseClass),
  },
  {
    id: "licenseClass",
    labelKey: "groups.table.licenseClass",
    skeletonWidth: 54,
    renderCell: (group) => group.licenseClass,
  },
  {
    id: "capacity",
    labelKey: "groups.table.capacity",
    skeletonWidth: 64,
    renderCell: (group) => `${group.assignedCandidateCount} / ${group.capacity}`,
  },
  {
    id: "activeCandidates",
    labelKey: "groups.table.activeCandidates",
    skeletonWidth: 44,
    renderCell: (group) => group.activeCandidateCount,
  },
  {
    id: "startDate",
    labelKey: "groups.table.startDate",
    skeletonWidth: 84,
    renderCell: (group) => formatDateTR(group.startDate),
  },
  {
    id: "mebStatus",
    labelKey: "groups.table.mebStatus",
    skeletonWidth: 76,
    renderCell: (group) => (
      <StatusPill
        label={groupMebStatusLabel(group.mebStatus)}
        status={groupMebStatusToPill(group.mebStatus)}
      />
    ),
  },
  {
    id: "createdAtUtc",
    labelKey: "groups.table.createdAtUtc",
    skeletonWidth: 88,
    renderCell: (group) => formatDateTR(group.createdAtUtc),
  },
  {
    id: "updatedAtUtc",
    labelKey: "groups.table.updatedAtUtc",
    skeletonWidth: 88,
    renderCell: (group) => formatDateTR(group.updatedAtUtc),
  },
];
const GROUP_COLUMN_IDS: GroupColumnId[] = GROUP_COLUMNS.map((column) => column.id);
const DEFAULT_VISIBLE_GROUP_COLUMN_IDS: GroupColumnId[] = [
  "name",
  "capacity",
  "startDate",
  "mebStatus",
];

export function GroupsPage() {
  const { showToast } = useToast();
  const t = useT();
  const { lang } = useLanguage();
  const { isVisible, toggle: toggleColumn } = useColumnVisibility(
    "groups.columns.v1",
    GROUP_COLUMN_IDS,
    DEFAULT_VISIBLE_GROUP_COLUMN_IDS
  );

  const [terms, setTerms] = useState<TermResponse[]>([]);
  const [termsLoading, setTermsLoading] = useState(true);
  const [termRefreshKey, setTermRefreshKey] = useState(0);
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [termModalState, setTermModalState] = useState<{ mode: "create" | "edit"; term: TermResponse | null } | null>(null);
  const [confirmDeleteTermId, setConfirmDeleteTermId] = useState<string | null>(null);
  const [deletingTerm, setDeletingTerm] = useState(false);

  const [viewMode, setViewMode] = useState<GroupViewMode>("cards");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const visibleColumns = GROUP_COLUMNS.filter((column) => isVisible(column.id));
  const pickerOptions: ColumnOption[] = GROUP_COLUMNS.map((column) => ({
    id: column.id,
    label: t(column.labelKey),
  }));

  /* ── Terms ───────────────────────────────────────────── */

  useEffect(() => {
    const controller = new AbortController();
    setTermsLoading(true);
    getTerms({ pageSize: 200 }, controller.signal)
      .then((result) => {
        const sorted = [...result.items].sort(compareTermsDesc);
        setTerms(sorted);
        setSelectedTermId((prev) => (prev ? prev : pickDefaultTermId(sorted) ?? ""));
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        showToast(t("terms.loadFailed"), "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setTermsLoading(false);
      });
    return () => controller.abort();
  }, [termRefreshKey, showToast, t]);

  const sortedTerms = useMemo(() => [...terms].sort(compareTermsDesc), [terms]);
  const selectedTerm = useMemo(
    () => sortedTerms.find((t) => t.id === selectedTermId) ?? null,
    [sortedTerms, selectedTermId]
  );

  const handleTermCreated = (term: TermResponse) => {
    setTermModalState(null);
    setSelectedTermId(term.id);
    setPage(1);
    setTermRefreshKey((k) => k + 1);
  };

  const handleTermSaved = (term: TermResponse) => {
    setTermModalState(null);
    setSelectedTermId(term.id);
    setPage(1);
    setTermRefreshKey((k) => k + 1);
  };

  const handleTermRename = (term: TermResponse) => {
    setTermModalState({ mode: "edit", term });
  };

  const handleTermDeleteConfirm = async (term: TermResponse) => {
    setDeletingTerm(true);
    try {
      await deleteTerm(term.id);
      showToast(t("terms.deleted"));
      if (selectedTermId === term.id) setSelectedTermId("");
      setTermRefreshKey((k) => k + 1);
      setConfirmDeleteTermId(null);
    } catch (error) {
      if (error instanceof ApiError && error.validationErrors?.term?.length) {
        showToast(t("terms.deleteBlockedActiveGroups"), "error");
        return;
      }
      showToast(t("terms.deleteFailed"), "error");
    } finally {
      setDeletingTerm(false);
    }
  };

  /* ── Groups (scoped to the selected term) ────────────── */

  useEffect(() => {
    if (!selectedTermId) {
      setGroups([]);
      setTotalPages(1);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);

    getGroups(
      {
        termId: selectedTermId,
        page,
        pageSize: PAGE_SIZE,
      },
      controller.signal
    )
      .then((result) => {
        setGroups(result.items);
        setTotalPages(result.totalPages);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        showToast(t("groups.loadFailed"), "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [
    selectedTermId,
    page,
    refreshKey,
    showToast,
    t,
  ]);

  const handleGroupCreated = () => {
    setModalOpen(false);
    showToast(t("groups.created"));
    setRefreshKey((k) => k + 1);
    setTermRefreshKey((k) => k + 1);
  };

  const handleGroupUpdated = () => {
    setRefreshKey((k) => k + 1);
    setTermRefreshKey((k) => k + 1);
  };

  const handleGroupDeleted = () => {
    setSelectedGroupId(null);
    setRefreshKey((k) => k + 1);
    setTermRefreshKey((k) => k + 1);
  };

  const emptyMessage = !selectedTermId
    ? t("groups.empty.noTermSelected")
    : t("groups.empty.noGroupsForTab");

  return (
    <>
      <PageToolbar
        actions={
          <>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setTermModalState({ mode: "create", term: null })}
              type="button"
            >
              <PlusIcon size={14} />
              {t("terms.newTerm")}
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={!selectedTermId}
              onClick={() => setModalOpen(true)}
              type="button"
            >
              <PlusIcon size={14} />
              {t("groups.newGroup")}
            </button>
            {selectedTerm && (
              confirmDeleteTermId === selectedTerm.id ? (
                <>
                  <span style={{ fontSize: 13, color: "var(--gray-600)" }}>
                    {t("terms.confirmDelete")}
                  </span>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={deletingTerm}
                    onClick={() => setConfirmDeleteTermId(null)}
                    type="button"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={deletingTerm}
                    onClick={() => handleTermDeleteConfirm(selectedTerm)}
                    type="button"
                  >
                    {t("terms.delete")}
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleTermRename(selectedTerm)}
                    type="button"
                  >
                    {t("terms.edit")}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setConfirmDeleteTermId(selectedTerm.id)}
                    type="button"
                  >
                    {t("terms.delete")}
                  </button>
                </>
              )
            )}
          </>
        }
        title={t("groups.title")}
      />

      <div className="term-bar">
        <CustomSelect
          aria-label={t("terms.selector.label")}
          className="form-select term-bar-select"
          disabled={termsLoading}
          onChange={(e) => {
            setSelectedTermId(e.target.value);
            setPage(1);
          }}
          value={selectedTermId}
        >
          <option value="">{t("terms.selector.none")}</option>
          {sortedTerms.map((term) => (
            <option key={term.id} value={term.id}>
              {buildTermLabel(term, sortedTerms, lang)}
              {" · "}
              {t("terms.groupCount", { count: term.groupCount })}
            </option>
          ))}
        </CustomSelect>

        <div className="view-toggle" role="group" aria-label={t("groups.view.label")}>
          <button
            aria-pressed={viewMode === "cards"}
            aria-label={t("groups.view.cards")}
            className={viewMode === "cards" ? "view-toggle-btn active" : "view-toggle-btn"}
            onClick={() => setViewMode("cards")}
            title={t("groups.view.cards")}
            type="button"
          >
            <GridIcon size={14} />
          </button>
          <button
            aria-pressed={viewMode === "list"}
            aria-label={t("groups.view.list")}
            className={viewMode === "list" ? "view-toggle-btn active" : "view-toggle-btn"}
            onClick={() => setViewMode("list")}
            title={t("groups.view.list")}
            type="button"
          >
            <ListIcon size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        viewMode === "cards" ? (
          <div className="groups-grid">
            {Array.from({ length: 6 }, (_, i) => (
              <div className="panel" key={i}>
                <div className="panel-header">
                  <span className="skeleton" style={{ width: `${130 + (i * 41) % 80}px`, height: 14 }} />
                  <span className="skeleton skeleton-pill" style={{ width: 56 }} />
                </div>
                <div className="group-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[70, 88, 88, 64].map((w, j) => (
                    <div className="drawer-row" key={j}>
                      <span className="skeleton" style={{ width: w }} />
                      <span className="skeleton" style={{ width: `${60 + (i + j) * 13 % 40}px` }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="table-wrap spaced">
            <table className="data-table group-table">
              <thead>
                <tr>
                  {visibleColumns.map((column) => (
                    <th className={column.headerClassName} key={column.id}>
                      {t(column.labelKey)}
                    </th>
                  ))}
                  <th className="col-picker-th">
                    <ColumnPicker
                      columns={pickerOptions}
                      isVisible={isVisible}
                      onToggle={toggleColumn}
                      triggerTitle={t("groups.columns.button")}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: PAGE_SIZE }, (_, i) => (
                  <tr key={i} style={{ pointerEvents: "none" }}>
                    {visibleColumns.map((column) => (
                      <td className={column.cellClassName} key={column.id}>
                        <span
                          className={
                            column.id === "mebStatus" ? "skeleton skeleton-pill" : "skeleton"
                          }
                          style={{ width: `${column.skeletonWidth + (i * 9) % 28}px` }}
                        />
                      </td>
                    ))}
                    <td className="col-picker-td" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : groups.length === 0 ? (
        <div className="data-table-empty" style={{ padding: "48px 0", textAlign: "center" }}>
          {emptyMessage}
        </div>
      ) : viewMode === "cards" ? (
        <div className="groups-grid">
          {groups.map((group) => (
            <div className="panel group-card" key={group.id} onClick={() => setSelectedGroupId(group.id)}>
              <div className="panel-header group-card-header">
                <div className="group-card-heading">
                  <span className="panel-title">
                    {buildGroupHeading(group.title, group.term, sortedTerms, lang, group.licenseClass)}
                  </span>
                </div>
                <StatusPill
                  label={groupMebStatusLabel(group.mebStatus)}
                  status={groupMebStatusToPill(group.mebStatus)}
                />
              </div>
              <div className="group-body">
                <div className="drawer-row">
                  <span className="label">{t("groups.card.capacity")}</span>
                  <span className="value">
                    {group.assignedCandidateCount} / {group.capacity}
                  </span>
                </div>
                <div className="drawer-row">
                  <span className="label">{t("groups.card.startDate")}</span>
                  <span className="value">{formatDateTR(group.startDate)}</span>
                </div>
              </div>
              {(group.candidatePreview?.length ?? 0) > 0 && (
                <div className="group-card-avatar-stack">
                  {(group.candidatePreview ?? []).map((candidate) => (
                    <CandidateAvatar
                      candidate={{
                        id: candidate.candidateId,
                        firstName: candidate.firstName,
                        lastName: candidate.lastName,
                        photo: candidate.photo ?? null,
                      }}
                      className="group-card-avatar"
                      key={candidate.candidateId}
                      size={28}
                    />
                  ))}
                  {group.activeCandidateCount > (group.candidatePreview?.length ?? 0) && (
                    <span className="group-card-avatar-overflow">
                      +{group.activeCandidateCount - (group.candidatePreview?.length ?? 0)}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="table-wrap spaced">
          <table className="data-table group-table">
            <thead>
              <tr>
                {visibleColumns.map((column) => (
                  <th className={column.headerClassName} key={column.id}>
                    {t(column.labelKey)}
                  </th>
                ))}
                <th className="col-picker-th">
                  <ColumnPicker
                    columns={pickerOptions}
                    isVisible={isVisible}
                    onToggle={toggleColumn}
                    triggerTitle={t("groups.columns.button")}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                >
                  {visibleColumns.map((column) => (
                    <td className={column.cellClassName} key={column.id}>
                      {column.renderCell(group, sortedTerms, lang)}
                    </td>
                  ))}
                  <td className="col-picker-td" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination disabled={loading} onChange={setPage} page={page} totalPages={totalPages} />

      <NewGroupModal
        initialTermId={selectedTermId || null}
        onClose={() => setModalOpen(false)}
        onSubmit={handleGroupCreated}
        open={modalOpen}
      />

      <NewTermModal
        onClose={() => setTermModalState(null)}
        onSaved={termModalState?.mode === "edit" ? handleTermSaved : handleTermCreated}
        open={termModalState !== null}
        term={termModalState?.mode === "edit" ? termModalState.term : null}
      />

      <GroupDrawer
        groupId={selectedGroupId}
        onClose={() => setSelectedGroupId(null)}
        onDeleted={handleGroupDeleted}
        onUpdated={handleGroupUpdated}
      />
    </>
  );
}
