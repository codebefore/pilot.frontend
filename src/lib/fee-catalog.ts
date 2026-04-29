import type { FeeType } from "./types";

export const FEE_TYPE_OPTIONS: { value: FeeType; label: string }[] = [
  { value: "theory_lesson", label: "Teorik Ders Saat Ücreti" },
  { value: "practice_lesson", label: "Direksiyon Ders Saat Ücreti" },
  { value: "theory_exam", label: "Teorik Sınav Ücreti" },
  { value: "practice_exam", label: "Direksiyon Sınav Ücreti" },
  { value: "failed_practice_exam", label: "Başarısız Direksiyon Sınav Ücreti" },
  { value: "mebbis", label: "Mebbis Ücreti" },
];

export const FEE_TYPE_LABELS: Record<FeeType, string> = FEE_TYPE_OPTIONS.reduce(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {} as Record<FeeType, string>
);
