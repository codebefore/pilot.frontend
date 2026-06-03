import { getTrainingApiBaseUrl } from "./api";
import { httpDelete, httpGet, httpPost, httpPostForm, httpPut, type QueryParams } from "./http";
import type {
  InstructorBranch,
  InstructorCreateRequest,
  InstructorEmploymentType,
  InstructorListResponse,
  InstructorResponse,
  InstructorRole,
  InstructorUpsertRequest,
  LicenseClass,
} from "./types";

const trainingRequestOptions = (signal?: AbortSignal) => ({
  baseUrl: getTrainingApiBaseUrl(),
  signal,
});

export type InstructorSortField =
  | "fullName"
  | "role"
  | "employmentType"
  | "branch"
  | "licenseClass"
  | "weeklyLessonHours"
  | "isActive";
export type InstructorSortDirection = "asc" | "desc";
export type InstructorActivityFilter = "active" | "inactive" | "all";

interface GetInstructorsOptions {
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

  return httpGet<InstructorListResponse>(
    "/api/training/instructors",
    params,
    trainingRequestOptions(signal)
  );
}

export function getInstructor(
  id: string,
  signal?: AbortSignal
): Promise<InstructorResponse> {
  return httpGet<InstructorResponse>(
    `/api/training/instructors/${id}`,
    undefined,
    trainingRequestOptions(signal)
  );
}

export function createInstructor(body: InstructorCreateRequest): Promise<InstructorResponse> {
  return httpPost<InstructorResponse>("/api/training/instructors", body, trainingRequestOptions());
}

export function updateInstructor(
  id: string,
  body: InstructorUpsertRequest
): Promise<InstructorResponse> {
  return httpPut<InstructorResponse>(
    `/api/training/instructors/${id}`,
    body,
    trainingRequestOptions()
  );
}

export function deleteInstructor(id: string): Promise<void> {
  return httpDelete(`/api/training/instructors/${id}`, undefined, trainingRequestOptions());
}

export function uploadInstructorPhoto(
  id: string,
  file: File
): Promise<InstructorResponse> {
  const form = new FormData();
  form.append("file", file);
  return httpPostForm<InstructorResponse>(
    `/api/training/instructors/${id}/photo`,
    form,
    trainingRequestOptions()
  );
}

export function deleteInstructorPhoto(id: string): Promise<InstructorResponse> {
  return httpDelete<InstructorResponse>(
    `/api/training/instructors/${id}/photo`,
    undefined,
    trainingRequestOptions()
  );
}

interface InstructorLeaveRequest {
  leftAtDate: string;
  reason?: string | null;
  rowVersion: number;
}

export function markInstructorLeft(
  id: string,
  body: InstructorLeaveRequest
): Promise<InstructorResponse> {
  return httpPost<InstructorResponse>(
    `/api/training/instructors/${id}/leave`,
    body,
    trainingRequestOptions()
  );
}

export function clearInstructorLeft(id: string): Promise<InstructorResponse> {
  return httpDelete<InstructorResponse>(
    `/api/training/instructors/${id}/leave`,
    undefined,
    trainingRequestOptions()
  );
}
