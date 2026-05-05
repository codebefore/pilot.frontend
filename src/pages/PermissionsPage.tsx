import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { PageToolbar } from "../components/layout/PageToolbar";
import { Modal } from "../components/ui/Modal";
import { Panel } from "../components/ui/Panel";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";
import { ApiError } from "../lib/http";
import { useT, type TranslationKey } from "../lib/i18n";
import {
  deleteRole,
  getPermissionAreas,
  getRolePermissions,
  getRoles,
  saveRolePermissions,
} from "../lib/roles-api";
import type {
  PermissionAreasResponse,
  PermissionLevel,
  RolePermissionResponse,
  RoleResponse,
} from "../lib/types";

type MatrixValue = "none" | PermissionLevel;
type PermissionsPageProps = {
  embedded?: boolean;
};

const AREA_LABEL_KEY: Record<string, TranslationKey> = {
  candidates: "nav.candidates",
  groups: "nav.groups",
  documents: "nav.documents",
  documentTypes: "nav.documentTypes",
  payments: "nav.payments",
  training: "nav.training",
  mebjobs: "nav.mebJobs",
  users: "nav.users",
  permissions: "nav.permissions",
  settings: "nav.settings",
};

const LEVEL_LABEL: Record<MatrixValue, string> = {
  none: "Yok",
  view: "Görüntüle",
  full: "Tam Yetki",
};

const PERMISSION_OPTIONS: { value: MatrixValue; label: string }[] = [
  { value: "none", label: LEVEL_LABEL.none },
  { value: "view", label: LEVEL_LABEL.view },
  { value: "full", label: LEVEL_LABEL.full },
];

