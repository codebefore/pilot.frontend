import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useT } from "../../lib/i18n";
import type { PracticeEducationType } from "../../lib/types";

type PracticeEducationPopoverProps = {
  pos: { x: number; y: number };
  /** Header'da slot bilgisi (saat · süre). Null ise gösterilmez. */
  slotInfo: string | null;
  isLoading: boolean;
  onPick: (type: PracticeEducationType) => void;
  onClose: () => void;
};

const POPOVER_OFFSET = 8;
const POPOVER_WIDTH = 240;

const OPTIONS: PracticeEducationType[] = [
  "normal",
  "makeup",
  "second_practice",
  "failed_candidate",
];

/**
 * Uygulama dersi atanmadan önce MEBBİS `cmbEgitimTuru` seçimi.
 * Branş popover'ıyla aynı stil (chat baloncuğu); 4 sabit seçenek.
 */
export function PracticeEducationPopover({
  pos,
  slotInfo,
  isLoading,
  onPick,
  onClose,
}: PracticeEducationPopoverProps) {
  const t = useT();
  const ref = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: pos.y + POPOVER_OFFSET,
    left: pos.x + POPOVER_OFFSET,
  });

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
  }, [pos.x, pos.y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onOutside = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
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
      <div className="branch-popover-header">
        {slotInfo ?? t("training.practiceEducation.popoverTitle")}
      </div>
      <div className="branch-popover-list">
        {OPTIONS.map((option) => (
          <button
            className="branch-popover-item"
            disabled={isLoading}
            key={option}
            onClick={() => onPick(option)}
            type="button"
          >
            <span>{t(`training.practiceEducation.${option}` as const)}</span>
          </button>
        ))}
      </div>
      {isLoading ? (
        <div className="branch-popover-loading">{t("training.popover.assigning")}</div>
      ) : null}
    </div>,
    document.body
  );
}
