import type { ExamScheduleLicenseClassCount, ExamScheduleOption } from "./types";

const LICENSE_CLASS_ORDER = ["B", "A2", "C", "D", "E"];
const DRIVING_SUMMARY_LICENSE_CLASSES = ["B", "A2"];

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

export function formatLicenseClassTotalSummary(
  licenseClassCounts: ExamScheduleLicenseClassCount[]
): string {
  const totals = new Map<string, number>();

  for (const entry of licenseClassCounts) {
    totals.set(entry.licenseClass, (totals.get(entry.licenseClass) ?? 0) + entry.count);
  }

  for (const licenseClass of DRIVING_SUMMARY_LICENSE_CLASSES) {
    if (!totals.has(licenseClass)) {
      totals.set(licenseClass, 0);
    }
  }

  return Array.from(totals.entries())
    .map<ExamScheduleLicenseClassCount>(([licenseClass, count]) => ({ licenseClass, count }))
    .filter(
      (entry) => entry.count > 0 || DRIVING_SUMMARY_LICENSE_CLASSES.includes(entry.licenseClass)
    )
    .sort((left, right) => compareLicenseClasses(left.licenseClass, right.licenseClass))
    .map((entry) => `${entry.licenseClass}(${entry.count})`)
    .join(" ");
}
