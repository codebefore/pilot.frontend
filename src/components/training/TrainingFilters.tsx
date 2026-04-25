import { useMemo } from "react";

import type {
  TrainingCalendarEvent,
  TrainingEventKind,
} from "../../lib/training-calendar";
import { colorForGroup } from "../../lib/training-calendar-palette";

type TrainingFiltersProps = {
  events: TrainingCalendarEvent[];
  /** Teorik → "Gruplar" / Uygulama → "Adaylar" başlığı + dataset key. */
  kind: TrainingEventKind;
  visibleGroups: Set<string>;
  visibleInstructors: Set<string>;
  onToggleGroup: (groupName: string) => void;
  onToggleInstructor: (instructorId: string) => void;
  onResetFilters: () => void;
  onShowAllGroups: () => void;
  onHideAllGroups: () => void;
  onShowAllInstructors: () => void;
  onHideAllInstructors: () => void;
};

export function TrainingFilters({
  events,
  kind,
  visibleGroups,
  visibleInstructors,
  onToggleGroup,
  onToggleInstructor,
  onResetFilters,
  onShowAllGroups,
  onHideAllGroups,
  onShowAllInstructors,
  onHideAllInstructors,
}: TrainingFiltersProps) {
  const groupSectionTitle = kind === "uygulama" ? "Adaylar" : "Gruplar";
  // Filter listesi sadece bu sayfanın kind'ına ait event'lerden türer —
  // teorik sayfada yanlışlıkla uygulama event'leri (aday adları) ya da
  // tersi kazara karışırsa filtre kirlenmesin. Gruplar sadece
  // internal'lardan; external grup adları (Direksiyon Slot vb.) burada
  // gösterilmez. Eğitmenler internal + external (aynı eğitmen iki
  // takvimde olabilir, kullanıcı kapatınca her ikisi de gizlenmeli).
  const ownEvents = useMemo(
    () => events.filter((e) => e.kind === kind),
    [events, kind]
  );

  const groups = useMemo(() => {
    const set = new Set(
      ownEvents.filter((e) => !e.external).map((e) => e.groupName)
    );
    return Array.from(set).sort();
  }, [ownEvents]);

  const instructors = useMemo(() => {
    const map = new Map<string, string>();
    ownEvents.forEach((e) => {
      if (!map.has(e.instructorId)) map.set(e.instructorId, e.instructorName);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [ownEvents]);

  const anyHidden =
    visibleGroups.size < groups.length ||
    visibleInstructors.size < instructors.length;

  return (
    <aside className="training-filters">
      <div className="training-filters-header">
        <span>Filtreler</span>
        {anyHidden ? (
          <button
            className="training-filters-reset"
            onClick={onResetFilters}
            type="button"
          >
            Sıfırla
          </button>
        ) : null}
      </div>

      <section className="training-filters-section">
        <div className="training-filters-section-header">
          <h4 className="training-filters-section-title">{groupSectionTitle}</h4>
          <label className="training-filters-master-toggle switch-toggle switch-toggle-sm">
            <input
              checked={visibleGroups.size === groups.length && groups.length > 0}
              onChange={() => {
                if (visibleGroups.size === groups.length) {
                  onHideAllGroups();
                } else {
                  onShowAllGroups();
                }
              }}
              type="checkbox"
            />
            <span className="switch-toggle-control" />
          </label>
        </div>
        <ul className="training-filters-list">
          {groups.map((group) => {
            const color = colorForGroup(group);
            const checked = visibleGroups.has(group);
            return (
              <li key={group}>
                <label className="training-filters-item switch-toggle switch-toggle-sm">
                  <input
                    checked={checked}
                    onChange={() => onToggleGroup(group)}
                    type="checkbox"
                  />
                  <span className="switch-toggle-control" />
                  <span
                    aria-hidden="true"
                    className="training-filters-dot"
                    style={{ background: color.bg, borderColor: color.border }}
                  />
                  <span className="training-filters-name">{group}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="training-filters-section">
        <div className="training-filters-section-header">
          <h4 className="training-filters-section-title">Eğitmenler</h4>
          <label className="training-filters-master-toggle switch-toggle switch-toggle-sm">
            <input
              checked={visibleInstructors.size === instructors.length && instructors.length > 0}
              onChange={() => {
                if (visibleInstructors.size === instructors.length) {
                  onHideAllInstructors();
                } else {
                  onShowAllInstructors();
                }
              }}
              type="checkbox"
            />
            <span className="switch-toggle-control" />
          </label>
        </div>
        <ul className="training-filters-list">
          {instructors.map((instructor) => {
            const checked = visibleInstructors.has(instructor.id);
            return (
              <li key={instructor.id}>
                <label className="training-filters-item switch-toggle switch-toggle-sm">
                  <input
                    checked={checked}
                    onChange={() => onToggleInstructor(instructor.id)}
                    type="checkbox"
                  />
                  <span className="switch-toggle-control" />
                  <span className="training-filters-name">{instructor.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
}
