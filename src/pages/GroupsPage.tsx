import { useEffect, useMemo, useState } from "react";

import { GroupDrawer } from "../components/drawers/GroupDrawer";
import { GridIcon, ListIcon, PencilIcon, PlusIcon, XIcon } from "../components/icons";
import { PageToolbar } from "../components/layout/PageToolbar";
import { NewGroupModal } from "../components/modals/NewGroupModal";
import { NewTermModal } from "../components/modals/NewTermModal";
import { Pagination } from "../components/ui/Pagination";
import { SearchInput } from "../components/ui/SearchInput";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";
import { getGroups } from "../lib/groups-api";
import { useLanguage, useT } from "../lib/i18n";
import {
  formatDateTR,
  groupMebStatusLabel,
  groupMebStatusToPill,
  GROUP_MEB_STATUS_OPTIONS,
} from "../lib/status-maps";
import { buildGroupHeading, buildTermLabel, compareTermsDesc } from "../lib/term-label";
import { deleteTerm, getTerms, updateTerm } from "../lib/terms-api";
import type { GroupResponse, TermResponse } from "../lib/types";

type Filters = {
  search: string;
  mebStatus: string;
};

type GroupViewMode = "cards" | "list";

const INITIAL_FILTERS: Filters = {
  search: "",
  mebStatus: "",
};

const PAGE_SIZE = 12;
const TEXT_DEBOUNCE_MS = 300;

