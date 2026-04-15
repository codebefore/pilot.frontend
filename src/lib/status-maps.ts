import type { JobStatus } from "../types";

/* ── Shared select options ── */

export const LICENSE_CLASS_OPTIONS: { value: string; label: string }[] = [
  { value: "B",  label: "B — Otomobil" },
  { value: "A2", label: "A2 — Motosiklet" },
  { value: "C",  label: "C — Kamyon" },
  { value: "D",  label: "D — Otobüs" },
  { value: "E",  label: "E — Dorseli" },
];

export const EXISTING_LICENSE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "exempt", label: "Muaf" },
  { value: "m", label: "M" },
  { value: "m_auto", label: "M - Otomatik" },
  { value: "a1", label: "A1" },
  { value: "a1_auto", label: "A1 - Otomatik" },
  { value: "a1_new_gen", label: "A1 - Yeni Nesil" },
  { value: "a1_new_gen_auto", label: "A1 - Yeni Nesil Otomatik" },
  { value: "a2", label: "A2" },
  { value: "a2_auto", label: "A2 - Otomatik" },
  { value: "a", label: "A" },
  { value: "a_auto", label: "A - Otomatik" },
  { value: "b1", label: "B1" },
  { value: "b1_auto", label: "B1 - Otomatik" },
  { value: "b", label: "B" },
  { value: "b_auto", label: "B - Otomatik" },
  { value: "b_disabled", label: "B - Engelli" },
  { value: "be", label: "BE" },
  { value: "be_auto", label: "BE - Otomatik" },
  { value: "c1", label: "C1" },
  { value: "c1_auto", label: "C1 - Otomatik" },
  { value: "c1e", label: "C1E" },
  { value: "c1e_auto", label: "C1E - Otomatik" },
  { value: "c", label: "C" },
  { value: "c_auto", label: "C - Otomatik" },
  { value: "ce", label: "CE" },
  { value: "ce_auto", label: "CE - Otomatik" },
  { value: "d1", label: "D1" },
  { value: "d1_auto", label: "D1 - Otomatik" },
  { value: "d1e", label: "D1E" },
  { value: "d1e_auto", label: "D1E - Otomatik" },
  { value: "d", label: "D" },
  { value: "d_auto", label: "D - Otomatik" },
  { value: "de", label: "DE" },
  { value: "de_auto", label: "DE - Otomatik" },
  { value: "e", label: "E" },
  { value: "e_auto", label: "E - Otomatik" },
  { value: "f", label: "F" },
  { value: "f_auto", label: "F - Otomatik" },
  { value: "g", label: "G" },
  { value: "g_auto", label: "G - Otomatik" },
  { value: "cp_100", label: "100/CP" },
];

export function existingLicenseTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return EXISTING_LICENSE_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

const TURKEY_PROVINCES = [
  "Adana",
  "Adiyaman",
  "Afyonkarahisar",
  "Agri",
  "Aksaray",
  "Amasya",
  "Ankara",
  "Antalya",
  "Ardahan",
  "Artvin",
  "Aydin",
  "Balikesir",
  "Bartin",
  "Batman",
  "Bayburt",
  "Bilecik",
  "Bingol",
  "Bitlis",
  "Bolu",
  "Burdur",
  "Bursa",
  "Canakkale",
  "Cankiri",
  "Corum",
  "Denizli",
  "Diyarbakir",
  "Duzce",
  "Edirne",
  "Elazig",
  "Erzincan",
  "Erzurum",
  "Eskisehir",
  "Gaziantep",
  "Giresun",
  "Gumushane",
  "Hakkari",
  "Hatay",
  "Igdir",
  "Isparta",
  "Istanbul",
  "Izmir",
  "Kahramanmaras",
  "Karabuk",
  "Karaman",
  "Kars",
  "Kastamonu",
  "Kayseri",
  "Kilis",
  "Kirikkale",
  "Kirklareli",
  "Kirsehir",
  "Kocaeli",
  "Konya",
  "Kutahya",
  "Malatya",
  "Manisa",
  "Mardin",
  "Mersin",
  "Mugla",
  "Mus",
  "Nevsehir",
  "Nigde",
  "Ordu",
  "Osmaniye",
  "Rize",
  "Sakarya",
  "Samsun",
  "Sanliurfa",
  "Siirt",
  "Sinop",
  "Sirnak",
  "Sivas",
  "Tekirdag",
  "Tokat",
  "Trabzon",
  "Tunceli",
  "Usak",
  "Van",
  "Yalova",
  "Yozgat",
  "Zonguldak",
] as const;

export const TURKEY_PROVINCE_OPTIONS: { value: string; label: string }[] = TURKEY_PROVINCES.map(
  (province) => ({
    value: province,
    label: province,
  })
);

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

export function normalizeCandidateMebExamResultValue(
  result: string | null | undefined
): string | null {
  if (!result) return null;
  return result.trim().toLowerCase();
}

export function candidateMebExamResultToPill(
  result: string | null | undefined
): JobStatus {
  switch (normalizeCandidateMebExamResultValue(result)) {
    case "passed": return "success";
    case "failed": return "failed";
    default:       return "queued";
  }
}

export function candidateMebExamResultLabel(
  result: string | null | undefined
): string {
  switch (normalizeCandidateMebExamResultValue(result)) {
    case "passed": return "Gecti";
    case "failed": return "Kaldi";
    default:       return "—";
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
