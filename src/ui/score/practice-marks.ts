import type { MarkState } from '../../core/practice/types.js';
import type { NoteId } from '../../core/score/model.js';

export interface PracticeMarksOptions {
  ctx: CanvasRenderingContext2D;
  dpr: number;
  containerRect: DOMRect;
  marks: readonly { noteId: NoteId; state: MarkState }[];
  noteRects: ReadonlyMap<NoteId, DOMRect>;
  dimmedNoteRects?: readonly DOMRect[];
  /** False when the user has switched the marks layer off (FR-012): nothing is drawn, the session is unaffected. */
  visible?: boolean;
}

/**
 * What the Practice note layer still paints: the dimming of the notes the musician is not practising (FR-032). Every
 * mark of a note is something else now (feature 008): a correct, played-along, held-over or skipped note is a recoloured
 * notehead (`note-marks.ts`), the held-over and skipped ones also carry a chevron (`drawStateChevron` in
 * `pressed-keys.ts`), the waiting note is the band behind it (`practice-band.ts`), and a wrong key is a red disc. No
 * outline is drawn here, and never a dashed one (FR-009, SC-003) - `marks` and `noteRects` are accepted and ignored.
 */
export function drawPracticeMarks(options: PracticeMarksOptions): void {
  const { ctx, dpr, containerRect, dimmedNoteRects, visible = true } = options;
  if (!visible) return;

  // Dim unselected notes
  if (dimmedNoteRects) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for (const rect of dimmedNoteRects) {
      const x = (rect.left - containerRect.left) * dpr;
      const y = (rect.top - containerRect.top) * dpr;
      const w = rect.width * dpr;
      const h = rect.height * dpr;
      ctx.fillRect(x - 2 * dpr, y - 2 * dpr, w + 4 * dpr, h + 4 * dpr);
    }
  }
}

export interface StartMarkerOptions {
  ctx: CanvasRenderingContext2D;
  dpr: number;
  containerRect: DOMRect;
  measureRect: DOMRect;
  visible?: boolean;
}

/** Marks the measure a session will start at (FR-015): a bar down the left edge of the measure with a triangle at
 *  its top, so it reads by shape as well as colour and never covers a notehead. */
export function drawStartMarker(options: StartMarkerOptions): void {
  const { ctx, dpr, containerRect, measureRect, visible = true } = options;
  if (!visible) return;
  const x = (measureRect.left - containerRect.left) * dpr;
  const top = (measureRect.top - containerRect.top) * dpr;
  const height = measureRect.height * dpr;
  const size = 10 * dpr;

  ctx.save();
  ctx.strokeStyle = '#0072b2';
  ctx.fillStyle = '#0072b2';
  ctx.setLineDash([]);
  ctx.lineWidth = 3 * dpr;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, top + height);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, top - size / 2);
  ctx.lineTo(x + size, top);
  ctx.lineTo(x, top + size / 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export interface LoopMarksOptions {
  ctx: CanvasRenderingContext2D;
  dpr: number;
  containerRect: DOMRect;
  /** The mounted measures of the loop range, with whether each is the range's first or last measure. */
  measures: readonly { rect: DOMRect; first: boolean; last: boolean }[];
  visible?: boolean;
}

/** Marks the looped measures (AS-3.2): a bracket line above each measure, closed by a short downward stroke at the
 *  range's first and last measure. It is drawn above the measure only, never over the notes, and reads by shape as
 *  well as by colour. */
export function drawLoopMarks(options: LoopMarksOptions): void {
  const { ctx, dpr, containerRect, measures, visible = true } = options;
  if (!visible || measures.length === 0) return;

  const gap = 4 * dpr;
  const tick = 8 * dpr;

  ctx.save();
  ctx.strokeStyle = '#882255'; // wine: distinct from the start marker's blue and every mark colour
  ctx.setLineDash([]);
  ctx.lineWidth = 3 * dpr;
  for (const { rect, first, last } of measures) {
    const left = (rect.left - containerRect.left) * dpr;
    const right = (rect.right - containerRect.left) * dpr;
    const top = (rect.top - containerRect.top) * dpr;
    const y = top - gap - tick;

    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();

    // The end strokes point down at the measure but stop short of it.
    if (first) {
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left, y + tick);
      ctx.stroke();
    }
    if (last) {
      ctx.beginPath();
      ctx.moveTo(right, y);
      ctx.lineTo(right, y + tick);
      ctx.stroke();
    }
  }
  ctx.restore();
}
