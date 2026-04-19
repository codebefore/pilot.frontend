import type { JobStatus } from "../types";
import type { CandidateGenderValue } from "./types";

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
  { value: "not_sent", label: "Gönderilmedi" },
  { value: "sent",     label: "Gönderildi" },
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
  { value: "pre_registered", label: "Ön Kayıt" },
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

/* ── Gender ─────────────────────────────────────────────────────
 *
 * Backend now only accepts the three canonical English values below. The
 * helpers in this section map any legacy / user-facing / stale value onto
 * that canonical set so the UI can stay in Turkish while payloads sent to
 * the API are always one of `female | male | unspecified` (or null).
 */

export const CANDIDATE_GENDER_VALUES: readonly CandidateGenderValue[] = [
  "female",
  "male",
  "unspecified",
];
export type { CandidateGenderValue };

/** Turkish display labels — intentionally hardcoded (task requirement). */
const CANDIDATE_GENDER_LABELS_TR: Record<CandidateGenderValue, string> = {
  female: "Kadın",
  male: "Erkek",
  unspecified: "Seçilmemiş",
};

/** Select options for the gender field (filter panel, future forms). */
export const CANDIDATE_GENDER_OPTIONS: { value: CandidateGenderValue; label: string }[] =
  CANDIDATE_GENDER_VALUES.map((value) => ({
    value,
    label: CANDIDATE_GENDER_LABELS_TR[value],
  }));

/**
 * Legacy alias map. Keys are already lowercased (Turkish locale) before
 * lookup, so we store them that way. This covers:
 *   - canonical English: female / male / unspecified
 *   - Turkish words:     kadin / kadın / erkek / secilmemis / seçilmemiş
 *   - legacy numeric:    -1, 0, 1 (ISO 5218-ish, plus old forms)
 * Unknown / untrusted input → null, so it never leaks to the backend.
 */
const CANDIDATE_GENDER_ALIASES: Record<string, CandidateGenderValue> = {
  female: "female",
  male: "male",
  unspecified: "unspecified",
  kadin: "female",
  "kadın": "female",
  k: "female",
  erkek: "male",
  e: "male",
  secilmemis: "unspecified",
  "seçilmemiş": "unspecified",
  belirsiz: "unspecified",
  "0": "female",
  "1": "male",
  "-1": "unspecified",
};

/**
 * Map any legacy / user / stale gender value onto canonical English.
 * Returns `null` for empty/unknown input so callers can decide whether to
 * omit the field entirely.
 */
export function normalizeCandidateGender(
  value: string | null | undefined
): CandidateGenderValue | null {
  if (value === null || value === undefined) return null;
  const key = String(value).trim().toLocaleLowerCase("tr-TR");
  if (key === "") return null;
  return CANDIDATE_GENDER_ALIASES[key] ?? null;
}

/**
 * Turkish display label for a gender value (canonical or legacy). Returns
 * an empty string for null/unknown so the caller can decide how to render
 * the empty state (e.g. an em-dash).
 */
export function candidateGenderLabel(
  value: string | null | undefined
): string {
  const canonical = normalizeCandidateGender(value);
  return canonical ? CANDIDATE_GENDER_LABELS_TR[canonical] : "";
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
    case "pre_registered": return "Ön Kayıt";
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
  return normalizeCandidateMebExamResultValue(result) ? "success" : "failed";
}

export function candidateMebExamResultLabel(
  result: string | null | undefined
): string {
  return normalizeCandidateMebExamResultValue(result) ? "Gönderildi" : "Gönderilmedi";
}

/* ── Group MEB status ── */

export function groupMebStatusToPill(mebStatus: string | null): JobStatus {
  if (!mebStatus) return "queued";
  switch (normalizeGroupMebStatusValue(mebStatus)) {
    case "not_sent": return "queued";
    case "sent":     return "success";
    default:              return "manual";
  }
}

export function groupMebStatusLabel(mebStatus: string | null): string {
  if (!mebStatus) return "Gönderilmedi";
  switch (normalizeGroupMebStatusValue(mebStatus)) {
    case "not_sent": return "Gönderilmedi";
    case "sent":     return "Gönderildi";
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
