import { describe, expect, it, vi } from 'vitest';
import { drawCursorOverlay } from '../../src/ui/score/cursor-overlay.js';
import { drawLoopMarks, drawPracticeMarks } from '../../src/ui/score/practice-marks.js';

describe('practice marks rendering', () => {
  it('the states still drawn as outlines (heldOver, playedAlong, skipped) render a stroke, until US3 replaces them (T050)', () => {
    // We will test that drawPracticeMarks calls the appropriate canvas context methods
    // with different fillStyles and shapes (rects, arcs, etc.) for each MarkState.
    const ctx = {
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      setLineDash: vi.fn(),
      closePath: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    // We can define dummy note rects
    const getRect = (id: string): DOMRect =>
      ({ left: 10, top: 20, right: 30, bottom: 40, width: 20, height: 20 }) as DOMRect;

    // Call drawPracticeMarks with a variety of states. wrongPitch/wrongOctave/extra are excluded: they have no
    // notehead of their own to mark (the key pressed is not written at this event at all) and are never produced
    // as a `markNotes` state by the matcher any more - they reach the on-screen keyboard instead, via the separate
    // `keyFeedback` effect (T056, R-14), covered by tests/ui/practice-key-feedback.test.ts.
    // 008 T013: waiting, correctSoFar and correct are no longer outlines (FR-009): they are the printed notehead in
    // green (or nothing, for waiting) and are asserted below. The other three stay until T050/T054 (US3).
    const marks = [
      { noteId: 'n7', state: 'heldOver' as const },
      { noteId: 'n8', state: 'playedAlong' as const },
      { noteId: 'n9', state: 'skipped' as const },
    ];

    // Pass noteRects for each
    const noteRects = new Map([
      ['n7', getRect('n7')],
      ['n8', getRect('n8')],
      ['n9', getRect('n9')],
    ]);

    drawPracticeMarks({
      ctx,
      dpr: 1,
      containerRect: { left: 0, top: 0 } as DOMRect,
      marks,
      noteRects,
    });

    // The test asserts that drawPracticeMarks uses stroke methods to avoid covering noteheads
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.strokeRect).toHaveBeenCalled();
  });

  it('waiting, correctSoFar and correct draw no outline at all, never a dashed one; dimming is unchanged (008 FR-009, T013)', () => {
    const dashPatterns: number[][] = [];
    const ctx = {
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      rect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      setLineDash: vi.fn((pattern: number[]) => dashPatterns.push(pattern)),
    } as unknown as CanvasRenderingContext2D;
    const rect = { left: 10, top: 20, right: 30, bottom: 40, width: 20, height: 20 } as DOMRect;

    drawPracticeMarks({
      ctx,
      dpr: 1,
      containerRect: { left: 0, top: 0 } as DOMRect,
      marks: [
        { noteId: 'w', state: 'waiting' },
        { noteId: 's', state: 'correctSoFar' },
        { noteId: 'c', state: 'correct' },
      ],
      noteRects: new Map([
        ['w', rect],
        ['s', rect],
        ['c', rect],
      ]),
      dimmedNoteRects: [{ left: 50, top: 20, right: 70, bottom: 40, width: 20, height: 20 } as DOMRect],
    });

    // Not a ring, not a square, not a line: nothing but the dimming of the unselected hand's notes
    expect(ctx.stroke).not.toHaveBeenCalled();
    expect(ctx.strokeRect).not.toHaveBeenCalled();
    expect(ctx.arc).not.toHaveBeenCalled();
    expect(ctx.moveTo).not.toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalledTimes(1); // the one dimmed rect, untouched behaviour
    expect(dashPatterns.filter((pattern) => pattern.length > 0)).toEqual([]); // never a dashed pattern
  });

  it('waiting cursor sits on the expected event (using drawCursorOverlay with mode)', () => {
    const ctx = {
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    drawCursorOverlay({
      ctx,
      dpr: 1,
      measureRect: { left: 5, top: 10, bottom: 50, right: 50 } as DOMRect,
      noteRects: [{ left: 20, top: 20, bottom: 30, right: 30 } as DOMRect],
      containerRect: { left: 0, top: 0 } as DOMRect,
      isPracticeWaiting: true, // Some new flag we will add to drawCursorOverlay
    });

    // Practice cursor should be visually distinct (e.g., hollow box instead of line)
    // For now we just expect it to draw something around the note
    expect(ctx.strokeRect).toHaveBeenCalled(); // e.g. it draws a strokeRect around the expected event
  });
});

describe('loop marks (AS-3.2: the looped measures are clearly marked)', () => {
  function recordingCtx() {
    const segments: { x: number; y: number; kind: 'move' | 'line' }[] = [];
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn((x: number, y: number) => segments.push({ x, y, kind: 'move' })),
      lineTo: vi.fn((x: number, y: number) => segments.push({ x, y, kind: 'line' })),
      setLineDash: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    return { ctx, segments };
  }

  const rect = (left: number, top: number): DOMRect =>
    ({ left, top, right: left + 100, bottom: top + 60, width: 100, height: 60 }) as DOMRect;
  const containerRect = { left: 0, top: 0 } as DOMRect;

  it('draws a bracket over the measures, as a line and not only a colour', () => {
    const { ctx, segments } = recordingCtx();

    drawLoopMarks({
      ctx,
      dpr: 1,
      containerRect,
      measures: [
        { rect: rect(100, 50), first: true, last: false },
        { rect: rect(200, 50), first: false, last: true },
      ],
    });

    expect(ctx.stroke).toHaveBeenCalled();
    expect(segments.length).toBeGreaterThan(0);
  });

  it('never draws below the top of a measure, so it cannot cover a notehead', () => {
    const { ctx, segments } = recordingCtx();

    drawLoopMarks({
      ctx,
      dpr: 1,
      containerRect,
      measures: [{ rect: rect(100, 50), first: true, last: true }],
    });

    for (const point of segments) expect(point.y).toBeLessThanOrEqual(50);
  });

  it('closes the bracket with an end stroke only at the first and the last measure of the range', () => {
    const { ctx, segments } = recordingCtx();

    drawLoopMarks({
      ctx,
      dpr: 1,
      containerRect,
      measures: [
        { rect: rect(100, 50), first: true, last: false },
        { rect: rect(200, 50), first: false, last: false },
        { rect: rect(300, 50), first: false, last: true },
      ],
    });

    // an end stroke is a segment that changes y at a fixed x
    const verticals = new Set<number>();
    for (let i = 1; i < segments.length; i++) {
      const a = segments[i - 1];
      const b = segments[i];
      if (a && b && b.kind === 'line' && a.x === b.x && a.y !== b.y) verticals.add(a.x);
    }
    expect([...verticals].sort((a, b) => a - b)).toEqual([100, 400]);
  });

  it('draws nothing for an empty range', () => {
    const { ctx } = recordingCtx();

    drawLoopMarks({ ctx, dpr: 1, containerRect, measures: [] });

    expect(ctx.stroke).not.toHaveBeenCalled();
  });
});
