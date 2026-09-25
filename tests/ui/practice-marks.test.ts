import { describe, expect, it, vi } from 'vitest';
import { drawLoopMarks, drawPracticeMarks } from '../../src/ui/score/practice-marks.js';
import { drawStateChevron } from '../../src/ui/score/pressed-keys.js';

describe('practice marks rendering', () => {
  it('draws no mark of its own for any state: not for heldOver, playedAlong or skipped either (008 FR-009, T050)', () => {
    const dashPatterns: number[][] = [];
    const ctx = {
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      setLineDash: vi.fn((pattern: number[]) => dashPatterns.push(pattern)),
    } as unknown as CanvasRenderingContext2D;
    const rect = { left: 10, top: 20, right: 30, bottom: 40, width: 20, height: 20 } as DOMRect;

    // The outlines of these three states are gone: heldOver and skipped get a chevron from `drawStateChevron` (below),
    // playedAlong is a green notehead like a correct note (note-marks.ts); wrongPitch/wrongOctave/extra are discs.
    const marks = (['heldOver', 'playedAlong', 'skipped', 'wrongPitch', 'wrongOctave', 'extra'] as const).map(
      (state, i) => ({ noteId: `n${i}`, state }),
    );
    drawPracticeMarks({
      ctx,
      dpr: 1,
      containerRect: { left: 0, top: 0 } as DOMRect,
      marks,
      noteRects: new Map(marks.map((m) => [m.noteId, rect])),
    });

    expect(ctx.stroke).not.toHaveBeenCalled();
    expect(ctx.strokeRect).not.toHaveBeenCalled();
    expect(ctx.arc).not.toHaveBeenCalled();
    expect(ctx.moveTo).not.toHaveBeenCalled();
    expect(dashPatterns.filter((pattern) => pattern.length > 0)).toEqual([]);
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

describe('state chevrons: the shapes that tell held-over and skipped notes apart without colour (008 R-03, T050)', () => {
  interface Point {
    x: number;
    y: number;
  }
  function recording() {
    const points: Point[] = [];
    const dashes: number[][] = [];
    const styles: unknown[] = [];
    const state: Record<string, unknown> = {};
    const ctx = new Proxy(
      {},
      {
        get: (_t, name) => {
          if (typeof name === 'symbol') return undefined;
          if (name in state) return state[name];
          return (...args: unknown[]) => {
            if (name === 'moveTo' || name === 'lineTo') points.push({ x: args[0] as number, y: args[1] as number });
            if (name === 'setLineDash') dashes.push(args[0] as number[]);
            if (name === 'stroke') styles.push(state.strokeStyle);
          };
        },
        set: (_t, name, value) => {
          state[String(name)] = value;
          return true;
        },
      },
    ) as unknown as CanvasRenderingContext2D;
    return { ctx, points, dashes, styles };
  }
  /** A notehead box of one staff space (16 px) high and a little wider. */
  const head = { left: 100, right: 119, top: 200, bottom: 216, width: 19, height: 16 } as DOMRect;
  const container = { left: 0, top: 0 } as DOMRect;
  const bounds = (points: Point[]) => ({
    left: Math.min(...points.map((p) => p.x)),
    right: Math.max(...points.map((p) => p.x)),
    top: Math.min(...points.map((p) => p.y)),
    bottom: Math.max(...points.map((p) => p.y)),
  });

  it('held-over: a solid upward chevron entirely above the notehead box and within one staff space of it', () => {
    const { ctx, points, dashes, styles } = recording();
    drawStateChevron({ ctx, dpr: 1, containerRect: container, noteheadRect: head, kind: 'heldOver' });
    expect(points).toHaveLength(3);
    const [a, apex, b] = points as [Point, Point, Point];
    expect(apex.y).toBeLessThan(a.y); // it points up
    expect(a.y).toBe(b.y);
    expect(apex.x).toBeGreaterThan(a.x);
    expect(apex.x).toBeLessThan(b.x);
    const box = bounds(points);
    expect(box.bottom).toBeLessThan(head.top); // entirely above, touching nothing
    expect(head.top - box.top).toBeLessThanOrEqual(head.height); // within one staff space
    expect(box.left).toBeGreaterThanOrEqual(head.left - head.width / 2);
    expect(box.right).toBeLessThanOrEqual(head.right + head.width / 2);
    expect(styles).toEqual(['#e69f00']);
    expect(dashes.filter((d) => d.length > 0)).toEqual([]); // solid
  });

  it('skipped: a solid right-pointing chevron entirely below the notehead box and within one staff space of it', () => {
    const { ctx, points, dashes, styles } = recording();
    drawStateChevron({ ctx, dpr: 1, containerRect: container, noteheadRect: head, kind: 'skipped' });
    expect(points).toHaveLength(3);
    const [a, tip, b] = points as [Point, Point, Point];
    expect(tip.x).toBeGreaterThan(a.x); // it points right
    expect(a.x).toBe(b.x);
    expect(tip.y).toBeGreaterThan(a.y);
    expect(tip.y).toBeLessThan(b.y);
    const box = bounds(points);
    expect(box.top).toBeGreaterThan(head.bottom); // entirely below
    expect(box.bottom - head.bottom).toBeLessThanOrEqual(head.height);
    expect(styles).toEqual(['#999999']);
    expect(dashes.filter((d) => d.length > 0)).toEqual([]);
  });

  it('follows the notehead when the page is scrolled or the pixel ratio is not 1', () => {
    const { ctx, points } = recording();
    drawStateChevron({
      ctx,
      dpr: 2,
      containerRect: { left: 40, top: 60 } as DOMRect,
      noteheadRect: head,
      kind: 'heldOver',
    });
    const box = bounds(points);
    expect(box.bottom).toBeLessThan((head.top - 60) * 2);
    expect(box.left).toBeGreaterThan((head.left - 40 - head.width) * 2);
  });

  it('the two chevrons are told apart by direction and side, not only by colour', () => {
    const held = recording();
    const skipped = recording();
    drawStateChevron({ ctx: held.ctx, dpr: 1, containerRect: container, noteheadRect: head, kind: 'heldOver' });
    drawStateChevron({ ctx: skipped.ctx, dpr: 1, containerRect: container, noteheadRect: head, kind: 'skipped' });
    expect(bounds(held.points).bottom).toBeLessThan(head.top);
    expect(bounds(skipped.points).top).toBeGreaterThan(head.bottom);
  });
});
