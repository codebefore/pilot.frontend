import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { createClassroom, updateClassroom } from "../../lib/classrooms-api";
import { getTrainingBranchDefinitions } from "../../lib/training-branch-definitions-api";
import { ApiError, type ApiValidationError } from "../../lib/http";
import { useT, type TranslationKey } from "../../lib/i18n";
import type {
  ClassroomResponse,
  ClassroomUpsertRequest,
  TrainingBranchDefinitionResponse,
} from "../../lib/types";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

type ClassroomFormValues = {
  name: string;
  capacity: string;
  isActive: boolean;
  notes: string;
  branchIds: string[];
};

type ClassroomFormModalProps = {
  open: boolean;
  editing: ClassroomResponse | null;
  onClose: () => void;
  onSaved: (saved: ClassroomResponse) => void;
  onConcurrencyConflict?: () => void;
};

const VALIDATION_FIELD_MAP: Record<string, keyof ClassroomFormValues> = {
  name: "name",
  Name: "name",
  capacity: "capacity",
  Capacity: "capacity",
  notes: "notes",
  Notes: "notes",
  branchIds: "branchIds",
  BranchIds: "branchIds",
};

const CONCURRENCY_CODE = "classroom.validation.concurrencyConflict";

function getEmptyValues(editing: ClassroomResponse | null): ClassroomFormValues {
  return editing
    ? {
        name: editing.name,
        capacity: String(editing.capacity),
        isActive: editing.isActive,
        notes: editing.notes ?? "",
        branchIds: editing.branches.map((branch) => branch.id),
      }
    : {
        name: "",
        capacity: "20",
        isActive: true,
        notes: "",
        branchIds: [],
      };
}

function hasConcurrencyError(
  codes: Record<string, ApiValidationError[]> | undefined
): boolean {
  if (!codes) return false;
  return Object.values(codes).some((errors) =>
    errors.some((error) => error.code === CONCURRENCY_CODE)
  );
}

function applyServerFieldErrors(
  error: ApiError,
  setError: (field: keyof ClassroomFormValues, error: { message: string }) => void,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): { appliedFieldError: boolean; unmappedMessage: string | null } {
  const codes = error.validationErrorCodes;
  const fallback = error.validationErrors;
  let appliedFieldError = false;
  let unmappedMessage: string | null = null;

  if (codes) {
    for (const [serverField, fieldErrors] of Object.entries(codes)) {
      const formField = VALIDATION_FIELD_MAP[serverField];
      const first = fieldErrors[0];
      if (!first) continue;
      if (!formField) {
        unmappedMessage ??= t(first.code as TranslationKey, first.params);
        continue;
      }
      setError(formField, { message: t(first.code as TranslationKey, first.params) });
      appliedFieldError = true;
    }
  }

  if (fallback) {
    for (const [serverField, messages] of Object.entries(fallback)) {
      const formField = VALIDATION_FIELD_MAP[serverField];
      if (!messages?.[0]) continue;
      if (!formField) {
        unmappedMessage ??= messages[0];
        continue;
      }
      if (codes && codes[serverField]?.length) continue;
      setError(formField, { message: messages[0] });
      appliedFieldError = true;
    }
  }

  return { appliedFieldError, unmappedMessage };
}

