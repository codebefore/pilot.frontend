import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";

import { MebIcon, PencilIcon, PlusIcon, TrashIcon } from "../icons";
import { InstructorFormModal } from "../modals/InstructorFormModal";
import { ColumnPicker } from "../ui/ColumnPicker";
import { InstructorAvatar } from "../ui/InstructorAvatar";
import { Pagination } from "../ui/Pagination";
import { SearchInput } from "../ui/SearchInput";
import { StatusPill } from "../ui/StatusPill";
import { TableHeaderFilter } from "../ui/TableHeaderFilter";
import { useToast } from "../ui/Toast";
import { useAuth } from "../../lib/auth";
import { canManageArea } from "../../lib/permissions";
import { candidateKeys } from "../../lib/queries/use-candidates";
import {
  createInstructor,
  deleteInstructor,
  getInstructors,
  markInstructorLeft,
  updateInstructor,
  uploadInstructorPhoto,
  type InstructorActivityFilter,
  type InstructorSortDirection,
  type InstructorSortField,
} from "../../lib/instructors-api";
import {
  createAssignment,
  listAssignments,
  updateAssignment,
} from "../../lib/instructor-assignments-api";
import { ApiError } from "../../lib/http";
import {
  createInstructorInventoryImportJob,
  getMebbisJob,
  type MebbisJobResponse,
} from "../../lib/mebbis-jobs-api";
import { getTrainingBranchDefinitions } from "../../lib/training-branch-definitions-api";
import {
  INSTRUCTOR_EMPLOYMENT_LABEL_KEYS,
  INSTRUCTOR_EMPLOYMENT_OPTIONS,
  INSTRUCTOR_ROLE_LABEL_KEYS,
  INSTRUCTOR_ROLE_OPTIONS,
} from "../../lib/instructor-catalog";
import type {
  InstructorAssignmentUpsertRequest,
  InstructorBranch,
  InstructorCreateRequest,
  InstructorEmploymentType,
  InstructorListSummaryResponse,
  InstructorResponse,
  InstructorRole,
  InstructorUpsertRequest,
  LicenseClass,
  TrainingBranchDefinitionResponse,
} from "../../lib/types";
import { useT } from "../../lib/i18n";
import { formatDateTR } from "../../lib/status-maps";
import { useColumnVisibility } from "../../lib/use-column-visibility";
import {
  mergeLicenseClassOptionsWithValues,
  type LicenseClassOption,
  useLicenseClassOptions,
} from "../../lib/use-license-class-options";

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const SEARCH_DEBOUNCE_MS = 300;
const MEBBIS_INSTRUCTOR_POLL_INTERVAL_MS = 2000;
const MEBBIS_INSTRUCTOR_POLL_TIMEOUT_MS = 60_000;
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
  | "fullName"
  | "role"
  | "employmentType"
  | "branches"
  | "licenseClassCodes"
  | "weeklyLessonHours"
  | "contractEndDate"
  | "leaveReason"
  | "isActive";

type MebbisInstructorInventoryRow = {
  nationalId?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  fullName?: unknown;
  role?: unknown;
  branch?: unknown;
  licenseClass?: unknown;
  licenseClasses?: unknown;
  mebbisPermitNo?: unknown;
  contractStartDate?: unknown;
  contractEndDate?: unknown;
  leftAtDate?: unknown;
  weeklyLessonHours?: unknown;
  phoneNumber?: unknown;
  email?: unknown;
  photoDataUrl?: unknown;
  employmentStatus?: unknown;
  educationInfo?: unknown;
  status?: unknown;
};

