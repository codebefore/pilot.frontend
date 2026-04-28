import { useEffect, useMemo, useState } from "react";

import { PencilIcon, PlusIcon, TrashIcon } from "../icons";
import { InstructorFormModal } from "../modals/InstructorFormModal";
import { ColumnPicker } from "../ui/ColumnPicker";
import { Pagination } from "../ui/Pagination";
import { SearchInput } from "../ui/SearchInput";
import { StatusPill } from "../ui/StatusPill";
import { TableHeaderFilter } from "../ui/TableHeaderFilter";
import { useToast } from "../ui/Toast";
import {
  deleteInstructor,
  getInstructors,
  type InstructorActivityFilter,
  type InstructorSortDirection,
  type InstructorSortField,
} from "../../lib/instructors-api";
import { getTrainingBranchDefinitions } from "../../lib/training-branch-definitions-api";
import {
  INSTRUCTOR_EMPLOYMENT_LABELS,
  INSTRUCTOR_EMPLOYMENT_OPTIONS,
  INSTRUCTOR_ROLE_LABELS,
  INSTRUCTOR_ROLE_OPTIONS,
} from "../../lib/instructor-catalog";
import type {
  InstructorBranch,
  InstructorEmploymentType,
  InstructorListSummaryResponse,
  InstructorResponse,
  InstructorRole,
  LicenseClass,
  TrainingBranchDefinitionResponse,
} from "../../lib/types";
import { useT } from "../../lib/i18n";
import { useColumnVisibility } from "../../lib/use-column-visibility";
import {
  type LicenseClassOption,
  useLicenseClassOptions,
} from "../../lib/use-license-class-options";

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const SEARCH_DEBOUNCE_MS = 300;
type SortState = { field: InstructorSortField; direction: InstructorSortDirection } | null;
type InstructorFilterValue<T extends string> = T | "all";
type InstructorFilters = {
  activity: InstructorActivityFilter;
  role: InstructorFilterValue<InstructorRole>;
  employmentType: InstructorFilterValue<InstructorEmploymentType>;
  branch: InstructorFilterValue<InstructorBranch>;
  licenseClass: InstructorFilterValue<LicenseClass>;
};
type InstructorColumnId =
  | "code"
  | "fullName"
  | "role"
  | "employmentType"
  | "branches"
  | "licenseClassCodes"
  | "weeklyLessonHours"
  | "isActive";
type InstructorColumnDef = {
  id: InstructorColumnId;
  label: string;
  sortField?: InstructorSortField;
  renderCell: (instructor: InstructorResponse) => React.ReactNode;
  skeletonWidth: number;
  skeletonKind?: "line" | "pill";
};

const EMPTY_SUMMARY: InstructorListSummaryResponse = {
  activeCount: 0,
  masterInstructorCount: 0,
  specialistInstructorCount: 0,
  practiceBranchCount: 0,
};

type BranchOption = {
  value: InstructorBranch;
  label: string;
};

function getBranchOptions(
  branches: TrainingBranchDefinitionResponse[]
): BranchOption[] {
  return branches.map((branch) => ({
    value: branch.code,
    label: branch.name,
  }));
}

function getBranchLabelMap(branchOptions: BranchOption[]): Record<string, string> {
  return branchOptions.reduce<Record<string, string>>((acc, option) => {
    acc[option.value] = option.label;
    return acc;
  }, {});
}

