import { screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Sidebar } from "./Sidebar";
import { SidebarStatsProvider } from "../../lib/sidebar-stats";
import { renderWithProviders } from "../../test/render-with-providers";

const getSidebarStatsMock = vi.fn();

vi.mock("../../lib/stats-api", () => ({
  getSidebarStats: (...args: unknown[]) => getSidebarStatsMock(...args),
}));

function renderSidebar(path = "/") {
  return renderWithProviders(
    <MemoryRouter initialEntries={[path]}>
      <SidebarStatsProvider>
        <Sidebar
          activeInstitutionId="i1"
          onClose={() => {}}
          onInstitutionChange={() => {}}
          open
        />
      </SidebarStatsProvider>
    </MemoryRouter>
  );
}

describe("Sidebar live stats", () => {
  beforeEach(() => {
    getSidebarStatsMock.mockReset();
  });

  it("renders nav badges populated from /api/stats/sidebar response", async () => {
    getSidebarStatsMock.mockResolvedValue({
      candidates: { total: 200, active: 142 },
      groups: { total: 12 },
      documents: { missingCount: 5 },
      mebJobs: { failed: 2, manualReview: 1 },
    });

    renderSidebar();

    // Candidates badge → active (142)
    await waitFor(() => {
      expect(screen.getByText("142")).toBeInTheDocument();
    });
    // Documents badge → missingCount (5)
    expect(screen.getByText("5")).toBeInTheDocument();
    // MEB jobs badge → failed + manualReview (3)
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders no badges when stats fetch fails", async () => {
    getSidebarStatsMock.mockRejectedValue(new Error("network down"));

    renderSidebar();

    // Wait for the (rejected) promise to settle.
    await waitFor(() => {
      expect(getSidebarStatsMock).toHaveBeenCalled();
    });

    // On error the sidebar still renders nav items but skips all badges.
    // None of the dummy zeros should appear as badge text.
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("hides documents and meb badges when their counts are zero", async () => {
    getSidebarStatsMock.mockResolvedValue({
      candidates: { total: 5, active: 5 },
      groups: { total: 1 },
      documents: { missingCount: 0 },
      mebJobs: { failed: 0, manualReview: 0 },
    });

    renderSidebar();

    // Candidates badge always renders even at zero — it is a directory count,
    // not an attention indicator.
    await waitFor(() => expect(screen.getByText("5")).toBeInTheDocument());

    // Documents and MEB attention indicators should NOT render any "0" badge.
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("renders exams submenu and highlights the active child route", async () => {
    getSidebarStatsMock.mockResolvedValue({
      candidates: { total: 8, active: 4 },
      groups: { total: 2 },
      documents: { missingCount: 0 },
      mebJobs: { failed: 0, manualReview: 0 },
    });

    renderSidebar("/exams/e-sinav");

    await waitFor(() => expect(screen.getByText("4")).toBeInTheDocument());

    expect(screen.getByRole("link", { name: "Sınavlar" })).toHaveClass("active");
    expect(screen.getByRole("link", { name: "E-Sınav" })).toHaveClass("active");
    expect(screen.getByRole("link", { name: "Uygulama" })).toBeInTheDocument();
  });

  it("renders training submenu and highlights the active child route", async () => {
    getSidebarStatsMock.mockResolvedValue({
      candidates: { total: 8, active: 4 },
      groups: { total: 2 },
      documents: { missingCount: 0 },
      mebJobs: { failed: 0, manualReview: 0 },
    });

    renderSidebar("/training/uygulama");

    await waitFor(() => expect(screen.getByText("4")).toBeInTheDocument());

    expect(screen.getByRole("link", { name: "Eğitim Planı" })).toHaveClass("active");
    expect(screen.getByRole("link", { name: "Uygulama Eğitim" })).toHaveClass("active");
    expect(screen.getByRole("link", { name: "Teorik Eğitim" })).toBeInTheDocument();
  });
});
