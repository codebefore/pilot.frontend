import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useT } from "../../lib/i18n";
import { FilterIcon } from "../icons";

export type CheckboxListOption = {
  value: string;
  label: string;
};

type CheckboxListPopoverProps = {
  values: string[];
  onChange: (next: string[]) => void;
  options: CheckboxListOption[];
  title: string;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  /** Optional extra class on the trigger; defaults to `form-select`. */
  triggerClassName?: string;
  /**
   * "form" (default) renders a wide button styled like `.form-select`.
   * "icon" renders a small filter icon button suitable for table headers —
   * uses the same look as `TableHeaderFilter`.
   */
  triggerVariant?: "form" | "icon";
};

const MENU_VIEWPORT_GAP = 8;
const MENU_TRIGGER_GAP = 6;
const MENU_FALLBACK_WIDTH = 240;
const MENU_FALLBACK_HEIGHT = 320;

export function CheckboxListPopover({
  values,
  onChange,
  options,
  title,
  placeholder,
  searchable = false,
  disabled = false,
  triggerClassName,
  triggerVariant = "form",
}: CheckboxListPopoverProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedSet = useMemo(() => new Set(values), [values]);
  const selectedCount = values.length;

  const filteredOptions = useMemo(() => {
    if (!searchable || search.trim() === "") return options;
    const needle = search.trim().toLocaleLowerCase("tr");
    return options.filter((option) =>
      option.label.toLocaleLowerCase("tr").includes(needle)
    );
  }, [options, search, searchable]);

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
      const measuredWidth =
        triggerVariant === "icon"
          ? menuRef.current?.offsetWidth ?? MENU_FALLBACK_WIDTH
          : Math.max(
              triggerRect.width,
              menuRef.current?.offsetWidth ?? MENU_FALLBACK_WIDTH
            );
      const measuredHeight = menuRef.current?.offsetHeight ?? MENU_FALLBACK_HEIGHT;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const maxLeft = Math.max(MENU_VIEWPORT_GAP, viewportWidth - measuredWidth - MENU_VIEWPORT_GAP);
      const preferredLeft =
        triggerVariant === "icon"
          ? triggerRect.right - measuredWidth
          : triggerRect.left;
      const left = Math.min(
        Math.max(preferredLeft, MENU_VIEWPORT_GAP),
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

      setMenuPos({ top, left, width: measuredWidth });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, filteredOptions.length, triggerVariant]);

  const handleToggle = (value: string) => {
    if (selectedSet.has(value)) {
      onChange(values.filter((existing) => existing !== value));
    } else {
      onChange([...values, value]);
    }
  };

  const handleClear = () => {
    if (selectedCount === 0) return;
    onChange([]);
  };

  const triggerLabel =
    selectedCount === 0
      ? placeholder ?? title
      : t("candidates.filters.selectedCount", { count: selectedCount });

  const isIconTrigger = triggerVariant === "icon";

  return (
    <div
      className={isIconTrigger ? "table-header-filter" : "checkbox-popover"}
      ref={ref}
    >
      {isIconTrigger ? (
        <button
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={title}
          className={`table-header-filter-trigger${selectedCount > 0 ? " active" : ""}`}
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          ref={triggerRef}
          title={title}
          type="button"
        >
          <FilterIcon size={12} />
        </button>
      ) : (
        <button
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={title}
          className={`checkbox-popover-trigger ${triggerClassName ?? "form-select"}${
            selectedCount > 0 ? " has-selection" : ""
          }`}
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          ref={triggerRef}
          type="button"
        >
          <span className="checkbox-popover-trigger-label">{triggerLabel}</span>
        </button>
      )}

      {open
        ? createPortal(
            <div
              className="checkbox-popover-menu"
              ref={menuRef}
              role="dialog"
              style={
                menuPos
                  ? { top: menuPos.top, left: menuPos.left, minWidth: menuPos.width }
                  : undefined
              }
            >
              <div className="checkbox-popover-header">
                <div className="checkbox-popover-title">{title}</div>
                {selectedCount > 0 ? (
                  <button
                    className="checkbox-popover-clear"
                    onClick={handleClear}
                    type="button"
                  >
                    {t("common.clear")}
                  </button>
                ) : null}
              </div>
              {searchable ? (
                <input
                  aria-label={t("common.search")}
                  className="checkbox-popover-search"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("common.search")}
                  type="text"
                  value={search}
                />
              ) : null}
              <div className="checkbox-popover-list">
                {filteredOptions.length === 0 ? (
                  <div className="checkbox-popover-empty">{t("common.noResults")}</div>
                ) : (
                  filteredOptions.map((option) => {
                    const checked = selectedSet.has(option.value);
                    return (
                      <label
                        className={`checkbox-popover-item switch-toggle switch-toggle-knob-right${
                          checked ? " selected" : ""
                        }`}
                        key={option.value}
                      >
                        <span className="checkbox-popover-item-label">{option.label}</span>
                        <input
                          checked={checked}
                          onChange={() => handleToggle(option.value)}
                          type="checkbox"
                        />
                        <span className="switch-toggle-control" aria-hidden="true" />
                      </label>
                    );
                  })
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
