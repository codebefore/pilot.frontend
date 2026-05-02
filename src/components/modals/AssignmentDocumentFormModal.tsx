import { useEffect, useState } from "react";

import { addAssignmentDocument } from "../../lib/instructor-assignments-api";
import { useT } from "../../lib/i18n";
import type { InstructorAssignmentDocument } from "../../lib/types";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

type Props = {
  open: boolean;
  instructorId: string;
  assignmentId: string;
  onClose: () => void;
  onSaved: (doc: InstructorAssignmentDocument) => void;
};

export function AssignmentDocumentFormModal({
  open,
  instructorId,
  assignmentId,
  onClose,
  onSaved,
}: Props) {
  const t = useT();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setFile(null);
    setError(null);
  }, [open]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!name.trim()) {
      setError(t("settings.instructors.detail.assignments.documents.errors.nameRequired"));
      return;
    }

    setSubmitting(true);
    try {
      const saved = await addAssignmentDocument(instructorId, assignmentId, {
        name: name.trim(),
        description: description.trim() || null,
        file,
      });
      showToast(t("settings.instructors.detail.assignments.documents.toasts.added"));
      onSaved(saved);
    } catch {
      showToast(t("settings.instructors.detail.assignments.documents.errors.saveFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("settings.instructors.detail.assignments.documents.modal.title")}
      footer={
        <>
          <button className="btn btn-secondary" disabled={submitting} onClick={onClose} type="button">
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" disabled={submitting} onClick={submit} type="button">
            {submitting ? t("common.saving") : t("common.save")}
          </button>
        </>
      }
    >
      <form className="settings-form" onSubmit={submit}>
        {error && <div className="form-error form-error-banner">{error}</div>}

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              {t("settings.instructors.detail.assignments.documents.field.name")}
            </label>
            <input
              autoFocus
              className="form-input"
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              type="text"
              value={name}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              {t("settings.instructors.detail.assignments.documents.field.description")}
            </label>
            <textarea
              className="form-input"
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              value={description}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              {t("settings.instructors.detail.assignments.documents.field.file")}
            </label>
            <input
              className="form-input"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              type="file"
            />
            {file && <div className="form-hint">{file.name}</div>}
          </div>
        </div>
      </form>
    </Modal>
  );
}
