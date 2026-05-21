import { useEffect, useState } from "react";

import { getLicenseClassDefinitions } from "./license-class-definitions-api";
import { LICENSE_CLASS_DEFINITION_CATEGORY_LABELS } from "./license-class-definition-catalog";
import type { LicenseClassDefinitionResponse } from "./types";

export type LicenseClassOption = {
  value: string;
  label: string;
};

type ExistingLicenseTypeOption = LicenseClassOption;

function toExistingLicenseValue(code: string): string {
  return code.trim().toLowerCase();
}

function toOption(item: LicenseClassDefinitionResponse): LicenseClassOption {
  const code = item.code.trim();
  const name = item.name.trim();
  const fallbackName = LICENSE_CLASS_DEFINITION_CATEGORY_LABELS[item.category] ?? item.category;
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

function uniqueTargetOptions(items: LicenseClassDefinitionResponse[]): LicenseClassOption[] {
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
    .map(toOption);
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

async function getActiveLicenseClassOptions(signal?: AbortSignal) {
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
  const activeOptions = uniqueTargetOptions(activeResponse.items);
  return activeOptions;
}

export async function getActiveInitialLicenseClassOptions(signal?: AbortSignal) {
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
  const activeOptions = uniqueTargetOptions(
    activeResponse.items.filter((item) => !item.hasExistingLicense)
  );
  return activeOptions;
}

async function getActiveExistingLicenseTypeOptions(signal?: AbortSignal) {
  const options = await getActiveLicenseClassOptions(signal);
  return options.map(toExistingLicenseTypeOption);
}

export function useLicenseClassOptions() {
  const [options, setOptions] = useState<LicenseClassOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    getActiveLicenseClassOptions(controller.signal)
      .then((nextOptions) => setOptions(nextOptions))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setOptions([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  return { options, loading };
}

export function useInitialLicenseClassOptions() {
  const [options, setOptions] = useState<LicenseClassOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    getActiveInitialLicenseClassOptions(controller.signal)
      .then((nextOptions) => setOptions(nextOptions))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setOptions([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  return { options, loading };
}

export function useExistingLicenseTypeOptions() {
  const [options, setOptions] = useState<ExistingLicenseTypeOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    getActiveExistingLicenseTypeOptions(controller.signal)
      .then((nextOptions) => setOptions(nextOptions))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setOptions([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  return { options, loading };
}
