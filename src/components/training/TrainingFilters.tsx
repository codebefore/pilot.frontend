import { useMemo } from "react";

import { useT } from "../../lib/i18n";
import type {
  TrainingCalendarEvent,
  TrainingEventKind,
} from "../../lib/training-calendar";
import { colorForGroup } from "../../lib/training-calendar-palette";
import type {
  GroupResponse,
  InstructorResponse,
  VehicleResponse,
} from "../../lib/types";

type TrainingFiltersProps = {
  events: TrainingCalendarEvent[];
  /** Teorik → "Gruplar" / Uygulama → "Araçlar" başlığı + dataset key. */
  kind: TrainingEventKind;
  /** Branş yetkisi denetimi için tam eğitmen kataloğu. */
  allInstructors: InstructorResponse[];
  /** Tüm aktif grupların kataloğu (teorik filtresinde kullanılır —
   *  henüz dersi olmayan gruplar da listelensin). */
  allGroupsCatalog: GroupResponse[];
  /** Tüm aktif araçların kataloğu (uygulama filtresinde kullanılır —
   *  henüz dersi olmayan araçlar da listelensin). */
  allVehiclesCatalog: VehicleResponse[];
  visibleGroups: Set<string>;
  visibleInstructors: Set<string>;
  onToggleGroup: (groupName: string) => void;
  onToggleInstructor: (instructorId: string) => void;
  onResetFilters: () => void;
  /** Bulk toggle — yalnız listede görünen kayıtları etkiler. */
  onSetGroupsVisibility: (groupNames: string[], visible: boolean) => void;
  onSetInstructorsVisibility: (ids: string[], visible: boolean) => void;
};

export function TrainingFilters({
  events,
  kind,
  allInstructors,
  allGroupsCatalog,
  allVehiclesCatalog,
  visibleGroups,
  visibleInstructors,
  onToggleGroup,
  onToggleInstructor,
  onResetFilters,
  onSetGroupsVisibility,
  onSetInstructorsVisibility,
}: TrainingFiltersProps) {
  const t = useT();
  const groupSectionTitle =
    kind === "uygulama"
      ? t("training.filter.vehiclesTitle")
      : t("training.filter.groupsTitle");
  // Filter listesi sadece bu sayfanın kind'ına ait event'lerden türer —
  // teorik sayfada yanlışlıkla uygulama event'leri (aday adları) ya da
  // tersi kazara karışırsa filtre kirlenmesin.
  const ownEvents = useMemo(
    () => events.filter((e) => e.kind === kind),
    [events, kind]
  );

  const noVehicleLabel = t("training.filter.noVehicle");
  const groups = useMemo(() => {
    const set = new Set(
      ownEvents.map((e) =>
        kind === "uygulama" ? (e.vehiclePlate || noVehicleLabel) : e.groupName
      )
    );
    // Teorik tarafında: dersi olmayan ama aktif aday'ı olan grupları da
    // ekle (kullanıcı daha hiç ders atamadan da o grubu filterda görsün).
    // `activeCandidateCount` gerçek atama; `assignedCandidateCount`
    // kontenjan sayacı (aldatıcı olabilir).
    if (kind === "teorik") {
      allGroupsCatalog
        .filter((g) => g.activeCandidateCount > 0)
        .forEach((g) => set.add(g.title));
    } else {
      // Uygulama tarafında: dersi olmayan ama aktif olan tüm araçlar
      // da listede görünmeli (filter ekran tamamen boş kalmasın).
      allVehiclesCatalog
        .filter((v) => v.isActive)
        .forEach((v) => set.add(v.plateNumber));
    }
    return Array.from(set).sort();
  }, [ownEvents, kind, allGroupsCatalog, allVehiclesCatalog, noVehicleLabel]);

  // Eğitmen branş yetkisi map'i — teorik sayfada en az bir teorik
  // branşı olan, uygulama sayfada `practice` branşı olan eğitmenler
  // listelenir. Branş bilgisi olmayan (katalogda yok) eğitmenler de
  // güvende kalsın diye varsayılan olarak gösterilir.
  const eligibleInstructorIds = useMemo(() => {
    const set = new Set<string>();
    allInstructors.forEach((inst) => {
      const eligible =
        kind === "uygulama"
          ? inst.branches.includes("practice")
          : inst.branches.some((b) => b !== "practice");
      if (eligible) set.add(inst.id);
    });
    return set;
  }, [allInstructors, kind]);

  const instructors = useMemo(() => {
    const map = new Map<string, string>();
    // Önce dersi olan eğitmenler (event'ten alınan canlı isim önceliklidir).
    ownEvents.forEach((e) => {
      if (!eligibleInstructorIds.has(e.instructorId)) return;
      if (!map.has(e.instructorId)) map.set(e.instructorId, e.instructorName);
    });
    // Henüz dersi olmayan ama branş'a uygun eğitmenler de listede görünsün.
    allInstructors.forEach((inst) => {
      if (!eligibleInstructorIds.has(inst.id)) return;
      if (map.has(inst.id)) return;
      map.set(inst.id, `${inst.firstName} ${inst.lastName}`.trim());
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [ownEvents, eligibleInstructorIds, allInstructors]);

  // Master toggle/anyHidden hesaplamaları sadece **bu listede görünen**
  // kayıtlar üzerinden — `visible*` Set'i diğer (filter dışı) ID'leri de
  // içeriyor olabilir, onlar bulk toggle'a dahil değil.
  const visibleGroupsInList = groups.filter((g) => visibleGroups.has(g)).length;
  const visibleInstructorsInList = instructors.filter((i) =>
    visibleInstructors.has(i.id)
  ).length;
  const allGroupsChecked =
    groups.length > 0 && visibleGroupsInList === groups.length;
  const allInstructorsChecked =
    instructors.length > 0 && visibleInstructorsInList === instructors.length;
  // Sıfırla butonu: en az bir filter aktifse göster (klikleyince tümü
  // false olur). Hiçbir şey aktif değilse buton anlamsız → gizli.
  const anyVisible =
    visibleGroupsInList > 0 || visibleInstructorsInList > 0;

  return (
    <aside className="training-filters">
      <div className="training-filters-header">
        <span>{t("training.filter.title")}</span>
        {anyVisible ? (
          <button
            className="training-filters-reset"
            onClick={onResetFilters}
            type="button"
          >
            {t("training.filter.reset")}
          </button>
        ) : null}
      </div>

      <section className="training-filters-section">
        <div className="training-filters-section-header">
          <h4 className="training-filters-section-title">{groupSectionTitle}</h4>
          <label className="training-filters-master-toggle switch-toggle switch-toggle-sm">
            <input
              checked={allGroupsChecked}
              onChange={() => onSetGroupsVisibility(groups, !allGroupsChecked)}
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
          <h4 className="training-filters-section-title">
            {t("training.filter.instructorsTitle")}
          </h4>
          <label className="training-filters-master-toggle switch-toggle switch-toggle-sm">
            <input
              checked={allInstructorsChecked}
              onChange={() =>
                onSetInstructorsVisibility(
                  instructors.map((i) => i.id),
                  !allInstructorsChecked
                )
              }
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
