import { useEffect, useMemo, useState } from "react";

import { PencilIcon, PlusIcon, TrashIcon } from "../icons";
import { RouteFormModal } from "../modals/RouteFormModal";
import { ColumnPicker, type ColumnOption } from "../ui/ColumnPicker";
import { Pagination } from "../ui/Pagination";
import { SearchInput } from "../ui/SearchInput";
import { StatusPill } from "../ui/StatusPill";
import { TableHeaderFilter } from "../ui/TableHeaderFilter";
import { useToast } from "../ui/Toast";
import {
  deleteRoute,
  getRoutes,
  type RouteActivityFilter,
  type RouteSortDirection,
  type RouteSortField,
} from "../../lib/routes-api";
import {
  ROUTE_USAGE_LABELS,
  ROUTE_USAGE_OPTIONS,
} from "../../lib/route-catalog";
import type {
  RouteListSummaryResponse,
  RouteResponse,
  RouteUsageType,
} from "../../lib/types";
import { useColumnVisibility } from "../../lib/use-column-visibility";

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const SEARCH_DEBOUNCE_MS = 300;
type SortState = { field: RouteSortField; direction: RouteSortDirection } | null;
type RouteFilterValue<T extends string> = T | "all";
type RouteFilters = {
  activity: RouteActivityFilter;
  usageType: RouteFilterValue<RouteUsageType>;
};
type RouteColumnId =
  | "code"
  | "name"
  | "usageType"
  | "district"
  | "distanceKm"
  | "estimatedDurationMinutes"
  | "isActive";
type RouteColumnDef = {
  id: RouteColumnId;
  label: string;
  sortField?: RouteSortField;
  renderCell: (route: RouteResponse) => React.ReactNode;
  skeletonWidth: number;
  skeletonKind?: "line" | "pill";
};

const EMPTY_SUMMARY: RouteListSummaryResponse = {
  activeCount: 0,
  practiceRouteCount: 0,
  examRouteCount: 0,
};

function formatDistance(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return `${value.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} km`;
}

function formatDuration(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return `${value} dk`;
}

const ROUTE_COLUMNS: RouteColumnDef[] = [
  {
    id: "code",
    label: "Kod",
    sortField: "code",
    renderCell: (route) => <strong>{route.code}</strong>,
    skeletonWidth: 76,
  },
  {
    id: "name",
    label: "Güzergah",
    sortField: "name",
    renderCell: (route) => (
      <div>
        {route.name}
        {route.startLocation || route.endLocation ? (
          <div className="settings-table-secondary">
            {[route.startLocation, route.endLocation].filter(Boolean).join(" → ")}
          </div>
        ) : null}
      </div>
    ),
    skeletonWidth: 200,
  },
  {
    id: "usageType",
    label: "Kullanım",
    sortField: "usageType",
    renderCell: (route) => ROUTE_USAGE_LABELS[route.usageType],
    skeletonWidth: 120,
  },
  {
    id: "district",
    label: "Bölge",
    sortField: "district",
    renderCell: (route) => route.district ?? "-",
    skeletonWidth: 110,
  },
  {
    id: "distanceKm",
    label: "Mesafe",
    sortField: "distanceKm",
    renderCell: (route) => formatDistance(route.distanceKm),
    skeletonWidth: 70,
  },
  {
    id: "estimatedDurationMinutes",
    label: "Süre",
    sortField: "estimatedDurationMinutes",
    renderCell: (route) => formatDuration(route.estimatedDurationMinutes),
    skeletonWidth: 70,
  },
  {
    id: "isActive",
    label: "Genel Durum",
    sortField: "isActive",
    renderCell: (route) => (
      <StatusPill
        label={route.isActive ? "Aktif" : "Pasif"}
        status={route.isActive ? "success" : "manual"}
      />
    ),
    skeletonWidth: 74,
    skeletonKind: "pill",
  },
];
const ROUTE_COLUMN_IDS = ROUTE_COLUMNS.map((column) => column.id);
const ROUTE_COLUMN_PICKER_OPTIONS: ColumnOption[] = ROUTE_COLUMNS.map((column) => ({
  id: column.id,
  label: column.label,
}));
const DEFAULT_FILTERS: RouteFilters = {
  activity: "active",
  usageType: "all",
};

