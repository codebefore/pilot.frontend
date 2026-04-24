import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { createVehicle, updateVehicle } from "../../lib/vehicles-api";
import {
  VEHICLE_FUEL_OPTIONS,
  VEHICLE_LICENSE_CLASS_OPTIONS,
  VEHICLE_ODOMETER_UNIT_OPTIONS,
  VEHICLE_OWNERSHIP_OPTIONS,
  VEHICLE_STATUS_OPTIONS,
  VEHICLE_TRANSMISSION_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
} from "../../lib/vehicle-catalog";
import { ApiError } from "../../lib/http";
import type { VehicleResponse, VehicleUpsertRequest } from "../../lib/types";
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

export function VehicleFormModal({
  open,
  editing,
  onClose,
  onSaved,
}: VehicleFormModalProps) {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
    watch,
  } = useForm<VehicleFormValues>({
    defaultValues: getEmptyValues(editing),
  });

  useEffect(() => {
    if (!open) return;
    reset(getEmptyValues(editing));
  }, [editing, open, reset]);

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
    };

    try {
      const saved = editing
        ? await updateVehicle(editing.id, payload)
        : await createVehicle(payload);
      onSaved(saved);
    } catch (error) {
      if (error instanceof ApiError && error.validationErrors) {
        for (const [serverField, messages] of Object.entries(error.validationErrors)) {
          const formField = VALIDATION_FIELD_MAP[serverField];
          if (formField && messages?.[0]) {
            setError(formField, { message: messages[0] });
          }
        }
      } else {
        showToast("Araç kaydı sırasında hata oluştu", "error");
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
                  {VEHICLE_LICENSE_CLASS_OPTIONS.map((option) => (
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
