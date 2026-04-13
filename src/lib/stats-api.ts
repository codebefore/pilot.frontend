import { httpGet } from "./http";
import type { SidebarStatsResponse } from "./types";

export function getSidebarStats(signal?: AbortSignal): Promise<SidebarStatsResponse> {
  return httpGet<SidebarStatsResponse>("/api/stats/sidebar", undefined, { signal });
}
