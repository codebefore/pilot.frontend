import { useEffect, useState } from "react";

import { getLicenseClassDefinitions } from "./license-class-definitions-api";
import { LICENSE_CLASS_DEFINITION_CATEGORY_LABELS } from "./license-class-definition-catalog";
import type { LicenseClassDefinitionResponse } from "./types";

export type LicenseClassOption = {
  value: string;
  label: string;
};

export type ExistingLicenseTypeOption = LicenseClassOption;

function toExistingLicenseValue(code: string): string {
  return code.trim().toLowerCase();
}

function toOption(item: LicenseClassDefinitionResponse): LicenseClassOption {
  const code = item.code.trim();
  const name = item.name.trim();
  const fallbackName = LICENSE_CLASS_DEFINITION_CATEGORY_LABELS[item.category] ?? item.category;
  const labelName = name || fallbackName;

  return { value: code, label: labelName === code ? code : `${code} - ${labelName}` };
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

export async function getActiveLicenseClassOptions(signal?: AbortSignal) {
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

export async function getActiveExistingLicenseTypeOptions(signal?: AbortSignal) {
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
