import { useEffect, useRef, useState } from "react";

import { TrashIcon } from "../icons";
import { formatExamScheduleLicenseClassSummary } from "../../lib/exam-schedule-summary";
import { formatDateTR } from "../../lib/status-maps";
import type { ExamScheduleOption } from "../../lib/types";

type CandidateExamDateSidebarProps = {
  title: string;
  options: ExamScheduleOption[];
  selectedDate: string;
  onSelect: (date: string) => void;
  onDelete?: (option: ExamScheduleOption) => void;
  deletingOptionId?: string | null;
  actions?: { label: string; onClick: () => void; disabled?: boolean }[];
  showTime?: boolean;
  summaryMode?: "capacity" | "candidateCount" | "licenseClass";
};

function toDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayDateOnly(): string {
  return toDateOnly(new Date());
}

function getMillisecondsUntilNextDay(): number {
  const now = new Date();
  const nextDay = new Date(now);
  nextDay.setHours(24, 0, 0, 0);
  return Math.max(nextDay.getTime() - now.getTime(), 0);
}

function findTodayDividerDate(
  options: ExamScheduleOption[],
  today: string
): string | null {
  return (
    options
      .map((option) => option.date)
      .filter((date) => date <= today)
      .sort((left, right) => right.localeCompare(left))[0] ?? null
  );
}

export function CandidateExamDateSidebar({
  title,
  options,
  selectedDate,
  onSelect,
  onDelete,
  deletingOptionId,
  actions = [],
  showTime = true,
  summaryMode = "capacity",
}: CandidateExamDateSidebarProps) {
  const [today, setToday] = useState(getTodayDateOnly);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const confirmRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let timeoutId = 0;

    const scheduleNextUpdate = () => {
      timeoutId = window.setTimeout(() => {
        setToday(getTodayDateOnly());
        scheduleNextUpdate();
      }, getMillisecondsUntilNextDay());
    };

    scheduleNextUpdate();

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!confirmingId) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (confirmRef.current && !confirmRef.current.contains(event.target as Node)) {
        setConfirmingId(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConfirmingId(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [confirmingId]);

  useEffect(() => {
    if (deletingOptionId === null || deletingOptionId === undefined) {
      return;
    }
    if (confirmingId === deletingOptionId) {
      setConfirmingId(null);
    }
  }, [confirmingId, deletingOptionId]);

  const todayDividerDate = findTodayDividerDate(options, today);

  return (
    <div aria-label={title} className="exam-date-sidebar-list" role="complementary">
      {actions.length > 0 ? (
        <div aria-label={`${title} aksiyonları`} className="exam-date-sidebar-actions" role="toolbar">
          {actions.map((action) => (
            <button
              className="btn btn-secondary btn-sm exam-date-sidebar-action"
              disabled={action.disabled}
              key={action.label}
              onClick={action.onClick}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
      {options.map((option) => {
        const isDeleting = deletingOptionId === option.id;
        return (
          <div className="exam-date-option-group" key={option.id}>
            {option.date === todayDividerDate ? (
              <div aria-hidden="true" className="exam-date-divider" data-testid="exam-date-divider" />
            ) : null}
            <div className="exam-date-option-shell">
              <button
                aria-pressed={selectedDate === option.date}
                className={selectedDate === option.date ? "exam-date-option active" : "exam-date-option"}
                onClick={() => onSelect(selectedDate === option.date ? "" : option.date)}
                type="button"
              >
                <span className="exam-date-option-head">
                  <span className="exam-date-option-date">{formatDateTR(option.date)}</span>
                  {showTime && option.time ? (
                    <span className="exam-date-option-time">{option.time}</span>
                  ) : null}
                </span>
                <span className="exam-date-option-meta">
                  {summaryMode === "licenseClass"
                    ? formatExamScheduleLicenseClassSummary(option)
                    : summaryMode === "candidateCount"
                      ? `${option.candidateCount} aday`
                      : `${option.candidateCount}/${option.capacity}`}
                </span>
              </button>
              {onDelete ? (
                <button
                  aria-label={`${formatDateTR(option.date)} sınav tarihini sil`}
                  className="exam-date-option-delete"
                  disabled={isDeleting}
                  onClick={(event) => {
                    event.stopPropagation();
                    setConfirmingId((current) => (current === option.id ? null : option.id));
                  }}
                  type="button"
                >
                  <TrashIcon size={14} />
                </button>
              ) : null}
              {onDelete && confirmingId === option.id ? (
                <div className="exam-date-option-confirm" ref={confirmRef} role="dialog">
                  <span className="exam-date-option-confirm-label">Bu tarihi sil?</span>
                  <div className="exam-date-option-confirm-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={isDeleting}
                      onClick={() => setConfirmingId(null)}
                      type="button"
                    >
                      Vazgeç
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={isDeleting}
                      onClick={() => onDelete(option)}
                      type="button"
                    >
                      {isDeleting ? "Siliniyor…" : "Sil"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
