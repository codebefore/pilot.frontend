import { getCatalogApiBaseUrl } from "./api";
import { httpGet } from "./http";
import type {
  CertificateProgramResponse,
  CertificateProgramListResponse,
} from "./types";

type CertificateProgramActivityFilter = "active" | "inactive" | "all";
type CertificateProgramSortField = "code" | "source" | "target" | "displayOrder";
type CertificateProgramSortDirection = "asc" | "desc";

interface GetCertificateProgramsOptions {
  search?: string;
  activity?: CertificateProgramActivityFilter;
  sourceLicenseClass?: string;
  targetLicenseClass?: string;
  page?: number;
  pageSize?: number;
  sortBy?: CertificateProgramSortField;
  sortDir?: CertificateProgramSortDirection;
}

type CertificateProgramSnapshot = Omit<
  CertificateProgramResponse,
  "id" | "notes" | "createdAtUtc"
> & {
  certificateProgramId: string;
};

const catalogRequestOptions = (signal?: AbortSignal) => ({
  baseUrl: getCatalogApiBaseUrl(),
  signal,
});

export function getCertificatePrograms(
  options?: GetCertificateProgramsOptions,
  signal?: AbortSignal
): Promise<CertificateProgramListResponse> {
  return httpGet<CertificateProgramSnapshot[]>(
    "/api/catalog/certificate-programs",
    undefined,
    catalogRequestOptions(signal)
  ).then((items) => mapCertificateProgramList(items, options));
}

function mapCertificateProgramList(
  snapshots: CertificateProgramSnapshot[],
  options?: GetCertificateProgramsOptions
): CertificateProgramListResponse {
  const search = options?.search?.trim().toLocaleLowerCase("tr-TR");
  const activity = options?.activity ?? "active";
  let items = snapshots.map(mapCertificateProgram);

  if (activity === "active") {
    items = items.filter((item) => item.isActive);
  } else if (activity === "inactive") {
    items = items.filter((item) => !item.isActive);
  }
  if (options?.sourceLicenseClass) {
    items = items.filter((item) => item.sourceLicenseClass === options.sourceLicenseClass);
  }
  if (options?.targetLicenseClass) {
    items = items.filter((item) => item.targetLicenseClass === options.targetLicenseClass);
  }
  if (search) {
    items = items.filter((item) =>
      [
        item.code,
        item.sourceLicenseClass,
        item.sourceLicenseDisplayName,
        item.targetLicenseClass,
        item.targetLicenseDisplayName,
      ].some((value) => value.toLocaleLowerCase("tr-TR").includes(search))
    );
  }

  const activeCount = snapshots.filter((item) => item.isActive).length;
  const inactiveCount = snapshots.length - activeCount;
  const sorted = sortCertificatePrograms(items, options?.sortBy, options?.sortDir);
  return toPagedResponse(sorted, options?.page, options?.pageSize, { activeCount, inactiveCount });
}

function mapCertificateProgram(snapshot: CertificateProgramSnapshot): CertificateProgramResponse {
  return {
    ...snapshot,
    id: snapshot.certificateProgramId,
    notes: null,
    createdAtUtc: snapshot.updatedAtUtc,
  };
}

function sortCertificatePrograms(
  items: CertificateProgramResponse[],
  sortBy: CertificateProgramSortField = "displayOrder",
  sortDir: CertificateProgramSortDirection = "asc"
): CertificateProgramResponse[] {
  const direction = sortDir === "desc" ? -1 : 1;
  return [...items].sort((left, right) => {
    const comparison = compareValues(
      getCertificateProgramSortValue(left, sortBy),
      getCertificateProgramSortValue(right, sortBy)
    );
    return comparison === 0 ? compareValues(left.code, right.code) : comparison * direction;
  });
}

function getCertificateProgramSortValue(
  item: CertificateProgramResponse,
  sortBy: CertificateProgramSortField
): string | number {
  if (sortBy === "source") {
    return item.sourceLicenseClass;
  }
  if (sortBy === "target") {
    return item.targetLicenseClass;
  }
  return item[sortBy];
}

function compareValues(left: string | number | boolean, right: string | number | boolean): number {
  if (typeof left === "string" && typeof right === "string") {
    return left.localeCompare(right, "tr");
  }
  if (left === right) return 0;
  return left > right ? 1 : -1;
}

function toPagedResponse<T>(
  items: T[],
  page = 1,
  pageSize = items.length || 20,
  summary: CertificateProgramListResponse["summary"]
): CertificateProgramListResponse {
  const currentPage = Math.max(1, page);
  const currentPageSize = Math.max(1, pageSize);
  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / currentPageSize));
  const start = (currentPage - 1) * currentPageSize;
  return {
    items: items.slice(start, start + currentPageSize) as CertificateProgramResponse[],
    page: currentPage,
    pageSize: currentPageSize,
    totalCount,
    totalPages,
    summary,
  };
}
