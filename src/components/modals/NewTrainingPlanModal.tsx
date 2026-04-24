import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Modal } from "../ui/Modal";
import { CustomSelect } from "../ui/CustomSelect";

type PlanType = "teorik" | "uygulama";

type NewTrainingPlanForm = {
  type: PlanType;
  className: "B" | "A2" | "C" | "D" | "E";
  instructor: string;
  vehicle: string;
  totalHours: number;
};

type NewTrainingPlanModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

const DEFAULT_VALUES: NewTrainingPlanForm = {
  type: "teorik",
  className: "B",
  instructor: "",
  vehicle: "",
  totalHours: 32,
};

export function NewTrainingPlanModal({
  open,
  onClose,
  onSubmit,
}: NewTrainingPlanModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<NewTrainingPlanForm>({ defaultValues: DEFAULT_VALUES });

  useEffect(() => {
    if (!open) reset(DEFAULT_VALUES);
  }, [open, reset]);

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
              <option value="B">B — Otomobil</option>
              <option value="A2">A2 — Motosiklet</option>
              <option value="C">C — Kamyon</option>
              <option value="D">D — Otobüs</option>
              <option value="E">E — Dorseli</option>
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
