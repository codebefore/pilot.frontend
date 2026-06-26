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
  /** Bulk toggle — yalnız listede görünen kayıtları etkiler. */
  onSetInstructorsVisibility: (ids: string[], visible: boolean) => void;
  /** Uygulama plaka bulk toggle. */
  onSetGroupsVisibility?: (plates: string[], visible: boolean) => void;
};

type VehicleFilterOption = {
  key: string;
  label: string;
  licenseClass: string;
};

function getVehicleFilterKey(vehicle: VehicleResponse): string {
  return vehicle.plateNumber || vehicle.id;
}

function getVehicleFilterLabel(vehicle: VehicleResponse, simulatorLabel: string, fallbackLabel: string): string {
  const primary = vehicle.plateNumber.trim();
  if (primary) return primary;
  const name = [vehicle.brand, vehicle.model].filter(Boolean).join(" ").trim();
  return name || (vehicle.isSimulator ? simulatorLabel : fallbackLabel);
}

export function TrainingFilters({
  events,
  kind,
  allInstructors,
  allVehiclesCatalog = [],
  visibleInstructors,
  visibleGroups,
  onToggleInstructor,
  onToggleGroup,
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

  const expiredInstructorIds = useMemo(() => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const set = new Set<string>();
    allInstructors.forEach((inst) => {
      const end = inst.contractEndDate;
      if (end && end.slice(0, 10) < todayKey) set.add(inst.id);
    });
    return set;
  }, [allInstructors]);

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
      .map(([id, name]) => ({ id, name, expired: expiredInstructorIds.has(id) }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [ownEvents, eligibleInstructorIds, allInstructors, expiredInstructorIds]);

  // Araç listesi (sadece uygulama tarafında): aktif kataloğun tamamı +
  // event'lerde plakası geçen araçlar (öncelikli sıra).
  const noVehicleLabel = t("training.filter.noVehicle");
  const vehicles = useMemo(() => {
    if (kind !== "uygulama") return [];
    const map = new Map<string, VehicleFilterOption>();
    ownEvents.forEach((e) => {
      const key = e.vehicleId || e.vehiclePlate || noVehicleLabel;
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: e.vehiclePlate || noVehicleLabel,
          licenseClass: "",
        });
      }
    });
    allVehiclesCatalog
      .filter((v) => v.isActive)
      .forEach((v) => {
        const key = getVehicleFilterKey(v);
        map.set(key, {
          key,
          label: getVehicleFilterLabel(v, t("vehicleForm.field.simulator"), noVehicleLabel),
          licenseClass: v.isSimulator ? t("common.all") : v.licenseClasses.join(", "),
        });
      });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "tr"));
  }, [ownEvents, allVehiclesCatalog, kind, noVehicleLabel]);

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
    return vehicles.filter((v) => v.label.toLocaleLowerCase("tr").includes(q));
  }, [vehicles, vehicleSearch]);

  return (
    <aside className="training-filters">
      {kind === "uygulama" ? (
        <section className="training-filters-section">
          <input
            className="training-filters-search"
            onChange={(e) => setVehicleSearch(e.target.value)}
            placeholder={t("training.filter.searchPlaceholder")}
            type="search"
            value={vehicleSearch}
          />
          <ul className="training-filters-list training-filters-list-scroll">
            {filteredVehicles.map((vehicle) => {
              const checked = visibleGroups?.has(vehicle.key) ?? false;
              return (
                <li key={vehicle.key}>
                  <label className="training-filters-item switch-toggle switch-toggle-sm">
                    <input
                      checked={checked}
                      onChange={() => onToggleGroup?.(vehicle.key)}
                      type="checkbox"
                    />
                    <span className="switch-toggle-control" />
                    <span className="training-filters-name">
                      {vehicle.label}
                      {vehicle.licenseClass ? (
                        <>
                          {" — "}
                          <span className="license-class-badge">
                            {vehicle.licenseClass}
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
        {kind === "uygulama" ? (
          <input
            className="training-filters-search"
            onChange={(e) => setInstructorSearch(e.target.value)}
            placeholder={t("training.filter.searchPlaceholder")}
            type="search"
            value={instructorSearch}
          />
        ) : null}
        <ul className="training-filters-list training-filters-list-scroll">
          {filteredInstructors.map((instructor) => {
            const checked = visibleInstructors.has(instructor.id);
            return (
              <li key={instructor.id}>
                <label
                  className={
                    "training-filters-item switch-toggle switch-toggle-sm" +
                    (instructor.expired ? " training-filters-item--expired" : "")
                  }
                  title={instructor.expired ? t("trainingFilters.title.expired") : undefined}
                >
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
