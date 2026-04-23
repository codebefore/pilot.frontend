import { httpGet, httpPost, httpPostForm, httpPut, type QueryParams } from "./http";
import type {
  DocumentMetadataField,
  DocumentChecklistEntry,
  DocumentResponse,
  DocumentStatus,
  DocumentTypeResponse,
  DocumentTypeUpsertRequest,
  PagedResponse,
} from "./types";

function normalizeMetadataField(field: DocumentMetadataField): DocumentMetadataField {
  const matchesLegacyLabel =
    /belge\s+say/i.test(field.label) || (!!field.placeholder && /belge\s+say/i.test(field.placeholder));

  if (field.key !== "document_number" && !matchesLegacyLabel) {
    return field;
  }

  const placeholder =
    !field.placeholder || /belge\s+say/i.test(field.placeholder)
      ? "Belge No"
      : field.placeholder;

  return {
    ...field,
    label: "Belge No",
    placeholder,
  };
}

function normalizeDocumentType(documentType: DocumentTypeResponse): DocumentTypeResponse {
  return {
    ...documentType,
    metadataFields: documentType.metadataFields.map(normalizeMetadataField),
  };
}

export interface GetDocumentTypesOptions {
  module?: string;
  /** When true, also returns soft-deactivated types. Used by the admin screen. */
  includeInactive?: boolean;
}

export interface GetDocumentChecklistParams extends QueryParams {
  search?: string;
  status?: DocumentStatus;
  candidateStatus?: "pre_registered" | "active";
  tags?: string[];
  firstName?: string;
  lastName?: string;
  nationalId?: string;
  phoneNumber?: string;
  email?: string;
  licenseClass?: string;
  gender?: string;
  groupId?: string;
  hasActiveGroup?: boolean;
  hasPhoto?: boolean;
  hasExamResult?: boolean;
  examFeePaid?: boolean;
  hasMissingDocuments?: boolean;
  missingDocumentCountMin?: number;
  missingDocumentCountMax?: number;
  birthDateFrom?: string;
  birthDateTo?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  updatedAtFrom?: string;
  updatedAtTo?: string;
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
  return httpGet<DocumentTypeResponse[]>("/api/document-types", params, { signal }).then(
    (documentTypes) => documentTypes.map(normalizeDocumentType)
  );
}

export function createDocumentType(
  body: DocumentTypeUpsertRequest
): Promise<DocumentTypeResponse> {
  return httpPost<DocumentTypeResponse>("/api/document-types", body).then(normalizeDocumentType);
}

export function updateDocumentType(
  id: string,
  body: DocumentTypeUpsertRequest
): Promise<DocumentTypeResponse> {
  return httpPut<DocumentTypeResponse>(`/api/document-types/${id}`, body).then(
    normalizeDocumentType
  );
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
  /**
   * Extra key-value data collected from the schema fields defined on the
   * selected document type. Serialized to a single `metadataJson` form field
   * because the backend accepts the dict as a JSON string.
   */
  metadata?: Record<string, string>;
}

export function uploadDocument(
  input: UploadDocumentInput,
  signal?: AbortSignal
): Promise<DocumentResponse> {
  const form = new FormData();
  form.append("documentTypeId", input.documentTypeId);
  form.append("file", input.file);
  if (input.note) form.append("note", input.note);
  if (input.metadata && Object.keys(input.metadata).length > 0) {
    form.append("metadataJson", JSON.stringify(input.metadata));
  }
  return httpPostForm<DocumentResponse>(
    `/api/candidates/${input.candidateId}/documents`,
    form,
    { signal }
  );
}

export interface UpdateCandidateDocumentInput {
  note?: string | null;
  metadata?: Record<string, string>;
}

export function updateCandidateDocument(
  candidateId: string,
  documentId: string,
  input: UpdateCandidateDocumentInput,
  signal?: AbortSignal
): Promise<DocumentResponse> {
  return httpPut<DocumentResponse>(
    `/api/candidates/${candidateId}/documents/${documentId}`,
    {
      note: input.note ?? null,
      metadataJson:
        input.metadata !== undefined ? JSON.stringify(input.metadata) : undefined,
    },
    { signal }
  );
}

export function getCandidateDocuments(
  candidateId: string,
  signal?: AbortSignal
): Promise<DocumentResponse[]> {
  return httpGet<DocumentResponse[]>(
    `/api/candidates/${candidateId}/documents`,
    undefined,
    { signal }
  );
}
