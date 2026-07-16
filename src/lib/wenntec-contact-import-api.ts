import { getCandidateApiBaseUrl } from "./api";
import { httpGet, httpPost, httpPostForm } from "./http";

export type WenntecContactImportSummary = {
  totalRows: number;
  distinctIdentities: number;
  duplicateIdentities: number;
  invalidNationalIdRows: number;
  sourceConflictIdentities: number;
  matchedIdentities: number;
  candidateNotFoundIdentities: number;
  phoneAvailableIdentities: number;
  addressAvailableIdentities: number;
  phoneFillCandidates: number;
  addressFillCandidates: number;
  processedIdentities: number;
  updatedIdentities: number;
  updatedCandidates: number;
  noChangeIdentities: number;
  manualReviewIdentities: number;
  projectionMessagesTotal: number;
  projectionMessagesPublished: number;
  errorLogs: WenntecContactImportErrorLog[];
};

export type WenntecContactImportErrorLog = {
  occurredAtUtc: string;
  stage: "apply" | "projection" | string;
  attempt: number;
  message: string;
};

export type WenntecContactImportBatch = {
  id: string;
  sourceFileName: string;
  fileSizeBytes: number;
  fileSha256: string;
  status: string;
  summary: WenntecContactImportSummary;
  errorMessage: string | null;
  attemptCount: number;
  processingStartedAtUtc: string | null;
  completedAtUtc: string | null;
  applyRequestedAtUtc: string | null;
  appliedByName: string | null;
  createdByName: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type WenntecContactImportReviewItem = {
  id: string;
  maskedNationalId: string;
  phoneNumber: string | null;
  address: string | null;
  status: string;
  reason: string | null;
  sourceRowCount: number;
  matchedCandidateCount: number;
  updatedCandidateCount: number;
  variantsJson: string;
};

const options = (migrationAccessToken: string, signal?: AbortSignal) => ({
  baseUrl: getCandidateApiBaseUrl(),
  headers: { "X-Migration-Access-Token": migrationAccessToken },
  signal,
});

export function listWenntecContactImports(token: string, signal?: AbortSignal) {
  return httpGet<WenntecContactImportBatch[]>(
    "/api/candidates/imports/wenntec-contacts",
    { limit: 10 },
    options(token, signal),
  );
}

export function listWenntecContactImportJobs(signal?: AbortSignal) {
  return httpGet<WenntecContactImportBatch[]>(
    "/api/candidates/imports/wenntec-contacts/jobs",
    { limit: 20 },
    { baseUrl: getCandidateApiBaseUrl(), signal },
  );
}

export function getWenntecContactImport(id: string, token: string, signal?: AbortSignal) {
  return httpGet<WenntecContactImportBatch>(
    `/api/candidates/imports/wenntec-contacts/${id}`,
    undefined,
    options(token, signal),
  );
}

export function analyzeWenntecContactImport(file: File, token: string) {
  const form = new FormData();
  form.append("file", file);
  return httpPostForm<WenntecContactImportBatch>(
    "/api/candidates/imports/wenntec-contacts",
    form,
    options(token),
  );
}

export function applyWenntecContactImport(id: string, token: string) {
  return httpPost<WenntecContactImportBatch>(
    `/api/candidates/imports/wenntec-contacts/${id}/apply`,
    {},
    options(token),
  );
}

export function listWenntecContactImportReviewItems(id: string, token: string, signal?: AbortSignal) {
  return httpGet<WenntecContactImportReviewItem[]>(
    `/api/candidates/imports/wenntec-contacts/${id}/items`,
    { limit: 500 },
    options(token, signal),
  );
}
