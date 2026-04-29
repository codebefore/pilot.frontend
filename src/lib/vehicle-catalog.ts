import type {
  VehicleFuelType,
  VehicleOwnershipType,
  VehicleStatus,
  VehicleTransmissionType,
  VehicleType,
} from "./types";
import { REFERENCE_LICENSE_CLASS_OPTIONS } from "./use-license-class-options";

type Option<T extends string> = {
  value: T;
  label: string;
};

export const VEHICLE_STATUS_OPTIONS: Option<VehicleStatus>[] = [
  { value: "idle", label: "Boşta" },
  { value: "in_use", label: "Kullanımda" },
  { value: "maintenance", label: "Bakımda" },
];

export const VEHICLE_TRANSMISSION_OPTIONS: Option<VehicleTransmissionType>[] = [
  { value: "manual", label: "Düz" },
  { value: "automatic", label: "Otomatik" },
];

export const VEHICLE_TYPE_OPTIONS: Option<VehicleType>[] = [
  { value: "automobile", label: "Otomobil" },
  { value: "motorcycle", label: "Motosiklet" },
  { value: "minibus", label: "Minibüs" },
  { value: "bus", label: "Otobüs" },
  { value: "pickup", label: "Kamyonet" },
  { value: "truck", label: "Kamyon" },
  { value: "trailer", label: "Römork" },
  { value: "work_machine", label: "İş Makinesi" },
  { value: "tir", label: "Tır" },
];

export const VEHICLE_OWNERSHIP_OPTIONS: Option<VehicleOwnershipType>[] = [
  { value: "owned", label: "Satın Alındı" },
  { value: "leased", label: "Kiralandı" },
];

export const VEHICLE_FUEL_OPTIONS: Option<VehicleFuelType>[] = [
  { value: "gasoline", label: "Benzin" },
  { value: "diesel", label: "Dizel" },
  { value: "lpg", label: "LPG" },
  { value: "electric", label: "Elektrik" },
  { value: "hybrid", label: "Hibrit" },
];

export const VEHICLE_LICENSE_CLASS_OPTIONS = [...REFERENCE_LICENSE_CLASS_OPTIONS];

function buildLabelMap<T extends string>(options: Option<T>[]): Record<T, string> {
  return options.reduce(
    (acc, option) => ({ ...acc, [option.value]: option.label }),
    {} as Record<T, string>
  );
}

export const VEHICLE_STATUS_LABELS = buildLabelMap(VEHICLE_STATUS_OPTIONS);
export const VEHICLE_TRANSMISSION_LABELS = buildLabelMap(VEHICLE_TRANSMISSION_OPTIONS);
export const VEHICLE_TYPE_LABELS = buildLabelMap(VEHICLE_TYPE_OPTIONS);
export const VEHICLE_OWNERSHIP_LABELS = buildLabelMap(VEHICLE_OWNERSHIP_OPTIONS);
export const VEHICLE_FUEL_LABELS = buildLabelMap(VEHICLE_FUEL_OPTIONS);
