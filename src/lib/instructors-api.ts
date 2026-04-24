import { httpDelete, httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type {
  InstructorBranch,
  InstructorEmploymentType,
  InstructorListResponse,
  InstructorResponse,
  InstructorRole,
  InstructorUpsertRequest,
  LicenseClass,
} from "./types";

export type InstructorSortField =
  | "code"
  | "fullName"
  | "role"
  | "employmentType"
  | "branch"
  | "licenseClass"
  | "weeklyLessonHours"
  | "isActive";
export type InstructorSortDirection = "asc" | "desc";
export type InstructorActivityFilter = "active" | "inactive" | "all";

export interface GetInstructorsOptions {
  search?: string;
  includeInactive?: boolean;
  activity?: InstructorActivityFilter;
  role?: InstructorRole;
  employmentType?: InstructorEmploymentType;
  branch?: InstructorBranch;
  licenseClass?: LicenseClass;
  page?: number;
  pageSize?: number;
  sortBy?: InstructorSortField;
  sortDir?: InstructorSortDirection;
}

export function getInstructors(
  options?: GetInstructorsOptions,
  signal?: AbortSignal
): Promise<InstructorListResponse> {
  const params: QueryParams = {
    search: options?.search || undefined,
    includeInactive: options?.includeInactive ?? false,
    activity: options?.activity,
    role: options?.role,
    employmentType: options?.employmentType,
    branch: options?.branch,
    licenseClass: options?.licenseClass,
    page: options?.page,
    pageSize: options?.pageSize,
    sortBy: options?.sortBy,
    sortDir: options?.sortDir,
  };

  return httpGet<InstructorListResponse>("/api/instructors", params, { signal });
}

export function createInstructor(body: InstructorUpsertRequest): Promise<InstructorResponse> {
  return httpPost<InstructorResponse>("/api/instructors", body);
}

export function updateInstructor(
  id: string,
  body: InstructorUpsertRequest
): Promise<InstructorResponse> {
  return httpPut<InstructorResponse>(`/api/instructors/${id}`, body);
}

export function deleteInstructor(id: string): Promise<void> {
  return httpDelete(`/api/instructors/${id}`);
}
