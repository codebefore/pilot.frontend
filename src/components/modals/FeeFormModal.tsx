import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { createFee, updateFee } from "../../lib/fees-api";
import { FEE_TYPE_OPTIONS } from "../../lib/fee-catalog";
import { getLicenseClassDefinitions } from "../../lib/license-class-definitions-api";
import { ApiError, type ApiValidationError } from "../../lib/http";
import { useT, type TranslationKey } from "../../lib/i18n";
import type {
  FeeResponse,
  FeeType,
  FeeUpsertRequest,
  LicenseClassDefinitionResponse,
} from "../../lib/types";
import { CustomSelect } from "../ui/CustomSelect";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

type FeeFormValues = {
  feeType: FeeType | "";
  amount: string;
  isActive: boolean;
  notes: string;
  licenseClassIds: string[];
};

type FeeFormModalProps = {
  open: boolean;
  editing: FeeResponse | null;
  onClose: () => void;
  onSaved: (saved: FeeResponse) => void;
  onConcurrencyConflict?: () => void;
};

const VALIDATION_FIELD_MAP: Record<string, keyof FeeFormValues> = {
  feeType: "feeType",
  FeeType: "feeType",
  amount: "amount",
  Amount: "amount",
  notes: "notes",
  Notes: "notes",
  licenseClassIds: "licenseClassIds",
  LicenseClassIds: "licenseClassIds",
};

const CONCURRENCY_CODE = "fee.validation.concurrencyConflict";

