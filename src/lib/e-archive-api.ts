import { getFinanceApiBaseUrl } from "./api";
import { ApiError, httpGet, httpPost, httpPut } from "./http";

export type EInvoiceEnvironment = "test" | "production";

export interface EInvoiceIntegrationResponse {
  providerCode: string;
  environment: EInvoiceEnvironment;
  taxNumber: string;
  senderAlias: string | null;
  credentialConfigured: boolean;
  usesEArchive: boolean;
  isEnabled: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

export interface EInvoiceIntegrationUpsertRequest {
  providerCode: string;
  environment: EInvoiceEnvironment;
  taxNumber: string;
  senderAlias: string | null;
  credentialReference: string | null;
  usesEArchive: boolean;
  isEnabled: boolean;
  rowVersion: number | null;
}

export interface EInvoiceConnectionTestResponse {
  succeeded: boolean;
  providerCode: string;
  environment: EInvoiceEnvironment;
  checkedAtUtc: string;
}

export async function getEInvoiceIntegration(
  signal?: AbortSignal
): Promise<EInvoiceIntegrationResponse | null> {
  try {
    return await httpGet<EInvoiceIntegrationResponse>(
      "/api/finance/e-archive/integration",
      undefined,
      { baseUrl: getFinanceApiBaseUrl(), signal }
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export function upsertEInvoiceIntegration(
  body: EInvoiceIntegrationUpsertRequest
): Promise<EInvoiceIntegrationResponse> {
  return httpPut<EInvoiceIntegrationResponse>(
    "/api/finance/e-archive/integration",
    body,
    { baseUrl: getFinanceApiBaseUrl() }
  );
}

export function testEInvoiceIntegrationConnection(): Promise<EInvoiceConnectionTestResponse> {
  return httpPost<EInvoiceConnectionTestResponse>(
    "/api/finance/e-archive/integration/test-connection",
    {},
    { baseUrl: getFinanceApiBaseUrl() }
  );
}
