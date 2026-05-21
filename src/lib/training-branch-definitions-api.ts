import { httpGet, httpPut, type QueryParams } from "./http";
import type {
  TrainingBranchDefinitionListResponse,
  TrainingBranchDefinitionResponse,
  TrainingBranchDefinitionUpsertRequest,
} from "./types";

type TrainingBranchDefinitionActivityFilter = "active" | "inactive" | "all";

interface GetTrainingBranchDefinitionsOptions {
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

export function updateTrainingBranchDefinition(
  id: string,
  body: TrainingBranchDefinitionUpsertRequest
): Promise<TrainingBranchDefinitionResponse> {
  return httpPut<TrainingBranchDefinitionResponse>(
    `/api/training-branch-definitions/${id}`,
    body
  );
}
