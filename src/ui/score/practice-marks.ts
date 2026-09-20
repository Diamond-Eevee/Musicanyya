import type { MarkState } from '../../core/practice/types.js';
import type { NoteId } from '../../core/score/model.js';

export interface PracticeMarksOptions {
  ctx: CanvasRenderingContext2D;
  dpr: number;
  containerRect: DOMRect;
  marks: readonly { noteId: NoteId; state: MarkState }[];
  noteRects: ReadonlyMap<NoteId, DOMRect>;
  dimmedNoteRects?: readonly DOMRect[];
}

export function drawPracticeMarks(options: PracticeMarksOptions): void {
  const { ctx, dpr, containerRect, marks, noteRects, dimmedNoteRects } = options;

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

  for (const mark of marks) {
    const rect = noteRects.get(mark.noteId);
    if (!rect) continue;

    const x = (rect.left - containerRect.left) * dpr;
    const y = (rect.top - containerRect.top) * dpr;
    const w = rect.width * dpr;
    const h = rect.height * dpr;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.max(w, h) / 2 + 4 * dpr; // Draw outside the notehead

    ctx.beginPath();
    ctx.lineWidth = 2 * dpr;
    ctx.setLineDash([]);

    switch (mark.state) {
      case 'correctSoFar':
        ctx.strokeStyle = '#56b4e9'; // sky-blue
        ctx.setLineDash([4 * dpr, 4 * dpr]);
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'correct':
        ctx.strokeStyle = '#009e73'; // bluish-green
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'wrongPitch':
      case 'wrongOctave':
      case 'extra':
        // No notehead of their own to mark: the key pressed is not written at this event at all, so these three
        // are shown on the on-screen keyboard instead, via the `keyFeedback` effect (T056, R-14) - never here.
        break;
      case 'heldOver':
        ctx.strokeStyle = '#f0e442'; // yellow
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy + r);
        ctx.lineTo(cx - r, cy + r);
        ctx.closePath();
        ctx.stroke();
        break;
      case 'playedAlong':
        ctx.strokeStyle = '#0072b2'; // blue
        ctx.moveTo(cx - r, cy - r / 2);
        ctx.lineTo(cx, cy - r);
        ctx.lineTo(cx + r, cy - r / 2);
        ctx.lineTo(cx + r, cy + r / 2);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r, cy + r / 2);
        ctx.closePath();
        ctx.stroke();
        break;
      case 'skipped':
        ctx.strokeStyle = '#999999'; // gray
        ctx.setLineDash([2 * dpr, 2 * dpr]);
        ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
        break;
      case 'waiting':
        ctx.strokeStyle = '#0072b2'; // blue
        ctx.setLineDash([6 * dpr, 4 * dpr]);
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        break;
    }
  }
}

export interface StartMarkerOptions {
  ctx: CanvasRenderingContext2D;
  dpr: number;
  containerRect: DOMRect;
  measureRect: DOMRect;
}

/** Marks the measure a session will start at (FR-015): a bar down the left edge of the measure with a triangle at
 *  its top, so it reads by shape as well as colour and never covers a notehead. */
export function drawStartMarker(options: StartMarkerOptions): void {
  const { ctx, dpr, containerRect, measureRect } = options;
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
}

/** Marks the looped measures (AS-3.2): a bracket line above each measure, closed by a short downward stroke at the
 *  range's first and last measure. It is drawn above the measure only, never over the notes, and reads by shape as
 *  well as by colour. */
export function drawLoopMarks(options: LoopMarksOptions): void {
  const { ctx, dpr, containerRect, measures } = options;
  if (measures.length === 0) return;

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