export function GroupsPage() {
  const { showToast } = useToast();
  const t = useT();
  const { lang } = useLanguage();

  const [terms, setTerms] = useState<TermResponse[]>([]);
  const [termsLoading, setTermsLoading] = useState(true);
  const [termRefreshKey, setTermRefreshKey] = useState(0);
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [termModalOpen, setTermModalOpen] = useState(false);

  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState<GroupViewMode>("cards");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  /* ── Terms ───────────────────────────────────────────── */

  useEffect(() => {
    const controller = new AbortController();
    setTermsLoading(true);
    getTerms({ pageSize: 200 }, controller.signal)
      .then((result) => {
        const sorted = [...result.items].sort(compareTermsDesc);
        setTerms(sorted);
        // Default-select the most recent term on first load.
        setSelectedTermId((prev) => (prev ? prev : sorted[0]?.id ?? ""));
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
    setTermModalOpen(false);
    setSelectedTermId(term.id);
    setPage(1);
    setTermRefreshKey((k) => k + 1);
  };

  const handleTermRename = async (term: TermResponse) => {
    const next = window.prompt(t("terms.form.name"), term.name ?? "");
    if (next === null) return;
    try {
      await updateTerm(term.id, { name: next.trim() || null });
      showToast(t("terms.updated"));
      setTermRefreshKey((k) => k + 1);
    } catch {
      showToast(t("terms.updateFailed"), "error");
    }
  };

  const handleTermDelete = async (term: TermResponse) => {
    if (!window.confirm(t("terms.confirmDelete"))) return;
    try {
      await deleteTerm(term.id);
      showToast(t("terms.deleted"));
      if (selectedTermId === term.id) setSelectedTermId("");
      setTermRefreshKey((k) => k + 1);
    } catch {
      showToast(t("terms.deleteFailed"), "error");
    }
  };

  /* ── Groups (scoped to the selected term) ────────────── */

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(filters.search),
      TEXT_DEBOUNCE_MS
    );
    return () => window.clearTimeout(timer);
  }, [filters.search]);

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
        search: debouncedSearch.trim() || undefined,
        mebStatus: filters.mebStatus || undefined,
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
    debouncedSearch,
    filters.mebStatus,
    page,
    refreshKey,
    showToast,
    t,
  ]);

  const patchFilters = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters(INITIAL_FILTERS);
    setPage(1);
  };

  const hasAnyFilter =
    filters.search !== INITIAL_FILTERS.search ||
    filters.mebStatus !== INITIAL_FILTERS.mebStatus;

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

  const emptyMessage = !selectedTermId
    ? t("groups.empty.noTermSelected")
    : hasAnyFilter
    ? t("groups.empty.noMatches")
    : t("groups.empty.noGroupsForTab");

  return (
    <>
      <PageToolbar
        actions={
          <>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setTermModalOpen(true)}
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
          </>
        }
        title={t("groups.title")}
      />

      <div className="term-bar">
        <label className="term-bar-label" htmlFor="term-selector">
          {t("terms.selector.label")}
        </label>
        <select
          aria-label={t("terms.selector.label")}
          className="form-select term-bar-select"
          disabled={termsLoading}
          id="term-selector"
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
        </select>

        {selectedTerm && (
          <div className="term-bar-actions">
            <button
              className="icon-btn"
              onClick={() => handleTermRename(selectedTerm)}
              title={t("terms.edit")}
              type="button"
            >
              <PencilIcon size={13} />
            </button>
            <button
              className="icon-btn"
              onClick={() => handleTermDelete(selectedTerm)}
              title={t("terms.delete")}
              type="button"
            >
              <XIcon size={13} />
            </button>
          </div>
        )}
      </div>

      <div className="search-box">
        <SearchInput
          onChange={(v) => patchFilters({ search: v })}
          placeholder={t("groups.searchPlaceholder")}
          value={filters.search}
        />
        <select
          aria-label={t("groups.filter.mebStatus")}
          className="form-select filter-select"
          onChange={(e) => patchFilters({ mebStatus: e.target.value })}
          value={filters.mebStatus}
        >
          <option value="">{t("groups.filter.allMebStatuses")}</option>
          {GROUP_MEB_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {hasAnyFilter && (
          <button
            className="btn btn-secondary btn-sm filter-clear"
            onClick={handleClearFilters}
            type="button"
          >
            <XIcon size={12} />
            {t("common.clearFilters")}
          </button>
        )}
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
                  <th>{t("groups.table.name")}</th>
                  <th>{t("groups.table.capacity")}</th>
                  <th>{t("groups.table.startDate")}</th>
                  <th>{t("groups.table.mebStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: PAGE_SIZE }, (_, i) => (
                  <tr key={i} style={{ pointerEvents: "none" }}>
                    <td><span className="skeleton" style={{ width: `${170 + (i * 37) % 70}px` }} /></td>
                    <td><span className="skeleton" style={{ width: "64px" }} /></td>
                    <td><span className="skeleton" style={{ width: "84px" }} /></td>
                    <td><span className="skeleton skeleton-pill" style={{ width: "76px" }} /></td>
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
            <div
              className="panel group-card"
              key={group.id}
              onClick={() => setSelectedGroupId(group.id)}
            >
              <div className="panel-header">
                <span className="panel-title">
                  {buildGroupHeading(group.title, group.term, sortedTerms, lang, group.licenseClass)}
                </span>
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
            </div>
          ))}
        </div>
      ) : (
        <div className="table-wrap spaced">
          <table className="data-table group-table">
            <thead>
              <tr>
                <th>{t("groups.table.name")}</th>
                <th>{t("groups.table.capacity")}</th>
                <th>{t("groups.table.startDate")}</th>
                <th>{t("groups.table.mebStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                >
                  <td className="group-table-name">
                    {buildGroupHeading(group.title, group.term, sortedTerms, lang, group.licenseClass)}
                  </td>
                  <td>
                    {group.assignedCandidateCount} / {group.capacity}
                  </td>
                  <td>{formatDateTR(group.startDate)}</td>
                  <td>
                    <StatusPill
                      label={groupMebStatusLabel(group.mebStatus)}
                      status={groupMebStatusToPill(group.mebStatus)}
                    />
                  </td>
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
        onClose={() => setTermModalOpen(false)}
        onCreated={handleTermCreated}
        open={termModalOpen}
      />

      <GroupDrawer
        groupId={selectedGroupId}
        onClose={() => setSelectedGroupId(null)}
        onUpdated={handleGroupUpdated}
      />
    </>
  );
}
