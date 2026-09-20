import { describe, expect, it } from 'vitest';
import { buildExpectedEvents } from '../../../src/core/practice/expected.js';
import { loopRangeToPassIndices, passIndicesToLoopRange, resolveLoop } from '../../../src/core/practice/loop.js';
import type { ExpectedEvent, HandSelection, ResolvedLoop } from '../../../src/core/practice/types.js';
import { loadFixture } from './helpers.js';

/** A bare event: only the fields a loop reads. */
function ev(index: number, passIndex: number, measureIndex: number): ExpectedEvent {
  return {
    index,
    passIndex,
    measureIndex,
    onsetTick: index * 100,
    required: [{ key: 60, noteIds: [], staff: 1 }],
    accompaniment: [],
  };
}

/** The measure played by each pass of an unrolled timeline: `passesOf(0, 1, 0, 2)` is m1 m2 m1 m3. */
function passesOf(...measureIndices: number[]): { measureIndex: number }[] {
  return measureIndices.map((measureIndex) => ({ measureIndex }));
}

/** One event per pass. */
function eventsFor(passes: readonly { measureIndex: number }[]): ExpectedEvent[] {
  return passes.map((pass, i) => ev(i, i, pass.measureIndex));
}

describe('resolveLoop: the range', () => {
  const passes = passesOf(0, 1, 2, 3, 4, 5);
  const events = eventsFor(passes);

  it('resolves a measure range to the events of those measures (AS-3.1)', () => {
    const loop = resolveLoop(events, passes, { fromMeasureIndex: 2, toMeasureIndex: 3 }, 0);

    expect(loop).toEqual({
      fromEventIndex: 2,
      toEventIndex: 3,
      fromPassIndex: 2,
      toPassIndex: 3,
      occurrence: null,
    });
  });

  it('corrects a reversed range instead of refusing it (AS-3.4)', () => {
    const reversed = resolveLoop(events, passes, { fromMeasureIndex: 3, toMeasureIndex: 2 }, 0);

    expect(reversed).toEqual(resolveLoop(events, passes, { fromMeasureIndex: 2, toMeasureIndex: 3 }, 0));
    expect(reversed?.fromEventIndex).toBe(2);
  });

  it('a one-measure range is a loop over that measure', () => {
    const loop = resolveLoop(events, passes, { fromMeasureIndex: 4, toMeasureIndex: 4 }, 0);

    expect([loop?.fromEventIndex, loop?.toEventIndex]).toEqual([4, 4]);
  });

  it('takes every event of every pass in the range, not one per measure', () => {
    const many = [ev(0, 0, 0), ev(1, 1, 1), ev(2, 1, 1), ev(3, 1, 1), ev(4, 2, 2)];
    const loop = resolveLoop(many, passesOf(0, 1, 2), { fromMeasureIndex: 1, toMeasureIndex: 1 }, 0);

    expect([loop?.fromEventIndex, loop?.toEventIndex]).toEqual([1, 3]);
  });

  it('is null when nothing can be resolved: no events, or a range outside the Score (R-06)', () => {
    expect(resolveLoop([], passes, { fromMeasureIndex: 0, toMeasureIndex: 1 }, 0)).toBeNull();
    expect(resolveLoop(events, passes, { fromMeasureIndex: 8, toMeasureIndex: 9 }, 0)).toBeNull();
    expect(resolveLoop(events, [], { fromMeasureIndex: 0, toMeasureIndex: 1 }, 0)).toBeNull();
  });

  it('is null when the practised hand has no required events in the range (R-06)', () => {
    // the hand rests in measures 1 and 2: no event carries those measures
    const resting = [ev(0, 0, 0), ev(1, 3, 3)];

    expect(resolveLoop(resting, passesOf(0, 1, 2, 3), { fromMeasureIndex: 1, toMeasureIndex: 2 }, 0)).toBeNull();
  });

  it('a measure the hand rests in stays inside the range and does not split it', () => {
    const resting = [ev(0, 0, 0), ev(1, 2, 2)];
    const loop = resolveLoop(resting, passesOf(0, 1, 2), { fromMeasureIndex: 0, toMeasureIndex: 2 }, 0);

    expect(loop).toMatchObject({ fromEventIndex: 0, toEventIndex: 1, fromPassIndex: 0, toPassIndex: 2 });
    expect(loop?.occurrence).toBeNull();
  });

  it('a cursor outside the Score is clamped, never a crash', () => {
    expect(resolveLoop(events, passes, { fromMeasureIndex: 2, toMeasureIndex: 3 }, -5)?.fromEventIndex).toBe(2);
    expect(resolveLoop(events, passes, { fromMeasureIndex: 2, toMeasureIndex: 3 }, 999)?.fromEventIndex).toBe(2);
  });
});

