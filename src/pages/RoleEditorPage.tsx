import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { PageToolbar } from "../components/layout/PageToolbar";
import { Panel } from "../components/ui/Panel";
import { useToast } from "../components/ui/Toast";
import { ApiError } from "../lib/http";
import { createRole, getRoles, updateRole } from "../lib/roles-api";
import type { RoleResponse, RoleUpsertRequest } from "../lib/types";

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

  const [loading, setLoading] = useState(Boolean(roleId));
  const [submitting, setSubmitting] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleResponse | null>(null);

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
      setEditingRole(null);
      setLoading(false);
      reset(EMPTY_VALUES);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    getRoles({ includeInactive: true }, controller.signal)
      .then((roles) => {
        const role = roles.find((item) => item.id === roleId) ?? null;
        setEditingRole(role);
        reset(role ? { name: role.name, isActive: role.isActive } : EMPTY_VALUES);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        showToast("Rol bilgisi yüklenemedi", "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [reset, roleId, showToast]);

  const permissionsBasePath = location.pathname.startsWith("/settings/")
    ? "/settings/definitions/permissions"
    : "/permissions";
  const backToPermissions = editingRole
    ? `${permissionsBasePath}?role=${editingRole.id}`
    : permissionsBasePath;

  const submit = handleSubmit(async (values) => {
    setSubmitting(true);
    const payload: RoleUpsertRequest = {
      name: values.name.trim(),
      isActive: values.isActive,
    };

    try {
      const saved = editingRole
        ? await updateRole(editingRole.id, payload)
        : await createRole(payload);

      showToast(editingRole ? "Rol güncellendi" : "Rol eklendi");
      navigate(`${permissionsBasePath}?role=${saved.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.validationErrors) {
        for (const [serverField, messages] of Object.entries(error.validationErrors)) {
          const formField = VALIDATION_FIELD_MAP[serverField];
          if (formField && messages?.[0]) {
            setError(formField, { message: messages[0] });
          }
        }
      }

      showToast(editingRole ? "Rol güncellenemedi" : "Rol eklenemedi", "error");
    } finally {
      setSubmitting(false);
    }
  });

  if (roleId && !loading && !editingRole) {
    return (
      <>
        <PageToolbar
          actions={
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate(permissionsBasePath)}
              type="button"
            >
              Listeye Dön
            </button>
          }
          title="Rol Bulunamadı"
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
              disabled={loading || submitting}
              onClick={submit}
              type="button"
            >
              {submitting ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </>
        }
        title={editingRole ? "Rolü Düzenle" : "Yeni Rol"}
      />

      <div className="role-editor-page spaced">
        <Panel padded>
          <form className="role-editor-form" onSubmit={submit}>
            <div className="role-editor-copy">
              <h3 className="role-editor-title">
                {editingRole ? editingRole.name : "Yeni rol bilgileri"}
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
                      placeholder="Örn. Eğitim Koordinatörü"
                      {...register("name", {
                        required: "Zorunlu alan",
                        minLength: { value: 2, message: "En az 2 karakter" },
                      })}
                    />
                    {errors.name && <div className="form-error">{errors.name.message}</div>}
                  </div>
                </div>

                <div className="form-row full">
                  <label className="switch-toggle">
                    <input type="checkbox" {...register("isActive")} />
                    <span className="switch-toggle-control" aria-hidden="true" />
                    <span>{watch("isActive") ? "Aktif" : "Pasif"}</span>
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
