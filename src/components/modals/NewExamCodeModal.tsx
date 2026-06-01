import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { createExamCode } from "../../lib/exam-codes-api";
import { applyApiErrorsToForm } from "../../lib/form-errors";
import { Modal } from "../ui/Modal";
import { RequiredMark } from "../ui/RequiredMark";
import { useToast } from "../ui/Toast";
import { useT } from "../../lib/i18n";

const examCodeSchema = z.object({
  code: z
    .string()
    .min(1, "Sınav kodu zorunlu")
    .regex(/^\d{9}$/, "Sınav kodu 9 haneli olmalı."),
});
type NewExamCodeForm = z.infer<typeof examCodeSchema>;

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
  const t = useT();
  const noPermissionTitle = t("common.noPermission");
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
  } = useForm<NewExamCodeForm>({
    defaultValues: { code: "" },
    resolver: zodResolver(examCodeSchema),
  });
  const code = watch("code");

  useEffect(() => {
    if (open) reset({ code: "" });
  }, [open, reset]);

  const submit = handleSubmit(async (data) => {
    if (!canManage) return;
    setSubmitting(true);
    try {
      await createExamCode({ examType: "uygulama", code: data.code });
      showToast("Sınav kodu eklendi");
      onSaved();
    } catch (error) {
      const { applied, unmappedMessages } = applyApiErrorsToForm(error, setError);
      if (unmappedMessages[0]) {
        showToast(unmappedMessages[0], "error");
      } else if (!applied) {
        showToast("Sınav kodu eklenemedi", "error");
      }
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Modal
      footer={
        <>
          <button className="btn btn-secondary" disabled={submitting} onClick={onClose} type="button">
            {t("common.cancel")}
          </button>
          <button
            className="btn btn-primary"
            disabled={submitting || !canManage}
            onClick={submit}
            title={!canManage ? noPermissionTitle : undefined}
            type="button"
          >
            {submitting ? t("common.saving") : t("common.save")}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title={t("newExamCode.modalTitle")}
    >
      <form onSubmit={submit}>
        <div className="form-row full">
          <div className="form-group">
            <label className="form-label" htmlFor={inputId}>
              Sınav Kodu<RequiredMark />
            </label>
            <input
              className={errors.code ? "form-input error" : "form-input"}
              disabled={!canManage}
              id={inputId}
              inputMode="numeric"
              maxLength={9}
              value={code}
              {...register("code")}
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
