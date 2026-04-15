import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Modal } from "../ui/Modal";
import { CustomSelect } from "../ui/CustomSelect";
import type { UserRole } from "../../mock/users";

type NewUserForm = {
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  tempPassword: string;
  sendInvite: boolean;
};

type NewUserModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

const ROLES: { key: UserRole; label: string }[] = [
  { key: "Patron",    label: "Patron" },
  { key: "Muhasebe",  label: "Muhasebe" },
  { key: "Operasyon", label: "Operasyon" },
  { key: "Eğitmen",   label: "Eğitmen" },
];

const DEFAULT_VALUES: NewUserForm = {
  fullName: "",
  email: "",
  phone: "",
  role: "Operasyon",
  tempPassword: "",
  sendInvite: true,
};

export function NewUserModal({ open, onClose, onSubmit }: NewUserModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewUserForm>({ defaultValues: DEFAULT_VALUES });

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
            Ekle
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title="Yeni Kullanıcı"
    >
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Ad Soyad</label>
            <input
              className={fieldClass(!!errors.fullName, "form-input")}
              placeholder="Ad Soyad"
              {...register("fullName", {
                required: "Zorunlu alan",
                minLength: { value: 3, message: "En az 3 karakter" },
              })}
            />
            {errors.fullName && (
              <div className="form-error">{errors.fullName.message}</div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Rol</label>
            <CustomSelect
              className={fieldClass(!!errors.role, "form-select")}
              {...register("role", { required: true })}
            >
              {ROLES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </CustomSelect>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">E-posta</label>
            <input
              className={fieldClass(!!errors.email, "form-input")}
              placeholder="kullanici@kurum.com"
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

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">Geçici Şifre</label>
            <input
              className={fieldClass(!!errors.tempPassword, "form-input")}
              placeholder="Boş bırakılırsa otomatik üretilir"
              type="password"
              {...register("tempPassword", {
                validate: (v) =>
                  !v || v.length >= 8 ||
                  "En az 8 karakter (boş bırakırsan otomatik üretilir)",
              })}
            />
            {errors.tempPassword && (
              <div className="form-error">{errors.tempPassword.message}</div>
            )}
            <div className="form-hint">
              Boş bırakılırsa sistem otomatik üretir ve e-posta ile gönderir.
            </div>
          </div>
        </div>

        <div className="form-row full">
          <label className="form-checkbox">
            <input type="checkbox" {...register("sendInvite")} />
            <span>E-posta ile davet gönder</span>
          </label>
        </div>
      </form>
    </Modal>
  );
}
