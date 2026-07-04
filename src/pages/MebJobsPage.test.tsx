import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../test/render-with-providers";
import { MebJobsPage } from "./MebJobsPage";

const getCandidatesMock = vi.fn();
const listMebbisJobsMock = vi.fn();
const listMebbisJobTypesMock = vi.fn();
const listMebbisJobStepsMock = vi.fn();
const cancelMebbisJobMock = vi.fn();
const cancelAllMebbisJobsMock = vi.fn();
const retryMebbisJobsMock = vi.fn();
const createCandidateLookupJobMock = vi.fn();
const getMebbisJobQueueStatusMock = vi.fn();
const getLocalAgentMebbisSessionMock = vi.fn();
const ensureMebbisSessionMock = vi.fn();
let mebbisSessionDisabled = false;

vi.mock("../lib/candidates-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/candidates-api")>(
    "../lib/candidates-api"
  );

  return {
    ...actual,
    getCandidates: (...args: Parameters<typeof actual.getCandidates>) => getCandidatesMock(...args),
  };
});

vi.mock("../lib/local-agent-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/local-agent-api")>(
    "../lib/local-agent-api"
  );

  return {
    ...actual,
    getLocalAgentMebbisSession: (...args: Parameters<typeof actual.getLocalAgentMebbisSession>) =>
      getLocalAgentMebbisSessionMock(...args),
  };
});

vi.mock("../lib/queries/use-mebbis-session", () => ({
  MEBBIS_SESSION_REQUIRED_MESSAGE: "MEBBİS oturumu açılmalı.",
  useMebbisSessionGuard: () => ({
    disabled: mebbisSessionDisabled,
    ensureSessionAsync: ensureMebbisSessionMock,
    message: "MEBBİS oturumu açılmalı.",
    sessionOpen: !mebbisSessionDisabled,
    warnSessionRequired: vi.fn(),
  }),
}));

vi.mock("../lib/mebbis-jobs-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/mebbis-jobs-api")>(
    "../lib/mebbis-jobs-api"
  );

  return {
    ...actual,
    listMebbisJobs: (...args: Parameters<typeof actual.listMebbisJobs>) =>
      listMebbisJobsMock(...args),
    listMebbisJobTypes: (...args: Parameters<typeof actual.listMebbisJobTypes>) =>
      listMebbisJobTypesMock(...args),
    listMebbisJobSteps: (...args: Parameters<typeof actual.listMebbisJobSteps>) =>
      listMebbisJobStepsMock(...args),
    cancelMebbisJob: (...args: Parameters<typeof actual.cancelMebbisJob>) =>
      cancelMebbisJobMock(...args),
    cancelAllMebbisJobs: (...args: Parameters<typeof actual.cancelAllMebbisJobs>) =>
      cancelAllMebbisJobsMock(...args),
    retryMebbisJobs: (...args: Parameters<typeof actual.retryMebbisJobs>) =>
      retryMebbisJobsMock(...args),
    createCandidateLookupJob: (...args: Parameters<typeof actual.createCandidateLookupJob>) =>
      createCandidateLookupJobMock(...args),
    getMebbisJobQueueStatus: (...args: Parameters<typeof actual.getMebbisJobQueueStatus>) =>
      getMebbisJobQueueStatusMock(...args),
  };
});

const runningJob = {
  id: "11111111-1111-1111-1111-111111111111",
  jobType: "candidate_lookup",
  entityType: "candidate",
  entityId: "candidate-1",
  status: "running",
  priority: 0,
  payloadJson: JSON.stringify({ nationalId: "12345678901" }),
  resultJson: null,
  errorMessage: null,
  attemptCount: 1,
  maxAttemptCount: 3,
  nextAttemptAtUtc: null,
  leaseOwnerClientId: null,
  leaseExpiresAtUtc: null,
  queuePublishedAtUtc: "2026-05-30T09:59:05Z",
  queuePublishLastAttemptAtUtc: "2026-05-30T09:59:05Z",
  queuePublishAttemptCount: 1,
  queuePublishError: null,
  startedAtUtc: "2026-05-30T10:00:00Z",
  completedAtUtc: null,
  createdAtUtc: "2026-05-30T09:59:00Z",
  updatedAtUtc: "2026-05-30T10:00:00Z",
  rowVersion: 1,
};

function pagedJobsResponse(
  items = [runningJob],
  overrides: Partial<Awaited<ReturnType<typeof import("../lib/mebbis-jobs-api").listMebbisJobs>>> = {}
) {
  return {
    items,
    page: 1,
    pageSize: 100,
    totalCount: items.length,
    totalPages: items.length > 0 ? 1 : 0,
    summary: {
      succeeded: 0,
      running: 1,
      pending: 0,
      needsManualAction: 0,
      failed: 0,
      cancelled: 0,
    },
    ...overrides,
  };
}

