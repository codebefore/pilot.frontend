import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Persist which table columns are visible in localStorage keyed by
 * `storageKey`. Columns whose ids are not present in storage fall back to
 * `defaultVisibleIds` (or every column id when omitted). Unknown ids coming
 * from storage (stale keys after a column removal) are silently dropped.
 *
 * The hook guarantees at least one column stays visible — attempts to hide
 * the last visible column are ignored so the table never renders empty.
 */
export function useColumnVisibility(
  storageKey: string,
  allColumnIds: string[],
  defaultVisibleIds?: string[]
) {
  const fallback = defaultVisibleIds ?? allColumnIds;

  const readFromStorage = useCallback((): string[] => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return fallback;
      const filtered = parsed.filter(
        (id): id is string => typeof id === "string" && allColumnIds.includes(id)
      );
      return filtered.length > 0 ? filtered : fallback;
    } catch {
      return fallback;
    }
    // allColumnIds / fallback identities change whenever the caller
    // re-renders with new columns, which is the intended signal to re-read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, allColumnIds.join(","), fallback.join(",")]);

  const [visibleIds, setVisibleIds] = useState<string[]>(() => readFromStorage());

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(visibleIds));
    } catch {
      /* ignore storage errors (quota, private mode) */
    }
  }, [storageKey, visibleIds]);

  const visibleSet = useMemo(() => new Set(visibleIds), [visibleIds]);

  const isVisible = useCallback((id: string) => visibleSet.has(id), [visibleSet]);

  const toggle = useCallback(
    (id: string) => {
      setVisibleIds((current) => {
        if (current.includes(id)) {
          // Never allow hiding the last visible column.
          if (current.length === 1) return current;
          return current.filter((c) => c !== id);
        }
        // Preserve the original column order defined by `allColumnIds`.
        const next = new Set(current);
        next.add(id);
        return allColumnIds.filter((c) => next.has(c));
      });
    },
    [allColumnIds]
  );

  const reset = useCallback(() => setVisibleIds(fallback), [fallback]);

  return { visibleIds, isVisible, toggle, reset };
}
