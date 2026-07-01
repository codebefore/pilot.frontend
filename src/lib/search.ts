const MIN_SEARCH_QUERY_LENGTH = 2;

export function normalizeTextQuery(
  value: string | null | undefined,
  minLength = MIN_SEARCH_QUERY_LENGTH
): string | undefined {
  const trimmed = value?.trim() ?? "";
  return trimmed.length >= minLength ? trimmed : undefined;
}

export function normalizeSearchComparable(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC");
}
