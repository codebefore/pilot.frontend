import { describe, expect, it, vi } from "vitest";

import {
  buildCandidateContractPrintHtml,
  printCandidateContractHtml,
} from "./candidate-contract-print";
import type {
  CandidateAccountingSummaryResponse,
  CandidateResponse,
  LicenseClassFeeRowResponse,
} from "./types";
import type { InstitutionSettingsResponse } from "./institution-settings-api";

const candidate = {
  id: "candidate-1",
  firstName: "Ayşe",
  lastName: "Yılmaz",
  nationalId: "12345678901",
  phoneNumber: "5551112233",
  address: "Aday adresi",
  licenseClass: "B",
  hasExistingLicense: false,
  existingLicenseType: null,
} as CandidateResponse;

const accounting = {
  candidateId: "candidate-1",
  movements: [
    {
      id: "movement-1",
      candidateId: "candidate-1",
      type: "kurs",
      number: "BRC-1",
      description: "Kurs",
      dueDate: "2026-06-22",
      amount: 12000,
      paidAmount: 0,
      refundedAmount: 0,
      remainingAmount: 12000,
      status: "active",
      lastPaymentMethod: null,
      lastPaidAtUtc: null,
      cancelledAtUtc: null,
      cancellationReason: null,
      createdAtUtc: "2026-06-01T00:00:00Z",
      updatedAtUtc: "2026-06-01T00:00:00Z",
      rowVersion: 1,
    },
  ],
  payments: [],
  refunds: [],
  invoices: [],
  feeSuggestions: [],
  totalMovementAmount: 12000,
  totalPaid: 0,
  totalRefunded: 0,
  balance: 12000,
  invoiceTotal: 0,
} as unknown as CandidateAccountingSummaryResponse;

const institution = {
  institutionOfficialName: "Pilot Motorlu Taşıt Sürücüleri Kursu",
  institutionName: "Pilot Kurs",
  institutionAddress: "Kurum adresi",
  institutionPhone: "5550000000",
  city: "İstanbul",
  district: "Kadıköy",
  bankName: "Ziraat Bankası",
  iban: "TR000000000000000000000000",
} as InstitutionSettingsResponse;

const theoryFeeRow = {
  lessonType: "theory",
  lessonHours: 34,
  vatIncludedHourlyRate: 100,
  contractTheoryExamFee: 750,
} as LicenseClassFeeRowResponse;

const practiceFeeRow = {
  lessonType: "practice",
  lessonHours: 14,
  vatIncludedHourlyRate: 500,
  contractPracticeExamFee: 1200,
} as LicenseClassFeeRowResponse;

describe("candidate contract print", () => {
  it("builds printable contract html without raw placeholders", () => {
    const html = buildCandidateContractPrintHtml({
      candidate,
      accounting,
      contractYear: 2026,
      theoryFeeRow,
      practiceFeeRow,
      institution,
      managerName: "Mehmet Müdür",
    });

    expect(html).toContain("Ayşe");
    expect(html).toContain("Pilot Motorlu Taşıt Sürücüleri Kursu");
    expect(html).toContain("2026 yılı");
    expect(html).toContain("Ziraat Bankası");
    expect(html).toContain("Mehmet Müdür");
    expect(html).not.toContain("{{");
    expect(html).not.toContain("}}");
  });

  it("returns false when the print window cannot be opened", () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);

    expect(printCandidateContractHtml("<html></html>")).toBe(false);

    openSpy.mockRestore();
  });
});
