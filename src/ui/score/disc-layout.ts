import type { DiscPlacement } from '../../core/notation/place-discs.js';

/**
 * Where the red discs go sideways (feature 008, research R-09): pure geometry over numbers, in the units of the caller
 * (CSS pixels of the viewport). A disc never hides a written notehead: when its staff position is the same as a written
 * head or a second from it, it moves right, as an engraver offsets a second in a chord.
 */

/** A disc is this fraction of a black notehead: it reads as "your key", not as a printed note (R-04). */
export const DISC_SIZE_RATIO = 0.85;
/** The room left between a shifted disc and what it moved past, in staff spaces. */
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

/** A rendered written notehead at the cursor's column on the disc's staff, with what hangs on it. */
export interface NoteBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** The right edge of its augmentation dots, when it has some. */
  dotsRight?: number;
  /** The left edge of its accidental sign, when it has one. */
  accidentalLeft?: number;
  /** True for something that is not a notehead but must not be covered either (a state chevron): it is avoided like a
   *  head and does not take part in sizing the discs. */
  mark?: true;
}

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
 *  notehead column; `obstacles` are the written heads there (measured from the page), or none. */
export function layoutDiscs(
  placements: readonly DiscPlacement[],
  staff: StaffGeometry,
  cursorX: number,
  obstacles: readonly NoteBox[],
): DiscSlot[] {
  if (placements.length === 0) return [];
  const { space } = staff;
  const heads = obstacles.filter((o) => !o.mark);
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
    const blockedAt = (x: number) =>
      obstacles.some((o) => {
        const right = o.dotsRight !== undefined ? Math.max(o.right, o.dotsRight + gap) : o.right;
        return (
          Math.abs(y - (o.top + o.bottom) / 2) < (height + (o.bottom - o.top)) / 2 &&
          x - width / 2 < right &&
          x + width / 2 > o.left
        );
      }) || placed.some((p) => Math.abs(y - p.y) < height && Math.abs(x - p.x) < width);
    let slot = 0;
    while (slot < MAX_SLOTS && blockedAt(cursorX + slot * step)) slot++;
    xs[i] = cursorX + slot * step;
    placed.push({ x: xs[i] ?? cursorX, y });
  }

  // The accidental column sits left of everything in the chord: the written heads, their own signs and every disc
  const chordLeft = Math.min(
    cursorX - headWidth / 2,
    ...obstacles.map((o) => Math.min(o.left, o.accidentalLeft ?? Number.POSITIVE_INFINITY)),
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
