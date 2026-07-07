import { getDocumentApiBaseUrl } from "./api";
import { httpPostBlob } from "./http";
import type { InstitutionSettingsResponse } from "./institution-settings-api";
import { formatPhoneDisplay } from "./phone";
import { formatDateTR } from "./status-maps";
import type {
  CandidateAccountingSummaryResponse,
  CandidateKCertificateResponse,
  CandidateResponse,
  InstructorResponse,
  LicenseClassFeeRowResponse,
  TrainingLessonResponse,
  VehicleResponse,
} from "./types";

const emptyValue = "-";

export type CandidateContractDocumentInput = {
  candidate: CandidateResponse;
  accounting: CandidateAccountingSummaryResponse;
  contractYear: number;
  theoryFeeRow: LicenseClassFeeRowResponse | null;
  practiceFeeRow: LicenseClassFeeRowResponse | null;
  institution: InstitutionSettingsResponse | null;
  managerName: string | null;
};

export type CandidateKCertificateRenderInput = {
  candidate: CandidateResponse;
  certificate: Pick<CandidateKCertificateResponse, "documentNumber" | "startDate" | "expiryDate" | "lastLessonEndDate">;
  institution: InstitutionSettingsResponse | null;
  managerName: string | null;
  lesson: TrainingLessonResponse | null;
  instructor: InstructorResponse | null;
  vehicle: VehicleResponse | null;
  vehicleTypeLabel: string | null;
  routeName: string | null;
  biometricPhoto?: CandidateContractImageInput | null;
};

export type CandidateDrivingTrackingListRenderInput = {
  candidate: CandidateResponse;
  lessons: TrainingLessonResponse[];
  managerName: string | null;
};

export type CandidateContractRenderPdfRequest = {
  values: Record<string, string>;
  fileName: string;
  templateKey?: CandidateContractTemplateKey;
  images?: Record<string, CandidateContractImageInput>;
  sheetName?: string;
};

export type CandidateContractTemplateKey =
  | "registration-contract"
  | "signature-sample"
  | "k-certificate"
  | "driving-tracking-list";

export type CandidateContractImageInput = {
  base64: string;
  contentType: string;
  widthCm?: number;
  heightCm?: number;
};

function documentRequestOptions(signal?: AbortSignal) {
  return { baseUrl: getDocumentApiBaseUrl(), signal };
}

function clean(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value).trim();
  return text || emptyValue;
}

function hasExistingLicenseValue(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLocaleLowerCase("tr-TR") ?? "";
  return normalized !== "" && normalized !== "-" && normalized !== "yok" && normalized !== "none" && normalized !== "exempt";
}

