import { httpGet, httpPost, httpPostForm, httpPut, type QueryParams } from "./http";
import type {
  DocumentChecklistEntry,
  DocumentResponse,
  DocumentStatus,
  DocumentTypeResponse,
  DocumentTypeUpsertRequest,
  PagedResponse,
} from "./types";

export type DocumentChecklistTab = "missing" | "all";

export interface GetDocumentTypesOptions {
  module?: string;
  /** When true, also returns soft-deactivated types. Used by the admin screen. */
  includeInactive?: boolean;
}

export interface GetDocumentChecklistParams extends QueryParams {
  search?: string;
  documentTypeId?: string;
  status?: DocumentStatus;
  page?: number;
  pageSize?: number;
}

export function getDocumentTypes(
  options?: GetDocumentTypesOptions,
  signal?: AbortSignal
): Promise<DocumentTypeResponse[]> {
  const params: QueryParams = {
    module: options?.module ?? "candidate",
    includeInactive: options?.includeInactive ?? false,
  };
  return httpGet<DocumentTypeResponse[]>("/api/document-types", params, { signal });
}

export function createDocumentType(
  body: DocumentTypeUpsertRequest
): Promise<DocumentTypeResponse> {
  return httpPost<DocumentTypeResponse>("/api/document-types", body);
}

export function updateDocumentType(
  id: string,
  body: DocumentTypeUpsertRequest
): Promise<DocumentTypeResponse> {
  return httpPut<DocumentTypeResponse>(`/api/document-types/${id}`, body);
}

export function getDocumentChecklist(
  params?: GetDocumentChecklistParams,
  signal?: AbortSignal
): Promise<PagedResponse<DocumentChecklistEntry>> {
  return httpGet<PagedResponse<DocumentChecklistEntry>>(
    "/api/documents/candidate-checklist",
    params,
    { signal }
  );
}

export interface UploadDocumentInput {
  candidateId: string;
  documentTypeId: string;
  file: File;
  note?: string;
}

export function uploadDocument(
  input: UploadDocumentInput,
  signal?: AbortSignal
): Promise<DocumentResponse> {
  const form = new FormData();
  form.append("documentTypeId", input.documentTypeId);
  form.append("file", input.file);
  if (input.note) form.append("note", input.note);
  return httpPostForm<DocumentResponse>(
    `/api/candidates/${input.candidateId}/documents`,
    form,
    { signal }
  );
}
