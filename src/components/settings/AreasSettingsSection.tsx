import { useEffect, useMemo, useState } from "react";

import { PencilIcon, PlusIcon, TrashIcon } from "../icons";
import { AreaFormModal } from "../modals/AreaFormModal";
import { ColumnPicker, type ColumnOption } from "../ui/ColumnPicker";
import { Pagination } from "../ui/Pagination";
import { SearchInput } from "../ui/SearchInput";
import { StatusPill } from "../ui/StatusPill";
import { TableHeaderFilter } from "../ui/TableHeaderFilter";
import { useToast } from "../ui/Toast";
import {
  deleteArea,
  getAreas,
  type AreaActivityFilter,
  type AreaSortDirection,
  type AreaSortField,
} from "../../lib/areas-api";
import { AREA_TYPE_LABELS, AREA_TYPE_OPTIONS } from "../../lib/area-catalog";
import type {
  AreaListSummaryResponse,
  AreaResponse,
  AreaType,
} from "../../lib/types";
import { useColumnVisibility } from "../../lib/use-column-visibility";

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const SEARCH_DEBOUNCE_MS = 300;
type SortState = { field: AreaSortField; direction: AreaSortDirection } | null;
type AreaFilterValue<T extends string> = T | "all";
type AreaFilters = {
  activity: AreaActivityFilter;
  areaType: AreaFilterValue<AreaType>;
};
type AreaColumnId =
  | "code"
  | "name"
  | "areaType"
  | "capacity"
  | "district"
  | "isActive";
type AreaColumnDef = {
  id: AreaColumnId;
  label: string;
  sortField?: AreaSortField;
  renderCell: (area: AreaResponse) => React.ReactNode;
  skeletonWidth: number;
  skeletonKind?: "line" | "pill";
};

const EMPTY_SUMMARY: AreaListSummaryResponse = {
  activeCount: 0,
  classroomCount: 0,
  practiceTrackCount: 0,
  examAreaCount: 0,
};

function formatCapacity(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return `${value} kişi`;
}

const AREA_COLUMNS: AreaColumnDef[] = [
  {
    id: "code",
    label: "Kod",
    sortField: "code",
    renderCell: (area) => <strong>{area.code}</strong>,
    skeletonWidth: 76,
  },
  {
    id: "name",
    label: "Alan",
    sortField: "name",
    renderCell: (area) => (
      <div>
        {area.name}
        {area.address ? <div className="settings-table-secondary">{area.address}</div> : null}
      </div>
    ),
    skeletonWidth: 200,
  },
  {
    id: "areaType",
    label: "Tip",
    sortField: "areaType",
    renderCell: (area) => AREA_TYPE_LABELS[area.areaType],
    skeletonWidth: 140,
  },
  {
    id: "capacity",
    label: "Kapasite",
    sortField: "capacity",
    renderCell: (area) => formatCapacity(area.capacity),
    skeletonWidth: 80,
  },
  {
    id: "district",
    label: "Bölge",
    sortField: "district",
    renderCell: (area) => area.district ?? "-",
    skeletonWidth: 110,
  },
  {
    id: "isActive",
    label: "Genel Durum",
    sortField: "isActive",
    renderCell: (area) => (
      <StatusPill
        label={area.isActive ? "Aktif" : "Pasif"}
        status={area.isActive ? "success" : "manual"}
      />
    ),
    skeletonWidth: 74,
    skeletonKind: "pill",
  },
];
const AREA_COLUMN_IDS = AREA_COLUMNS.map((column) => column.id);
const AREA_COLUMN_PICKER_OPTIONS: ColumnOption[] = AREA_COLUMNS.map((column) => ({
  id: column.id,
  label: column.label,
}));
const DEFAULT_FILTERS: AreaFilters = {
  activity: "active",
  areaType: "all",
};

