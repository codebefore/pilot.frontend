import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { createGroup, getGroups } from "../../lib/groups-api";
import {
  buildGroupCode,
  GROUP_BRANCH_VALUES,
  GROUP_NUMBER_VALUES,
  suggestNextGroupBranch,
  suggestNextGroupCodeParts,
} from "../../lib/group-code";
import { ApiError } from "../../lib/http";
import { getTerms } from "../../lib/terms-api";
import { buildGroupHeading, buildTermLabel, compareTermsDesc } from "../../lib/term-label";
import { useLanguage, useT } from "../../lib/i18n";
import type { TermResponse } from "../../lib/types";
import { CustomSelect } from "../ui/CustomSelect";
import { Modal } from "../ui/Modal";
import { LocalizedDateInput } from "../ui/LocalizedDateInput";
import { useToast } from "../ui/Toast";

type NewGroupForm = {
  groupNumber: string;
  groupBranch: string;
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
  groupNumber: GROUP_NUMBER_VALUES[0],
  groupBranch: GROUP_BRANCH_VALUES[0],
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
  const [groupTitles, setGroupTitles] = useState<string[]>([]);
  const [terms, setTerms] = useState<TermResponse[]>([]);

  const {
    register,
    handleSubmit,
    getFieldState,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NewGroupForm>({ defaultValues: defaultValues(initialTermId) });
  const selectedTermId = watch("termId");
  const groupNumber = watch("groupNumber");
  const groupBranch = watch("groupBranch");
  const startDate = watch("startDate");
  const termIdRegistration = register("termId", { required: "Zorunlu alan" });
  const groupNumberRegistration = register("groupNumber", { required: "Zorunlu alan" });
  const groupBranchRegistration = register("groupBranch", { required: "Zorunlu alan" });
  const startDateRegistration = register("startDate", { required: "Zorunlu alan" });

  useEffect(() => {
    if (open) {
      reset(defaultValues(initialTermId));
      setGroupTitles([]);
    }
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

  useEffect(() => {
    if (!open || !selectedTermId) {
      setGroupTitles([]);
      return;
    }

    const controller = new AbortController();
    getGroups(
      {
        termId: selectedTermId,
        page: 1,
        pageSize: 100,
      },
      controller.signal
    )
      .then((result) => {
        const nextGroupTitles = result.items.map((group) => group.title);
        setGroupTitles(nextGroupTitles);

        if (getFieldState("groupNumber").isDirty || getFieldState("groupBranch").isDirty) {
          return;
        }

        const suggested = suggestNextGroupCodeParts(nextGroupTitles);
        setValue("groupNumber", suggested.groupNumber, { shouldDirty: false });
        setValue("groupBranch", suggested.groupBranch, { shouldDirty: false });
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });

    return () => controller.abort();
  }, [getFieldState, open, selectedTermId, setValue]);

  useEffect(() => {
    if (!open || !selectedTermId || getFieldState("groupBranch").isDirty) {
      return;
    }

    const suggestedBranch = suggestNextGroupBranch(groupTitles, groupNumber);
    if (groupBranch !== suggestedBranch) {
      setValue("groupBranch", suggestedBranch, { shouldDirty: false });
    }
  }, [getFieldState, groupBranch, groupNumber, groupTitles, open, selectedTermId, setValue]);

  const sortedTerms = useMemo(() => [...terms].sort(compareTermsDesc), [terms]);
  const selectedTerm = useMemo(
    () => sortedTerms.find((term) => term.id === selectedTermId) ?? null,
    [selectedTermId, sortedTerms]
  );

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
        groupNumber: Number(data.groupNumber),
        groupBranch: data.groupBranch,
        termId: data.termId,
        capacity: data.capacity,
        startDate: data.startDate,
        mebStatus: "not_sent",
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

        const groupNumberError =
          error.validationErrors.groupNumber?.[0] ?? error.validationErrors.GroupNumber?.[0];
        if (groupNumberError) {
          setError("groupNumber", { message: groupNumberError });
        }

        const groupBranchError =
          error.validationErrors.groupBranch?.[0] ?? error.validationErrors.GroupBranch?.[0];
        if (groupBranchError) {
          setError("groupBranch", { message: groupBranchError });
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
            <label className="form-label">{t("terms.selector.label")}</label>
            <CustomSelect
              className={fieldClass(!!errors.termId, "form-select")}
              value={selectedTermId}
              {...termIdRegistration}
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

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Grup No</label>
            <CustomSelect
              className={fieldClass(!!errors.groupNumber, "form-select")}
              value={groupNumber}
              {...groupNumberRegistration}
            >
              {GROUP_NUMBER_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </CustomSelect>
            {errors.groupNumber && (
              <div className="form-error">{errors.groupNumber.message}</div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Şube</label>
            <CustomSelect
              className={fieldClass(!!errors.groupBranch, "form-select")}
              value={groupBranch}
              {...groupBranchRegistration}
            >
              {GROUP_BRANCH_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </CustomSelect>
            {errors.groupBranch && (
              <div className="form-error">{errors.groupBranch.message}</div>
            )}
            <div className="form-hint">
              Başlık:{" "}
              {selectedTerm
                ? buildGroupHeading(
                    buildGroupCode(groupNumber, groupBranch),
                    selectedTerm,
                    sortedTerms,
                    lang
                  )
                : buildGroupCode(groupNumber, groupBranch)}
            </div>
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
