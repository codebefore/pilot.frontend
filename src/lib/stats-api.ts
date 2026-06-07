import { getPlatformApiBaseUrl } from "./api";
import { httpGet } from "./http";
import type { DashboardOverviewResponse } from "./types";

export function getDashboardOverview(signal?: AbortSignal): Promise<DashboardOverviewResponse> {
  return httpGet<DashboardOverviewResponse>("/api/stats/dashboard", undefined, {
    baseUrl: getPlatformApiBaseUrl(),
    signal,
  });
}
