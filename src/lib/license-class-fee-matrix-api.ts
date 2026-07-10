import { getFinanceApiBaseUrl } from "./api";
import { httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type {
  LicenseClassFeeBulkApplyRequest,
  LicenseClassFeeMatrixResponse,
  LicenseClassFeeMatrixUpsertRequest,
} from "./types";

const financeRequestOptions = (signal?: AbortSignal) => ({
  baseUrl: getFinanceApiBaseUrl(),
  signal,
});

interface GetLicenseClassFeeMatrixOptions {
  targetLicenseClass?: string;
  licenseClassDefinitionId?: string;
}

export function getLicenseClassFeeMatrix(
  year: number,
  options?: GetLicenseClassFeeMatrixOptions,
  signal?: AbortSignal
): Promise<LicenseClassFeeMatrixResponse> {
  const params: QueryParams = {
    targetLicenseClass: options?.targetLicenseClass,
    licenseClassDefinitionId: options?.licenseClassDefinitionId,
  };

  return httpGet<LicenseClassFeeMatrixResponse>(
    `/api/finance/license-class-fee-matrix/${year}`,
    params,
    financeRequestOptions(signal)
  );
}

export function updateLicenseClassFeeMatrix(
  year: number,
  body: LicenseClassFeeMatrixUpsertRequest
): Promise<LicenseClassFeeMatrixResponse> {
  return httpPut<LicenseClassFeeMatrixResponse>(
    `/api/finance/license-class-fee-matrix/${year}`,
    body,
    financeRequestOptions()
  );
}

export function bulkApplyLicenseClassFeeMatrix(
  year: number,
  body: LicenseClassFeeBulkApplyRequest
): Promise<LicenseClassFeeMatrixResponse> {
  return httpPost<LicenseClassFeeMatrixResponse>(
    `/api/finance/license-class-fee-matrix/${year}/bulk-apply`,
    body,
    financeRequestOptions()
  );
}
