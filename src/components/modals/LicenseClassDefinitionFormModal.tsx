import { useEffect, useId, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, type Path, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { applyApiErrorsToForm } from "../../lib/form-errors";
import {
  createLicenseClassDefinition,
  updateLicenseClassDefinition,
} from "../../lib/license-class-definitions-api";
import { ApiError, type ApiValidationError } from "../../lib/http";
import { useT, type TranslationKey } from "../../lib/i18n";
import { candidateKeys } from "../../lib/queries/use-candidates";
import { existingLicenseTypeLabel } from "../../lib/status-maps";
import { useExistingLicenseTypeOptions } from "../../lib/use-license-class-options";
import type {
  LicenseClassDefinitionResponse,
  LicenseClassDefinitionUpsertRequest,
} from "../../lib/types";
import { CustomSelect } from "../ui/CustomSelect";
import { Modal } from "../ui/Modal";
import { RequiredMark } from "../ui/RequiredMark";
import { useToast } from "../ui/Toast";

const optionalNonNegInt = (max: number, message: string) =>
  z.string().refine((v) => {
    if (!v.trim()) return true;
    const n = Number(v.replace(",", "."));
    return Number.isInteger(n) && n >= 0 && n <= max;
  }, message);

const licenseClassDefinitionSchema = z.object({
  code: z.string().min(1, "Hedef kod zorunlu"),
  name: z.string().min(1, "Ad zorunlu"),
  minimumAge: optionalNonNegInt(100, "licenseClassDefForm.error.ageRange"),
  existingLicenseType: z.string(),
  theoryLessonHours: optionalNonNegInt(999, "licenseClassDefForm.error.lessonHoursRange"),
  directPracticeLessonHours: optionalNonNegInt(999, "licenseClassDefForm.error.lessonHoursRange"),
  isActive: z.boolean(),
});
type LicenseClassDefinitionFormValues = {
  code: string;
  name: string;
  minimumAge: string;
  existingLicenseType: string;
  theoryLessonHours: string;
  directPracticeLessonHours: string;
  isActive: boolean;
};

type LicenseClassDefinitionFormModalProps = {
  open: boolean;
  canManage?: boolean;
  editing: LicenseClassDefinitionResponse | null;
  onClose: () => void;
  onSaved: (saved: LicenseClassDefinitionResponse) => void;
  onConcurrencyConflict?: () => void;
};

const VALIDATION_FIELD_MAP: Record<string, keyof LicenseClassDefinitionFormValues> = {
  code: "code",
  Code: "code",
  name: "name",
  Name: "name",
  minimumAge: "minimumAge",
  MinimumAge: "minimumAge",
  existingLicenseType: "existingLicenseType",
  ExistingLicenseType: "existingLicenseType",
  theoryLessonHours: "theoryLessonHours",
  TheoryLessonHours: "theoryLessonHours",
  directPracticeLessonHours: "directPracticeLessonHours",
  DirectPracticeLessonHours: "directPracticeLessonHours",
};

const CONCURRENCY_CODE = "licenseClassDefinition.validation.concurrencyConflict";

function hasConcurrencyError(
  codes: Record<string, ApiValidationError[]> | undefined
): boolean {
  if (!codes) return false;
  return Object.values(codes).some((errors) =>
    errors.some((error) => error.code === CONCURRENCY_CODE)
  );
}

function normalizeUppercase(value: string): string {
  return value.toLocaleUpperCase("tr-TR");
}

function stringValue(value: number | null): string {
  return value === null || value === undefined ? "" : String(value);
}

function getEmptyValues(
  editing: LicenseClassDefinitionResponse | null
): LicenseClassDefinitionFormValues {
  return editing
    ? {
        code: editing.code,
        name: editing.name,
        minimumAge: stringValue(editing.minimumAge),
        existingLicenseType: editing.existingLicenseType ?? "",
        theoryLessonHours: stringValue(editing.theoryLessonHours),
        directPracticeLessonHours: stringValue(editing.directPracticeLessonHours),
        isActive: editing.isActive,
      }
    : {
        code: "",
        name: "",
        minimumAge: "18",
        existingLicenseType: "",
        theoryLessonHours: "",
        directPracticeLessonHours: "",
        isActive: true,
      };
}

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function LicenseClassDefinitionFormModal({
  open,
  canManage = true,
  editing,
  onClose,
  onSaved,
  onConcurrencyConflict,
}: LicenseClassDefinitionFormModalProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const t = useT();
  const noPermissionTitle = t("common.noPermission");
  const [submitting, setSubmitting] = useState(false);
  const codeInputId = useId();
  const nameInputId = useId();
  const minimumAgeId = useId();
  const { options: existingLicenseTypeOptions } = useExistingLicenseTypeOptions(open);

  const invalidateLicenseClassDependents = () => {
    void queryClient.invalidateQueries({ queryKey: ["licenseClassDefinitions"] });
    void queryClient.invalidateQueries({ queryKey: ["settings", "license-class-fee-matrix"] });
    void queryClient.invalidateQueries({ queryKey: ["finance", "license-class-fee-matrix"] });
    void queryClient.invalidateQueries({ queryKey: ["candidate-detail", "exam-attempt-fee-matrix"] });
    void queryClient.invalidateQueries({ queryKey: ["candidate-detail", "contract-back-fee-matrix"] });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
    void queryClient.invalidateQueries({ queryKey: ["training", "vehicles"] });
    void queryClient.invalidateQueries({ queryKey: ["training", "instructors"] });
    void queryClient.invalidateQueries({ queryKey: ["training", "lessons"] });
    void queryClient.invalidateQueries({ queryKey: ["payments"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
    watch,
  } = useForm<LicenseClassDefinitionFormValues>({
    defaultValues: getEmptyValues(editing),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(licenseClassDefinitionSchema) as any,
  });
  const existingLicenseSelectOptions = useMemo(() => {
    if (!editing?.existingLicenseType) return existingLicenseTypeOptions;
    if (existingLicenseTypeOptions.some((option) => option.value === editing.existingLicenseType)) {
      return existingLicenseTypeOptions;
    }

    return [
      ...existingLicenseTypeOptions,
      {
        value: editing.existingLicenseType,
        label: existingLicenseTypeLabel(editing.existingLicenseType, existingLicenseTypeOptions),
      },
    ];
  }, [editing?.existingLicenseType, existingLicenseTypeOptions]);

  useEffect(() => {
    if (!open) return;
    reset(getEmptyValues(editing));
  }, [editing, open, reset]);

  const submit = handleSubmit(async (values) => {
    if (!canManage) return;

    setSubmitting(true);

    const payload: LicenseClassDefinitionUpsertRequest = {
      code: values.code.trim(),
      name: values.name.trim(),
      minimumAge: parseOptionalNumber(values.minimumAge),
      existingLicenseType: values.existingLicenseType.trim() || null,
      theoryLessonHours: parseOptionalNumber(values.theoryLessonHours),
      directPracticeLessonHours: parseOptionalNumber(values.directPracticeLessonHours),
      displayOrder: editing?.displayOrder ?? 1000,
      isActive: values.isActive,
      ...(editing ? { rowVersion: editing.rowVersion } : {}),
    };

    try {
      const saved = editing
        ? await updateLicenseClassDefinition(editing.id, payload)
        : await createLicenseClassDefinition(payload);
      invalidateLicenseClassDependents();
      onSaved(saved);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && hasConcurrencyError(error.validationErrorCodes)) {
        showToast(t("licenseClassDefinition.validation.concurrencyConflict"), "error");
        onConcurrencyConflict?.();
        return;
      }
      const { applied, unmappedMessages } = applyApiErrorsToForm(error, setError, {
        translateCode: (code, params) => t(code as TranslationKey, params),
        fieldMap: VALIDATION_FIELD_MAP as Record<string, Path<LicenseClassDefinitionFormValues>>,
      });
      if (unmappedMessages[0]) {
        showToast(unmappedMessages[0], "error");
      } else if (!applied) {
        showToast(t("licenseClassDefinition.validation.generic"), "error");
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
      title={editing ? t("licenseClassDef.modalTitleEdit") : t("licenseClassDef.modalTitleNew")}
    >
      <form className="settings-form" onSubmit={submit}>
        <div className="form-row license-rule-basics-row">
          <div className="form-group">
            <label className="form-label" htmlFor={codeInputId}>{t("licenseClassDef.field.targetCode")}<RequiredMark /></label>
            <Controller
              control={control}
              name="code"
              render={({ field }) => (
                <input
                  {...field}
                  id={codeInputId}
                  autoCapitalize="characters"
                  className={fieldClass(errors.code?.message)}
                  placeholder="B"
                  value={field.value ?? ""}
                  onChange={(event) => field.onChange(normalizeUppercase(event.target.value))}
                />
              )}
            />
            {errors.code && <div className="form-error">{errors.code.message}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor={nameInputId}>Ad<RequiredMark /></label>
            <input
              id={nameInputId}
              className={fieldClass(errors.name?.message)}
              placeholder="Otomobil ve Kamyonet"
              {...register("name")}
            />
            {errors.name && <div className="form-error">{errors.name.message}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor={minimumAgeId}>{t("licenseClassDef.field.minimumAge")}</label>
            <input
              id={minimumAgeId}
              className={fieldClass(errors.minimumAge?.message)}
              inputMode="numeric"
              min={0}
              placeholder="18"
              step={1}
              type="number"
              {...register("minimumAge")}
            />
            {errors.minimumAge && <div className="form-error">{errors.minimumAge.message}</div>}
          </div>
        </div>

        <div className="settings-checkbox-list">
          <SwitchField label={t("common.field.generalStatus")} switchValue={watch("isActive")} {...register("isActive")} />
        </div>

        <div className="form-subsection license-existing-section">
          <div className="form-subsection-header">
            <div>
              <div className="form-subsection-title">{t("settings.licenseClasses.columns.existingLicenseType")}</div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <Controller
                control={control}
                name="existingLicenseType"
                render={({ field }) => (
                  <CustomSelect
                    {...field}
                    className={selectClass(errors.existingLicenseType?.message)}
                    value={field.value ?? ""}
                  >
                    <option value="">-</option>
                    {existingLicenseSelectOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </CustomSelect>
                )}
              />
              {errors.existingLicenseType && <div className="form-error">{errors.existingLicenseType.message}</div>}
            </div>
          </div>
        </div>

        <div className="form-subsection">
          <div className="form-subsection-header">
            <div>
              <div className="form-subsection-title">{t("licenseClassDefForm.section.lessonHours")}</div>
            </div>
          </div>

          <div className="form-row">
            <NumberField
              error={errors.theoryLessonHours?.message}
              label={t("licenseClassDefForm.field.theoryHours")}
              placeholder="34"
              registerProps={register("theoryLessonHours")}
            />
            <NumberField
              error={errors.directPracticeLessonHours?.message}
              label={t("licenseClassDefForm.field.practiceHours")}
              placeholder="14"
              registerProps={register("directPracticeLessonHours")}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}

type SwitchFieldProps = {
  label: string;
  switchValue: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>;

function SwitchField({ label, switchValue, ...inputProps }: SwitchFieldProps) {
  return (
    <label className="switch-toggle">
      <input type="checkbox" {...inputProps} />
      <span className="switch-toggle-control" aria-hidden="true" />
      <span>{label}: {switchValue ? "Aktif" : "Pasif"}</span>
    </label>
  );
}

type InputFieldProps = {
  error?: string;
  label: string;
  placeholder?: string;
  registerProps: React.InputHTMLAttributes<HTMLInputElement>;
};

function NumberField({ error, label, placeholder, registerProps }: InputFieldProps) {
  const inputId = useId();
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        aria-label={label}
        className={error ? "form-input error" : "form-input"}
        inputMode="numeric"
        min={0}
        placeholder={placeholder}
        step={1}
        type="number"
        {...registerProps}
      />
      {error ? <div className="form-error">{error}</div> : null}
    </div>
  );
}
