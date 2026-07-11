import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { CandidateFilterPanel } from "../components/candidates/CandidateFilterPanel";
import { CheckIcon, DownloadIcon, XIcon } from "../components/icons";
import { PageTabs, PageToolbar } from "../components/layout/PageToolbar";
import { CandidateTagManagerModal } from "../components/modals/CandidateTagManagerModal";
import { ManageDocumentModal } from "../components/modals/ManageDocumentModal";
import { UploadDocumentModal } from "../components/modals/UploadDocumentModal";
import { CandidateAvatar } from "../components/ui/CandidateAvatar";
import { CandidateTagsInput, tagColorIndex } from "../components/ui/CandidateTagsInput";
import { ColumnPicker, type ColumnOption } from "../components/ui/ColumnPicker";
import { CustomSelect } from "../components/ui/CustomSelect";
import { Pagination } from "../components/ui/Pagination";
import { SearchInput } from "../components/ui/SearchInput";
import { CheckboxListPopover } from "../components/ui/CheckboxListPopover";
import { TableHeaderFilter } from "../components/ui/TableHeaderFilter";
import { useToast } from "../components/ui/Toast";
import { applyStatusToCandidates, applyTagsToCandidates } from "../lib/candidate-bulk";
import { useAuth } from "../lib/auth";
import {
  EMPTY_CANDIDATE_FILTERS,
  countActiveCandidateFilters,
  filtersToQuery,
  type CandidateFilterState,
} from "../lib/candidate-filters";
import {
  assignCandidateGroup,
  createCandidateTag,
} from "../lib/candidates-api";
import { getDocumentChecklist, getDocumentChecklistByCandidateIds, getDocumentTypes } from "../lib/documents-api";
import { isAbortError } from "../lib/http";
import { useLanguage, useT } from "../lib/i18n";
import { canManageArea } from "../lib/permissions";
import { candidateKeys, useCandidateTags } from "../lib/queries/use-candidates";
import { groupKeys, useGroups } from "../lib/queries/use-groups";
import { formatLocalDateOnly } from "../lib/date-only";
import { buildWhatsAppUrl, formatPhoneDisplay } from "../lib/phone";
import { normalizeSearchComparable, normalizeTextQuery } from "../lib/search";
import { buildGroupHeading } from "../lib/term-label";
import {
  CANDIDATE_STATUS_OPTIONS,
  type CandidateStatusValue,
} from "../lib/status-maps";
import {
  mergeLicenseClassOptionsWithValues,
  useLicenseClassOptions,
} from "../lib/use-license-class-options";
import type {
  CandidateTag,
  DocumentChecklistEntry,
  DocumentTypeResponse,
  GroupResponse,
} from "../lib/types";

type Filters = {
  search: string;
};

const INITIAL_FILTERS: Filters = {
  search: "",
};

const DEFAULT_PAGE_SIZE = 100;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const TEXT_DEBOUNCE_MS = 300;

type DocumentSortField = "name" | "licenseClass" | "term";
type SortDirection = "asc" | "desc";
type SortState = { field: DocumentSortField; direction: SortDirection } | null;

type DocumentsTab = "all" | "missing" | "complete";
const DEFAULT_TAB: DocumentsTab = "all";

type BulkActionMode = "status" | "tags" | "export" | "group" | null;

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
  const phoneNumber = formatPhoneDisplay(entry.phoneNumber);
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

function renderDocumentTerm(entry: DocumentChecklistEntry, lang: "tr" | "en") {
  return entry.currentGroup
    ? buildGroupHeading(entry.currentGroup.title, entry.currentGroup.term, [entry.currentGroup.term], lang)
    : "-";
}

const DOCUMENT_COLUMN_LABELS_BY_KEY: Record<string, string> = {
  application_form: "Mrct.",
  biometric_photo: "Biyo",
  contract_back: "Söz. A.",
  contract_front: "Söz. Ö.",
  criminal_record: "Adli",
  education_certificate: "Öğr.",
  existing_license_copy: "Mvct",
  health_report: "Sğlk",
  identity_card: "Kmlk",
  national_id: "Kmlk",
  signature_sample: "İmza",
  webcam_photo: "Wbcm",
};

const DOCUMENT_COLUMN_LABELS_BY_NORMALIZED_NAME: Record<string, string> = {
  adli_sicil_kaydi: "Adli",
  biyometrik_fotograf: "Biyo",
  kimlik_fotokopisi: "Kmlk",
  mevcut_ehliyet_fotokopisi: "Mvct",
  muracaat_formu: "Mrct.",
  nufus_cuzdani: "Kmlk",
  ogrenci_belgesi: "Öğr.",
  ogrenim_belgesi: "Öğr.",
  saglik_raporu: "Sğlk",
  sozlesme_arka_yuz: "Söz. A.",
  sozlesme_on_yuz: "Söz. Ö.",
  imza_ornegi: "İmza",
  webcam_fotografi: "Wbcm",
};

