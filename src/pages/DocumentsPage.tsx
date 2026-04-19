import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "react-router-dom";

import { CandidateFilterPanel } from "../components/candidates/CandidateFilterPanel";
import { CandidateDrawer } from "../components/drawers/CandidateDrawer";
import { CheckIcon, XIcon } from "../components/icons";
import { PageTabs, PageToolbar } from "../components/layout/PageToolbar";
import { CandidateTagManagerModal } from "../components/modals/CandidateTagManagerModal";
import { ManageDocumentModal } from "../components/modals/ManageDocumentModal";
import { UploadDocumentModal } from "../components/modals/UploadDocumentModal";
import { CandidateAvatar } from "../components/ui/CandidateAvatar";
import { CandidateTagsInput, tagColorIndex } from "../components/ui/CandidateTagsInput";
import { CustomSelect } from "../components/ui/CustomSelect";
import { Pagination } from "../components/ui/Pagination";
import { Panel } from "../components/ui/Panel";
import { SearchInput } from "../components/ui/SearchInput";
import { useToast } from "../components/ui/Toast";
import {
  applyStatusToCandidates,
  applyTagsToCandidates,
} from "../lib/candidate-bulk";
import {
  EMPTY_CANDIDATE_FILTERS,
  countActiveCandidateFilters,
  filtersToQuery,
  type CandidateFilterState,
} from "../lib/candidate-filters";
import { createCandidateTag, searchCandidateTags } from "../lib/candidates-api";
import { getDocumentChecklist, getDocumentTypes } from "../lib/documents-api";
import { useT } from "../lib/i18n";
import { buildWhatsAppUrl, formatPhoneNumber } from "../lib/phone";
import { normalizeTextQuery } from "../lib/search";
import {
  CANDIDATE_STATUS_OPTIONS,
  type CandidateStatusValue,
} from "../lib/status-maps";
import type {
  CandidateTag,
  DocumentChecklistEntry,
  DocumentTypeResponse,
} from "../lib/types";

type Filters = {
  search: string;
};

const INITIAL_FILTERS: Filters = {
  search: "",
};

const PAGE_SIZE = 20;
const TEXT_DEBOUNCE_MS = 300;

type DocumentSortField = "name";
type SortDirection = "asc" | "desc";
type SortState = { field: DocumentSortField; direction: SortDirection } | null;

type DocumentsTab = "all" | "pre_registered" | "active";

const TABS: { key: DocumentsTab; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "pre_registered", label: "Ön Kayıt" },
  { key: "active", label: "Aktif" },
];
const DEFAULT_TAB: DocumentsTab = "all";

type BulkActionMode = "status" | "tags" | null;
const BULK_STATUS_OPTIONS = CANDIDATE_STATUS_OPTIONS;

type UploadTarget = {
  candidateId?: string;
  candidateName?: string;
  documentTypeId?: string;
} | null;

type ManageTarget = {
  candidateId: string;
  candidateName: string;
  documentTypeId: string;
} | null;

function shortDocumentTypeLabel(name: string): string {
  const trimmed = name.trim();
  const visible = trimmed.slice(0, 8);
  return trimmed.length > 8 ? `${visible}..` : trimmed;
}

function documentSummaryToneClass(
  summary: DocumentChecklistEntry["summary"]
): "documents-summary-empty" | "documents-summary-partial" | "documents-summary-complete" {
  if (summary.totalRequiredCount === 0 || summary.completedCount >= summary.totalRequiredCount) {
    return "documents-summary-complete";
  }

  if (summary.completedCount === 0) {
    return "documents-summary-empty";
  }

  return "documents-summary-partial";
}

function toAvatarCandidate(entry: DocumentChecklistEntry) {
  const trimmed = entry.fullName.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? trimmed;
  const lastName = parts.slice(1).join(" ") || parts[0] || trimmed;

  return {
    id: entry.candidateId,
    firstName,
    lastName,
    photo: entry.photo ?? null,
  };
}

