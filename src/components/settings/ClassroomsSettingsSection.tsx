import { useEffect, useMemo, useState } from "react";

import { PencilIcon, PlusIcon, TrashIcon } from "../icons";
import { ClassroomFormModal } from "../modals/ClassroomFormModal";
import { ColumnPicker } from "../ui/ColumnPicker";
import { Pagination } from "../ui/Pagination";
import { SearchInput } from "../ui/SearchInput";
import { StatusPill } from "../ui/StatusPill";
import { TableHeaderFilter } from "../ui/TableHeaderFilter";
import { useToast } from "../ui/Toast";
import { useT, type TranslationKey } from "../../lib/i18n";
import {
  deleteClassroom,
  getClassrooms,
  type ClassroomActivityFilter,
  type ClassroomSortDirection,
  type ClassroomSortField,
} from "../../lib/classrooms-api";
import { getTrainingBranchDefinitions } from "../../lib/training-branch-definitions-api";
import type {
  ClassroomListSummaryResponse,
  ClassroomResponse,
  TrainingBranchDefinitionResponse,
} from "../../lib/types";
import { useColumnVisibility } from "../../lib/use-column-visibility";

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const SEARCH_DEBOUNCE_MS = 300;

type SortState = { field: ClassroomSortField; direction: ClassroomSortDirection } | null;
type ClassroomFilters = {
  activity: ClassroomActivityFilter;
  branchId: string | "all";
};
type ClassroomColumnId = "name" | "capacity" | "branches" | "isActive";
type ClassroomColumnDef = {
  id: ClassroomColumnId;
  labelKey: TranslationKey;
  sortField?: ClassroomSortField;
  renderCell: (classroom: ClassroomResponse) => React.ReactNode;
  skeletonWidth: number;
  skeletonKind?: "line" | "pill";
};

const EMPTY_SUMMARY: ClassroomListSummaryResponse = {
  activeCount: 0,
  inactiveCount: 0,
};

const CLASSROOM_COLUMN_IDS: ClassroomColumnId[] = ["name", "capacity", "branches", "isActive"];

const DEFAULT_FILTERS: ClassroomFilters = {
  activity: "active",
  branchId: "all",
};

function buildColumns(t: ReturnType<typeof useT>): ClassroomColumnDef[] {
  return [
    {
      id: "name",
      labelKey: "settings.classrooms.columns.name",
      sortField: "name",
      renderCell: (classroom) => <strong>{classroom.name}</strong>,
      skeletonWidth: 140,
    },
    {
      id: "capacity",
      labelKey: "settings.classrooms.columns.capacity",
      sortField: "capacity",
      renderCell: (classroom) => classroom.capacity,
      skeletonWidth: 60,
    },
    {
      id: "branches",
      labelKey: "settings.classrooms.columns.branches",
      renderCell: (classroom) => (
        <div className="settings-branch-chips">
          {classroom.branches.length === 0 ? (
            <span className="form-subsection-note">—</span>
          ) : (
            classroom.branches.map((branch) => (
              <span
                className="settings-branch-chip"
                key={branch.id}
                style={{ backgroundColor: `${branch.colorHex}22`, borderColor: branch.colorHex }}
              >
                <span
                  className="settings-color-swatch"
                  style={{ backgroundColor: branch.colorHex }}
                />
                {branch.name}
              </span>
            ))
          )}
        </div>
      ),
      skeletonWidth: 200,
    },
    {
      id: "isActive",
      labelKey: "settings.classrooms.columns.isActive",
      sortField: "isActive",
      renderCell: (classroom) => (
        <StatusPill
          label={
            classroom.isActive
              ? t("settings.classrooms.filter.isActive.active")
              : t("settings.classrooms.filter.isActive.inactive")
          }
          status={classroom.isActive ? "success" : "manual"}
        />
      ),
      skeletonWidth: 70,
      skeletonKind: "pill",
    },
  ];
}

