import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { MebIcon, PencilIcon, PlusIcon, TrashIcon } from "../icons";
import { VehicleFormModal } from "../modals/VehicleFormModal";
import { Pagination } from "../ui/Pagination";
import { SearchInput } from "../ui/SearchInput";
import { StatusPill } from "../ui/StatusPill";
import { TableHeaderFilter } from "../ui/TableHeaderFilter";
import { useToast } from "../ui/Toast";
import { useAuth } from "../../lib/auth";
import { useT, type TranslationKey } from "../../lib/i18n";
import { canManageArea } from "../../lib/permissions";
import { candidateKeys } from "../../lib/queries/use-candidates";
import {
  createVehicle,
  deleteVehicle,
  getVehicles,
  updateVehicle,
  type VehicleActivityFilter,
  type VehicleSortDirection,
  type VehicleSortField,
} from "../../lib/vehicles-api";
import { ApiError } from "../../lib/http";
import {
  createVehicleInventoryImportJob,
  getMebbisJob,
  type MebbisJobResponse,
} from "../../lib/mebbis-jobs-api";
import {
  createVehicleDocument,
  listVehicleDocuments,
  updateVehicleDocument,
} from "../../lib/vehicle-documents-api";
import {
  VEHICLE_STATUS_OPTIONS,
  VEHICLE_STATUS_LABEL_KEYS,
  VEHICLE_TRANSMISSION_LABEL_KEYS,
} from "../../lib/vehicle-catalog";
import type {
  LicenseClass,
  VehicleListSummaryResponse,
  VehicleOwnershipType,
  VehicleDocumentResponse,
  VehicleResponse,
  VehicleStatus,
  VehicleTransmissionType,
  VehicleType,
  VehicleUpsertRequest,
} from "../../lib/types";
import {
  mergeLicenseClassOptionsWithValues,
  type LicenseClassOption,
  useLicenseClassOptions,
} from "../../lib/use-license-class-options";

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const SEARCH_DEBOUNCE_MS = 300;
const MEBBIS_VEHICLE_POLL_INTERVAL_MS = 2000;
const MEBBIS_VEHICLE_POLL_TIMEOUT_MS = 60_000;
type SortState = { field: VehicleSortField; direction: VehicleSortDirection } | null;
type VehicleFilterValue<T extends string> = T | "all";
type VehicleFilters = {
  activity: VehicleActivityFilter;
  status: VehicleFilterValue<VehicleStatus>;
  licenseClass: VehicleFilterValue<LicenseClass>;
};
type VehicleColumnId =
  | "plateNumber"
  | "licenseClass"
  | "isActive"
  | "status"
  | "insuranceEndDate"
  | "inspectionEndDate"
  | "cascoEndDate"
  | "brandModel"
  | "transmissionType";

type MebbisVehicleInventoryRow = {
  plateNumber?: unknown;
  licenseClass?: unknown;
  brand?: unknown;
  model?: unknown;
  modelYear?: unknown;
  registrationDate?: unknown;
  serviceStartDate?: unknown;
  serviceEndDate?: unknown;
  inspectionValidUntil?: unknown;
  insuranceStartDate?: unknown;
  insuranceDocumentNumber?: unknown;
  ownershipStatus?: unknown;
  vehicleStatus?: unknown;
  institutionApprovalStatus?: unknown;
  memApprovalStatus?: unknown;
  transmission?: unknown;
};

type MebbisVehicleInventoryResult = {
  vehicles?: MebbisVehicleInventoryRow[];
};

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const target = new Date(iso.slice(0, 10) + "T00:00:00Z").getTime();
  if (!Number.isFinite(target)) return null;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function formatDateTR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

