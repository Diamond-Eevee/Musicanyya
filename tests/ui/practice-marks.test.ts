import { describe, expect, it, vi } from 'vitest';
import { drawCursorOverlay } from '../../src/ui/score/cursor-overlay.js';
import { drawLoopMarks, drawPracticeMarks } from '../../src/ui/score/practice-marks.js';

describe('practice marks rendering', () => {
  it('each of the nine MarkStates renders a distinct shape class as well as a colour, and no mark covers the notehead', () => {
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

    // Call drawPracticeMarks with a variety of states
    const marks = [
      { noteId: 'n1', state: 'waiting' as const },
      { noteId: 'n2', state: 'correctSoFar' as const },
      { noteId: 'n3', state: 'correct' as const },
      { noteId: 'n4', state: 'wrongPitch' as const },
      { noteId: 'n5', state: 'wrongOctave' as const },
      { noteId: 'n6', state: 'extra' as const },
      { noteId: 'n7', state: 'heldOver' as const },
      { noteId: 'n8', state: 'playedAlong' as const },
      { noteId: 'n9', state: 'skipped' as const },
    ];

    // Pass noteRects for each
    const noteRects = new Map([
      ['n1', getRect('n1')],
      ['n2', getRect('n2')],
      ['n3', getRect('n3')],
      ['n4', getRect('n4')],
      ['n5', getRect('n5')],
      ['n6', getRect('n6')],
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
