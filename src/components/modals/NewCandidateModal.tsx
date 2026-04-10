import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Modal } from "../ui/Modal";

type NewCandidateForm = {
  tc: string;
  className: "B" | "A2" | "C" | "D" | "E";
  firstName: string;
  lastName: string;
  birthDate: string;
  phone: string;
  email: string;
  group: string;
  fee: number;
};

type NewCandidateModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

function seventeenYearsAgoISO(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 17);
  return d.toISOString().slice(0, 10);
}

function yearsSince(iso: string): number {
  const birth = new Date(iso);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years--;
  return years;
}

const defaultValues = (): NewCandidateForm => ({
  tc: "",
  className: "B",
  firstName: "",
  lastName: "",
  birthDate: seventeenYearsAgoISO(),
  phone: "",
  email: "",
  group: "Nisan",
  fee: 4800,
});

export function NewCandidateModal({ open, onClose, onSubmit }: NewCandidateModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewCandidateForm>({ defaultValues: defaultValues() });

  useEffect(() => {
    if (!open) reset(defaultValues());
  }, [open, reset]);

  const submit = handleSubmit(() => {
    onSubmit();
  });

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
            Kaydet
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title="Yeni Aday Kaydı"
    >
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">TC Kimlik No</label>
            <input
              className={fieldClass(!!errors.tc, "form-input")}
              inputMode="numeric"
              maxLength={11}
              placeholder="11 haneli TC"
              {...register("tc", {
                required: "Zorunlu alan",
                pattern: { value: /^\d{11}$/, message: "11 haneli rakam olmalı" },
              })}
            />
            {errors.tc && <div className="form-error">{errors.tc.message}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Sınıf</label>
            <select
              className={fieldClass(!!errors.className, "form-select")}
              {...register("className", { required: true })}
            >
              <option value="B">B — Otomobil</option>
              <option value="A2">A2 — Motosiklet</option>
              <option value="C">C — Kamyon</option>
              <option value="D">D — Otobüs</option>
              <option value="E">E — Dorseli</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Ad</label>
            <input
              className={fieldClass(!!errors.firstName, "form-input")}
              placeholder="Adı"
              {...register("firstName", {
                required: "Zorunlu alan",
                minLength: { value: 2, message: "En az 2 karakter" },
              })}
            />
            {errors.firstName && <div className="form-error">{errors.firstName.message}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Soyad</label>
            <input
              className={fieldClass(!!errors.lastName, "form-input")}
              placeholder="Soyadı"
              {...register("lastName", {
                required: "Zorunlu alan",
                minLength: { value: 2, message: "En az 2 karakter" },
              })}
            />
            {errors.lastName && <div className="form-error">{errors.lastName.message}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Doğum Tarihi</label>
            <input
              className={fieldClass(!!errors.birthDate, "form-input")}
              type="date"
              {...register("birthDate", {
                required: "Zorunlu alan",
                validate: (v) => {
                  const age = yearsSince(v);
                  if (age < 17) return "En az 17 yaşında olmalı";
                  if (age > 80) return "Geçerli bir tarih girin";
                  return true;
                },
              })}
            />
            {errors.birthDate && <div className="form-error">{errors.birthDate.message}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Telefon</label>
            <input
              className={fieldClass(!!errors.phone, "form-input")}
              inputMode="numeric"
              maxLength={10}
              placeholder="5XXXXXXXXX"
              {...register("phone", {
                required: "Zorunlu alan",
                pattern: {
                  value: /^5\d{9}$/,
                  message: "10 hane, 5 ile başlamalı (başında 0 yok)",
                },
              })}
            />
            {errors.phone && <div className="form-error">{errors.phone.message}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">E-posta</label>
            <input
              className={fieldClass(!!errors.email, "form-input")}
              placeholder="aday@mail.com"
              type="email"
              {...register("email", {
                required: "Zorunlu alan",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Geçersiz e-posta",
                },
              })}
            />
            {errors.email && <div className="form-error">{errors.email.message}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Grup</label>
            <select className="form-select" {...register("group")}>
              <option value="Nisan">B Sınıfı — Nisan 2026</option>
              <option value="A2-Nisan">A2 Sınıfı — Nisan 2026</option>
              <option value="none">Atanmamış</option>
            </select>
          </div>
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">Ücret (TL)</label>
            <input
              className={fieldClass(!!errors.fee, "form-input")}
              type="number"
              {...register("fee", {
                required: "Zorunlu alan",
                valueAsNumber: true,
                min: { value: 1, message: "Pozitif bir değer girin" },
              })}
            />
            {errors.fee && <div className="form-error">{errors.fee.message}</div>}
          </div>
        </div>
      </form>
    </Modal>
  );
}
