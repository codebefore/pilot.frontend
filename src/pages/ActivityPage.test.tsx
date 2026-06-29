import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../test/render-with-providers";
import { getDashboardActivity } from "../lib/stats-api";
import { ActivityPage } from "./ActivityPage";

vi.mock("../lib/stats-api", () => ({
  getDashboardActivity: vi.fn(),
}));

const getDashboardActivityMock = vi.mocked(getDashboardActivity);

function renderActivity(initialPath = "/activity") {
  return renderWithProviders(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<ActivityPage />} path="/activity" />
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
}

describe("ActivityPage", () => {
  beforeEach(() => {
    getDashboardActivityMock.mockReset();
    getDashboardActivityMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 100,
      totalCount: 0,
      totalPages: 0,
    });
  });

  it("requests activities with fixed page size and renders the empty state", async () => {
    renderActivity("/activity?page=2");

    await waitFor(() => {
      expect(getDashboardActivityMock).toHaveBeenCalledWith(
        { page: 2, pageSize: 100 },
        expect.any(AbortSignal)
      );
    });
    expect(await screen.findByText("Son hareket yok")).toBeInTheDocument();
  });

  it("normalizes manually edited fractional page values", async () => {
    renderActivity("/activity?page=1.5");

    await waitFor(() => {
      expect(getDashboardActivityMock).toHaveBeenCalledWith(
        { page: 1, pageSize: 100 },
        expect.any(AbortSignal)
      );
    });
  });

  it("renders activities and carries return state when opening a candidate link", async () => {
    getDashboardActivityMock.mockResolvedValue({
      items: [
        {
          id: "activity-1",
          avatar: "E",
          avatarTone: "blue",
          actor: "Evrak",
          description: "aday evrakı yüklendi: Fotoğraf",
          time: "Güncel",
          createdAtUtc: "2026-06-27T10:00:00Z",
          linkPath: "/candidates/candidate-1",
          actorDisplayName: "Ayşe Yılmaz",
          actorPhotoUrl: null,
        },
      ],
      page: 2,
      pageSize: 100,
      totalCount: 101,
      totalPages: 2,
    });

    renderActivity("/activity?page=2");

    expect(await screen.findByText("27 Haziran Cumartesi")).toBeInTheDocument();
    expect(await screen.findByText("Ayşe Yılmaz")).toBeInTheDocument();
    fireEvent.click(await screen.findByText("aday evrakı yüklendi: Fotoğraf"));

    expect(await screen.findByText("← Son hareketlere dön")).toBeInTheDocument();
    expect(screen.getByText("/activity?page=2")).toBeInTheDocument();
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
