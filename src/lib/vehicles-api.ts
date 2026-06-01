import { getTrainingApiBaseUrl } from "./api";
import { httpDelete, httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type {
  LicenseClass,
  VehicleListResponse,
  VehicleResponse,
  VehicleStatus,
  VehicleTransmissionType,
  VehicleUpsertRequest,
} from "./types";

const trainingRequestOptions = (signal?: AbortSignal) => ({
  baseUrl: getTrainingApiBaseUrl(),
  signal,
});

export type VehicleSortField =
  | "plateNumber"
  | "brandModel"
  | "vehicleType"
  | "licenseClass"
  | "transmissionType"
  | "status"
  | "isActive";
export type VehicleSortDirection = "asc" | "desc";
export type VehicleActivityFilter = "active" | "inactive" | "all";

interface GetVehiclesOptions {
  search?: string;
  includeInactive?: boolean;
  activity?: VehicleActivityFilter;
  status?: VehicleStatus;
  licenseClass?: LicenseClass;
  transmissionType?: VehicleTransmissionType;
  page?: number;
  pageSize?: number;
  sortBy?: VehicleSortField;
  sortDir?: VehicleSortDirection;
}

export function getVehicles(
  options?: GetVehiclesOptions,
  signal?: AbortSignal
): Promise<VehicleListResponse> {
  const params: QueryParams = {
    search: options?.search || undefined,
    includeInactive: options?.includeInactive ?? false,
    activity: options?.activity,
    status: options?.status,
    licenseClass: options?.licenseClass,
    transmissionType: options?.transmissionType,
    page: options?.page,
    pageSize: options?.pageSize,
    sortBy: options?.sortBy,
    sortDir: options?.sortDir,
  };

  return httpGet<VehicleListResponse>(
    "/api/vehicles",
    params,
    trainingRequestOptions(signal)
  );
}

export async function getVehicle(
  id: string,
  signal?: AbortSignal
): Promise<VehicleResponse> {
  // Backend has no GET-by-id endpoint yet; pull from the list and find.
  // Replace with `/api/vehicles/${id}` once backend exposes it.
  const response = await httpGet<VehicleListResponse>(
    "/api/vehicles",
    { activity: "all", page: 1, pageSize: 500 },
    trainingRequestOptions(signal)
  );
  const found = response.items.find((item) => item.id === id);
  if (!found) {
    throw new Error(`Vehicle not found: ${id}`);
  }
  return found;
}

export function createVehicle(body: VehicleUpsertRequest): Promise<VehicleResponse> {
  return httpPost<VehicleResponse>("/api/vehicles", body, trainingRequestOptions());
}

export function updateVehicle(
  id: string,
  body: VehicleUpsertRequest
): Promise<VehicleResponse> {
  return httpPut<VehicleResponse>(`/api/vehicles/${id}`, body, trainingRequestOptions());
}

export function deleteVehicle(id: string): Promise<void> {
  return httpDelete(`/api/vehicles/${id}`, undefined, trainingRequestOptions());
}
