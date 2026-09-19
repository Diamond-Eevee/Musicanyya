export interface CursorOptions {
  ctx: CanvasRenderingContext2D;
  dpr: number;
  measureRect: DOMRect;
  noteRects: DOMRect[];
  containerRect: DOMRect;
}

const BAR_WIDTH_PX = 3;
const MARKER_RADIUS_PX = 5;

/**
 * Draws the playhead: a vertical bar spanning the current measure, at the sounding note's x
 * (or the measure's start when `noteRects` is empty, e.g. a rest) - a dot marks the note's exact position
 * (R-11, Constitution VI colour+shape). Coordinates are canvas-local (subtract `containerRect`) and
 * device-pixel-scaled by `dpr`.
 */
export function drawCursorOverlay(options: CursorOptions): void {
  const { ctx, dpr, measureRect, noteRects, containerRect } = options;

  const x = ((noteRects[0]?.left ?? measureRect.left) - containerRect.left) * dpr;
  const top = (measureRect.top - containerRect.top) * dpr;
  const bottom = (measureRect.bottom - containerRect.top) * dpr;
  const barWidth = BAR_WIDTH_PX * dpr;

  ctx.fillRect(x - barWidth / 2, top, barWidth, bottom - top);

  if (noteRects.length === 0) return;

  ctx.beginPath();
  ctx.arc(x, top, MARKER_RADIUS_PX * dpr, 0, Math.PI * 2);
  ctx.fill();
}
