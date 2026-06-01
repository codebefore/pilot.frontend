import { getTrainingApiBaseUrl } from "./api";
import { httpDelete, httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type {
  CreateTermRequest,
  PagedResponse,
  TermResponse,
  UpdateTermRequest,
} from "./types";

const trainingRequestOptions = (signal?: AbortSignal) => ({
  baseUrl: getTrainingApiBaseUrl(),
  signal,
});

export interface GetTermsParams extends QueryParams {
  page?: number;
  pageSize?: number;
}

export function getTerms(
  params?: GetTermsParams,
  signal?: AbortSignal
): Promise<PagedResponse<TermResponse>> {
  return httpGet<PagedResponse<TermResponse>>(
    "/api/terms",
    params,
    trainingRequestOptions(signal)
  );
}

export function createTerm(body: CreateTermRequest): Promise<TermResponse> {
  return httpPost<TermResponse>("/api/terms", body, trainingRequestOptions());
}

export function updateTerm(id: string, body: UpdateTermRequest): Promise<TermResponse> {
  return httpPut<TermResponse>(`/api/terms/${id}`, body, trainingRequestOptions());
}

export function deleteTerm(id: string): Promise<void> {
  return httpDelete(`/api/terms/${id}`, undefined, trainingRequestOptions());
}
