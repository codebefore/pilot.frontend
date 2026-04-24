import { httpDelete, httpGet, httpPost, httpPut, type QueryParams } from "./http";
import type {
  LicenseClass,
  VehicleListResponse,
  VehicleResponse,
  VehicleStatus,
  VehicleTransmissionType,
  VehicleUpsertRequest,
} from "./types";

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

export interface GetVehiclesOptions {
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

  return httpGet<VehicleListResponse>("/api/vehicles", params, { signal });
}

export function createVehicle(body: VehicleUpsertRequest): Promise<VehicleResponse> {
  return httpPost<VehicleResponse>("/api/vehicles", body);
}

export function updateVehicle(
  id: string,
  body: VehicleUpsertRequest
): Promise<VehicleResponse> {
  return httpPut<VehicleResponse>(`/api/vehicles/${id}`, body);
}

export function deleteVehicle(id: string): Promise<void> {
  return httpDelete(`/api/vehicles/${id}`);
}
