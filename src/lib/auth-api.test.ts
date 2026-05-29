import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearStoredAuthSession } from "./auth-storage";
import { changePassword, loginWithPassword, selectInstitution } from "./auth-api";

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

  it("posts login requests to the auth login endpoint", async () => {
    await loginWithPassword({ phone: "5551112233", password: "secret" });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:5080/api/auth/login");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ phone: "5551112233", password: "secret" }));
  });

  it("posts institution selection requests to the auth select endpoint", async () => {
    await selectInstitution("institution-1");

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:5080/api/auth/institutions/institution-1/select");
    expect(init?.method).toBe("POST");
  });

  it("posts password changes to the auth password endpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await changePassword({ currentPassword: "old-secret", newPassword: "new-secret" });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:5080/api/auth/password");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ currentPassword: "old-secret", newPassword: "new-secret" }));
  });
});
