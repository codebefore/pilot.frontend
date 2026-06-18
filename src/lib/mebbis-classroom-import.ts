import {
  createClassroom,
  getClassrooms,
  updateClassroom,
} from "./classrooms-api";
import type { MebbisJobResponse } from "./mebbis-jobs-api";
import { getTrainingBranchDefinitions } from "./training-branch-definitions-api";
import type { TrainingBranchDefinitionResponse } from "./types";

type MebbisClassroomInventoryRow = {
  classroomType?: unknown;
  classroomName?: unknown;
  capacity?: unknown;
  status?: unknown;
  approvalStatus?: unknown;
};

type MebbisClassroomInventoryResult = {
  classrooms?: MebbisClassroomInventoryRow[];
};

export type MebbisClassroomInventoryApplyResult = {
  importedCount: number;
  createdCount: number;
  updatedCount: number;
  missingTypes: string[];
};

export async function applyMebbisClassroomInventory(
  job: MebbisJobResponse
): Promise<MebbisClassroomInventoryApplyResult> {
  const result = parseMebbisClassroomInventoryResult(job);
  const importedRows = result?.classrooms?.filter(isReadableMebbisClassroomRow) ?? [];
  if (importedRows.length === 0) {
    return {
      importedCount: 0,
      createdCount: 0,
      updatedCount: 0,
      missingTypes: [],
    };
  }

  const [classroomResponse, branchResponse] = await Promise.all([
    getClassrooms({ activity: "all", page: 1, pageSize: 1000 }),
    getTrainingBranchDefinitions({ activity: "all", page: 1, pageSize: 200 }),
  ]);
  const branchByName = buildTrainingBranchLookup(branchResponse.items);
  const trafficEthicsBranch =
    resolveTrainingBranch("traffic_ethics", branchByName) ??
    resolveTrainingBranch("Trafik Adabı", branchByName);
  const existingByName = new Map(
    classroomResponse.items.map((classroom) => [normalizeComparable(classroom.name), classroom])
  );
  const groupedRows = groupMebbisClassroomRows(importedRows);
  let createdCount = 0;
  let updatedCount = 0;
  const missingTypes = new Set<string>();

  for (const imported of groupedRows) {
    const branchIds = imported.types
      .map((typeName) => {
        const branch = resolveTrainingBranch(typeName, branchByName);
        if (!branch) missingTypes.add(typeName);
        return branch?.id;
      })
      .filter((id): id is string => Boolean(id));
    if (trafficEthicsBranch) {
      branchIds.push(trafficEthicsBranch.id);
    }
    if (branchIds.length === 0) continue;

    const existing = existingByName.get(imported.normalizedName);
    if (!existing) {
      await createClassroom({
        name: formatMebbisClassroomName(imported.name),
        capacity: imported.capacity,
        isActive: true,
        branchIds: uniqueStrings(branchIds),
      });
      createdCount += 1;
      continue;
    }

    const existingBranchIds = existing.branches.map((branch) => branch.id);
    const nextBranchIds = uniqueStrings([...existingBranchIds, ...branchIds]);
    const needsUpdate =
      !existing.isActive ||
      existing.capacity !== imported.capacity ||
      nextBranchIds.length !== existingBranchIds.length;

    if (needsUpdate) {
      await updateClassroom(existing.id, {
        name: existing.name,
        capacity: imported.capacity,
        isActive: true,
        notes: existing.notes,
        branchIds: nextBranchIds,
        rowVersion: existing.rowVersion,
      });
      updatedCount += 1;
    }
  }

  return {
    importedCount: importedRows.length,
    createdCount,
    updatedCount,
    missingTypes: [...missingTypes],
  };
}

function parseMebbisClassroomInventoryResult(
  job: MebbisJobResponse
): MebbisClassroomInventoryResult | null {
  if (!job.resultJson) return null;

  try {
    const parsed = JSON.parse(job.resultJson) as MebbisClassroomInventoryResult;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function isReadableMebbisClassroomRow(
  row: MebbisClassroomInventoryRow
): row is Required<Pick<MebbisClassroomInventoryRow, "classroomName" | "classroomType" | "capacity">> &
  MebbisClassroomInventoryRow {
  return (
    readMebbisString(row.classroomName).length > 0 &&
    readMebbisString(row.classroomType).length > 0 &&
    readMebbisNumber(row.capacity) > 0
  );
}

function groupMebbisClassroomRows(rows: MebbisClassroomInventoryRow[]) {
  const grouped = new Map<
    string,
    {
      normalizedName: string;
      name: string;
      capacity: number;
      types: string[];
    }
  >();

  for (const row of rows) {
    const name = readMebbisString(row.classroomName);
    const type = readMebbisString(row.classroomType);
    const capacity = readMebbisNumber(row.capacity);
    const normalizedName = normalizeComparable(name);
    if (!normalizedName || !type || capacity <= 0) continue;

    const current = grouped.get(normalizedName);
    if (!current) {
      grouped.set(normalizedName, {
        normalizedName,
        name,
        capacity,
        types: [type],
      });
      continue;
    }

    current.capacity = Math.max(current.capacity, capacity);
    current.types = uniqueStrings([...current.types, type]);
  }

  return [...grouped.values()];
}

function buildTrainingBranchLookup(branches: TrainingBranchDefinitionResponse[]) {
  return branches.map((branch) => ({
    branch,
    normalizedName: normalizeBranchType(branch.name),
    normalizedCode: normalizeBranchType(branch.code),
  }));
}

function resolveTrainingBranch(
  mebbisType: string,
  lookup: ReturnType<typeof buildTrainingBranchLookup>
): TrainingBranchDefinitionResponse | null {
  const normalizedType = normalizeBranchType(mebbisType);
  return (
    lookup.find(
      (item) =>
        item.normalizedName === normalizedType ||
        item.normalizedCode === normalizedType ||
        normalizedType.includes(item.normalizedName) ||
        item.normalizedName.includes(normalizedType)
    )?.branch ?? null
  );
}

function readMebbisString(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function readMebbisNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value !== "string") return 0;
  const parsed = Number.parseInt(value.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeBranchType(value: string): string {
  return normalizeComparable(value)
    .replace(/BILGISI$/u, "")
    .replace(/DERSI$/u, "")
    .replace(/DERS$/u, "");
}

function normalizeComparable(value: string): string {
  return value
    .replace(/[İIı]/g, "i")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, "")
    .toLocaleUpperCase("en-US");
}

function formatMebbisClassroomName(name: string): string {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .split(" ")
    .map((part) => (part ? `${part[0].toLocaleUpperCase("tr-TR")}${part.slice(1)}` : part))
    .join(" ");
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