describe('resolveLoop: which occurrence (R-06, PRACTICE_LOOP_OCCURRENCE = current-pass)', () => {
  // repeat-simple: measures 0 and 1, repeated once -> passes m0 m1 m0 m1
  const { score, timeline } = loadFixture('repeat-simple.musicxml');
  const events = buildExpectedEvents(score, timeline, { preset: 'both', partIndex: 0, staves: [1] });
  const passes = timeline.passes;
  const measure0 = { fromMeasureIndex: 0, toMeasureIndex: 0 };

  it('the fixture unrolls into m0 m1 m0 m1', () => {
    expect(passes.map((p) => p.measureIndex)).toEqual([0, 1, 0, 1]);
  });

  it('keeps a repeat that lies inside the range inside the loop', () => {
    const loop = resolveLoop(events, passes, { fromMeasureIndex: 0, toMeasureIndex: 1 }, 0);

    expect(loop).toMatchObject({ fromEventIndex: 0, toEventIndex: 3, fromPassIndex: 0, toPassIndex: 3 });
    expect(loop?.occurrence).toBeNull();
  });

  it('a range that is played twice resolves to the occurrence the cursor is in', () => {
    expect(resolveLoop(events, passes, measure0, 0)).toMatchObject({
      fromEventIndex: 0,
      toEventIndex: 0,
      occurrence: { index: 1, count: 2 },
    });
    expect(resolveLoop(events, passes, measure0, 2)).toMatchObject({
      fromEventIndex: 2,
      toEventIndex: 2,
      occurrence: { index: 2, count: 2 },
    });
  });

  it('otherwise to the first occurrence at or after the cursor', () => {
    // event 1 is measure 1, between the two times measure 0 is played
    expect(resolveLoop(events, passes, measure0, 1)?.fromEventIndex).toBe(2);
  });

  it('with no occurrence at or after the cursor, to the first occurrence in the Score', () => {
    expect(resolveLoop(events, passes, measure0, 3)?.fromEventIndex).toBe(0);
  });

  it('a range that stays in the Score once carries no occurrence label', () => {
    const loop = resolveLoop(events, passes, { fromMeasureIndex: 0, toMeasureIndex: 1 }, 2);

    expect(loop?.occurrence).toBeNull();
  });
});

describe('resolveLoop: repeats and endings', () => {
  // volta-1-2: m0 (repeat start), m1 (ending 1, repeat back), m2 (ending 2), m3 -> passes m0 m1 m0 m2 m3
  const { score, timeline } = loadFixture('volta-1-2.musicxml');
  const events = buildExpectedEvents(score, timeline, { preset: 'both', partIndex: 0, staves: [1] });
  const passes = timeline.passes;

  it('the fixture unrolls into m0 m1 m0 m2 m3', () => {
    expect(passes.map((p) => p.measureIndex)).toEqual([0, 1, 0, 2, 3]);
  });

  it('a range ends at its last written measure: it does not slide on into the second ending', () => {
    const loop = resolveLoop(events, passes, { fromMeasureIndex: 0, toMeasureIndex: 1 }, 0);

    expect(loop).toMatchObject({ fromPassIndex: 0, toPassIndex: 1 });
    expect(events[loop?.toEventIndex ?? -1]?.measureIndex).toBe(1);
  });

  it('a range that spans both endings runs the whole unrolled passage', () => {
    const loop = resolveLoop(events, passes, { fromMeasureIndex: 0, toMeasureIndex: 3 }, 0);

    expect(loop).toMatchObject({ fromPassIndex: 0, toPassIndex: 4 });
    expect(loop?.toEventIndex).toBe(events.length - 1);
  });

  it('a range inside the second ending is the second ending only', () => {
    const loop = resolveLoop(events, passes, { fromMeasureIndex: 2, toMeasureIndex: 2 }, 0);

    expect(loop).toMatchObject({ fromPassIndex: 3, toPassIndex: 3 });
    expect(loop?.occurrence).toBeNull();
  });
});

