import { useEffect, useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  createInstructor,
  deleteInstructorPhoto,
  updateInstructor,
  uploadInstructorPhoto,
} from "../../lib/instructors-api";
import { ApiError, type ApiValidationError } from "../../lib/http";
import { useT, type TranslationKey } from "../../lib/i18n";
import { applyApiErrorsToForm } from "../../lib/form-errors";
import { isPhoneStartingWith5 } from "../../lib/phone";
import type {
  InstructorCreateRequest,
  InstructorResponse,
  InstructorUpsertRequest,
  LicenseClass,
} from "../../lib/types";
import { useLicenseClassOptions } from "../../lib/use-license-class-options";
import { InstructorAvatar } from "../ui/InstructorAvatar";
import { Modal } from "../ui/Modal";
import { RequiredMark } from "../ui/RequiredMark";
import { useToast } from "../ui/Toast";

type InstructorFormValues = {
  firstName: string;
  lastName: string;
  nationalId: string;
  phoneNumber: string;
  email: string;
  isActive: boolean;
  licenseClassCodes: LicenseClass[];
  notes: string;
};

type InstructorFormModalProps = {
  open: boolean;
  editing: InstructorResponse | null;
  canManage?: boolean;
  onClose: () => void;
  onSaved: (saved: InstructorResponse) => void;
  onConcurrencyConflict?: () => void;
};

const instructorFormSchema = z.object({
  firstName: z.string().min(1, "instructorForm.error.firstNameRequired"),
  lastName: z.string().min(1, "instructorForm.error.lastNameRequired"),
  nationalId: z.string(),
  phoneNumber: z.string().refine(
    (value) => !value.trim() || isPhoneStartingWith5(value),
    "instructorForm.error.phoneStartWith5"
  ),
  email: z.string(),
  isActive: z.boolean(),
  licenseClassCodes: z.array(z.string()),
  notes: z.string(),
});

