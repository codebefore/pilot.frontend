import { getFinanceApiBaseUrl } from "./api";
import { httpGet, httpPostForm } from "./http";

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
  createdByUserId: string | null;
  createdByName: string | null;
  createdAtUtc: string;
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
