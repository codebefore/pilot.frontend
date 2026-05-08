export function isPhoneStartingWith5(raw: string | null | undefined): boolean {
  return (raw ?? "").trim().startsWith("5");
}

export function buildWhatsAppUrl(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  const local = digits.length >= 12 && digits.startsWith("90")
    ? digits.slice(2)
    : digits.length >= 11 && digits.startsWith("0")
      ? digits.slice(1)
      : digits;

  if (local.length === 10 && local.startsWith("5")) {
    return `https://wa.me/90${local}`;
  }

  return null;
}
