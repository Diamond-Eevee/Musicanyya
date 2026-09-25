/**
 * The Practice cursor (feature 008, research R-02): a translucent band behind the current event's column, as wide as
 * its noteheads plus a margin and as tall as the measure. It is an element under the page SVG (score.css puts the page
 * above it), so it never tints a notehead and green and red stay readable; it belongs to the cursor layer.
 */

/** Space added on each side of the event's noteheads. */
export const BAND_MARGIN_PX = 6;

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** The box of the band before the margin: the noteheads' x-range by the measure's full height. An event whose
 *  noteheads cannot be found (a rest-only column) gets a band of margin width at the measure's start. */
export function bandRectFor(noteheadRects: readonly DOMRect[], measureRect: DOMRect): DOMRect {
  let left = measureRect.left;
  let right = measureRect.left;
  if (noteheadRects.length > 0) {
    left = Math.min(...noteheadRects.map((r) => r.left));
    right = Math.max(...noteheadRects.map((r) => r.right));
  }
  return box({ left, right, top: measureRect.top, bottom: measureRect.bottom });
}

/**
 * Positions the band in the stack it sits in (`containerRect` = the stack's own rectangle, so the band scrolls with
 * the page). Hidden when there is nothing to show (`rect` null) or the cursor layer is off. Writes a style only when
 * its value changed, so a frame with the same event costs no layout work.
 */
export function placePracticeBand(
  band: HTMLElement,
  rect: DOMRect | null,
  containerRect: DOMRect,
  visible: boolean,
): void {
  const show = visible && rect !== null;
  if (band.hidden === show) band.hidden = !show;
  if (!show || rect === null) return;
  setStyle(band, 'left', `${rect.left - BAND_MARGIN_PX - containerRect.left}px`);
  setStyle(band, 'width', `${rect.right - rect.left + 2 * BAND_MARGIN_PX}px`);
  setStyle(band, 'top', `${rect.top - containerRect.top}px`);
  setStyle(band, 'height', `${rect.bottom - rect.top}px`);
}

function setStyle(el: HTMLElement, property: 'left' | 'width' | 'top' | 'height', value: string): void {
  if (el.style[property] !== value) el.style[property] = value;
}

function box(b: Box): DOMRect {
  return { ...b, width: b.right - b.left, height: b.bottom - b.top, x: b.left, y: b.top, toJSON: () => b } as DOMRect;
}
