import { useEffect, useMemo, useState } from "react";

import { PencilIcon, PlusIcon, TrashIcon } from "../icons";
import { VehicleFormModal } from "../modals/VehicleFormModal";
import { ColumnPicker, type ColumnOption } from "../ui/ColumnPicker";
import { Pagination } from "../ui/Pagination";
import { SearchInput } from "../ui/SearchInput";
import { StatusPill } from "../ui/StatusPill";
import { TableHeaderFilter } from "../ui/TableHeaderFilter";
import { useToast } from "../ui/Toast";
import { useT } from "../../lib/i18n";
import {
  deleteVehicle,
  getVehicles,
  type VehicleActivityFilter,
  type VehicleSortDirection,
  type VehicleSortField,
} from "../../lib/vehicles-api";
import {
  VEHICLE_STATUS_OPTIONS,
  VEHICLE_STATUS_LABELS,
  VEHICLE_TRANSMISSION_OPTIONS,
  VEHICLE_TRANSMISSION_LABELS,
  VEHICLE_TYPE_LABELS,
} from "../../lib/vehicle-catalog";
import type {
  LicenseClass,
  VehicleListSummaryResponse,
  VehicleResponse,
  VehicleStatus,
  VehicleTransmissionType,
} from "../../lib/types";
import { useColumnVisibility } from "../../lib/use-column-visibility";
import {
  type LicenseClassOption,
  useLicenseClassOptions,
} from "../../lib/use-license-class-options";

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const SEARCH_DEBOUNCE_MS = 300;
type SortState = { field: VehicleSortField; direction: VehicleSortDirection } | null;
type VehicleFilterValue<T extends string> = T | "all";
type VehicleFilters = {
  activity: VehicleActivityFilter;
  status: VehicleFilterValue<VehicleStatus>;
  licenseClass: VehicleFilterValue<LicenseClass>;
  transmissionType: VehicleFilterValue<VehicleTransmissionType>;
};
type VehicleColumnId =
  | "plateNumber"
  | "brandModel"
  | "vehicleType"
  | "licenseClass"
  | "transmissionType"
  | "status"
  | "isActive";
type VehicleColumnDef = {
  id: VehicleColumnId;
  labelKey: string;
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
      id: "brandModel",
      labelKey: "settings.vehicles.columns.brandModel",
      sortField: "brandModel",
      renderCell: (vehicle) => (
        <div>
          {vehicle.brand}
          {vehicle.model ? ` ${vehicle.model}` : ""}
          {vehicle.modelYear ? ` · ${vehicle.modelYear}` : ""}
        </div>
      ),
      skeletonWidth: 180,
    },
    {
      id: "vehicleType",
      labelKey: "settings.vehicles.columns.vehicleType",
      sortField: "vehicleType",
      renderCell: (vehicle) => VEHICLE_TYPE_LABELS[vehicle.vehicleType],
      skeletonWidth: 88,
    },
    {
      id: "licenseClass",
      labelKey: "settings.vehicles.columns.licenseClass",
      sortField: "licenseClass",
      renderCell: (vehicle) => vehicle.licenseClass,
      skeletonWidth: 44,
    },
    {
      id: "transmissionType",
      labelKey: "settings.vehicles.columns.transmissionType",
      sortField: "transmissionType",
      renderCell: (vehicle) => VEHICLE_TRANSMISSION_LABELS[vehicle.transmissionType],
      skeletonWidth: 76,
    },
    {
      id: "status",
      labelKey: "settings.vehicles.columns.status",
      sortField: "status",
      renderCell: (vehicle) => (
        <StatusPill
          label={VEHICLE_STATUS_LABELS[vehicle.status]}
          status={
            vehicle.status === "in_use"
              ? "running"
              : vehicle.status === "maintenance"
                ? "retry"
                : "manual"
          }
        />
      ),
      skeletonWidth: 90,
      skeletonKind: "pill",
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
  ];
}

