export const MIN_SEARCH_QUERY_LENGTH = 2;

export function normalizeTextQuery(
  value: string | null | undefined,
  minLength = MIN_SEARCH_QUERY_LENGTH
): string | undefined {
  const trimmed = value?.trim() ?? "";
  return trimmed.length >= minLength ? trimmed : undefined;
}
