import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";

import { createExamSchedule } from "../../lib/exam-schedules-api";
import { ApiError } from "../../lib/http";
import { useLanguage } from "../../lib/i18n";
import { LocalizedDateInput } from "../ui/LocalizedDateInput";
import { LocalizedTimeInput } from "../ui/LocalizedTimeInput";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

type NewExamScheduleForm = {
  date: string;
  time: string;
  capacity: number;
};

type NewExamScheduleModalProps = {
  examType: "e_sinav" | "direksiyon";
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
    time: "09:00",
    capacity: 20,
  };
}

function modalTitle(examType: "e_sinav" | "direksiyon"): string {
  return examType === "e_sinav" ? "Yeni E-Sınav Tarihi" : "Yeni Direksiyon Tarihi";
}

export function NewExamScheduleModal({
  examType,
  open,
  onClose,
  onSaved,
}: NewExamScheduleModalProps) {
  const { showToast } = useToast();
  const { lang } = useLanguage();
  const dateInputLang = lang === "tr" ? "tr-TR" : undefined;
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
  } = useForm<NewExamScheduleForm>({ defaultValues: defaultValues() });
  const date = watch("date");
  const time = watch("time");
  const showTimeField = examType === "e_sinav";
  const dateRegistration = register("date", { required: "Zorunlu alan" });
  const timeRegistration = register("time", { required: "Zorunlu alan" });

  useEffect(() => {
    if (open) {
      reset(defaultValues());
    }
  }, [open, reset]);

  const submit = handleSubmit(async (data) => {
    setSubmitting(true);

    try {
      await createExamSchedule({
        examType,
        date: data.date,
        ...(showTimeField ? { time: data.time.trim() } : {}),
        capacity: Number(data.capacity),
      });
      showToast("Sinav tarihi eklendi");
      onSaved();
    } catch (error) {
      if (error instanceof ApiError && error.validationErrors) {
        const dateError = error.validationErrors.date?.[0] ?? error.validationErrors.Date?.[0];
        if (dateError) {
          setError("date", { message: dateError });
        }

        const timeError = error.validationErrors.time?.[0] ?? error.validationErrors.Time?.[0];
        if (timeError) {
          setError("time", { message: timeError });
        }

        const capacityError =
          error.validationErrors.capacity?.[0] ?? error.validationErrors.Capacity?.[0];
        if (capacityError) {
          setError("capacity", { message: capacityError });
        }

        showToast("Sinav tarihi eklenemedi", "error");
        return;
      }

      showToast("Sinav tarihi eklenemedi", "error");
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
            İptal
          </button>
          <button
            className="btn btn-primary"
            disabled={submitting}
            onClick={submit}
            type="button"
          >
            {submitting ? "Kaydediliyor..." : "Kaydet"}
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
            <label className="form-label">Sinav Tarihi</label>
            <LocalizedDateInput
              ariaLabel="Sinav Tarihi"
              className={fieldClass(!!errors.date, "form-input")}
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
              <label className="form-label">Saat</label>
              <LocalizedTimeInput
                ariaLabel="Saat"
                className={fieldClass(!!errors.time, "form-input")}
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
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label" htmlFor={capacityInputId}>Kontenjan</label>
            <input
              className={fieldClass(!!errors.capacity, "form-input")}
              id={capacityInputId}
              min={1}
              type="number"
              {...register("capacity", {
                required: "Zorunlu alan",
                valueAsNumber: true,
                min: {
                  value: 1,
                  message: "Kontenjan 1 veya daha buyuk olmali.",
                },
              })}
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