const VEHICLE_COLUMN_IDS: VehicleColumnId[] = [
  "plateNumber",
  "brandModel",
  "vehicleType",
  "licenseClass",
  "transmissionType",
  "status",
  "isActive",
];
const DEFAULT_FILTERS: VehicleFilters = {
  activity: "active",
  status: "all",
  licenseClass: "all",
  transmissionType: "all",
};

export function VehiclesSettingsSection() {
  const { showToast } = useToast();
  const t = useT();
  const { isVisible, toggle: toggleColumn } = useColumnVisibility(
    "settings.vehicles.columns.v1",
    VEHICLE_COLUMN_IDS
  );

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
  const { options: licenseClassOptions } = useLicenseClassOptions();
  const vehicleColumns = buildVehicleColumns(t);
  const visibleColumns = vehicleColumns.filter((column) => isVisible(column.id));

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
      transmissionType:
        filters.transmissionType !== "all" ? filters.transmissionType : undefined,
      ...(sort ? { sortBy: sort.field, sortDir: sort.direction } : {}),
    };

    getVehicles(query, controller.signal)
      .then((response) => {
        setItems(response.items);
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
    filters.licenseClass !== DEFAULT_FILTERS.licenseClass ||
    filters.transmissionType !== DEFAULT_FILTERS.transmissionType;

  const handleSaved = (_saved: VehicleResponse) => {
    setFormOpen(false);
    setEditing(null);
    setRefreshKey((current) => current + 1);
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

  const handleColumnToggle = (id: string) => {
    const column = vehicleColumns.find((item) => item.id === id);
    if (column?.sortField && isVisible(id) && sort?.field === column.sortField) {
      setSort(null);
    }
    if (isVisible(id)) {
      if (id === "isActive") {
        setFilter("activity", DEFAULT_FILTERS.activity);
      } else if (id === "status") {
        setFilter("status", DEFAULT_FILTERS.status);
      } else if (id === "licenseClass") {
        setFilter("licenseClass", DEFAULT_FILTERS.licenseClass);
      } else if (id === "transmissionType") {
        setFilter("transmissionType", DEFAULT_FILTERS.transmissionType);
      }
    }
    toggleColumn(id);
  };

  const setFilter = <K extends keyof VehicleFilters>(key: K, value: VehicleFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const handleDelete = async (vehicle: VehicleResponse) => {
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
    } catch {
      showToast(t("settings.vehicles.toast.deleteError"), "error");
    } finally {
      setDeletingVehicleId(null);
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
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
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
                          licenseClassOptions,
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
                  <th className="col-picker-th">
                    <ColumnPicker
                      columns={vehicleColumns.map((column) => ({
                        id: column.id,
                        label: t(column.labelKey),
                      }))}
                      isVisible={isVisible}
                      onToggle={handleColumnToggle}
                      triggerTitle={t("settings.vehicles.columnPicker.title")}
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
                      {t("settings.vehicles.empty")}
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
                                disabled={deletingVehicleId === item.id}
                                onClick={() => handleDelete(item)}
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
                                onClick={() => {
                                  setEditing(item);
                                  setFormOpen(true);
                                }}
                                title={t("settings.vehicles.action.edit")}
                                type="button"
                              >
                                <PencilIcon size={14} />
                              </button>
                              <button
                                aria-label={t("settings.vehicles.action.delete")}
                                className="icon-btn icon-btn-danger"
                                disabled={deletingVehicleId !== null}
                                onClick={() => setConfirmDeleteVehicleId(item.id)}
                                title={t("settings.vehicles.action.delete")}
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
            label: option.label,
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

  if (columnId === "transmissionType") {
    return (
      <TableHeaderFilter
        active={filters.transmissionType !== DEFAULT_FILTERS.transmissionType}
        onChange={(nextValue) =>
          setFilter("transmissionType", nextValue as VehicleFilters["transmissionType"])
        }
        options={[
          { value: "all", label: t("common.all") },
          ...VEHICLE_TRANSMISSION_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          })),
        ]}
        title={t("settings.vehicles.filter.transmissionType.title")}
        value={filters.transmissionType}
      />
    );
  }

  return null;
}
