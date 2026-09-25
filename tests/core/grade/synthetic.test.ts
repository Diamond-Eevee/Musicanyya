import { describe, expect, it } from 'vitest';
import { buildExpectedNotes } from '../../../src/core/grade/expected.js';
import { syntheticLog } from '../../../src/core/grade/synthetic.js';
import type { HandSelection } from '../../../src/core/practice/types.js';
import { loadFixture } from '../practice/helpers.js';

// 009 T054 (contract play-display.md section 3): the performance the `e2e-synthetic-grade` seam feeds the normal grade
// worker, so an e2e test gets a Grade (and the marks of every library item) without playing a whole run.

const BOTH: HandSelection = { preset: 'both', partIndex: 0, staves: [1, 2] };
const { score, timeline } = loadFixture('grade/grade-marks.musicxml');
const expected = buildExpectedNotes(score, timeline, BOTH, null);
const audioTimeOf = (tick: number) => tick / 1000;

describe('syntheticLog (009 T054)', () => {
  it('"nothing" is an empty performance', () => {
    expect(syntheticLog(expected, 'nothing', audioTimeOf)).toEqual({ version: 1, messages: [], droppedMessages: 0 });
  });

  it('"correct" presses every expected key once, at its onset, in playing order', () => {
    const { messages } = syntheticLog(expected, 'correct', audioTimeOf);
    expect(messages).toHaveLength(expected.length);
    messages.forEach((m, i) => {
      const note = expected[i];
      expect(m).toMatchObject({ kind: 'noteOn', key: note?.key, audioTimeSec: (note?.onsetTick ?? 0) / 1000 });
      expect(m.velocity).toBeGreaterThan(0);
    });
    const times = messages.map((m) => m.audioTimeSec);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('"semitoneHigh" presses every key one semitone above the written one, at the same moments', () => {
    const correct = syntheticLog(expected, 'correct', audioTimeOf).messages;
    const high = syntheticLog(expected, 'semitoneHigh', audioTimeOf).messages;
    expect(high.map((m) => m.key)).toEqual(correct.map((m) => m.key + 1));
    expect(high.map((m) => m.audioTimeSec)).toEqual(correct.map((m) => m.audioTimeSec));
  });

  it('is deterministic', () => {
    expect(syntheticLog(expected, 'correct', audioTimeOf)).toEqual(syntheticLog(expected, 'correct', audioTimeOf));
  });
});
