import type { VehicleResponse } from "./types";

function normalizeLicenseClass(value: string): string {
  return value.trim().toLocaleUpperCase("tr-TR");
}

export function vehicleSupportsLicenseClass(
  vehicle: VehicleResponse,
  licenseClass: string
): boolean {
  if (vehicle.isSimulator) return true;

  const normalizedLicenseClass = normalizeLicenseClass(licenseClass);
  return vehicle.licenseClasses.some(
    (item) => normalizeLicenseClass(item) === normalizedLicenseClass
  );
}
