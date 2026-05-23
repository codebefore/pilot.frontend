import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Persist which table columns are visible in localStorage keyed by
 * `storageKey`. Columns whose ids are not present in storage fall back to
 * `defaultVisibleIds` (or every column id when omitted). Unknown ids coming
 * from storage (stale keys after a column removal) are silently dropped.
 *
 * The hook guarantees at least one column stays visible unless `allowEmpty`
 * is enabled for tables with forced/locked columns.
 */
export function useColumnVisibility(
  storageKey: string,
  allColumnIds: string[],
  defaultVisibleIds?: string[],
  options: { allowEmpty?: boolean } = {}
) {
  const fallback = defaultVisibleIds ?? allColumnIds;
  const allowEmpty = options.allowEmpty ?? false;

  const readFromStorage = useCallback((): string[] => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return fallback;
      const filtered = parsed.filter(
        (id): id is string => typeof id === "string" && allColumnIds.includes(id)
      );
      return filtered.length > 0 || allowEmpty ? filtered : fallback;
    } catch {
      return fallback;
    }
    // allColumnIds / fallback identities change whenever the caller
    // re-renders with new columns, which is the intended signal to re-read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, allColumnIds.join(","), fallback.join(","), allowEmpty]);

  const [state, setState] = useState<{ storageKey: string; visibleIds: string[] }>(() => ({
    storageKey,
    visibleIds: readFromStorage(),
  }));

  useEffect(() => {
    setState({ storageKey, visibleIds: readFromStorage() });
  }, [readFromStorage, storageKey]);

  useEffect(() => {
    if (state.storageKey !== storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state.visibleIds));
    } catch {
      /* ignore storage errors (quota, private mode) */
    }
  }, [storageKey, state]);

  const visibleIds = state.visibleIds;
  const visibleSet = useMemo(() => new Set(visibleIds), [visibleIds]);

  const isVisible = useCallback((id: string) => visibleSet.has(id), [visibleSet]);

  const toggle = useCallback(
    (id: string) => {
      setState((currentState) => {
        const current = currentState.visibleIds;
        if (current.includes(id)) {
          // Never allow hiding the last visible column.
          if (!allowEmpty && current.length === 1) return currentState;
          return { ...currentState, visibleIds: current.filter((c) => c !== id) };
        }
        // Preserve the original column order defined by `allColumnIds`.
        const next = new Set(current);
        next.add(id);
        return { ...currentState, visibleIds: allColumnIds.filter((c) => next.has(c)) };
      });
    },
    [allColumnIds, allowEmpty]
  );

  const reset = useCallback(
    () => setState({ storageKey, visibleIds: fallback }),
    [fallback, storageKey]
  );

  return { visibleIds, isVisible, toggle, reset };
}
