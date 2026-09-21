import { describe, expect, it } from 'vitest';
import { gradePerformance } from '../../../src/core/grade/grade.js';
import type { ExpectedNote, GradeInput, LatencyProfile, PerformanceLog } from '../../../src/core/grade/types.js';
import type { HandSelection } from '../../../src/core/practice/types.js';
import type { MeasureInfo } from '../../../src/core/score/model.js';
import type { TempoSegment } from '../../../src/core/timeline/types.js';

const SELECTION: HandSelection = { preset: 'both', partIndex: 0, staves: [1] };
const PPQ = 960;
const ZERO_LATENCY: LatencyProfile = { outputLatencyMs: 0, inputLatencyMs: 0, source: 'assumed', measuredAt: null };

/**
 * contracts/grading.md 1.1.2 / T106: a run whose count-in/range shift (`countInTicks - rangeStartTick`) is
 * non-zero, with a tempo change inside the graded range. `tempo` (run-tick space, 0 = count-in start) is
 * constant at 50 qpm throughout - the shape a compiled schedule has when the timeline's own tempo change falls
 * *before* the run's own start, so the run itself never re-enters a tempo change. `timelineTempo` (timeline-tick
 * space) is what the note's `onsetTick` actually keys into: 50 qpm up to tick 2000, 200 qpm from there on - and
 * the one expected note sits at tick 2400, inside the fast segment.
 */
function tempoSpaceGradeInput(): GradeInput {
  const runTempo: TempoSegment[] = [{ startTick: 0, qpmNum: 50, qpmDen: 1 }];
  const timelineTempo: TempoSegment[] = [
    { startTick: 0, qpmNum: 50, qpmDen: 1 },
    { startTick: 2000, qpmNum: 200, qpmDen: 1 },
  ];
  const measures: MeasureInfo[] = [
    {
      index: 0,
      id: 'm0',
      label: '1',
      startTick: 0,
      lengthTicks: 4000,
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
      onsetTick: 2400,
      measureIndex: 0,
      passIndex: 0,
      chordSize: 1,
      arpeggiated: false,
    },
  ];

  // Step 1 must still use the run-space `tempo` (constant 50 qpm) to place the press: run tick 3070 at 50 qpm is
  // 3070 / (50 * 960 / 60) = 3.8375s, which lands the press at timeline tick 2400 + 170 = 2570 once the
  // countInTicks(1000) - rangeStartTick(500) shift is applied.
  const log: PerformanceLog = {
    version: 1,
    messages: [
      { kind: 'noteOn', key: 60, velocity: 80, down: false, audioTimeSec: 3.8375, timeStampMs: 3837.5, deviceId: 'd' },
      { kind: 'noteOff', key: 60, velocity: 0, down: false, audioTimeSec: 3.9375, timeStampMs: 3937.5, deviceId: 'd' },
    ],
    droppedMessages: 0,
  };

  return {
    runId: 'tempo-space-run',
    complete: true,
    expected,
    playedAlong: [],
    log,
    tempo: runTempo,
    timelineTempo,
    ppq: PPQ,
    tickMap: { countInTicks: 1000, rangeStartTick: 500, rangeEndTick: 4000, ppq: PPQ },
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
    latency: ZERO_LATENCY,
    reliability: [],
    passes: [{ measureIndex: 0, passNo: 1, startTick: 0, lengthTicks: 4000 }],
    measures,
  };
}

describe('gradePerformance window sizing uses timeline-tick tempo, not run-tick tempo (contracts/grading.md 1.1.2, T106)', () => {
  it('a note 170 ticks late, inside the 200bpm window (192 ticks) but outside the 50bpm one (144 ticks), grades onTime', () => {
    const grade = gradePerformance(tempoSpaceGradeInput());

    expect(grade.results).toHaveLength(1);
    const result = grade.results[0];
    expect(result?.pitch).toBe('correct');
    expect(result?.deltaTicks).toBe(170);
    // At 50 qpm (the run-tick-space map, wrongly indexed by the timeline onset before the fix) beginner's
    // onTimeLate clamps down to its 180ms cap = 144 ticks, so 170 would read as late. At the 200 qpm actually in
    // force at timeline tick 2400, the same window floors up to its 60ms floor = 192 ticks, so 170 is onTime.
    expect(result?.timing).toBe('onTime');
  });
});
