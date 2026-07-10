import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyRuntimeConfig } from "./api";
import {
  getEInvoiceIntegration,
  testEInvoiceIntegrationConnection,
  upsertEInvoiceIntegration,
} from "./e-archive-api";

describe("e-archive api", () => {
  beforeEach(() => {
    applyRuntimeConfig({ financeApiBaseUrl: "http://127.0.0.1:5093" });
    vi.restoreAllMocks();
  });

  it("uses the Finance service and treats a missing institution integration as empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    const result = await getEInvoiceIntegration();

    expect(result).toBeNull();
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      "http://127.0.0.1:5093/api/finance/e-archive/integration"
    );
  });

  it("sends institution integration settings to the Finance service", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ providerCode: "vendor-one" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    await upsertEInvoiceIntegration({
      providerCode: "vendor-one",
      environment: "test",
      taxNumber: "1234567890",
      senderAlias: "urn:mail:defaultpk@institution",
      credentialReference: "finance/e-archive/institution-secret",
      usesEArchive: true,
      isEnabled: true,
      rowVersion: null,
    });

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      "http://127.0.0.1:5093/api/finance/e-archive/integration"
    );
    const request = vi.mocked(fetch).mock.calls[0][1];
    expect(request?.method).toBe("PUT");
    expect(JSON.parse(String(request?.body))).toMatchObject({
      providerCode: "vendor-one",
      taxNumber: "1234567890",
      usesEArchive: true,
      isEnabled: true,
    });
  });

  it("routes connection tests to the Finance service", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ succeeded: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    await testEInvoiceIntegrationConnection();

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      "http://127.0.0.1:5093/api/finance/e-archive/integration/test-connection"
    );
    expect(vi.mocked(fetch).mock.calls[0][1]?.method).toBe("POST");
  });
});
