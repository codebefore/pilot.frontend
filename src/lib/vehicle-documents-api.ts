import { httpDelete, httpGet, httpPost, httpPut } from "./http";
import { getDocumentApiBaseUrl } from "./api";
import type {
  VehicleDocumentResponse,
  VehicleDocumentUpsertRequest,
} from "./types";

function documentRequestOptions(signal?: AbortSignal) {
  return { baseUrl: getDocumentApiBaseUrl(), signal };
}

export function listVehicleDocuments(
  vehicleId: string,
  signal?: AbortSignal
): Promise<VehicleDocumentResponse[]> {
  return httpGet<VehicleDocumentResponse[]>(
    `/api/document/vehicles/${vehicleId}/documents`,
    undefined,
    documentRequestOptions(signal)
  );
}

export function createVehicleDocument(
  vehicleId: string,
  body: VehicleDocumentUpsertRequest
): Promise<VehicleDocumentResponse> {
  return httpPost<VehicleDocumentResponse>(
    `/api/document/vehicles/${vehicleId}/documents`,
    body,
    documentRequestOptions()
  );
}

export function updateVehicleDocument(
  vehicleId: string,
  documentId: string,
  body: VehicleDocumentUpsertRequest
): Promise<VehicleDocumentResponse> {
  return httpPut<VehicleDocumentResponse>(
    `/api/document/vehicles/${vehicleId}/documents/${documentId}`,
    body,
    documentRequestOptions()
  );
}

export function deleteVehicleDocument(
  vehicleId: string,
  documentId: string,
  rowVersion: number
): Promise<void> {
  return httpDelete(
    `/api/document/vehicles/${vehicleId}/documents/${documentId}?rowVersion=${rowVersion}`,
    undefined,
    documentRequestOptions()
  );
}
