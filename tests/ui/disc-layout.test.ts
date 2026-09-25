import { describe, expect, it } from 'vitest';
import type { DiscPlacement } from '../../src/core/notation/place-discs.js';
import {
  caretBox,
  DISC_SHIFT_GAP_SPACES,
  DISC_SIZE_RATIO,
  layoutDiscs,
  type NoteBox,
  type StaffGeometry,
  skipIconBox,
} from '../../src/ui/score/disc-layout.js';

/** A staff 10 px per space: bottom line at y = 100 (canvas coordinates grow downward), so a position p is at y = 100 - 5p. */
const SPACE = 10;
const STAFF: StaffGeometry = { bottomLineY: 100, space: SPACE, lineWidth: 1, left: 0, right: 400 };
const HEAD_W = 12;
const HEAD_H = 10;
const CURSOR_X = 100; // the centre of the written notehead column
const GAP = DISC_SHIFT_GAP_SPACES * SPACE;

const yOf = (position: number) => STAFF.bottomLineY - position * (SPACE / 2);

const disc = (key: number, position: number, over: Partial<DiscPlacement> = {}): DiscPlacement => ({
  key,
  staff: 1,
  letter: 'C',
  alter: 0,
  printedOctave: 4,
  showAccidental: false,
  position,
  ledgerLines: 0,
  ottava: 0,
  state: 'wrongPitch',
  ...over,
});

const head = (position: number, dx = 0, over: Partial<NoteBox> = {}): NoteBox => ({
  left: CURSOR_X + dx - HEAD_W / 2,
  right: CURSOR_X + dx + HEAD_W / 2,
  top: yOf(position) - HEAD_H / 2,
  bottom: yOf(position) + HEAD_H / 2,
  ...over,
});

