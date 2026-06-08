import { useEffect, useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { addAssignmentDocument } from "../../lib/instructor-assignments-api";
import { useT } from "../../lib/i18n";
import type { InstructorAssignmentDocument } from "../../lib/types";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

type Props = {
  open: boolean;
  canManage?: boolean;
  instructorId: string;
  assignmentId: string;
  onClose: () => void;
  onSaved: (doc: InstructorAssignmentDocument) => void;
};

export function AssignmentDocumentFormModal({
  open,
  canManage = true,
  instructorId,
  assignmentId,
  onClose,
  onSaved,
}: Props) {
  const queryClient = useQueryClient();
  const t = useT();
  const { showToast } = useToast();
  const noPermissionTitle = t("common.noPermission");
  const [name, setName] = useState("");
  const nameInputId = useId();
  const descriptionInputId = useId();
  const fileInputId = useId();
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidateAssignmentDocumentDependents = () => {
    void queryClient.invalidateQueries({ queryKey: ["instructorAssignments", instructorId] });
    void queryClient.invalidateQueries({ queryKey: ["instructors", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["instructors", "detail"] });
    void queryClient.invalidateQueries({ queryKey: ["instructors", "detail", instructorId] });
    void queryClient.invalidateQueries({ queryKey: ["training", "instructors"] });
    void queryClient.invalidateQueries({ queryKey: ["training", "lessons"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

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
    if (!canManage) return;
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
      invalidateAssignmentDocumentDependents();
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
    >
      <form className="settings-form" onSubmit={submit}>
        {error && <div className="form-error form-error-banner">{error}</div>}

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor={nameInputId}>
              {t("settings.instructors.detail.assignments.documents.field.name")}
            </label>
            <input
              id={nameInputId}
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
            <label className="form-label" htmlFor={descriptionInputId}>
              {t("settings.instructors.detail.assignments.documents.field.description")}
            </label>
            <textarea
              id={descriptionInputId}
              className="form-input"
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              value={description}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor={fileInputId}>
              {t("settings.instructors.detail.assignments.documents.field.file")}
            </label>
            <input
              id={fileInputId}
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
