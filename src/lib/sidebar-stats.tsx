import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { getSidebarStats } from "./stats-api";
import type { SidebarStatsResponse } from "./types";
import { useAuth } from "./auth";
import { canViewArea } from "./permissions";

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
  const { user, permissions } = useAuth();
  const enabled = canViewArea(user, permissions, "dashboard");
  const query = useQuery({
    queryKey: ["sidebar", "stats"],
    queryFn: () => getSidebarStats(),
    enabled,
  });
  const { refetch } = query;
  const refresh = useCallback(() => {
    void refetch();
  }, [refetch]);
  const stats = enabled ? query.data ?? ZERO_STATS : ZERO_STATS;
  const loading = enabled ? query.isLoading : false;
  const error = enabled ? query.isError : false;

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
