import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useT } from "../../lib/i18n";

type DrawerProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
};

export function Drawer({ open, title, onClose, children, actions }: DrawerProps) {
  const t = useT();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="detail-drawer" role="dialog" aria-modal="false">
        <div className="drawer-header">
          <h3>{title}</h3>
          <button
            aria-label={t("common.close")}
            className="modal-close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        {children}
        {actions && <div className="drawer-actions">{actions}</div>}
      </aside>
    </>,
    document.body
  );
}

type DrawerSectionProps = {
  title: string;
  children: ReactNode;
};

export function DrawerSection({ title, children }: DrawerSectionProps) {
  return (
    <div className="drawer-section">
      <div className="drawer-section-title">{title}</div>
      {children}
    </div>
  );
}

type DrawerRowTone = "default" | "brand" | "danger";

type DrawerRowProps = {
  label: string;
  children: ReactNode;
  tone?: DrawerRowTone;
};

export function DrawerRow({ label, children, tone = "default" }: DrawerRowProps) {
  const valueClass = tone === "default" ? "value" : `value ${tone}`;
  return (
    <div className="drawer-row">
      <span className="label">{label}</span>
      <span className={valueClass}>{children}</span>
    </div>
  );
}
