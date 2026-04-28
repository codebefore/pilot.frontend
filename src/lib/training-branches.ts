// Branş kataloğu artık DB'den geliyor (Ayarlar > Tanımlar > Branşlar).
// Bu dosya yalnızca `TrainingBranchDefinitionResponse` listesini tüketen
// runtime helper'ları üretir; hardcoded `BRANCH_CATALOG` kaldırıldı.

import type { TrainingBranchDefinitionResponse } from "./types";

export type BranchColor = {
  bg: string;
  border: string;
  fg: string;
};

export type BranchHelpers = {
  /** Code → branş kaydı. Bilinmiyorsa undefined. */
  byCode: (code: string | null | undefined) => TrainingBranchDefinitionResponse | undefined;
  /** Code → kullanıcıya gösterilecek isim. */
  label: (code: string | null | undefined) => string | null;
  /** Code → palet (RBC event style için bg/border/fg). */
  color: (code: string | null | undefined) => BranchColor | null;
  /** notes alanındaki etiketi (ör. "İlk Yardım") branş code'una çözer.
   *  T067 öncesi quick-assign akışı `notes` alanına etiketi yazıyor;
   *  gerçek FK gelince bu heuristic kalkar. */
  detectFromNotes: (notes: string | null | undefined) => string | null;
};

// `colorHex` bg olarak kullanılır; border bg'nin biraz koyusu, fg beyaz.
function paletteFromHex(hex: string): BranchColor {
  return {
    bg: hex,
    border: darken(hex, 0.2),
    fg: "#ffffff",
  };
}

// Çok basit shade — RGB kanalları üzerinden lineer karartma. CSS color
// kütüphanesi getirmemek için inline.
function darken(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const v = parseInt(m[1], 16);
  const r = Math.max(0, Math.round(((v >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((v >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((v & 0xff) * (1 - amount)));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function buildBranchHelpers(
  branches: readonly TrainingBranchDefinitionResponse[]
): BranchHelpers {
  const byCodeMap = new Map(branches.map((b) => [b.code, b]));
  const labelToCode = new Map(
    branches.map((b) => [b.name.toLocaleLowerCase("tr"), b.code])
  );
  return {
    byCode: (code) => (code ? byCodeMap.get(code) : undefined),
    label: (code) => (code ? byCodeMap.get(code)?.name ?? null : null),
    color: (code) => {
      if (!code) return null;
      const meta = byCodeMap.get(code);
      return meta ? paletteFromHex(meta.colorHex) : null;
    },
    detectFromNotes: (notes) => {
      if (!notes) return null;
      return labelToCode.get(notes.trim().toLocaleLowerCase("tr")) ?? null;
    },
  };
}
