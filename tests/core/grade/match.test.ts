import { describe, expect, it } from 'vitest';
import { buildExpectedNotes } from '../../../src/core/grade/expected.js';
import type { TickedMessage } from '../../../src/core/grade/match.js';
import { matchPerformance } from '../../../src/core/grade/match.js';
import type { ExpectedNote } from '../../../src/core/grade/types.js';
import type { ResolvedWindow } from '../../../src/core/grade/windows.js';
import { resolveWindows } from '../../../src/core/grade/windows.js';
import { loadFixture } from './helpers.js';

const BOTH = { preset: 'both' as const, partIndex: 0, staves: [1, 2] };

function expectedNote(index: number, onsetTick: number, key: number): ExpectedNote {
  return {
    index,
    noteIds: [`n${index}`],
    key,
    onsetTick,
    measureIndex: 0,
    passIndex: 0,
    chordSize: 1,
    arpeggiated: false,
  };
}

function wide(): ResolvedWindow {
  return {
    onTimeEarlyTicks: 100,
    onTimeLateTicks: 100,
    claimEarlyTicks: 100000,
    claimLateTicks: 100000,
    timingNotResolvable: false,
  };
}

function on(key: number, tick: number, audioTimeSec = tick / 1000, velocity = 80): TickedMessage {
  return { kind: 'noteOn', key, velocity, tick, audioTimeSec };
}

function off(key: number, tick: number, audioTimeSec = tick / 1000): TickedMessage {
  return { kind: 'noteOff', key, velocity: 0, tick, audioTimeSec };
}

