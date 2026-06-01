import { getTrainingApiBaseUrl } from "./api";
import { httpDelete, httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type {
  GroupCreateRequest,
  GroupDetailResponse,
  GroupResponse,
  GroupUpdateRequest,
  PagedResponse,
} from "./types";

const trainingRequestOptions = (signal?: AbortSignal) => ({
  baseUrl: getTrainingApiBaseUrl(),
  signal,
});

export interface GetGroupsParams extends QueryParams {
  search?: string;
  mebStatus?: string;
  termId?: string;
  page?: number;
  pageSize?: number;
}

export function getGroups(
  params?: GetGroupsParams,
  signal?: AbortSignal
): Promise<PagedResponse<GroupResponse>> {
  return httpGet<PagedResponse<GroupResponse>>(
    "/api/groups",
    params,
    trainingRequestOptions(signal)
  );
}

export function getGroupById(id: string, signal?: AbortSignal): Promise<GroupDetailResponse> {
  return httpGet<GroupDetailResponse>(
    `/api/groups/${id}`,
    undefined,
    trainingRequestOptions(signal)
  );
}

export function createGroup(body: GroupCreateRequest): Promise<GroupResponse> {
  return httpPost<GroupResponse>("/api/groups", body, trainingRequestOptions());
}

export function updateGroup(id: string, body: GroupUpdateRequest): Promise<GroupResponse> {
  return httpPut<GroupResponse>(`/api/groups/${id}`, body, trainingRequestOptions());
}

export function deleteGroup(id: string): Promise<void> {
  return httpDelete(`/api/groups/${id}`, undefined, trainingRequestOptions());
}
