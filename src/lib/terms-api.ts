import { httpDelete, httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type {
  CreateTermRequest,
  PagedResponse,
  TermResponse,
  UpdateTermRequest,
} from "./types";

export interface GetTermsParams extends QueryParams {
  page?: number;
  pageSize?: number;
}

export function getTerms(
  params?: GetTermsParams,
  signal?: AbortSignal
): Promise<PagedResponse<TermResponse>> {
  return httpGet<PagedResponse<TermResponse>>("/api/terms", params, { signal });
}

export function getTermById(id: string, signal?: AbortSignal): Promise<TermResponse> {
  return httpGet<TermResponse>(`/api/terms/${id}`, undefined, { signal });
}

export function createTerm(body: CreateTermRequest): Promise<TermResponse> {
  return httpPost<TermResponse>("/api/terms", body);
}

export function updateTerm(id: string, body: UpdateTermRequest): Promise<TermResponse> {
  return httpPut<TermResponse>(`/api/terms/${id}`, body);
}

export function deleteTerm(id: string): Promise<void> {
  return httpDelete(`/api/terms/${id}`);
}