function renderDocumentEndCell(iso: string | null) {
  if (!iso) return "—";
  const days = daysUntil(iso);
  const tone =
    days == null ? "default" : days < 0 ? "expired" : days <= 30 ? "warning" : "default";
  return (
    <div className={`instructor-contract-end instructor-contract-end--${tone}`}>
      <span>{formatDateTR(iso)}</span>
      {days != null && days >= 0 && days <= 60 ? (
        <span className="instructor-contract-end-days">{days} gün</span>
      ) : days != null && days < 0 ? (
        <span className="instructor-contract-end-days">geçti</span>
      ) : null}
    </div>
  );
}
type VehicleColumnDef = {
  id: VehicleColumnId;
  labelKey: TranslationKey;
  sortField?: VehicleSortField;
  renderCell: (vehicle: VehicleResponse) => React.ReactNode;
  skeletonWidth: number;
  skeletonKind?: "line" | "pill";
};

const EMPTY_SUMMARY: VehicleListSummaryResponse = {
  activeCount: 0,
  inUseCount: 0,
  maintenanceCount: 0,
  idleCount: 0,
};

function buildVehicleColumns(t: ReturnType<typeof useT>): VehicleColumnDef[] {
  return [
    {
      id: "plateNumber",
      labelKey: "settings.vehicles.columns.plateNumber",
      sortField: "plateNumber",
      renderCell: (vehicle) => <strong>{vehicle.plateNumber}</strong>,
      skeletonWidth: 84,
    },
    {
      id: "licenseClass",
      labelKey: "settings.vehicles.columns.licenseClass",
      sortField: "licenseClass",
      renderCell: (vehicle) => vehicle.licenseClasses.join(", "),
      skeletonWidth: 60,
    },
    {
      id: "isActive",
      labelKey: "settings.vehicles.columns.isActive",
      sortField: "isActive",
      renderCell: (vehicle) => (
        <StatusPill
          label={vehicle.isActive ? t("settings.vehicles.status.active") : t("settings.vehicles.status.inactive")}
          status={vehicle.isActive ? "success" : "manual"}
        />
      ),
      skeletonWidth: 74,
      skeletonKind: "pill",
    },
    {
      id: "status",
      labelKey: "settings.vehicles.columns.status",
      sortField: "status",
      renderCell: (vehicle) => (
        <StatusPill
          label={t(VEHICLE_STATUS_LABEL_KEYS[vehicle.status])}
          status={
            vehicle.status === "in_use"
              ? "running"
              : vehicle.status === "maintenance"
                ? "warning"
                : "manual"
          }
        />
      ),
      skeletonWidth: 90,
      skeletonKind: "pill",
    },
    {
      id: "insuranceEndDate",
      labelKey: "settings.vehicles.columns.insuranceEndDate",
      renderCell: (vehicle) => renderDocumentEndCell(vehicle.latestInsuranceEndDate),
      skeletonWidth: 110,
    },
    {
      id: "inspectionEndDate",
      labelKey: "settings.vehicles.columns.inspectionEndDate",
      renderCell: (vehicle) => renderDocumentEndCell(vehicle.latestInspectionEndDate),
      skeletonWidth: 110,
    },
    {
      id: "cascoEndDate",
      labelKey: "settings.vehicles.columns.cascoEndDate",
      renderCell: (vehicle) => renderDocumentEndCell(vehicle.latestCascoEndDate),
      skeletonWidth: 110,
    },
    {
      id: "brandModel",
      labelKey: "settings.vehicles.columns.brandModel",
      renderCell: (vehicle) => {
        const parts = [vehicle.brand, vehicle.model].filter(Boolean).join(" ");
        return vehicle.modelYear ? `${parts} (${vehicle.modelYear})` : parts || "—";
      },
      skeletonWidth: 160,
    },
    {
      id: "transmissionType",
      labelKey: "settings.vehicles.columns.transmissionType",
      renderCell: (vehicle) => VEHICLE_TRANSMISSION_LABEL_KEYS[vehicle.transmissionType] ? t(VEHICLE_TRANSMISSION_LABEL_KEYS[vehicle.transmissionType]) : "—",
      skeletonWidth: 80,
    },
  ];
}
const DEFAULT_FILTERS: VehicleFilters = {
  activity: "all",
  status: "all",
  licenseClass: "all",
};

