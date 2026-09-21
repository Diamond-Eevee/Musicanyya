import { describe, expect, it } from 'vitest';
import { gradePerformance } from '../../../src/core/grade/grade.js';
import type { ExpectedNote, GradeInput, LatencyProfile } from '../../../src/core/grade/types.js';
import { createIdleRun, playRunReducer } from '../../../src/core/play/run.js';
import type { RunSettings } from '../../../src/core/play/types.js';
import type { HandSelection } from '../../../src/core/practice/types.js';
import type { MeasureInfo } from '../../../src/core/score/model.js';
import type { TempoSegment } from '../../../src/core/timeline/types.js';

const PPQ = 960;
const BPM = 208;
const SELECTION: HandSelection = { preset: 'both', partIndex: 0, staves: [1] };
const ZERO_LATENCY: LatencyProfile = { outputLatencyMs: 0, inputLatencyMs: 0, source: 'assumed', measuredAt: null };

/**
 * SC-007 / T103: a run long and fast enough (~10 minutes at 208 bpm, one note per beat = 2080 notes) that a
 * dropped message or a mis-accounted press would show up as a real gap, not a rounding error at fixture scale.
 * Recorded through the actual `playRunReducer` (the same path a live run takes), not a hand-built log, so this
 * also stresses the reducer's own append-only recording, not just `gradePerformance`'s accounting.
 */
describe('a 10-minute run at 208 bpm accounts for every recorded message (SC-007)', () => {
  it('every note-on ends as exactly one playedKey, PlayedAlongPress or ExtraNote, droppedMessages stays 0', () => {
    const noteCount = 2080; // 208 beats/min * 10 min
    const secondsPerBeat = 60 / BPM;
    const settings: RunSettings = {
      range: null,
      tempoPercent: 100,
      selection: SELECTION,
      strictness: 'beginner',
      countInMeasures: 1,
      metronomeMuted: false,
      accompaniment: true,
    };
    const tickMap = { countInTicks: 0, rangeStartTick: 0, rangeEndTick: noteCount * PPQ, ppq: PPQ };

    let step = playRunReducer(createIdleRun('score-1', settings, tickMap), {
      type: 'start',
      runId: 'long-run',
      startAudioTimeSec: 0,
      startedAt: '2026-09-21T00:00:00.000Z',
    });
    step = playRunReducer(step.run, { type: 'position', runTick: 0, audioTimeSec: 0 }); // countIn -> running

    const expected: ExpectedNote[] = [];
    for (let i = 0; i < noteCount; i++) {
      const key = 60 + (i % 12); // walks through an octave, never a repeated-pitch retrigger edge case
      const onsetTick = i * PPQ;
      const audioTimeSec = i * secondsPerBeat;
      expected.push({
        index: i,
        noteIds: [`n${i}`],
        key,
        onsetTick,
        measureIndex: 0,
        passIndex: 0,
        chordSize: 1,
        arpeggiated: false,
      });
      step = playRunReducer(step.run, {
        type: 'input',
        message: {
          kind: 'noteOn',
          key,
          velocity: 80,
          down: false,
          audioTimeSec,
          timeStampMs: audioTimeSec * 1000,
          deviceId: 'fake-keyboard',
        },
      });
      step = playRunReducer(step.run, {
        type: 'input',
        message: {
          kind: 'noteOff',
          key,
          velocity: 0,
          down: false,
          audioTimeSec: audioTimeSec + secondsPerBeat / 2,
          timeStampMs: (audioTimeSec + secondsPerBeat / 2) * 1000,
          deviceId: 'fake-keyboard',
        },
      });
    }
    step = playRunReducer(step.run, { type: 'ended' });
    const run = step.run;

    expect(run.log.droppedMessages).toBe(0);
    expect(run.log.messages).toHaveLength(noteCount * 2); // one noteOn + one noteOff per note

    const tempo: TempoSegment[] = [{ startTick: 0, qpmNum: BPM, qpmDen: 1 }];
    const measures: MeasureInfo[] = [
      {
        index: 0,
        id: 'm0',
        label: '1',
        startTick: 0,
        lengthTicks: noteCount * PPQ,
        nominalTicks: 0,
        implicit: false,
        beatOffsetTicks: 0,
        time: { beats: '4', beatType: 4 },
      },
    ];
    const input: GradeInput = {
      runId: run.runId,
      complete: true,
      expected,
      playedAlong: [],
      log: run.log,
      tempo,
      timelineTempo: tempo,
      ppq: PPQ,
      tickMap,
      startAudioTimeSec: 0,
      settings,
      latency: ZERO_LATENCY,
      reliability: [],
      passes: [{ measureIndex: 0, passNo: 1, startTick: 0, lengthTicks: noteCount * PPQ }],
      measures,
    };

    const grade = gradePerformance(input);

    expect(grade.results).toHaveLength(noteCount);
    const noteOnCount = run.log.messages.filter((m) => m.kind === 'noteOn' && m.velocity > 0).length;
    const claimed = grade.results.filter((r) => r.playedKey !== null).length;
    const accounted = claimed + grade.playedAlong.length + grade.extras.length;
    expect(accounted).toBe(noteOnCount);
    expect(grade.extras).toHaveLength(0); // every press was claimed by its own note - no dropout, nothing orphaned
    expect(grade.results.every((r) => r.pitch === 'correct' && r.timing === 'onTime')).toBe(true);
  });
});