function getInstructorColumns(
  t: ReturnType<typeof useT>,
  branchLabelMap: Record<string, string>
): InstructorColumnDef[] {
  return [
    {
      id: "code",
      label: t("settings.instructors.table.code"),
      sortField: "code",
      renderCell: (instructor) => <strong>{instructor.code}</strong>,
      skeletonWidth: 76,
    },
    {
      id: "fullName",
      label: t("settings.instructors.table.fullName"),
      sortField: "fullName",
      renderCell: (instructor) => (
        <div>
          {instructor.firstName} {instructor.lastName}
          {instructor.mebbisPermitNo ? (
            <div className="settings-table-secondary">MEBBİS: {instructor.mebbisPermitNo}</div>
          ) : null}
        </div>
      ),
      skeletonWidth: 180,
    },
    {
      id: "role",
      label: t("settings.instructors.table.role"),
      sortField: "role",
      renderCell: (instructor) => INSTRUCTOR_ROLE_LABELS[instructor.role],
      skeletonWidth: 120,
    },
    {
      id: "employmentType",
      label: t("settings.instructors.table.employmentType"),
      sortField: "employmentType",
      renderCell: (instructor) => INSTRUCTOR_EMPLOYMENT_LABELS[instructor.employmentType],
      skeletonWidth: 110,
    },
    {
      id: "branches",
      label: t("settings.instructors.table.branches"),
      sortField: "branch",
      renderCell: (instructor) =>
        instructor.branches
          .map((branch) => branchLabelMap[branch] ?? branch)
          .join(", "),
      skeletonWidth: 160,
    },
    {
      id: "licenseClassCodes",
      label: t("settings.instructors.table.licenseClass"),
      sortField: "licenseClass",
      renderCell: (instructor) => instructor.licenseClassCodes.join(", "),
      skeletonWidth: 78,
    },
    {
      id: "weeklyLessonHours",
      label: t("settings.instructors.table.weeklyLessonHours"),
      sortField: "weeklyLessonHours",
      renderCell: (instructor) => instructor.weeklyLessonHours ?? "-",
      skeletonWidth: 70,
    },
    {
      id: "isActive",
      label: t("settings.instructors.table.status"),
      sortField: "isActive",
      renderCell: (instructor) => (
        <StatusPill
          label={instructor.isActive ? t("settings.instructors.status.active") : t("settings.instructors.status.inactive")}
          status={instructor.isActive ? "success" : "manual"}
        />
      ),
      skeletonWidth: 74,
      skeletonKind: "pill",
    },
  ];
}
const INSTRUCTOR_COLUMN_IDS: InstructorColumnId[] = [
  "code",
  "fullName",
  "role",
  "employmentType",
  "branches",
  "licenseClassCodes",
  "weeklyLessonHours",
  "isActive",
];
const DEFAULT_FILTERS: InstructorFilters = {
  activity: "active",
  role: "all",
  employmentType: "all",
  branch: "all",
  licenseClass: "all",
};

