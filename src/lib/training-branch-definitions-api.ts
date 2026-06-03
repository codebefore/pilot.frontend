import { getCatalogApiBaseUrl } from "./api";
import { httpGet, httpPut } from "./http";
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

type TrainingBranchSnapshot = Omit<
  TrainingBranchDefinitionResponse,
  "id" | "notes" | "createdAtUtc"
> & {
  trainingBranchDefinitionId: string;
};

const catalogRequestOptions = (signal?: AbortSignal) => ({
  baseUrl: getCatalogApiBaseUrl(),
  signal,
});

export function getTrainingBranchDefinitions(
  options?: GetTrainingBranchDefinitionsOptions,
  signal?: AbortSignal
): Promise<TrainingBranchDefinitionListResponse> {
  return httpGet<TrainingBranchSnapshot[]>(
    "/api/catalog/training-branches",
    undefined,
    catalogRequestOptions(signal)
  ).then((items) => mapTrainingBranchList(items, options));
}

export function updateTrainingBranchDefinition(
  id: string,
  body: TrainingBranchDefinitionUpsertRequest
): Promise<TrainingBranchDefinitionResponse> {
  return httpPut<TrainingBranchSnapshot>(
    `/api/catalog/training-branches/${id}`,
    body,
    catalogRequestOptions()
  ).then(mapTrainingBranch);
}

function mapTrainingBranchList(
  snapshots: TrainingBranchSnapshot[],
  options?: GetTrainingBranchDefinitionsOptions
): TrainingBranchDefinitionListResponse {
  const search = options?.search?.trim().toLocaleLowerCase("tr-TR");
  const activity = options?.activity ?? (options?.includeInactive ? "all" : "active");
  let items = snapshots.map(mapTrainingBranch);

  if (activity === "active") {
    items = items.filter((item) => item.isActive);
  } else if (activity === "inactive") {
    items = items.filter((item) => !item.isActive);
  }
  if (search) {
    items = items.filter((item) =>
      [item.code, item.name].some((value) => value.toLocaleLowerCase("tr-TR").includes(search))
    );
  }

  const sorted = [...items].sort((left, right) => {
    const displayOrderComparison = left.displayOrder - right.displayOrder;
    return displayOrderComparison === 0
      ? left.code.localeCompare(right.code, "tr")
      : displayOrderComparison;
  });
  const activeItems = snapshots.filter((item) => item.isActive);
  return toTrainingBranchPagedResponse(sorted, options?.page, options?.pageSize, {
    activeCount: activeItems.length,
    limitedCount: activeItems.filter((item) => item.totalLessonHourLimit !== null).length,
  });
}

function mapTrainingBranch(snapshot: TrainingBranchSnapshot): TrainingBranchDefinitionResponse {
  return {
    ...snapshot,
    id: snapshot.trainingBranchDefinitionId,
    notes: null,
    createdAtUtc: snapshot.updatedAtUtc,
  };
}

function toTrainingBranchPagedResponse(
  items: TrainingBranchDefinitionResponse[],
  page = 1,
  pageSize = items.length || 20,
  summary: TrainingBranchDefinitionListResponse["summary"]
): TrainingBranchDefinitionListResponse {
  const currentPage = Math.max(1, page);
  const currentPageSize = Math.max(1, pageSize);
  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / currentPageSize));
  const start = (currentPage - 1) * currentPageSize;
  return {
    items: items.slice(start, start + currentPageSize),
    page: currentPage,
    pageSize: currentPageSize,
    totalCount,
    totalPages,
    summary,
  };
}