function renderPhoneNumber(entry: DocumentChecklistEntry) {
  const phoneNumber = formatPhoneNumber(entry.phoneNumber);
  const whatsappUrl = buildWhatsAppUrl(entry.phoneNumber);

  if (!whatsappUrl) {
    return <div className="cand-secondary-text">{phoneNumber}</div>;
  }

  return (
    <a
      className="documents-phone-link"
      href={whatsappUrl}
      onClick={(event) => event.stopPropagation()}
      rel="noreferrer"
      target="_blank"
    >
      {phoneNumber}
    </a>
  );
}

export function DocumentsPage() {
  const t = useT();
  const { showToast } = useToast();

  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<SortState>(null);
  const [tab, setTab] = useState<DocumentsTab>(DEFAULT_TAB);
  const [candidateFilters, setCandidateFilters] = useState<CandidateFilterState>(
    EMPTY_CANDIDATE_FILTERS
  );
  const [debouncedCandidateFilters, setDebouncedCandidateFilters] =
    useState<CandidateFilterState>(EMPTY_CANDIDATE_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = countActiveCandidateFilters(candidateFilters);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [entries, setEntries] = useState<DocumentChecklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const lastCompletedFetchKeyRef = useRef<string | null>(null);

  const [documentTypes, setDocumentTypes] = useState<DocumentTypeResponse[]>([]);
  const [uploadTarget, setUploadTarget] = useState<UploadTarget>(null);
  const [manageTarget, setManageTarget] = useState<ManageTarget>(null);

  const [allTags, setAllTags] = useState<CandidateTag[]>([]);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagDraft, setNewTagDraft] = useState("");
  const newTagInputRef = useRef<HTMLInputElement | null>(null);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("selected");
  const openDrawer = (id: string) => setSearchParams({ selected: id });
  const closeDrawer = () => setSearchParams({});

  const [bulkSelectEnabled, setBulkSelectEnabled] = useState(false);
  const [bulkActionMode, setBulkActionMode] = useState<BulkActionMode>(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [bulkStatusValue, setBulkStatusValue] = useState<"" | CandidateStatusValue>("");
  const [bulkTagValues, setBulkTagValues] = useState<string[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);

  const selectedCount = selectedCandidateIds.size;
  const allVisibleSelected =
    entries.length > 0 && entries.every((entry) => selectedCandidateIds.has(entry.candidateId));
  const visibleBulkStatusOptions = useMemo(
    () =>
      tab === "all"
        ? BULK_STATUS_OPTIONS
        : BULK_STATUS_OPTIONS.filter((option) => option.value !== tab),
    [tab]
  );

  useEffect(() => {
    const controller = new AbortController();
    getDocumentTypes(undefined, controller.signal)
      .then(setDocumentTypes)
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        showToast(t("uploadDoc.errors.typesLoadFailed"), "error");
      });
    return () => controller.abort();
  }, [showToast, t]);

  // Load the full list of candidate tags for the filter chips. Refreshes with
  // refreshKey so bulk-added tags show up here too.
  useEffect(() => {
    const controller = new AbortController();
    searchCandidateTags(undefined, 200, controller.signal)
      .then(setAllTags)
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [refreshKey]);

  // Drop active tag filters that no longer exist (e.g. renamed/deleted elsewhere).
  useEffect(() => {
    if (activeTags.length === 0) return;
    const known = new Set(allTags.map((tag) => tag.name));
    const filtered = activeTags.filter((name) => known.has(name));
    if (filtered.length !== activeTags.length) {
      setActiveTags(filtered);
    }
  }, [activeTags, allTags]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(filters.search),
      TEXT_DEBOUNCE_MS
    );
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedCandidateFilters(candidateFilters),
      TEXT_DEBOUNCE_MS
    );
    return () => window.clearTimeout(timer);
  }, [candidateFilters]);

  useEffect(() => {
    const controller = new AbortController();
    const requestParams = {
      search: normalizeTextQuery(debouncedSearch),
      candidateStatus: tab === "all" ? undefined : tab,
      tags: activeTags.length > 0 ? activeTags : undefined,
      ...filtersToQuery(debouncedCandidateFilters),
      page,
      pageSize: PAGE_SIZE,
    };
    const fetchKey = JSON.stringify({ ...requestParams, refreshKey });
    if (lastCompletedFetchKeyRef.current === fetchKey) {
      return;
    }

    setLoading(true);

    getDocumentChecklist(requestParams, controller.signal)
      .then((result) => {
        lastCompletedFetchKeyRef.current = fetchKey;
        setEntries(result.items);
        setTotalPages(result.totalPages);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        showToast(t("documents.loadFailed"), "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [activeTags, debouncedCandidateFilters, debouncedSearch, page, refreshKey, showToast, t, tab]);

  const patchFilters = (patch: Partial<Filters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters(INITIAL_FILTERS);
    setPage(1);
  };

  const handleCandidateFilterChange = <K extends keyof CandidateFilterState>(
    key: K,
    value: CandidateFilterState[K]
  ) => {
    setPage(1);
    setCandidateFilters((current) => ({ ...current, [key]: value }));
  };

  const clearAllCandidateFilters = () => {
    setPage(1);
    setCandidateFilters(EMPTY_CANDIDATE_FILTERS);
    setDebouncedCandidateFilters(EMPTY_CANDIDATE_FILTERS);
    setActiveTags([]);
  };

  const handleSortToggle = (field: DocumentSortField) => {
    setPage(1);
    setSort((current) => {
      if (!current || current.field !== field) {
        return { field, direction: "asc" };
      }

      if (current.direction === "asc") {
        return { field, direction: "desc" };
      }

      return null;
    });
  };

  const hasAnyFilter = !!filters.search;

  const handleTabChange = (value: DocumentsTab) => {
    setTab(value);
    setPage(1);
  };

  const handleTagFilterToggle = (name: string) => {
    setPage(1);
    setActiveTags((current) =>
      current.includes(name) ? current.filter((tag) => tag !== name) : [...current, name]
    );
  };

  const upsertTagCatalog = (tag: CandidateTag) => {
    setAllTags((current) => {
      const next = current.some((item) => item.id === tag.id || item.name === tag.name)
        ? current.map((item) => (item.id === tag.id || item.name === tag.name ? tag : item))
        : [...current, tag];
      return next.slice().sort((left, right) => left.name.localeCompare(right.name, "tr"));
    });
  };

  const removeTagFromCatalog = (tagId: string) => {
    setAllTags((current) => current.filter((tag) => tag.id !== tagId));
  };

  const openAddTagInput = () => {
    setNewTagDraft("");
    setIsAddingTag(true);
    window.setTimeout(() => newTagInputRef.current?.focus(), 0);
  };

  const closeAddTagInput = () => {
    if (isCreatingTag) return;
    setIsAddingTag(false);
    setNewTagDraft("");
  };

  const commitNewTag = async () => {
    const name = newTagDraft.trim();
    if (!name) {
      closeAddTagInput();
      return;
    }

    const normalized = name.toLocaleLowerCase("tr-TR");
    const existing = allTags.find(
      (tag) => tag.name.toLocaleLowerCase("tr-TR") === normalized
    );
    if (existing) {
      setActiveTags((current) =>
        current.includes(existing.name) ? current : [...current, existing.name]
      );
      setPage(1);
      setIsAddingTag(false);
      setNewTagDraft("");
      return;
    }

    setIsCreatingTag(true);
    try {
      const createdTag = await createCandidateTag(name);
      upsertTagCatalog(createdTag);
      setActiveTags((current) =>
        current.includes(createdTag.name) ? current : [...current, createdTag.name]
      );
      setPage(1);
      setIsAddingTag(false);
      setNewTagDraft("");
    } catch {
      showToast("Etiket oluşturulamadı", "error");
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleNewTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void commitNewTag();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeAddTagInput();
    }
  };

  const handleTagRenamed = (previousTag: CandidateTag, nextTag: CandidateTag) => {
    removeTagFromCatalog(previousTag.id);
    upsertTagCatalog(nextTag);
    setActiveTags((current) => {
      const mapped = current.map((name) => (name === previousTag.name ? nextTag.name : name));
      return mapped.filter((name, index) => mapped.indexOf(name) === index);
    });
    setRefreshKey((k) => k + 1);
  };

  const handleTagDeleted = (tag: CandidateTag) => {
    removeTagFromCatalog(tag.id);
    setActiveTags((current) => current.filter((name) => name !== tag.name));
    setRefreshKey((k) => k + 1);
  };

  const toggleBulkSelection = () => {
    setBulkSelectEnabled((current) => {
      const next = !current;
      if (next) {
        // Close the filter drawer so the toolbar has room for the bulk controls.
        setFiltersOpen(false);
      } else {
        setBulkActionMode(null);
        setSelectedCandidateIds(new Set());
        setBulkStatusValue("");
        setBulkTagValues([]);
      }
      return next;
    });
  };

  const toggleCandidateSelection = (candidateId: string) => {
    setSelectedCandidateIds((current) => {
      const next = new Set(current);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);
      return next;
    });
  };

  const toggleVisibleCandidateSelection = () => {
    setSelectedCandidateIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const entry of entries) next.delete(entry.candidateId);
      } else {
        for (const entry of entries) next.add(entry.candidateId);
      }
      return next;
    });
  };

  const openBulkStatusAction = () => {
    if (selectedCount === 0) {
      showToast("Önce en az bir aday seç", "error");
      return;
    }
    setBulkActionMode("status");
  };

  const openBulkTagAction = () => {
    if (selectedCount === 0) {
      showToast("Önce en az bir aday seç", "error");
      return;
    }
    setBulkActionMode("tags");
  };

  const applyBulkStatusChange = async () => {
    if (!bulkStatusValue || selectedCount === 0) return;
    setBulkSaving(true);
    try {
      const selectedIds = Array.from(selectedCandidateIds);
      await applyStatusToCandidates(selectedIds, bulkStatusValue);
      showToast(`${selectedIds.length} aday güncellendi`);
      setBulkActionMode(null);
      setSelectedCandidateIds(new Set());
      setBulkStatusValue("");
      setRefreshKey((k) => k + 1);
    } catch {
      showToast("Toplu durum güncellenemedi", "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const applyBulkTagChange = async () => {
    if (bulkTagValues.length === 0 || selectedCount === 0) return;
    setBulkSaving(true);
    try {
      const selectedIds = Array.from(selectedCandidateIds);
      await applyTagsToCandidates(selectedIds, bulkTagValues);
      showToast(`${selectedIds.length} adaya etiket eklendi`);
      setBulkActionMode(null);
      setSelectedCandidateIds(new Set());
      setBulkTagValues([]);
      setRefreshKey((k) => k + 1);
    } catch {
      showToast("Toplu etiket ekleme tamamlanamadı", "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const openUpload = (entry?: DocumentChecklistEntry, documentTypeId?: string) => {
    const firstMissingType = documentTypeId ?? (
      entry?.missingDocumentKeys[0]
        ? documentTypes.find((item) => item.key === entry.missingDocumentKeys[0])?.id
        : undefined
    );

    setUploadTarget({
      candidateId: entry?.candidateId,
      candidateName: entry?.fullName,
      documentTypeId: firstMissingType,
    });
  };

  const handleUploaded = () => {
    setUploadTarget(null);
    showToast(t("documents.uploaded"));
    setRefreshKey((current) => current + 1);
  };

  const handleDocumentSaved = () => {
    setManageTarget(null);
    showToast(t("documents.manage.saved"));
    setRefreshKey((current) => current + 1);
  };

  const emptyMessage = hasAnyFilter
    ? t("documents.empty.filtered")
    : t("documents.empty.all");
  const requiredDocumentTypes = [...documentTypes]
    .filter((documentType) => documentType.isRequired && documentType.isActive)
    .sort((left, right) =>
      left.sortOrder === right.sortOrder
        ? left.name.localeCompare(right.name, "tr", { sensitivity: "base" })
        : left.sortOrder - right.sortOrder
    );
  const sortedEntries = [...entries].sort((left, right) => {
    if (!sort || sort.field !== "name") {
      return 0;
    }

    const byLastName = left.fullName.localeCompare(right.fullName, "tr", { sensitivity: "base" });
    return sort.direction === "asc" ? byLastName : -byLastName;
  });

  return (
    <>
      <PageToolbar
        actions={
          bulkSelectEnabled ? (
            <div className="candidate-bulk-toolbar">
              {selectedCount > 0 ? (
                <span className="candidate-bulk-count">{selectedCount} seçili</span>
              ) : null}
              {bulkActionMode === "status" ? (
                <>
                  <CustomSelect
                    aria-label="Toplu durum seç"
                    onChange={(event) =>
                      setBulkStatusValue(event.target.value as "" | CandidateStatusValue)
                    }
                    size="sm"
                    value={bulkStatusValue}
                  >
                    <option value="">Durum seç</option>
                    {visibleBulkStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </CustomSelect>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={selectedCount === 0 || !bulkStatusValue || bulkSaving}
                    onClick={applyBulkStatusChange}
                    type="button"
                  >
                    {bulkSaving ? "Güncelleniyor..." : "Uygula"}
                  </button>
                </>
              ) : bulkActionMode === "tags" ? (
                <>
                  <CandidateTagsInput
                    ariaLabel="Toplu etiket seç"
                    className="candidate-bulk-tags-input"
                    onChange={setBulkTagValues}
                    placeholder="Etiket ara veya yeni ekle"
                    value={bulkTagValues}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={selectedCount === 0 || bulkTagValues.length === 0 || bulkSaving}
                    onClick={applyBulkTagChange}
                    type="button"
                  >
                    {bulkSaving ? "Ekleniyor..." : "Uygula"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={openBulkTagAction}
                    type="button"
                  >
                    Etiket Ekle
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={openBulkStatusAction}
                    type="button"
                  >
                    Durum Değiştir
                  </button>
                </>
              )}
              <button
                className="btn btn-secondary btn-sm"
                onClick={toggleBulkSelection}
                type="button"
              >
                Kapat
              </button>
            </div>
          ) : (
            <>
              <label className="switch-toggle cand-filters-switch">
                <input
                  aria-controls="documents-filters-panel"
                  aria-label="Filtreler"
                  checked={filtersOpen}
                  onChange={(event) => setFiltersOpen(event.target.checked)}
                  type="checkbox"
                />
                <span className="switch-toggle-control" aria-hidden="true" />
                <span>Filtreler</span>
                {activeFilterCount > 0 && !filtersOpen && (
                  <span className="cand-filters-badge">{activeFilterCount}</span>
                )}
              </label>
              <button
                aria-pressed={bulkSelectEnabled}
                className="btn btn-secondary btn-sm"
                onClick={toggleBulkSelection}
                type="button"
              >
                Toplu Seçim
              </button>
            </>
          )
        }
        title={t("documents.title")}
      />

      <CandidateFilterPanel
        activeFilterCount={activeFilterCount}
        filters={candidateFilters}
        hasAnyActiveFilter={activeFilterCount > 0 || activeTags.length > 0}
        onChange={handleCandidateFilterChange}
        onClearAll={clearAllCandidateFilters}
        onClose={() => setFiltersOpen(false)}
        open={filtersOpen}
      />

      <div className="tabs-search-row">
        <PageTabs active={tab} onChange={handleTabChange} tabs={TABS} />
        <div className="search-box documents-toolbar-search">
          <SearchInput
            onChange={(value) => patchFilters({ search: value })}
            placeholder={t("documents.searchPlaceholder")}
            value={filters.search}
          />
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
      </div>

      <div className="tag-filter-bar" role="toolbar" aria-label={t("candidates.tags.label")}>
        {allTags.map((tag) => {
          const isActive = activeTags.includes(tag.name);
          return (
            <button
              aria-pressed={isActive}
              className={`tag-filter-chip color-${tagColorIndex(tag.name)}${
                isActive ? " active" : ""
              }`}
              key={tag.id}
              onClick={() => handleTagFilterToggle(tag.name)}
              type="button"
            >
              {tag.name}
            </button>
          );
        })}
        {isAddingTag ? (
          <input
            aria-label={t("candidates.tags.newFilterPlaceholder")}
            className="tag-filter-new-input"
            disabled={isCreatingTag}
            onBlur={() => {
              void commitNewTag();
            }}
            onChange={(event) => setNewTagDraft(event.target.value)}
            onKeyDown={handleNewTagKeyDown}
            placeholder={t("candidates.tags.newFilterPlaceholder")}
            ref={newTagInputRef}
            type="text"
            value={newTagDraft}
          />
        ) : (
          <button
            aria-label={t("candidates.tags.addFilter")}
            className="tag-filter-add"
            onClick={openAddTagInput}
            type="button"
          >
            + {t("candidates.tags.addFilter")}
          </button>
        )}
        <button
          className="tag-filter-manage"
          onClick={() => setTagManagerOpen(true)}
          type="button"
        >
          Etiketleri Yönet
        </button>
      </div>

      <div className="table-wrap spaced documents-table-wrap">
        <Panel>
          <table className="data-table documents-table">
            <thead>
              <tr>
                {bulkSelectEnabled && (
                  <th className="cand-select-th">
                    <span className="cand-select-control">
                      <input
                        aria-label="Bu sayfadaki tüm adayları seç"
                        checked={allVisibleSelected}
                        onChange={toggleVisibleCandidateSelection}
                        type="checkbox"
                      />
                    </span>
                  </th>
                )}
                <th aria-label="Resim" className="cand-photo-th" />
                <SortableTh
                  field="name"
                  label={t("documents.col.candidate")}
                  onToggle={handleSortToggle}
                  sort={sort}
                />
                {requiredDocumentTypes.map((documentType) => (
                  <th
                    className="documents-doc-th"
                    key={documentType.id}
                    title={documentType.name}
                  >
                    <span aria-label={documentType.name} className="documents-doc-label">
                      {shortDocumentTypeLabel(documentType.name)}
                    </span>
                  </th>
                ))}
                <th>{t("documents.col.summary")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }, (_, index) => (
                  <tr key={index} style={{ pointerEvents: "none" }}>
                    {bulkSelectEnabled && <td className="cand-select-td" />}
                    <td className="cand-photo-td">
                      <span className="skeleton" style={{ width: 28, height: 28, borderRadius: "999px" }} />
                    </td>
                    <td>
                      <span className="skeleton" style={{ width: `${110 + (index * 37) % 60}px` }} />
                    </td>
                    {requiredDocumentTypes.map((documentType, docIndex) => (
                      <td className="documents-doc-td" key={documentType.id}>
                        <span
                          className="skeleton"
                          style={{ width: `${18 + ((index + docIndex) * 5) % 6}px` }}
                        />
                      </td>
                    ))}
                    <td>
                      <span className="skeleton" style={{ width: 88 }} />
                    </td>
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td
                    className="data-table-empty"
                    colSpan={requiredDocumentTypes.length + 3 + (bulkSelectEnabled ? 1 : 0)}
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                sortedEntries.map((entry) => {
                  return (
                    <tr key={entry.candidateId} onClick={() => openDrawer(entry.candidateId)}>
                      {bulkSelectEnabled && (
                        <td
                          className="cand-select-td"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <span className="cand-select-control">
                            <input
                              aria-label={`${entry.fullName} seç`}
                              checked={selectedCandidateIds.has(entry.candidateId)}
                              onChange={() => toggleCandidateSelection(entry.candidateId)}
                              onClick={(event) => event.stopPropagation()}
                              type="checkbox"
                            />
                          </span>
                        </td>
                      )}
                      <td className="cand-photo-td">
                        <CandidateAvatar
                          candidate={toAvatarCandidate(entry)}
                          className="cand-avatar-cell"
                          size={30}
                        />
                      </td>
                      <td>
                        <div className="cand-name">{entry.fullName}</div>
                        {renderPhoneNumber(entry)}
                      </td>
                      {requiredDocumentTypes.map((documentType) => {
                        const hasDocument = !entry.missingDocumentKeys.includes(documentType.key);
                        const documentTypeId = documentType.id;
                        return (
                          <td className="documents-doc-td" key={documentType.id}>
                            {hasDocument ? (
                              <button
                                aria-label={`${documentType.name}: var`}
                                className="documents-doc-icon-btn"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setManageTarget({
                                    candidateId: entry.candidateId,
                                    candidateName: entry.fullName,
                                    documentTypeId,
                                  });
                                }}
                                title={`${documentType.name}: Var - Görüntüle / Düzenle`}
                                type="button"
                              >
                                <span className="documents-doc-icon present">
                                  <CheckIcon size={16} />
                                </span>
                              </button>
                            ) : (
                              <button
                                aria-label={`${documentType.name}: yok, yukle`}
                                className="documents-doc-icon-btn"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openUpload(entry, documentTypeId);
                                }}
                                title={`${documentType.name}: Yok - Yükle`}
                                type="button"
                              >
                                <span className="documents-doc-icon missing">
                                  <XIcon size={16} />
                                </span>
                              </button>
                            )}
                          </td>
                        );
                      })}
                      <td>
                        <span className={documentSummaryToneClass(entry.summary)}>
                          {t("documents.summary", {
                            completedCount: entry.summary.completedCount,
                            totalRequiredCount: entry.summary.totalRequiredCount,
                            missingCount: entry.summary.missingCount,
                          })}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Panel>
      </div>

      <Pagination onChange={setPage} page={page} totalPages={totalPages} />

      <UploadDocumentModal
        candidateId={uploadTarget?.candidateId ?? null}
        candidateName={uploadTarget?.candidateName}
        documentTypes={documentTypes}
        initialDocumentTypeId={uploadTarget?.documentTypeId}
        onClose={() => setUploadTarget(null)}
        onUploaded={handleUploaded}
        open={uploadTarget !== null}
      />

      <ManageDocumentModal
        candidateId={manageTarget?.candidateId ?? null}
        candidateName={manageTarget?.candidateName}
        documentTypeId={manageTarget?.documentTypeId}
        documentTypes={documentTypes}
        onClose={() => setManageTarget(null)}
        onSaved={handleDocumentSaved}
        open={manageTarget !== null}
      />

      <CandidateTagManagerModal
        onClose={() => setTagManagerOpen(false)}
        onDeleted={handleTagDeleted}
        onRenamed={handleTagRenamed}
        open={tagManagerOpen}
        tags={allTags}
      />

      <CandidateDrawer
        candidateId={selectedId}
        onClose={closeDrawer}
        onDeleted={() => {
          closeDrawer();
          setRefreshKey((k) => k + 1);
        }}
        onUpdated={() => setRefreshKey((k) => k + 1)}
      />
    </>
  );
}

type SortableThProps = {
  field: DocumentSortField;
  label: string;
  sort: SortState;
  onToggle: (field: DocumentSortField) => void;
};

function SortableTh({ field, label, sort, onToggle }: SortableThProps) {
  const isActive = sort?.field === field;
  const direction = isActive ? sort.direction : null;
  const indicator = direction === "asc" ? "▲" : direction === "desc" ? "▼" : "↕";
  const ariaSort = isActive
    ? direction === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <th aria-sort={ariaSort} className={isActive ? "sortable-th active" : "sortable-th"}>
      <button
        className="sortable-th-btn"
        onClick={() => onToggle(field)}
        type="button"
      >
        <span>{label}</span>
        <span aria-hidden="true" className="sortable-th-indicator">
          {indicator}
        </span>
      </button>
    </th>
  );
}
