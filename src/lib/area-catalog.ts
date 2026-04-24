import type { AreaType } from "./types";

type Option<T extends string> = {
  value: T;
  label: string;
};

export const AREA_TYPE_OPTIONS: Option<AreaType>[] = [
  { value: "classroom", label: "Sınıf" },
  { value: "practice_track", label: "Direksiyon Sahası" },
  { value: "exam_area", label: "Sınav Alanı" },
  { value: "office", label: "Ofis / Şube" },
  { value: "storage", label: "Depo / Arşiv" },
  { value: "psychotechnic_room", label: "Psikoteknik Odası" },
  { value: "src_training_room", label: "SRC Eğitim Salonu" },
  { value: "other", label: "Diğer" },
];

function buildLabelMap<T extends string>(options: Option<T>[]): Record<T, string> {
  return options.reduce(
    (acc, option) => ({ ...acc, [option.value]: option.label }),
    {} as Record<T, string>
  );
}

export const AREA_TYPE_LABELS = buildLabelMap(AREA_TYPE_OPTIONS);
