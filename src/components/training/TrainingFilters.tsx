import { useMemo } from "react";

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
  isSimulator: boolean;
};

function getLicenseClassSortRank(licenseClass: string): number {
  const ranks = licenseClass
    .split(",")
    .map((part) => part.trim().toLocaleUpperCase("tr-TR").match(/[A-Z]/)?.[0])
    .filter((letter): letter is string => Boolean(letter))
    .map((letter) => letter.charCodeAt(0) - "A".charCodeAt(0));
  return ranks.length ? Math.min(...ranks) : Number.POSITIVE_INFINITY;
}

function compareVehicleFilterOptions(a: VehicleFilterOption, b: VehicleFilterOption): number {
  if (a.isSimulator !== b.isSimulator) return a.isSimulator ? -1 : 1;
  const licenseClassOrder =
    getLicenseClassSortRank(a.licenseClass) - getLicenseClassSortRank(b.licenseClass);
  if (licenseClassOrder !== 0) return licenseClassOrder;
  const licenseClassLabelOrder = a.licenseClass.localeCompare(b.licenseClass, "tr", {
    sensitivity: "base",
    numeric: true,
  });
  if (licenseClassLabelOrder !== 0) return licenseClassLabelOrder;
  return a.label.localeCompare(b.label, "tr", { sensitivity: "base", numeric: true });
}

function getVehicleFilterKey(vehicle: VehicleResponse): string {
  return vehicle.plateNumber.trim() || vehicle.id;
}

function getVehicleFilterLabel(vehicle: VehicleResponse, fallbackLabel: string): string {
  const primary = vehicle.plateNumber.trim();
  if (primary) return primary;
  const name = [vehicle.brand, vehicle.model].filter(Boolean).join(" ").trim();
  return name || fallbackLabel;
}

function vehicleFilterOptionFromCatalog(
  vehicle: VehicleResponse,
  fallbackLabel: string,
  allLicenseClassLabel: string
): VehicleFilterOption {
  return {
    key: getVehicleFilterKey(vehicle),
    label: getVehicleFilterLabel(vehicle, fallbackLabel),
    licenseClass: vehicle.isSimulator ? allLicenseClassLabel : vehicle.licenseClasses.join(", "),
    isSimulator: vehicle.isSimulator,
  };
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
    const catalogById = new Map(allVehiclesCatalog.map((vehicle) => [vehicle.id, vehicle]));
    const allLicenseClassLabel = t("common.all");
    ownEvents.forEach((e) => {
      const catalogVehicle = e.vehicleId ? catalogById.get(e.vehicleId) : undefined;
      if (catalogVehicle) {
        const option = vehicleFilterOptionFromCatalog(
          catalogVehicle,
          noVehicleLabel,
          allLicenseClassLabel
        );
        if (!map.has(option.key)) {
          map.set(option.key, option);
        }
        return;
      }
      const eventVehiclePlate = e.vehiclePlate?.trim();
      const key = e.vehicleId || eventVehiclePlate || noVehicleLabel;
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: eventVehiclePlate || noVehicleLabel,
          licenseClass: "",
          isSimulator: false,
        });
      }
    });
    allVehiclesCatalog
      .filter((v) => v.isActive)
      .forEach((v) => {
        const option = vehicleFilterOptionFromCatalog(
          v,
          noVehicleLabel,
          allLicenseClassLabel
        );
        map.set(option.key, option);
      });
    return Array.from(map.values()).sort(compareVehicleFilterOptions);
  }, [ownEvents, allVehiclesCatalog, kind, noVehicleLabel, t]);

  return (
    <aside className="training-filters">
      {kind === "uygulama" ? (
        <section className="training-filters-section">
          <ul className="training-filters-list training-filters-list-scroll">
            {vehicles.map((vehicle) => {
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
            {vehicles.length === 0 ? (
              <li className="training-filters-empty">
                {t("training.filter.noMatches")}
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      <section className="training-filters-section">
        <ul className="training-filters-list training-filters-list-scroll">
          {instructors.map((instructor) => {
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
          {instructors.length === 0 ? (
            <li className="training-filters-empty">
              {t("training.filter.noMatches")}
            </li>
          ) : null}
        </ul>
      </section>
    </aside>
  );
}
