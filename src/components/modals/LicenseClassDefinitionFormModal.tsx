import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  createLicenseClassDefinition,
  updateLicenseClassDefinition,
} from "../../lib/license-class-definitions-api";
import { LICENSE_CLASS_DEFINITION_CATEGORY_OPTIONS } from "../../lib/license-class-definition-catalog";
import { FEE_TYPE_LABELS } from "../../lib/fee-catalog";
import { getFees } from "../../lib/fees-api";
import { ApiError, type ApiValidationError } from "../../lib/http";
import { useT, type TranslationKey } from "../../lib/i18n";
import { EXISTING_LICENSE_TYPE_OPTIONS } from "../../lib/status-maps";
import type {
  FeeResponse,
  LicenseClassDefinitionResponse,
  LicenseClassDefinitionUpsertRequest,
} from "../../lib/types";
import { CustomSelect } from "../ui/CustomSelect";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

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

function validateOptionalInteger(value: string, min: number, max: number, message: string): true | string {
  const parsed = parseOptionalNumber(value);
  if (parsed === null) return true;
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return message;
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
  const [linkedFees, setLinkedFees] = useState<FeeResponse[]>([]);
  const [linkedFeesLoading, setLinkedFeesLoading] = useState(false);

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

  useEffect(() => {
    if (!open || !editing?.id) {
      setLinkedFees([]);
      return;
    }
    const controller = new AbortController();
    setLinkedFeesLoading(true);
    getFees(
      { activity: "active", licenseClassId: editing.id, page: 1, pageSize: 100 },
      controller.signal
    )
      .then((response) => setLinkedFees(response.items))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLinkedFees([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLinkedFeesLoading(false);
      });
    return () => controller.abort();
  }, [editing?.id, open]);

  const submit = handleSubmit(async (values) => {
    setSubmitting(true);

    const payload: LicenseClassDefinitionUpsertRequest = {
      code: values.code.trim(),
      category: values.category,
      minimumAge: parseOptionalNumber(values.minimumAge),
      hasExistingLicense: values.hasExistingLicense,
      existingLicenseType: values.hasExistingLicense ? values.existingLicenseType.trim() || null : null,
      existingLicensePre2016: values.hasExistingLicense ? values.existingLicensePre2016 : false,
      requiresTheoryExam: values.requiresTheoryExam,
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
      title={editing ? "Ehliyet Kuralı Düzenle" : "Yeni Ehliyet Kuralı"}
    >
      <form className="settings-form" onSubmit={submit}>
        <div className="form-row license-rule-basics-row">
          <div className="form-group">
            <label className="form-label">Hedef Kod</label>
            <Controller
              control={control}
              name="code"
              rules={{ required: "Hedef kod zorunlu" }}
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

        <div className="form-subsection license-existing-section">
          <div className="form-subsection-header">
            <div>
              <div className="form-subsection-title">Mevcut Ehliyet</div>
            </div>
          </div>

          <div className="settings-checkbox-list">
            <SwitchField label="Mevcut ehliyet var" switchValue={watch("hasExistingLicense")} {...register("hasExistingLicense")} />
            <SwitchField label="2016 öncesi" switchValue={watch("existingLicensePre2016")} {...register("existingLicensePre2016")} />
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
                    <option value="">Mevcut tipi seçin</option>
                    {EXISTING_LICENSE_TYPE_OPTIONS.map((option) => (
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
              registerProps={register("theoryLessonHours", {
                validate: (value) =>
                  validateOptionalInteger(value, 0, 999, "Ders saati 0 ile 999 arasında olmalı"),
              })}
            />
            <NumberField
              error={errors.simulatorLessonHours?.message}
              label="Simülatör Saati"
              placeholder="2"
              registerProps={register("simulatorLessonHours", {
                validate: (value) =>
                  validateOptionalInteger(value, 0, 999, "Ders saati 0 ile 999 arasında olmalı"),
              })}
            />
            <NumberField
              error={errors.directPracticeLessonHours?.message}
              label="Direksiyon Saati"
              placeholder="14"
              registerProps={register("directPracticeLessonHours", {
                validate: (value) =>
                  validateOptionalInteger(value, 0, 999, "Ders saati 0 ile 999 arasında olmalı"),
              })}
            />
          </div>
        </div>

        {editing ? (
          <div className="form-subsection">
            <div className="form-subsection-header">
              <div>
                <div className="form-subsection-title">İlgili Ücretler</div>
                <div className="form-subsection-note">
                  Bu sınıfa bağlı ücretler. Düzenlemek için Ücretler ekranını kullanın.
                </div>
              </div>
            </div>
            <div className="settings-table-wrap">
              <table className="settings-table">
                <thead>
                  <tr>
                    <th>Ders Türü</th>
                    <th>Ücret (TL)</th>
                  </tr>
                </thead>
                <tbody>
                  {linkedFeesLoading ? (
                    <tr>
                      <td colSpan={2}>…</td>
                    </tr>
                  ) : linkedFees.length === 0 ? (
                    <tr>
                      <td colSpan={2}>Bu sınıfa bağlı ücret yok.</td>
                    </tr>
                  ) : (
                    linkedFees.map((fee) => (
                      <tr key={fee.id}>
                        <td>{FEE_TYPE_LABELS[fee.feeType] ?? fee.feeType}</td>
                        <td>{fee.amount.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

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