const box = (s: { x: number; y: number; width: number; height: number }) => ({
  left: s.x - s.width / 2,
  right: s.x + s.width / 2,
  top: s.y - s.height / 2,
  bottom: s.y + s.height / 2,
});
const intersects = (
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

describe('layoutDiscs: horizontal slots for the red discs, pure geometry (feature 008, research R-09)', () => {
  it('a disc alone, with nothing written near it, sits in the cursor column at its staff position', () => {
    const [slot] = layoutDiscs([disc(62, 6)], STAFF, CURSOR_X, [head(-2), head(12)]);
    expect(slot).toMatchObject({ x: CURSOR_X, y: yOf(6) });
    expect(slot?.width).toBeCloseTo(DISC_SIZE_RATIO * HEAD_W);
    expect(slot?.height).toBeCloseTo(DISC_SIZE_RATIO * HEAD_H);
  });

  it('uses the fallback head size of 1.18 x 1.0 spaces when no written head is measured', () => {
    const [slot] = layoutDiscs([disc(62, 6)], STAFF, CURSOR_X, []);
    expect(slot?.width).toBeCloseTo(DISC_SIZE_RATIO * 1.18 * SPACE);
    expect(slot?.height).toBeCloseTo(DISC_SIZE_RATIO * 1.0 * SPACE);
  });

  it('(a) a disc a second from a written head stays in the column, over the head (FR-006 revised)', () => {
    // E5 written on the top space (position 7); the pressed D5 is a second below it (position 6)
    const [slot] = layoutDiscs([disc(74, 6)], STAFF, CURSOR_X, [head(7)]);
    expect(slot?.x).toBe(CURSOR_X);
    expect(slot?.y).toBe(yOf(6));
    expect(intersects(box(slot as never), head(7))).toBe(true); // it lies over the lower half of the E5
    // and the same second above the written head
    const [above] = layoutDiscs([disc(77, 8)], STAFF, CURSOR_X, [head(7)]);
    expect(above?.x).toBe(CURSOR_X);
    expect(intersects(box(above as never), head(7))).toBe(true);
  });

  it('(b) a disc at the same position as a written head sits on it, inside its box, so the head shows around it', () => {
    const [slot] = layoutDiscs([disc(76, 7)], STAFF, CURSOR_X, [head(7)]);
    expect(slot).toMatchObject({ x: CURSOR_X, y: yOf(7) });
    const discBox = box(slot as never);
    const written = head(7);
    expect(discBox.left).toBeGreaterThan(written.left);
    expect(discBox.right).toBeLessThan(written.right);
    expect(discBox.top).toBeGreaterThan(written.top);
    expect(discBox.bottom).toBeLessThan(written.bottom);
  });

  it('a disc a third or more from every written head stays in the cursor column', () => {
    const [slot] = layoutDiscs([disc(72, 5)], STAFF, CURSOR_X, [head(7)]);
    expect(slot?.x).toBe(CURSOR_X);
  });

  it('a written chord second (one head set right of the stem) does not move the disc either', () => {
    // written E5 at the column and F5 shifted right by Verovio; the pressed D5 (a second below E5) stays in the column
    const [slot] = layoutDiscs([disc(74, 6)], STAFF, CURSOR_X, [head(7), head(8, HEAD_W)]);
    expect(slot?.x).toBe(CURSOR_X);
    // nor a pressed F5 (the displaced head's own position): the column, not the displaced head
    const [f5] = layoutDiscs([disc(77, 8)], STAFF, CURSOR_X, [head(7), head(8, HEAD_W)]);
    expect(f5?.x).toBe(CURSOR_X);
  });

  it('(d) two discs a second apart zig-zag without touching each other', () => {
    const slots = layoutDiscs([disc(64, 0), disc(65, 1)], STAFF, CURSOR_X, []);
    expect(slots.map((s) => s.placement.key)).toEqual([64, 65]); // input order kept
    const [low, high] = slots;
    expect(low?.x).toBe(CURSOR_X); // the lowest first, in the column
    expect(high?.x).toBeCloseTo(CURSOR_X + 1.18 * SPACE + GAP);
    expect(intersects(box(low as never), box(high as never))).toBe(false);
  });

  it('three discs in a run: the third is a third above the second and goes back to the column', () => {
    const slots = layoutDiscs([disc(60, 0), disc(62, 1), disc(64, 2)], STAFF, CURSOR_X, []);
    expect(slots.map((s) => s.x > CURSOR_X)).toEqual([false, true, false]);
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        expect(intersects(box(slots[i] as never), box(slots[j] as never))).toBe(false);
      }
    }
  });

  it('discs that do not touch share the column', () => {
    const slots = layoutDiscs([disc(60, 0), disc(64, 4), disc(67, 6)], STAFF, CURSOR_X, []);
    expect(slots.map((s) => s.x)).toEqual([CURSOR_X, CURSOR_X, CURSOR_X]);
  });

  it('places the lowest disc first whatever the input order, and returns the slots in input order', () => {
    const slots = layoutDiscs([disc(65, 1), disc(64, 0)], STAFF, CURSOR_X, []);
    expect(slots.map((s) => s.placement.key)).toEqual([65, 64]);
    expect(slots[1]?.x).toBe(CURSOR_X); // key 64, the lower one, took the column
    expect(slots[0]?.x).toBeGreaterThan(CURSOR_X);
  });

  it('(e) the accidental of a disc sits left of the written chord’s accidentals', () => {
    const accidentalLeft = CURSOR_X - HEAD_W / 2 - 14;
    const [slot] = layoutDiscs([disc(75, 6, { showAccidental: true, alter: 1 })], STAFF, CURSOR_X, [
      head(7, 0, { accidentalLeft }),
    ]);
    expect(slot?.accidentalX).not.toBeNull();
    expect(slot?.accidentalX as number).toBeLessThanOrEqual(accidentalLeft - GAP + 1e-9);
  });

  it('(e) with no written accidental the disc’s accidental sits left of the whole column', () => {
    const [slot] = layoutDiscs([disc(75, 6, { showAccidental: true, alter: 1 })], STAFF, CURSOR_X, [head(7)]);
    expect(slot?.accidentalX as number).toBeLessThan(box(slot as never).left);
    expect(slot?.accidentalX as number).toBeLessThan(head(7).left);
  });

  it('a disc over a written head keeps its accidental left of the head, not on it', () => {
    const [slot] = layoutDiscs([disc(74, 6, { showAccidental: true, alter: 1 })], STAFF, CURSOR_X, [head(7)]);
    expect(slot?.x).toBe(CURSOR_X);
    expect((slot?.accidentalX as number) + 1.1 * SPACE).toBeLessThan(head(7).left);
  });

  it('the upper of two discs a second apart moves right of the column, over or past written heads alike', () => {
    const slots = layoutDiscs([disc(72, 5), disc(74, 6)], STAFF, CURSOR_X, [head(7)]);
    expect(slots[0]?.x).toBe(CURSOR_X);
    expect(slots[1]?.x).toBeCloseTo(CURSOR_X + HEAD_W + GAP);
  });

  it('no accidental for a disc that shows none', () => {
    const [slot] = layoutDiscs([disc(72, 5)], STAFF, CURSOR_X, [head(7)]);
    expect(slot?.accidentalX).toBeNull();
  });

  it('two accidentals a few steps apart do not overlap: the second goes one column further left', () => {
    const slots = layoutDiscs(
      [disc(64, 0, { showAccidental: true }), disc(66, 1, { showAccidental: true })],
      STAFF,
      CURSOR_X,
      [],
    );
    const [a, b] = slots.map((s) => s.accidentalX as number);
    expect(Math.abs((a as number) - (b as number))).toBeGreaterThanOrEqual(SPACE);
  });

  it('is deterministic and returns nothing for no discs', () => {
    expect(layoutDiscs([], STAFF, CURSOR_X, [head(7)])).toEqual([]);
    const input = [disc(64, 0), disc(65, 1), disc(67, 3)];
    expect(layoutDiscs(input, STAFF, CURSOR_X, [head(2)])).toEqual(layoutDiscs(input, STAFF, CURSOR_X, [head(2)]));
  });

  it('(f) property: every disc is in the column unless another disc is a second away, and no two discs overlap, over random chords (SC-004)', () => {
    // A small deterministic PRNG so the run is the same every time
    let seed = 20260925;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let trial = 0; trial < 500; trial++) {
      const heads: NoteBox[] = [];
      const written = new Set<number>();
      const headCount = 1 + Math.floor(random() * 5);
      for (let i = 0; i < headCount; i++) {
        const position = Math.floor(random() * 15) - 3;
        if (written.has(position)) continue;
        written.add(position);
        // a written second is engraved with one head on the other side of the stem
        const shifted = written.has(position - 1) || written.has(position + 1);
        heads.push(head(position, shifted ? HEAD_W : 0));
      }
      const placements: DiscPlacement[] = [];
      const used = new Set<number>();
      const discCount = 1 + Math.floor(random() * 6);
      for (let i = 0; i < discCount; i++) {
        const position = Math.floor(random() * 17) - 4;
        if (used.has(position)) continue;
        used.add(position);
        placements.push(disc(40 + position, position, { showAccidental: random() < 0.4 }));
      }
      const slots = layoutDiscs(placements, STAFF, CURSOR_X, heads);
      expect(slots).toHaveLength(placements.length);
      for (const slot of slots) {
        const step = (slot.x - CURSOR_X) / (HEAD_W + GAP);
        expect(Math.abs(step - Math.round(step)), `trial ${trial}: disc between slots`).toBeLessThan(1e-9);
        expect(step, `trial ${trial}: disc left of the column`).toBeGreaterThanOrEqual(0);
        const discNear = slots.some(
          (other) => other !== slot && Math.abs(other.placement.position - slot.placement.position) <= 1,
        );
        if (!discNear) expect(slot.x, `trial ${trial}: disc ${slot.placement.position} left the column`).toBe(CURSOR_X);
      }
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          expect(intersects(box(slots[i] as never), box(slots[j] as never)), `trial ${trial}: two discs`).toBe(false);
        }
      }
    }
  });
});

