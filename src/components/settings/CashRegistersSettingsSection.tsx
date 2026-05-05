import { useEffect, useMemo, useState } from "react";

import { PencilIcon, PlusIcon, TrashIcon } from "../icons";
import { CashRegisterFormModal } from "../modals/CashRegisterFormModal";
import { ColumnPicker } from "../ui/ColumnPicker";
import { Pagination } from "../ui/Pagination";
import { SearchInput } from "../ui/SearchInput";
import { StatusPill } from "../ui/StatusPill";
import { TableHeaderFilter } from "../ui/TableHeaderFilter";
import { useToast } from "../ui/Toast";
import { useT, type TranslationKey } from "../../lib/i18n";
import {
  deleteCashRegister,
  getCashRegisters,
  type CashRegisterActivityFilter,
  type CashRegisterSortDirection,
  type CashRegisterSortField,
} from "../../lib/cash-registers-api";
import type {
  CashRegisterListSummaryResponse,
  CashRegisterResponse,
  CashRegisterType,
} from "../../lib/types";
import { useColumnVisibility } from "../../lib/use-column-visibility";

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const SEARCH_DEBOUNCE_MS = 300;
const CASH_REGISTER_TYPES: CashRegisterType[] = [
  "cash",
  "bank_transfer",
  "credit_card",
  "mail_order",
];

type SortState = { field: CashRegisterSortField; direction: CashRegisterSortDirection } | null;
type CashRegisterFilters = {
  activity: CashRegisterActivityFilter;
  type: CashRegisterType | "all";
};
type CashRegisterColumnId = "name" | "type" | "isActive" | "notes";
type CashRegisterColumnDef = {
  id: CashRegisterColumnId;
  labelKey: TranslationKey;
  sortField?: CashRegisterSortField;
  renderCell: (register: CashRegisterResponse) => React.ReactNode;
  skeletonWidth: number;
  skeletonKind?: "line" | "pill";
};

const EMPTY_SUMMARY: CashRegisterListSummaryResponse = {
  activeCount: 0,
  inactiveCount: 0,
};

const CASH_REGISTER_COLUMN_IDS: CashRegisterColumnId[] = ["name", "type", "isActive", "notes"];

const DEFAULT_FILTERS: CashRegisterFilters = {
  activity: "active",
  type: "all",
};

function buildColumns(t: ReturnType<typeof useT>): CashRegisterColumnDef[] {
  return [
    {
      id: "name",
      labelKey: "settings.cashRegisters.columns.name",
      sortField: "name",
      renderCell: (register) => <strong>{register.name}</strong>,
      skeletonWidth: 140,
    },
    {
      id: "type",
      labelKey: "settings.cashRegisters.columns.type",
      sortField: "type",
      renderCell: (register) => (
        <StatusPill
          label={t(`settings.cashRegisters.type.${register.type}` as TranslationKey)}
          status="manual"
        />
      ),
      skeletonWidth: 90,
      skeletonKind: "pill",
    },
    {
      id: "isActive",
      labelKey: "settings.cashRegisters.columns.isActive",
      sortField: "isActive",
      renderCell: (register) => (
        <StatusPill
          label={
            register.isActive
              ? t("settings.cashRegisters.filter.isActive.active")
              : t("settings.cashRegisters.filter.isActive.inactive")
          }
          status={register.isActive ? "success" : "manual"}
        />
      ),
      skeletonWidth: 70,
      skeletonKind: "pill",
    },
    {
      id: "notes",
      labelKey: "settings.cashRegisters.columns.notes",
      renderCell: (register) => register.notes || <span className="form-subsection-note">—</span>,
      skeletonWidth: 180,
    },
  ];
}

