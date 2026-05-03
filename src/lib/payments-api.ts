import { httpGet } from "./http";
import type { PaymentsOverviewResponse } from "./types";

export function getPaymentsOverview(signal?: AbortSignal): Promise<PaymentsOverviewResponse> {
  return httpGet<PaymentsOverviewResponse>("/api/payments/overview", undefined, { signal });
}
