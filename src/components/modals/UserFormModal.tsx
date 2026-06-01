import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { createUser, updateUser } from "../../lib/users-api";
import { isPhoneStartingWith5 } from "../../lib/phone";
import { applyApiErrorsToForm } from "../../lib/form-errors";
import type {
  AppUserResponse,
  AppUserUpsertRequest,
  RoleResponse,
} from "../../lib/types";
import { CustomSelect } from "../ui/CustomSelect";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { useT } from "../../lib/i18n";

const userFormSchema = z.object({
  fullName: z.string().min(1, "Zorunlu alan").min(3, "En az 3 karakter"),
  phone: z
    .string()
    .min(1, "Zorunlu alan")
    .refine((v) => isPhoneStartingWith5(v), "5 ile başlamalı"),
  mebbisUsername: z.string(),
  mebbisPassword: z.string(),
  roleId: z.string(),
  isActive: z.boolean(),
});

type UserFormValues = z.infer<typeof userFormSchema>;

type UserFormModalProps = {
  open: boolean;
  editing: AppUserResponse | null;
  canManage?: boolean;
  roles: RoleResponse[];
  onClose: () => void;
  onSaved: (saved: AppUserResponse) => void;
};

const emptyValues = (editing: AppUserResponse | null): UserFormValues =>
  editing
    ? {
        fullName: editing.fullName,
        phone: editing.phone ?? "",
        mebbisUsername: editing.mebbisUsername ?? "",
        mebbisPassword: "",
        roleId: editing.roleId ?? "",
        isActive: editing.isActive,
      }
    : {
        fullName: "",
        phone: "",
        mebbisUsername: "",
        mebbisPassword: "",
        roleId: "",
        isActive: true,
      };

const VALIDATION_FIELD_MAP: Record<string, keyof UserFormValues> = {
  FullName: "fullName",
  Phone: "phone",
  MebbisUsername: "mebbisUsername",
  MebbisPassword: "mebbisPassword",
  RoleId: "roleId",
  IsActive: "isActive",
};

export function UserFormModal({
  open,
  editing,
  canManage = true,
  roles,
  onClose,
  onSaved,
}: UserFormModalProps) {
  const { showToast } = useToast();
  const t = useT();
  const noPermissionTitle = t("common.noPermission");
  const [submitting, setSubmitting] = useState(false);

  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
    watch,
  } = useForm<UserFormValues>({ defaultValues: emptyValues(editing), resolver: zodResolver(userFormSchema) });
  const selectedRoleId = watch("roleId");
  const activeRoles = useMemo(() => roles.filter((role) => role.isActive), [roles]);
  const phoneRegistration = register("phone");

  useEffect(() => {
    if (!open) return;
    reset(emptyValues(editing));
  }, [editing, open, reset]);

  useEffect(() => {
    if (!open || !selectedRoleId) return;
    if (activeRoles.some((role) => role.id === selectedRoleId)) return;
    setValue("roleId", "", { shouldDirty: true, shouldValidate: true });
  }, [activeRoles, open, selectedRoleId, setValue]);

  const fieldClass = (hasError: boolean, base: "form-input" | "form-select") =>
    hasError ? `${base} error` : base;

  const submit = handleSubmit(async (values) => {
    if (!canManage) return;
    setSubmitting(true);
    const payload: AppUserUpsertRequest = {
      fullName: values.fullName.trim(),
      phone: values.phone.trim(),
      mebbisUsername: values.mebbisUsername.trim() || null,
      mebbisPassword: values.mebbisPassword.trim() || null,
      roleId: values.roleId || null,
      isActive: values.isActive,
    };

    try {
      const saved = editing
        ? await updateUser(editing.id, payload)
        : await createUser(payload);
      onSaved(saved);
    } catch (error) {
      const { applied, unmappedMessages } = applyApiErrorsToForm(error, setError, {
        fieldMap: VALIDATION_FIELD_MAP,
      });
      if (unmappedMessages[0]) {
        showToast(unmappedMessages[0], "error");
      } else if (!applied) {
        showToast(editing ? "Kullanıcı güncellenemedi" : "Kullanıcı eklenemedi", "error");
      }
    } finally {
      setSubmitting(false);
    }
  });

  if (!open) return null;

  return (
    <Modal
      footer={
        <>
          <button
            className="btn btn-secondary"
            disabled={submitting}
            onClick={onClose}
            type="button"
          >
            {t("common.cancel")}
          </button>
          <button
            className="btn btn-primary"
            disabled={submitting || !canManage}
            onClick={submit}
            title={!canManage ? noPermissionTitle : undefined}
            type="button"
          >
            {submitting ? t("common.saving") : t("common.save")}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title={editing ? t("userForm.modalTitleEdit") : t("userForm.modalTitleNew")}
    >
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t("common.field.fullName")}</label>
            <input
              className={fieldClass(!!errors.fullName, "form-input")}
              disabled={!canManage}
              placeholder="Ad Soyad"
              {...register("fullName")}
            />
            {errors.fullName && (
              <div className="form-error">{errors.fullName.message}</div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">{t("common.field.role")}</label>
            <CustomSelect
              className={fieldClass(!!errors.roleId, "form-select")}
              disabled={!canManage}
              value={selectedRoleId ?? ""}
              {...register("roleId")}
            >
              <option value="">— Rol atanmamış —</option>
              {activeRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </CustomSelect>
            {errors.roleId && <div className="form-error">{errors.roleId.message}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t("common.field.phone")}</label>
            <input
              className={fieldClass(!!errors.phone, "form-input")}
              disabled={!canManage}
              maxLength={32}
              placeholder="5XX XXX XX XX"
              {...phoneRegistration}
            />
            {errors.phone && <div className="form-error">{errors.phone.message}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t("common.field.mebbisUsername")}</label>
            <input
              className={fieldClass(!!errors.mebbisUsername, "form-input")}
              disabled={!canManage}
              placeholder="MEBBİS kullanıcı adı"
              {...register("mebbisUsername")}
            />
            {errors.mebbisUsername && (
              <div className="form-error">{errors.mebbisUsername.message}</div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">{t("common.field.mebbisPassword")}</label>
            <input
              autoComplete="new-password"
              className={fieldClass(!!errors.mebbisPassword, "form-input")}
              disabled={!canManage}
              placeholder={editing?.hasMebbisPassword ? "Değiştirmek için yeni şifre gir" : "MEBBİS şifresi"}
              type="password"
              {...register("mebbisPassword")}
            />
            {editing?.hasMebbisPassword ? (
              <div className="form-hint">Mevcut şifre kayıtlı; boş bırakırsan değişmez.</div>
            ) : null}
            {errors.mebbisPassword && (
              <div className="form-error">{errors.mebbisPassword.message}</div>
            )}
          </div>
        </div>

        <div className="form-row full">
          <label className="switch-toggle">
            <input disabled={!canManage} type="checkbox" {...register("isActive")} />
            <span className="switch-toggle-control" aria-hidden="true" />
            <span>{watch("isActive") ? "Aktif" : "Pasif"}</span>
          </label>
        </div>
      </form>
    </Modal>
  );
}
