import { useEffect, useMemo, useState } from "react";

import { PencilIcon, PlusIcon, TrashIcon } from "../icons";
import { VehicleFormModal } from "../modals/VehicleFormModal";
import { ColumnPicker, type ColumnOption } from "../ui/ColumnPicker";
import { Pagination } from "../ui/Pagination";
import { SearchInput } from "../ui/SearchInput";
import { StatusPill } from "../ui/StatusPill";
import { TableHeaderFilter } from "../ui/TableHeaderFilter";
import { useToast } from "../ui/Toast";
import {
  deleteVehicle,
  getVehicles,
  type VehicleActivityFilter,
  type VehicleSortDirection,
  type VehicleSortField,
} from "../../lib/vehicles-api";
import {
  VEHICLE_LICENSE_CLASS_OPTIONS,
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

const PAGE_SIZE = 10;
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
  label: string;
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

const VEHICLE_COLUMNS: VehicleColumnDef[] = [
  {
    id: "plateNumber",
    label: "Plaka",
    sortField: "plateNumber",
    renderCell: (vehicle) => <strong>{vehicle.plateNumber}</strong>,
    skeletonWidth: 84,
  },
  {
    id: "brandModel",
    label: "Marka / Model",
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
    label: "Tür",
    sortField: "vehicleType",
    renderCell: (vehicle) => VEHICLE_TYPE_LABELS[vehicle.vehicleType],
    skeletonWidth: 88,
  },
  {
    id: "licenseClass",
    label: "Belge",
    sortField: "licenseClass",
    renderCell: (vehicle) => vehicle.licenseClass,
    skeletonWidth: 44,
  },
  {
    id: "transmissionType",
    label: "Vites",
    sortField: "transmissionType",
    renderCell: (vehicle) => VEHICLE_TRANSMISSION_LABELS[vehicle.transmissionType],
    skeletonWidth: 76,
  },
  {
    id: "status",
    label: "Araç Durumu",
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
    label: "Genel Durum",
    sortField: "isActive",
    renderCell: (vehicle) => (
      <StatusPill
        label={vehicle.isActive ? "Aktif" : "Pasif"}
        status={vehicle.isActive ? "success" : "manual"}
      />
    ),
    skeletonWidth: 74,
    skeletonKind: "pill",
  },
];
const VEHICLE_COLUMN_IDS = VEHICLE_COLUMNS.map((column) => column.id);
const VEHICLE_COLUMN_PICKER_OPTIONS: ColumnOption[] = VEHICLE_COLUMNS.map((column) => ({
  id: column.id,
  label: column.label,
}));
const DEFAULT_FILTERS: VehicleFilters = {
  activity: "active",
  status: "all",
  licenseClass: "all",
  transmissionType: "all",
};

export function VehiclesSettingsSection() {
  const { showToast } = useToast();
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
  const [filters, setFilters] = useState<VehicleFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleResponse | null>(null);
  const [confirmDeleteVehicleId, setConfirmDeleteVehicleId] = useState<string | null>(null);
  const [deletingVehicleId, setDeletingVehicleId] = useState<string | null>(null);
  const visibleColumns = VEHICLE_COLUMNS.filter((column) => isVisible(column.id));

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const query = {
      activity: filters.activity,
      page,
      pageSize: PAGE_SIZE,
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
        showToast("Araç listesi yüklenemedi", "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [filters, page, refreshKey, search, showToast, sort]);

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
    showToast(editing ? "Araç kaydı güncellendi" : "Araç kaydı oluşturuldu");
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
    const column = VEHICLE_COLUMNS.find((item) => item.id === id);
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
      showToast("Araç silindi");
      if (items.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        setRefreshKey((current) => current + 1);
      }
    } catch {
      showToast("Araç silinemedi", "error");
    } finally {
      setDeletingVehicleId(null);
    }
  };

  return (
    <>
      <div className="settings-section-stack">
        <div className="settings-summary-grid">
          <div className="settings-summary-card">
            <span className="settings-summary-label">Toplam Araç</span>
            <strong className="settings-summary-value">{counts.total}</strong>
          </div>
          <div className="settings-summary-card">
            <span className="settings-summary-label">Boşta</span>
            <strong className="settings-summary-value">{counts.idle}</strong>
          </div>
          <div className="settings-summary-card">
            <span className="settings-summary-label">Kullanımda</span>
            <strong className="settings-summary-value">{counts.inUse}</strong>
          </div>
          <div className="settings-summary-card">
            <span className="settings-summary-label">Bakımda</span>
            <strong className="settings-summary-value">{counts.maintenance}</strong>
          </div>
        </div>

        <section className="settings-surface">
          <div className="settings-surface-header">
            <div className="settings-surface-title">Araç Listesi</div>
            <div className="settings-module-actions">
              <div className="search-box settings-module-search settings-module-search-compact">
                <SearchInput
                  onChange={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                  placeholder="Plaka, marka veya model ara"
                  value={search}
                />
              </div>
              {hasActiveFilters ? (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSearch("");
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
                Yeni Araç
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
                      <th key={column.id}>{column.label}</th>
                    )
                  )}
                  <th className="col-picker-th">
                    <ColumnPicker
                      columns={VEHICLE_COLUMN_PICKER_OPTIONS}
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
                      Araç kaydı bulunmuyor.
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
                                Vazgeç
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                disabled={deletingVehicleId === item.id}
                                onClick={() => handleDelete(item)}
                                type="button"
                              >
                                {deletingVehicleId === item.id ? "Siliniyor..." : "Sil"}
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
                                disabled={deletingVehicleId !== null}
                                onClick={() => setConfirmDeleteVehicleId(item.id)}
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
              page={page}
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
  setFilter: <K extends keyof VehicleFilters>(key: K, value: VehicleFilters[K]) => void
) {
  if (columnId === "isActive") {
    return (
      <TableHeaderFilter
        active={filters.activity !== DEFAULT_FILTERS.activity}
        onChange={(nextValue) => setFilter("activity", nextValue as VehicleActivityFilter)}
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

  if (columnId === "status") {
    return (
      <TableHeaderFilter
        active={filters.status !== DEFAULT_FILTERS.status}
        onChange={(nextValue) => setFilter("status", nextValue as VehicleFilters["status"])}
        options={[
          { value: "all", label: "Tümü" },
          ...VEHICLE_STATUS_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          })),
        ]}
        title="Araç Durumu filtresi"
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
          { value: "all", label: "Tümü" },
          ...VEHICLE_LICENSE_CLASS_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          })),
        ]}
        title="Belge filtresi"
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
          { value: "all", label: "Tümü" },
          ...VEHICLE_TRANSMISSION_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          })),
        ]}
        title="Vites filtresi"
        value={filters.transmissionType}
      />
    );
  }

  return null;
}
