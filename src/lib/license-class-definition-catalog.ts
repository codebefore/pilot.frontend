import type { LicenseClassDefinitionCategory } from "./types";

type Option<T extends string> = {
  value: T;
  label: string;
};

export const LICENSE_CLASS_DEFINITION_CATEGORY_OPTIONS: Option<LicenseClassDefinitionCategory>[] = [
  { value: "motorcycle", label: "Motosiklet" },
  { value: "automobile", label: "Otomobil" },
  { value: "heavy_vehicle", label: "Ağır Vasıta" },
  { value: "bus", label: "Otobüs" },
  { value: "tractor", label: "Traktör" },
  { value: "work_machine", label: "İş Makinesi" },
  { value: "other", label: "Diğer" },
];

function buildLabelMap<T extends string>(options: Option<T>[]): Record<T, string> {
  return options.reduce(
    (acc, option) => ({ ...acc, [option.value]: option.label }),
    {} as Record<T, string>
  );
}

export const LICENSE_CLASS_DEFINITION_CATEGORY_LABELS = buildLabelMap(
  LICENSE_CLASS_DEFINITION_CATEGORY_OPTIONS
);
