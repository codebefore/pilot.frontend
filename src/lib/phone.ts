export function formatPhoneNumber(raw: string | null | undefined): string {
  const localDigits = normalizeTurkishPhoneDigits(raw);

  if (localDigits.length !== 10) {
    return raw?.trim() || "—";
  }

  return `0 ${localDigits.slice(0, 3)} ${localDigits.slice(3, 6)} ${localDigits.slice(
    6,
    8
  )} ${localDigits.slice(8, 10)}`;
}

export function formatPhoneInput(raw: string | null | undefined): string {
  const localDigits = normalizeTurkishPhoneDigits(raw).slice(0, 10);
  if (!localDigits) return "";

  const groups = [
    localDigits.slice(0, 3),
    localDigits.slice(3, 6),
    localDigits.slice(6, 8),
    localDigits.slice(8, 10),
  ].filter(Boolean);

  return `0 ${groups.join(" ")}`;
}

export function normalizePhoneForSubmit(raw: string | null | undefined): string | null {
  const localDigits = normalizeTurkishPhoneDigits(raw);
  return localDigits.length === 10 ? localDigits : null;
}

export function isValidTurkishPhoneNumber(raw: string | null | undefined): boolean {
  return normalizeTurkishPhoneDigits(raw).length === 10;
}

export function isValidTurkishMobilePhoneNumber(raw: string | null | undefined): boolean {
  const localDigits = normalizeTurkishPhoneDigits(raw);
  return localDigits.length === 10 && localDigits.startsWith("5");
}

export function buildWhatsAppUrl(raw: string | null | undefined): string | null {
  const digits = normalizeTurkishPhoneDigits(raw);

  if (digits.length === 10 && digits.startsWith("5")) {
    return `https://wa.me/90${digits}`;
  }

  return null;
}

function normalizeTurkishPhoneDigits(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("90")) {
    return digits.slice(2);
  }
  if (digits.length >= 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }
  return digits;
}
