import { httpGet, httpPostForm, type QueryParams } from "./http";
import type {
  DocumentChecklistEntry,
  DocumentResponse,
  DocumentStatus,
  DocumentTypeResponse,
  PagedResponse,
} from "./types";

/**
 * Tab of the documents page. Sent to the backend as-is so it can decide which
 * rows to materialize — for example `missing` returns only entries that have
 * no uploaded document yet, `soon` returns entries whose due date is in the
 * near future.
 */
export type DocumentChecklistTab = "missing" | "all" | "soon";

export interface GetDocumentChecklistParams extends QueryParams {
  tab?: DocumentChecklistTab;
  search?: string;
  documentTypeId?: string;
  status?: DocumentStatus;
  page?: number;
  pageSize?: number;
}

export function getDocumentTypes(signal?: AbortSignal): Promise<DocumentTypeResponse[]> {
  return httpGet<DocumentTypeResponse[]>("/api/document-types", undefined, { signal });
}

export function getDocumentChecklist(
  params?: GetDocumentChecklistParams,
  signal?: AbortSignal
): Promise<PagedResponse<DocumentChecklistEntry>> {
  return httpGet<PagedResponse<DocumentChecklistEntry>>(
    "/api/documents/checklist",
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
  form.append("candidateId", input.candidateId);
  form.append("documentTypeId", input.documentTypeId);
  form.append("file", input.file);
  if (input.note) form.append("note", input.note);
  return httpPostForm<DocumentResponse>("/api/documents", form, { signal });
}