function renderPage(permissions: Record<string, "view" | "full"> = { mebjobs: "view" }) {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/meb-jobs"]}>
      <MebJobsPage />
    </MemoryRouter>,
    {
      auth: {
        user: {
          id: "meb-viewer",
          phone: "5073737262",
          name: "MEB Viewer",
          roleName: "MEB İzleme",
          isSuperAdmin: false,
        },
        permissions,
      },
    }
  );
}

describe("MebJobsPage", () => {
  beforeEach(() => {
    getCandidatesMock.mockReset();
    listMebbisJobsMock.mockReset();
    listMebbisJobTypesMock.mockReset();
    listMebbisJobStepsMock.mockReset();
    cancelMebbisJobMock.mockReset();
    cancelAllMebbisJobsMock.mockReset();
    retryMebbisJobsMock.mockReset();
    createCandidateLookupJobMock.mockReset();
    getMebbisJobQueueStatusMock.mockReset();
    getLocalAgentMebbisSessionMock.mockReset();
    ensureMebbisSessionMock.mockReset();
    mebbisSessionDisabled = false;
    vi.spyOn(window, "confirm").mockReturnValue(true);

    getCandidatesMock.mockResolvedValue({
      items: [
        {
          id: "candidate-1",
          firstName: "Ali",
          lastName: "Veli",
          nationalId: "12345678901",
        },
      ],
    });
    listMebbisJobsMock.mockResolvedValue(pagedJobsResponse());
    listMebbisJobTypesMock.mockResolvedValue([
      {
        code: "candidate_lookup",
        displayName: "Aday sorgulama",
        description: "Aday sorgulama",
        entityType: "candidate",
        requiresEntity: true,
        defaultPriority: 50,
        defaultMaxAttemptCount: 1,
      },
      {
        code: "candidate_sync",
        displayName: "Aday senkronizasyonu",
        description: "Aday senkronizasyonu",
        entityType: "candidate",
        requiresEntity: true,
        defaultPriority: 50,
        defaultMaxAttemptCount: 1,
      },
    ]);
    listMebbisJobStepsMock.mockResolvedValue([]);
    getLocalAgentMebbisSessionMock.mockResolvedValue({
      status: "connected",
      message: "MEBBIS bağlantısı açık.",
      currentUrl: "https://mebbis.meb.gov.tr/",
      mebbisUser: "meb-user",
      requiresVerificationCode: false,
      updatedAtUtc: new Date().toISOString(),
    });
    ensureMebbisSessionMock.mockResolvedValue(true);
    getMebbisJobQueueStatusMock.mockResolvedValue({
      streamsEnabled: true,
      streamName: "mebbis-jobs",
      consumerGroupName: "pilot-mebbis",
      publishRetryEnabled: true,
      pendingJobCount: 0,
      activeJobCount: 1,
      unpublishedPendingCount: 0,
      publishErrorCount: 0,
      activeExtensionClientCount: 1,
      healthyExtensionClientCount: 1,
      extensionHeartbeatFreshSeconds: 60,
      lastExtensionSeenAtUtc: null,
      lastExtensionDisplayName: null,
      lastPublishedAtUtc: null,
      lastPublishAttemptAtUtc: null,
      redisPendingMessageCount: 0,
      redisConsumerCount: 1,
      redisLowestPendingMessageId: null,
      redisHighestPendingMessageId: null,
      redisError: null,
      healthStatus: "healthy",
      healthMessage: "healthy",
    });
    cancelAllMebbisJobsMock.mockResolvedValue({
      cancelledCount: 1,
      cancelledAtUtc: "2026-05-30T10:01:00Z",
    });
    retryMebbisJobsMock.mockResolvedValue({
      createdCount: 1,
      skippedCount: 0,
      jobs: [],
      retriedAtUtc: "2026-05-30T10:02:00Z",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows MEB jobs to view-only users but disables mutating actions", async () => {
    renderPage();

    expect(await screen.findByText("Aday Durum Görüntüleme")).toBeInTheDocument();
    expect(screen.getByText("Stream")).toBeInTheDocument();

    const newJobButton = screen.getByRole("button", { name: /Yeni MEB İşi/ });
    expect(newJobButton).toBeDisabled();
    expect(newJobButton).toHaveAttribute("title", "Yetkiniz yok.");

    const rowCancelButton = screen.getByRole("button", { name: "İptal" });
    expect(rowCancelButton).toBeDisabled();
    expect(rowCancelButton).toHaveAttribute("title", "Yetkiniz yok.");

    const cancelAllButton = screen.getByRole("button", { name: "Tüm Jobları İptal Et" });
    expect(cancelAllButton).toBeDisabled();
    expect(cancelAllButton).toHaveAttribute("title", "Yetkiniz yok.");

    fireEvent.click(rowCancelButton);
    fireEvent.click(newJobButton);
    fireEvent.click(cancelAllButton);

    expect(cancelMebbisJobMock).not.toHaveBeenCalled();
    expect(cancelAllMebbisJobsMock).not.toHaveBeenCalled();
    expect(createCandidateLookupJobMock).not.toHaveBeenCalled();
  });

  it("confirms and cancels all active jobs for full access users", async () => {
    renderPage({ mebjobs: "full" });

    const cancelAllButton = await screen.findByRole("button", { name: "Tüm Jobları İptal Et" });
    fireEvent.click(cancelAllButton);

    expect(window.confirm).toHaveBeenCalledWith(
      "Bu kurumdaki tüm aktif MEBBIS joblarını iptal etmek istiyor musun?"
    );
    await waitFor(() => expect(cancelAllMebbisJobsMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("1 iş iptal edildi")).toBeInTheDocument();
  });

  it("warns and does not open new job flow when MEBBIS session is closed", async () => {
    mebbisSessionDisabled = true;
    ensureMebbisSessionMock.mockResolvedValue(false);
    renderPage({ mebjobs: "full" });

    const newJobButton = await screen.findByRole("button", { name: /Yeni MEB İşi/ });
    await waitFor(() =>
      expect(newJobButton).toHaveAttribute("aria-disabled", "true")
    );

    fireEvent.click(newJobButton);

    await waitFor(() => expect(ensureMebbisSessionMock).toHaveBeenCalledTimes(1));
    expect(createCandidateLookupJobMock).not.toHaveBeenCalled();
  });

  it("refetches and blocks new job flow when cached MEBBIS session turns closed", async () => {
    ensureMebbisSessionMock.mockResolvedValue(false);
    renderPage({ mebjobs: "full" });

    const newJobButton = await screen.findByRole("button", { name: /Yeni MEB İşi/ });
    await waitFor(() => expect(newJobButton).toHaveAttribute("aria-disabled", "false"));

    fireEvent.click(newJobButton);

    await waitFor(() => expect(ensureMebbisSessionMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(createCandidateLookupJobMock).not.toHaveBeenCalled();
  });

  it("does not cancel all jobs when confirmation is rejected", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    renderPage({ mebjobs: "full" });

    const cancelAllButton = await screen.findByRole("button", { name: "Tüm Jobları İptal Et" });
    fireEvent.click(cancelAllButton);

    expect(cancelAllMebbisJobsMock).not.toHaveBeenCalled();
  });

  it("shows skipped count when manual MEB job bulk retry skips invalid jobs", async () => {
    retryMebbisJobsMock.mockResolvedValueOnce({
      createdCount: 2,
      skippedCount: 1,
      jobs: [],
      retriedAtUtc: "2026-05-30T10:02:00Z",
    });
    renderPage({ mebjobs: "full" });

    const retryManualButton = await screen.findByRole("button", { name: "Manuel Kalanları Tekrar Başlat" });
    await waitFor(() => expect(retryManualButton).toHaveAttribute("aria-disabled", "false"));
    fireEvent.click(retryManualButton);

    await waitFor(() => expect(retryMebbisJobsMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("2 manuel MEB işi tekrar kuyruğa alındı, 1 iş veri eksikliği nedeniyle atlandı")).toBeInTheDocument();
  });

  it("uses paged response summary and total count", async () => {
    listMebbisJobsMock.mockResolvedValueOnce(pagedJobsResponse([runningJob], {
      totalCount: 120,
      totalPages: 2,
      summary: {
        succeeded: 86,
        running: 0,
        pending: 12,
        needsManualAction: 0,
        failed: 2,
        cancelled: 1,
      },
    }));

    renderPage();

    expect(await screen.findByText("Toplam 120 iş")).toBeInTheDocument();
    expect(screen.getByText("86")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("requests the next server page with page and pageSize", async () => {
    listMebbisJobsMock
      .mockResolvedValueOnce(pagedJobsResponse([runningJob], { totalCount: 120, totalPages: 2 }))
      .mockResolvedValueOnce(pagedJobsResponse([], { page: 2, totalCount: 120, totalPages: 2 }));

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Sonraki →" }));

    await waitFor(() =>
      expect(listMebbisJobsMock).toHaveBeenLastCalledWith(
        {
          page: 2,
          pageSize: 100,
          status: undefined,
          jobType: undefined,
        },
        expect.any(AbortSignal)
      )
    );
  });

  it("sends grouped raw statuses for status filters", async () => {
    listMebbisJobsMock
      .mockResolvedValueOnce(pagedJobsResponse())
      .mockResolvedValueOnce(pagedJobsResponse([], { totalCount: 0, totalPages: 0 }));

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Bekliyor" }));

    await waitFor(() =>
      expect(listMebbisJobsMock).toHaveBeenLastCalledWith(
        {
          page: 1,
          pageSize: 100,
          status: "pending,retry",
          jobType: undefined,
        },
        expect.any(AbortSignal)
      )
    );
  });
});
