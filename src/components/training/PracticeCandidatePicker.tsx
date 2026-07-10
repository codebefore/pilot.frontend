import {
  useEffect,
  useMemo,
  useState,
  type AriaAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";

import { MebIcon } from "../icons";
import { CandidateAvatar } from "../ui/CandidateAvatar";
import { CheckboxListPopover } from "../ui/CheckboxListPopover";
import { getCandidatePhotosByCandidateIds } from "../../lib/documents-api";
import { useT, currentLocale } from "../../lib/i18n";
import {
  getPracticeCandidates,
  type PracticeCandidateListItem,
  type PracticeCandidateFilterOptions,
  type PracticeCandidateSortDirection,
  type PracticeCandidateSortField,
  type PracticeCandidateTabCounts,
  type PracticeCandidateTab,
} from "../../lib/practice-candidates-api";

type PracticeCandidatePickerProps = {
  onAssign: (candidateId: string) => void;
  onSelectionChange: (candidateIds: Set<string>) => void;
  refreshToken?: number;
  selectedCandidateIds: Set<string>;
};

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 100;
const SORT_STORAGE_PREFIX = "training.practiceCandidatePicker.sort";

const tabs: PracticeCandidateTab[] = ["all", "havuz", "basarisiz", "randevulu"];
const emptyTabCounts: PracticeCandidateTabCounts = {
  all: 0,
  havuz: 0,
  basarisiz: 0,
  randevulu: 0,
};
const emptyFilterOptions: PracticeCandidateFilterOptions = {
  licenseClasses: [],
  groups: [],
};

type CandidatePickerPhoto = {
  documentId: string;
  kind: string;
};

type PracticeCandidateSortState = {
  field: PracticeCandidateSortField;
  direction: PracticeCandidateSortDirection;
} | null;

type PracticeCandidateFilters = {
  licenseClasses: string[];
  groupIds: string[];
  attemptNumbers: string[];
};

type PracticeCandidateColumnId =
  | "select"
  | "name"
  | "licenseClass"
  | "group"
  | "attempt"
  | "progress"
  | "lastLesson";

type PracticeCandidateColumnDef = {
  id: PracticeCandidateColumnId;
  label: string;
  sortField: PracticeCandidateSortField;
};

const emptyFilters: PracticeCandidateFilters = {
  licenseClasses: [],
  groupIds: [],
  attemptNumbers: [],
};

function defaultSortForTab(tab: PracticeCandidateTab): PracticeCandidateSortState {
  if (tab === "all" || tab === "havuz") return { field: "theoryExamDate", direction: "desc" };
  if (tab === "randevulu") return { field: "drivingExamDate", direction: "asc" };
  if (tab === "basarisiz") return { field: "drivingExamDate", direction: "desc" };
  return null;
}

function sortStorageKey(tab: PracticeCandidateTab): string {
  return `${SORT_STORAGE_PREFIX}.${tab}`;
}

function readSort(tab: PracticeCandidateTab): PracticeCandidateSortState {
  try {
    const raw = window.localStorage.getItem(sortStorageKey(tab));
    if (!raw) return defaultSortForTab(tab);
    const parsed = JSON.parse(raw) as Partial<NonNullable<PracticeCandidateSortState>> | null;
    if (
      parsed &&
      typeof parsed.field === "string" &&
      (parsed.direction === "asc" || parsed.direction === "desc")
    ) {
      return {
        field: parsed.field as PracticeCandidateSortField,
        direction: parsed.direction,
      };
    }
  } catch {
    // localStorage may be blocked or contain old data; fall back to the tab default.
  }
  return defaultSortForTab(tab);
}

function writeSort(tab: PracticeCandidateTab, sort: PracticeCandidateSortState): void {
  try {
    const key = sortStorageKey(tab);
    if (sort) {
      window.localStorage.setItem(key, JSON.stringify(sort));
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Sorting still works for the current session if localStorage is unavailable.
  }
}

function splitCandidateFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: fullName.trim(), lastName: "" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1] ?? "",
  };
}