describe('matchPerformance (contracts/grading.md §3)', () => {
  it('pass 1 claims a press of the exact same pitch', () => {
    const expected = [expectedNote(0, 0, 60)];
    const { claims, missedIndices, extraMessageIndices } = matchPerformance(expected, [wide()], [on(60, 0)]);
    expect(claims).toEqual([{ expectedIndex: 0, messageIndex: 0, pass: 'exact' }]);
    expect(missedIndices).toEqual([]);
    expect(extraMessageIndices).toEqual([]);
  });

  it('pass 2 claims only the same pitch class - an octave error', () => {
    const expected = [expectedNote(0, 0, 60)]; // C4
    const { claims } = matchPerformance(expected, [wide()], [on(72, 0)]); // C5: same pitch class, wrong octave
    expect(claims).toEqual([{ expectedIndex: 0, messageIndex: 0, pass: 'octave' }]);
  });

  it('a wrong letter is extra plus a missed note, never an octave match', () => {
    const expected = [expectedNote(0, 0, 60)]; // C4
    const { claims, missedIndices, extraMessageIndices } = matchPerformance(expected, [wide()], [on(62, 0)]); // D4
    expect(claims).toEqual([]);
    expect(missedIndices).toEqual([0]);
    expect(extraMessageIndices).toEqual([0]);
  });

  it('two presses of one pitch claim the two written notes in order (repeated-pitch-two-presses)', () => {
    const expected = [expectedNote(0, 0, 60), expectedNote(1, 960, 60)];
    const { claims } = matchPerformance(expected, [wide(), wide()], [on(60, 0), on(60, 960)]);
    expect(claims).toEqual([
      { expectedIndex: 0, messageIndex: 0, pass: 'exact' },
      { expectedIndex: 1, messageIndex: 1, pass: 'exact' },
    ]);
  });

  it('two same-pitch onsets milliseconds apart never cross-match (unison-two-voices)', () => {
    const { score, timeline } = loadFixture('unison-two-voices.musicxml', BOTH);
    const expected = buildExpectedNotes(score, timeline, BOTH, null);
    expect(expected).toHaveLength(2);
    const windows = resolveWindows(expected, score.measures, timeline.tempo, 960, 100, 'beginner');
    const onset0 = expected[0]!.onsetTick;
    const onset1 = expected[1]!.onsetTick;
    // A press played close to (but distinguishably nearer) each onset, inside that onset's neighbour-clamped window.
    const near0 = onset0 + Math.floor((onset1 - onset0) * 0.2);
    const near1 = onset0 + Math.floor((onset1 - onset0) * 0.8);
    const { claims } = matchPerformance(expected, windows, [on(60, near0), on(60, near1)]);
    expect(claims).toEqual([
      { expectedIndex: 0, messageIndex: 0, pass: 'exact' },
      { expectedIndex: 1, messageIndex: 1, pass: 'exact' },
    ]);
  });

  it('a note-on with velocity 0 never claims (it is a note-off)', () => {
    const expected = [expectedNote(0, 0, 60)];
    const { claims, missedIndices } = matchPerformance(expected, [wide()], [on(60, 0, 0, 0)]);
    expect(claims).toEqual([]);
    expect(missedIndices).toEqual([0]);
  });

  it('chatter under PLAY_RETRIGGER_DEBOUNCE_MS is coalesced into the one press it really was', () => {
    const expected = [expectedNote(0, 0, 60)];
    const messages = [
      on(60, 0, 0), // the real press, at audio time 0s
      off(60, 5, 0.005), // released 5ms later
      on(60, 10, 0.01), // a bounce 5ms after that (< 15ms debounce): chatter, not a second press
    ];
    const { claims, extraMessageIndices } = matchPerformance(expected, [wide()], messages);
    expect(claims).toHaveLength(1);
    expect(extraMessageIndices).toEqual([]); // the bounce is not reported as an extra note either
  });

  it('a retrigger past the debounce window is a genuine second press', () => {
    const expected = [expectedNote(0, 0, 60), expectedNote(1, 960, 60)];
    const messages = [on(60, 0, 0), off(60, 100, 0.1), on(60, 960, 1)]; // 900ms later: not chatter
    const { claims } = matchPerformance(expected, [wide(), wide()], messages);
    expect(claims.map((c) => c.expectedIndex)).toEqual([0, 1]);
  });

  it('matching is on sounding key, not written spelling (enharmonic-cs-db)', () => {
    const { score, timeline } = loadFixture('enharmonic-cs-db.musicxml', BOTH);
    const expected = buildExpectedNotes(score, timeline, BOTH, null);
    expect(expected.every((n) => n.key === 61)).toBe(true); // C#4 and Db4 both sound key 61
    const windows = expected.map(() => wide());
    const { claims } = matchPerformance(
      expected,
      windows,
      expected.map((n) => on(61, n.onsetTick)),
    );
    expect(claims).toHaveLength(2);
    expect(claims.every((c) => c.pass === 'exact')).toBe(true);
  });

  it('matching is on the sounding key of a transposing part (transposing-part-sounding-pitch)', () => {
    const { score, timeline } = loadFixture('transposing-part-sounding-pitch.musicxml', BOTH);
    const expected = buildExpectedNotes(score, timeline, BOTH, null);
    // Bb clarinet, chromatic=-2: written C5/D5/E5 sound Bb4/C5/D5 (70/72/74) - matching claims the sounding key.
    const windows = expected.map(() => wide());
    const messages = expected.map((n) => on(n.key, n.onsetTick));
    const { claims, missedIndices } = matchPerformance(expected, windows, messages);
    expect(missedIndices).toEqual([]);
    expect(claims.every((c) => c.pass === 'exact')).toBe(true);
  });

  it('pass 1 completes globally before pass 2 begins: a press pass 1 claims cannot be stolen by pass 2 elsewhere', () => {
    const a = expectedNote(0, 0, 60); // C4 - the press below matches this exactly
    const b = expectedNote(1, 10, 72); // C5 nearby - same pitch class as the press, would match in pass 2 alone
    const { claims, missedIndices } = matchPerformance([a, b], [wide(), wide()], [on(60, 5)]);
    expect(claims).toEqual([{ expectedIndex: 0, messageIndex: 0, pass: 'exact' }]);
    expect(missedIndices).toEqual([1]); // b never gets a look-in: its only possible press went to a in pass 1
  });
});
