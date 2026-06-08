import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { PageToolbar } from "../components/layout/PageToolbar";
import { PageLoadError } from "../components/ui/PageLoadError";
import { Panel } from "../components/ui/Panel";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../lib/auth";
import { updateStoredActiveInstitutionRoleName } from "../lib/auth-storage";
import { ApiError } from "../lib/http";
import { canManageArea } from "../lib/permissions";
import { createRole, getRoles, updateRole } from "../lib/roles-api";
import type { RoleUpsertRequest } from "../lib/types";
import { useT } from "../lib/i18n";

type RoleFormValues = {
  name: string;
  isActive: boolean;
};

const EMPTY_VALUES: RoleFormValues = {
  name: "",
  isActive: true,
};

const VALIDATION_FIELD_MAP: Record<string, keyof RoleFormValues> = {
  name: "name",
  Name: "name",
  isActive: "isActive",
  IsActive: "isActive",
};

export function RoleEditorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { roleId } = useParams();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { user, permissions, activeInstitution } = useAuth();
  const canManagePermissions = canManageArea(user, permissions, "permissions");
  const t = useT();
  const noPermissionTitle = t("common.noPermission");

  const [submitting, setSubmitting] = useState(false);

  const rolesQuery = useQuery({
    queryKey: ["roles", "list", { includeInactive: true }],
    queryFn: ({ signal }) => getRoles({ includeInactive: true }, signal),
    enabled: Boolean(roleId),
  });

  const editingRole = roleId
    ? (rolesQuery.data?.find((item) => item.id === roleId) ?? null)
    : null;
  const loading = Boolean(roleId) && rolesQuery.isLoading;
  const loadError = Boolean(roleId) && rolesQuery.isError;

  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
    watch,
  } = useForm<RoleFormValues>({ defaultValues: EMPTY_VALUES });

  useEffect(() => {
    if (!roleId) {
      reset(EMPTY_VALUES);
      return;
    }
    if (rolesQuery.isSuccess) {
      reset(editingRole ? { name: editingRole.name, isActive: editingRole.isActive } : EMPTY_VALUES);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId, rolesQuery.isSuccess, editingRole?.id, reset]);

  const usersPermissionsRoute = location.pathname.startsWith(
    "/settings/definitions/users/permissions"
  );
  const permissionsBasePath = usersPermissionsRoute
    ? "/settings/definitions/users"
    : location.pathname.startsWith("/settings/")
      ? "/settings/definitions/permissions"
      : "/permissions";
  const buildPermissionsPath = (roleId?: string) => {
    if (usersPermissionsRoute) {
      return roleId
        ? `${permissionsBasePath}?tab=permissions&role=${roleId}`
        : `${permissionsBasePath}?tab=permissions`;
    }
    return roleId ? `${permissionsBasePath}?role=${roleId}` : permissionsBasePath;
  };
  const backToPermissions = buildPermissionsPath(editingRole?.id);

  const submit = handleSubmit(async (values) => {
    if (!canManagePermissions) return;

    setSubmitting(true);
    const payload: RoleUpsertRequest = {
      name: values.name.trim(),
      isActive: values.isActive,
    };

    try {
      const saved = editingRole
        ? await updateRole(editingRole.id, payload)
        : await createRole(payload);

      void queryClient.invalidateQueries({ queryKey: ["roles", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["rolePermissions"] });
      void queryClient.invalidateQueries({ queryKey: ["users", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (editingRole && activeInstitution?.roleName === editingRole.name) {
        updateStoredActiveInstitutionRoleName(editingRole.name, saved.name);
      }
      showToast(t(editingRole ? "roleEditor.toast.roleUpdated" : "roleEditor.toast.roleCreated"));
      navigate(buildPermissionsPath(saved.id));
    } catch (error) {
      if (error instanceof ApiError && error.validationErrors) {
        for (const [serverField, messages] of Object.entries(error.validationErrors)) {
          const formField = VALIDATION_FIELD_MAP[serverField];
          if (formField && messages?.[0]) {
            setError(formField, { message: messages[0] });
          }
        }
      }

      showToast(t(editingRole ? "roleEditor.toast.updateFailed" : "roleEditor.toast.createFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  });

  if (roleId && !loading && loadError) {
    return (
      <>
        <PageToolbar
          actions={
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate(buildPermissionsPath())}
              type="button"
            >
              Listeye Dön
            </button>
          }
          title={t("roleEditor.loadFailedTitle")}
        />

        <div className="role-editor-page spaced">
          <PageLoadError
            title={t("roleEditor.loadFailedShort")}
            description={t("roleEditor.error.loadDescription")}
            onRetry={() => void rolesQuery.refetch()}
          />
        </div>
      </>
    );
  }

  if (roleId && !loading && !editingRole) {
    return (
      <>
        <PageToolbar
          actions={
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate(buildPermissionsPath())}
              type="button"
            >
              Listeye Dön
            </button>
          }
          title={t("roleEditor.notFoundTitle")}
        />

        <div className="role-editor-page spaced">
          <Panel padded>
            <div className="permissions-empty-state">
              Bu rol bulunamadı ya da silinmiş olabilir.
            </div>
          </Panel>
        </div>
      </>
    );
  }

  return (
    <>
      <PageToolbar
        actions={
          <>
            <button
              className="btn btn-secondary btn-sm"
              disabled={submitting}
              onClick={() => navigate(backToPermissions)}
              type="button"
            >
              Vazgeç
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={loading || submitting || !canManagePermissions}
              onClick={submit}
              title={!canManagePermissions ? noPermissionTitle : undefined}
              type="button"
            >
              {submitting ? t("common.saving") : t("common.save")}
            </button>
          </>
        }
        title={editingRole ? t("roleEditor.modalTitleEdit") : t("roleEditor.modalTitleNew")}
      />

      <div className="role-editor-page spaced">
        <Panel padded>
          <form className="role-editor-form" onSubmit={submit}>
            <div className="role-editor-copy">
              <h3 className="role-editor-title">
                {editingRole ? editingRole.name : t("roleEditor.newRoleHint")}
              </h3>
              <p className="role-editor-text">
                Rolü kaydettikten sonra yetkilerini yetki yönetimi ekranından düzenleyebilirsin.
              </p>
            </div>

            {loading ? (
              <div className="role-editor-loading">
                <span className="skeleton" style={{ width: 220 }} />
                <span className="skeleton" style={{ width: 320 }} />
              </div>
            ) : (
              <>
                <div className="form-row full">
                  <div className="form-group">
                    <label className="form-label">Rol Adı</label>
                    <input
                      className={errors.name ? "form-input error" : "form-input"}
                      disabled={!canManagePermissions}
                      placeholder={t("roleEditor.namePlaceholder")}
                      {...register("name", {
                        required: t("roleEditor.validation.required"),
                        minLength: { value: 2, message: t("roleEditor.validation.minLength") },
                      })}
                    />
                    {errors.name && <div className="form-error">{errors.name.message}</div>}
                  </div>
                </div>

                <div className="form-row full">
                  <label className="switch-toggle">
                    <input
                      disabled={!canManagePermissions}
                      type="checkbox"
                      {...register("isActive")}
                    />
                    <span className="switch-toggle-control" aria-hidden="true" />
                    <span>{watch("isActive") ? t("common.statusActive") : t("common.statusInactive")}</span>
                  </label>
                </div>
              </>
            )}
          </form>
        </Panel>
      </div>
    </>
  );
}
