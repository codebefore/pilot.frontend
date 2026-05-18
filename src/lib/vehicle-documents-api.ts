import { httpDelete, httpGet, httpPost, httpPut } from "./http";
import type {
  VehicleDocumentResponse,
  VehicleDocumentUpsertRequest,
} from "./types";

export function listVehicleDocuments(
  vehicleId: string,
  signal?: AbortSignal
): Promise<VehicleDocumentResponse[]> {
  return httpGet<VehicleDocumentResponse[]>(
    `/api/vehicles/${vehicleId}/documents`,
    undefined,
    { signal }
  );
}

export function createVehicleDocument(
  vehicleId: string,
  body: VehicleDocumentUpsertRequest
): Promise<VehicleDocumentResponse> {
  return httpPost<VehicleDocumentResponse>(
    `/api/vehicles/${vehicleId}/documents`,
    body
  );
}

export function updateVehicleDocument(
  vehicleId: string,
  documentId: string,
  body: VehicleDocumentUpsertRequest
): Promise<VehicleDocumentResponse> {
  return httpPut<VehicleDocumentResponse>(
    `/api/vehicles/${vehicleId}/documents/${documentId}`,
    body
  );
}

export function deleteVehicleDocument(
  vehicleId: string,
  documentId: string,
  rowVersion: number
): Promise<void> {
  return httpDelete(
    `/api/vehicles/${vehicleId}/documents/${documentId}?rowVersion=${rowVersion}`
  );
}
