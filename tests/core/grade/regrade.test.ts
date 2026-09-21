import { describe, expect, it } from 'vitest';
import { gradePerformance } from '../../../src/core/grade/grade.js';
import type {
  ExpectedNote,
  GradeInput,
  LatencyProfile,
  PerformanceLog,
  StrictnessLevelName,
} from '../../../src/core/grade/types.js';
import type { HandSelection } from '../../../src/core/practice/types.js';
import type { MeasureInfo } from '../../../src/core/score/model.js';
import type { TempoSegment } from '../../../src/core/timeline/types.js';

const SELECTION: HandSelection = { preset: 'both', partIndex: 0, staves: [1] };
const PPQ = 960;
const ZERO_LATENCY: LatencyProfile = { outputLatencyMs: 0, inputLatencyMs: 0, source: 'assumed', measuredAt: null };

/**
 * A stored performance's `GradeInput` (research R-20: `startAudioTimeSec: 0`, the log already run-relative): one
 * isolated note, 100ms late at 60 bpm - inside beginner's on-time window (raw 1/6 beat = 166.67ms, clamped to
 * [60, 180]) but outside strict's (raw 1/16 beat = 62.5ms, clamped to [20, 70]), so the two strictness levels
 * disagree on `timing` without either of them missing the note.
 */
function storedGradeInput(strictness: StrictnessLevelName, log: PerformanceLog): GradeInput {
  const bpm = 60;
  const tempo: TempoSegment[] = [{ startTick: 0, qpmNum: bpm * 100, qpmDen: 100 }];
  const measures: MeasureInfo[] = [
    {
      index: 0,
      id: 'm0',
      label: '1',
      startTick: 0,
      lengthTicks: PPQ * 4,
      nominalTicks: 0,
      implicit: false,
      beatOffsetTicks: 0,
      time: { beats: '4', beatType: 4 },
    },
  ];
  const expected: ExpectedNote[] = [
    {
      index: 0,
      noteIds: ['n0'],
      key: 60,
      onsetTick: 0,
      measureIndex: 0,
      passIndex: 0,
      chordSize: 1,
      arpeggiated: false,
    },
  ];

  return {
    runId: 'stored-run',
    complete: true,
    expected,
    playedAlong: [],
    log,
    tempo,
    timelineTempo: tempo,
    ppq: PPQ,
    tickMap: { countInTicks: 0, rangeStartTick: 0, rangeEndTick: PPQ * 4, ppq: PPQ },
    startAudioTimeSec: 0,
    settings: {
      range: null,
      tempoPercent: 100,
      selection: SELECTION,
      strictness,
      countInMeasures: 1,
      metronomeMuted: false,
      accompaniment: true,
    },
    latency: ZERO_LATENCY,
    reliability: [],
    passes: [{ measureIndex: 0, passNo: 1, startTick: 0, lengthTicks: PPQ * 4 }],
    measures,
  };
}

describe('Re-grading a stored performance (FR-027, SC-011)', () => {
  it('a different strictness yields a different Grade from the byte-identical stored log', () => {
    const offsetSec = 0.1; // 100ms late
    const log: PerformanceLog = {
      version: 1,
      messages: [
        { kind: 'noteOn', key: 60, velocity: 80, down: false, audioTimeSec: offsetSec, timeStampMs: 0, deviceId: 'd' },
        {
          kind: 'noteOff',
          key: 60,
          velocity: 0,
          down: false,
          audioTimeSec: offsetSec + 0.2,
          timeStampMs: 0,
          deviceId: 'd',
        },
      ],
      droppedMessages: 0,
    };
    const logSnapshot = structuredClone(log);

    const beginnerGrade = gradePerformance(storedGradeInput('beginner', log));
    const strictGrade = gradePerformance(storedGradeInput('strict', log));

    expect(beginnerGrade.results[0]?.pitch).toBe('correct');
    expect(strictGrade.results[0]?.pitch).toBe('correct');
    expect(beginnerGrade.results[0]?.timing).toBe('onTime');
    expect(strictGrade.results[0]?.timing).toBe('late');
    expect(beginnerGrade.summary.counts).not.toEqual(strictGrade.summary.counts);

    // SC-011: re-grading never writes back to the store - gradePerformance itself never mutates the log it was
    // given, so the same stored log re-grades identically every time.
    expect(log).toEqual(logSnapshot);
  });

  it('the same strictness re-graded from the stored log gives a byte-identical Grade (FR-027)', () => {
    const log: PerformanceLog = {
      version: 1,
      messages: [
        { kind: 'noteOn', key: 60, velocity: 80, down: false, audioTimeSec: 0, timeStampMs: 0, deviceId: 'd' },
        { kind: 'noteOff', key: 60, velocity: 0, down: false, audioTimeSec: 0.2, timeStampMs: 0, deviceId: 'd' },
      ],
      droppedMessages: 0,
    };

    const first = gradePerformance(storedGradeInput('standard', log));
    const second = gradePerformance(storedGradeInput('standard', log));
    expect(second).toEqual(first);
  });
});
