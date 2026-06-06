import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyRuntimeConfig } from "./api";
import {
  cancelCandidateAccountingMovement,
  createCandidateAccountingInvoice,
  createCandidateAccountingPayment,
  getCandidateAccounting,
} from "./candidate-accounting-api";
import {
  bulkApplyLicenseClassFeeMatrix,
  getLicenseClassFeeMatrix,
} from "./license-class-fee-matrix-api";
import { createCashRegister, getCashRegisters } from "./cash-registers-api";
import { createCashInflow, getPaymentsOverview } from "./payments-api";

describe("finance api routing", () => {
  beforeEach(() => {
    applyRuntimeConfig(undefined);
    vi.restoreAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({}), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      )
    );
  });

  it("routes candidate accounting calls to the runtime finance base url", async () => {
    applyRuntimeConfig({ financeApiBaseUrl: "http://127.0.0.1:5093" });

    await getCandidateAccounting("candidate-1");
    await createCandidateAccountingPayment("candidate-1", {
      type: "kurs",
      paymentMethod: "cash",
      cashRegisterId: "cash-1",
      amount: 100,
    });
    await createCandidateAccountingInvoice("candidate-1", {
      invoiceNo: "INV-1",
      invoiceType: "sale",
      invoiceDate: "2026-06-01",
      subtotal: 100,
      vatRate: 20,
    });
    await cancelCandidateAccountingMovement("candidate-1", "movement-1", "Hatalı borç");

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      "http://127.0.0.1:5093/api/finance/candidates/candidate-1/summary"
    );
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe(
      "http://127.0.0.1:5093/api/finance/candidates/candidate-1/accounting/payments"
    );
    expect(String(vi.mocked(fetch).mock.calls[2][0])).toBe(
      "http://127.0.0.1:5093/api/finance/candidates/candidate-1/accounting/invoices"
    );
    expect(String(vi.mocked(fetch).mock.calls[3][0])).toBe(
      "http://127.0.0.1:5093/api/finance/candidates/candidate-1/accounting/debts/movement-1?cancellationReason=Hatal%C4%B1+bor%C3%A7"
    );
  });

  it("routes payments overview and cash movement calls to the runtime finance base url", async () => {
    applyRuntimeConfig({ financeApiBaseUrl: "http://127.0.0.1:5093" });

    await getPaymentsOverview({ fromDate: "2026-06-01", toDate: "2026-06-30" });
    await createCashInflow({
      cashRegisterId: "cash-1",
      amount: 250,
      occurredDate: "2026-06-01",
      note: "Açılış",
    });

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      "http://127.0.0.1:5093/api/finance/payments/overview?fromDate=2026-06-01&toDate=2026-06-30"
    );
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe(
      "http://127.0.0.1:5093/api/finance/cash-register-movements"
    );
  });

  it("routes cash register calls to the runtime finance base url", async () => {
    applyRuntimeConfig({ financeApiBaseUrl: "http://127.0.0.1:5093" });

    await getCashRegisters({ activity: "active", page: 2, pageSize: 20 });
    await createCashRegister({ name: "Merkez Kasa", type: "cash", isActive: true });

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      "http://127.0.0.1:5093/api/finance/cash-registers?activity=active&page=2&pageSize=20"
    );
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe(
      "http://127.0.0.1:5093/api/finance/cash-registers"
    );
  });

  it("routes fee matrix calls to the runtime finance base url", async () => {
    applyRuntimeConfig({ financeApiBaseUrl: "http://127.0.0.1:5093" });

    await getLicenseClassFeeMatrix(2026, { targetLicenseClass: "B" });
    await bulkApplyLicenseClassFeeMatrix(2026, {
      field: "vatIncludedHourlyRate",
      value: 500,
    });

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      "http://127.0.0.1:5093/api/finance/license-class-fee-matrix/2026?targetLicenseClass=B"
    );
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe(
      "http://127.0.0.1:5093/api/finance/license-class-fee-matrix/2026/bulk-apply"
    );
  });
});
