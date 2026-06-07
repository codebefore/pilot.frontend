import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "./App";
import { AuthContext, type AuthContextValue } from "./lib/auth";
import type { AuthInstitution } from "./lib/auth-storage";
import { getCandidates } from "./lib/candidates-api";
import { getDashboardOverview } from "./lib/stats-api";
import { LanguageProvider } from "./lib/i18n";
import { ToastProvider } from "./components/ui/Toast";
import { renderWithProviders } from "./test/render-with-providers";

vi.mock("./lib/notifications-api", () => ({
  getNotifications: vi.fn().mockResolvedValue({ items: [] }),
}));

vi.mock("./lib/stats-api", () => ({
  getDashboardOverview: vi.fn().mockResolvedValue({
    pendingTasks: [],
    recentMebJobs: [],
    recentActivity: [],
  }),
}));

vi.mock("./lib/candidates-api", async () => {
  const actual = await vi.importActual<typeof import("./lib/candidates-api")>("./lib/candidates-api");
  return {
    ...actual,
    getCandidates: vi.fn().mockResolvedValue({
      items: [],
      licenseClassCounts: [],
      page: 1,
      pageSize: 1000,
      totalCount: 0,
      totalPages: 0,
    }),
  };
});

vi.mock("./lib/user-notes-api", () => ({
  getUserNotes: vi.fn().mockResolvedValue({ items: [] }),
  createUserNote: vi.fn(),
  updateUserNote: vi.fn(),
  setUserNoteCompletion: vi.fn(),
  deleteUserNote: vi.fn(),
}));

vi.mock("./pages/CandidatesPage", () => ({
  CandidatesPage: () => <div>Candidates Page Mock</div>,
}));

const institutions: AuthInstitution[] = [
  {
    id: "i1",
    name: "Pilot Sürücü Kursu",
    slug: "pilot-surucu-kursu",
    roleName: "Kurum Yöneticisi",
    isDefault: true,
    permissions: {
      dashboard: "view",
      candidates: "view",
      groups: "view",
      documents: "view",
      payments: "view",
      training: "view",
      mebjobs: "view",
      settings: "view",
    },
  },
  {
    id: "i2",
    name: "İkinci Kurum",
    slug: "ikinci-kurum",
    roleName: "Personel",
    isDefault: false,
    permissions: { dashboard: "view", candidates: "view" },
  },
];

describe("AppShell tenant state", () => {
  beforeEach(() => {
    vi.mocked(getDashboardOverview).mockClear();
    vi.mocked(getCandidates).mockClear();
  });

  it("renders institution-required state instead of tenant pages", () => {
    renderWithProviders(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
      {
        auth: {
          institutions,
          activeInstitution: null,
          institutionRequired: true,
        },
      }
    );

    expect(screen.getByText("Aktif kurum bulunamadı")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pilot Sürücü Kursu" })).toBeInTheDocument();
    expect(screen.queryByText("Kurum ayarı yok")).not.toBeInTheDocument();
  });

  it("keeps institution-required state and shows toast when selection fails", async () => {
    const selectInstitution = vi.fn().mockRejectedValue(new Error("failed"));

    renderWithProviders(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
      {
        auth: {
          institutions,
          activeInstitution: null,
          institutionRequired: true,
          selectInstitution,
        },
      }
    );

    fireEvent.click(screen.getByRole("button", { name: "Pilot Sürücü Kursu" }));

    await waitFor(() => expect(selectInstitution).toHaveBeenCalledWith("i1"));
    expect(await screen.findByText("Kurum değiştirilemedi")).toBeInTheDocument();
    expect(screen.getByText("Aktif kurum bulunamadı")).toBeInTheDocument();
  });

  it("remounts tenant page fetches when active institution changes", async () => {
    renderSwitchingShell();

    await waitFor(() => expect(getDashboardOverview).toHaveBeenCalledTimes(1), { timeout: 5000 });
    expect(screen.queryByText(/operasyon özeti/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Pilot Sürücü Kursu.*pilot-surucu-kursu/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /İkinci Kurum.*ikinci-kurum.*Personel/i }));

    await waitFor(() => expect(getDashboardOverview).toHaveBeenCalledTimes(2), { timeout: 5000 });
    expect(screen.getAllByRole("button", { name: /İkinci Kurum/i }).length).toBeGreaterThan(0);
  });

  it("redirects unauthorized tenant routes to the first permitted page", async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/documents"]}>
        <AppShell />
      </MemoryRouter>,
      {
        auth: {
          user: {
            id: "candidate-viewer",
            phone: "5000000001",
            name: "Candidate Viewer",
            roleName: "Aday",
            isSuperAdmin: false,
          },
          institutions,
          activeInstitution: institutions[0],
          permissions: { candidates: "view" },
        },
      }
    );

    expect(await screen.findByText("Candidates Page Mock")).toBeInTheDocument();
  });

  it("shows no-permission state when no tenant page is allowed", async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/documents"]}>
        <AppShell />
      </MemoryRouter>,
      {
        auth: {
          user: {
            id: "blocked-user",
            phone: "5000000002",
            name: "Blocked User",
            roleName: "Kısıtlı",
            isSuperAdmin: false,
          },
          institutions,
          activeInstitution: institutions[0],
          permissions: {},
        },
      }
    );

    expect(await screen.findByText("Yetkiniz yok")).toBeInTheDocument();
    expect(screen.getByText("Bu ekrana erişmek için gerekli yetkiye sahip değilsiniz.")).toBeInTheDocument();
  });
});

function renderSwitchingShell() {
  function SwitchingShell() {
    const [activeInstitution, setActiveInstitution] = useState<AuthInstitution>(institutions[0]);
    const authValue: AuthContextValue = {
      user: {
        id: "user-1",
        phone: "5000000000",
        name: "Test User",
        roleName: activeInstitution.roleName,
        isSuperAdmin: false,
      },
      accessToken: `token-${activeInstitution.id}`,
      institutions,
      activeInstitution,
      permissions: activeInstitution.permissions,
      hasInstitution: true,
      institutionRequired: false,
      requestLoginCode: async () => ({
        phone: "5000000000",
        expiresAtUtc: new Date(Date.now() + 5 * 60_000).toISOString(),
      }),
      login: async () => {},
      selectInstitution: async (institutionId: string) => {
        setActiveInstitution(institutions.find((institution) => institution.id === institutionId) ?? activeInstitution);
      },
      logout: () => {},
    };

    return (
      <LanguageProvider>
        <ToastProvider>
          <AuthContext.Provider value={authValue}>
            <MemoryRouter>
              <AppShell />
            </MemoryRouter>
          </AuthContext.Provider>
        </ToastProvider>
      </LanguageProvider>
    );
  }

  return renderWithProviders(<SwitchingShell />, { auth: { user: null } });
}