type MebbisInstructorInventoryResult = {
  instructors?: MebbisInstructorInventoryRow[];
};

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const target = new Date(iso.slice(0, 10) + "T00:00:00Z").getTime();
  if (!Number.isFinite(target)) return null;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}
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
      id: "fullName",
      label: t("settings.instructors.table.fullName"),
      sortField: "fullName",
      renderCell: (instructor) => (
        <div className="instructor-row-name">
          <InstructorAvatar instructor={instructor} size={32} />
          <div>
            {instructor.firstName} {instructor.lastName}
          </div>
        </div>
      ),
      skeletonWidth: 220,
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
    {
      id: "contractEndDate",
      label: t("settings.instructors.table.contractEndDate"),
      renderCell: (instructor) => {
        if (!instructor.contractEndDate) return "—";
        const days = daysUntil(instructor.contractEndDate);
        const tone =
          days == null ? "default" : days < 0 ? "expired" : days <= 10 ? "warning" : "default";
        return (
          <div className={`instructor-contract-end instructor-contract-end--${tone}`}>
            <span>{formatDateTR(instructor.contractEndDate)}</span>
            {days != null && days >= 0 && days <= 30 ? (
              <span className="instructor-contract-end-days">{days} gün</span>
            ) : null}
            {days != null && days < 0 ? (
              <span className="instructor-contract-end-days">geçti</span>
            ) : null}
          </div>
        );
      },
      skeletonWidth: 110,
    },
    {
      id: "role",
      label: t("settings.instructors.table.role"),
      sortField: "role",
      renderCell: (instructor) => t(INSTRUCTOR_ROLE_LABEL_KEYS[instructor.role]),
      skeletonWidth: 120,
    },
    {
      id: "employmentType",
      label: t("settings.instructors.table.employmentType"),
      sortField: "employmentType",
      renderCell: (instructor) => t(INSTRUCTOR_EMPLOYMENT_LABEL_KEYS[instructor.employmentType]),
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
      id: "leaveReason",
      label: t("settings.instructors.table.leaveReason"),
      renderCell: (instructor) => {
        if (!instructor.leftAtDate) return "—";
        const date = formatDateTR(instructor.leftAtDate);
        return (
          <div className="instructor-leave-cell">
            <div className="instructor-leave-cell-date">{date}</div>
            {instructor.leaveReason ? (
              <div className="instructor-leave-cell-reason" title={instructor.leaveReason}>
                {instructor.leaveReason}
              </div>
            ) : null}
          </div>
        );
      },
      skeletonWidth: 140,
    },
  ];
}
const INSTRUCTOR_COLUMN_IDS: InstructorColumnId[] = [
  "fullName",
  "isActive",
  "contractEndDate",
  "role",
  "employmentType",
  "branches",
  "licenseClassCodes",
  "weeklyLessonHours",
  "leaveReason",
];
const DEFAULT_INSTRUCTOR_VISIBLE_COLUMNS: InstructorColumnId[] = [
  "fullName",
  "isActive",
  "contractEndDate",
  "role",
  "employmentType",
  "branches",
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
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { user, permissions } = useAuth();
  const canManageTraining = canManageArea(user, permissions, "training");
  const noPermissionTitle = t("common.noPermission");
  const { isVisible, toggle: toggleColumn } = useColumnVisibility(
    "settings.instructors.columns.v2",
    INSTRUCTOR_COLUMN_IDS,
    DEFAULT_INSTRUCTOR_VISIBLE_COLUMNS
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
  const [importingMebbisInstructors, setImportingMebbisInstructors] = useState(false);
  const [trainingBranches, setTrainingBranches] = useState<TrainingBranchDefinitionResponse[]>([]);
  const { options: licenseClassOptions } = useLicenseClassOptions();
  const filterLicenseClassOptions = useMemo(
    () =>
      mergeLicenseClassOptionsWithValues(
        licenseClassOptions,
        [
          filters.licenseClass !== "all" ? filters.licenseClass : null,
          ...items.flatMap((instructor) => instructor.licenseClassCodes),
        ]
      ),
    [filters.licenseClass, items, licenseClassOptions]
  );
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
      { activity: "active", page: 1, pageSize: 100 },
      controller.signal
    )
      .then((response) => setTrainingBranches(response.items))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        showToast(t("instructorsSettings.toast.branchLoadFailed"), "error");
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

  const invalidateInstructorDependents = () => {
    void queryClient.invalidateQueries({ queryKey: ["training", "instructors"] });
    void queryClient.invalidateQueries({ queryKey: ["training", "lessons"] });
    void queryClient.invalidateQueries({ queryKey: ["instructors", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["instructors", "detail"] });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const detailReturnState = useMemo(
    () => ({
      returnLabel: `← ${t("settings.instructors.detail.backToList")}`,
      returnTo: `${location.pathname}${location.search}`,
    }),
    [location.pathname, location.search, t]
  );

  const handleSaved = (saved: InstructorResponse) => {
    const wasCreate = !editing;
    setFormOpen(false);
    setEditing(null);
    setRefreshKey((current) => current + 1);
    invalidateInstructorDependents();
    showToast(editing ? t("settings.instructors.toasts.updated") : t("settings.instructors.toasts.created"));
    if (wasCreate) {
      navigate(`/settings/definitions/instructors/${saved.id}?newAssignment=1`, {
        state: detailReturnState,
      });
    }
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
    if (!canManageTraining) return;
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
      invalidateInstructorDependents();
    } catch {
      showToast(t("settings.instructors.errors.deleteFailed"), "error");
    } finally {
      setDeletingInstructorId(null);
    }
  };

  const applyMebbisInstructorInventory = async (job: MebbisJobResponse) => {
    const result = parseMebbisInstructorInventoryResult(job);
    const importedRows = result?.instructors?.filter(isReadableMebbisInstructorRow) ?? [];
    if (importedRows.length === 0) {
      showToast(t("settings.instructors.mebbisImportCompleted"));
      return;
    }

    const existingResponse = await getInstructors({ activity: "all", page: 1, pageSize: 1000 });
    const existingByNationalId = new Map(
      existingResponse.items
        .filter((instructor) => instructor.nationalId)
        .map((instructor) => [normalizeDigits(instructor.nationalId ?? ""), instructor])
    );
    const existingByName = new Map(
      existingResponse.items.map((instructor) => [
        normalizeComparable(`${instructor.firstName} ${instructor.lastName}`),
        instructor,
      ])
    );

    let createdCount = 0;
    let updatedCount = 0;
    for (const imported of importedRows) {
      const nationalId = normalizeDigits(readMebbisString(imported.nationalId));
      const fullNameKey = normalizeComparable(readMebbisFullName(imported));
      const existing =
        (nationalId ? existingByNationalId.get(nationalId) : undefined) ??
        existingByName.get(fullNameKey);
      const request = buildInstructorUpsertRequest(imported, existing);
      if (!request) continue;

      if (!existing) {
        const saved = await createInstructor(request);
        await uploadMebbisInstructorPhotoIfNeeded(saved, imported);
        createdCount += 1;
        if (saved.nationalId) existingByNationalId.set(normalizeDigits(saved.nationalId), saved);
        existingByName.set(normalizeComparable(`${saved.firstName} ${saved.lastName}`), saved);
      } else {
        const updateRequest: InstructorUpsertRequest = {
          firstName: request.firstName,
          lastName: request.lastName,
          nationalId: request.nationalId,
          phoneNumber: request.phoneNumber,
          email: request.email,
          isActive: request.isActive,
          assignedVehicleId: request.assignedVehicleId,
          notes: request.notes,
          rowVersion: existing.rowVersion,
        };
        const saved = await updateInstructor(existing.id, updateRequest);
        await upsertMebbisInstructorAssignment(saved, imported);
        await applyMebbisInstructorLeaveState(saved, imported);
        await uploadMebbisInstructorPhotoIfNeeded(saved, imported);
        updatedCount += 1;
        if (saved.nationalId) existingByNationalId.set(normalizeDigits(saved.nationalId), saved);
        existingByName.set(normalizeComparable(`${saved.firstName} ${saved.lastName}`), saved);
      }
    }

    setRefreshKey((current) => current + 1);
    invalidateInstructorDependents();
    showToast(
      t("settings.instructors.mebbisImportApplied", {
        created: String(createdCount),
        updated: String(updatedCount),
      })
    );
  };

  const pollMebbisInstructorInventoryJob = async (jobId: string, startedAt = Date.now()) => {
    while (Date.now() - startedAt < MEBBIS_INSTRUCTOR_POLL_TIMEOUT_MS) {
      await new Promise((resolve) => window.setTimeout(resolve, MEBBIS_INSTRUCTOR_POLL_INTERVAL_MS));
      const job = await getMebbisJob(jobId);
      if (job.status === "succeeded") {
        await applyMebbisInstructorInventory(job);
        void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
        return;
      }

      if (["failed", "needs_manual_action", "cancelled"].includes(job.status)) {
        showToast(t("settings.instructors.mebbisImportNeedsManualAction"), "error");
        void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
        return;
      }
    }

    showToast(t("settings.instructors.mebbisImportStillRunning"));
  };

  const handleMebbisInstructorImport = async () => {
    if (!canManageTraining || importingMebbisInstructors) return;
    setImportingMebbisInstructors(true);
    try {
      const job = await createInstructorInventoryImportJob();
      void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
      showToast(t("settings.instructors.mebbisImportQueued"));
      await pollMebbisInstructorInventoryJob(job.id);
    } catch (error) {
      console.error(error);
      const message =
        error instanceof ApiError
          ? Object.values(error.validationErrors ?? {})[0]?.[0] ??
            t("settings.instructors.mebbisImportFailed")
          : t("settings.instructors.mebbisImportFailed");
      showToast(message, "error");
    } finally {
      setImportingMebbisInstructors(false);
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
                className="btn btn-secondary btn-sm"
                disabled={!canManageTraining || importingMebbisInstructors}
                onClick={handleMebbisInstructorImport}
                title={!canManageTraining ? noPermissionTitle : undefined}
                type="button"
              >
                <MebIcon size={14} />
                {importingMebbisInstructors
                  ? t("settings.instructors.mebbisImportRunning")
                  : t("settings.instructors.mebbisImportButton")}
              </button>
              <button
                className="btn btn-primary btn-sm"
                disabled={!canManageTraining}
                onClick={() => {
                  if (!canManageTraining) return;
                  setEditing(null);
                  setFormOpen(true);
                }}
                title={!canManageTraining ? noPermissionTitle : undefined}
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
                          filterLicenseClassOptions,
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
                          filterLicenseClassOptions,
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
                    <tr
                      className="data-table-row-clickable"
                      key={item.id}
                      onClick={() =>
                        navigate(`/settings/definitions/instructors/${item.id}`, {
                          state: detailReturnState,
                        })
                      }
                    >
                      {visibleColumns.map((column) => (
                        <td key={column.id}>{column.renderCell(item)}</td>
                      ))}
                      <td className="col-picker-td" onClick={(e) => e.stopPropagation()}>
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
                                disabled={deletingInstructorId === item.id || !canManageTraining}
                                onClick={() => handleDelete(item)}
                                title={!canManageTraining ? noPermissionTitle : undefined}
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
                                disabled={!canManageTraining}
                                onClick={() => {
                                  if (!canManageTraining) return;
                                  setEditing(item);
                                  setFormOpen(true);
                                }}
                                title={!canManageTraining ? noPermissionTitle : t("common.edit")}
                                type="button"
                              >
                                <PencilIcon size={14} />
                              </button>
                              <button
                                aria-label={t("common.delete")}
                                className="icon-btn icon-btn-danger"
                                disabled={deletingInstructorId !== null || !canManageTraining}
                                onClick={() => {
                                  if (!canManageTraining) return;
                                  setConfirmDeleteInstructorId(item.id);
                                }}
                                title={!canManageTraining ? noPermissionTitle : t("common.delete")}
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
        canManage={canManageTraining}
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

function parseMebbisInstructorInventoryResult(
  job: MebbisJobResponse
): MebbisInstructorInventoryResult | null {
  if (!job.resultJson) return null;

  try {
    const parsed = JSON.parse(job.resultJson) as MebbisInstructorInventoryResult;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function isReadableMebbisInstructorRow(row: MebbisInstructorInventoryRow): boolean {
  const name = readMebbisFullName(row);
  return name.length > 0 || normalizeDigits(readMebbisString(row.nationalId)).length === 11;
}

function buildInstructorUpsertRequest(
  row: MebbisInstructorInventoryRow,
  existing: InstructorResponse | undefined
): InstructorCreateRequest | null {
  const names = splitInstructorName(row, existing);
  if (!names.firstName || !names.lastName) return null;

  const nationalId = normalizeDigits(readMebbisString(row.nationalId));
  const phoneNumber = normalizeDigits(readMebbisString(row.phoneNumber));
  const email = readMebbisString(row.email);
  const assignmentRequest = buildMebbisInstructorAssignmentRequest(row, existing);

  const request: InstructorCreateRequest = {
    firstName: names.firstName.toLocaleUpperCase("tr-TR"),
    lastName: names.lastName.toLocaleUpperCase("tr-TR"),
    nationalId: nationalId.length === 11 ? nationalId : existing?.nationalId ?? null,
    phoneNumber: phoneNumber || (existing?.phoneNumber ?? null),
    email: email || (existing?.email ?? null),
    isActive: mapMebbisInstructorActive(row.status, existing),
    assignedVehicleId: existing?.assignedVehicleId ?? null,
    notes: mergeInstructorNotes(existing?.notes, row),
  };

  if (!existing) {
    request.initialAssignment = assignmentRequest;
  }

  return request;
}

async function upsertMebbisInstructorAssignment(
  instructor: InstructorResponse,
  row: MebbisInstructorInventoryRow
) {
  const request = buildMebbisInstructorAssignmentRequest(row, instructor);
  if (!request) return;

  const assignments = await listAssignments(instructor.id);
  const permitNo = readMebbisString(row.mebbisPermitNo);
  const matchingAssignment =
    (permitNo
      ? assignments.find((assignment) => assignment.mebPermitNo === permitNo)
      : undefined) ??
    assignments.find(
      (assignment) =>
        assignment.contractStartDate === request.contractStartDate &&
        assignment.role === request.role
    );

  if (!matchingAssignment) {
    await createAssignment(instructor.id, request);
    return;
  }

  await updateAssignment(instructor.id, matchingAssignment.id, {
    ...request,
    rowVersion: matchingAssignment.rowVersion,
  });
}

async function applyMebbisInstructorLeaveState(
  instructor: InstructorResponse,
  row: MebbisInstructorInventoryRow
) {
  const leftAtDate = parseMebbisDate(readMebbisString(row.leftAtDate));
  const status = readMebbisString(row.status);
  if (!leftAtDate || instructor.leftAtDate) return;

  await markInstructorLeft(instructor.id, {
    leftAtDate,
    reason: status || null,
    rowVersion: instructor.rowVersion,
  });
}

async function uploadMebbisInstructorPhotoIfNeeded(
  instructor: InstructorResponse,
  row: MebbisInstructorInventoryRow
) {
  if (instructor.hasPhoto) return;
  const file = buildMebbisInstructorPhotoFile(row, instructor);
  if (!file) return;
  await uploadInstructorPhoto(instructor.id, file);
}

function buildMebbisInstructorPhotoFile(
  row: MebbisInstructorInventoryRow,
  instructor: InstructorResponse
): File | null {
  const dataUrl = readMebbisString(row.photoDataUrl);
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;

  const contentType = match[1];
  const extension = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";
  try {
    const binary = window.atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new File(
      [bytes],
      `${normalizeComparable(`${instructor.firstName}-${instructor.lastName}`) || "mebbis-photo"}.${extension}`,
      { type: contentType }
    );
  } catch {
    return null;
  }
}

function buildMebbisInstructorAssignmentRequest(
  row: MebbisInstructorInventoryRow,
  existing: InstructorResponse | undefined
): InstructorAssignmentUpsertRequest {
  const contractStartDate =
    parseMebbisDate(readMebbisString(row.contractStartDate)) ??
    existing?.contractStartDate ??
    todayIsoDate();
  const contractEndDate =
    parseMebbisDate(readMebbisString(row.contractEndDate)) ??
    existing?.contractEndDate ??
    null;
  const branches = mapMebbisInstructorBranches(row.branch);
  const licenseClassCodes = readMebbisLicenseClasses(row);

  return {
    role: mapMebbisInstructorRole(row.role),
    employmentType: mapMebbisInstructorEmploymentType(row.employmentStatus),
    branches,
    licenseClassCodes:
      licenseClassCodes.length > 0
        ? licenseClassCodes
        : existing?.licenseClassCodes.length
          ? existing.licenseClassCodes
          : ["B" as LicenseClass],
    weeklyLessonHours: readMebbisNumber(row.weeklyLessonHours),
    mebPermitNo: readMebbisString(row.mebbisPermitNo) || null,
    contractStartDate,
    contractEndDate,
  };
}

function splitInstructorName(
  row: MebbisInstructorInventoryRow,
  existing: InstructorResponse | undefined
): { firstName: string; lastName: string } {
  const firstName = readMebbisString(row.firstName);
  const lastName = readMebbisString(row.lastName);
  if (firstName && lastName) return { firstName, lastName };
  const fullName = readMebbisFullName(row);
  const parts = fullName.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return {
      firstName: parts.slice(0, -1).join(" "),
      lastName: parts.slice(-1)[0],
    };
  }

  return {
    firstName: firstName || existing?.firstName || "",
    lastName: lastName || existing?.lastName || "",
  };
}

function readMebbisFullName(row: MebbisInstructorInventoryRow): string {
  return (
    readMebbisString(row.fullName) ||
    [readMebbisString(row.firstName), readMebbisString(row.lastName)].filter(Boolean).join(" ")
  ).trim();
}

function readMebbisString(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function readMebbisNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number.parseInt(normalizeDigits(readMebbisString(value)), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function readMebbisStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => readMebbisString(item)).filter(Boolean)
    : [];
}

function normalizeDigits(value: string): string {
  return value.replace(/[^\d]/g, "");
}

function normalizeComparable(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[İI]/g, "I")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C");
}

function parseLicenseClassCode(value: string): LicenseClass | "" {
  return normalizeComparable(value)
    .replace(/\bSINIFI\b/g, " ")
    .replace(/\bSERTIFIKA\b/g, " ")
    .replace(/\bSERTIFIKASI\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")[0] || "";
}

function readMebbisLicenseClasses(row: MebbisInstructorInventoryRow): LicenseClass[] {
  const values = [
    ...readMebbisStringArray(row.licenseClasses),
    readMebbisString(row.licenseClass),
  ];
  const codes = values.map(parseLicenseClassCode).filter(Boolean);
  return [...new Set(codes)] as LicenseClass[];
}

function parseMebbisDate(value: string): string | null {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  return `${match[3]}-${month}-${day}`;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapMebbisInstructorActive(
  value: unknown,
  existing: InstructorResponse | undefined
): boolean {
  const normalized = normalizeComparable(readMebbisString(value));
  if (
    normalized.includes("PASIF") ||
    normalized.includes("AYRIL") ||
    normalized.includes("IPTAL") ||
    normalized.includes("FESIH") ||
    (normalized && normalized !== "GOREVDE" && !normalized.includes("AKTIF"))
  ) {
    return false;
  }
  if (normalized.includes("AKTIF") || normalized === "A" || normalized === "GOREVDE") return true;
  return existing?.isActive ?? true;
}

function mapMebbisInstructorRole(value: unknown): InstructorRole {
  const normalized = normalizeComparable(readMebbisString(value));
  if (normalized.includes("YARDIMCI") && normalized.includes("MUDUR")) return "assistant_manager";
  if (normalized.includes("MUDUR")) return "manager";
  if (normalized.includes("UZMAN")) return "specialist_instructor";
  if (normalized.includes("PSIKOLOG")) return "psychologist";
  if (normalized.includes("MUHASEBE")) return "accounting";
  if (normalized.includes("BÜRO") || normalized.includes("BURO") || normalized.includes("MEMUR")) return "office_staff";
  return "master_instructor";
}

function mapMebbisInstructorEmploymentType(value: unknown): InstructorEmploymentType {
  const normalized = normalizeComparable(readMebbisString(value));
  if (normalized.includes("AYLIK")) return "salaried";
  if (normalized.includes("UCRET")) return "hourly";
  return "hourly";
}

function mapMebbisInstructorBranches(value: unknown): InstructorBranch[] {
  const normalized = normalizeComparable(readMebbisString(value));
  const branches = new Set<InstructorBranch>();
  if (normalized.includes("DIREKSIYON") || normalized.includes("UYGULAMA")) {
    branches.add("practice");
  }
  if (
    normalized.includes("TRAFIK") ||
    normalized.includes("CEVRE") ||
    normalized.includes("MOTOR") ||
    normalized.includes("ARAC TEKNIGI") ||
    normalized.includes("ILK YARDIM") ||
    normalized.includes("ILKYARDIM") ||
    normalized.includes("TEORIK")
  ) {
    branches.add("theory");
  }
  return branches.size > 0 ? [...branches] : ["practice"];
}

function mergeInstructorNotes(
  current: string | null | undefined,
  row: MebbisInstructorInventoryRow
): string | null {
  const details = [
    readMebbisString(row.role) ? `MEBBIS görev: ${readMebbisString(row.role)}` : null,
    readMebbisString(row.employmentStatus)
      ? `MEBBIS statü: ${readMebbisString(row.employmentStatus)}`
      : null,
    readMebbisString(row.branch) ? `MEBBIS branş: ${readMebbisString(row.branch)}` : null,
    readMebbisString(row.status) ? `MEBBIS durum: ${readMebbisString(row.status)}` : null,
    readMebbisString(row.educationInfo)
      ? `MEBBIS öğrenim: ${readMebbisString(row.educationInfo)}`
      : null,
  ].filter(Boolean);
  const next = details.join(" | ");
  if (!next) return current ?? null;
  if (current?.includes("MEBBIS görev:") || current?.includes("MEBBIS branş:")) return current;
  return current ? `${current}\n${next}` : next;
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
            label: t(option.labelKey),
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
            label: t(option.labelKey),
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
