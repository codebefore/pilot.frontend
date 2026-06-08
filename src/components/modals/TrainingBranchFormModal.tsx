import { useEffect, useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { applyApiErrorsToForm } from "../../lib/form-errors";
import {
  updateTrainingBranchDefinition,
} from "../../lib/training-branch-definitions-api";
import type {
  TrainingBranchDefinitionResponse,
  TrainingBranchDefinitionUpsertRequest,
} from "../../lib/types";
import { Modal } from "../ui/Modal";
import { RequiredMark } from "../ui/RequiredMark";
import { useToast } from "../ui/Toast";
import { useT } from "../../lib/i18n";

const trainingBranchSchema = z.object({
  code: z.string(),
  name: z.string().min(1, "Ad zorunlu"),
  colorHex: z.string(),
});
type TrainingBranchFormValues = z.infer<typeof trainingBranchSchema>;

type TrainingBranchFormModalProps = {
  open: boolean;
  canManage?: boolean;
  editing: TrainingBranchDefinitionResponse | null;
  onClose: () => void;
  onSaved: (saved: TrainingBranchDefinitionResponse) => void;
};

const DEFAULT_VALUES: TrainingBranchFormValues = {
  code: "",
  name: "",
  colorHex: "#3e5660",
};

function getValues(editing: TrainingBranchDefinitionResponse | null): TrainingBranchFormValues {
  if (!editing) return DEFAULT_VALUES;
  return {
    code: editing.code,
    name: editing.name,
    colorHex: editing.colorHex,
  };
}

function buildPayload(
  values: TrainingBranchFormValues,
  editing: TrainingBranchDefinitionResponse
): TrainingBranchDefinitionUpsertRequest {
  return {
    code: editing.code,
    name: values.name.trim(),
    totalLessonHourLimit: editing.totalLessonHourLimit,
    colorHex: values.colorHex.trim() || "#3e5660",
    displayOrder: editing.displayOrder,
    isActive: editing.isActive,
    notes: editing.notes,
    rowVersion: editing.rowVersion,
  };
}

export function TrainingBranchFormModal({
  open,
  canManage = true,
  editing,
  onClose,
  onSaved,
}: TrainingBranchFormModalProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const t = useT();
  const noPermissionTitle = t("common.noPermission");
  const [submitting, setSubmitting] = useState(false);
  const codeInputId = useId();
  const nameInputId = useId();
  const colorInputId = useId();
  const systemLimitId = useId();

  const invalidateTrainingBranchDependents = () => {
    void queryClient.invalidateQueries({ queryKey: ["settings", "training-branches"] });
    void queryClient.invalidateQueries({ queryKey: ["settings", "classrooms", "training-branches"] });
    void queryClient.invalidateQueries({ queryKey: ["training", "branches"] });
    void queryClient.invalidateQueries({ queryKey: ["training", "instructors"] });
    void queryClient.invalidateQueries({ queryKey: ["training", "lessons"] });
    void queryClient.invalidateQueries({ queryKey: ["instructors", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["instructors", "detail"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
  } = useForm<TrainingBranchFormValues>({
    defaultValues: getValues(editing),
    resolver: zodResolver(trainingBranchSchema),
  });

  useEffect(() => {
    if (!open) return;
    reset(getValues(editing));
  }, [editing, open, reset]);

  const submit = handleSubmit(async (values) => {
    if (!canManage) return;
    if (!editing) return;
    setSubmitting(true);
    try {
      const payload = buildPayload(values, editing);
      const saved = await updateTrainingBranchDefinition(editing.id, payload);
      invalidateTrainingBranchDependents();
      onSaved(saved);
    } catch (error) {
      const { applied, unmappedMessages } = applyApiErrorsToForm(error, setError);
      if (unmappedMessages[0]) {
        showToast(unmappedMessages[0], "error");
      } else if (!applied) {
        showToast(t("trainingBranchForm.toast.saveFailed"), "error");
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
      title={t("trainingBranchForm.modalTitle")}
    >
      <form className="settings-form" onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor={codeInputId}>{t("trainingBranchForm.field.code")}</label>
            <input
              id={codeInputId}
              className={fieldClass(errors.code?.message)}
              disabled
              placeholder="trafik_ve_cevre"
              {...register("code")}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={nameInputId}>{t("trainingBranchForm.field.name")}<RequiredMark /></label>
            <input
              id={nameInputId}
              className={fieldClass(errors.name?.message)}
              placeholder={t("trainingBranchForm.placeholder.example")}
              {...register("name")}
            />
            {errors.name ? <div className="form-error">{errors.name.message}</div> : null}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor={colorInputId}>{t("common.field.color")}</label>
            <input id={colorInputId} className="branch-color-input" type="color" {...register("colorHex")} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={systemLimitId}>{t("trainingBranchForm.field.systemLimit")}</label>
            <input
              id={systemLimitId}
              className="form-input"
              disabled
              readOnly
              value={editing?.totalLessonHourLimit ?? t("trainingBranchForm.systemLimit.unlimited")}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
