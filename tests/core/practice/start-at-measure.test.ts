import { describe, expect, it } from 'vitest';
import {
  buildExpectedEvents,
  firstEventAtOrAfterTick,
  resolveStartMeasure,
} from '../../../src/core/practice/expected.js';
import type { ExpectedEvent, HandSelection } from '../../../src/core/practice/types.js';
import { loadFixture } from './helpers.js';

/** A bare event: only the fields the resolution rule reads. */
function ev(index: number, passIndex: number, measureIndex: number, onsetTick = index * 100): ExpectedEvent {
  return {
    index,
    passIndex,
    measureIndex,
    onsetTick,
    required: [{ key: 60, noteIds: [], staff: 1 }],
    accompaniment: [],
  };
}

describe('resolveStartMeasure on a played-twice measure (FR-015, AS-2.3, R-06)', () => {
  // repeat-simple: measures 0 and 1, repeated once -> passes m0 m1 m0 m1
  const { score, timeline } = loadFixture('repeat-simple.musicxml');
  const events = buildExpectedEvents(score, timeline, { preset: 'both', partIndex: 0, staves: [1] });

  it('the fixture unrolls into four events, two per pass', () => {
    expect(events.map((e) => [e.passIndex, e.measureIndex])).toEqual([
      [0, 0],
      [1, 1],
      [2, 0],
      [3, 1],
    ]);
  });

  it('starts at the occurrence the cursor is in', () => {
    expect(resolveStartMeasure(events, 0, 0)).toBe(0);
    expect(resolveStartMeasure(events, 0, 2)).toBe(2);
    expect(resolveStartMeasure(events, 1, 3)).toBe(3);
  });

  it('otherwise starts at the first occurrence at or after the cursor', () => {
    expect(resolveStartMeasure(events, 1, 0)).toBe(1);
    expect(resolveStartMeasure(events, 0, 1)).toBe(2);
    expect(resolveStartMeasure(events, 1, 2)).toBe(3);
  });

  it('with no occurrence at or after the cursor, starts at the first occurrence in the Score', () => {
    expect(resolveStartMeasure(events, 0, 3)).toBe(0);
  });
});

describe('resolveStartMeasure picks the first expected event of the measure', () => {
  it('backs up to the first event of the occurrence when the cursor is part-way through it', () => {
    const events = [ev(0, 0, 0), ev(1, 0, 0), ev(2, 0, 0), ev(3, 0, 1)];

    expect(resolveStartMeasure(events, 0, 2)).toBe(0);
  });

  it('never lands in the middle of a measure entered from before it', () => {
    const events = [ev(0, 0, 0), ev(1, 0, 1), ev(2, 0, 1), ev(3, 0, 1)];

    expect(resolveStartMeasure(events, 1, 0)).toBe(1);
  });

  it('a measure with no expected events for this selection starts at the next one that has some', () => {
    const events = [ev(0, 0, 0), ev(1, 1, 2), ev(2, 1, 3)];

    expect(resolveStartMeasure(events, 1, 0)).toBe(1);
  });

  it('is null when nothing at or after that measure can be played, or there are no events', () => {
    expect(resolveStartMeasure([ev(0, 0, 0)], 4, 0)).toBeNull();
    expect(resolveStartMeasure([], 0, 0)).toBeNull();
  });

  it('accepts a measure index outside the Score without throwing', () => {
    expect(resolveStartMeasure([ev(0, 0, 0)], -3, 0)).toBe(0);
    expect(resolveStartMeasure([ev(0, 0, 0)], 99, 0)).toBeNull();
  });
});

describe('a selection change restarts from the current measure (AS-2.4)', () => {
  const RIGHT: HandSelection = { preset: 'right', partIndex: 0, staves: [1] };
  const BOTH: HandSelection = { preset: 'both', partIndex: 0, staves: [1, 2] };

  it('firstEventAtOrAfterTick maps a position onto the rebuilt event list', () => {
    const { score, timeline } = loadFixture('hands-accompaniment.musicxml');
    const right = buildExpectedEvents(score, timeline, RIGHT);
    const both = buildExpectedEvents(score, timeline, BOTH);

    const third = right[2];
    if (!third) throw new Error('expected three right-hand events');
    // right-hand event 2 is at beat 4; with both hands the first event at or after it is the beat-4 chord
    expect(firstEventAtOrAfterTick(both, third.onsetTick)).toBe(3);
    // past the last event: clamped to the last one
    expect(firstEventAtOrAfterTick(both, third.onsetTick + 100000)).toBe(both.length - 1);
    expect(firstEventAtOrAfterTick([], 0)).toBe(0);
  });

  it('restarts at the first event of the measure, not at the note that was reached', () => {
    const { score, timeline } = loadFixture('hands-accompaniment.musicxml');
    const right = buildExpectedEvents(score, timeline, RIGHT);
    const both = buildExpectedEvents(score, timeline, BOTH);

    const reached = right[2];
    if (!reached) throw new Error('expected three right-hand events');
    const cursor = firstEventAtOrAfterTick(both, reached.onsetTick);

    expect(resolveStartMeasure(both, reached.measureIndex, cursor)).toBe(0);
  });
});