export function ClassroomFormModal({
  open,
  editing,
  onClose,
  onSaved,
  onConcurrencyConflict,
}: ClassroomFormModalProps) {
  const { showToast } = useToast();
  const t = useT();
  const [submitting, setSubmitting] = useState(false);
  const [branches, setBranches] = useState<TrainingBranchDefinitionResponse[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
    watch,
  } = useForm<ClassroomFormValues>({
    defaultValues: getEmptyValues(editing),
  });

  useEffect(() => {
    if (!open) return;
    reset(getEmptyValues(editing));
  }, [editing, open, reset]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setBranchesLoading(true);
    getTrainingBranchDefinitions(
      { activity: "active", page: 1, pageSize: 200 },
      controller.signal
    )
      .then((response) => setBranches(response.items))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        showToast(t("settings.classrooms.toast.loadError"), "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setBranchesLoading(false);
      });
    return () => controller.abort();
  }, [open, showToast, t]);

  const submit = handleSubmit(async (values) => {
    setSubmitting(true);

    const capacityValue = Number.parseInt(values.capacity, 10);
    const payload: ClassroomUpsertRequest = {
      name: values.name.trim(),
      capacity: Number.isFinite(capacityValue) ? capacityValue : 0,
      isActive: values.isActive,
      notes: values.notes.trim() || null,
      branchIds: values.branchIds,
      ...(editing ? { rowVersion: editing.rowVersion } : {}),
    };

    try {
      const saved = editing
        ? await updateClassroom(editing.id, payload)
        : await createClassroom(payload);
      onSaved(saved);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409 && hasConcurrencyError(error.validationErrorCodes)) {
          showToast(t("classroom.validation.concurrencyConflict"), "error");
          onConcurrencyConflict?.();
          return;
        }
        const { appliedFieldError, unmappedMessage } = applyServerFieldErrors(error, setError, t);
        if (unmappedMessage) {
          showToast(unmappedMessage, "error");
        } else if (!appliedFieldError) {
          showToast(t("classroom.validation.generic"), "error");
        }
      } else {
        showToast(t("classroom.validation.generic"), "error");
      }
    } finally {
      setSubmitting(false);
    }
  });

  const fieldClass = (message?: string) => (message ? "form-input error" : "form-input");

  return (
    <Modal
      footer={
        <>
          <button className="btn btn-secondary" disabled={submitting} onClick={onClose} type="button">
            {t("settings.classrooms.form.cancel")}
          </button>
          <button className="btn btn-primary" disabled={submitting} onClick={submit} type="button">
            {submitting ? t("settings.classrooms.form.saving") : t("settings.classrooms.form.save")}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title={editing ? t("settings.classrooms.form.titleEdit") : t("settings.classrooms.form.titleNew")}
    >
      <form className="settings-form" onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t("settings.classrooms.form.name")}</label>
            <input
              className={fieldClass(errors.name?.message)}
              placeholder={t("settings.classrooms.form.namePlaceholder")}
              {...register("name", { required: t("classroom.validation.required") })}
            />
            {errors.name && <div className="form-error">{errors.name.message}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">{t("settings.classrooms.form.capacity")}</label>
            <input
              className={fieldClass(errors.capacity?.message)}
              inputMode="numeric"
              min={1}
              placeholder="20"
              type="number"
              {...register("capacity", { required: t("classroom.validation.required") })}
            />
            {errors.capacity && <div className="form-error">{errors.capacity.message}</div>}
          </div>
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">{t("settings.classrooms.form.branches")}</label>
            <div className="form-subsection-note">{t("settings.classrooms.form.branchesHint")}</div>
            <Controller
              control={control}
              name="branchIds"
              render={({ field }) => (
                <div className="settings-checkbox-list">
                  {branchesLoading ? (
                    <span className="form-subsection-note">…</span>
                  ) : branches.length === 0 ? (
                    <span className="form-subsection-note">—</span>
                  ) : (
                    branches.map((branch) => {
                      const checked = field.value.includes(branch.id);
                      return (
                        <label className="switch-toggle" key={branch.id}>
                          <input
                            checked={checked}
                            onChange={(event) => {
                              if (event.target.checked) {
                                field.onChange([...field.value, branch.id]);
                              } else {
                                field.onChange(field.value.filter((id) => id !== branch.id));
                              }
                            }}
                            type="checkbox"
                          />
                          <span className="switch-toggle-control" aria-hidden="true" />
                          <span>
                            <span
                              className="settings-color-swatch"
                              style={{ backgroundColor: branch.colorHex, marginRight: 6 }}
                            />
                            {branch.name}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              )}
              rules={{
                validate: (value) =>
                  value.length > 0 || t("classroom.validation.branchRequired"),
              }}
            />
            {errors.branchIds && <div className="form-error">{errors.branchIds.message}</div>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t("settings.classrooms.form.isActive")}</label>
            <label className="switch-toggle">
              <input type="checkbox" {...register("isActive")} />
              <span className="switch-toggle-control" aria-hidden="true" />
              <span>
                {watch("isActive")
                  ? t("settings.classrooms.filter.isActive.active")
                  : t("settings.classrooms.filter.isActive.inactive")}
              </span>
            </label>
          </div>
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">{t("settings.classrooms.form.notes")}</label>
            <textarea className="form-input" rows={3} {...register("notes")} />
          </div>
        </div>
      </form>
    </Modal>
  );
}
