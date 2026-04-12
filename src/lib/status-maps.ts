import type { JobStatus } from "../types";

/* ── Candidate status ── */

export function candidateStatusToPill(status: string): JobStatus {
  switch (status.toLowerCase()) {
    case "tamam":       return "success";
    case "calisiyor":   return "running";
    case "bekliyor":    return "queued";
    case "hata":        return "failed";
    case "tekrar":      return "retry";
    case "new":         return "queued";
    default:            return "manual";
  }
}

export function candidateStatusLabel(status: string): string {
  switch (status.toLowerCase()) {
    case "tamam":       return "Tamam";
    case "calisiyor":   return "Çalışıyor";
    case "bekliyor":    return "Bekliyor";
    case "hata":        return "Hata";
    case "tekrar":      return "Tekrar";
    case "new":         return "Yeni";
    default:            return status;
  }
}

/* ── Group status ── */

export function groupStatusToPill(status: string): JobStatus {
  switch (status.toLowerCase()) {
    case "aktif":         return "running";
    case "draft":         return "queued";
    case "kapanista":     return "manual";
    case "tamamlandi":    return "success";
    case "tamamlandı":    return "success";
    default:              return "manual";
  }
}

export function groupStatusLabel(status: string): string {
  switch (status.toLowerCase()) {
    case "aktif":         return "Aktif";
    case "draft":         return "Taslak";
    case "kapanista":     return "Kapanışta";
    case "tamamlandi":
    case "tamamlandı":    return "Tamamlandı";
    default:              return status;
  }
}

/* ── Group MEB status ── */

export function groupMebStatusToPill(mebStatus: string | null): JobStatus {
  if (!mebStatus) return "queued";
  switch (mebStatus.toLowerCase()) {
    case "olusturuldu":   return "success";
    case "oluşturuldu":   return "success";
    case "kapandi":
    case "kapandı":       return "success";
    case "manuel onay":   return "manual";
    case "hata":          return "failed";
    case "bekliyor":      return "queued";
    default:              return "manual";
  }
}

export function groupMebStatusLabel(mebStatus: string | null): string {
  if (!mebStatus) return "Atanmamış";
  switch (mebStatus.toLowerCase()) {
    case "olusturuldu":
    case "oluşturuldu":   return "Oluşturuldu";
    case "kapandi":
    case "kapandı":       return "Kapandı";
    case "manuel onay":   return "Manuel Onay";
    case "hata":          return "Hata";
    case "bekliyor":      return "Bekliyor";
    default:              return mebStatus;
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
