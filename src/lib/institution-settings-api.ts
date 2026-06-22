import { getPlatformApiBaseUrl } from "./api";
import { getStoredAccessToken, notifyUnauthorized } from "./auth-storage";
import { httpDelete, httpGet, httpPostForm, httpPut, normalizeApiPathForBaseUrl } from "./http";

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

export interface InstitutionAuthorizedPersonResponse {
  id: string;
  fullName: string;
  phone: string | null;
  title: string | null;
  sortOrder: number;
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
  buildingCapacity: number | null;
  bankName: string | null;
  iban: string | null;
  logo: InstitutionLogoResponse | null;
  founder: InstitutionFounderResponse;
  authorizedPersons: InstitutionAuthorizedPersonResponse[];
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

interface InstitutionAuthorizedPersonUpsertRequest {
  id: string | null;
  fullName: string | null;
  phone: string | null;
  title: string | null;
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
  buildingCapacity: number | null;
  bankName: string | null;
  iban: string | null;
  founder: InstitutionFounderUpsertRequest;
  authorizedPersons: InstitutionAuthorizedPersonUpsertRequest[];
  rowVersion: number | null;
}

export interface InstitutionIntegrationsResponse {
  hasOcrApiKey: boolean;
  ocrApiKey: string | null;
  hasWhatsAppAccessToken: boolean;
  whatsAppAccessToken: string | null;
  updatedAtUtc: string | null;
  rowVersion: number | null;
}

export interface InstitutionIntegrationsUpsertRequest {
  ocrApiKey: string | null;
  clearOcrApiKey: boolean;
  whatsAppAccessToken: string | null;
  clearWhatsAppAccessToken: boolean;
  rowVersion: number | null;
}

export async function getInstitutionSettings(
  signal?: AbortSignal
): Promise<InstitutionSettingsResponse | null> {
  try {
    return await httpGet<InstitutionSettingsResponse>(
      "/api/institution-settings",
      undefined,
      { baseUrl: getPlatformApiBaseUrl(), signal }
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
  return httpPut<InstitutionSettingsResponse>("/api/institution-settings", body, {
    baseUrl: getPlatformApiBaseUrl(),
  });
}

export function getInstitutionIntegrations(
  signal?: AbortSignal
): Promise<InstitutionIntegrationsResponse> {
  return httpGet<InstitutionIntegrationsResponse>(
    "/api/institution-settings/integrations",
    undefined,
    { baseUrl: getPlatformApiBaseUrl(), signal }
  );
}

export function upsertInstitutionIntegrations(
  body: InstitutionIntegrationsUpsertRequest
): Promise<InstitutionIntegrationsResponse> {
  return httpPut<InstitutionIntegrationsResponse>(
    "/api/institution-settings/integrations",
    body,
    { baseUrl: getPlatformApiBaseUrl() }
  );
}

export interface WhatsAppStatusResponse {
  enabled: boolean;
  hasPhoneNumberId: boolean;
  hasAccessToken: boolean;
  templateName: string;
  templateLanguage: string;
}

export function getWhatsAppStatus(
  signal?: AbortSignal
): Promise<WhatsAppStatusResponse> {
  return httpGet<WhatsAppStatusResponse>(
    "/api/institution-settings/integrations/whatsapp",
    undefined,
    { baseUrl: getPlatformApiBaseUrl(), signal }
  );
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
    form,
    { baseUrl: getPlatformApiBaseUrl() }
  );
}

export function deleteInstitutionLogo(
  rowVersion: number | null
): Promise<InstitutionSettingsResponse> {
  return httpDelete<InstitutionSettingsResponse>(
    "/api/institution-settings/logo",
    { rowVersion: rowVersion ?? undefined },
    { baseUrl: getPlatformApiBaseUrl() }
  );
}

function getInstitutionLogoUrl(
  logo: InstitutionLogoResponse,
  cacheKey?: string
): string {
  const base = getPlatformApiBaseUrl().replace(/\/+$/, "");
  const path = logo.url.startsWith("/") ? logo.url : `/${logo.url}`;
  const url = new URL(`${base}${normalizeApiPathForBaseUrl(base, path)}`, window.location.origin);
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
