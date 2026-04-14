import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { createTerm } from "../../lib/terms-api";
import { useT } from "../../lib/i18n";
import type { TermResponse } from "../../lib/types";
import { useToast } from "../ui/Toast";
import { Modal } from "../ui/Modal";

type NewTermForm = {
  /** HTML `month` input value, e.g. "2026-04" */
  month: string;
  name: string;
};

type NewTermModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (term: TermResponse) => void;
};

function currentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

const defaultValues = (): NewTermForm => ({
  month: currentMonth(),
  name: "",
});

export function NewTermModal({ open, onClose, onCreated }: NewTermModalProps) {
  const t = useT();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewTermForm>({ defaultValues: defaultValues() });

  useEffect(() => {
    if (open) reset(defaultValues());
  }, [open, reset]);

  const submit = handleSubmit(async (data) => {
    setSubmitting(true);
    try {
      // HTML month input gives "YYYY-MM"; backend expects a full ISO date.
      const monthDate = `${data.month}-01`;
      const created = await createTerm({
        monthDate,
        name: data.name.trim() || null,
      });
      showToast(t("terms.created"));
      onCreated(created);
    } catch {
      showToast(t("terms.createFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  });

  const fieldClass = (hasError: boolean, base: "form-input" | "form-select") =>
    hasError ? `${base} error` : base;

  return (
    <Modal
      footer={
        <>
          <button
            className="btn btn-secondary"
            disabled={submitting}
            onClick={onClose}
            type="button"
          >
            {t("terms.form.cancel")}
          </button>
          <button
            className="btn btn-primary"
            disabled={submitting}
            onClick={submit}
            type="button"
          >
            {submitting ? t("terms.form.saving") : t("terms.form.save")}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title={t("terms.form.create")}
    >
      <form onSubmit={submit}>
        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">{t("terms.form.month")}</label>
            <input
              className={fieldClass(!!errors.month, "form-input")}
              type="month"
              {...register("month", {
                required: t("terms.form.monthRequired"),
              })}
            />
            {errors.month ? (
              <div className="form-error">{errors.month.message}</div>
            ) : (
              <div className="form-hint">{t("terms.form.monthHelp")}</div>
            )}
          </div>
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">{t("terms.form.name")}</label>
            <input
              className="form-input"
              placeholder={t("terms.form.namePlaceholder")}
              {...register("name")}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
