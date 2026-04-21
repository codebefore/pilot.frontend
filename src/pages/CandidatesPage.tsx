import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "react-router-dom";

import { CandidateFilterPanel } from "../components/candidates/CandidateFilterPanel";
import { CandidateDrawer } from "../components/drawers/CandidateDrawer";
import { DownloadIcon, PlusIcon } from "../components/icons";
import { PageTabs, PageToolbar } from "../components/layout/PageToolbar";
import { CandidateTagManagerModal } from "../components/modals/CandidateTagManagerModal";
import { NewCandidateModal } from "../components/modals/NewCandidateModal";
import { CandidateDocumentBadge } from "../components/ui/CandidateDocumentBadge";
import { CandidateAvatar } from "../components/ui/CandidateAvatar";
import { CandidateTagsInput, tagColorIndex } from "../components/ui/CandidateTagsInput";
import { ColumnPicker, type ColumnOption } from "../components/ui/ColumnPicker";
import { CustomSelect } from "../components/ui/CustomSelect";
import { Pagination } from "../components/ui/Pagination";
import { SearchInput } from "../components/ui/SearchInput";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";
import {
  EMPTY_CANDIDATE_FILTERS,
  countActiveCandidateFilters,
  filtersToQuery,
  type CandidateFilterState,
} from "../lib/candidate-filters";
import {
  applyStatusToCandidates,
  applyTagsToCandidates,
} from "../lib/candidate-bulk";
import {
  getCandidates,
  getCandidateById,
  createCandidateTag,
  searchCandidateTags,
  type GetCandidatesParams,
  type CandidateSortField,
  type SortDirection,
} from "../lib/candidates-api";
import { getDocumentChecklist } from "../lib/documents-api";
import { useLanguage, useT } from "../lib/i18n";
import {
  candidateGenderLabel,
  candidateMebExamResultLabel,
  candidateMebExamResultToPill,
  CANDIDATE_STATUS_OPTIONS,
  CANDIDATE_STATUS_VALUES,
  candidateStatusLabel,
  candidateStatusToPill,
  formatDateTR,
  type CandidateStatusValue,
} from "../lib/status-maps";
import { buildGroupHeading, buildTermLabel } from "../lib/term-label";
import { normalizeTextQuery } from "../lib/search";
import type { CandidateResponse, CandidateTag } from "../lib/types";
import { useColumnVisibility } from "../lib/use-column-visibility";

type CandidateTab = "all" | CandidateStatusValue;
type BulkActionMode = "status" | "tags" | "export" | null;
type CandidateListTabKey = string;

const TAB_KEYS: CandidateTab[] = [
  "all",
  "pre_registered",
  "active",
  "parked",
  "graduated",
  "dropped",
];
const DEFAULT_TAB: CandidateTab = "active";

const PAGE_SIZE = 10;
const TEXT_DEBOUNCE_MS = 300;
const BULK_STATUS_OPTIONS = CANDIDATE_STATUS_OPTIONS;

type SortState = { field: CandidateSortField; direction: SortDirection } | null;

type CandidateColumnId =
  | "photo"
  | "name"
  | "nationalId"
  | "phoneNumber"
  | "email"
  | "birthDate"
  | "gender"
  | "licenseClass"
  | "group"
  | "groupStartDate"
  | "documents"
  | "missingDocuments"
  | "mebExamResult"
  | "examFeePaid"
  | "balance"
  | "status"
  | "createdAtUtc"
  | "updatedAtUtc";

type CandidateColumnDef = {
  id: CandidateColumnId;
  /** i18n key for the header + picker label. */
  labelKey: "candidates.col.name"
    | "candidates.col.photo"
    | "candidates.col.nationalId"
    | "candidates.col.phoneNumber"
    | "candidates.col.email"
    | "candidates.col.birthDate"
    | "candidates.col.gender"
    | "candidates.col.licenseClass"
    | "candidates.col.group"
    | "candidates.col.groupStartDate"
    | "candidates.col.documents"
    | "candidates.col.missingDocuments"
    | "candidates.col.mebExamResult"
    | "candidates.col.examFeePaid"
    | "candidates.col.balance"
    | "candidates.col.status"
    | "candidates.col.createdAtUtc"
    | "candidates.col.updatedAtUtc";
  headerLabel?: React.ReactNode;
  /** When set, this column is sortable via the given backend field. */
  sortField?: CandidateSortField;
  headerClassName?: string;
  cellClassName?: string;
  renderCell: (c: CandidateResponse) => React.ReactNode;
  /** Approximate skeleton width in pixels (used while loading). */
  skeletonWidth: number;
};

