import {
  createInstructor,
  getInstructors,
  markInstructorLeft,
  updateInstructor,
  uploadInstructorPhoto,
} from "./instructors-api";
import {
  createAssignment,
  listAssignments,
  updateAssignment,
} from "./instructor-assignments-api";
import type { MebbisJobResponse } from "./mebbis-jobs-api";
import type {
  InstructorAssignmentUpsertRequest,
  InstructorBranch,
  InstructorCreateRequest,
  InstructorEmploymentType,
  InstructorResponse,
  InstructorRole,
  InstructorUpsertRequest,
  LicenseClass,
} from "./types";

type MebbisInstructorInventoryRow = {
  nationalId?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  fullName?: unknown;
  role?: unknown;
  branch?: unknown;
  licenseClass?: unknown;
  licenseClasses?: unknown;
  mebbisPermitNo?: unknown;
  contractStartDate?: unknown;
  contractEndDate?: unknown;
  leftAtDate?: unknown;
  weeklyLessonHours?: unknown;
  phoneNumber?: unknown;
  email?: unknown;
  photoDataUrl?: unknown;
  employmentStatus?: unknown;
  educationInfo?: unknown;
  status?: unknown;
};

type MebbisInstructorInventoryResult = {
  instructors?: MebbisInstructorInventoryRow[];
};

export type MebbisInstructorInventoryApplyResult = {
  importedCount: number;
  createdCount: number;
  updatedCount: number;
};

export async function applyMebbisInstructorInventory(
  job: MebbisJobResponse
): Promise<MebbisInstructorInventoryApplyResult> {
  const result = parseMebbisInstructorInventoryResult(job);
  const importedRows = result?.instructors?.filter(isReadableMebbisInstructorRow) ?? [];
  if (importedRows.length === 0) {
    return {
      importedCount: 0,
      createdCount: 0,
      updatedCount: 0,
    };
  }

  const existingResponse = await getInstructors({ activity: "all", page: 1, pageSize: 1000 });
  const existingByNationalId = new Map(
    existingResponse.items
      .filter((instructor) => instructor.nationalId)
      .map((instructor) => [normalizeDigits(instructor.nationalId ?? ""), instructor])
  );
  const existingByName = new Map(
    existingResponse.items.map((instructor) => [
      normalizeComparable(`${instructor.firstName} ${instructor.lastName}`),
      instructor,
    ])
  );

  let createdCount = 0;
  let updatedCount = 0;
  for (const imported of importedRows) {
    const nationalId = normalizeDigits(readMebbisString(imported.nationalId));
    const fullNameKey = normalizeComparable(readMebbisFullName(imported));
    const existingByTc = nationalId ? existingByNationalId.get(nationalId) : undefined;
    const existing = existingByTc ?? existingByName.get(fullNameKey);
    const request = buildInstructorUpsertRequest(imported, existing);
    if (!request) continue;

    if (!existing) {
      const saved = await createInstructor(request);
      await uploadMebbisInstructorPhotoIfNeeded(saved, imported);
      createdCount += 1;
      if (saved.nationalId) existingByNationalId.set(normalizeDigits(saved.nationalId), saved);
      existingByName.set(normalizeComparable(`${saved.firstName} ${saved.lastName}`), saved);
    } else if (existingByTc) {
      await upsertMebbisInstructorAssignment(existing, imported);
    } else {
      const updateRequest: InstructorUpsertRequest = {
        firstName: request.firstName,
        lastName: request.lastName,
        nationalId: request.nationalId,
        phoneNumber: request.phoneNumber,
        email: request.email,
        isActive: request.isActive,
        assignedVehicleId: request.assignedVehicleId,
        notes: request.notes,
        rowVersion: existing.rowVersion,
      };
      const saved = await updateInstructor(existing.id, updateRequest);
      await upsertMebbisInstructorAssignment(saved, imported);
      await applyMebbisInstructorLeaveState(saved, imported);
      await uploadMebbisInstructorPhotoIfNeeded(saved, imported);
      updatedCount += 1;
      if (saved.nationalId) existingByNationalId.set(normalizeDigits(saved.nationalId), saved);
      existingByName.set(normalizeComparable(`${saved.firstName} ${saved.lastName}`), saved);
    }
  }

  return {
    importedCount: importedRows.length,
    createdCount,
    updatedCount,
  };
}

