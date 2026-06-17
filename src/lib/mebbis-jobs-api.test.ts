import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyRuntimeConfig } from "./api";
import {
  createCandidateNationalIdImportJob,
  createCandidateSyncByNationalIdJob,
  createCandidateSyncJob,
  getMebbisJobQueueStatus,
  listMebbisJobs,
} from "./mebbis-jobs-api";

describe("mebbis jobs api", () => {
  beforeEach(() => {
    applyRuntimeConfig(undefined);
    vi.restoreAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
  });

  it("uses the default api base url when no MEBBIS base url is configured", async () => {
    await listMebbisJobs(50);

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:5080/api/mebbis/jobs?limit=50");
  });

  it("routes MEBBIS calls to the runtime MEBBIS base url when configured", async () => {
    applyRuntimeConfig({
      apiBaseUrl: "http://127.0.0.1:5080",
      mebbisApiBaseUrl: "http://127.0.0.1:5090",
    });

    await listMebbisJobs(25);

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:5090/api/mebbis/jobs?limit=25");
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
});
