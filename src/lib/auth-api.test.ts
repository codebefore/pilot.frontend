import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearStoredAuthSession } from "./auth-storage";
import { applyRuntimeConfig } from "./api";
import { logoutSession, refreshSession, requestLoginCode, selectInstitution, verifyLoginCode } from "./auth-api";
import { getRoles, getPermissionAreas, saveRolePermissions } from "./roles-api";
import { getUserNotes, setUserNoteCompletion } from "./user-notes-api";
import { createUser, getUsers } from "./users-api";

describe("auth api", () => {
  beforeEach(() => {
    applyRuntimeConfig(undefined);
    clearStoredAuthSession();
    vi.restoreAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
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

  it("includes the channel field when a WhatsApp request is made", async () => {
    await requestLoginCode({ phone: "5551112233", channel: "whatsapp" });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.body).toBe(JSON.stringify({ phone: "5551112233", channel: "whatsapp" }));
  });

  it("includes the channel field when an SMS request is made", async () => {
    await requestLoginCode({ phone: "5551112233", channel: "sms" });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.body).toBe(JSON.stringify({ phone: "5551112233", channel: "sms" }));
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

  it("routes auth calls to the runtime auth base url when configured", async () => {
    applyRuntimeConfig({
      apiBaseUrl: "http://127.0.0.1:5080",
      authApiBaseUrl: "http://127.0.0.1:5091",
    });

    await verifyLoginCode({ phone: "5551112233", code: "123456" });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:5091/api/auth/login/verify-code");
    expect(init?.method).toBe("POST");
  });

  it("routes identity management calls to the runtime auth base url when configured", async () => {
    applyRuntimeConfig({
      apiBaseUrl: "http://127.0.0.1:5080",
      authApiBaseUrl: "http://127.0.0.1:5091",
    });

    await getUsers({ includeInactive: false, includeSuperAdmins: true });
    await createUser({
      fullName: "Test User",
      phone: "5551112233",
      isActive: true,
      roleId: null,
    });
    await getRoles({ includeInactive: false });
    await getPermissionAreas();
    await saveRolePermissions("role-1", []);
    await getUserNotes();
    await setUserNoteCompletion("note-1", true);

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      "http://127.0.0.1:5091/api/users?includeInactive=false&includeSuperAdmins=true"
    );
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe("http://127.0.0.1:5091/api/users");
    expect(String(vi.mocked(fetch).mock.calls[2][0])).toBe(
      "http://127.0.0.1:5091/api/roles?includeInactive=false"
    );
    expect(String(vi.mocked(fetch).mock.calls[3][0])).toBe(
      "http://127.0.0.1:5091/api/role-permissions/areas"
    );
    expect(String(vi.mocked(fetch).mock.calls[4][0])).toBe(
      "http://127.0.0.1:5091/api/role-permissions/role-1"
    );
    expect(String(vi.mocked(fetch).mock.calls[5][0])).toBe(
      "http://127.0.0.1:5091/api/user-notes"
    );
    expect(String(vi.mocked(fetch).mock.calls[6][0])).toBe(
      "http://127.0.0.1:5091/api/user-notes/note-1/completion"
    );
  });
});
