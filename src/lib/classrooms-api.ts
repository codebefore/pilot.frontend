import { httpDelete, httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type {
  ClassroomListResponse,
  ClassroomResponse,
  ClassroomUpsertRequest,
} from "./types";

export type ClassroomSortField = "name" | "capacity" | "isActive";
export type ClassroomSortDirection = "asc" | "desc";
export type ClassroomActivityFilter = "active" | "inactive" | "all";

export interface GetClassroomsOptions {
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

  return httpGet<ClassroomListResponse>("/api/classrooms", params, { signal });
}

export function createClassroom(body: ClassroomUpsertRequest): Promise<ClassroomResponse> {
  return httpPost<ClassroomResponse>("/api/classrooms", body);
}

export function updateClassroom(
  id: string,
  body: ClassroomUpsertRequest
): Promise<ClassroomResponse> {
  return httpPut<ClassroomResponse>(`/api/classrooms/${id}`, body);
}

export function deleteClassroom(id: string): Promise<void> {
  return httpDelete(`/api/classrooms/${id}`);
}
