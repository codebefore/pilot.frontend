import { getPlatformApiBaseUrl } from "./api";
import { httpGet } from "./http";
import type { DashboardActivityListResponse, DashboardOverviewResponse } from "./types";

export function getDashboardOverview(signal?: AbortSignal): Promise<DashboardOverviewResponse> {
  return httpGet<DashboardOverviewResponse>("/api/stats/dashboard", undefined, {
    baseUrl: getPlatformApiBaseUrl(),
    signal,
  });
}

export function getDashboardActivity(
  params: {
    page?: number;
    pageSize?: number;
    search?: string;
    category?: string;
    fromUtc?: string;
    toUtc?: string;
  } = {},
  signal?: AbortSignal
): Promise<DashboardActivityListResponse> {
  return httpGet<DashboardActivityListResponse>("/api/stats/activity", params, {
    baseUrl: getPlatformApiBaseUrl(),
    signal,
  });
}