function parseMebbisInstructorInventoryResult(
  job: MebbisJobResponse
): MebbisInstructorInventoryResult | null {
  if (!job.resultJson) return null;

  try {
    const parsed = JSON.parse(job.resultJson) as MebbisInstructorInventoryResult;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function isReadableMebbisInstructorRow(row: MebbisInstructorInventoryRow): boolean {
  const name = readMebbisFullName(row);
  return name.length > 0 || normalizeDigits(readMebbisString(row.nationalId)).length === 11;
}

function buildInstructorUpsertRequest(
  row: MebbisInstructorInventoryRow,
  existing: InstructorResponse | undefined
): InstructorCreateRequest | null {
  const names = splitInstructorName(row, existing);
  if (!names.firstName || !names.lastName) return null;

  const nationalId = normalizeDigits(readMebbisString(row.nationalId));
  const phoneNumber = normalizeDigits(readMebbisString(row.phoneNumber));
  const email = readMebbisString(row.email);
  const assignmentRequest = buildMebbisInstructorAssignmentRequest(row, existing);

  const request: InstructorCreateRequest = {
    firstName: names.firstName.toLocaleUpperCase("tr-TR"),
    lastName: names.lastName.toLocaleUpperCase("tr-TR"),
    nationalId: nationalId.length === 11 ? nationalId : existing?.nationalId ?? null,
    driverLicenseNumber: existing?.driverLicenseNumber ?? null,
    driverLicenseTypeText: existing?.driverLicenseTypeText ?? null,
    driverLicenseIssuedPlace: existing?.driverLicenseIssuedPlace ?? null,
    driverLicenseAddress: existing?.driverLicenseAddress ?? null,
    phoneNumber: phoneNumber || (existing?.phoneNumber ?? null),
    email: email || (existing?.email ?? null),
    isActive: mapMebbisInstructorActive(row.status, existing),
    assignedVehicleId: existing?.assignedVehicleId ?? null,
    notes: mergeInstructorNotes(existing?.notes, row),
  };

  if (!existing) {
    request.initialAssignment = assignmentRequest;
  }

  return request;
}

async function upsertMebbisInstructorAssignment(
  instructor: InstructorResponse,
  row: MebbisInstructorInventoryRow
) {
  const request = buildMebbisInstructorAssignmentRequest(row, instructor);
  if (!request) return;

  const assignments = await listAssignments(instructor.id);
  const permitNo = readMebbisString(row.mebbisPermitNo);
  const matchingAssignment = permitNo
    ? assignments.find((assignment) => assignment.mebPermitNo === permitNo)
    : undefined;

  if (!matchingAssignment) {
    await createAssignment(instructor.id, request);
    return;
  }

  await updateAssignment(instructor.id, matchingAssignment.id, {
    ...request,
    rowVersion: matchingAssignment.rowVersion,
  });
}

async function applyMebbisInstructorLeaveState(
  instructor: InstructorResponse,
  row: MebbisInstructorInventoryRow
) {
  const leftAtDate = parseMebbisDate(readMebbisString(row.leftAtDate));
  const status = readMebbisString(row.status);
  if (!leftAtDate || instructor.leftAtDate) return;

  await markInstructorLeft(instructor.id, {
    leftAtDate,
    reason: status || null,
    rowVersion: instructor.rowVersion,
  });
}

async function uploadMebbisInstructorPhotoIfNeeded(
  instructor: InstructorResponse,
  row: MebbisInstructorInventoryRow
) {
  if (instructor.hasPhoto) return;
  const file = buildMebbisInstructorPhotoFile(row, instructor);
  if (!file) return;
  await uploadInstructorPhoto(instructor.id, file);
}

function buildMebbisInstructorPhotoFile(
  row: MebbisInstructorInventoryRow,
  instructor: InstructorResponse
): File | null {
  const dataUrl = readMebbisString(row.photoDataUrl);
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;

  const contentType = match[1];
  const extension = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";
  try {
    const binary = window.atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new File(
      [bytes],
      `${normalizeComparable(`${instructor.firstName}-${instructor.lastName}`) || "mebbis-photo"}.${extension}`,
      { type: contentType }
    );
  } catch {
    return null;
  }
}

function buildMebbisInstructorAssignmentRequest(
  row: MebbisInstructorInventoryRow,
  existing: InstructorResponse | undefined
): InstructorAssignmentUpsertRequest {
  const contractStartDate =
    parseMebbisDate(readMebbisString(row.contractStartDate)) ??
    existing?.contractStartDate ??
    todayIsoDate();
  const contractEndDate =
    parseMebbisDate(readMebbisString(row.contractEndDate)) ??
    existing?.contractEndDate ??
    null;
  const branches = mapMebbisInstructorBranches(row.branch);
  const hasPracticeBranch = branches.includes("practice");
  const licenseClassCodes = hasPracticeBranch ? readMebbisLicenseClasses(row) : [];

  return {
    role: mapMebbisInstructorRole(row.role),
    employmentType: mapMebbisInstructorEmploymentType(row.employmentStatus),
    branches,
    licenseClassCodes:
      hasPracticeBranch
        ? licenseClassCodes.length > 0
          ? licenseClassCodes
          : existing?.licenseClassCodes.length
            ? existing.licenseClassCodes
            : ["B" as LicenseClass]
        : [],
    weeklyLessonHours: readMebbisNumber(row.weeklyLessonHours),
    mebPermitNo: readMebbisString(row.mebbisPermitNo) || null,
    contractStartDate,
    contractEndDate,
  };
}

function splitInstructorName(
  row: MebbisInstructorInventoryRow,
  existing: InstructorResponse | undefined
): { firstName: string; lastName: string } {
  const firstName = readMebbisString(row.firstName);
  const lastName = readMebbisString(row.lastName);
  if (firstName && lastName) return { firstName, lastName };
  const fullName = readMebbisFullName(row);
  const parts = fullName.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return {
      firstName: parts.slice(0, -1).join(" "),
      lastName: parts.slice(-1)[0],
    };
  }

  return {
    firstName: firstName || existing?.firstName || "",
    lastName: lastName || existing?.lastName || "",
  };
}

function readMebbisFullName(row: MebbisInstructorInventoryRow): string {
  return (
    readMebbisString(row.fullName) ||
    [readMebbisString(row.firstName), readMebbisString(row.lastName)].filter(Boolean).join(" ")
  ).trim();
}

function readMebbisString(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function readMebbisNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number.parseInt(normalizeDigits(readMebbisString(value)), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function readMebbisStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => readMebbisString(item)).filter(Boolean)
    : [];
}

function normalizeDigits(value: string): string {
  return value.replace(/[^\d]/g, "");
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

function parseLicenseClassCode(value: string): LicenseClass | "" {
  return normalizeComparable(value)
    .replace(/\bSINIFI\b/g, " ")
    .replace(/\bSERTIFIKA\b/g, " ")
    .replace(/\bSERTIFIKASI\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")[0] || "";
}

function readMebbisLicenseClasses(row: MebbisInstructorInventoryRow): LicenseClass[] {
  const values = [
    ...readMebbisStringArray(row.licenseClasses),
    readMebbisString(row.licenseClass),
  ];
  const codes = values.map(parseLicenseClassCode).filter(Boolean);
  return [...new Set(codes)] as LicenseClass[];
}

function parseMebbisDate(value: string): string | null {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  return `${match[3]}-${month}-${day}`;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapMebbisInstructorActive(
  value: unknown,
  existing: InstructorResponse | undefined
): boolean {
  const normalized = normalizeComparable(readMebbisString(value));
  if (
    normalized.includes("PASIF") ||
    normalized.includes("AYRIL") ||
    normalized.includes("IPTAL") ||
    normalized.includes("FESIH") ||
    (normalized && normalized !== "GOREVDE" && !normalized.includes("AKTIF"))
  ) {
    return false;
  }
  if (normalized.includes("AKTIF") || normalized === "A" || normalized === "GOREVDE") return true;
  return existing?.isActive ?? true;
}

function mapMebbisInstructorRole(value: unknown): InstructorRole {
  const normalized = normalizeComparable(readMebbisString(value));
  if (normalized.includes("YARDIMCI") && normalized.includes("MUDUR")) return "assistant_manager";
  if (normalized.includes("MUDUR")) return "manager";
  if (normalized.includes("UZMAN")) return "specialist_instructor";
  if (normalized.includes("PSIKOLOG")) return "psychologist";
  if (normalized.includes("MUHASEBE")) return "accounting";
  if (normalized.includes("BÜRO") || normalized.includes("BURO") || normalized.includes("MEMUR")) return "office_staff";
  return "master_instructor";
}

function mapMebbisInstructorEmploymentType(value: unknown): InstructorEmploymentType {
  const normalized = normalizeComparable(readMebbisString(value));
  if (normalized.includes("AYLIK")) return "salaried";
  if (normalized.includes("UCRET")) return "hourly";
  return "hourly";
}

function mapMebbisInstructorBranches(value: unknown): InstructorBranch[] {
  const normalized = normalizeComparable(readMebbisString(value));
  const branches = new Set<InstructorBranch>();
  if (normalized.includes("DIREKSIYON") || normalized.includes("UYGULAMA")) {
    branches.add("practice");
  }
  const hasTraffic = normalized.includes("TRAFIK") || normalized.includes("CEVRE");
  const hasFirstAid = normalized.includes("ILK YARDIM") || normalized.includes("ILKYARDIM");
  const hasVehicleTechnique =
    normalized.includes("MOTOR") ||
    normalized.includes("ARAC TEKNIGI") ||
    normalized.includes("ARAC TEKNIK");
  const hasTrafficEthics = hasTraffic || normalized.includes("TRAFIK ADAB");
  if (hasTraffic) {
    branches.add("traffic");
  }
  if (hasFirstAid) {
    branches.add("first_aid");
  }
  if (hasVehicleTechnique) {
    branches.add("vehicle_technique");
  }
  if (hasTrafficEthics) {
    branches.add("traffic_ethics");
  }
  return [...branches];
}

function mergeInstructorNotes(
  current: string | null | undefined,
  row: MebbisInstructorInventoryRow
): string | null {
  const details = [
    readMebbisString(row.role) ? `MEBBIS görev: ${readMebbisString(row.role)}` : null,
    readMebbisString(row.employmentStatus)
      ? `MEBBIS statü: ${readMebbisString(row.employmentStatus)}`
      : null,
    readMebbisString(row.branch) ? `MEBBIS branş: ${readMebbisString(row.branch)}` : null,
    readMebbisString(row.status) ? `MEBBIS durum: ${readMebbisString(row.status)}` : null,
    readMebbisString(row.educationInfo)
      ? `MEBBIS öğrenim: ${readMebbisString(row.educationInfo)}`
      : null,
  ].filter(Boolean);
  const next = details.join(" | ");
  if (!next) return current ?? null;
  if (current?.includes("MEBBIS görev:") || current?.includes("MEBBIS branş:")) return current;
  return current ? `${current}\n${next}` : next;
}
