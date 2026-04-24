import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CheckIcon, FilterIcon } from "../icons";

export type TableHeaderFilterOption = {
  label: string;
  value: string;
};

const MENU_VIEWPORT_GAP = 8;
const MENU_TRIGGER_GAP = 6;
const MENU_FALLBACK_WIDTH = 180;
const MENU_FALLBACK_HEIGHT = 240;

type TableHeaderFilterProps = {
  active?: boolean;
  onChange: (value: string) => void;
  options: TableHeaderFilterOption[];
  title: string;
  value: string;
};

export function TableHeaderFilter({
  active = false,
  onChange,
  options,
  title,
  value,
}: TableHeaderFilterProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
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
        top = Math.max(MENU_VIEWPORT_GAP, viewportHeight - measuredHeight - MENU_VIEWPORT_GAP);
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
  }, [open, options.length]);

  return (
    <div className={open ? "table-header-filter open" : "table-header-filter"} ref={ref}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={title}
        className={`table-header-filter-trigger${active ? " active" : ""}`}
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        title={title}
        type="button"
      >
        <FilterIcon size={12} />
      </button>

      {open
        ? createPortal(
            <div
              className="table-header-filter-menu"
              ref={menuRef}
              role="dialog"
              style={menuPos ? { top: menuPos.top, left: menuPos.left } : undefined}
            >
              <div className="table-header-filter-title">{title}</div>
              <div className="table-header-filter-options">
                {options.map((option) => {
                  const selected = option.value === value;
                  return (
                    <button
                      aria-pressed={selected}
                      className={`table-header-filter-option${selected ? " selected" : ""}`}
                      key={option.value}
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                      type="button"
                    >
                      <span>{option.label}</span>
                      {selected ? <CheckIcon size={12} /> : null}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