export function VehiclesSettingsSection() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const t = useT();
  const { user, permissions } = useAuth();
  const canManageTraining = canManageArea(user, permissions, "training");
  const noPermissionTitle = t("common.noPermission");

  const [items, setItems] = useState<VehicleResponse[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [summary, setSummary] = useState<VehicleListSummaryResponse>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchResetKey, setSearchResetKey] = useState(0);
  const [filters, setFilters] = useState<VehicleFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sort, setSort] = useState<SortState>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleResponse | null>(null);
  const [confirmDeleteVehicleId, setConfirmDeleteVehicleId] = useState<string | null>(null);
  const [deletingVehicleId, setDeletingVehicleId] = useState<string | null>(null);
  const [importingMebbisVehicles, setImportingMebbisVehicles] = useState(false);
  const { options: licenseClassOptions } = useLicenseClassOptions();
  const filterLicenseClassOptions = useMemo(
    () =>
      mergeLicenseClassOptionsWithValues(
        licenseClassOptions,
        [
          filters.licenseClass !== "all" ? filters.licenseClass : null,
          ...items.flatMap((vehicle) => vehicle.licenseClasses),
        ]
      ),
    [filters.licenseClass, items, licenseClassOptions]
  );
  const vehicleColumns = buildVehicleColumns(t);
  const visibleColumns = vehicleColumns;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const query = {
      activity: filters.activity,
      page,
      pageSize,
      search: search.trim() || undefined,
      status: filters.status !== "all" ? filters.status : undefined,
      licenseClass: filters.licenseClass !== "all" ? filters.licenseClass : undefined,
      ...(sort ? { sortBy: sort.field, sortDir: sort.direction } : {}),
    };

    getVehicles(query, controller.signal)
      .then(async (response) => {
        const itemsWithDocumentSummaries = await enrichVehicleDocumentSummaries(
          response.items,
          controller.signal
        );
        if (controller.signal.aborted) return;
        setItems(itemsWithDocumentSummaries);
        setTotalCount(response.totalCount);
        setTotalPages(response.totalPages);
        setSummary(response.summary);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        showToast(t("settings.vehicles.toast.loadError"), "error");
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
      idle: summary.idleCount,
      inUse: summary.inUseCount,
      maintenance: summary.maintenanceCount,
    };
  }, [summary, totalCount]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    filters.activity !== DEFAULT_FILTERS.activity ||
    filters.status !== DEFAULT_FILTERS.status ||
    filters.licenseClass !== DEFAULT_FILTERS.licenseClass;

  const invalidateVehicleDependents = () => {
    void queryClient.invalidateQueries({ queryKey: ["training", "vehicles"] });
    void queryClient.invalidateQueries({ queryKey: ["training", "lessons"] });
    void queryClient.invalidateQueries({ queryKey: ["vehicles", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["vehicles", "detail"] });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const handleSaved = (_saved: VehicleResponse) => {
    setFormOpen(false);
    setEditing(null);
    setRefreshKey((current) => current + 1);
    invalidateVehicleDependents();
    showToast(editing ? t("settings.vehicles.toast.updated") : t("settings.vehicles.toast.created"));
  };

  const handleSortToggle = (field: VehicleSortField) => {
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

  const setFilter = <K extends keyof VehicleFilters>(key: K, value: VehicleFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const handleDelete = async (vehicle: VehicleResponse) => {
    if (!canManageTraining) return;
    setDeletingVehicleId(vehicle.id);
    try {
      await deleteVehicle(vehicle.id);
      setConfirmDeleteVehicleId(null);
      showToast(t("settings.vehicles.toast.deleted"));
      if (items.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        setRefreshKey((current) => current + 1);
      }
      invalidateVehicleDependents();
    } catch {
      showToast(t("settings.vehicles.toast.deleteError"), "error");
    } finally {
      setDeletingVehicleId(null);
    }
  };

  const applyMebbisVehicleInventory = async (job: MebbisJobResponse) => {
    const result = parseMebbisVehicleInventoryResult(job);
    const importedRows = result?.vehicles?.filter(isReadableMebbisVehicleRow) ?? [];
    if (importedRows.length === 0) {
      showToast(t("settings.vehicles.mebbisImportCompleted"));
      return;
    }

    const existingResponse = await getVehicles({ activity: "all", page: 1, pageSize: 1000 });
    const existingByPlate = new Map(
      existingResponse.items.map((vehicle) => [normalizePlate(vehicle.plateNumber), vehicle])
    );
    let createdCount = 0;
    let updatedCount = 0;
    let inspectionDocumentCount = 0;
    let insuranceDocumentCount = 0;
    let documentErrorCount = 0;

    for (const imported of importedRows) {
      const plateNumber = normalizePlate(readMebbisString(imported.plateNumber));
      const existing = existingByPlate.get(plateNumber);
      const request = buildVehicleUpsertRequest(imported, existing);
      if (!request) continue;

      let savedVehicle: VehicleResponse;
      if (!existing) {
        savedVehicle = await createVehicle(request);
        createdCount += 1;
      } else {
        savedVehicle = await updateVehicle(existing.id, {
          ...request,
          rowVersion: existing.rowVersion,
        });
        updatedCount += 1;
      }

      try {
        const vehicleDocuments = await listVehicleDocuments(savedVehicle.id);
        const inspectionUpdated = await upsertMebbisInspectionDocument(
          savedVehicle,
          imported,
          vehicleDocuments
        );
        if (inspectionUpdated) inspectionDocumentCount += 1;
        const insuranceUpdated = await upsertMebbisInsuranceDocument(
          savedVehicle,
          imported,
          vehicleDocuments
        );
        if (insuranceUpdated) insuranceDocumentCount += 1;
      } catch (error) {
        console.error("MEBBIS vehicle document import failed", error);
        documentErrorCount += 1;
      }
    }

    setRefreshKey((current) => current + 1);
    invalidateVehicleDependents();
    if (documentErrorCount > 0) {
      showToast(
        t("settings.vehicles.mebbisImportDocumentFailed", {
          count: String(documentErrorCount),
        }),
        "error"
      );
    }
    showToast(
      t("settings.vehicles.mebbisImportApplied", {
        created: String(createdCount),
        updated: String(updatedCount),
        inspections: String(inspectionDocumentCount),
        insurances: String(insuranceDocumentCount),
      })
    );
  };

  const pollMebbisVehicleInventoryJob = async (jobId: string, startedAt = Date.now()) => {
    while (Date.now() - startedAt < MEBBIS_VEHICLE_POLL_TIMEOUT_MS) {
      await new Promise((resolve) => window.setTimeout(resolve, MEBBIS_VEHICLE_POLL_INTERVAL_MS));
      const job = await getMebbisJob(jobId);
      if (job.status === "succeeded") {
        await applyMebbisVehicleInventory(job);
        void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
        return;
      }

      if (["failed", "needs_manual_action", "cancelled"].includes(job.status)) {
        showToast(t("settings.vehicles.mebbisImportNeedsManualAction"), "error");
        void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
        return;
      }
    }

    showToast(t("settings.vehicles.mebbisImportStillRunning"));
  };

  const handleMebbisVehicleImport = async () => {
    if (!canManageTraining || importingMebbisVehicles) return;
    setImportingMebbisVehicles(true);
    try {
      const job = await createVehicleInventoryImportJob();
      void queryClient.invalidateQueries({ queryKey: ["mebbisJobs", "list"] });
      showToast(t("settings.vehicles.mebbisImportQueued"));
      await pollMebbisVehicleInventoryJob(job.id);
    } catch (error) {
      console.error(error);
      const message =
        error instanceof ApiError
          ? Object.values(error.validationErrors ?? {})[0]?.[0] ??
            t("settings.vehicles.mebbisImportFailed")
          : t("settings.vehicles.mebbisImportFailed");
      showToast(message, "error");
    } finally {
      setImportingMebbisVehicles(false);
    }
  };

  return (
    <>
      <div className="settings-section-stack">
        <div className="settings-summary-grid">
          <div className="settings-summary-card">
            <span className="settings-summary-label">{t("settings.vehicles.summary.totalVehicles")}</span>
            <strong className="settings-summary-value">{counts.total}</strong>
          </div>
          <div className="settings-summary-card">
            <span className="settings-summary-label">{t("settings.vehicles.summary.idle")}</span>
            <strong className="settings-summary-value">{counts.idle}</strong>
          </div>
          <div className="settings-summary-card">
            <span className="settings-summary-label">{t("settings.vehicles.summary.inUse")}</span>
            <strong className="settings-summary-value">{counts.inUse}</strong>
          </div>
          <div className="settings-summary-card">
            <span className="settings-summary-label">{t("settings.vehicles.summary.maintenance")}</span>
            <strong className="settings-summary-value">{counts.maintenance}</strong>
          </div>
        </div>

        <section className="settings-surface">
          <div className="settings-surface-header">
            <div className="settings-surface-title">{t("settings.vehicles.title")}</div>
            <div className="settings-module-actions">
              <div className="search-box settings-module-search settings-module-search-compact">
                <SearchInput
                  debounceMs={SEARCH_DEBOUNCE_MS}
                  onChange={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                  placeholder={t("settings.vehicles.search.placeholder")}
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
                className="btn btn-secondary btn-sm"
                disabled={!canManageTraining || importingMebbisVehicles}
                onClick={handleMebbisVehicleImport}
                title={!canManageTraining ? noPermissionTitle : undefined}
                type="button"
              >
                <MebIcon size={14} />
                {importingMebbisVehicles
                  ? t("settings.vehicles.mebbisImportRunning")
                  : t("settings.vehicles.mebbisImportButton")}
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
                {t("settings.vehicles.button.new")}
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
                          filterLicenseClassOptions,
                          t
                        )}
                        key={column.id}
                        label={t(column.labelKey)}
                        onToggle={handleSortToggle}
                        sort={sort}
                      />
                    ) : (
                      <th key={column.id}>{t(column.labelKey)}</th>
                    )
                  )}
                  <th aria-label={t("vehiclesSettings.aria.actions")} />
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
                      <td>
                        <span className="skeleton" style={{ width: 24 }} />
                      </td>
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td className="data-table-empty" colSpan={visibleColumns.length + 1}>
                      {t("settings.vehicles.empty")}
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      className="data-table-row-clickable"
                      key={item.id}
                      onClick={() => navigate(`/settings/definitions/vehicles/${item.id}`)}
                    >
                      {visibleColumns.map((column) => (
                        <td key={column.id}>{column.renderCell(item)}</td>
                      ))}
                      <td onClick={(e) => e.stopPropagation()}>
                        <div
                          className={
                            confirmDeleteVehicleId === item.id
                              ? "table-row-actions table-row-actions-confirm"
                              : "table-row-actions"
                          }
                        >
                          {confirmDeleteVehicleId === item.id ? (
                            <>
                              <button
                                className="btn btn-secondary btn-sm"
                                disabled={deletingVehicleId === item.id}
                                onClick={() => setConfirmDeleteVehicleId(null)}
                                type="button"
                              >
                                {t("common.cancel")}
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                disabled={deletingVehicleId === item.id || !canManageTraining}
                                onClick={() => handleDelete(item)}
                                title={!canManageTraining ? noPermissionTitle : undefined}
                                type="button"
                              >
                                {deletingVehicleId === item.id ? t("settings.vehicles.action.deleting") : t("common.delete")}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                aria-label={t("settings.vehicles.action.edit")}
                                className="icon-btn"
                                disabled={!canManageTraining}
                                onClick={() => {
                                  if (!canManageTraining) return;
                                  setEditing(item);
                                  setFormOpen(true);
                                }}
                                title={!canManageTraining ? noPermissionTitle : t("settings.vehicles.action.edit")}
                                type="button"
                              >
                                <PencilIcon size={14} />
                              </button>
                              <button
                                aria-label={t("settings.vehicles.action.delete")}
                                className="icon-btn icon-btn-danger"
                                disabled={deletingVehicleId !== null || !canManageTraining}
                                onClick={() => {
                                  if (!canManageTraining) return;
                                  setConfirmDeleteVehicleId(item.id);
                                }}
                                title={!canManageTraining ? noPermissionTitle : t("settings.vehicles.action.delete")}
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

      <VehicleFormModal
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
  field: VehicleSortField;
  filterControl?: React.ReactNode;
  label: string;
  sort: SortState;
  onToggle: (field: VehicleSortField) => void;
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

function buildColumnFilterControl(
  columnId: VehicleColumnId,
  filters: VehicleFilters,
  setFilter: <K extends keyof VehicleFilters>(key: K, value: VehicleFilters[K]) => void,
  licenseClassOptions: LicenseClassOption[],
  t: ReturnType<typeof useT>
) {
  if (columnId === "isActive") {
    return (
      <TableHeaderFilter
        active={filters.activity !== DEFAULT_FILTERS.activity}
        onChange={(nextValue) => setFilter("activity", nextValue as VehicleActivityFilter)}
        options={[
          { value: "active", label: t("settings.vehicles.filter.isActive.active") },
          { value: "all", label: t("common.all") },
          { value: "inactive", label: t("settings.vehicles.filter.isActive.inactive") },
        ]}
        title={t("settings.vehicles.filter.isActive.title")}
        value={filters.activity}
      />
    );
  }

  if (columnId === "status") {
    return (
      <TableHeaderFilter
        active={filters.status !== DEFAULT_FILTERS.status}
        onChange={(nextValue) => setFilter("status", nextValue as VehicleFilters["status"])}
        options={[
          { value: "all", label: t("common.all") },
          ...VEHICLE_STATUS_OPTIONS.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          })),
        ]}
        title={t("settings.vehicles.filter.status.title")}
        value={filters.status}
      />
    );
  }

  if (columnId === "licenseClass") {
    return (
      <TableHeaderFilter
        active={filters.licenseClass !== DEFAULT_FILTERS.licenseClass}
        onChange={(nextValue) =>
          setFilter("licenseClass", nextValue as VehicleFilters["licenseClass"])
        }
        options={[
          { value: "all", label: t("common.all") },
          ...licenseClassOptions.map((option) => ({
            value: option.value,
            label: option.label,
          })),
        ]}
        title={t("settings.vehicles.filter.licenseClass.title")}
        value={filters.licenseClass}
      />
    );
  }

  return null;
}

