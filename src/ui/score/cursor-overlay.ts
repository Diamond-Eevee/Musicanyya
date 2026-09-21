export interface CursorOptions {
  ctx: CanvasRenderingContext2D;
  dpr: number;
  measureRect: DOMRect;
  noteRects: DOMRect[];
  containerRect: DOMRect;
  isPracticeWaiting?: boolean;
  /** False when the user has switched the cursor layer off (FR-012): nothing is drawn, the run is unaffected. */
  visible?: boolean;
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
  const { ctx, dpr, measureRect, noteRects, containerRect, isPracticeWaiting, visible = true } = options;
  if (!visible) return;

  const x = ((noteRects[0]?.left ?? measureRect.left) - containerRect.left) * dpr;
  const top = (measureRect.top - containerRect.top) * dpr;
  const bottom = (measureRect.bottom - containerRect.top) * dpr;
  const barWidth = BAR_WIDTH_PX * dpr;

  if (isPracticeWaiting) {
    // Practice cursor: highlight the expected event without obscuring notes
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)'; // indigo
    ctx.lineWidth = 2 * dpr;
    if (noteRects.length > 0) {
      let minTop = Infinity;
      let maxBottom = -Infinity;
      for (const rect of noteRects) {
        minTop = Math.min(minTop, rect.top);
        maxBottom = Math.max(maxBottom, rect.bottom);
      }
      const eventTop = (minTop - containerRect.top) * dpr - 10 * dpr;
      const eventBottom = (maxBottom - containerRect.top) * dpr + 10 * dpr;
      const eventLeft = x - 15 * dpr;
      const eventWidth = 30 * dpr;
      ctx.strokeRect(eventLeft, eventTop, eventWidth, eventBottom - eventTop);
    } else {
      ctx.strokeRect(x - 15 * dpr, top, 30 * dpr, bottom - top);
    }
    return;
  }

  ctx.fillRect(x - barWidth / 2, top, barWidth, bottom - top);

  if (noteRects.length === 0) return;

  ctx.beginPath();
  ctx.arc(x, top, MARKER_RADIUS_PX * dpr, 0, Math.PI * 2);
  ctx.fill();
}
