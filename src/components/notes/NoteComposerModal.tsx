import { useEffect, useState } from "react";

import { ClockIcon } from "../icons";
import { LocalizedDateInput } from "../ui/LocalizedDateInput";
import { LocalizedTimeInput } from "../ui/LocalizedTimeInput";
import { Modal } from "../ui/Modal";
import { useT } from "../../lib/i18n";

export type NoteDraft = {
  body: string;
  reminderAtUtc: string | null;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initialBody?: string;
  initialReminderAtUtc?: string | null;
  initialReminderDate?: string;
  placeholder?: string;
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
  saving = false,
  onCancel,
  onSubmit,
}: Props) {
  const t = useT();
  const effectivePlaceholder = placeholder ?? t("noteComposer.placeholder.default");
  const [body, setBody] = useState(initialBody);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");

  useEffect(() => {
    if (!open) return;
    setBody(initialBody);
    if (initialReminderAtUtc) {
      const parts = splitLocalParts(initialReminderAtUtc);
      setReminderDate(parts.date);
      setReminderTime(parts.time);
    } else {
      setReminderDate(initialReminderDate);
      setReminderTime("");
    }
  }, [open, initialBody, initialReminderAtUtc, initialReminderDate]);

  const trimmed = body.trim();
  const submitDisabled = !trimmed || saving;

  const handleSubmit = () => {
    if (submitDisabled) return;
    const reminderAtUtc = reminderDate
      ? combineLocalToUtc(reminderDate, reminderTime || "09:00")
      : null;
    void onSubmit({ body: trimmed, reminderAtUtc });
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
      title={mode === "edit" ? t("noteComposer.title.edit") : t("noteComposer.title.create")}
    >
      <div className="note-composer">
        <label className="form-group">
          <span className="form-label">{t("noteComposer.field.note")}</span>
          <textarea
            aria-label={t("noteComposer.field.note")}
            className="form-input"
            onChange={(event) => setBody(event.target.value)}
            placeholder={effectivePlaceholder}
            rows={5}
            value={body}
          />
        </label>
        <div className="form-group">
          <span className="form-label">
            <ClockIcon size={14} /> {t("noteComposer.label.reminderOptional")}
          </span>
          <div className="note-composer-reminder-fields">
            <LocalizedDateInput
              ariaLabel={t("noteComposer.aria.reminderDate")}
              onChange={setReminderDate}
              value={reminderDate}
            />
            <LocalizedTimeInput
              ariaLabel={t("noteComposer.aria.reminderTime")}
              onChange={setReminderTime}
              value={reminderTime}
            />
          </div>
        </div>
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