function formatOptionalText(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

function formatGroupWithTerm(candidate: CandidateResponse, lang: "tr" | "en"): string {
  if (!candidate.currentGroup) return "—";
  return buildGroupHeading(
    candidate.currentGroup.title,
    candidate.currentGroup.term,
    [candidate.currentGroup.term],
    lang
  );
}

function formatCandidateTerm(candidate: CandidateResponse, lang: "tr" | "en"): string {
  if (!candidate.currentGroup) return "—";
  return buildTermLabel(candidate.currentGroup.term, [candidate.currentGroup.term], lang);
}

const CANDIDATE_COLUMNS: CandidateColumnDef[] = [
  {
    id: "photo",
    labelKey: "candidates.col.photo",
    headerLabel: "",
    headerClassName: "cand-photo-th",
    cellClassName: "cand-photo-td",
    renderCell: (c) => (
      <CandidateAvatar candidate={c} className="cand-avatar-cell" />
    ),
    skeletonWidth: 36,
  },
  {
    id: "name",
    labelKey: "candidates.col.name",
    sortField: "name",
    renderCell: (c) => (
      <span className="cand-name">
        {c.firstName} {c.lastName}
      </span>
    ),
    skeletonWidth: 140,
  },
  {
    id: "nationalId",
    labelKey: "candidates.col.nationalId",
    sortField: "nationalId",
    renderCell: (c) => <span className="cand-tc">{c.nationalId}</span>,
    skeletonWidth: 96,
  },
  {
    id: "phoneNumber",
    labelKey: "candidates.col.phoneNumber",
    renderCell: (c) => formatOptionalText(c.phoneNumber),
    skeletonWidth: 110,
  },
  {
    id: "email",
    labelKey: "candidates.col.email",
    renderCell: (c) => formatOptionalText(c.email),
    skeletonWidth: 180,
  },
  {
    id: "birthDate",
    labelKey: "candidates.col.birthDate",
    renderCell: (c) => formatDateTR(c.birthDate),
    skeletonWidth: 88,
  },
  {
    id: "gender",
    labelKey: "candidates.col.gender",
    renderCell: (c) => formatOptionalText(candidateGenderLabel(c.gender)),
    skeletonWidth: 72,
  },
  {
    id: "licenseClass",
    labelKey: "candidates.col.licenseClass",
    sortField: "licenseClass",
    renderCell: (c) => c.licenseClass,
    skeletonWidth: 56,
  },
  {
    id: "group",
    labelKey: "candidates.col.group",
    sortField: "groupTitle",
    renderCell: (c) => formatGroupWithTerm(c, "tr"),
    skeletonWidth: 110,
  },
  {
    id: "groupStartDate",
    labelKey: "candidates.col.groupStartDate",
    renderCell: (c) => formatDateTR(c.currentGroup?.startDate),
    skeletonWidth: 88,
  },
  {
    id: "documents",
    labelKey: "candidates.col.documents",
    sortField: "missingDocumentCount",
    renderCell: (c) => (
      <CandidateDocumentBadge
        loadMissingDocumentNames={async () => {
          const result = await getDocumentChecklist({
            status: "missing",
            search: c.nationalId,
            page: 1,
            pageSize: 1,
          });
          return result.items[0]?.missingDocumentNames ?? [];
        }}
        summary={c.documentSummary}
      />
    ),
    skeletonWidth: 48,
  },
  {
    id: "missingDocuments",
    labelKey: "candidates.col.missingDocuments",
    sortField: "missingDocumentCount",
    renderCell: (c) => c.documentSummary?.missingCount ?? 0,
    skeletonWidth: 48,
  },
  {
    id: "mebExamResult",
    labelKey: "candidates.col.mebExamResult",
    renderCell: (c) => (
      <StatusPill
        label={candidateMebExamResultLabel(c.mebExamResult)}
        status={candidateMebExamResultToPill(c.mebExamResult)}
      />
    ),
    skeletonWidth: 72,
  },
  {
    id: "examFeePaid",
    labelKey: "candidates.col.examFeePaid",
    renderCell: (c) => (
      <StatusPill
        label={c.examFeePaid ? "Ödendi" : "Ödenmedi"}
        status={c.examFeePaid ? "success" : "failed"}
      />
    ),
    skeletonWidth: 88,
  },
  {
    id: "balance",
    labelKey: "candidates.col.balance",
    renderCell: () => "—",
    skeletonWidth: 48,
  },
  {
    id: "status",
    labelKey: "candidates.col.status",
    sortField: "status",
    renderCell: (c) => (
      <StatusPill
        label={candidateStatusLabel(c.status)}
        status={candidateStatusToPill(c.status)}
      />
    ),
    skeletonWidth: 64,
  },
  {
    id: "createdAtUtc",
    labelKey: "candidates.col.createdAtUtc",
    sortField: "createdAtUtc",
    renderCell: (c) => formatDateTR(c.createdAtUtc),
    skeletonWidth: 88,
  },
  {
    id: "updatedAtUtc",
    labelKey: "candidates.col.updatedAtUtc",
    renderCell: (c) => formatDateTR(c.updatedAtUtc),
    skeletonWidth: 88,
  },
];

const CANDIDATE_COLUMN_IDS: CandidateColumnId[] = CANDIDATE_COLUMNS.map((col) => col.id);
const DEFAULT_VISIBLE_CANDIDATE_COLUMN_IDS: CandidateColumnId[] = [
  "photo",
  "name",
  "nationalId",
  "group",
  "documents",
  "mebExamResult",
  "examFeePaid",
  "status",
];

type CandidatesPageProps = {
  title?: string;
  columnStorageKey?: string;
  showTabs?: boolean;
  defaultTab?: CandidateTab;
  groupColumnMode?: "group" | "term";
  tabConfig?: {
    tabs: { key: CandidateListTabKey; label: string }[];
    defaultTab: CandidateListTabKey;
    buildParams: (tab: CandidateListTabKey) => Partial<GetCandidatesParams>;
  };
};

export function CandidatesPage({
  title = "Adaylar",
  columnStorageKey = "candidates.columns.v8",
  showTabs = true,
  defaultTab = DEFAULT_TAB,
  groupColumnMode = "group",
  tabConfig,
}: CandidatesPageProps = {}) {
  const t = useT();
  const { lang } = useLanguage();
  const defaultTabs = useMemo(
    () =>
      TAB_KEYS.map((key) => ({
        key,
        label: key === "all" ? "Tümü" : candidateStatusLabel(key),
      })),
    []
  );
  const resolvedTabConfig = useMemo(
    () =>
      tabConfig ?? {
        tabs: defaultTabs,
        defaultTab,
        buildParams: (tab: CandidateListTabKey): Partial<GetCandidatesParams> => ({
          status: tab === "all" ? undefined : tab,
        }),
      },
    [defaultTab, defaultTabs, tabConfig]
  );

  const { isVisible, toggle: toggleColumn } = useColumnVisibility(
    columnStorageKey,
    CANDIDATE_COLUMN_IDS,
    DEFAULT_VISIBLE_CANDIDATE_COLUMN_IDS
  );

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tab, setTab] = useState<CandidateListTabKey>(resolvedTabConfig.defaultTab);
  const [sort, setSort] = useState<SortState>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [bulkSelectEnabled, setBulkSelectEnabled] = useState(false);
  const [bulkActionMode, setBulkActionMode] = useState<BulkActionMode>(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [bulkStatusValue, setBulkStatusValue] = useState<"" | CandidateStatusValue>("");
  const [bulkTagValues, setBulkTagValues] = useState<string[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkExporting, setBulkExporting] = useState(false);
  const [candidates, setCandidates] = useState<CandidateResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [allTags, setAllTags] = useState<CandidateTag[]>([]);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagDraft, setNewTagDraft] = useState("");
  const newTagInputRef = useRef<HTMLInputElement | null>(null);
  const [filters, setFilters] = useState<CandidateFilterState>(
    EMPTY_CANDIDATE_FILTERS
  );
  const [debouncedFilters, setDebouncedFilters] = useState<CandidateFilterState>(
    EMPTY_CANDIDATE_FILTERS
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = countActiveCandidateFilters(filters);
  const lastCompletedFetchKeyRef = useRef<string | null>(null);
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("selected");

  const resolvedColumns = useMemo(
    () =>
      CANDIDATE_COLUMNS.map((col) => {
        if (col.id !== "group") return col;
        return {
          ...col,
          renderCell: (candidate: CandidateResponse) =>
            groupColumnMode === "term"
              ? formatCandidateTerm(candidate, lang)
              : formatGroupWithTerm(candidate, lang),
        };
      }),
    [groupColumnMode, lang]
  );
  const visibleColumns = resolvedColumns.filter((col) => isVisible(col.id));
  const getColumnLabel = (col: CandidateColumnDef) =>
    col.id === "group" && groupColumnMode === "term"
      ? t("candidates.col.term")
      : t(col.labelKey);
  const currentStatusTab = useMemo(() => {
    if (tab === "all") return tab;
    return CANDIDATE_STATUS_VALUES.includes(tab as CandidateStatusValue)
      ? (tab as CandidateStatusValue)
      : null;
  }, [tab]);
  const visibleBulkStatusOptions = useMemo(
    () =>
      currentStatusTab === "all" || currentStatusTab === null
        ? BULK_STATUS_OPTIONS
        : BULK_STATUS_OPTIONS.filter((option) => option.value !== currentStatusTab),
    [currentStatusTab]
  );

  const pickerOptions: ColumnOption[] = resolvedColumns.map((col) => ({
    id: col.id,
    label: getColumnLabel(col),
  }));
  const allVisibleSelected =
    candidates.length > 0 && candidates.every((candidate) => selectedCandidateIds.has(candidate.id));
  const selectedCount = selectedCandidateIds.size;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, TEXT_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [search]);

  // Debounce the full filter object: text inputs (firstName, nationalId, ...)
  // trigger this at every keystroke, so we coalesce them before kicking off a
  // backend fetch. Tri-state selects and date pickers pay the same 300 ms tax
  // but that's imperceptible for discrete controls.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedFilters(filters);
    }, TEXT_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    setTab(resolvedTabConfig.defaultTab);
  }, [resolvedTabConfig.defaultTab]);

  useEffect(() => {
    const controller = new AbortController();
    const requestParams = {
      search: normalizeTextQuery(debouncedSearch),
      ...resolvedTabConfig.buildParams(tab),
      tags: activeTags.length > 0 ? activeTags : undefined,
      ...filtersToQuery(debouncedFilters),
      sortBy: sort?.field,
      sortDir: sort?.direction,
      page,
      pageSize: PAGE_SIZE,
    };
    const fetchKey = JSON.stringify({ ...requestParams, refreshKey });
    if (lastCompletedFetchKeyRef.current === fetchKey) {
      return;
    }

    setLoading(true);

    getCandidates(
      requestParams,
      controller.signal
    )
      .then((result) => {
        lastCompletedFetchKeyRef.current = fetchKey;
        setCandidates(result.items);
        setTotalPages(result.totalPages);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        showToast("Adaylar yüklenemedi", "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [activeTags, debouncedFilters, debouncedSearch, page, refreshKey, resolvedTabConfig, showToast, sort, tab]);

  // Load the full tag catalog for the filter bar. Refetched on refreshKey
  // bumps so newly created tags surface after create/edit flows.
  useEffect(() => {
    const controller = new AbortController();
    searchCandidateTags("", 200, controller.signal)
      .then((result) => setAllTags(result))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setAllTags([]);
      });
    return () => controller.abort();
  }, [refreshKey]);

  // If any of the active filter tags disappear (deleted or renamed elsewhere),
  // drop them so the candidate list is not stuck filtered-to-nothing.
  useEffect(() => {
    if (activeTags.length === 0) return;
    const known = new Set(allTags.map((tag) => tag.name));
    const filtered = activeTags.filter((name) => known.has(name));
    if (filtered.length !== activeTags.length) {
      setActiveTags(filtered);
    }
  }, [activeTags, allTags]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleTabChange = (value: CandidateListTabKey) => {
    setTab(value);
    setPage(1);
  };

  const handleTagFilterToggle = (name: string) => {
    setPage(1);
    setActiveTags((current) =>
      current.includes(name)
        ? current.filter((value) => value !== name)
        : [...current, name]
    );
  };

  const handleFilterChange = <K extends keyof CandidateFilterState>(
    key: K,
    value: CandidateFilterState[K]
  ) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const clearAllFilters = () => {
    setPage(1);
    setFilters(EMPTY_CANDIDATE_FILTERS);
    setDebouncedFilters(EMPTY_CANDIDATE_FILTERS);
    setActiveTags([]);
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

  useEffect(() => {
    if (
      bulkStatusValue &&
      !visibleBulkStatusOptions.some((option) => option.value === bulkStatusValue)
    ) {
      setBulkStatusValue("");
    }
  }, [bulkStatusValue, visibleBulkStatusOptions]);

  /**
   * Cycle the sort state for a clicked header:
   *   unsorted -> asc -> desc -> unsorted
   * Always resets pagination to page 1 so the first row of the newly sorted
   * result set is visible.
   */
  const handleSortToggle = (field: CandidateSortField) => {
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

  const openDrawer = (id: string) => setSearchParams({ selected: id });
  const closeDrawer = () => setSearchParams({});

  const handleSubmitNew = () => {
    setModalOpen(false);
    setPage(1);
    setRefreshKey((k) => k + 1);
  };

  const exportCandidatesToCsv = (rowsToExport: CandidateResponse[]) => {
    const groupColumnHeader =
      groupColumnMode === "term" ? t("candidates.col.term") : t("candidates.col.group");
    const rows = rowsToExport.map((candidate) => ({
      "Ad Soyad": `${candidate.firstName} ${candidate.lastName}`.trim(),
      "TC Kimlik": candidate.nationalId,
      Telefon: formatOptionalText(candidate.phoneNumber),
      "E-posta": formatOptionalText(candidate.email),
      "Doğum Tarihi": formatDateTR(candidate.birthDate),
      Cinsiyet: formatOptionalText(candidateGenderLabel(candidate.gender)),
      "Ehliyet Tipi": candidate.licenseClass,
      [groupColumnHeader]:
        groupColumnMode === "term"
          ? formatCandidateTerm(candidate, lang)
          : formatGroupWithTerm(candidate, lang),
      "Tamamlanan Evrak": candidate.documentSummary?.completedCount ?? 0,
      "Eksik Evrak": candidate.documentSummary?.missingCount ?? 0,
      "MEB Durumu": candidateMebExamResultLabel(candidate.mebExamResult),
      "Sınav Ücreti": candidate.examFeePaid ? "Ödendi" : "Ödenmedi",
      Durum: candidateStatusLabel(candidate.status),
      "Kayıt Tarihi": formatDateTR(candidate.createdAtUtc),
    }));

    const headers = [
      "Ad Soyad",
      "TC Kimlik",
      "Telefon",
      "E-posta",
      "Doğum Tarihi",
      "Cinsiyet",
      "Ehliyet Tipi",
      groupColumnHeader,
      "Tamamlanan Evrak",
      "Eksik Evrak",
      "MEB Durumu",
      "Sınav Ücreti",
      "Durum",
      "Kayıt Tarihi",
    ] as const;

    const escapeCsvValue = (value: string | number) => {
      const text = String(value);
      if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
        return `"${text.replace(/"/g, "\"\"")}"`;
      }
      return text;
    };

    const csvLines = [
      headers.join(","),
      ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(",")),
    ];

    const blob = new Blob(["\uFEFF" + csvLines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `adaylar-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const downloadSelectedCandidatesCsv = async () => {
    if (selectedCandidateIds.size === 0) {
      return;
    }

    setBulkExporting(true);

    try {
      const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
      const selectedIds = Array.from(selectedCandidateIds);
      const selectedCandidates = await Promise.all(
        selectedIds.map(
          async (candidateId) => candidateById.get(candidateId) ?? (await getCandidateById(candidateId))
        )
      );

      exportCandidatesToCsv(selectedCandidates);
      setBulkActionMode(null);
    } catch {
      showToast("Seçili adaylar dışa aktarılamadı", "error");
    } finally {
      setBulkExporting(false);
    }
  };

  const toggleBulkSelection = () => {
    setBulkSelectEnabled((current) => {
      const next = !current;
      if (next) {
        // Filtreler toggle butonu bulk modunda toolbardan kayboluyor; açık
        // kalmış paneli beraber kapatıp orphan state'i engelliyoruz.
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
        for (const candidate of candidates) {
          next.delete(candidate.id);
        }
      } else {
        for (const candidate of candidates) {
          next.add(candidate.id);
        }
      }
      return next;
    });
  };

  const openBulkStatusAction = () => {
    if (selectedCandidateIds.size === 0) {
      showToast("Önce en az bir aday seç", "error");
      return;
    }
    setBulkActionMode("status");
  };

  const openBulkTagAction = () => {
    if (selectedCandidateIds.size === 0) {
      showToast("Önce en az bir aday seç", "error");
      return;
    }
    setBulkActionMode("tags");
  };

  const openBulkExportAction = () => {
    if (selectedCandidateIds.size === 0) {
      showToast("Önce en az bir aday seç", "error");
      return;
    }
    setBulkActionMode("export");
  };

  const applyBulkStatusChange = async () => {
    if (!bulkStatusValue || selectedCandidateIds.size === 0) {
      return;
    }

    setBulkSaving(true);

    try {
      const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
      const selectedIds = Array.from(selectedCandidateIds);

      await applyStatusToCandidates(selectedIds, bulkStatusValue, candidateById);

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
    if (bulkTagValues.length === 0 || selectedCandidateIds.size === 0) {
      return;
    }

    setBulkSaving(true);

    try {
      const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
      const selectedIds = Array.from(selectedCandidateIds);

      await applyTagsToCandidates(selectedIds, bulkTagValues, candidateById);

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
              ) : bulkActionMode === "export" ? (
                <button
                  className="btn btn-primary btn-sm"
                  disabled={selectedCount === 0 || bulkExporting}
                  onClick={downloadSelectedCandidatesCsv}
                  type="button"
                >
                  {bulkExporting ? "İndiriliyor..." : "CSV İndir"}
                </button>
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
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={openBulkExportAction}
                    type="button"
                  >
                    <DownloadIcon size={14} />
                    Dışa Aktar
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
                  aria-controls="cand-filters-panel"
                  aria-label={t("candidates.filters.button")}
                  checked={filtersOpen}
                  onChange={(event) => setFiltersOpen(event.target.checked)}
                  type="checkbox"
                />
                <span className="switch-toggle-control" aria-hidden="true" />
                <span>{t("candidates.filters.button")}</span>
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
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setModalOpen(true)}
                type="button"
              >
                <PlusIcon size={14} />
                Yeni Aday
              </button>
            </>
          )
        }
        title={title}
      />

      <div className={showTabs ? "tabs-search-row" : "tabs-search-row no-tabs"}>
        {showTabs && <PageTabs active={tab} onChange={handleTabChange} tabs={resolvedTabConfig.tabs} />}
        <div className="search-box">
          <SearchInput
            onChange={handleSearchChange}
            placeholder="Aday ara... (ad, soyad, TC)"
            value={search}
          />
        </div>
      </div>

      <CandidateFilterPanel
        activeFilterCount={activeFilterCount}
        filters={filters}
        hasAnyActiveFilter={activeFilterCount > 0 || activeTags.length > 0}
        onChange={handleFilterChange}
        onClearAll={clearAllFilters}
        onClose={() => setFiltersOpen(false)}
        open={filtersOpen}
      />


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

      <div className="table-wrap spaced">
        <table className="data-table cand-table">
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
              {visibleColumns.map((col) =>
                col.sortField ? (
                <SortableTh
                  className={col.headerClassName}
                  key={col.id}
                  field={col.sortField}
                  label={getColumnLabel(col)}
                  onToggle={handleSortToggle}
                  sort={sort}
                />
                ) : (
                  <th
                    aria-label={getColumnLabel(col)}
                    className={col.headerClassName}
                    key={col.id}
                  >
                    {col.headerLabel ?? getColumnLabel(col)}
                  </th>
                )
              )}
              <th className="col-picker-th">
                <ColumnPicker
                  columns={pickerOptions}
                  isVisible={isVisible}
                  onToggle={toggleColumn}
                  triggerTitle={t("candidates.columns.button")}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <>
                {Array.from({ length: PAGE_SIZE }, (_, i) => (
                  <tr key={i} style={{ pointerEvents: "none" }}>
                    {bulkSelectEnabled && <td className="cand-select-td" />}
                    {visibleColumns.map((col) => (
                      <td className={col.cellClassName} key={col.id}>
                        <span
                          className="skeleton"
                          style={{ width: `${col.skeletonWidth + (i * 11) % 24}px` }}
                        />
                      </td>
                    ))}
                    <td className="col-picker-td" />
                  </tr>
                ))}
              </>
            ) : candidates.length === 0 ? (
              <tr>
                <td
                  className="data-table-empty"
                  colSpan={visibleColumns.length + 1 + (bulkSelectEnabled ? 1 : 0)}
                >
                  Eşleşen aday bulunamadı.
                </td>
              </tr>
            ) : (
              candidates.map((c) => (
                <tr key={c.id} onClick={() => openDrawer(c.id)}>
                  {bulkSelectEnabled && (
                    <td
                      className="cand-select-td"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <span className="cand-select-control">
                        <input
                          aria-label={`${c.firstName} ${c.lastName} seç`}
                          checked={selectedCandidateIds.has(c.id)}
                          onChange={() => toggleCandidateSelection(c.id)}
                          onClick={(event) => event.stopPropagation()}
                          type="checkbox"
                        />
                      </span>
                    </td>
                  )}
                  {visibleColumns.map((col) => (
                    <td className={col.cellClassName} key={col.id}>
                      {col.renderCell(c)}
                    </td>
                  ))}
                  <td className="col-picker-td" />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination disabled={loading} onChange={setPage} page={page} totalPages={totalPages} />

      <CandidateDrawer
        candidateId={selectedId}
        onClose={closeDrawer}
        onDeleted={() => {
          closeDrawer();
          setRefreshKey((k) => k + 1);
        }}
        onUpdated={() => setRefreshKey((k) => k + 1)}
      />

      <NewCandidateModal
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmitNew}
        open={modalOpen}
      />
      <CandidateTagManagerModal
        onClose={() => setTagManagerOpen(false)}
        onDeleted={handleTagDeleted}
        onRenamed={handleTagRenamed}
        open={tagManagerOpen}
        tags={allTags}
      />
    </>
  );
}

type SortableThProps = {
  field: CandidateSortField;
  label: string;
  sort: SortState;
  onToggle: (field: CandidateSortField) => void;
  className?: string;
};

function SortableTh({ field, label, sort, onToggle, className }: SortableThProps) {
  const isActive = sort?.field === field;
  const direction = isActive ? sort!.direction : null;
  const indicator = direction === "asc" ? "▲" : direction === "desc" ? "▼" : "↕";
  const ariaSort: React.AriaAttributes["aria-sort"] = isActive
    ? direction === "asc"
      ? "ascending"
      : "descending"
    : "none";
  const thClassName = [isActive ? "sortable-th active" : "sortable-th", className]
    .filter(Boolean)
    .join(" ");
  return (
    <th aria-sort={ariaSort} className={thClassName}>
      <button
        className="sortable-th-btn"
        onClick={() => onToggle(field)}
        type="button"
      >
        <span>{label}</span>
        <span className="sortable-th-indicator" aria-hidden="true">
          {indicator}
        </span>
      </button>
    </th>
  );
}
