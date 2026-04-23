import { useEffect, useState } from "react";

import { formatExamScheduleLicenseClassSummary } from "../../lib/exam-schedule-summary";
import { formatDateTR } from "../../lib/status-maps";
import type { ExamScheduleOption } from "../../lib/types";

type CandidateExamDateSidebarProps = {
  title: string;
  options: ExamScheduleOption[];
  selectedDate: string;
  onSelect: (date: string) => void;
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

function findNextUpcomingDate(
  options: ExamScheduleOption[],
  today: string
): string | null {
  return (
    options
      .map((option) => option.date)
      .filter((date) => date > today)
      .sort((left, right) => left.localeCompare(right))[0] ?? null
  );
}

export function CandidateExamDateSidebar({
  title,
  options,
  selectedDate,
  onSelect,
  actions = [],
  showTime = true,
  summaryMode = "capacity",
}: CandidateExamDateSidebarProps) {
  const [today, setToday] = useState(getTodayDateOnly);

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

  const nextUpcomingDate = findNextUpcomingDate(options, today);

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
        return (
          <div className="exam-date-option-group" key={option.id}>
            {option.date === nextUpcomingDate ? (
              <div aria-hidden="true" className="exam-date-divider" data-testid="exam-date-divider" />
            ) : null}
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
          </div>
        );
      })}
    </div>
  );
}
