import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { getLicenseClassDefinitions } from "./license-class-definitions-api";
import type { LicenseClassDefinitionResponse } from "./types";

export type LicenseClassOption = {
  value: string;
  label: string;
  licenseClassDefinitionId?: string;
};

type ExistingLicenseTypeOption = LicenseClassOption;

const ACTIVE_LICENSE_CLASS_DEFINITIONS_QUERY_KEY = [
  "licenseClassDefinitions",
  "options",
  "active",
  "institution",
] as const;

const GLOBAL_ACTIVE_LICENSE_CLASS_DEFINITIONS_QUERY_KEY = [
  "licenseClassDefinitions",
  "options",
  "active",
  "global",
] as const;

function normalizeLicenseValue(value: string): string {
  return value.trim().toLocaleUpperCase("tr-TR");
}

function toExistingLicenseValue(code: string): string {
  return code.trim();
}

function toOption(item: LicenseClassDefinitionResponse): LicenseClassOption {
  const code = item.code.trim();
  return { value: code, label: code, licenseClassDefinitionId: item.id };
}

export function mergeLicenseClassOptionsWithValues(
  options: readonly LicenseClassOption[],
  values: Iterable<string | null | undefined>
): LicenseClassOption[] {
  const byValue = new Map(options.map((option) => [option.value, option]));
  const appended: LicenseClassOption[] = [];

  for (const rawValue of values) {
    const value = rawValue?.trim();
    if (!value || byValue.has(value)) continue;
    const option = { value, label: value };
    byValue.set(value, option);
    appended.push(option);
  }

  appended.sort((left, right) => left.label.localeCompare(right.label, "tr"));
  return [...options, ...appended];
}

export function getLicenseClassOptionsFromDefinitions(
  items: LicenseClassDefinitionResponse[]
): LicenseClassOption[] {
  return uniqueTargetOptions(items);
}

export function findLicenseClassDefinitionIdForSelection(
  items: readonly LicenseClassDefinitionResponse[],
  licenseClass: string,
  existingLicenseType: string | null | undefined,
  hasExistingLicense: boolean
): string | null {
  const selectedTarget = normalizeLicenseValue(licenseClass);
  const selectedSource =
    hasExistingLicense && existingLicenseType?.trim()
      ? normalizeLicenseValue(existingLicenseType)
      : "";
  const match = items.find((item) => {
    if (normalizeLicenseValue(item.code) !== selectedTarget) return false;
    const source = item.existingLicenseType ? normalizeLicenseValue(item.existingLicenseType) : "";
    return source === selectedSource;
  });
  return match?.id ?? null;
}

function uniqueTargetOptions(
  items: LicenseClassDefinitionResponse[],
): LicenseClassOption[] {
  const preferredByCode = new Map<string, LicenseClassDefinitionResponse>();

  for (const item of items) {
    const key = normalizeLicenseValue(item.code);
    const current = preferredByCode.get(key);
    if (!current || isPreferredTargetOption(item, current)) {
      preferredByCode.set(key, item);
    }
  }

  return [...preferredByCode.values()]
    .sort((a, b) => a.displayOrder - b.displayOrder || a.code.localeCompare(b.code, "tr"))
    .map((item) => toOption(item));
}

function isPreferredTargetOption(
  candidate: LicenseClassDefinitionResponse,
  current: LicenseClassDefinitionResponse
): boolean {
  return (
    candidate.displayOrder < current.displayOrder ||
    (candidate.displayOrder === current.displayOrder &&
      candidate.name.localeCompare(current.name, "tr") < 0)
  );
}

