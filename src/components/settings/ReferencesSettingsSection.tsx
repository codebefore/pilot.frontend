import {
  Fragment,
  useEffect,
  useState,
  type ChangeEvent,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { PencilIcon, TrashIcon } from "../icons";
import { SettingsTableSkeleton } from "../ui/Skeleton";
import { StatusPill } from "../ui/StatusPill";
import { useToast } from "../ui/Toast";
import {
  createCandidateReference,
  deleteCandidateReference,
  getCandidateReferences,
  updateCandidateReference,
  type CandidateReferenceKind,
  type CandidateReferenceResponse,
} from "../../lib/candidate-references-api";
import { getVehicles } from "../../lib/vehicles-api";
import { useAuth } from "../../lib/auth";
import { canManageArea } from "../../lib/permissions";
import { useT } from "../../lib/i18n";
import { candidateKeys } from "../../lib/queries/use-candidates";
import type { VehicleResponse } from "../../lib/types";

const SETTINGS_QUERY_CACHE_MS = 5 * 60 * 1000;

type ReferencesSettingsSectionCopy = {
  totalLabel: string;
  listTitle: string;
  newButton: string;
  placeholder: string;
  emptyText: string;
  nameColumn: string;
  addedToast: string;
  addFailedToast: string;
  updatedToast: string;
  deletedToast: string;
  deleteFailedToast: string;
  vehicleColumn?: string;
  vehicleSelectLabel?: string;
};

const referenceCopy: ReferencesSettingsSectionCopy = {
  totalLabel: "Toplam Referans",
  listTitle: "Referans Listesi",
  newButton: "Yeni Referans",
  placeholder: "Referans adı",
  emptyText: "Henüz referans tanımı yok.",
  nameColumn: "Ad",
  addedToast: "Referans eklendi",
  addFailedToast: "Referans eklenemedi",
  updatedToast: "Referans güncellendi",
  deletedToast: "Referans silindi",
  deleteFailedToast: "Referans silinemedi",
};

const routeCopy: ReferencesSettingsSectionCopy = {
  totalLabel: "Toplam Güzergah",
  listTitle: "Güzergah Listesi",
  newButton: "Yeni Güzergah",
  placeholder: "Güzergah adı",
  emptyText: "Henüz güzergah tanımı yok.",
  nameColumn: "Adres",
  addedToast: "Güzergah eklendi",
  addFailedToast: "Güzergah eklenemedi",
  updatedToast: "Güzergah güncellendi",
  deletedToast: "Güzergah silindi",
  deleteFailedToast: "Güzergah silinemedi",
  vehicleColumn: "Araç Plakaları",
  vehicleSelectLabel: "Araç plakaları",
};

type ReferencesSettingsSectionProps = {
  variant?: "references" | "routes";
};

function vehicleLabel(vehicle: VehicleResponse): string {
  const name = [vehicle.brand, vehicle.model].filter(Boolean).join(" ").trim();
  return name ? `${vehicle.plateNumber} · ${name}` : vehicle.plateNumber;
}

export function ReferencesSettingsSection({ variant = "references" }: ReferencesSettingsSectionProps) {
  const { showToast } = useToast();
  const { user, permissions } = useAuth();
  const canManageCandidates = canManageArea(user, permissions, "candidates");
  const t = useT();
  const copy = variant === "routes" ? routeCopy : referenceCopy;
  const kind: CandidateReferenceKind = variant === "routes" ? "route" : "reference";
  const queryClient = useQueryClient();
  const noPermissionTitle = t("common.noPermission");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<CandidateReferenceResponse | null>(null);
  const [editName, setEditName] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [editVehicleIds, setEditVehicleIds] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const referencesQuery = useQuery({
    gcTime: SETTINGS_QUERY_CACHE_MS,
    queryKey: ["settings", "candidate-references", { includeInactive: true, kind }],
    queryFn: ({ signal }) => getCandidateReferences({ includeInactive: true, kind }, signal),
    retry: false,
  });
  const vehiclesQuery = useQuery({
    enabled: kind === "route",
    gcTime: SETTINGS_QUERY_CACHE_MS,
    queryKey: ["settings", "vehicles", { activity: "active", page: 1, pageSize: 1000 }],
    queryFn: ({ signal }) => getVehicles({ activity: "active", page: 1, pageSize: 1000 }, signal),
    retry: false,
  });
  const items = referencesQuery.data ?? [];
  const vehicles = vehiclesQuery.data?.items ?? [];
  const loading = referencesQuery.isLoading;

  useEffect(() => {
    if (referencesQuery.isError) {
      showToast(t("references.toast.loadFailed"), "error");
    }
  }, [referencesQuery.isError, showToast, t]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["settings", "candidate-references"] });
    if (kind === "route") {
      void queryClient.invalidateQueries({ queryKey: ["settings", "candidate-routes"] });
    }
    void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const handleCreate = async () => {
    if (!canManageCandidates) return;
    const trimmed = newName.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const nextOrder = items.length > 0
        ? Math.max(...items.map((item) => item.displayOrder)) + 100
        : 100;
      await createCandidateReference({
        kind,
        name: trimmed,
        vehicleIds: kind === "route" ? selectedVehicleIds : [],
        displayOrder: nextOrder,
        isActive: true,
      });
      setNewName("");
      setSelectedVehicleIds([]);
      setCreating(false);
      showToast(copy.addedToast);
      refresh();
    } catch {
      showToast(copy.addFailedToast, "error");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: CandidateReferenceResponse) => {
    if (!canManageCandidates) return;
    setEditing(item);
    setEditName(item.name);
    setEditActive(item.isActive);
    setEditVehicleIds(item.vehicleIds ?? []);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditName("");
    setEditVehicleIds([]);
  };

  const handleSaveEdit = async () => {
    if (!canManageCandidates) return;
    if (!editing) return;
    const trimmed = editName.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const payload = {
        kind,
        name: trimmed,
        vehicleIds: kind === "route" ? editVehicleIds : [],
        displayOrder: editing.displayOrder,
        isActive: editActive,
        rowVersion: editing.rowVersion,
      };
      const saved = await updateCandidateReference(editing.id, payload);
      applyReferenceToCache({ ...saved, vehicleIds: payload.vehicleIds });
      cancelEdit();
      showToast(copy.updatedToast);
      refresh();
    } catch {
      showToast(t("references.toast.updateFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const applyReferenceToCache = (saved: CandidateReferenceResponse) => {
    const replace = (current: CandidateReferenceResponse[] | undefined) =>
      current?.map((item) => (item.id === saved.id ? saved : item));
    queryClient.setQueriesData<CandidateReferenceResponse[]>(
      { queryKey: ["settings", "candidate-references"] },
      replace
    );
    if (saved.kind === "route") {
      queryClient.setQueriesData<CandidateReferenceResponse[]>(
        { queryKey: ["settings", "candidate-routes"] },
        replace
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!canManageCandidates) return;
    setDeletingId(id);
    try {
      await deleteCandidateReference(id);
      showToast(copy.deletedToast);
      setConfirmDeleteId(null);
      refresh();
    } catch {
      showToast(copy.deleteFailedToast, "error");
    } finally {
      setDeletingId(null);
    }
  };

  const activeCount = items.filter((item) => item.isActive).length;
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const columnCount = kind === "route" ? 4 : 3;

  const toggleSelectedVehicle = (
    vehicleId: string,
    setter: Dispatch<SetStateAction<string[]>>
  ) => {
    setter((current) =>
      current.includes(vehicleId)
        ? current.filter((id) => id !== vehicleId)
        : [...current, vehicleId]
    );
  };

  const renderVehiclePicker = (
    value: string[],
    setter: Dispatch<SetStateAction<string[]>>
  ) => {
    if (kind !== "route") return null;
    return (
      <div className="settings-panel-note" style={{ display: "grid", gap: 8 }}>
        <span className="settings-summary-label">{copy.vehicleSelectLabel}</span>
        {vehiclesQuery.isLoading ? (
          <span>Araçlar yükleniyor...</span>
        ) : vehicles.length === 0 ? (
          <span>Aktif araç bulunmuyor.</span>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {vehicles.map((vehicle) => (
              <label className="route-vehicle-toggle" key={vehicle.id}>
                <input
                  checked={value.includes(vehicle.id)}
                  disabled={!canManageCandidates}
                  onChange={() => toggleSelectedVehicle(vehicle.id, setter)}
                  type="checkbox"
                />
                <span className="route-vehicle-toggle-control" aria-hidden="true" />
                <span className="route-vehicle-toggle-label">{vehicleLabel(vehicle)}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    );
  };

  const formatVehicleIds = (vehicleIds: string[] | undefined) => {
    if (!vehicleIds || vehicleIds.length === 0) return "—";
    return vehicleIds
      .map((id) => {
        const vehicle = vehicleById.get(id);
        return vehicle ? vehicleLabel(vehicle) : id;
      })
      .join(", ");
  };

  const renderNameField = (
    value: string,
    onChange: (value: string) => void,
    onEnter: () => void,
    onEscape: () => void,
    autoFocus = false
  ) => {
    const commonProps = {
      autoFocus,
      className: "form-input",
      disabled: !canManageCandidates,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
      onKeyDown: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (event.key === "Enter" && (kind !== "route" || !event.shiftKey)) {
          event.preventDefault();
          onEnter();
        }
        if (event.key === "Escape") onEscape();
      },
      placeholder: copy.placeholder,
      value,
    };

    return kind === "route" ? (
      <textarea {...commonProps} className="form-input settings-route-address-input" rows={3} />
    ) : (
      <input {...commonProps} />
    );
  };

  return (
    <div className="settings-section-stack">
      <div className="settings-summary-grid">
        <div className="settings-summary-card">
          <span className="settings-summary-label">{copy.totalLabel}</span>
          <strong className="settings-summary-value">{items.length}</strong>
        </div>
        <div className="settings-summary-card">
          <span className="settings-summary-label">Aktif</span>
          <strong className="settings-summary-value">{activeCount}</strong>
        </div>
      </div>

      <section className="settings-surface">
        <div className="settings-surface-header">
          <div className="settings-surface-title">{copy.listTitle}</div>
          {!creating ? (
          <button
            className="btn btn-primary btn-sm"
            disabled={!canManageCandidates}
            onClick={() => {
              if (!canManageCandidates) return;
              setCreating(true);
            }}
            title={!canManageCandidates ? noPermissionTitle : undefined}
            type="button"
          >
              {copy.newButton}
            </button>
          ) : null}
        </div>

        {creating ? (
          <div className="settings-panel-note" style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {renderNameField(
                newName,
                setNewName,
                () => void handleCreate(),
                () => {
                    setCreating(false);
                    setNewName("");
                    setSelectedVehicleIds([]);
                },
                true
              )}
              <button
                className="btn btn-primary btn-sm"
                disabled={!canManageCandidates || saving || !newName.trim()}
                onClick={() => void handleCreate()}
                title={!canManageCandidates ? noPermissionTitle : undefined}
                type="button"
              >
                Ekle
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={saving}
                onClick={() => {
                  setCreating(false);
                  setNewName("");
                  setSelectedVehicleIds([]);
                }}
                type="button"
              >
                Vazgeç
              </button>
            </div>
            {renderVehiclePicker(selectedVehicleIds, setSelectedVehicleIds)}
          </div>
        ) : null}

        <div className="settings-table-wrap">
          <table className="settings-table">
            <thead>
              <tr>
                <th>{copy.nameColumn}</th>
                {kind === "route" ? <th>{copy.vehicleColumn}</th> : null}
                <th>Durum</th>
                <th style={{ width: 120 }} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SettingsTableSkeleton columns={kind === "route" ? [180, 180, 72, 64] : [180, 72, 64]} rows={4} />
              ) : null}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={columnCount}>{copy.emptyText}</td>
                </tr>
              ) : null}
              {items.map((item) => {
                const isEditing = editing?.id === item.id;
                const isConfirming = confirmDeleteId === item.id;
                return (
                  <Fragment key={item.id}>
                    <tr>
                      <td colSpan={isEditing && kind === "route" ? 2 : 1}>
                        {isEditing
                          ? renderNameField(
                              editName,
                              setEditName,
                              () => void handleSaveEdit(),
                              cancelEdit,
                              true
                            )
                          : item.name}
                      </td>
                      {kind === "route" && !isEditing ? (
                        <td>{formatVehicleIds(item.vehicleIds)}</td>
                      ) : null}
                      <td>
                        {isEditing ? (
                          <label className="switch-toggle switch-toggle-sm">
                            <input
                              checked={editActive}
                              disabled={!canManageCandidates}
                              onChange={(event) => setEditActive(event.target.checked)}
                              type="checkbox"
                            />
                            <span className="switch-toggle-control" aria-hidden="true" />
                            <span>{editActive ? "Aktif" : "Pasif"}</span>
                          </label>
                        ) : (
                          <StatusPill
                            label={item.isActive ? "Aktif" : "Pasif"}
                            status={item.isActive ? "success" : "manual"}
                          />
                        )}
                      </td>
                      <td className="settings-table-actions">
                        {isEditing ? (
                          <>
                            <button
                              className="btn btn-primary btn-sm"
                              disabled={!canManageCandidates || saving || !editName.trim()}
                              onClick={() => void handleSaveEdit()}
                              title={!canManageCandidates ? noPermissionTitle : undefined}
                              type="button"
                            >
                              Kaydet
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              disabled={saving}
                              onClick={cancelEdit}
                              type="button"
                            >
                              Vazgeç
                            </button>
                          </>
                        ) : isConfirming ? (
                          <>
                            <button
                              className="btn btn-danger btn-sm"
                              disabled={!canManageCandidates || deletingId === item.id}
                              onClick={() => void handleDelete(item.id)}
                              title={!canManageCandidates ? noPermissionTitle : undefined}
                              type="button"
                            >
                              Sil
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              disabled={deletingId === item.id}
                              onClick={() => setConfirmDeleteId(null)}
                              type="button"
                            >
                              Vazgeç
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="icon-button"
                              disabled={!canManageCandidates}
                              onClick={() => startEdit(item)}
                              title={!canManageCandidates ? noPermissionTitle : t("common.edit")}
                              type="button"
                            >
                              <PencilIcon size={16} />
                            </button>
                            <button
                              className="icon-button"
                              disabled={!canManageCandidates}
                              onClick={() => {
                                if (!canManageCandidates) return;
                                setConfirmDeleteId(item.id);
                              }}
                              title={!canManageCandidates ? noPermissionTitle : "Sil"}
                              type="button"
                            >
                              <TrashIcon size={16} />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                    {isEditing && kind === "route" ? (
                      <tr className="settings-route-vehicle-row">
                        <td colSpan={columnCount}>
                          {renderVehiclePicker(editVehicleIds, setEditVehicleIds)}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
