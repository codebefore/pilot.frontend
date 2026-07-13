import { getCatalogApiBaseUrl, getDocumentApiBaseUrl } from "./api";
import {
  httpDelete,
  httpGet,
  httpPost,
  httpPostForm,
  httpPut,
  normalizeApiPathForBaseUrl,
  type QueryParams,
} from "./http";
import type { CandidateStatusValue } from "./status-maps";
import type {
  CandidateDocumentOcrSuggestionResponse,
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

function documentRequestOptions(signal?: AbortSignal) {
  return { baseUrl: getDocumentApiBaseUrl(), signal };
}

function catalogRequestOptions(signal?: AbortSignal) {
  return { baseUrl: getCatalogApiBaseUrl(), signal };
}

function buildDocumentUrl(path: string): URL {
  const base = getDocumentApiBaseUrl().replace(/\/+$/, "");
  return new URL(`${base}${normalizeApiPathForBaseUrl(base, path)}`, window.location.origin);
}

interface GetDocumentTypesOptions {
  module?: string;
  /** When true, also returns soft-deactivated types. Used by the admin screen. */
  includeInactive?: boolean;
}

interface DocumentTypeSnapshot {
  documentTypeId: string;
  module: string;
  key: string;
  name: string;
  sortOrder: number;
  isRequired: boolean;
  isActive: boolean;
  metadataSchemaJson: string | null;
  updatedAtUtc: string;
}

export interface GetDocumentChecklistParams extends QueryParams {
  candidateIds?: readonly string[];
  search?: string;
  status?: DocumentStatus;
  candidateStatus?: CandidateStatusValue;
  tags?: readonly string[];
  firstName?: string;
  lastName?: string;
  nationalId?: string;
  phoneNumber?: string;
  email?: string;
  licenseClasses?: readonly string[];
  gender?: string;
  groupId?: string;
  hasActiveGroup?: boolean;
  hasPhoto?: boolean;
  hasExamResult?: boolean;
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
  return httpGet<DocumentTypeSnapshot[]>(
    "/api/catalog/document-types",
    undefined,
    catalogRequestOptions(signal)
  ).then((documentTypes) =>
    documentTypes
      .filter((item) => !(item.module === "candidate" && item.key === "invoice"))
      .filter((item) => item.module === params.module)
      .filter((item) => params.includeInactive || item.isActive)
      .map(mapDocumentTypeSnapshot)
      .map(normalizeDocumentType)
  );
}

function mapDocumentTypeSnapshot(snapshot: DocumentTypeSnapshot): DocumentTypeResponse {
  return {
    id: snapshot.documentTypeId,
    module: snapshot.module,
    key: snapshot.key,
    name: snapshot.name,
    sortOrder: snapshot.sortOrder,
    isRequired: snapshot.isRequired,
    isActive: snapshot.isActive,
    metadataFields: parseMetadataFields(snapshot.metadataSchemaJson),
    createdAtUtc: snapshot.updatedAtUtc,
    updatedAtUtc: snapshot.updatedAtUtc,
  };
}

function parseMetadataFields(metadataSchemaJson: string | null): DocumentMetadataField[] {
  if (!metadataSchemaJson) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(metadataSchemaJson);
    return Array.isArray(parsed) ? (parsed as DocumentMetadataField[]) : [];
  } catch {
    return [];
  }
}

export function createDocumentType(
  body: DocumentTypeUpsertRequest
): Promise<DocumentTypeResponse> {
  return httpPost<DocumentTypeSnapshot>(
    "/api/catalog/document-types",
    body,
    catalogRequestOptions()
  )
    .then(mapDocumentTypeSnapshot)
    .then(normalizeDocumentType);
}

export function updateDocumentType(
  id: string,
  body: DocumentTypeUpsertRequest
): Promise<DocumentTypeResponse> {
  return httpPut<DocumentTypeSnapshot>(
    `/api/catalog/document-types/${id}`,
    body,
    catalogRequestOptions()
  )
    .then(mapDocumentTypeSnapshot)
    .then(normalizeDocumentType);
}

export function getDocumentChecklist(
  params?: GetDocumentChecklistParams,
  signal?: AbortSignal
): Promise<PagedResponse<DocumentChecklistEntry>> {
  return httpGet<PagedResponse<DocumentChecklistEntry>>(
    "/api/documents/candidate-checklist",
    params,
    documentRequestOptions(signal)
  );
}

