import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { PageToolbar } from "../components/layout/PageToolbar";
import { CheckIcon, EditLineIcon, XIcon } from "../components/icons";
import { NoteComposerModal, type NoteDraft } from "../components/notes/NoteComposerModal";
import { NotificationListSkeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../lib/auth";
import { currentLocale, useT } from "../lib/i18n";
import { canManageArea } from "../lib/permissions";
import {
  deleteUserNote,
  getUserNotes,
  setUserNoteCompletion,
  updateUserNote,
  type UserNoteResponse,
} from "../lib/user-notes-api";

export function TasksPage() {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { user, permissions } = useAuth();
  const canManageDashboard = canManageArea(user, permissions, "dashboard");
  const noPermissionTitle = t("common.noPermission");
  const [editing, setEditing] = useState<UserNoteResponse | null>(null);
  const [deleteConfirmNoteId, setDeleteConfirmNoteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const notesQuery = useQuery({
    queryKey: ["user-notes", "tasks-page"],
    queryFn: ({ signal }) => getUserNotes(signal),
  });
  const groups = useMemo(
    () => groupNotesByDay(notesQuery.data?.items ?? [], t("notesPanel.undatedTitle")),
    [notesQuery.data?.items, t]
  );

  const invalidateNoteDependents = () => {
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["user-notes", "tasks-page"] });
  };

  const handleToggle = async (note: UserNoteResponse) => {
    if (!canManageDashboard || note.createdByUserId !== user?.id) return;
    try {
      setDeleteConfirmNoteId(null);
      await setUserNoteCompletion(note.id, note.completedAtUtc === null);
      invalidateNoteDependents();
    } catch {
      showToast("Görev güncellenemedi", "error");
    }
  };

  const handleDelete = async (note: UserNoteResponse) => {
    if (!canManageDashboard || note.createdByUserId !== user?.id) return;
    try {
      await deleteUserNote(note.id);
      setDeleteConfirmNoteId(null);
      invalidateNoteDependents();
    } catch {
      showToast("Görev silinemedi", "error");
    }
  };

  const handleSubmit = async ({ body, reminderAtUtc, isVisibleToInstitution }: NoteDraft) => {
    if (!editing || !canManageDashboard || editing.createdByUserId !== user?.id) return;
    setSaving(true);
    try {
      await updateUserNote(editing.id, {
        body,
        reminderAtUtc,
        isVisibleToInstitution,
        candidateId: editing.candidateId,
        candidateName: editing.candidateName,
      });
      showToast("Görev güncellendi");
      setEditing(null);
      invalidateNoteDependents();
    } catch {
      showToast("Görev güncellenemedi", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageToolbar title={t("tasks.title")} />

      <div className="tasks-page">
        <div className="page-content-leading">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate("/")} type="button">
            {t("common.backToDashboard")}
          </button>
        </div>
        {notesQuery.isLoading ? (
          <NotificationListSkeleton rows={8} />
        ) : groups.length === 0 ? (
          <div className="data-table-empty" style={{ padding: "48px 0", textAlign: "center" }}>
            {t("tasks.empty")}
          </div>
        ) : (
          <div className="tasks-day-groups">
            {groups.map((group) => (
              <section className="tasks-day-group" key={group.key}>
                <div className="tasks-day-heading">
                  <strong>{group.label}</strong>
                  <span>{t("tasks.count", { count: String(group.notes.length) })}</span>
                </div>
                <ul className="tasks-page-list">
                  {group.notes.map((note) => {
                    const canManageNote = canManageDashboard && note.createdByUserId === user?.id;
                    const isOwnedByAnotherUser = note.createdByUserId !== user?.id;
                    const actionRestrictionTitle = !canManageDashboard
                      ? noPermissionTitle
                      : isOwnedByAnotherUser
                        ? buildOwnerRestrictionMessage(note.createdByUserName)
                        : undefined;
                    return (
                      <li
                        className={[
                          "tasks-page-item",
                          note.completedAtUtc ? "is-completed" : "",
                          isOverdue(note) ? "is-overdue" : "",
                        ].filter(Boolean).join(" ")}
                        key={note.id}
                      >
                        <span className="tasks-page-state" aria-hidden="true" />
                        <button
                          aria-label={note.completedAtUtc ? t("notesPanel.aria.uncomplete") : t("notesPanel.aria.complete")}
                          className="tasks-page-toggle"
                          disabled={!canManageNote}
                          onClick={() => void handleToggle(note)}
                          title={actionRestrictionTitle}
                          type="button"
                        >
                          {note.completedAtUtc ? <CheckIcon size={13} /> : null}
                        </button>
                        <div className="tasks-page-time">
                          {note.reminderAtUtc ? formatTime(note.reminderAtUtc) : t("notesPanel.undatedTitle")}
                        </div>
                        <div className="tasks-page-body">
                          <div className="tasks-page-text">{note.body}</div>
                          {note.candidateId && note.candidateName ? (
                            <button
                              className="tasks-page-candidate"
                              onClick={() =>
                                navigate(`/candidates/${note.candidateId}`, {
                                  state: { returnLabel: "← Görevlere dön", returnTo: "/tasks" },
                                })
                              }
                              type="button"
                            >
                              {note.candidateName}
                            </button>
                          ) : null}
                          <div className="tasks-page-meta">
                            {note.completedAtUtc
                              ? t("tasks.status.completed", { time: formatDateTime(note.completedAtUtc) })
                              : isOverdue(note)
                                ? t("tasks.status.overdue")
                                : t("tasks.status.pending")}
                          </div>
                          {note.isVisibleToInstitution && note.createdByUserName ? (
                            <div className="tasks-page-meta">Oluşturan: {note.createdByUserName}</div>
                          ) : null}
                          {note.isVisibleToInstitution && isOwnedByAnotherUser ? (
                            <div className="tasks-page-meta">Yalnızca oluşturan kişi güncelleyebilir veya silebilir.</div>
                          ) : null}
                        </div>
                        <div className="tasks-page-actions">
                          <button
                            aria-label={t("common.edit")}
                            className="user-notes-item-action"
                            disabled={!canManageNote}
                            onClick={() => {
                              setDeleteConfirmNoteId(null);
                              setEditing(note);
                            }}
                            title={actionRestrictionTitle}
                            type="button"
                          >
                            <EditLineIcon size={14} />
                          </button>
                          <button
                            aria-label="Sil"
                            className="user-notes-item-action is-danger"
                            disabled={!canManageNote}
                            onClick={() => setDeleteConfirmNoteId(note.id)}
                            title={actionRestrictionTitle}
                            type="button"
                          >
                            <XIcon size={15} />
                          </button>
                          {deleteConfirmNoteId === note.id ? (
                            <div className="task-delete-confirm-popover" role="alertdialog" aria-label="Görev silme onayı">
                              <strong>Görev silinsin mi?</strong>
                              <span>Bu işlem geri alınamaz.</span>
                              <div className="task-delete-confirm-actions">
                                <button className="btn btn-secondary btn-sm" onClick={() => setDeleteConfirmNoteId(null)} type="button">
                                  Vazgeç
                                </button>
                                <button className="btn btn-danger btn-sm" onClick={() => void handleDelete(note)} type="button">
                                  Sil
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
      <NoteComposerModal
        fieldLabel="Görev"
        hideReminderLabel
        initialBody={editing?.body ?? ""}
        initialIsVisibleToInstitution={editing?.isVisibleToInstitution ?? false}
        initialReminderAtUtc={editing?.reminderAtUtc ?? null}
        mode="edit"
        onCancel={() => setEditing(null)}
        onSubmit={handleSubmit}
        open={editing !== null}
        placeholder="Görev içeriği..."
        reminderDateAriaLabel="Görev tarihi"
        reminderLabel="Tarih/Saat (opsiyonel)"
        reminderTimeAriaLabel="Görev saati"
        saving={saving}
        titleCreate="Yeni Görev"
        titleEdit="Görevi Düzenle"
      />
    </>
  );
}

type NoteGroup = {
  key: string;
  label: string;
  notes: UserNoteResponse[];
};

function groupNotesByDay(notes: UserNoteResponse[], undatedLabel: string): NoteGroup[] {
  const sorted = [...notes].sort(compareNotes);
  const groups = new Map<string, NoteGroup>();

  for (const note of sorted) {
    const key = note.reminderAtUtc ? toLocalDateKey(new Date(note.reminderAtUtc)) : "undated";
    const label = note.reminderAtUtc ? formatDayLabel(key) : undatedLabel;
    const group = groups.get(key) ?? { key, label, notes: [] };
    group.notes.push(note);
    groups.set(key, group);
  }

  return [...groups.values()];
}

function compareNotes(left: UserNoteResponse, right: UserNoteResponse): number {
  const leftTime = left.reminderAtUtc ? new Date(left.reminderAtUtc).getTime() : Number.POSITIVE_INFINITY;
  const rightTime = right.reminderAtUtc ? new Date(right.reminderAtUtc).getTime() : Number.POSITIVE_INFINITY;
  if (leftTime !== rightTime) return leftTime - rightTime;
  return new Date(right.createdAtUtc).getTime() - new Date(left.createdAtUtc).getTime();
}

function isOverdue(note: UserNoteResponse): boolean {
  return (
    note.completedAtUtc === null &&
    note.reminderAtUtc !== null &&
    new Date(note.reminderAtUtc).getTime() <= Date.now()
  );
}

function buildOwnerRestrictionMessage(createdByUserName?: string | null): string {
  const owner = createdByUserName ? `Görevi ${createdByUserName} oluşturdu. ` : "";
  return `${owner}Yalnızca oluşturan kişi güncelleyebilir veya silebilir.`;
}

function formatDayLabel(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  return date.toLocaleDateString(currentLocale(), {
    day: "numeric",
    month: "long",
    weekday: "long",
  });
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString(currentLocale(), {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(currentLocale(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
