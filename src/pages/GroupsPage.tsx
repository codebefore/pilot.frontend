import { useEffect, useState } from "react";

import { GroupDrawer } from "../components/drawers/GroupDrawer";
import { PlusIcon, XIcon } from "../components/icons";
import { PageTabs, PageToolbar } from "../components/layout/PageToolbar";
import { NewGroupModal } from "../components/modals/NewGroupModal";
import { Pagination } from "../components/ui/Pagination";
import { SearchInput } from "../components/ui/SearchInput";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";
import { useT } from "../lib/i18n";
import { getGroups } from "../lib/groups-api";
import {
  formatDateTR,
  groupMebStatusLabel,
  groupMebStatusToPill,
  groupStatusToPill,
  GROUP_MEB_STATUS_OPTIONS,
  LICENSE_CLASS_OPTIONS,
} from "../lib/status-maps";
import type { GroupResponse, LicenseClass } from "../lib/types";
import type { TranslationKey } from "../lib/i18n";

type GroupStatusTab = "active" | "draft" | "closing" | "completed";

const TAB_LABEL_KEYS: Record<GroupStatusTab, TranslationKey> = {
  active:    "groupStatus.active",
  draft:     "groupStatus.draft",
  closing:   "groupStatus.closing",
  completed: "groupStatus.completed",
};

const TAB_KEYS: GroupStatusTab[] = ["active", "draft", "closing", "completed"];

function normalizeStatusToKey(status: string): TranslationKey | null {
  switch (status.toLowerCase()) {
    case "active":      return "groupStatus.active";
    case "draft":       return "groupStatus.draft";
    case "closing":     return "groupStatus.closing";
    case "completed":   return "groupStatus.completed";
    default:            return null;
  }
}

type Filters = {
  search: string;
  licenseClass: "" | LicenseClass;
  termName: string;
  mebStatus: string;
};

const INITIAL_FILTERS: Filters = {
  search: "",
  licenseClass: "",
  termName: "",
  mebStatus: "",
};

const PAGE_SIZE = 12;
const TEXT_DEBOUNCE_MS = 300;

function parseLicenseClass(value: string): "" | LicenseClass {
  return LICENSE_CLASS_OPTIONS.some((o) => o.value === value) ? (value as LicenseClass) : "";
}

export function GroupsPage() {
  const { showToast } = useToast();
  const t = useT();

  const tabs = TAB_KEYS.map((key) => ({ key, label: t(TAB_LABEL_KEYS[key]) }));

  const [tab, setTab] = useState<GroupStatusTab>("active");
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedTermName, setDebouncedTermName] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Debounce only the text inputs; tab and select changes should feel instant.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(filters.search);
      setDebouncedTermName(filters.termName);
    }, TEXT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [filters.search, filters.termName]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    getGroups(
      {
        search: debouncedSearch.trim() || undefined,
        status: tab,
        mebStatus: filters.mebStatus || undefined,
        licenseClass: filters.licenseClass || undefined,
        termName: debouncedTermName.trim() || undefined,
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
    tab,
    debouncedSearch,
    debouncedTermName,
    filters.licenseClass,
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

  const handleTabChange = (value: GroupStatusTab) => {
    setTab(value);
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters(INITIAL_FILTERS);
    setPage(1);
  };

  const hasAnyFilter = Object.values(filters).some(Boolean);

  const handleGroupCreated = () => {
    setModalOpen(false);
    showToast(t("groups.created"));
    setRefreshKey((k) => k + 1);
  };

  const handleGroupUpdated = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <>
      <PageToolbar
        actions={
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setModalOpen(true)}
            type="button"
          >
            <PlusIcon size={14} />
            {t("groups.newGroup")}
          </button>
        }
        title={t("groups.title")}
      />

      <PageTabs active={tab} onChange={handleTabChange} tabs={tabs} />

      <div className="search-box">
        <SearchInput
          onChange={(v) => patchFilters({ search: v })}
          placeholder={t("groups.searchPlaceholder")}
          value={filters.search}
        />
        <select
          aria-label={t("groups.filter.licenseClass")}
          className="form-select filter-select"
          onChange={(e) => patchFilters({ licenseClass: parseLicenseClass(e.target.value) })}
          value={filters.licenseClass}
        >
          <option value="">{t("groups.filter.allLicenseClasses")}</option>
          {LICENSE_CLASS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <input
          aria-label={t("groups.filter.termName")}
          className="form-input filter-input"
          onChange={(e) => patchFilters({ termName: e.target.value })}
          placeholder={t("groups.termNamePlaceholder")}
          type="text"
          value={filters.termName}
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
      </div>

      {loading ? (
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
      ) : groups.length === 0 ? (
        <div className="data-table-empty" style={{ padding: "48px 0", textAlign: "center" }}>
          {hasAnyFilter ? t("groups.empty.noMatches") : t("groups.empty.noGroupsForTab")}
        </div>
      ) : (
        <div className="groups-grid">
          {groups.map((group) => {
            const statusKey = normalizeStatusToKey(group.status);
            const statusLabel = statusKey ? t(statusKey) : group.status;
            return (
              <div
                className="panel group-card"
                key={group.id}
                onClick={() => setSelectedGroupId(group.id)}
              >
                <div className="panel-header">
                  <span className="panel-title">{group.title}</span>
                  <StatusPill label={statusLabel} status={groupStatusToPill(group.status)} />
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
                  <div className="drawer-row">
                    <span className="label">{t("groups.card.endDate")}</span>
                    <span className="value">{formatDateTR(group.endDate)}</span>
                  </div>
                  <div className="drawer-row">
                    <span className="label">{t("groups.card.mebStatus")}</span>
                    <span className="value">
                      <StatusPill
                        label={groupMebStatusLabel(group.mebStatus)}
                        status={groupMebStatusToPill(group.mebStatus)}
                      />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination disabled={loading} onChange={setPage} page={page} totalPages={totalPages} />

      <NewGroupModal
        onClose={() => setModalOpen(false)}
        onSubmit={handleGroupCreated}
        open={modalOpen}
      />

      <GroupDrawer
        groupId={selectedGroupId}
        onClose={() => setSelectedGroupId(null)}
        onUpdated={handleGroupUpdated}
      />
    </>
  );
}
