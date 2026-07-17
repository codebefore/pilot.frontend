import { getPlatformApiBaseUrl } from "./api";
import { getStoredAccessToken, notifyUnauthorized } from "./auth-storage";
import { httpDelete, httpGet, httpPost, httpPostForm, httpPut, normalizeApiPathForBaseUrl } from "./http";

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
  districtNationalEducationDirector: string | null;
  districtNationalEducationBranchManager: string | null;
  city: string | null;
  district: string | null;
  buildingCapacity: number | null;
  bankName: string | null;
  iban: string | null;
  receiptPrintProfile: string;
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
  districtNationalEducationDirector: string | null;
  districtNationalEducationBranchManager: string | null;
  city: string | null;
  district: string | null;
  buildingCapacity: number | null;
  bankName: string | null;
  iban: string | null;
  receiptPrintProfile: string;
  founder: InstitutionFounderUpsertRequest;
  authorizedPersons: InstitutionAuthorizedPersonUpsertRequest[];
  rowVersion: number | null;
}

export interface InstitutionIntegrationsResponse {
  hasOcrApiKey: boolean;
  ocrApiKey: string | null;
  hasWhatsAppAccessToken: boolean;
  whatsAppAccessToken: string | null;
  smsProvider: string | null;
  smsEnabled: boolean;
  smsSenderTitle: string | null;
  hasSmsApiToken: boolean;
  updatedAtUtc: string | null;
  rowVersion: number | null;
}

export interface InstitutionIntegrationsUpsertRequest {
  ocrApiKey: string | null;
  clearOcrApiKey: boolean;
  whatsAppAccessToken: string | null;
  clearWhatsAppAccessToken: boolean;
  smsProvider: string | null;
  smsEnabled: boolean | null;
  smsSenderTitle: string | null;
  smsApiToken: string | null;
  clearSmsApiToken: boolean;
  rowVersion: number | null;
}

export interface SmsTemplateVariableResponse {
  key: string;
  label: string;
  exampleValue: string;
}

export interface SmsTriggerCatalogItemResponse {
  triggerType: string;
  title: string;
  description: string;
  variables: SmsTemplateVariableResponse[];
}

export interface SmsTemplateResponse {
  id: string;
  triggerType: string;
  name: string;
  body: string;
  enabled: boolean;
  version: number;
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

export interface SmsTemplateUpsertRequest {
  triggerType: string;
  name: string;
  body: string;
  enabled: boolean;
  rowVersion: number | null;
}

export interface SmsAutomationRuleResponse {
  id: string;
  triggerType: string;
  templateId: string;
  recipientType: string;
  timingType: string;
  offsetMinutes: number | null;
  enabled: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
  rowVersion: number;
}

export interface SmsAutomationRuleUpsertRequest {
  templateId: string;
  timingType: "immediate";
  offsetMinutes: null;
  enabled: boolean;
  rowVersion: number | null;
}

export interface SmsTemplatePreviewResponse {
  renderedBody: string;
  characterCount: number;
  estimatedSegmentCount: number;
}

export interface SmsTestSendResponse {
  messageId: string;
  status: string;
  phoneMasked: string;
  providerMessageId: string | null;
  sentAtUtc: string;
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

export function getSmsTriggerCatalog(signal?: AbortSignal): Promise<SmsTriggerCatalogItemResponse[]> {
  return httpGet<SmsTriggerCatalogItemResponse[]>(
    "/api/institution-settings/sms/catalog",
    undefined,
    { baseUrl: getPlatformApiBaseUrl(), signal }
  );
}

export function getSmsTemplates(signal?: AbortSignal): Promise<SmsTemplateResponse[]> {
  return httpGet<SmsTemplateResponse[]>(
    "/api/institution-settings/sms/templates",
    undefined,
    { baseUrl: getPlatformApiBaseUrl(), signal }
  );
}

export function createSmsTemplate(body: SmsTemplateUpsertRequest): Promise<SmsTemplateResponse> {
  return httpPost<SmsTemplateResponse>("/api/institution-settings/sms/templates", body, {
    baseUrl: getPlatformApiBaseUrl(),
  });
}

export function updateSmsTemplate(
  templateId: string,
  body: SmsTemplateUpsertRequest
): Promise<SmsTemplateResponse> {
  return httpPut<SmsTemplateResponse>(
    `/api/institution-settings/sms/templates/${templateId}`,
    body,
    { baseUrl: getPlatformApiBaseUrl() }
  );
}

export function deleteSmsTemplate(templateId: string, rowVersion: number): Promise<boolean> {
  return httpDelete<boolean>(
    `/api/institution-settings/sms/templates/${templateId}`,
    { rowVersion },
    { baseUrl: getPlatformApiBaseUrl() }
  );
}

export function getSmsAutomationRules(signal?: AbortSignal): Promise<SmsAutomationRuleResponse[]> {
  return httpGet<SmsAutomationRuleResponse[]>(
    "/api/institution-settings/sms/automation-rules",
    undefined,
    { baseUrl: getPlatformApiBaseUrl(), signal }
  );
}

export function upsertSmsAutomationRule(
  triggerType: string,
  body: SmsAutomationRuleUpsertRequest
): Promise<SmsAutomationRuleResponse> {
  return httpPut<SmsAutomationRuleResponse>(
    `/api/institution-settings/sms/automation-rules/${encodeURIComponent(triggerType)}`,
    body,
    { baseUrl: getPlatformApiBaseUrl() }
  );
}

export function previewSmsTemplate(
  triggerType: string,
  body: string
): Promise<SmsTemplatePreviewResponse> {
  return httpPost<SmsTemplatePreviewResponse>(
    "/api/institution-settings/sms/templates/preview",
    { triggerType, body },
    { baseUrl: getPlatformApiBaseUrl() }
  );
}

export function sendTestSms(phone: string, requestId: string): Promise<SmsTestSendResponse> {
  return httpPost<SmsTestSendResponse>(
    "/api/institution-settings/sms/test",
    { phone, requestId },
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
