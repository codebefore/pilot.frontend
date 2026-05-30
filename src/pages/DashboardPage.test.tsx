import { fireEvent, screen } from "@testing-library/react";
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
      <DashboardPage
        activeInstitution={{
          id: "institution-1",
          name: "Pilot Kurs",
          slug: "pilot-kurs",
          roleName: "Finans",
          isDefault: true,
          permissions: {
            dashboard: "view",
            candidates: "view",
            payments: "view",
          },
        }}
        userName="Finans Viewer"
      />
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

describe("DashboardPage permissions", () => {
  beforeEach(() => {
    getDashboardOverviewMock.mockReset();
    getDashboardOverviewMock.mockResolvedValue({
      pendingTasks: [],
      recentMebJobs: [],
      recentActivity: [],
    });
  });

  it("keeps quick actions visible but disabled without full permissions", async () => {
    renderDashboard();

    expect(await screen.findByText("Hızlı İşlemler")).toBeInTheDocument();

    const newCandidateButton = screen.getByRole("button", { name: /Yeni Aday Kaydı/ });
    const newPaymentButton = screen.getByRole("button", { name: /Tahsilat Girişi/ });
    const mebButton = screen.getByRole("button", { name: /MEB İşi Başlat/ });

    for (const button of [newCandidateButton, newPaymentButton, mebButton]) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("title", "Yetkiniz yok.");
      fireEvent.click(button);
    }

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
