import { useCallback, useEffect, useState } from "react";

import { BellIcon, CheckIcon, PencilIcon, PlusIcon, TrashIcon } from "../icons";
import { NoteComposerModal, type NoteDraft } from "../notes/NoteComposerModal";
import { Panel } from "../ui/Panel";
import { useToast } from "../ui/Toast";
import { useAuth } from "../../lib/auth";
import { canManageArea } from "../../lib/permissions";
import { useT } from "../../lib/i18n";
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
  const { user, permissions } = useAuth();
  const canManageDashboard = canManageArea(user, permissions, "dashboard");
  const t = useT();
  const noPermissionTitle = t("common.noPermission");
  const [notes, setNotes] = useState<UserNoteResponse[] | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<UserNoteResponse | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await getUserNotes();
      setNotes(response.items);
    } catch {
      showToast("Notlar yüklenemedi", "error");
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const beginCreate = () => {
    if (!canManageDashboard) return;
    setEditing(null);
    setComposerOpen(true);
  };

  const beginEdit = (note: UserNoteResponse) => {
    if (!canManageDashboard) return;
    setEditing(note);
    setComposerOpen(true);
  };

  const closeComposer = () => {
    setComposerOpen(false);
    setEditing(null);
  };

  const handleSubmit = async ({ body, reminderAtUtc }: NoteDraft) => {
    if (!canManageDashboard) return;

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
    if (!canManageDashboard) return;

    try {
      await setUserNoteCompletion(note.id, note.completedAtUtc === null);
      await load();
    } catch {
      showToast("Not güncellenemedi", "error");
    }
  };

  const handleDelete = async (note: UserNoteResponse) => {
    if (!canManageDashboard) return;

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
          <button
            className="panel-action"
            disabled={!canManageDashboard}
            onClick={beginCreate}
            title={!canManageDashboard ? noPermissionTitle : undefined}
            type="button"
          >
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
                    disabled={!canManageDashboard}
                    onClick={() => void handleToggle(note)}
                    title={!canManageDashboard ? noPermissionTitle : undefined}
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
                      disabled={!canManageDashboard}
                      onClick={() => beginEdit(note)}
                      title={!canManageDashboard ? noPermissionTitle : undefined}
                      type="button"
                    >
                      <PencilIcon size={14} />
                    </button>
                    <button
                      aria-label="Sil"
                      className="user-notes-item-action is-danger"
                      disabled={!canManageDashboard}
                      onClick={() => void handleDelete(note)}
                      title={!canManageDashboard ? noPermissionTitle : undefined}
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
