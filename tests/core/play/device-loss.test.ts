import { describe, expect, it } from 'vitest';
import { gradePerformance } from '../../../src/core/grade/grade.js';
import type { ExpectedNote, GradeInput, LatencyProfile } from '../../../src/core/grade/types.js';
import { createIdleRun, playRunReducer } from '../../../src/core/play/run.js';
import type { PlayEffect, PlayRun, RunSettings } from '../../../src/core/play/types.js';
import type { HandSelection } from '../../../src/core/practice/types.js';
import type { MeasureInfo } from '../../../src/core/score/model.js';
import type { TempoSegment } from '../../../src/core/timeline/types.js';

const PPQ = 960;
const BPM = 120;
const SELECTION: HandSelection = { preset: 'both', partIndex: 0, staves: [1] };
const ZERO_LATENCY: LatencyProfile = { outputLatencyMs: 0, inputLatencyMs: 0, source: 'assumed', measuredAt: null };

function noteOn(key: number, audioTimeSec: number) {
  return {
    kind: 'noteOn' as const,
    key,
    velocity: 80,
    down: false,
    audioTimeSec,
    timeStampMs: audioTimeSec * 1000,
    deviceId: 'fake-keyboard',
  };
}

function noteOff(key: number, audioTimeSec: number) {
  return {
    kind: 'noteOff' as const,
    key,
    velocity: 0,
    down: false,
    audioTimeSec,
    timeStampMs: audioTimeSec * 1000,
    deviceId: 'fake-keyboard',
  };
}

/**
 * SC-013 / T080: unplugging and replugging the MIDI keyboard mid-run. Six one-measure-apart notes; the device
 * goes away partway through measure 2 (no note-on can reach the reducer while it is gone - a real unplug simply
 * silences the input, it does not queue anything) and comes back at the start of measure 4, where the very next
 * note is recorded with nothing special required of the reducer (there is no cooldown or debounce after
 * `midiDeviceBack` - "resumes within 3 seconds" is a hardware/OS bound this code never adds to).
 */
