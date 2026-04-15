import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { createGroup } from "../../lib/groups-api";
import { ApiError } from "../../lib/http";
import { getTerms } from "../../lib/terms-api";
import { buildTermLabel, compareTermsDesc } from "../../lib/term-label";
import { useLanguage, useT } from "../../lib/i18n";
import type { LicenseClass, TermResponse } from "../../lib/types";
import { LICENSE_CLASS_OPTIONS } from "../../lib/status-maps";
import { CustomSelect } from "../ui/CustomSelect";
import { Modal } from "../ui/Modal";
import { LocalizedDateInput } from "../ui/LocalizedDateInput";
import { useToast } from "../ui/Toast";

type NewGroupForm = {
  licenseClass: LicenseClass;
  title: string;
  termId: string;
  capacity: number;
  startDate: string;
};

type NewGroupModalProps = {
  open: boolean;
  /** When provided the form opens with this term already selected. */
  initialTermId?: string | null;
  onClose: () => void;
  onSubmit: () => void;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const defaultValues = (initialTermId?: string | null): NewGroupForm => ({
  licenseClass: "B",
  title: "",
  termId: initialTermId ?? "",
  capacity: 20,
  startDate: todayISO(),
});

export function NewGroupModal({
  open,
  initialTermId,
  onClose,
  onSubmit,
}: NewGroupModalProps) {
  const { showToast } = useToast();
  const t = useT();
  const { lang } = useLanguage();
  const dateInputLang = lang === "tr" ? "tr-TR" : undefined;
  const [submitting, setSubmitting] = useState(false);
  const [terms, setTerms] = useState<TermResponse[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NewGroupForm>({ defaultValues: defaultValues(initialTermId) });
  const startDate = watch("startDate");
  const startDateRegistration = register("startDate", { required: "Zorunlu alan" });

  useEffect(() => {
    if (open) reset(defaultValues(initialTermId));
  }, [open, initialTermId, reset]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    getTerms({ pageSize: 200 }, controller.signal)
      .then((result) => setTerms(result.items))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setTerms([]);
      });
    return () => controller.abort();
  }, [open]);

  const sortedTerms = useMemo(() => [...terms].sort(compareTermsDesc), [terms]);

  const termLabelById = useMemo(() => {
    const labels = new Map<string, string>();
    for (const term of sortedTerms) {
      labels.set(term.id, buildTermLabel(term, sortedTerms, lang));
    }
    return labels;
  }, [lang, sortedTerms]);

  const submit = handleSubmit(async (data) => {
    setSubmitting(true);
    try {
      await createGroup({
        title: data.title.trim(),
        licenseClass: data.licenseClass,
        termId: data.termId,
        capacity: data.capacity,
        startDate: data.startDate,
        mebStatus: null,
      });
      onSubmit();
    } catch (error) {
      if (error instanceof ApiError && error.validationErrors) {
        const startDateError =
          error.validationErrors.startDate?.[0] ??
          error.validationErrors.StartDate?.[0];

        if (startDateError) {
          const selectedTermLabel = termLabelById.get(data.termId);
          const message = selectedTermLabel
            ? `Baslangic tarihi secilen donemin ayi icinde olmali: ${selectedTermLabel}.`
            : "Baslangic tarihi secilen donemin ayi icinde olmali.";
          setError("startDate", { message });
          showToast(message, "error");
          return;
        }

        const termIdError = error.validationErrors.termId?.[0] ?? error.validationErrors.TermId?.[0];
        if (termIdError) {
          setError("termId", { message: termIdError });
        }

        const titleError = error.validationErrors.title?.[0] ?? error.validationErrors.Title?.[0];
        if (titleError) {
          setError("title", { message: titleError });
        }

        const capacityError =
          error.validationErrors.capacity?.[0] ?? error.validationErrors.Capacity?.[0];
        if (capacityError) {
          setError("capacity", { message: capacityError });
        }

        showToast("Grup olusturulamadi. Form alanlarini kontrol edin.", "error");
        return;
      }

      showToast("Grup olusturulamadi. Lutfen tekrar deneyin.", "error");
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
      title="Yeni Grup"
    >
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Sınıf</label>
            <CustomSelect
              className={fieldClass(!!errors.licenseClass, "form-select")}
              {...register("licenseClass", { required: true })}
            >
              {LICENSE_CLASS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </CustomSelect>
          </div>
          <div className="form-group">
            <label className="form-label">{t("terms.selector.label")}</label>
            <CustomSelect
              className={fieldClass(!!errors.termId, "form-select")}
              {...register("termId", { required: "Zorunlu alan" })}
            >
              <option value="">{t("terms.selector.none")}</option>
              {sortedTerms.map((term) => (
                <option key={term.id} value={term.id}>
                  {buildTermLabel(term, sortedTerms, lang)}
                </option>
              ))}
            </CustomSelect>
            {errors.termId && (
              <div className="form-error">{errors.termId.message}</div>
            )}
          </div>
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">Başlık</label>
            <input
              className={fieldClass(!!errors.title, "form-input")}
              placeholder="1A"
              {...register("title", {
                required: "Zorunlu alan",
                minLength: { value: 1, message: "En az 1 karakter" },
              })}
            />
            {errors.title && <div className="form-error">{errors.title.message}</div>}
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
            <LocalizedDateInput
              ariaLabel="Başlangıç"
              className={fieldClass(!!errors.startDate, "form-input")}
              inputRef={startDateRegistration.ref}
              lang={dateInputLang}
              name={startDateRegistration.name}
              onBlur={startDateRegistration.onBlur}
              onChange={(value) =>
                setValue("startDate", value, { shouldDirty: true, shouldValidate: true })
              }
              value={startDate}
            />
            {errors.startDate && (
              <div className="form-error">{errors.startDate.message}</div>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}
