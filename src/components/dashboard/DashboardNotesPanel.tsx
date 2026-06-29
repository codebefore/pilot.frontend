import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { CalendarIcon, CheckIcon, EditLineIcon, XIcon } from "../icons";
import { NoteComposerModal, type NoteDraft } from "../notes/NoteComposerModal";
import { Panel } from "../ui/Panel";
import { useToast } from "../ui/Toast";
import { useAuth } from "../../lib/auth";
import { isAbortError } from "../../lib/http";
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

const calendarWeekdays = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export function DashboardNotesPanel() {
  const { showToast } = useToast();
  const { user, permissions } = useAuth();
  const canManageDashboard = canManageArea(user, permissions, "dashboard");
  const t = useT();
  const queryClient = useQueryClient();
  const noPermissionTitle = t("common.noPermission");
  const [notes, setNotes] = useState<UserNoteResponse[] | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<UserNoteResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateKey(new Date()));
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await getUserNotes(signal);
      if (signal?.aborted) return;
      setNotes(response.items);
    } catch (error) {
      if (isAbortError(error)) return;
      showToast(t("notesPanel.toast.loadFailed"), "error");
    }
  }, [showToast, t]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
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

  const invalidateNoteDependents = () => {
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const handleSubmit = async ({ body, reminderAtUtc }: NoteDraft) => {
    if (!canManageDashboard) return;

    setSaving(true);
    try {
      if (editing) {
        await updateUserNote(editing.id, { body, reminderAtUtc });
        showToast(t("notesPanel.toast.noteUpdated"));
      } else {
        await createUserNote({ body, reminderAtUtc });
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

  const handleToggle = async (note: UserNoteResponse) => {
    if (!canManageDashboard) return;

    try {
      await setUserNoteCompletion(note.id, note.completedAtUtc === null);
      await load();
      invalidateNoteDependents();
    } catch {
      showToast(t("notesPanel.toast.noteUpdateFailed"), "error");
    }
  };

  const handleDelete = async (note: UserNoteResponse) => {
    if (!canManageDashboard) return;

    try {
      await deleteUserNote(note.id);
      await load();
      invalidateNoteDependents();
    } catch {
      showToast("Not silinemedi", "error");
    }
  };

  const notesForSelectedDate = useMemo(() => {
    if (notes === null) return [];
    return notes.filter((note) => note.reminderAtUtc && toLocalDateKey(new Date(note.reminderAtUtc)) === selectedDate);
  }, [notes, selectedDate]);
  const undatedNotes = useMemo(() => {
    if (notes === null) return [];
    return notes.filter((note) => note.reminderAtUtc === null);
  }, [notes]);
  const reminderCountsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const note of notes ?? []) {
      if (!note.reminderAtUtc) continue;
      const key = toLocalDateKey(new Date(note.reminderAtUtc));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [notes]);
  const overdueDateKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const note of notes ?? []) {
      if (
        note.completedAtUtc === null &&
        note.reminderAtUtc !== null &&
        new Date(note.reminderAtUtc).getTime() <= Date.now()
      ) {
        keys.add(toLocalDateKey(new Date(note.reminderAtUtc)));
      }
    }
    return keys;
  }, [notes]);
  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  const selectedDateLabel = useMemo(() => formatLongDate(selectedDate), [selectedDate]);
  const visibleMonthLabel = useMemo(
    () => visibleMonth.toLocaleDateString("tr-TR", { month: "long", year: "numeric" }),
    [visibleMonth]
  );
  const selectedDateCountLabel = `${notesForSelectedDate.length} not`;

  const goToPreviousMonth = () => setVisibleMonth((current) => addMonths(current, -1));
  const goToNextMonth = () => setVisibleMonth((current) => addMonths(current, 1));
  const goToToday = () => {
    const today = new Date();
    setSelectedDate(toLocalDateKey(today));
    setVisibleMonth(startOfMonth(today));
  };
  const selectCalendarDay = (date: Date) => {
    setSelectedDate(toLocalDateKey(date));
  };

  const renderNote = (note: UserNoteResponse, variant: "dated" | "undated" = "dated") => {
    const completed = note.completedAtUtc !== null;
    const reminderTime = note.reminderAtUtc ? formatReminderTime(note.reminderAtUtc) : "Tarihsiz";
    const overdue =
      !completed &&
      note.reminderAtUtc !== null &&
      new Date(note.reminderAtUtc).getTime() <= Date.now();
    return (
      <li
        className={[
          "user-notes-item",
          "is-dashboard-note",
          completed ? "is-completed" : "",
          overdue ? "is-overdue" : "",
          variant === "undated" ? "is-undated" : "",
        ].filter(Boolean).join(" ")}
        key={note.id}
      >
        <span className="user-notes-item-state" aria-hidden="true" />
        <button
          aria-label={completed ? t("notesPanel.aria.uncomplete") : t("notesPanel.aria.complete")}
          className="user-notes-item-toggle"
          disabled={!canManageDashboard}
          onClick={() => void handleToggle(note)}
          title={!canManageDashboard ? noPermissionTitle : undefined}
          type="button"
        >
          {completed ? <CheckIcon size={12} /> : null}
        </button>
        <div className="user-notes-item-time">{reminderTime}</div>
        <div className="user-notes-item-body">
          <div className="user-notes-item-text">{note.body}</div>
        </div>
        <div className="user-notes-item-actions">
          <button
            aria-label={t("common.edit")}
            className="user-notes-item-action"
            disabled={!canManageDashboard}
            onClick={() => beginEdit(note)}
            title={!canManageDashboard ? noPermissionTitle : undefined}
            type="button"
          >
            <EditLineIcon size={14} />
          </button>
          <button
            aria-label="Sil"
            className="user-notes-item-action is-danger"
            disabled={!canManageDashboard}
            onClick={() => void handleDelete(note)}
            title={!canManageDashboard ? noPermissionTitle : undefined}
            type="button"
          >
            <XIcon size={15} />
          </button>
        </div>
      </li>
    );
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
            Yeni Not
          </button>
        }
        icon={
          <span className="icon-brand">
            <CalendarIcon />
          </span>
        }
        title="Görevler"
      >
        {notes === null ? (
          <div className="user-notes-empty">{t("notesPanel.loading")}</div>
        ) : (
          <div className="dashboard-notes-layout">
            <aside className="dashboard-notes-calendar" aria-label={t("notesPanel.calendar.aria")}>
              <div className="dashboard-notes-calendar-head">
                <button
                  aria-label={t("notesPanel.calendar.previousMonth")}
                  className="dashboard-notes-calendar-nav"
                  onClick={goToPreviousMonth}
                  type="button"
                >
                  ‹
                </button>
                <strong>{visibleMonthLabel}</strong>
                <button
                  aria-label={t("notesPanel.calendar.nextMonth")}
                  className="dashboard-notes-calendar-nav"
                  onClick={goToNextMonth}
                  type="button"
                >
                  ›
                </button>
              </div>
              <button className="dashboard-notes-today" onClick={goToToday} type="button">
                {t("notesPanel.calendar.today")}
              </button>
              <div className="dashboard-notes-weekdays" aria-hidden="true">
                {calendarWeekdays.map((weekday) => (
                  <span key={weekday}>{weekday}</span>
                ))}
              </div>
              <div className="dashboard-notes-days">
                {calendarDays.map((day) => {
                  const noteCount = reminderCountsByDate.get(day.key) ?? 0;
                  return (
                    <button
                      aria-label={`${formatLongDate(day.key)}${noteCount > 0 ? `, ${noteCount} not` : ""}`}
                      className={[
                        "dashboard-notes-day",
                        day.inCurrentMonth ? "" : "is-muted",
                        day.key === selectedDate ? "is-selected" : "",
                        day.key === toLocalDateKey(new Date()) ? "is-today" : "",
                        noteCount > 0 ? "has-notes" : "",
                        noteCount > 1 ? "has-multiple-notes" : "",
                        overdueDateKeys.has(day.key) ? "has-overdue" : "",
                      ].filter(Boolean).join(" ")}
                      key={day.key}
                      onClick={() => selectCalendarDay(day.date)}
                      type="button"
                    >
                      <span>{day.date.getDate()}</span>
                      {noteCount > 0 ? <i aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            </aside>
            <div className="dashboard-notes-main">
              <div className="dashboard-notes-selected-head">
                <div>
                  <span>{t("notesPanel.calendar.selectedDate")}</span>
                  <strong>{selectedDateLabel}</strong>
                </div>
                <em>{selectedDateCountLabel}</em>
              </div>
              {notesForSelectedDate.length > 0 ? (
                <ul className="user-notes-list is-dashboard-list">
                  {notesForSelectedDate.map((note) => renderNote(note))}
                </ul>
              ) : (
                <div className="user-notes-empty is-selected-date-empty">
                  {t("notesPanel.emptySelectedDate")}
                </div>
              )}
              {undatedNotes.length > 0 ? (
                <section className="dashboard-notes-undated">
                  <h3>{t("notesPanel.undatedTitle")}</h3>
                  <ul className="user-notes-list is-dashboard-list is-undated-list">
                    {undatedNotes.map((note) => renderNote(note, "undated"))}
                  </ul>
                </section>
              ) : null}
            </div>
          </div>
        )}
      </Panel>

      <NoteComposerModal
        initialBody={editing?.body ?? ""}
        initialReminderDate={editing ? "" : selectedDate}
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

function buildCalendarDays(month: Date): { date: Date; key: string; inCurrentMonth: boolean }[] {
  const firstDay = startOfMonth(month);
  const offset = (firstDay.getDay() + 6) % 7;
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - offset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      key: toLocalDateKey(date),
      inCurrentMonth: date.getMonth() === month.getMonth(),
    };
  });
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function toLocalDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatLongDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    weekday: "long",
  });
}

function formatReminderTime(utcIso: string): string {
  const d = new Date(utcIso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
