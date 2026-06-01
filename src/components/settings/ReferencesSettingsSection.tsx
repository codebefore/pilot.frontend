import { useEffect, useState } from "react";

import { PencilIcon, TrashIcon } from "../icons";
import { StatusPill } from "../ui/StatusPill";
import { useToast } from "../ui/Toast";
import {
  createCandidateReference,
  deleteCandidateReference,
  getCandidateReferences,
  updateCandidateReference,
  type CandidateReferenceResponse,
} from "../../lib/candidate-references-api";
import { useAuth } from "../../lib/auth";
import { canManageArea } from "../../lib/permissions";
import { useT } from "../../lib/i18n";

export function ReferencesSettingsSection() {
  const { showToast } = useToast();
  const { user, permissions } = useAuth();
  const canManageCandidates = canManageArea(user, permissions, "candidates");
  const t = useT();
  const noPermissionTitle = t("common.noPermission");
  const [items, setItems] = useState<CandidateReferenceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<CandidateReferenceResponse | null>(null);
  const [editName, setEditName] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getCandidateReferences({ includeInactive: true })
      .then((data) => {
        if (!controller.signal.aborted) setItems(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) showToast("Referans listesi yüklenemedi", "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refreshKey, showToast]);

  const refresh = () => setRefreshKey((value) => value + 1);

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
        name: trimmed,
        displayOrder: nextOrder,
        isActive: true,
      });
      setNewName("");
      setCreating(false);
      showToast("Referans eklendi");
      refresh();
    } catch {
      showToast("Referans eklenemedi", "error");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: CandidateReferenceResponse) => {
    if (!canManageCandidates) return;
    setEditing(item);
    setEditName(item.name);
    setEditActive(item.isActive);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditName("");
  };

  const handleSaveEdit = async () => {
    if (!canManageCandidates) return;
    if (!editing) return;
    const trimmed = editName.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await updateCandidateReference(editing.id, {
        name: trimmed,
        displayOrder: editing.displayOrder,
        isActive: editActive,
        rowVersion: editing.rowVersion,
      });
      cancelEdit();
      showToast("Referans güncellendi");
      refresh();
    } catch {
      showToast("Referans güncellenemedi", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canManageCandidates) return;
    setDeletingId(id);
    try {
      await deleteCandidateReference(id);
      showToast("Referans silindi");
      setConfirmDeleteId(null);
      refresh();
    } catch {
      showToast("Referans silinemedi", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const activeCount = items.filter((item) => item.isActive).length;

  return (
    <div className="settings-section-stack">
      <div className="settings-summary-grid">
        <div className="settings-summary-card">
          <span className="settings-summary-label">Toplam Referans</span>
          <strong className="settings-summary-value">{items.length}</strong>
        </div>
        <div className="settings-summary-card">
          <span className="settings-summary-label">Aktif</span>
          <strong className="settings-summary-value">{activeCount}</strong>
        </div>
      </div>

      <section className="settings-surface">
        <div className="settings-surface-header">
          <div className="settings-surface-title">Referans Listesi</div>
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
              Yeni Referans
            </button>
          ) : null}
        </div>

        {creating ? (
          <div className="settings-panel-note" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              autoFocus
              className="form-input"
              disabled={!canManageCandidates}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleCreate();
                if (event.key === "Escape") {
                  setCreating(false);
                  setNewName("");
                }
              }}
              placeholder="Referans adı"
              value={newName}
            />
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
              }}
              type="button"
            >
              Vazgeç
            </button>
          </div>
        ) : null}

        <div className="settings-table-wrap">
          <table className="settings-table">
            <thead>
              <tr>
                <th>Ad</th>
                <th>Durum</th>
                <th style={{ width: 120 }} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3}>Yükleniyor...</td>
                </tr>
              ) : null}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={3}>Henüz referans tanımı yok.</td>
                </tr>
              ) : null}
              {items.map((item) => {
                const isEditing = editing?.id === item.id;
                const isConfirming = confirmDeleteId === item.id;
                return (
                  <tr key={item.id}>
                    <td>
                      {isEditing ? (
                        <input
                          autoFocus
                          className="form-input"
                          disabled={!canManageCandidates}
                          onChange={(event) => setEditName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void handleSaveEdit();
                            if (event.key === "Escape") cancelEdit();
                          }}
                          value={editName}
                        />
                      ) : (
                        item.name
                      )}
                    </td>
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
                            title={!canManageCandidates ? noPermissionTitle : "Düzenle"}
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
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
