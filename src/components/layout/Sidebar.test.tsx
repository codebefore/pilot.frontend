import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Sidebar } from "./Sidebar";
import { SidebarStatsProvider } from "../../lib/sidebar-stats";
import type { AuthInstitution } from "../../lib/auth-storage";
import { renderWithProviders } from "../../test/render-with-providers";

const getSidebarStatsMock = vi.fn();

vi.mock("../../lib/stats-api", () => ({
  getSidebarStats: (...args: unknown[]) => getSidebarStatsMock(...args),
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

function renderSidebar(path = "/", onInstitutionChange = async () => {}) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[path]}>
      <SidebarStatsProvider>
        <Sidebar
          activeInstitutionId="i1"
          institutions={institutions}
          onClose={() => {}}
          onInstitutionChange={onInstitutionChange}
          open
        />
      </SidebarStatsProvider>
    </MemoryRouter>,
    {
      auth: {
        institutions,
        activeInstitution: institutions[0],
        permissions: institutions[0].permissions,
        selectInstitution: onInstitutionChange,
      },
    }
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
      payments: { dueToday: 0 },
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

  it("uses session institutions for tenant switching", async () => {
    const onInstitutionChange = vi.fn().mockResolvedValue(undefined);
    getSidebarStatsMock.mockResolvedValue({
      candidates: { total: 0, active: 0 },
      groups: { total: 0 },
      documents: { missingCount: 0 },
      mebJobs: { failed: 0, manualReview: 0 },
      payments: { dueToday: 0 },
    });

    renderSidebar("/", onInstitutionChange);

    fireEvent.click(screen.getByRole("button", { name: /Pilot Sürücü Kursu.*pilot-surucu-kursu/i }));
    fireEvent.click(screen.getByRole("button", { name: /İkinci Kurum.*ikinci-kurum.*Personel/i }));

    await waitFor(() => expect(onInstitutionChange).toHaveBeenCalledWith("i2"));
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
      payments: { dueToday: 0 },
    });

    renderSidebar();

    // Candidates badge always renders even at zero — it is a directory count,
    // not an attention indicator.
    await waitFor(() => expect(screen.getByText("5")).toBeInTheDocument());

    // Documents and MEB attention indicators should NOT render any "0" badge.
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("keeps submenus collapsed by default and activates the first child when parent is clicked", async () => {
    getSidebarStatsMock.mockResolvedValue({
      candidates: { total: 8, active: 4 },
      groups: { total: 2 },
      documents: { missingCount: 0 },
      mebJobs: { failed: 0, manualReview: 0 },
      payments: { dueToday: 0 },
    });

    renderSidebar("/");

    await waitFor(() => expect(screen.getByText("4")).toBeInTheDocument());

    const trainingMenu = screen.getByRole("button", { name: "Eğitim Planı" });

    expect(trainingMenu).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Teorik Eğitim" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Direksiyon Eğitim" })).not.toBeInTheDocument();

    fireEvent.click(trainingMenu);

    expect(trainingMenu).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Teorik Eğitim" })).toHaveClass("active");
    expect(screen.getByRole("link", { name: "Direksiyon Eğitim" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "E-Sınav" })).not.toBeInTheDocument();
  });

  it("closes the previous submenu when another parent menu is opened", async () => {
    getSidebarStatsMock.mockResolvedValue({
      candidates: { total: 8, active: 4 },
      groups: { total: 2 },
      documents: { missingCount: 0 },
      mebJobs: { failed: 0, manualReview: 0 },
      payments: { dueToday: 0 },
    });

    renderSidebar("/");

    await waitFor(() => expect(screen.getByText("4")).toBeInTheDocument());

    const trainingMenu = screen.getByRole("button", { name: "Eğitim Planı" });
    const examsMenu = screen.getByRole("button", { name: "Sınavlar" });

    fireEvent.click(trainingMenu);

    expect(trainingMenu).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Teorik Eğitim" })).toBeInTheDocument();

    fireEvent.click(examsMenu);

    expect(trainingMenu).toHaveAttribute("aria-expanded", "false");
    expect(examsMenu).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByRole("link", { name: "Teorik Eğitim" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "E-Sınav" })).toHaveClass("active");
  });

  it("renders exams submenu and highlights the active child route", async () => {
    getSidebarStatsMock.mockResolvedValue({
      candidates: { total: 8, active: 4 },
      groups: { total: 2 },
      documents: { missingCount: 0 },
      mebJobs: { failed: 0, manualReview: 0 },
      payments: { dueToday: 0 },
    });

    renderSidebar("/exams/e-sinav");

    await waitFor(() => expect(screen.getByText("4")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: "Sınavlar" })).toHaveClass("active");
    expect(screen.getByRole("link", { name: "E-Sınav" })).toHaveClass("active");
    expect(screen.getByRole("link", { name: "Direksiyon" })).toBeInTheDocument();
  });

  it("renders training submenu and highlights the active child route", async () => {
    getSidebarStatsMock.mockResolvedValue({
      candidates: { total: 8, active: 4 },
      groups: { total: 2 },
      documents: { missingCount: 0 },
      mebJobs: { failed: 0, manualReview: 0 },
      payments: { dueToday: 0 },
    });

    renderSidebar("/training/uygulama");

    await waitFor(() => expect(screen.getByText("4")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: "Eğitim Planı" })).toHaveClass("active");
    expect(screen.getByRole("link", { name: "Direksiyon Eğitim" })).toHaveClass("active");
    expect(screen.getByRole("link", { name: "Teorik Eğitim" })).toBeInTheDocument();
  });
});
