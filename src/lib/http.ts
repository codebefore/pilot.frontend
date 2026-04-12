import { getApiBaseUrl } from "./api";

export class ApiError extends Error {
  status: number;
  statusText: string;
  validationErrors?: Record<string, string[]>;

  constructor(
    status: number,
    statusText: string,
    validationErrors?: Record<string, string[]>
  ) {
    super(`API error ${status}: ${statusText}`);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.validationErrors = validationErrors;
  }
}

export type QueryParamValue = string | number | boolean | undefined | null;
export type QueryParams = Record<string, QueryParamValue>;

type RequestOptions = {
  signal?: AbortSignal;
};

function buildUrl(path: string, params?: QueryParams): string {
  const base = getApiBaseUrl().replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const dedupedPath =
    base.endsWith("/api") && normalizedPath.startsWith("/api/")
      ? normalizedPath.slice("/api".length)
      : normalizedPath;
  const rawUrl = `${base}${dedupedPath}`;
  const url = new URL(rawUrl, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  if (!response.ok) {
    let validationErrors: Record<string, string[]> | undefined;
    try {
      const body = await response.json();
      if (body?.errors) validationErrors = body.errors;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(response.status, response.statusText, validationErrors);
  }

  return response.json() as Promise<T>;
}

export async function httpGet<T>(
  path: string,
  params?: QueryParams,
  options?: RequestOptions
): Promise<T> {
  const response = await fetch(buildUrl(path, params), {
    signal: options?.signal,
  });
  return handleResponse<T>(response);
}

export async function httpPost<T>(
  path: string,
  body: unknown,
  options?: RequestOptions
): Promise<T> {
  const response = await fetch(buildUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  const response = await fetch(buildUrl(path), {
    method: "POST",
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
  const response = await fetch(buildUrl(path), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: options?.signal,
  });
  return handleResponse<T>(response);
}

export async function httpDelete(path: string, options?: RequestOptions): Promise<void> {
  const response = await fetch(buildUrl(path), {
    method: "DELETE",
    signal: options?.signal,
  });
  return handleResponse<void>(response);
}