function formatDocumentColumnLabel(documentType: DocumentTypeResponse): string {
  const keyLabel = DOCUMENT_COLUMN_LABELS_BY_KEY[documentType.key];
  if (keyLabel) return keyLabel;

  return DOCUMENT_COLUMN_LABELS_BY_NORMALIZED_NAME[normalizeDocumentTypeName(documentType.name)] ?? documentType.name;
}

function normalizeDocumentTypeName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function DocumentsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();
  const { lang } = useLanguage();
  const { showToast } = useToast();
  const { user, permissions } = useAuth();
  const canManageDocuments = canManageArea(user, permissions, "documents");
  const canManageMebJobs = canManageArea(user, permissions, "mebjobs");
  const canManageCandidates = canManageArea(user, permissions, "candidates");
  const canManageGroups = canManageArea(user, permissions, "groups");
  const noPermissionTitle = t("common.noPermission");
  const { options: licenseClassOptions } = useLicenseClassOptions();
  const queryClient = useQueryClient();

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
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [allTags, setAllTags] = useState<CandidateTag[]>([]);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagDraft, setNewTagDraft] = useState("");
  const newTagInputRef = useRef<HTMLInputElement | null>(null);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);

  const [uploadTarget, setUploadTarget] = useState<UploadTarget>(null);
  const [manageTarget, setManageTarget] = useState<ManageTarget>(null);

  const detailReturnState = useMemo(
    () => ({
      returnLabel: "← Evrak kontrol sayfasına dön",
      returnTo: `${location.pathname}${location.search}`,
    }),
    [location.pathname, location.search]
  );

  const [bulkActionMode, setBulkActionMode] = useState<BulkActionMode>(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [bulkStatusValue, setBulkStatusValue] = useState<"" | CandidateStatusValue>("");
  const [bulkTagValues, setBulkTagValues] = useState<string[]>([]);
  const [bulkGroupId, setBulkGroupId] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkExporting, setBulkExporting] = useState(false);
  const [hiddenDocumentColumnIds, setHiddenDocumentColumnIds] = useState<Set<string>>(new Set());

  // --- React Query: document types ---
  const { data: documentTypes = [] } = useQuery<DocumentTypeResponse[]>({
    queryKey: ["documents", "types"],
    queryFn: ({ signal }) =>
      getDocumentTypes(undefined, signal).catch((err) => {
        if (isAbortError(err)) {
          throw err;
        }
        showToast(t("uploadDoc.errors.typesLoadFailed"), "error");
        throw err;
      }),
  });

  // --- React Query: groups for bulk actions and Dönem filter ---
  const { data: bulkGroupsData, isLoading: bulkGroupLoading } = useGroups({ pageSize: 200 }, true);
  const bulkGroupOptions: GroupResponse[] = bulkGroupsData?.items ?? [];

  // --- React Query: candidate tags for filter chips ---
  const { data: tagsData } = useCandidateTags("", 200, true);

  // Sync fetched tags into local state so mutations (create/rename/delete) can
  // update the list without a full refetch.
  useEffect(() => {
    if (tagsData) setAllTags(tagsData);
  }, [tagsData]);

  const invalidateDocumentChecklist = () => {
    void queryClient.invalidateQueries({ queryKey: ["documents", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["documents", "tabCount"] });
  };

  const invalidateCandidateAndGroupData = () => {
    void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
    void queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: groupKeys.details() });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

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

  // --- React Query: document checklist (main list) ---
  const candidateFilterQuery = filtersToQuery(debouncedCandidateFilters);
  const checklistParams = {
    search: normalizeTextQuery(debouncedSearch),
    tags: activeTags.length > 0 ? activeTags : undefined,
    ...candidateFilterQuery,
    candidateStatus: "pre_registered" as const,
    hasMissingDocuments:
      tab === "missing" ? true : tab === "complete" ? false : candidateFilterQuery.hasMissingDocuments,
    page,
    pageSize,
  };

  const {
    data: checklistData,
    isFetching: loading,
  } = useQuery({
    queryKey: ["documents", "list", checklistParams],
    queryFn: ({ signal }) =>
      getDocumentChecklist(checklistParams, signal).catch((err) => {
        if (isAbortError(err)) {
          throw err;
        }
        showToast(t("documents.loadFailed"), "error");
        throw err;
      }),
  });

  const entries: DocumentChecklistEntry[] = checklistData?.items ?? [];
  const totalPages = checklistData?.totalPages ?? 1;
  const filterLicenseClassOptions = useMemo(
    () =>
      mergeLicenseClassOptionsWithValues(licenseClassOptions, [
        ...candidateFilters.licenseClasses,
        ...entries.map((entry) => entry.licenseClass),
      ]),
    [candidateFilters.licenseClasses, entries, licenseClassOptions]
  );

  // --- React Query: tab counts ---
  const { hasMissingDocuments: _ignored, ...baseCandidateFilterQuery } = candidateFilterQuery;
  const baseCountParams = {
    search: normalizeTextQuery(debouncedSearch),
    tags: activeTags.length > 0 ? activeTags : undefined,
    ...baseCandidateFilterQuery,
    candidateStatus: "pre_registered" as const,
    page: 1,
    pageSize: 1,
  };

  const { data: tabCountAll } = useQuery({
    queryKey: ["documents", "tabCount", "all", baseCountParams],
    queryFn: ({ signal }) => getDocumentChecklist(baseCountParams, signal),
  });
  const { data: tabCountMissing } = useQuery({
    queryKey: ["documents", "tabCount", "missing", baseCountParams],
    queryFn: ({ signal }) =>
      getDocumentChecklist({ ...baseCountParams, hasMissingDocuments: true }, signal),
  });
  const { data: tabCountComplete } = useQuery({
    queryKey: ["documents", "tabCount", "complete", baseCountParams],
    queryFn: ({ signal }) =>
      getDocumentChecklist({ ...baseCountParams, hasMissingDocuments: false }, signal),
  });
  const tabCounts = {
    all: tabCountAll?.totalCount ?? 0,
    missing: tabCountMissing?.totalCount ?? 0,
    complete: tabCountComplete?.totalCount ?? 0,
  };

  const selectedCount = selectedCandidateIds.size;
  const allVisibleSelected =
    entries.length > 0 && entries.every((entry) => selectedCandidateIds.has(entry.candidateId));

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
    if (!canManageCandidates) return;
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
    if (!canManageCandidates) return;
    const name = newTagDraft.trim();
    if (!name) {
      closeAddTagInput();
      return;
    }

    const normalized = normalizeSearchComparable(name);
    const existing = allTags.find(
      (tag) => normalizeSearchComparable(tag.name) === normalized
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
      void queryClient.invalidateQueries({ queryKey: [...candidateKeys.all, "tags"] });
    } catch {
      showToast(t("documentsPage.toast.tagCreateFailed"), "error");
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
    invalidateDocumentChecklist();
    invalidateCandidateAndGroupData();
    void queryClient.invalidateQueries({ queryKey: [...candidateKeys.all, "tags"] });
  };

  const handleTagDeleted = (tag: CandidateTag) => {
    removeTagFromCatalog(tag.id);
    setActiveTags((current) => current.filter((name) => name !== tag.name));
    invalidateDocumentChecklist();
    invalidateCandidateAndGroupData();
    void queryClient.invalidateQueries({ queryKey: [...candidateKeys.all, "tags"] });
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

  const openBulkTagAction = () => {
    if (!canManageCandidates) return;
    if (selectedCount === 0) {
      showToast(t("candidates.toast.selectAtLeastOne"), "error");
      return;
    }
    setBulkActionMode("tags");
  };

  const openBulkStatusAction = () => {
    if (!canManageCandidates) return;
    if (selectedCount === 0) {
      showToast(t("candidates.toast.selectAtLeastOne"), "error");
      return;
    }

    setBulkActionMode("status");
  };

  const openBulkExportAction = () => {
    if (selectedCount === 0) {
      showToast(t("candidates.toast.selectAtLeastOne"), "error");
      return;
    }

    setBulkActionMode("export");
  };

  const openBulkGroupAction = () => {
    if (!canManageGroups) return;
    if (selectedCount === 0) {
      showToast(t("candidates.toast.selectAtLeastOne"), "error");
      return;
    }

    setBulkActionMode("group");
    setBulkGroupId("");
  };

  const cancelBulkAction = () => {
    setBulkActionMode(null);
    setBulkStatusValue("");
    setBulkTagValues([]);
    setBulkGroupId("");
  };

  const applyBulkStatusChange = async () => {
    if (!canManageCandidates) return;
    if (!bulkStatusValue || selectedCount === 0) return;
    setBulkSaving(true);
    try {
      const selectedIds = Array.from(selectedCandidateIds);
      await applyStatusToCandidates(selectedIds, bulkStatusValue);
      showToast(`${selectedIds.length} aday güncellendi`);
      setBulkActionMode(null);
      setSelectedCandidateIds(new Set());
      setBulkStatusValue("");
      invalidateDocumentChecklist();
      invalidateCandidateAndGroupData();
    } catch {
      showToast(t("candidates.toast.bulkStatusFailed"), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const applyBulkTagChange = async () => {
    if (!canManageCandidates) return;
    if (bulkTagValues.length === 0 || selectedCount === 0) return;
    setBulkSaving(true);
    try {
      const selectedIds = Array.from(selectedCandidateIds);
      await applyTagsToCandidates(selectedIds, bulkTagValues);
      showToast(`${selectedIds.length} adaya etiket eklendi`);
      setBulkActionMode(null);
      setSelectedCandidateIds(new Set());
      setBulkTagValues([]);
      invalidateDocumentChecklist();
      invalidateCandidateAndGroupData();
      void queryClient.invalidateQueries({ queryKey: [...candidateKeys.all, "tags"] });
    } catch {
      showToast(t("candidates.toast.bulkTagFailed"), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const exportDocumentRowsToCsv = (rowsToExport: DocumentChecklistEntry[]) => {
    const headers = [
      t("documents.col.candidate"),
      t("candidates.col.phoneNumber"),
      "Ehliyet Tipi",
      t("documentsPage.col.term"),
      t("documentsPage.col.advancePayment"),
      t("candidates.csv.completedDocuments"),
      t("candidates.col.missingDocuments"),
      "Eksik Evraklar",
    ] as const;

    const rows = rowsToExport.map((entry): readonly (string | number)[] => [
      entry.fullName,
      formatPhoneDisplay(entry.phoneNumber, ""),
      entry.licenseClass,
      renderDocumentTerm(entry, lang),
      entry.hasAdvancePayment ? "Var" : "Yok",
      entry.summary.completedCount,
      entry.summary.missingCount,
      entry.missingDocumentNames.join("; "),
    ]);

    const escapeCsvValue = (value: string | number) => {
      const text = String(value);
      if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
        return `"${text.replace(/"/g, "\"\"")}"`;
      }
      return text;
    };

    const csvLines = [
      headers.join(","),
      ...rows.map((row) => row.map((value) => escapeCsvValue(value)).join(",")),
    ];
    const blob = new Blob(["\uFEFF" + csvLines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `evrak-kontrol-${formatLocalDateOnly(new Date())}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const downloadSelectedDocumentsCsv = async () => {
    if (selectedCount === 0) return;
    setBulkExporting(true);
    try {
      const selectedIds = Array.from(selectedCandidateIds);
      const rows = await getDocumentChecklistByCandidateIds(selectedIds);
      exportDocumentRowsToCsv(rows);
      setBulkActionMode(null);
    } catch {
      showToast(t("candidates.toast.bulkExportFailed"), "error");
    } finally {
      setBulkExporting(false);
    }
  };

  const applyBulkGroupChange = async () => {
    if (!canManageGroups) return;
    if (!bulkGroupId || selectedCount === 0) return;
    setBulkSaving(true);
    try {
      const selectedIds = Array.from(selectedCandidateIds);
      await Promise.all(
        selectedIds.map((candidateId) => assignCandidateGroup(candidateId, bulkGroupId))
      );
      showToast(`${selectedIds.length} aday gruba aktarıldı`);
      setBulkActionMode(null);
      setSelectedCandidateIds(new Set());
      setBulkGroupId("");
      invalidateDocumentChecklist();
      invalidateCandidateAndGroupData();
    } catch {
      showToast(t("candidates.toast.bulkGroupFailed"), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const openUpload = (entry?: DocumentChecklistEntry, documentTypeId?: string) => {
    if (!canManageDocuments) return;
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

  const openCandidateAccounting = (candidateId: string) => {
    navigate(`/candidates/${candidateId}?tab=payments`, { state: detailReturnState });
  };

  const openCandidateDetail = (candidateId: string) => {
    navigate(`/candidates/${candidateId}?tab=documents`, { state: detailReturnState });
  };

  const handleUploaded = () => {
    setUploadTarget(null);
    showToast(t("documents.uploaded"));
    invalidateDocumentChecklist();
    invalidateCandidateAndGroupData();
  };

  const handleDocumentSaved = () => {
    setManageTarget(null);
    showToast(t("documents.manage.saved"));
    invalidateDocumentChecklist();
    invalidateCandidateAndGroupData();
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
  const visibleRequiredDocumentTypes = requiredDocumentTypes.filter(
    (documentType) => !hiddenDocumentColumnIds.has(documentType.id)
  );
  const documentColumnOptions: ColumnOption[] = [
    { id: "candidate", label: t("documents.col.candidate"), locked: true },
    { id: "licenseClass", label: "Ehlyt", locked: true },
    { id: "term", label: t("documentsPage.col.term"), locked: true },
    { id: "advancePayment", label: t("documentsPage.col.advancePayment"), locked: true },
    ...requiredDocumentTypes.map((documentType) => ({
      id: documentType.id,
      label: documentType.name,
    })),
    { id: "summary", label: t("documents.col.summary"), locked: true },
  ];
  const isDocumentColumnVisible = (id: string) =>
    id === "candidate" ||
    id === "licenseClass" ||
    id === "term" ||
    id === "advancePayment" ||
    id === "summary" ||
    !hiddenDocumentColumnIds.has(id);
  const toggleDocumentColumn = (id: string) => {
    if (
      id === "candidate" ||
      id === "licenseClass" ||
      id === "term" ||
      id === "advancePayment" ||
      id === "summary"
    ) return;
    setHiddenDocumentColumnIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (requiredDocumentTypes.length - next.size <= 1) return current;
      next.add(id);
      return next;
    });
  };
  const sortedEntries = [...entries].sort((left, right) => {
    if (!sort) {
      return 0;
    }

    const multiplier = sort.direction === "asc" ? 1 : -1;
    if (sort.field === "licenseClass") {
      return left.licenseClass.localeCompare(right.licenseClass, "tr", { sensitivity: "base" }) * multiplier;
    }
    if (sort.field === "term") {
      return renderDocumentTerm(left, lang).localeCompare(renderDocumentTerm(right, lang), "tr", {
        sensitivity: "base",
      }) * multiplier;
    }
    return left.fullName.localeCompare(right.fullName, "tr", { sensitivity: "base" }) * multiplier;
  });
  const tabs: { key: DocumentsTab; label: string }[] = [
    { key: "all", label: t("documentsPage.tab.allWithCount", { count: tabCounts.all }) },
    { key: "missing", label: `Eksik Evrak (${tabCounts.missing})` },
    { key: "complete", label: `Tam Evrak (${tabCounts.complete})` },
  ];

  return (
    <div className="documents-page">
      <PageToolbar
        actions={
          <>
            <div className="candidate-bulk-toolbar">
              {selectedCount > 0 ? (
                <span className="candidate-bulk-count">{t("documentsPage.selectedCount", { count: selectedCount })}</span>
              ) : null}
              {bulkActionMode === "status" ? (
                <>
                  <CustomSelect
                    aria-label={t("candidates.aria.bulkStatusSelect")}
                    disabled={!canManageCandidates}
                    onChange={(event) =>
                      setBulkStatusValue(event.target.value as "" | CandidateStatusValue)
                    }
                    size="sm"
                    title={!canManageCandidates ? noPermissionTitle : undefined}
                    value={bulkStatusValue}
                  >
                    <option value="">{t("candidates.bulk.statusPlaceholder")}</option>
                    {CANDIDATE_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </CustomSelect>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={!canManageCandidates || selectedCount === 0 || !bulkStatusValue || bulkSaving}
                    onClick={applyBulkStatusChange}
                    title={!canManageCandidates ? noPermissionTitle : undefined}
                    type="button"
                  >
                    {bulkSaving ? t("candidates.bulk.applying") : t("candidates.bulk.apply")}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={bulkSaving}
                    onClick={cancelBulkAction}
                    type="button"
                  >
                    {t("candidates.bulk.cancel")}
                  </button>
                </>
              ) : bulkActionMode === "tags" ? (
                <>
                  <CandidateTagsInput
                    ariaLabel={t("candidates.aria.bulkTagSelect")}
                    className="candidate-bulk-tags-input"
                    disabled={!canManageCandidates}
                    disabledTitle={noPermissionTitle}
                    onChange={setBulkTagValues}
                    placeholder={t("candidates.bulk.tagSearchPlaceholder")}
                    value={bulkTagValues}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={!canManageCandidates || selectedCount === 0 || bulkTagValues.length === 0 || bulkSaving}
                    onClick={applyBulkTagChange}
                    title={!canManageCandidates ? noPermissionTitle : undefined}
                    type="button"
                  >
                    {bulkSaving ? t("candidates.bulk.adding") : t("candidates.bulk.apply")}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={bulkSaving}
                    onClick={cancelBulkAction}
                    type="button"
                  >
                    {t("candidates.bulk.cancel")}
                  </button>
                </>
              ) : bulkActionMode === "export" ? (
                <>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={selectedCount === 0 || bulkExporting}
                    onClick={downloadSelectedDocumentsCsv}
                    type="button"
                  >
                    {bulkExporting ? t("candidates.bulk.exporting") : t("candidates.bulk.exportCsv")}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={bulkExporting}
                    onClick={cancelBulkAction}
                    type="button"
                  >
                    {t("candidates.bulk.close")}
                  </button>
                </>
              ) : bulkActionMode === "group" ? (
                <>
                  <CustomSelect
                    aria-label={t("candidates.aria.bulkGroupSelect")}
                    disabled={bulkGroupLoading || !canManageGroups}
                    onChange={(event) => setBulkGroupId(event.target.value)}
                    size="sm"
                    title={!canManageGroups ? noPermissionTitle : undefined}
                    value={bulkGroupId}
                  >
                    <option value="">
                      {bulkGroupLoading
                        ? t("candidates.bulk.loadingGroups")
                        : t("candidates.bulk.groupPlaceholder")}
                    </option>
                    {bulkGroupOptions.map((group) => (
                      <option key={group.id} value={group.id}>
                        {buildGroupHeading(group.title, group.term, [group.term], lang)}
                      </option>
                    ))}
                  </CustomSelect>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={!canManageGroups || selectedCount === 0 || !bulkGroupId || bulkSaving}
                    onClick={applyBulkGroupChange}
                    title={!canManageGroups ? noPermissionTitle : undefined}
                    type="button"
                  >
                    {bulkSaving ? t("candidates.bulk.assigning") : t("candidates.bulk.apply")}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={bulkSaving}
                    onClick={cancelBulkAction}
                    type="button"
                  >
                    {t("candidates.bulk.cancel")}
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={!canManageGroups}
                    onClick={openBulkGroupAction}
                    title={!canManageGroups ? noPermissionTitle : undefined}
                    type="button"
                  >
                    {t("candidates.bulk.assignGroup")}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={!canManageCandidates}
                    onClick={openBulkStatusAction}
                    title={!canManageCandidates ? noPermissionTitle : undefined}
                    type="button"
                  >
                    {t("candidates.bulk.changeStatus")}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={!canManageCandidates}
                    onClick={openBulkTagAction}
                    title={!canManageCandidates ? noPermissionTitle : undefined}
                    type="button"
                  >
                    {t("candidates.bulk.addTag")}
                  </button>
                  <button
                    aria-controls="documents-filters-panel"
                    aria-expanded={filtersOpen}
                    className={filtersOpen ? "btn btn-secondary btn-sm active cand-filters-button" : "btn btn-secondary btn-sm cand-filters-button"}
                    onClick={() => setFiltersOpen((current) => !current)}
                    type="button"
                  >
                    <span>Filtreler</span>
                    {activeFilterCount > 0 && !filtersOpen && (
                      <span className="cand-filters-badge">{activeFilterCount}</span>
                    )}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={openBulkExportAction}
                    type="button"
                  >
                    <DownloadIcon size={14} />
                    {t("candidates.bulk.export")}
                  </button>
                </>
              )}
            </div>
          </>
        }
        title={t("documents.title")}
      />

      <CandidateFilterPanel
        activeFilterCount={activeFilterCount}
        filters={candidateFilters}
        hasExamResultLabel={t("documents.filters.hasTheoryExamScore")}
        hasAnyActiveFilter={activeFilterCount > 0 || activeTags.length > 0}
        onChange={handleCandidateFilterChange}
        onClearAll={clearAllCandidateFilters}
        onClose={() => setFiltersOpen(false)}
        open={filtersOpen}
      />

      <div className="tabs-search-row">
        <PageTabs active={tab} onChange={handleTabChange} tabs={tabs} />
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
            disabled={!canManageCandidates}
            onClick={openAddTagInput}
            title={!canManageCandidates ? noPermissionTitle : undefined}
            type="button"
          >
            + {t("candidates.tags.addFilter")}
          </button>
        )}
        <button
          className="tag-filter-manage"
          disabled={!canManageCandidates}
          onClick={() => setTagManagerOpen(true)}
          title={!canManageCandidates ? noPermissionTitle : undefined}
          type="button"
        >
          Etiketleri Yönet
        </button>
      </div>

      <div className="table-wrap spaced documents-table-wrap">
        <table className="data-table cand-table documents-table">
            <thead>
              <tr>
                <th className="cand-select-th">
                  <label className="cand-select-control switch-toggle">
                    <input
                      aria-label={t("documentsPage.aria.selectAll")}
                      checked={allVisibleSelected}
                      onChange={toggleVisibleCandidateSelection}
                      type="checkbox"
                    />
                    <span className="switch-toggle-control" aria-hidden="true" />
                  </label>
                </th>
                <th aria-label="Resim" className="cand-photo-th" />
                <SortableTh
                  className="documents-candidate-th"
                  field="name"
                  label={t("documents.col.candidate")}
                  onToggle={handleSortToggle}
                  sort={sort}
                />
                <SortableTh
                  className="documents-license-th"
                  field="licenseClass"
                  filterControl={
                    <CheckboxListPopover
                      onChange={(next) =>
                        handleCandidateFilterChange(
                          "licenseClasses",
                          next as CandidateFilterState["licenseClasses"]
                        )
                      }
                      options={filterLicenseClassOptions}
                      placeholder="Ehlyt"
                      searchable={filterLicenseClassOptions.length > 8}
                      title="Ehlyt"
                      triggerVariant="icon"
                      values={candidateFilters.licenseClasses}
                    />
                  }
                  label="Ehlyt"
                  onToggle={handleSortToggle}
                  sort={sort}
                />
                <SortableTh
                  className="documents-term-th"
                  field="term"
                  filterControl={
                    <CheckboxListPopover
                      onChange={(next) =>
                        handleCandidateFilterChange("groupIds", next)
                      }
                      options={bulkGroupOptions.map((group) => ({
                        value: group.id,
                        label: buildGroupHeading(group.title, group.term, [group.term], lang),
                      }))}
                      placeholder={t("documentsPage.filter.term")}
                      searchable={bulkGroupOptions.length > 8}
                      title={t("documentsPage.filter.term")}
                      triggerVariant="icon"
                      values={candidateFilters.groupIds}
                    />
                  }
                  label={t("documentsPage.filter.term")}
                  onToggle={handleSortToggle}
                  sort={sort}
                />
                <th className="documents-doc-th documents-advance-th">
                  <div className="documents-doc-label">
                    <span title="Peşinat">Peş.</span>
                  </div>
                </th>
                {visibleRequiredDocumentTypes.map((documentType) => (
                  <th
                    className="documents-doc-th"
                    key={documentType.id}
                    title={documentType.name}
                  >
                    <span aria-label={documentType.name} className="documents-doc-label">
                      {formatDocumentColumnLabel(documentType)}
                    </span>
                  </th>
                ))}
                <th className="documents-summary-th">
                  <div className="sortable-th-shell">
                    <span>{t("documents.col.summary")}</span>
                    <div className="sortable-th-filter">
                      <TableHeaderFilter
                        active={tab !== "all"}
                        onChange={(value) => handleTabChange(value as DocumentsTab)}
                        options={[
                          { value: "all", label: t("payments.datePreset.all") },
                          { value: "missing", label: "Eksik Evrak" },
                          { value: "complete", label: "Tam Evrak" },
                        ]}
                        title={t("documents.col.summary")}
                        value={tab}
                      />
                    </div>
                  </div>
                </th>
                <th className="col-picker-th">
                  <ColumnPicker
                    columns={documentColumnOptions}
                    isVisible={isDocumentColumnVisible}
                    onToggle={toggleDocumentColumn}
                    triggerTitle={t("candidates.columns.button")}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }, (_, index) => (
                  <tr key={index} style={{ pointerEvents: "none" }}>
                    <td className="cand-select-td" />
                    <td className="cand-photo-td">
                      <span className="skeleton" style={{ width: 28, height: 28, borderRadius: "999px" }} />
                    </td>
                    <td className="documents-candidate-td">
                      <span className="skeleton" style={{ width: `${110 + (index * 37) % 60}px` }} />
                    </td>
                    <td className="documents-license-td">
                      <span className="skeleton" style={{ width: 56 }} />
                    </td>
                    <td className="documents-term-td">
                      <span className="skeleton" style={{ width: 94 }} />
                    </td>
                    <td className="documents-doc-td documents-advance-td">
                      <span className="skeleton" style={{ width: 56 }} />
                    </td>
                    {visibleRequiredDocumentTypes.map((documentType, docIndex) => (
                      <td className="documents-doc-td" key={documentType.id}>
                        <span
                          className="skeleton"
                          style={{ width: `${18 + ((index + docIndex) * 5) % 6}px` }}
                        />
                      </td>
                    ))}
                    <td className="documents-summary-td">
                      <span className="skeleton" style={{ width: 88 }} />
                    </td>
                    <td className="col-picker-td" />
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td
                    className="data-table-empty"
                    colSpan={visibleRequiredDocumentTypes.length + 8}
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                sortedEntries.map((entry) => {
                  return (
                    <tr key={entry.candidateId} onClick={() => openCandidateDetail(entry.candidateId)}>
                      <td
                        className="cand-select-td"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <label className="cand-select-control switch-toggle">
                          <input
                            aria-label={`${entry.fullName} seç`}
                            checked={selectedCandidateIds.has(entry.candidateId)}
                            onChange={() => toggleCandidateSelection(entry.candidateId)}
                            onClick={(event) => event.stopPropagation()}
                            type="checkbox"
                          />
                          <span className="switch-toggle-control" aria-hidden="true" />
                        </label>
                      </td>
                      <td className="cand-photo-td">
                        <CandidateAvatar
                          candidate={toAvatarCandidate(entry)}
                          className="cand-avatar-cell"
                          previewOnClick
                          size={30}
                        />
                      </td>
                      <td className="documents-candidate-td">
                        <div className="cand-name">{entry.fullName}</div>
                        {renderPhoneNumber(entry)}
                      </td>
                      <td className="documents-license-td">{entry.licenseClass}</td>
                      <td className="documents-term-td">{renderDocumentTerm(entry, lang)}</td>
                      <td className="documents-doc-td documents-advance-td">
                        <button
                          aria-label={entry.hasAdvancePayment ? t("documentsPage.advancePayment.has") : t("documentsPage.advancePayment.none")}
                          className="documents-doc-icon-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (!entry.hasAdvancePayment) {
                              openCandidateAccounting(entry.candidateId);
                            }
                          }}
                          title={
                            entry.hasAdvancePayment
                              ? t("documentsPage.payment.has")
                              : t("documentsPage.payment.none")
                          }
                          type="button"
                        >
                          <span className={`documents-doc-icon ${entry.hasAdvancePayment ? "present" : "missing"}`}>
                            {entry.hasAdvancePayment ? <CheckIcon size={16} /> : <XIcon size={16} />}
                          </span>
                        </button>
                      </td>
                      {visibleRequiredDocumentTypes.map((documentType) => {
                        const hasDocument = !entry.missingDocumentKeys.includes(documentType.key);
                        const documentTypeId = documentType.id;
                        const notApplicable =
                          documentType.key === "existing_license_copy" &&
                          entry.hasExistingLicense === false;
                        return (
                          <td className="documents-doc-td" key={documentType.id}>
                            {notApplicable ? (
                              <span
                                aria-label={`${documentType.name}: gerekli değil`}
                                className="documents-doc-not-applicable"
                                title={`${documentType.name}: Mevcut ehliyet yok`}
                              >
                                -
                              </span>
                            ) : hasDocument ? (
                              <button
                                aria-label={`${documentType.name}: var`}
                                className="documents-doc-icon-btn"
                                disabled={!canManageDocuments}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setManageTarget({
                                    candidateId: entry.candidateId,
                                    candidateName: entry.fullName,
                                    documentTypeId,
                                  });
                                }}
                                title={
                                  !canManageDocuments
                                    ? noPermissionTitle
                                    : `${documentType.name}: Var - Görüntüle / Düzenle`
                                }
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
                                disabled={!canManageDocuments}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openUpload(entry, documentTypeId);
                                }}
                                title={!canManageDocuments ? noPermissionTitle : `${documentType.name}: Yok - Yükle`}
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
                      <td className="documents-summary-td">
                        <span className={documentSummaryToneClass(entry.summary)}>
                          {t("documents.summary", {
                            completedCount: entry.summary.completedCount,
                            totalRequiredCount: entry.summary.totalRequiredCount,
                            missingCount: entry.summary.missingCount,
                          })}
                        </span>
                      </td>
                      <td className="col-picker-td" />
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
      </div>

      <Pagination
        disabled={loading}
        onChange={setPage}
        onPageSizeChange={(nextSize) => {
          setPageSize(nextSize);
          setPage(1);
        }}
        page={page}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        totalPages={totalPages}
      />

      <UploadDocumentModal
        canManage={canManageDocuments}
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
        canManageDocuments={canManageDocuments}
        canManageMebJobs={canManageMebJobs}
        open={manageTarget !== null}
      />

      <CandidateTagManagerModal
        onClose={() => setTagManagerOpen(false)}
        onDeleted={handleTagDeleted}
        onRenamed={handleTagRenamed}
        canManage={canManageCandidates}
        open={tagManagerOpen}
        tags={allTags}
      />

    </div>
  );
}

type SortableThProps = {
  className?: string;
  field: DocumentSortField;
  filterControl?: ReactNode;
  label: string;
  sort: SortState;
  onToggle: (field: DocumentSortField) => void;
};

function SortableTh({ className, field, filterControl, label, sort, onToggle }: SortableThProps) {
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
      className={`${isActive ? "sortable-th active" : "sortable-th"}${className ? ` ${className}` : ""}`}
    >
      <div className="sortable-th-shell">
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
        {filterControl ? <div className="sortable-th-filter">{filterControl}</div> : null}
      </div>
    </th>
  );
}
