import { describe, expect, it } from 'vitest';
import { GRACE_MIN_REMAINING_TICKS, GRACE_NOTE_TICKS } from '../../../src/core/defaults.js';
import type { GraceInput } from '../../../src/core/timeline/grace.js';
import { applyGraceTiming } from '../../../src/core/timeline/grace.js';

const PPQ = 960;

function principal(overrides: Partial<GraceInput> = {}): GraceInput {
  return {
    noteId: 'principal',
    part: 0,
    voice: '1',
    nominalTick: 960,
    graceIndex: null,
    stealPrevious: null,
    stealFollowing: null,
    durationTicks: 960,
    ...overrides,
  };
}

function grace(overrides: Partial<GraceInput> = {}): GraceInput {
  return {
    noteId: 'grace',
    part: 0,
    voice: '1',
    nominalTick: 960,
    graceIndex: 1,
    stealPrevious: null,
    stealFollowing: null,
    durationTicks: 0,
    ...overrides,
  };
}

describe('applyGraceTiming', () => {
  it('steals GRACE_NOTE_TICKS from the previous note for a single acciaccatura (grace-acciaccatura)', () => {
    const prev = principal({ noteId: 'prev', nominalTick: 0, durationTicks: 960 });
    const g = grace({ noteId: 'g1', nominalTick: 960 });
    const next = principal({ noteId: 'next', nominalTick: 960 });
    const { timed, leadInTicks } = applyGraceTiming([prev, g, next], PPQ);
    const byId = Object.fromEntries(timed.map((t) => [t.noteId, t]));
    const graceTicks = GRACE_NOTE_TICKS(PPQ);
    expect(byId.g1).toEqual({ noteId: 'g1', startTick: 960 - graceTicks, endTick: 960 });
    expect(byId.prev).toEqual({ noteId: 'prev', startTick: 0, endTick: 960 - graceTicks });
    expect(byId.next).toEqual({ noteId: 'next', startTick: 960, endTick: 1920 });
    expect(leadInTicks).toBe(0);
  });

  it('caps a large grace group at GRACE_MAX_STEAL_RATIO of the previous note', () => {
    // 3 * GRACE_NOTE_TICKS(960) = 360, which would exceed half of a 200-tick note (cap 100) while
    // still leaving well over GRACE_MIN_REMAINING_TICKS, so the ratio cap is what binds here.
    const prev = principal({ noteId: 'prev', nominalTick: 0, durationTicks: 200 });
    const graces = [
      grace({ noteId: 'g1', graceIndex: 1 }),
      grace({ noteId: 'g2', graceIndex: 2 }),
      grace({ noteId: 'g3', graceIndex: 3 }),
    ];
    const { timed } = applyGraceTiming([prev, ...graces], PPQ);
    const byId = Object.fromEntries(timed.map((t) => [t.noteId, t]));
    const totalStolen = byId.prev.endTick - byId.prev.startTick;
    expect(200 - totalStolen).toBe(100);
    expect(byId.g1.endTick).toBe(byId.g2.startTick);
    expect(byId.g2.endTick).toBe(byId.g3.startTick);
    expect(byId.g3.endTick).toBe(960);
  });

  it('never shortens the previous note below GRACE_MIN_REMAINING_TICKS', () => {
    const minRemaining = GRACE_MIN_REMAINING_TICKS(PPQ);
    const prev = principal({ noteId: 'prev', nominalTick: 0, durationTicks: minRemaining + 10 });
    const graces = Array.from({ length: 8 }, (_, i) => grace({ noteId: `g${i}`, graceIndex: i + 1 }));
    const { timed } = applyGraceTiming([prev, ...graces], PPQ);
    const byId = Object.fromEntries(timed.map((t) => [t.noteId, t]));
    expect(byId.prev.endTick - byId.prev.startTick).toBeGreaterThanOrEqual(minRemaining);
  });

  it('honours steal-time-following: the group stays on the beat and delays the principal', () => {
    const g = grace({ noteId: 'g1', stealFollowing: 100, nominalTick: 960 });
    const next = principal({ noteId: 'next', nominalTick: 960, durationTicks: 960 });
    const { timed } = applyGraceTiming([g, next], PPQ);
    const byId = Object.fromEntries(timed.map((t) => [t.noteId, t]));
    const graceTicks = GRACE_NOTE_TICKS(PPQ);
    expect(byId.g1.startTick).toBe(960);
    expect(byId.g1.endTick).toBe(960 + graceTicks);
    expect(byId.next.startTick).toBe(960 + graceTicks);
    expect(byId.next.endTick).toBe(960 + graceTicks + 960);
  });

  it('gives grace notes at the very start of the piece a lead-in before tick 0 (grace-group-at-start)', () => {
    const graces = [
      grace({ noteId: 'g1', graceIndex: 1, nominalTick: 0 }),
      grace({ noteId: 'g2', graceIndex: 2, nominalTick: 0 }),
    ];
    const next = principal({ noteId: 'first', nominalTick: 0 });
    const { timed, leadInTicks } = applyGraceTiming([...graces, next], PPQ);
    const graceTicks = GRACE_NOTE_TICKS(PPQ);
    expect(leadInTicks).toBe(graceTicks * 2);
    const byId = Object.fromEntries(timed.map((t) => [t.noteId, t]));
    // Everything is shifted forward by leadInTicks so nothing starts before 0.
    expect(byId.g1.startTick).toBe(0);
    expect(byId.g2.startTick).toBe(graceTicks);
    expect(byId.first.startTick).toBe(leadInTicks);
    expect(timed.every((t) => t.startTick >= 0)).toBe(true);
  });

  it('places a trailing grace group (after a note, at measure end) before the next note it borrows from', () => {
    // grace-after-note-end-of-measure: graces share the onset of whatever comes right after them
    // (here, the first note of the following measure), since they never advance the cursor.
    const prev = principal({ noteId: 'prev', nominalTick: 0, durationTicks: 960 });
    const g = grace({ noteId: 'g1', nominalTick: 960 });
    const nextMeasureNote = principal({ noteId: 'nextMeasure', nominalTick: 960 });
    const { timed } = applyGraceTiming([prev, g, nextMeasureNote], PPQ);
    const byId = Object.fromEntries(timed.map((t) => [t.noteId, t]));
    expect(byId.g1.endTick).toBe(960);
    expect(byId.nextMeasure.startTick).toBe(960);
  });
});
