import { useEffect, useMemo, useState } from "react";

import { PencilIcon, PlusIcon, TrashIcon } from "../icons";
import { FeeFormModal } from "../modals/FeeFormModal";
import { ColumnPicker } from "../ui/ColumnPicker";
import { Pagination } from "../ui/Pagination";
import { SearchInput } from "../ui/SearchInput";
import { StatusPill } from "../ui/StatusPill";
import { TableHeaderFilter } from "../ui/TableHeaderFilter";
import { useToast } from "../ui/Toast";
import { useT, type TranslationKey } from "../../lib/i18n";
import {
  deleteFee,
  getFees,
  type FeeActivityFilter,
  type FeeSortDirection,
  type FeeSortField,
} from "../../lib/fees-api";
import { FEE_TYPE_LABELS, FEE_TYPE_OPTIONS } from "../../lib/fee-catalog";
import { getLicenseClassDefinitions } from "../../lib/license-class-definitions-api";
import type {
  FeeListSummaryResponse,
  FeeResponse,
  FeeType,
  LicenseClassDefinitionResponse,
} from "../../lib/types";
import { useColumnVisibility } from "../../lib/use-column-visibility";

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const SEARCH_DEBOUNCE_MS = 300;

type SortState = { field: FeeSortField; direction: FeeSortDirection } | null;
type FeeFilters = {
  activity: FeeActivityFilter;
  feeType: FeeType | "all";
};
type FeeColumnId = "feeType" | "amount" | "licenseClasses" | "isActive";
type FeeColumnDef = {
  id: FeeColumnId;
  labelKey: TranslationKey;
  sortField?: FeeSortField;
  renderCell: (fee: FeeResponse, totalLicenseClassCount: number, t: ReturnType<typeof useT>) => React.ReactNode;
  skeletonWidth: number;
  skeletonKind?: "line" | "pill";
};

const EMPTY_SUMMARY: FeeListSummaryResponse = {
  activeCount: 0,
  inactiveCount: 0,
};

const FEE_COLUMN_IDS: FeeColumnId[] = ["feeType", "amount", "licenseClasses", "isActive"];

const DEFAULT_FILTERS: FeeFilters = {
  activity: "active",
  feeType: "all",
};

