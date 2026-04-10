import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Modal } from "../ui/Modal";
import { mockCandidates } from "../../mock/candidates";

type PaymentMethodKey = "Nakit" | "Havale" | "KrediKarti";

type NewPaymentForm = {
  candidateId: string;
  amount: number;
  method: PaymentMethodKey;
  date: string;
  note: string;
};

type NewPaymentModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

const debtors = mockCandidates.filter((c) => c.balance < 0);

const todayISO = () => new Date().toISOString().slice(0, 10);

const defaultValues = (): NewPaymentForm => ({
  candidateId: debtors[0]?.id ?? "",
  amount: 2400,
  method: "Nakit",
  date: todayISO(),
  note: "",
});

export function NewPaymentModal({ open, onClose, onSubmit }: NewPaymentModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewPaymentForm>({ defaultValues: defaultValues() });

  useEffect(() => {
    if (!open) reset(defaultValues());
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
            Kaydet & Makbuz Kes
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title="Tahsilat Girişi"
    >
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Aday</label>
            <select
              className={fieldClass(!!errors.candidateId, "form-select")}
              {...register("candidateId", { required: "Aday seçin" })}
            >
              {debtors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} — Bakiye: {c.balance.toLocaleString("tr-TR")} TL
                </option>
              ))}
            </select>
            {errors.candidateId && (
              <div className="form-error">{errors.candidateId.message}</div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Tutar (TL)</label>
            <input
              className={fieldClass(!!errors.amount, "form-input")}
              type="number"
              {...register("amount", {
                required: "Zorunlu alan",
                valueAsNumber: true,
                min: { value: 1, message: "Pozitif bir değer girin" },
              })}
            />
            {errors.amount && <div className="form-error">{errors.amount.message}</div>}
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Ödeme Tipi</label>
            <select className="form-select" {...register("method", { required: true })}>
              <option value="Nakit">Nakit</option>
              <option value="Havale">Havale / EFT</option>
              <option value="KrediKarti">Kredi Kartı</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Tarih</label>
            <input
              className={fieldClass(!!errors.date, "form-input")}
              type="date"
              {...register("date", {
                required: "Zorunlu alan",
                validate: (v) => {
                  const diff = (new Date(v).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
                  if (diff > 1) return "Gelecek tarih olamaz";
                  return true;
                },
              })}
            />
            {errors.date && <div className="form-error">{errors.date.message}</div>}
          </div>
        </div>
        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">Not</label>
            <textarea
              className="form-input"
              placeholder="Ödeme notu (opsiyonel)"
              rows={3}
              {...register("note")}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
