import type { JobStatus } from "../types";

/* ── Shared select options ── */

export const LICENSE_CLASS_OPTIONS: { value: string; label: string }[] = [
  { value: "B",  label: "B — Otomobil" },
  { value: "A2", label: "A2 — Motosiklet" },
  { value: "C",  label: "C — Kamyon" },
  { value: "D",  label: "D — Otobüs" },
  { value: "E",  label: "E — Dorseli" },
];

export const GROUP_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "draft",       label: "Taslak" },
  { value: "active",      label: "Aktif" },
  { value: "closing",     label: "Kapanışta" },
  { value: "completed",   label: "Tamamlandı" },
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

export function normalizeCandidateStatusValue(status: string): string {
  return status.trim().toLowerCase();
}

export function normalizeGroupStatusValue(status: string): string {
  return status.trim().toLowerCase();
}

export function normalizeGroupMebStatusValue(mebStatus: string | null): string | null {
  if (!mebStatus) return null;
  return mebStatus.trim().toLowerCase();
}

export function candidateStatusToPill(status: string): JobStatus {
  switch (normalizeCandidateStatusValue(status)) {
    case "completed":   return "success";
    case "active":      return "running";
    case "pending":     return "queued";
    case "error":       return "failed";
    case "retry":       return "retry";
    case "new":         return "queued";
    default:            return "manual";
  }
}

export function candidateStatusLabel(status: string): string {
  switch (normalizeCandidateStatusValue(status)) {
    case "completed":   return "Tamam";
    case "active":      return "Çalışıyor";
    case "pending":     return "Bekliyor";
    case "error":       return "Hata";
    case "retry":       return "Tekrar";
    case "new":         return "Yeni";
    default:            return status;
  }
}

/* ── Group status ── */

export function groupStatusToPill(status: string): JobStatus {
  switch (normalizeGroupStatusValue(status)) {
    case "active":       return "running";
    case "draft":        return "queued";
    case "closing":      return "manual";
    case "completed":    return "success";
    default:              return "manual";
  }
}

export function groupStatusLabel(status: string): string {
  switch (normalizeGroupStatusValue(status)) {
    case "active":       return "Aktif";
    case "draft":        return "Taslak";
    case "closing":      return "Kapanışta";
    case "completed":    return "Tamamlandı";
    default:              return status;
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
    case "approved":       return "success";
    case "pending":        return "queued";
    case "rejected":       return "failed";
    case "missing":        return "failed";
    case "expiring_soon":  return "retry";
    default:               return "manual";
  }
}

export function documentStatusLabel(status: string): string {
  switch (status.toLowerCase()) {
    case "approved":       return "Onaylı";
    case "pending":        return "Beklemede";
    case "rejected":       return "Reddedildi";
    case "missing":        return "Eksik";
    case "expiring_soon":  return "Süresi Yaklaşıyor";
    default:               return status;
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
