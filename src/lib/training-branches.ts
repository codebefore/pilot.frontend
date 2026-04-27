// MTSK ders branş katalog — backend `InstructorCatalog` token'larıyla
// uyumlu. T067 (Ders Tipleri ayar modülü) tamamlanınca bu sabit
// liste yerine API'den gelen `LessonType` entity'si kullanılacak.
//
// Renkler `GROUP_PALETTE` ailesinden mat tonlar; beyaz metin okunaklı.

import type { InstructorBranch } from "./types";

export type BranchColor = {
  bg: string;
  border: string;
  fg: string;
};

export type BranchMeta = {
  code: InstructorBranch;
  label: string;
  color: BranchColor;
};

export const BRANCH_CATALOG: readonly BranchMeta[] = [
  {
    code: "traffic",
    label: "Trafik ve Çevre",
    color: { bg: "#3e5660", border: "#2c4049", fg: "#ffffff" }, // mat petrol
  },
  {
    code: "first_aid",
    label: "İlk Yardım",
    color: { bg: "#6f4d4d", border: "#553838", fg: "#ffffff" }, // mat kiremit
  },
  {
    code: "vehicle_technique",
    label: "Araç Tekniği",
    color: { bg: "#4d5c70", border: "#374455", fg: "#ffffff" }, // mat çelik
  },
  {
    code: "traffic_ethics",
    label: "Trafik Adabı",
    color: { bg: "#5a4d6a", border: "#423850", fg: "#ffffff" }, // mat patlıcan
  },
  {
    code: "practice",
    label: "Uygulama",
    color: { bg: "#4d6b47", border: "#385032", fg: "#ffffff" }, // mat orman
  },
] as const;

export const BRANCH_LABELS: Record<InstructorBranch, string> =
  Object.fromEntries(BRANCH_CATALOG.map((b) => [b.code, b.label])) as Record<
    InstructorBranch,
    string
  >;

const LABEL_TO_CODE: Map<string, InstructorBranch> = new Map(
  BRANCH_CATALOG.map((b) => [b.label.toLocaleLowerCase("tr"), b.code])
);

/**
 * `notes` içindeki branş etiketinden (ör. "İlk Yardım") code'a (ör.
 * "first_aid") çözer. T067 öncesinde quick-assign akışı `notes` alanına
 * branş etiketini yazıyor — gerçek `LessonType.id` alanı geldiğinde bu
 * heuristic kalkar.
 */
export function detectBranchFromNotes(
  notes: string | null | undefined
): InstructorBranch | null {
  if (!notes) return null;
  const code = LABEL_TO_CODE.get(notes.trim().toLocaleLowerCase("tr"));
  return code ?? null;
}

export function colorForBranch(code: InstructorBranch | null): BranchColor | null {
  if (!code) return null;
  const meta = BRANCH_CATALOG.find((b) => b.code === code);
  return meta?.color ?? null;
}
