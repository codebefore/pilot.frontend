import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { createInstructor, updateInstructor } from "../../lib/instructors-api";
import {
  INSTRUCTOR_EMPLOYMENT_OPTIONS,
  INSTRUCTOR_ROLE_OPTIONS,
} from "../../lib/instructor-catalog";
import { ApiError, type ApiValidationError } from "../../lib/http";
import { useT, type TranslationKey } from "../../lib/i18n";
import type {
  InstructorBranch,
  InstructorResponse,
  InstructorUpsertRequest,
  LicenseClass,
} from "../../lib/types";
import { useLicenseClassOptions } from "../../lib/use-license-class-options";
import { CustomSelect } from "../ui/CustomSelect";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

type InstructorFormValues = {
  code: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  phoneNumber: string;
  email: string;
  isActive: boolean;
  role: InstructorUpsertRequest["role"];
  employmentType: InstructorUpsertRequest["employmentType"];
  branches: InstructorBranch[];
  licenseClassCodes: LicenseClass[];
  weeklyLessonHours: string;
  mebbisPermitNo: string;
  notes: string;
};

type InstructorFormModalProps = {
  open: boolean;
  editing: InstructorResponse | null;
  branchOptions: Array<{ value: InstructorBranch; label: string }>;
  onClose: () => void;
  onSaved: (saved: InstructorResponse) => void;
  onConcurrencyConflict?: () => void;
};

const VALIDATION_FIELD_MAP: Record<string, keyof InstructorFormValues> = {
  code: "code",
  Code: "code",
  firstName: "firstName",
  FirstName: "firstName",
  lastName: "lastName",
  LastName: "lastName",
  nationalId: "nationalId",
  NationalId: "nationalId",
  phoneNumber: "phoneNumber",
  PhoneNumber: "phoneNumber",
  email: "email",
  Email: "email",
  role: "role",
  Role: "role",
  employmentType: "employmentType",
  EmploymentType: "employmentType",
  branches: "branches",
  Branches: "branches",
  licenseClassCodes: "licenseClassCodes",
  LicenseClassCodes: "licenseClassCodes",
  weeklyLessonHours: "weeklyLessonHours",
  WeeklyLessonHours: "weeklyLessonHours",
  mebbisPermitNo: "mebbisPermitNo",
  MebbisPermitNo: "mebbisPermitNo",
  notes: "notes",
  Notes: "notes",
};

const CONCURRENCY_CODE = "instructor.validation.concurrencyConflict";

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
  setError: (field: keyof InstructorFormValues, error: { message: string }) => void,
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

function getEmptyValues(editing: InstructorResponse | null): InstructorFormValues {
  return editing
    ? {
        code: editing.code,
        firstName: editing.firstName,
        lastName: editing.lastName,
        nationalId: editing.nationalId ?? "",
        phoneNumber: editing.phoneNumber ?? "",
        email: editing.email ?? "",
        isActive: editing.isActive,
        role: editing.role,
        employmentType: editing.employmentType,
        branches: editing.branches,
        licenseClassCodes: editing.licenseClassCodes,
        weeklyLessonHours:
          editing.weeklyLessonHours !== null && editing.weeklyLessonHours !== undefined
            ? String(editing.weeklyLessonHours)
            : "",
        mebbisPermitNo: editing.mebbisPermitNo ?? "",
        notes: editing.notes ?? "",
      }
    : {
        code: "",
        firstName: "",
        lastName: "",
        nationalId: "",
        phoneNumber: "",
        email: "",
        isActive: true,
        role: "master_instructor",
        employmentType: "hourly",
        branches: ["practice"],
        licenseClassCodes: ["B"],
        weeklyLessonHours: "",
        mebbisPermitNo: "",
        notes: "",
      };
}

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateWeeklyLessonHours(value: string): true | string {
  if (!value.trim()) return true;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 80) {
    return "Haftalık ders saati 0 ile 80 arasında olmalı";
  }

  return true;
}

function toggleValue<T extends string>(values: T[], value: T, checked: boolean): T[] {
  if (checked) {
    return values.includes(value) ? values : [...values, value];
  }

  return values.filter((item) => item !== value);
}