function formatAmount(value: number): string {
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function buildColumns(): FeeColumnDef[] {
  return [
    {
      id: "feeType",
      labelKey: "settings.fees.columns.feeType",
      sortField: "feeType",
      renderCell: (fee) => <strong>{FEE_TYPE_LABELS[fee.feeType] ?? fee.feeType}</strong>,
      skeletonWidth: 200,
    },
    {
      id: "amount",
      labelKey: "settings.fees.columns.amount",
      sortField: "amount",
      renderCell: (fee) => formatAmount(fee.amount),
      skeletonWidth: 80,
    },
    {
      id: "licenseClasses",
      labelKey: "settings.fees.columns.licenseClasses",
      renderCell: (fee, totalLicenseClassCount, t) => {
        if (
          totalLicenseClassCount > 0 &&
          fee.licenseClasses.length === totalLicenseClassCount
        ) {
          return <strong>{t("settings.fees.allLicenseClasses")}</strong>;
        }
        return (
          <div className="settings-branch-chips">
            {fee.licenseClasses.length === 0 ? (
              <span className="form-subsection-note">—</span>
            ) : (
              fee.licenseClasses.map((cls) => (
                <span className="settings-branch-chip" key={cls.id}>
                  {cls.code}
                </span>
              ))
            )}
          </div>
        );
      },
      skeletonWidth: 200,
    },
    {
      id: "isActive",
      labelKey: "settings.fees.columns.isActive",
      sortField: "isActive",
      renderCell: (fee, _, t) => (
        <StatusPill
          label={
            fee.isActive
              ? t("settings.fees.filter.isActive.active")
              : t("settings.fees.filter.isActive.inactive")
          }
          status={fee.isActive ? "success" : "manual"}
        />
      ),
      skeletonWidth: 70,
      skeletonKind: "pill",
    },
  ];
}

export function FeesSettingsSection() {
  const { showToast } = useToast();
  const t = useT();
  const { isVisible, toggle: toggleColumn } = useColumnVisibility(
    "settings.fees.columns.v1",
    FEE_COLUMN_IDS
  );

  const [items, setItems] = useState<FeeResponse[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [summary, setSummary] = useState<FeeListSummaryResponse>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchResetKey, setSearchResetKey] = useState(0);
  const [filters, setFilters] = useState<FeeFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sort, setSort] = useState<SortState>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FeeResponse | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [licenseClasses, setLicenseClasses] = useState<LicenseClassDefinitionResponse[]>([]);

  const columns = buildColumns();
  const visibleColumns = columns.filter((column) => isVisible(column.id));

  useEffect(() => {
    const controller = new AbortController();
    getLicenseClassDefinitions(
      { activity: "active", page: 1, pageSize: 1000, sortBy: "displayOrder", sortDir: "asc" },
      controller.signal
    )
      .then((response) => setLicenseClasses(response.items))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const query = {
      activity: filters.activity,
      feeType: filters.feeType !== "all" ? filters.feeType : undefined,
      page,
      pageSize,
      search: search.trim() || undefined,
      ...(sort ? { sortBy: sort.field, sortDir: sort.direction } : {}),
    };

    getFees(query, controller.signal)
      .then((response) => {
        setItems(response.items);
        setTotalCount(response.totalCount);
        setTotalPages(response.totalPages);
        setSummary(response.summary);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        showToast(t("settings.fees.toast.loadError"), "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [filters, page, pageSize, refreshKey, search, showToast, sort, t]);

  const counts = useMemo(
    () => ({
      total: totalCount,
      active: summary.activeCount,
      inactive: summary.inactiveCount,
    }),
    [summary, totalCount]
  );

  const hasActiveFilters =
    search.trim().length > 0 ||
    filters.activity !== DEFAULT_FILTERS.activity ||
    filters.feeType !== DEFAULT_FILTERS.feeType;

  const setFilter = <K extends keyof FeeFilters>(key: K, value: FeeFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const handleSortToggle = (field: FeeSortField) => {
    setPage(1);
    setSort((current) => {
      if (!current || current.field !== field) return { field, direction: "asc" };
      if (current.direction === "asc") return { field, direction: "desc" };
      return null;
    });
  };

  const handleColumnToggle = (id: string) => {
    const column = columns.find((item) => item.id === id);
    if (column?.sortField && isVisible(id) && sort?.field === column.sortField) {
      setSort(null);
    }
    if (isVisible(id)) {
      if (id === "isActive") setFilter("activity", DEFAULT_FILTERS.activity);
      if (id === "feeType") setFilter("feeType", DEFAULT_FILTERS.feeType);
    }
    toggleColumn(id);
  };

  const handleSaved = () => {
    setFormOpen(false);
    const wasEditing = editing !== null;
    setEditing(null);
    setRefreshKey((current) => current + 1);
    showToast(
      wasEditing
        ? t("settings.fees.toast.updated")
        : t("settings.fees.toast.created")
    );
  };

  const handleDelete = async (fee: FeeResponse) => {
    setDeletingId(fee.id);
    try {
      await deleteFee(fee.id);
      setConfirmDeleteId(null);
      showToast(t("settings.fees.toast.deleted"));
      if (items.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        setRefreshKey((current) => current + 1);
      }
    } catch {
      showToast(t("settings.fees.toast.deleteError"), "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="settings-section-stack">
        <div className="settings-summary-grid">
          <div className="settings-summary-card">
            <span className="settings-summary-label">{t("settings.fees.summary.total")}</span>
            <strong className="settings-summary-value">{counts.total}</strong>
          </div>
          <div className="settings-summary-card">
            <span className="settings-summary-label">{t("settings.fees.summary.active")}</span>
            <strong className="settings-summary-value">{counts.active}</strong>
          </div>
          <div className="settings-summary-card">
            <span className="settings-summary-label">{t("settings.fees.summary.inactive")}</span>
            <strong className="settings-summary-value">{counts.inactive}</strong>
          </div>
        </div>

        <section className="settings-surface">
          <div className="settings-surface-header">
            <div className="settings-surface-title">{t("settings.fees.title")}</div>
            <div className="settings-module-actions">
              <div className="search-box settings-module-search settings-module-search-compact">
                <SearchInput
                  debounceMs={SEARCH_DEBOUNCE_MS}
                  onChange={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                  placeholder={t("settings.fees.search.placeholder")}
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
                  {t("common.clearFilters")}
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
                {t("settings.fees.button.new")}
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
                        label={t(column.labelKey)}
                        onToggle={handleSortToggle}
                        sort={sort}
                      />
                    ) : (
                      <th key={column.id}>{t(column.labelKey)}</th>
                    )
                  )}
                  <th className="col-picker-th">
                    <ColumnPicker
                      columns={columns.map((column) => ({
                        id: column.id,
                        label: t(column.labelKey),
                      }))}
                      isVisible={isVisible}
                      onToggle={handleColumnToggle}
                      triggerTitle={t("settings.fees.columnPicker.title")}
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
                      {t("settings.fees.empty")}
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id}>
                      {visibleColumns.map((column) => (
                        <td key={column.id}>
                          {column.renderCell(item, licenseClasses.length, t)}
                        </td>
                      ))}
                      <td className="col-picker-td">
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
                                {deletingId === item.id
                                  ? t("settings.fees.action.deleting")
                                  : t("common.delete")}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                aria-label={t("settings.fees.action.edit")}
                                className="icon-btn"
                                onClick={() => {
                                  setEditing(item);
                                  setFormOpen(true);
                                }}
                                title={t("settings.fees.action.edit")}
                                type="button"
                              >
                                <PencilIcon size={14} />
                              </button>
                              <button
                                aria-label={t("settings.fees.action.delete")}
                                className="icon-btn icon-btn-danger"
                                disabled={deletingId !== null}
                                onClick={() => setConfirmDeleteId(item.id)}
                                title={t("settings.fees.action.delete")}
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

      <FeeFormModal
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
  field: FeeSortField;
  filterControl?: React.ReactNode;
  label: string;
  sort: SortState;
  onToggle: (field: FeeSortField) => void;
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

function buildColumnFilterControl(
  columnId: FeeColumnId,
  filters: FeeFilters,
  setFilter: <K extends keyof FeeFilters>(key: K, value: FeeFilters[K]) => void,
  t: ReturnType<typeof useT>
) {
  if (columnId === "isActive") {
    return (
      <TableHeaderFilter
        active={filters.activity !== DEFAULT_FILTERS.activity}
        onChange={(nextValue) => setFilter("activity", nextValue as FeeActivityFilter)}
        options={[
          { value: "active", label: t("settings.fees.filter.isActive.active") },
          { value: "all", label: t("common.all") },
          { value: "inactive", label: t("settings.fees.filter.isActive.inactive") },
        ]}
        title={t("settings.fees.filter.isActive.title")}
        value={filters.activity}
      />
    );
  }

  if (columnId === "feeType") {
    return (
      <TableHeaderFilter
        active={filters.feeType !== DEFAULT_FILTERS.feeType}
        onChange={(nextValue) => setFilter("feeType", nextValue as FeeFilters["feeType"])}
        options={[
          { value: "all", label: t("common.all") },
          ...FEE_TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
        ]}
        title={t("settings.fees.filter.feeType.title")}
        value={filters.feeType}
      />
    );
  }

  return null;
}
