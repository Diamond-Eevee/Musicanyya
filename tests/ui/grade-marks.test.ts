import { describe, expect, it } from 'vitest';
import type { GradeDisc, GradeSkipIcon } from '../../src/core/grade/marks.js';
import type { DiscSlot, StaffGeometry } from '../../src/ui/score/disc-layout.js';
import { discAt, drawGradeMarks, type GradeMarkGeometry, gradeHeadClass } from '../../src/ui/score/grade-marks.js';
import { DISC_COLOR, SKIPPED_COLOR } from '../../src/ui/score/pressed-keys.js';
import { recordingCanvas } from './helpers/recording-canvas.js';

// 009 T031 (FR-014 to FR-019, FR-021, FR-022, SC-008): the Grade is drawn in Practice's look - red discs at the pitch played,
// then the skip icon of missed notes and the timing carets on top of them - and never as a ring, a cross or a diamond.
// The old T045 tests of the ring / cross / diamond shapes are gone because the behaviour they asserted was removed
// (FR-016, FR-019, logged): each is replaced by an assertion about the new mark; nothing is loosened.

const CONTAINER = { left: 20, top: 40, width: 800, height: 600 } as DOMRect;
const STAFF: StaffGeometry = { bottomLineY: 300, space: 10, lineWidth: 1.5, left: 0, right: 600 };

const slot = (x: number, y: number, over: Partial<DiscSlot> = {}, staff = 1): DiscSlot => ({
  placement: {
    key: 60,
    staff,
    letter: 'C',
    alter: 0,
    printedOctave: 4,
    showAccidental: false,
    position: -2,
    ledgerLines: 0,
    ottava: 0,
    state: 'extra',
  },
  x,
  y,
  width: 10,
  height: 8,
  accidentalX: null,
  ...over,
});
const disc = (key: number): GradeDisc => ({ key }) as unknown as GradeDisc;
const icon = (): GradeSkipIcon => ({ staff: 1, noteIds: ['n1'] }) as unknown as GradeSkipIcon;

/** One of each mark: a disc, a skip icon, an early caret and a late caret. */
function geometry(): GradeMarkGeometry {
  return {
    discSlots: [{ disc: disc(60), slot: slot(200, 250), staff: STAFF }],
    skipIconBoxes: [{ icon: icon(), box: { left: 300, right: 304, top: 260, bottom: 267 } }],
    caretBoxes: [
      { noteId: 'n1', side: 'early', box: { left: 380, right: 386, top: 250, bottom: 258 } },
      { noteId: 'n2', side: 'late', box: { left: 420, right: 426, top: 250, bottom: 258 } },
    ],
  };
}

const draw = (g: GradeMarkGeometry, over: { visible?: boolean; origin?: { x: number; y: number } } = {}) => {
  const canvas = recordingCanvas();
  drawGradeMarks({
    ctx: canvas.ctx,
    dpr: 1,
    containerRect: { left: 0, top: 0 } as DOMRect,
    origin: over.origin ?? { x: 0, y: 0 },
    visible: over.visible ?? true,
    geometry: g,
    glyphs: null,
  });
  return canvas;
};

