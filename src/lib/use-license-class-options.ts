import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { getLicenseClassDefinitions } from "./license-class-definitions-api";
import { LICENSE_CLASS_DEFINITION_CATEGORY_LABEL_KEYS } from "./license-class-definition-catalog";
import { useT, type TranslationKey } from "./i18n";
import type { LicenseClassDefinitionResponse } from "./types";

export type LicenseClassOption = {
  value: string;
  label: string;
};

type ExistingLicenseTypeOption = LicenseClassOption;

const ACTIVE_LICENSE_CLASS_DEFINITIONS_QUERY_KEY = [
  "licenseClassDefinitions",
  "options",
  "active",
] as const;

function toExistingLicenseValue(code: string): string {
  return code.trim().toLowerCase();
}

function toOption(item: LicenseClassDefinitionResponse, translateCategory: (cat: LicenseClassDefinitionResponse["category"]) => string): LicenseClassOption {
  const code = item.code.trim();
  const name = item.name.trim();
  const fallbackName = translateCategory(item.category);
  const labelName = stripCodeSuffixesFromName(name || fallbackName, code);

  return { value: code, label: labelName === code ? code : `${code} - ${labelName}` };
}

/**
 * Drop trailing modifier words from the name when the code already carries
 * them (e.g. code "A1-OTOMATIK" + name "Motosiklet - Otomatik" → "Motosiklet").
 * Compares normalized to be case- and diacritic-insensitive.
 */
function stripCodeSuffixesFromName(name: string, code: string): string {
  const codeTokens = code
    .split(/[\s\-_]+/)
    .map(normalizeForCompare)
    .filter((token) => token.length > 0);
  if (codeTokens.length === 0) return name;

  let result = name;
  // Strip from the tail repeatedly so e.g. "Engelli Otomobil - Engelli - Otomatik" collapses fully.
  // Each iteration peels off one trailing " - <segment>" if it matches a code token.
  // Stops when the tail no longer matches.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const match = result.match(/^(.*?)\s*-\s*([^-]+?)\s*$/);
    if (!match) break;
    const tail = normalizeForCompare(match[2]);
    if (!codeTokens.includes(tail)) break;
    result = match[1].trim();
    if (result.length === 0) break;
  }
  return result.length > 0 ? result : name;
}

function normalizeForCompare(value: string): string {
  // Use invariant lowercase: tr-TR maps "I" to dotless "ı", which would make
  // "OTOMATIK" not equal "Otomatik" when compared.
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "");
}

function toExistingLicenseTypeOption(option: LicenseClassOption): ExistingLicenseTypeOption {
  return {
    value: toExistingLicenseValue(option.value),
    label: option.label,
  };
}

function uniqueTargetOptions(
  items: LicenseClassDefinitionResponse[],
  translateCategory: (cat: LicenseClassDefinitionResponse["category"]) => string,
): LicenseClassOption[] {
  const preferredByCode = new Map<string, LicenseClassDefinitionResponse>();

  for (const item of items) {
    const key = item.code.trim().toLocaleUpperCase("tr-TR");
    const current = preferredByCode.get(key);
    if (!current || isPreferredTargetOption(item, current)) {
      preferredByCode.set(key, item);
    }
  }

  return [...preferredByCode.values()]
    .sort((a, b) => a.displayOrder - b.displayOrder || a.code.localeCompare(b.code, "tr"))
    .map((item) => toOption(item, translateCategory));
}

function isPreferredTargetOption(
  candidate: LicenseClassDefinitionResponse,
  current: LicenseClassDefinitionResponse
): boolean {
  if (candidate.hasExistingLicense !== current.hasExistingLicense) {
    return !candidate.hasExistingLicense;
  }

  return (
    candidate.displayOrder < current.displayOrder ||
    (candidate.displayOrder === current.displayOrder &&
      candidate.name.localeCompare(current.name, "tr") < 0)
  );
}

async function getActiveLicenseClassDefinitions(signal?: AbortSignal) {
  const activeResponse = await getLicenseClassDefinitions(
    {
      activity: "active",
      page: 1,
      pageSize: 1000,
      sortBy: "displayOrder",
      sortDir: "asc",
    },
    signal
  );
  return activeResponse.items;
}

export async function getActiveInitialLicenseClassOptions(
  signal?: AbortSignal,
  translateCategory?: (cat: LicenseClassDefinitionResponse["category"]) => string,
) {
  const items = await getActiveLicenseClassDefinitions(signal);
  const translate = translateCategory ?? ((cat) => cat);
  const activeOptions = uniqueTargetOptions(
    items.filter((item) => !item.hasExistingLicense),
    translate,
  );
  return activeOptions;
}

export function useLicenseClassOptions() {
  const t = useT();
  const translateCategory = (cat: LicenseClassDefinitionResponse["category"]) =>
    LICENSE_CLASS_DEFINITION_CATEGORY_LABEL_KEYS[cat] ? t(LICENSE_CLASS_DEFINITION_CATEGORY_LABEL_KEYS[cat] as TranslationKey) : cat;
  const query = useQuery({
    queryKey: ACTIVE_LICENSE_CLASS_DEFINITIONS_QUERY_KEY,
    queryFn: () => getActiveLicenseClassDefinitions(),
    staleTime: 5 * 60_000,
  });
  const options = useMemo(
    () => uniqueTargetOptions(query.data ?? [], translateCategory),
    [query.data, translateCategory]
  );

  return { options, loading: query.isLoading };
}

export function useInitialLicenseClassOptions() {
  const t = useT();
  const translateCategory = (cat: LicenseClassDefinitionResponse["category"]) =>
    LICENSE_CLASS_DEFINITION_CATEGORY_LABEL_KEYS[cat] ? t(LICENSE_CLASS_DEFINITION_CATEGORY_LABEL_KEYS[cat] as TranslationKey) : cat;
  const query = useQuery({
    queryKey: ACTIVE_LICENSE_CLASS_DEFINITIONS_QUERY_KEY,
    queryFn: () => getActiveLicenseClassDefinitions(),
    staleTime: 5 * 60_000,
  });
  const options = useMemo(
    () => uniqueTargetOptions((query.data ?? []).filter((item) => !item.hasExistingLicense), translateCategory),
    [query.data, translateCategory]
  );

  return { options, loading: query.isLoading };
}

export function useExistingLicenseTypeOptions(enabled = true) {
  const t = useT();
  const translateCategory = (cat: LicenseClassDefinitionResponse["category"]) =>
    LICENSE_CLASS_DEFINITION_CATEGORY_LABEL_KEYS[cat] ? t(LICENSE_CLASS_DEFINITION_CATEGORY_LABEL_KEYS[cat] as TranslationKey) : cat;
  const query = useQuery({
    queryKey: ACTIVE_LICENSE_CLASS_DEFINITIONS_QUERY_KEY,
    queryFn: () => getActiveLicenseClassDefinitions(),
    enabled,
    staleTime: 5 * 60_000,
  });
  const options = useMemo(
    () => uniqueTargetOptions(query.data ?? [], translateCategory).map(toExistingLicenseTypeOption),
    [query.data, translateCategory]
  );

  return { options, loading: query.isLoading };
}