const VALIDATION_FIELD_MAP: Record<string, keyof InstructorFormValues> = {
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


function normalizeUppercase(value: string): string {
  return value.toLocaleUpperCase("tr-TR");
}

function getEmptyValues(editing: InstructorResponse | null): InstructorFormValues {
  return editing
    ? {
        firstName: editing.firstName,
        lastName: editing.lastName,
        nationalId: editing.nationalId ?? "",
        phoneNumber: editing.phoneNumber ?? "",
        email: editing.email ?? "",
        isActive: editing.isActive,
        licenseClassCodes: editing.licenseClassCodes,
        notes: editing.notes ?? "",
      }
    : {
        firstName: "",
        lastName: "",
        nationalId: "",
        phoneNumber: "",
        email: "",
        isActive: true,
        licenseClassCodes: ["B"],
        notes: "",
      };
}

export function InstructorFormModal({
  open,
  editing,
  canManage = true,
  onClose,
  onSaved,
  onConcurrencyConflict,
}: InstructorFormModalProps) {
  const { showToast } = useToast();
  const t = useT();
  const noPermissionTitle = t("common.noPermission");
  const translateError = (message: string | undefined): string =>
    !message ? "" : message.includes(".") ? t(message as TranslationKey) : message;
  const [submitting, setSubmitting] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoInstructor, setPhotoInstructor] = useState<InstructorResponse | null>(editing);
  const nationalIdInputId = useId();
  const firstNameId = useId();
  const lastNameInputId = useId();
  const phoneInputId = useId();
  const emailId = useId();
  const notesId = useId();
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
    resolver: zodResolver(instructorFormSchema),
  });
  const selectedLicenseClassCodes = watch("licenseClassCodes");
  const phoneNumberRegistration = register("phoneNumber");

  useEffect(() => {
    if (!open) return;
    reset(getEmptyValues(editing));
    setPhotoInstructor(editing);
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
    if (!canManage) return;
    setSubmitting(true);

    const payload: InstructorUpsertRequest = {
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
    const createPayload: InstructorCreateRequest = { ...payload };

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
      }
      const { applied, unmappedMessages } = applyApiErrorsToForm(error, setError, {
        translateCode: (code, params) => t(code as TranslationKey, params),
        fieldMap: VALIDATION_FIELD_MAP as Record<string, import("react-hook-form").Path<InstructorFormValues>>,
      });
      if (unmappedMessages[0]) {
        showToast(unmappedMessages[0], "error");
      } else if (!applied) {
        showToast(t("instructor.validation.generic"), "error");
      }
    } finally {
      setSubmitting(false);
    }
  });

  const fieldClass = (message?: string) => (message ? "form-input error" : "form-input");

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!canManage) return;
    if (!file || !photoInstructor) return;

    setPhotoBusy(true);
    try {
      const updated = await uploadInstructorPhoto(photoInstructor.id, file);
      setPhotoInstructor(updated);
      onSaved(updated);
    } catch {
      showToast(t("instructorForm.toast.photoUploadFailed"), "error");
    } finally {
      setPhotoBusy(false);
    }
  };

  const handlePhotoDelete = async () => {
    if (!canManage) return;
    if (!photoInstructor || !photoInstructor.hasPhoto) return;
    setPhotoBusy(true);
    try {
      const updated = await deleteInstructorPhoto(photoInstructor.id);
      setPhotoInstructor(updated);
      onSaved(updated);
    } catch {
      showToast("Resim silinemedi", "error");
    } finally {
      setPhotoBusy(false);
    }
  };

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
      title={editing ? t("instructorForm.modalTitleEdit") : t("instructorForm.modalTitleNew")}
    >
      <form className="settings-form" onSubmit={submit}>
        {!photoInstructor ? (
          <div className="instructor-photo-hint instructor-photo-hint--banner">
            Profil resmi kayıttan sonra eklenebilir.
          </div>
        ) : null}
        {photoInstructor ? (
          <div className="instructor-photo-row">
            <InstructorAvatar instructor={photoInstructor} size={72} />
            <div className="instructor-photo-actions">
              <label className="btn btn-secondary btn-sm">
                {photoBusy ? t("common.loading") : photoInstructor.hasPhoto ? t("instructorForm.action.changePhoto") : t("instructorForm.action.uploadPhoto")}
                <input
                  accept="image/jpeg,image/png,image/webp"
                  disabled={photoBusy || !canManage}
                  hidden
                  onChange={handlePhotoChange}
                  type="file"
                />
              </label>
              {photoInstructor.hasPhoto ? (
                <button
                  className="btn btn-link btn-sm btn-link-danger"
                  disabled={photoBusy || !canManage}
                  onClick={handlePhotoDelete}
                  title={!canManage ? noPermissionTitle : undefined}
                  type="button"
                >
                  Kaldır
                </button>
              ) : null}
              <div className="instructor-photo-hint">JPEG, PNG, WEBP — en fazla 5 MB</div>
            </div>
          </div>
        ) : null}

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor={nationalIdInputId}>{t("common.field.nationalId")}</label>
            <input
              id={nationalIdInputId}
              className={fieldClass(errors.nationalId?.message)}
              inputMode="numeric"
              maxLength={11}
              placeholder="11 haneli TC"
              {...register("nationalId")}
            />
            {errors.nationalId && <div className="form-error">{errors.nationalId.message}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor={firstNameId}>{t("common.field.firstName")}<RequiredMark /></label>
            <Controller
              control={control}
              name="firstName"
              render={({ field }) => (
                <input
                  {...field}
                  id={firstNameId}
                  autoCapitalize="characters"
                  className={fieldClass(errors.firstName?.message)}
                  placeholder="HASAN"
                  value={field.value ?? ""}
                  onChange={(event) => field.onChange(normalizeUppercase(event.target.value))}
                />
              )}
            />
            {errors.firstName && <div className="form-error">{translateError(errors.firstName.message)}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor={lastNameInputId}>{t("common.field.lastName")}<RequiredMark /></label>
            <Controller
              control={control}
              name="lastName"
              render={({ field }) => (
                <input
                  {...field}
                  id={lastNameInputId}
                  autoCapitalize="characters"
                  className={fieldClass(errors.lastName?.message)}
                  placeholder="KORKMAZ"
                  value={field.value ?? ""}
                  onChange={(event) => field.onChange(normalizeUppercase(event.target.value))}
                />
              )}
            />
            {errors.lastName && <div className="form-error">{translateError(errors.lastName.message)}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor={phoneInputId}>{t("common.field.phone")}</label>
            <input
              id={phoneInputId}
              className={fieldClass(errors.phoneNumber?.message)}
              inputMode="numeric"
              maxLength={32}
              placeholder="5XX XXX XX XX"
              {...phoneNumberRegistration}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor={emailId}>{t("common.field.email")}</label>
            <input
              id={emailId}
              className={fieldClass(errors.email?.message)}
              placeholder="egitmen@kurum.com"
              type="email"
              {...register("email")}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t("common.field.generalStatus")}</label>
            <label className="switch-toggle">
              <input type="checkbox" {...register("isActive")} />
              <span className="switch-toggle-control" aria-hidden="true" />
              <span>{watch("isActive") ? t("common.active") : t("common.inactive")}</span>
            </label>
          </div>
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label" htmlFor={notesId}>{t("common.field.note")}</label>
            <textarea id={notesId} className="form-input" rows={4} {...register("notes")} />
          </div>
        </div>

      </form>
    </Modal>
  );
}
