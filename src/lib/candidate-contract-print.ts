import JSZip from "jszip";

import type { InstitutionSettingsResponse } from "./institution-settings-api";
import type {
  CandidateAccountingMovementResponse,
  CandidateAccountingSummaryResponse,
  CandidateResponse,
  LicenseClassFeeRowResponse,
} from "./types";

const CONTRACT_TEMPLATE_URL = "/templates/kursiyerkayitsozlesmesi.docx";
const CONTRACT_DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
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

function clean(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value).trim();
  return text || emptyValue;
}

function escapeXml(value: string | number | null | undefined): string {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function formatMoney(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return emptyValue;
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return emptyValue;
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return clean(value);
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function courseMovements(accounting: CandidateAccountingSummaryResponse): CandidateAccountingMovementResponse[] {
  return accounting.movements
    .filter((movement) => movement.type === "kurs" && movement.status !== "cancelled")
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.createdAtUtc.localeCompare(right.createdAtUtc));
}

function firstPhone(candidate: CandidateResponse): string | null {
  return candidate.phoneNumber ?? candidate.contacts?.find((contact) => contact.isPrimary)?.value ?? null;
}

function secondPhone(candidate: CandidateResponse): string | null {
  const primary = firstPhone(candidate);
  return candidate.contacts?.find((contact) => contact.value !== primary)?.value ?? null;
}

function contractTotal(accounting: CandidateAccountingSummaryResponse): number | null {
  const total = courseMovements(accounting).reduce((sum, movement) => sum + movement.amount, 0);
  return total > 0 ? total : null;
}

function installmentValue(
  accounting: CandidateAccountingSummaryResponse,
  index: number,
  field: "dueDate" | "amount"
): string {
  const movement = courseMovements(accounting)[index] ?? null;
  if (!movement) return emptyValue;
  return field === "dueDate" ? formatDate(movement.dueDate) : formatMoney(movement.amount);
}

export function buildCandidateContractPlaceholderValues({
  candidate,
  accounting,
  contractYear,
  theoryFeeRow,
  practiceFeeRow,
  institution,
  managerName,
}: CandidateContractDocumentInput): Record<string, string> {
  const total = contractTotal(accounting);
  const practiceHours = practiceFeeRow?.lessonHours ?? null;
  const practiceHourly = practiceFeeRow?.vatIncludedHourlyRate ?? null;
  const retryPracticeFee =
    practiceHours != null && practiceHourly != null
      ? Math.max(practiceHours - 2, 0) * practiceHourly
      : null;
  const institutionName = institution?.institutionOfficialName ?? institution?.institutionName ?? null;
  const existingLicense =
    candidate.hasExistingLicense === true || candidate.existingLicenseType
      ? candidate.existingLicenseType
      : null;

  return {
    kursiyeradi: clean(candidate.firstName),
    kursiyersoyadi: clean(candidate.lastName),
    kursiyertckimlikno: clean(candidate.nationalId),
    kursiyeradresi: clean(candidate.address),
    kursiyertelefon1: clean(firstPhone(candidate)),
    kursiyertelefon2: clean(secondPhone(candidate)),
    ehliyettipi: clean(candidate.licenseClass),
    mevcutehliyettipi: clean(existingLicense),
    kurumresmiadi: clean(institutionName),
    kurumil: clean(institution?.city),
    kurumilce: clean(institution?.district),
    kurumadresi: clean(institution?.institutionAddress),
    kurumtelefon: clean(institution?.institutionPhone),
    kurummudur: clean(managerName),
    kurumbankaadi: clean(institution?.bankName),
    kurumiban: clean(institution?.iban),
    sozlesmetoplam: formatMoney(total),
    direksiyonsaatucreti: formatMoney(practiceHourly),
    "yıl": clean(contractYear),
    teoriksinavucreti: formatMoney(theoryFeeRow?.contractTheoryExamFee),
    direksiyonsinavucreti: formatMoney(practiceFeeRow?.contractPracticeExamFee),
    teoriksaatsayisi: clean(theoryFeeRow?.lessonHours),
    direksiyonsaatsayisi: clean(practiceHours),
    teoriksaatucreti: formatMoney(theoryFeeRow?.vatIncludedHourlyRate),
    direksiyonsaatsayisieksi2carpidireksiyonsaatucreti: formatMoney(retryPracticeFee),
    birincitaksitvadetarihi: installmentValue(accounting, 0, "dueDate"),
    birincitaksittutari: installmentValue(accounting, 0, "amount"),
    ikincitaksitvadetarihi: installmentValue(accounting, 1, "dueDate"),
    ikincitaksittutari: installmentValue(accounting, 1, "amount"),
    ucuncutaksitvadetarihi: installmentValue(accounting, 2, "dueDate"),
    ucuncutaksittutari: installmentValue(accounting, 2, "amount"),
    dorduncutaksitvadetarihi: installmentValue(accounting, 3, "dueDate"),
    dorduncutaksittutari: installmentValue(accounting, 3, "amount"),
    besincitaksitvadetarihi: installmentValue(accounting, 4, "dueDate"),
    besincitaksittutari: installmentValue(accounting, 4, "amount"),
    teorikdersucreti: formatMoney(theoryFeeRow?.vatIncludedHourlyRate),
    direksiyonderssayisi: clean(practiceHours),
  };
}

export function applyCandidateContractPlaceholders(
  documentXml: string,
  values: Record<string, string>
): string {
  return documentXml.replace(/\{\{[\s\S]*?\}\}/g, (placeholderXml) => {
    const placeholderName = decodeXmlText(placeholderXml.replace(/<[^>]+>/g, "")).replace(/[{}\s]/g, "");
    return escapeXml(values[placeholderName] ?? emptyValue);
  });
}

export async function buildCandidateContractDocxBlob(
  input: CandidateContractDocumentInput,
  templateUrl = CONTRACT_TEMPLATE_URL
): Promise<Blob> {
  const templateResponse = await fetch(templateUrl);
  if (!templateResponse.ok) {
    throw new Error("Sözleşme şablonu indirilemedi.");
  }

  const zip = await JSZip.loadAsync(await templateResponse.arrayBuffer());
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) {
    throw new Error("Sözleşme şablonu geçersiz.");
  }

  const values = buildCandidateContractPlaceholderValues(input);
  const documentXml = await documentFile.async("string");
  zip.file("word/document.xml", applyCandidateContractPlaceholders(documentXml, values));

  return zip.generateAsync({
    type: "blob",
    mimeType: CONTRACT_DOCX_MIME,
    compression: "DEFLATE",
  });
}

export function downloadCandidateContractDocx(blob: Blob, candidate: CandidateResponse): void {
  const fullName = `${candidate.firstName} ${candidate.lastName}`.trim() || "kursiyer";
  const fileName = `${fullName.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]+/gi, "-").replace(/^-|-$/g, "")}-kayit-sozlesmesi.docx`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
