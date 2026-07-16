import { getApiBaseUrl, getAuthApiBaseUrl } from "./api";
import {
  AUTH_STORAGE_KEY,
  getStoredAccessToken,
  getStoredActiveInstitutionId,
  getStoredUserId,
  getStoredUserName,
  notifyInstitutionRequired,
  notifyRefreshUnauthorized,
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
const AUTH_REFRESH_LOCK_KEY = `${AUTH_STORAGE_KEY}.refresh-lock`;
const AUTH_REFRESH_LOCK_TTL_MS = 10_000;
const AUTH_REFRESH_LOCK_POLL_MS = 100;
const AUTH_REFRESH_LOCK_WAIT_MS = 8_000;
const ACCESS_TOKEN_RETRY_SKEW_MS = 30_000;

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
  headers?: HeadersInit;
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

export async function httpPostBlob(
  path: string,
  body: unknown,
  options?: RequestOptions
): Promise<Blob> {
  const response = await fetchWithAuthRetry(buildUrl(path, undefined, options?.baseUrl), {
    method: "POST",
    headers: buildHeaders({ "Content-Type": "application/json" }, options),
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  if (!response.ok) {
    await handleResponse<never>(response);
  }

  return response.blob();
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
    headers: buildHeaders(undefined, options),
    body: form,
    signal: options?.signal,
  });
  return handleResponse<T>(response);
}

export async function httpPutForm<T>(
  path: string,
  form: FormData,
  options?: RequestOptions
): Promise<T> {
  const response = await fetchWithAuthRetry(buildUrl(path, undefined, options?.baseUrl), {
    method: "PUT",
    headers: buildHeaders(undefined, options),
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
  new Headers(options?.headers).forEach((value, key) => headers.set(key, value));
  const token = getStoredAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const activeInstitutionId = getStoredActiveInstitutionId();
  if (activeInstitutionId && options?.includeInstitutionHeader !== false) {
    headers.set("X-Institution-Id", activeInstitutionId);
  }
  const userId = getStoredUserId();
  if (userId) {
    headers.set("X-User-Id", userId);
  }
  const userName = getStoredUserName();
  if (userName) {
    headers.set("X-User-Name-Encoded", encodeURIComponent(userName));
    if (isAsciiHeaderValue(userName)) {
      headers.set("X-User-Name", userName);
    }
  }
  return headers;
}

function isAsciiHeaderValue(value: string): boolean {
  return /^[\x20-\x7E]+$/.test(value);
}

async function fetchWithAuthRetry(url: string, init: RequestInit): Promise<Response> {
  const originalAccessToken = getAuthorizationToken(init.headers);
  const response = await fetch(url, init);
  if (response.status !== 401 || isAuthRefreshRequest(url)) {
    return response;
  }

  if (hasUsableStoredAccessToken(originalAccessToken)) {
    return fetch(url, {
      ...init,
      headers: replaceAuthorizationHeader(init.headers),
    });
  }

  const refreshed = await refreshStoredSession(originalAccessToken);
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

function getAuthorizationToken(headersInit?: HeadersInit): string | null {
  const authorization = new Headers(headersInit).get("Authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
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

async function refreshStoredSession(staleAccessToken: string | null): Promise<boolean> {
  if (refreshSessionPromise) {
    return refreshSessionPromise;
  }

  refreshSessionPromise = refreshStoredSessionOnce(staleAccessToken).finally(() => {
    refreshSessionPromise = null;
  });
  return refreshSessionPromise;
}

async function refreshStoredSessionOnce(staleAccessToken: string | null): Promise<boolean> {
  const session = readStoredAuthSession();
  if (!session) {
    notifyUnauthorized();
    return false;
  }

  if (isUsableAccessSession(session, staleAccessToken)) {
    return true;
  }

  const refreshToken = session.refreshToken;
  if (!refreshToken) {
    notifyUnauthorized();
    return false;
  }

  const refreshLock = await acquireRefreshLock();
  if (!refreshLock) {
    return waitForSessionRefresh(refreshToken, staleAccessToken);
  }

  try {
    const latestSession = readStoredAuthSession();
    const tokenToRefresh = latestSession?.refreshToken ?? refreshToken;
    if (latestSession && tokenToRefresh !== refreshToken && isUsableAccessSession(latestSession, staleAccessToken)) {
      notifySessionRefreshed(latestSession);
      return true;
    }

    const response = await fetch(buildUrl("/api/auth/refresh", undefined, getAuthApiBaseUrl()), {
      method: "POST",
      headers: new Headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ refreshToken: tokenToRefresh }),
    });

    if (!response.ok) {
      if (await waitForSessionRefresh(tokenToRefresh, staleAccessToken, AUTH_REFRESH_LOCK_POLL_MS)) {
        return true;
      }

      if (response.status === 401) {
        notifyRefreshUnauthorized();
      }
      notifyUnauthorized();
      return false;
    }

    const refreshed = await response.json() as RefreshLoginResponse;
    const session = mapRefreshResponse(refreshed);
    writeStoredAuthSession(session);
    notifySessionRefreshed(session);
    return true;
  } finally {
    releaseRefreshLock(refreshLock);
  }
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

type RefreshLock = {
  owner: string;
  expiresAt: number;
};

async function acquireRefreshLock(): Promise<RefreshLock | null> {
  const deadline = Date.now() + AUTH_REFRESH_LOCK_WAIT_MS;
  while (Date.now() < deadline) {
    const existing = readRefreshLock();
    if (!existing || existing.expiresAt <= Date.now()) {
      const lock = {
        owner: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
        expiresAt: Date.now() + AUTH_REFRESH_LOCK_TTL_MS,
      };
      writeRefreshLock(lock);
      await delay(20);
      if (readRefreshLock()?.owner === lock.owner) {
        return lock;
      }
    }

    await delay(AUTH_REFRESH_LOCK_POLL_MS);
  }

  return null;
}

function releaseRefreshLock(lock: RefreshLock): void {
  if (readRefreshLock()?.owner === lock.owner) {
    localStorage.removeItem(AUTH_REFRESH_LOCK_KEY);
  }
}

function readRefreshLock(): RefreshLock | null {
  try {
    const raw = localStorage.getItem(AUTH_REFRESH_LOCK_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<RefreshLock>;
    if (typeof value.owner !== "string" || typeof value.expiresAt !== "number") {
      return null;
    }
    return { owner: value.owner, expiresAt: value.expiresAt };
  } catch {
    return null;
  }
}

function writeRefreshLock(lock: RefreshLock): void {
  localStorage.setItem(AUTH_REFRESH_LOCK_KEY, JSON.stringify(lock));
}

async function waitForSessionRefresh(
  previousRefreshToken: string,
  staleAccessToken: string | null,
  timeoutMs = AUTH_REFRESH_LOCK_WAIT_MS
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const session = readStoredAuthSession();
    if (
      session &&
      session.refreshToken !== previousRefreshToken &&
      isUsableAccessSession(session, staleAccessToken)
    ) {
      notifySessionRefreshed(session);
      return true;
    }

    await delay(AUTH_REFRESH_LOCK_POLL_MS);
  }

  return false;
}

function hasUsableStoredAccessToken(staleAccessToken: string | null): boolean {
  const session = readStoredAuthSession();
  return !!session && isUsableAccessSession(session, staleAccessToken);
}

function isUsableAccessSession(session: AuthSession, staleAccessToken: string | null): boolean {
  if (!session.accessToken || session.accessToken === staleAccessToken) {
    return false;
  }

  const expiresAt = getAccessTokenExpiresAt(session.accessToken) ?? new Date(session.expiresAtUtc).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now() + ACCESS_TOKEN_RETRY_SKEW_MS;
}

function getAccessTokenExpiresAt(accessToken: string): number | null {
  try {
    const [, payload] = accessToken.split(".");
    if (!payload) return null;
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - normalizedPayload.length % 4) % 4),
      "="
    );
    const decoded = JSON.parse(atob(paddedPayload)) as { exp?: unknown };
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
