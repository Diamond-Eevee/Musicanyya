import { describe, expect, it } from 'vitest';
import type { DiscPlacement } from '../../src/core/notation/place-discs.js';
import type { DiscSlot, StaffGeometry } from '../../src/ui/score/disc-layout.js';
import { DISC_COLOR, drawPressedKeyDiscs, type MusicGlyphs } from '../../src/ui/score/pressed-keys.js';

interface Call {
  name: string;
  args: unknown[];
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: unknown;
}

/** A canvas that records every call with the style in force at that moment. */
function recordingCanvas() {
  const calls: Call[] = [];
  const state: Record<string, unknown> = { fillStyle: '#000', strokeStyle: '#000', lineWidth: 1 };
  const ctx = new Proxy(
    {},
    {
      get: (_t, name) => {
        if (typeof name === 'symbol') return undefined;
        if (name in state) return state[name];
        return (...args: unknown[]) => {
          calls.push({
            name,
            args,
            fillStyle: state.fillStyle,
            strokeStyle: state.strokeStyle,
            lineWidth: state.lineWidth,
          });
        };
      },
      set: (_t, name, value) => {
        state[String(name)] = value;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, calls, named: (n: string) => calls.filter((c) => c.name === n) };
}

const SHARP = { id: 'sharp' } as unknown as Path2D;
const FLAT = { id: 'flat' } as unknown as Path2D;
const NATURAL = { id: 'natural' } as unknown as Path2D;
const GLYPHS: MusicGlyphs = { sharp: SHARP, flat: FLAT, natural: NATURAL, unitsPerSpace: 250 };

const SPACE = 10;
const STAFF: StaffGeometry = { bottomLineY: 300, space: SPACE, lineWidth: 1.5, left: 0, right: 600 };
const CONTAINER = { left: 20, top: 40, width: 800, height: 600 } as DOMRect;

const placement = (over: Partial<DiscPlacement> = {}): DiscPlacement => ({
  key: 62,
  staff: 1,
  letter: 'D',
  alter: 0,
  printedOctave: 5,
  showAccidental: false,
  position: 6,
  ledgerLines: 0,
  ottava: 0,
  state: 'wrongPitch',
  ...over,
});
const slot = (over: Partial<DiscPlacement> = {}, x = 200, y = 270, accidentalX: number | null = null): DiscSlot => ({
  placement: placement(over),
  x,
  y,
  width: 10.2,
  height: 8.5,
  accidentalX,
});

const draw = (slots: DiscSlot[], dpr = 2, visible = true) => {
  const rec = recordingCanvas();
  drawPressedKeyDiscs({
    ctx: rec.ctx,
    dpr,
    containerRect: CONTAINER,
    slots,
    staff: new Map([[1, STAFF]]),
    glyphs: GLYPHS,
    visible,
  });
  return rec;
};

describe('drawPressedKeyDiscs: the red discs on the overlay canvas (feature 008, research R-04, R-11)', () => {
  it('draws one filled ellipse in the disc colour per slot, in device pixels', () => {
    const { named, calls } = draw([slot({ key: 62 }, 200, 270), slot({ key: 64, position: 8 }, 260, 250)]);
    const ellipses = named('ellipse');
    expect(ellipses).toHaveLength(2);
    // centre and radii scaled by the pixel ratio, relative to the canvas (container) origin
    expect(ellipses[0]?.args.slice(0, 4)).toEqual([(200 - 20) * 2, (270 - 40) * 2, (10.2 / 2) * 2, (8.5 / 2) * 2]);
    expect(ellipses[1]?.args.slice(0, 2)).toEqual([(260 - 20) * 2, (250 - 40) * 2]);
    // each ellipse is filled, in the vermilion of the wrong-pitch colour
    const fills = calls.filter((c) => c.name === 'fill' && c.args.length === 0);
    expect(fills).toHaveLength(2);
    for (const f of fills) expect(f.fillStyle).toBe(DISC_COLOR);
    expect(DISC_COLOR.toLowerCase()).toBe('#d55e00');
  });

  it('draws the placement’s ledger lines below the staff at the staff-line width', () => {
    const { calls, named } = draw([slot({ position: -4, ledgerLines: -2 }, 200, 320)]);
    const strokes = named('stroke');
    expect(strokes.length).toBeGreaterThanOrEqual(1);
    for (const s of strokes) expect(s.lineWidth).toBe(1.5 * 2);
    // two horizontal segments: one and two spaces below the bottom line
    const ys = new Set<number>();
    const moves = calls.filter((c) => c.name === 'moveTo');
    const lines = calls.filter((c) => c.name === 'lineTo');
    expect(moves).toHaveLength(2);
    for (let i = 0; i < moves.length; i++) {
      const from = moves[i]?.args as number[];
      const to = lines[i]?.args as number[];
      expect(from[1]).toBe(to[1]); // horizontal
      expect((to[0] as number) - (from[0] as number)).toBeGreaterThan(10.2 * 2); // wider than the disc
      ys.add(from[1] as number);
    }
    expect([...ys].sort((a, b) => a - b)).toEqual([(300 + SPACE - 40) * 2, (300 + 2 * SPACE - 40) * 2]);
  });

  it('draws ledger lines above the staff from the top line up', () => {
    const { calls } = draw([slot({ position: 12, ledgerLines: 2 }, 200, 240)]);
    const ys = calls.filter((c) => c.name === 'moveTo').map((c) => (c.args as number[])[1]);
    // the top line is 4 spaces above the bottom line
    expect(ys).toEqual([(300 - 4 * SPACE - SPACE - 40) * 2, (300 - 4 * SPACE - 2 * SPACE - 40) * 2]);
  });

  it('draws no ledger line for a disc inside the staff or in the space next to it', () => {
    expect(draw([slot({ position: 6, ledgerLines: 0 })]).named('moveTo')).toHaveLength(0);
  });

  it('draws the accidental glyph only when the placement shows one, the right glyph for the alter', () => {
    const glyphFills = (alter: -1 | 0 | 1, showAccidental: boolean) =>
      draw([slot({ alter, showAccidental }, 200, 270, showAccidental ? 170 : null)])
        .named('fill')
        .map((c) => c.args[0])
        .filter((a) => a !== undefined);
    expect(glyphFills(1, true)).toEqual([SHARP]);
    expect(glyphFills(-1, true)).toEqual([FLAT]);
    expect(glyphFills(0, true)).toEqual([NATURAL]);
    expect(glyphFills(1, false)).toEqual([]);
  });

  it('scales the glyph from font units to the staff space: y flipped, positive x', () => {
    const { named } = draw([slot({ alter: 1, showAccidental: true }, 200, 270, 170)], 2);
    const scales = named('scale');
    expect(scales).toHaveLength(1);
    const [sx, sy] = (scales[0]?.args ?? []) as number[];
    expect(sx).toBeCloseTo((SPACE / 250) * 2);
    expect(sy).toBeCloseTo(-(SPACE / 250) * 2);
    const translate = named('translate')[0]?.args as number[];
    expect(translate).toEqual([(170 - 20) * 2, (270 - 40) * 2]);
  });

  it('draws an ottava label only when the placement was folded', () => {
    const labels = (ottava: -3 | -2 | -1 | 0 | 1 | 2 | 3) =>
      draw([slot({ ottava })])
        .named('fillText')
        .map((c) => c.args[0]);
    expect(labels(0)).toEqual([]);
    expect(labels(1)).toEqual(['8va']);
    expect(labels(-1)).toEqual(['8vb']);
    expect(labels(2)).toEqual(['15ma']);
    expect(labels(-2)).toEqual(['15mb']);
    expect(labels(3)).toEqual(['22ma']);
    expect(labels(-3)).toEqual(['22mb']);
  });

  it('draws nothing at all when the layer is switched off, and nothing for no slots', () => {
    expect(
      draw([slot({ ledgerLines: -2, alter: 1, showAccidental: true, ottava: -1 }, 200, 270, 170)], 2, false).calls,
    ).toEqual([]);
    expect(draw([]).calls).toEqual([]);
  });

  it('skips a slot whose staff has no measured geometry (its page is not mounted)', () => {
    const rec = recordingCanvas();
    drawPressedKeyDiscs({
      ctx: rec.ctx,
      dpr: 1,
      containerRect: CONTAINER,
      slots: [slot({ staff: 2 })],
      staff: new Map([[1, STAFF]]),
      glyphs: GLYPHS,
      visible: true,
    });
    expect(rec.calls).toEqual([]);
  });

  it('never sets a dash pattern (no dashed outline anywhere, SC-003)', () => {
    const { named } = draw([slot({ ledgerLines: -2, alter: 1, showAccidental: true, ottava: -1 }, 200, 270, 170)]);
    for (const c of named('setLineDash')) expect(c.args[0]).toEqual([]);
  });
});
