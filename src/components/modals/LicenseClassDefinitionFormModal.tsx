import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  createLicenseClassDefinition,
  updateLicenseClassDefinition,
} from "../../lib/license-class-definitions-api";
import { LICENSE_CLASS_DEFINITION_CATEGORY_OPTIONS } from "../../lib/license-class-definition-catalog";
import { ApiError, type ApiValidationError } from "../../lib/http";
import { useT, type TranslationKey } from "../../lib/i18n";
import type {
  LicenseClassDefinitionResponse,
  LicenseClassDefinitionUpsertRequest,
} from "../../lib/types";
import { CustomSelect } from "../ui/CustomSelect";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

type LicenseClassDefinitionFormValues = {
  code: string;
  name: string;
  category: LicenseClassDefinitionUpsertRequest["category"];
  minimumAge: string;
  isAutomatic: boolean;
  isDisabled: boolean;
  isNewGeneration: boolean;
  requiresTheoryExam: boolean;
  requiresPracticeExam: boolean;
  contractLessonHours: string;
  directPracticeLessonHours: string;
  upgradePracticeLessonHours: string;
  courseFee: string;
  mebbisFee: string;
  theoryExamFee: string;
  practiceExamFirstFee: string;
  practiceExamRepeatFee: string;
  additionalPracticeLessonFee: string;
  otherFee: string;
  displayOrder: string;
  isActive: boolean;
  notes: string;
};

type LicenseClassDefinitionFormModalProps = {
  open: boolean;
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
  category: "category",
  Category: "category",
  minimumAge: "minimumAge",
  MinimumAge: "minimumAge",
  contractLessonHours: "contractLessonHours",
  ContractLessonHours: "contractLessonHours",
  directPracticeLessonHours: "directPracticeLessonHours",
  DirectPracticeLessonHours: "directPracticeLessonHours",
  upgradePracticeLessonHours: "upgradePracticeLessonHours",
  UpgradePracticeLessonHours: "upgradePracticeLessonHours",
  courseFee: "courseFee",
  CourseFee: "courseFee",
  mebbisFee: "mebbisFee",
  MebbisFee: "mebbisFee",
  theoryExamFee: "theoryExamFee",
  TheoryExamFee: "theoryExamFee",
  practiceExamFirstFee: "practiceExamFirstFee",
  PracticeExamFirstFee: "practiceExamFirstFee",
  practiceExamRepeatFee: "practiceExamRepeatFee",
  PracticeExamRepeatFee: "practiceExamRepeatFee",
  additionalPracticeLessonFee: "additionalPracticeLessonFee",
  AdditionalPracticeLessonFee: "additionalPracticeLessonFee",
  otherFee: "otherFee",
  OtherFee: "otherFee",
  displayOrder: "displayOrder",
  DisplayOrder: "displayOrder",
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

function applyServerFieldErrors(
  error: ApiError,
  setError: (
    field: keyof LicenseClassDefinitionFormValues,
    error: { message: string }
  ) => void,
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
        category: editing.category,
        minimumAge: stringValue(editing.minimumAge),
        isAutomatic: editing.isAutomatic,
        isDisabled: editing.isDisabled,
        isNewGeneration: editing.isNewGeneration,
        requiresTheoryExam: editing.requiresTheoryExam,
        requiresPracticeExam: editing.requiresPracticeExam,
        contractLessonHours: stringValue(editing.contractLessonHours),
        directPracticeLessonHours: stringValue(editing.directPracticeLessonHours),
        upgradePracticeLessonHours: stringValue(editing.upgradePracticeLessonHours),
        courseFee: stringValue(editing.courseFee),
        mebbisFee: stringValue(editing.mebbisFee),
        theoryExamFee: stringValue(editing.theoryExamFee),
        practiceExamFirstFee: stringValue(editing.practiceExamFirstFee),
        practiceExamRepeatFee: stringValue(editing.practiceExamRepeatFee),
        additionalPracticeLessonFee: stringValue(editing.additionalPracticeLessonFee),
        otherFee: stringValue(editing.otherFee),
        displayOrder: String(editing.displayOrder),
        isActive: editing.isActive,
        notes: editing.notes ?? "",
      }
    : {
        code: "",
        name: "",
        category: "automobile",
        minimumAge: "18",
        isAutomatic: false,
        isDisabled: false,
        isNewGeneration: false,
        requiresTheoryExam: true,
        requiresPracticeExam: true,
        contractLessonHours: "",
        directPracticeLessonHours: "",
        upgradePracticeLessonHours: "",
        courseFee: "",
        mebbisFee: "",
        theoryExamFee: "",
        practiceExamFirstFee: "",
        practiceExamRepeatFee: "",
        additionalPracticeLessonFee: "",
        otherFee: "",
        displayOrder: "1000",
        isActive: true,
        notes: "",
      };
}

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 1000;
}