describe('grade marks rendering (009 US3)', () => {
  it('draws the discs first, then the skip icons, then the timing carets on top', () => {
    const { calls } = draw(geometry());
    const first = (name: string, after = -1) => calls.findIndex((c, i) => i > after && c.name === name);
    const ellipse = first('ellipse');
    const triangle = first('closePath');
    const bar = first('fillRect');
    const caret = first('stroke');
    expect(ellipse).toBeGreaterThanOrEqual(0);
    expect(triangle).toBeGreaterThan(ellipse); // the icon comes after the disc, so a disc can never hide it
    expect(bar).toBeGreaterThan(ellipse);
    expect(caret).toBeGreaterThan(triangle); // carets last
    expect(calls.filter((c) => c.name === 'stroke')).toHaveLength(2); // the two carets (this disc has no ledger line)
  });

  it('draws a filled disc in the disc colour, the skip icon in grey, the carets as strokes: never a ring, a cross or a diamond (FR-019)', () => {
    const { calls, named } = draw(geometry());
    expect(named('arc')).toHaveLength(0); // no ring
    expect(named('ellipse')[0]?.fillStyle).toBe(DISC_COLOR);
    expect(named('fill').map((c) => c.fillStyle)).toEqual([DISC_COLOR, SKIPPED_COLOR]); // the disc, then the icon's triangle
    // every stroked path is a two-segment chevron (a caret): no cross (two separate strokes in one path), no diamond
    let segments: string[] = [];
    for (const call of calls) {
      if (call.name === 'beginPath') segments = [];
      else if (['moveTo', 'lineTo', 'closePath'].includes(call.name)) segments.push(call.name);
      else if (call.name === 'stroke') expect(segments).toEqual(['moveTo', 'lineTo', 'lineTo']);
    }
    // a closed path is only ever filled (the triangle), never stroked: no outline anywhere
    segments = [];
    let closedThenStroked = false;
    for (const call of calls) {
      if (call.name === 'beginPath') segments = [];
      else if (call.name === 'closePath') segments.push('closePath');
      else if (call.name === 'stroke' && segments.includes('closePath')) closedThenStroked = true;
    }
    expect(closedThenStroked).toBe(false);
  });

  it('early and late carets are mirror images of each other, each on its own side (FR-018)', () => {
    const { calls } = draw(geometry());
    const chevrons: { x: number; y: number }[][] = [];
    let current: { x: number; y: number }[] = [];
    for (const call of calls) {
      if (call.name === 'beginPath') current = [];
      else if (call.name === 'moveTo' || call.name === 'lineTo') {
        current.push({ x: call.args[0] as number, y: call.args[1] as number });
      } else if (call.name === 'stroke') chevrons.push(current);
    }
    const [early, late] = chevrons as [{ x: number; y: number }[], { x: number; y: number }[]];
    expect(early[1]?.x).toBeGreaterThan(early[0]?.x as number); // the early caret's tip points right, toward the note
    expect(late[1]?.x).toBeLessThan(late[0]?.x as number); // the late caret's tip points left, toward the note
    expect(early[0]?.x).toBeLessThan(late[0]?.x as number);
  });

  it('the three kinds of mark are told apart by what is drawn, not by colour alone (Constitution VI)', () => {
    const only = (g: Partial<GradeMarkGeometry>) =>
      draw({ discSlots: [], skipIconBoxes: [], caretBoxes: [], ...g })
        .calls.map((c) => c.name)
        .join(',');
    const g = geometry();
    const disc = only({ discSlots: g.discSlots });
    const skip = only({ skipIconBoxes: g.skipIconBoxes });
    const caret = only({ caretBoxes: g.caretBoxes });
    expect(new Set([disc, skip, caret]).size).toBe(3);
    expect(disc).toContain('ellipse');
    expect(skip).toContain('closePath');
    expect(caret).toContain('stroke');
  });

  it('draws nothing when the marks layer is off (FR-025), and nothing for an empty Grade', () => {
    expect(draw(geometry(), { visible: false }).calls).toEqual([]);
    expect(draw({ discSlots: [], skipIconBoxes: [], caretBoxes: [] }).calls).toEqual([]);
  });

  it('draws the discs’ ledger lines in the disc colour under the disc, as Practice does', () => {
    const withLedger = slot(200, 320, { placement: { ...slot(0, 0).placement, position: -2, ledgerLines: -1 } });
    const { named } = draw({
      discSlots: [{ disc: disc(60), slot: withLedger, staff: STAFF }],
      skipIconBoxes: [],
      caretBoxes: [],
    });
    expect(named('stroke')).toHaveLength(1);
    expect(named('stroke')[0]?.strokeStyle).toBe(DISC_COLOR);
  });

  it('follows the page: the same marks drawn from another origin are shifted by exactly that much', () => {
    const at = (origin: { x: number; y: number }) => {
      const xs = draw(geometry(), { origin })
        .calls.filter((c) => c.name === 'ellipse')
        .map((c) => c.args[0] as number);
      return xs[0] as number;
    };
    expect(at({ x: 50, y: 0 }) - at({ x: 0, y: 0 })).toBe(50); // the page origin is 50 px further right: so is every mark
  });

  it('draws the same marks the same way twice, pixel for pixel (SC-008)', () => {
    const a = draw(geometry()).calls.map((c) => JSON.stringify([c.name, c.args, c.fillStyle, c.strokeStyle]));
    const b = draw(geometry()).calls.map((c) => JSON.stringify([c.name, c.args, c.fillStyle, c.strokeStyle]));
    expect(a).toEqual(b);
  });
});

describe('gradeHeadClass (009 FR-014, FR-016)', () => {
  it('a correct head is green like Practice’s, a missed one grey like Practice’s skipped one', () => {
    expect(gradeHeadClass('correct')).toBe('mx-mark-correct');
    expect(gradeHeadClass('missed')).toBe('mx-mark-skipped');
  });
});

describe('discAt: which drawn disc is under a point (009 FR-022)', () => {
  const slots = [
    { disc: disc(60), slot: slot(100, 100), staff: STAFF },
    { disc: disc(62), slot: slot(112, 105), staff: STAFF }, // a second above, moved right past the first
  ];
  const origin = { x: 0, y: 0 };

  it('hits inside a disc’s ellipse and misses just outside it', () => {
    expect(discAt(slots, 100, 100, origin)?.key).toBe(60);
    expect(discAt(slots, 103, 101, origin)?.key).toBe(60);
    expect(discAt(slots, 108, 100, origin)).toBeNull(); // 8 px from the centre of a disc 10 px wide
    expect(discAt(slots, 100, 110, origin)).toBeNull(); // 10 px below a disc 8 px high
  });

  it('tells two discs a second apart from each other, and misses between them', () => {
    expect(discAt(slots, 112, 105, origin)?.key).toBe(62);
    expect(discAt(slots, 106, 102.5, origin)).toBeNull(); // the gap between the two
  });

  it('reads client coordinates: the page origin is taken off first', () => {
    expect(discAt(slots, 100 + 50, 100 + 20, { x: 50, y: 20 })?.key).toBe(60);
    expect(discAt(slots, 100, 100, { x: 50, y: 20 })).toBeNull();
  });

  it('finds nothing without discs', () => {
    expect(discAt([], 0, 0, origin)).toBeNull();
  });
});
