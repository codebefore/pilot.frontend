import { getCatalogApiBaseUrl } from "./api";
import { httpDelete, httpGet, httpPost, httpPut } from "./http";
import type {
  LicenseClassDefinitionActivityRequest,
  LicenseClassDefinitionListResponse,
  LicenseClassDefinitionResponse,
  LicenseClassDefinitionUpsertRequest,
} from "./types";

export type LicenseClassDefinitionSortField =
  | "code"
  | "name"
  | "minimumAge"
  | "displayOrder"
  | "isActive";
export type LicenseClassDefinitionSortDirection = "asc" | "desc";
export type LicenseClassDefinitionActivityFilter = "active" | "inactive" | "all";

interface GetLicenseClassDefinitionsOptions {
  search?: string;
  code?: string;
  baseOnly?: boolean;
  includeInstitutionContext?: boolean;
  includeInactive?: boolean;
  activity?: LicenseClassDefinitionActivityFilter;
  page?: number;
  pageSize?: number;
  sortBy?: LicenseClassDefinitionSortField;
  sortDir?: LicenseClassDefinitionSortDirection;
}

type LicenseClassSnapshot = Omit<
  LicenseClassDefinitionResponse,
  "id" | "createdAtUtc"
> & {
  licenseClassDefinitionId: string;
};

const catalogRequestOptions = (signal?: AbortSignal, includeInstitutionContext = true) => ({
  baseUrl: getCatalogApiBaseUrl(),
  includeInstitutionHeader: includeInstitutionContext,
  signal,
});

export function getLicenseClassDefinitions(
  options?: GetLicenseClassDefinitionsOptions,
  signal?: AbortSignal
): Promise<LicenseClassDefinitionListResponse> {
  return httpGet<LicenseClassSnapshot[]>(
    "/api/catalog/license-classes",
    undefined,
    catalogRequestOptions(signal, options?.includeInstitutionContext ?? true)
  ).then((items) => mapLicenseClassList(items, options));
}

export async function getLicenseClassDefinition(
  id: string,
  signal?: AbortSignal
): Promise<LicenseClassDefinitionResponse> {
  // Backend has no GET-by-id endpoint yet; pull from the list and find.
  const response = await getLicenseClassDefinitions({ activity: "all", page: 1, pageSize: 500 }, signal);
  const found = response.items.find((item) => item.id === id);
  if (!found) {
    throw new Error(`License class definition not found: ${id}`);
  }
  return found;
}

function mapLicenseClassList(
  snapshots: LicenseClassSnapshot[],
  options?: GetLicenseClassDefinitionsOptions
): LicenseClassDefinitionListResponse {
  const search = options?.search?.trim().toLocaleLowerCase("tr-TR");
  const activity = options?.activity ?? (options?.includeInactive ? "all" : "active");
  let items = snapshots.map(mapLicenseClass);

  if (options?.baseOnly) {
    items = items.filter((item) => !item.existingLicenseType);
  }
  if (activity === "active") {
    items = items.filter((item) => item.isActive);
  } else if (activity === "inactive") {
    items = items.filter((item) => !item.isActive);
  }
  if (options?.code) {
    items = items.filter((item) => item.code === options.code);
  }
  if (search) {
    items = items.filter((item) =>
      [item.code, item.name, item.existingLicenseType ?? ""].some((value) =>
        value.toLocaleLowerCase("tr-TR").includes(search)
      )
    );
  }

  const summarySource = options?.baseOnly
    ? snapshots.map(mapLicenseClass).filter((item) => !item.existingLicenseType)
    : snapshots.map(mapLicenseClass);
  const activeCount = summarySource.filter((item) => item.isActive).length;
  const sorted = sortLicenseClasses(items, options?.sortBy, options?.sortDir);
  return toLicensePagedResponse(sorted, options?.page, options?.pageSize, { activeCount });
}

function mapLicenseClass(snapshot: LicenseClassSnapshot): LicenseClassDefinitionResponse {
  return {
    ...snapshot,
    id: snapshot.licenseClassDefinitionId,
    createdAtUtc: snapshot.updatedAtUtc,
  };
}

function sortLicenseClasses(
  items: LicenseClassDefinitionResponse[],
  sortBy: LicenseClassDefinitionSortField = "displayOrder",
  sortDir: LicenseClassDefinitionSortDirection = "asc"
): LicenseClassDefinitionResponse[] {
  const direction = sortDir === "desc" ? -1 : 1;
  return [...items].sort((left, right) => {
    const comparison = compareValues(left[sortBy], right[sortBy]);
    return comparison === 0 ? compareValues(left.code, right.code) : comparison * direction;
  });
}

function compareValues(
  left: string | number | boolean | null,
  right: string | number | boolean | null
): number {
  if (left === right) return 0;
  if (left === null) return -1;
  if (right === null) return 1;
  if (typeof left === "string" && typeof right === "string") {
    return left.localeCompare(right, "tr");
  }
  return left > right ? 1 : -1;
}

function toLicensePagedResponse(
  items: LicenseClassDefinitionResponse[],
  page = 1,
  pageSize = items.length || 20,
  summary: LicenseClassDefinitionListResponse["summary"]
): LicenseClassDefinitionListResponse {
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

export function createLicenseClassDefinition(
  body: LicenseClassDefinitionUpsertRequest
): Promise<LicenseClassDefinitionResponse> {
  return httpPost<LicenseClassSnapshot>(
    "/api/catalog/license-classes",
    body,
    catalogRequestOptions()
  ).then(mapLicenseClass);
}

export function updateLicenseClassDefinition(
  id: string,
  body: LicenseClassDefinitionUpsertRequest
): Promise<LicenseClassDefinitionResponse> {
  return httpPut<LicenseClassSnapshot>(
    `/api/catalog/license-classes/${id}`,
    body,
    catalogRequestOptions()
  ).then(mapLicenseClass);
}

export function updateLicenseClassDefinitionActivity(
  id: string,
  body: LicenseClassDefinitionActivityRequest
): Promise<LicenseClassDefinitionResponse> {
  return httpPut<LicenseClassSnapshot>(
    `/api/catalog/license-classes/${id}/activity`,
    body,
    catalogRequestOptions()
  ).then(mapLicenseClass);
}

export function deleteLicenseClassDefinition(id: string): Promise<void> {
  return httpDelete(`/api/catalog/license-classes/${id}`, undefined, catalogRequestOptions());
}