async function getActiveLicenseClassDefinitions(
  signal?: AbortSignal,
  includeInstitutionContext = true
) {
  const activeResponse = await getLicenseClassDefinitions(
    {
      activity: "active",
      includeInstitutionContext,
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
) {
  const items = await getActiveLicenseClassDefinitions(signal);
  return getInitialLicenseClassOptions(items);
}

export function useLicenseClassOptions() {
  const query = useQuery({
    queryKey: ACTIVE_LICENSE_CLASS_DEFINITIONS_QUERY_KEY,
    queryFn: ({ signal }) => getActiveLicenseClassDefinitions(signal),
  });
  const options = useMemo(
    () => getLicenseClassOptionsFromDefinitions(query.data ?? []),
    [query.data]
  );

  return { options, loading: query.isLoading };
}

export function useLicenseClassFilterOptions() {
  const query = useQuery({
    queryKey: ACTIVE_LICENSE_CLASS_DEFINITIONS_QUERY_KEY,
    queryFn: ({ signal }) => getActiveLicenseClassDefinitions(signal),
  });
  const options = useMemo(
    () => getLicenseClassOptionsFromDefinitions(query.data ?? []),
    [query.data]
  );

  return { options, loading: query.isLoading };
}

export function useActiveLicenseClassDefinitions(enabled = true) {
  const query = useQuery({
    queryKey: ACTIVE_LICENSE_CLASS_DEFINITIONS_QUERY_KEY,
    queryFn: ({ signal }) => getActiveLicenseClassDefinitions(signal),
    enabled,
  });

  return { items: query.data ?? [], loading: query.isLoading };
}

export function useInitialLicenseClassOptions() {
  const query = useQuery({
    queryKey: ACTIVE_LICENSE_CLASS_DEFINITIONS_QUERY_KEY,
    queryFn: ({ signal }) => getActiveLicenseClassDefinitions(signal),
  });
  const options = useMemo(
    () => uniqueTargetOptions((query.data ?? []).filter((item) => !item.existingLicenseType)),
    [query.data]
  );

  return { options, loading: query.isLoading };
}

export function useCandidateLicenseClassOptions(
  existingLicenseType: string,
  hasExistingLicense: boolean,
  enabled = true
) {
  const query = useQuery({
    queryKey: ACTIVE_LICENSE_CLASS_DEFINITIONS_QUERY_KEY,
    queryFn: ({ signal }) => getActiveLicenseClassDefinitions(signal),
    enabled,
  });
  const options = useMemo(
    () => getCandidateTargetOptions(query.data ?? [], existingLicenseType, hasExistingLicense),
    [existingLicenseType, hasExistingLicense, query.data]
  );

  return { options, loading: query.isLoading };
}

export function useExistingLicenseTypeOptions(enabled = true) {
  const query = useQuery({
    queryKey: GLOBAL_ACTIVE_LICENSE_CLASS_DEFINITIONS_QUERY_KEY,
    queryFn: ({ signal }) => getActiveLicenseClassDefinitions(signal, false),
    enabled,
  });
  const options = useMemo(
    () => uniqueExistingLicenseTypeOptions(query.data ?? []),
    [query.data]
  );

  return { options, loading: query.isLoading };
}

function uniqueExistingLicenseTypeOptions(
  items: LicenseClassDefinitionResponse[]
): ExistingLicenseTypeOption[] {
  const byValue = new Map<string, ExistingLicenseTypeOption>();

  for (const item of items) {
    if (!item.existingLicenseType) {
      const value = toExistingLicenseValue(item.code);
      if (!byValue.has(value)) byValue.set(value, { value, label: item.code });
      continue;
    }

    const value = toExistingLicenseValue(item.existingLicenseType);
    if (!byValue.has(value)) byValue.set(value, { value, label: item.existingLicenseType });
  }

  return [...byValue.values()].sort((left, right) => left.label.localeCompare(right.label, "tr"));
}

function getInitialLicenseClassOptions(
  items: LicenseClassDefinitionResponse[]
): LicenseClassOption[] {
  return uniqueTargetOptions(items.filter((item) => !item.existingLicenseType));
}

function getCandidateTargetOptions(
  items: LicenseClassDefinitionResponse[],
  existingLicenseType: string,
  hasExistingLicense: boolean
): LicenseClassOption[] {
  if (!hasExistingLicense || !existingLicenseType.trim()) {
    return getInitialLicenseClassOptions(items);
  }

  const selectedExistingLicenseType = normalizeLicenseValue(existingLicenseType);
  return uniqueTargetOptions(
    items.filter(
      (item) =>
        item.existingLicenseType &&
        normalizeLicenseValue(item.existingLicenseType) === selectedExistingLicenseType
    )
  );
}