export function InstructorFormModal({
  open,
  editing,
  branchOptions,
  onClose,
  onSaved,
  onConcurrencyConflict,
}: InstructorFormModalProps) {
  const { showToast } = useToast();
  const t = useT();
  const [submitting, setSubmitting] = useState(false);
  const { options: licenseClassOptions } = useLicenseClassOptions();

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
    watch,
  } = useForm<InstructorFormValues>({
    defaultValues: getEmptyValues(editing),
  });
  const selectedLicenseClassCodes = watch("licenseClassCodes");

  useEffect(() => {
    if (!open) return;
    reset(getEmptyValues(editing));
  }, [editing, open, reset]);

  useEffect(() => {
    if (!open || licenseClassOptions.length === 0) return;

    const supported = new Set(licenseClassOptions.map((option) => option.value));
    const selected = selectedLicenseClassCodes ?? [];
    if (selected.length > 0 && selected.every((value) => supported.has(value))) {
      return;
    }

    const activeSelected = selected.filter((value) => supported.has(value));
    setValue("licenseClassCodes", activeSelected.length > 0 ? activeSelected : [licenseClassOptions[0].value], {
      shouldDirty: false,
      shouldValidate: true,
    });
  }, [licenseClassOptions, open, selectedLicenseClassCodes, setValue]);

  const submit = handleSubmit(async (values) => {
    setSubmitting(true);

    const payload: InstructorUpsertRequest = {
      code: values.code.trim() || null,
      firstName: normalizeUppercase(values.firstName.trim()),
      lastName: normalizeUppercase(values.lastName.trim()),
      nationalId: values.nationalId.trim() || null,
      phoneNumber: values.phoneNumber.trim() || null,
      email: values.email.trim() || null,
      isActive: values.isActive,
      role: values.role,
      employmentType: values.employmentType,
      branches: values.branches,
      licenseClassCodes: values.licenseClassCodes,
      weeklyLessonHours: parseOptionalNumber(values.weeklyLessonHours),
      mebbisPermitNo: values.mebbisPermitNo.trim() || null,
      assignedVehicleId: editing?.assignedVehicleId ?? null,
      notes: values.notes.trim() || null,
      ...(editing ? { rowVersion: editing.rowVersion } : {}),
    };

    try {
      const saved = editing
        ? await updateInstructor(editing.id, payload)
        : await createInstructor(payload);
      onSaved(saved);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409 && hasConcurrencyError(error.validationErrorCodes)) {
          showToast(t("instructor.validation.concurrencyConflict"), "error");
          onConcurrencyConflict?.();
          return;
        }
        const { appliedFieldError, unmappedMessage } = applyServerFieldErrors(error, setError, t);
        if (unmappedMessage) {
          showToast(unmappedMessage, "error");
        } else if (!appliedFieldError) {
          showToast(t("instructor.validation.generic"), "error");
        }
      } else {
        showToast(t("instructor.validation.generic"), "error");
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
      title={editing ? "Eğitmen Düzenle" : "Yeni Eğitmen"}
    >
      <form className="settings-form" onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Personel Kodu</label>
            <Controller
              control={control}
              name="code"
              render={({ field }) => (
                <input
                  {...field}
                  autoCapitalize="characters"
                  className={fieldClass(errors.code?.message)}
                  placeholder="Boş ise otomatik"
                  value={field.value ?? ""}
                  onChange={(event) => field.onChange(normalizeUppercase(event.target.value))}
                />
              )}
            />
            {errors.code && <div className="form-error">{errors.code.message}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">TC Kimlik No</label>
            <input
              className={fieldClass(errors.nationalId?.message)}
              inputMode="numeric"
              maxLength={11}
              placeholder="12345678901"
              {...register("nationalId")}
            />
            {errors.nationalId && <div className="form-error">{errors.nationalId.message}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Ad</label>
            <Controller
              control={control}
              name="firstName"
              rules={{ required: "Ad zorunlu" }}
              render={({ field }) => (
                <input
                  {...field}
                  autoCapitalize="characters"
                  className={fieldClass(errors.firstName?.message)}
                  placeholder="HASAN"
                  value={field.value ?? ""}
                  onChange={(event) => field.onChange(normalizeUppercase(event.target.value))}
                />
              )}
            />
            {errors.firstName && <div className="form-error">{errors.firstName.message}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Soyad</label>
            <Controller
              control={control}
              name="lastName"
              rules={{ required: "Soyad zorunlu" }}
              render={({ field }) => (
                <input
                  {...field}
                  autoCapitalize="characters"
                  className={fieldClass(errors.lastName?.message)}
                  placeholder="KORKMAZ"
                  value={field.value ?? ""}
                  onChange={(event) => field.onChange(normalizeUppercase(event.target.value))}
                />
              )}
            />
            {errors.lastName && <div className="form-error">{errors.lastName.message}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Telefon</label>
            <input className={fieldClass(errors.phoneNumber?.message)} placeholder="0532 123 45 67" {...register("phoneNumber")} />
          </div>

          <div className="form-group">
            <label className="form-label">E-posta</label>
            <input
              className={fieldClass(errors.email?.message)}
              placeholder="egitmen@kurum.com"
              type="email"
              {...register("email")}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Görev</label>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <CustomSelect className={selectClass(errors.role?.message)} {...field}>
                  {INSTRUCTOR_ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </CustomSelect>
              )}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Statü</label>
            <Controller
              control={control}
              name="employmentType"
              render={({ field }) => (
                <CustomSelect className={selectClass(errors.employmentType?.message)} {...field}>
                  {INSTRUCTOR_EMPLOYMENT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </CustomSelect>
              )}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Haftalık Ders Saati</label>
            <input
              className={fieldClass(errors.weeklyLessonHours?.message)}
              inputMode="numeric"
              max={80}
              min={0}
              placeholder="24"
              step={1}
              type="number"
              {...register("weeklyLessonHours", { validate: validateWeeklyLessonHours })}
            />
            {errors.weeklyLessonHours && (
              <div className="form-error">{errors.weeklyLessonHours.message}</div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">MEBBİS İzin No</label>
            <input className={fieldClass(errors.mebbisPermitNo?.message)} placeholder="MEB izin no" {...register("mebbisPermitNo")} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Branş</label>
            <Controller
              control={control}
              name="branches"
              rules={{ validate: (value) => value.length > 0 || "En az bir branş seçilmeli" }}
              render={({ field }) => {
                const values = field.value ?? [];
                return (
                  <div className="settings-checkbox-list">
                    {branchOptions.map((option) => (
                      <label className="switch-toggle" key={option.value}>
                        <input
                          checked={values.includes(option.value)}
                          onChange={(event) =>
                            field.onChange(toggleValue(values, option.value, event.target.checked))
                          }
                          type="checkbox"
                        />
                        <span className="switch-toggle-control" aria-hidden="true" />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                );
              }}
            />
            {errors.branches && <div className="form-error">{errors.branches.message}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Belge Türleri</label>
            <Controller
              control={control}
              name="licenseClassCodes"
              rules={{ validate: (value) => value.length > 0 || "En az bir belge türü seçilmeli" }}
              render={({ field }) => {
                const values = field.value ?? [];
                return (
                  <div className="settings-checkbox-list">
                    {licenseClassOptions.map((option) => (
                      <label className="switch-toggle" key={option.value}>
                        <input
                          checked={values.includes(option.value)}
                          onChange={(event) =>
                            field.onChange(toggleValue(values, option.value, event.target.checked))
                          }
                          type="checkbox"
                        />
                        <span className="switch-toggle-control" aria-hidden="true" />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                );
              }}
            />
            {errors.licenseClassCodes && (
              <div className="form-error">{errors.licenseClassCodes.message}</div>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Genel Durum</label>
            <label className="switch-toggle">
              <input type="checkbox" {...register("isActive")} />
              <span className="switch-toggle-control" aria-hidden="true" />
              <span>{watch("isActive") ? "Aktif" : "Pasif"}</span>
            </label>
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
