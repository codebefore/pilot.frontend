import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";

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

/** Estimated popover width in px; must stay in sync with `.cand-doc-popover`. */
const POPOVER_WIDTH = 240;
const POPOVER_GAP = 6;

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
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const badgeRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close the popover when the user clicks anywhere outside of both the
  // trigger and the (portaled) popover.
  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (badgeRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Measure the trigger and position the portal'ed popover. Recalculates on
  // scroll/resize so the popover stays pinned to the button.
  useLayoutEffect(() => {
    if (!open) {
      setPopoverPos(null);
      return;
    }
    const updatePosition = () => {
      const button = badgeRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      // Center the popover under the trigger, but clamp to viewport so it
      // never runs off-screen on narrow layouts.
      const desiredLeft = rect.left + rect.width / 2 - POPOVER_WIDTH / 2;
      const clampedLeft = Math.max(
        8,
        Math.min(desiredLeft, viewportWidth - POPOVER_WIDTH - 8)
      );
      setPopoverPos({ top: rect.bottom + POPOVER_GAP, left: clampedLeft });
    };
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
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
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t("candidateDocs.aria.openDetails")}
        className={className}
        onClick={handleClick}
        ref={badgeRef}
        type="button"
      >
        {label}
      </button>
      {open && popoverPos &&
        createPortal(
          <div
            className="cand-doc-popover"
            ref={popoverRef}
            role="dialog"
            style={{ top: popoverPos.top, left: popoverPos.left }}
          >
            <div className="cand-doc-popover-title">{label}</div>
            <div className="cand-doc-popover-body">{popoverBody}</div>
          </div>,
          document.body
        )}
    </>
  );
}
