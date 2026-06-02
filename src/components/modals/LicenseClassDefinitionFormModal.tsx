import { useEffect, useMemo, useState } from "react";
import { Controller, type Path, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { applyApiErrorsToForm } from "../../lib/form-errors";
import {
  createLicenseClassDefinition,
  updateLicenseClassDefinition,
} from "../../lib/license-class-definitions-api";
import { LICENSE_CLASS_DEFINITION_CATEGORY_OPTIONS } from "../../lib/license-class-definition-catalog";
import { ApiError, type ApiValidationError } from "../../lib/http";
import { useT, type TranslationKey } from "../../lib/i18n";
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
  category: z.string(),
  minimumAge: optionalNonNegInt(100, "licenseClassDefForm.error.ageRange"),
  hasExistingLicense: z.boolean(),
  existingLicenseType: z.string(),
  existingLicensePre2016: z.boolean(),
  requiresTheoryExam: z.boolean(),
  requiresPracticeExam: z.boolean(),
  theoryLessonHours: optionalNonNegInt(999, "licenseClassDefForm.error.lessonHoursRange"),
  simulatorLessonHours: optionalNonNegInt(999, "licenseClassDefForm.error.lessonHoursRange"),
  directPracticeLessonHours: optionalNonNegInt(999, "licenseClassDefForm.error.lessonHoursRange"),
  isActive: z.boolean(),
  notes: z.string(),
});
type LicenseClassDefinitionFormValues = {
  code: string;
  category: LicenseClassDefinitionUpsertRequest["category"];
  minimumAge: string;
  hasExistingLicense: boolean;
  existingLicenseType: string;
  existingLicensePre2016: boolean;
  requiresTheoryExam: boolean;
  requiresPracticeExam: boolean;
  theoryLessonHours: string;
  simulatorLessonHours: string;
  directPracticeLessonHours: string;
  isActive: boolean;
  notes: string;
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
  category: "category",
  Category: "category",
  minimumAge: "minimumAge",
  MinimumAge: "minimumAge",
  hasExistingLicense: "hasExistingLicense",
  HasExistingLicense: "hasExistingLicense",
  existingLicenseType: "existingLicenseType",
  ExistingLicenseType: "existingLicenseType",
  existingLicensePre2016: "existingLicensePre2016",
  ExistingLicensePre2016: "existingLicensePre2016",
  theoryLessonHours: "theoryLessonHours",
  TheoryLessonHours: "theoryLessonHours",
  simulatorLessonHours: "simulatorLessonHours",
  SimulatorLessonHours: "simulatorLessonHours",
  directPracticeLessonHours: "directPracticeLessonHours",
  DirectPracticeLessonHours: "directPracticeLessonHours",
  notes: "notes",
  Notes: "notes",
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
        category: editing.category,
        minimumAge: stringValue(editing.minimumAge),
        hasExistingLicense: editing.hasExistingLicense,
        existingLicenseType: editing.existingLicenseType ?? "",
        existingLicensePre2016: editing.existingLicensePre2016,
        requiresTheoryExam: editing.requiresTheoryExam,
        requiresPracticeExam: editing.requiresPracticeExam,
        theoryLessonHours: stringValue(editing.theoryLessonHours),
        simulatorLessonHours: stringValue(editing.simulatorLessonHours),
        directPracticeLessonHours: stringValue(editing.directPracticeLessonHours),
        isActive: editing.isActive,
        notes: editing.notes ?? "",
      }
    : {
        code: "",
        category: "automobile",
        minimumAge: "18",
        hasExistingLicense: false,
        existingLicenseType: "",
        existingLicensePre2016: false,
        requiresTheoryExam: true,
        requiresPracticeExam: true,
        theoryLessonHours: "",
        simulatorLessonHours: "",
        directPracticeLessonHours: "",
        isActive: true,
        notes: "",
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
  const { showToast } = useToast();
  const t = useT();
  const noPermissionTitle = t("common.noPermission");
  const [submitting, setSubmitting] = useState(false);
  const { options: existingLicenseTypeOptions } = useExistingLicenseTypeOptions();

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
    watch,
  } = useForm<LicenseClassDefinitionFormValues>({
    defaultValues: getEmptyValues(editing),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(licenseClassDefinitionSchema) as any,
  });
  const hasExistingLicense = watch("hasExistingLicense");
  const existingLicensePre2016 = watch("existingLicensePre2016");
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

  useEffect(() => {
    if (open && hasExistingLicense) {
      setValue("requiresTheoryExam", false, { shouldDirty: true, shouldValidate: true });
    }
  }, [hasExistingLicense, open, setValue]);

  useEffect(() => {
    if (open && existingLicensePre2016 && !hasExistingLicense) {
      setValue("hasExistingLicense", true, { shouldDirty: true, shouldValidate: true });
    }
  }, [existingLicensePre2016, hasExistingLicense, open, setValue]);

  const submit = handleSubmit(async (values) => {
    if (!canManage) return;

    setSubmitting(true);

    const payload: LicenseClassDefinitionUpsertRequest = {
      code: values.code.trim(),
      category: values.category,
      minimumAge: parseOptionalNumber(values.minimumAge),
      hasExistingLicense: values.hasExistingLicense,
      existingLicenseType: values.hasExistingLicense ? values.existingLicenseType.trim() || null : null,
      existingLicensePre2016: values.hasExistingLicense ? values.existingLicensePre2016 : false,
      requiresTheoryExam: values.hasExistingLicense ? false : values.requiresTheoryExam,
      requiresPracticeExam: values.requiresPracticeExam,
      theoryLessonHours: parseOptionalNumber(values.theoryLessonHours),
      simulatorLessonHours: parseOptionalNumber(values.simulatorLessonHours),
      directPracticeLessonHours: parseOptionalNumber(values.directPracticeLessonHours),
      displayOrder: editing?.displayOrder ?? 1000,
      isActive: values.isActive,
      notes: values.notes.trim() || null,
      ...(editing ? { rowVersion: editing.rowVersion } : {}),
    };

    try {
      const saved = editing
        ? await updateLicenseClassDefinition(editing.id, payload)
        : await createLicenseClassDefinition(payload);
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
            <label className="form-label">{t("licenseClassDef.field.targetCode")}<RequiredMark /></label>
            <Controller
              control={control}
              name="code"
              render={({ field }) => (
                <input
                  {...field}
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
            <label className="form-label">{t("common.field.vehicleType")}</label>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <CustomSelect className={selectClass(errors.category?.message)} {...field}>
                  {LICENSE_CLASS_DEFINITION_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </CustomSelect>
              )}
            />
            {errors.category && <div className="form-error">{errors.category.message}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">{t("licenseClassDef.field.minimumAge")}</label>
            <input
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
          <SwitchField
            label={t("licenseClassDefForm.field.theoryExamRequired")}
            switchValue={watch("requiresTheoryExam")}
            {...register("requiresTheoryExam")}
          />
          <SwitchField
            label={t("licenseClassDefForm.field.practiceExamRequired")}
            switchValue={watch("requiresPracticeExam")}
            {...register("requiresPracticeExam")}
          />
          <SwitchField label="Genel Durum" switchValue={watch("isActive")} {...register("isActive")} />
        </div>

        <div className="form-subsection license-existing-section">
          <div className="form-subsection-header">
            <div>
              <div className="form-subsection-title">Mevcut Ehliyet</div>
            </div>
          </div>

          <div className="settings-checkbox-list">
            <SwitchField label="Mevcut ehliyet var" switchValue={watch("hasExistingLicense")} {...register("hasExistingLicense")} />
            <SwitchField label={t("licenseClassDefForm.field.pre2016")} switchValue={watch("existingLicensePre2016")} {...register("existingLicensePre2016")} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <Controller
                control={control}
                name="existingLicenseType"
                rules={{
                  validate: (value) =>
                    !watch("hasExistingLicense") || value.trim().length > 0 || "Mevcut tipi zorunlu",
                }}
                render={({ field }) => (
                  <CustomSelect
                    {...field}
                    className={selectClass(errors.existingLicenseType?.message)}
                    disabled={!watch("hasExistingLicense")}
                    value={field.value ?? ""}
                  >
                    <option value="">{t("licenseClassDefForm.placeholder.selectExistingType")}</option>
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
              <div className="form-subsection-title">Ders Saatleri</div>
            </div>
          </div>

          <div className="form-row">
            <NumberField
              error={errors.theoryLessonHours?.message}
              label="Teorik Ders Saati"
              placeholder="34"
              registerProps={register("theoryLessonHours")}
            />
            <NumberField
              error={errors.simulatorLessonHours?.message}
              label={t("licenseClassDefForm.field.simulatorHours")}
              placeholder="2"
              registerProps={register("simulatorLessonHours")}
            />
            <NumberField
              error={errors.directPracticeLessonHours?.message}
              label="Direksiyon Saati"
              placeholder="14"
              registerProps={register("directPracticeLessonHours")}
            />
          </div>
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">{t("common.field.note")}</label>
            <textarea className="form-input" rows={4} {...register("notes")} />
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
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input
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
