export function isPhoneStartingWith5(raw: string | null | undefined): boolean {
  return (raw ?? "").trim().startsWith("5");
}

function normalizeTurkeyLocal(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  const local = digits.length >= 12 && digits.startsWith("90")
    ? digits.slice(2)
    : digits.length >= 11 && digits.startsWith("0")
      ? digits.slice(1)
      : digits;

  return local.length === 10 ? local : null;
}

function normalizeTurkeyMobileLocal(raw: string | null | undefined): string | null {
  const local = normalizeTurkeyLocal(raw);
  return local?.startsWith("5") ? local : null;
}

export function formatPhoneDisplay(raw: string | null | undefined, fallback = "—"): string {
  const local = normalizeTurkeyLocal(raw);
  if (!local) {
    const trimmed = (raw ?? "").trim();
    return trimmed || fallback;
  }

  return `+90 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 8)} ${local.slice(8)}`;
}

export function buildWhatsAppUrl(raw: string | null | undefined): string | null {
  const local = normalizeTurkeyMobileLocal(raw);

  if (local) {
    return `https://wa.me/90${local}`;
  }

  return null;
}
