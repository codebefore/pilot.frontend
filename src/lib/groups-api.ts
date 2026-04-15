import { httpDelete, httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type {
  GroupDetailResponse,
  GroupResponse,
  GroupUpsertRequest,
  LicenseClass,
  PagedResponse,
} from "./types";

export interface GetGroupsParams extends QueryParams {
  search?: string;
  mebStatus?: string;
  licenseClass?: LicenseClass;
  termId?: string;
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

export function deleteGroup(id: string): Promise<void> {
  return httpDelete(`/api/groups/${id}`);
}
