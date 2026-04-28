import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { updateTrainingBranchDefinition } from "../../lib/training-branch-definitions-api";
import type {
  TrainingBranchDefinitionResponse,
  TrainingBranchDefinitionUpsertRequest,
} from "../../lib/types";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

type TrainingBranchFormValues = {
  name: string;
  totalLessonHourLimit: string;
  colorHex: string;
  isActive: boolean;
  notes: string;
};

type TrainingBranchFormModalProps = {
  open: boolean;
  editing: TrainingBranchDefinitionResponse | null;
  onClose: () => void;
  onSaved: (saved: TrainingBranchDefinitionResponse) => void;
};

const DEFAULT_VALUES: TrainingBranchFormValues = {
  name: "",
  totalLessonHourLimit: "",
  colorHex: "#3e5660",
  isActive: true,
  notes: "",
};

function getValues(editing: TrainingBranchDefinitionResponse | null): TrainingBranchFormValues {
  if (!editing) return DEFAULT_VALUES;
  return {
    name: editing.name,
    totalLessonHourLimit: editing.totalLessonHourLimit?.toString() ?? "",
    colorHex: editing.colorHex,
    isActive: editing.isActive,
    notes: editing.notes ?? "",
  };
}

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function buildPayload(
  values: TrainingBranchFormValues,
  editing: TrainingBranchDefinitionResponse | null
): TrainingBranchDefinitionUpsertRequest {
  return {
    code: editing?.code ?? "",
    name: values.name.trim(),
    totalLessonHourLimit: parseOptionalNumber(values.totalLessonHourLimit),
    colorHex: values.colorHex.trim() || "#3e5660",
    displayOrder: editing?.displayOrder ?? 1000,
    isActive: values.isActive,
    notes: values.notes.trim() || null,
    ...(editing ? { rowVersion: editing.rowVersion } : {}),
  };
}

export function TrainingBranchFormModal({
  open,
  editing,
  onClose,
  onSaved,
}: TrainingBranchFormModalProps) {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<TrainingBranchFormValues>({
    defaultValues: getValues(editing),
  });

  useEffect(() => {
    if (!open) return;
    reset(getValues(editing));
  }, [editing, open, reset]);

  const submit = handleSubmit(async (values) => {
    if (!editing) return;
    setSubmitting(true);
    try {
      const payload = buildPayload(values, editing);
      const saved = await updateTrainingBranchDefinition(editing.id, payload);
      onSaved(saved);
    } catch (error) {
      console.error(error);
      showToast("Branş kaydedilemedi", "error");
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
            İptal
          </button>
          <button className="btn btn-primary" disabled={submitting} onClick={submit} type="button">
            {submitting ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title="Branş Düzenle"
    >
      <form className="settings-form" onSubmit={submit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Ad</label>
            <input
              className={fieldClass(errors.name?.message)}
              placeholder="Trafik ve Çevre"
              {...register("name", { required: "Ad zorunlu" })}
            />
            {errors.name ? <div className="form-error">{errors.name.message}</div> : null}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Toplam Saat</label>
            <input className="form-input" min={0} type="number" {...register("totalLessonHourLimit")} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Renk</label>
            <input className="branch-color-input" type="color" {...register("colorHex")} />
          </div>
          <div className="form-group">
            <label className="form-label">Genel Durum</label>
            <label className="switch-toggle">
              <input type="checkbox" {...register("isActive")} />
              <span aria-hidden="true" className="switch-toggle-control" />
              <span>Aktif</span>
            </label>
          </div>
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">Not</label>
            <textarea className="form-textarea" rows={3} {...register("notes")} />
          </div>
        </div>
      </form>
    </Modal>
  );
}
