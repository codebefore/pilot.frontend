import { httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type {
  CertificateProgramFeeBulkApplyRequest,
  CertificateProgramFeeMatrixResponse,
  CertificateProgramFeeMatrixUpsertRequest,
} from "./types";

export interface GetCertificateProgramFeeMatrixOptions {
  targetLicenseClass?: string;
}

export function getCertificateProgramFeeMatrix(
  year: number,
  options?: GetCertificateProgramFeeMatrixOptions,
  signal?: AbortSignal
): Promise<CertificateProgramFeeMatrixResponse> {
  const params: QueryParams = {
    targetLicenseClass: options?.targetLicenseClass,
  };

  return httpGet<CertificateProgramFeeMatrixResponse>(
    `/api/certificate-program-fee-matrix/${year}`,
    params,
    { signal }
  );
}

export function updateCertificateProgramFeeMatrix(
  year: number,
  body: CertificateProgramFeeMatrixUpsertRequest
): Promise<CertificateProgramFeeMatrixResponse> {
  return httpPut<CertificateProgramFeeMatrixResponse>(
    `/api/certificate-program-fee-matrix/${year}`,
    body
  );
}

export function bulkApplyCertificateProgramFeeMatrix(
  year: number,
  body: CertificateProgramFeeBulkApplyRequest
): Promise<CertificateProgramFeeMatrixResponse> {
  return httpPost<CertificateProgramFeeMatrixResponse>(
    `/api/certificate-program-fee-matrix/${year}/bulk-apply`,
    body
  );
}
