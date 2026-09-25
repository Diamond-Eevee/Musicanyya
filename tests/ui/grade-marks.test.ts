import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { drawGradeMarks } from '../../src/ui/score/grade-marks.js';
import '../../src/ui/elements/mx-score-view.js';
import type { Grade } from '../../src/core/grade/types.js';
import type { MxScoreView } from '../../src/ui/elements/mx-score-view.js';
import type { VerovioClient } from '../../src/ui/score/verovio-client.js';
import { playState } from '../../src/ui/state/playState.js';
import { practiceState } from '../../src/ui/state/practiceState.js';
import { viewState } from '../../src/ui/state/viewState.js';

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

describe('live marks during a run are green noteheads (008 FR-017, R-13, T051)', () => {
  /** A view over one page with three notes, in Play mode, whose frame we drive by hand. */
  async function playView() {
    const client: VerovioClient = {
      init: async () => ({ version: 'fake' }),
      load: async () => ({ pageCount: 1 }),
      relayout: async () => ({ pageCount: 1 }),
      page: async () =>
        ({
          svg: `<svg xmlns="http://www.w3.org/2000/svg"><g class="measure" id="m-1">${['n1', 'n2', 'n3']
            .map((id) => `<g class="note" id="${id}"><g class="notehead"><use/></g><g class="stem"><rect/></g></g>`)
            .join('')}</g></svg>`,
        }) as { svg: string },
      pageOf: async () => ({ page: 1 }),
    };
    const view = document.createElement('mx-score-view') as MxScoreView;
    view.client = client;
    document.body.appendChild(view);
    await view.load('<score-partwise/>', ['m-1']);
    practiceState.setMode('play');
    const frame = () => (view as unknown as { updateCursor(): void }).updateCursor();
    const marked = () =>
      Array.from(view.querySelectorAll('g.note'))
        .filter((el) => el.classList.contains('mx-mark-correct'))
        .map((el) => el.id);
    return { view, frame, marked };
  }

  beforeEach(() => {
    playState.clear();
    practiceState.setMode('listen');
    viewState.setOverlay('marks', true);
  });
  afterEach(() => {
    document.body.innerHTML = '';
    playState.clear();
    practiceState.setMode('listen');
    viewState.setOverlay('marks', true);
  });

  it('maps every liveMark note ID to mx-mark-correct, on the note and nowhere else', async () => {
    const { frame, marked, view } = await playView();
    frame();
    expect(marked()).toEqual([]);
    playState.addLiveMark(['n1']);
    frame();
    expect(marked()).toEqual(['n1']);
    playState.addLiveMark(['n3']);
    frame();
    expect(marked()).toEqual(['n1', 'n3']);
    expect(view.querySelector('#n1 > g.stem')?.getAttribute('class')).not.toContain('mx-mark');
    expect(view.querySelectorAll('[class*="mx-mark"]')).toHaveLength(2);
  });

  it('clears them when the Grade layer is shown', async () => {
    const { frame, marked } = await playView();
    playState.addLiveMark(['n1', 'n2']);
    frame();
    expect(marked()).toEqual(['n1', 'n2']);
    playState.setGrade({ results: [] } as unknown as Grade);
    frame();
    expect(marked()).toEqual([]);
  });

  it('clears them when a new run starts', async () => {
    const { frame, marked } = await playView();
    playState.addLiveMark(['n2']);
    frame();
    expect(marked()).toEqual(['n2']);
    playState.clear(); // what a new run does first (FR-035)
    frame();
    expect(marked()).toEqual([]);
    playState.addLiveMark(['n3']);
    frame();
    expect(marked()).toEqual(['n3']);
  });

  it('clears them when the mode changes', async () => {
    const { frame, marked } = await playView();
    playState.addLiveMark(['n1']);
    frame();
    expect(marked()).toEqual(['n1']);
    practiceState.setMode('listen');
    frame();
    expect(marked()).toEqual([]);
  });

  it('shows none while the marks layer is switched off, and them again when it is switched on', async () => {
    const { frame, marked } = await playView();
    playState.addLiveMark(['n1']);
    viewState.setOverlay('marks', false);
    frame();
    expect(marked()).toEqual([]);
    viewState.setOverlay('marks', true);
    frame();
    expect(marked()).toEqual(['n1']);
  });
});