export function RoutesSettingsSection() {
  const { showToast } = useToast();
  const { isVisible, toggle: toggleColumn } = useColumnVisibility(
    "settings.routes.columns.v1",
    ROUTE_COLUMN_IDS
  );

  const [items, setItems] = useState<RouteResponse[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [summary, setSummary] = useState<RouteListSummaryResponse>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchResetKey, setSearchResetKey] = useState(0);
  const [filters, setFilters] = useState<RouteFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sort, setSort] = useState<SortState>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RouteResponse | null>(null);
  const [confirmDeleteRouteId, setConfirmDeleteRouteId] = useState<string | null>(null);
  const [deletingRouteId, setDeletingRouteId] = useState<string | null>(null);
  const visibleColumns = ROUTE_COLUMNS.filter((column) => isVisible(column.id));

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const query = {
      activity: filters.activity,
      page,
      pageSize,
      search: search.trim() || undefined,
      usageType: filters.usageType !== "all" ? filters.usageType : undefined,
      ...(sort ? { sortBy: sort.field, sortDir: sort.direction } : {}),
    };

    getRoutes(query, controller.signal)
      .then((response) => {
        setItems(response.items);
        setTotalCount(response.totalCount);
        setTotalPages(response.totalPages);
        setSummary(response.summary);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        showToast("Güzergah listesi yüklenemedi", "error");
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
      practice: summary.practiceRouteCount,
      exam: summary.examRouteCount,
    };
  }, [summary, totalCount]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    filters.activity !== DEFAULT_FILTERS.activity ||
    filters.usageType !== DEFAULT_FILTERS.usageType;

  const handleSaved = (_saved: RouteResponse) => {
    setFormOpen(false);
    setEditing(null);
    setRefreshKey((current) => current + 1);
    showToast(editing ? "Güzergah kaydı güncellendi" : "Güzergah kaydı oluşturuldu");
  };

  const handleSortToggle = (field: RouteSortField) => {
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
    const column = ROUTE_COLUMNS.find((item) => item.id === id);
    if (column?.sortField && isVisible(id) && sort?.field === column.sortField) {
      setSort(null);
    }
    if (isVisible(id)) {
      if (id === "isActive") {
        setFilter("activity", DEFAULT_FILTERS.activity);
      } else if (id === "usageType") {
        setFilter("usageType", DEFAULT_FILTERS.usageType);
      }
    }
    toggleColumn(id);
  };

  const setFilter = <K extends keyof RouteFilters>(
    key: K,
    value: RouteFilters[K]
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const handleDelete = async (route: RouteResponse) => {
    setDeletingRouteId(route.id);
    try {
      await deleteRoute(route.id);
      setConfirmDeleteRouteId(null);
      showToast("Güzergah silindi");
      if (items.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        setRefreshKey((current) => current + 1);
      }
    } catch {
      showToast("Güzergah silinemedi", "error");
    } finally {
      setDeletingRouteId(null);
    }
  };

  return (
    <>
      <div className="settings-section-stack">
        <div className="settings-summary-grid">
          <div className="settings-summary-card">
            <span className="settings-summary-label">Toplam Güzergah</span>
            <strong className="settings-summary-value">{counts.total}</strong>
          </div>
          <div className="settings-summary-card">
            <span className="settings-summary-label">Aktif</span>
            <strong className="settings-summary-value">{counts.active}</strong>
          </div>
          <div className="settings-summary-card">
            <span className="settings-summary-label">Uygulama</span>
            <strong className="settings-summary-value">{counts.practice}</strong>
          </div>
          <div className="settings-summary-card">
            <span className="settings-summary-label">Sınav</span>
            <strong className="settings-summary-value">{counts.exam}</strong>
          </div>
        </div>

        <section className="settings-surface">
          <div className="settings-surface-header">
            <div className="settings-surface-title">Güzergah Listesi</div>
            <div className="settings-module-actions">
              <div className="search-box settings-module-search settings-module-search-compact">
                <SearchInput
                  debounceMs={SEARCH_DEBOUNCE_MS}
                  onChange={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                  placeholder="Kod, ad, bölge veya nokta ara"
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
                  Temizle
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
                Yeni Güzergah
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
                        filterControl={buildColumnFilterControl(column.id, filters, setFilter)}
                        key={column.id}
                        label={column.label}
                        onToggle={handleSortToggle}
                        sort={sort}
                      />
                    ) : (
                      <PlainTh
                        filterControl={buildColumnFilterControl(column.id, filters, setFilter)}
                        key={column.id}
                        label={column.label}
                      />
                    )
                  )}
                  <th className="col-picker-th">
                    <ColumnPicker
                      columns={ROUTE_COLUMN_PICKER_OPTIONS}
                      isVisible={isVisible}
                      onToggle={handleColumnToggle}
                      triggerTitle="Sütunlar"
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
                      Güzergah kaydı bulunmuyor.
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
                            confirmDeleteRouteId === item.id
                              ? "table-row-actions table-row-actions-confirm"
                              : "table-row-actions"
                          }
                        >
                          {confirmDeleteRouteId === item.id ? (
                            <>
                              <button
                                className="btn btn-secondary btn-sm"
                                disabled={deletingRouteId === item.id}
                                onClick={() => setConfirmDeleteRouteId(null)}
                                type="button"
                              >
                                Vazgeç
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                disabled={deletingRouteId === item.id}
                                onClick={() => handleDelete(item)}
                                type="button"
                              >
                                {deletingRouteId === item.id ? "Siliniyor..." : "Sil"}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                aria-label="Düzenle"
                                className="icon-btn"
                                onClick={() => {
                                  setEditing(item);
                                  setFormOpen(true);
                                }}
                                title="Düzenle"
                                type="button"
                              >
                                <PencilIcon size={14} />
                              </button>
                              <button
                                aria-label="Sil"
                                className="icon-btn icon-btn-danger"
                                disabled={deletingRouteId !== null}
                                onClick={() => setConfirmDeleteRouteId(item.id)}
                                title="Sil"
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

      <RouteFormModal
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
  field: RouteSortField;
  filterControl?: React.ReactNode;
  label: string;
  sort: SortState;
  onToggle: (field: RouteSortField) => void;
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
  columnId: RouteColumnId,
  filters: RouteFilters,
  setFilter: <K extends keyof RouteFilters>(key: K, value: RouteFilters[K]) => void
) {
  if (columnId === "isActive") {
    return (
      <TableHeaderFilter
        active={filters.activity !== DEFAULT_FILTERS.activity}
        onChange={(nextValue) => setFilter("activity", nextValue as RouteActivityFilter)}
        options={[
          { value: "active", label: "Aktif" },
          { value: "all", label: "Tümü" },
          { value: "inactive", label: "Pasif" },
        ]}
        title="Genel Durum filtresi"
        value={filters.activity}
      />
    );
  }

  if (columnId === "usageType") {
    return (
      <TableHeaderFilter
        active={filters.usageType !== DEFAULT_FILTERS.usageType}
        onChange={(nextValue) => setFilter("usageType", nextValue as RouteFilters["usageType"])}
        options={[
          { value: "all", label: "Tümü" },
          ...ROUTE_USAGE_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          })),
        ]}
        title="Kullanım filtresi"
        value={filters.usageType}
      />
    );
  }

  return null;
}
