import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { CheckIcon } from "../icons";

type ToastVariant = "success" | "error";

type ToastEntry = {
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_MS = 2500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entry, setEntry] = useState<ToastEntry | null>(null);

  const showToast = useCallback((message: string, variant: ToastVariant = "success") => {
    setEntry({ message, variant });
  }, []);

  useEffect(() => {
    if (entry === null) return;
    const timer = window.setTimeout(() => setEntry(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [entry]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {entry !== null &&
        createPortal(
          <div className={`toast toast-${entry.variant}`} role="status">
            <span className="toast-icon">
              {entry.variant === "error" ? (
                <span style={{ fontWeight: 700, lineHeight: 1 }}>✕</span>
              ) : (
                <CheckIcon size={14} />
              )}
            </span>
            {entry.message}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
