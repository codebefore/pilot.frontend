import { useCallback, useEffect, useState } from "react";

import { BellIcon, CheckIcon, PencilIcon, PlusIcon, TrashIcon } from "../icons";
import { NoteComposerModal, type NoteDraft } from "../notes/NoteComposerModal";
import { Panel } from "../ui/Panel";
import { useToast } from "../ui/Toast";
import {
  createCandidateNote,
  deleteCandidateNote,
  getCandidateNotes,
  setCandidateNoteCompletion,
  updateCandidateNote,
  type CandidateNoteResponse,
} from "../../lib/candidate-notes-api";

type Props = {
  candidateId: string;
};

export function CandidateNotesPanel({ candidateId }: Props) {
  const { showToast } = useToast();
  const [notes, setNotes] = useState<CandidateNoteResponse[] | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<CandidateNoteResponse | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await getCandidateNotes(candidateId);
      setNotes(response.items);
    } catch {
      showToast("Notlar yüklenemedi", "error");
    }
  }, [candidateId, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const beginCreate = () => {
    setEditing(null);
    setComposerOpen(true);
  };

  const beginEdit = (note: CandidateNoteResponse) => {
    setEditing(note);
    setComposerOpen(true);
  };

  const closeComposer = () => {
    setComposerOpen(false);
    setEditing(null);
  };

  const handleSubmit = async ({ body, reminderAtUtc }: NoteDraft) => {
    setSaving(true);
    try {
      if (editing) {
        await updateCandidateNote(candidateId, editing.id, { body, reminderAtUtc });
        showToast("Not güncellendi");
      } else {
        await createCandidateNote(candidateId, { body, reminderAtUtc });
        showToast("Not eklendi");
      }
      closeComposer();
      await load();
    } catch {
      showToast(editing ? "Not güncellenemedi" : "Not eklenemedi", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (note: CandidateNoteResponse) => {
    try {
      await setCandidateNoteCompletion(candidateId, note.id, note.completedAtUtc === null);
      await load();
    } catch {
      showToast("Not güncellenemedi", "error");
    }
  };

  const handleDelete = async (note: CandidateNoteResponse) => {
    try {
      await deleteCandidateNote(candidateId, note.id);
      await load();
    } catch {
      showToast("Not silinemedi", "error");
    }
  };

  return (
    <>
      <Panel
        action={
          <button className="panel-action" onClick={beginCreate} type="button">
            <PlusIcon size={14} /> Yeni Not
          </button>
        }
        icon={
          <span className="icon-brand">
            <PencilIcon />
          </span>
        }
        title="Notlar"
      >
        {notes === null ? (
          <div className="user-notes-empty">Yükleniyor...</div>
        ) : notes.length === 0 ? (
          <div className="user-notes-empty">Bu aday için henüz not yok.</div>
        ) : (
          <ul className="user-notes-list">
            {notes.map((note) => {
              const completed = note.completedAtUtc !== null;
              const reminderText = note.reminderAtUtc ? formatReminder(note.reminderAtUtc) : null;
              const overdue =
                !completed &&
                note.reminderAtUtc !== null &&
                new Date(note.reminderAtUtc).getTime() <= Date.now();
              const author = note.createdByName?.trim() || null;
              const authoredText = author
                ? `${author} · ${formatReminder(note.createdAtUtc)}`
                : formatReminder(note.createdAtUtc);
              return (
                <li
                  className={`user-notes-item${completed ? " is-completed" : ""}${overdue ? " is-overdue" : ""}`}
                  key={note.id}
                >
                  <button
                    aria-label={completed ? "Tamamlandı işaretini kaldır" : "Tamamlandı olarak işaretle"}
                    className="user-notes-item-toggle"
                    onClick={() => void handleToggle(note)}
                    type="button"
                  >
                    {completed ? <CheckIcon size={12} /> : null}
                  </button>
                  <div className="user-notes-item-body">
                    <div className="user-notes-item-text">{note.body}</div>
                    <div className="user-notes-item-footer">
                      {reminderText ? (
                        <span className="user-notes-item-reminder">
                          <BellIcon size={12} /> {reminderText}
                        </span>
                      ) : null}
                      <span className="user-notes-item-meta">{authoredText}</span>
                    </div>
                  </div>
                  <div className="user-notes-item-actions">
                    <button
                      aria-label="Düzenle"
                      className="user-notes-item-action"
                      onClick={() => beginEdit(note)}
                      type="button"
                    >
                      <PencilIcon size={14} />
                    </button>
                    <button
                      aria-label="Sil"
                      className="user-notes-item-action is-danger"
                      onClick={() => void handleDelete(note)}
                      type="button"
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <NoteComposerModal
        initialBody={editing?.body ?? ""}
        initialReminderAtUtc={editing?.reminderAtUtc ?? null}
        mode={editing ? "edit" : "create"}
        onCancel={closeComposer}
        onSubmit={handleSubmit}
        open={composerOpen}
        placeholder="Bu adayla ilgili not..."
        saving={saving}
      />
    </>
  );
}

function formatReminder(utcIso: string): string {
  const d = new Date(utcIso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
