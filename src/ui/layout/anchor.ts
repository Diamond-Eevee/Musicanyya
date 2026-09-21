/** A rectangle in CSS pixels, as `getBoundingClientRect()` reports it (only the four numbers are needed). */
export interface AnchorRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface AnchorSize {
  width: number;
  height: number;
}

/** `below-start` lines the popup's left edge up with the invoker's, `below-end` lines the right edges up. */
export type AnchorPlacement = 'below-start' | 'below-end';

export interface AnchoredPosition {
  left: number;
  top: number;
  /** Which side of the invoker the popup ended up on. */
  side: 'below' | 'above';
}

/** Space between an invoker and the popup it opens. */
export const ANCHOR_GAP_PX = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Where to put a popup so it is under its invoker and inside the viewport. CSS Anchor Positioning is not used
 * (research R-3), so menus and panels are placed with this pure helper. It flips above the invoker when there is
 * no room below, shifts into the viewport when it fits on neither side, and never returns a negative offset -
 * a popup larger than the viewport is pinned to its top-left corner.
 */
export function anchorRect(
  invoker: AnchorRect,
  popup: AnchorSize,
  viewport: AnchorSize,
  placement: AnchorPlacement,
): AnchoredPosition {
  const maxLeft = Math.max(0, viewport.width - popup.width);
  const maxTop = Math.max(0, viewport.height - popup.height);

  const wantedLeft = placement === 'below-start' ? invoker.left : invoker.left + invoker.width - popup.width;
  const left = clamp(wantedLeft, 0, maxLeft);

  const belowTop = invoker.top + invoker.height + ANCHOR_GAP_PX;
  if (belowTop + popup.height <= viewport.height) return { left, top: belowTop, side: 'below' };

  const aboveTop = invoker.top - ANCHOR_GAP_PX - popup.height;
  if (aboveTop >= 0) return { left, top: aboveTop, side: 'above' };

  return { left, top: clamp(belowTop, 0, maxTop), side: 'below' };
}
