import { getTrainingApiBaseUrl } from "./api";
import { httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type {
  ClassroomListResponse,
  ClassroomResponse,
  ClassroomUpsertRequest,
} from "./types";

const trainingRequestOptions = (signal?: AbortSignal) => ({
  baseUrl: getTrainingApiBaseUrl(),
  signal,
});

export type ClassroomSortField = "name" | "capacity" | "isActive";
export type ClassroomSortDirection = "asc" | "desc";
export type ClassroomActivityFilter = "active" | "inactive" | "all";

interface GetClassroomsOptions {
  search?: string;
  activity?: ClassroomActivityFilter;
  branchId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: ClassroomSortField;
  sortDir?: ClassroomSortDirection;
}

export function getClassrooms(
  options?: GetClassroomsOptions,
  signal?: AbortSignal
): Promise<ClassroomListResponse> {
  const params: QueryParams = {
    search: options?.search || undefined,
    activity: options?.activity,
    branchId: options?.branchId,
    page: options?.page,
    pageSize: options?.pageSize,
    sortBy: options?.sortBy,
    sortDir: options?.sortDir,
  };

  return httpGet<ClassroomListResponse>(
    "/api/training/classrooms",
    params,
    trainingRequestOptions(signal)
  );
}

export function createClassroom(body: ClassroomUpsertRequest): Promise<ClassroomResponse> {
  return httpPost<ClassroomResponse>("/api/training/classrooms", body, trainingRequestOptions());
}

export function updateClassroom(
  id: string,
  body: ClassroomUpsertRequest
): Promise<ClassroomResponse> {
  return httpPut<ClassroomResponse>(
    `/api/training/classrooms/${id}`,
    body,
    trainingRequestOptions()
  );
}
