import { useEffect, useState } from "react";

import { getLicenseClassDefinitions } from "./license-class-definitions-api";
import { LICENSE_CLASS_DEFINITION_CATEGORY_LABELS } from "./license-class-definition-catalog";
import type { LicenseClassDefinitionResponse } from "./types";

export type LicenseClassOption = {
  value: string;
  label: string;
};

export const REFERENCE_LICENSE_CLASS_OPTIONS: LicenseClassOption[] = [
  { value: "M", label: "M - Motorlu Bisiklet" },
  { value: "M-OTOMATIK", label: "M Otomatik" },
  { value: "A1", label: "A1 - Motosiklet" },
  { value: "A1-OTOMATIK", label: "A1 Otomatik" },
  { value: "A1-YENI-NESIL", label: "A1 Yeni Nesil" },
  { value: "A1-YENI-NESIL-OTOMATIK", label: "A1 Yeni Nesil Otomatik" },
  { value: "A2", label: "A2 - Motosiklet" },
  { value: "A2-OTOMATIK", label: "A2 Otomatik" },
  { value: "A", label: "A - Motosiklet" },
  { value: "A-OTOMATIK", label: "A Otomatik" },
  { value: "B1", label: "B1 - Dört Tekerlekli Motosiklet" },
  { value: "B1-OTOMATIK", label: "B1 Otomatik" },
  { value: "B", label: "B - Otomobil" },
  { value: "B-OTOMATIK", label: "B Otomatik" },
  { value: "B-ENGELLI", label: "B Engelli" },
  { value: "BE", label: "BE - Römorklu Otomobil" },
  { value: "BE-OTOMATIK", label: "BE Otomatik" },
  { value: "C1", label: "C1 - Kamyonet" },
  { value: "C1-OTOMATIK", label: "C1 Otomatik" },
  { value: "C1E", label: "C1E - Römorklu Kamyonet" },
  { value: "C1E-OTOMATIK", label: "C1E Otomatik" },
  { value: "C", label: "C - Kamyon" },
  { value: "C-OTOMATIK", label: "C Otomatik" },
  { value: "CE", label: "CE - Römorklu Kamyon" },
  { value: "CE-OTOMATIK", label: "CE Otomatik" },
  { value: "D1", label: "D1 - Minibüs" },
  { value: "D1-OTOMATIK", label: "D1 Otomatik" },
  { value: "D1E", label: "D1E - Römorklu Minibüs" },
  { value: "D1E-OTOMATIK", label: "D1E Otomatik" },
  { value: "D", label: "D - Otobüs" },
  { value: "D-OTOMATIK", label: "D Otomatik" },
  { value: "DE", label: "DE - Römorklu Otobüs" },
  { value: "DE-OTOMATIK", label: "DE Otomatik" },
  { value: "E", label: "E - Dorseli" },
  { value: "E-OTOMATIK", label: "E Otomatik" },
  { value: "F", label: "F - Traktör" },
  { value: "F-OTOMATIK", label: "F Otomatik" },
  { value: "G", label: "G - İş Makinesi" },
  { value: "G-OTOMATIK", label: "G Otomatik" },
];

function toOption(item: LicenseClassDefinitionResponse): LicenseClassOption {
  const code = item.code.trim();
  const categoryLabel = LICENSE_CLASS_DEFINITION_CATEGORY_LABELS[item.category] ?? item.category;

  return { value: code, label: `${code} - ${categoryLabel}` };
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

export function useLicenseClassOptions() {
  const [options, setOptions] = useState<LicenseClassOption[]>(REFERENCE_LICENSE_CLASS_OPTIONS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    getLicenseClassDefinitions(
      {
        activity: "active",
        page: 1,
        pageSize: 1000,
        sortBy: "displayOrder",
        sortDir: "asc",
      },
      controller.signal
    )
      .then((response) => {
        const nextOptions = uniqueTargetOptions(response.items);
        setOptions(nextOptions.length > 0 ? nextOptions : REFERENCE_LICENSE_CLASS_OPTIONS);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setOptions(REFERENCE_LICENSE_CLASS_OPTIONS);
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
