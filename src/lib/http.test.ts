import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, httpGet, normalizeApiPathForBaseUrl } from "./http";
import { clearStoredAuthSession, writeStoredAuthSession } from "./auth-storage";
import { applyRuntimeConfig } from "./api";

describe("http client", () => {
  beforeEach(() => {
    applyRuntimeConfig(undefined);
    clearStoredAuthSession();
    vi.restoreAllMocks();
  });

  it("normalizes legacy api paths for v1 service base urls", () => {
    expect(normalizeApiPathForBaseUrl("https://api.test/v1/document", "/api/documents")).toBe("/documents");
    expect(normalizeApiPathForBaseUrl("https://api.test/v1/training", "/api/training/groups")).toBe("/groups");
    expect(normalizeApiPathForBaseUrl("https://api.test/v1/catalog", "/api/catalog/document-types")).toBe(
      "/catalog/document-types"
    );
    expect(normalizeApiPathForBaseUrl("https://api.test/v1/identity", "/api/auth/login/request-code")).toBe(
      "/auth/login/request-code"
    );
    expect(normalizeApiPathForBaseUrl("https://api.test/v1/candidates", "/api/candidates")).toBe("/candidates");
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
      message: "Validation failed",
      problemTitle: "Validation failed",
    } satisfies Partial<ApiError>);
  });

  it("uses a user-safe message for forbidden responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ title: "Forbidden" }), {
          status: 403,
          statusText: "Forbidden",
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    await expect(httpGet("/api/users")).rejects.toMatchObject({
      status: 403,
      message: "Yetkiniz yok.",
      problemTitle: "Forbidden",
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
      message: "Aktif kurum seçmeniz gerekiyor.",
      problemTitle: "Active institution is required.",
    } satisfies Partial<ApiError>);

    expect(institutionRequired).toHaveBeenCalledTimes(1);
    expect(unauthorized).not.toHaveBeenCalled();
    window.removeEventListener("pilot:institution-required", institutionRequired);
    window.removeEventListener("pilot:unauthorized", unauthorized);
  });

  it("sends active institution id with authenticated requests", async () => {
    writeStoredAuthSession({
      accessToken: "token",
      expiresAtUtc: new Date(Date.now() + 60_000).toISOString(),
      refreshToken: "refresh-token",
      refreshTokenExpiresAtUtc: new Date(Date.now() + 120_000).toISOString(),
      user: {
        id: "user-1",
        phone: "5551112233",
        name: "Test User",
        roleName: "Operator",
        isSuperAdmin: false,
      },
      institutions: [
        {
          id: "institution-1",
          name: "Pilot Kurs",
          slug: "pilot",
          roleName: "Operator",
          isDefault: true,
          permissions: { payments: "full" },
        },
      ],
      activeInstitution: {
        id: "institution-1",
        name: "Pilot Kurs",
        slug: "pilot",
        roleName: "Operator",
        isDefault: true,
        permissions: { payments: "full" },
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    await expect(httpGet<{ ok: boolean }>("/api/test")).resolves.toEqual({ ok: true });

    const headers = new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token");
    expect(headers.get("X-Institution-Id")).toBe("institution-1");
  });

  it("refreshes the session and retries once on unauthorized responses", async () => {
    writeStoredAuthSession({
      accessToken: "old-token",
      expiresAtUtc: new Date(Date.now() - 60_000).toISOString(),
      refreshToken: "refresh-token",
      refreshTokenExpiresAtUtc: new Date(Date.now() + 60_000).toISOString(),
      user: {
        id: "user-1",
        phone: "5551112233",
        name: "Test User",
        roleName: "Operator",
        isSuperAdmin: false,
      },
      institutions: [],
      activeInstitution: null,
    });
    const refreshed = vi.fn();
    window.addEventListener("pilot:session-refreshed", refreshed);
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          accessToken: "new-token",
          expiresAtUtc: new Date(Date.now() + 60_000).toISOString(),
          refreshToken: "new-refresh-token",
          refreshTokenExpiresAtUtc: new Date(Date.now() + 120_000).toISOString(),
          user: {
            id: "user-1",
            fullName: "Test User",
            phone: "5551112233",
            roleName: "Operator",
            isSuperAdmin: false,
          },
          institutions: [],
          activeInstitution: null,
        }), { status: 200, headers: { "Content-Type": "application/json" } }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }))
    );

    await expect(httpGet<{ ok: boolean }>("/api/test")).resolves.toEqual({ ok: true });

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe("http://127.0.0.1:5080/api/auth/refresh");
    expect(new Headers(vi.mocked(fetch).mock.calls[2][1]?.headers).get("Authorization")).toBe("Bearer new-token");
    expect(refreshed).toHaveBeenCalledTimes(1);
    window.removeEventListener("pilot:session-refreshed", refreshed);
  });

  it("deduplicates concurrent refresh attempts", async () => {
    writeStoredAuthSession({
      accessToken: "old-token",
      expiresAtUtc: new Date(Date.now() - 60_000).toISOString(),
      refreshToken: "refresh-token",
      refreshTokenExpiresAtUtc: new Date(Date.now() + 60_000).toISOString(),
      user: {
        id: "user-1",
        phone: "5551112233",
        name: "Test User",
        roleName: "Operator",
        isSuperAdmin: false,
      },
      institutions: [],
      activeInstitution: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          accessToken: "new-token",
          expiresAtUtc: new Date(Date.now() + 60_000).toISOString(),
          refreshToken: "new-refresh-token",
          refreshTokenExpiresAtUtc: new Date(Date.now() + 120_000).toISOString(),
          user: {
            id: "user-1",
            fullName: "Test User",
            phone: "5551112233",
            roleName: "Operator",
            isSuperAdmin: false,
          },
          institutions: [],
          activeInstitution: null,
        }), { status: 200, headers: { "Content-Type": "application/json" } }))
        .mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })))
    );

    await Promise.all([
      expect(httpGet<{ ok: boolean }>("/api/one")).resolves.toEqual({ ok: true }),
      expect(httpGet<{ ok: boolean }>("/api/two")).resolves.toEqual({ ok: true }),
    ]);

    const refreshCalls = vi.mocked(fetch).mock.calls.filter(([url]) =>
      String(url) === "http://127.0.0.1:5080/api/auth/refresh"
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it("notifies unauthorized when refresh token is missing", async () => {
    const unauthorized = vi.fn();
    window.addEventListener("pilot:unauthorized", unauthorized);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 401, statusText: "Unauthorized" }))
    );

    await expect(httpGet("/api/document-types")).rejects.toMatchObject({
      status: 401,
    } satisfies Partial<ApiError>);

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(unauthorized).toHaveBeenCalledTimes(1);
    window.removeEventListener("pilot:unauthorized", unauthorized);
  });

  it("notifies unauthorized when refresh request fails", async () => {
    writeStoredAuthSession({
      accessToken: "old-token",
      expiresAtUtc: new Date(Date.now() - 60_000).toISOString(),
      refreshToken: "refresh-token",
      refreshTokenExpiresAtUtc: new Date(Date.now() + 60_000).toISOString(),
      user: {
        id: "user-1",
        phone: "5551112233",
        name: "Test User",
        roleName: "Operator",
        isSuperAdmin: false,
      },
      institutions: [],
      activeInstitution: null,
    });
    const unauthorized = vi.fn();
    window.addEventListener("pilot:unauthorized", unauthorized);
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(new Response(null, { status: 401, statusText: "Unauthorized" }))
        .mockResolvedValueOnce(new Response(null, { status: 401, statusText: "Unauthorized" }))
    );

    await expect(httpGet("/api/document-types")).rejects.toMatchObject({
      status: 401,
    } satisfies Partial<ApiError>);

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe("http://127.0.0.1:5080/api/auth/refresh");
    expect(unauthorized).toHaveBeenCalledTimes(1);
    window.removeEventListener("pilot:unauthorized", unauthorized);
  });

  it("routes automatic refresh to the configured auth base url", async () => {
    applyRuntimeConfig({
      apiBaseUrl: "http://127.0.0.1:5080",
      authApiBaseUrl: "http://127.0.0.1:5091",
    });
    writeStoredAuthSession({
      accessToken: "old-token",
      expiresAtUtc: new Date(Date.now() - 60_000).toISOString(),
      refreshToken: "refresh-token",
      refreshTokenExpiresAtUtc: new Date(Date.now() + 60_000).toISOString(),
      user: {
        id: "user-1",
        phone: "5551112233",
        name: "Test User",
        roleName: "Operator",
        isSuperAdmin: false,
      },
      institutions: [],
      activeInstitution: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          accessToken: "new-token",
          expiresAtUtc: new Date(Date.now() + 60_000).toISOString(),
          refreshToken: "new-refresh-token",
          refreshTokenExpiresAtUtc: new Date(Date.now() + 120_000).toISOString(),
          user: {
            id: "user-1",
            fullName: "Test User",
            phone: "5551112233",
            roleName: "Operator",
            isSuperAdmin: false,
          },
          institutions: [],
          activeInstitution: null,
        }), { status: 200, headers: { "Content-Type": "application/json" } }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }))
    );

    await expect(httpGet<{ ok: boolean }>("/api/test")).resolves.toEqual({ ok: true });

    expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe("http://127.0.0.1:5091/api/auth/refresh");
  });
});