export function PermissionsPage({ embedded = false }: PermissionsPageProps) {
  const t = useT();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();

  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [areas, setAreas] = useState<PermissionAreasResponse | null>(null);
  const [matrix, setMatrix] = useState<Record<string, MatrixValue>>({});
  const originalMatrixRef = useRef<Record<string, MatrixValue>>({});
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteRoleId, setConfirmDeleteRoleId] = useState<string | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [discardAction, setDiscardAction] = useState<(() => void) | null>(null);

  const requestedRoleId = searchParams.get("role");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    Promise.all([
      getRoles({ includeInactive: false }, controller.signal),
      getPermissionAreas(controller.signal),
    ])
    .then(([roleList, areaResponse]) => {
      const sortedRoles = roleList
          .filter((role) => role.isActive)
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name, "tr"));
        setRoles(sortedRoles);
        setAreas(areaResponse);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        showToast("Roller yüklenemedi", "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [showToast]);

  const selectedRoleId = useMemo(() => {
    if (requestedRoleId && roles.some((role) => role.id === requestedRoleId)) {
      return requestedRoleId;
    }
    return roles[0]?.id ?? null;
  }, [requestedRoleId, roles]);

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) ?? null,
    [roles, selectedRoleId]
  );

  useEffect(() => {
    if (selectedRoleId === requestedRoleId) return;

    const nextParams = new URLSearchParams(searchParams);
    if (selectedRoleId) {
      nextParams.set("role", selectedRoleId);
    } else {
      nextParams.delete("role");
    }
    setSearchParams(nextParams, { replace: true });
  }, [requestedRoleId, searchParams, selectedRoleId, setSearchParams]);

  useEffect(() => {
    if (!selectedRoleId || !areas) {
      setMatrix({});
      originalMatrixRef.current = {};
      setDirty(false);
      setPermissionsLoading(false);
      setConfirmDeleteRoleId(null);
      return;
    }

    const controller = new AbortController();
    setPermissionsLoading(true);

    getRolePermissions(selectedRoleId, controller.signal)
      .then((permissions) => applyLoadedMatrix(areas.areas, permissions))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        showToast("Yetkiler yüklenemedi", "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setPermissionsLoading(false);
        }
      });

    return () => controller.abort();
  }, [areas, selectedRoleId, showToast]);

  const applyLoadedMatrix = (
    areaList: string[],
    permissions: RolePermissionResponse[]
  ) => {
    const next: Record<string, MatrixValue> = {};
    for (const area of areaList) next[area] = "none";
    for (const permission of permissions) next[permission.area] = permission.level;
    setMatrix(next);
    originalMatrixRef.current = { ...next };
    setDirty(false);
  };

  const updateSelectedRole = (roleId: string | null, replace = false) => {
    const nextParams = new URLSearchParams(searchParams);
    if (roleId) {
      nextParams.set("role", roleId);
    } else {
      nextParams.delete("role");
    }
    setSearchParams(nextParams, { replace });
  };

  const requestDiscardChanges = (action: () => void) => {
    if (!dirty) {
      action();
      return;
    }

    setDiscardAction(() => action);
  };

  const cancelDiscardChanges = () => {
    setDiscardAction(null);
  };

  const confirmDiscardChanges = () => {
    const action = discardAction;
    setDiscardAction(null);
    action?.();
  };

  const handleRoleSelect = (roleId: string) => {
    if (roleId === selectedRoleId) return;
    requestDiscardChanges(() => {
      setConfirmDeleteRoleId(null);
      updateSelectedRole(roleId);
    });
  };

  const handleLevelChange = (area: string, value: MatrixValue) => {
    setMatrix((prev) => {
      const next = { ...prev, [area]: value };
      setDirty(!isEqualMatrix(next, originalMatrixRef.current));
      return next;
    });
  };

  const handleReset = () => {
    setMatrix({ ...originalMatrixRef.current });
    setDirty(false);
  };

  const handleSave = async () => {
    if (!selectedRoleId) return;
    setSaving(true);
    try {
      const body: RolePermissionResponse[] = Object.entries(matrix)
        .filter(([, level]) => level !== "none")
        .map(([area, level]) => ({ area, level: level as PermissionLevel }));
      const saved = await saveRolePermissions(selectedRoleId, body);
      if (areas) applyLoadedMatrix(areas.areas, saved);
      showToast("Yetkiler kaydedildi");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Yetkiler kaydedilemedi";
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = () => {
    requestDiscardChanges(() => {
      navigate(embedded ? "/settings/definitions/permissions/roles/new" : "/permissions/roles/new");
    });
  };

  const handleEditRole = () => {
    if (!selectedRole) return;
    requestDiscardChanges(() => {
      navigate(
        embedded
          ? `/settings/definitions/permissions/roles/${selectedRole.id}`
          : `/permissions/roles/${selectedRole.id}`
      );
    });
  };

  const handleDeleteRole = async () => {
    if (!selectedRole) return;
    setDeletingRoleId(selectedRole.id);
    try {
      await deleteRole(selectedRole.id);
      setRoles((prev) => prev.filter((role) => role.id !== selectedRole.id));
      setConfirmDeleteRoleId(null);
      showToast("Rol silindi");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Rol silinemedi";
      showToast(message, "error");
    } finally {
      setDeletingRoleId(null);
    }
  };

  const hasRoles = roles.length > 0;
  const activeRoleCount = roles.filter((role) => role.isActive).length;

  const actions = (
    <button className="btn btn-primary btn-sm" onClick={handleCreateRole} type="button">
      Yeni Rol
    </button>
  );

  const content = (
    <div className={embedded ? "permissions-page-grid" : "permissions-page-grid spaced"}>
        <Panel
          action={
            hasRoles ? (
              <span className="permissions-role-count">
                {activeRoleCount}/{roles.length} aktif
              </span>
            ) : undefined
          }
          title="Roller"
        >
          {loading ? (
            <div className="permissions-role-list">
              {Array.from({ length: 4 }, (_, index) => (
                <div className="permissions-role-item-skeleton" key={index}>
                  <span className="skeleton" style={{ width: 120 }} />
                  <span className="skeleton skeleton-pill" style={{ width: 52 }} />
                </div>
              ))}
            </div>
          ) : !hasRoles ? (
            <div className="permissions-empty-state">
              Rol yok. Önce bir rol ekleyip sonra yetkilerini belirle.
            </div>
          ) : (
            <div className="permissions-role-list">
              {roles.map((role) => (
                <button
                  aria-label={`${role.name} rolü`}
                  aria-pressed={role.id === selectedRoleId}
                  className={
                    role.id === selectedRoleId
                      ? "permissions-role-item active"
                      : "permissions-role-item"
                  }
                  key={role.id}
                  onClick={() => handleRoleSelect(role.id)}
                  type="button"
                >
                  <span className="permissions-role-item-copy">
                    <span className="permissions-role-item-name">{role.name}</span>
                    <span className="permissions-role-item-meta">
                      {role.userCount} kullanıcı
                    </span>
                  </span>
                  <StatusPill
                    label={role.isActive ? "Aktif" : "Pasif"}
                    status={role.isActive ? "success" : "manual"}
                  />
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Rol Yetkileri">
          {!hasRoles && !loading ? (
            <div className="permissions-empty-state">
              Yetki düzenlemek için önce rol oluştur.
            </div>
          ) : !selectedRole ? (
            <div className="permissions-empty-state">
              Yetkilerini görmek için soldan bir rol seç.
            </div>
          ) : (
            <div className="permissions-detail">
              <div className="permissions-detail-header">
                <div className="permissions-detail-copy">
                  <h3 className="permissions-detail-title">{selectedRole.name}</h3>
                  <div className="permissions-detail-meta">
                    <StatusPill
                      label={selectedRole.isActive ? "Aktif" : "Pasif"}
                      status={selectedRole.isActive ? "success" : "manual"}
                    />
                    <span>{selectedRole.userCount} kullanıcı</span>
                    {dirty && <span className="permissions-dirty-badge">Kaydedilmedi</span>}
                  </div>
                </div>

                <div className="permissions-detail-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleEditRole}
                    type="button"
                  >
                    Rolü Düzenle
                  </button>
                  {confirmDeleteRoleId === selectedRole.id ? (
                    <>
                      <span className="permissions-delete-hint">
                        {selectedRole.userCount > 0
                          ? `"${selectedRole.name}" silinsin mi? ${selectedRole.userCount} kullanıcı rolsüz kalacak.`
                          : `"${selectedRole.name}" silinsin mi?`}
                      </span>
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={deletingRoleId === selectedRole.id}
                        onClick={() => setConfirmDeleteRoleId(null)}
                        type="button"
                      >
                        Vazgeç
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={deletingRoleId === selectedRole.id}
                        onClick={handleDeleteRole}
                        type="button"
                      >
                        {deletingRoleId === selectedRole.id ? "Siliniyor..." : "Sil"}
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={deletingRoleId !== null}
                      onClick={() => setConfirmDeleteRoleId(selectedRole.id)}
                      type="button"
                    >
                      Sil
                    </button>
                  )}
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={!dirty || saving}
                    onClick={handleReset}
                    type="button"
                  >
                    Geri Al
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={!dirty || saving}
                    onClick={handleSave}
                    type="button"
                  >
                    {saving ? "Kaydediliyor..." : "Kaydet"}
                  </button>
                </div>
              </div>

              {permissionsLoading || !areas ? (
                <div className="permissions-row-list">
                  {Array.from({ length: 5 }, (_, index) => (
                    <div className="permissions-row-skeleton" key={index}>
                      <span className="skeleton" style={{ width: 140 }} />
                      <span className="skeleton" style={{ width: 220 }} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="permissions-row-list">
                  {areas.areas.map((area) => {
                    const labelKey = AREA_LABEL_KEY[area];
                    const label = labelKey ? t(labelKey) : area;
                    const value = matrix[area] ?? "none";

                    return (
                      <div className="permissions-row" key={area}>
                        <div className="permissions-row-copy">
                          <div className="permissions-row-title">{label}</div>
                          <div className="permissions-row-value">
                            {LEVEL_LABEL[value]}
                          </div>
                        </div>

                        <div className="permissions-level-group" role="group" aria-label={label}>
                          {PERMISSION_OPTIONS.map((option) => (
                            <button
                              aria-pressed={value === option.value}
                              className={
                                value === option.value
                                  ? `permissions-level-btn active ${option.value}`
                                  : "permissions-level-btn"
                              }
                              key={option.value}
                              onClick={() => handleLevelChange(area, option.value)}
                              type="button"
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>
  );

  return (
    <>
      {embedded ? (
        <div className="settings-section-stack">
          <section className="settings-surface">
            <div className="settings-surface-header">
              <div className="settings-surface-title">Yetki Yönetimi</div>
              <div className="settings-module-actions">{actions}</div>
            </div>
            <div className="settings-surface-body">{content}</div>
          </section>
        </div>
      ) : (
        <>
          <PageToolbar actions={actions} title="Yetki Yönetimi" />
          {content}
        </>
      )}
      <Modal
        footer={
          <>
            <button className="btn btn-secondary" onClick={cancelDiscardChanges} type="button">
              Vazgeç
            </button>
            <button className="btn btn-danger" onClick={confirmDiscardChanges} type="button">
              Değişiklikleri Sil
            </button>
          </>
        }
        onClose={cancelDiscardChanges}
        open={discardAction !== null}
        title="Kaydedilmemiş Değişiklikler"
      >
        <p className="form-subsection-note">
          Kaydedilmemiş yetki değişiklikleri silinecek. Devam etmek istiyor musun?
        </p>
      </Modal>
    </>
  );
}

function isEqualMatrix(
  a: Record<string, MatrixValue>,
  b: Record<string, MatrixValue>
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a[key] ?? "none") !== (b[key] ?? "none")) return false;
  }
  return true;
}
