/**
 * Türk TC Kimlik No formatlayıcı. 11 haneli rakamı `XXX XXX XXX XX` paterniyle
 * gruplar (okuma kolaylığı). Geçerli olmayan girdiyi olduğu gibi döner — sadece
 * görüntüleme için kullanılır, doğrulama yapmaz.
 */
export function formatNationalId(value: string | null | undefined): string {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return value;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9, 11)}`;
}
