import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { PencilIcon, PlusIcon, TrashIcon } from "../icons";
import { Modal } from "../ui/Modal";
import { SearchInput } from "../ui/SearchInput";
import { StatusPill } from "../ui/StatusPill";
import { useToast } from "../ui/Toast";
import { useAuth } from "../../lib/auth";
import {
  createCashMovementCategory,
  deleteCashMovementCategory,
  getCashMovementCategories,
  updateCashMovementCategory,
} from "../../lib/cash-movement-categories-api";
import { canManageArea } from "../../lib/permissions";
import type {
  CashMovementCategoryResponse,
  CashMovementCategoryUpsertRequest,
  CashMovementDirection,
  CashMovementReferenceType,
} from "../../lib/types";

const EMPTY_FORM: CashMovementCategoryUpsertRequest = {
  name: "",
  direction: "outflow",
  referenceType: "other",
  isDescriptionRequired: false,
  isActive: true,
  notes: "",
};

const directionLabel = (value: CashMovementDirection) =>
  value === "inflow" ? "Gelir" : "Gider";
const referenceLabel = (value: CashMovementReferenceType) =>
  value === "vehicle" ? "Araç" : value === "personnel" ? "Personel" : "Diğer";

export function CashMovementCategoriesSettingsSection() {
  const { user, permissions } = useAuth();
  const canManage = canManageArea(user, permissions, "payments");
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<CashMovementCategoryResponse | null>(
    null,
  );
  const [formOpen, setFormOpen] = useState(false);

  const query = useQuery({
    queryKey: ["settings", "cash-movement-categories", search, showInactive],
    queryFn: ({ signal }) =>
      getCashMovementCategories(
        {
          search: search.trim() || undefined,
          activity: showInactive ? "all" : "active",
          page: 1,
          pageSize: 100,
        },
        signal,
      ),
    retry: false,
  });

  useEffect(() => {
    if (query.isError) showToast("Gelir/gider kalemleri yüklenemedi", "error");
  }, [query.isError, showToast]);

  const counts = useMemo(
    () => ({
      total: query.data?.totalCount ?? 0,
      income:
        query.data?.items.filter((item) => item.direction === "inflow")
          .length ?? 0,
      expense:
        query.data?.items.filter((item) => item.direction === "outflow")
          .length ?? 0,
      inactive: query.data?.summary.inactiveCount ?? 0,
    }),
    [query.data],
  );

  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: ["settings", "cash-movement-categories"],
    });
    void queryClient.invalidateQueries({ queryKey: ["payments"] });
  };

  const remove = async (item: CashMovementCategoryResponse) => {
    if (!canManage) return;
    try {
      await deleteCashMovementCategory(item.id);
      refresh();
      showToast("Kalem pasife alındı");
    } catch {
      showToast("Kalem pasife alınamadı", "error");
    }
  };

  return (
    <>
      <div className="settings-section-stack">
        <div className="settings-summary-grid">
          <Summary label="Toplam" value={counts.total} />
          <Summary label="Gelir" value={counts.income} />
          <Summary label="Gider" value={counts.expense} />
          <Summary label="Pasif" value={counts.inactive} />
        </div>

        <section className="settings-surface">
          <div className="settings-surface-header">
            <div className="settings-surface-title">Gelir/Gider Kalemleri</div>
            <div className="settings-module-actions">
              <div className="search-box settings-module-search settings-module-search-compact">
                <SearchInput
                  debounceMs={300}
                  onChange={setSearch}
                  placeholder="Kalem ara"
                  value={search}
                />
              </div>
              <label className="switch-toggle toolbar-switch-toggle">
                <input
                  checked={showInactive}
                  onChange={(event) => setShowInactive(event.target.checked)}
                  type="checkbox"
                />
                <span className="switch-toggle-control" aria-hidden="true" />
                <span>Pasifleri göster</span>
              </label>
              <button
                className="btn btn-primary btn-sm"
                disabled={!canManage}
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                type="button"
              >
                <PlusIcon size={14} /> Yeni Kalem
              </button>
            </div>
          </div>
          <div className="settings-surface-body">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kalem adı</th>
                  <th>Yön</th>
                  <th>Bağlantı tipi</th>
                  <th>Açıklama</th>
                  <th>Durum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {query.isLoading ? (
                  <tr>
                    <td className="data-table-empty" colSpan={6}>
                      Yükleniyor...
                    </td>
                  </tr>
                ) : query.data?.items.length ? (
                  query.data.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                      </td>
                      <td>
                        <StatusPill
                          label={directionLabel(item.direction)}
                          status={
                            item.direction === "inflow" ? "success" : "manual"
                          }
                        />
                      </td>
                      <td>{referenceLabel(item.referenceType)}</td>
                      <td>
                        {item.isDescriptionRequired
                          ? "Zorunlu"
                          : "İsteğe bağlı"}
                      </td>
                      <td>
                        <StatusPill
                          label={item.isActive ? "Aktif" : "Pasif"}
                          status={item.isActive ? "success" : "manual"}
                        />
                      </td>
                      <td className="col-picker-td">
                        <div className="table-row-actions">
                          <button
                            className="icon-btn"
                            disabled={!canManage}
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
                            className="icon-btn icon-btn-danger"
                            disabled={!canManage || !item.isActive}
                            onClick={() => void remove(item)}
                            title="Pasife al"
                            type="button"
                          >
                            <TrashIcon size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="data-table-empty" colSpan={6}>
                      Kalem bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <CategoryModal
        canManage={canManage}
        editing={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={() => {
          setFormOpen(false);
          setEditing(null);
          refresh();
        }}
        open={formOpen}
      />
    </>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="settings-summary-card">
      <span className="settings-summary-label">{label}</span>
      <strong className="settings-summary-value">{value}</strong>
    </div>
  );
}

function CategoryModal({
  open,
  editing,
  canManage,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: CashMovementCategoryResponse | null;
  canManage: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [form, setForm] =
    useState<CashMovementCategoryUpsertRequest>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setForm(
      editing
        ? {
            name: editing.name,
            direction: editing.direction,
            referenceType: editing.referenceType,
            isDescriptionRequired: editing.isDescriptionRequired,
            isActive: editing.isActive,
            notes: editing.notes ?? "",
            rowVersion: editing.rowVersion,
          }
        : EMPTY_FORM,
    );
  }, [editing, open]);

  const save = async () => {
    if (!canManage || !form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        notes: form.notes?.trim() || null,
      };
      if (editing) await updateCashMovementCategory(editing.id, payload);
      else await createCashMovementCategory(payload);
      showToast(editing ? "Kalem güncellendi" : "Kalem oluşturuldu");
      onSaved();
    } catch {
      showToast(
        "Kalem kaydedilemedi. Aynı yönde aynı ad kullanılıyor olabilir.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} type="button">
            İptal
          </button>
          <button
            className="btn btn-primary"
            disabled={saving || !form.name.trim()}
            onClick={() => void save()}
            type="button"
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title={editing ? "Kalemi Düzenle" : "Yeni Gelir/Gider Kalemi"}
    >
      <form
        className="settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Kalem adı</label>
            <input
              className="form-input"
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Hareket yönü</label>
            <select
              className="form-input"
              value={form.direction}
              onChange={(event) =>
                setForm({
                  ...form,
                  direction: event.target.value as CashMovementDirection,
                })
              }
            >
              <option value="outflow">Gider</option>
              <option value="inflow">Gelir</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Bağlantı tipi</label>
            <select
              className="form-input"
              value={form.referenceType}
              onChange={(event) =>
                setForm({
                  ...form,
                  referenceType: event.target
                    .value as CashMovementReferenceType,
                })
              }
            >
              <option value="vehicle">Araç</option>
              <option value="personnel">Personel</option>
              <option value="other">Diğer</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Durum</label>
            <label className="switch-toggle">
              <input
                checked={form.isActive}
                onChange={(event) =>
                  setForm({ ...form, isActive: event.target.checked })
                }
                type="checkbox"
              />
              <span className="switch-toggle-control" aria-hidden="true" />
              <span>{form.isActive ? "Aktif" : "Pasif"}</span>
            </label>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="switch-toggle">
              <input
                checked={form.isDescriptionRequired}
                onChange={(event) =>
                  setForm({
                    ...form,
                    isDescriptionRequired: event.target.checked,
                  })
                }
                type="checkbox"
              />
              <span className="switch-toggle-control" aria-hidden="true" />
              <span>Açıklama zorunlu</span>
            </label>
          </div>
        </div>
        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">Not</label>
            <textarea
              className="form-input"
              rows={3}
              value={form.notes ?? ""}
              onChange={(event) =>
                setForm({ ...form, notes: event.target.value })
              }
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
