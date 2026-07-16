import { getFinanceApiBaseUrl } from "./api";
import { httpGet, httpPost, httpPostForm } from "./http";

export type WenntecImportSummary = {
  totalRows: number;
  activeRows: number;
  deletedRows: number;
  zeroAmountRows: number;
  negativeAmountRows: number;
  eligibleRows: number;
  candidateRows: number;
  paidCandidateRows: number;
  unpaidCandidateRows: number;
  trackingCandidateRows: number;
  refundReviewRows: number;
  incomeRows: number;
  expenseRows: number;
  matchedCandidateRows: number;
  candidateNotFoundRows: number;
  multipleCandidateRows: number;
  invalidDataRows: number;
  paidCandidateAmount: number;
  openCandidateAmount: number;
  trackingCandidateAmount: number;
  incomeAmount: number;
  expenseAmount: number;
  importedRows: number;
  skippedRows: number;
  manualReviewRows: number;
  importedMovementRows: number;
  importedPaymentRows: number;
  importedCashMovementRows: number;
  existingSourceRows: number;
};

export type WenntecImportBatch = {
  id: string;
  sourceSystem: "wenntec";
  sourceFileName: string;
  fileSizeBytes: number;
  fileSha256: string;
  status: "queued" | "processing" | "analyzed" | "failed" | string;
  summary: WenntecImportSummary;
  errorMessage: string | null;
  attemptCount: number;
  processingStartedAtUtc: string | null;
  completedAtUtc: string | null;
  fileRetainUntilUtc: string | null;
  fileDeletedAtUtc: string | null;
  applyRequestedAtUtc: string | null;
  appliedByUserId: string | null;
  appliedByName: string | null;
  createdByUserId: string | null;
  createdByName: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type WenntecImportReviewItem = {
  id: string;
  importBatchId: string;
  sourceKey: string;
  sourceCourseStudentId: number | null;
  maskedNationalId: string | null;
  status: string;
  reason: string | null;
  candidateId: string | null;
  normalizedJson: string;
  resolutionAction: string | null;
  resolvedByUserId: string | null;
  resolvedByName: string | null;
  resolvedAtUtc: string | null;
  updatedAtUtc: string;
};

const financeRequestOptions = (migrationAccessToken: string, signal?: AbortSignal) => ({
  baseUrl: getFinanceApiBaseUrl(),
  headers: { "X-Migration-Access-Token": migrationAccessToken },
  signal,
});

export function listWenntecImportBatches(
  migrationAccessToken: string,
  signal?: AbortSignal
): Promise<WenntecImportBatch[]> {
  return httpGet<WenntecImportBatch[]>(
    "/api/finance/imports/wenntec",
    { limit: 10 },
    financeRequestOptions(migrationAccessToken, signal)
  );
}

export function getWenntecImportBatch(
  batchId: string,
  migrationAccessToken: string,
  signal?: AbortSignal
): Promise<WenntecImportBatch> {
  return httpGet<WenntecImportBatch>(
    `/api/finance/imports/wenntec/${batchId}`,
    undefined,
    financeRequestOptions(migrationAccessToken, signal)
  );
}

export function analyzeWenntecImport(
  file: File,
  migrationAccessToken: string
): Promise<WenntecImportBatch> {
  const form = new FormData();
  form.append("file", file);
  return httpPostForm<WenntecImportBatch>(
    "/api/finance/imports/wenntec",
    form,
    financeRequestOptions(migrationAccessToken)
  );
}

export function applyWenntecImport(
  batchId: string,
  migrationAccessToken: string
): Promise<WenntecImportBatch> {
  return httpPost<WenntecImportBatch>(
    `/api/finance/imports/wenntec/${batchId}/apply`,
    {},
    financeRequestOptions(migrationAccessToken)
  );
}

export function listWenntecImportReviewItems(
  batchId: string,
  migrationAccessToken: string,
  signal?: AbortSignal
): Promise<WenntecImportReviewItem[]> {
  return httpGet<WenntecImportReviewItem[]>(
    `/api/finance/imports/wenntec/${batchId}/items`,
    { limit: 500 },
    financeRequestOptions(migrationAccessToken, signal)
  );
}

export function resolveWenntecImportReviewItem(
  batchId: string,
  itemId: string,
  action: "retry" | "skip",
  migrationAccessToken: string
): Promise<WenntecImportBatch> {
  return httpPost<WenntecImportBatch>(
    `/api/finance/imports/wenntec/${batchId}/items/${itemId}/resolve`,
    { action },
    financeRequestOptions(migrationAccessToken)
  );
}
