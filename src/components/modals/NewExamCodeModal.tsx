import { useEffect, useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { createExamCode } from "../../lib/exam-codes-api";
import { applyApiErrorsToForm } from "../../lib/form-errors";
import { candidateKeys } from "../../lib/queries/use-candidates";
import { Modal } from "../ui/Modal";
import { RequiredMark } from "../ui/RequiredMark";
import { useToast } from "../ui/Toast";
import { useT, type TranslationKey } from "../../lib/i18n";

const examCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "examCode.error.required")
    .max(15, "examCode.error.max15"),
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
  const queryClient = useQueryClient();
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

  const invalidateExamCodeDependents = () => {
    void queryClient.invalidateQueries({ queryKey: ["examCodes"] });
    void queryClient.invalidateQueries({
      queryKey: [...candidateKeys.all, "examScheduleOptions"],
    });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: candidateKeys.details() });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  useEffect(() => {
    if (open) reset({ code: "" });
  }, [open, reset]);

  const submit = handleSubmit(async (data) => {
    if (!canManage) return;
    setSubmitting(true);
    try {
      await createExamCode({ examType: "uygulama", code: data.code });
      invalidateExamCodeDependents();
      showToast(t("examCode.toast.added"));
      onSaved();
    } catch (error) {
      const { applied, unmappedMessages } = applyApiErrorsToForm(error, setError);
      if (unmappedMessages[0]) {
        showToast(unmappedMessages[0], "error");
      } else if (!applied) {
        showToast(t("examCode.toast.addFailed"), "error");
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
              {t("examCode.field.code")}<RequiredMark />
            </label>
            <input
              className={errors.code ? "form-input error" : "form-input"}
              disabled={!canManage}
              id={inputId}
              maxLength={15}
              value={code}
              {...register("code")}
              onChange={(event) =>
                setValue("code", event.target.value.slice(0, 15), {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
            {errors.code ? <div className="form-error">{errors.code.message?.includes(".") ? t(errors.code.message as TranslationKey) : errors.code.message}</div> : null}
          </div>
        </div>
      </form>
    </Modal>
  );
}
