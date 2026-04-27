import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useT } from "../../lib/i18n";
import {
  BRANCH_LABELS,
  colorForBranch,
} from "../../lib/training-branches";
import type { InstructorBranch } from "../../lib/types";

type BranchPickerPopoverProps = {
  pos: { x: number; y: number };
  availableBranches: InstructorBranch[];
  /** Header'da slot bilgisi (saat · süre). Null ise gösterilmez. */
  slotInfo: string | null;
  isLoading: boolean;
  onPick: (branch: InstructorBranch) => void;
  onClose: () => void;
};

const POPOVER_OFFSET = 8;
const POPOVER_WIDTH = 220;

/**
 * Tıklanan slotun yanında çıkan kompakt branş seçici.
 * - Outside-click veya Escape ile kapanır.
 * - Viewport sınırlarını aşmamak için pozisyon clamp edilir.
 * - `position: fixed` + portal ile DOM ağacında üst seviyeye çıkar.
 */
export function BranchPickerPopover({
  pos,
  availableBranches,
  slotInfo,
  isLoading,
  onPick,
  onClose,
}: BranchPickerPopoverProps) {
  const t = useT();
  const ref = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: pos.y + POPOVER_OFFSET,
    left: pos.x + POPOVER_OFFSET,
  });

  // Render sonrası viewport içinde clamp et — mouse sağ/alt kenara
  // yakınsa popover dışarı taşmasın.
  useLayoutEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const padding = 8;
    let left = pos.x + POPOVER_OFFSET;
    let top = pos.y + POPOVER_OFFSET;
    if (left + rect.width + padding > window.innerWidth) {
      left = window.innerWidth - rect.width - padding;
    }
    if (top + rect.height + padding > window.innerHeight) {
      top = pos.y - rect.height - POPOVER_OFFSET;
    }
    setCoords({ top: Math.max(padding, top), left: Math.max(padding, left) });
  }, [pos.x, pos.y, availableBranches.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onOutside = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    // Tek tık ile dışarı tıklamada kapansın — `mousedown` (mouseup
    // global tracker'ından önce, popover açılma anına çakışmasın diye
    // setTimeout ile bir tick sonra ekliyoruz).
    const id = window.setTimeout(() => {
      document.addEventListener("mousedown", onOutside);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onOutside);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="branch-popover"
      ref={ref}
      style={{
        position: "fixed",
        top: coords.top,
        left: coords.left,
        width: POPOVER_WIDTH,
        zIndex: 100,
      }}
    >
      {slotInfo ? <div className="branch-popover-header">{slotInfo}</div> : null}
      {availableBranches.length > 0 ? (
        <div className="branch-popover-list">
          {availableBranches.map((branch) => {
            const color = colorForBranch(branch);
            return (
              <button
                className="branch-popover-item"
                disabled={isLoading}
                key={branch}
                onClick={() => onPick(branch)}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className="branch-popover-item-dot"
                  style={
                    color
                      ? { background: color.bg, borderColor: color.border }
                      : undefined
                  }
                />
                <span>{BRANCH_LABELS[branch]}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="branch-popover-empty">
          {t("training.popover.noBranches")}
        </div>
      )}
      {isLoading ? (
        <div className="branch-popover-loading">{t("training.popover.assigning")}</div>
      ) : null}
    </div>,
    document.body
  );
}
