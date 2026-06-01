import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useT } from "../../lib/i18n";

type ModalProps = {
  open: boolean;
  title: string;
  titleExtra?: ReactNode;
  onClose: () => void;
  closeOnOverlayClick?: boolean;
  children: ReactNode;
  footer?: ReactNode;
};

export function Modal({
  open,
  title,
  titleExtra,
  onClose,
  closeOnOverlayClick = false,
  children,
  footer
}: ModalProps) {
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
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (closeOnOverlayClick && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-title">{title}</span>
            {titleExtra}
          </div>
          <button
            aria-label={t("common.close")}
            className="modal-close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