export function CashRegistersSettingsSection() {
  const { showToast } = useToast();
  const t = useT();
  const { isVisible, toggle: toggleColumn } = useColumnVisibility(
    "settings.cashRegisters.columns.v1",
    CASH_REGISTER_COLUMN_IDS
  );

  const [items, setItems] = useState<CashRegisterResponse[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [summary, setSummary] = useState<CashRegisterListSummaryResponse>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchResetKey, setSearchResetKey] = useState(0);
  const [filters, setFilters] = useState<CashRegisterFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sort, setSort] = useState<SortState>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CashRegisterResponse | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const columns = buildColumns(t);
  const visibleColumns = columns.filter((column) => isVisible(column.id));

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    getCashRegisters(
      {
        activity: filters.activity,
        type: filters.type,
        page,
        pageSize,
        search: search.trim() || undefined,
        ...(sort ? { sortBy: sort.field, sortDir: sort.direction } : {}),
      },
      controller.signal
    )
      .then((response) => {
        setItems(response.items);
        setTotalCount(response.totalCount);
        setTotalPages(response.totalPages);
        setSummary(response.summary);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        showToast(t("settings.cashRegisters.toast.loadError"), "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [filters, page, pageSize, refreshKey, search, showToast, sort, t]);

  const counts = useMemo(() => {
    const visibleTypes = new Set(items.map((item) => item.type));
    return {
      total: totalCount,
      active: summary.activeCount,
      inactive: summary.inactiveCount,
      typeCount: visibleTypes.size,
    };
  }, [items, summary, totalCount]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    filters.activity !== DEFAULT_FILTERS.activity ||
    filters.type !== DEFAULT_FILTERS.type;

  const setFilter = <K extends keyof CashRegisterFilters>(
    key: K,
    value: CashRegisterFilters[K]
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const handleSortToggle = (field: CashRegisterSortField) => {
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
      if (id === "type") setFilter("type", DEFAULT_FILTERS.type);
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
        ? t("settings.cashRegisters.toast.updated")
        : t("settings.cashRegisters.toast.created")
    );
  };

  const handleDelete = async (register: CashRegisterResponse) => {
    setDeletingId(register.id);
    try {
      await deleteCashRegister(register.id);
      setConfirmDeleteId(null);
      showToast(t("settings.cashRegisters.toast.deleted"));
      if (items.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        setRefreshKey((current) => current + 1);
      }
    } catch {
      showToast(t("settings.cashRegisters.toast.deleteError"), "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="settings-section-stack">
        <div className="settings-summary-grid">
          <div className="settings-summary-card">
            <span className="settings-summary-label">{t("settings.cashRegisters.summary.total")}</span>
            <strong className="settings-summary-value">{counts.total}</strong>
          </div>
          <div className="settings-summary-card">
            <span className="settings-summary-label">{t("settings.cashRegisters.summary.active")}</span>
            <strong className="settings-summary-value">{counts.active}</strong>
          </div>
          <div className="settings-summary-card">
            <span className="settings-summary-label">{t("settings.cashRegisters.summary.inactive")}</span>
            <strong className="settings-summary-value">{counts.inactive}</strong>
          </div>
          <div className="settings-summary-card">
            <span className="settings-summary-label">{t("settings.cashRegisters.summary.visibleTypes")}</span>
            <strong className="settings-summary-value">{counts.typeCount}</strong>
          </div>
        </div>

        <section className="settings-surface">
          <div className="settings-surface-header">
            <div className="settings-surface-title">{t("settings.cashRegisters.title")}</div>
            <div className="settings-module-actions">
              <div className="search-box settings-module-search settings-module-search-compact">
                <SearchInput
                  debounceMs={SEARCH_DEBOUNCE_MS}
                  onChange={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                  placeholder={t("settings.cashRegisters.search.placeholder")}
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
                {t("settings.cashRegisters.button.new")}
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
                      triggerTitle={t("settings.cashRegisters.columnPicker.title")}
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
                      {t("settings.cashRegisters.empty")}
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id}>
                      {visibleColumns.map((column) => (
                        <td key={column.id}>{column.renderCell(item)}</td>
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
                                  ? t("settings.cashRegisters.action.deleting")
                                  : t("common.delete")}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                aria-label={t("settings.cashRegisters.action.edit")}
                                className="icon-btn"
                                onClick={() => {
                                  setEditing(item);
                                  setFormOpen(true);
                                }}
                                title={t("settings.cashRegisters.action.edit")}
                                type="button"
                              >
                                <PencilIcon size={14} />
                              </button>
                              <button
                                aria-label={t("settings.cashRegisters.action.delete")}
                                className="icon-btn icon-btn-danger"
                                disabled={deletingId !== null}
                                onClick={() => setConfirmDeleteId(item.id)}
                                title={t("settings.cashRegisters.action.delete")}
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

      <CashRegisterFormModal
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
  field: CashRegisterSortField;
  filterControl?: React.ReactNode;
  label: string;
  sort: SortState;
  onToggle: (field: CashRegisterSortField) => void;
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
  columnId: CashRegisterColumnId,
  filters: CashRegisterFilters,
  setFilter: <K extends keyof CashRegisterFilters>(key: K, value: CashRegisterFilters[K]) => void,
  t: ReturnType<typeof useT>
) {
  if (columnId === "isActive") {
    return (
      <TableHeaderFilter
        active={filters.activity !== DEFAULT_FILTERS.activity}
        onChange={(nextValue) => setFilter("activity", nextValue as CashRegisterActivityFilter)}
        options={[
          { value: "active", label: t("settings.cashRegisters.filter.isActive.active") },
          { value: "all", label: t("common.all") },
          { value: "inactive", label: t("settings.cashRegisters.filter.isActive.inactive") },
        ]}
        title={t("settings.cashRegisters.filter.isActive.title")}
        value={filters.activity}
      />
    );
  }

  if (columnId === "type") {
    return (
      <TableHeaderFilter
        active={filters.type !== DEFAULT_FILTERS.type}
        onChange={(nextValue) => setFilter("type", nextValue as CashRegisterFilters["type"])}
        options={[
          { value: "all", label: t("common.all") },
          ...CASH_REGISTER_TYPES.map((type) => ({
            value: type,
            label: t(`settings.cashRegisters.type.${type}` as TranslationKey),
          })),
        ]}
        title={t("settings.cashRegisters.filter.type.title")}
        value={filters.type}
      />
    );
  }

  return null;
}
