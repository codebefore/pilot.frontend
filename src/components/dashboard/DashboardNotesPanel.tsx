import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { CheckIcon, EditLineIcon, XIcon } from "../icons";
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
const TURKEY_FIXED_PUBLIC_HOLIDAYS = new Map([
  ["01-01", "Yılbaşı"],
  ["04-23", "Ulusal Egemenlik ve Çocuk Bayramı"],
  ["05-01", "Emek ve Dayanışma Günü"],
  ["05-19", "Atatürk'ü Anma, Gençlik ve Spor Bayramı"],
  ["07-15", "Demokrasi ve Milli Birlik Günü"],
  ["08-30", "Zafer Bayramı"],
  ["10-28", "Cumhuriyet Bayramı arifesi"],
  ["10-29", "Cumhuriyet Bayramı"],
]);
const TURKEY_2026_MOVABLE_PUBLIC_HOLIDAYS = new Map([
  ["2026-03-19", "Ramazan Bayramı arifesi"],
  ["2026-03-20", "Ramazan Bayramı"],
  ["2026-03-21", "Ramazan Bayramı"],
  ["2026-03-22", "Ramazan Bayramı"],
  ["2026-05-26", "Kurban Bayramı arifesi"],
  ["2026-05-27", "Kurban Bayramı"],
  ["2026-05-28", "Kurban Bayramı"],
  ["2026-05-29", "Kurban Bayramı"],
  ["2026-05-30", "Kurban Bayramı"],
]);

