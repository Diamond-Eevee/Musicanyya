import { describe, expect, it } from 'vitest';
import { gradePerformance } from '../../../src/core/grade/grade.js';
import type { PerformanceLog } from '../../../src/core/grade/types.js';
import type { HandSelection } from '../../../src/core/practice/types.js';
import { buildGradeInput } from './helpers.js';

const BOTH: HandSelection = { preset: 'both', partIndex: 0, staves: [1] };

function roll(notes: readonly { key: number; atSec: number }[]): PerformanceLog {
  const messages: PerformanceLog['messages'] = [];
  for (const n of notes) {
    messages.push({
      kind: 'noteOn',
      key: n.key,
      velocity: 80,
      down: false,
      audioTimeSec: n.atSec,
      timeStampMs: n.atSec * 1000,
      deviceId: 'fake-keyboard',
    });
    messages.push({
      kind: 'noteOff',
      key: n.key,
      velocity: 0,
      down: false,
      audioTimeSec: n.atSec + 0.3,
      timeStampMs: (n.atSec + 0.3) * 1000,
      deviceId: 'fake-keyboard',
    });
  }
  return { version: 1, messages, droppedMessages: 0 };
}

describe('chord spread (FR-022, SC-016)', () => {
  it('a chord rolled by hand within the chord spread is on time for every member (chord-spread-rolled)', () => {
    // C4-E4-G4, quarter=100: Beginner onTime is 100ms, chordSpread adds another 50ms - a roll well inside
    // that combined 150ms window must be on time for every member, not just the first note struck.
    const log = roll([
      { key: 60, atSec: 0 },
      { key: 64, atSec: 0.11 },
      { key: 67, atSec: 0.14 },
    ]);
    const input = buildGradeInput('chord-spread-rolled.musicxml', BOTH, log);
    const grade = gradePerformance(input);

    expect(grade.results).toHaveLength(3);
    for (const result of grade.results) {
      expect(result.pitch).toBe('correct');
      expect(result.timing).toBe('onTime');
    }
    // A chord never shrinks its own members' windows: every member gets the same window size, not a smaller
    // one because two others share its onset.
    const deltas = grade.results.map((r) => Math.abs(r.deltaTicks ?? 0));
    expect(new Set(deltas).size).toBeLessThanOrEqual(3); // just sanity: nothing overflowed into "late"/"missed"
    expect(grade.summary.counts).toEqual({ correct: 3, wrongPitch: 0, missed: 0, extra: 0, early: 0, late: 0 });
  });

  it('a written <arpeggiate> uses the wider arpeggio spread instead of the chord spread, and is not late; the same roll on an unmarked chord in the same Score is late (arpeggiate-chord)', () => {
    // First chord (C4-E4-G4, half notes) is written <arpeggiate>: PLAY_ARPEGGIO_SPREAD_BEATS (0.5 beats, wider
    // than the ordinary chord spread) applies. Second chord (F4-A4) is unmarked: the ordinary, tighter chord
    // spread applies. Both rolled by the same 200ms - inside the arpeggio spread's combined window, outside the
    // ordinary chord spread's.
    const log = roll([
      { key: 60, atSec: 0 }, // C4, on the beat
      { key: 64, atSec: 0.2 }, // E4, +200ms
      { key: 67, atSec: 0.25 }, // G4, +250ms - still inside the arpeggio-widened window
      { key: 65, atSec: 1.2 }, // F4, second chord's onset (beat 3, quarter=100 => 1.2s)
      { key: 69, atSec: 1.4 }, // A4, +200ms - outside the ordinary chord spread's window
    ]);
    const input = buildGradeInput('arpeggiate-chord.musicxml', BOTH, log);
    const grade = gradePerformance(input);

    expect(grade.results).toHaveLength(5);
    const byKey = new Map(grade.results.map((r) => [r.playedKey, r]));
    for (const key of [60, 64, 67]) {
      expect(byKey.get(key)?.pitch).toBe('correct');
      expect(byKey.get(key)?.timing, `key ${key} (arpeggiated chord)`).toBe('onTime');
    }
    expect(byKey.get(65)?.timing).toBe('onTime'); // F4, exactly on the beat
    expect(byKey.get(69)?.timing, 'A4 (unmarked chord, same 200ms roll)').toBe('late');
  });
});
