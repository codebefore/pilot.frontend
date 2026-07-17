import { describe, expect, it, vi } from "vitest";

import {
  buildCandidateApplicationFormRenderPdfRequest,
  buildCandidateContractRenderPdfRequest,
  buildCandidateDrivingTrackingListRenderPdfRequest,
  buildCandidateFreeCandidateFormRenderPdfRequest,
  buildCandidateKCertificateRenderPdfRequest,
  buildCandidatePenaltyPointsCertificateRenderPdfRequest,
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
  TrainingLessonResponse,
} from "./types";

const candidate = {
  id: "candidate-1",
  firstName: "Ayşe",
  lastName: "Yılmaz",
  nationalId: "12345678901",
  phoneNumber: "5551112233",
  address: "Aday adresi",
  motherName: "Fatma",
  fatherName: "Ahmet",
  birthDate: "1995-05-10",
  birthPlace: "Ankara",
  licenseClass: "B",
  hasExistingLicense: true,
  existingLicenseType: "A2",
  existingLicenseIssuedAt: "2020-06-15",
  existingLicenseIssuedProvince: "İstanbul",
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
  districtNationalEducationDirector: "İlçe Milli Eğitim Müdürü",
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
    expect(request.values.adayadisoyadi).toBe("Ayşe Yılmaz");
    expect(request.values.adaytc).toBe("12345678901");
    expect(request.values.adayadresi).toBe("Aday adresi");
    expect(request.values.adaytelefon1).toBe("+90 555 111 22 33");
    expect(request.values.kurumresmiadi).toBe("Pilot Motorlu Taşıt Sürücüleri Kursu");
    expect(request.values["yıl"]).toBe("2026");
    expect(request.values.kurumbankaadi).toBe("Ziraat Bankası");
    expect(request.values.kurummudur).toBe("Mehmet Müdür");
    expect(request.values.kurummuduru).toBe("Mehmet Müdür");
    expect(request.values.kurummuduruimza).toBe("\u200B");
    expect(request.values.kursiyertelefon1).toBe("+90 555 111 22 33");
    expect(request.values.kurumtelefon).toBe("+90 555 000 00 00");
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

  it("builds PDF render request for the blank-fee registration contract template", () => {
    const request = buildCandidateContractRenderPdfRequest({
      candidate,
      accounting,
      contractYear: 2026,
      theoryFeeRow,
      practiceFeeRow,
      institution,
      managerName: "Mehmet Müdür",
      templateKey: "registration-contract-blank-fee",
    });

    expect(request.fileName).toBe("ayşe-yılmaz-kayit-sozlesmesi-ucret-bos.pdf");
    expect(request.templateKey).toBe("registration-contract-blank-fee");
    expect(request.values.adayadisoyadi).toBe("Ayşe Yılmaz");
    expect(request.values.adaytc).toBe("12345678901");
    expect(request.values.kurumadresi).toBe("Kurum adresi");
    expect(request.values.kurummuduruimza).toBe("\u200B");
  });

  it("uses only phone contacts for the secondary phone placeholder", () => {
    const request = buildCandidateContractRenderPdfRequest({
      candidate: {
        ...candidate,
        contacts: [
          {
            id: "contact-address",
            type: "address",
            label: "Adres",
            value: "Adres satırı telefon alanına basılmamalı",
            isPrimary: false,
            displayOrder: 0,
            ownerName: null,
          },
          {
            id: "contact-phone",
            type: "phone",
            label: "Telefon",
            value: "5552223344",
            isPrimary: false,
            displayOrder: 1,
            ownerName: "Anne",
          },
        ],
      },
      accounting,
      contractYear: 2026,
      theoryFeeRow,
      practiceFeeRow,
      institution,
      managerName: null,
    });

    expect(request.values.kursiyertelefon2).toBe("+90 555 222 33 44");
    expect(request.values.kursiyertelefon2).not.toContain("Adres");
  });

  it("leaves secondary phone empty when the candidate has no second phone contact", () => {
    const request = buildCandidateContractRenderPdfRequest({
      candidate: {
        ...candidate,
        contacts: [
          {
            id: "contact-address",
            type: "address",
            label: "Adres",
            value: "Adres satırı telefon alanına basılmamalı",
            isPrimary: false,
            displayOrder: 0,
            ownerName: null,
          },
        ],
      },
      accounting,
      contractYear: 2026,
      theoryFeeRow,
      practiceFeeRow,
      institution,
      managerName: null,
    });

    expect(request.values.kursiyertelefon2).toBe("-");
  });

  it("builds PDF render request values for the signature sample", () => {
    const request = buildCandidateSignatureSampleRenderPdfRequest(candidate);

    expect(request.fileName).toBe("ayşe-yılmaz-imza-ornegi.pdf");
    expect(request.templateKey).toBe("signature-sample");
    expect(request.values).toEqual({
      kursiyeradi: "Ayşe",
      kursiyersoyadi: "Yılmaz",
      kursiyertckimlikno: "12345678901",
      adaysadisoyadi: "Ayşe Yılmaz",
      adaytc: "12345678901",
    });
  });

  it("builds PDF render request values for the application form", () => {
    const request = buildCandidateApplicationFormRenderPdfRequest({
      candidate,
      institution,
      managerName: "Mehmet Müdür",
      biometricPhoto: {
        base64: "abc",
        contentType: "image/png",
        widthCm: 2.4,
        heightCm: 3.2,
      },
    });

    expect(request.fileName).toBe("ayşe-yılmaz-muracaat-formu.pdf");
    expect(request.templateKey).toBe("application-form");
    expect(request.values.adayadi).toBe("Ayşe");
    expect(request.values.adaysoyadi).toBe("Yılmaz");
    expect(request.values.adayadisoyadi).toBe("Ayşe Yılmaz");
    expect(request.values.adaytckimlikno).toBe("12345678901");
    expect(request.values.adaytel).toBe("+90 555 111 22 33");
    expect(request.values.adayanneadi).toBe("Fatma");
    expect(request.values.adaybabadi).toBe("Ahmet");
    expect(request.values.adaydogumtarihi).toBe("10.05.1995");
    expect(request.values.adaydogumyeri).toBe("Ankara");
    expect(request.values.adayehliyettipi).toBe("B");
    expect(request.values.adaymevcutehliyettipi).toBe("A2");
    expect(request.values.mevcutehliyetipiverilistarihi).toBe("15.06.2020");
    expect(request.values.mevcutehliyettipiverildigiyer).toBe("İstanbul");
    expect(request.values.kursresmiadi).toBe("Pilot Motorlu Taşıt Sürücüleri Kursu");
    expect(request.values.kurumresmiadi).toBe("Pilot Motorlu Taşıt Sürücüleri Kursu");
    expect(request.values.kurummuduru).toBe("Mehmet Müdür");
    expect(request.values.adaybiyometrikresim).toBe("");
    expect(request.images?.adaybiyometrikresim?.base64).toBe("abc");
  });

  it("builds PDF render request values for the free candidate form", () => {
    const request = buildCandidateFreeCandidateFormRenderPdfRequest({
      candidate,
      institution,
    });

    expect(request.fileName).toBe("ayşe-yılmaz-ucretsiz-kursiyer-formu.pdf");
    expect(request.templateKey).toBe("free-candidate-form");
    expect(request.values).toEqual({
      adayadisoyadi: "Ayşe Yılmaz",
      adaytc: "12345678901",
      kurumresmiadi: "Pilot Motorlu Taşıt Sürücüleri Kursu",
    });
  });

  it("builds PDF render request values for the 100 penalty points certificate", () => {
    const request = buildCandidatePenaltyPointsCertificateRenderPdfRequest({
      candidate: {
        ...candidate,
        licenseClass: "100CP",
        currentGroup: {
          groupId: "group-1",
          title: "100 CP Grubu",
          startDate: "2026-07-01",
          term: {
            id: "term-1",
            monthDate: "2026-07-01",
            sequence: 1,
            name: "2026/7",
          },
          assignedAtUtc: "2026-07-01T00:00:00Z",
        },
      },
      institution,
      managerName: "Mehmet Müdür",
      lessons: [
        {
          id: "lesson-1",
          kind: "teorik",
          startAtUtc: "2026-07-02T07:00:00Z",
          endAtUtc: "2026-07-02T09:00:00Z",
        },
        {
          id: "lesson-2",
          kind: "teorik",
          startAtUtc: "2026-07-04T07:00:00Z",
          endAtUtc: "2026-07-04T09:00:00Z",
        },
      ] as TrainingLessonResponse[],
      biometricPhoto: {
        base64: "abc",
        contentType: "image/png",
        widthCm: 2.4,
        heightCm: 3.2,
      },
    });

    expect(request.fileName).toBe("ayşe-yılmaz-100-ceza-puani-belgesi.pdf");
    expect(request.templateKey).toBe("penalty-points-certificate");
    expect(request.values.adi).toBe("Ayşe");
    expect(request.values.adayadi).toBe("Ayşe");
    expect(request.values.soyadi).toBe("Yılmaz");
    expect(request.values.adaysoyadi).toBe("Yılmaz");
    expect(request.values.adayadsoyad).toBe("Ayşe Yılmaz");
    expect(request.values.tckimlikno).toBe("12345678901");
    expect(request.values.adaytc).toBe("12345678901");
    expect(request.values["adaytc]"]).toBe("12345678901");
    expect(request.values.anneadi).toBe("Fatma");
    expect(request.values.adayanaadi).toBe("Fatma");
    expect(request.values.babadi).toBe("Ahmet");
    expect(request.values.adaybabaadi).toBe("Ahmet");
    expect(request.values.dogumyeri).toBe("Ankara");
    expect(request.values.adaydogumyeri).toBe("Ankara");
    expect(request.values.dogumtarihi).toBe("10.05.1995");
    expect(request.values.adaydogumyili).toBe("1995");
    expect(request.values.ehliyettipi).toBe("100CP");
    expect(request.values.kursilce).toBe("Kadıköy");
    expect(request.values.kurumilce).toBe("Kadıköy");
    expect(request.values.kursresmiadi).toBe("Pilot Motorlu Taşıt Sürücüleri Kursu");
    expect(request.values.kurskisaadi).toBe("Pilot Kurs");
    expect(request.values.kurumkisaadi).toBe("Pilot Kurs");
    expect(request.values.kursmuduru).toBe("Mehmet Müdür");
    expect(request.values.kurummuduru).toBe("Mehmet Müdür");
    expect(request.values.ilcemilliegitimmuduru).toBe("İlçe Milli Eğitim Müdürü");
    expect(request.values.grupbaslangictarihi).toBe("01.07.2026");
    expect(request.values.grupbaslangic).toBe("01.07.2026");
    expect(request.values.grupteorikdersbitistarihi).toBe("04.07.2026");
    expect(request.values.grupteorikdersbitis).toBe("04.07.2026");
    expect(request.values.biyometrikfoto).toBe("");
    expect(request.values.biyometrik).toBe("");
    expect(request.values.adaybiyometrik).toBe("");
    expect(request.images?.biyometrikfoto?.base64).toBe("abc");
    expect(request.images?.biyometrik?.base64).toBe("abc");
    expect(request.images?.adaybiyometrik?.base64).toBe("abc");
  });

  it("builds K certificate request values for the matbu template aliases", () => {
    const request = buildCandidateKCertificateRenderPdfRequest({
      candidate: {
        ...candidate,
        fatherName: "Ahmet",
        birthPlace: "Ankara",
        birthDate: "1995-05-10",
      },
      certificate: {
        documentNumber: "K-42",
        startDate: "2026-07-08",
        expiryDate: "2026-07-15",
        lastLessonEndDate: "2026-07-08",
      },
      institution,
      managerName: "Mehmet Müdür",
      lesson: {
        id: "lesson-1",
        kind: "uygulama",
        startAtUtc: "2026-07-08T09:00:00Z",
        endAtUtc: "2026-07-08T11:00:00Z",
        vehiclePlate: "34 ABC 123",
        instructorName: "Ali Usta",
      } as TrainingLessonResponse,
      instructor: null,
      vehicle: null,
      vehicleTypeLabel: "Motosiklet",
      routeName: "Güzergah 1",
      templateKey: "k-certificate-matbu",
      biometricPhoto: {
        base64: "abc",
        contentType: "image/png",
        widthCm: 2.4,
        heightCm: 3.2,
      },
    });

    expect(request.templateKey).toBe("k-certificate-matbu");
    expect(request.values.belgeno).toBe("K-42");
    expect(request.values.kurskisaadi).toBe("Pilot");
    expect(request.values.kurumkisaadi).toBe("Pilot");
    expect(request.values.kurumil).toBe("İstanbul");
    expect(request.values.kurumilcesi).toBe("Kadıköy");
    expect(request.values.kurumadresi).toBe("Kurum adresi");
    expect(request.values.kursiyerfoto).toBe("");
    expect(request.images?.kursiyerbiyometrikfotograf?.base64).toBe("abc");
    expect(request.images?.kursiyerfoto?.base64).toBe("abc");
  });

  it("uses the official institution name without repeated legal course words for K certificate short name", () => {
    const request = buildCandidateKCertificateRenderPdfRequest({
      candidate,
      certificate: {
        documentNumber: "K-42",
        startDate: "2026-07-08",
        expiryDate: "2026-07-15",
        lastLessonEndDate: "2026-07-08",
      },
      institution: {
        ...institution,
        institutionOfficialName: "ÖZEL TANIDIK MOTORLU TAŞIT SÜRÜCÜLERİ KURSU",
        institutionName: "Tanıdık Kurs",
      },
      managerName: "Mehmet Müdür",
      lesson: null,
      instructor: null,
      vehicle: null,
      vehicleTypeLabel: "Motosiklet",
      routeName: "Güzergah 1",
      templateKey: "k-certificate-matbu",
    });

    expect(request.values.kurskisaadi).toBe("TANIDIK");
    expect(request.values.kurumkisaadi).toBe("TANIDIK");
  });

  it("builds PDF render request values for the driving tracking list", () => {
    const request = buildCandidateDrivingTrackingListRenderPdfRequest({
      candidate,
      managerName: "Mehmet Müdür",
      lessons: [
        {
          id: "lesson-2",
          kind: "uygulama",
          startAtUtc: "2026-07-08T09:00:00Z",
          endAtUtc: "2026-07-08T11:00:00Z",
          vehiclePlate: "34 ABC 123",
          instructorName: "Ali Usta",
        },
        {
          id: "lesson-1",
          kind: "uygulama",
          startAtUtc: "2026-07-07T07:00:00Z",
          endAtUtc: "2026-07-07T09:00:00Z",
          vehiclePlate: "34 DEF 456",
          instructorName: "Veli Usta",
        },
      ] as TrainingLessonResponse[],
    });

    expect(request.fileName).toBe("ayşe-yılmaz-direksiyon-takip-listesi.pdf");
    expect(request.templateKey).toBe("driving-tracking-list");
    expect(request.sheetName).toBe("B");
    expect(request.values.kursiyeradi).toBe("Ayşe");
    expect(request.values.kursiyersoyadi).toBe("Yılmaz");
    expect(request.values.kursiyertckimlikno).toBe("12345678901");
    expect(request.values.kursiyerehliyettipi).toBe("B");
    expect(request.values.kurummudur).toBe("Mehmet Müdür");
    expect(request.values.birincidireksiyonderstarihi).toBe("07.07.2026");
    expect(request.values.birincidireksiyonderssaati).toBe("10:00-12:00");
    expect(request.values.birincidersaracplakasi).toBe("34 DEF 456");
    expect(request.values.birincidersustaogretici).toBe("Veli Usta");
    expect(request.values.ikincidireksiyonderstarihi).toBe("08.07.2026");
    expect(request.values.ikincidireksiyonderssaati).toBe("12:00-14:00");
    expect(request.values.ucuncudireksiyonderstarihi).toBe("-");
  });

  it("uses the base license class as the driving tracking list sheet name", () => {
    const request = buildCandidateDrivingTrackingListRenderPdfRequest({
      candidate: {
        ...candidate,
        licenseClass: "A2-OTOMATIK",
      },
      managerName: null,
      lessons: [],
    });

    expect(request.sheetName).toBe("A2");
    expect(request.values.kursiyerehliyettipi).toBe("A2-OTOMATIK");
  });

  it("posts the render request and returns a PDF blob", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("%PDF-1.4", {
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
