import type { GradeDisc, GradeHeadMark, GradeSkipIcon } from '../../core/grade/marks.js';
import type { NoteId } from '../../core/score/model.js';
import type { Box, DiscSlot, StaffGeometry } from './disc-layout.js';
import type { NoteMarkClass } from './note-marks.js';
import { DISC_TILT_RADIANS, drawPressedKeyDiscs, drawStateChevron, type MusicGlyphs } from './pressed-keys.js';

// Okabe-Ito palette (tokens.css): colour is decoration, never the sole differentiator (Constitution VI, SC-006).
const EARLY_COLOR = '#0072b2'; // blue
const LATE_COLOR = '#e69f00'; // orange

/**
 * The Grade drawn in Practice's look (009 US3, contract play-display.md section 3): a correct note is a green notehead and a
 * missed one a grey notehead (both are classes on the note, `gradeHeadClass`, applied by the view); this module draws what
 * goes on the overlay canvas - the red discs at the pitch played (008's renderer), the skip icon of the missed notes and the
 * early / late carets - from geometry the view measured once per page content, never per frame. No ring, cross or diamond.
 */

/** What to draw, in the coordinates of the page content (the origin is passed separately, so scrolling needs no re-measuring). */
export interface GradeMarkGeometry {
  /** Each disc with its laid-out slot and the geometry of the staff it is on (ledger lines are drawn against it). */
  discSlots: readonly { disc: GradeDisc; slot: DiscSlot; staff: StaffGeometry }[];
  skipIconBoxes: readonly { icon: GradeSkipIcon; box: Box }[];
  caretBoxes: readonly { noteId: NoteId; side: 'early' | 'late'; box: Box }[];
}

export interface GradeMarksOptions {
  ctx: CanvasRenderingContext2D;
  dpr: number;
  /** The overlay canvas's container, in client coordinates (only its `left` and `top` are used). */
  containerRect: DOMRect;
  /** Where the geometry's origin (the top-left of the page content) is in client coordinates right now. */
  origin: { x: number; y: number };
  /** False when the marks layer is off (FR-025): nothing is drawn; the notes it refers to are not touched. */
  visible: boolean;
  geometry: GradeMarkGeometry;
  /** Null draws discs without accidentals. */
  glyphs: MusicGlyphs | null;
}

/**
 * Draws, in this order on the shared canvas: the red discs, then the skip icons and the timing carets on top of them, so the
 * only shapes that tell a missed or wrong note from a correct one are never hidden under a disc (008 bound 4, FR-021).
 */
export function drawGradeMarks(options: GradeMarksOptions): void {
  const { ctx, dpr, containerRect, origin, visible, geometry, glyphs } = options;
  if (!visible) return;
  // The drawing helpers take client coordinates and the container's rect; ours are content coordinates, so shift the rect
  const local = { left: containerRect.left - origin.x, top: containerRect.top - origin.y } as DOMRect;

  for (const { slot, staff } of geometry.discSlots) {
    drawPressedKeyDiscs({
      ctx,
      dpr,
      containerRect: local,
      slots: [slot],
      staff: new Map([[slot.placement.staff, staff]]),
      glyphs,
      visible: true,
    });
  }
  for (const { box } of geometry.skipIconBoxes) {
    drawStateChevron({ ctx, dpr, containerRect: local, kind: 'skipped', box });
  }
  for (const { side, box } of geometry.caretBoxes) drawCaret(ctx, dpr, local, box, side);
}

/** A solid two-stroke chevron in its box, its tip pointing at the note: early on the left points right, late on the right left. */
function drawCaret(ctx: CanvasRenderingContext2D, dpr: number, local: DOMRect, box: Box, side: 'early' | 'late'): void {
  const px = (x: number) => (x - local.left) * dpr;
  const py = (y: number) => (y - local.top) * dpr;
  const tipX = side === 'early' ? box.right : box.left;
  const farX = side === 'early' ? box.left : box.right;
  ctx.beginPath();
  ctx.strokeStyle = side === 'early' ? EARLY_COLOR : LATE_COLOR;
  ctx.setLineDash([]);
  ctx.lineWidth = 2 * dpr;
  ctx.moveTo(px(farX), py(box.top));
  ctx.lineTo(px(tipX), py((box.top + box.bottom) / 2));
  ctx.lineTo(px(farX), py(box.bottom));
  ctx.stroke();
}

/** A graded notehead's mark -> the class it carries: the same green and grey as Practice's correct and skipped notes. */
export function gradeHeadClass(head: GradeHeadMark): NoteMarkClass {
  return head === 'correct' ? 'mx-mark-correct' : 'mx-mark-skipped';
}

/**
 * The drawn disc under a client point, or null (FR-022: a disc is selectable in its own right). The hit test is the disc's
 * own ellipse, tilted as it is drawn; where two overlap the one drawn last (on top) wins.
 */
export function discAt(
  slots: GradeMarkGeometry['discSlots'],
  clientX: number,
  clientY: number,
  origin: { x: number; y: number },
): GradeDisc | null {
  const x = clientX - origin.x;
  const y = clientY - origin.y;
  const cos = Math.cos(DISC_TILT_RADIANS);
  const sin = Math.sin(DISC_TILT_RADIANS);
  for (let i = slots.length - 1; i >= 0; i--) {
    const entry = slots[i];
    if (!entry) continue;
    const { slot, disc } = entry;
    const dx = x - slot.x;
    const dy = y - slot.y;
    const u = dx * cos + dy * sin; // the point in the ellipse's own axes
    const v = -dx * sin + dy * cos;
    const a = slot.width / 2;
    const b = slot.height / 2;
    if ((u / a) ** 2 + (v / b) ** 2 <= 1) return disc;
  }
  return null;
}
