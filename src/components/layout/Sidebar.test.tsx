import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { Sidebar } from "./Sidebar";
import type { AuthInstitution, AuthUser } from "../../lib/auth-storage";
import { renderWithProviders } from "../../test/render-with-providers";

const institutions: AuthInstitution[] = [
  {
    id: "i1",
    name: "Pilot Sürücü Kursu",
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
    roleName: "Personel",
    isDefault: false,
    permissions: { dashboard: "view", candidates: "view" },
  },
];

const regularUser: AuthUser = {
  id: "regular-user",
  phone: "5551112233",
  name: "Regular User",
  roleName: "Kurum Yöneticisi",
  isSuperAdmin: false,
};

const superAdminUser: AuthUser = {
  id: "super-admin",
  phone: "5551112233",
  name: "Super Admin",
  roleName: "super_admin",
  isSuperAdmin: true,
};

function renderSidebar(
  path = "/",
  onInstitutionChange = async () => {},
  user: AuthUser = regularUser
) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar
        activeInstitutionId="i1"
        institutions={institutions}
        onClose={() => {}}
        onInstitutionChange={onInstitutionChange}
        open
      />
    </MemoryRouter>,
    {
      auth: {
        user,
        institutions,
        activeInstitution: institutions[0],
        permissions: institutions[0].permissions,
        selectInstitution: onInstitutionChange,
      },
    }
  );
}

describe("Sidebar", () => {
  it("renders nav links without count badges", () => {
    renderSidebar();

    expect(screen.getByRole("link", { name: "Adaylar" })).toBeInTheDocument();
    expect(document.querySelector(".sidebar-badge")).not.toBeInTheDocument();
  });

  it("renders tenant navigation in workflow order", () => {
    renderSidebar();

    const labels = Array.from(document.querySelectorAll(".sidebar-link")).map((item) =>
      item.textContent?.trim()
    );

    expect(labels).toEqual([
      "Kokpit",
      "Adaylar",
      "Evrak Kontrol",
      "Dönemler",
      "Sınavlar",
      "Eğitim Planı",
      "Finans",
      "Meb Sync",
      "Kurum Ayarları",
    ]);
  });

  it("uses session institutions for tenant switching", async () => {
    const onInstitutionChange = vi.fn().mockResolvedValue(undefined);

    renderSidebar("/", onInstitutionChange);

    fireEvent.click(screen.getByRole("button", { name: "Pilot Sürücü Kursu" }));
    fireEvent.click(screen.getByRole("button", { name: /İkinci Kurum.*Personel/i }));

    await waitFor(() => expect(onInstitutionChange).toHaveBeenCalledWith("i2"));
  });

  it("hides the super admin section for regular users", () => {
    renderSidebar("/");

    expect(screen.queryByText("Süper Admin")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Kurumlar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Outbox" })).not.toBeInTheDocument();
  });

  it("groups super admin-only links under the super admin section", () => {
    renderSidebar("/", async () => {}, superAdminUser);

    expect(screen.getByText("Süper Admin")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Kurumlar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Outbox" })).toBeInTheDocument();
  });

  it("keeps submenus collapsed by default and activates the first child when parent is clicked", () => {
    renderSidebar("/");

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

  it("closes the previous submenu when another parent menu is opened", () => {
    renderSidebar("/");

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

  it("renders exams submenu and highlights the active child route", () => {
    renderSidebar("/exams/e-sinav");

    expect(screen.getByRole("button", { name: "Sınavlar" })).toHaveClass("active");
    expect(screen.getByRole("link", { name: "E-Sınav" })).toHaveClass("active");
    expect(screen.getByRole("link", { name: "Direksiyon" })).toBeInTheDocument();
  });

  it("renders training submenu and highlights the active child route", () => {
    renderSidebar("/training/uygulama");

    expect(screen.getByRole("button", { name: "Eğitim Planı" })).toHaveClass("active");
    expect(screen.getByRole("link", { name: "Direksiyon Eğitim" })).toHaveClass("active");
    expect(screen.getByRole("link", { name: "Teorik Eğitim" })).toBeInTheDocument();
  });
});
