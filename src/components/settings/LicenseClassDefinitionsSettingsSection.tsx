import { type FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

import { FilterIcon, PencilIcon, PlusIcon, TrashIcon } from "../icons";
import { LicenseClassDefinitionFormModal } from "../modals/LicenseClassDefinitionFormModal";
import { ColumnPicker, type ColumnOption } from "../ui/ColumnPicker";
import { SearchInput } from "../ui/SearchInput";
import { TableHeaderFilter } from "../ui/TableHeaderFilter";
import { useToast } from "../ui/Toast";
import {
  deleteLicenseClassDefinition,
  getLicenseClassDefinitions,
  updateLicenseClassDefinitionActivity,
  type LicenseClassDefinitionActivityFilter,
  type LicenseClassDefinitionSortDirection,
  type LicenseClassDefinitionSortField,
} from "../../lib/license-class-definitions-api";
import { useAuth } from "../../lib/auth";
import { ApiError } from "../../lib/http";
import { useT } from "../../lib/i18n";
import {
  createLicenseClassInventoryImportJob,
  getMebbisJob,
  type MebbisJobResponse,
} from "../../lib/mebbis-jobs-api";
import { canManageArea } from "../../lib/permissions";
import { candidateKeys } from "../../lib/queries/use-candidates";
import type {
  LicenseClassDefinitionListSummaryResponse,
  LicenseClassDefinitionResponse,
} from "../../lib/types";
import { useColumnVisibility } from "../../lib/use-column-visibility";

const SEARCH_DEBOUNCE_MS = 300;
const SETTINGS_QUERY_CACHE_MS = 5 * 60 * 1000;
const MEBBIS_LICENSE_CLASS_POLL_INTERVAL_MS = 2000;
const MEBBIS_LICENSE_CLASS_POLL_TIMEOUT_MS = 60_000;
type SortState = {
  field: LicenseClassDefinitionSortField;
  direction: LicenseClassDefinitionSortDirection;
} | null;
type LicenseClassDefinitionFilters = {
  activity: LicenseClassDefinitionActivityFilter;
  code: string;
};
type LicenseClassDefinitionColumnId =
  | "code"
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

type MebbisLicenseClassInventoryResult = {
  programs?: Array<{
    programName?: unknown;
    licenseClassCode?: unknown;
  }>;
};

function formatOptionalNumber(value: number | null, suffix = ""): string {
  if (value === null || value === undefined) return "-";
  return `${value}${suffix}`;
}

const DEFAULT_FILTERS: LicenseClassDefinitionFilters = {
  activity: "all",
  code: "",
};

function invalidateLicenseClassDependentCaches(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["licenseClassDefinitions"] });
  void queryClient.invalidateQueries({ queryKey: ["settings", "license-class-fee-matrix"] });
  void queryClient.invalidateQueries({ queryKey: ["finance", "license-class-fee-matrix"] });
  void queryClient.invalidateQueries({ queryKey: ["candidate-detail", "exam-attempt-fee-matrix"] });
  void queryClient.invalidateQueries({ queryKey: ["candidate-detail", "contract-back-fee-matrix"] });
  void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
  void queryClient.invalidateQueries({ queryKey: ["training", "vehicles"] });
  void queryClient.invalidateQueries({ queryKey: ["training", "instructors"] });
  void queryClient.invalidateQueries({ queryKey: ["training", "lessons"] });
  void queryClient.invalidateQueries({ queryKey: ["payments"] });
  void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
  void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
}

function normalizeLicenseClassCode(value: string): string {
  return value
    .trim()
    .toLocaleUpperCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[İI]/g, "I")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/\s+/g, "-");
}

function readMebbisLicenseClassCode(value: unknown): string {
  return typeof value === "string" ? normalizeLicenseClassCode(value) : "";
}

