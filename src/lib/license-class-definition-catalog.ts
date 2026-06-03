import type { LicenseClassDefinitionCategory } from "./types";
import type { TranslationKey } from "./i18n";

type Option<T extends string> = {
  value: T;
  labelKey: TranslationKey;
};

export const LICENSE_CLASS_DEFINITION_CATEGORY_OPTIONS: Option<LicenseClassDefinitionCategory>[] = [
  { value: "motorcycle", labelKey: "licenseClassCategory.motorcycle" },
  { value: "automobile", labelKey: "licenseClassCategory.automobile" },
  { value: "heavy_vehicle", labelKey: "licenseClassCategory.heavyVehicle" },
  { value: "bus", labelKey: "licenseClassCategory.bus" },
  { value: "tractor", labelKey: "licenseClassCategory.tractor" },
  { value: "work_machine", labelKey: "licenseClassCategory.workMachine" },
  { value: "other", labelKey: "licenseClassCategory.other" },
];

function buildLabelKeyMap<T extends string>(options: Option<T>[]): Record<T, TranslationKey> {
  return options.reduce(
    (acc, option) => ({ ...acc, [option.value]: option.labelKey }),
    {} as Record<T, TranslationKey>
  );
}

export const LICENSE_CLASS_DEFINITION_CATEGORY_LABEL_KEYS = buildLabelKeyMap(
  LICENSE_CLASS_DEFINITION_CATEGORY_OPTIONS
);
