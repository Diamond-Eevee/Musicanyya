import { describe, expect, it } from 'vitest';
import type { DiscPlacement } from '../../src/core/notation/place-discs.js';
import {
  DISC_SHIFT_GAP_SPACES,
  DISC_SIZE_RATIO,
  layoutDiscs,
  type NoteBox,
  type StaffGeometry,
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

  it('(a) a disc a second from a written head moves right by one head width plus 0.1 space', () => {
    // E5 written on the top space (position 7); the pressed D5 is a second below it (position 6)
    const [slot] = layoutDiscs([disc(74, 6)], STAFF, CURSOR_X, [head(7)]);
    expect(slot?.x).toBeCloseTo(CURSOR_X + HEAD_W + GAP);
    expect(slot?.y).toBe(yOf(6));
    // and the same second above the written head
    const [above] = layoutDiscs([disc(77, 8)], STAFF, CURSOR_X, [head(7)]);
    expect(above?.x).toBeCloseTo(CURSOR_X + HEAD_W + GAP);
  });

  it('(b) a disc at the same position as a written head moves right too', () => {
    const [slot] = layoutDiscs([disc(76, 7)], STAFF, CURSOR_X, [head(7)]);
    expect(slot?.x).toBeCloseTo(CURSOR_X + HEAD_W + GAP);
  });

  it('a disc a third or more from every written head stays in the cursor column', () => {
    const [slot] = layoutDiscs([disc(72, 5)], STAFF, CURSOR_X, [head(7)]);
    expect(slot?.x).toBe(CURSOR_X);
  });

  it('a written head that already sits to the side (a chord second) is not an obstacle to a disc in the column', () => {
    // written E5 at the column and F5 shifted right by Verovio; the pressed D5 (a second below E5) still moves aside
    // to the first slot free of both: the column slot is blocked by E5, slot 1 by the shifted F5? no - F5 is a third
    // away from D5, so slot 1 is free
    const [slot] = layoutDiscs([disc(74, 6)], STAFF, CURSOR_X, [head(7), head(8, HEAD_W)]);
    expect(slot?.x).toBeCloseTo(CURSOR_X + HEAD_W + GAP);
  });

  it('(c) moves past augmentation dots when the written head has them', () => {
    const dotsRight = CURSOR_X + HEAD_W / 2 + 18;
    const [slot] = layoutDiscs([disc(76, 7)], STAFF, CURSOR_X, [head(7, 0, { dotsRight })]);
    const discBox = box(slot as never);
    expect(discBox.left).toBeGreaterThanOrEqual(dotsRight);
    expect(slot?.x).toBeGreaterThan(CURSOR_X + HEAD_W + GAP); // further than the plain second
    // ...and it is the nearest slot that clears the dots, not a far one
    expect(slot?.x).toBeLessThanOrEqual(CURSOR_X + 3 * (HEAD_W + GAP));
  });

  it('keeps clear of a mark that is not a notehead (a held-over chevron) without changing the size of the discs', () => {
    // a chevron box sits just above the written head at position 0; a disc at position 2 would land on it
    const chevron: NoteBox = { left: 94, right: 106, top: yOf(0) - 15, bottom: yOf(0) - 8, mark: true };
    const [slot] = layoutDiscs([disc(67, 2)], STAFF, CURSOR_X, [head(0), chevron]);
    expect(intersects(box(slot as never), chevron)).toBe(false);
    expect(slot?.x).toBeGreaterThan(CURSOR_X);
    expect(slot?.width).toBeCloseTo(DISC_SIZE_RATIO * HEAD_W); // sized from the head only
    // and when the chevron is not there, the same disc stays in the column
    const [plain] = layoutDiscs([disc(67, 2)], STAFF, CURSOR_X, [head(0)]);
    expect(plain?.x).toBe(CURSOR_X);
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

  it('a disc moved to the side keeps its accidental left of everything, not next to the disc', () => {
    const [slot] = layoutDiscs([disc(74, 6, { showAccidental: true, alter: 1 })], STAFF, CURSOR_X, [head(7)]);
    expect(slot?.x).toBeGreaterThan(CURSOR_X);
    expect(slot?.accidentalX as number).toBeLessThan(head(7).left);
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

  it('(f) property: no disc box ever intersects a written notehead box or another disc, over random chords (SC-004)', () => {
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
        heads.push(
          head(position, shifted ? HEAD_W : 0, random() < 0.2 ? { dotsRight: CURSOR_X + HEAD_W / 2 + 16 } : {}),
        );
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
        for (const h of heads) {
          expect(intersects(box(slot), h), `trial ${trial}: disc ${slot.placement.position} over a written head`).toBe(
            false,
          );
        }
      }
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          expect(intersects(box(slots[i] as never), box(slots[j] as never)), `trial ${trial}: two discs`).toBe(false);
        }
      }
    }
  });
});
