import {
  createVehicle,
  getVehicles,
  updateVehicle,
} from "./vehicles-api";
import {
  createVehicleDocument,
  listVehicleDocuments,
  updateVehicleDocument,
} from "./vehicle-documents-api";
import type { MebbisJobResponse } from "./mebbis-jobs-api";
import type {
  LicenseClass,
  VehicleDocumentResponse,
  VehicleOwnershipType,
  VehicleResponse,
  VehicleTransmissionType,
  VehicleType,
  VehicleUpsertRequest,
} from "./types";

type MebbisVehicleInventoryRow = {
  plateNumber?: unknown;
  licenseClass?: unknown;
  brand?: unknown;
  model?: unknown;
  modelYear?: unknown;
  registrationDate?: unknown;
  serviceStartDate?: unknown;
  serviceEndDate?: unknown;
  inspectionValidUntil?: unknown;
  insuranceStartDate?: unknown;
  insuranceDocumentNumber?: unknown;
  ownershipStatus?: unknown;
  vehicleStatus?: unknown;
  institutionApprovalStatus?: unknown;
  memApprovalStatus?: unknown;
  transmission?: unknown;
};

type MebbisVehicleInventoryResult = {
  vehicles?: MebbisVehicleInventoryRow[];
};

export type MebbisVehicleInventoryApplyResult = {
  importedCount: number;
  createdCount: number;
  updatedCount: number;
  inspectionDocumentCount: number;
  insuranceDocumentCount: number;
  documentErrorCount: number;
};

export async function applyMebbisVehicleInventory(
  job: MebbisJobResponse
): Promise<MebbisVehicleInventoryApplyResult> {
  const result = parseMebbisVehicleInventoryResult(job);
  const importedRows = result?.vehicles?.filter(isReadableMebbisVehicleRow) ?? [];
  if (importedRows.length === 0) {
    return {
      importedCount: 0,
      createdCount: 0,
      updatedCount: 0,
      inspectionDocumentCount: 0,
      insuranceDocumentCount: 0,
      documentErrorCount: 0,
    };
  }

  const existingResponse = await getVehicles({ activity: "all", page: 1, pageSize: 1000 });
  const existingByPlate = new Map(
    existingResponse.items.map((vehicle) => [normalizePlate(vehicle.plateNumber), vehicle])
  );
  let createdCount = 0;
  let updatedCount = 0;
  let inspectionDocumentCount = 0;
  let insuranceDocumentCount = 0;
  let documentErrorCount = 0;

  for (const imported of importedRows) {
    const plateNumber = normalizePlate(readMebbisString(imported.plateNumber));
    const existing = existingByPlate.get(plateNumber);
    const request = buildVehicleUpsertRequest(imported, existing);
    if (!request) continue;

    let savedVehicle: VehicleResponse;
    if (!existing) {
      savedVehicle = await createVehicle(request);
      createdCount += 1;
    } else {
      savedVehicle = await updateVehicle(existing.id, {
        ...request,
        rowVersion: existing.rowVersion,
      });
      updatedCount += 1;
    }

    try {
      const vehicleDocuments = await listVehicleDocuments(savedVehicle.id);
      const inspectionUpdated = await upsertMebbisInspectionDocument(
        savedVehicle,
        imported,
        vehicleDocuments
      );
      if (inspectionUpdated) inspectionDocumentCount += 1;
      const insuranceUpdated = await upsertMebbisInsuranceDocument(
        savedVehicle,
        imported,
        vehicleDocuments
      );
      if (insuranceUpdated) insuranceDocumentCount += 1;
    } catch (error) {
      console.error("MEBBIS vehicle document import failed", error);
      documentErrorCount += 1;
    }
  }

  return {
    importedCount: importedRows.length,
    createdCount,
    updatedCount,
    inspectionDocumentCount,
    insuranceDocumentCount,
    documentErrorCount,
  };
}

