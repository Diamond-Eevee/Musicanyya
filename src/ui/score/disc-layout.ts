import type { DiscPlacement } from '../../core/notation/place-discs.js';

/**
 * Where the red discs go sideways (feature 008, research R-09): pure geometry over numbers, in the units of the caller
 * (CSS pixels of the viewport). A disc stays in the column of the current note, drawn over any written head it meets,
 * so the mistake reads as belonging to that note (FR-006, owner decision 2026-09-25). Only a disc a second from another
 * disc moves right, as an engraver offsets a second in a chord.
 */

/** A disc is this fraction of a black notehead: it reads as "your key", not as a printed note (R-04). */
export const DISC_SIZE_RATIO = 0.85;
/** The room left between a shifted disc and the disc it moved past, in staff spaces. */
export const DISC_SHIFT_GAP_SPACES = 0.1;

const FALLBACK_HEAD_WIDTH_SPACES = 1.18;
const FALLBACK_HEAD_HEIGHT_SPACES = 1.0;
/** Width and height of an accidental sign in staff spaces (a sharp is the tallest, about three spaces). */
const ACCIDENTAL_WIDTH_SPACES = 1.1;
const ACCIDENTAL_HEIGHT_SPACES = 3;
/** A slot search always ends: no chord has more heads and discs than this. */
const MAX_SLOTS = 32;

/** The measured lines of one staff: `bottomLineY` is the y of the bottom line, `space` the distance between two lines. */
export interface StaffGeometry {
  bottomLineY: number;
  space: number;
  lineWidth: number;
  left: number;
  right: number;
}

/** A rectangle in the units of the caller (CSS pixels). */
export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** A rendered written notehead at the cursor's column on the disc's staff, with its accidental and dots. */
export interface NoteBox extends Box {
  /** The left edge of its accidental sign, when it has one. */
  accidentalLeft?: number;
  /** The right edge of its augmentation dots, when it has any. */
  dotsRight?: number;
}

/** The skip icon is this wide and this high, as fractions of a notehead, and this far below the lowest head (009 R-13). */
export const SKIP_ICON_WIDTH_RATIO = 0.4;
export const SKIP_ICON_HEIGHT_RATIO = 0.7;
export const SKIP_ICON_GAP_RATIO = 0.15;
/** A timing caret is this wide and this high, as fractions of a notehead, and this far (of a head width) from what it clears. */
export const CARET_WIDTH_RATIO = 0.5;
export const CARET_HEIGHT_RATIO = 0.8;
export const CARET_GAP_RATIO = 0.25;

export interface DiscSlot {
  placement: DiscPlacement;
  /** Centre of the disc. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Where the accidental glyph's origin (its left edge) goes, in the accidental column left of the chord; null when
   *  the placement shows no accidental. */
  accidentalX: number | null;
}

interface Placed {
  x: number;
  y: number;
}

