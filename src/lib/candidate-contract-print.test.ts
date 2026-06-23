import { describe, expect, it, vi } from "vitest";

import {
  buildCandidateContractRenderPdfRequest,
  buildCandidateSignatureSampleRenderPdfRequest,
  openCandidateContractPrintWindow,
  printCandidateContractPdf,
  renderCandidateContractPdf,
} from "./candidate-contract-print";
import type { InstitutionSettingsResponse } from "./institution-settings-api";
import type {
  CandidateAccountingSummaryResponse,
  CandidateResponse,
  LicenseClassFeeRowResponse,
} from "./types";

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
      amount: 1000,
      paidAmount: 0,
      refundedAmount: 0,
      remainingAmount: 1000,
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
  totalMovementAmount: 1000,
  totalPaid: 0,
  totalRefunded: 0,
  balance: 1000,
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
  it("builds PDF render request values from candidate contract data", () => {
    const request = buildCandidateContractRenderPdfRequest({
      candidate,
      accounting,
      contractYear: 2026,
      theoryFeeRow,
      practiceFeeRow,
      institution,
      managerName: "Mehmet Müdür",
    });

    expect(request.fileName).toBe("ayşe-yılmaz-kayit-sozlesmesi.pdf");
    expect(request.templateKey).toBe("registration-contract");
    expect(request.values.kursiyeradi).toBe("Ayşe");
    expect(request.values.kurumresmiadi).toBe("Pilot Motorlu Taşıt Sürücüleri Kursu");
    expect(request.values["yıl"]).toBe("2026");
    expect(request.values.kurumbankaadi).toBe("Ziraat Bankası");
    expect(request.values.kurummudur).toBe("Mehmet Müdür");
    expect(request.values.sozlesmetoplam).toBe("10.400,00");
    expect(request.values.taksitsayi).toBe("1");
    expect(request.values.birincitaksitvadetarihi).toBe("-");
    expect(request.values.birincitaksittutari).toBe("10.400,00");
    expect(request.values.ikincitaksittutari).toBe("-");
    expect(Object.values(request.values)).not.toContain("1.000,00");
    expect(Object.values(request.values).join(" ")).not.toContain("{{");
  });

  it("does not print existing license placeholders as a license", () => {
    const request = buildCandidateContractRenderPdfRequest({
      candidate: {
        ...candidate,
        hasExistingLicense: false,
        existingLicenseType: "Yok",
      },
      accounting,
      contractYear: 2026,
      theoryFeeRow,
      practiceFeeRow,
      institution,
      managerName: null,
    });

    expect(request.values.mevcutehliyettipi).toBe("-");
  });

  it("builds PDF render request values for the signature sample", () => {
    const request = buildCandidateSignatureSampleRenderPdfRequest(candidate);

    expect(request.fileName).toBe("ayşe-yılmaz-imza-ornegi.pdf");
    expect(request.templateKey).toBe("signature-sample");
    expect(request.values).toEqual({
      kursiyeradi: "Ayşe",
      kursiyersoyadi: "Yılmaz",
      kursiyertckimlikno: "12345678901",
    });
  });

  it("posts the render request and returns a PDF blob", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Blob(["%PDF-1.4"], { type: "application/pdf" }), {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      })
    );

    const request = { values: { kursiyeradi: "Ayşe" }, fileName: "ayse.pdf" };
    const blob = await renderCandidateContractPdf(request);

    expect(blob.type).toBe("application/pdf");
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/document/candidate-contracts/render-pdf"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(request),
      })
    );

    fetchSpy.mockRestore();
  });

  it("returns null when the print window cannot be opened", () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);

    expect(openCandidateContractPrintWindow()).toBeNull();

    openSpy.mockRestore();
  });

  it("opens the PDF directly in the print window and triggers print", () => {
    vi.useFakeTimers();
    const createSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const loadHandlers: EventListener[] = [];
    const printWindow = {
      addEventListener: vi.fn((_event: string, handler: EventListenerOrEventListenerObject) => {
        loadHandlers.push(typeof handler === "function" ? handler : () => handler.handleEvent(new Event("load")));
      }),
      focus: vi.fn(),
      print: vi.fn(),
      location: {
        href: "",
      },
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      },
    } as unknown as Window;

    printCandidateContractPdf(printWindow, new Blob(["%PDF-1.4"], { type: "application/pdf" }));
    expect(loadHandlers).toHaveLength(1);
    loadHandlers[0](new Event("load"));
    vi.advanceTimersByTime(500);

    expect(printWindow.location.href).toBe("blob:test");
    expect(printWindow.focus).toHaveBeenCalled();
    expect(printWindow.print).toHaveBeenCalled();
    expect(printWindow.document.write).not.toHaveBeenCalled();

    vi.advanceTimersByTime(60_000);
    expect(revokeSpy).toHaveBeenCalledWith("blob:test");

    vi.useRealTimers();
    revokeSpy.mockRestore();
    createSpy.mockRestore();
  });
});
