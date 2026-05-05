import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { createUser, updateUser } from "../../lib/users-api";
import { ApiError } from "../../lib/http";
import type {
  AppUserResponse,
  AppUserUpsertRequest,
  RoleResponse,
} from "../../lib/types";
import { CustomSelect } from "../ui/CustomSelect";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

type UserFormValues = {
  fullName: string;
  email: string;
  phone: string;
  mebbisUsername: string;
  mebbisPassword: string;
  roleId: string;
  isActive: boolean;
};

type UserFormModalProps = {
  open: boolean;
  editing: AppUserResponse | null;
  roles: RoleResponse[];
  onClose: () => void;
  onSaved: (saved: AppUserResponse) => void;
};

const emptyValues = (editing: AppUserResponse | null): UserFormValues =>
  editing
    ? {
        fullName: editing.fullName,
        email: editing.email ?? "",
        phone: editing.phone ?? "",
        mebbisUsername: editing.mebbisUsername ?? "",
        mebbisPassword: "",
        roleId: editing.roleId ?? "",
        isActive: editing.isActive,
      }
    : {
        fullName: "",
        email: "",
        phone: "",
        mebbisUsername: "",
        mebbisPassword: "",
        roleId: "",
        isActive: true,
      };

const VALIDATION_FIELD_MAP: Record<string, keyof UserFormValues> = {
  fullName: "fullName",
  FullName: "fullName",
  email: "email",
  Email: "email",
  phone: "phone",
  Phone: "phone",
  mebbisUsername: "mebbisUsername",
  MebbisUsername: "mebbisUsername",
  mebbisPassword: "mebbisPassword",
  MebbisPassword: "mebbisPassword",
  roleId: "roleId",
  RoleId: "roleId",
  isActive: "isActive",
  IsActive: "isActive",
};

export function UserFormModal({
  open,
  editing,
  roles,
  onClose,
  onSaved,
}: UserFormModalProps) {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
    watch,
  } = useForm<UserFormValues>({ defaultValues: emptyValues(editing) });
  const selectedRoleId = watch("roleId");
  const activeRoles = useMemo(() => roles.filter((role) => role.isActive), [roles]);

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
    setSubmitting(true);
    const payload: AppUserUpsertRequest = {
      fullName: values.fullName.trim(),
      email: values.email.trim() ? values.email.trim() : null,
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
      if (error instanceof ApiError && error.validationErrors) {
        for (const [serverField, messages] of Object.entries(error.validationErrors)) {
          const formField = VALIDATION_FIELD_MAP[serverField];
          if (formField && messages?.[0]) {
            setError(formField, { message: messages[0] });
          }
        }
      }
      showToast(editing ? "Kullanıcı güncellenemedi" : "Kullanıcı eklenemedi", "error");
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
            Vazgeç
          </button>
          <button
            className="btn btn-primary"
            disabled={submitting}
            onClick={submit}
            type="button"
          >
            {submitting ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title={editing ? "Kullanıcıyı Düzenle" : "Yeni Kullanıcı"}
    >
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Ad Soyad</label>
            <input
              className={fieldClass(!!errors.fullName, "form-input")}
              placeholder="Ad Soyad"
              {...register("fullName", {
                required: "Zorunlu alan",
                minLength: { value: 3, message: "En az 3 karakter" },
              })}
            />
            {errors.fullName && (
              <div className="form-error">{errors.fullName.message}</div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Rol</label>
            <CustomSelect
              className={fieldClass(!!errors.roleId, "form-select")}
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
            <label className="form-label">E-posta</label>
            <input
              className={fieldClass(!!errors.email, "form-input")}
              placeholder="kullanici@kurum.com"
              type="email"
              {...register("email", {
                validate: (value) =>
                  !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || "Geçersiz e-posta",
              })}
            />
            {errors.email && <div className="form-error">{errors.email.message}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Telefon</label>
            <input
              className={fieldClass(!!errors.phone, "form-input")}
              inputMode="numeric"
              maxLength={10}
              placeholder="5XXXXXXXXX"
              {...register("phone", {
                required: "Zorunlu alan",
                pattern: {
                  value: /^5\d{9}$/,
                  message: "10 hane, 5 ile başlamalı (başında 0 yok)",
                },
              })}
            />
            {errors.phone && <div className="form-error">{errors.phone.message}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">MEBBİS Kullanıcı Adı</label>
            <input
              className={fieldClass(!!errors.mebbisUsername, "form-input")}
              placeholder="MEBBİS kullanıcı adı"
              {...register("mebbisUsername")}
            />
            {errors.mebbisUsername && (
              <div className="form-error">{errors.mebbisUsername.message}</div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">MEBBİS Şifresi</label>
            <input
              autoComplete="new-password"
              className={fieldClass(!!errors.mebbisPassword, "form-input")}
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
            <input type="checkbox" {...register("isActive")} />
            <span className="switch-toggle-control" aria-hidden="true" />
            <span>{watch("isActive") ? "Aktif" : "Pasif"}</span>
          </label>
        </div>
      </form>
    </Modal>
  );
}
