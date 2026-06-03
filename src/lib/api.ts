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
      publicUrl?: string;
      trainingApiBaseUrl?: string;
    };
  }
}

const DEFAULT_API_BASE_URL = "http://127.0.0.1:5080";

export function applyRuntimeConfig(config: Window["__APP_CONFIG__"]): void {
  window.__APP_CONFIG__ = config;
}

export function getApiBaseUrl(): string {
  return (
    window.__APP_CONFIG__?.apiBaseUrl ??
    import.meta.env.VITE_API_BASE_URL ??
    DEFAULT_API_BASE_URL
  );
}

export function getMebbisApiBaseUrl(): string {
  return (
    window.__APP_CONFIG__?.mebbisApiBaseUrl ??
    import.meta.env.VITE_MEBBIS_API_BASE_URL ??
    getApiBaseUrl()
  );
}

export function getAuthApiBaseUrl(): string {
  return (
    window.__APP_CONFIG__?.authApiBaseUrl ??
    import.meta.env.VITE_AUTH_API_BASE_URL ??
    getApiBaseUrl()
  );
}

export function getCandidateApiBaseUrl(): string {
  return (
    window.__APP_CONFIG__?.candidateApiBaseUrl ??
    import.meta.env.VITE_CANDIDATE_API_BASE_URL ??
    getApiBaseUrl()
  );
}

export function getCatalogApiBaseUrl(): string {
  return (
    window.__APP_CONFIG__?.catalogApiBaseUrl ??
    import.meta.env.VITE_CATALOG_API_BASE_URL ??
    getApiBaseUrl()
  );
}

export function getDocumentApiBaseUrl(): string {
  return (
    window.__APP_CONFIG__?.documentApiBaseUrl ??
    import.meta.env.VITE_DOCUMENT_API_BASE_URL ??
    getApiBaseUrl()
  );
}

export function getFinanceApiBaseUrl(): string {
  return (
    window.__APP_CONFIG__?.financeApiBaseUrl ??
    import.meta.env.VITE_FINANCE_API_BASE_URL ??
    getApiBaseUrl()
  );
}

export function getTrainingApiBaseUrl(): string {
  return (
    window.__APP_CONFIG__?.trainingApiBaseUrl ??
    import.meta.env.VITE_TRAINING_API_BASE_URL ??
    getApiBaseUrl()
  );
}
