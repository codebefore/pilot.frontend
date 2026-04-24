import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { createVehicle, updateVehicle } from "../../lib/vehicles-api";
import {
  VEHICLE_FUEL_OPTIONS,
  VEHICLE_ODOMETER_UNIT_OPTIONS,
  VEHICLE_OWNERSHIP_OPTIONS,
  VEHICLE_STATUS_OPTIONS,
  VEHICLE_TRANSMISSION_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
} from "../../lib/vehicle-catalog";
import { ApiError, type ApiValidationError } from "../../lib/http";
import { useT, type TranslationKey } from "../../lib/i18n";
import type { VehicleResponse, VehicleUpsertRequest } from "../../lib/types";
import { useLicenseClassOptions } from "../../lib/use-license-class-options";
import { CustomSelect } from "../ui/CustomSelect";
import { LocalizedDateInput } from "../ui/LocalizedDateInput";
import { Modal } from "../ui/Modal";
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
  licenseClass: VehicleUpsertRequest["licenseClass"];
  ownershipType: VehicleUpsertRequest["ownershipType"];
  fuelType: VehicleUpsertRequest["fuelType"] | "";
  odometerValue: string;
  odometerUnit: VehicleUpsertRequest["odometerUnit"];
  notes: string;
};

function normalizeUppercase(value: string): string {
  return value.toUpperCase();
}

type VehicleFormModalProps = {
  open: boolean;
  editing: VehicleResponse | null;
  onClose: () => void;
  onSaved: (saved: VehicleResponse) => void;
  /**
   * Invoked when the server reports a 409 concurrency conflict (someone else
   * updated the record). The parent typically closes the modal, shows a
   * toast, and refetches the list so the user can retry against fresh data.
   */
  onConcurrencyConflict?: () => void;
};

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
  licenseClass: "licenseClass",
  LicenseClass: "licenseClass",
  ownershipType: "ownershipType",
  OwnershipType: "ownershipType",
  fuelType: "fuelType",
  FuelType: "fuelType",
  odometerValue: "odometerValue",
  OdometerValue: "odometerValue",
  odometerUnit: "odometerUnit",
  OdometerUnit: "odometerUnit",
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
        licenseClass: editing.licenseClass,
        ownershipType: editing.ownershipType,
        fuelType: editing.fuelType ?? "",
        odometerValue:
          editing.odometerValue !== null && editing.odometerValue !== undefined
            ? String(editing.odometerValue)
            : "",
        odometerUnit: editing.odometerUnit,
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
        licenseClass: "B",
        ownershipType: "owned",
        fuelType: "diesel",
        odometerValue: "",
        odometerUnit: "km",
        notes: "",
      };
}

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

const CONCURRENCY_CODE = "vehicle.validation.concurrencyConflict";

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
  setError: (field: keyof VehicleFormValues, error: { message: string }) => void,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): { appliedFieldError: boolean; unmappedMessage: string | null } {
  const codes = error.validationErrorCodes;
  const fallback = error.validationErrors;
  let appliedFieldError = false;
  let unmappedMessage: string | null = null;

  // Prefer structured codes when the server provided them: they translate and
  // interpolate {min}/{max}/{values} cleanly. Fall back to the plain-text
  // `errors` map only for fields the server didn't annotate with a code.
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
      // Only use the plain text when the structured map didn't already cover
      // the field — otherwise we would overwrite a translated message.
      if (codes && codes[serverField]?.length) continue;
      setError(formField, { message: messages[0] });
      appliedFieldError = true;
    }
  }

  return { appliedFieldError, unmappedMessage };
}

