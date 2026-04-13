import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

import { useT } from "../../lib/i18n";
import type { CandidateDocumentSummaryResponse } from "../../lib/types";

type CandidateDocumentBadgeProps = {
  summary: CandidateDocumentSummaryResponse | null;
  /**
   * Optional list of missing document display names. When provided this is
   * rendered immediately in the popover. Pre-fetching scenarios should use
   * this prop.
   */
  missingDocumentNames?: string[];
  /**
   * Optional lazy loader used when the backend does not include missing names
   * on the parent response. Called the first time the popover is opened with
   * a non-zero missing count, and the result is cached for subsequent opens.
   */
  loadMissingDocumentNames?: () => Promise<string[]>;
  /**
   * Called when the badge is activated. Overrides the default popover toggle
   * behavior — useful for navigating to a richer detail surface.
   */
  onClick?: () => void;
};

export function CandidateDocumentBadge({
  summary,
  missingDocumentNames,
  loadMissingDocumentNames,
  onClick,
}: CandidateDocumentBadgeProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [lazyNames, setLazyNames] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Close the popover when the user clicks anywhere outside of it.
  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Lazy-load missing names the first time the popover opens. Result is
  // cached locally so reopening the same badge does not refetch.
  useEffect(() => {
    if (!open) return;
    if (!summary || summary.missingCount === 0) return;
    if (missingDocumentNames && missingDocumentNames.length > 0) return;
    if (lazyNames !== null) return;
    if (!loadMissingDocumentNames) return;

    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    loadMissingDocumentNames()
      .then((names) => {
        if (!cancelled) setLazyNames(names);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, summary, missingDocumentNames, lazyNames, loadMissingDocumentNames]);

  if (!summary) {
    return <span className="cand-doc-badge cand-doc-badge-unknown">{t("candidateDocs.unknown")}</span>;
  }

  const isComplete = summary.missingCount === 0;
  const className = `cand-doc-badge ${isComplete ? "complete" : "missing"}`;
  const label = t("candidateDocs.fraction", {
    completed: summary.completedCount,
    total: summary.totalRequiredCount,
  });

  const handleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (onClick) {
      onClick();
      return;
    }
    setOpen((prev) => !prev);
  };

  // Decide what to show inside the popover. Order of preference for missing
  // rows: caller-provided names → lazy-loaded names → loading/error/placeholder.
  const resolvedNames =
    missingDocumentNames && missingDocumentNames.length > 0
      ? missingDocumentNames
      : lazyNames && lazyNames.length > 0
      ? lazyNames
      : null;

  let popoverBody: React.ReactNode;
  if (isComplete) {
    popoverBody = t("candidateDocs.tooltip.complete");
  } else if (resolvedNames) {
    popoverBody = (
      <ul className="cand-doc-popover-list">
        {resolvedNames.map((name, idx) => (
          <li key={`${name}-${idx}`}>{name}</li>
        ))}
      </ul>
    );
  } else if (loading) {
    popoverBody = t("candidateDocs.tooltip.loading");
  } else if (loadError) {
    popoverBody = t("candidateDocs.tooltip.loadFailed");
  } else {
    popoverBody = t("candidateDocs.tooltip.missingPlaceholder");
  }

  return (
    <span className="cand-doc-badge-wrap" ref={ref}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t("candidateDocs.aria.openDetails")}
        className={className}
        onClick={handleClick}
        type="button"
      >
        {label}
      </button>
      {open && (
        <div className="cand-doc-popover" role="dialog">
          <div className="cand-doc-popover-title">{label}</div>
          <div className="cand-doc-popover-body">{popoverBody}</div>
        </div>
      )}
    </span>
  );
}
