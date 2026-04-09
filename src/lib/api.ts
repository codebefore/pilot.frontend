declare global {
  interface Window {
    __APP_CONFIG__?: {
      apiBaseUrl?: string;
      publicUrl?: string;
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

export function getPublicUrl(): string {
  return (
    window.__APP_CONFIG__?.publicUrl ??
    import.meta.env.VITE_PUBLIC_URL ??
    window.location.origin
  );
}
