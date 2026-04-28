import { httpDelete, httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type {
  TrainingBranchDefinitionListResponse,
  TrainingBranchDefinitionResponse,
  TrainingBranchDefinitionUpsertRequest,
} from "./types";

export type TrainingBranchDefinitionActivityFilter = "active" | "inactive" | "all";

export interface GetTrainingBranchDefinitionsOptions {
  search?: string;
  activity?: TrainingBranchDefinitionActivityFilter;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
}

export function getTrainingBranchDefinitions(
  options?: GetTrainingBranchDefinitionsOptions,
  signal?: AbortSignal
): Promise<TrainingBranchDefinitionListResponse> {
  const params: QueryParams = {
    search: options?.search,
    activity: options?.activity,
    includeInactive: options?.includeInactive,
    page: options?.page,
    pageSize: options?.pageSize,
  };

  return httpGet<TrainingBranchDefinitionListResponse>(
    "/api/training-branch-definitions",
    params,
    { signal }
  );
}

export function createTrainingBranchDefinition(
  body: TrainingBranchDefinitionUpsertRequest
): Promise<TrainingBranchDefinitionResponse> {
  return httpPost<TrainingBranchDefinitionResponse>(
    "/api/training-branch-definitions",
    body
  );
}

export function updateTrainingBranchDefinition(
  id: string,
  body: TrainingBranchDefinitionUpsertRequest
): Promise<TrainingBranchDefinitionResponse> {
  return httpPut<TrainingBranchDefinitionResponse>(
    `/api/training-branch-definitions/${id}`,
    body
  );
}

export function deleteTrainingBranchDefinition(id: string): Promise<void> {
  return httpDelete(`/api/training-branch-definitions/${id}`);
}
