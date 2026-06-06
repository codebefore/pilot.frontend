import { getApiBaseUrl, getAuthApiBaseUrl } from "./api";
import {
  getStoredAccessToken,
  getStoredActiveInstitutionId,
  getStoredRefreshToken,
  notifyInstitutionRequired,
  notifySessionRefreshed,
  notifyUnauthorized,
  readStoredAuthSession,
  writeStoredAuthSession,
  type AuthInstitution,
  type AuthSession,
} from "./auth-storage";

let refreshSessionPromise: Promise<boolean> | null = null;

export const FORBIDDEN_ERROR_MESSAGE = "Yetkiniz yok.";
export const ACTIVE_INSTITUTION_REQUIRED_MESSAGE = "Aktif kurum seçmeniz gerekiyor.";
const ACTIVE_INSTITUTION_REQUIRED_TITLE = "Active institution is required.";

/**
 * Structured validation error delivered through
 * `ValidationProblemDetails.Extensions["errorCodes"]` by endpoints that opt
 * into i18n-friendly error reporting. `code` is the
 * translation key; `params` carries interpolation values (e.g. the list of
 * allowed catalog values).
 */
export type ApiValidationError = {
  code: string;
  params?: Record<string, string>;
};

export class ApiError extends Error {
  status: number;
  statusText: string;
  problemTitle?: string;
  errorCode?: string;
  validationErrors?: Record<string, string[]>;
  validationErrorCodes?: Record<string, ApiValidationError[]>;

