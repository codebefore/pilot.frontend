import type { RouteUsageType } from "./types";

type Option<T extends string> = {
  value: T;
  label: string;
};

export const ROUTE_USAGE_OPTIONS: Option<RouteUsageType>[] = [
  { value: "practice_and_exam", label: "Ders + Sınav" },
  { value: "practice", label: "Uygulama Dersi" },
  { value: "exam", label: "Sınav" },
];

function buildLabelMap<T extends string>(options: Option<T>[]): Record<T, string> {
  return options.reduce(
    (acc, option) => ({ ...acc, [option.value]: option.label }),
    {} as Record<T, string>
  );
}

export const ROUTE_USAGE_LABELS = buildLabelMap(ROUTE_USAGE_OPTIONS);
