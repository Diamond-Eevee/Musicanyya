// R-9: a `loopCompleted` effect is the source of the `practised` progress event (feature 013 US2) for a musician
// who loops a passage instead of reaching the end of the Score.
import { describe, expect, it } from 'vitest';
import { applyInput, startSession } from '../../../src/core/practice/matcher.js';
import type {
  ExpectedEvent,
  PracticeEffect,
  PracticeInput,
  PracticeSession,
  ResolvedLoop,
} from '../../../src/core/practice/types.js';

function ev(index: number, key: number): ExpectedEvent {
  return {
    index,
    passIndex: index,
    measureIndex: index,
    onsetTick: index * 100,
    required: [{ key, noteIds: [`n${index}`], staff: 1 }],
    accompaniment: [],
    orchestra: [],
  };
}

function loopOf(fromEventIndex: number, toEventIndex: number): ResolvedLoop {
  return { fromEventIndex, toEventIndex, fromPassIndex: fromEventIndex, toPassIndex: toEventIndex, occurrence: null };
}

// e0 e1 e2 e3 e4 on keys 60 62 64 65 67, each its own measure (measureIndex = event index)
const EVENTS = [ev(0, 60), ev(1, 62), ev(2, 64), ev(3, 65), ev(4, 67)];

function start(loop: ResolvedLoop | null, startEventIndex: number, events: readonly ExpectedEvent[] = EVENTS) {
  return startSession({ scoreId: 'test', events, startEventIndex, loop, accompaniment: true, help: false });
}

let clock = 0;
function apply(session: PracticeSession, input: Omit<PracticeInput, 'timeStampMs'>) {
  return applyInput(session, { ...input, timeStampMs: clock++ });
}

function play(session: PracticeSession, ...keys: number[]) {
  let current = session;
  const effects: PracticeEffect[] = [];
  for (const key of keys) {
    for (const input of [{ type: 'noteOn', key } as const, { type: 'noteOff', key } as const]) {
      const step = apply(current, input);
      current = step.session;
      effects.push(...step.effects);
    }
  }
  return { session: current, effects };
}

describe('loopCompleted (R-9): the loop wraps because its last event was played', () => {
  it('is emitted once when the loop wraps after playing its last event', () => {
    const { effects } = play(start(loopOf(1, 2), 1), 62, 64);

    expect(effects.filter((e) => e.type === 'loopCompleted')).toHaveLength(1);
  });

  it("carries the loop's own bars, 1-based written measure numbers (data-model.md §4)", () => {
    const { effects } = play(start(loopOf(1, 3), 1), 62, 64, 65);

    expect(effects.find((e) => e.type === 'loopCompleted')).toEqual({
      type: 'loopCompleted',
      fromMeasure: 2, // event 1 -> measureIndex 1 -> written measure 2
      toMeasure: 4, // event 3 -> measureIndex 3 -> written measure 4
    });
  });

  it('is emitted again each time the loop wraps around', () => {
    const { effects } = play(start(loopOf(1, 2), 1), 62, 64, 62, 64, 62, 64);

    expect(effects.filter((e) => e.type === 'loopCompleted')).toHaveLength(3);
  });

  it('a one-event loop emits it on every pass, with equal from/to measures', () => {
    const { effects } = play(start(loopOf(2, 2), 2), 64);

    expect(effects.filter((e) => e.type === 'loopCompleted')).toEqual([
      { type: 'loopCompleted', fromMeasure: 3, toMeasure: 3 },
    ]);
  });

  it('is never emitted by skipNext, even when skipping wraps the loop the same way playing would', () => {
    const step = apply(start(loopOf(1, 2), 2), { type: 'skipNext' });

    expect(step.session.index).toBe(1); // confirms the wrap did happen
    expect(step.effects.some((e) => e.type === 'loopCompleted')).toBe(false);
  });

  it('is never emitted without a loop, even at the end of the Score', () => {
    const { effects } = play(start(null, 1), 62, 64, 65, 67);

    expect(effects.some((e) => e.type === 'loopCompleted')).toBe(false);
    expect(effects.some((e) => e.type === 'sessionEnded')).toBe(true);
  });

  it("a wrong key at the loop's last event does not wrap it, so no loopCompleted either", () => {
    const { effects } = play(start(loopOf(1, 2), 2), 70);

    expect(effects.some((e) => e.type === 'loopCompleted')).toBe(false);
  });
});
