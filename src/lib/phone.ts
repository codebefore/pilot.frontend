export function formatPhoneNumber(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  const localDigits =
    digits.length === 11 && digits.startsWith("0")
      ? digits.slice(1)
      : digits.length === 12 && digits.startsWith("90")
        ? digits.slice(2)
        : digits;

  if (localDigits.length !== 10) {
    return raw?.trim() || "—";
  }

  return `0 ${localDigits.slice(0, 3)} ${localDigits.slice(3, 6)} ${localDigits.slice(
    6,
    8
  )} ${localDigits.slice(8, 10)}`;
}

export function buildWhatsAppUrl(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");

  if (digits.length === 10) {
    return `https://wa.me/90${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    return `https://wa.me/90${digits.slice(1)}`;
  }

  if (digits.length === 12 && digits.startsWith("90")) {
    return `https://wa.me/${digits}`;
  }

  return null;
}
