import { httpDelete, httpGet, httpPostForm, httpPutForm, normalizeApiPathForBaseUrl } from "./http";
import { getDocumentApiBaseUrl } from "./api";
import type {
  VehicleDocumentResponse,
  VehicleDocumentUpsertRequest,
} from "./types";

function documentRequestOptions(signal?: AbortSignal) {
  return { baseUrl: getDocumentApiBaseUrl(), signal };
}

function buildDocumentUrl(path: string): URL {
  const base = getDocumentApiBaseUrl().replace(/\/+$/, "");
  return new URL(`${base}${normalizeApiPathForBaseUrl(base, path)}`, window.location.origin);
}

function toVehicleDocumentForm(body: VehicleDocumentUpsertRequest): FormData {
  const form = new FormData();
  form.append("documentType", body.documentType);
  form.append("startDate", body.startDate);
  form.append("endDate", body.endDate);
  if (body.notes) form.append("notes", body.notes);
  if (body.rowVersion !== undefined) form.append("rowVersion", String(body.rowVersion));
  if (body.file) form.append("file", body.file);
  return form;
}

export function listVehicleDocuments(
  vehicleId: string,
  signal?: AbortSignal
): Promise<VehicleDocumentResponse[]> {
  return httpGet<VehicleDocumentResponse[]>(
    `/api/vehicles/${vehicleId}/documents`,
    undefined,
    documentRequestOptions(signal)
  );
}

export function createVehicleDocument(
  vehicleId: string,
  body: VehicleDocumentUpsertRequest
): Promise<VehicleDocumentResponse> {
  return httpPostForm<VehicleDocumentResponse>(
    `/api/vehicles/${vehicleId}/documents`,
    toVehicleDocumentForm(body),
    documentRequestOptions()
  );
}

export function updateVehicleDocument(
  vehicleId: string,
  documentId: string,
  body: VehicleDocumentUpsertRequest
): Promise<VehicleDocumentResponse> {
  return httpPutForm<VehicleDocumentResponse>(
    `/api/vehicles/${vehicleId}/documents/${documentId}`,
    toVehicleDocumentForm(body),
    documentRequestOptions()
  );
}

export function deleteVehicleDocument(
  vehicleId: string,
  documentId: string,
  rowVersion: number
): Promise<void> {
  return httpDelete(
    `/api/vehicles/${vehicleId}/documents/${documentId}?rowVersion=${rowVersion}`,
    undefined,
    documentRequestOptions()
  );
}

export function getVehicleDocumentDownloadUrl(
  vehicleId: string,
  documentId: string
): string {
  const path = `/api/vehicles/${vehicleId}/documents/${documentId}/download`;
  return buildDocumentUrl(path).toString();
}
