import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

  it("does not render the secondary cockpit grid", async () => {
    renderDashboard();

    expect(await screen.findByText("Bekleyen Görevler")).toBeInTheDocument();
    expect(screen.queryByText("MEBBİS Senkronizasyonu")).not.toBeInTheDocument();
    expect(screen.queryByText("Hızlı İşlemler")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Yeni Aday Kaydı/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tahsilat Girişi/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /MEB İşi Başlat/ })).not.toBeInTheDocument();
  });
});
