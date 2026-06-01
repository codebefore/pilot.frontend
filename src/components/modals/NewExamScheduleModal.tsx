import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { createExamSchedule } from "../../lib/exam-schedules-api";
import { useLanguage, useT } from "../../lib/i18n";
import { applyApiErrorsToForm } from "../../lib/form-errors";
import { LocalizedDateInput } from "../ui/LocalizedDateInput";
import { LocalizedTimeInput } from "../ui/LocalizedTimeInput";
import { Modal } from "../ui/Modal";
import { RequiredMark } from "../ui/RequiredMark";
import { useToast } from "../ui/Toast";
import type { ExamCodeOption } from "../../lib/types";

const newExamScheduleSchema = z.object({
  date: z.string().min(1, "Zorunlu alan"),
  examCodeId: z.string().min(1, "Sınav kodu zorunlu"),
  time: z.string().min(1, "Zorunlu alan"),
  capacity: z.number().min(1, "Kontenjan 1 veya daha buyuk olmali."),
});

type NewExamScheduleForm = z.infer<typeof newExamScheduleSchema>;

type NewExamScheduleModalProps = {
  canManage?: boolean;
  examType: "e_sinav" | "uygulama";
  examCodes?: ExamCodeOption[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultValues(): NewExamScheduleForm {
  return {
    date: todayISO(),
    examCodeId: "",
    time: "09:00",
    capacity: 20,
  };
}

function modalTitle(examType: "e_sinav" | "uygulama"): string {
  return examType === "e_sinav" ? "Yeni E-Sınav Tarihi" : "Yeni Direksiyon Tarihi";
}

export function NewExamScheduleModal({
  canManage = true,
  examType,
  examCodes = [],
  open,
  onClose,
  onSaved,
}: NewExamScheduleModalProps) {
  const { showToast } = useToast();
  const { lang } = useLanguage();
  const dateInputLang = lang === "tr" ? "tr-TR" : undefined;
  const t = useT();
  const noPermissionTitle = t("common.noPermission");
  const [submitting, setSubmitting] = useState(false);
  const capacityInputId = useId();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NewExamScheduleForm>({ defaultValues: defaultValues(), resolver: zodResolver(newExamScheduleSchema) });
  const date = watch("date");
  const examCodeId = watch("examCodeId");
  const time = watch("time");
  const showTimeField = examType === "e_sinav";
  const showExamCodeField = examType === "uygulama";
  const dateRegistration = register("date");
  const timeRegistration = register("time");

  useEffect(() => {
    if (open) {
      reset({
        ...defaultValues(),
        examCodeId: examCodes[0]?.id ?? "",
      });
    }
  }, [examCodes, open, reset]);

  const submit = handleSubmit(async (data) => {
    if (!canManage) return;
    setSubmitting(true);

    try {
      await createExamSchedule({
        examType,
        date: data.date,
        ...(showExamCodeField ? { examCodeId: data.examCodeId } : {}),
        ...(showTimeField ? { time: data.time.trim() } : {}),
        capacity: Number(data.capacity),
      });
      showToast("Sinav tarihi eklendi");
      onSaved();
    } catch (error) {
      const { applied, unmappedMessages } = applyApiErrorsToForm(error, setError);
      if (unmappedMessages[0]) {
        showToast(unmappedMessages[0], "error");
      } else if (!applied) {
        showToast("Sinav tarihi eklenemedi", "error");
      }
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
      title={modalTitle(examType)}
    >
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t("newExamSchedule.field.examDate")}<RequiredMark /></label>
            <LocalizedDateInput
              ariaLabel="Sinav Tarihi"
              className={fieldClass(!!errors.date, "form-input")}
              disabled={!canManage}
              inputRef={dateRegistration.ref}
              lang={dateInputLang}
              name={dateRegistration.name}
              onBlur={dateRegistration.onBlur}
              onChange={(value) =>
                setValue("date", value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              value={date}
            />
            {errors.date ? <div className="form-error">{errors.date.message}</div> : null}
          </div>

          {showTimeField ? (
            <div className="form-group">
              <label className="form-label">{t("common.field.time")}<RequiredMark /></label>
              <LocalizedTimeInput
                ariaLabel="Saat"
                className={fieldClass(!!errors.time, "form-input")}
                disabled={!canManage}
                inputRef={timeRegistration.ref}
                name={timeRegistration.name}
                onBlur={timeRegistration.onBlur}
                onChange={(value) =>
                  setValue("time", value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                value={time}
              />
              {errors.time ? <div className="form-error">{errors.time.message}</div> : null}
            </div>
          ) : null}

          {showExamCodeField ? (
            <div className="form-group">
              <label className="form-label">{t("newExamSchedule.field.examCode")}<RequiredMark /></label>
              <select
                className={fieldClass(!!errors.examCodeId, "form-select")}
                disabled={!canManage}
                value={examCodeId}
                {...register("examCodeId")}
              >
                <option value="">Sınav kodu seçin</option>
                {examCodes.map((code) => (
                  <option key={code.id} value={code.id}>
                    {code.code}
                  </option>
                ))}
              </select>
              {errors.examCodeId ? (
                <div className="form-error">{errors.examCodeId.message}</div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label" htmlFor={capacityInputId}>Kontenjan<RequiredMark /></label>
            <input
              className={fieldClass(!!errors.capacity, "form-input")}
              disabled={!canManage}
              id={capacityInputId}
              min={1}
              type="number"
              {...register("capacity", { valueAsNumber: true })}
            />
            {errors.capacity ? (
              <div className="form-error">{errors.capacity.message}</div>
            ) : null}
            <div className="form-hint">Ayni sinav tipi icin ayni gunde tek oturum kaydi tutulur.</div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
