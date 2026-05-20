import { httpGet } from "./http";
import type { DashboardOverviewResponse, SidebarStatsResponse } from "./types";

export function getSidebarStats(signal?: AbortSignal): Promise<SidebarStatsResponse> {
  return httpGet<SidebarStatsResponse>("/api/stats/sidebar", undefined, { signal });
}

export function getDashboardOverview(signal?: AbortSignal): Promise<DashboardOverviewResponse> {
  return httpGet<DashboardOverviewResponse>("/api/stats/dashboard", undefined, { signal });
}
