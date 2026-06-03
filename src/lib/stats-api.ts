import { getPlatformApiBaseUrl } from "./api";
import { httpGet } from "./http";
import type { DashboardOverviewResponse, SidebarStatsResponse } from "./types";

export function getSidebarStats(signal?: AbortSignal): Promise<SidebarStatsResponse> {
  return httpGet<SidebarStatsResponse>("/api/stats/sidebar", undefined, {
    baseUrl: getPlatformApiBaseUrl(),
    signal,
  });
}

export function getDashboardOverview(signal?: AbortSignal): Promise<DashboardOverviewResponse> {
  return httpGet<DashboardOverviewResponse>("/api/stats/dashboard", undefined, {
    baseUrl: getPlatformApiBaseUrl(),
    signal,
  });
}
