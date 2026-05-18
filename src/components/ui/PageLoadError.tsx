import { useState } from "react";
import type { ReactNode } from "react";

type PageLoadErrorProps = {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  variant?: "page" | "card";
};

export function PageLoadError({
  title = "Bilgiler yüklenemedi",
  description = "Bağlantı veya sunucu tarafında bir sorun oluştu. Lütfen tekrar deneyin.",
  onRetry,
  retryLabel = "Tekrar Dene",
  variant = "page",
}: PageLoadErrorProps) {
  const [pending, setPending] = useState(false);

  const handleRetry = () => {
    if (!onRetry || pending) return;
    setPending(true);
    onRetry();
    // Kısa süreliğine basılı kalma feedback'i; parent loading=true yapınca bu component zaten unmount olur.
    window.setTimeout(() => setPending(false), 600);
  };

  return (
    <div className={`page-load-error page-load-error--${variant}`} role="alert">
      <div className="page-load-error__icon" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h3 className="page-load-error__title">{title}</h3>
      {description ? <p className="page-load-error__description">{description}</p> : null}
      {onRetry ? (
        <button
          type="button"
          className="page-load-error__retry"
          onClick={handleRetry}
          disabled={pending}
        >
          {pending ? "Yükleniyor..." : retryLabel}
        </button>
      ) : null}
    </div>
  );
}
