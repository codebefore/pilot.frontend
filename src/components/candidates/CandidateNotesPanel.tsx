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
import { createUserNote } from "../../lib/user-notes-api";

type Props = {
  candidateId: string;
  candidateName?: string | null;
};

export function CandidateNotesPanel({ candidateId, candidateName }: Props) {
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    setConfirmDeleteId(null);
    setComposerOpen(true);
  };

  const beginEdit = (note: CandidateNoteResponse) => {
    if (!canManageCandidates) return;
    setEditing(note);
    setConfirmDeleteId(null);
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

  const handleSubmit = async ({ body, reminderAtUtc, addToTasks }: NoteDraft) => {
    if (!canManageCandidates) return;

    setSaving(true);
    try {
      if (editing) {
        await updateCandidateNote(candidateId, editing.id, { body, reminderAtUtc });
        showToast(t("notesPanel.toast.noteUpdated"));
      } else {
        const createdNote = await createCandidateNote(candidateId, { body, reminderAtUtc });
        if (addToTasks) {
          await createUserNote({
            body,
            reminderAtUtc: reminderAtUtc ?? createdNote.createdAtUtc,
            isVisibleToInstitution: false,
            candidateId,
            candidateName: candidateName?.trim() || null,
          });
        }
        showToast(addToTasks ? "Not eklendi, görev oluşturuldu" : "Not eklendi");
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
    if (!canManageCandidates || deletingId) return;

    setDeletingId(note.id);
    try {
      await deleteCandidateNote(candidateId, note.id);
      setConfirmDeleteId(null);
      await load();
      invalidateNoteDependents();
    } catch {
      showToast("Not silinemedi", "error");
    } finally {
      setDeletingId(null);
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
              const isConfirmingDelete = confirmDeleteId === note.id;
              const isDeleting = deletingId === note.id;
              return (
                <li
                  className={`user-notes-item${completed ? " is-completed" : ""}${overdue ? " is-overdue" : ""}${isConfirmingDelete ? " has-delete-popover" : ""}`}
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
                      disabled={!canManageCandidates || isDeleting}
                      onClick={() => beginEdit(note)}
                      title={!canManageCandidates ? noPermissionTitle : undefined}
                      type="button"
                    >
                      <PencilIcon size={14} />
                    </button>
                    <button
                      aria-label="Sil"
                      className="user-notes-item-action is-danger"
                      disabled={!canManageCandidates || isDeleting}
                      onClick={() => setConfirmDeleteId(isConfirmingDelete ? null : note.id)}
                      title={!canManageCandidates ? noPermissionTitle : undefined}
                      type="button"
                    >
                      <TrashIcon size={14} />
                    </button>
                    {isConfirmingDelete ? (
                      <div
                        aria-label="Not silme onayı"
                        className="user-notes-delete-popover"
                        role="alertdialog"
                      >
                        <div className="user-notes-delete-popover-title">Not silinsin mi?</div>
                        <div className="user-notes-delete-popover-actions">
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={isDeleting}
                            onClick={() => setConfirmDeleteId(null)}
                            type="button"
                          >
                            Vazgeç
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            disabled={isDeleting}
                            onClick={() => void handleDelete(note)}
                            type="button"
                          >
                            {isDeleting ? "Siliniyor..." : "Sil"}
                          </button>
                        </div>
                      </div>
                    ) : null}
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
        showAddToTasksToggle={!editing}
      />
    </>
  );
}

function formatReminder(utcIso: string): string {
  const d = new Date(utcIso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
