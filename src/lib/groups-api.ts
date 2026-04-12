import { httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type { GroupDetailResponse, GroupResponse, GroupUpsertRequest, PagedResponse } from "./types";

interface GetGroupsParams extends QueryParams {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export function getGroups(
  params?: GetGroupsParams,
  signal?: AbortSignal
): Promise<PagedResponse<GroupResponse>> {
  return httpGet<PagedResponse<GroupResponse>>("/api/groups", params, { signal });
}

export function getGroupById(id: string, signal?: AbortSignal): Promise<GroupDetailResponse> {
  return httpGet<GroupDetailResponse>(`/api/groups/${id}`, undefined, { signal });
}

export function createGroup(body: GroupUpsertRequest): Promise<GroupResponse> {
  return httpPost<GroupResponse>("/api/groups", body);
}

export function updateGroup(id: string, body: GroupUpsertRequest): Promise<GroupResponse> {
  return httpPut<GroupResponse>(`/api/groups/${id}`, body);
}