export function DashboardNotesPanel() {
  const { showToast } = useToast();
  const { user, permissions } = useAuth();
  const canManageDashboard = canManageArea(user, permissions, "dashboard");
  const t = useT();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const noPermissionTitle = t("common.noPermission");
  const [notes, setNotes] = useState<UserNoteResponse[] | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<UserNoteResponse | null>(null);
  const [deleteConfirmNoteId, setDeleteConfirmNoteId] = useState<string | null>(null);
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
      setNotes([]);
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

  const handleSubmit = async ({ body, reminderAtUtc, isVisibleToInstitution }: NoteDraft) => {
    if (!canManageDashboard) return;
    if (editing && editing.createdByUserId !== user?.id) return;

    setSaving(true);
    try {
      if (editing) {
        await updateUserNote(editing.id, {
          body,
          reminderAtUtc,
          isVisibleToInstitution,
          candidateId: editing.candidateId,
          candidateName: editing.candidateName,
        });
        showToast("Görev güncellendi");
      } else {
        await createUserNote({ body, reminderAtUtc, isVisibleToInstitution });
        showToast("Görev eklendi");
      }
      closeComposer();
      await load();
      invalidateNoteDependents();
    } catch {
      showToast(editing ? "Görev güncellenemedi" : "Görev eklenemedi", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (note: UserNoteResponse) => {
    if (!canManageDashboard || note.createdByUserId !== user?.id) return;

    try {
      setDeleteConfirmNoteId(null);
      await setUserNoteCompletion(note.id, note.completedAtUtc === null);
      await load();
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
      await load();
      invalidateNoteDependents();
    } catch {
      showToast("Görev silinemedi", "error");
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
  const visibleMonthLabel = useMemo(
    () => visibleMonth.toLocaleDateString("tr-TR", { month: "long", year: "numeric" }),
    [visibleMonth]
  );
  const selectedDateCompletedCount = notesForSelectedDate.filter((note) => note.completedAtUtc !== null).length;
  const selectedDateCountLabel = `${selectedDateCompletedCount}/${notesForSelectedDate.length}`;

  const goToPreviousMonth = () => setVisibleMonth((current) => addMonths(current, -1));
  const goToNextMonth = () => setVisibleMonth((current) => addMonths(current, 1));
  const selectCalendarDay = (date: Date) => {
    setSelectedDate(toLocalDateKey(date));
  };

  const renderNote = (note: UserNoteResponse, variant: "dated" | "undated" = "dated") => {
    const completed = note.completedAtUtc !== null;
    const canManageNote = canManageDashboard && note.createdByUserId === user?.id;
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
          disabled={!canManageNote}
          onClick={() => void handleToggle(note)}
          title={!canManageNote ? noPermissionTitle : undefined}
          type="button"
        >
          {completed ? <CheckIcon size={12} /> : null}
        </button>
        <div className="user-notes-item-time">{reminderTime}</div>
        <div className="user-notes-item-body">
          <div className="user-notes-item-text">{note.body}</div>
          {note.candidateId && note.candidateName ? (
            <button
              className="user-notes-item-candidate"
              onClick={() =>
                navigate(`/candidates/${note.candidateId}`, {
                  state: { returnLabel: "← Kokpite dön", returnTo: "/" },
                })
              }
              type="button"
            >
              {note.candidateName}
            </button>
          ) : null}
        </div>
        <div className="user-notes-item-actions">
          <button
            aria-label={t("common.edit")}
            className="user-notes-item-action"
            disabled={!canManageNote}
            onClick={() => {
              setDeleteConfirmNoteId(null);
              beginEdit(note);
            }}
            title={!canManageNote ? noPermissionTitle : undefined}
            type="button"
          >
            <EditLineIcon size={14} />
          </button>
          <button
            aria-label="Sil"
            className="user-notes-item-action is-danger"
            disabled={!canManageNote}
            onClick={() => setDeleteConfirmNoteId(note.id)}
            title={!canManageNote ? noPermissionTitle : undefined}
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
  };

  return (
    <>
      <Panel
        action={
          <div className="dashboard-notes-panel-actions">
            <button className="panel-action" onClick={() => navigate("/tasks")} type="button">
              {t("dashboard.viewAll")}
            </button>
            <button
              className="panel-action"
              disabled={!canManageDashboard}
              onClick={beginCreate}
              title={!canManageDashboard ? noPermissionTitle : undefined}
              type="button"
            >
              Yeni Görev
            </button>
          </div>
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
              <div className="dashboard-notes-weekdays" aria-hidden="true">
                {calendarWeekdays.map((weekday) => (
                  <span key={weekday}>{weekday}</span>
                ))}
              </div>
              <div className="dashboard-notes-days">
                {calendarDays.map((day) => {
                  const noteCount = reminderCountsByDate.get(day.key) ?? 0;
                  const publicHoliday = getTurkeyPublicHolidayLabel(day.key);
                  const weekend = isWeekend(day.date);
                  return (
                    <button
                      aria-label={[
                        formatLongDate(day.key),
                        publicHoliday,
                        noteCount > 0 ? `${noteCount} not` : "",
                      ].filter(Boolean).join(", ")}
                      className={[
                        "dashboard-notes-day",
                        day.inCurrentMonth ? "" : "is-muted",
                        weekend ? "is-weekend" : "",
                        publicHoliday ? "is-public-holiday" : "",
                        day.key === selectedDate ? "is-selected" : "",
                        day.key === toLocalDateKey(new Date()) ? "is-today" : "",
                        noteCount > 0 ? "has-notes" : "",
                        noteCount > 1 ? "has-multiple-notes" : "",
                        overdueDateKeys.has(day.key) ? "has-overdue" : "",
                      ].filter(Boolean).join(" ")}
                      key={day.key}
                      onClick={() => selectCalendarDay(day.date)}
                      title={publicHoliday || undefined}
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
              <div className="dashboard-notes-selected-foot">
                <em>{selectedDateCountLabel}</em>
              </div>
            </div>
          </div>
        )}
      </Panel>

      <NoteComposerModal
        fieldLabel="Görev"
        hideReminderLabel
        initialBody={editing?.body ?? ""}
        initialIsVisibleToInstitution={editing?.isVisibleToInstitution ?? false}
        initialReminderDate={editing ? "" : selectedDate}
        initialReminderAtUtc={editing?.reminderAtUtc ?? null}
        mode={editing ? "edit" : "create"}
        onCancel={closeComposer}
        onSubmit={handleSubmit}
        open={composerOpen}
        placeholder="Görev içeriği..."
        reminderDateAriaLabel="Görev tarihi"
        reminderLabel="Tarih/Saat (opsiyonel)"
        reminderTimeAriaLabel="Görev saati"
        saving={saving}
        showVisibilityToggle={!editing}
        titleCreate="Yeni Görev"
        titleEdit="Görevi Düzenle"
        visibilityToggleHint="Kapalıysa sadece sen görürsün."
        visibilityToggleLabel="Herkese göster"
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

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function getTurkeyPublicHolidayLabel(dateKey: string): string | null {
  const [, month, day] = dateKey.split("-").map(Number);
  const fixedHoliday = TURKEY_FIXED_PUBLIC_HOLIDAYS.get(`${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  return fixedHoliday ?? TURKEY_2026_MOVABLE_PUBLIC_HOLIDAYS.get(dateKey) ?? null;
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
