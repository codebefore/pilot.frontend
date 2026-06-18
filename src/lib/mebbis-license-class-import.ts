import {
  getLicenseClassDefinitions,
  updateLicenseClassDefinitionActivity,
} from "./license-class-definitions-api";
import type { MebbisJobResponse } from "./mebbis-jobs-api";
import type { LicenseClassDefinitionResponse } from "./types";

type MebbisLicenseClassInventoryResult = {
  programs?: Array<{
    programName?: unknown;
    licenseClassCode?: unknown;
  }>;
};

export type MebbisLicenseClassInventoryApplyResult = {
  matchedCount: number;
  activatedCount: number;
};

export async function applyMebbisLicenseClassInventory(
  job: MebbisJobResponse
): Promise<MebbisLicenseClassInventoryApplyResult> {
  const result = parseMebbisLicenseClassInventoryResult(job);
  if (!result) {
    return {
      matchedCount: 0,
      activatedCount: 0,
    };
  }

  const response = await getLicenseClassDefinitions({
    activity: "all",
    page: 1,
    pageSize: 1000,
  });
  const targetCodes = resolveMebbisLicenseClassCodes(result, response.items);
  const targetDefinitions = response.items.filter(
    (item) => !item.existingLicenseType && targetCodes.has(normalizeLicenseClassCode(item.code))
  );
  const inactiveTargets = targetDefinitions.filter((item) => !item.isActive);

  for (const definition of inactiveTargets) {
    await updateLicenseClassDefinitionActivity(definition.id, {
      isActive: true,
      rowVersion: definition.rowVersion,
    });
  }

  return {
    matchedCount: targetDefinitions.length,
    activatedCount: inactiveTargets.length,
  };
}

function normalizeLicenseClassCode(value: string): string {
  return value
    .trim()
    .toLocaleUpperCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[İI]/g, "I")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/\s+/g, "-");
}

function readMebbisLicenseClassCode(value: unknown): string {
  return typeof value === "string" ? normalizeLicenseClassCode(value) : "";
}

function parseMebbisLicenseClassInventoryResult(
  job: MebbisJobResponse
): MebbisLicenseClassInventoryResult | null {
  if (!job.resultJson) return null;
  try {
    const parsed = JSON.parse(job.resultJson) as MebbisLicenseClassInventoryResult;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function resolveMebbisLicenseClassCodes(
  result: MebbisLicenseClassInventoryResult,
  definitions: LicenseClassDefinitionResponse[]
): Set<string> {
  const availableCodes = new Set(definitions.map((item) => normalizeLicenseClassCode(item.code)));
  const targetCodes = new Set<string>();

  for (const program of result.programs ?? []) {
    const code = readMebbisLicenseClassCode(program.licenseClassCode);
    if (!code) continue;
    if (availableCodes.has(code)) targetCodes.add(code);

    const automaticCode = `${code}-OTOMATIK`;
    if (availableCodes.has(automaticCode)) {
      targetCodes.add(automaticCode);
    }
  }

  return targetCodes;
}
