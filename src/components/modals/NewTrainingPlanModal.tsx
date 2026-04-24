import { useEffect } from "react";
import { useForm } from "react-hook-form";

import type { LicenseClass } from "../../lib/types";
import { useLicenseClassOptions } from "../../lib/use-license-class-options";
import { Modal } from "../ui/Modal";
import { CustomSelect } from "../ui/CustomSelect";

type PlanType = "teorik" | "uygulama";

type NewTrainingPlanForm = {
  type: PlanType;
  className: LicenseClass;
  instructor: string;
  vehicle: string;
  totalHours: number;
};

type NewTrainingPlanModalProps = {
  open: boolean;
  defaultType?: PlanType;
  onClose: () => void;
  onSubmit: () => void;
};

const buildDefaultValues = (type: PlanType): NewTrainingPlanForm => ({
  type,
  className: "B",
  instructor: "",
  vehicle: "",
  totalHours: 32,
});

export function NewTrainingPlanModal({
  open,
  defaultType = "teorik",
  onClose,
  onSubmit,
}: NewTrainingPlanModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NewTrainingPlanForm>({ defaultValues: buildDefaultValues(defaultType) });
  const { options: licenseClassOptions } = useLicenseClassOptions();

  useEffect(() => {
    if (!open) reset(buildDefaultValues(defaultType));
  }, [defaultType, open, reset]);

  const selectedClass = watch("className");
  useEffect(() => {
    if (!open || licenseClassOptions.length === 0) return;
    if (licenseClassOptions.some((option) => option.value === selectedClass)) {
      return;
    }

    setValue("className", licenseClassOptions[0].value, {
      shouldDirty: false,
      shouldValidate: true,
    });
  }, [licenseClassOptions, open, selectedClass, setValue]);

  const submit = handleSubmit(() => onSubmit());

  const fieldClass = (hasError: boolean, base: "form-input" | "form-select") =>
    hasError ? `${base} error` : base;

  const type = watch("type");
  const needsVehicle = type === "uygulama";

  return (
    <Modal
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} type="button">
            İptal
          </button>
          <button className="btn btn-primary" onClick={submit} type="button">
            Kaydet
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title="Yeni Eğitim Planı"
    >
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Plan Tipi</label>
            <CustomSelect className="form-select" {...register("type", { required: true })}>
              <option value="teorik">Teorik</option>
              <option value="uygulama">Uygulama</option>
            </CustomSelect>
          </div>
          <div className="form-group">
            <label className="form-label">Sınıf</label>
            <CustomSelect className="form-select" {...register("className", { required: true })}>
              {licenseClassOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </CustomSelect>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Eğitmen</label>
            <input
              className={fieldClass(!!errors.instructor, "form-input")}
              placeholder="Ad Soyad"
              {...register("instructor", {
                required: "Zorunlu alan",
                minLength: { value: 3, message: "En az 3 karakter" },
              })}
            />
            {errors.instructor && (
              <div className="form-error">{errors.instructor.message}</div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Toplam Saat</label>
            <input
              className={fieldClass(!!errors.totalHours, "form-input")}
              inputMode="numeric"
              type="number"
              {...register("totalHours", {
                required: "Zorunlu alan",
                valueAsNumber: true,
                min: { value: 1, message: "En az 1 saat" },
                max: { value: 200, message: "En fazla 200 saat" },
              })}
            />
            {errors.totalHours && (
              <div className="form-error">{errors.totalHours.message}</div>
            )}
          </div>
        </div>

        {needsVehicle && (
          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Araç</label>
              <input
                className={fieldClass(!!errors.vehicle, "form-input")}
                placeholder="34 ABC 123 — Fiat Egea"
                {...register("vehicle", {
                  required: needsVehicle ? "Uygulama için araç zorunlu" : false,
                })}
              />
              {errors.vehicle && (
                <div className="form-error">{errors.vehicle.message}</div>
              )}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
