import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { BellIcon, CheckIcon, PencilIcon, PlusIcon, TrashIcon } from "../icons";
import { NoteComposerModal, type NoteDraft } from "../notes/NoteComposerModal";
import { Panel } from "../ui/Panel";
import { useToast } from "../ui/Toast";
import { useAuth } from "../../lib/auth";
import { isAbortError } from "../../lib/http";
import { canManageArea } from "../../lib/permissions";
import { useT } from "../../lib/i18n";
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
  const { user, permissions } = useAuth();
  const canManageCandidates = canManageArea(user, permissions, "candidates");
  const t = useT();
  const queryClient = useQueryClient();
  const noPermissionTitle = t("common.noPermission");
  const [notes, setNotes] = useState<CandidateNoteResponse[] | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<CandidateNoteResponse | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await getCandidateNotes(candidateId, signal);
      if (signal?.aborted) return;
      setNotes(response.items);
    } catch (error) {
      if (isAbortError(error)) return;
      showToast(t("notesPanel.toast.loadFailed"), "error");
    }
  }, [candidateId, showToast, t]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const beginCreate = () => {
    if (!canManageCandidates) return;
    setEditing(null);
    setComposerOpen(true);
  };

  const beginEdit = (note: CandidateNoteResponse) => {
    if (!canManageCandidates) return;
    setEditing(note);
    setComposerOpen(true);
  };

  const closeComposer = () => {
    setComposerOpen(false);
    setEditing(null);
  };

  const invalidateNoteDependents = () => {
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const handleSubmit = async ({ body, reminderAtUtc }: NoteDraft) => {
    if (!canManageCandidates) return;

    setSaving(true);
    try {
      if (editing) {
        await updateCandidateNote(candidateId, editing.id, { body, reminderAtUtc });
        showToast(t("notesPanel.toast.noteUpdated"));
      } else {
        await createCandidateNote(candidateId, { body, reminderAtUtc });
        showToast("Not eklendi");
      }
      closeComposer();
      await load();
      invalidateNoteDependents();
    } catch {
      showToast(t(editing ? "notesPanel.toast.noteUpdateFailed" : "notesPanel.toast.noteAddFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (note: CandidateNoteResponse) => {
    if (!canManageCandidates) return;

    try {
      await setCandidateNoteCompletion(candidateId, note.id, note.completedAtUtc === null);
      await load();
      invalidateNoteDependents();
    } catch {
      showToast(t("notesPanel.toast.noteUpdateFailed"), "error");
    }
  };

  const handleDelete = async (note: CandidateNoteResponse) => {
    if (!canManageCandidates) return;

    try {
      await deleteCandidateNote(candidateId, note.id);
      await load();
      invalidateNoteDependents();
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
            disabled={!canManageCandidates}
            onClick={beginCreate}
            title={!canManageCandidates ? noPermissionTitle : undefined}
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
          <div className="user-notes-empty">{t("notesPanel.loading")}</div>
        ) : notes.length === 0 ? (
          <div className="user-notes-empty">{t("notesPanel.emptyCandidate")}</div>
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
              return (
                <li
                  className={`user-notes-item${completed ? " is-completed" : ""}${overdue ? " is-overdue" : ""}`}
                  key={note.id}
                >
                    <button
                      aria-label={completed ? t("notesPanel.aria.uncomplete") : t("notesPanel.aria.complete")}
                      className="user-notes-item-toggle"
                      disabled={!canManageCandidates}
                      onClick={() => void handleToggle(note)}
                      title={!canManageCandidates ? noPermissionTitle : undefined}
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
                      {author ? <span className="user-notes-item-meta">{author}</span> : null}
                    </div>
                  </div>
                  <div className="user-notes-item-actions">
                    <button
                      aria-label={t("common.edit")}
                      className="user-notes-item-action"
                      disabled={!canManageCandidates}
                      onClick={() => beginEdit(note)}
                      title={!canManageCandidates ? noPermissionTitle : undefined}
                      type="button"
                    >
                      <PencilIcon size={14} />
                    </button>
                    <button
                      aria-label="Sil"
                      className="user-notes-item-action is-danger"
                      disabled={!canManageCandidates}
                      onClick={() => void handleDelete(note)}
                      title={!canManageCandidates ? noPermissionTitle : undefined}
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
