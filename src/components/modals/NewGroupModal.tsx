import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { createGroup } from "../../lib/groups-api";
import type { LicenseClass } from "../../lib/types";
import { useToast } from "../ui/Toast";
import { Modal } from "../ui/Modal";

type NewGroupForm = {
  className: LicenseClass;
  term: string;
  capacity: number;
  startDate: string;
  endDate: string;
};

type NewGroupModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const defaultValues = (): NewGroupForm => ({
  className: "B",
  term: "",
  capacity: 20,
  startDate: todayISO(),
  endDate: plusDaysISO(60),
});

export function NewGroupModal({ open, onClose, onSubmit }: NewGroupModalProps) {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<NewGroupForm>({ defaultValues: defaultValues() });

  useEffect(() => {
    if (!open) reset(defaultValues());
  }, [open, reset]);

  const submit = handleSubmit(async (data) => {
    setSubmitting(true);
    try {
      await createGroup({
        title: `${data.className} Sinifi - ${data.term.trim()}`,
        status: "draft",
        licenseClass: data.className,
        termName: data.term,
        capacity: data.capacity,
        assignedCandidateCount: 0,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        mebStatus: null,
      });
      onSubmit();
    } catch {
      showToast("Grup oluşturulamadı. Lütfen tekrar deneyin.", "error");
    } finally {
      setSubmitting(false);
    }
  });

  const fieldClass = (hasError: boolean, base: "form-input" | "form-select") =>
    hasError ? `${base} error` : base;

  const startDate = watch("startDate");

  return (
    <Modal
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} type="button" disabled={submitting}>
            İptal
          </button>
          <button className="btn btn-primary" onClick={submit} type="button" disabled={submitting}>
            {submitting ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title="Yeni Grup"
    >
      <form onSubmit={submit}>
        <div className="form-row">
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
          <div className="form-group">
            <label className="form-label">Dönem</label>
            <input
              className={fieldClass(!!errors.term, "form-input")}
              placeholder="Nisan 2026"
              {...register("term", {
                required: "Zorunlu alan",
                minLength: { value: 3, message: "En az 3 karakter" },
              })}
            />
            {errors.term && <div className="form-error">{errors.term.message}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Kontenjan</label>
            <input
              className={fieldClass(!!errors.capacity, "form-input")}
              inputMode="numeric"
              type="number"
              {...register("capacity", {
                required: "Zorunlu alan",
                valueAsNumber: true,
                min: { value: 1, message: "En az 1" },
                max: { value: 50, message: "En fazla 50" },
              })}
            />
            {errors.capacity && <div className="form-error">{errors.capacity.message}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Başlangıç</label>
            <input
              className={fieldClass(!!errors.startDate, "form-input")}
              type="date"
              {...register("startDate", { required: "Zorunlu alan" })}
            />
            {errors.startDate && (
              <div className="form-error">{errors.startDate.message}</div>
            )}
          </div>
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">Bitiş</label>
            <input
              className={fieldClass(!!errors.endDate, "form-input")}
              type="date"
              {...register("endDate", {
                required: "Zorunlu alan",
                validate: (v) => {
                  if (startDate && v <= startDate) {
                    return "Bitiş, başlangıçtan sonra olmalı";
                  }
                  return true;
                },
              })}
            />
            {errors.endDate && (
              <div className="form-error">{errors.endDate.message}</div>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}
