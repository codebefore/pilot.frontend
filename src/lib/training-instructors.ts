import type { InstructorResponse } from "./types";

function normalizeLicenseClass(value: string): string {
  return value.trim().toLocaleUpperCase("tr-TR");
}

export function instructorSupportsLicenseClass(
  instructor: InstructorResponse,
  licenseClass: string
): boolean {
  const normalizedLicenseClass = normalizeLicenseClass(licenseClass);
  return instructor.licenseClassCodes.some(
    (item) => normalizeLicenseClass(item) === normalizedLicenseClass
  );
}
