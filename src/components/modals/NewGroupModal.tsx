import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { createGroup, getGroups } from "../../lib/groups-api";
import {
  buildGroupCode,
  GROUP_BRANCH_VALUES,
  GROUP_NUMBER_VALUES,
  suggestNextGroupBranch,
  suggestNextGroupCodeParts,
} from "../../lib/group-code";
import { ApiError } from "../../lib/http";
import { applyApiErrorsToForm } from "../../lib/form-errors";
import { getTerms } from "../../lib/terms-api";
import { buildGroupHeading, buildTermLabel, compareTermsDesc } from "../../lib/term-label";
import { useLanguage, useT, type TranslationKey } from "../../lib/i18n";
import type { TermResponse } from "../../lib/types";
import { CustomSelect } from "../ui/CustomSelect";
import { Modal } from "../ui/Modal";
import { LocalizedDateInput } from "../ui/LocalizedDateInput";
import { useToast } from "../ui/Toast";

const newGroupFormSchema = z.object({
  groupNumber: z.string().min(1, "group.validation.required"),
  groupBranch: z.string().min(1, "group.validation.required"),
  termId: z.string().min(1, "group.validation.required"),
  capacity: z.number().min(1, "En az 1").max(50, "En fazla 50"),
  startDate: z.string().min(1, "group.validation.required"),
});
type NewGroupForm = z.infer<typeof newGroupFormSchema>;

type NewGroupModalProps = {
  open: boolean;
  canManage?: boolean;
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
  canManage = true,
  initialTermId,
  onClose,
  onSubmit,
}: NewGroupModalProps) {
  const { showToast } = useToast();
  const t = useT();
  const { lang } = useLanguage();
  const dateInputLang = lang === "tr" ? "tr-TR" : undefined;
  const noPermissionTitle = t("common.noPermission");
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
  } = useForm<NewGroupForm>({ defaultValues: defaultValues(initialTermId), resolver: zodResolver(newGroupFormSchema) });
  const selectedTermId = watch("termId");
  const groupNumber = watch("groupNumber");
  const groupBranch = watch("groupBranch");
  const startDate = watch("startDate");
  const termIdRegistration = register("termId");
  const groupNumberRegistration = register("groupNumber");
  const groupBranchRegistration = register("groupBranch");
  const startDateRegistration = register("startDate");

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
    if (!canManage) return;
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
      }

      const { applied, unmappedMessages } = applyApiErrorsToForm(error, setError, {
        translateCode: (code) => t(code as TranslationKey),
      });
      if (applied) {
        showToast("Grup olusturulamadi. Form alanlarini kontrol edin.", "error");
      } else if (unmappedMessages.length > 0) {
        showToast(unmappedMessages[0], "error");
      } else {
        showToast("Grup olusturulamadi. Lutfen tekrar deneyin.", "error");
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
      title={t("newGroup.modalTitle")}
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
              <div className="form-error">{t((errors.termId.message ?? "") as TranslationKey)}</div>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t("newGroup.field.groupNumber")}</label>
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
              <div className="form-error">{t((errors.groupNumber.message ?? "") as TranslationKey)}</div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">{t("newGroup.field.branch")}</label>
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
              <div className="form-error">{t((errors.groupBranch.message ?? "") as TranslationKey)}</div>
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
            <label className="form-label">{t("common.field.capacity")}</label>
            <input
              className={fieldClass(!!errors.capacity, "form-input")}
              inputMode="numeric"
              type="number"
              {...register("capacity", { valueAsNumber: true })}
            />
            {errors.capacity && <div className="form-error">{errors.capacity.message}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">{t("common.field.startDate")}</label>
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
              <div className="form-error">{t((errors.startDate.message ?? "") as TranslationKey)}</div>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}
