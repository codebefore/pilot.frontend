/**
 * Türkçe karakter duyarlı büyük harf dönüşümü.
 * Standart `toUpperCase()` `i` → `I` çevirir (yanlış); `tr-TR` locale
 * `i` → `İ`, `ı` → `I` yapar. Aday ad/soyad gibi insan ismi alanları
 * için bu davranış gerekli.
 *
 * `null`/`undefined` korunur; boş string boş kalır (input clear case).
 */
export function toTurkishUpperCase(value: string): string {
  if (!value) return value;
  return value.toLocaleUpperCase("tr-TR");
}
