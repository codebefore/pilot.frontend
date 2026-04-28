import { useMemo, useState } from "react";

import { useT } from "../../lib/i18n";
import type {
  TrainingCalendarEvent,
  TrainingEventKind,
} from "../../lib/training-calendar";
import type { InstructorResponse, VehicleResponse } from "../../lib/types";

type TrainingFiltersProps = {
  events: TrainingCalendarEvent[];
  /** Branş yetkisi (`practice` mi, teorik mi) bu değere göre filtrelenir. */
  kind: TrainingEventKind;
  /** Branş yetkisi denetimi için tam eğitmen kataloğu. */
  allInstructors: InstructorResponse[];
  /** Uygulama tarafında araç filtresi için tam araç kataloğu. */
  allVehiclesCatalog?: VehicleResponse[];
  visibleInstructors: Set<string>;
  /** Uygulama'da `visibleGroups` plaka set'idir. Teorik'te kullanılmaz. */
  visibleGroups?: Set<string>;
  onToggleInstructor: (instructorId: string) => void;
  /** Uygulama'da plaka toggle'ı için. Teorik'te tetiklenmez. */
  onToggleGroup?: (plate: string) => void;
  onResetFilters: () => void;
  /** Bulk toggle — yalnız listede görünen kayıtları etkiler. */
  onSetInstructorsVisibility: (ids: string[], visible: boolean) => void;
  /** Uygulama plaka bulk toggle. */
  onSetGroupsVisibility?: (plates: string[], visible: boolean) => void;
};

export function TrainingFilters({
  events,
  kind,
  allInstructors,
  allVehiclesCatalog = [],
  visibleInstructors,
  visibleGroups,
  onToggleInstructor,
  onToggleGroup,
  onResetFilters,
  onSetInstructorsVisibility,
  onSetGroupsVisibility,
}: TrainingFiltersProps) {
  const t = useT();
  // Filter listesi sadece bu sayfanın kind'ına ait event'lerden türer.
  const ownEvents = useMemo(
    () => events.filter((e) => e.kind === kind),
    [events, kind]
  );

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

  // Araç listesi (sadece uygulama tarafında): aktif kataloğun tamamı +
  // event'lerde plakası geçen araçlar (öncelikli sıra).
  const noVehicleLabel = t("training.filter.noVehicle");
  const vehicles = useMemo(() => {
    if (kind !== "uygulama") return [];
    const set = new Set<string>();
    ownEvents.forEach((e) => set.add(e.vehiclePlate || noVehicleLabel));
    allVehiclesCatalog
      .filter((v) => v.isActive)
      .forEach((v) => set.add(v.plateNumber));
    return Array.from(set).sort();
  }, [ownEvents, allVehiclesCatalog, kind, noVehicleLabel]);

  // Plaka → ehliyet sınıfı map. "Araç seçilmedi" placeholder için
  // sınıf yok.
  const licenseClassByPlate = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of allVehiclesCatalog) {
      map.set(v.plateNumber, v.licenseClass);
    }
    return map;
  }, [allVehiclesCatalog]);

  // Search state'leri.
  const [instructorSearch, setInstructorSearch] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");

  const filteredInstructors = useMemo(() => {
    const q = instructorSearch.trim().toLocaleLowerCase("tr");
    if (!q) return instructors;
    return instructors.filter((i) =>
      i.name.toLocaleLowerCase("tr").includes(q)
    );
  }, [instructors, instructorSearch]);

  const filteredVehicles = useMemo(() => {
    const q = vehicleSearch.trim().toLocaleLowerCase("tr");
    if (!q) return vehicles;
    return vehicles.filter((v) => v.toLocaleLowerCase("tr").includes(q));
  }, [vehicles, vehicleSearch]);

  const filteredInstructorsCheckedCount = filteredInstructors.filter((i) =>
    visibleInstructors.has(i.id)
  ).length;
  const allInstructorsChecked =
    filteredInstructors.length > 0 &&
    filteredInstructorsCheckedCount === filteredInstructors.length;

  const filteredVehiclesCheckedCount = filteredVehicles.filter((v) =>
    visibleGroups?.has(v) ?? false
  ).length;
  const allVehiclesChecked =
    filteredVehicles.length > 0 &&
    filteredVehiclesCheckedCount === filteredVehicles.length;

  const visibleVehiclesInList =
    kind === "uygulama"
      ? vehicles.filter((v) => visibleGroups?.has(v) ?? false).length
      : 0;
  const visibleInstructorsInList = instructors.filter((i) =>
    visibleInstructors.has(i.id)
  ).length;
  const anyVisible = visibleInstructorsInList > 0 || visibleVehiclesInList > 0;

  return (
    <aside className="training-filters">
      {anyVisible ? (
        <div className="training-filters-header">
          <button
            className="training-filters-reset"
            onClick={onResetFilters}
            type="button"
          >
            {t("training.filter.reset")}
          </button>
        </div>
      ) : null}

      {kind === "uygulama" ? (
        <section className="training-filters-section">
          <div className="training-filters-section-header">
            <h4 className="training-filters-section-title">
              {t("training.filter.vehiclesTitle")}
            </h4>
            <label className="training-filters-master-toggle switch-toggle switch-toggle-sm">
              <input
                checked={allVehiclesChecked}
                onChange={() =>
                  onSetGroupsVisibility?.(filteredVehicles, !allVehiclesChecked)
                }
                type="checkbox"
              />
              <span className="switch-toggle-control" />
            </label>
          </div>
          <input
            className="training-filters-search"
            onChange={(e) => setVehicleSearch(e.target.value)}
            placeholder={t("training.filter.searchPlaceholder")}
            type="search"
            value={vehicleSearch}
          />
          <ul className="training-filters-list training-filters-list-scroll">
            {filteredVehicles.map((plate) => {
              const checked = visibleGroups?.has(plate) ?? false;
              const licenseClass = licenseClassByPlate.get(plate);
              return (
                <li key={plate}>
                  <label className="training-filters-item switch-toggle switch-toggle-sm">
                    <input
                      checked={checked}
                      onChange={() => onToggleGroup?.(plate)}
                      type="checkbox"
                    />
                    <span className="switch-toggle-control" />
                    <span className="training-filters-name">
                      {plate}
                      {licenseClass ? (
                        <>
                          {" — "}
                          <span className="license-class-badge">
                            {licenseClass}
                          </span>
                        </>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
            {filteredVehicles.length === 0 ? (
              <li className="training-filters-empty">
                {t("training.filter.noMatches")}
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

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
                  filteredInstructors.map((i) => i.id),
                  !allInstructorsChecked
                )
              }
              type="checkbox"
            />
            <span className="switch-toggle-control" />
          </label>
        </div>
        <input
          className="training-filters-search"
          onChange={(e) => setInstructorSearch(e.target.value)}
          placeholder={t("training.filter.searchPlaceholder")}
          type="search"
          value={instructorSearch}
        />
        <ul className="training-filters-list training-filters-list-scroll">
          {filteredInstructors.map((instructor) => {
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
          {filteredInstructors.length === 0 ? (
            <li className="training-filters-empty">
              {t("training.filter.noMatches")}
            </li>
          ) : null}
        </ul>
      </section>
    </aside>
  );
}
