import { useEffect, useId, useMemo, useState } from "react";
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
import { RequiredMark } from "../ui/RequiredMark";
import { useToast } from "../ui/Toast";
import { useT, type TranslationKey } from "../../lib/i18n";

const userFormSchema = z.object({
  fullName: z.string().min(1, "common.required").min(3, "common.minChars3"),
  phone: z
    .string()
    .min(1, "common.required")
    .refine((v) => isPhoneStartingWith5(v), "userForm.phone.startWith5"),
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
  const fullNameId = useId();
  const roleSelectId = useId();
  const phoneId = useId();
  const mebbisUsernameId = useId();
  const mebbisPasswordId = useId();

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

  const translateError = (message: string | undefined): string => {
    if (!message) return "";
    if (message.includes(".")) return t(message as TranslationKey);
    return message;
  };

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
        showToast(t(editing ? "userForm.toast.updateFailed" : "userForm.toast.addFailed"), "error");
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
            <label className="form-label" htmlFor={fullNameId}>{t("common.field.fullName")}<RequiredMark /></label>
            <input
              id={fullNameId}
              className={fieldClass(!!errors.fullName, "form-input")}
              disabled={!canManage}
              placeholder={t("userForm.placeholder.fullName")}
              {...register("fullName")}
            />
            {errors.fullName && (
              <div className="form-error">{translateError(errors.fullName.message)}</div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={roleSelectId}>{t("common.field.role")}</label>
            <CustomSelect
              id={roleSelectId}
              className={fieldClass(!!errors.roleId, "form-select")}
              disabled={!canManage}
              value={selectedRoleId ?? ""}
              {...register("roleId")}
            >
              <option value="">{t("userForm.role.unassigned")}</option>
              {activeRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </CustomSelect>
            {errors.roleId && <div className="form-error">{translateError(errors.roleId.message)}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor={phoneId}>{t("common.field.phone")}<RequiredMark /></label>
            <input
              id={phoneId}
              className={fieldClass(!!errors.phone, "form-input")}
              disabled={!canManage}
              maxLength={32}
              placeholder="5XX XXX XX XX"
              {...phoneRegistration}
            />
            {errors.phone && <div className="form-error">{translateError(errors.phone.message)}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor={mebbisUsernameId}>{t("common.field.mebbisUsername")}</label>
            <input
              id={mebbisUsernameId}
              className={fieldClass(!!errors.mebbisUsername, "form-input")}
              disabled={!canManage}
              placeholder={t("userForm.placeholder.mebbisUsername")}
              {...register("mebbisUsername")}
            />
            {errors.mebbisUsername && (
              <div className="form-error">{translateError(errors.mebbisUsername.message)}</div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={mebbisPasswordId}>{t("common.field.mebbisPassword")}</label>
            <input
              id={mebbisPasswordId}
              autoComplete="new-password"
              className={fieldClass(!!errors.mebbisPassword, "form-input")}
              disabled={!canManage}
              placeholder={t(editing?.hasMebbisPassword ? "userForm.placeholder.mebbisPasswordNew" : "userForm.placeholder.mebbisPassword")}
              type="password"
              {...register("mebbisPassword")}
            />
            {editing?.hasMebbisPassword ? (
              <div className="form-hint">{t("userForm.hint.passwordSet")}</div>
            ) : null}
            {errors.mebbisPassword && (
              <div className="form-error">{translateError(errors.mebbisPassword.message)}</div>
            )}
          </div>
        </div>

        <div className="form-row full">
          <label className="switch-toggle">
            <input disabled={!canManage} type="checkbox" {...register("isActive")} />
            <span className="switch-toggle-control" aria-hidden="true" />
            <span>{watch("isActive") ? t("common.active") : t("common.inactive")}</span>
          </label>
        </div>
      </form>
    </Modal>
  );
}