describe('a MIDI hot-plug mid-run never stops the run, and the gap lands on the Grade (SC-013)', () => {
  it('recording continues unaffected either side of the gap; the gap becomes a reliability warning on the Grade', () => {
    const settings: RunSettings = {
      range: null,
      tempoPercent: 100,
      selection: SELECTION,
      strictness: 'beginner',
      countInMeasures: 1,
      metronomeMuted: false,
      accompaniment: true,
    };
    const tickMap = { countInTicks: 0, rangeStartTick: 0, rangeEndTick: 6 * PPQ, ppq: PPQ };
    const secondsPerBeat = 60 / BPM;

    let run: PlayRun = createIdleRun('score-1', settings, tickMap);
    const allEffects: PlayEffect[] = [];
    function dispatch(action: Parameters<typeof playRunReducer>[1]) {
      const step = playRunReducer(run, action);
      run = step.run;
      allEffects.push(...step.effects);
    }

    dispatch({ type: 'start', runId: 'hot-plug-run', startAudioTimeSec: 0, startedAt: '2026-09-21T00:00:00.000Z' });
    dispatch({ type: 'position', runTick: 0, audioTimeSec: 0 }); // countIn -> running

    // Measures 0 and 1: played normally.
    dispatch({ type: 'input', message: noteOn(60, 0) });
    dispatch({ type: 'input', message: noteOff(60, 0.1) });
    dispatch({ type: 'input', message: noteOn(62, secondsPerBeat) });
    dispatch({ type: 'input', message: noteOff(62, secondsPerBeat + 0.1) });

    // The keyboard is unplugged partway through measure 2 - no input reaches the reducer until it is back.
    const lostAtSec = 2 * secondsPerBeat + 0.2;
    dispatch({ type: 'reliability', event: { kind: 'midiDeviceLost', audioTimeSec: lostAtSec, detail: null } });
    // Nothing plays during measures 2 and 3 - the physical gap (both those notes go unclaimed, honestly).
    const backAtSec = 4 * secondsPerBeat - 0.1;
    dispatch({ type: 'reliability', event: { kind: 'midiDeviceBack', audioTimeSec: backAtSec, detail: null } });

    // Measures 4 and 5: the very next presses after reconnection, recorded with no special handling needed.
    dispatch({ type: 'input', message: noteOn(65, 4 * secondsPerBeat) });
    dispatch({ type: 'input', message: noteOff(65, 4 * secondsPerBeat + 0.1) });
    dispatch({ type: 'input', message: noteOn(67, 5 * secondsPerBeat) });
    dispatch({ type: 'input', message: noteOff(67, 5 * secondsPerBeat + 0.1) });

    dispatch({ type: 'ended' });

    // The run never stopped because of the hot-plug: only the final `ended` action produced a `runEnded` effect.
    expect(run.phase).toBe('finished');
    const runEndedEffects = allEffects.filter((e) => e.type === 'runEnded');
    expect(runEndedEffects).toHaveLength(1);
    expect(runEndedEffects[0]).toEqual({ type: 'runEnded', reason: 'reachedEnd' });
    // Non-blocking notices only (FR-009) - never anything that could read as a stop.
    const notices = allEffects.filter((e) => e.type === 'notice').map((e) => (e as { code: string }).code);
    expect(notices).toEqual(['playMidiLost', 'playMidiBack']);

    // Recording itself: every message either side of the gap is present, nothing dropped.
    expect(run.log.droppedMessages).toBe(0);
    expect(run.log.messages).toHaveLength(8); // 4 notes played, on+off each
    expect(run.reliability.map((e) => e.kind)).toEqual(['midiDeviceLost', 'midiDeviceBack']);

    // Grade it, and confirm the gap is on the Grade, not silently absorbed.
    // Keys line up with what was actually played at each measure (60, 62, [gap], [gap], 65, 67); the two gap
    // measures' keys are arbitrary since nothing claims them - they grade as missed regardless of pitch.
    const expected: ExpectedNote[] = [60, 62, 63, 64, 65, 67].map((key, i) => ({
      index: i,
      noteIds: [`n${i}`],
      key,
      onsetTick: i * PPQ,
      measureIndex: i,
      passIndex: i,
      chordSize: 1,
      arpeggiated: false,
    }));
    const tempo: TempoSegment[] = [{ startTick: 0, qpmNum: BPM, qpmDen: 1 }];
    const measures: MeasureInfo[] = Array.from({ length: 6 }, (_, i) => ({
      index: i,
      id: `m${i}`,
      label: String(i + 1),
      startTick: i * PPQ,
      lengthTicks: PPQ,
      nominalTicks: 0,
      implicit: false,
      beatOffsetTicks: 0,
      time: { beats: '4', beatType: 4 },
    }));
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
      reliability: run.reliability,
      passes: measures.map((m, i) => ({
        measureIndex: i,
        passNo: 1,
        startTick: m.startTick,
        lengthTicks: m.lengthTicks,
      })),
      measures,
    };

    const grade = gradePerformance(input);

    // The two notes actually missed during the physical gap - the honest consequence of a real unplug, not a
    // grading bug.
    expect(grade.results[2]?.pitch).toBe('missed');
    expect(grade.results[3]?.pitch).toBe('missed');
    // Everything either side of the gap graded normally - reconnection blocked nothing.
    expect(grade.results[0]?.pitch).toBe('correct');
    expect(grade.results[1]?.pitch).toBe('correct');
    expect(grade.results[4]?.pitch).toBe('correct');
    expect(grade.results[5]?.pitch).toBe('correct');

    // The gap itself becomes reliability warnings covering measures 2-3 (where the device was away) - "on the
    // Grade": the lost event's own pass (2) and the pass the reconnection landed in (3), by kind (R-12).
    expect(grade.reliability).toContainEqual({ kind: 'midiDeviceLost', fromPassIndex: 2, toPassIndex: 3 });
    expect(grade.reliability).toContainEqual({ kind: 'midiDeviceBack', fromPassIndex: 3, toPassIndex: 4 });
    const unreliableMeasures = grade.measures.filter((m) => m.unreliable).map((m) => m.measureIndex);
    expect(unreliableMeasures).toEqual([2, 3]);
    // Measures either side of the gap are not tainted by it.
    expect(grade.measures.filter((m) => !m.unreliable).map((m) => m.measureIndex)).toEqual([0, 1, 4, 5]);
  });
});
