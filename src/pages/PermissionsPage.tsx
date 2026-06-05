import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { PageToolbar } from "../components/layout/PageToolbar";
import { Modal } from "../components/ui/Modal";
import { PageLoadError } from "../components/ui/PageLoadError";
import { Panel } from "../components/ui/Panel";
import { StatusPill } from "../components/ui/StatusPill";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../lib/auth";
import { ApiError, isAbortError } from "../lib/http";
import { useT, type TranslationKey } from "../lib/i18n";
import { canManageArea } from "../lib/permissions";
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

const LEVEL_LABEL_KEY: Record<MatrixValue, TranslationKey> = {
  none: "permissions.level.none",
  view: "permissions.level.view",
  full: "permissions.level.full",
};

export function PermissionsPage({ embedded = false }: PermissionsPageProps) {
  const t = useT();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const { user, permissions } = useAuth();
  const canManagePermissions = canManageArea(user, permissions, "permissions");
  const noPermissionTitle = t("common.noPermission");

  const queryClient = useQueryClient();
  const [matrix, setMatrix] = useState<Record<string, MatrixValue>>({});
  const originalMatrixRef = useRef<Record<string, MatrixValue>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteRoleId, setConfirmDeleteRoleId] = useState<string | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [discardAction, setDiscardAction] = useState<(() => void) | null>(null);

  const requestedRoleId = searchParams.get("role");

  const rolesQuery = useQuery<RoleResponse[]>({
    queryKey: ["roles", "list", { includeInactive: false }],
    queryFn: () => getRoles({ includeInactive: false }),
  });

  const areasQuery = useQuery<PermissionAreasResponse>({
    queryKey: ["permissionAreas", "list"],
    queryFn: () => getPermissionAreas(),
  });

  const rawRoles = rolesQuery.data ?? [];
  const areas = areasQuery.data ?? null;
  const loading = rolesQuery.isPending || areasQuery.isPending;
  const loadError = rolesQuery.isError || areasQuery.isError;

  const roles = useMemo(
    () =>
      rawRoles
        .filter((role) => role.isActive)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [rawRoles]
  );

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

  const rolePermissionsQuery = useQuery<RolePermissionResponse[]>({
    queryKey: ["rolePermissions", "detail", selectedRoleId],
    queryFn: ({ signal }) => getRolePermissions(selectedRoleId as string, signal),
    enabled: !!selectedRoleId,
  });

  const permissionsLoading = rolePermissionsQuery.isPending && !!selectedRoleId;

  useEffect(() => {
    if (!areas) return;
    if (!selectedRoleId) {
      setMatrix({});
      originalMatrixRef.current = {};
      setDirty(false);
      setConfirmDeleteRoleId(null);
      return;
    }
    if (rolePermissionsQuery.isError) return;
    if (!rolePermissionsQuery.data) return;
    applyLoadedMatrix(areas.areas, rolePermissionsQuery.data);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areas, selectedRoleId, rolePermissionsQuery.data, rolePermissionsQuery.isError]);

  // Error toast lives in its own effect keyed only on the query's error state
  // for this role so refetching adjacent queries (e.g. areas after a retry)
  // does not double-fire the toast.
  useEffect(() => {
    if (rolePermissionsQuery.isError && selectedRoleId && !isAbortError(rolePermissionsQuery.error)) {
      showToast(t("permissions.toast.loadFailed"), "error");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolePermissionsQuery.error, rolePermissionsQuery.isError, selectedRoleId]);

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
    if (!canManagePermissions) return;
    setMatrix((prev) => {
      const next = { ...prev, [area]: value };
      setDirty(!isEqualMatrix(next, originalMatrixRef.current));
      return next;
    });
  };

  const handleReset = () => {
    if (!canManagePermissions) return;
    setMatrix({ ...originalMatrixRef.current });
    setDirty(false);
  };

  const handleSave = async () => {
    if (!canManagePermissions) return;
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
    if (!canManagePermissions) return;
    requestDiscardChanges(() => {
      navigate(
        embedded
          ? "/settings/definitions/users/permissions/roles/new"
          : "/permissions/roles/new"
      );
    });
  };

  const handleEditRole = () => {
    if (!canManagePermissions) return;
    if (!selectedRole) return;
    requestDiscardChanges(() => {
      navigate(
        embedded
          ? `/settings/definitions/users/permissions/roles/${selectedRole.id}`
          : `/permissions/roles/${selectedRole.id}`
      );
    });
  };

  const handleDeleteRole = async () => {
    if (!canManagePermissions) return;
    if (!selectedRole) return;
    setDeletingRoleId(selectedRole.id);
    try {
      await deleteRole(selectedRole.id);
      queryClient.setQueryData<RoleResponse[]>(
        ["roles", "list", { includeInactive: false }],
        (prev) => (prev ? prev.filter((role) => role.id !== selectedRole.id) : [])
      );
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
    <button
      className="btn btn-primary btn-sm"
      disabled={!canManagePermissions}
      onClick={handleCreateRole}
      title={!canManagePermissions ? noPermissionTitle : undefined}
      type="button"
    >
      Yeni Rol
    </button>
  );

  const content = loadError ? (
    <div className={embedded ? undefined : "spaced"}>
      <PageLoadError
        title={t("permissions.error.loadTitle")}
        description={t("permissions.error.loadDescription")}
        onRetry={() => {
          void queryClient.invalidateQueries({ queryKey: ["roles", "list", { includeInactive: false }] });
          void queryClient.invalidateQueries({ queryKey: ["permissionAreas", "list"] });
        }}
      />
    </div>
  ) : (
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
                    disabled={!canManagePermissions}
                    onClick={handleEditRole}
                    title={!canManagePermissions ? noPermissionTitle : undefined}
                    type="button"
                  >
                    Rolü Düzenle
                  </button>
                  {confirmDeleteRoleId === selectedRole.id ? (
                    <>
                      <span className="permissions-delete-hint">
                        {selectedRole.userCount > 0
                          ? t("permissions.confirmDeleteRole", { role: selectedRole.name, count: selectedRole.userCount })
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
                        disabled={deletingRoleId === selectedRole.id || !canManagePermissions}
                        onClick={handleDeleteRole}
                        title={!canManagePermissions ? noPermissionTitle : undefined}
                        type="button"
                      >
                        {deletingRoleId === selectedRole.id ? "Siliniyor..." : "Sil"}
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={deletingRoleId !== null || !canManagePermissions}
                      onClick={() => {
                        if (!canManagePermissions) return;
                        setConfirmDeleteRoleId(selectedRole.id);
                      }}
                      title={!canManagePermissions ? noPermissionTitle : undefined}
                      type="button"
                    >
                      Sil
                    </button>
                  )}
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={!dirty || saving || !canManagePermissions}
                    onClick={handleReset}
                    title={!canManagePermissions ? noPermissionTitle : undefined}
                    type="button"
                  >
                    Geri Al
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={!dirty || saving || !canManagePermissions}
                    onClick={handleSave}
                    title={!canManagePermissions ? noPermissionTitle : undefined}
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
                            {t(LEVEL_LABEL_KEY[value])}
                          </div>
                        </div>

                        <div className="permissions-level-group" role="group" aria-label={label}>
                          {(["none", "view", "full"] as MatrixValue[]).map((optionValue) => (
                            <button
                              aria-pressed={value === optionValue}
                              className={
                                value === optionValue
                                  ? `permissions-level-btn active ${optionValue}`
                                  : "permissions-level-btn"
                              }
                              key={optionValue}
                              disabled={!canManagePermissions}
                              onClick={() => handleLevelChange(area, optionValue)}
                              title={!canManagePermissions ? noPermissionTitle : undefined}
                              type="button"
                            >
                              {t(LEVEL_LABEL_KEY[optionValue])}
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
              <div className="settings-surface-title">{t("permissions.title")}</div>
              <div className="settings-module-actions">{actions}</div>
            </div>
            <div className="settings-surface-body">{content}</div>
          </section>
        </div>
      ) : (
        <>
          <PageToolbar actions={actions} title={t("permissions.title")} />
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
        title={t("permissions.unsavedChanges")}
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
