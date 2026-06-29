import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from "react";

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
  const [visibleGroupCount, setVisibleGroupCount] = useState(10);
  const [groupSearch, setGroupSearch] = useState("");
  const groupListRef = useRef<HTMLUListElement | null>(null);
  const groupListSentinelRef = useRef<HTMLLIElement | null>(null);

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
        }),
    [groups]
  );
  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLocaleLowerCase("tr");
    if (!q) return sortedGroups;
    return sortedGroups.filter((group) =>
      group.title.toLocaleLowerCase("tr").includes(q)
    );
  }, [sortedGroups, groupSearch]);
  const visibleGroups = useMemo(
    () => filteredGroups.slice(0, visibleGroupCount),
    [filteredGroups, visibleGroupCount]
  );

  useEffect(() => {
    setVisibleGroupCount(10);
    if (groupListRef.current) {
      groupListRef.current.scrollTop = 0;
    }
  }, [groups, groupSearch]);

  const toggle = (id: string) => {
    if (isLoading) return;
    onSettingsChange({ groupId: id === groupId ? "" : id });
  };

  const getGroupYear = (group: GroupResponse) =>
    group.startDate?.slice(0, 4) ?? group.title.match(/\b\d{4}\b/)?.[0] ?? "";

  const showMoreGroups = useCallback(() => {
    setVisibleGroupCount((current) =>
      current >= filteredGroups.length
        ? current
        : Math.min(current + 10, filteredGroups.length)
    );
  }, [filteredGroups.length]);

  useEffect(() => {
    const el = groupListRef.current;
    if (!el || visibleGroupCount >= filteredGroups.length) return;
    if (el.scrollHeight <= el.clientHeight + 1) {
      showMoreGroups();
    }
  }, [filteredGroups.length, showMoreGroups, visibleGroupCount]);

  useEffect(() => {
    const root = groupListRef.current;
    const sentinel = groupListSentinelRef.current;
    if (!root || !sentinel || visibleGroupCount >= filteredGroups.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          showMoreGroups();
        }
      },
      { root, rootMargin: "32px 0px", threshold: 0.01 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredGroups.length, showMoreGroups, visibleGroupCount]);

  const handleGroupsScroll = (event: UIEvent<HTMLUListElement>) => {
    const el = event.currentTarget;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceToBottom > 24) return;
    showMoreGroups();
  };

  return (
    <div className="training-quick-assign">
      <input
        className="training-quick-group-search"
        onChange={(event) => setGroupSearch(event.target.value)}
        placeholder={t("training.filter.searchPlaceholder")}
        type="search"
        value={groupSearch}
      />
      <ul
        className="training-filters-list training-filters-list-scroll"
        onScroll={handleGroupsScroll}
        ref={groupListRef}
      >
        {visibleGroups.map((group) => {
          const checked = group.id === groupId;
          const isMebbisSent = group.mebStatus?.trim().toLowerCase() === "sent";
          const groupYear = getGroupYear(group);
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
                <span className="training-filters-name training-filters-group-name">
                  {groupYear ? (
                    <span className="training-filters-group-year">
                      {groupYear}
                    </span>
                  ) : null}
                  <span className="training-filters-group-title">
                    {/* "Nisan 2026 - 1A" → "Nisan - 1A" — yıl bilgisini kısalt. */}
                    {group.title.replace(/\s+\d{4}/g, "")}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
        {filteredGroups.length === 0 ? (
          <li className="training-filters-empty">
            {t("training.filter.noMatches")}
          </li>
        ) : null}
        {visibleGroups.length < filteredGroups.length ? (
          <li
            aria-hidden="true"
            className="training-filters-scroll-sentinel"
            ref={groupListSentinelRef}
          />
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
