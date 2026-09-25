import { describe, expect, it } from 'vitest';
import { gradePerformance } from '../../../src/core/grade/grade.js';
import type { ExpectedNote, GradeInput, PerformanceLog } from '../../../src/core/grade/types.js';
import type { RunSettings } from '../../../src/core/play/types.js';
import type { HandSelection } from '../../../src/core/practice/types.js';
import type { MeasureInfo } from '../../../src/core/score/model.js';
import { audioTimeAtTick } from '../../../src/core/tempo/rate.js';
import type { TempoSegment } from '../../../src/core/timeline/types.js';
import { loadRecordedPerformance } from '../../fakes/performance-log.js';
import { buildGradeInput } from './helpers.js';

const BOTH: HandSelection = { preset: 'both', partIndex: 0, staves: [1] };
const PPQ = 960;

/**
 * A tempo map with several changes, chosen (by search) so that converting a tick to audio time and back with plain
 * IEEE754 float arithmetic does not land back on the exact integer it started from (e.g. tick 4001 comes back as
 * 4000.9999999999995) - the concrete case contracts/grading.md §2 rule 5 requires never to reach `deltaTicks`.
 */
const DRIFTING_TEMPO: readonly TempoSegment[] = [
  { startTick: 0, qpmNum: 137, qpmDen: 1 },
  { startTick: 1717, qpmNum: 93, qpmDen: 1 },
  { startTick: 5003, qpmNum: 161, qpmDen: 1 },
];

/** A minimal, hand-built GradeInput (no fixture files) so the tempo/ticks used are exactly under the test's control. */
function integerTicksInput(tempo: readonly TempoSegment[], onsetTick: number): GradeInput {
  const measures: MeasureInfo[] = [
    {
      index: 0,
      id: 'm-0',
      label: '1',
      startTick: 0,
      lengthTicks: 100000,
      nominalTicks: 100000,
      implicit: false,
      beatOffsetTicks: 0,
      time: { beats: '4', beatType: 4 },
    },
  ];
  const expected: ExpectedNote[] = [
    { index: 0, noteIds: ['n0'], key: 60, onsetTick, measureIndex: 0, passIndex: 0, chordSize: 1, arpeggiated: false },
  ];
  const audioTimeSec = audioTimeAtTick(onsetTick, tempo, PPQ, 100); // played exactly on the beat
  const log: PerformanceLog = {
    version: 1,
    messages: [{ kind: 'noteOn', key: 60, velocity: 80, down: false, audioTimeSec, timeStampMs: 0, deviceId: 'fake' }],
    droppedMessages: 0,
  };
  const settings: RunSettings = {
    range: null,
    tempoPercent: 100,
    selection: BOTH,
    strictness: 'beginner',
    countInMeasures: 1,
    metronomeMuted: false,
    accompaniment: true,
  };
  return {
    runId: 'integer-ticks-test',
    complete: true,
    expected,
    playedAlong: [],
    log,
    tempo,
    timelineTempo: tempo,
    ppq: PPQ,
    tickMap: { countInTicks: 0, rangeStartTick: 0, rangeEndTick: 100000, ppq: PPQ },
    startAudioTimeSec: 0,
    settings,
    latency: { outputLatencyMs: 0, inputLatencyMs: 0, source: 'assumed', measuredAt: null },
    reliability: [],
    passes: [{ measureIndex: 0, passNo: 0, startTick: 0, lengthTicks: 100000 }],
    measures,
  };
}

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

describe('Step 1 puts every message on an integer tick (Constitution II, contracts/grading.md §2 rule 5, T110)', () => {
  it('deltaTicks is exactly 0 for a note played exactly on its onset, across a tempo change', () => {
    const input = integerTicksInput(DRIFTING_TEMPO, 4001);
    const grade = gradePerformance(input);
    const result = grade.results[0]!;
    expect(result.pitch).not.toBe('missed');
    expect(Number.isInteger(result.deltaTicks)).toBe(true);
    expect(result.deltaTicks).toBe(0);
  });

  it('an extra press lands on an exact integer tick too', () => {
    const input = integerTicksInput(DRIFTING_TEMPO, 1000);
    const strayAudioTimeSec = audioTimeAtTick(4001, input.tempo, PPQ, 100);
    const withExtra: GradeInput = {
      ...input,
      log: {
        ...input.log,
        messages: [
          ...input.log.messages,
          {
            kind: 'noteOn',
            key: 72, // no expected note anywhere near here - always an extra
            velocity: 80,
            down: false,
            audioTimeSec: strayAudioTimeSec,
            timeStampMs: 0,
            deviceId: 'fake',
          },
        ],
      },
    };
    const grade = gradePerformance(withExtra);
    const extra = grade.extras.find((e) => e.key === 72);
    expect(extra).toBeDefined();
    expect(Number.isInteger(extra!.atTick)).toBe(true);
    expect(extra!.atTick).toBe(4001);
  });
});
