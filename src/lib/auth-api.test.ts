import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearStoredAuthSession } from "./auth-storage";
import { logoutSession, refreshSession, requestLoginCode, selectInstitution, verifyLoginCode } from "./auth-api";

describe("auth api", () => {
  beforeEach(() => {
    clearStoredAuthSession();
    vi.restoreAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            accessToken: "token",
            expiresAtUtc: new Date(Date.now() + 60_000).toISOString(),
            refreshToken: "refresh-token",
            refreshTokenExpiresAtUtc: new Date(Date.now() + 14 * 24 * 60 * 60_000).toISOString(),
            user: {
              id: "user-1",
              fullName: "Test User",
              phone: "5551112233",
              roleName: null,
              isSuperAdmin: false,
            },
            institutions: [],
            activeInstitution: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );
  });

  it("posts login code requests to the auth request endpoint", async () => {
    await requestLoginCode({ phone: "5551112233" });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:5080/api/auth/login/request-code");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ phone: "5551112233" }));
  });

  it("posts login code verification to the auth verify endpoint", async () => {
    await verifyLoginCode({ phone: "5551112233", code: "123456" });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:5080/api/auth/login/verify-code");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ phone: "5551112233", code: "123456" }));
  });

  it("posts institution selection requests to the auth select endpoint", async () => {
    await selectInstitution("institution-1");

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:5080/api/auth/institutions/institution-1/select");
    expect(init?.method).toBe("POST");
  });

  it("posts refresh requests to the auth refresh endpoint", async () => {
    await refreshSession({ refreshToken: "refresh-token" });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:5080/api/auth/refresh");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ refreshToken: "refresh-token" }));
  });

  it("posts logout requests to the auth logout endpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await logoutSession({ refreshToken: "refresh-token" });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:5080/api/auth/logout");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ refreshToken: "refresh-token" }));
  });
});
