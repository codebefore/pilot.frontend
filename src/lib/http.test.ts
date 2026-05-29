import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, httpGet } from "./http";
import { clearStoredAuthSession } from "./auth-storage";

describe("http client", () => {
  beforeEach(() => {
    clearStoredAuthSession();
    vi.restoreAllMocks();
  });

  it("exposes problem details title on ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ title: "Validation failed" }), {
          status: 400,
          statusText: "Bad Request",
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    await expect(httpGet("/api/test")).rejects.toMatchObject({
      status: 400,
      problemTitle: "Validation failed",
    } satisfies Partial<ApiError>);
  });

  it("notifies active institution requirement without clearing auth as unauthorized", async () => {
    const institutionRequired = vi.fn();
    const unauthorized = vi.fn();
    window.addEventListener("pilot:institution-required", institutionRequired);
    window.addEventListener("pilot:unauthorized", unauthorized);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ title: "Active institution is required." }), {
          status: 403,
          statusText: "Forbidden",
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    await expect(httpGet("/api/candidates")).rejects.toMatchObject({
      status: 403,
      problemTitle: "Active institution is required.",
    } satisfies Partial<ApiError>);

    expect(institutionRequired).toHaveBeenCalledTimes(1);
    expect(unauthorized).not.toHaveBeenCalled();
    window.removeEventListener("pilot:institution-required", institutionRequired);
    window.removeEventListener("pilot:unauthorized", unauthorized);
  });
});
