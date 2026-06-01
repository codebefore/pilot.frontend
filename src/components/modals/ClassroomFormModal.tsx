import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { createClassroom, updateClassroom } from "../../lib/classrooms-api";
import { getTrainingBranchDefinitions } from "../../lib/training-branch-definitions-api";
import { ApiError, type ApiValidationError } from "../../lib/http";
import { useT, type TranslationKey } from "../../lib/i18n";
import { applyApiErrorsToForm } from "../../lib/form-errors";
import type {
  ClassroomResponse,
  ClassroomUpsertRequest,
  TrainingBranchDefinitionResponse,
} from "../../lib/types";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

const classroomFormSchema = z.object({
  name: z.string().min(1, "classroom.validation.required"),
  capacity: z.string().min(1, "classroom.validation.required"),
  isActive: z.boolean(),
  notes: z.string(),
  branchIds: z.array(z.string()).min(1, "classroom.validation.branchRequired"),
});

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
  canManage?: boolean;
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

export function ClassroomFormModal({
  open,
  editing,
  canManage = true,
  onClose,
  onSaved,
  onConcurrencyConflict,
}: ClassroomFormModalProps) {
  const { showToast } = useToast();
  const t = useT();
  const noPermissionTitle = t("common.noPermission");
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
    resolver: zodResolver(classroomFormSchema),
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
    if (!canManage) return;
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
        const { applied, unmappedMessages } = applyApiErrorsToForm(error, setError, {
          translateCode: (code, params) => t(code as TranslationKey, params),
          fieldMap: VALIDATION_FIELD_MAP,
        });
        if (unmappedMessages[0]) {
          showToast(unmappedMessages[0], "error");
        } else if (!applied) {
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
          <button
            className="btn btn-primary"
            disabled={submitting || !canManage}
            onClick={submit}
            title={!canManage ? noPermissionTitle : undefined}
            type="button"
          >
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
              readOnly={editing !== null}
              {...register("name")}
            />
            {errors.name && <div className="form-error">{t((errors.name.message ?? "") as TranslationKey)}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">{t("settings.classrooms.form.capacity")}</label>
            <input
              className={fieldClass(errors.capacity?.message)}
              inputMode="numeric"
              min={1}
              placeholder="20"
              type="number"
              {...register("capacity")}
            />
            {errors.capacity && <div className="form-error">{t((errors.capacity.message ?? "") as TranslationKey)}</div>}
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
            />
            {errors.branchIds && <div className="form-error">{t((errors.branchIds.message ?? "") as TranslationKey)}</div>}
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
