import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

type AnchoredPopoverOptions = {
  anchorRef: RefObject<HTMLElement | null>;
  fallbackWidth: number;
  matchAnchorWidth?: boolean;
  open: boolean;
  preferredMaxHeight: number;
};

const VIEWPORT_PADDING = 8;
const POPOVER_GAP = 8;
const MIN_POPOVER_HEIGHT = 48;

/** Positions a portalled popover inside the viewport and flips it above its anchor when needed. */
export function useAnchoredPopover({
  anchorRef,
  fallbackWidth,
  matchAnchorWidth = false,
  open,
  preferredMaxHeight,
}: AnchoredPopoverOptions) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>();

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const popover = popoverRef.current;
    if (!anchor || !popover) return;

    const rect = anchor.getBoundingClientRect();
    const availableBelow = Math.max(
      0,
      window.innerHeight - rect.bottom - VIEWPORT_PADDING - POPOVER_GAP
    );
    const availableAbove = Math.max(0, rect.top - VIEWPORT_PADDING - POPOVER_GAP);
    const naturalHeight = popover.scrollHeight || preferredMaxHeight;
    const requiredHeight = Math.min(naturalHeight, preferredMaxHeight);
    const openAbove = availableBelow < requiredHeight && availableAbove > availableBelow;
    const availableHeight = openAbove ? availableAbove : availableBelow;
    const maxHeight = Math.max(
      MIN_POPOVER_HEIGHT,
      Math.min(preferredMaxHeight, availableHeight)
    );
    const desiredWidth = matchAnchorWidth
      ? Math.max(fallbackWidth, rect.width)
      : popover.offsetWidth || fallbackWidth;
    const width = Math.min(
      desiredWidth,
      Math.max(1, window.innerWidth - VIEWPORT_PADDING * 2)
    );
    const maxLeft = Math.max(
      VIEWPORT_PADDING,
      window.innerWidth - width - VIEWPORT_PADDING
    );
    const left = Math.min(Math.max(VIEWPORT_PADDING, rect.left), maxLeft);
    const renderedHeight = Math.min(naturalHeight, maxHeight);
    const top = openAbove
      ? Math.max(VIEWPORT_PADDING, rect.top - POPOVER_GAP - renderedHeight)
      : rect.bottom + POPOVER_GAP;

    setPopoverStyle({
      left,
      maxHeight,
      overflowY: "auto",
      position: "fixed",
      top,
      ...(matchAnchorWidth ? { width } : {}),
    });
  }, [anchorRef, fallbackWidth, matchAnchorWidth, preferredMaxHeight]);

  useLayoutEffect(() => {
    if (!open) {
      setPopoverStyle(undefined);
      return;
    }

    updatePosition();
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(updatePosition);
    if (popoverRef.current) resizeObserver?.observe(popoverRef.current);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  return { popoverRef, popoverStyle, updatePosition };
}
