import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "./auth";
import { AUTH_STORAGE_KEY, clearStoredAuthSession, readStoredAuthSession } from "./auth-storage";

const requestLoginCodeMock = vi.fn();
const verifyLoginCodeMock = vi.fn();
const selectInstitutionMock = vi.fn();
const logoutSessionMock = vi.fn();

vi.mock("./auth-api", () => ({
  logoutSession: (...args: unknown[]) => logoutSessionMock(...args),
  requestLoginCode: (...args: unknown[]) => requestLoginCodeMock(...args),
  selectInstitution: (...args: unknown[]) => selectInstitutionMock(...args),
  verifyLoginCode: (...args: unknown[]) => verifyLoginCodeMock(...args),
}));

const kurumA = {
  id: "kurum-a",
  name: "Kurum A",
  slug: "kurum-a",
  roleName: "Operator",
  isDefault: true,
  permissions: { dashboard: "view", candidates: "view" },
};

const kurumB = {
  id: "kurum-b",
  name: "Kurum B",
  slug: "kurum-b",
  roleName: "Yönetici",
  isDefault: false,
  permissions: { dashboard: "full", candidates: "full" },
};

function response(activeInstitution = kurumA, token = "token-a") {
  return {
    accessToken: token,
    expiresAtUtc: new Date(Date.now() + 60_000).toISOString(),
    refreshToken: `refresh-${token}`,
    refreshTokenExpiresAtUtc: new Date(Date.now() + 14 * 24 * 60 * 60_000).toISOString(),
    user: {
      id: "user-1",
      fullName: "Test User",
      phone: "5551112233",
      roleName: activeInstitution.roleName,
      isSuperAdmin: false,
    },
    institutions: [kurumA, kurumB],
    activeInstitution,
  };
}

function Harness() {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="user">{auth.user?.name ?? "none"}</div>
      <div data-testid="active">{auth.activeInstitution?.slug ?? "none"}</div>
      <div data-testid="role">{auth.user?.roleName ?? "none"}</div>
      <div data-testid="required">{auth.institutionRequired ? "yes" : "no"}</div>
      <button onClick={() => void auth.login("5551112233", "123456")} type="button">
        login
      </button>
      <button onClick={() => void auth.selectInstitution("kurum-b").catch(() => {})} type="button">
        select
      </button>
      <button onClick={auth.logout} type="button">
        logout
      </button>
    </div>
  );
}

function renderHarness() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Harness />
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    clearStoredAuthSession();
    requestLoginCodeMock.mockReset();
    verifyLoginCodeMock.mockReset();
    selectInstitutionMock.mockReset();
    logoutSessionMock.mockReset();
    logoutSessionMock.mockResolvedValue(undefined);
  });

  it("stores institutions and active institution after login", async () => {
    verifyLoginCodeMock.mockResolvedValue(response());
    renderHarness();

    await act(async () => {
      screen.getByText("login").click();
    });

    expect(screen.getByTestId("active")).toHaveTextContent("kurum-a");
    expect(readStoredAuthSession()?.institutions).toHaveLength(2);
  });

  it("updates token, active institution and role after institution selection", async () => {
    verifyLoginCodeMock.mockResolvedValue(response());
    selectInstitutionMock.mockResolvedValue(response(kurumB, "token-b"));
    renderHarness();

    await act(async () => {
      screen.getByText("login").click();
    });
    await act(async () => {
      screen.getByText("select").click();
    });

    expect(screen.getByTestId("active")).toHaveTextContent("kurum-b");
    expect(screen.getByTestId("role")).toHaveTextContent("Yönetici");
    expect(readStoredAuthSession()?.accessToken).toBe("token-b");
  });

  it("keeps the old session when institution selection fails", async () => {
    verifyLoginCodeMock.mockResolvedValue(response());
    selectInstitutionMock.mockRejectedValue(new Error("failed"));
    renderHarness();

    await act(async () => {
      screen.getByText("login").click();
    });
    await act(async () => {
      screen.getByText("select").click();
    });

    expect(screen.getByTestId("active")).toHaveTextContent("kurum-a");
    expect(readStoredAuthSession()?.accessToken).toBe("token-a");
  });

  it("clears session on unauthorized event", async () => {
    verifyLoginCodeMock.mockResolvedValue(response());
    renderHarness();

    await act(async () => {
      screen.getByText("login").click();
    });
    act(() => {
      window.dispatchEvent(new Event("pilot:unauthorized"));
    });

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("none"));
  });

  it("calls logout endpoint and clears only auth session locally", async () => {
    verifyLoginCodeMock.mockResolvedValue(response());
    localStorage.setItem("pilot.lang", "tr");
    localStorage.setItem("pilot.theme", "pilot");
    renderHarness();

    await act(async () => {
      screen.getByText("login").click();
    });
    await act(async () => {
      screen.getByText("logout").click();
    });

    expect(logoutSessionMock).toHaveBeenCalledWith({ refreshToken: "refresh-token-a" });
    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(readStoredAuthSession()).toBeNull();
    expect(localStorage.getItem("pilot.lang")).toBe("tr");
    expect(localStorage.getItem("pilot.theme")).toBe("pilot");
  });

  it("clears local session even when logout endpoint fails", async () => {
    verifyLoginCodeMock.mockResolvedValue(response());
    logoutSessionMock.mockRejectedValue(new Error("logout failed"));
    renderHarness();

    await act(async () => {
      screen.getByText("login").click();
    });
    await act(async () => {
      screen.getByText("logout").click();
    });

    expect(logoutSessionMock).toHaveBeenCalledWith({ refreshToken: "refresh-token-a" });
    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(readStoredAuthSession()).toBeNull();
  });

  it("clears session when auth storage is removed in another tab", async () => {
    verifyLoginCodeMock.mockResolvedValue(response());
    renderHarness();

    await act(async () => {
      screen.getByText("login").click();
    });
    act(() => {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: AUTH_STORAGE_KEY,
          oldValue: JSON.stringify(response()),
          newValue: null,
          storageArea: localStorage,
        })
      );
    });

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("none"));
    expect(screen.getByTestId("required")).toHaveTextContent("no");
  });

  it("marks institution required without clearing session", async () => {
    verifyLoginCodeMock.mockResolvedValue(response());
    renderHarness();

    await act(async () => {
      screen.getByText("login").click();
    });
    act(() => {
      window.dispatchEvent(new Event("pilot:institution-required"));
    });

    expect(screen.getByTestId("required")).toHaveTextContent("yes");
    expect(screen.getByTestId("user")).toHaveTextContent("Test User");
  });
});