export function ClassroomsSettingsSection() {
  const { showToast } = useToast();
  const t = useT();
  const { isVisible, toggle: toggleColumn } = useColumnVisibility(
    "settings.classrooms.columns.v1",
    CLASSROOM_COLUMN_IDS
  );

  const [items, setItems] = useState<ClassroomResponse[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [summary, setSummary] = useState<ClassroomListSummaryResponse>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchResetKey, setSearchResetKey] = useState(0);
  const [filters, setFilters] = useState<ClassroomFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sort, setSort] = useState<SortState>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClassroomResponse | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [branches, setBranches] = useState<TrainingBranchDefinitionResponse[]>([]);

  const columns = buildColumns(t);
  const visibleColumns = columns.filter((column) => isVisible(column.id));

  useEffect(() => {
    const controller = new AbortController();
    getTrainingBranchDefinitions(
      { activity: "active", page: 1, pageSize: 200 },
      controller.signal
    )
      .then((response) => setBranches(response.items))
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
      branchId: filters.branchId !== "all" ? filters.branchId : undefined,
      page,
      pageSize,
      search: search.trim() || undefined,
      ...(sort ? { sortBy: sort.field, sortDir: sort.direction } : {}),
    };

    getClassrooms(query, controller.signal)
      .then((response) => {
        setItems(response.items);
        setTotalCount(response.totalCount);
        setTotalPages(response.totalPages);
        setSummary(response.summary);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        showToast(t("settings.classrooms.toast.loadError"), "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [filters, page, pageSize, refreshKey, search, showToast, sort, t]);

  const counts = useMemo(() => {
    const totalCapacity = items.reduce((sum, item) => sum + item.capacity, 0);
    return {
      total: totalCount,
      active: summary.activeCount,
      inactive: summary.inactiveCount,
      capacity: totalCapacity,
    };
  }, [items, summary, totalCount]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    filters.activity !== DEFAULT_FILTERS.activity ||
    filters.branchId !== DEFAULT_FILTERS.branchId;

  const setFilter = <K extends keyof ClassroomFilters>(key: K, value: ClassroomFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const handleSortToggle = (field: ClassroomSortField) => {
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
      if (id === "branches") setFilter("branchId", DEFAULT_FILTERS.branchId);
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
        ? t("settings.classrooms.toast.updated")
        : t("settings.classrooms.toast.created")
    );
  };

  const handleDelete = async (classroom: ClassroomResponse) => {
    setDeletingId(classroom.id);
    try {
      await deleteClassroom(classroom.id);
      setConfirmDeleteId(null);
      showToast(t("settings.classrooms.toast.deleted"));
      if (items.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        setRefreshKey((current) => current + 1);
      }
    } catch {
      showToast(t("settings.classrooms.toast.deleteError"), "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="settings-section-stack">
        <div className="settings-summary-grid">
          <div className="settings-summary-card">
            <span className="settings-summary-label">
              {t("settings.classrooms.summary.total")}
            </span>
            <strong className="settings-summary-value">{counts.total}</strong>
          </div>
          <div className="settings-summary-card">
            <span className="settings-summary-label">
              {t("settings.classrooms.summary.active")}
            </span>
            <strong className="settings-summary-value">{counts.active}</strong>
          </div>
          <div className="settings-summary-card">
            <span className="settings-summary-label">
              {t("settings.classrooms.summary.inactive")}
            </span>
            <strong className="settings-summary-value">{counts.inactive}</strong>
          </div>
          <div className="settings-summary-card">
            <span className="settings-summary-label">
              {t("settings.classrooms.summary.totalCapacity")}
            </span>
            <strong className="settings-summary-value">{counts.capacity}</strong>
          </div>
        </div>

        <section className="settings-surface">
          <div className="settings-surface-header">
            <div className="settings-surface-title">{t("settings.classrooms.title")}</div>
            <div className="settings-module-actions">
              <div className="search-box settings-module-search settings-module-search-compact">
                <SearchInput
                  debounceMs={SEARCH_DEBOUNCE_MS}
                  onChange={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                  placeholder={t("settings.classrooms.search.placeholder")}
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
                {t("settings.classrooms.button.new")}
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
                        filterControl={buildColumnFilterControl(
                          column.id,
                          filters,
                          setFilter,
                          branches,
                          t
                        )}
                        key={column.id}
                        label={t(column.labelKey)}
                        onToggle={handleSortToggle}
                        sort={sort}
                      />
                    ) : (
                      <th key={column.id}>
                        <div className="sortable-th-shell">
                          <span>{t(column.labelKey)}</span>
                          {buildColumnFilterControl(column.id, filters, setFilter, branches, t)}
                        </div>
                      </th>
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
                      triggerTitle={t("settings.classrooms.columnPicker.title")}
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
                      {t("settings.classrooms.empty")}
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
                                  ? t("settings.classrooms.action.deleting")
                                  : t("common.delete")}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                aria-label={t("settings.classrooms.action.edit")}
                                className="icon-btn"
                                onClick={() => {
                                  setEditing(item);
                                  setFormOpen(true);
                                }}
                                title={t("settings.classrooms.action.edit")}
                                type="button"
                              >
                                <PencilIcon size={14} />
                              </button>
                              <button
                                aria-label={t("settings.classrooms.action.delete")}
                                className="icon-btn icon-btn-danger"
                                disabled={deletingId !== null}
                                onClick={() => setConfirmDeleteId(item.id)}
                                title={t("settings.classrooms.action.delete")}
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

      <ClassroomFormModal
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
  field: ClassroomSortField;
  filterControl?: React.ReactNode;
  label: string;
  sort: SortState;
  onToggle: (field: ClassroomSortField) => void;
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
  columnId: ClassroomColumnId,
  filters: ClassroomFilters,
  setFilter: <K extends keyof ClassroomFilters>(key: K, value: ClassroomFilters[K]) => void,
  branches: TrainingBranchDefinitionResponse[],
  t: ReturnType<typeof useT>
) {
  if (columnId === "isActive") {
    return (
      <TableHeaderFilter
        active={filters.activity !== DEFAULT_FILTERS.activity}
        onChange={(nextValue) => setFilter("activity", nextValue as ClassroomActivityFilter)}
        options={[
          { value: "active", label: t("settings.classrooms.filter.isActive.active") },
          { value: "all", label: t("common.all") },
          { value: "inactive", label: t("settings.classrooms.filter.isActive.inactive") },
        ]}
        title={t("settings.classrooms.filter.isActive.title")}
        value={filters.activity}
      />
    );
  }

  if (columnId === "branches") {
    return (
      <TableHeaderFilter
        active={filters.branchId !== DEFAULT_FILTERS.branchId}
        onChange={(nextValue) => setFilter("branchId", nextValue as ClassroomFilters["branchId"])}
        options={[
          { value: "all", label: t("common.all") },
          ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
        ]}
        title={t("settings.classrooms.filter.branch.title")}
        value={filters.branchId}
      />
    );
  }

  return null;
}
