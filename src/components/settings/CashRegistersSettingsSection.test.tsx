import { fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/render-with-providers";
import { CashRegistersSettingsSection } from "./CashRegistersSettingsSection";

const getCashRegistersMock = vi.fn();
const createCashRegisterMock = vi.fn();
const updateCashRegisterMock = vi.fn();
const deleteCashRegisterMock = vi.fn();

vi.mock("../../lib/cash-registers-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/cash-registers-api")>(
    "../../lib/cash-registers-api"
  );

  return {
    ...actual,
    getCashRegisters: (...args: Parameters<typeof actual.getCashRegisters>) =>
      getCashRegistersMock(...args),
    createCashRegister: (...args: Parameters<typeof actual.createCashRegister>) =>
      createCashRegisterMock(...args),
    updateCashRegister: (...args: Parameters<typeof actual.updateCashRegister>) =>
      updateCashRegisterMock(...args),
    deleteCashRegister: (...args: Parameters<typeof actual.deleteCashRegister>) =>
      deleteCashRegisterMock(...args),
  };
});

const sampleRegister = {
  id: "cash-1",
  name: "Ana Kasa",
  type: "cash" as const,
  isActive: true,
  notes: null,
  createdAtUtc: "2026-05-30T10:00:00Z",
  updatedAtUtc: "2026-05-30T10:00:00Z",
  rowVersion: 1,
};

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/settings/definitions/cash-registers"]}>
      <CashRegistersSettingsSection />
    </MemoryRouter>,
    {
      auth: {
        user: {
          id: "payments-viewer",
          phone: "5073737262",
          name: "Finans Viewer",
          roleName: "Finans",
          isSuperAdmin: false,
        },
        permissions: { payments: "view" },
      },
    }
  );
}

describe("CashRegistersSettingsSection permissions", () => {
  beforeEach(() => {
    localStorage.clear();
    getCashRegistersMock.mockReset();
    createCashRegisterMock.mockReset();
    updateCashRegisterMock.mockReset();
    deleteCashRegisterMock.mockReset();

    getCashRegistersMock.mockResolvedValue({
      items: [sampleRegister],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
      summary: {
        activeCount: 1,
        inactiveCount: 0,
      },
    });
  });

  it("shows registers to view-only users but disables mutating actions", async () => {
    renderSection();

    expect(await screen.findByText("Ana Kasa")).toBeInTheDocument();

    const newButton = screen.getByRole("button", { name: /Yeni Kasa/ });
    const editButton = screen.getByRole("button", { name: "Düzenle" });
    const deleteButton = screen.getByRole("button", { name: "Sil" });

    for (const button of [newButton, editButton, deleteButton]) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("title", "Yetkiniz yok.");
      fireEvent.click(button);
    }

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(deleteCashRegisterMock).not.toHaveBeenCalled();
    expect(createCashRegisterMock).not.toHaveBeenCalled();
    expect(updateCashRegisterMock).not.toHaveBeenCalled();
  });
});