export function AreasSettingsSection() {
  const { showToast } = useToast();
  const { isVisible, toggle: toggleColumn } = useColumnVisibility(
    "settings.areas.columns.v1",
    AREA_COLUMN_IDS
  );

  const [items, setItems] = useState<AreaResponse[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [summary, setSummary] = useState<AreaListSummaryResponse>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchResetKey, setSearchResetKey] = useState(0);
  const [filters, setFilters] = useState<AreaFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sort, setSort] = useState<SortState>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AreaResponse | null>(null);
  const [confirmDeleteAreaId, setConfirmDeleteAreaId] = useState<string | null>(null);
  const [deletingAreaId, setDeletingAreaId] = useState<string | null>(null);
  const visibleColumns = AREA_COLUMNS.filter((column) => isVisible(column.id));

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const query = {
      activity: filters.activity,
      page,
      pageSize,
      search: search.trim() || undefined,
      areaType: filters.areaType !== "all" ? filters.areaType : undefined,
      ...(sort ? { sortBy: sort.field, sortDir: sort.direction } : {}),
    };

    getAreas(query, controller.signal)
      .then((response) => {
        setItems(response.items);
        setTotalCount(response.totalCount);
        setTotalPages(response.totalPages);
        setSummary(response.summary);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        showToast("Alan listesi yüklenemedi", "error");
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
      classroom: summary.classroomCount,
      practiceTrack: summary.practiceTrackCount,
      examArea: summary.examAreaCount,
    };
  }, [summary, totalCount]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    filters.activity !== DEFAULT_FILTERS.activity ||
    filters.areaType !== DEFAULT_FILTERS.areaType;

  const handleSaved = (_saved: AreaResponse) => {
    setFormOpen(false);
    setEditing(null);
    setRefreshKey((current) => current + 1);
    showToast(editing ? "Alan kaydı güncellendi" : "Alan kaydı oluşturuldu");
  };

  const handleSortToggle = (field: AreaSortField) => {
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
    const column = AREA_COLUMNS.find((item) => item.id === id);
    if (column?.sortField && isVisible(id) && sort?.field === column.sortField) {
      setSort(null);
    }
    if (isVisible(id)) {
      if (id === "isActive") {
        setFilter("activity", DEFAULT_FILTERS.activity);
      } else if (id === "areaType") {
        setFilter("areaType", DEFAULT_FILTERS.areaType);
      }
    }
    toggleColumn(id);
  };

  const setFilter = <K extends keyof AreaFilters>(
    key: K,
    value: AreaFilters[K]
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const handleDelete = async (area: AreaResponse) => {
    setDeletingAreaId(area.id);
    try {
      await deleteArea(area.id);
      setConfirmDeleteAreaId(null);
      showToast("Alan silindi");
      if (items.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        setRefreshKey((current) => current + 1);
      }
    } catch {
      showToast("Alan silinemedi", "error");
    } finally {
      setDeletingAreaId(null);
    }
  };

  return (
    <>
      <div className="settings-section-stack">
        <div className="settings-summary-grid">
          <div className="settings-summary-card">
            <span className="settings-summary-label">Toplam Alan</span>
            <strong className="settings-summary-value">{counts.total}</strong>
          </div>
          <div className="settings-summary-card">
            <span className="settings-summary-label">Aktif</span>
            <strong className="settings-summary-value">{counts.active}</strong>
          </div>
          <div className="settings-summary-card">
            <span className="settings-summary-label">Sınıf</span>
            <strong className="settings-summary-value">{counts.classroom}</strong>
          </div>
          <div className="settings-summary-card">
            <span className="settings-summary-label">Saha / Sınav</span>
            <strong className="settings-summary-value">{counts.practiceTrack + counts.examArea}</strong>
          </div>
        </div>

        <section className="settings-surface">
          <div className="settings-surface-header">
            <div className="settings-surface-title">Alan Listesi</div>
            <div className="settings-module-actions">
              <div className="search-box settings-module-search settings-module-search-compact">
                <SearchInput
                  debounceMs={SEARCH_DEBOUNCE_MS}
                  onChange={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                  placeholder="Kod, ad, bölge veya adres ara"
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
                Yeni Alan
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
                      columns={AREA_COLUMN_PICKER_OPTIONS}
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
                      Alan kaydı bulunmuyor.
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
                            confirmDeleteAreaId === item.id
                              ? "table-row-actions table-row-actions-confirm"
                              : "table-row-actions"
                          }
                        >
                          {confirmDeleteAreaId === item.id ? (
                            <>
                              <button
                                className="btn btn-secondary btn-sm"
                                disabled={deletingAreaId === item.id}
                                onClick={() => setConfirmDeleteAreaId(null)}
                                type="button"
                              >
                                Vazgeç
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                disabled={deletingAreaId === item.id}
                                onClick={() => handleDelete(item)}
                                type="button"
                              >
                                {deletingAreaId === item.id ? "Siliniyor..." : "Sil"}
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
                                disabled={deletingAreaId !== null}
                                onClick={() => setConfirmDeleteAreaId(item.id)}
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

      <AreaFormModal
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
  field: AreaSortField;
  filterControl?: React.ReactNode;
  label: string;
  sort: SortState;
  onToggle: (field: AreaSortField) => void;
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
  columnId: AreaColumnId,
  filters: AreaFilters,
  setFilter: <K extends keyof AreaFilters>(key: K, value: AreaFilters[K]) => void
) {
  if (columnId === "isActive") {
    return (
      <TableHeaderFilter
        active={filters.activity !== DEFAULT_FILTERS.activity}
        onChange={(nextValue) => setFilter("activity", nextValue as AreaActivityFilter)}
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

  if (columnId === "areaType") {
    return (
      <TableHeaderFilter
        active={filters.areaType !== DEFAULT_FILTERS.areaType}
        onChange={(nextValue) => setFilter("areaType", nextValue as AreaFilters["areaType"])}
        options={[
          { value: "all", label: "Tümü" },
          ...AREA_TYPE_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          })),
        ]}
        title="Alan Tipi filtresi"
        value={filters.areaType}
      />
    );
  }

  return null;
}
