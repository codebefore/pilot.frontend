import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../lib/http";
import { renderWithProviders } from "../../test/render-with-providers";
import { WenntecContactImportPanel } from "./WenntecContactImportPanel";

const listMock = vi.fn();
const detailMock = vi.fn();
const analyzeMock = vi.fn();
const applyMock = vi.fn();
const reviewMock = vi.fn();

vi.mock("../../lib/wenntec-contact-import-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/wenntec-contact-import-api")>("../../lib/wenntec-contact-import-api");
  return {
    ...actual,
    listWenntecContactImports: (...args: unknown[]) => listMock(...args),
    getWenntecContactImport: (...args: unknown[]) => detailMock(...args),
    analyzeWenntecContactImport: (...args: unknown[]) => analyzeMock(...args),
    applyWenntecContactImport: (...args: unknown[]) => applyMock(...args),
    listWenntecContactImportReviewItems: (...args: unknown[]) => reviewMock(...args),
  };
});

const summary = {
  totalRows: 6839,
  distinctIdentities: 6553,
  duplicateIdentities: 258,
  invalidNationalIdRows: 0,
  sourceConflictIdentities: 175,
  matchedIdentities: 6000,
  candidateNotFoundIdentities: 553,
  phoneAvailableIdentities: 6400,
  addressAvailableIdentities: 6500,
  phoneFillCandidates: 5000,
  addressFillCandidates: 5100,
  processedIdentities: 6553,
  updatedIdentities: 5800,
  updatedCandidates: 5900,
  noChangeIdentities: 25,
  manualReviewIdentities: 728,
  projectionMessagesTotal: 17700,
  projectionMessagesPublished: 3200,
  errorLogs: [],
};

const batch = {
  id: "contact-batch-1",
  sourceFileName: "erentc.sql",
  fileSizeBytes: 3_100_000,
  fileSha256: "a".repeat(64),
  status: "analyzed",
  summary,
  errorMessage: null,
  attemptCount: 0,
  processingStartedAtUtc: null,
  completedAtUtc: null,
  applyRequestedAtUtc: null,
  appliedByName: null,
  createdByName: "Test User",
  createdAtUtc: "2026-07-16T12:00:00Z",
  updatedAtUtc: "2026-07-16T12:00:00Z",
};

describe("WenntecContactImportPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue([batch]);
    detailMock.mockResolvedValue(batch);
    reviewMock.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25, totalPages: 1 });
    applyMock.mockResolvedValue({ ...batch, status: "apply_queued" });
  });

  it("requires popover approval before queuing the contact import", async () => {
    renderWithProviders(<WenntecContactImportPanel migrationAccessToken="migration-token" onMigrationAccessInvalid={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Aktarımı başlat" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Aday iletişim aktarımını başlat");
    expect(applyMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Evet, başlat" }));
    await waitFor(() => expect(applyMock).toHaveBeenCalledWith("contact-batch-1", "migration-token"));
  });

  it("shows projection progress while finalizing", async () => {
    listMock.mockResolvedValue([{ ...batch, status: "finalizing", summary }]);
    detailMock.mockResolvedValue({ ...batch, status: "finalizing", summary });
    renderWithProviders(<WenntecContactImportPanel migrationAccessToken="migration-token" onMigrationAccessInvalid={vi.fn()} />);
    expect((await screen.findAllByText("Servisler güncelleniyor")).length).toBeGreaterThan(0);
    expect(screen.getByText("Servis güncellemeleri tamamlanıyor: 3.200 / 17.700")).toBeInTheDocument();
  });

  it("loads manual review records page by page", async () => {
    listMock.mockResolvedValue([{ ...batch, status: "completed_with_review", summary }]);
    reviewMock.mockImplementation((_id: string, _token: string, page: number, pageSize: number) => Promise.resolve({
      items: [{
        id: `review-${page}`,
        maskedNationalId: page === 1 ? "100*****240" : "200*****241",
        phoneNumber: "5344546925",
        address: "MALTEPE MH. NO:3, YILDIRIM / BURSA",
        status: "candidate_not_found",
        reason: "No active Pilot candidate matches the source national ID.",
        sourceRowCount: 1,
        matchedCandidateCount: 0,
        updatedCandidateCount: 0,
        variantsJson: "{}",
      }],
      total: 26,
      page,
      pageSize,
      totalPages: 2,
    }));

    renderWithProviders(<WenntecContactImportPanel migrationAccessToken="migration-token" onMigrationAccessInvalid={vi.fn()} />);

    expect(await screen.findByText("Manuel İnceleme")).toBeInTheDocument();
    expect(await screen.findByText("1–25 / 26")).toBeInTheDocument();
    expect(screen.getByText("Bu T.C. ile aktif Pilot adayı bulunamadı.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sonraki →" }));

    await waitFor(() => expect(reviewMock).toHaveBeenLastCalledWith(
      "contact-batch-1",
      "migration-token",
      2,
      25,
      expect.any(AbortSignal),
    ));
    expect(await screen.findByText("26–26 / 26")).toBeInTheDocument();
    expect(screen.getByText("200*****241")).toBeInTheDocument();
  });

  it("relocks migration access when review pagination rejects an expired token", async () => {
    const onMigrationAccessInvalid = vi.fn();
    listMock.mockResolvedValue([{ ...batch, status: "completed_with_review", summary }]);
    reviewMock.mockRejectedValue(new ApiError(
      403,
      "Forbidden",
      undefined,
      undefined,
      undefined,
      "Verified migration approval is required.",
    ));

    renderWithProviders(
      <WenntecContactImportPanel
        migrationAccessToken="expired-token"
        onMigrationAccessInvalid={onMigrationAccessInvalid}
      />,
    );

    await waitFor(() => expect(onMigrationAccessInvalid).toHaveBeenCalledTimes(1));
  });
});
