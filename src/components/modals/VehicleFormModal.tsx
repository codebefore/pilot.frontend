import { useEffect, useId, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { createVehicle, updateVehicle } from "../../lib/vehicles-api";
import {
  VEHICLE_FUEL_OPTIONS,
  VEHICLE_OWNERSHIP_OPTIONS,
  VEHICLE_STATUS_OPTIONS,
  VEHICLE_TRANSMISSION_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
} from "../../lib/vehicle-catalog";
import { ApiError, type ApiValidationError } from "../../lib/http";
import { useT, type TranslationKey } from "../../lib/i18n";
import { applyApiErrorsToForm } from "../../lib/form-errors";
import { candidateKeys } from "../../lib/queries/use-candidates";
import type { VehicleResponse, VehicleUpsertRequest } from "../../lib/types";
import {
  useLicenseClassOptions,
  type LicenseClassOption,
} from "../../lib/use-license-class-options";
import { CustomSelect } from "../ui/CustomSelect";
import { LocalizedDateInput } from "../ui/LocalizedDateInput";
import { Modal } from "../ui/Modal";
import { RequiredMark } from "../ui/RequiredMark";
import { useToast } from "../ui/Toast";

type VehicleFormValues = {
  plateNumber: string;
  brand: string;
  model: string;
  modelYear: string;
  color: string;
  status: VehicleUpsertRequest["status"];
  isActive: boolean;
  transmissionType: VehicleUpsertRequest["transmissionType"];
  vehicleType: VehicleUpsertRequest["vehicleType"];
  licenseClasses: VehicleUpsertRequest["licenseClasses"];
  ownershipType: VehicleUpsertRequest["ownershipType"];
  fuelType: VehicleUpsertRequest["fuelType"] | "";
  registrationDate: string;
  serviceStartDate: string;
  accidentNotes: string;
  otherDetails: string;
  notes: string;
};

function normalizeUppercase(value: string): string {
  return value.toUpperCase();
}

type VehicleFormModalProps = {
  open: boolean;
  editing: VehicleResponse | null;
  canManage?: boolean;
  onClose: () => void;
  onSaved: (saved: VehicleResponse) => void;
  /**
   * Invoked when the server reports a 409 concurrency conflict (someone else
   * updated the record). The parent typically closes the modal, shows a
   * toast, and refetches the list so the user can retry against fresh data.
   */
  onConcurrencyConflict?: () => void;
};

const vehicleFormSchema = z.object({
  plateNumber: z.string().min(1, "Plaka zorunlu"),
  brand: z.string().min(1, "Marka zorunlu"),
  model: z.string(),
  modelYear: z.string(),
  color: z.string(),
  status: z.string(),
  isActive: z.boolean(),
  transmissionType: z.string(),
  vehicleType: z.string(),
  licenseClasses: z.array(z.string()).min(1, "vehicleForm.error.licenseClassesMin"),
  ownershipType: z.string(),
  fuelType: z.string().nullable().optional(),
  registrationDate: z.string(),
  serviceStartDate: z.string(),
  accidentNotes: z.string(),
  otherDetails: z.string(),
  notes: z.string(),
});

const VALIDATION_FIELD_MAP: Record<string, keyof VehicleFormValues> = {
  plateNumber: "plateNumber",
  PlateNumber: "plateNumber",
  brand: "brand",
  Brand: "brand",
  model: "model",
  Model: "model",
  modelYear: "modelYear",
  ModelYear: "modelYear",
  color: "color",
  Color: "color",
  status: "status",
  Status: "status",
  transmissionType: "transmissionType",
  TransmissionType: "transmissionType",
  vehicleType: "vehicleType",
  VehicleType: "vehicleType",
  licenseClasses: "licenseClasses",
  LicenseClasses: "licenseClasses",
  ownershipType: "ownershipType",
  OwnershipType: "ownershipType",
  fuelType: "fuelType",
  FuelType: "fuelType",
  registrationDate: "registrationDate",
  RegistrationDate: "registrationDate",
  serviceStartDate: "serviceStartDate",
  ServiceStartDate: "serviceStartDate",
  accidentNotes: "accidentNotes",
  AccidentNotes: "accidentNotes",
  otherDetails: "otherDetails",
  OtherDetails: "otherDetails",
  notes: "notes",
  Notes: "notes",
};

function getEmptyValues(editing: VehicleResponse | null): VehicleFormValues {
  return editing
    ? {
        plateNumber: editing.plateNumber,
        brand: normalizeUppercase(editing.brand),
        model: editing.model ? normalizeUppercase(editing.model) : "",
        modelYear: editing.modelYear ? String(editing.modelYear) : "",
        color: editing.color ?? "",
        status: editing.status,
        isActive: editing.isActive,
        transmissionType: editing.transmissionType,
        vehicleType: editing.vehicleType,
        licenseClasses: editing.licenseClasses,
        ownershipType: editing.ownershipType,
        fuelType: editing.fuelType ?? "",
        registrationDate: editing.registrationDate ?? "",
        serviceStartDate: editing.serviceStartDate ?? "",
        accidentNotes: editing.accidentNotes ?? "",
        otherDetails: editing.otherDetails ?? "",
        notes: editing.notes ?? "",
      }
    : {
        plateNumber: "",
        brand: "",
        model: "",
        modelYear: "",
        color: "",
        status: "idle",
        isActive: true,
        transmissionType: "manual",
        vehicleType: "automobile",
        licenseClasses: ["B"],
        ownershipType: "owned",
        fuelType: "diesel",
        registrationDate: "",
        serviceStartDate: "",
        accidentNotes: "",
        otherDetails: "",
        notes: "",
      };
}

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function mergeSelectedLicenseOptions(
  options: LicenseClassOption[],
  selected: readonly string[]
): LicenseClassOption[] {
  const byValue = new Map(options.map((option) => [option.value, option]));
  for (const value of selected) {
    if (!value || byValue.has(value)) continue;
    byValue.set(value, { value, label: value });
  }
  return [...byValue.values()];
}

const CONCURRENCY_CODE = "vehicle.validation.concurrencyConflict";
const PLATE_CONFLICT_MESSAGE = "A vehicle with this plate already exists.";

function hasConcurrencyError(
  codes: Record<string, ApiValidationError[]> | undefined
): boolean {
  if (!codes) return false;
  return Object.values(codes).some((errors) =>
    errors.some((error) => error.code === CONCURRENCY_CODE)
  );
}

function translateVehicleValidationMessage(
  message: string,
  serverField: string,
  t: ReturnType<typeof useT>
): string {
  if (serverField === "PlateNumber" && message === PLATE_CONFLICT_MESSAGE) {
    return t("vehicle.validation.plateConflict");
  }

  return message;
}

export function VehicleFormModal({
  open,
  editing,
  canManage = true,
  onClose,
  onSaved,
  onConcurrencyConflict,
}: VehicleFormModalProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const t = useT();
  const noPermissionTitle = t("common.noPermission");
  const [submitting, setSubmitting] = useState(false);
  const { options: licenseClassOptions } = useLicenseClassOptions();
  const plateId = useId();
  const brandId = useId();
  const modelId = useId();
  const modelYearId = useId();
  const vehicleTypeId = useId();
  const transmissionId = useId();
  const statusId = useId();
  const ownershipId = useId();
  const fuelId = useId();
  const colorId = useId();
  const registrationDateId = useId();
  const serviceStartDateId = useId();
  const crashCountId = useId();
  const otherId = useId();
  const noteId = useId();

  const invalidateVehicleDependents = (vehicleId?: string) => {
    void queryClient.invalidateQueries({ queryKey: ["vehicles", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["vehicles", "detail"] });
    if (vehicleId) {
      void queryClient.invalidateQueries({ queryKey: ["vehicles", "detail", vehicleId] });
    }
    void queryClient.invalidateQueries({ queryKey: ["training", "vehicles"] });
    void queryClient.invalidateQueries({ queryKey: ["training", "lessons"] });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
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
    setValue,
    watch,
  } = useForm<VehicleFormValues>({
    defaultValues: getEmptyValues(editing),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(vehicleFormSchema) as any,
  });
  const selectedLicenseClasses = watch("licenseClasses");
  const visibleLicenseClassOptions = useMemo(
    () => mergeSelectedLicenseOptions(licenseClassOptions, selectedLicenseClasses ?? []),
    [licenseClassOptions, selectedLicenseClasses]
  );

  useEffect(() => {
    if (!open) return;
    reset(getEmptyValues(editing));
  }, [editing, open, reset]);

  useEffect(() => {
    if (!open || editing || licenseClassOptions.length === 0) return;
    const supported = new Set(licenseClassOptions.map((option) => option.value));
    const selected = selectedLicenseClasses ?? [];
    if (selected.length > 0 && selected.every((value) => supported.has(value))) {
      return;
    }
    const activeSelected = selected.filter((value) => supported.has(value));
    setValue(
      "licenseClasses",
      activeSelected.length > 0 ? activeSelected : [licenseClassOptions[0].value],
      { shouldDirty: false, shouldValidate: true },
    );
  }, [editing, licenseClassOptions, open, selectedLicenseClasses, setValue]);

  const submit = handleSubmit(async (values) => {
    if (!canManage) return;
    setSubmitting(true);

    const payload: VehicleUpsertRequest = {
      plateNumber: values.plateNumber.trim(),
      brand: normalizeUppercase(values.brand.trim()),
      model: values.model.trim() ? normalizeUppercase(values.model.trim()) : null,
      modelYear: parseOptionalNumber(values.modelYear),
      color: values.color.trim() || null,
      status: values.status,
      isActive: values.isActive,
      transmissionType: values.transmissionType,
      vehicleType: values.vehicleType,
      licenseClasses: values.licenseClasses,
      ownershipType: values.ownershipType,
      fuelType: values.fuelType || null,
      odometerValue: null,
      odometerUnit: "km",
      registrationDate: values.registrationDate || null,
      serviceStartDate: values.serviceStartDate || null,
      accidentNotes: values.accidentNotes.trim() || null,
      otherDetails: values.otherDetails.trim() || null,
      notes: values.notes.trim() || null,
      ...(editing ? { rowVersion: editing.rowVersion } : {}),
    };

    try {
      const saved = editing
        ? await updateVehicle(editing.id, payload)
        : await createVehicle(payload);
      invalidateVehicleDependents(saved.id);
      onSaved(saved);
    } catch (error) {
      if (error instanceof ApiError) {
        // 409 on the RowVersion field means a concurrent update. Surface it
        // through the dedicated callback so the parent can close the modal
        // and refetch — re-showing the form would just race again.
        if (error.status === 409 && hasConcurrencyError(error.validationErrorCodes)) {
          showToast(t("vehicle.validation.concurrencyConflict"), "error");
          onConcurrencyConflict?.();
          return;
        }
      }
      const { applied, unmappedMessages } = applyApiErrorsToForm(error, setError, {
        translateCode: (code, params) => t(code as TranslationKey, params),
        translateMessage: (message, serverField) =>
          translateVehicleValidationMessage(message, serverField, t),
        fieldMap: VALIDATION_FIELD_MAP as Record<string, import("react-hook-form").Path<VehicleFormValues>>,
      });
      if (unmappedMessages[0]) {
        showToast(unmappedMessages[0], "error");
      } else if (!applied) {
        showToast(t("vehicle.validation.generic"), "error");
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
      title={editing ? t("vehicleForm.modalTitleEdit") : t("vehicleForm.modalTitleNew")}
    >
      <form className="settings-form" onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor={plateId}>{t("vehicleForm.field.plate")}<RequiredMark /></label>
            <Controller
              control={control}
              name="plateNumber"
              render={({ field }) => (
                <input
                  {...field}
                  id={plateId}
                  autoCapitalize="characters"
                  className={fieldClass(errors.plateNumber?.message)}
                  placeholder="34 ABC 123"
                  value={field.value ?? ""}
                  onChange={(event) => {
                    field.onChange(event.target.value.toLocaleUpperCase("tr-TR"));
                  }}
                />
              )}
            />
            {errors.plateNumber && <div className="form-error">{errors.plateNumber.message}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor={brandId}>{t("vehicleForm.field.brand")}<RequiredMark /></label>
            <Controller
              control={control}
              name="brand"
              render={({ field }) => (
                <input
                  {...field}
                  id={brandId}
                  autoCapitalize="characters"
                  className={fieldClass(errors.brand?.message)}
                  placeholder="FIAT"
                  value={field.value ?? ""}
                  onChange={(event) => {
                    field.onChange(normalizeUppercase(event.target.value));
                  }}
                />
              )}
            />
            {errors.brand && <div className="form-error">{errors.brand.message}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor={modelId}>{t("vehicleForm.field.model")}</label>
            <Controller
              control={control}
              name="model"
              render={({ field }) => (
                <input
                  {...field}
                  id={modelId}
                  autoCapitalize="characters"
                  className={fieldClass(errors.model?.message)}
                  placeholder="EGEA"
                  value={field.value ?? ""}
                  onChange={(event) => {
                    field.onChange(normalizeUppercase(event.target.value));
                  }}
                />
              )}
            />
            {errors.model && <div className="form-error">{errors.model.message}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor={modelYearId}>{t("vehicleForm.field.modelYear")}</label>
            <Controller
              control={control}
              name="modelYear"
              render={({ field }) => (
                <LocalizedDateInput
                  ariaLabel={t("vehicleForm.aria.modelYear")}
                  className={fieldClass(errors.modelYear?.message)}
                  id={modelYearId}
                  mode="year"
                  onChange={(nextValue) => field.onChange(nextValue ? nextValue.slice(0, 4) : "")}
                  placeholder="yyyy"
                  value={field.value ? `${field.value}-01-01` : ""}
                />
              )}
            />
            {errors.modelYear && <div className="form-error">{errors.modelYear.message}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor={vehicleTypeId}>{t("common.field.vehicleType")}</label>
            <Controller
              control={control}
              name="vehicleType"
              render={({ field }) => (
                <CustomSelect id={vehicleTypeId} className={selectClass(errors.vehicleType?.message)} {...field}>
                  {VEHICLE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </option>
                  ))}
                </CustomSelect>
              )}
            />
            {errors.vehicleType && <div className="form-error">{errors.vehicleType.message}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">{t("common.field.licenseClasses")}<RequiredMark /></label>
            <Controller
              control={control}
              name="licenseClasses"
              render={({ field }) => {
                const values = field.value ?? [];
                const toggle = (option: string, checked: boolean) => {
                  if (checked) {
                    if (!values.includes(option as never)) {
                      field.onChange([...values, option]);
                    }
                  } else {
                    field.onChange(values.filter((v) => v !== option));
                  }
                };
                return (
                  <div className="settings-checkbox-list">
                    {visibleLicenseClassOptions.map((option) => (
                      <label className="switch-toggle" key={option.value}>
                        <input
                          checked={values.includes(option.value as never)}
                          onChange={(event) => toggle(option.value, event.target.checked)}
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
            {errors.licenseClasses && <div className="form-error">{(() => { const m = errors.licenseClasses?.message as string | undefined; return !m ? "" : m.includes(".") ? t(m as TranslationKey) : m; })()}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor={transmissionId}>{t("vehicleForm.field.transmission")}</label>
            <Controller
              control={control}
              name="transmissionType"
              render={({ field }) => (
                <CustomSelect
                  id={transmissionId}
                  className={selectClass(errors.transmissionType?.message)}
                  {...field}
                >
                  {VEHICLE_TRANSMISSION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </option>
                  ))}
                </CustomSelect>
              )}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor={statusId}>{t("vehicleForm.field.activity")}</label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <CustomSelect id={statusId} className={selectClass(errors.status?.message)} {...field}>
                  {VEHICLE_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </option>
                  ))}
                </CustomSelect>
              )}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor={ownershipId}>{t("vehicleForm.field.ownership")}</label>
            <Controller
              control={control}
              name="ownershipType"
              render={({ field }) => (
                <CustomSelect id={ownershipId} className={selectClass(errors.ownershipType?.message)} {...field}>
                  {VEHICLE_OWNERSHIP_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </option>
                  ))}
                </CustomSelect>
              )}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor={fuelId}>{t("vehicleForm.field.fuel")}</label>
            <Controller
              control={control}
              name="fuelType"
              render={({ field }) => (
                <CustomSelect
                  id={fuelId}
                  className={selectClass(errors.fuelType?.message)}
                  {...field}
                  value={field.value ?? ""}
                >
                  <option value="">{t("common.select")}</option>
                  {VEHICLE_FUEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </option>
                  ))}
                </CustomSelect>
              )}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor={colorId}>{t("common.field.color")}</label>
            <input id={colorId} className={fieldClass(errors.color?.message)} placeholder={t("vehicleForm.placeholder.color")} {...register("color")} />
          </div>

          <div className="form-group">
            <label className="form-label">{t("common.field.generalStatus")}</label>
            <label className="switch-toggle">
              <input type="checkbox" {...register("isActive")} />
              <span className="switch-toggle-control" aria-hidden="true" />
              <span>{watch("isActive") ? t("common.active") : t("common.inactive")}</span>
            </label>
          </div>
        </div>

        <details className="settings-form-details">
          <summary>{t("vehicleForm.detailsSummary")}</summary>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor={registrationDateId}>{t("vehicleForm.field.registrationDate")}</label>
              <Controller
                control={control}
                name="registrationDate"
                render={({ field }) => (
                  <LocalizedDateInput
                    ariaLabel={t("vehicleForm.aria.registrationDate")}
                    className={fieldClass(errors.registrationDate?.message)}
                    id={registrationDateId}
                    onChange={(nextValue) => field.onChange(nextValue ?? "")}
                    value={field.value}
                  />
                )}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor={serviceStartDateId}>{t("vehicleForm.field.serviceStartDate")}</label>
              <Controller
                control={control}
                name="serviceStartDate"
                render={({ field }) => (
                  <LocalizedDateInput
                    ariaLabel={t("vehicleForm.aria.serviceStartDate")}
                    className={fieldClass(errors.serviceStartDate?.message)}
                    id={serviceStartDateId}
                    onChange={(nextValue) => field.onChange(nextValue ?? "")}
                    value={field.value}
                  />
                )}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor={crashCountId}>{t("vehicleForm.field.crashCount")}</label>
              <textarea id={crashCountId} className="form-input" rows={3} {...register("accidentNotes")} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor={otherId}>{t("vehicleForm.field.other")}</label>
              <textarea id={otherId} className="form-input" rows={3} {...register("otherDetails")} />
            </div>
          </div>
        </details>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label" htmlFor={noteId}>{t("common.field.note")}</label>
            <textarea id={noteId} className="form-input" rows={4} {...register("notes")} />
          </div>
        </div>
      </form>
    </Modal>
  );
}
