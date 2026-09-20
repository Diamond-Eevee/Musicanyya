import { describe, expect, it } from 'vitest';
import { gradePerformance } from '../../../src/core/grade/grade.js';
import type { GradeInput, LatencyProfile, PerformanceLog } from '../../../src/core/grade/types.js';
import type { HandSelection } from '../../../src/core/practice/types.js';
import type { MeasureInfo } from '../../../src/core/score/model.js';
import type { TempoSegment } from '../../../src/core/timeline/types.js';

const SELECTION: HandSelection = { preset: 'both', partIndex: 0, staves: [1] };
const PPQ = 960;
const BEAT_TICKS = PPQ; // 4/4, quarter = one beat

const ZERO_LATENCY: LatencyProfile = { outputLatencyMs: 0, inputLatencyMs: 0, source: 'assumed', measuredAt: null };

/**
 * A synthetic GradeInput: `noteCount` isolated notes, one beat apart, at `bpm`. Each note's recorded
 * audioTimeSec is the exact ideal onset time plus the latency profile's compensation plus a deliberate
 * `offsetsMs[i]` displacement - so once gradePerformance compensates for latency, the reported deltaMs should
 * equal exactly the injected offset (this is the only thing this file checks: that compensation has the right
 * sign and size, SC-003/SC-004).
 */
function syntheticGradeInput(params: {
  bpm: number;
  noteCount: number;
  latency?: LatencyProfile;
  offsetsMs?: readonly number[];
}): GradeInput {
  const { bpm, noteCount, latency = ZERO_LATENCY, offsetsMs = [] } = params;
  const secondsPerBeat = 60 / bpm;
  const compensationSec = (latency.outputLatencyMs + latency.inputLatencyMs) / 1000;

  const tempo: TempoSegment[] = [{ startTick: 0, qpmNum: bpm * 100, qpmDen: 100 }];
  const measures: MeasureInfo[] = [
    {
      index: 0,
      id: 'm0',
      label: '1',
      startTick: 0,
      lengthTicks: BEAT_TICKS * (noteCount + 4),
      nominalTicks: 0,
      implicit: false,
      beatOffsetTicks: 0,
      time: { beats: '4', beatType: 4 },
    },
  ];

  const expected = Array.from({ length: noteCount }, (_, i) => ({
    index: i,
    noteIds: [`n${i}`],
    key: 60,
    onsetTick: i * BEAT_TICKS,
    measureIndex: 0,
    passIndex: 0,
    chordSize: 1,
    arpeggiated: false,
  }));

  const messages: PerformanceLog['messages'] = [];
  expected.forEach((note, i) => {
    const idealAudioTime = i * secondsPerBeat;
    const offsetSec = (offsetsMs[i] ?? 0) / 1000;
    const audioTimeSec = idealAudioTime + compensationSec + offsetSec;
    messages.push({
      kind: 'noteOn',
      key: note.key,
      velocity: 80,
      down: false,
      audioTimeSec,
      timeStampMs: audioTimeSec * 1000,
      deviceId: 'fake-keyboard',
    });
    messages.push({
      kind: 'noteOff',
      key: note.key,
      velocity: 0,
      down: false,
      audioTimeSec: audioTimeSec + 0.1,
      timeStampMs: (audioTimeSec + 0.1) * 1000,
      deviceId: 'fake-keyboard',
    });
  });

  return {
    runId: 'synthetic',
    complete: true,
    expected,
    playedAlong: [],
    log: { version: 1, messages, droppedMessages: 0 },
    tempo,
    ppq: PPQ,
    tickMap: { countInTicks: 0, rangeStartTick: 0, rangeEndTick: noteCount * BEAT_TICKS, ppq: PPQ },
    startAudioTimeSec: 0,
    settings: {
      range: null,
      tempoPercent: 100,
      selection: SELECTION,
      strictness: 'beginner',
      countInMeasures: 1,
      metronomeMuted: false,
      accompaniment: true,
    },
    latency,
    reliability: [],
    passes: [{ measureIndex: 0, passNo: 1, startTick: 0, lengthTicks: BEAT_TICKS * (noteCount + 4) }],
    measures,
  };
}

describe('timing accuracy - latency compensation has the right sign and size (SC-003, SC-004, FR-013)', () => {
  it.each([40, 60, 120, 160, 208])(
    'a performance played exactly on time is 100% correct and on time at %i bpm',
    (bpm) => {
      const input = syntheticGradeInput({ bpm, noteCount: 5 });
      const grade = gradePerformance(input);
      expect(grade.results).toHaveLength(5);
      for (const result of grade.results) {
        expect(result.pitch).toBe('correct');
        expect(result.timing).toBe('onTime');
        expect(result.deltaMs).toBeCloseTo(0, 3);
      }
    },
  );

  it.each([15, -15, 40, -40, 200, -200])(
    'an injected offset of %i ms is reported within 5ms once an assumed Latency profile is compensated',
    (offsetMs) => {
      const latency: LatencyProfile = { outputLatencyMs: 20, inputLatencyMs: 10, source: 'assumed', measuredAt: null };
      // One isolated note (far from any neighbour) at a slow tempo, so its claim window is wide enough to
      // accommodate every injected offset without the neighbour clamp or the claim boundary interfering.
      const input = syntheticGradeInput({ bpm: 60, noteCount: 1, latency, offsetsMs: [offsetMs] });
      const grade = gradePerformance(input);
      expect(grade.results).toHaveLength(1);
      const result = grade.results[0];
      expect(result?.pitch).toBe('correct');
      expect(result?.deltaMs).not.toBeNull();
      expect(Math.abs((result?.deltaMs ?? Number.NaN) - offsetMs)).toBeLessThanOrEqual(5);
    },
  );

  it.each([15, -15, 40, -40, 200, -200])(
    'the same injected offset of %i ms is reported within 5ms with a measured Latency profile too',
    (offsetMs) => {
      const latency: LatencyProfile = {
        outputLatencyMs: 20,
        inputLatencyMs: 10,
        source: 'measured',
        measuredAt: '2026-09-20T00:00:00.000Z',
      };
      const input = syntheticGradeInput({ bpm: 60, noteCount: 1, latency, offsetsMs: [offsetMs] });
      const grade = gradePerformance(input);
      const result = grade.results[0];
      expect(result?.pitch).toBe('correct');
      expect(Math.abs((result?.deltaMs ?? Number.NaN) - offsetMs)).toBeLessThanOrEqual(5);
    },
  );
});
