import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";

import { createExamCode } from "../../lib/exam-codes-api";
import { ApiError } from "../../lib/http";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

type NewExamCodeForm = {
  code: string;
};

type NewExamCodeModalProps = {
  open: boolean;
  canManage?: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function NewExamCodeModal({
  open,
  canManage = true,
  onClose,
  onSaved,
}: NewExamCodeModalProps) {
  const { showToast } = useToast();
  const noPermissionTitle = "Yetkiniz yok.";
  const [submitting, setSubmitting] = useState(false);
  const inputId = useId();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NewExamCodeForm>({ defaultValues: { code: "" } });
  const code = watch("code");

  useEffect(() => {
    if (open) reset({ code: "" });
  }, [open, reset]);

  const submit = handleSubmit(async (data) => {
    if (!canManage) return;
    const cleaned = data.code.replace(/\D/g, "");
    if (cleaned.length !== 9) {
      setError("code", { message: "Sınav kodu 9 haneli olmalı." });
      return;
    }

    setSubmitting(true);
    try {
      await createExamCode({ examType: "uygulama", code: cleaned });
      showToast("Sınav kodu eklendi");
      onSaved();
    } catch (error) {
      if (error instanceof ApiError && error.validationErrors) {
        const codeError = error.validationErrors.code?.[0] ?? error.validationErrors.Code?.[0];
        if (codeError) setError("code", { message: codeError });
      }
      showToast("Sınav kodu eklenemedi", "error");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Modal
      footer={
        <>
          <button className="btn btn-secondary" disabled={submitting} onClick={onClose} type="button">
            İptal
          </button>
          <button
            className="btn btn-primary"
            disabled={submitting || !canManage}
            onClick={submit}
            title={!canManage ? noPermissionTitle : undefined}
            type="button"
          >
            {submitting ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title="Yeni Sınav Kodu"
    >
      <form onSubmit={submit}>
        <div className="form-row full">
          <div className="form-group">
            <label className="form-label" htmlFor={inputId}>
              Sınav Kodu
            </label>
            <input
              className={errors.code ? "form-input error" : "form-input"}
              disabled={!canManage}
              id={inputId}
              inputMode="numeric"
              maxLength={9}
              value={code}
              {...register("code", {
                required: "Sınav kodu zorunlu",
                minLength: { value: 9, message: "Sınav kodu 9 haneli olmalı." },
              })}
              onChange={(event) =>
                setValue("code", event.target.value.replace(/\D/g, "").slice(0, 9), {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
            {errors.code ? <div className="form-error">{errors.code.message}</div> : null}
          </div>
        </div>
      </form>
    </Modal>
  );
}
