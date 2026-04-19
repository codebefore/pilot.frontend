export type UserRole = "Patron" | "Muhasebe" | "Operasyon" | "Eğitmen";

export function formatPhone(raw: string): string {
  if (raw.length !== 10) return raw;
  return `0${raw.slice(0, 3)} ${raw.slice(3, 6)} ${raw.slice(6, 8)} ${raw.slice(8, 10)}`;
}
