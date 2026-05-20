import { getInstitutionSettings } from "./institution-settings-api";
import type { Institution, InstitutionType } from "./types";

const FALLBACK_INSTITUTION: Institution = {
  id: "institution-settings",
  name: "Kurum ayarı yok",
  type: "Kurum",
};

export async function getInstitutions(signal?: AbortSignal): Promise<Institution[]> {
  const settings = await getInstitutionSettings(signal).catch((error: unknown) => {
    if ((error as { name?: string }).name === "AbortError") throw error;
    return null;
  });
  if (!settings) {
    return [FALLBACK_INSTITUTION];
  }

  return [
    {
      id: settings.id,
      name:
        settings.institutionName?.trim() ||
        settings.institutionOfficialName?.trim() ||
        FALLBACK_INSTITUTION.name,
      type: resolveInstitutionType(settings.institutionOfficialName ?? settings.institutionName),
    },
  ];
}

function resolveInstitutionType(name?: string | null): InstitutionType {
  const normalized = (name ?? "").toLocaleLowerCase("tr-TR");
  if (normalized.includes("src")) return "SRC";
  if (normalized.includes("psikoteknik")) return "Psikoteknik";
  if (normalized.includes("iş mak") || normalized.includes("is mak")) return "İş Mak.";
  return "MTSK";
}
