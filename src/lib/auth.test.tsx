import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "./auth";
import { clearStoredAuthSession, readStoredAuthSession } from "./auth-storage";

const loginWithPasswordMock = vi.fn();
const selectInstitutionMock = vi.fn();

vi.mock("./auth-api", () => ({
  loginWithPassword: (...args: unknown[]) => loginWithPasswordMock(...args),
  logoutSession: vi.fn(),
  selectInstitution: (...args: unknown[]) => selectInstitutionMock(...args),
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
      <button onClick={() => void auth.login("5551112233", "secret")} type="button">
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
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Harness />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    clearStoredAuthSession();
    loginWithPasswordMock.mockReset();
    selectInstitutionMock.mockReset();
  });

  it("stores institutions and active institution after login", async () => {
    loginWithPasswordMock.mockResolvedValue(response());
    renderHarness();

    await act(async () => {
      screen.getByText("login").click();
    });

    expect(screen.getByTestId("active")).toHaveTextContent("kurum-a");
    expect(readStoredAuthSession()?.institutions).toHaveLength(2);
  });

  it("updates token, active institution and role after institution selection", async () => {
    loginWithPasswordMock.mockResolvedValue(response());
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
    loginWithPasswordMock.mockResolvedValue(response());
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
    loginWithPasswordMock.mockResolvedValue(response());
    renderHarness();

    await act(async () => {
      screen.getByText("login").click();
    });
    act(() => {
      window.dispatchEvent(new Event("pilot:unauthorized"));
    });

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("none"));
  });

  it("marks institution required without clearing session", async () => {
    loginWithPasswordMock.mockResolvedValue(response());
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
