import { useMemo, useState } from "react";

import { useT } from "../../lib/i18n";
import type { GroupResponse } from "../../lib/types";

type QuickLessonAssignmentProps = {
  groups: GroupResponse[];
  /** Controlled: parent kontrol eder. */
  groupId: string;
  /** Seçim değişikliğini parent'a (TrainingPage) iletiyor. */
  onSettingsChange: (params: { groupId: string }) => void;
  isLoading?: boolean;
};

export function QuickLessonAssignment({
  groups,
  groupId,
  onSettingsChange,
  isLoading = false,
}: QuickLessonAssignmentProps) {
  const t = useT();
  const [search, setSearch] = useState("");

  // Aktif aday'ı 0 olan gruplar atlanır (assignedCandidateCount
  // kontenjan sayacı, gerçek atama değil). Sıralama: startDate desc
  // (en güncel grup en üstte), tarih yoksa en sonda.
  const sortedGroups = useMemo(
    () =>
      groups
        .filter((g) => g.activeCandidateCount > 0)
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
    const q = search.trim().toLocaleLowerCase("tr");
    if (!q) return sortedGroups;
    return sortedGroups.filter((g) =>
      g.title.toLocaleLowerCase("tr").includes(q)
    );
  }, [sortedGroups, search]);

  const toggle = (id: string) => {
    if (isLoading) return;
    onSettingsChange({ groupId: id === groupId ? "" : id });
  };

  return (
    <div className="training-quick-assign">
      <input
        className="training-filters-search"
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("training.quick.groupPlaceholder")}
        type="search"
        value={search}
      />
      <ul className="training-filters-list training-filters-list-scroll">
        {filteredGroups.map((group) => {
          const checked = group.id === groupId;
          return (
            <li key={group.id}>
              <label className="training-filters-item switch-toggle switch-toggle-sm">
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
        {filteredGroups.length === 0 ? (
          <li className="training-filters-empty">
            {t("training.filter.noMatches")}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
