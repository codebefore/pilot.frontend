import { type FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

import { FilterIcon, PencilIcon, PlusIcon, TrashIcon } from "../icons";
import { LicenseClassDefinitionFormModal } from "../modals/LicenseClassDefinitionFormModal";
import { ColumnPicker, type ColumnOption } from "../ui/ColumnPicker";
import { Pagination } from "../ui/Pagination";
import { SearchInput } from "../ui/SearchInput";
import { StatusPill } from "../ui/StatusPill";
import { TableHeaderFilter } from "../ui/TableHeaderFilter";
import { useToast } from "../ui/Toast";
import {
  deleteLicenseClassDefinition,
  getLicenseClassDefinitions,
  type LicenseClassDefinitionActivityFilter,
  type LicenseClassDefinitionSortDirection,
  type LicenseClassDefinitionSortField,
} from "../../lib/license-class-definitions-api";
import {
  LICENSE_CLASS_DEFINITION_CATEGORY_LABELS,
  LICENSE_CLASS_DEFINITION_CATEGORY_OPTIONS,
} from "../../lib/license-class-definition-catalog";
import { useT } from "../../lib/i18n";
import { existingLicenseTypeLabel } from "../../lib/status-maps";
import type {
  LicenseClassDefinitionCategory,
  LicenseClassDefinitionListSummaryResponse,
  LicenseClassDefinitionResponse,
} from "../../lib/types";
import { useColumnVisibility } from "../../lib/use-column-visibility";

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const SEARCH_DEBOUNCE_MS = 300;
type SortState = {
  field: LicenseClassDefinitionSortField;
  direction: LicenseClassDefinitionSortDirection;
} | null;
type LicenseClassDefinitionFilterValue<T extends string> = T | "all";
type LicenseClassDefinitionFilters = {
  activity: LicenseClassDefinitionActivityFilter;
  code: string;
  category: LicenseClassDefinitionFilterValue<LicenseClassDefinitionCategory>;
};
type LicenseClassDefinitionColumnId =
  | "code"
  | "category"
  | "existingLicenseType"
  | "minimumAge"
  | "isActive";
type LicenseClassDefinitionColumnDef = {
  id: LicenseClassDefinitionColumnId;
  label: string;
  sortField?: LicenseClassDefinitionSortField;
  renderCell: (item: LicenseClassDefinitionResponse) => React.ReactNode;
  skeletonWidth: number;
  skeletonKind?: "line" | "pill";
};

const EMPTY_SUMMARY: LicenseClassDefinitionListSummaryResponse = {
  activeCount: 0,
};

function formatOptionalNumber(value: number | null, suffix = ""): string {
  if (value === null || value === undefined) return "-";
  return `${value}${suffix}`;
}

function formatExistingLicenseRequirement(item: LicenseClassDefinitionResponse): string {
  if (!item.hasExistingLicense) return "-";
  const label = existingLicenseTypeLabel(item.existingLicenseType);
  return item.existingLicensePre2016 ? `${label} (2016 öncesi)` : label;
}

const DEFAULT_FILTERS: LicenseClassDefinitionFilters = {
  activity: "active",
  code: "",
  category: "all",
};

export function LicenseClassDefinitionsSettingsSection() {
  const navigate = useNavigate();
  const t = useT();
  const { showToast } = useToast();

  const LICENSE_CLASS_DEFINITION_COLUMNS: LicenseClassDefinitionColumnDef[] = [
    {
      id: "existingLicenseType",
      label: t("settings.licenseClasses.columns.existingLicenseType"),
      renderCell: (item) => formatExistingLicenseRequirement(item),
      skeletonWidth: 100,
    },
    {
      id: "code",
      label: t("settings.licenseClasses.columns.code"),
      sortField: "code",
      renderCell: (item) => <strong>{item.code}</strong>,
      skeletonWidth: 70,
    },
    {
      id: "category",
      label: t("settings.licenseClasses.columns.category"),
      sortField: "category",
      renderCell: (item) => LICENSE_CLASS_DEFINITION_CATEGORY_LABELS[item.category] ?? item.category,
      skeletonWidth: 100,
    },
    {
      id: "minimumAge",
      label: t("settings.licenseClasses.columns.minimumAge"),
      sortField: "minimumAge",
      renderCell: (item) => formatOptionalNumber(item.minimumAge),
      skeletonWidth: 50,
    },
    {
      id: "isActive",
      label: t("settings.licenseClasses.columns.isActive"),
      sortField: "isActive",
      renderCell: (item) => (
        <StatusPill
          label={item.isActive ? t("settings.licenseClasses.status.active") : t("settings.licenseClasses.status.inactive")}
          status={item.isActive ? "success" : "manual"}
        />
      ),
      skeletonWidth: 74,
      skeletonKind: "pill",
    },
  ];

  const LICENSE_CLASS_DEFINITION_COLUMN_IDS = LICENSE_CLASS_DEFINITION_COLUMNS.map(
    (column) => column.id
  );
  const LICENSE_CLASS_DEFINITION_COLUMN_PICKER_OPTIONS: ColumnOption[] =
    LICENSE_CLASS_DEFINITION_COLUMNS.map((column) => ({
      id: column.id,
      label: column.label,
    }));

  const { isVisible, toggle: toggleColumn } = useColumnVisibility(
    "settings.license-class-definitions.columns.v4",
    LICENSE_CLASS_DEFINITION_COLUMN_IDS
  );

  const [items, setItems] = useState<LicenseClassDefinitionResponse[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [summary, setSummary] =
    useState<LicenseClassDefinitionListSummaryResponse>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchResetKey, setSearchResetKey] = useState(0);
  const [filters, setFilters] = useState<LicenseClassDefinitionFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sort, setSort] = useState<SortState>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LicenseClassDefinitionResponse | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const visibleColumns = LICENSE_CLASS_DEFINITION_COLUMNS.filter((column) =>
    isVisible(column.id)
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const query = {
      activity: filters.activity,
      code: filters.code.trim() || undefined,
      page,
      pageSize,
      search: search.trim() || undefined,
      category: filters.category !== "all" ? filters.category : undefined,
      ...(sort ? { sortBy: sort.field, sortDir: sort.direction } : {}),
    };

    getLicenseClassDefinitions(query, controller.signal)
      .then((response) => {
        setItems(response.items);
        setTotalCount(response.totalCount);
        setTotalPages(response.totalPages);
        setSummary(response.summary);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        showToast(t("settings.licenseClasses.toast.loadFailed"), "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [filters, page, pageSize, refreshKey, search, showToast, sort]);

  const counts = useMemo(() => {
    return {
      total: totalCount,
      active: summary.activeCount,
    };
  }, [summary, totalCount]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    filters.activity !== DEFAULT_FILTERS.activity ||
    filters.code !== DEFAULT_FILTERS.code ||
    filters.category !== DEFAULT_FILTERS.category;

  const handleSaved = (_saved: LicenseClassDefinitionResponse) => {
    setFormOpen(false);
    setEditing(null);
    setRefreshKey((current) => current + 1);
    showToast(editing ? t("settings.licenseClasses.toast.updated") : t("settings.licenseClasses.toast.created"));
  };

  const handleSortToggle = (field: LicenseClassDefinitionSortField) => {
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

  const handleColumnToggle = (id: string) => {
    const column = LICENSE_CLASS_DEFINITION_COLUMNS.find((item) => item.id === id);
    if (column?.sortField && isVisible(id) && sort?.field === column.sortField) {
      setSort(null);
    }
    if (isVisible(id)) {
      if (id === "isActive") {
        setFilter("activity", DEFAULT_FILTERS.activity);
      } else if (id === "code") {
        setFilter("code", DEFAULT_FILTERS.code);
      } else if (id === "category") {
        setFilter("category", DEFAULT_FILTERS.category);
      }
    }
    toggleColumn(id);
  };

  const setFilter = <K extends keyof LicenseClassDefinitionFilters>(
    key: K,
    value: LicenseClassDefinitionFilters[K]
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const handleDelete = async (item: LicenseClassDefinitionResponse) => {
    setDeletingId(item.id);
    try {
      await deleteLicenseClassDefinition(item.id);
      setConfirmDeleteId(null);
      showToast(t("settings.licenseClasses.toast.deleted"));
      if (items.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        setRefreshKey((current) => current + 1);
      }
    } catch {
      showToast(t("settings.licenseClasses.toast.deleteFailed"), "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="settings-section-stack">
        <div className="settings-summary-grid">
          <div className="settings-summary-card">
            <span className="settings-summary-label">{t("settings.licenseClasses.summary.total")}</span>
            <strong className="settings-summary-value">{counts.total}</strong>
          </div>
          <div className="settings-summary-card">
            <span className="settings-summary-label">{t("settings.licenseClasses.summary.active")}</span>
            <strong className="settings-summary-value">{counts.active}</strong>
          </div>
        </div>

        <section className="settings-surface">
          <div className="settings-surface-header">
            <div className="settings-surface-title">{t("settings.licenseClasses.title")}</div>
            <div className="settings-module-actions">
              <div className="search-box settings-module-search settings-module-search-compact">
                <SearchInput
                  debounceMs={SEARCH_DEBOUNCE_MS}
                  onChange={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                  placeholder={t("settings.licenseClasses.search.placeholder")}
                  resetSignal={searchResetKey}
                  value={search}
                />
              </div>
              {hasActiveFilters ? (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSearch("");
                    setSearchResetKey((current) => current + 1);
                    setFilters(DEFAULT_FILTERS);
                    setPage(1);
                  }}
                  type="button"
                >
                  {t("settings.licenseClasses.button.clearFilters")}
                </button>
              ) : null}
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                type="button"
              >
                <PlusIcon size={14} />
                {t("settings.licenseClasses.button.new")}
              </button>
            </div>
          </div>

          <div className="settings-surface-body">
            <table className="data-table">
              <thead>
                <tr>
                  {visibleColumns.map((column) =>
                    column.sortField ? (
                      <SortableTh
                        field={column.sortField}
                        filterControl={buildColumnFilterControl(column.id, filters, setFilter, t)}
                        key={column.id}
                        label={column.label}
                        onToggle={handleSortToggle}
                        sort={sort}
                      />
                    ) : (
                      <PlainTh
                        filterControl={buildColumnFilterControl(column.id, filters, setFilter, t)}
                        key={column.id}
                        label={column.label}
                      />
                    )
                  )}
                  <th className="col-picker-th">
                    <ColumnPicker
                      columns={LICENSE_CLASS_DEFINITION_COLUMN_PICKER_OPTIONS}
                      isVisible={isVisible}
                      onToggle={handleColumnToggle}
                      triggerTitle={t("settings.licenseClasses.columnPicker.title")}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }, (_, index) => (
                    <tr key={index} style={{ pointerEvents: "none" }}>
                      {visibleColumns.map((column) => (
                        <td key={column.id}>
                          <span
                            className={
                              column.skeletonKind === "pill"
                                ? "skeleton skeleton-pill"
                                : "skeleton"
                            }
                            style={{ width: column.skeletonWidth }}
                          />
                        </td>
                      ))}
                      <td className="col-picker-td">
                        <span className="skeleton" style={{ width: 24 }} />
                      </td>
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td className="data-table-empty" colSpan={visibleColumns.length + 1}>
                      {t("settings.licenseClasses.empty")}
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      className="data-table-row-clickable"
                      key={item.id}
                      onClick={() => navigate(`/settings/definitions/license-classes/${item.id}`)}
                    >
                      {visibleColumns.map((column) => (
                        <td key={column.id}>{column.renderCell(item)}</td>
                      ))}
                      <td className="col-picker-td" onClick={(e) => e.stopPropagation()}>
                        <div
                          className={
                            confirmDeleteId === item.id
                              ? "table-row-actions table-row-actions-confirm"
                              : "table-row-actions"
                          }
                        >
                          {confirmDeleteId === item.id ? (
                            <>
                              <button
                                className="btn btn-secondary btn-sm"
                                disabled={deletingId === item.id}
                                onClick={() => setConfirmDeleteId(null)}
                                type="button"
                              >
                                {t("common.cancel")}
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                disabled={deletingId === item.id}
                                onClick={() => handleDelete(item)}
                                type="button"
                              >
                                {deletingId === item.id ? t("settings.licenseClasses.button.deleting") : t("common.delete")}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                aria-label={t("common.edit")}
                                className="icon-btn"
                                onClick={() => {
                                  setEditing(item);
                                  setFormOpen(true);
                                }}
                                title={t("common.edit")}
                                type="button"
                              >
                                <PencilIcon size={14} />
                              </button>
                              <button
                                aria-label={t("common.delete")}
                                className="icon-btn icon-btn-danger"
                                disabled={deletingId !== null}
                                onClick={() => setConfirmDeleteId(item.id)}
                                title={t("common.delete")}
                                type="button"
                              >
                                <TrashIcon size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

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
          </div>
        </section>
      </div>

      <LicenseClassDefinitionFormModal
        editing={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onConcurrencyConflict={() => {
          setFormOpen(false);
          setEditing(null);
          setRefreshKey((current) => current + 1);
        }}
        onSaved={handleSaved}
        open={formOpen}
      />
    </>
  );
}

type SortableThProps = {
  field: LicenseClassDefinitionSortField;
  filterControl?: React.ReactNode;
  label: string;
  sort: SortState;
  onToggle: (field: LicenseClassDefinitionSortField) => void;
};

function SortableTh({ field, filterControl, label, sort, onToggle }: SortableThProps) {
  const isActive = sort?.field === field;
  const direction = isActive ? sort.direction : null;
  const indicator = direction === "asc" ? "▲" : direction === "desc" ? "▼" : "↕";
  const ariaSort: React.AriaAttributes["aria-sort"] = isActive
    ? direction === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <th aria-sort={ariaSort} className={isActive ? "sortable-th active" : "sortable-th"}>
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

type PlainThProps = {
  filterControl?: React.ReactNode;
  label: string;
};

function PlainTh({ filterControl, label }: PlainThProps) {
  return (
    <th>
      <div className="sortable-th-shell">
        <span>{label}</span>
        {filterControl ? <div className="sortable-th-filter">{filterControl}</div> : null}
      </div>
    </th>
  );
}

function buildColumnFilterControl(
  columnId: LicenseClassDefinitionColumnId,
  filters: LicenseClassDefinitionFilters,
  setFilter: <K extends keyof LicenseClassDefinitionFilters>(
    key: K,
    value: LicenseClassDefinitionFilters[K]
  ) => void,
  t: ReturnType<typeof useT>
) {
  if (columnId === "code") {
    return (
      <TableHeaderTextFilter
        active={filters.code.trim().length > 0}
        applyLabel={t("common.search")}
        clearLabel={t("settings.licenseClasses.button.clearFilters")}
        onApply={(nextValue) => setFilter("code", nextValue)}
        onClear={() => setFilter("code", DEFAULT_FILTERS.code)}
        placeholder={t("settings.licenseClasses.filter.codePlaceholder")}
        title={t("settings.licenseClasses.filter.codeTitle")}
        value={filters.code}
      />
    );
  }

  if (columnId === "isActive") {
    return (
      <TableHeaderFilter
        active={filters.activity !== DEFAULT_FILTERS.activity}
        onChange={(nextValue) =>
          setFilter("activity", nextValue as LicenseClassDefinitionActivityFilter)
        }
        options={[
          { value: "active", label: t("settings.licenseClasses.status.active") },
          { value: "all", label: t("common.all") },
          { value: "inactive", label: t("settings.licenseClasses.status.inactive") },
        ]}
        title={t("settings.licenseClasses.filter.statusTitle")}
        value={filters.activity}
      />
    );
  }

  if (columnId === "category") {
    return (
      <TableHeaderFilter
        active={filters.category !== DEFAULT_FILTERS.category}
        onChange={(nextValue) =>
          setFilter("category", nextValue as LicenseClassDefinitionFilterValue<LicenseClassDefinitionCategory>)
        }
        options={[
          { value: "all", label: t("common.all") },
          ...LICENSE_CLASS_DEFINITION_CATEGORY_OPTIONS,
        ]}
        title={t("settings.licenseClasses.filter.categoryTitle")}
        value={filters.category}
      />
    );
  }

  return null;
}

const FILTER_MENU_VIEWPORT_GAP = 8;
const FILTER_MENU_TRIGGER_GAP = 6;
const FILTER_MENU_FALLBACK_WIDTH = 220;
const FILTER_MENU_FALLBACK_HEIGHT = 150;

type TableHeaderTextFilterProps = {
  active: boolean;
  applyLabel: string;
  clearLabel: string;
  onApply: (value: string) => void;
  onClear: () => void;
  placeholder: string;
  title: string;
  value: string;
};

function TableHeaderTextFilter({
  active,
  applyLabel,
  clearLabel,
  onApply,
  onClear,
  placeholder,
  title,
  value,
}: TableHeaderTextFilterProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setDraft(value);
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const triggerRect = trigger.getBoundingClientRect();
      const measuredWidth = menuRef.current?.offsetWidth ?? FILTER_MENU_FALLBACK_WIDTH;
      const measuredHeight = menuRef.current?.offsetHeight ?? FILTER_MENU_FALLBACK_HEIGHT;
      const maxLeft = Math.max(
        FILTER_MENU_VIEWPORT_GAP,
        window.innerWidth - measuredWidth - FILTER_MENU_VIEWPORT_GAP
      );
      const left = Math.min(
        Math.max(triggerRect.right - measuredWidth, FILTER_MENU_VIEWPORT_GAP),
        maxLeft
      );
      const belowTop = triggerRect.bottom + FILTER_MENU_TRIGGER_GAP;
      const aboveTop = triggerRect.top - measuredHeight - FILTER_MENU_TRIGGER_GAP;
      const fitsBelow = belowTop + measuredHeight <= window.innerHeight - FILTER_MENU_VIEWPORT_GAP;
      const fitsAbove = aboveTop >= FILTER_MENU_VIEWPORT_GAP;
      const top = fitsBelow
        ? belowTop
        : fitsAbove
          ? aboveTop
          : Math.max(
              FILTER_MENU_VIEWPORT_GAP,
              window.innerHeight - measuredHeight - FILTER_MENU_VIEWPORT_GAP
            );

      setMenuPos({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onApply(draft.trim());
    setOpen(false);
  };

  return (
    <div className={open ? "table-header-filter open" : "table-header-filter"} ref={ref}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={title}
        className={`table-header-filter-trigger${active ? " active" : ""}`}
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        title={title}
        type="button"
      >
        <FilterIcon size={12} />
      </button>

      {open
        ? createPortal(
            <div
              className="table-header-filter-menu table-header-filter-text-menu"
              ref={menuRef}
              role="dialog"
              style={menuPos ? { top: menuPos.top, left: menuPos.left } : undefined}
            >
              <div className="table-header-filter-title">{title}</div>
              <form className="table-header-filter-form" onSubmit={submit}>
                <input
                  autoFocus
                  className="table-header-filter-input"
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={placeholder}
                  type="search"
                  value={draft}
                />
                <div className="table-header-filter-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      onClear();
                      setOpen(false);
                    }}
                    type="button"
                  >
                    {clearLabel}
                  </button>
                  <button className="btn btn-primary btn-sm" type="submit">
                    {applyLabel}
                  </button>
                </div>
              </form>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
