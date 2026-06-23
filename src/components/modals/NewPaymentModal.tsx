import { useEffect, useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Modal } from "../ui/Modal";
import { getCandidates } from "../../lib/candidates-api";
import { todayLocalDateOnly } from "../../lib/date-only";
import { useLanguage, useT, currentLocale, type TranslationKey } from "../../lib/i18n";
import type { CandidateResponse } from "../../lib/types";
import { CustomSelect } from "../ui/CustomSelect";
import { LocalizedDateInput } from "../ui/LocalizedDateInput";
import { RequiredMark } from "../ui/RequiredMark";

const newPaymentSchema = z.object({
  candidateId: z.string().min(1, "newPayment.error.candidateRequired"),
  amount: z.number().min(1, "newPayment.error.positiveAmount"),
  method: z.enum(["Nakit", "Havale", "KrediKarti"]),
  date: z
    .string()
    .min(1, "common.required")
    .refine((v) => {
      const [year, month, day] = v.split("-").map(Number);
      if (!year || !month || !day) return false;
      const paymentDate = new Date(year, month - 1, day);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diff = (paymentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 1;
    }, "newPayment.error.futureDate"),
  note: z.string(),
});

type NewPaymentForm = z.infer<typeof newPaymentSchema>;

type NewPaymentModalProps = {
  open: boolean;
  canManage?: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

const defaultValues = (): NewPaymentForm => ({
  candidateId: "",
  amount: 2400,
  method: "Nakit",
  date: todayLocalDateOnly(),
  note: "",
});

export function NewPaymentModal({ open, canManage = true, onClose, onSubmit }: NewPaymentModalProps) {
  const t = useT();
  const { lang } = useLanguage();
  const dateInputLang = lang === "tr" ? "tr-TR" : undefined;
  const noPermissionTitle = t("common.noPermission");
  const translateError = (message: string | undefined): string =>
    !message ? "" : message.includes(".") ? t(message as TranslationKey) : message;
  const [debtors, setDebtors] = useState<CandidateResponse[]>([]);
  const candidateSelectId = useId();
  const amountId = useId();
  const methodId = useId();
  const dateId = useId();
  const noteId = useId();
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NewPaymentForm>({ defaultValues: defaultValues(), resolver: zodResolver(newPaymentSchema) });
  const date = watch("date");
  const dateRegistration = register("date");

  useEffect(() => {
    if (!open) {
      reset(defaultValues());
      return;
    }

    const controller = new AbortController();
    getCandidates({ page: 1, pageSize: 100 }, controller.signal)
      .then((result) => {
        const withDebt = result.items.filter((candidate) => candidate.totalDebt > 0);
        setDebtors(withDebt);
        if (withDebt.length > 0) {
          setValue("candidateId", withDebt[0].id, { shouldDirty: false });
        }
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setDebtors([]);
      });

    return () => controller.abort();
  }, [open, reset, setValue]);

  const submit = handleSubmit(() => {
    if (!canManage) return;
    onSubmit();
  });

  const fieldClass = (hasError: boolean, base: "form-input" | "form-select") =>
    hasError ? `${base} error` : base;

  return (
    <Modal
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} type="button">
            {t("common.cancel")}
          </button>
          <button
            className="btn btn-primary"
            disabled={!canManage}
            onClick={submit}
            title={!canManage ? noPermissionTitle : undefined}
            type="button"
          >
            Kaydet & Makbuz Kes
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title={t("newPayment.modalTitle")}
    >
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor={candidateSelectId}>{t("common.field.candidate")}<RequiredMark /></label>
            <CustomSelect
              id={candidateSelectId}
              className={fieldClass(!!errors.candidateId, "form-select")}
              disabled={!canManage}
              {...register("candidateId")}
            >
              {debtors.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {`${candidate.firstName} ${candidate.lastName}`.trim()} — Bakiye:{" "}
                  {candidate.totalDebt.toLocaleString(currentLocale())} TL
                </option>
              ))}
            </CustomSelect>
            {errors.candidateId && (
              <div className="form-error">{translateError(errors.candidateId.message)}</div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={amountId}>{t("newPayment.field.amount")}<RequiredMark /></label>
            <input
              id={amountId}
              className={fieldClass(!!errors.amount, "form-input")}
              disabled={!canManage}
              type="number"
              {...register("amount", { valueAsNumber: true })}
            />
            {errors.amount && <div className="form-error">{translateError(errors.amount.message)}</div>}
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor={methodId}>{t("newPayment.field.method")}</label>
            <Controller
              control={control}
              name="method"
              render={({ field }) => (
                <CustomSelect
                  id={methodId}
                  className="form-select"
                  disabled={!canManage}
                  name={field.name}
                  onBlur={field.onBlur}
                  onChange={(event) => field.onChange(event.target.value)}
                  value={field.value}
                >
                  <option value="Nakit">Nakit</option>
                  <option value="Havale">Havale / EFT</option>
                  <option value="KrediKarti">Kredi Kartı</option>
                </CustomSelect>
              )}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={dateId}>{t("common.field.date")}<RequiredMark /></label>
            <LocalizedDateInput
              ariaLabel={t("common.field.date")}
              className={fieldClass(!!errors.date, "form-input")}
              disabled={!canManage}
              id={dateId}
              inputRef={dateRegistration.ref}
              lang={dateInputLang}
              name={dateRegistration.name}
              onBlur={dateRegistration.onBlur}
              onChange={(value) =>
                setValue("date", value, { shouldDirty: true, shouldValidate: true })
              }
              value={date}
            />
            {errors.date && <div className="form-error">{translateError(errors.date.message)}</div>}
          </div>
        </div>
        <div className="form-row full">
          <div className="form-group">
            <label className="form-label" htmlFor={noteId}>{t("common.field.note")}</label>
            <textarea
              id={noteId}
              className="form-input"
              disabled={!canManage}
              placeholder={t("newPayment.placeholder.note")}
              rows={3}
              {...register("note")}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
