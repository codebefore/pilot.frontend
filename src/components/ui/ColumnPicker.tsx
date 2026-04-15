import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ListIcon } from "../icons";

export type ColumnOption = {
  id: string;
  label: string;
  /** When true, the checkbox is disabled — the column cannot be hidden. */
  locked?: boolean;
};

const MENU_VIEWPORT_GAP = 8;
const MENU_TRIGGER_GAP = 6;
const MENU_FALLBACK_WIDTH = 220;
const MENU_FALLBACK_HEIGHT = 280;

type ColumnPickerProps = {
  columns: ColumnOption[];
  isVisible: (id: string) => boolean;
  onToggle: (id: string) => void;
  /** Optional button label, defaults to an icon-only trigger. */
  label?: string;
  /** Tooltip / aria-label for the trigger button. */
  triggerTitle?: string;
};

export function ColumnPicker({
  columns,
  isVisible,
  onToggle,
  label,
  triggerTitle = "Sütunlar",
}: ColumnPickerProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const triggerRect = trigger.getBoundingClientRect();
      const measuredWidth = menuRef.current?.offsetWidth ?? MENU_FALLBACK_WIDTH;
      const measuredHeight = menuRef.current?.offsetHeight ?? MENU_FALLBACK_HEIGHT;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const maxLeft = Math.max(MENU_VIEWPORT_GAP, viewportWidth - measuredWidth - MENU_VIEWPORT_GAP);
      const left = Math.min(
        Math.max(triggerRect.right - measuredWidth, MENU_VIEWPORT_GAP),
        maxLeft
      );

      const preferredBelowTop = triggerRect.bottom + MENU_TRIGGER_GAP;
      const preferredAboveTop = triggerRect.top - measuredHeight - MENU_TRIGGER_GAP;
      const fitsBelow = preferredBelowTop + measuredHeight <= viewportHeight - MENU_VIEWPORT_GAP;
      const fitsAbove = preferredAboveTop >= MENU_VIEWPORT_GAP;

      let top = preferredBelowTop;
      if (!fitsBelow && fitsAbove) {
        top = preferredAboveTop;
      } else if (!fitsBelow) {
        top = Math.max(
          MENU_VIEWPORT_GAP,
          viewportHeight - measuredHeight - MENU_VIEWPORT_GAP
        );
      }

      setMenuPos({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [columns.length, open]);

  return (
    <div className={open ? "column-picker open" : "column-picker"} ref={ref}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={triggerTitle}
        className="btn btn-secondary btn-sm column-picker-trigger"
        onClick={() => setOpen((v) => !v)}
        ref={triggerRef}
        title={triggerTitle}
        type="button"
      >
        <ListIcon size={14} />
        {label && <span>{label}</span>}
      </button>

      {open &&
        createPortal(
          <div
            className="column-picker-menu"
            ref={menuRef}
            role="dialog"
            style={menuPos ? { top: menuPos.top, left: menuPos.left } : undefined}
          >
            <div className="column-picker-title">{triggerTitle}</div>
            {columns.map((col) => {
              const checked = isVisible(col.id);
              return (
                <label
                  className={`column-picker-item${col.locked ? " locked" : ""}`}
                  key={col.id}
                >
                  <input
                    checked={checked}
                    disabled={col.locked}
                    onChange={() => onToggle(col.id)}
                    type="checkbox"
                  />
                  <span>{col.label}</span>
                </label>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
