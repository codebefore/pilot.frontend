import { useEffect, useRef, useState } from "react";

import { DownloadIcon } from "../icons";

type ExportDropdownProps = {
  disabled?: boolean;
  onExcel: () => void;
  onPdf: () => void;
  title?: string;
};

export function ExportDropdown({
  disabled = false,
  onExcel,
  onPdf,
  title,
}: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const select = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="export-dropdown" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="btn btn-secondary btn-sm export-dropdown-trigger"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        title={title}
        type="button"
      >
        <DownloadIcon size={14} />
        Dışa aktar
      </button>
      {open ? (
        <div className="export-dropdown-menu" role="menu">
          <button onClick={() => select(onPdf)} role="menuitem" type="button">
            PDF
          </button>
          <button onClick={() => select(onExcel)} role="menuitem" type="button">
            EXCEL
          </button>
        </div>
      ) : null}
    </div>
  );
}
