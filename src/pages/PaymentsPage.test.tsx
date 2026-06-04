import { fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../test/render-with-providers";
import { PaymentsPage } from "./PaymentsPage";

const getPaymentsOverviewMock = vi.fn();
const createCashInflowMock = vi.fn();
const createCashOutflowMock = vi.fn();
const createCashTransferMock = vi.fn();

vi.mock("../lib/payments-api", async () => {
  const actual = await vi.importActual<typeof import("../lib/payments-api")>(
    "../lib/payments-api"
  );

  return {
    ...actual,
    getPaymentsOverview: (...args: Parameters<typeof actual.getPaymentsOverview>) =>
      getPaymentsOverviewMock(...args),
    createCashInflow: (...args: Parameters<typeof actual.createCashInflow>) =>
      createCashInflowMock(...args),
    createCashOutflow: (...args: Parameters<typeof actual.createCashOutflow>) =>
      createCashOutflowMock(...args),
    createCashTransfer: (...args: Parameters<typeof actual.createCashTransfer>) =>
      createCashTransferMock(...args),
  };
});

vi.mock("../lib/use-license-class-options", () => ({
  useLicenseClassOptions: () => ({ loading: false, options: [] }),
}));

const paymentsOverview = {
  summary: {
    todayCollected: 0,
    monthCollected: 0,
    activeBalance: 0,
    overdueInstallmentTotal: 0,
    cancelledPaymentTotal: 0,
  },
  cashRegisters: [
    {
      id: "cash-1",
      name: "Ana Kasa",
      type: "cash",
      balance: 1000,
      lastMovementDate: "2026-05-30",
    },
    {
      id: "cash-2",
      name: "Banka",
      type: "bank_transfer",
      balance: 500,
      lastMovementDate: "2026-05-30",
    },
  ],
  payments: [],
  refunds: [],
  cashMovements: [],
  invoices: [],
  installments: [],
};

function renderCashPage() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/payments/cash"]}>
      <PaymentsPage mode="cash" />
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

function renderFinancePage() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/payments"]}>
      <PaymentsPage />
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

describe("PaymentsPage permissions", () => {
  beforeEach(() => {
    getPaymentsOverviewMock.mockReset();
    createCashInflowMock.mockReset();
    createCashOutflowMock.mockReset();
    createCashTransferMock.mockReset();

    getPaymentsOverviewMock.mockResolvedValue(paymentsOverview);
  });

  it("shows cash page to view-only users but disables cash mutation actions", async () => {
    renderCashPage();

    expect(await screen.findByText("Kasa Özeti")).toBeInTheDocument();

    const inflowButton = screen.getByRole("button", { name: "Giriş" });
    const outflowButton = screen.getByRole("button", { name: "Çıkış" });
    const transferButton = screen.getByRole("button", { name: "Transfer" });

    for (const button of [inflowButton, outflowButton, transferButton]) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("title", "Yetkiniz yok.");
      fireEvent.click(button);
    }

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(createCashInflowMock).not.toHaveBeenCalled();
    expect(createCashOutflowMock).not.toHaveBeenCalled();
    expect(createCashTransferMock).not.toHaveBeenCalled();
  });

  it("renders when overview omits optional list fields", async () => {
    getPaymentsOverviewMock.mockResolvedValue({
      summary: paymentsOverview.summary,
    });

    renderFinancePage();

    expect(await screen.findByRole("heading", { name: "Finans" })).toBeInTheDocument();
  });
});
