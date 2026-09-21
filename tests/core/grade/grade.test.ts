import { describe, expect, it } from 'vitest';
import { gradePerformance } from '../../../src/core/grade/grade.js';
import type { HandSelection } from '../../../src/core/practice/types.js';
import { loadRecordedPerformance } from '../../fakes/performance-log.js';
import { buildGradeInput } from './helpers.js';

const BOTH: HandSelection = { preset: 'both', partIndex: 0, staves: [1] };

describe('gradePerformance invariants (FR-018, FR-023, FR-024)', () => {
  it('every expected note appears exactly once in results', () => {
    const { log } = loadRecordedPerformance('accurate-eight-measures.json');
    const input = buildGradeInput('eight-measure-melody.musicxml', BOTH, log);
    const grade = gradePerformance(input);

    expect(grade.results).toHaveLength(input.expected.length);
    const indices = grade.results.map((r) => r.expectedIndex).sort((a, b) => a - b);
    expect(indices).toEqual(input.expected.map((n) => n.index).sort((a, b) => a - b));
    expect(new Set(indices).size).toBe(indices.length); // never twice
  });

  it('timing is null exactly when pitch is missed', () => {
    const { log } = loadRecordedPerformance('mistakes-measures-3-and-7.json');
    const input = buildGradeInput('eight-measure-melody.musicxml', BOTH, log);
    const grade = gradePerformance(input);

    expect(grade.results.length).toBeGreaterThan(0);
    for (const result of grade.results) {
      expect(result.timing === null).toBe(result.pitch === 'missed');
    }
    expect(grade.results.some((r) => r.pitch === 'missed')).toBe(true); // the fixture has real misses
  });

  it('every recorded note-on ends as exactly one of playedKey, a PlayedAlongPress or an ExtraNote', () => {
    const { log } = loadRecordedPerformance('accurate-eight-measures.json');
    const input = buildGradeInput('eight-measure-melody.musicxml', BOTH, log);
    const grade = gradePerformance(input);

    // This fixture has no chatter and no velocity-0 note-ons, so every note-on is a genuine candidate press.
    const noteOnCount = log.messages.filter((m) => m.kind === 'noteOn' && m.velocity > 0).length;
    const claimed = grade.results.filter((r) => r.playedKey !== null).length;
    const accounted = claimed + grade.playedAlong.length + grade.extras.length;
    expect(accounted).toBe(noteOnCount);
  });

  it('pedal and velocity change no result', () => {
    const { log } = loadRecordedPerformance('accurate-eight-measures.json');
    const withPedal = {
      ...log,
      messages: [
        ...log.messages.map((m) => (m.kind === 'noteOn' ? { ...m, velocity: 40 } : m)), // different velocity
        {
          kind: 'sustain' as const,
          key: 0,
          velocity: 0,
          down: true,
          audioTimeSec: 0.05,
          timeStampMs: 50,
          deviceId: 'fake-keyboard',
        },
        {
          kind: 'sustain' as const,
          key: 0,
          velocity: 0,
          down: false,
          audioTimeSec: 5,
          timeStampMs: 5000,
          deviceId: 'fake-keyboard',
        },
      ],
    };
    const baseline = gradePerformance(buildGradeInput('eight-measure-melody.musicxml', BOTH, log));
    const withExtras = gradePerformance(buildGradeInput('eight-measure-melody.musicxml', BOTH, withPedal));

    const strip = (g: typeof baseline) =>
      g.results.map((r) => ({ pitch: r.pitch, timing: r.timing, deltaTicks: r.deltaTicks }));
    expect(strip(withExtras)).toEqual(strip(baseline));
    expect(withExtras.extras).toEqual(baseline.extras);
  });
});