describe('the stored form of a loop: unrolled pass indices (R-06, practice-settings)', () => {
  const selection: HandSelection = { preset: 'both', partIndex: 0, staves: [1] };

  it('loopRangeToPassIndices is the pass span of the occurrence, not its first and last event', () => {
    const resting = [ev(0, 1, 1), ev(1, 2, 2)];
    const loop = resolveLoop(resting, passesOf(0, 1, 2, 3), { fromMeasureIndex: 0, toMeasureIndex: 3 }, 0);

    // the hand rests in measures 0 and 3, but the musician's range was measures 0-3
    expect(loop && loopRangeToPassIndices(loop)).toEqual({ fromPassIndex: 0, toPassIndex: 3 });
  });

  it('passIndicesToLoopRange reads the written measures of the first and last pass', () => {
    const passes = passesOf(0, 1, 0, 1, 2);

    expect(passIndicesToLoopRange(passes, { fromPassIndex: 2, toPassIndex: 3 })).toEqual({
      fromMeasureIndex: 0,
      toMeasureIndex: 1,
    });
  });

  it('clamps an end past the timeline, and drops a span that no longer fits', () => {
    const passes = passesOf(0, 1, 2);

    expect(passIndicesToLoopRange(passes, { fromPassIndex: 1, toPassIndex: 40 })).toEqual({
      fromMeasureIndex: 1,
      toMeasureIndex: 2,
    });
    expect(passIndicesToLoopRange(passes, { fromPassIndex: 3, toPassIndex: 4 })).toBeNull();
    expect(passIndicesToLoopRange(passes, { fromPassIndex: -1, toPassIndex: 1 })).toBeNull();
    expect(passIndicesToLoopRange(passes, { fromPassIndex: 2, toPassIndex: 1 })).toBeNull();
    expect(passIndicesToLoopRange(passes, { fromPassIndex: 0.5, toPassIndex: 1 })).toBeNull();
    expect(passIndicesToLoopRange([], { fromPassIndex: 0, toPassIndex: 0 })).toBeNull();
  });

  /** Store a loop, read it back, and resolve it the way a session start does (the loop's own first pass is the
   *  cursor): it must be the very same loop, including which time through a repeat it is. */
  function roundTrip(
    events: readonly ExpectedEvent[],
    passes: readonly { measureIndex: number }[],
    loop: ResolvedLoop,
  ) {
    const span = loopRangeToPassIndices(loop);
    const range = passIndicesToLoopRange(passes, span);
    if (!range) throw new Error('the stored span must read back as a range');
    const cursor = events.findIndex((event) => event.passIndex >= span.fromPassIndex);
    return resolveLoop(events, passes, range, cursor);
  }

  it('round-trips every occurrence of a range on a repeated passage', () => {
    const { score, timeline } = loadFixture('repeat-simple.musicxml');
    const events = buildExpectedEvents(score, timeline, selection);
    const passes = timeline.passes;

    for (const range of [
      { fromMeasureIndex: 0, toMeasureIndex: 0 },
      { fromMeasureIndex: 1, toMeasureIndex: 1 },
      { fromMeasureIndex: 0, toMeasureIndex: 1 },
    ]) {
      for (let cursor = 0; cursor < events.length; cursor++) {
        const loop = resolveLoop(events, passes, range, cursor);
        expect(loop).not.toBeNull();
        if (loop) expect(roundTrip(events, passes, loop)).toEqual(loop);
      }
    }
  });

  it('round-trips a range across endings and a range over a measure the hand rests in', () => {
    const { score, timeline } = loadFixture('volta-1-2.musicxml');
    const events = buildExpectedEvents(score, timeline, selection);

    for (const range of [
      { fromMeasureIndex: 0, toMeasureIndex: 1 },
      { fromMeasureIndex: 0, toMeasureIndex: 3 },
      { fromMeasureIndex: 2, toMeasureIndex: 2 },
    ]) {
      const loop = resolveLoop(events, timeline.passes, range, 0);
      expect(loop).not.toBeNull();
      if (loop) expect(roundTrip(events, timeline.passes, loop)).toEqual(loop);
    }

    const resting = [ev(0, 1, 1), ev(1, 2, 2)];
    const restingPasses = passesOf(0, 1, 2, 3);
    const loop = resolveLoop(resting, restingPasses, { fromMeasureIndex: 0, toMeasureIndex: 3 }, 0);
    expect(loop && roundTrip(resting, restingPasses, loop)).toEqual(loop);
  });
});
