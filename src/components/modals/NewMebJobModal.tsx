import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Modal } from "../ui/Modal";
import { CustomSelect } from "../ui/CustomSelect";

type NewMebJobForm = {
  jobType: string;
  scope: "single" | "group";
  target: string;
};

type NewMebJobModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

const JOB_TYPES = [
  "MEBBIS Aday Kaydı",
  "MEBBIS Belge Gönderimi",
  "MEBBIS Grup Oluşturma",
  "MEBBIS Dönem Kapanışı",
  "MEBBIS Fatura Kaydı",
];

const TARGETS = [
  "Ahmet Yılmaz",
  "Emre Şahin",
  "Fatma Demir",
  "B Sınıfı — NİSAN 2026 (tüm grup)",
];

const DEFAULT_VALUES: NewMebJobForm = {
  jobType: JOB_TYPES[0],
  scope: "single",
  target: TARGETS[0],
};

export function NewMebJobModal({ open, onClose, onSubmit }: NewMebJobModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewMebJobForm>({ defaultValues: DEFAULT_VALUES });

  useEffect(() => {
    if (!open) reset(DEFAULT_VALUES);
  }, [open, reset]);

  const submit = handleSubmit(() => onSubmit());

  const fieldClass = (hasError: boolean, base: "form-input" | "form-select") =>
    hasError ? `${base} error` : base;

  return (
    <Modal
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} type="button">
            İptal
          </button>
          <button className="btn btn-primary" onClick={submit} type="button">
            İşi Başlat
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title="Yeni MEB İşi"
    >
      <form onSubmit={submit}>
        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">İş Tipi</label>
            <CustomSelect
              className={fieldClass(!!errors.jobType, "form-select")}
              {...register("jobType", { required: "İş tipi seçin" })}
            >
              {JOB_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </CustomSelect>
            {errors.jobType && <div className="form-error">{errors.jobType.message}</div>}
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Kapsam</label>
            <CustomSelect className="form-select" {...register("scope", { required: true })}>
              <option value="single">Tek Aday</option>
              <option value="group">Grup (Toplu)</option>
            </CustomSelect>
          </div>
          <div className="form-group">
            <label className="form-label">Aday / Grup</label>
            <CustomSelect
              className={fieldClass(!!errors.target, "form-select")}
              {...register("target", { required: "Hedef seçin" })}
            >
              {TARGETS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </CustomSelect>
            {errors.target && <div className="form-error">{errors.target.message}</div>}
          </div>
        </div>
        <div className="info-box">
          <span className="info-icon">i</span>
          <span>
            İş arka planda çalışacak. Sonucu MEB İşleri sayfasından takip edebilirsiniz.
            Hata durumunda otomatik bildirim alırsınız.
          </span>
        </div>
      </form>
    </Modal>
  );
}