// 009 T032 (FR-016, FR-016a, FR-018, research R-13): the marks that go beside and below the heads of a column are placed
// clear of every head: one skip icon below the lowest head, a caret outside the accidental / displaced heads / dots.
describe('skipIconBox (009 R-13)', () => {
  const box = (heads: readonly NoteBox[]) => skipIconBox(heads);
  const overlaps = (a: { left: number; right: number; top: number; bottom: number }, b: NoteBox) =>
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

  it('for a single head: below it, centred on it, 0.4 of a head wide and 0.7 high, 0.15 of a head clear', () => {
    const h = head(0); // position 0: the bottom line
    const b = box([h]);
    expect(b.left + (b.right - b.left) / 2).toBeCloseTo(CURSOR_X);
    expect(b.right - b.left).toBeCloseTo(0.4 * HEAD_W);
    expect(b.bottom - b.top).toBeCloseTo(0.7 * HEAD_H);
    expect(b.top - h.bottom).toBeCloseTo(0.15 * HEAD_H);
    expect(overlaps(b, h)).toBe(false);
  });

  it('for a chord a third apart: below the lowest head, touching neither', () => {
    const heads = [head(0), head(2), head(4)]; // stacked thirds
    const lowest = heads[0] as NoteBox;
    const b = box(heads);
    expect(b.top).toBeGreaterThan(lowest.bottom);
    expect(heads.some((h) => overlaps(b, h))).toBe(false);
  });

  it('for a chord with a second (a displaced head): below the lowest head of both columns, touching no head', () => {
    const heads = [head(0), head(1, HEAD_W)]; // the second is drawn beside, to the right
    const b = box(heads);
    expect(heads.some((h) => overlaps(b, h))).toBe(false);
    expect(b.top).toBeGreaterThan(Math.max(...heads.map((h) => h.bottom)) - 0.001);
  });

  it('for a stem-down chord it stays clear of the stem at the heads’ left edge', () => {
    const heads = [head(0), head(2)];
    const b = box(heads);
    const stemX = CURSOR_X - HEAD_W / 2; // a stem-down chord's stem is at the left edge of its heads
    expect(b.left).toBeGreaterThan(stemX + 0.2 * HEAD_W);
  });

  it('is the same wherever the column is on the page: only the heads decide', () => {
    const a = box([head(3)]);
    const shifted = box([{ ...head(3), left: head(3).left + 500, right: head(3).right + 500 }]);
    expect(shifted.left - a.left).toBeCloseTo(500);
    expect(shifted.right - a.right).toBeCloseTo(500);
    expect(shifted.top).toBeCloseTo(a.top);
  });
});

