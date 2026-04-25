import { useMemo } from "react";

import type { TrainingCalendarEvent } from "../../lib/training-calendar";

type TrainingWeekSummaryProps = {
  events: TrainingCalendarEvent[];
};

// Pazartesi 00:00'ı içeren haftanın başı ve sonu (Pazar 23:59:59).
const getWeekRange = (): { start: Date; end: Date } => {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // 0 = Pazartesi
  const start = new Date(now);
  start.setDate(now.getDate() - dow);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  end.setMilliseconds(-1);
  return { start, end };
};

export function TrainingWeekSummary({ events }: TrainingWeekSummaryProps) {
  const stats = useMemo(() => {
    const { start, end } = getWeekRange();
    const inRange = events.filter(
      (e) => e.start >= start && e.start <= end
    );
    const instructorSet = new Set(inRange.map((e) => e.instructorId));
    const groupSet = new Set(inRange.map((e) => e.groupName));
    const totalCandidates = inRange.reduce((s, e) => s + e.candidateCount, 0);
    const totalMinutes = inRange.reduce(
      (s, e) => s + (e.end.getTime() - e.start.getTime()) / 60000,
      0
    );
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
    return {
      lessonCount: inRange.length,
      instructorCount: instructorSet.size,
      groupCount: groupSet.size,
      totalCandidates,
      totalHours,
    };
  }, [events]);

  return (
    <div className="training-week-summary">
      <div className="training-week-summary-stats">
        <div className="training-week-summary-stat">
          <span className="training-week-summary-value">{stats.lessonCount}</span>
          <span className="training-week-summary-key">ders</span>
        </div>
        <div className="training-week-summary-stat">
          <span className="training-week-summary-value">{stats.groupCount}</span>
          <span className="training-week-summary-key">grup</span>
        </div>
        <div className="training-week-summary-stat">
          <span className="training-week-summary-value">{stats.instructorCount}</span>
          <span className="training-week-summary-key">eğitmen</span>
        </div>
        <div className="training-week-summary-stat">
          <span className="training-week-summary-value">{stats.totalCandidates}</span>
          <span className="training-week-summary-key">aday</span>
        </div>
        <div className="training-week-summary-stat">
          <span className="training-week-summary-value">{stats.totalHours}</span>
          <span className="training-week-summary-key">saat</span>
        </div>
      </div>
    </div>
  );
}