function getEmptyValues(editing: FeeResponse | null): FeeFormValues {
  return editing
    ? {
        feeType: editing.feeType,
        amount: String(editing.amount),
        isActive: editing.isActive,
        notes: editing.notes ?? "",
        licenseClassIds: editing.licenseClasses.map((item) => item.id),
      }
    : {
        feeType: "",
        amount: "",
        isActive: true,
        notes: "",
        licenseClassIds: [],
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
  setError: (field: keyof FeeFormValues, error: { message: string }) => void,
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

export function FeeFormModal({
  open,
  editing,
  onClose,
  onSaved,
  onConcurrencyConflict,
}: FeeFormModalProps) {
  const { showToast } = useToast();
  const t = useT();
  const [submitting, setSubmitting] = useState(false);
  const [classes, setClasses] = useState<LicenseClassDefinitionResponse[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
    watch,
  } = useForm<FeeFormValues>({
    defaultValues: getEmptyValues(editing),
  });

  useEffect(() => {
    if (!open) return;
    reset(getEmptyValues(editing));
  }, [editing, open, reset]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setClassesLoading(true);
    getLicenseClassDefinitions(
      { activity: "active", page: 1, pageSize: 1000, sortBy: "displayOrder", sortDir: "asc" },
      controller.signal
    )
      .then((response) => setClasses(response.items))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        showToast(t("settings.fees.toast.loadError"), "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setClassesLoading(false);
      });
    return () => controller.abort();
  }, [open, showToast, t]);

  const submit = handleSubmit(async (values) => {
    setSubmitting(true);

    const amountValue = Number.parseFloat(values.amount);
    const payload: FeeUpsertRequest = {
      feeType: values.feeType as FeeType,
      amount: Number.isFinite(amountValue) ? amountValue : 0,
      isActive: values.isActive,
      notes: values.notes.trim() || null,
      licenseClassIds: values.licenseClassIds,
      ...(editing ? { rowVersion: editing.rowVersion } : {}),
    };

    try {
      const saved = editing
        ? await updateFee(editing.id, payload)
        : await createFee(payload);
      onSaved(saved);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409 && hasConcurrencyError(error.validationErrorCodes)) {
          showToast(t("fee.validation.concurrencyConflict"), "error");
          onConcurrencyConflict?.();
          return;
        }
        const { appliedFieldError, unmappedMessage } = applyServerFieldErrors(error, setError, t);
        if (unmappedMessage) {
          showToast(unmappedMessage, "error");
        } else if (!appliedFieldError) {
          showToast(t("fee.validation.generic"), "error");
        }
      } else {
        showToast(t("fee.validation.generic"), "error");
      }
    } finally {
      setSubmitting(false);
    }
  });

  const fieldClass = (message?: string) => (message ? "form-input error" : "form-input");
  const selectClass = (message?: string) => (message ? "form-select error" : "form-select");

  return (
    <Modal
      footer={
        <>
          <button className="btn btn-secondary" disabled={submitting} onClick={onClose} type="button">
            {t("settings.fees.form.cancel")}
          </button>
          <button className="btn btn-primary" disabled={submitting} onClick={submit} type="button">
            {submitting ? t("settings.fees.form.saving") : t("settings.fees.form.save")}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title={editing ? t("settings.fees.form.titleEdit") : t("settings.fees.form.titleNew")}
    >
      <form className="settings-form" onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t("settings.fees.form.feeType")}</label>
            <Controller
              control={control}
              name="feeType"
              rules={{ required: t("fee.validation.required") }}
              render={({ field }) => (
                <CustomSelect className={selectClass(errors.feeType?.message)} {...field}>
                  <option value="">{t("settings.fees.form.feeTypePlaceholder")}</option>
                  {FEE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </CustomSelect>
              )}
            />
            {errors.feeType && <div className="form-error">{errors.feeType.message}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">{t("settings.fees.form.amount")}</label>
            <input
              className={fieldClass(errors.amount?.message)}
              inputMode="decimal"
              min={0}
              placeholder="0"
              step="0.01"
              type="number"
              {...register("amount", { required: t("fee.validation.required") })}
            />
            {errors.amount && <div className="form-error">{errors.amount.message}</div>}
          </div>
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">{t("settings.fees.form.licenseClasses")}</label>
            <div className="form-subsection-note">{t("settings.fees.form.licenseClassesHint")}</div>
            <Controller
              control={control}
              name="licenseClassIds"
              render={({ field }) => (
                <>
                  <div className="settings-module-actions" style={{ marginBottom: 8 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={classesLoading || classes.length === 0}
                      onClick={() => field.onChange(classes.map((c) => c.id))}
                      type="button"
                    >
                      {t("settings.fees.form.selectAll")}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={field.value.length === 0}
                      onClick={() => field.onChange([])}
                      type="button"
                    >
                      {t("settings.fees.form.clearAll")}
                    </button>
                  </div>
                  <div className="settings-checkbox-list">
                    {classesLoading ? (
                      <span className="form-subsection-note">…</span>
                    ) : classes.length === 0 ? (
                      <span className="form-subsection-note">—</span>
                    ) : (
                      classes.map((cls) => {
                        const checked = field.value.includes(cls.id);
                        return (
                          <label className="switch-toggle" key={cls.id}>
                            <input
                              checked={checked}
                              onChange={(event) => {
                                if (event.target.checked) {
                                  field.onChange([...field.value, cls.id]);
                                } else {
                                  field.onChange(field.value.filter((id) => id !== cls.id));
                                }
                              }}
                              type="checkbox"
                            />
                            <span className="switch-toggle-control" aria-hidden="true" />
                            <span>
                              <strong>{cls.code}</strong> · {cls.name}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </>
              )}
              rules={{
                validate: (value) =>
                  value.length > 0 || t("fee.validation.licenseClassRequired"),
              }}
            />
            {errors.licenseClassIds && (
              <div className="form-error">{errors.licenseClassIds.message}</div>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t("settings.fees.form.isActive")}</label>
            <label className="switch-toggle">
              <input type="checkbox" {...register("isActive")} />
              <span className="switch-toggle-control" aria-hidden="true" />
              <span>
                {watch("isActive")
                  ? t("settings.fees.filter.isActive.active")
                  : t("settings.fees.filter.isActive.inactive")}
              </span>
            </label>
          </div>
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">{t("settings.fees.form.notes")}</label>
            <textarea className="form-input" rows={3} {...register("notes")} />
          </div>
        </div>
      </form>
    </Modal>
  );
}
