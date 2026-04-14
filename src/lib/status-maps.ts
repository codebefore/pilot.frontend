import type { JobStatus } from "../types";

/* ── Shared select options ── */

export const LICENSE_CLASS_OPTIONS: { value: string; label: string }[] = [
  { value: "B",  label: "B — Otomobil" },
  { value: "A2", label: "A2 — Motosiklet" },
  { value: "C",  label: "C — Kamyon" },
  { value: "D",  label: "D — Otobüs" },
  { value: "E",  label: "E — Dorseli" },
];

export const GROUP_MEB_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "pending",       label: "Bekliyor" },
  { value: "planned",       label: "Planlandı" },
  { value: "created",       label: "Oluşturuldu" },
  { value: "manual_review", label: "Manuel Onay" },
  { value: "closed",        label: "Kapandı" },
  { value: "error",         label: "Hata" },
];


/* ── Candidate status ── */

/** Canonical English candidate status values sent to / returned by the API. */
export type CandidateStatusValue =
  | "pre_registered"
  | "active"
  | "parked"
  | "graduated"
  | "dropped";

export const CANDIDATE_STATUS_VALUES: CandidateStatusValue[] = [
  "pre_registered",
  "active",
  "parked",
  "graduated",
  "dropped",
];

/** Select options for the candidate status field (drawer + modal). */
export const CANDIDATE_STATUS_OPTIONS: { value: CandidateStatusValue; label: string }[] = [
  { value: "pre_registered", label: "Onkayit" },
  { value: "active",         label: "Aktif" },
  { value: "parked",         label: "Park" },
  { value: "graduated",      label: "Mezun" },
  { value: "dropped",        label: "Dosya Yakan" },
];

export function normalizeCandidateStatusValue(status: string): string {
  return status.trim().toLowerCase();
}

export function normalizeGroupMebStatusValue(mebStatus: string | null): string | null {
  if (!mebStatus) return null;
  return mebStatus.trim().toLowerCase();
}

export function candidateStatusToPill(status: string): JobStatus {
  switch (normalizeCandidateStatusValue(status)) {
    case "pre_registered": return "queued";
    case "active":         return "running";
    case "parked":         return "manual";
    case "graduated":      return "success";
    case "dropped":        return "failed";
    default:               return "manual";
  }
}

export function candidateStatusLabel(status: string): string {
  switch (normalizeCandidateStatusValue(status)) {
    case "pre_registered": return "Onkayit";
    case "active":         return "Aktif";
    case "parked":         return "Park";
    case "graduated":      return "Mezun";
    case "dropped":        return "Dosya Yakan";
    default:               return status;
  }
}

/* ── Group MEB status ── */

export function groupMebStatusToPill(mebStatus: string | null): JobStatus {
  if (!mebStatus) return "queued";
  switch (normalizeGroupMebStatusValue(mebStatus)) {
    case "planned":       return "queued";
    case "created":       return "success";
    case "closed":        return "success";
    case "manual_review": return "manual";
    case "error":         return "failed";
    case "pending":       return "queued";
    default:              return "manual";
  }
}

export function groupMebStatusLabel(mebStatus: string | null): string {
  if (!mebStatus) return "Atanmamış";
  switch (normalizeGroupMebStatusValue(mebStatus)) {
    case "planned":       return "Planlandı";
    case "created":       return "Oluşturuldu";
    case "closed":        return "Kapandı";
    case "manual_review": return "Manuel Onay";
    case "error":         return "Hata";
    case "pending":       return "Bekliyor";
    default:              return mebStatus;
  }
}

/* ── Document status ── */

export function documentStatusToPill(status: string): JobStatus {
  switch (status.toLowerCase()) {
    case "uploaded": return "success";
    case "missing": return "failed";
    default: return "manual";
  }
}

export function documentStatusLabel(status: string): string {
  switch (status.toLowerCase()) {
    case "uploaded": return "Yüklendi";
    case "missing": return "Eksik";
    default: return status;
  }
}

/* ── Date formatting ── */

export function formatDateTR(iso: string | null | undefined): string {
  if (!iso) return "—";
  // Handle ISO datetime strings (e.g. "2026-04-01T00:00:00Z")
  const dateStr = iso.slice(0, 10);
  const parts = dateStr.split("-");
  if (parts.length !== 3) return iso;
  const [year, month, day] = parts;
  return `${day}.${month}.${year}`;
}