function validateOptionalInteger(value: string, min: number, max: number, message: string): true | string {
  const parsed = parseOptionalNumber(value);
  if (parsed === null) return true;
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return message;
  }
  return true;
}

function validateFee(value: string): true | string {
  const parsed = parseOptionalNumber(value);
  if (parsed === null) return true;
  if (parsed < 0 || parsed > 1000000) {
    return "Ücret 0 ile 1000000 arasında olmalı";
  }
  return true;
}

export function LicenseClassDefinitionFormModal({
  open,
  editing,
  onClose,
  onSaved,
  onConcurrencyConflict,
}: LicenseClassDefinitionFormModalProps) {
  const { showToast } = useToast();
  const t = useT();
  const [submitting, setSubmitting] = useState(false);

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
  });

  useEffect(() => {
    if (!open) return;
    reset(getEmptyValues(editing));
  }, [editing, open, reset]);

  const submit = handleSubmit(async (values) => {
    setSubmitting(true);

    const payload: LicenseClassDefinitionUpsertRequest = {
      code: values.code.trim(),
      name: values.name.trim(),
      category: values.category,
      minimumAge: parseOptionalNumber(values.minimumAge),
      isAutomatic: values.isAutomatic,
      isDisabled: values.isDisabled,
      isNewGeneration: values.isNewGeneration,
      requiresTheoryExam: values.requiresTheoryExam,
      requiresPracticeExam: values.requiresPracticeExam,
      contractLessonHours: parseOptionalNumber(values.contractLessonHours),
      directPracticeLessonHours: parseOptionalNumber(values.directPracticeLessonHours),
      upgradePracticeLessonHours: parseOptionalNumber(values.upgradePracticeLessonHours),
      courseFee: parseOptionalNumber(values.courseFee),
      mebbisFee: parseOptionalNumber(values.mebbisFee),
      theoryExamFee: parseOptionalNumber(values.theoryExamFee),
      practiceExamFirstFee: parseOptionalNumber(values.practiceExamFirstFee),
      practiceExamRepeatFee: parseOptionalNumber(values.practiceExamRepeatFee),
      additionalPracticeLessonFee: parseOptionalNumber(values.additionalPracticeLessonFee),
      otherFee: parseOptionalNumber(values.otherFee),
      displayOrder: parseInteger(values.displayOrder),
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
      if (error instanceof ApiError) {
        if (error.status === 409 && hasConcurrencyError(error.validationErrorCodes)) {
          showToast(t("licenseClassDefinition.validation.concurrencyConflict"), "error");
          onConcurrencyConflict?.();
          return;
        }
        const { appliedFieldError, unmappedMessage } = applyServerFieldErrors(error, setError, t);
        if (unmappedMessage) {
          showToast(unmappedMessage, "error");
        } else if (!appliedFieldError) {
          showToast(t("licenseClassDefinition.validation.generic"), "error");
        }
      } else {
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
            İptal
          </button>
          <button className="btn btn-primary" disabled={submitting} onClick={submit} type="button">
            {submitting ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title={editing ? "Ehliyet Tipi Düzenle" : "Yeni Ehliyet Tipi"}
    >
      <form className="settings-form" onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Kod</label>
            <Controller
              control={control}
              name="code"
              rules={{ required: "Kod zorunlu" }}
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
            <label className="form-label">Ehliyet Tipi</label>
            <input
              className={fieldClass(errors.name?.message)}
              placeholder="B Otomobil"
              {...register("name", { required: "Ehliyet tipi zorunlu" })}
            />
            {errors.name && <div className="form-error">{errors.name.message}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Kategori</label>
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
            <label className="form-label">Yaş Şartı</label>
            <input
              className={fieldClass(errors.minimumAge?.message)}
              inputMode="numeric"
              min={0}
              placeholder="18"
              step={1}
              type="number"
              {...register("minimumAge", {
                validate: (value) =>
                  validateOptionalInteger(value, 0, 100, "Yaş şartı 0 ile 100 arasında olmalı"),
              })}
            />
            {errors.minimumAge && <div className="form-error">{errors.minimumAge.message}</div>}
          </div>
        </div>

        <div className="settings-checkbox-list">
          <SwitchField label="Otomatik" switchValue={watch("isAutomatic")} {...register("isAutomatic")} />
          <SwitchField label="Engelli" switchValue={watch("isDisabled")} {...register("isDisabled")} />
          <SwitchField
            label="Yeni Nesil"
            switchValue={watch("isNewGeneration")}
            {...register("isNewGeneration")}
          />
          <SwitchField
            label="Teorik sınav gerekli"
            switchValue={watch("requiresTheoryExam")}
            {...register("requiresTheoryExam")}
          />
          <SwitchField
            label="Uygulama sınavı gerekli"
            switchValue={watch("requiresPracticeExam")}
            {...register("requiresPracticeExam")}
          />
          <SwitchField label="Genel Durum" switchValue={watch("isActive")} {...register("isActive")} />
        </div>

        <div className="form-subsection">
          <div className="form-subsection-header">
            <div>
              <div className="form-subsection-title">Ders Saatleri</div>
            </div>
          </div>

          <div className="form-row">
            <NumberField
              error={errors.contractLessonHours?.message}
              label="Sözleşme Saati"
              placeholder="16"
              registerProps={register("contractLessonHours", {
                validate: (value) =>
                  validateOptionalInteger(value, 0, 999, "Ders saati 0 ile 999 arasında olmalı"),
              })}
            />
            <NumberField
              error={errors.directPracticeLessonHours?.message}
              label="Doğrudan Direksiyon"
              placeholder="14"
              registerProps={register("directPracticeLessonHours", {
                validate: (value) =>
                  validateOptionalInteger(value, 0, 999, "Ders saati 0 ile 999 arasında olmalı"),
              })}
            />
            <NumberField
              error={errors.upgradePracticeLessonHours?.message}
              label="Yükseltme Direksiyon"
              placeholder="7"
              registerProps={register("upgradePracticeLessonHours", {
                validate: (value) =>
                  validateOptionalInteger(value, 0, 999, "Ders saati 0 ile 999 arasında olmalı"),
              })}
            />
          </div>
        </div>

        <div className="form-subsection">
          <div className="form-subsection-header">
            <div>
              <div className="form-subsection-title">Ücret Kalemleri</div>
            </div>
          </div>

          <div className="form-row">
            <MoneyField
              error={errors.courseFee?.message}
              label="Eğitim Ücreti"
              registerProps={register("courseFee", { validate: validateFee })}
            />
            <MoneyField
              error={errors.mebbisFee?.message}
              label="MEBBIS Ücreti"
              registerProps={register("mebbisFee", { validate: validateFee })}
            />
            <MoneyField
              error={errors.theoryExamFee?.message}
              label="Teorik Sınav"
              registerProps={register("theoryExamFee", { validate: validateFee })}
            />
          </div>

          <div className="form-row">
            <MoneyField
              error={errors.practiceExamFirstFee?.message}
              label="1. Uygulama"
              registerProps={register("practiceExamFirstFee", { validate: validateFee })}
            />
            <MoneyField
              error={errors.practiceExamRepeatFee?.message}
              label="Tekrar Uygulama"
              registerProps={register("practiceExamRepeatFee", { validate: validateFee })}
            />
            <MoneyField
              error={errors.additionalPracticeLessonFee?.message}
              label="2 Saatlik Uygulama"
              registerProps={register("additionalPracticeLessonFee", { validate: validateFee })}
            />
          </div>

          <div className="form-row">
            <MoneyField
              error={errors.otherFee?.message}
              label="Diğer Ücret"
              registerProps={register("otherFee", { validate: validateFee })}
            />
            <NumberField
              error={errors.displayOrder?.message}
              label="Sıralama"
              placeholder="1000"
              registerProps={register("displayOrder", {
                required: "Sıralama zorunlu",
                validate: (value) =>
                  validateOptionalInteger(value, 0, 100000, "Sıralama 0 ile 100000 arasında olmalı"),
              })}
            />
          </div>
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">Not</label>
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

function MoneyField({ error, label, registerProps }: InputFieldProps) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input
        aria-label={label}
        className={error ? "form-input error" : "form-input"}
        inputMode="decimal"
        min={0}
        placeholder="0"
        step="0.01"
        type="number"
        {...registerProps}
      />
      {error ? <div className="form-error">{error}</div> : null}
    </div>
  );
}