function parseMebbisLicenseClassInventoryResult(
  job: MebbisJobResponse
): MebbisLicenseClassInventoryResult | null {
  if (!job.resultJson) return null;
  try {
    const parsed = JSON.parse(job.resultJson) as MebbisLicenseClassInventoryResult;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function resolveMebbisLicenseClassCodes(
  result: MebbisLicenseClassInventoryResult,
  definitions: LicenseClassDefinitionResponse[]
): Set<string> {
  const availableCodes = new Set(definitions.map((item) => normalizeLicenseClassCode(item.code)));
  const targetCodes = new Set<string>();

  for (const program of result.programs ?? []) {
    const code = readMebbisLicenseClassCode(program.licenseClassCode);
    if (!code) continue;
    if (availableCodes.has(code)) targetCodes.add(code);

    const automaticCode = `${code}-OTOMATIK`;
    if (availableCodes.has(automaticCode)) {
      targetCodes.add(automaticCode);
    }
  }

  return targetCodes;
}

export function LicenseClassDefinitionsSettingsSection() {
  const navigate = useNavigate();
  const t = useT();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { permissions, user } = useAuth();
  const canManageCatalog = user?.isSuperAdmin ?? false;
  const canManageActivity = canManageArea(user, permissions, "settings");

  const LICENSE_CLASS_DEFINITION_COLUMNS: LicenseClassDefinitionColumnDef[] = [
    {
      id: "code",
      label: t("settings.licenseClasses.columns.code"),
      sortField: "code",
      renderCell: (item) => <strong>{item.code}</strong>,
      skeletonWidth: 70,
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
        <LicenseClassStatusToggle
          disabled={togglingId === item.id || !canManageActivity}
          item={item}
          onToggle={handleStatusToggle}
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
    "settings.license-class-definitions.columns.v5",
    LICENSE_CLASS_DEFINITION_COLUMN_IDS
  );

  const [items, setItems] = useState<LicenseClassDefinitionResponse[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] =
    useState<LicenseClassDefinitionListSummaryResponse>(EMPTY_SUMMARY);
  const [search, setSearch] = useState("");
  const [searchResetKey, setSearchResetKey] = useState(0);
  const [filters, setFilters] = useState<LicenseClassDefinitionFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortState>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LicenseClassDefinitionResponse | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [importingMebbisLicenseClasses, setImportingMebbisLicenseClasses] = useState(false);
  const visibleColumns = LICENSE_CLASS_DEFINITION_COLUMNS.filter((column) =>
    isVisible(column.id)
  );

  const listQueryParams = useMemo(
    () => ({
      activity: filters.activity,
      baseOnly: true,
      code: filters.code.trim() || undefined,
      search: search.trim() || undefined,
      sortBy: sort?.field ?? "displayOrder",
      sortDir: sort?.direction ?? "asc",
    }),
    [filters.activity, filters.code, search, sort]
  );

  const listQuery = useQuery({
    gcTime: SETTINGS_QUERY_CACHE_MS,
    queryKey: ["settings", "license-class-definitions", listQueryParams, refreshKey],
    queryFn: ({ signal }) => getLicenseClassDefinitions(listQueryParams, signal),
    retry: false,
  });

  useEffect(() => {
    if (!listQuery.data) return;
    setItems(listQuery.data.items);
    setTotalCount(listQuery.data.totalCount);
    setSummary(listQuery.data.summary);
  }, [listQuery.data]);

  useEffect(() => {
    if (listQuery.isError) {
      showToast(t("settings.licenseClasses.toast.loadFailed"), "error");
    }
  }, [listQuery.isError, showToast, t]);

  const loading = listQuery.isLoading;

  const counts = useMemo(() => {
    return {
      total: totalCount,
      active: summary.activeCount,
    };
  }, [summary, totalCount]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    filters.activity !== DEFAULT_FILTERS.activity ||
    filters.code !== DEFAULT_FILTERS.code;

  const handleSaved = (_saved: LicenseClassDefinitionResponse) => {
    setFormOpen(false);
    setEditing(null);
    setRefreshKey((current) => current + 1);
    invalidateLicenseClassDependentCaches(queryClient);
    showToast(editing ? t("settings.licenseClasses.toast.updated") : t("settings.licenseClasses.toast.created"));
  };

  const handleSortToggle = (field: LicenseClassDefinitionSortField) => {
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
      }
    }
    toggleColumn(id);
  };

  const setFilter = <K extends keyof LicenseClassDefinitionFilters>(
    key: K,
    value: LicenseClassDefinitionFilters[K]
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handleDelete = async (item: LicenseClassDefinitionResponse) => {
    if (!canManageCatalog) return;
    setDeletingId(item.id);
    try {
      await deleteLicenseClassDefinition(item.id);
      setConfirmDeleteId(null);
      showToast(t("settings.licenseClasses.toast.deleted"));
      setRefreshKey((current) => current + 1);
      invalidateLicenseClassDependentCaches(queryClient);
    } catch {
      showToast(t("settings.licenseClasses.toast.deleteFailed"), "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleStatusToggle = async (item: LicenseClassDefinitionResponse) => {
    if (!canManageActivity) return;
    setTogglingId(item.id);
    try {
      const saved = await updateLicenseClassDefinitionActivity(item.id, {
        isActive: !item.isActive,
        rowVersion: item.rowVersion,
      });
      setItems((current) =>
        current
          .map((candidate) => (candidate.id === item.id ? saved : candidate))
          .filter((candidate) => {
            if (filters.activity === "active") return candidate.isActive;
            if (filters.activity === "inactive") return !candidate.isActive;
            return true;
          })
      );
      setRefreshKey((current) => current + 1);
      invalidateLicenseClassDependentCaches(queryClient);
      showToast(
        saved.isActive
          ? t("settings.licenseClasses.toast.activated")
          : t("settings.licenseClasses.toast.deactivated")
      );
    } catch {
      showToast(t("settings.licenseClasses.toast.updateFailed"), "error");
    } finally {
      setTogglingId(null);
    }
  };

  const applyMebbisLicenseClassInventory = async (job: MebbisJobResponse) => {
    const result = parseMebbisLicenseClassInventoryResult(job);
    if (!result) {
      showToast(t("settings.licenseClasses.mebbisImportCompleted"));
      return;
    }

    const response = await getLicenseClassDefinitions({
      activity: "all",
      page: 1,
      pageSize: 1000,
    });
    const targetCodes = resolveMebbisLicenseClassCodes(result, response.items);
    const targetDefinitions = response.items.filter(
      (item) => !item.existingLicenseType && targetCodes.has(normalizeLicenseClassCode(item.code))
    );
    const inactiveTargets = targetDefinitions.filter((item) => !item.isActive);

    for (const definition of inactiveTargets) {
      await updateLicenseClassDefinitionActivity(definition.id, {
        isActive: true,
        rowVersion: definition.rowVersion,
      });
    }

    setRefreshKey((current) => current + 1);
    invalidateLicenseClassDependentCaches(queryClient);
    showToast(
      t("settings.licenseClasses.mebbisImportApplied", {
        count: String(inactiveTargets.length),
        total: String(targetDefinitions.length),
      })
    );
  };

  const pollMebbisLicenseClassInventoryJob = async (jobId: string, startedAt = Date.now()) => {
    while (Date.now() - startedAt < MEBBIS_LICENSE_CLASS_POLL_TIMEOUT_MS) {
      await new Promise((resolve) => window.setTimeout(resolve, MEBBIS_LICENSE_CLASS_POLL_INTERVAL_MS));
      const job = await getMebbisJob(jobId);
      if (job.status === "succeeded") {
        await applyMebbisLicenseClassInventory(job);
        void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
        return;
      }

      if (["failed", "needs_manual_action", "cancelled"].includes(job.status)) {
        showToast(t("settings.licenseClasses.mebbisImportNeedsManualAction"), "error");
        void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
        return;
      }
    }

    showToast(t("settings.licenseClasses.mebbisImportStillRunning"));
  };

  const handleMebbisLicenseClassImport = async () => {
    if (!canManageActivity || importingMebbisLicenseClasses) return;
    setImportingMebbisLicenseClasses(true);
    try {
      const job = await createLicenseClassInventoryImportJob();
      void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
      showToast(t("settings.licenseClasses.mebbisImportQueued"));
      await pollMebbisLicenseClassInventoryJob(job.id);
    } catch (error) {
      console.error(error);
      const message =
        error instanceof ApiError
          ? Object.values(error.validationErrors ?? {})[0]?.[0] ??
            t("settings.licenseClasses.mebbisImportFailed")
          : t("settings.licenseClasses.mebbisImportFailed");
      showToast(message, "error");
    } finally {
      setImportingMebbisLicenseClasses(false);
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
                  }}
                  type="button"
                >
                  {t("settings.licenseClasses.button.clearFilters")}
                </button>
              ) : null}
              <button
                className="btn btn-secondary btn-sm"
                disabled={!canManageActivity || importingMebbisLicenseClasses}
                onClick={handleMebbisLicenseClassImport}
                title={!canManageActivity ? "Yetkiniz yok." : undefined}
                type="button"
              >
                {importingMebbisLicenseClasses
                  ? t("settings.licenseClasses.mebbisImportStarting")
                  : t("settings.licenseClasses.mebbisImport")}
              </button>
              {canManageCatalog ? (
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
              ) : null}
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
                                disabled={!canManageCatalog}
                                onClick={() => {
                                  if (!canManageCatalog) return;
                                  setEditing(item);
                                  setFormOpen(true);
                                }}
                                title={!canManageCatalog ? "Yetkiniz yok." : t("common.edit")}
                                type="button"
                              >
                                <PencilIcon size={14} />
                              </button>
                              {canManageCatalog ? (
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
                              ) : null}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <LicenseClassDefinitionFormModal
        canManage={canManageCatalog}
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

type LicenseClassStatusToggleProps = {
  disabled: boolean;
  item: LicenseClassDefinitionResponse;
  onToggle: (item: LicenseClassDefinitionResponse) => void;
};

function LicenseClassStatusToggle({ disabled, item, onToggle }: LicenseClassStatusToggleProps) {
  return (
    <label
      className="switch-toggle settings-inline-status-toggle"
      onClick={(event) => event.stopPropagation()}
      title={item.isActive ? "Aktif" : "Pasif"}
    >
      <input
        aria-label={`${item.code} durumunu ${item.isActive ? "pasife al" : "aktife al"}`}
        checked={item.isActive}
        disabled={disabled}
        onChange={() => onToggle(item)}
        type="checkbox"
      />
      <span aria-hidden="true" className="switch-toggle-control" />
      <span>{item.isActive ? "Aktif" : "Pasif"}</span>
    </label>
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
