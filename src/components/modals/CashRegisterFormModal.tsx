import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { createCashRegister, updateCashRegister } from "../../lib/cash-registers-api";
import { ApiError, type ApiValidationError } from "../../lib/http";
import { useT, type TranslationKey } from "../../lib/i18n";
import { applyApiErrorsToForm } from "../../lib/form-errors";
import type {
  CashRegisterResponse,
  CashRegisterType,
  CashRegisterUpsertRequest,
} from "../../lib/types";
import { Modal } from "../ui/Modal";
import { RequiredMark } from "../ui/RequiredMark";
import { useToast } from "../ui/Toast";

const cashRegisterFormSchema = z.object({
  name: z.string().min(1, "cashRegister.validation.required"),
  type: z.string(),
  isActive: z.boolean(),
  notes: z.string(),
});

type CashRegisterFormValues = {
  name: string;
  type: CashRegisterType;
  isActive: boolean;
  notes: string;
};

type CashRegisterFormModalProps = {
  open: boolean;
  editing: CashRegisterResponse | null;
  canManage?: boolean;
  onClose: () => void;
  onSaved: (saved: CashRegisterResponse) => void;
  onConcurrencyConflict?: () => void;
};

const VALIDATION_FIELD_MAP: Record<string, keyof CashRegisterFormValues> = {
  name: "name",
  Name: "name",
  type: "type",
  Type: "type",
  notes: "notes",
  Notes: "notes",
};

const CASH_REGISTER_TYPES: CashRegisterType[] = [
  "cash",
  "bank_transfer",
  "credit_card",
  "mail_order",
];

const CONCURRENCY_CODE = "cashRegister.validation.concurrencyConflict";

function getEmptyValues(editing: CashRegisterResponse | null): CashRegisterFormValues {
  return editing
    ? {
        name: editing.name,
        type: editing.type,
        isActive: editing.isActive,
        notes: editing.notes ?? "",
      }
    : {
        name: "",
        type: "cash",
        isActive: true,
        notes: "",
      };
}

function hasConcurrencyError(
  codes: Record<string, ApiValidationError[]> | undefined
): boolean {
  if (!codes) return false;
  return Object.values(codes).some((errors) =>
    errors.some((error) => error.code === CONCURRENCY_CODE)
  );
}

export function CashRegisterFormModal({
  open,
  editing,
  canManage = true,
  onClose,
  onSaved,
  onConcurrencyConflict,
}: CashRegisterFormModalProps) {
  const { showToast } = useToast();
  const t = useT();
  const noPermissionTitle = t("common.noPermission");
  const [submitting, setSubmitting] = useState(false);
  const nameInputId = useId();
  const typeSelectId = useId();
  const notesInputId = useId();

  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
    watch,
  } = useForm<CashRegisterFormValues>({
    defaultValues: getEmptyValues(editing),
    resolver: zodResolver(cashRegisterFormSchema) as any,
  });

  useEffect(() => {
    if (!open) return;
    reset(getEmptyValues(editing));
  }, [editing, open, reset]);

  const submit = handleSubmit(async (values) => {
    if (!canManage) return;
    setSubmitting(true);

    const payload: CashRegisterUpsertRequest = {
      name: values.name.trim(),
      type: values.type,
      isActive: values.isActive,
      notes: values.notes.trim() || null,
      ...(editing ? { rowVersion: editing.rowVersion } : {}),
    };

    try {
      const saved = editing
        ? await updateCashRegister(editing.id, payload)
        : await createCashRegister(payload);
      onSaved(saved);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409 && hasConcurrencyError(error.validationErrorCodes)) {
          showToast(t("cashRegister.validation.concurrencyConflict"), "error");
          onConcurrencyConflict?.();
          return;
        }
        const { applied, unmappedMessages } = applyApiErrorsToForm(error, setError, {
          translateCode: (code, params) => t(code as TranslationKey, params),
          fieldMap: VALIDATION_FIELD_MAP,
        });
        if (unmappedMessages[0]) {
          showToast(unmappedMessages[0], "error");
        } else if (!applied) {
          showToast(t("cashRegister.validation.generic"), "error");
        }
      } else {
        showToast(t("cashRegister.validation.generic"), "error");
      }
    } finally {
      setSubmitting(false);
    }
  });

  const fieldClass = (message?: string) => (message ? "form-input error" : "form-input");

  return (
    <Modal
      footer={
        <>
          <button className="btn btn-secondary" disabled={submitting} onClick={onClose} type="button">
            {t("settings.cashRegisters.form.cancel")}
          </button>
          <button
            className="btn btn-primary"
            disabled={submitting || !canManage}
            onClick={submit}
            title={!canManage ? noPermissionTitle : undefined}
            type="button"
          >
            {submitting ? t("settings.cashRegisters.form.saving") : t("settings.cashRegisters.form.save")}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title={
        editing
          ? t("settings.cashRegisters.form.titleEdit")
          : t("settings.cashRegisters.form.titleNew")
      }
    >
      <form className="settings-form" onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor={nameInputId}>{t("settings.cashRegisters.form.name")}<RequiredMark /></label>
            <input
              id={nameInputId}
              className={fieldClass(errors.name?.message)}
              disabled={!canManage}
              placeholder={t("settings.cashRegisters.form.namePlaceholder")}
              {...register("name")}
            />
            {errors.name && <div className="form-error">{t((errors.name.message ?? "") as TranslationKey)}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor={typeSelectId}>{t("settings.cashRegisters.form.type")}</label>
            <select
              id={typeSelectId}
              className={fieldClass(errors.type?.message)}
              disabled={!canManage}
              {...register("type")}
            >
              {CASH_REGISTER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`settings.cashRegisters.type.${type}` as TranslationKey)}
                </option>
              ))}
            </select>
            {errors.type && <div className="form-error">{errors.type.message}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t("settings.cashRegisters.form.isActive")}</label>
            <label className="switch-toggle">
              <input disabled={!canManage} type="checkbox" {...register("isActive")} />
              <span className="switch-toggle-control" aria-hidden="true" />
              <span>
                {watch("isActive")
                  ? t("settings.cashRegisters.filter.isActive.active")
                  : t("settings.cashRegisters.filter.isActive.inactive")}
              </span>
            </label>
          </div>
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label" htmlFor={notesInputId}>{t("settings.cashRegisters.form.notes")}</label>
            <textarea id={notesInputId} className="form-input" disabled={!canManage} rows={3} {...register("notes")} />
          </div>
        </div>
      </form>
    </Modal>
  );
}
