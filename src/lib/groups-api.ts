import { getTrainingApiBaseUrl } from "./api";
import { getDocumentChecklistByCandidateIds } from "./documents-api";
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
    "/api/training/groups",
    params,
    trainingRequestOptions(signal)
  ).then((response) => enrichGroupListWithCandidatePhotos(response, signal));
}

export async function getAllGroups(
  params?: Omit<GetGroupsParams, "page" | "pageSize">,
  signal?: AbortSignal
): Promise<GroupResponse[]> {
  const pageSize = 200;
  const firstPage = await getGroups({ ...params, page: 1, pageSize }, signal);
  const items = [...firstPage.items];
  const totalPages =
    firstPage.totalPages ?? Math.ceil(firstPage.totalCount / firstPage.pageSize);

  for (let page = 2; page <= totalPages; page += 1) {
    const result = await getGroups({ ...params, page, pageSize }, signal);
    items.push(...result.items);
  }

  return items;
}

export function getGroupById(id: string, signal?: AbortSignal): Promise<GroupDetailResponse> {
  return httpGet<GroupDetailResponse>(
    `/api/training/groups/${id}`,
    undefined,
    trainingRequestOptions(signal)
  ).then((response) => enrichGroupDetailWithCandidatePhotos(response, signal));
}

async function enrichGroupListWithCandidatePhotos(
  response: PagedResponse<GroupResponse>,
  signal?: AbortSignal
): Promise<PagedResponse<GroupResponse>> {
  const candidateIds = [
    ...new Set(
      (response.items ?? [])
        .flatMap((group) => group.candidatePreview ?? [])
        .map((candidate) => candidate.candidateId)
        .filter(Boolean)
    ),
  ];
  if (candidateIds.length === 0) {
    return response;
  }

  const photoByCandidateId = await getCandidatePhotoMap(candidateIds, signal);
  if (!photoByCandidateId) {
    return response;
  }

  return {
    ...response,
    items: response.items.map((group) => ({
      ...group,
      candidatePreview: group.candidatePreview?.map((candidate) => ({
        ...candidate,
        photo: photoByCandidateId.get(candidate.candidateId) ?? null,
      })),
    })),
  };
}

async function enrichGroupDetailWithCandidatePhotos(
  response: GroupDetailResponse,
  signal?: AbortSignal
): Promise<GroupDetailResponse> {
  const candidateIds = [
    ...new Set([
      ...(response.candidatePreview ?? []).map((candidate) => candidate.candidateId),
      ...(response.activeCandidates ?? []).map((candidate) => candidate.candidateId),
    ]),
  ].filter(Boolean);
  if (candidateIds.length === 0) {
    return response;
  }

  const photoByCandidateId = await getCandidatePhotoMap(candidateIds, signal);
  if (!photoByCandidateId) {
    return response;
  }

  return {
    ...response,
    candidatePreview: response.candidatePreview?.map((candidate) => ({
      ...candidate,
      photo: photoByCandidateId.get(candidate.candidateId) ?? null,
    })),
    activeCandidates: (response.activeCandidates ?? []).map((candidate) => ({
      ...candidate,
      photo: photoByCandidateId.get(candidate.candidateId) ?? null,
    })),
  };
}

async function getCandidatePhotoMap(
  candidateIds: string[],
  signal?: AbortSignal
) {
  const overviewItems = await getDocumentChecklistByCandidateIds(candidateIds, signal).catch(() => null);
  if (!overviewItems) {
    return null;
  }

  return new Map(overviewItems.map((item) => [item.candidateId, item.photo ?? null]));
}

export function createGroup(body: GroupCreateRequest): Promise<GroupResponse> {
  return httpPost<GroupResponse>("/api/training/groups", body, trainingRequestOptions());
}

export function updateGroup(id: string, body: GroupUpdateRequest): Promise<GroupResponse> {
  return httpPut<GroupResponse>(`/api/training/groups/${id}`, body, trainingRequestOptions());
}

export function deleteGroup(id: string): Promise<void> {
  return httpDelete(`/api/training/groups/${id}`, undefined, trainingRequestOptions());
}
