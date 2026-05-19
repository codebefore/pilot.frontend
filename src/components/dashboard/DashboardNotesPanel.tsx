import { useEffect, useState } from "react";

import { BellIcon, CheckIcon, PencilIcon, PlusIcon, TrashIcon } from "../icons";
import { NoteComposerModal, type NoteDraft } from "../notes/NoteComposerModal";
import { Panel } from "../ui/Panel";
import { useToast } from "../ui/Toast";
import {
  createUserNote,
  deleteUserNote,
  getUserNotes,
  setUserNoteCompletion,
  updateUserNote,
  type UserNoteResponse,
} from "../../lib/user-notes-api";

export function DashboardNotesPanel() {
  const { showToast } = useToast();
  const [notes, setNotes] = useState<UserNoteResponse[] | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<UserNoteResponse | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const response = await getUserNotes();
      setNotes(response.items);
    } catch {
      showToast("Notlar yüklenemedi", "error");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beginCreate = () => {
    setEditing(null);
    setComposerOpen(true);
  };

  const beginEdit = (note: UserNoteResponse) => {
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
        await updateUserNote(editing.id, { body, reminderAtUtc });
        showToast("Not güncellendi");
      } else {
        await createUserNote({ body, reminderAtUtc });
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

  const handleToggle = async (note: UserNoteResponse) => {
    try {
      await setUserNoteCompletion(note.id, note.completedAtUtc === null);
      await load();
    } catch {
      showToast("Not güncellenemedi", "error");
    }
  };

  const handleDelete = async (note: UserNoteResponse) => {
    try {
      await deleteUserNote(note.id);
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
          <div className="user-notes-empty">Henüz not yok. Yeni not ekleyebilirsin.</div>
        ) : (
          <ul className="user-notes-list">
            {notes.map((note) => {
              const completed = note.completedAtUtc !== null;
              const reminderText = note.reminderAtUtc ? formatReminder(note.reminderAtUtc) : null;
              const overdue =
                !completed &&
                note.reminderAtUtc !== null &&
                new Date(note.reminderAtUtc).getTime() <= Date.now();
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
                    {reminderText ? (
                      <div className="user-notes-item-footer">
                        <span className="user-notes-item-reminder">
                          <BellIcon size={12} /> {reminderText}
                        </span>
                      </div>
                    ) : null}
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
