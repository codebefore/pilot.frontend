import { httpGet } from "./http";
import type { PaymentsOverviewResponse } from "./types";

type PaymentsOverviewParams = {
  fromDate?: string;
  statsMonth?: string;
  toDate?: string;
};

export function getPaymentsOverview(
  params?: PaymentsOverviewParams,
  signal?: AbortSignal,
): Promise<PaymentsOverviewResponse> {
  return httpGet<PaymentsOverviewResponse>("/api/payments/overview", params, { signal });
}
