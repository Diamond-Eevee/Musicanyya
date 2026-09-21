import { describe, expect, it, vi } from 'vitest';
import { drawGradeMarks, drawLiveMarks } from '../../src/ui/score/grade-marks.js';

// T045 (US1): every NoteResult state is distinguishable by shape in greyscale and survives a colour-blind-safe
// check (SC-008, FR-029), no mark ever covers the notehead it refers to, and the whole layer is switchable off
// without touching the notes it marks (FR-035). R-11 fixes the design: pitch is a shape at/around the head
// (correct = nothing, wrongPitch = a cross above it, missed = a hollow ring around it), timing is a caret to the
// left (early) or right (late) of the head (onTime = nothing), and an extra note is a diamond in its own lane.
//
// None of the assertions below read `ctx.fillStyle` / `ctx.strokeStyle`: every state is told apart by which
// primitives are called and where, never by colour alone - that is what makes this a colour-blind-safe check
// rather than merely a "some CSS colour differs" check.

function recordingCtx() {
  const calls: { method: string; args: readonly number[] }[] = [];
  const ctx = {
    beginPath: vi.fn(() => calls.push({ method: 'beginPath', args: [] })),
    stroke: vi.fn(() => calls.push({ method: 'stroke', args: [] })),
    fill: vi.fn(() => calls.push({ method: 'fill', args: [] })),
    closePath: vi.fn(() => calls.push({ method: 'closePath', args: [] })),
    setLineDash: vi.fn((segments: number[]) => calls.push({ method: 'setLineDash', args: segments })),
    moveTo: vi.fn((x: number, y: number) => calls.push({ method: 'moveTo', args: [x, y] })),
    lineTo: vi.fn((x: number, y: number) => calls.push({ method: 'lineTo', args: [x, y] })),
    arc: vi.fn((x: number, y: number, r: number) => calls.push({ method: 'arc', args: [x, y, r] })),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const rect = (left: number, top: number, size = 20): DOMRect =>
  ({ left, top, right: left + size, bottom: top + size, width: size, height: size }) as DOMRect;
const containerRect = { left: 0, top: 0 } as DOMRect;

describe('grade marks rendering (T045)', () => {
  it('pitch correct + timing onTime draws nothing at all: an unmarked note reads as correct (R-11)', () => {
    const { ctx, calls } = recordingCtx();
    const noteRects = new Map([['n1', rect(100, 100)]]);

    drawGradeMarks({
      ctx,
      dpr: 1,
      containerRect,
      visible: true,
      marks: [{ noteId: 'n1', pitch: 'correct', timing: 'onTime' }],
      extraRects: [],
      noteRects,
    });

    expect(calls).toEqual([]);
  });

  it('wrongPitch draws a cross that stays above the notehead, never over it', () => {
    const { ctx, calls } = recordingCtx();
    const r = rect(100, 100);
    const noteRects = new Map([['n1', r]]);

    drawGradeMarks({
      ctx,
      dpr: 1,
      containerRect,
      visible: true,
      marks: [{ noteId: 'n1', pitch: 'wrongPitch', timing: null }],
      extraRects: [],
      noteRects,
    });

    expect(ctx.stroke).toHaveBeenCalled();
    const moves = calls.filter((c) => c.method === 'moveTo' || c.method === 'lineTo');
    expect(moves.length).toBeGreaterThanOrEqual(4); // two diagonal strokes = at least 2 moveTo + 2 lineTo
    for (const { args } of moves) expect(args[1]).toBeLessThan(r.top); // strictly above the notehead's top edge
  });

  it('missed draws a hollow ring that surrounds the notehead instead of covering it', () => {
    const { ctx, calls } = recordingCtx();
    const r = rect(100, 100);
    const noteRects = new Map([['n1', r]]);

    drawGradeMarks({
      ctx,
      dpr: 1,
      containerRect,
      visible: true,
      marks: [{ noteId: 'n1', pitch: 'missed', timing: null }],
      extraRects: [],
      noteRects,
    });

    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled(); // hollow: a stroke, never a fill, so it cannot cover the head
    const arcs = calls.filter((c) => c.method === 'arc');
    expect(arcs).toHaveLength(1);
    const radius = arcs[0]?.args[2] ?? 0;
    expect(radius).toBeGreaterThan(Math.max(r.width, r.height) / 2); // wider than the head: it surrounds, not covers
  });

  it('early draws a caret that stays left of the notehead', () => {
    const { calls, ctx } = recordingCtx();
    const r = rect(100, 100);
    const noteRects = new Map([['n1', r]]);

    drawGradeMarks({
      ctx,
      dpr: 1,
      containerRect,
      visible: true,
      marks: [{ noteId: 'n1', pitch: 'correct', timing: 'early' }],
      extraRects: [],
      noteRects,
    });

    const moves = calls.filter((c) => c.method === 'moveTo' || c.method === 'lineTo');
    expect(moves.length).toBeGreaterThan(0);
    for (const { args } of moves) expect(args[0]).toBeLessThanOrEqual(r.left); // never right of the head's left edge
  });

  it('late draws a caret that stays right of the notehead - the mirror image of early, not the same shape read differently', () => {
    const { calls, ctx } = recordingCtx();
    const r = rect(100, 100);
    const noteRects = new Map([['n1', r]]);

    drawGradeMarks({
      ctx,
      dpr: 1,
      containerRect,
      visible: true,
      marks: [{ noteId: 'n1', pitch: 'correct', timing: 'late' }],
      extraRects: [],
      noteRects,
    });

    const moves = calls.filter((c) => c.method === 'moveTo' || c.method === 'lineTo');
    expect(moves.length).toBeGreaterThan(0);
    for (const { args } of moves) expect(args[0]).toBeGreaterThanOrEqual(r.right); // never left of the head's right edge
  });

  it('an extra note draws a diamond in its own lane, independent of any notehead', () => {
    const { ctx, calls } = recordingCtx();

    drawGradeMarks({
      ctx,
      dpr: 1,
      containerRect,
      visible: true,
      marks: [],
      extraRects: [rect(300, 400)],
      noteRects: new Map(),
    });

    expect(ctx.stroke).toHaveBeenCalled();
    const closes = calls.filter((c) => c.method === 'closePath');
    expect(closes.length).toBeGreaterThan(0);
  });

  it('every one of the six result states has its own call signature, so shape and position (never colour alone) tell them apart (SC-008)', () => {
    // Early and late deliberately share a shape (R-11's caret, mirrored) and are told apart only by which side of
    // the head they sit on - the one spatial metaphor that reads left-to-right without misreading, and one that
    // survives greyscale exactly as well as a shape difference would. The signature below includes coordinates,
    // not just method names, so that left/right position counts as telling them apart - a real distinction a
    // reader sees, not a loophole.
    type Mark = {
      noteId: string;
      pitch: 'correct' | 'wrongPitch' | 'missed';
      timing: 'onTime' | 'early' | 'late' | null;
    };
    const cases: Record<string, Mark[]> = {
      correctOnTime: [{ noteId: 'n1', pitch: 'correct', timing: 'onTime' }],
      correctEarly: [{ noteId: 'n1', pitch: 'correct', timing: 'early' }],
      correctLate: [{ noteId: 'n1', pitch: 'correct', timing: 'late' }],
      wrongPitch: [{ noteId: 'n1', pitch: 'wrongPitch', timing: 'onTime' }],
      missed: [{ noteId: 'n1', pitch: 'missed', timing: null }],
    };

    const signature = (calls: { method: string; args: readonly number[] }[]) =>
      calls.map((c) => `${c.method}:${c.args.map((a) => Math.round(a)).join('|')}`).join(',');

    const signatures = new Map<string, string>();
    for (const [name, marks] of Object.entries(cases)) {
      const { ctx, calls } = recordingCtx();
      drawGradeMarks({
        ctx,
        dpr: 1,
        containerRect,
        visible: true,
        marks,
        extraRects: [],
        noteRects: new Map([['n1', rect(100, 100)]]),
      });
      signatures.set(name, signature(calls));
    }
    // extra note is the sixth state, on its own geometry
    {
      const { ctx, calls } = recordingCtx();
      drawGradeMarks({
        ctx,
        dpr: 1,
        containerRect,
        visible: true,
        marks: [],
        extraRects: [rect(300, 400)],
        noteRects: new Map(),
      });
      signatures.set('extra', signature(calls));
    }

    expect(new Set(signatures.values()).size).toBe(signatures.size); // six distinct shapes/positions, zero collisions
    // ...but early and late still share their call-method sequence (same shape, mirrored) - only the coordinates differ.
    const methodsOnly = (name: string) => {
      const { ctx, calls } = recordingCtx();
      drawGradeMarks({
        ctx,
        dpr: 1,
        containerRect,
        visible: true,
        marks: cases[name] as Mark[],
        extraRects: [],
        noteRects: new Map([['n1', rect(100, 100)]]),
      });
      return calls.map((c) => c.method).join(',');
    };
    expect(methodsOnly('correctEarly')).toBe(methodsOnly('correctLate'));
  });

  it('visible: false switches the whole layer off and draws nothing, but the caller never has to hide the notes themselves (FR-035)', () => {
    const { ctx, calls } = recordingCtx();
    const noteRects = new Map([
      ['n1', rect(100, 100)],
      ['n2', rect(200, 100)],
    ]);

    drawGradeMarks({
      ctx,
      dpr: 1,
      containerRect,
      visible: false,
      marks: [
        { noteId: 'n1', pitch: 'wrongPitch', timing: 'late' },
        { noteId: 'n2', pitch: 'missed', timing: null },
      ],
      extraRects: [rect(300, 400)],
      noteRects,
    });

    expect(calls).toEqual([]);
  });
});

describe('live marks during a run (T044, FR-011)', () => {
  it('draws a dashed ring around a matched notehead, never a cross - the live test can never say "wrong" (D-3)', () => {
    const { ctx, calls } = recordingCtx();
    const r = rect(100, 100);

    drawLiveMarks({
      ctx,
      dpr: 1,
      containerRect,
      visible: true,
      noteIds: ['n1'],
      noteRects: new Map([['n1', r]]),
    });

    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
    const arcs = calls.filter((c) => c.method === 'arc');
    expect(arcs).toHaveLength(1);
    const dashCalls = calls.filter((c) => c.method === 'setLineDash' && c.args.length > 0);
    expect(dashCalls.length).toBeGreaterThan(0); // dashed: distinguishable by shape from the Grade's own solid ring
  });

  it('visible: false draws nothing', () => {
    const { ctx, calls } = recordingCtx();

    drawLiveMarks({
      ctx,
      dpr: 1,
      containerRect,
      visible: false,
      noteIds: ['n1'],
      noteRects: new Map([['n1', rect(100, 100)]]),
    });

    expect(calls).toEqual([]);
  });
});
