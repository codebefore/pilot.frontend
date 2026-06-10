import type { ExamScheduleOption } from "./types";

const LICENSE_CLASS_ORDER = ["B", "A2", "C", "D", "E"];

function getLicenseClassSortIndex(licenseClass: string): number {
  const index = LICENSE_CLASS_ORDER.findIndex(
    (item) => item.toLocaleLowerCase("tr-TR") === licenseClass.toLocaleLowerCase("tr-TR")
  );

  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function compareLicenseClasses(left: string, right: string): number {
  const sortIndex = getLicenseClassSortIndex(left) - getLicenseClassSortIndex(right);
  return sortIndex !== 0 ? sortIndex : left.localeCompare(right, "tr");
}

function formatLicenseClassHeaderCode(licenseClass: string): string {
  return licenseClass
    .split("-")
    .map((part, index) => {
      const trimmed = part.trim();
      return index === 0 || trimmed.length <= 2 ? trimmed : trimmed[0] ?? trimmed;
    })
    .filter(Boolean)
    .join("-");
}

export function formatExamScheduleLicenseClassSummary(option: ExamScheduleOption): string {
  const summary = (option.licenseClassCounts ?? [])
    .filter((entry) => entry.count > 0)
    .slice()
    .sort((left, right) => compareLicenseClasses(left.licenseClass, right.licenseClass))
    .map((entry) => `${entry.licenseClass}(${entry.count})`)
    .join(" - ");

  return summary
    ? `(${option.candidateCount}/${option.capacity}) ${summary}`
    : `(${option.candidateCount}/${option.capacity})`;
}

export function formatExamScheduleLicenseClassHeader(option: ExamScheduleOption): string {
  return (option.licenseClassCounts ?? [])
    .filter((entry) => entry.count > 0)
    .slice()
    .sort((left, right) => compareLicenseClasses(left.licenseClass, right.licenseClass))
    .map((entry) => formatLicenseClassHeaderCode(entry.licenseClass))
    .join(" - ");
}