describe('caretBox (009 FR-018, R-13)', () => {
  const overlaps = (a: { left: number; right: number; top: number; bottom: number }, b: NoteBox) =>
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

  it('the early caret is left of the head, the late caret right of it, both beside the head at its height', () => {
    const h = head(4);
    const early = caretBox(h, [h], 'early');
    const late = caretBox(h, [h], 'late');
    expect(early.right).toBeLessThan(h.left);
    expect(late.left).toBeGreaterThan(h.right);
    for (const b of [early, late]) {
      expect(b.top).toBeGreaterThanOrEqual(h.top - 0.001);
      expect(b.bottom).toBeLessThanOrEqual(h.bottom + 0.001);
    }
  });

  it('the early caret goes left of the accidental, the late caret right of the dots', () => {
    const h = head(4, 0, { accidentalLeft: CURSOR_X - HEAD_W / 2 - 14, dotsRight: CURSOR_X + HEAD_W / 2 + 9 });
    const early = caretBox(h, [h], 'early');
    const late = caretBox(h, [h], 'late');
    expect(early.right).toBeLessThan(h.accidentalLeft as number);
    expect(late.left).toBeGreaterThan(h.dotsRight as number);
  });

  it('in a chord with displaced heads neither caret touches any head: left of the leftmost, right of the rightmost', () => {
    const heads = [head(0, -HEAD_W), head(1), head(2, HEAD_W)];
    const middle = heads[1] as NoteBox;
    const early = caretBox(middle, heads, 'early');
    const late = caretBox(middle, heads, 'late');
    expect(heads.some((h) => overlaps(early, h))).toBe(false);
    expect(heads.some((h) => overlaps(late, h))).toBe(false);
    expect(early.right).toBeLessThan(Math.min(...heads.map((h) => h.left)));
    expect(late.left).toBeGreaterThan(Math.max(...heads.map((h) => h.right)));
  });
});
