import type { PitchResult, TimingResult } from '../../core/grade/types.js';
import type { NoteId } from '../../core/score/model.js';

// Okabe-Ito palette (tokens.css): colour is decoration, never the sole differentiator (SC-008).
const WRONG_PITCH_COLOR = '#d55e00'; // vermilion
const MISSED_COLOR = '#cc79a7'; // reddish-purple
const EARLY_COLOR = '#0072b2'; // blue
const LATE_COLOR = '#e69f00'; // orange
const EXTRA_COLOR = '#f0e442'; // yellow
const LIVE_CORRECT_COLOR = '#56b4e9'; // sky-blue, practice-marks.ts's own `correctSoFar` colour

export interface GradeMark {
  noteId: NoteId;
  pitch: PitchResult;
  timing: TimingResult | null;
}

export interface GradeMarksOptions {
  ctx: CanvasRenderingContext2D;
  dpr: number;
  containerRect: DOMRect;
  /** FR-035: the whole layer is switchable off, without the caller having to touch the notes it refers to. */
  visible: boolean;
  /** One entry per notehead (a unison expands to one entry per `NoteId`, same treatment as `practice-marks.ts`). */
  marks: readonly GradeMark[];
  /** Extra notes' on-screen position, already resolved to their lane below the staff (R-11) by the caller. */
  extraRects: readonly DOMRect[];
  noteRects: ReadonlyMap<NoteId, DOMRect>;
}

/**
 * R-11: pitch is a shape at or around the notehead (correct = nothing, wrongPitch = a cross above it, missed = a
 * hollow ring around it); timing is a caret beside the head (onTime = nothing, early = left, late = right - the
 * one spatial metaphor a musician reading left to right cannot misread); an extra note is a diamond in its own
 * lane. No mark ever covers the notehead (Constitution VI): the cross sits strictly above it, the ring strictly
 * outside it, the carets strictly to either side. Every state is told apart by shape or position, never by colour
 * alone, so the whole layer survives a greyscale check (SC-008).
 */
export function drawGradeMarks(options: GradeMarksOptions): void {
  const { ctx, dpr, containerRect, visible, marks, extraRects, noteRects } = options;
  if (!visible) return;

  for (const mark of marks) {
    const rect = noteRects.get(mark.noteId);
    if (!rect) continue;

    if (mark.pitch === 'wrongPitch') drawCross(ctx, dpr, containerRect, rect);
    else if (mark.pitch === 'missed') drawRing(ctx, dpr, containerRect, rect);

    if (mark.timing === 'early') drawCaret(ctx, dpr, containerRect, rect, 'early');
    else if (mark.timing === 'late') drawCaret(ctx, dpr, containerRect, rect, 'late');
  }

  for (const rect of extraRects) drawDiamond(ctx, dpr, containerRect, rect);
}

export interface LiveMarksOptions {
  ctx: CanvasRenderingContext2D;
  dpr: number;
  containerRect: DOMRect;
  visible: boolean;
  /** Every notehead the run's cheap same-pitch test has matched so far (T044, FR-011). */
  noteIds: readonly NoteId[];
  noteRects: ReadonlyMap<NoteId, DOMRect>;
}

/** FR-011, FR-011a: display-only "correct so far" during a run - a dashed ring, deliberately a different shape
 *  (dashed, not solid) and colour from the Grade's own `missed` ring, so the two are never mistaken once the
 *  Grade layer replaces this one at the end of the run. Never a cross: the live test can never establish a wrong
 *  pitch (D-3). */
export function drawLiveMarks(options: LiveMarksOptions): void {
  const { ctx, dpr, containerRect, visible, noteIds, noteRects } = options;
  if (!visible) return;

  for (const noteId of noteIds) {
    const rect = noteRects.get(noteId);
    if (!rect) continue;
    const x = (rect.left - containerRect.left) * dpr;
    const y = (rect.top - containerRect.top) * dpr;
    const w = rect.width * dpr;
    const h = rect.height * dpr;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.max(w, h) / 2 + 4 * dpr;

    ctx.beginPath();
    ctx.strokeStyle = LIVE_CORRECT_COLOR;
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    ctx.lineWidth = 2 * dpr;
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawCross(ctx: CanvasRenderingContext2D, dpr: number, containerRect: DOMRect, rect: DOMRect): void {
  const x = (rect.left - containerRect.left) * dpr;
  const y = (rect.top - containerRect.top) * dpr;
  const w = rect.width * dpr;
  const h = rect.height * dpr;
  const cx = x + w / 2;
  const pad = 4 * dpr;
  const arm = Math.max(w, h) / 4 + 2 * dpr;
  const centerY = y - pad - arm; // the cross's own bottom edge (centerY + arm) stays above y (the head's top edge)

  ctx.beginPath();
  ctx.strokeStyle = WRONG_PITCH_COLOR;
  ctx.setLineDash([]);
  ctx.lineWidth = 2 * dpr;
  ctx.moveTo(cx - arm, centerY - arm);
  ctx.lineTo(cx + arm, centerY + arm);
  ctx.moveTo(cx - arm, centerY + arm);
  ctx.lineTo(cx + arm, centerY - arm);
  ctx.stroke();
}

function drawRing(ctx: CanvasRenderingContext2D, dpr: number, containerRect: DOMRect, rect: DOMRect): void {
  const x = (rect.left - containerRect.left) * dpr;
  const y = (rect.top - containerRect.top) * dpr;
  const w = rect.width * dpr;
  const h = rect.height * dpr;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.max(w, h) / 2 + 6 * dpr; // wider than the head: a hollow ring surrounds it, never covers it

  ctx.beginPath();
  ctx.strokeStyle = MISSED_COLOR;
  ctx.setLineDash([]);
  ctx.lineWidth = 2 * dpr;
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke(); // hollow: a stroke, never a fill
}

function drawCaret(
  ctx: CanvasRenderingContext2D,
  dpr: number,
  containerRect: DOMRect,
  rect: DOMRect,
  side: 'early' | 'late',
): void {
  const left = (rect.left - containerRect.left) * dpr;
  const right = (rect.right - containerRect.left) * dpr;
  const y = (rect.top - containerRect.top) * dpr;
  const h = rect.height * dpr;
  const cy = y + h / 2;
  const pad = 4 * dpr;
  const size = 5 * dpr;
  const tipX = side === 'early' ? left - pad : right + pad;
  const farX = side === 'early' ? tipX - size : tipX + size;

  ctx.beginPath();
  ctx.strokeStyle = side === 'early' ? EARLY_COLOR : LATE_COLOR;
  ctx.setLineDash([]);
  ctx.lineWidth = 2 * dpr;
  ctx.moveTo(farX, cy - size);
  ctx.lineTo(tipX, cy); // the tip points toward the notehead
  ctx.lineTo(farX, cy + size);
  ctx.stroke();
}

function drawDiamond(ctx: CanvasRenderingContext2D, dpr: number, containerRect: DOMRect, rect: DOMRect): void {
  const x = (rect.left - containerRect.left) * dpr;
  const y = (rect.top - containerRect.top) * dpr;
  const w = rect.width * dpr;
  const h = rect.height * dpr;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.max(w, h) / 2;

  ctx.beginPath();
  ctx.strokeStyle = EXTRA_COLOR;
  ctx.setLineDash([]);
  ctx.lineWidth = 2 * dpr;
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.stroke();
}
