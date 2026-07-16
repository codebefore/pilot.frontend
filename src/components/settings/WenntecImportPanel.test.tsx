import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/render-with-providers";
import { ApiError } from "../../lib/http";
import { WenntecImportPanel } from "./WenntecImportPanel";

const listWenntecImportBatchesMock = vi.fn();
const getWenntecImportBatchMock = vi.fn();
const analyzeWenntecImportMock = vi.fn();

vi.mock("../../lib/wenntec-import-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/wenntec-import-api")>(
    "../../lib/wenntec-import-api"
  );
  return {
    ...actual,
    listWenntecImportBatches: (...args: Parameters<typeof actual.listWenntecImportBatches>) =>
      listWenntecImportBatchesMock(...args),
    getWenntecImportBatch: (...args: Parameters<typeof actual.getWenntecImportBatch>) =>
      getWenntecImportBatchMock(...args),
    analyzeWenntecImport: (...args: Parameters<typeof actual.analyzeWenntecImport>) =>
      analyzeWenntecImportMock(...args),
  };
});

const batch = {
  id: "batch-1",
  sourceSystem: "wenntec" as const,
  sourceFileName: "eren.sql",
  fileSizeBytes: 30 * 1024 * 1024,
  fileSha256: "a".repeat(64),
  status: "analyzed",
  summary: {
    totalRows: 16831,
    activeRows: 15969,
    deletedRows: 862,
    zeroAmountRows: 1258,
    negativeAmountRows: 12,
    eligibleRows: 14711,
    candidateRows: 9741,
    paidCandidateRows: 9572,
    unpaidCandidateRows: 146,
    trackingCandidateRows: 22,
    refundReviewRows: 1,
    incomeRows: 1354,
    expenseRows: 3616,
    matchedCandidateRows: 9000,
    candidateNotFoundRows: 100,
    multipleCandidateRows: 641,
    invalidDataRows: 0,
    paidCandidateAmount: 22789704,
    openCandidateAmount: 677150,
    trackingCandidateAmount: 49760,
    incomeAmount: 498859.5,
    expenseAmount: 10108272.3,
  },
  errorMessage: null,
  attemptCount: 1,
  processingStartedAtUtc: null,
  completedAtUtc: "2026-07-15T12:00:10Z",
  fileRetainUntilUtc: "2026-08-14T12:00:00Z",
  fileDeletedAtUtc: null,
  createdByUserId: "user-1",
  createdByName: "Test User",
  createdAtUtc: "2026-07-15T12:00:00Z",
  updatedAtUtc: "2026-07-15T12:00:00Z",
};

const queuedBatch = {
  ...batch,
  status: "queued",
  summary: Object.fromEntries(Object.keys(batch.summary).map((key) => [key, 0])) as typeof batch.summary,
  attemptCount: 0,
  completedAtUtc: null,
};

describe("WenntecImportPanel", () => {
  beforeEach(() => {
    listWenntecImportBatchesMock.mockReset();
    getWenntecImportBatchMock.mockReset();
    analyzeWenntecImportMock.mockReset();
    listWenntecImportBatchesMock.mockResolvedValue([]);
    getWenntecImportBatchMock.mockResolvedValue(queuedBatch);
    analyzeWenntecImportMock.mockResolvedValue(batch);
  });

  it("uploads a SQL file and displays its queued job status", async () => {
    analyzeWenntecImportMock.mockResolvedValue(queuedBatch);
    renderWithProviders(
      <WenntecImportPanel
        migrationAccessToken="migration-token"
        onMigrationAccessInvalid={vi.fn()}
      />
    );

    const file = new File(["sql"], "eren.sql", { type: "application/sql" });
    fireEvent.change(screen.getByLabelText("Wenntec SQL dosyası"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Dosyayı analiz et" }));

    await waitFor(() => expect(analyzeWenntecImportMock.mock.calls[0]?.[0]).toBe(file));
    expect(analyzeWenntecImportMock.mock.calls[0]?.[1]).toBe("migration-token");
    expect(await screen.findByText("Analiz sırasına alındı")).toBeInTheDocument();
    expect(screen.getByText("Dosya güvenli şekilde kaydedildi ve analiz sırasına alındı.")).toBeInTheDocument();
    expect(screen.queryByText("Dry-run Özeti")).toBeInTheDocument();
    expect(screen.queryByText("16.831")).not.toBeInTheDocument();
  });

  it("displays a completed dry-run summary from job history", async () => {
    listWenntecImportBatchesMock.mockResolvedValue([batch]);
    renderWithProviders(
      <WenntecImportPanel
        migrationAccessToken="migration-token"
        onMigrationAccessInvalid={vi.fn()}
      />
    );

    expect(await screen.findByText("Dry-run Özeti")).toBeInTheDocument();
    expect(screen.getByText("16.831")).toBeInTheDocument();
    expect(screen.getByText("Analiz tamamlandı")).toBeInTheDocument();
    expect(screen.getByText("Bu aşamada muhasebe kayıtlarına veri yazılmadı.")).toBeInTheDocument();
  });

  it("polls the selected batch detail until the analysis completes", async () => {
    analyzeWenntecImportMock.mockResolvedValue(queuedBatch);
    getWenntecImportBatchMock.mockResolvedValue(batch);
    renderWithProviders(
      <WenntecImportPanel
        migrationAccessToken="migration-token"
        onMigrationAccessInvalid={vi.fn()}
      />
    );

    const file = new File(["sql"], "eren.sql", { type: "application/sql" });
    fireEvent.change(screen.getByLabelText("Wenntec SQL dosyası"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Dosyayı analiz et" }));

    await waitFor(() =>
      expect(getWenntecImportBatchMock).toHaveBeenCalledWith(
        "batch-1",
        "migration-token",
        expect.any(AbortSignal)
      )
    );
    expect(await screen.findByText("16.831")).toBeInTheDocument();
    expect(screen.getByText("Analiz tamamlandı")).toBeInTheDocument();
  });

  it("relocks migration access when Finance rejects the migration token", async () => {
    const onMigrationAccessInvalid = vi.fn();
    listWenntecImportBatchesMock.mockRejectedValue(
      new ApiError(
        403,
        "Forbidden",
        undefined,
        undefined,
        undefined,
        "Verified migration approval is required."
      )
    );

    renderWithProviders(
      <WenntecImportPanel
        migrationAccessToken="expired-token"
        onMigrationAccessInvalid={onMigrationAccessInvalid}
      />
    );

    await waitFor(() => expect(onMigrationAccessInvalid).toHaveBeenCalledTimes(1));
  });
});
