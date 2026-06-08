import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { createTerm, updateTerm } from "../../lib/terms-api";
import { ApiError } from "../../lib/http";
import { useLanguage, useT, type TranslationKey } from "../../lib/i18n";
import { applyApiErrorsToForm } from "../../lib/form-errors";
import type { TermResponse } from "../../lib/types";
import { LocalizedDateInput } from "../ui/LocalizedDateInput";
import { RequiredMark } from "../ui/RequiredMark";
import { useToast } from "../ui/Toast";
import { Modal } from "../ui/Modal";

// Error message is an i18n key; render code translates via t().
const termFormSchema = z.object({
  monthDate: z.string().min(1, "terms.form.monthRequired"),
  name: z.string(),
});
type NewTermForm = z.infer<typeof termFormSchema>;

type NewTermModalProps = {
  open: boolean;
  canManage?: boolean;
  onClose: () => void;
  onSaved: (term: TermResponse) => void;
  term?: TermResponse | null;
};

/** Return the first-of-month ISO date ("YYYY-MM-01") for the given ISO date. */
function toMonthStart(iso: string): string {
  return iso.length >= 7 ? `${iso.slice(0, 7)}-01` : iso;
}

function currentMonthStart(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

const defaultValues = (): NewTermForm => ({
  monthDate: currentMonthStart(),
  name: "",
});

function termValues(term?: TermResponse | null): NewTermForm {
  if (!term) {
    return defaultValues();
  }

  return {
    monthDate: toMonthStart(term.monthDate.slice(0, 10)),
    name: term.name ?? "",
  };
}

function isNameRequiredForDuplicateMonth(message: string): boolean {
  return /name is required when another term already exists in the same month/i.test(message);
}

export function NewTermModal({ open, canManage = true, onClose, onSaved, term }: NewTermModalProps) {
  const t = useT();
  const { lang } = useLanguage();
  const dateInputLang = lang === "tr" ? "tr-TR" : undefined;
  const { showToast } = useToast();
  const noPermissionTitle = t("common.noPermission");
  const [submitting, setSubmitting] = useState(false);
  const isEditMode = Boolean(term);
  const nameInputId = useId();
  const monthDateInputId = useId();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NewTermForm>({ defaultValues: termValues(term), resolver: zodResolver(termFormSchema) });
  const monthDate = watch("monthDate");
  const monthDateRegistration = register("monthDate");

  useEffect(() => {
    if (open) reset(termValues(term));
  }, [open, reset, term]);

  const submit = handleSubmit(async (data) => {
    if (!canManage) return;
    setSubmitting(true);
    try {
      const normalizedMonthDate = toMonthStart(data.monthDate);
      const saved = isEditMode && term
        ? await updateTerm(term.id, {
            monthDate: normalizedMonthDate,
            name: data.name.trim() || null,
            rowVersion: term.rowVersion,
          })
        : await createTerm({
            monthDate: normalizedMonthDate,
            name: data.name.trim() || null,
          });
      showToast(t(isEditMode ? "terms.updated" : "terms.created"));
      onSaved(saved);
    } catch (error) {
      if (error instanceof ApiError) {
        // 409 on RowVersion means someone else updated this term while the
        // modal was open. Surface via i18n, close the modal, and let the
        // parent refetch the list on the next render.
        const concurrencyCode = "term.validation.concurrencyConflict";
        const hasConcurrency = error.validationErrorCodes
          ? Object.values(error.validationErrorCodes).some((codes) =>
              codes.some((entry) => entry.code === concurrencyCode)
            )
          : false;
        if (error.status === 409 && hasConcurrency) {
          showToast(t(concurrencyCode), "error");
          onClose();
          return;
        }
      }

      const { applied, appliedMessages, unmappedMessages } = applyApiErrorsToForm(error, setError, {
        translateCode: (code) => t(code as TranslationKey),
        translateMessage: (message) =>
          isNameRequiredForDuplicateMonth(message)
            ? t("term.validation.nameRequired")
            : message,
        fieldMap: {
          Name: "name",
          name: "name",
          Term: "name",
          term: "name",
        },
      });
      if (applied) {
        showToast(
          appliedMessages[0]
            ?? unmappedMessages[0]
            ?? t(isEditMode ? "terms.updateFailed" : "terms.createFailed"),
          "error"
        );
        return;
      }
      const fallback = unmappedMessages[0]
        ?? t(isEditMode ? "terms.updateFailed" : "terms.createFailed");
      showToast(fallback, "error");
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
            disabled={submitting || !canManage}
            onClick={submit}
            title={!canManage ? noPermissionTitle : undefined}
            type="button"
          >
            {submitting ? t("terms.form.saving") : t("terms.form.save")}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title={t(isEditMode ? "terms.form.edit" : "terms.form.create")}
    >
      <form onSubmit={submit}>
        <div className="form-row full">
          <div className="form-group">
            <label className="form-label" htmlFor={monthDateInputId}>{t("terms.form.month")}<RequiredMark /></label>
            <LocalizedDateInput
              ariaLabel={t("terms.form.month")}
              className={fieldClass(!!errors.monthDate, "form-input")}
              disabled={!canManage}
              id={monthDateInputId}
              inputRef={monthDateRegistration.ref}
              lang={dateInputLang}
              mode="month"
              name={monthDateRegistration.name}
              onBlur={monthDateRegistration.onBlur}
              onChange={(value) =>
                setValue("monthDate", toMonthStart(value), {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              value={monthDate}
            />
            {errors.monthDate ? (
              <div className="form-error">{t((errors.monthDate.message ?? "") as TranslationKey)}</div>
            ) : (
              <div className="form-hint">{t("terms.form.monthHelp")}</div>
            )}
          </div>
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label" htmlFor={nameInputId}>{t("terms.form.name")}</label>
            <input
              className={fieldClass(!!errors.name, "form-input")}
              disabled={!canManage}
              id={nameInputId}
              placeholder={t("terms.form.namePlaceholder")}
              {...register("name")}
            />
            {errors.name ? (
              <div className="form-error">{errors.name.message}</div>
            ) : (
              <div className="form-hint">{t("terms.form.nameHelp")}</div>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}
