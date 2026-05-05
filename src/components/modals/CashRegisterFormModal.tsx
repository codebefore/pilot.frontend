import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { createCashRegister, updateCashRegister } from "../../lib/cash-registers-api";
import { ApiError, type ApiValidationError } from "../../lib/http";
import { useT, type TranslationKey } from "../../lib/i18n";
import type {
  CashRegisterResponse,
  CashRegisterType,
  CashRegisterUpsertRequest,
} from "../../lib/types";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

type CashRegisterFormValues = {
  name: string;
  type: CashRegisterType;
  isActive: boolean;
  notes: string;
};

type CashRegisterFormModalProps = {
  open: boolean;
  editing: CashRegisterResponse | null;
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

function applyServerFieldErrors(
  error: ApiError,
  setError: (field: keyof CashRegisterFormValues, error: { message: string }) => void,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): { appliedFieldError: boolean; unmappedMessage: string | null } {
  const codes = error.validationErrorCodes;
  const fallback = error.validationErrors;
  let appliedFieldError = false;
  let unmappedMessage: string | null = null;

  if (codes) {
    for (const [serverField, fieldErrors] of Object.entries(codes)) {
      const formField = VALIDATION_FIELD_MAP[serverField];
      const first = fieldErrors[0];
      if (!first) continue;
      if (!formField) {
        unmappedMessage ??= t(first.code as TranslationKey, first.params);
        continue;
      }
      setError(formField, { message: t(first.code as TranslationKey, first.params) });
      appliedFieldError = true;
    }
  }

  if (fallback) {
    for (const [serverField, messages] of Object.entries(fallback)) {
      const formField = VALIDATION_FIELD_MAP[serverField];
      if (!messages?.[0]) continue;
      if (!formField) {
        unmappedMessage ??= messages[0];
        continue;
      }
      if (codes && codes[serverField]?.length) continue;
      setError(formField, { message: messages[0] });
      appliedFieldError = true;
    }
  }

  return { appliedFieldError, unmappedMessage };
}

export function CashRegisterFormModal({
  open,
  editing,
  onClose,
  onSaved,
  onConcurrencyConflict,
}: CashRegisterFormModalProps) {
  const { showToast } = useToast();
  const t = useT();
  const [submitting, setSubmitting] = useState(false);

  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
    watch,
  } = useForm<CashRegisterFormValues>({
    defaultValues: getEmptyValues(editing),
  });

  useEffect(() => {
    if (!open) return;
    reset(getEmptyValues(editing));
  }, [editing, open, reset]);

  const submit = handleSubmit(async (values) => {
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
        const { appliedFieldError, unmappedMessage } = applyServerFieldErrors(error, setError, t);
        if (unmappedMessage) {
          showToast(unmappedMessage, "error");
        } else if (!appliedFieldError) {
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
          <button className="btn btn-primary" disabled={submitting} onClick={submit} type="button">
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
            <label className="form-label">{t("settings.cashRegisters.form.name")}</label>
            <input
              className={fieldClass(errors.name?.message)}
              placeholder={t("settings.cashRegisters.form.namePlaceholder")}
              {...register("name", { required: t("cashRegister.validation.required") })}
            />
            {errors.name && <div className="form-error">{errors.name.message}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">{t("settings.cashRegisters.form.type")}</label>
            <select className={fieldClass(errors.type?.message)} {...register("type")}>
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
              <input type="checkbox" {...register("isActive")} />
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
            <label className="form-label">{t("settings.cashRegisters.form.notes")}</label>
            <textarea className="form-input" rows={3} {...register("notes")} />
          </div>
        </div>
      </form>
    </Modal>
  );
}
