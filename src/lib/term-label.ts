import type { GroupTermRef, TermResponse } from "./types";

/** Months localized for the two supported UI languages. */
const MONTHS_TR = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];
const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type TermLike = Pick<GroupTermRef, "id" | "monthDate" | "sequence" | "name"> | TermResponse;

export type TermLabelLanguage = "tr" | "en";

function monthYear(monthDate: string, lang: TermLabelLanguage): string {
  const parts = monthDate.slice(0, 10).split("-");
  if (parts.length !== 3) return monthDate;
  const year = parts[0];
  const monthIdx = Math.max(0, Math.min(11, Number(parts[1]) - 1));
  const months = lang === "tr" ? MONTHS_TR : MONTHS_EN;
  return `${months[monthIdx]} ${year}`;
}

function sameMonth(a: TermLike, b: TermLike): boolean {
  return a.monthDate.slice(0, 7) === b.monthDate.slice(0, 7);
}

/**
 * Produce a display label for a single term using the supplied list as
 * context. The list lets us decide whether a given month has siblings.
 *
 * - A month with a single term: `Nisan 2026`
 * - A month with multiple terms: `Nisan 2026 / 1`, `Nisan 2026 / 2`
 * - A term with a `name`: `Nisan 2026 / 2 - Ek Donem`
 *
 * Backend does not compute this, so the frontend derives it locally. The
 * `siblings` argument is the full list of known terms (or any subset that
 * contains the relevant month peers).
 */
export function buildTermLabel(
  term: TermLike,
  siblings: TermLike[],
  lang: TermLabelLanguage = "tr"
): string {
  const base = monthYear(term.monthDate, lang);
  const peerCount = siblings.filter((t) => sameMonth(t, term)).length;
  let label = base;
  if (peerCount > 1) {
    label = `${base} / ${term.sequence}`;
  }
  if (term.name && term.name.trim().length > 0) {
    label = `${label} - ${term.name.trim()}`;
  }
  return label;
}

/**
 * Build the final group heading shown in cards/drawers. Legacy data may have
 * stored the term label inside the group title itself, e.g.
 * "1C Sinifi - Nisan 2026". When that exact term label is already present as
 * a suffix, remove only the duplicated suffix and keep the rest of the title
 * intact. When `licenseClass` is provided, it is appended as a parenthesized
 * suffix so the heading reads e.g. "1A Sinifi — Şubat 2026 - (C)".
 */
export function buildGroupHeading(
  title: string,
  term: TermLike,
  siblings: TermLike[],
  lang: TermLabelLanguage = "tr",
  licenseClass?: string | null
): string {
  const termLabel = buildTermLabel(term, siblings, lang);
  const normalizedTitle = title.trim();
  const licenseSuffix =
    licenseClass && licenseClass.trim().length > 0 ? ` - (${licenseClass.trim()})` : "";

  const withTerm = (() => {
    if (normalizedTitle === termLabel) {
      return termLabel;
    }
    for (const separator of [" - ", " — "]) {
      const suffix = `${separator}${termLabel}`;
      if (normalizedTitle.endsWith(suffix)) {
        const withoutSuffix = normalizedTitle.slice(0, -suffix.length).trim();
        return withoutSuffix.length > 0 ? `${withoutSuffix} — ${termLabel}` : termLabel;
      }
    }
    return `${normalizedTitle} — ${termLabel}`;
  })();

  return `${withTerm}${licenseSuffix}`;
}

/**
 * Sort helper that mirrors how we typically want terms ordered in the UI:
 * most recent months first, and within the same month by sequence descending
 * so the newest sibling term appears first.
 */
export function compareTermsDesc(a: TermLike, b: TermLike): number {
  if (a.monthDate !== b.monthDate) {
    return a.monthDate < b.monthDate ? 1 : -1;
  }
  return b.sequence - a.sequence;
}

/**
 * Prefer the term that belongs to the current month/year. If no term exists
 * for the current month, fall back to the newest known term.
 */
export function pickDefaultTermId(
  terms: TermLike[],
  now: Date = new Date()
): string | undefined {
  if (terms.length === 0) {
    return undefined;
  }

  const sortedTerms = [...terms].sort(compareTermsDesc);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const currentMonthKey = `${now.getFullYear()}-${month}`;

  return (
    sortedTerms.find((term) => term.monthDate.slice(0, 7) === currentMonthKey)?.id ??
    sortedTerms[0]?.id
  );
}
