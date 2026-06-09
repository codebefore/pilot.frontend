import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { AuthInstitution } from "../../lib/auth-storage";
import { renderWithProviders } from "../../test/render-with-providers";
import { Header } from "./Header";

vi.mock("../../lib/notifications-api", () => ({
  getNotifications: vi.fn().mockResolvedValue({ items: [] }),
}));

const institutions: AuthInstitution[] = [
  {
    id: "i1",
    name: "Pilot Sürücü Kursu",
    roleName: "Kurum Yöneticisi",
    isDefault: true,
    permissions: { dashboard: "view", candidates: "view" },
  },
  {
    id: "i2",
    name: "İkinci Kurum",
    roleName: "Personel",
    isDefault: false,
    permissions: { candidates: "view" },
  },
];

describe("Header tenant selector", () => {
  it("renders session institutions and calls select handler when changed", async () => {
    const onInstitutionChange = vi.fn().mockResolvedValue(undefined);

    renderWithProviders(
      <MemoryRouter>
        <Header
          activeInstitutionId="i1"
          institutions={institutions}
          onInstitutionChange={onInstitutionChange}
          onMenuToggle={() => {}}
          onSidebarToggle={() => {}}
          sidebarCollapsed={false}
          userInitials="TU"
        />
      </MemoryRouter>,
      {
        auth: {
          institutions,
          activeInstitution: institutions[0],
          selectInstitution: onInstitutionChange,
        },
      }
    );

    fireEvent.click(screen.getByRole("button", { name: "Pilot Sürücü Kursu" }));
    fireEvent.click(screen.getByRole("button", { name: /İkinci Kurum.*Personel/i }));

    await waitFor(() => expect(onInstitutionChange).toHaveBeenCalledWith("i2"));
  });
});
