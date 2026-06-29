import { useEffect, useState } from "react";

import { ClockIcon } from "../icons";
import { LocalizedDateInput } from "../ui/LocalizedDateInput";
import { LocalizedTimeInput } from "../ui/LocalizedTimeInput";
import { Modal } from "../ui/Modal";
import { useT } from "../../lib/i18n";

export type NoteDraft = {
  body: string;
  reminderAtUtc: string | null;
  isVisibleToInstitution: boolean;
  addToTasks: boolean;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initialBody?: string;
  initialReminderAtUtc?: string | null;
  initialReminderDate?: string;
  placeholder?: string;
  titleCreate?: string;
  titleEdit?: string;
  fieldLabel?: string;
  reminderLabel?: string;
  reminderDateAriaLabel?: string;
  reminderTimeAriaLabel?: string;
  hideReminderLabel?: boolean;
  showVisibilityToggle?: boolean;
  initialIsVisibleToInstitution?: boolean;
  visibilityToggleLabel?: string;
  visibilityToggleHint?: string;
  showAddToTasksToggle?: boolean;
  initialAddToTasks?: boolean;
  addToTasksToggleLabel?: string;
  addToTasksToggleHint?: string;
  saving?: boolean;
  onCancel: () => void;
  onSubmit: (draft: NoteDraft) => Promise<void> | void;
};

export function NoteComposerModal({
  open,
  mode,
  initialBody = "",
  initialReminderAtUtc = null,
  initialReminderDate = "",
  placeholder,
  titleCreate,
  titleEdit,
  fieldLabel,
  reminderLabel,
  reminderDateAriaLabel,
  reminderTimeAriaLabel,
  hideReminderLabel = false,
  showVisibilityToggle = false,
  initialIsVisibleToInstitution = false,
  visibilityToggleLabel = "Herkese göster",
  visibilityToggleHint = "Kapalıysa sadece sen görürsün.",
  showAddToTasksToggle = false,
  initialAddToTasks = false,
  addToTasksToggleLabel = "Görevlere ekle",
  addToTasksToggleHint = "Tarih seçilmezse eklenme tarihi kullanılır.",
  saving = false,
  onCancel,
  onSubmit,
}: Props) {
  const t = useT();
  const effectivePlaceholder = placeholder ?? t("noteComposer.placeholder.default");
  const effectiveFieldLabel = fieldLabel ?? t("noteComposer.field.note");
  const effectiveReminderLabel = reminderLabel ?? t("noteComposer.label.reminderOptional");
  const effectiveReminderDateAriaLabel = reminderDateAriaLabel ?? t("noteComposer.aria.reminderDate");
  const effectiveReminderTimeAriaLabel = reminderTimeAriaLabel ?? t("noteComposer.aria.reminderTime");
  const [body, setBody] = useState(initialBody);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [isVisibleToInstitution, setIsVisibleToInstitution] = useState(initialIsVisibleToInstitution);
  const [addToTasks, setAddToTasks] = useState(initialAddToTasks);

  useEffect(() => {
    if (!open) return;
    setBody(initialBody);
    setIsVisibleToInstitution(initialIsVisibleToInstitution);
    setAddToTasks(initialAddToTasks);
    if (initialReminderAtUtc) {
      const parts = splitLocalParts(initialReminderAtUtc);
      setReminderDate(parts.date);
      setReminderTime(parts.time);
    } else {
      setReminderDate(initialReminderDate);
      setReminderTime("");
    }
  }, [open, initialBody, initialReminderAtUtc, initialReminderDate, initialIsVisibleToInstitution, initialAddToTasks]);

  const trimmed = body.trim();
  const submitDisabled = !trimmed || saving;

  const handleSubmit = () => {
    if (submitDisabled) return;
    const reminderAtUtc = reminderDate
      ? combineLocalToUtc(reminderDate, reminderTime || "09:00")
      : null;
    void onSubmit({ body: trimmed, reminderAtUtc, isVisibleToInstitution, addToTasks });
  };

  return (
    <Modal
      footer={
        <>
          <button
            className="btn btn-secondary"
            disabled={saving}
            onClick={onCancel}
            type="button"
          >
            {t("common.cancel")}
          </button>
          <button
            className="btn btn-primary"
            disabled={submitDisabled}
            onClick={handleSubmit}
            type="button"
          >
            {saving ? t("common.saving") : mode === "edit" ? t("noteComposer.action.update") : t("noteComposer.action.create")}
          </button>
        </>
      }
      onClose={onCancel}
      open={open}
      title={mode === "edit" ? titleEdit ?? t("noteComposer.title.edit") : titleCreate ?? t("noteComposer.title.create")}
    >
      <div className="note-composer">
        <label className="form-group">
          <span className="form-label">{effectiveFieldLabel}</span>
          <textarea
            aria-label={effectiveFieldLabel}
            className="form-input"
            onChange={(event) => setBody(event.target.value)}
            placeholder={effectivePlaceholder}
            rows={5}
            value={body}
          />
        </label>
        <div className="form-group">
          {!hideReminderLabel ? (
            <span className="form-label">
              <ClockIcon size={14} /> {effectiveReminderLabel}
            </span>
          ) : null}
          <div className="note-composer-reminder-fields">
            <LocalizedDateInput
              ariaLabel={effectiveReminderDateAriaLabel}
              onChange={setReminderDate}
              value={reminderDate}
            />
            <LocalizedTimeInput
              ariaLabel={effectiveReminderTimeAriaLabel}
              onChange={setReminderTime}
              value={reminderTime}
            />
          </div>
        </div>
        {showVisibilityToggle ? (
          <label className="note-composer-visibility switch-toggle">
            <input
              aria-label={visibilityToggleLabel}
              checked={isVisibleToInstitution}
              onChange={(event) => setIsVisibleToInstitution(event.target.checked)}
              type="checkbox"
            />
            <span className="switch-toggle-control" aria-hidden="true" />
            <span className="note-composer-visibility-text">
              <strong>{visibilityToggleLabel}</strong>
              <em>{visibilityToggleHint}</em>
            </span>
          </label>
        ) : null}
        {showAddToTasksToggle ? (
          <label className="note-composer-visibility switch-toggle">
            <input
              aria-label={addToTasksToggleLabel}
              checked={addToTasks}
              onChange={(event) => setAddToTasks(event.target.checked)}
              type="checkbox"
            />
            <span className="switch-toggle-control" aria-hidden="true" />
            <span className="note-composer-visibility-text">
              <strong>{addToTasksToggleLabel}</strong>
              <em>{addToTasksToggleHint}</em>
            </span>
          </label>
        ) : null}
      </div>
    </Modal>
  );
}

function splitLocalParts(utcIso: string): { date: string; time: string } {
  const d = new Date(utcIso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function combineLocalToUtc(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}
