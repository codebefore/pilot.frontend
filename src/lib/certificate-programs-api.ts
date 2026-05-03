import { httpDelete, httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type {
  CertificateProgramListResponse,
  CertificateProgramResponse,
  CertificateProgramUpsertRequest,
} from "./types";

export type CertificateProgramActivityFilter = "active" | "inactive" | "all";
export type CertificateProgramSortField = "code" | "source" | "target" | "displayOrder";
export type CertificateProgramSortDirection = "asc" | "desc";

export interface GetCertificateProgramsOptions {
  search?: string;
  activity?: CertificateProgramActivityFilter;
  sourceLicenseClass?: string;
  targetLicenseClass?: string;
  page?: number;
  pageSize?: number;
  sortBy?: CertificateProgramSortField;
  sortDir?: CertificateProgramSortDirection;
}

export function getCertificatePrograms(
  options?: GetCertificateProgramsOptions,
  signal?: AbortSignal
): Promise<CertificateProgramListResponse> {
  const params: QueryParams = {
    search: options?.search || undefined,
    activity: options?.activity,
    sourceLicenseClass: options?.sourceLicenseClass,
    targetLicenseClass: options?.targetLicenseClass,
    page: options?.page,
    pageSize: options?.pageSize,
    sortBy: options?.sortBy,
    sortDir: options?.sortDir,
  };

  return httpGet<CertificateProgramListResponse>("/api/certificate-programs", params, {
    signal,
  });
}

export function getCertificateProgram(
  id: string,
  signal?: AbortSignal
): Promise<CertificateProgramResponse> {
  return httpGet<CertificateProgramResponse>(`/api/certificate-programs/${id}`, undefined, {
    signal,
  });
}

export function createCertificateProgram(
  body: CertificateProgramUpsertRequest
): Promise<CertificateProgramResponse> {
  return httpPost<CertificateProgramResponse>("/api/certificate-programs", body);
}

export function updateCertificateProgram(
  id: string,
  body: CertificateProgramUpsertRequest
): Promise<CertificateProgramResponse> {
  return httpPut<CertificateProgramResponse>(`/api/certificate-programs/${id}`, body);
}

export function deleteCertificateProgram(id: string): Promise<void> {
  return httpDelete(`/api/certificate-programs/${id}`);
}