const mean = (values: readonly number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

/** Slots for the discs of one staff, returned in the order of `placements`. `cursorX` is the centre of the written
 *  notehead column; `heads` are the written heads there (measured from the page), or none: they size the discs and
 *  place the accidental column, and are never avoided. */
export function layoutDiscs(
  placements: readonly DiscPlacement[],
  staff: StaffGeometry,
  cursorX: number,
  heads: readonly NoteBox[],
): DiscSlot[] {
  if (placements.length === 0) return [];
  const { space } = staff;
  const headWidth = heads.length > 0 ? mean(heads.map((o) => o.right - o.left)) : FALLBACK_HEAD_WIDTH_SPACES * space;
  const headHeight = heads.length > 0 ? mean(heads.map((o) => o.bottom - o.top)) : FALLBACK_HEAD_HEIGHT_SPACES * space;
  const width = DISC_SIZE_RATIO * headWidth;
  const height = DISC_SIZE_RATIO * headHeight;
  const gap = DISC_SHIFT_GAP_SPACES * space;
  const step = headWidth + gap;
  const yOf = (position: number) => staff.bottomLineY - position * (space / 2);

  const xs: number[] = new Array(placements.length).fill(cursorX);
  const placed: Placed[] = [];
  const lowestFirst = placements
    .map((_, i) => i)
    .sort((a, b) => (placements[a]?.position ?? 0) - (placements[b]?.position ?? 0));
  for (const i of lowestFirst) {
    const y = yOf(placements[i]?.position ?? 0);
    const blockedAt = (x: number) => placed.some((p) => Math.abs(y - p.y) < height && Math.abs(x - p.x) < width);
    let slot = 0;
    while (slot < MAX_SLOTS && blockedAt(cursorX + slot * step)) slot++;
    xs[i] = cursorX + slot * step;
    placed.push({ x: xs[i] ?? cursorX, y });
  }

  // The accidental column sits left of everything in the chord: the written heads, their own signs and every disc
  const chordLeft = Math.min(
    cursorX - headWidth / 2,
    ...heads.map((o) => Math.min(o.left, o.accidentalLeft ?? Number.POSITIVE_INFINITY)),
    ...xs.map((x) => x - width / 2),
  );
  const accidentalWidth = ACCIDENTAL_WIDTH_SPACES * space;
  const accidentalHeight = ACCIDENTAL_HEIGHT_SPACES * space;
  // Accidentals of discs that sit within a sign's height of each other go into further columns to the left
  const taken: { y: number; column: number }[] = [];
  const accidentalXs: (number | null)[] = placements.map(() => null);
  for (const i of lowestFirst) {
    const placement = placements[i];
    if (!placement?.showAccidental) continue;
    const y = yOf(placement.position);
    let column = 0;
    while (taken.some((a) => a.column === column && Math.abs(a.y - y) < accidentalHeight)) column++;
    taken.push({ y, column });
    accidentalXs[i] = chordLeft - gap - accidentalWidth - column * (accidentalWidth + gap);
  }

  return placements.map((placement, i) => ({
    placement,
    x: xs[i] ?? cursorX,
    y: yOf(placement.position),
    width,
    height,
    accidentalX: accidentalXs[i] ?? null,
  }));
}

/**
 * The box of the skip icon of a column (009 R-13, FR-016): below the lowest of `columnHeads` (every head written in the
 * column on that staff, all voices), centred on the column, `SKIP_ICON_WIDTH_RATIO` x `SKIP_ICON_HEIGHT_RATIO` of a head,
 * `SKIP_ICON_GAP_RATIO` of a head clear of the lowest head. Below the whole chord nothing is written but the stem of a
 * stem-down chord, which stands at the heads' left edge, and the icon is narrower than the heads, so it never covers a head.
 */
export function skipIconBox(columnHeads: readonly NoteBox[]): Box {
  if (columnHeads.length === 0) return { left: 0, right: 0, top: 0, bottom: 0 };
  const headWidth = mean(columnHeads.map((h) => h.right - h.left));
  const headHeight = mean(columnHeads.map((h) => h.bottom - h.top));
  const centre = (Math.min(...columnHeads.map((h) => h.left)) + Math.max(...columnHeads.map((h) => h.right))) / 2;
  const top = Math.max(...columnHeads.map((h) => h.bottom)) + SKIP_ICON_GAP_RATIO * headHeight;
  const half = (SKIP_ICON_WIDTH_RATIO * headWidth) / 2;
  return { left: centre - half, right: centre + half, top, bottom: top + SKIP_ICON_HEIGHT_RATIO * headHeight };
}

/**
 * The box of a timing caret beside `head` (009 FR-018, R-13): the early one outside everything on the left of the column
 * (every head, and every accidental sign), the late one outside everything on its right (every head, and the dots), so
 * neither covers part of a written note. Vertically centred on `head`.
 */
export function caretBox(head: NoteBox, columnHeads: readonly NoteBox[], side: 'early' | 'late'): Box {
  const all = columnHeads.length > 0 ? columnHeads : [head];
  const width = CARET_WIDTH_RATIO * (head.right - head.left);
  const height = CARET_HEIGHT_RATIO * (head.bottom - head.top);
  const gap = CARET_GAP_RATIO * (head.right - head.left);
  const centre = (head.top + head.bottom) / 2;
  const top = centre - height / 2;
  if (side === 'early') {
    const edge = Math.min(...all.flatMap((h) => [h.left, h.accidentalLeft ?? Number.POSITIVE_INFINITY])) - gap;
    return { left: edge - width, right: edge, top, bottom: top + height };
  }
  const edge = Math.max(...all.flatMap((h) => [h.right, h.dotsRight ?? Number.NEGATIVE_INFINITY])) + gap;
  return { left: edge, right: edge + width, top, bottom: top + height };
}