export function PracticeCandidatePicker({
  onAssign,
  onSelectionChange,
  refreshToken = 0,
  selectedCandidateIds,
}: PracticeCandidatePickerProps) {
  const t = useT();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tab, setTab] = useState<PracticeCandidateTab>("all");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<PracticeCandidateListItem[]>([]);
  const [photoByCandidateId, setPhotoByCandidateId] = useState<Map<string, CandidatePickerPhoto>>(new Map());
  const [totalPages, setTotalPages] = useState(0);
  const [tabCounts, setTabCounts] = useState<PracticeCandidateTabCounts>(emptyTabCounts);
  const [filterOptions, setFilterOptions] = useState<PracticeCandidateFilterOptions>(emptyFilterOptions);
  const [sort, setSort] = useState<PracticeCandidateSortState>(() => readSort("all"));
  const [filters, setFilters] = useState<PracticeCandidateFilters>(emptyFilters);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(
      () => setDebouncedSearch(searchInput),
      SEARCH_DEBOUNCE_MS
    );
    return () => window.clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters, sort, tab]);

  useEffect(() => {
    writeSort(tab, sort);
  }, [sort, tab]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getPracticeCandidates(
      {
        tab,
        search: debouncedSearch.trim() || undefined,
        licenseClasses: filters.licenseClasses,
        groupIds: filters.groupIds,
        attemptNumbers: filters.attemptNumbers.map(Number),
        sortBy: sort?.field,
        sortDir: sort?.direction,
        page,
        pageSize: PAGE_SIZE,
      },
      controller.signal
    )
      .then((response) => {
        setItems(response.items);
        setTotalPages(response.totalPages ?? 1);
        setTabCounts(response.tabCounts ?? emptyTabCounts);
        setFilterOptions(response.filterOptions ?? emptyFilterOptions);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error(error);
        setItems([]);
        setTotalPages(0);
        setTabCounts(emptyTabCounts);
        setFilterOptions(emptyFilterOptions);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debouncedSearch, filters, page, refreshToken, sort, tab]);

  useEffect(() => {
    const candidateIds = items.map((item) => item.candidateId);
    if (candidateIds.length === 0) {
      setPhotoByCandidateId(new Map());
      return;
    }

    const controller = new AbortController();
    getCandidatePhotosByCandidateIds(candidateIds, controller.signal)
      .then((entries) => {
        if (controller.signal.aborted) return;
        setPhotoByCandidateId(
          new Map(
            entries
              .filter((entry) => entry.photo)
              .map((entry) => [entry.candidateId, entry.photo as CandidatePickerPhoto])
          )
        );
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setPhotoByCandidateId(new Map());
        }
      });

    return () => controller.abort();
  }, [items]);

  const formatDateTime = (value: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(currentLocale(), {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const tabLabel = (value: PracticeCandidateTab) => {
    const label =
      value === "all"
        ? t("training.picker.stage.all")
        : value === "havuz"
          ? t("training.picker.stage.havuz")
          : value === "basarisiz"
            ? t("training.picker.stage.failed")
            : t("training.picker.stage.randevulu");

    return `${label} (${tabCounts[value] ?? 0})`;
  };

  const currentColumns = useMemo<PracticeCandidateColumnDef[]>(
    () => [
      { id: "name", label: t("training.picker.col.name"), sortField: "name" },
      {
        id: "licenseClass",
        label: t("training.picker.col.licenseClass"),
        sortField: "licenseClass",
      },
      { id: "group", label: t("training.picker.col.group"), sortField: "groupTitle" },
      { id: "attempt", label: t("training.picker.col.attempt"), sortField: "attemptNumber" },
      { id: "progress", label: t("training.picker.col.progress"), sortField: "progress" },
      {
        id: "lastLesson",
        label: t("training.picker.col.lastLesson"),
        sortField: "lastPracticeLessonAt",
      },
    ],
    [t]
  );

  const licenseClassOptions = useMemo(
    () =>
      [...filterOptions.licenseClasses]
        .sort((left, right) => left.localeCompare(right, "tr"))
        .map((value) => ({ value, label: value })),
    [filterOptions.licenseClasses]
  );

  const groupOptions = useMemo(
    () =>
      [...filterOptions.groups]
        .map((group) => ({ value: group.id, label: group.title }))
        .sort((left, right) => left.label.localeCompare(right.label, "tr")),
    [filterOptions.groups]
  );

  const attemptOptions = useMemo(
    () =>
      [1, 2, 3, 4, 5].map((value) => ({
        value: String(value),
        label: `${value}. Hak`,
      })),
    []
  );

  const setFilter = <K extends keyof PracticeCandidateFilters>(
    key: K,
    value: PracticeCandidateFilters[K]
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handleTabChange = (value: PracticeCandidateTab) => {
    setTab(value);
    setSort(readSort(value));
  };

  const handleSortToggle = (field: PracticeCandidateSortField) => {
    setSort((current) => {
      if (!current || current.field !== field) return { field, direction: "asc" };
      if (current.direction === "asc") return { field, direction: "desc" };
      return null;
    });
  };

  const getColumnFilterControl = (column: PracticeCandidateColumnDef): ReactNode => {
    if (column.id === "licenseClass") {
      return (
        <CheckboxListPopover
          onChange={(next) => setFilter("licenseClasses", next)}
          options={licenseClassOptions}
          placeholder={column.label}
          searchable={licenseClassOptions.length > 8}
          title={column.label}
          triggerVariant="icon"
          values={filters.licenseClasses}
        />
      );
    }

    if (column.id === "group") {
      return (
        <CheckboxListPopover
          onChange={(next) => setFilter("groupIds", next)}
          options={groupOptions}
          placeholder={column.label}
          searchable={groupOptions.length > 8}
          title={column.label}
          triggerVariant="icon"
          values={filters.groupIds}
        />
      );
    }

    if (column.id === "attempt") {
      return (
        <CheckboxListPopover
          onChange={(next) => setFilter("attemptNumbers", next)}
          options={attemptOptions}
          placeholder={column.label}
          title={column.label}
          triggerVariant="icon"
          values={filters.attemptNumbers}
        />
      );
    }

    return null;
  };

  const openCandidate = (candidateId: string) => {
    navigate(`/candidates/${candidateId}`, {
      state: {
        returnLabel: "← Direksiyon sayfasına dön",
        returnTo: "/training/uygulama",
      },
    });
  };

  const openCandidateFromAction = (event: MouseEvent, candidateId: string) => {
    event.stopPropagation();
    openCandidate(candidateId);
  };

  const toggleCandidateSelection = (candidateId: string) => {
    const next = new Set(selectedCandidateIds);
    if (next.has(candidateId)) next.delete(candidateId);
    else next.add(candidateId);
    onSelectionChange(next);
  };

  const formatHours = (value: number) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return String(value);

    return numericValue.toLocaleString(currentLocale(), {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    });
  };

  return (
    <section className="practice-picker">
      <div className="practice-picker-controls">
        <div className="practice-picker-stage-tabs" role="tablist">
          {tabs.map((value) => (
            <button
              aria-pressed={tab === value}
              className={
                tab === value
                  ? "practice-picker-stage-tab is-active"
                  : "practice-picker-stage-tab"
              }
              key={value}
              onClick={() => handleTabChange(value)}
              type="button"
            >
              {tabLabel(value)}
            </button>
          ))}
        </div>
        <input
          className="practice-picker-search"
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t("training.quick.candidatePlaceholder")}
          type="search"
          value={searchInput}
        />
      </div>

      {items.length === 0 ? (
        <div className="practice-picker-empty">
          {loading ? t("training.picker.loading") : t("training.picker.empty")}
        </div>
      ) : (
        <div className="practice-picker-table-wrap">
          <table className="practice-picker-table">
            <thead>
              <tr>
                <th className="practice-picker-select-th" aria-label={t("training.picker.col.select")} />
                {currentColumns.map((column) => (
                  <SortableTh
                    field={column.sortField}
                    filterControl={getColumnFilterControl(column)}
                    key={column.id}
                    label={column.label}
                    onToggle={handleSortToggle}
                    sort={sort}
                  />
                ))}
                <th>{t("training.picker.col.assign")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((candidate) => {
                const fallbackName = splitCandidateFullName(candidate.fullName);
                const avatarCandidate = {
                  id: candidate.candidateId,
                  firstName: candidate.firstName ?? fallbackName.firstName,
                  lastName: candidate.lastName ?? fallbackName.lastName,
                  gender: candidate.gender ?? null,
                  photo: candidate.photo ?? photoByCandidateId.get(candidate.candidateId) ?? null,
                };
                return (
                  <tr
                    className="practice-picker-row"
                    key={candidate.candidateId}
                    onClick={() => onAssign(candidate.candidateId)}
                  >
                    <td
                      className="practice-picker-select-td"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <label
                        className="practice-picker-select-control switch-toggle"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          aria-label={t("training.picker.selectCandidate", {
                            name: candidate.fullName,
                          })}
                          checked={selectedCandidateIds.has(candidate.candidateId)}
                          onChange={() => toggleCandidateSelection(candidate.candidateId)}
                          onClick={(event) => event.stopPropagation()}
                          type="checkbox"
                        />
                        <span className="switch-toggle-control" aria-hidden="true" />
                      </label>
                    </td>
                    <td className="practice-picker-row-name">
                      <CandidateAvatar
                        candidate={avatarCandidate}
                        className="practice-picker-avatar"
                        previewOnClick
                      />
                      <span>{candidate.fullName}</span>
                    </td>
                    <td>
                      <span className="license-class-badge">
                        {candidate.licenseClass}
                      </span>
                    </td>
                    <td className="practice-picker-row-muted">
                      {candidate.groupTitle ?? "—"}
                    </td>
                    <td>
                      <span className="practice-picker-attempt-badge">
                        {candidate.attemptSlotLabel}
                      </span>
                    </td>
                    <td>
                      <div className="practice-picker-row-progress">
                        <div
                          aria-hidden="true"
                          className={
                            candidate.remainingPracticeHours <= 0
                              ? "practice-picker-bar practice-picker-bar-done"
                              : candidate.remainingPracticeHours <= 4
                                ? "practice-picker-bar practice-picker-bar-almost"
                                : "practice-picker-bar"
                          }
                        >
                          <div
                            className="practice-picker-bar-fill"
                            style={{
                              width: `${
                                candidate.targetPracticeHours > 0
                                  ? Math.min(
                                      100,
                                      (candidate.completedPracticeHours / candidate.targetPracticeHours) * 100
                                    )
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="practice-picker-progress-text">
                          {formatHours(candidate.completedPracticeHours)} / {formatHours(candidate.targetPracticeHours)}
                        </span>
                      </div>
                    </td>
                    <td className="practice-picker-row-muted">
                      {formatDateTime(candidate.lastPracticeLessonAt)}
                    </td>
                    <td className="practice-picker-action-cell">
                      <button
                        aria-label={t("training.picker.openCandidate", {
                          name: candidate.fullName,
                        })}
                        className="practice-picker-assign-btn"
                        onClick={(event) => openCandidateFromAction(event, candidate.candidateId)}
                        type="button"
                      >
                        <MebIcon size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="practice-picker-pagination">
          <button
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            type="button"
          >
            {t("common.prev")}
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages || loading}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            type="button"
          >
            {t("common.next")}
          </button>
        </div>
      ) : null}
    </section>
  );
}

type SortableThProps = {
  field: PracticeCandidateSortField;
  filterControl?: ReactNode;
  label: string;
  sort: PracticeCandidateSortState;
  onToggle: (field: PracticeCandidateSortField) => void;
};

function SortableTh({ field, filterControl, label, sort, onToggle }: SortableThProps) {
  const isActive = sort?.field === field;
  const direction = isActive ? sort.direction : null;
  const indicator = direction === "asc" ? "▲" : direction === "desc" ? "▼" : "↕";
  const ariaSort: AriaAttributes["aria-sort"] = isActive
    ? direction === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <th aria-sort={ariaSort} className={isActive ? "sortable-th active" : "sortable-th"}>
      <div className="sortable-th-shell">
        <button className="sortable-th-btn" onClick={() => onToggle(field)} type="button">
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
