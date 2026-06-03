import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyRuntimeConfig } from "./api";
import {
  addAssignmentDocument,
  getAssignmentDocumentDownloadUrl,
  listAssignments,
} from "./instructor-assignments-api";

describe("instructor assignments api", () => {
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

  it("routes assignment reads to the training base url", async () => {
    applyRuntimeConfig({
      trainingApiBaseUrl: "http://127.0.0.1:5095",
      documentApiBaseUrl: "http://127.0.0.1:5092",
    });

    await listAssignments("instructor-1");

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:5095/api/training/instructors/instructor-1/assignments");
  });

  it("routes assignment document upload and download urls to the document base url", async () => {
    applyRuntimeConfig({
      documentApiBaseUrl: "http://127.0.0.1:5092",
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "doc-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await addAssignmentDocument("instructor-1", "assignment-1", {
      name: "Sözleşme",
      description: null,
      file: null,
    });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe(
      "http://127.0.0.1:5092/api/document/instructors/instructor-1/assignments/assignment-1/documents"
    );
    expect(init?.method).toBe("POST");
    expect(getAssignmentDocumentDownloadUrl("instructor-1", "assignment-1", "doc-1")).toBe(
      "http://127.0.0.1:5092/api/document/instructors/instructor-1/assignments/assignment-1/documents/doc-1/file"
    );
  });
});
