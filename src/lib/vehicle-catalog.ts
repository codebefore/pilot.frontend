import type {
  VehicleFuelType,
  VehicleOwnershipType,
  VehicleStatus,
  VehicleTransmissionType,
  VehicleType,
} from "./types";
import type { TranslationKey } from "./i18n";

type Option<T extends string> = {
  value: T;
  labelKey: TranslationKey;
};

export const VEHICLE_STATUS_OPTIONS: Option<VehicleStatus>[] = [
  { value: "idle", labelKey: "vehicle.status.idle" },
  { value: "in_use", labelKey: "vehicle.status.inUse" },
  { value: "maintenance", labelKey: "vehicle.status.maintenance" },
];

export const VEHICLE_TRANSMISSION_OPTIONS: Option<VehicleTransmissionType>[] = [
  { value: "manual", labelKey: "vehicle.transmission.manual" },
  { value: "automatic", labelKey: "vehicle.transmission.automatic" },
];

export const VEHICLE_TYPE_OPTIONS: Option<VehicleType>[] = [
  { value: "automobile", labelKey: "vehicle.type.automobile" },
  { value: "motorcycle", labelKey: "vehicle.type.motorcycle" },
  { value: "minibus", labelKey: "vehicle.type.minibus" },
  { value: "bus", labelKey: "vehicle.type.bus" },
  { value: "pickup", labelKey: "vehicle.type.pickup" },
  { value: "truck", labelKey: "vehicle.type.truck" },
  { value: "trailer", labelKey: "vehicle.type.trailer" },
  { value: "work_machine", labelKey: "vehicle.type.workMachine" },
  { value: "tir", labelKey: "vehicle.type.tir" },
];

export const VEHICLE_OWNERSHIP_OPTIONS: Option<VehicleOwnershipType>[] = [
  { value: "owned", labelKey: "vehicle.ownership.owned" },
  { value: "leased", labelKey: "vehicle.ownership.leased" },
];

export const VEHICLE_FUEL_OPTIONS: Option<VehicleFuelType>[] = [
  { value: "gasoline", labelKey: "vehicle.fuel.gasoline" },
  { value: "diesel", labelKey: "vehicle.fuel.diesel" },
  { value: "lpg", labelKey: "vehicle.fuel.lpg" },
  { value: "electric", labelKey: "vehicle.fuel.electric" },
  { value: "hybrid", labelKey: "vehicle.fuel.hybrid" },
];

function buildLabelKeyMap<T extends string>(options: Option<T>[]): Record<T, TranslationKey> {
  return options.reduce(
    (acc, option) => ({ ...acc, [option.value]: option.labelKey }),
    {} as Record<T, TranslationKey>
  );
}

export const VEHICLE_STATUS_LABEL_KEYS = buildLabelKeyMap(VEHICLE_STATUS_OPTIONS);
export const VEHICLE_TRANSMISSION_LABEL_KEYS = buildLabelKeyMap(VEHICLE_TRANSMISSION_OPTIONS);
export const VEHICLE_TYPE_LABEL_KEYS = buildLabelKeyMap(VEHICLE_TYPE_OPTIONS);
export const VEHICLE_OWNERSHIP_LABEL_KEYS = buildLabelKeyMap(VEHICLE_OWNERSHIP_OPTIONS);
export const VEHICLE_FUEL_LABEL_KEYS = buildLabelKeyMap(VEHICLE_FUEL_OPTIONS);