function parseMebbisVehicleInventoryResult(
  job: MebbisJobResponse
): MebbisVehicleInventoryResult | null {
  if (!job.resultJson) return null;

  try {
    const parsed = JSON.parse(job.resultJson) as MebbisVehicleInventoryResult;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function isReadableMebbisVehicleRow(
  row: MebbisVehicleInventoryRow
): row is Required<Pick<MebbisVehicleInventoryRow, "plateNumber" | "licenseClass" | "brand">> &
  MebbisVehicleInventoryRow {
  return (
    normalizePlate(readMebbisString(row.plateNumber)).length > 0 &&
    parseLicenseClassCode(readMebbisString(row.licenseClass)).length > 0 &&
    readMebbisString(row.brand).length > 0
  );
}

function buildVehicleUpsertRequest(
  row: MebbisVehicleInventoryRow,
  existing: VehicleResponse | undefined
): VehicleUpsertRequest | null {
  const plateNumber = normalizePlate(readMebbisString(row.plateNumber));
  const licenseClass = parseLicenseClassCode(readMebbisString(row.licenseClass));
  const brand = readMebbisString(row.brand);
  if (!plateNumber || !licenseClass || !brand) return null;

  const model = readMebbisString(row.model);
  const modelYear = readMebbisNumber(row.modelYear);
  const licenseClasses = uniqueStrings([...(existing?.licenseClasses ?? []), licenseClass]);
  const registrationDate = parseMebbisDate(readMebbisString(row.registrationDate));
  const serviceStartDate = parseMebbisDate(readMebbisString(row.serviceStartDate));

  return {
    plateNumber,
    brand,
    model: model && model !== String(modelYear ?? "") ? model : existing?.model ?? null,
    modelYear: modelYear ?? existing?.modelYear ?? null,
    color: existing?.color ?? null,
    status: existing?.status ?? "idle",
    isActive: isMebbisVehicleActive(readMebbisString(row.vehicleStatus)),
    isSimulator: false,
    transmissionType: mapMebbisTransmission(row.transmission, existing?.transmissionType),
    vehicleType: mapMebbisVehicleType(licenseClass, existing?.vehicleType),
    licenseClasses,
    ownershipType: mapMebbisOwnership(row.ownershipStatus, existing?.ownershipType),
    fuelType: existing?.fuelType ?? null,
    odometerValue: existing?.odometerValue ?? null,
    odometerUnit: existing?.odometerUnit ?? "km",
    registrationDate: registrationDate ?? existing?.registrationDate ?? null,
    serviceStartDate: serviceStartDate ?? existing?.serviceStartDate ?? null,
    accidentNotes: existing?.accidentNotes ?? null,
    otherDetails: mergeVehicleDetails(existing?.otherDetails, row),
    notes: existing?.notes ?? null,
  };
}

async function upsertMebbisInspectionDocument(
  vehicle: VehicleResponse,
  row: MebbisVehicleInventoryRow,
  documents: VehicleDocumentResponse[]
): Promise<boolean> {
  const endDate = parseMebbisDate(readMebbisString(row.inspectionValidUntil));
  if (!endDate) return false;

  const existing = selectInspectionDocument(documents, endDate);
  const startDate =
    existing?.startDate ??
    vehicle.serviceStartDate ??
    vehicle.registrationDate ??
    parseMebbisDate(readMebbisString(row.serviceStartDate)) ??
    parseMebbisDate(readMebbisString(row.registrationDate)) ??
    endDate;
  const notes = "MEBBIS araç listesinden aktarıldı.";

  if (existing) {
    if (existing.endDate === endDate && existing.startDate === startDate && existing.notes === notes) {
      return false;
    }

    await updateVehicleDocument(vehicle.id, existing.id, {
      documentType: "inspection",
      startDate,
      endDate,
      notes,
      rowVersion: existing.rowVersion,
    });
    return true;
  }

  await createVehicleDocument(vehicle.id, {
    documentType: "inspection",
    startDate,
    endDate,
    notes,
  });
  return true;
}

async function upsertMebbisInsuranceDocument(
  vehicle: VehicleResponse,
  row: MebbisVehicleInventoryRow,
  documents: VehicleDocumentResponse[]
): Promise<boolean> {
  const startDate = parseMebbisDate(readMebbisString(row.insuranceStartDate));
  if (!startDate) return false;

  const endDate = addOneYear(startDate);
  const existing = selectVehicleDocument(documents, "insurance", endDate);
  const documentNumber = readMebbisString(row.insuranceDocumentNumber);
  const notes = documentNumber
    ? `MEBBIS trafik sigortası belge no: ${documentNumber}`
    : "MEBBIS araç detayından aktarıldı.";

  if (existing) {
    if (existing.startDate === startDate && existing.endDate === endDate && existing.notes === notes) {
      return false;
    }

    await updateVehicleDocument(vehicle.id, existing.id, {
      documentType: "insurance",
      startDate,
      endDate,
      notes,
      rowVersion: existing.rowVersion,
    });
    return true;
  }

  await createVehicleDocument(vehicle.id, {
    documentType: "insurance",
    startDate,
    endDate,
    notes,
  });
  return true;
}

function selectInspectionDocument(
  documents: VehicleDocumentResponse[],
  endDate: string
): VehicleDocumentResponse | null {
  return selectVehicleDocument(documents, "inspection", endDate);
}

function selectVehicleDocument(
  documents: VehicleDocumentResponse[],
  documentType: "insurance" | "inspection",
  endDate: string
): VehicleDocumentResponse | null {
  const typedDocuments = documents.filter((document) => document.documentType === documentType);
  return (
    typedDocuments.find((document) => document.endDate === endDate) ??
    typedDocuments
      .slice()
      .sort((left, right) => right.endDate.localeCompare(left.endDate))[0] ??
    null
  );
}

function readMebbisString(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function readMebbisNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value !== "string") return null;
  const parsed = Number.parseInt(value.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePlate(value: string): string {
  return value.replace(/\s+/g, "").toLocaleUpperCase("tr-TR").trim();
}

function normalizeComparable(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[İI]/g, "I")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C");
}

function parseLicenseClassCode(value: string): LicenseClass {
  return normalizeComparable(value)
    .replace(/\bSINIFI\b/g, " ")
    .replace(/\bSERTIFIKA\b/g, " ")
    .replace(/\bSERTIFIKASI\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")[0] || "";
}

function parseMebbisDate(value: string): string | null {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  return `${match[3]}-${month}-${day}`;
}

function addOneYear(isoDate: string): string {
  const [yearText, month, day] = isoDate.split("-");
  const year = Number.parseInt(yearText, 10);
  if (!Number.isFinite(year) || !month || !day) return isoDate;
  return `${year + 1}-${month}-${day}`;
}

function isMebbisVehicleActive(value: string): boolean {
  const normalized = normalizeComparable(value);
  return normalized.includes("HIZMETTE");
}

function mapMebbisTransmission(
  value: unknown,
  fallback: VehicleTransmissionType | undefined
): VehicleTransmissionType {
  const normalized = normalizeComparable(readMebbisString(value));
  if (normalized.includes("OTOMATIK")) return "automatic";
  if (normalized.includes("MANUEL")) return "manual";
  return fallback ?? "manual";
}

function mapMebbisOwnership(
  value: unknown,
  fallback: VehicleOwnershipType | undefined
): VehicleOwnershipType {
  const normalized = normalizeComparable(readMebbisString(value));
  if (normalized.includes("KIRALIK")) return "leased";
  if (normalized.includes("KURUMA AIT")) return "owned";
  return fallback ?? "owned";
}

function mapMebbisVehicleType(
  licenseClass: LicenseClass,
  fallback: VehicleType | undefined
): VehicleType {
  return /^A\d?$/i.test(licenseClass) ? "motorcycle" : fallback ?? "automobile";
}

function mergeVehicleDetails(
  current: string | null | undefined,
  row: MebbisVehicleInventoryRow
): string | null {
  const details = [
    readMebbisString(row.institutionApprovalStatus)
      ? `Kurum onayı: ${readMebbisString(row.institutionApprovalStatus)}`
      : null,
    readMebbisString(row.memApprovalStatus)
      ? `MEM onayı: ${readMebbisString(row.memApprovalStatus)}`
      : null,
    readMebbisString(row.serviceEndDate)
      ? `Hizmetten çıkış: ${readMebbisString(row.serviceEndDate)}`
      : null,
  ].filter(Boolean);
  const next = details.join(" | ");
  if (!next) return current ?? null;
  if (current?.includes("Kurum onayı:") || current?.includes("MEM onayı:")) return current;
  return current ? `${current}\n${next}` : next;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
