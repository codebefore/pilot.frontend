declare global {
  interface Window {
    __APP_CONFIG__?: {
      apiBaseUrl?: string;
      authApiBaseUrl?: string;
      candidateApiBaseUrl?: string;
      catalogApiBaseUrl?: string;
      documentApiBaseUrl?: string;
      financeApiBaseUrl?: string;
      mebbisApiBaseUrl?: string;
      platformApiBaseUrl?: string;
      publicUrl?: string;
      trainingApiBaseUrl?: string;
    };
  }
}

const DEFAULT_API_BASE_URL = "http://127.0.0.1:5080";
const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1"]);

export function applyRuntimeConfig(config: Window["__APP_CONFIG__"]): void {
  window.__APP_CONFIG__ = config;
}

export function getApiBaseUrl(): string {
  return (
    firstNonEmpty(
      window.__APP_CONFIG__?.apiBaseUrl,
      import.meta.env.VITE_API_BASE_URL
    ) ??
    DEFAULT_API_BASE_URL
  );
}

export function getMebbisApiBaseUrl(): string {
  return getServiceApiBaseUrl("mebbisApiBaseUrl", "VITE_MEBBIS_API_BASE_URL", "mebbis");
}

export function getPlatformApiBaseUrl(): string {
  return getServiceApiBaseUrl("platformApiBaseUrl", "VITE_PLATFORM_API_BASE_URL", "platform");
}

export function getAuthApiBaseUrl(): string {
  return getServiceApiBaseUrl("authApiBaseUrl", "VITE_AUTH_API_BASE_URL", "identity");
}

export function getCandidateApiBaseUrl(): string {
  return getServiceApiBaseUrl("candidateApiBaseUrl", "VITE_CANDIDATE_API_BASE_URL", "candidates");
}

export function getCatalogApiBaseUrl(): string {
  return getServiceApiBaseUrl("catalogApiBaseUrl", "VITE_CATALOG_API_BASE_URL", "catalog");
}

export function getDocumentApiBaseUrl(): string {
  return getServiceApiBaseUrl("documentApiBaseUrl", "VITE_DOCUMENT_API_BASE_URL", "document");
}

export function getFinanceApiBaseUrl(): string {
  return getServiceApiBaseUrl("financeApiBaseUrl", "VITE_FINANCE_API_BASE_URL", "finance");
}

export function getTrainingApiBaseUrl(): string {
  return getServiceApiBaseUrl("trainingApiBaseUrl", "VITE_TRAINING_API_BASE_URL", "training");
}

function getServiceApiBaseUrl(
  runtimeKey: keyof NonNullable<Window["__APP_CONFIG__"]>,
  envKey: string,
  serviceSegment: string
): string {
  const apiBaseUrl = getApiBaseUrl();
  const configured = firstNonEmpty(
    window.__APP_CONFIG__?.[runtimeKey],
    (import.meta.env as Record<string, string | undefined>)[envKey]
  );

  if (configured && configured.replace(/\/+$/, "") !== apiBaseUrl.replace(/\/+$/, "")) {
    return configured;
  }

  return deriveGatewayServiceBaseUrl(apiBaseUrl, serviceSegment) ?? configured ?? apiBaseUrl;
}

function deriveGatewayServiceBaseUrl(apiBaseUrl: string, serviceSegment: string): string | null {
  const parsed = new URL(apiBaseUrl, window.location.origin);
  const pathname = parsed.pathname.replace(/\/+$/, "");

  if (/^\/v1\/[^/]+$/.test(pathname)) {
    return parsed.toString().replace(/\/+$/, "");
  }

  if (pathname !== "" && pathname !== "/" && pathname !== "/v1") {
    return null;
  }

  if (isLocalBase(parsed) && apiBaseUrl === DEFAULT_API_BASE_URL) {
    return null;
  }

  parsed.pathname = `${pathname === "/v1" ? "/v1" : ""}/v1/${serviceSegment}`.replace(/^\/v1\/v1\//, "/v1/");
  return parsed.toString().replace(/\/+$/, "");
}

function isLocalBase(url: URL): boolean {
  return LOCAL_HOSTNAMES.has(url.hostname);
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value !== undefined && value.trim() !== "");
}
