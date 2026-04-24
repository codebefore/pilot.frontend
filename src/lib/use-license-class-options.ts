import { useEffect, useState } from "react";

import { getLicenseClassDefinitions } from "./license-class-definitions-api";
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
  const name = item.name.trim();
  const code = item.code.trim();
  const label = name.toLocaleUpperCase("tr-TR").startsWith(code.toLocaleUpperCase("tr-TR"))
    ? name
    : `${code} - ${name}`;

  return { value: code, label };
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
        pageSize: 100,
        sortBy: "displayOrder",
        sortDir: "asc",
      },
      controller.signal
    )
      .then((response) => {
        const nextOptions = response.items.map(toOption);
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