function formatMoney(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return emptyValue;
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function firstPhone(candidate: CandidateResponse): string | null {
  return candidate.phoneNumber ?? candidate.contacts?.find((contact) => contact.type === "phone" && contact.isPrimary)?.value ?? null;
}

function secondPhone(candidate: CandidateResponse): string | null {
  const primary = firstPhone(candidate);
  return candidate.contacts?.find((contact) => contact.type === "phone" && contact.value !== primary)?.value ?? null;
}

function feeRowLessonTotal(row: LicenseClassFeeRowResponse | null): number | null {
  if (!row) return null;
  if (row.lessonFee != null && Number.isFinite(row.lessonFee)) return row.lessonFee;
  if (row.vatIncludedHourlyRate == null || !Number.isFinite(row.vatIncludedHourlyRate)) return null;
  return Math.round(row.vatIncludedHourlyRate * row.lessonHours * 100) / 100;
}

function contractTotal(
  theoryFeeRow: LicenseClassFeeRowResponse | null,
  practiceFeeRow: LicenseClassFeeRowResponse | null
): number | null {
  const totals = [feeRowLessonTotal(theoryFeeRow), feeRowLessonTotal(practiceFeeRow)]
    .filter((value): value is number => value != null);
  if (totals.length === 0) return null;
  const total = totals.reduce((sum, value) => sum + value, 0);
  return total > 0 ? Math.round(total * 100) / 100 : null;
}

function defaultInstallmentAmount(total: number | null, index: number): string {
  return index === 0 ? formatMoney(total) : emptyValue;
}

function candidatePdfFileName(candidate: CandidateResponse, suffix: string): string {
  const fullName = `${candidate.firstName} ${candidate.lastName}`.trim() || "kursiyer";
  const slug = fullName
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9çğıöşü]+/gi, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "kursiyer"}-${suffix}.pdf`;
}

function contractFileName(candidate: CandidateResponse): string {
  return candidatePdfFileName(candidate, "kayit-sozlesmesi");
}

function signatureSampleFileName(candidate: CandidateResponse): string {
  return candidatePdfFileName(candidate, "imza-ornegi");
}

function kCertificateFileName(candidate: CandidateResponse, documentNumber: string | null | undefined): string {
  const suffix = documentNumber?.trim()
    ? `k-belgesi-${documentNumber.trim()}`
    : "k-belgesi";
  return candidatePdfFileName(candidate, suffix);
}

function drivingTrackingListFileName(candidate: CandidateResponse): string {
  return candidatePdfFileName(candidate, "direksiyon-takip-listesi");
}

function splitFullName(fullName: string | null | undefined): { firstName: string | null; lastName: string | null } {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function formatLessonDateTR(value: string | null | undefined): string {
  if (!value) return emptyValue;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}

function formatLessonTimeTR(value: string | null | undefined): string {
  if (!value) return emptyValue;
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}

function formatLessonTimeRangeTR(lesson: TrainingLessonResponse | null | undefined): string {
  if (!lesson) return emptyValue;
  return `${formatLessonTimeTR(lesson.startAtUtc)}-${formatLessonTimeTR(lesson.endAtUtc)}`;
}

export function buildCandidateContractRenderPdfRequest({
  candidate,
  contractYear,
  theoryFeeRow,
  practiceFeeRow,
  institution,
  managerName,
}: CandidateContractDocumentInput): CandidateContractRenderPdfRequest {
  const total = contractTotal(theoryFeeRow, practiceFeeRow);
  const practiceHours = practiceFeeRow?.lessonHours ?? null;
  const practiceHourly = practiceFeeRow?.vatIncludedHourlyRate ?? null;
  const retryPracticeFee =
    practiceHours != null && practiceHourly != null
      ? Math.max(practiceHours - 2, 0) * practiceHourly
      : null;
  const institutionName = institution?.institutionOfficialName ?? institution?.institutionName ?? null;
  const existingLicense =
    candidate.hasExistingLicense === true || hasExistingLicenseValue(candidate.existingLicenseType)
      ? candidate.existingLicenseType
      : null;

  return {
    fileName: contractFileName(candidate),
    templateKey: "registration-contract",
    values: {
      kursiyeradi: clean(candidate.firstName),
      kursiyersoyadi: clean(candidate.lastName),
      kursiyertckimlikno: clean(candidate.nationalId),
      kursiyeradresi: clean(candidate.address),
      kursiyertelefon1: formatPhoneDisplay(firstPhone(candidate), emptyValue),
      kursiyertelefon2: formatPhoneDisplay(secondPhone(candidate), emptyValue),
      ehliyettipi: clean(candidate.licenseClass),
      mevcutehliyettipi: clean(existingLicense),
      kurumresmiadi: clean(institutionName),
      kurumil: clean(institution?.city),
      kurumilce: clean(institution?.district),
      kurumadresi: clean(institution?.institutionAddress),
      kurumtelefon: formatPhoneDisplay(institution?.institutionPhone, emptyValue),
      kurummudur: clean(managerName),
      kurumbankaadi: clean(institution?.bankName),
      kurumiban: clean(institution?.iban),
      sozlesmetoplam: formatMoney(total),
      direksiyonsaatucreti: formatMoney(practiceHourly),
      taksitsayi: clean(total == null ? null : 1),
      "yıl": clean(contractYear),
      teoriksinavucreti: formatMoney(theoryFeeRow?.contractTheoryExamFee),
      direksiyonsinavucreti: formatMoney(practiceFeeRow?.contractPracticeExamFee),
      teoriksaatsayisi: clean(theoryFeeRow?.lessonHours),
      direksiyonsaatsayisi: clean(practiceHours),
      teoriksaatucreti: formatMoney(theoryFeeRow?.vatIncludedHourlyRate),
      direksiyonsaatsayisieksi2carpidireksiyonsaatucreti: formatMoney(retryPracticeFee),
      birincitaksitvadetarihi: emptyValue,
      birincitaksittutari: defaultInstallmentAmount(total, 0),
      ikincitaksitvadetarihi: emptyValue,
      ikincitaksittutari: defaultInstallmentAmount(total, 1),
      ucuncutaksitvadetarihi: emptyValue,
      ucuncutaksittutari: defaultInstallmentAmount(total, 2),
      dorduncutaksitvadetarihi: emptyValue,
      dorduncutaksittutari: defaultInstallmentAmount(total, 3),
      besincitaksitvadetarihi: emptyValue,
      besincitaksittutari: defaultInstallmentAmount(total, 4),
      teorikdersucreti: formatMoney(theoryFeeRow?.vatIncludedHourlyRate),
      direksiyonderssayisi: clean(practiceHours),
    },
  };
}

export function buildCandidateSignatureSampleRenderPdfRequest(
  candidate: CandidateResponse
): CandidateContractRenderPdfRequest {
  return {
    fileName: signatureSampleFileName(candidate),
    templateKey: "signature-sample",
    values: {
      kursiyeradi: clean(candidate.firstName),
      kursiyersoyadi: clean(candidate.lastName),
      kursiyertckimlikno: clean(candidate.nationalId),
    },
  };
}

export function buildCandidateKCertificateRenderPdfRequest({
  candidate,
  certificate,
  institution,
  managerName,
  lesson,
  instructor,
  vehicle,
  vehicleTypeLabel,
  routeName,
  biometricPhoto,
}: CandidateKCertificateRenderInput): CandidateContractRenderPdfRequest {
  const institutionName = institution?.institutionOfficialName ?? institution?.institutionName ?? null;
  const instructorNameParts = splitFullName(
    instructor
      ? `${instructor.firstName} ${instructor.lastName}`
      : lesson?.instructorName
  );

  return {
    fileName: kCertificateFileName(candidate, certificate.documentNumber),
    templateKey: "k-certificate",
    images: biometricPhoto
      ? {
          kursiyerbiyometrikfotograf: biometricPhoto,
          kursiyerfoto: biometricPhoto,
        }
      : undefined,
    values: {
      adayno: clean(candidate.nationalId),
      aracturu: clean(vehicleTypeLabel),
      belgeno: clean(certificate.documentNumber),
      guzergah: clean(routeName),
      kbelgesibaslangictarihi: formatDateTR(certificate.startDate),
      kbelgesibitistarihi: formatDateTR(certificate.expiryDate),
      kursresmiadi: clean(institutionName),
      kursmuduru: clean(managerName),
      kursil: clean(institution?.city),
      kursilce: clean(institution?.district),
      kursadresi: clean(institution?.institutionAddress),
      kurumadresi: clean(institution?.institutionAddress),
      kurumkisaadi: clean(institution?.institutionName),
      kursiyertckimlikno: clean(candidate.nationalId),
      kursiyeradi: clean(candidate.firstName),
      kursiyersoyadi: clean(candidate.lastName),
      kursiyerbabaadi: clean(candidate.fatherName),
      kursiyerdogumyeri: clean(candidate.birthPlace),
      kursiyerdogumtarihi: formatDateTR(candidate.birthDate),
      kursiyeradresi: clean(candidate.address),
      kursiyerbiyometrikfotograf: "",
      kursiyerfoto: "",
      ustaogreticikimlikno: clean(instructor?.nationalId),
      ustaogreticiadi: clean(instructorNameParts.firstName),
      ustaogreticisoyadi: clean(instructorNameParts.lastName),
      ustaogreticiadresi: clean(instructor?.driverLicenseAddress),
      ustaogreticiehliyettipi: clean(instructor?.driverLicenseTypeText ?? instructor?.licenseClassCodes.join(", ")),
      ustaogreticiehliyetno: clean(instructor?.driverLicenseNumber),
      ustaogreticiehliyetverildigiyer: clean(instructor?.driverLicenseIssuedPlace),
      aracplaka: clean(vehicle?.plateNumber ?? lesson?.vehiclePlate),
    },
  };
}

const drivingLessonPlaceholderPrefixes = [
  "birinci",
  "ikinci",
  "ucuncu",
  "dorduncu",
  "besinci",
  "altinci",
  "yedinci",
  "sekizinci",
  "dokuzuncu",
  "onuncu",
  "onbirinci",
  "onikinci",
  "onucuncu",
  "ondorduncu",
  "onbesinci",
  "onaltinci",
  "onyedinci",
  "onsekizinci",
  "ondokuzuncu",
  "yirminci",
  "yirmibirinci",
  "yirmiikinci",
] as const;

function drivingTrackingListSheetName(candidate: CandidateResponse): string {
  return candidate.licenseClass
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/[\s_]+/g, "-")
    .replace(/-YN-OTOMATIK$/u, "")
    .replace(/-OTOMATIK$/u, "")
    .replace(/-2016$/u, "");
}

export function buildCandidateDrivingTrackingListRenderPdfRequest({
  candidate,
  lessons,
  managerName,
}: CandidateDrivingTrackingListRenderInput): CandidateContractRenderPdfRequest {
  const practiceLessons = [...lessons]
    .filter((lesson) => lesson.kind === "uygulama")
    .sort((left, right) => new Date(left.startAtUtc).getTime() - new Date(right.startAtUtc).getTime())
    .slice(0, drivingLessonPlaceholderPrefixes.length);
  const values: Record<string, string> = {
    kursiyeradi: clean(candidate.firstName),
    kursiyersoyadi: clean(candidate.lastName),
    kursiyertckimlikno: clean(candidate.nationalId),
    kursiyerehliyettipi: clean(candidate.licenseClass),
    kurummudur: clean(managerName),
  };

  drivingLessonPlaceholderPrefixes.forEach((prefix, index) => {
    const lesson = practiceLessons[index] ?? null;
    values[`${prefix}direksiyonderstarihi`] = lesson ? formatLessonDateTR(lesson.startAtUtc) : emptyValue;
    values[`${prefix}direksiyonderssaati`] = lesson ? formatLessonTimeRangeTR(lesson) : emptyValue;
    values[`${prefix}dersaracplakasi`] = clean(lesson?.vehiclePlate);
    values[`${prefix}dersustaogretici`] = clean(lesson?.instructorName);
  });

  return {
    fileName: drivingTrackingListFileName(candidate),
    templateKey: "driving-tracking-list",
    sheetName: drivingTrackingListSheetName(candidate),
    values,
  };
}

export function renderCandidateContractPdf(
  request: CandidateContractRenderPdfRequest,
  signal?: AbortSignal
): Promise<Blob> {
  return httpPostBlob(
    "/api/document/candidate-contracts/render-pdf",
    request,
    documentRequestOptions(signal)
  );
}

export function openCandidateContractPrintWindow(title = "Kursiyer Kayıt Sözleşmesi"): Window | null {
  const printWindow = window.open("", "_blank", "width=900,height=1200");
  if (!printWindow) return null;

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          html, body { width: 100%; height: 100%; margin: 0; }
          body { display: grid; place-items: center; font-family: Arial, sans-serif; }
        </style>
      </head>
      <body>Hazırlanıyor...</body>
    </html>
  `);
  printWindow.document.close();
  return printWindow;
}

export function printCandidateContractPdf(printWindow: Window, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  let printTriggered = false;
  const triggerPrint = () => {
    if (printTriggered) return;
    printTriggered = true;
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };

  printWindow.addEventListener("load", triggerPrint, { once: true });
  printWindow.location.href = url;
  window.setTimeout(triggerPrint, 1500);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
