import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyRuntimeConfig } from "./api";
import { createCandidateKCertificate, listCandidateKCertificates } from "./candidate-k-certificates-api";
import { createCandidateNote, getCandidateNotes } from "./candidate-notes-api";
import { createCandidateReference, getCandidateReferences } from "./candidate-references-api";
import type { CandidateUpsertRequest } from "./types";
import {
  assignCandidateGroup,
  createCandidateTag,
  getCandidateById,
  getCandidateReuseSources,
  getCandidates,
  removeActiveGroupAssignment,
  searchCandidateTags,
  updateCandidate,
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

  it("enriches candidate list items with biometric document photos", async () => {
    applyRuntimeConfig({
      candidateApiBaseUrl: "http://127.0.0.1:5094",
      documentApiBaseUrl: "http://127.0.0.1:5092",
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                id: "candidate-1",
                firstName: "Ayse",
                lastName: "Yilmaz",
                documentSummary: null,
                photo: null,
              },
            ],
            page: 2,
            pageSize: 20,
            totalCount: 1,
            totalPages: 1,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                candidateId: "candidate-1",
                summary: { completedCount: 1, missingCount: 0, totalRequiredCount: 1 },
                photo: { documentId: "document-1", kind: "biometric_photo" },
              },
            ],
            page: 1,
            pageSize: 1,
            totalCount: 1,
            totalPages: 1,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );

    const result = await getCandidates({ page: 2, pageSize: 20, search: "Ayse" });

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      "http://127.0.0.1:5094/api/candidates?page=2&pageSize=20&search=Ayse"
    );
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe(
      "http://127.0.0.1:5092/api/documents/candidate-checklist?candidateIds=candidate-1&page=1&pageSize=1"
    );
    expect(result.items[0].photo).toEqual({ documentId: "document-1", kind: "biometric_photo" });
    expect(result.items[0].documentSummary).toEqual({
      completedCount: 1,
      missingCount: 0,
      totalRequiredCount: 1,
    });
  });

  it("enriches updated candidates with biometric document photos", async () => {
    applyRuntimeConfig({
      candidateApiBaseUrl: "http://127.0.0.1:5094",
      documentApiBaseUrl: "http://127.0.0.1:5092",
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "candidate-1",
            firstName: "Ayse",
            lastName: "Yilmaz",
            documentSummary: null,
            photo: null,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                candidateId: "candidate-1",
                summary: { completedCount: 1, missingCount: 0, totalRequiredCount: 1 },
                photo: { documentId: "document-1", kind: "biometric_photo" },
              },
            ],
            page: 1,
            pageSize: 1,
            totalCount: 1,
            totalPages: 1,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );

    const result = await updateCandidate("candidate-1", {
      firstName: "Ayse",
      lastName: "Yilmaz",
      nationalId: "12345678910",
      licenseClass: "B",
      hasExistingLicense: false,
      status: "active",
      tags: [],
      rowVersion: 1,
    } as CandidateUpsertRequest);

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      "http://127.0.0.1:5094/api/candidates/candidate-1"
    );
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe(
      "http://127.0.0.1:5092/api/documents/candidate-checklist?candidateIds=candidate-1&page=1&pageSize=1"
    );
    expect(result.photo).toEqual({ documentId: "document-1", kind: "biometric_photo" });
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
