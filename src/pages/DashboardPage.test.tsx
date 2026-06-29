import { fireEvent, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../test/render-with-providers";
import { DashboardPage } from "./DashboardPage";

const getDashboardOverviewMock = vi.fn();

vi.mock("../lib/stats-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/stats-api")>(
    "../lib/stats-api"
  );

  return {
    ...actual,
    getDashboardOverview: (...args: Parameters<typeof actual.getDashboardOverview>) =>
      getDashboardOverviewMock(...args),
  };
});

function renderDashboard() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/"]}>
      <DashboardPage userName="Finans Viewer" />
    </MemoryRouter>,
    {
      auth: {
        user: {
          id: "dashboard-viewer",
          phone: "5073737262",
          name: "Finans Viewer",
          roleName: "Finans",
          isSuperAdmin: false,
        },
        permissions: {
          dashboard: "view",
          candidates: "view",
          payments: "view",
        },
      },
    }
  );
}

describe("DashboardPage layout", () => {
  beforeEach(() => {
    getDashboardOverviewMock.mockReset();
    getDashboardOverviewMock.mockResolvedValue({
      pendingTasks: [],
      recentMebJobs: [],
      recentActivity: [],
    });
  });

  it("does not render removed cockpit panels", async () => {
    renderDashboard();

    expect(await screen.findByText("Son Hareketler")).toBeInTheDocument();
    expect(screen.queryByText("Bekleyen Görevler")).not.toBeInTheDocument();
    expect(screen.queryByText("MEBBİS Senkronizasyonu")).not.toBeInTheDocument();
    expect(screen.queryByText("Hızlı İşlemler")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Yeni Aday Kaydı/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tahsilat Girişi/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /MEB İşi Başlat/ })).not.toBeInTheDocument();
  });

  it("renders recent activity and opens the full activity page", async () => {
    getDashboardOverviewMock.mockResolvedValue({
      pendingTasks: [],
      recentMebJobs: [],
      recentActivity: [
        {
          id: "activity-1",
          avatar: "F",
          avatarTone: "brand",
          actor: "Finans",
          description: "tahsilat alındı: 500 TL",
          time: "Güncel",
          createdAtUtc: "2026-06-27T10:00:00Z",
          linkPath: "/candidates/candidate-1?tab=payments",
          actorDisplayName: "Mehmet Kaya",
          actorPhotoUrl: null,
        },
      ],
    });

    renderWithProviders(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<DashboardPage userName="Finans Viewer" />} path="/" />
          <Route element={<div>Activity Page</div>} path="/activity" />
        </Routes>
      </MemoryRouter>,
      {
        auth: {
          user: {
            id: "dashboard-viewer",
            phone: "5073737262",
            name: "Finans Viewer",
            roleName: "Finans",
            isSuperAdmin: false,
          },
          permissions: {
            dashboard: "view",
            candidates: "view",
            payments: "view",
          },
        },
      }
    );

    expect(await screen.findByText("tahsilat alındı: 500 TL")).toBeInTheDocument();
    expect(screen.getByText("Mehmet Kaya")).toBeInTheDocument();

    const [activityButton] = screen.getAllByRole("button", { name: "Tümünü gör" }).slice(-1);
    fireEvent.click(activityButton);

    expect(await screen.findByText("Activity Page")).toBeInTheDocument();
  });

  it("opens candidate activity links with return state", async () => {
    getDashboardOverviewMock.mockResolvedValue({
      pendingTasks: [],
      recentMebJobs: [],
      recentActivity: [
        {
          id: "activity-1",
          avatar: "F",
          avatarTone: "brand",
          actor: "Finans",
          description: "tahsilat alındı",
          time: "Güncel",
          createdAtUtc: "2026-06-27T10:00:00Z",
          linkPath: "/candidates/candidate-1?tab=payments",
          actorDisplayName: null,
          actorPhotoUrl: null,
        },
      ],
    });

    renderWithProviders(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<DashboardPage userName="Finans Viewer" />} path="/" />
          <Route element={<CandidateRouteStateProbe />} path="/candidates/:candidateId" />
        </Routes>
      </MemoryRouter>,
      {
        auth: {
          user: {
            id: "dashboard-viewer",
            phone: "5073737262",
            name: "Finans Viewer",
            roleName: "Finans",
            isSuperAdmin: false,
          },
          permissions: {
            dashboard: "view",
            candidates: "view",
            payments: "view",
          },
        },
      }
    );

    fireEvent.click(await screen.findByText("tahsilat alındı"));

    expect(await screen.findByText("← Son hareketlere dön")).toBeInTheDocument();
    expect(screen.getByText("/")).toBeInTheDocument();
  });
});

function CandidateRouteStateProbe() {
  const location = useLocation();
  const state = location.state as { returnLabel?: string; returnTo?: string } | null;

  return (
    <div>
      <span>{state?.returnLabel}</span>
      <span>{state?.returnTo}</span>
    </div>
  );
}