  constructor(
    status: number,
    statusText: string,
    validationErrors?: Record<string, string[]>,
    validationErrorCodes?: Record<string, ApiValidationError[]>,
    errorCode?: string,
    problemTitle?: string
  ) {
    super(getApiErrorMessage(status, statusText, problemTitle));
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.problemTitle = problemTitle;
    this.validationErrors = validationErrors;
    this.validationErrorCodes = validationErrorCodes;
    this.errorCode = errorCode;
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function getApiErrorMessage(
  status: number,
  statusText: string,
  problemTitle?: string
): string {
  if (status === 403) {
    return problemTitle === ACTIVE_INSTITUTION_REQUIRED_TITLE
      ? ACTIVE_INSTITUTION_REQUIRED_MESSAGE
      : FORBIDDEN_ERROR_MESSAGE;
  }

  return problemTitle ?? `API error ${status}: ${statusText}`;
}

type QueryParamPrimitive = string | number | boolean | undefined | null;
type QueryParamValue = QueryParamPrimitive | readonly QueryParamPrimitive[];
export type QueryParams = Record<string, QueryParamValue>;

type RequestOptions = {
  baseUrl?: string;
  includeInstitutionHeader?: boolean;
  signal?: AbortSignal;
};

function buildUrl(path: string, params?: QueryParams, baseUrl?: string): string {
  const base = (baseUrl ?? getApiBaseUrl()).replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const dedupedPath = normalizeApiPathForBaseUrl(base, normalizedPath);
  const rawUrl = `${base}${dedupedPath}`;
  const url = new URL(rawUrl, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        // Arrays become repeated query params: ?key=a&key=b (handled natively
        // by ASP.NET model binding into List<string>/string[] parameters).
        for (const item of value) {
          if (item === undefined || item === null || item === "") continue;
          url.searchParams.append(key, String(item));
        }
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export function normalizeApiPathForBaseUrl(base: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (base.endsWith("/api") && normalizedPath.startsWith("/api/")) {
    return normalizedPath.slice("/api".length);
  }

  const basePath = new URL(base, window.location.origin).pathname.replace(/\/+$/, "");
  if (!/^\/v1\/[^/]+$/.test(basePath) || !normalizedPath.startsWith("/api/")) {
    return normalizedPath;
  }

  const serviceSegment = basePath.split("/")[2];
  const serviceApiPrefix = `/api/${serviceSegment}`;
  if (normalizedPath === serviceApiPrefix) {
    return "";
  }
  if (normalizedPath.startsWith(`${serviceApiPrefix}/`)) {
    return normalizedPath.slice(serviceApiPrefix.length);
  }

  return normalizedPath.slice("/api".length);
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  if (!response.ok) {
    let validationErrors: Record<string, string[]> | undefined;
    let validationErrorCodes: Record<string, ApiValidationError[]> | undefined;
    let errorCode: string | undefined;
    let problemTitle: string | undefined;
    try {
      const body = await response.json();
      if (body?.errors) validationErrors = body.errors;
      if (body?.errorCodes) validationErrorCodes = body.errorCodes;
      if (typeof body?.errorCode === "string") errorCode = body.errorCode;
      if (typeof body?.title === "string") problemTitle = body.title;
    } catch {
      // ignore parse errors
    }
    if (response.status === 403 && problemTitle === ACTIVE_INSTITUTION_REQUIRED_TITLE) {
      notifyInstitutionRequired();
    }
    throw new ApiError(
      response.status,
      response.statusText,
      validationErrors,
      validationErrorCodes,
      errorCode,
      problemTitle
    );
  }

  return response.json() as Promise<T>;
}

export async function httpGet<T>(
  path: string,
  params?: QueryParams,
  options?: RequestOptions
): Promise<T> {
  const response = await fetchWithAuthRetry(buildUrl(path, params, options?.baseUrl), {
    headers: buildHeaders(undefined, options),
    signal: options?.signal,
  });
  return handleResponse<T>(response);
}

export async function httpPost<T>(
  path: string,
  body: unknown,
  options?: RequestOptions
): Promise<T> {
  const response = await fetchWithAuthRetry(buildUrl(path, undefined, options?.baseUrl), {
    method: "POST",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
    signal: options?.signal,
  });
  return handleResponse<T>(response);
}

/**
 * POST a multipart/form-data request. The browser sets the Content-Type header
 * (including the multipart boundary) automatically from the FormData body, so
 * it must not be set manually.
 */
export async function httpPostForm<T>(
  path: string,
  form: FormData,
  options?: RequestOptions
): Promise<T> {
  const response = await fetchWithAuthRetry(buildUrl(path, undefined, options?.baseUrl), {
    method: "POST",
    headers: buildHeaders(),
    body: form,
    signal: options?.signal,
  });
  return handleResponse<T>(response);
}

export async function httpPut<T>(
  path: string,
  body: unknown,
  options?: RequestOptions
): Promise<T> {
  const response = await fetchWithAuthRetry(buildUrl(path, undefined, options?.baseUrl), {
    method: "PUT",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
    signal: options?.signal,
  });
  return handleResponse<T>(response);
}

export async function httpPatch<T>(
  path: string,
  body: unknown,
  options?: RequestOptions
): Promise<T> {
  const response = await fetchWithAuthRetry(buildUrl(path, undefined, options?.baseUrl), {
    method: "PATCH",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
    signal: options?.signal,
  });
  return handleResponse<T>(response);
}

export async function httpDelete<T = void>(
  path: string,
  params?: QueryParams,
  options?: RequestOptions
): Promise<T> {
  const response = await fetchWithAuthRetry(buildUrl(path, params, options?.baseUrl), {
    method: "DELETE",
    headers: buildHeaders(),
    signal: options?.signal,
  });
  return handleResponse<T>(response);
}

function buildHeaders(base?: HeadersInit, options?: RequestOptions): HeadersInit {
  const headers = new Headers(base);
  const token = getStoredAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const activeInstitutionId = getStoredActiveInstitutionId();
  if (activeInstitutionId && options?.includeInstitutionHeader !== false) {
    headers.set("X-Institution-Id", activeInstitutionId);
  }
  return headers;
}

async function fetchWithAuthRetry(url: string, init: RequestInit): Promise<Response> {
  const response = await fetch(url, init);
  if (response.status !== 401 || isAuthRefreshRequest(url)) {
    return response;
  }

  const refreshed = await refreshStoredSession();
  if (!refreshed) {
    return response;
  }

  return fetch(url, {
    ...init,
    headers: replaceAuthorizationHeader(init.headers),
  });
}

function isAuthRefreshRequest(url: string): boolean {
  return new URL(url, window.location.origin).pathname.endsWith("/api/auth/refresh");
}

function replaceAuthorizationHeader(headersInit?: HeadersInit): Headers {
  const headers = new Headers(headersInit);
  headers.delete("Authorization");
  const token = getStoredAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

type RefreshLoginResponse = {
  accessToken: string;
  expiresAtUtc: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
  user: {
    id: string;
    fullName: string;
    phone: string | null;
    roleName: string | null;
    isSuperAdmin: boolean;
  };
  institutions: AuthInstitution[];
  activeInstitution: AuthInstitution | null;
};

async function refreshStoredSession(): Promise<boolean> {
  if (refreshSessionPromise) {
    return refreshSessionPromise;
  }

  refreshSessionPromise = refreshStoredSessionOnce().finally(() => {
    refreshSessionPromise = null;
  });
  return refreshSessionPromise;
}

async function refreshStoredSessionOnce(): Promise<boolean> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    notifyUnauthorized();
    return false;
  }

  const response = await fetch(buildUrl("/api/auth/refresh", undefined, getAuthApiBaseUrl()), {
    method: "POST",
    headers: new Headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    notifyUnauthorized();
    return false;
  }

  const refreshed = await response.json() as RefreshLoginResponse;
  const session = mapRefreshResponse(refreshed);
  writeStoredAuthSession(session);
  notifySessionRefreshed(session);
  return true;
}

function mapRefreshResponse(response: RefreshLoginResponse): AuthSession {
  const previous = readStoredAuthSession();
  return {
    accessToken: response.accessToken,
    expiresAtUtc: response.expiresAtUtc,
    refreshToken: response.refreshToken,
    refreshTokenExpiresAtUtc: response.refreshTokenExpiresAtUtc,
    user: {
      id: response.user.id,
      phone: response.user.phone,
      name: response.user.fullName,
      roleName: response.activeInstitution?.roleName ?? response.user.roleName,
      isSuperAdmin: response.user.isSuperAdmin,
    },
    institutions: response.institutions,
    activeInstitution: response.activeInstitution ?? previous?.activeInstitution ?? null,
  };
}
