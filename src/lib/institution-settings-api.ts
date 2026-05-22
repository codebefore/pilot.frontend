import { getApiBaseUrl } from "./api";
import { getStoredAccessToken, notifyUnauthorized } from "./auth-storage";
import { httpDelete, httpGet, httpPostForm, httpPut } from "./http";

export type FounderType = "real" | "legal";

interface InstitutionLogoResponse {
  url: string;
  originalFileName: string | null;
  contentType: string | null;
  fileSizeBytes: number | null;
}

interface InstitutionFounderResponse {
  type: FounderType | null;
  name: string | null;
  taxId: string | null;
  taxOffice: string | null;
  address: string | null;
  phone: string | null;
}

export interface InstitutionSettingsResponse {
  id: string;
  institutionName: string | null;
  institutionOfficialName: string | null;
  institutionCode: string | null;
  institutionAddress: string | null;
  institutionPhone: string | null;
  institutionEmail: string | null;
  city: string | null;
  district: string | null;
  logo: InstitutionLogoResponse | null;
  founder: InstitutionFounderResponse;
  mebbisInstitutionCode: string | null;
  mebbisUsername: string | null;
  hasMebbisPassword: boolean;
  mebbisIsActive: boolean;
  mebbisLastLoginAtUtc: string | null;
  mebbisLastLoginStatus: string | null;
  mebbisLastLoginError: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

interface InstitutionFounderUpsertRequest {
  type: FounderType | null;
  name: string | null;
  taxId: string | null;
  taxOffice: string | null;
  address: string | null;
  phone: string | null;
}

interface InstitutionMebbisUpsertRequest {
  institutionCode: string | null;
  username: string | null;
  password: string | null;
  isActive: boolean;
}

export interface InstitutionSettingsUpsertRequest {
  institutionName: string | null;
  institutionOfficialName: string | null;
  institutionCode: string | null;
  institutionAddress: string | null;
  institutionPhone: string | null;
  institutionEmail: string | null;
  city: string | null;
  district: string | null;
  founder: InstitutionFounderUpsertRequest;
  authorizedPersons: [];
  mebbis: InstitutionMebbisUpsertRequest | null;
  rowVersion: number | null;
}

export async function getInstitutionSettings(
  signal?: AbortSignal
): Promise<InstitutionSettingsResponse | null> {
  try {
    return await httpGet<InstitutionSettingsResponse>(
      "/api/institution-settings",
      undefined,
      { signal }
    );
  } catch (error) {
    if ((error as { status?: number }).status === 404) {
      return null;
    }
    throw error;
  }
}

export function upsertInstitutionSettings(
  body: InstitutionSettingsUpsertRequest
): Promise<InstitutionSettingsResponse> {
  return httpPut<InstitutionSettingsResponse>("/api/institution-settings", body);
}

export function uploadInstitutionLogo(
  file: File,
  rowVersion: number | null
): Promise<InstitutionSettingsResponse> {
  const form = new FormData();
  form.append("file", file);
  if (rowVersion !== null) {
    form.append("rowVersion", String(rowVersion));
  }
  return httpPostForm<InstitutionSettingsResponse>(
    "/api/institution-settings/logo",
    form
  );
}

export function deleteInstitutionLogo(
  rowVersion: number | null
): Promise<InstitutionSettingsResponse> {
  return httpDelete<InstitutionSettingsResponse>(
    "/api/institution-settings/logo",
    { rowVersion: rowVersion ?? undefined }
  );
}

function getInstitutionLogoUrl(
  logo: InstitutionLogoResponse,
  cacheKey?: string
): string {
  const base = getApiBaseUrl().replace(/\/+$/, "");
  const path = logo.url.startsWith("/") ? logo.url : `/${logo.url}`;
  const dedupedPath =
    base.endsWith("/api") && path.startsWith("/api/")
      ? path.slice("/api".length)
      : path;
  const url = new URL(`${base}${dedupedPath}`, window.location.origin);
  if (cacheKey) {
    url.searchParams.set("v", cacheKey);
  }
  return url.toString();
}

export async function getInstitutionLogoObjectUrl(
  logo: InstitutionLogoResponse,
  cacheKey?: string,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch(getInstitutionLogoUrl(logo, cacheKey), {
    headers: buildLogoHeaders(),
    signal,
  });

  if (response.status === 401) {
    notifyUnauthorized();
  }

  if (!response.ok) {
    throw new Error(`Logo request failed with status ${response.status}`);
  }

  return URL.createObjectURL(await response.blob());
}

function buildLogoHeaders(): HeadersInit {
  const headers = new Headers();
  const token = getStoredAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}
