import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyRuntimeConfig } from "./api";
import {
  analyzeCandidateDocumentOcr,
  getCandidateDocumentDownloadUrl,
  getCandidateDocuments,
  getDocumentChecklist,
  getDocumentTypes,
  uploadDocument,
} from "./documents-api";

describe("documents api", () => {
  beforeEach(() => {
    applyRuntimeConfig(undefined);
    vi.restoreAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
  });

  it("routes document type catalog reads to the runtime catalog base url", async () => {
    applyRuntimeConfig({
      apiBaseUrl: "http://127.0.0.1:5080",
      catalogApiBaseUrl: "http://127.0.0.1:5090",
      documentApiBaseUrl: "http://127.0.0.1:5092",
    });

    await getDocumentTypes();

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:5090/api/catalog/document-types");
  });

  it("routes candidate document reads to the runtime document base url", async () => {
    applyRuntimeConfig({
      documentApiBaseUrl: "http://127.0.0.1:5092",
    });

    await getCandidateDocuments("candidate-1");

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:5092/api/candidates/candidate-1/documents");
  });

  it("routes checklist and ocr calls to the runtime document base url", async () => {
    applyRuntimeConfig({
      documentApiBaseUrl: "http://127.0.0.1:5092",
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [], page: 1, pageSize: 20, totalCount: 0 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ metadata: {}, confidence: null, warnings: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    await getDocumentChecklist({ page: 1 });
    await analyzeCandidateDocumentOcr("candidate-1", "doc-1");

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      "http://127.0.0.1:5092/api/documents/candidate-checklist?page=1"
    );
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe(
      "http://127.0.0.1:5092/api/candidates/candidate-1/documents/doc-1/ocr"
    );
  });

  it("routes candidate document uploads and download urls to the runtime document base url", async () => {
    applyRuntimeConfig({
      documentApiBaseUrl: "http://127.0.0.1:5092",
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "doc-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await uploadDocument({
      candidateId: "candidate-1",
      documentTypeId: "type-1",
      file: null,
      isPhysicallyAvailable: true,
    });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:5092/api/candidates/candidate-1/documents");
    expect(init?.method).toBe("POST");
    expect(getCandidateDocumentDownloadUrl("candidate-1", "doc-1", { inline: true })).toBe(
      "http://127.0.0.1:5092/api/candidates/candidate-1/documents/doc-1/download?inline=true"
    );
  });
});
