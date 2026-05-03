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
  InstructorCreateRequest,
  InstructorEmploymentType,
  InstructorResponse,
  InstructorRole,
  InstructorUpsertRequest,
  LicenseClass,
  TrainingBranchDefinitionResponse,
} from "../../lib/types";
import { useLicenseClassOptions } from "../../lib/use-license-class-options";
import { CustomSelect } from "../ui/CustomSelect";
import { LocalizedDateInput } from "../ui/LocalizedDateInput";
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
  licenseClassCodes: LicenseClass[];
  notes: string;
	  assignmentRole: InstructorRole;
	  assignmentEmploymentType: InstructorEmploymentType;
	  assignmentBranches: InstructorBranch[];
	  assignmentLicenseClassCodes: LicenseClass[];
	  assignmentWeeklyLessonHours: string;
  assignmentMebPermitNo: string;
  assignmentContractStartDate: string;
  assignmentContractEndDate: string;
};

type InstructorFormModalProps = {
  open: boolean;
  editing: InstructorResponse | null;
  branches: TrainingBranchDefinitionResponse[];
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
  licenseClassCodes: "licenseClassCodes",
  LicenseClassCodes: "licenseClassCodes",
  "initialAssignment.branches": "assignmentBranches",
  "InitialAssignment.Branches": "assignmentBranches",
  "initialAssignment.licenseClassCodes": "assignmentLicenseClassCodes",
  "InitialAssignment.LicenseClassCodes": "assignmentLicenseClassCodes",
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
        licenseClassCodes: editing.licenseClassCodes,
        notes: editing.notes ?? "",
        assignmentRole: editing.role,
        assignmentEmploymentType: editing.employmentType,
	        assignmentBranches: editing.branches,
	        assignmentLicenseClassCodes: editing.licenseClassCodes,
        assignmentWeeklyLessonHours:
          editing.weeklyLessonHours != null ? String(editing.weeklyLessonHours) : "",
        assignmentMebPermitNo: editing.mebbisPermitNo ?? "",
        assignmentContractStartDate: "",
        assignmentContractEndDate: "",
      }
    : {
        code: "",
        firstName: "",
        lastName: "",
        nationalId: "",
        phoneNumber: "",
        email: "",
        isActive: true,
        licenseClassCodes: ["B"],
        notes: "",
        assignmentRole: "master_instructor",
        assignmentEmploymentType: "hourly",
	        assignmentBranches: ["practice"],
	        assignmentLicenseClassCodes: ["B"],
        assignmentWeeklyLessonHours: "",
        assignmentMebPermitNo: "",
        assignmentContractStartDate: new Date().toISOString().slice(0, 10),
        assignmentContractEndDate: "",
      };
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
  branches,
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
  const selectedAssignmentBranches = watch("assignmentBranches");

  useEffect(() => {
    if (!open) return;
    reset(getEmptyValues(editing));
  }, [editing, open, reset]);

  useEffect(() => {
    if (!open || !editing || licenseClassOptions.length === 0) return;

    const supported = new Set(licenseClassOptions.map((option) => option.value));
    const selected = selectedLicenseClassCodes ?? [];
    if (selected.length > 0 && selected.every((value) => supported.has(value))) {
      return;
    }

    const activeSelected = selected.filter((value) => supported.has(value));
    setValue(
      "licenseClassCodes",
      activeSelected.length > 0 ? activeSelected : [licenseClassOptions[0].value],
      {
        shouldDirty: false,
        shouldValidate: true,
      }
    );
  }, [editing, licenseClassOptions, open, selectedLicenseClassCodes, setValue]);

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
      assignedVehicleId: editing?.assignedVehicleId ?? null,
      notes: values.notes.trim() || null,
      ...(editing ? { rowVersion: editing.rowVersion } : {}),
    };
    const createPayload: InstructorCreateRequest = {
      ...payload,
      initialAssignment: {
	        role: values.assignmentRole,
	        employmentType: values.assignmentEmploymentType,
	        branches: values.assignmentBranches,
	        licenseClassCodes: values.assignmentBranches.includes("practice")
	          ? values.assignmentLicenseClassCodes
	          : [],
        weeklyLessonHours: values.assignmentWeeklyLessonHours
          ? Number(values.assignmentWeeklyLessonHours)
          : null,
        mebPermitNo: values.assignmentMebPermitNo.trim() || null,
        contractStartDate: values.assignmentContractStartDate,
        contractEndDate: values.assignmentContractEndDate || null,
      },
    };

    try {
      const saved = editing
        ? await updateInstructor(editing.id, payload)
        : await createInstructor(createPayload);
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
      title={editing ? "Ekip Üyesini Düzenle" : "Yeni Ekip Üyesi"}
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
            <input
              className={fieldClass(errors.phoneNumber?.message)}
              placeholder="0532 123 45 67"
              {...register("phoneNumber")}
            />
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

        {!editing ? (
          <section className="form-subsection">
            <div className="form-subsection-header">
              <div>
                <div className="form-subsection-title">İlk Atama</div>
                <div className="form-subsection-note">
                  Ekip üyesi kaydı için ilk atama bilgileri zorunludur.
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Görev</label>
                <CustomSelect className="form-select" {...register("assignmentRole")}>
                  {INSTRUCTOR_ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </CustomSelect>
              </div>
              <div className="form-group">
                <label className="form-label">Çalışma Tipi</label>
                <CustomSelect className="form-select" {...register("assignmentEmploymentType")}>
                  {INSTRUCTOR_EMPLOYMENT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </CustomSelect>
              </div>
            </div>

            <div className="form-row">
	              <div className="form-group">
	                <label className="form-label">Branşlar</label>
	                <Controller
	                  control={control}
	                  name="assignmentBranches"
                    rules={{ validate: (value) => value.length > 0 || "En az bir branş seçilmeli" }}
	                  render={({ field }) => {
	                    const values = field.value ?? [];
	                    return (
	                      <div className="settings-checkbox-list">
	                        {branches.map((branch) => (
	                          <label className="switch-toggle" key={branch.id}>
	                            <input
	                              checked={values.includes(branch.code)}
	                              onChange={(event) =>
	                                field.onChange(toggleValue(values, branch.code, event.target.checked))
	                              }
	                              type="checkbox"
	                            />
	                            <span className="switch-toggle-control" aria-hidden="true" />
	                            <span>{branch.name}</span>
	                          </label>
	                        ))}
	                      </div>
	                    );
	                  }}
	                />
                  {errors.assignmentBranches && (
                    <div className="form-error">{errors.assignmentBranches.message}</div>
                  )}
	              </div>
              <div className="form-group">
                <label className="form-label">Haftalık Ders Saati</label>
                <input
                  className="form-input"
                  inputMode="numeric"
                  min={0}
                  type="number"
                  {...register("assignmentWeeklyLessonHours", {
                    validate: (value) => {
                      if (!value) return true;
                      const parsed = Number(value);
                      return (
                        (Number.isFinite(parsed) && parsed >= 0 && parsed <= 80) ||
                        "0 ile 80 arasında olmalı"
                      );
                    },
                  })}
                />
                {errors.assignmentWeeklyLessonHours && (
                  <div className="form-error">{errors.assignmentWeeklyLessonHours.message}</div>
                )}
              </div>
	            </div>

	            {selectedAssignmentBranches.includes("practice") ? (
	              <div className="form-row">
	                <div className="form-group">
	                  <label className="form-label">Atama Ehliyet Tipleri</label>
	                  <Controller
	                    control={control}
	                    name="assignmentLicenseClassCodes"
	                    rules={{
	                      validate: (value) =>
	                        !watch("assignmentBranches").includes("practice") ||
	                        value.length > 0 ||
	                        "En az bir ehliyet sınıfı seçilmeli",
	                    }}
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
	                  {errors.assignmentLicenseClassCodes && (
	                    <div className="form-error">{errors.assignmentLicenseClassCodes.message}</div>
	                  )}
	                </div>
	              </div>
	            ) : null}

	            <div className="form-row">
              <div className="form-group">
                <label className="form-label">MEBBİS İzin No</label>
                <input className="form-input" {...register("assignmentMebPermitNo")} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Sözleşme Başlangıç</label>
                <Controller
                  control={control}
                  name="assignmentContractStartDate"
                  rules={{ required: "Başlangıç tarihi zorunlu" }}
                  render={({ field }) => (
                    <LocalizedDateInput
                      ariaLabel="Sözleşme Başlangıç"
                      className={fieldClass(errors.assignmentContractStartDate?.message)}
                      lang="tr"
                      onChange={field.onChange}
                      value={field.value}
                    />
                  )}
                />
                {errors.assignmentContractStartDate && (
                  <div className="form-error">{errors.assignmentContractStartDate.message}</div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Sözleşme Bitiş</label>
                <Controller
                  control={control}
                  name="assignmentContractEndDate"
                  render={({ field }) => (
                    <LocalizedDateInput
                      ariaLabel="Sözleşme Bitiş"
                      className="form-input"
                      lang="tr"
                      onChange={field.onChange}
                      value={field.value}
                    />
                  )}
                />
              </div>
            </div>
          </section>
        ) : null}
      </form>
    </Modal>
  );
}
