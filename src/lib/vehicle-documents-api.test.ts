import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyRuntimeConfig } from "./api";
import {
  createVehicleDocument,
  deleteVehicleDocument,
  getVehicleDocumentDownloadUrl,
  listVehicleDocuments,
  updateVehicleDocument,
} from "./vehicle-documents-api";

describe("vehicle documents api", () => {
  beforeEach(() => {
    applyRuntimeConfig(undefined);
    vi.restoreAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }))
      )
    );
  });

  it("routes vehicle document reads and mutations to the document base url", async () => {
    applyRuntimeConfig({
      documentApiBaseUrl: "http://127.0.0.1:5092",
    });

    await listVehicleDocuments("vehicle-1");
    const file = new File(["demo"], "insurance.pdf", { type: "application/pdf" });
    await createVehicleDocument("vehicle-1", {
      documentType: "insurance",
      startDate: "2026-06-01",
      endDate: "2027-06-01",
      notes: null,
      file,
    });
    await updateVehicleDocument("vehicle-1", "doc-1", {
      documentType: "inspection",
      startDate: "2026-06-01",
      endDate: "2027-06-01",
      notes: "updated",
      rowVersion: 3,
    });
    await deleteVehicleDocument("vehicle-1", "doc-1", 3);

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      "http://127.0.0.1:5092/api/vehicles/vehicle-1/documents"
    );
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe(
      "http://127.0.0.1:5092/api/vehicles/vehicle-1/documents"
    );
    expect(String(vi.mocked(fetch).mock.calls[2][0])).toBe(
      "http://127.0.0.1:5092/api/vehicles/vehicle-1/documents/doc-1"
    );
    expect(String(vi.mocked(fetch).mock.calls[3][0])).toBe(
      "http://127.0.0.1:5092/api/vehicles/vehicle-1/documents/doc-1?rowVersion=3"
    );
    expect(vi.mocked(fetch).mock.calls[1][1]?.body).toBeInstanceOf(FormData);
    expect((vi.mocked(fetch).mock.calls[1][1]?.body as FormData).get("file")).toBe(file);
  });

  it("builds vehicle document download urls from the document base url", () => {
    applyRuntimeConfig({
      documentApiBaseUrl: "http://127.0.0.1:5092",
    });

    expect(getVehicleDocumentDownloadUrl("vehicle-1", "doc-1")).toBe(
      "http://127.0.0.1:5092/api/vehicles/vehicle-1/documents/doc-1/download"
    );
  });
});
