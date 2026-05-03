import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { getSidebarStats } from "./stats-api";
import type { SidebarStatsResponse } from "./types";

const ZERO_STATS: SidebarStatsResponse = {
  candidates: { total: 0, active: 0 },
  groups: { total: 0 },
  documents: { missingCount: 0 },
  mebJobs: { failed: 0, manualReview: 0 },
  payments: { dueToday: 0 },
};

type SidebarStatsContextValue = {
  /** Latest fetched stats. Falls back to all-zero values before the first
   *  successful response so consumers can render unconditionally. */
  stats: SidebarStatsResponse;
  loading: boolean;
  error: boolean;
  refresh: () => void;
};

const SidebarStatsContext = createContext<SidebarStatsContextValue | null>(null);

export function SidebarStatsProvider({ children }: { children: ReactNode }) {
  const [stats, setStats] = useState<SidebarStatsResponse>(ZERO_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);

    getSidebarStats(controller.signal)
      .then((data) => setStats(data))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <SidebarStatsContext.Provider value={{ stats, loading, error, refresh }}>
      {children}
    </SidebarStatsContext.Provider>
  );
}

export function useSidebarStats(): SidebarStatsContextValue {
  const ctx = useContext(SidebarStatsContext);
  if (!ctx) {
    // Fallback for tests / contexts that don't mount the provider — keep the
    // shape stable so consumers don't need to null-check.
    return { stats: ZERO_STATS, loading: false, error: false, refresh: () => {} };
  }
  return ctx;
}
