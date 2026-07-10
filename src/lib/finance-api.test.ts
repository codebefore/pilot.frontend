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
  updateLicenseClassFeeMatrix,
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

  it("enriches payments overview candidates with biometric document photos", async () => {
    applyRuntimeConfig({
      financeApiBaseUrl: "http://127.0.0.1:5093",
      documentApiBaseUrl: "http://127.0.0.1:5092",
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            summary: {},
            payments: [
              {
                id: "payment-1",
                candidate: {
                  id: "candidate-1",
                  firstName: "Ayse",
                  lastName: "Yilmaz",
                  licenseClass: "B",
                  currentGroup: null,
                  photo: null,
                },
              },
            ],
            refunds: [],
            invoices: [],
            installments: [],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                candidateId: "candidate-1",
                summary: { completedCount: 1, missingCount: 0, totalRequiredCount: 1 },
                photo: { documentId: "document-1", kind: "biometric_photo" },
              },
            ],
            page: 1,
            pageSize: 1,
            totalCount: 1,
            totalPages: 1,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );

    const result = await getPaymentsOverview({ fromDate: "2026-06-01" });

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      "http://127.0.0.1:5093/api/finance/payments/overview?fromDate=2026-06-01"
    );
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe(
      "http://127.0.0.1:5092/api/documents/candidate-checklist?candidateIds=candidate-1&page=1&pageSize=1"
    );
    expect(result.payments[0].candidate.photo).toEqual({
      documentId: "document-1",
      kind: "biometric_photo",
    });
  });

  it("does not request document checklist for overview-only statistics candidates", async () => {
    applyRuntimeConfig({
      financeApiBaseUrl: "http://127.0.0.1:5093",
      documentApiBaseUrl: "http://127.0.0.1:5092",
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          summary: {},
          candidates: [
            {
              id: "candidate-stat-only",
              firstName: "Stats",
              lastName: "Only",
              licenseClass: "B",
              currentGroup: null,
              photo: null,
            },
          ],
          payments: [],
          refunds: [],
          invoices: [],
          installments: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    const result = await getPaymentsOverview({ fromDate: "2026-06-01" });

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(result.candidates?.[0].id).toBe("candidate-stat-only");
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

    await getLicenseClassFeeMatrix(2026, {
      targetLicenseClass: "B",
      licenseClassDefinitionId: "11111111-1111-1111-1111-111111111111",
    });
    await updateLicenseClassFeeMatrix(2026, { rows: [], programs: [] }, {
      licenseClassDefinitionId: "11111111-1111-1111-1111-111111111111",
    });
    await bulkApplyLicenseClassFeeMatrix(2026, {
      field: "vatIncludedHourlyRate",
      value: 500,
    });

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      "http://127.0.0.1:5093/api/finance/license-class-fee-matrix/2026?targetLicenseClass=B&licenseClassDefinitionId=11111111-1111-1111-1111-111111111111"
    );
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe(
      "http://127.0.0.1:5093/api/finance/license-class-fee-matrix/2026?licenseClassDefinitionId=11111111-1111-1111-1111-111111111111"
    );
    expect(String(vi.mocked(fetch).mock.calls[2][0])).toBe(
      "http://127.0.0.1:5093/api/finance/license-class-fee-matrix/2026/bulk-apply"
    );
  });
});
