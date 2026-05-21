import { httpGet, type QueryParams } from "./http";
import type {
  CertificateProgramListResponse,
} from "./types";

type CertificateProgramActivityFilter = "active" | "inactive" | "all";
type CertificateProgramSortField = "code" | "source" | "target" | "displayOrder";
type CertificateProgramSortDirection = "asc" | "desc";

interface GetCertificateProgramsOptions {
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