export function InstructorsSettingsSection() {
  const t = useT();
  const { showToast } = useToast();
  const { isVisible, toggle: toggleColumn } = useColumnVisibility(
    "settings.instructors.columns.v1",
    INSTRUCTOR_COLUMN_IDS
  );

  const [items, setItems] = useState<InstructorResponse[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [summary, setSummary] = useState<InstructorListSummaryResponse>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchResetKey, setSearchResetKey] = useState(0);
  const [filters, setFilters] = useState<InstructorFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sort, setSort] = useState<SortState>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InstructorResponse | null>(null);
  const [confirmDeleteInstructorId, setConfirmDeleteInstructorId] = useState<string | null>(null);
  const [deletingInstructorId, setDeletingInstructorId] = useState<string | null>(null);
  const [trainingBranches, setTrainingBranches] = useState<TrainingBranchDefinitionResponse[]>([]);
  const { options: licenseClassOptions } = useLicenseClassOptions();
  const branchOptions = useMemo(() => getBranchOptions(trainingBranches), [trainingBranches]);
  const branchLabelMap = useMemo(() => getBranchLabelMap(branchOptions), [branchOptions]);
  const instructorColumns = useMemo(
    () => getInstructorColumns(t, branchLabelMap),
    [branchLabelMap, t]
  );
  const visibleColumns = instructorColumns.filter((column) => isVisible(column.id));

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const query = {
      activity: filters.activity,
      page,
      pageSize,
      search: search.trim() || undefined,
      role: filters.role !== "all" ? filters.role : undefined,
      employmentType: filters.employmentType !== "all" ? filters.employmentType : undefined,
      branch: filters.branch !== "all" ? filters.branch : undefined,
      licenseClass: filters.licenseClass !== "all" ? filters.licenseClass : undefined,
      ...(sort ? { sortBy: sort.field, sortDir: sort.direction } : {}),
    };

    getInstructors(query, controller.signal)
      .then((response) => {
        setItems(response.items);
        setTotalCount(response.totalCount);
        setTotalPages(response.totalPages);
        setSummary(response.summary);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        showToast(t("settings.instructors.errors.loadFailed"), "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [filters, page, pageSize, refreshKey, search, showToast, sort]);

  useEffect(() => {
    const controller = new AbortController();
    getTrainingBranchDefinitions(
      { activity: "all", page: 1, pageSize: 100 },
      controller.signal
    )
      .then((response) => setTrainingBranches(response.items))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        showToast("Branş tanımları yüklenemedi", "error");
      });

    return () => controller.abort();
  }, [showToast]);

  const counts = useMemo(() => {
    return {
      total: totalCount,
      active: summary.activeCount,
      master: summary.masterInstructorCount,
      practice: summary.practiceBranchCount,
    };
  }, [summary, totalCount]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    filters.activity !== DEFAULT_FILTERS.activity ||
    filters.role !== DEFAULT_FILTERS.role ||
    filters.employmentType !== DEFAULT_FILTERS.employmentType ||
    filters.branch !== DEFAULT_FILTERS.branch ||
    filters.licenseClass !== DEFAULT_FILTERS.licenseClass;

  const handleSaved = (_saved: InstructorResponse) => {
    setFormOpen(false);
    setEditing(null);
    setRefreshKey((current) => current + 1);
    showToast(editing ? t("settings.instructors.toasts.updated") : t("settings.instructors.toasts.created"));
  };

  const handleSortToggle = (field: InstructorSortField) => {
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
    const column = instructorColumns.find((item) => item.id === id);
    if (column?.sortField && isVisible(id) && sort?.field === column.sortField) {
      setSort(null);
    }
    if (isVisible(id)) {
      if (id === "isActive") {
        setFilter("activity", DEFAULT_FILTERS.activity);
      } else if (id === "role") {
        setFilter("role", DEFAULT_FILTERS.role);
      } else if (id === "employmentType") {
        setFilter("employmentType", DEFAULT_FILTERS.employmentType);
      } else if (id === "branches") {
        setFilter("branch", DEFAULT_FILTERS.branch);
      } else if (id === "licenseClassCodes") {
        setFilter("licenseClass", DEFAULT_FILTERS.licenseClass);
      }
    }
    toggleColumn(id);
  };

  const setFilter = <K extends keyof InstructorFilters>(
    key: K,
    value: InstructorFilters[K]
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const handleDelete = async (instructor: InstructorResponse) => {
    setDeletingInstructorId(instructor.id);
    try {
      await deleteInstructor(instructor.id);
      setConfirmDeleteInstructorId(null);
      showToast(t("settings.instructors.toasts.deleted"));
      if (items.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        setRefreshKey((current) => current + 1);
      }
    } catch {
      showToast(t("settings.instructors.errors.deleteFailed"), "error");
    } finally {
      setDeletingInstructorId(null);
    }
  };

  return (
    <>
      <div className="settings-section-stack">
        <div className="settings-summary-grid">
          <div className="settings-summary-card">
            <span className="settings-summary-label">{t("settings.instructors.summary.total")}</span>
            <strong className="settings-summary-value">{counts.total}</strong>
          </div>
          <div className="settings-summary-card">
            <span className="settings-summary-label">{t("settings.instructors.summary.active")}</span>
            <strong className="settings-summary-value">{counts.active}</strong>
          </div>
          <div className="settings-summary-card">
            <span className="settings-summary-label">{t("settings.instructors.summary.masterInstructor")}</span>
            <strong className="settings-summary-value">{counts.master}</strong>
          </div>
          <div className="settings-summary-card">
            <span className="settings-summary-label">{t("settings.instructors.summary.practiceBranch")}</span>
            <strong className="settings-summary-value">{counts.practice}</strong>
          </div>
        </div>

        <section className="settings-surface">
          <div className="settings-surface-header">
            <div className="settings-surface-title">{t("settings.instructors.title")}</div>
            <div className="settings-module-actions">
              <div className="search-box settings-module-search settings-module-search-compact">
                <SearchInput
                  debounceMs={SEARCH_DEBOUNCE_MS}
                  onChange={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                  placeholder={t("settings.instructors.search.placeholder")}
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
                  {t("settings.instructors.actions.clear")}
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
                {t("settings.instructors.actions.new")}
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
                          branchOptions,
                          licenseClassOptions,
                          t
                        )}
                        key={column.id}
                        label={column.label}
                        onToggle={handleSortToggle}
                        sort={sort}
                      />
                    ) : (
                      <PlainTh
                        filterControl={buildColumnFilterControl(
                          column.id,
                          filters,
                          setFilter,
                          branchOptions,
                          licenseClassOptions,
                          t
                        )}
                        key={column.id}
                        label={column.label}
                      />
                    )
                  )}
                  <th className="col-picker-th">
                    <ColumnPicker
                      columns={instructorColumns.map((column) => ({
                        id: column.id,
                        label: column.label,
                      }))}
                      isVisible={isVisible}
                      onToggle={handleColumnToggle}
                      triggerTitle={t("settings.instructors.columnPicker.title")}
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
                      {t("settings.instructors.empty")}
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
                            confirmDeleteInstructorId === item.id
                              ? "table-row-actions table-row-actions-confirm"
                              : "table-row-actions"
                          }
                        >
                          {confirmDeleteInstructorId === item.id ? (
                            <>
                              <button
                                className="btn btn-secondary btn-sm"
                                disabled={deletingInstructorId === item.id}
                                onClick={() => setConfirmDeleteInstructorId(null)}
                                type="button"
                              >
                                {t("common.cancel")}
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                disabled={deletingInstructorId === item.id}
                                onClick={() => handleDelete(item)}
                                type="button"
                              >
                                {deletingInstructorId === item.id ? t("settings.instructors.actions.deleting") : t("common.delete")}
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
                                disabled={deletingInstructorId !== null}
                                onClick={() => setConfirmDeleteInstructorId(item.id)}
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

      <InstructorFormModal
        branchOptions={branchOptions}
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
  field: InstructorSortField;
  filterControl?: React.ReactNode;
  label: string;
  sort: SortState;
  onToggle: (field: InstructorSortField) => void;
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
  columnId: InstructorColumnId,
  filters: InstructorFilters,
  setFilter: <K extends keyof InstructorFilters>(key: K, value: InstructorFilters[K]) => void,
  branchOptions: BranchOption[],
  licenseClassOptions: LicenseClassOption[],
  t: ReturnType<typeof useT>
) {
  if (columnId === "isActive") {
    return (
      <TableHeaderFilter
        active={filters.activity !== DEFAULT_FILTERS.activity}
        onChange={(nextValue) => setFilter("activity", nextValue as InstructorActivityFilter)}
        options={[
          { value: "active", label: t("settings.instructors.status.active") },
          { value: "all", label: t("common.all") },
          { value: "inactive", label: t("settings.instructors.status.inactive") },
        ]}
        title={t("settings.instructors.filters.statusTitle")}
        value={filters.activity}
      />
    );
  }

  if (columnId === "role") {
    return (
      <TableHeaderFilter
        active={filters.role !== DEFAULT_FILTERS.role}
        onChange={(nextValue) => setFilter("role", nextValue as InstructorFilters["role"])}
        options={[
          { value: "all", label: t("common.all") },
          ...INSTRUCTOR_ROLE_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          })),
        ]}
        title={t("settings.instructors.filters.roleTitle")}
        value={filters.role}
      />
    );
  }

  if (columnId === "employmentType") {
    return (
      <TableHeaderFilter
        active={filters.employmentType !== DEFAULT_FILTERS.employmentType}
        onChange={(nextValue) =>
          setFilter("employmentType", nextValue as InstructorFilters["employmentType"])
        }
        options={[
          { value: "all", label: t("common.all") },
          ...INSTRUCTOR_EMPLOYMENT_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          })),
        ]}
        title={t("settings.instructors.filters.employmentTypeTitle")}
        value={filters.employmentType}
      />
    );
  }

  if (columnId === "branches") {
    return (
      <TableHeaderFilter
        active={filters.branch !== DEFAULT_FILTERS.branch}
        onChange={(nextValue) => setFilter("branch", nextValue as InstructorFilters["branch"])}
        options={[
          { value: "all", label: t("common.all") },
          ...branchOptions.map((option) => ({
            value: option.value,
            label: option.label,
          })),
        ]}
        title={t("settings.instructors.filters.branchTitle")}
        value={filters.branch}
      />
    );
  }

  if (columnId === "licenseClassCodes") {
    return (
      <TableHeaderFilter
        active={filters.licenseClass !== DEFAULT_FILTERS.licenseClass}
        onChange={(nextValue) =>
          setFilter("licenseClass", nextValue as InstructorFilters["licenseClass"])
        }
        options={[
          { value: "all", label: t("common.all") },
          ...licenseClassOptions.map((option) => ({
            value: option.value,
            label: option.label,
          })),
        ]}
        title={t("settings.instructors.filters.licenseClassTitle")}
        value={filters.licenseClass}
      />
    );
  }

  return null;
}
