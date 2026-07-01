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
  options: {
    allowEmpty?: boolean;
    fallbackStorageKey?: string;
    removeStorageOnReset?: boolean;
    deferInitialPersist?: boolean;
  } = {}
) {
  const fallback = defaultVisibleIds ?? allColumnIds;
  const allowEmpty = options.allowEmpty ?? false;
  const fallbackStorageKey = options.fallbackStorageKey;
  const removeStorageOnReset = options.removeStorageOnReset ?? false;
  const deferInitialPersist = options.deferInitialPersist ?? false;

  const filterStoredColumnIds = useCallback(
    (raw: string | null): string[] | null => {
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      const filtered = parsed.filter(
        (id): id is string => typeof id === "string" && allColumnIds.includes(id)
      );
      return filtered.length > 0 || allowEmpty ? filtered : fallback;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allColumnIds.join(","), fallback.join(","), allowEmpty]
  );

  const readFromStorage = useCallback((): { visibleIds: string[]; writeMode: "persist" | "skip" } => {
    try {
      const stored = localStorage.getItem(storageKey);
      const fallbackStored = !stored && fallbackStorageKey
        ? localStorage.getItem(fallbackStorageKey)
        : null;
      const raw = stored ?? fallbackStored;
      if (!raw) {
        return { visibleIds: fallback, writeMode: deferInitialPersist ? "skip" : "persist" };
      }
      const visibleIds = filterStoredColumnIds(raw) ?? fallback;
      return {
        visibleIds,
        writeMode: !stored && deferInitialPersist ? "skip" : "persist",
      };
    } catch {
      return { visibleIds: fallback, writeMode: deferInitialPersist ? "skip" : "persist" };
    }
    // allColumnIds / fallback identities change whenever the caller
    // re-renders with new columns, which is the intended signal to re-read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, fallbackStorageKey, fallback.join(","), deferInitialPersist, filterStoredColumnIds]);

  const readResetVisibleIds = useCallback((): string[] => {
    if (!removeStorageOnReset || !fallbackStorageKey) return fallback;
    try {
      return filterStoredColumnIds(localStorage.getItem(fallbackStorageKey)) ?? fallback;
    } catch {
      return fallback;
    }
  }, [fallback, fallbackStorageKey, filterStoredColumnIds, removeStorageOnReset]);

  const [state, setState] = useState<{
    storageKey: string;
    visibleIds: string[];
    writeMode?: "persist" | "remove" | "skip";
  }>(() => {
    const initial = readFromStorage();
    return {
      storageKey,
      visibleIds: initial.visibleIds,
      writeMode: initial.writeMode,
    };
  });

  useEffect(() => {
    const next = readFromStorage();
    setState({ storageKey, visibleIds: next.visibleIds, writeMode: next.writeMode });
  }, [readFromStorage, storageKey]);

  useEffect(() => {
    if (state.storageKey !== storageKey) return;
    try {
      if (state.writeMode === "skip") {
        return;
      } else if (state.writeMode === "remove") {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, JSON.stringify(state.visibleIds));
      }
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
          return { ...currentState, visibleIds: current.filter((c) => c !== id), writeMode: "persist" };
        }
        // Preserve the original column order defined by `allColumnIds`.
        const next = new Set(current);
        next.add(id);
        return {
          ...currentState,
          visibleIds: allColumnIds.filter((c) => next.has(c)),
          writeMode: "persist",
        };
      });
    },
    [allColumnIds, allowEmpty]
  );

  const reset = useCallback(
    () =>
      setState({
        storageKey,
        visibleIds: readResetVisibleIds(),
        writeMode: removeStorageOnReset ? "remove" : "persist",
      }),
    [readResetVisibleIds, removeStorageOnReset, storageKey]
  );

  const reorder = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setState((currentState) => {
      const current = currentState.visibleIds;
      const sourceIndex = current.indexOf(sourceId);
      const targetIndex = current.indexOf(targetId);
      if (sourceIndex < 0 || targetIndex < 0) return currentState;

      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return { ...currentState, visibleIds: next, writeMode: "persist" };
    });
  }, []);

  return { visibleIds, isVisible, toggle, reset, reorder };
}
