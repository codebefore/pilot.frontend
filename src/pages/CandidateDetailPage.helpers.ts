import type { CandidateResponse, DocumentTypeResponse } from "../lib/types";

export function hasExistingLicenseValue(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLocaleLowerCase("tr-TR") ?? "";
  return normalized !== "" && normalized !== "-" && normalized !== "yok" && normalized !== "none" && normalized !== "exempt";
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

export function vehicleTypeForLicenseClass(licenseClass: string): string | null {
  const key = licenseClass.trim().toUpperCase().replace(/[\s_-]/g, "");
  if (!key) return null;
  if (key === "M" || key.startsWith("A") || key.startsWith("B1")) return "Motosiklet";
  if (key.startsWith("BENGELLI")) return "Engelli Otomobil";
  if (key.startsWith("BE")) return "Römorklu Otomobil";
  if (key.startsWith("B")) return "Otomobil";
  if (key.startsWith("CE") || key.startsWith("C1E")) return "Römorklu Kamyon";
  if (key.startsWith("C")) return "Kamyon";
  if (key.startsWith("DE") || key.startsWith("D1E")) return "Römorklu Otobüs";
  if (key.startsWith("D")) return "Otobüs";
  if (key.startsWith("F")) return "Traktör";
  if (key === "G") return "İş Makinesi";
  return null;
}

export function actorAvatarTone(name: string): "brand" | "blue" | "purple" | "amber" {
  const palette = ["brand", "blue", "purple", "amber"] as const;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

export function mapToneToAvatar(tone: string): "brand" | "blue" | "purple" | "amber" {
  switch (tone) {
    case "current":
      return "brand";
    case "future":
      return "purple";
    case "warning":
    case "danger":
    case "amber":
      return "amber";
    case "info":
    case "blue":
      return "blue";
    default:
      return "brand";
  }
}

export function buildFutureStages(candidate: CandidateResponse): string[] {
  const stage = candidate.examStageLabel;
  if (!stage || stage === "Mezun" || stage === "Dosya Yakıldı") return [];
  if (stage === "E-Sınav Aşamasında") return ["Direksiyon Aşaması", "Mezun"];
  if (stage === "Direksiyon Aşamasında" || stage === "2. Direksiyon Aşaması") return ["Mezun"];
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
