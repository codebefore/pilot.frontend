import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyRuntimeConfig } from "./api";
import { createCandidateKCertificate, listCandidateKCertificates } from "./candidate-k-certificates-api";
import { createCandidateNote, getCandidateNotes } from "./candidate-notes-api";
import { createCandidateReference, getCandidateReferences } from "./candidate-references-api";
import {
  assignCandidateGroup,
  createCandidateTag,
  getCandidateById,
  getCandidateReuseSources,
  getCandidates,
  removeActiveGroupAssignment,
  searchCandidateTags,
} from "./candidates-api";

describe("candidate api routing", () => {
  beforeEach(() => {
    applyRuntimeConfig(undefined);
    vi.restoreAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ items: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      )
    );
  });

  it("routes candidate list/detail/read helpers to the runtime candidate base url", async () => {
    applyRuntimeConfig({ candidateApiBaseUrl: "http://127.0.0.1:5094" });

    await getCandidates({ page: 2, pageSize: 20, search: "Ayse" });
    await getCandidateById("candidate-1");
    await getCandidateReuseSources("12345678910");

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      "http://127.0.0.1:5094/api/candidates?page=2&pageSize=20&search=Ayse"
    );
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe(
      "http://127.0.0.1:5094/api/candidates/candidate-1"
    );
    expect(String(vi.mocked(fetch).mock.calls[2][0])).toBe(
      "http://127.0.0.1:5094/api/candidates/reuse-sources?nationalId=12345678910"
    );
  });

  it("routes candidate tag commands to the runtime candidate base url", async () => {
    applyRuntimeConfig({ candidateApiBaseUrl: "http://127.0.0.1:5094" });

    await searchCandidateTags("vip");
    await createCandidateTag("VIP");

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      "http://127.0.0.1:5094/api/candidates/tags?search=vip&limit=20"
    );
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe(
      "http://127.0.0.1:5094/api/candidates/tags"
    );
  });

  it("routes candidate group assignment commands to the runtime training base url", async () => {
    applyRuntimeConfig({ trainingApiBaseUrl: "http://127.0.0.1:5097" });

    await assignCandidateGroup("candidate-1", "group-1");
    await removeActiveGroupAssignment("candidate-1");

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      "http://127.0.0.1:5097/api/training/candidates/candidate-1/group-assignments"
    );
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe(
      "http://127.0.0.1:5097/api/training/candidates/candidate-1/group-assignments/active"
    );
  });

  it("routes candidate notes, references, and K certificate calls to the runtime candidate base url", async () => {
    applyRuntimeConfig({ candidateApiBaseUrl: "http://127.0.0.1:5094" });

    await getCandidateNotes("candidate-1");
    await createCandidateNote("candidate-1", { body: "Ara", reminderAtUtc: null });
    await getCandidateReferences({ includeInactive: true });
    await createCandidateReference({ name: "Google", displayOrder: 1, isActive: true });
    await listCandidateKCertificates("candidate-1");
    await createCandidateKCertificate("candidate-1", {
      documentNumber: "K-1",
      startDate: "2026-06-01",
      expiryDate: "2027-06-01",
      lastLessonEndDate: "2026-06-15",
    });

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      "http://127.0.0.1:5094/api/candidates/candidate-1/notes"
    );
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe(
      "http://127.0.0.1:5094/api/candidates/candidate-1/notes"
    );
    expect(String(vi.mocked(fetch).mock.calls[2][0])).toBe(
      "http://127.0.0.1:5094/api/candidate-references?includeInactive=true"
    );
    expect(String(vi.mocked(fetch).mock.calls[3][0])).toBe(
      "http://127.0.0.1:5094/api/candidate-references"
    );
    expect(String(vi.mocked(fetch).mock.calls[4][0])).toBe(
      "http://127.0.0.1:5094/api/candidates/candidate-1/k-certificates"
    );
    expect(String(vi.mocked(fetch).mock.calls[5][0])).toBe(
      "http://127.0.0.1:5094/api/candidates/candidate-1/k-certificates"
    );
  });
});
