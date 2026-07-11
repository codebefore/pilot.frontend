import { fireEvent, screen, within } from "@testing-library/react";
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
    getPaymentsOverviewWithoutCandidatePhotos: (
      ...args: Parameters<typeof actual.getPaymentsOverviewWithoutCandidatePhotos>
    ) =>
      getPaymentsOverviewMock(...args),
    enrichPaymentsOverviewWithCandidatePhotos: vi.fn((response) => Promise.resolve(response)),
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

function renderBalancesPage() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/payments/balances"]}>
      <PaymentsPage mode="balances" />
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

function renderCollectionsPage() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/payments/collections"]}>
      <PaymentsPage mode="collections" />
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

function renderStatisticsPage() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/payments/statistics"]}>
      <PaymentsPage mode="statistics" />
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

function todayDateOnly() {
  const today = new Date();
  const month = `${today.getMonth() + 1}`.padStart(2, "0");
  const day = `${today.getDate()}`.padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function paymentCandidate(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "candidate-1",
    firstName: "Aday",
    lastName: "Bir",
    nationalId: "11111111111",
    licenseClass: "B",
    isDeleted: false,
    createdAtUtc: "2026-05-10T00:00:00Z",
    currentGroup: null,
    photo: null,
    ...overrides,
  };
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

    const inflowButton = document.querySelector<HTMLButtonElement>(".finance-cash-action--inflow");
    expect(inflowButton).not.toBeNull();
    const outflowButton = screen
      .getAllByRole("button", { name: "Çıkış" })
      .find((button) => button.classList.contains("finance-cash-action"));
    expect(outflowButton).not.toBeUndefined();
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

  it("shows remaining balance in the installments table", async () => {
    const today = todayDateOnly();
    const candidate = paymentCandidate({
      id: "candidate-installment",
      firstName: "Vadeli",
      lastName: "Aday",
    });

    getPaymentsOverviewMock.mockResolvedValue({
      ...paymentsOverview,
      installments: [
        {
          id: "installment-balance",
          candidate,
          type: "kurs",
          sequence: 1,
          dueDate: today,
          amount: 1000,
          paidAmount: 600,
          remainingAmount: 400,
          description: "Kurs vadesi",
          status: "active",
          paymentStatus: "partial",
          cancelledAtUtc: null,
          cancellationReason: null,
        },
      ],
    });

    renderBalancesPage();

    expect(await screen.findByRole("columnheader", { name: /Kalan/ })).toBeInTheDocument();
    const installmentRow = screen.getByRole("row", { name: /Vadeli Aday/ });
    expect(within(installmentRow).getByText("₺1.000")).toBeInTheDocument();
    expect(within(installmentRow).getByText("₺400")).toBeInTheDocument();
  });

  it("hides deleted candidate accounting rows from cash movements", async () => {
    const today = todayDateOnly();
    const activeCandidate = {
      id: "candidate-active",
      firstName: "Aktif",
      lastName: "Aday",
      nationalId: "11111111111",
      licenseClass: "B",
      isDeleted: false,
      currentGroup: null,
      photo: null,
    };
    const deletedCandidate = {
      ...activeCandidate,
      id: "candidate-deleted",
      firstName: "Silinen",
      isDeleted: true,
    };

    getPaymentsOverviewMock.mockResolvedValue({
      ...paymentsOverview,
      payments: [
        {
          id: "payment-active",
          candidate: activeCandidate,
          type: "kurs",
          installmentDescription: null,
          number: "TAH-1",
          cashRegisterId: "cash-1",
          cashRegister: paymentsOverview.cashRegisters[0],
          amount: 100,
          paymentMethod: "cash",
          paidAtUtc: `${today}T09:00:00Z`,
          note: "Aktif tahsilat",
          status: "active",
          cancelledAtUtc: null,
          cancellationReason: null,
        },
        {
          id: "payment-deleted",
          candidate: deletedCandidate,
          type: "kurs",
          installmentDescription: null,
          number: "TAH-2",
          cashRegisterId: "cash-1",
          cashRegister: paymentsOverview.cashRegisters[0],
          amount: 200,
          paymentMethod: "cash",
          paidAtUtc: `${today}T10:00:00Z`,
          note: "Silinen tahsilat",
          status: "active",
          cancelledAtUtc: null,
          cancellationReason: null,
        },
      ],
      refunds: [
        {
          id: "refund-deleted",
          paymentId: "payment-deleted",
          candidate: deletedCandidate,
          type: "kurs",
          number: "IAD-1",
          cashRegisterId: "cash-1",
          cashRegister: paymentsOverview.cashRegisters[0],
          amount: 50,
          refundedAtUtc: `${today}T11:00:00Z`,
          note: "Silinen iade",
        },
      ],
    });

    renderCashPage();

    expect(await screen.findByText("Aktif tahsilat")).toBeInTheDocument();
    expect(screen.queryByText("Silinen tahsilat")).not.toBeInTheDocument();
    expect(screen.queryByText("Silinen iade")).not.toBeInTheDocument();
  });

  it("shows cash movement time when available", async () => {
    const today = todayDateOnly();

    getPaymentsOverviewMock.mockResolvedValue({
      ...paymentsOverview,
      cashMovements: [
        {
          id: "cash-movement-1",
          type: "inflow",
          cashRegisterId: "cash-1",
          cashRegister: paymentsOverview.cashRegisters[0],
          amount: 300,
          occurredDate: today,
          occurredAtUtc: `${today}T09:15:00Z`,
          note: "Manuel kasa girişi",
          transferGroupId: null,
        },
      ],
    });

    renderCashPage();

    expect(await screen.findByText("Manuel kasa girişi")).toBeInTheDocument();
    expect(screen.getByText("12:15")).toBeInTheDocument();
  });

  it("does not show cancelled collections on the collections page", async () => {
    const today = todayDateOnly();
    const candidate = {
      id: "candidate-active",
      firstName: "Aktif",
      lastName: "Aday",
      nationalId: "11111111111",
      licenseClass: "B",
      isDeleted: false,
      currentGroup: null,
      photo: null,
    };

    getPaymentsOverviewMock.mockResolvedValue({
      ...paymentsOverview,
      payments: [
        {
          id: "payment-active",
          candidate,
          type: "kurs",
          installmentDescription: null,
          number: "TAH-1",
          cashRegisterId: "cash-1",
          cashRegister: paymentsOverview.cashRegisters[0],
          amount: 100,
          paymentMethod: "cash",
          paidAtUtc: `${today}T09:00:00Z`,
          note: "Aktif tahsilat",
          status: "active",
          cancelledAtUtc: null,
          cancellationReason: null,
        },
        {
          id: "payment-cancelled",
          candidate,
          type: "kurs",
          installmentDescription: null,
          number: "TAH-2",
          cashRegisterId: "cash-1",
          cashRegister: paymentsOverview.cashRegisters[0],
          amount: 200,
          paymentMethod: "cash",
          paidAtUtc: `${today}T10:00:00Z`,
          note: "Silinen tahsilat",
          status: "cancelled",
          cancelledAtUtc: `${today}T10:30:00Z`,
          cancellationReason: "Hatalı tahsilat",
        },
      ],
    });

    renderCollectionsPage();

    expect(await screen.findByText("Aktif tahsilat")).toBeInTheDocument();
    expect(screen.queryByText("Silinen tahsilat")).not.toBeInTheDocument();
    expect(screen.queryByText("Hatalı tahsilat")).not.toBeInTheDocument();
  });

  it("lists cancelled collections in the cancelled collections tab", async () => {
    const today = todayDateOnly();
    const candidate = {
      id: "candidate-cancelled",
      firstName: "Iptal",
      lastName: "Aday",
      nationalId: "11111111111",
      licenseClass: "B",
      isDeleted: false,
      currentGroup: null,
      photo: null,
    };

    getPaymentsOverviewMock.mockResolvedValue({
      ...paymentsOverview,
      payments: [
        {
          id: "payment-cancelled",
          candidate,
          type: "kurs",
          installmentDescription: null,
          number: "TAH-CANCEL",
          cashRegisterId: "cash-1",
          cashRegister: paymentsOverview.cashRegisters[0],
          amount: 250,
          paymentMethod: "cash",
          paidAtUtc: `${today}T09:00:00Z`,
          note: "İptal edilen tahsilat",
          status: "cancelled",
          cancelledAtUtc: `${today}T10:30:00Z`,
          cancellationReason: "Yanlış tahsilat",
          cancelledByUserId: "user-cancelled-payment",
          cancelledByName: "Ayse Yilmaz",
        },
      ],
    });

    renderCollectionsPage();

    fireEvent.click(await screen.findByRole("tab", { name: "İptal" }));

    const cancelledRow = await screen.findByRole("row", { name: /Iptal Aday/ });
    expect(within(cancelledRow).getByText("TAH-CANCEL")).toBeInTheDocument();
    expect(within(cancelledRow).getByText("Yanlış tahsilat")).toBeInTheDocument();
    expect(within(cancelledRow).queryByText("Ayse Yilmaz")).not.toBeInTheDocument();
    expect(within(cancelledRow).getByText("₺250")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Kolonlar" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Yetkili" }));

    expect(within(cancelledRow).getByText("Ayse Yilmaz")).toBeInTheDocument();
    const table = cancelledRow.closest("table");
    expect(table).not.toBeNull();
    const headerLabels = within(table as HTMLTableElement)
      .getAllByRole("columnheader")
      .map((header) => header.textContent ?? "");
    expect(headerLabels[headerLabels.length - 2]).toContain("Yetkili");
  });

  it("keeps operator as the rightmost data column in deleted debts", async () => {
    const today = todayDateOnly();
    const candidate = paymentCandidate({
      id: "candidate-cancelled-debt",
      firstName: "Silinen",
      lastName: "Borc",
    });

    getPaymentsOverviewMock.mockResolvedValue({
      ...paymentsOverview,
      installments: [
        {
          id: "installment-cancelled",
          candidate,
          type: "kurs",
          sequence: 1,
          dueDate: today,
          amount: 750,
          paidAmount: 0,
          remainingAmount: 750,
          description: "Silinen kurs borcu",
          status: "cancelled",
          paymentStatus: "cancelled",
          cancelledAtUtc: `${today}T12:00:00Z`,
          cancellationReason: "Hatalı borç",
          cancelledByUserId: "user-cancelled-debt",
          cancelledByName: "Mehmet Demir",
        },
      ],
    });

    renderBalancesPage();

    fireEvent.click(await screen.findByRole("tab", { name: "Silinen Borçlar" }));

    const cancelledDebtRow = await screen.findByRole("row", { name: /Silinen Borc/ });
    expect(within(cancelledDebtRow).queryByText("Mehmet Demir")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Kolonlar" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Yetkili" }));

    expect(within(cancelledDebtRow).getByText("Mehmet Demir")).toBeInTheDocument();
    const table = cancelledDebtRow.closest("table");
    expect(table).not.toBeNull();
    const headerLabels = within(table as HTMLTableElement)
      .getAllByRole("columnheader")
      .map((header) => header.textContent ?? "");
    expect(headerLabels[headerLabels.length - 2]).toContain("Yetkili");
  });

  it("shows operator for refunds in the refunds tab", async () => {
    const today = todayDateOnly();
    const candidate = paymentCandidate({
      id: "candidate-refund-operator",
      firstName: "Iade",
      lastName: "Aday",
    });

    getPaymentsOverviewMock.mockResolvedValue({
      ...paymentsOverview,
      refunds: [
        {
          id: "refund-operator",
          paymentId: "payment-operator",
          candidate,
          type: "kurs",
          number: null,
          cashRegisterId: "cash-1",
          cashRegister: paymentsOverview.cashRegisters[0],
          amount: 150,
          refundedAtUtc: `${today}T11:00:00Z`,
          note: "İade işlemi",
          createdByUserId: "user-refund",
          createdByName: "Zeynep Kaya",
        },
      ],
    });

    renderCollectionsPage();

    fireEvent.click(await screen.findByRole("tab", { name: "İade" }));

    const refundRow = await screen.findByRole("row", { name: /Iade Aday/ });
    expect(within(refundRow).queryByText("Zeynep Kaya")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Kolonlar" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Yetkili" }));

    expect(within(refundRow).getByText("Zeynep Kaya")).toBeInTheDocument();
    const table = refundRow.closest("table");
    expect(table).not.toBeNull();
    const headerLabels = within(table as HTMLTableElement)
      .getAllByRole("columnheader")
      .map((header) => header.textContent ?? "");
    expect(headerLabels[headerLabels.length - 2]).toContain("Yetkili");
  });

  it("keeps refunded collections in the collections matrix as gross collections", async () => {
    const today = todayDateOnly();
    const candidate = paymentCandidate({
      id: "candidate-refunded-collection",
      firstName: "Iadeli",
      lastName: "Tahsilat",
    });

    getPaymentsOverviewMock.mockResolvedValue({
      ...paymentsOverview,
      payments: [
        {
          id: "payment-refunded",
          candidate,
          type: "kurs",
          installmentDescription: null,
          number: "TAH-1",
          cashRegisterId: "cash-1",
          cashRegister: paymentsOverview.cashRegisters[0],
          amount: 1000,
          paymentMethod: "cash",
          paidAtUtc: `${today}T09:00:00Z`,
          note: "İade edilen tahsilat",
          status: "active",
          cancelledAtUtc: null,
          cancellationReason: null,
        },
      ],
      refunds: [
        {
          id: "refund-refunded",
          paymentId: "payment-refunded",
          candidate,
          type: "kurs",
          number: "IAD-1",
          cashRegisterId: "cash-1",
          cashRegister: paymentsOverview.cashRegisters[0],
          amount: 1000,
          refundedAtUtc: `${today}T10:00:00Z`,
          note: "Tam iade",
        },
      ],
    });

    renderCollectionsPage();

    expect(await screen.findByRole("heading", { name: "Tahsilat Matrisi" })).toBeInTheDocument();
    const courseRow = screen.getAllByRole("row", { name: /Kurs Ücreti/ })[0];
    expect(within(courseRow).getAllByText("₺1.000").length).toBeGreaterThan(0);
  });

  it("shows zero-debt candidates in balances by candidate registration date filters", async () => {
    const zeroDebtCandidate = paymentCandidate({
      id: "candidate-zero-debt",
      firstName: "Sifir",
      lastName: "Bakiye",
      createdAtUtc: "2026-05-10T00:00:00Z",
    });
    const outsideCandidate = paymentCandidate({
      id: "candidate-outside-balance",
      firstName: "Dis",
      lastName: "Bakiye",
      createdAtUtc: "2026-04-10T00:00:00Z",
    });

    getPaymentsOverviewMock.mockResolvedValue({
      ...paymentsOverview,
      candidates: [zeroDebtCandidate, outsideCandidate],
      installments: [
        {
          id: "installment-zero-debt",
          candidate: zeroDebtCandidate,
          type: "kurs",
          sequence: 1,
          dueDate: "2026-04-15",
          amount: 1000,
          paidAmount: 1000,
          remainingAmount: 0,
          description: "Kurs",
          status: "active",
          paymentStatus: "paid",
          cancelledAtUtc: null,
          cancellationReason: null,
        },
      ],
    });

    renderBalancesPage();

    expect(await screen.findByRole("heading", { name: "Bakiyeler" })).toBeInTheDocument();
    fireEvent.click(await screen.findByText("Bakiyeler", { selector: "button" }));
    fireEvent.change(await screen.findByPlaceholderText("Başlangıç"), {
      target: { value: "01.05.2026" },
    });
    fireEvent.change(await screen.findByPlaceholderText("Bitiş"), {
      target: { value: "31.05.2026" },
    });

    const zeroDebtRow = await screen.findByRole("row", { name: /Sifir Bakiye/ });
    expect(within(zeroDebtRow).getAllByText("₺0").length).toBeGreaterThan(0);
    expect(screen.queryByText("Dis Bakiye")).not.toBeInTheDocument();
  });

  it("filters statistics by candidate registration date and includes candidates without finance rows", async () => {
    const noFinanceCandidate = paymentCandidate({
      id: "candidate-no-finance",
      firstName: "Bos",
      lastName: "Aday",
      createdAtUtc: "2026-05-10T00:00:00Z",
    });
    const financeCandidate = paymentCandidate({
      id: "candidate-finance",
      firstName: "Finansli",
      lastName: "Aday",
      createdAtUtc: "2026-05-15T00:00:00Z",
    });
    const outsideCandidate = paymentCandidate({
      id: "candidate-outside",
      firstName: "Dis",
      lastName: "Aday",
      licenseClass: "C",
      createdAtUtc: "2026-04-20T00:00:00Z",
    });

    getPaymentsOverviewMock.mockResolvedValue({
      ...paymentsOverview,
      candidates: [noFinanceCandidate, financeCandidate, outsideCandidate],
      installments: [
        {
          id: "installment-finance",
          candidate: financeCandidate,
          type: "kurs",
          sequence: 1,
          dueDate: "2026-01-15",
          amount: 100,
          paidAmount: 50,
          remainingAmount: 50,
          description: "Kurs",
          status: "active",
          paymentStatus: "partial",
          cancelledAtUtc: null,
          cancellationReason: null,
        },
        {
          id: "installment-finance-exam",
          candidate: financeCandidate,
          type: "teorik_sinav",
          sequence: 2,
          dueDate: "2026-01-20",
          amount: 40,
          paidAmount: 20,
          remainingAmount: 20,
          description: "E-Sınav",
          status: "active",
          paymentStatus: "partial",
          cancelledAtUtc: null,
          cancellationReason: null,
        },
        {
          id: "installment-outside",
          candidate: outsideCandidate,
          type: "kurs",
          sequence: 1,
          dueDate: "2026-05-15",
          amount: 300,
          paidAmount: 300,
          remainingAmount: 0,
          description: "Kurs",
          status: "active",
          paymentStatus: "paid",
          cancelledAtUtc: null,
          cancellationReason: null,
        },
      ],
      payments: [
        {
          id: "payment-finance",
          candidate: financeCandidate,
          type: "kurs",
          installmentDescription: null,
          number: "TAH-1",
          cashRegisterId: "cash-1",
          cashRegister: paymentsOverview.cashRegisters[0],
          amount: 50,
          paymentMethod: "cash",
          paidAtUtc: "2026-04-01T09:00:00Z",
          note: null,
          status: "active",
          cancelledAtUtc: null,
          cancellationReason: null,
        },
        {
          id: "payment-finance-exam",
          candidate: financeCandidate,
          type: "teorik_sinav",
          installmentDescription: null,
          number: "TAH-EXAM",
          cashRegisterId: "cash-1",
          cashRegister: paymentsOverview.cashRegisters[0],
          amount: 20,
          paymentMethod: "cash",
          paidAtUtc: "2026-04-02T09:00:00Z",
          note: null,
          status: "active",
          cancelledAtUtc: null,
          cancellationReason: null,
        },
        {
          id: "payment-outside",
          candidate: outsideCandidate,
          type: "kurs",
          installmentDescription: null,
          number: "TAH-2",
          cashRegisterId: "cash-1",
          cashRegister: paymentsOverview.cashRegisters[0],
          amount: 300,
          paymentMethod: "cash",
          paidAtUtc: "2026-05-15T09:00:00Z",
          note: null,
          status: "active",
          cancelledAtUtc: null,
          cancellationReason: null,
        },
      ],
      refunds: [
        {
          id: "refund-finance",
          paymentId: "payment-finance",
          candidate: financeCandidate,
          type: "kurs",
          number: "IAD-1",
          cashRegisterId: "cash-1",
          cashRegister: paymentsOverview.cashRegisters[0],
          amount: 15,
          refundedAtUtc: "2026-06-01T09:00:00Z",
          note: null,
        },
      ],
    });

    renderStatisticsPage();

    expect(await screen.findByRole("heading", { name: "İstatistik" })).toBeInTheDocument();
    fireEvent.change(await screen.findByPlaceholderText("Kayıt başlangıç tarihi"), {
      target: { value: "01.05.2026" },
    });
    fireEvent.change(await screen.findByPlaceholderText("Kayıt bitiş tarihi"), {
      target: { value: "31.05.2026" },
    });

    const rows = screen.getAllByRole("row");
    const licenseBRow = rows.find((row) => within(row).queryByText("B"));
    expect(licenseBRow).toBeDefined();
    const cells = within(licenseBRow!).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("2");
    expect(cells[1]).toHaveTextContent("₺100");
    expect(cells[2]).toHaveTextContent("₺50");
    expect(cells[3]).toHaveTextContent("₺35");
    expect(cells[4]).toHaveTextContent("35%");
    expect(screen.queryByText("C")).not.toBeInTheDocument();
  });

  it("keeps statistics month and registration date filters mutually exclusive", async () => {
    getPaymentsOverviewMock.mockResolvedValue({
      ...paymentsOverview,
      candidates: [
        paymentCandidate({
          currentGroup: {
            groupId: "group-1",
            title: "Mayıs",
            startDate: "2026-05-20",
            term: { id: "term-1", name: "Mayıs 2026", monthDate: "2026-05-01" },
            assignedAtUtc: "2026-05-10T08:00:00Z",
          },
        }),
      ],
    });

    renderStatisticsPage();

    expect(await screen.findByRole("heading", { name: "İstatistik" })).toBeInTheDocument();
    const monthInput = await screen.findByPlaceholderText("Dönem") as HTMLInputElement;
    const startInput = await screen.findByPlaceholderText("Kayıt başlangıç tarihi") as HTMLInputElement;

    fireEvent.change(monthInput, { target: { value: "05.2026" } });
    fireEvent.blur(monthInput);
    expect(monthInput.value).toContain("Mayıs");

    fireEvent.change(startInput, { target: { value: "01.05.2026" } });
    fireEvent.blur(startInput);
    expect(startInput.value).toBe("01.05.2026");
    expect(monthInput.value).toBe("");

    fireEvent.change(monthInput, { target: { value: "05.2026" } });
    fireEvent.blur(monthInput);
    expect(monthInput.value).toContain("Mayıs");
    expect(startInput.value).toBe("");
  });

  it("filters statistics month by candidate current group and includes candidates without finance rows", async () => {
    getPaymentsOverviewMock.mockResolvedValue({
      ...paymentsOverview,
      candidates: [
        paymentCandidate({
          id: "candidate-may-no-finance",
          currentGroup: {
            groupId: "group-may",
            title: "Mayıs",
            startDate: "2026-05-20",
            term: { id: "term-may", name: "Mayıs 2026", monthDate: "2026-05-01", sequence: 1 },
            assignedAtUtc: "2026-05-10T08:00:00Z",
          },
        }),
        paymentCandidate({
          id: "candidate-june",
          licenseClass: "C",
          currentGroup: {
            groupId: "group-june",
            title: "Haziran",
            startDate: "2026-06-20",
            term: { id: "term-june", name: "Haziran 2026", monthDate: "2026-06-01", sequence: 1 },
            assignedAtUtc: "2026-06-10T08:00:00Z",
          },
        }),
      ],
      installments: [],
      payments: [],
      refunds: [],
    });

    renderStatisticsPage();

    expect(await screen.findByRole("heading", { name: "İstatistik" })).toBeInTheDocument();
    const monthInput = await screen.findByPlaceholderText("Dönem") as HTMLInputElement;
    fireEvent.change(monthInput, { target: { value: "05.2026" } });
    fireEvent.blur(monthInput);

    const rows = screen.getAllByRole("row");
    const licenseBRow = rows.find((row) => within(row).queryByText("B"));
    expect(licenseBRow?.textContent).toContain("1");
    expect(licenseBRow?.textContent).toContain("0");
    expect(screen.queryByText("C")).not.toBeInTheDocument();
  });

  it("keeps overview candidate scope fields when finance rows carry partial candidates", async () => {
    const scopedCandidate = paymentCandidate({
      id: "candidate-scoped",
      currentGroup: {
        groupId: "group-may",
        title: "Mayıs",
        startDate: "2026-05-20",
        term: { id: "term-may", name: "Mayıs 2026", monthDate: "2026-05-01", sequence: 1 },
        assignedAtUtc: "2026-05-10T08:00:00Z",
      },
    });
    const partialMovementCandidate = paymentCandidate({
      id: "candidate-scoped",
      currentGroup: null,
      createdAtUtc: undefined,
    });
    getPaymentsOverviewMock.mockResolvedValue({
      ...paymentsOverview,
      candidates: [scopedCandidate],
      installments: [
        {
          id: "installment-scoped",
          candidate: partialMovementCandidate,
          type: "kurs",
          sequence: 1,
          dueDate: "2026-01-15",
          amount: 100,
          paidAmount: 0,
          remainingAmount: 100,
          description: "Kurs",
          status: "active",
          paymentStatus: "unpaid",
          cancelledAtUtc: null,
          cancellationReason: null,
        },
      ],
      payments: [],
      refunds: [],
    });

    renderStatisticsPage();

    expect(await screen.findByRole("heading", { name: "İstatistik" })).toBeInTheDocument();
    const monthInput = await screen.findByPlaceholderText("Dönem") as HTMLInputElement;
    fireEvent.change(monthInput, { target: { value: "05.2026" } });
    fireEvent.blur(monthInput);

    const rows = screen.getAllByRole("row");
    const licenseBRow = rows.find((row) => within(row).queryByText("B"));
    expect(licenseBRow?.textContent).toContain("1");
    expect(licenseBRow?.textContent).toContain("100");
  });
});
