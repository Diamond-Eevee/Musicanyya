import { describe, expect, it } from 'vitest';
import { buildExpectedNotes, buildPlayedAlongSpans } from '../../../src/core/grade/expected.js';
import type { TickedMessage } from '../../../src/core/grade/match.js';
import { matchPerformance } from '../../../src/core/grade/match.js';
import type { ExpectedNote } from '../../../src/core/grade/types.js';
import type { ResolvedWindow } from '../../../src/core/grade/windows.js';
import { loadFixture } from './helpers.js';

const RIGHT = { preset: 'right' as const, partIndex: 0, staves: [1] };
const BOTH = { preset: 'both' as const, partIndex: 0, staves: [1] };

function wide(): ResolvedWindow {
  return {
    onTimeEarlyTicks: 50,
    onTimeLateTicks: 50,
    claimEarlyTicks: 50,
    claimLateTicks: 50,
    timingNotResolvable: false,
  };
}

function on(key: number, tick: number): TickedMessage {
  return { kind: 'noteOn', key, velocity: 80, tick, audioTimeSec: tick / 1000 };
}

describe('played-along spans and match pass 3 (T093, research R-18, FR-024)', () => {
  it('the ungraded (left) hand becomes PlayedAlongPress, never wrong or extra (played-along-both-hands)', () => {
    const { score, timeline } = loadFixture('played-along-both-hands.musicxml', RIGHT);
    const expected = buildExpectedNotes(score, timeline, RIGHT, null);
    const spans = buildPlayedAlongSpans(score, timeline, RIGHT, null);
    expect(spans.filter((s) => s.source === 'ungraded')).toHaveLength(4); // Bb2,Bb2,D2,D2

    const windows = expected.map(() => wide());
    // Play only the left hand (never the graded right hand), at its real onsets.
    const leftHandKeys = [46, 46, 38, 38]; // Bb2, Bb2, D2, D2
    const messages = spans.filter((s) => s.source === 'ungraded').map((s) => on(s.key, s.fromTick));
    expect(messages.map((m) => m.key)).toEqual(leftHandKeys);

    const { claims, missedIndices, playedAlong, extraMessageIndices } = matchPerformance(
      expected,
      windows,
      messages,
      spans,
    );
    expect(claims).toEqual([]); // never claims a graded (right-hand) note
    expect(extraMessageIndices).toEqual([]); // never extra
    expect(playedAlong).toHaveLength(4);
    expect(playedAlong.every((p) => p.source === 'ungraded')).toBe(true);
    // the right hand is entirely missed, since nothing played it
    expect(missedIndices).toEqual(expected.map((n) => n.index));
  });

  it("an ornament's realisation becomes PlayedAlongPress, source 'ornament' (trill-realisation)", () => {
    const { score, timeline } = loadFixture('trill-realisation.musicxml', BOTH);
    const expected: readonly ExpectedNote[] = buildExpectedNotes(score, timeline, BOTH, null);
    const spans = buildPlayedAlongSpans(score, timeline, BOTH, null);
    const ornamentSpans = spans.filter((s) => s.source === 'ornament');
    // trill-mark, mordent and turn each get an upper and lower diatonic neighbour; tremolo and the unknown
    // ornament (T085's inverted-mordent) do not realise extra pitches here.
    expect(ornamentSpans.length).toBeGreaterThanOrEqual(2);

    const firstNoteSpans = ornamentSpans.filter((s) => s.fromTick === expected[0]!.onsetTick);
    expect(firstNoteSpans.length).toBe(2); // trill-mark on the first note: one neighbour each way
    const neighbourKey = firstNoteSpans[0]!.key;

    const windows = expected.map(() => wide());
    // A press at the trill's neighbour pitch, inside the note's written duration, well away from any other
    // expected note's claim window.
    const pressTick = expected[0]!.onsetTick + 100;
    const { claims, playedAlong, extraMessageIndices } = matchPerformance(
      expected,
      windows,
      [on(neighbourKey, pressTick)],
      spans,
    );
    expect(claims).toEqual([]);
    expect(extraMessageIndices).toEqual([]);
    expect(playedAlong).toEqual([{ messageIndex: 0, source: 'ornament' }]);
  });

  it('a press that could claim a graded note still claims it, because pass 3 runs last', () => {
    const { score, timeline } = loadFixture('played-along-both-hands.musicxml', RIGHT);
    const expected = buildExpectedNotes(score, timeline, RIGHT, null);
    const spans = buildPlayedAlongSpans(score, timeline, RIGHT, null);
    const windows = expected.map(() => wide());
    // E5 (key 76) is the first graded note; play it correctly - it must be claimed, not treated as played-along
    // even though it shares an onset with an ungraded span.
    const { claims, playedAlong } = matchPerformance(
      expected,
      windows,
      [on(expected[0]!.key, expected[0]!.onsetTick)],
      spans,
    );
    expect(claims).toEqual([{ expectedIndex: expected[0]!.index, messageIndex: 0, pass: 'exact' }]);
    expect(playedAlong).toEqual([]);
  });

  it('a press outside every span stays extra', () => {
    const { score, timeline } = loadFixture('played-along-both-hands.musicxml', RIGHT);
    const expected = buildExpectedNotes(score, timeline, RIGHT, null);
    const spans = buildPlayedAlongSpans(score, timeline, RIGHT, null);
    const windows = expected.map(() => wide());
    // A key that is neither a graded right-hand note nor anywhere in the ungraded left-hand spans.
    const { claims, playedAlong, extraMessageIndices } = matchPerformance(expected, windows, [on(30, 0)], spans);
    expect(claims).toEqual([]);
    expect(playedAlong).toEqual([]);
    expect(extraMessageIndices).toEqual([0]);
  });
});
