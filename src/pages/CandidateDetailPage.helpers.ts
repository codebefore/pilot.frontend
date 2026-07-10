import type { CandidateResponse, DocumentTypeResponse, LicenseClassFeeRowResponse } from "../lib/types";
import type { useT } from "../lib/i18n";

export function hasExistingLicenseValue(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLocaleLowerCase("tr-TR") ?? "";
  return normalized !== "" && normalized !== "-" && normalized !== "yok" && normalized !== "none" && normalized !== "exempt";
}

export function candidateHasExistingLicense(candidate: Pick<CandidateResponse, "hasExistingLicense" | "existingLicenseType">): boolean {
  return candidate.hasExistingLicense === true || hasExistingLicenseValue(candidate.existingLicenseType);
}

export function shouldShowEmptyLicenseFeeWarning(
  theoryRow: Pick<LicenseClassFeeRowResponse, "institutionTheoryExamFee"> | null | undefined,
  practiceRow: Pick<LicenseClassFeeRowResponse, "institutionPracticeExamFee"> | null | undefined
): boolean {
  return (
    theoryRow?.institutionTheoryExamFee == null &&
    practiceRow?.institutionPracticeExamFee == null
  );
}

export function calculateLicenseContractTotal(
  theoryRow: Pick<LicenseClassFeeRowResponse, "lessonHours"> | null | undefined,
  practiceRow: Pick<LicenseClassFeeRowResponse, "lessonHours"> | null | undefined,
  theoryHourlyRate: number | null,
  practiceHourlyRate: number | null
): number | null {
  const hasTheory = theoryHourlyRate != null && Number.isFinite(theoryHourlyRate);
  const hasPractice = practiceHourlyRate != null && Number.isFinite(practiceHourlyRate);
  if (!hasTheory && !hasPractice) return null;

  const total =
    (hasTheory ? theoryHourlyRate * (theoryRow?.lessonHours ?? 0) : 0) +
    (hasPractice ? practiceHourlyRate * (practiceRow?.lessonHours ?? 0) : 0);
  return Math.round(total * 100) / 100;
}

export function parseTurkishMoneyInput(value: string): number | null {
  const compact = value.trim().replace(/\s/g, "");
  if (!compact) return null;

  let normalized = compact;
  if (compact.includes(",")) {
    if ((compact.match(/,/g) ?? []).length !== 1) return null;
    normalized = compact.replace(/\./g, "").replace(",", ".");
  } else {
    const dotCount = (compact.match(/\./g) ?? []).length;
    if (dotCount > 1) {
      normalized = compact.replace(/\./g, "");
    } else if (dotCount === 1) {
      const [integerPart, fractionPart] = compact.split(".");
      if (fractionPart.length === 3 && integerPart.length >= 1 && integerPart.length <= 3) {
        normalized = `${integerPart}${fractionPart}`;
      }
    }
  }

  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function isPenaltyPointsLicenseClass(licenseClass: string | null | undefined): boolean {
  const key = normalizeLicenseOptionKey(licenseClass ?? "");
  return key === "100CP" || key === "100CEZAPUANI" || key === "100CEZAPUAN";
}

export function isExistingLicenseCopyType(type: DocumentTypeResponse): boolean {
  const normalizedName = type.name.trim().toLocaleLowerCase("tr-TR");
  return (
    type.key === "existing_license_copy" ||
    (normalizedName.includes("mevcut") &&
      normalizedName.includes("ehliyet") &&
      normalizedName.includes("fotokopi"))
  );
}

export function canRetryMebbisDocumentTransfer(typeKey: string, isMebbisTransferred: boolean): boolean {
  return typeKey === "biometric_photo" || typeKey === "webcam_photo" || typeKey === "signature_sample" || typeKey === "contract_front" || typeKey === "contract_back" || typeKey === "education_certificate" || typeKey === "health_report" || typeKey === "criminal_record" || !isMebbisTransferred;
}

export function shouldShowMebbisDocumentTransferAction(typeKey: string): boolean {
  return typeKey !== "contract_back";
}

export function calculateAge(birthDateIso: string | null): number | null {
  if (!birthDateIso) return null;
  const birthDate = new Date(birthDateIso);
  if (Number.isNaN(birthDate.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDelta = now.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

export function vehicleTypeForLicenseClass(licenseClass: string, t: ReturnType<typeof useT>): string | null {
  const key = licenseClass.trim().toUpperCase().replace(/[\s_-]/g, "");
  if (!key) return null;
  if (key === "M" || key.startsWith("A") || key.startsWith("B1")) return t("vehicleType.motorcycle");
  if (key.startsWith("BENGELLI")) return t("vehicleType.disabledCar");
  if (key.startsWith("BE")) return t("vehicleType.trailerCar");
  if (key.startsWith("B")) return t("vehicleType.car");
  if (key.startsWith("CE") || key.startsWith("C1E")) return t("vehicleType.trailerTruck");
  if (key.startsWith("C")) return t("vehicleType.truck");
  if (key.startsWith("DE") || key.startsWith("D1E")) return t("vehicleType.trailerBus");
  if (key.startsWith("D")) return t("vehicleType.bus");
  if (key.startsWith("F")) return t("vehicleType.tractor");
  if (key === "G") return t("vehicleType.workMachine");
  return null;
}

export function buildFutureStages(candidate: CandidateResponse, t: ReturnType<typeof useT>): string[] {
  const stage = candidate.examStageLabel;
  if (!stage || stage === "Mezun" || stage === "Dosya Yakıldı") return [];
  if (stage === "E-Sınav Aşamasında") return [t("candidateDetail.futureStage.drivingStage"), t("candidateDetail.futureStage.graduated")];
  if (stage === "Direksiyon Aşamasında" || stage === "2. Direksiyon Aşaması") return [t("candidateDetail.futureStage.graduated")];
  return [];
}

export function formatTimelineDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function todayIsoDate(): string {
  const date = new Date();
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function nowDateTimeLocal(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Istanbul",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addHours(date: Date, hours: number): Date {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}

export function dateOnlyAt(dateIso: string, hour: number): Date {
  const [year, month, day] = dateIso.split("-").map((part) => parseInt(part, 10));
  return new Date(year, month - 1, day, hour, 0, 0, 0);
}

export function normalizeLicenseOptionKey(value: string): string {
  return value
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/Ç/g, "C")
    .replace(/Ğ/g, "G")
    .replace(/İ/g, "I")
    .replace(/Ö/g, "O")
    .replace(/Ş/g, "S")
    .replace(/Ü/g, "U")
    .replace(/OTOMATIK/g, "AUTO")
    .replace(/YENI\s*NESIL/g, "NEWGEN")
    .replace(/ENGELLI/g, "DISABLED")
    .replace(/[^A-Z0-9]/g, "");
}