export function VehicleFormModal({
  open,
  editing,
  onClose,
  onSaved,
  onConcurrencyConflict,
}: VehicleFormModalProps) {
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
  } = useForm<VehicleFormValues>({
    defaultValues: getEmptyValues(editing),
  });
  const selectedLicenseClass = watch("licenseClass");

  useEffect(() => {
    if (!open) return;
    reset(getEmptyValues(editing));
  }, [editing, open, reset]);

  useEffect(() => {
    if (!open || licenseClassOptions.length === 0) return;
    if (licenseClassOptions.some((option) => option.value === selectedLicenseClass)) {
      return;
    }

    setValue("licenseClass", licenseClassOptions[0].value, {
      shouldDirty: false,
      shouldValidate: true,
    });
  }, [licenseClassOptions, open, selectedLicenseClass, setValue]);

  const submit = handleSubmit(async (values) => {
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
      licenseClass: values.licenseClass,
      ownershipType: values.ownershipType,
      fuelType: values.fuelType || null,
      odometerValue: parseOptionalNumber(values.odometerValue),
      odometerUnit: values.odometerUnit,
      notes: values.notes.trim() || null,
      ...(editing ? { rowVersion: editing.rowVersion } : {}),
    };

    try {
      const saved = editing
        ? await updateVehicle(editing.id, payload)
        : await createVehicle(payload);
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
        const { appliedFieldError, unmappedMessage } = applyServerFieldErrors(error, setError, t);
        if (unmappedMessage) {
          showToast(unmappedMessage, "error");
        } else if (!appliedFieldError) {
          showToast(t("vehicle.validation.generic"), "error");
        }
      } else {
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
            İptal
          </button>
          <button className="btn btn-primary" disabled={submitting} onClick={submit} type="button">
            {submitting ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title={editing ? "Araç Düzenle" : "Yeni Araç"}
    >
      <form className="settings-form" onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Plaka</label>
            <Controller
              control={control}
              name="plateNumber"
              rules={{ required: "Plaka zorunlu" }}
              render={({ field }) => (
                <input
                  {...field}
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
            <label className="form-label">Marka</label>
            <Controller
              control={control}
              name="brand"
              rules={{ required: "Marka zorunlu" }}
              render={({ field }) => (
                <input
                  {...field}
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
            <label className="form-label">Model</label>
            <Controller
              control={control}
              name="model"
              render={({ field }) => (
                <input
                  {...field}
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
            <label className="form-label">Model Yılı</label>
            <Controller
              control={control}
              name="modelYear"
              render={({ field }) => (
                <LocalizedDateInput
                  ariaLabel="Model Yılı"
                  className={fieldClass(errors.modelYear?.message)}
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
            <label className="form-label">Araç Türü</label>
            <Controller
              control={control}
              name="vehicleType"
              render={({ field }) => (
                <CustomSelect className={selectClass(errors.vehicleType?.message)} {...field}>
                  {VEHICLE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </CustomSelect>
              )}
            />
            {errors.vehicleType && <div className="form-error">{errors.vehicleType.message}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Belge Türü</label>
            <Controller
              control={control}
              name="licenseClass"
              render={({ field }) => (
                <CustomSelect className={selectClass(errors.licenseClass?.message)} {...field}>
                  {licenseClassOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </CustomSelect>
              )}
            />
            {errors.licenseClass && <div className="form-error">{errors.licenseClass.message}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Vites</label>
            <Controller
              control={control}
              name="transmissionType"
              render={({ field }) => (
                <CustomSelect
                  className={selectClass(errors.transmissionType?.message)}
                  {...field}
                >
                  {VEHICLE_TRANSMISSION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </CustomSelect>
              )}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Araç Durumu</label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <CustomSelect className={selectClass(errors.status?.message)} {...field}>
                  {VEHICLE_STATUS_OPTIONS.map((option) => (
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
            <label className="form-label">Sahiplik</label>
            <Controller
              control={control}
              name="ownershipType"
              render={({ field }) => (
                <CustomSelect className={selectClass(errors.ownershipType?.message)} {...field}>
                  {VEHICLE_OWNERSHIP_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </CustomSelect>
              )}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Yakıt</label>
            <Controller
              control={control}
              name="fuelType"
              render={({ field }) => (
                <CustomSelect
                  className={selectClass(errors.fuelType?.message)}
                  {...field}
                  value={field.value ?? ""}
                >
                  <option value="">Seçiniz</option>
                  {VEHICLE_FUEL_OPTIONS.map((option) => (
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
            <label className="form-label">Renk</label>
            <input className={fieldClass(errors.color?.message)} placeholder="Beyaz" {...register("color")} />
          </div>

          <div className="form-group">
            <label className="form-label">Genel Durum</label>
            <label className="switch-toggle">
              <input type="checkbox" {...register("isActive")} />
              <span className="switch-toggle-control" aria-hidden="true" />
              <span>{watch("isActive") ? "Aktif" : "Pasif"}</span>
            </label>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Toplam KM / Saat</label>
            <input
              className={fieldClass(errors.odometerValue?.message)}
              inputMode="numeric"
              placeholder="12000"
              type="number"
              {...register("odometerValue")}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Ölçü Birimi</label>
            <Controller
              control={control}
              name="odometerUnit"
              render={({ field }) => (
                <CustomSelect className={selectClass(errors.odometerUnit?.message)} {...field}>
                  {VEHICLE_ODOMETER_UNIT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </CustomSelect>
              )}
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
