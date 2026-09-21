import { describe, expect, it } from 'vitest';
import type { RecordedMessage } from '../../../src/core/grade/types.js';
import { createIdleRun, playRunReducer } from '../../../src/core/play/run.js';
import type { PlayRun, PlayTickMap, RunSettings } from '../../../src/core/play/types.js';

function settings(): RunSettings {
  return {
    range: null,
    tempoPercent: 100,
    selection: { preset: 'both', partIndex: 0, staves: [1] },
    strictness: 'beginner',
    countInMeasures: 1,
    metronomeMuted: false,
    accompaniment: true,
  };
}

function tickMap(countInTicks = 3840): PlayTickMap {
  return { countInTicks, rangeStartTick: 0, rangeEndTick: 7680, ppq: 960 };
}

function idle(overrides: Partial<PlayTickMap> = {}): PlayRun {
  return createIdleRun('score-1', settings(), tickMap(overrides.countInTicks ?? 3840));
}

function message(overrides: Partial<RecordedMessage> = {}): RecordedMessage {
  return {
    kind: 'noteOn',
    key: 60,
    velocity: 80,
    down: false,
    audioTimeSec: 0,
    timeStampMs: 0,
    deviceId: 'dev',
    ...overrides,
  };
}

describe('playRunReducer', () => {
  it('moves idle -> countIn on start', () => {
    const { run } = playRunReducer(idle(), {
      type: 'start',
      runId: 'r1',
      startAudioTimeSec: 1.5,
      startedAt: '2026-01-01T00:00:00Z',
    });
    expect(run.phase).toBe('countIn');
    expect(run.runId).toBe('r1');
    expect(run.startAudioTimeSec).toBe(1.5);
  });

  it('moves countIn -> running exactly on a tick comparison, never on elapsed time', () => {
    let run = playRunReducer(idle(), { type: 'start', runId: 'r1', startAudioTimeSec: 0, startedAt: '' }).run;

    // Before the boundary: still counting in, no runStarted effect.
    const before = playRunReducer(run, { type: 'position', runTick: 3839, audioTimeSec: 1 });
    expect(before.run.phase).toBe('countIn');
    expect(before.effects).toEqual([]);

    // Exactly at the boundary: running, and the effect fires - driven purely by the tick in the action, not by
    // any elapsed wall-clock time (this reducer never reads a clock).
    const at = playRunReducer(before.run, { type: 'position', runTick: 3840, audioTimeSec: 999 });
    expect(at.run.phase).toBe('running');
    expect(at.effects).toEqual([{ type: 'runStarted' }]);
    run = at.run;

    // Once running, further positions never re-fire runStarted.
    const later = playRunReducer(run, { type: 'position', runTick: 4000, audioTimeSec: 1000 });
    expect(later.run.phase).toBe('running');
    expect(later.effects).toEqual([]);
  });

  it('records input during the count-in into the log (grading excludes it later, not the reducer)', () => {
    const countIn = playRunReducer(idle(), { type: 'start', runId: 'r1', startAudioTimeSec: 0, startedAt: '' }).run;
    const { run } = playRunReducer(countIn, { type: 'input', message: message({ audioTimeSec: 0.1 }) });
    expect(run.log.messages).toHaveLength(1);
    expect(run.phase).toBe('countIn');
  });

  it("keeps recording input while running, with no cutoff of its own (R-16: the tail is the controller's call)", () => {
    let run = playRunReducer(idle(), { type: 'start', runId: 'r1', startAudioTimeSec: 0, startedAt: '' }).run;
    run = playRunReducer(run, { type: 'position', runTick: 3840, audioTimeSec: 1 }).run;
    // A position report past the schedule's own range end still arrives before `ended`; the reducer must keep
    // recording rather than silently dropping input based on position.
    run = playRunReducer(run, { type: 'position', runTick: 8000, audioTimeSec: 2 }).run;
    const { run: afterInput } = playRunReducer(run, {
      type: 'input',
      message: message({ key: 62, audioTimeSec: 2.1 }),
    });
    expect(afterInput.log.messages).toHaveLength(1);
    expect(afterInput.log.messages[0]?.key).toBe(62);
  });

  it('emits soundInput for a note-on/note-off so the musician hears their own key (FR-006)', () => {
    const run = playRunReducer(idle(), { type: 'start', runId: 'r1', startAudioTimeSec: 0, startedAt: '' }).run;
    const on = playRunReducer(run, { type: 'input', message: message({ kind: 'noteOn', key: 64, velocity: 90 }) });
    expect(on.effects).toEqual([{ type: 'soundInput', key: 64, velocity: 90, on: true }]);

    const off = playRunReducer(run, { type: 'input', message: message({ kind: 'noteOff', key: 64, velocity: 0 }) });
    expect(off.effects).toEqual([{ type: 'soundInput', key: 64, velocity: 0, on: false }]);

    // A note-on at velocity 0 is a note-off (MIDI 1.0) - matches the matcher's own rule.
    const zeroVelocityOn = playRunReducer(run, {
      type: 'input',
      message: message({ kind: 'noteOn', key: 64, velocity: 0 }),
    });
    expect(zeroVelocityOn.effects).toEqual([{ type: 'soundInput', key: 64, velocity: 0, on: false }]);

    // Sustain never sounds through this effect.
    const sustain = playRunReducer(run, {
      type: 'input',
      message: message({ kind: 'sustain', key: 0, velocity: 0, down: true }),
    });
    expect(sustain.effects).toEqual([]);
  });

  it('a stop yields exactly the notes recorded up to it, marked incomplete by the controller (SC-010)', () => {
    let run = playRunReducer(idle(), { type: 'start', runId: 'r1', startAudioTimeSec: 0, startedAt: '' }).run;
    run = playRunReducer(run, { type: 'position', runTick: 3840, audioTimeSec: 1 }).run;
    run = playRunReducer(run, { type: 'input', message: message({ key: 60 }) }).run;
    const { run: stopped, effects } = playRunReducer(run, { type: 'stop' });
    expect(stopped.phase).toBe('stopped');
    expect(stopped.log.messages).toHaveLength(1); // exactly what was recorded up to the stop, nothing more
    expect(effects).toEqual([{ type: 'runEnded', reason: 'stopped' }]);
  });

  it('reaching the schedule end moves running -> finished', () => {
    let run = playRunReducer(idle(), { type: 'start', runId: 'r1', startAudioTimeSec: 0, startedAt: '' }).run;
    run = playRunReducer(run, { type: 'position', runTick: 3840, audioTimeSec: 1 }).run;
    const { run: finished, effects } = playRunReducer(run, { type: 'ended' });
    expect(finished.phase).toBe('finished');
    expect(effects).toEqual([{ type: 'runEnded', reason: 'reachedEnd' }]);
  });

  it('losing the MIDI keyboard appends a reliability event and never changes the phase (FR-044)', () => {
    let run = playRunReducer(idle(), { type: 'start', runId: 'r1', startAudioTimeSec: 0, startedAt: '' }).run;
    run = playRunReducer(run, { type: 'position', runTick: 3840, audioTimeSec: 1 }).run;
    expect(run.phase).toBe('running');

    const lost = playRunReducer(run, {
      type: 'reliability',
      event: { kind: 'midiDeviceLost', audioTimeSec: 5, detail: null },
    });
    expect(lost.run.phase).toBe('running'); // unchanged
    expect(lost.run.reliability).toEqual([{ kind: 'midiDeviceLost', audioTimeSec: 5, detail: null }]);
    expect(lost.effects).toEqual([{ type: 'notice', code: 'playMidiLost' }]);

    const back = playRunReducer(lost.run, {
      type: 'reliability',
      event: { kind: 'midiDeviceBack', audioTimeSec: 8, detail: null },
    });
    expect(back.run.phase).toBe('running');
    expect(back.run.reliability).toHaveLength(2);
    expect(back.effects).toEqual([{ type: 'notice', code: 'playMidiBack' }]);
  });

  it('audioLost moves countIn or running to aborted (FR-046)', () => {
    const countIn = playRunReducer(idle(), { type: 'start', runId: 'r1', startAudioTimeSec: 0, startedAt: '' }).run;
    const abortedFromCountIn = playRunReducer(countIn, { type: 'audioLost' });
    expect(abortedFromCountIn.run.phase).toBe('aborted');
    expect(abortedFromCountIn.effects).toEqual([
      { type: 'runEnded', reason: 'audioLost' },
      { type: 'notice', code: 'playAudioLost' },
    ]);

    const running = playRunReducer(countIn, { type: 'position', runTick: 3840, audioTimeSec: 1 }).run;
    const abortedFromRunning = playRunReducer(running, { type: 'audioLost' });
    expect(abortedFromRunning.run.phase).toBe('aborted');
  });

  it('ignores actions that do not apply to the current phase, without throwing', () => {
    const finished = playRunReducer(
      playRunReducer(playRunReducer(idle(), { type: 'start', runId: 'r1', startAudioTimeSec: 0, startedAt: '' }).run, {
        type: 'position',
        runTick: 3840,
        audioTimeSec: 1,
      }).run,
      { type: 'ended' },
    ).run;

    const { run, effects } = playRunReducer(finished, { type: 'input', message: message() });
    expect(run).toBe(finished); // unchanged (same reference: no-op)
    expect(effects).toEqual([]);

    const restarted = playRunReducer(finished, { type: 'start', runId: 'r2', startAudioTimeSec: 0, startedAt: '' });
    expect(restarted.run).toBe(finished); // start only applies from idle
  });
});