export async function getDocumentChecklistByCandidateIds(
  candidateIds: readonly string[],
  signal?: AbortSignal
): Promise<DocumentChecklistEntry[]> {
  const distinctCandidateIds = [...new Set(candidateIds.filter(Boolean))];
  if (distinctCandidateIds.length === 0) {
    return [];
  }

  const chunks: string[][] = [];
  for (let index = 0; index < distinctCandidateIds.length; index += 100) {
    chunks.push(distinctCandidateIds.slice(index, index + 100));
  }

  const pages = await Promise.all(
    chunks.map((chunk) =>
      getDocumentChecklist(
        {
          candidateIds: chunk,
          page: 1,
          pageSize: chunk.length,
        },
        signal
      )
    )
  );

  return pages.flatMap((page) => page.items);
}

type CandidatePhotoOverviewItem = {
  candidateId: string;
  photo: NonNullable<DocumentChecklistEntry["photo"]>;
};

export async function getCandidatePhotosByCandidateIds(
  candidateIds: readonly string[],
  signal?: AbortSignal
): Promise<CandidatePhotoOverviewItem[]> {
  const distinctCandidateIds = [...new Set(candidateIds.filter(Boolean))];
  if (distinctCandidateIds.length === 0) {
    return [];
  }

  const chunks: string[][] = [];
  for (let index = 0; index < distinctCandidateIds.length; index += 100) {
    chunks.push(distinctCandidateIds.slice(index, index + 100));
  }

  const pages = await Promise.all(
    chunks.map((chunk) =>
      httpPost<CandidatePhotoOverviewItem[]>(
        "/api/documents/candidate-photos",
        { candidateIds: chunk },
        documentRequestOptions(signal)
      )
    )
  );
  return pages.flat();
}

interface UploadDocumentInput {
  candidateId: string;
  documentTypeId: string;
  /** Dosya yüklenmiyorsa null; bu durumda `isPhysicallyAvailable` true olmalı. */
  file: File | null;
  /** "Fiziksel evrak elde var, dosya yüklemiyorum" işareti. */
  isPhysicallyAvailable?: boolean;
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
  if (input.file) {
    form.append("file", input.file);
  }
  if (input.isPhysicallyAvailable) {
    form.append("isPhysicallyAvailable", "true");
  }
  if (input.note) form.append("note", input.note);
  if (input.metadata && Object.keys(input.metadata).length > 0) {
    form.append("metadataJson", JSON.stringify(input.metadata));
  }
  return httpPostForm<DocumentResponse>(
    `/api/candidates/${input.candidateId}/documents`,
    form,
    documentRequestOptions(signal)
  );
}

interface UpdateCandidateDocumentInput {
  note?: string | null;
  metadata?: Record<string, string>;
  isMebbisTransferred?: boolean;
  isPhysicallyAvailable?: boolean;
  uploadedAtUtc?: string;
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
      isMebbisTransferred: input.isMebbisTransferred,
      isPhysicallyAvailable: input.isPhysicallyAvailable,
      uploadedAtUtc: input.uploadedAtUtc,
    },
    documentRequestOptions(signal)
  );
}

export function updateCandidateDocumentMebbisTransfer(
  candidateId: string,
  documentTypeId: string,
  isMebbisTransferred: boolean,
  signal?: AbortSignal
): Promise<DocumentResponse> {
  return httpPut<DocumentResponse>(
    `/api/candidates/${candidateId}/documents/types/${documentTypeId}/mebbis`,
    { isMebbisTransferred },
    documentRequestOptions(signal)
  );
}

export function analyzeCandidateDocumentOcr(
  candidateId: string,
  documentId: string,
  signal?: AbortSignal
): Promise<CandidateDocumentOcrSuggestionResponse> {
  return httpPost<CandidateDocumentOcrSuggestionResponse>(
    `/api/candidates/${candidateId}/documents/${documentId}/ocr/read`,
    {},
    documentRequestOptions(signal)
  );
}

export function getCandidateDocuments(
  candidateId: string,
  signal?: AbortSignal
): Promise<DocumentResponse[]> {
  return httpGet<DocumentResponse[]>(
    `/api/candidates/${candidateId}/documents`,
    undefined,
    documentRequestOptions(signal)
  );
}

export function deleteCandidateDocument(
  candidateId: string,
  documentId: string,
  signal?: AbortSignal
): Promise<void> {
  return httpDelete(
    `/api/candidates/${candidateId}/documents/${documentId}`,
    undefined,
    documentRequestOptions(signal)
  );
}

/** URL the user can hit (in a new tab) to download an attached candidate file. */
export function getCandidateDocumentDownloadUrl(
  candidateId: string,
  documentId: string,
  options?: { inline?: boolean }
): string {
  const path = `/api/candidates/${candidateId}/documents/${documentId}/download`;
  const url = buildDocumentUrl(path);
  if (options?.inline) {
    url.searchParams.set("inline", "true");
  }
  return url.toString();
}