function parseMebbisVehicleInventoryResult(
  job: MebbisJobResponse
): MebbisVehicleInventoryResult | null {
  if (!job.resultJson) return null;

  try {
    const parsed = JSON.parse(job.resultJson) as MebbisVehicleInventoryResult;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function isReadableMebbisVehicleRow(
  row: MebbisVehicleInventoryRow
): row is Required<Pick<MebbisVehicleInventoryRow, "plateNumber" | "licenseClass" | "brand">> &
  MebbisVehicleInventoryRow {
  return (
    normalizePlate(readMebbisString(row.plateNumber)).length > 0 &&
    parseLicenseClassCode(readMebbisString(row.licenseClass)).length > 0 &&
    readMebbisString(row.brand).length > 0
  );
}

function buildVehicleUpsertRequest(
  row: MebbisVehicleInventoryRow,
  existing: VehicleResponse | undefined
): VehicleUpsertRequest | null {
  const plateNumber = normalizePlate(readMebbisString(row.plateNumber));
  const licenseClass = parseLicenseClassCode(readMebbisString(row.licenseClass));
  const brand = readMebbisString(row.brand);
  if (!plateNumber || !licenseClass || !brand) return null;

  const model = readMebbisString(row.model);
  const modelYear = readMebbisNumber(row.modelYear);
  const licenseClasses = uniqueStrings([...(existing?.licenseClasses ?? []), licenseClass]);
  const registrationDate = parseMebbisDate(readMebbisString(row.registrationDate));
  const serviceStartDate = parseMebbisDate(readMebbisString(row.serviceStartDate));

  return {
    plateNumber,
    brand,
    model: model && model !== String(modelYear ?? "") ? model : existing?.model ?? null,
    modelYear: modelYear ?? existing?.modelYear ?? null,
    color: existing?.color ?? null,
    status: existing?.status ?? "idle",
    isActive: isMebbisVehicleActive(readMebbisString(row.vehicleStatus)),
    transmissionType: mapMebbisTransmission(row.transmission, existing?.transmissionType),
    vehicleType: mapMebbisVehicleType(licenseClass, existing?.vehicleType),
    licenseClasses,
    ownershipType: mapMebbisOwnership(row.ownershipStatus, existing?.ownershipType),
    fuelType: existing?.fuelType ?? null,
    odometerValue: existing?.odometerValue ?? null,
    odometerUnit: existing?.odometerUnit ?? "km",
    registrationDate: registrationDate ?? existing?.registrationDate ?? null,
    serviceStartDate: serviceStartDate ?? existing?.serviceStartDate ?? null,
    accidentNotes: existing?.accidentNotes ?? null,
    otherDetails: mergeVehicleDetails(existing?.otherDetails, row),
    notes: existing?.notes ?? null,
  };
}

async function enrichVehicleDocumentSummaries(
  vehicles: VehicleResponse[],
  signal: AbortSignal
): Promise<VehicleResponse[]> {
  if (vehicles.length === 0) return vehicles;

  return Promise.all(
    vehicles.map(async (vehicle) => {
      try {
        const documents = await listVehicleDocuments(vehicle.id, signal);
        return {
          ...vehicle,
          latestInsuranceEndDate:
            selectLatestVehicleDocumentEndDate(documents, "insurance") ??
            vehicle.latestInsuranceEndDate,
          latestInspectionEndDate:
            selectLatestVehicleDocumentEndDate(documents, "inspection") ??
            vehicle.latestInspectionEndDate,
          latestCascoEndDate:
            selectLatestVehicleDocumentEndDate(documents, "casco") ??
            vehicle.latestCascoEndDate,
        };
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw error;
        }

        return vehicle;
      }
    })
  );
}

function selectLatestVehicleDocumentEndDate(
  documents: VehicleDocumentResponse[],
  documentType: "insurance" | "inspection" | "casco"
): string | null {
  return (
    documents
      .filter((document) => document.documentType === documentType)
      .slice()
      .sort((left, right) => {
        const startComparison = right.startDate.localeCompare(left.startDate);
        return startComparison !== 0
          ? startComparison
          : right.endDate.localeCompare(left.endDate);
      })[0]?.endDate ?? null
  );
}

async function upsertMebbisInspectionDocument(
  vehicle: VehicleResponse,
  row: MebbisVehicleInventoryRow,
  documents: VehicleDocumentResponse[]
): Promise<boolean> {
  const endDate = parseMebbisDate(readMebbisString(row.inspectionValidUntil));
  if (!endDate) return false;

  const existing = selectInspectionDocument(documents, endDate);
  const startDate =
    existing?.startDate ??
    vehicle.serviceStartDate ??
    vehicle.registrationDate ??
    parseMebbisDate(readMebbisString(row.serviceStartDate)) ??
    parseMebbisDate(readMebbisString(row.registrationDate)) ??
    endDate;
  const notes = "MEBBIS araç listesinden aktarıldı.";

  if (existing) {
    if (existing.endDate === endDate && existing.startDate === startDate && existing.notes === notes) {
      return false;
    }

    await updateVehicleDocument(vehicle.id, existing.id, {
      documentType: "inspection",
      startDate,
      endDate,
      notes,
      rowVersion: existing.rowVersion,
    });
    return true;
  }

  await createVehicleDocument(vehicle.id, {
    documentType: "inspection",
    startDate,
    endDate,
    notes,
  });
  return true;
}

async function upsertMebbisInsuranceDocument(
  vehicle: VehicleResponse,
  row: MebbisVehicleInventoryRow,
  documents: VehicleDocumentResponse[]
): Promise<boolean> {
  const startDate = parseMebbisDate(readMebbisString(row.insuranceStartDate));
  if (!startDate) return false;

  const endDate = addOneYear(startDate);
  const existing = selectVehicleDocument(documents, "insurance", endDate);
  const documentNumber = readMebbisString(row.insuranceDocumentNumber);
  const notes = documentNumber
    ? `MEBBIS trafik sigortası belge no: ${documentNumber}`
    : "MEBBIS araç detayından aktarıldı.";

  if (existing) {
    if (existing.startDate === startDate && existing.endDate === endDate && existing.notes === notes) {
      return false;
    }

    await updateVehicleDocument(vehicle.id, existing.id, {
      documentType: "insurance",
      startDate,
      endDate,
      notes,
      rowVersion: existing.rowVersion,
    });
    return true;
  }

  await createVehicleDocument(vehicle.id, {
    documentType: "insurance",
    startDate,
    endDate,
    notes,
  });
  return true;
}

function selectInspectionDocument(
  documents: VehicleDocumentResponse[],
  endDate: string
): VehicleDocumentResponse | null {
  return selectVehicleDocument(documents, "inspection", endDate);
}

function selectVehicleDocument(
  documents: VehicleDocumentResponse[],
  documentType: "insurance" | "inspection",
  endDate: string
): VehicleDocumentResponse | null {
  const typedDocuments = documents.filter((document) => document.documentType === documentType);
  return (
    typedDocuments.find((document) => document.endDate === endDate) ??
    typedDocuments
      .slice()
      .sort((left, right) => right.endDate.localeCompare(left.endDate))[0] ??
    null
  );
}

function readMebbisString(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function readMebbisNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value !== "string") return null;
  const parsed = Number.parseInt(value.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePlate(value: string): string {
  return value.replace(/\s+/g, "").toLocaleUpperCase("tr-TR").trim();
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

function parseLicenseClassCode(value: string): LicenseClass {
  return normalizeComparable(value)
    .replace(/\bSINIFI\b/g, " ")
    .replace(/\bSERTIFIKA\b/g, " ")
    .replace(/\bSERTIFIKASI\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")[0] || "";
}

function parseMebbisDate(value: string): string | null {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  return `${match[3]}-${month}-${day}`;
}

function addOneYear(isoDate: string): string {
  const [yearText, month, day] = isoDate.split("-");
  const year = Number.parseInt(yearText, 10);
  if (!Number.isFinite(year) || !month || !day) return isoDate;
  return `${year + 1}-${month}-${day}`;
}

function isMebbisVehicleActive(value: string): boolean {
  const normalized = normalizeComparable(value);
  return normalized.includes("HIZMETTE");
}

function mapMebbisTransmission(
  value: unknown,
  fallback: VehicleTransmissionType | undefined
): VehicleTransmissionType {
  const normalized = normalizeComparable(readMebbisString(value));
  if (normalized.includes("OTOMATIK")) return "automatic";
  if (normalized.includes("MANUEL")) return "manual";
  return fallback ?? "manual";
}

function mapMebbisOwnership(
  value: unknown,
  fallback: VehicleOwnershipType | undefined
): VehicleOwnershipType {
  const normalized = normalizeComparable(readMebbisString(value));
  if (normalized.includes("KIRALIK")) return "leased";
  if (normalized.includes("KURUMA AIT")) return "owned";
  return fallback ?? "owned";
}

function mapMebbisVehicleType(
  licenseClass: LicenseClass,
  fallback: VehicleType | undefined
): VehicleType {
  return /^A\d?$/i.test(licenseClass) ? "motorcycle" : fallback ?? "automobile";
}

function mergeVehicleDetails(
  current: string | null | undefined,
  row: MebbisVehicleInventoryRow
): string | null {
  const details = [
    readMebbisString(row.institutionApprovalStatus)
      ? `Kurum onayı: ${readMebbisString(row.institutionApprovalStatus)}`
      : null,
    readMebbisString(row.memApprovalStatus)
      ? `MEM onayı: ${readMebbisString(row.memApprovalStatus)}`
      : null,
    readMebbisString(row.serviceEndDate)
      ? `Hizmetten çıkış: ${readMebbisString(row.serviceEndDate)}`
      : null,
  ].filter(Boolean);
  const next = details.join(" | ");
  if (!next) return current ?? null;
  if (current?.includes("Kurum onayı:") || current?.includes("MEM onayı:")) return current;
  return current ? `${current}\n${next}` : next;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
