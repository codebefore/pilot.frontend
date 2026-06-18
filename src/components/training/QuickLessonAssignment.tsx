import { useMemo } from "react";

import { useT } from "../../lib/i18n";
import type { ClassroomResponse, GroupResponse } from "../../lib/types";

type QuickLessonAssignmentProps = {
  groups: GroupResponse[];
  /** Controlled: parent kontrol eder. */
  groupId: string;
  /** Seçim değişikliğini parent'a (TrainingPage) iletiyor. */
  onSettingsChange: (params: { groupId?: string }) => void;
  isLoading?: boolean;
};

export function QuickLessonAssignment({
  groups,
  groupId,
  onSettingsChange,
  isLoading = false,
}: QuickLessonAssignmentProps) {
  const t = useT();

  // Sıralama: startDate desc (en güncel grup en üstte), tarih yoksa en sonda.
  const sortedGroups = useMemo(
    () =>
      groups
        .slice()
        .sort((a, b) => {
          if (!a.startDate && !b.startDate) {
            return a.title.localeCompare(b.title, "tr");
          }
          if (!a.startDate) return 1;
          if (!b.startDate) return -1;
          return b.startDate.localeCompare(a.startDate);
        })
        .slice(0, 10),
    [groups]
  );

  const toggle = (id: string) => {
    if (isLoading) return;
    onSettingsChange({ groupId: id === groupId ? "" : id });
  };

  return (
    <div className="training-quick-assign">
      <ul className="training-filters-list training-filters-list-scroll">
        {sortedGroups.map((group) => {
          const checked = group.id === groupId;
          const isMebbisSent = group.mebStatus?.trim().toLowerCase() === "sent";
          return (
            <li key={group.id}>
              <label
                className={[
                  "training-filters-item switch-toggle switch-toggle-sm",
                  checked ? "training-filters-item-selected" : "",
                  isMebbisSent ? "training-filters-item-meb-sent" : "",
                ].filter(Boolean).join(" ")}
                data-meb-sent={isMebbisSent ? "true" : undefined}
              >
                <input
                  checked={checked}
                  disabled={isLoading}
                  onChange={() => toggle(group.id)}
                  type="checkbox"
                />
                <span className="switch-toggle-control" />
                <span className="training-filters-name">
                  {/* "Nisan 2026 - 1A" → "Nisan - 1A" — yıl bilgisini kısalt. */}
                  {group.title.replace(/\s+\d{4}/g, "")} (
                  {group.activeCandidateCount})
                </span>
              </label>
            </li>
          );
        })}
        {sortedGroups.length === 0 ? (
          <li className="training-filters-empty">
            {t("training.filter.noMatches")}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

type QuickClassroomAssignmentProps = {
  classrooms: ClassroomResponse[];
  classroomId: string;
  onSettingsChange: (params: { classroomId?: string }) => void;
  isLoading?: boolean;
};

export function QuickClassroomAssignment({
  classrooms,
  classroomId,
  onSettingsChange,
  isLoading = false,
}: QuickClassroomAssignmentProps) {
  const t = useT();
  const sortedClassrooms = useMemo(
    () =>
      classrooms
        .filter((classroom) => classroom.isActive)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [classrooms]
  );

  const toggleClassroom = (id: string) => {
    if (isLoading) return;
    onSettingsChange({ classroomId: id === classroomId ? "" : id });
  };

  return (
    <div className="training-quick-assign">
      <ul className="training-filters-list training-filters-list-scroll">
        {sortedClassrooms.map((classroom) => {
          const checked = classroom.id === classroomId;
          return (
            <li key={classroom.id}>
              <label
                className={[
                  "training-filters-item switch-toggle switch-toggle-sm",
                  checked ? "training-filters-item-selected" : "",
                ].filter(Boolean).join(" ")}
              >
                <input
                  checked={checked}
                  disabled={isLoading}
                  onChange={() => toggleClassroom(classroom.id)}
                  type="checkbox"
                />
                <span className="switch-toggle-control" />
                <span className="training-filters-name">
                  {classroom.name} ({classroom.capacity})
                </span>
              </label>
            </li>
          );
        })}
        {sortedClassrooms.length === 0 ? (
          <li className="training-filters-empty">
            {t("settings.classrooms.empty")}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
