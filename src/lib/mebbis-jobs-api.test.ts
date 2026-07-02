import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyRuntimeConfig } from "./api";
import {
  createCandidateEducationInfoUploadJob,
  createCandidateExamResultSyncJob,
  createESinavExamResultSyncJob,
  createCandidateHealthReportUploadJob,
  createCandidateNationalIdImportJob,
  createCandidateSyncByNationalIdJob,
  createCandidateSyncJob,
  createCandidateTermEnrollJob,
  getMebbisJobQueueStatus,
  listMebbisJobTypes,
  listMebbisJobs,
} from "./mebbis-jobs-api";

describe("mebbis jobs api", () => {
  beforeEach(() => {
    applyRuntimeConfig(undefined);
    vi.restoreAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({
          items: [],
          page: 1,
          pageSize: 100,
          totalCount: 0,
          totalPages: 0,
          summary: {
            succeeded: 0,
            running: 0,
            pending: 0,
            needsManualAction: 0,
            failed: 0,
            cancelled: 0,
          },
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
  });

  it("uses the default api base url when no MEBBIS base url is configured", async () => {
    await listMebbisJobs({ page: 2, pageSize: 50, status: "queued" });

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:5080/api/mebbis/jobs?page=2&pageSize=50&status=queued");
  });

  it("routes MEBBIS calls to the runtime MEBBIS base url when configured", async () => {
    applyRuntimeConfig({
      apiBaseUrl: "http://127.0.0.1:5080",
      mebbisApiBaseUrl: "http://127.0.0.1:5090",
    });

    await listMebbisJobs({ page: 1, pageSize: 25 });

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:5090/api/mebbis/jobs?page=1&pageSize=25");
  });

  it("routes MEBBIS mutations to the MEBBIS base url", async () => {
    applyRuntimeConfig({
      mebbisApiBaseUrl: "http://127.0.0.1:5090",
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "job-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await createCandidateSyncJob("candidate-1");

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe(
      "http://127.0.0.1:5090/api/mebbis/jobs/candidates/candidate-1/sync"
    );
    expect(init?.method).toBe("POST");
  });

  it("creates candidate term enrollment jobs on the MEBBIS base url", async () => {
    applyRuntimeConfig({
      mebbisApiBaseUrl: "http://127.0.0.1:5090",
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "job-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );

    await createCandidateTermEnrollJob("candidate-1", { registrationFee: 8750 });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe(
      "http://127.0.0.1:5090/api/mebbis/jobs/candidates/candidate-1/term-enroll"
    );
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ registrationFee: 8750 }));
  });

  it("creates candidate exam result sync jobs on the MEBBIS base url", async () => {
    applyRuntimeConfig({
      mebbisApiBaseUrl: "http://127.0.0.1:5090",
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "job-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );

    await createCandidateExamResultSyncJob("candidate-1");

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe(
      "http://127.0.0.1:5090/api/mebbis/jobs/candidates/candidate-1/exam-result-sync"
    );
    expect(init?.method).toBe("POST");
  });

  it("creates date-level e-sinav exam result sync jobs on the MEBBIS base url", async () => {
    applyRuntimeConfig({
      mebbisApiBaseUrl: "http://127.0.0.1:5090",
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "job-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );

    await createESinavExamResultSyncJob("2026-06-12", "09:00");

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe(
      "http://127.0.0.1:5090/api/mebbis/jobs/exam-results/e-sinav"
    );
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ examDate: "2026-06-12", examTime: "09:00" }));
  });

  it("omits e-sinav exam time when it is not selected", async () => {
    applyRuntimeConfig({
      mebbisApiBaseUrl: "http://127.0.0.1:5090",
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "job-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );

    await createESinavExamResultSyncJob("2026-06-12", null);

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.body).toBe(JSON.stringify({ examDate: "2026-06-12" }));
  });

  it("creates candidate education info upload jobs on the MEBBIS base url", async () => {
    applyRuntimeConfig({
      mebbisApiBaseUrl: "http://127.0.0.1:5090",
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "job-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );

    await createCandidateEducationInfoUploadJob("candidate-1");

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe(
      "http://127.0.0.1:5090/api/mebbis/jobs/candidates/candidate-1/education-info/upload"
    );
    expect(init?.method).toBe("POST");
  });

  it("creates candidate health report upload jobs on the MEBBIS base url", async () => {
    applyRuntimeConfig({
      mebbisApiBaseUrl: "http://127.0.0.1:5090",
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "job-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );

    await createCandidateHealthReportUploadJob("candidate-1");

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe(
      "http://127.0.0.1:5090/api/mebbis/jobs/candidates/candidate-1/health-report/upload"
    );
    expect(init?.method).toBe("POST");
  });

  it("creates candidate national ID import jobs on the MEBBIS base url", async () => {
    applyRuntimeConfig({
      mebbisApiBaseUrl: "http://127.0.0.1:5090",
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "job-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await createCandidateNationalIdImportJob();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe(
      "http://127.0.0.1:5090/api/mebbis/jobs/candidates/national-ids/import"
    );
    expect(init?.method).toBe("POST");
  });

  it("creates candidate sync jobs by national id on the MEBBIS base url", async () => {
    applyRuntimeConfig({
      mebbisApiBaseUrl: "http://127.0.0.1:5090",
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "job-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );

    await createCandidateSyncByNationalIdJob("10122067560");

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe(
      "http://127.0.0.1:5090/api/mebbis/jobs/candidates/sync-by-national-id"
    );
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ nationalId: "10122067560" }));
  });

  it("passes candidate status hint when creating candidate sync jobs by national id", async () => {
    applyRuntimeConfig({
      mebbisApiBaseUrl: "http://127.0.0.1:5090",
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "job-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );

    await createCandidateSyncByNationalIdJob("10122067560", "graduated");

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.body).toBe(JSON.stringify({ nationalId: "10122067560", candidateStatusHint: "graduated" }));
  });

  it("keeps health and queue reads on the MEBBIS base url", async () => {
    applyRuntimeConfig({
      mebbisApiBaseUrl: "http://127.0.0.1:5090",
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ healthStatus: "healthy" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await getMebbisJobQueueStatus();

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:5090/api/mebbis/jobs/queue/status");
  });

  it("lists job types on the MEBBIS base url", async () => {
    applyRuntimeConfig({
      mebbisApiBaseUrl: "http://127.0.0.1:5090",
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await listMebbisJobTypes();

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:5090/api/mebbis/jobs/types");
  });
});
