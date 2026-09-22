import type { PlayAction, PlayEffect, PlayRun, PlayStep, PlayTickMap, RunSettings } from './types.js';

/** The idle run a controller starts from: `start` fills in `runId`, `startedAt` and `startAudioTimeSec`. */
export function createIdleRun(scoreId: string | null, settings: RunSettings, tickMap: PlayTickMap): PlayRun {
  return {
    runId: '',
    scoreId,
    settings,
    tickMap,
    phase: 'idle',
    startedAt: '',
    startAudioTimeSec: 0,
    positionRunTick: 0,
    log: { version: 1, messages: [], droppedMessages: 0 },
    reliability: [],
  };
}

/**
 * Pure run reducer (contracts/play-run.md, data-model.md §1): the same action sequence always produces the same
 * run and the same effects. Never reads the time itself - every transition is driven by a `position` report or a
 * command the controller passes in, never a timer (Constitution I).
 */
export function playRunReducer(run: PlayRun, action: PlayAction): PlayStep {
  switch (action.type) {
    case 'start': {
      if (run.phase !== 'idle') return { run, effects: [] };
      const next: PlayRun = {
        ...run,
        runId: action.runId,
        startedAt: action.startedAt,
        startAudioTimeSec: action.startAudioTimeSec,
        phase: 'countIn',
        positionRunTick: 0,
        log: { version: 1, messages: [], droppedMessages: 0 },
        reliability: [],
      };
      return { run: next, effects: [] };
    }

    case 'position': {
      if (run.phase !== 'countIn' && run.phase !== 'running') return { run, effects: [] };
      const positioned: PlayRun = { ...run, positionRunTick: action.runTick };
      // The count-in -> running boundary is a tick comparison against the position report, never a timer
      // (FR-003): the count-in is "over" exactly when the schedule's own clock says so.
      if (run.phase === 'countIn' && action.runTick >= run.tickMap.countInTicks) {
        return { run: { ...positioned, phase: 'running' }, effects: [{ type: 'runStarted' }] };
      }
      return { run: positioned, effects: [] };
    }

    case 'input': {
      // Recorded in both countIn and running (data-model.md §1): almost everything played during the count-in
      // is later excluded from matching by gradePerformance's own window filter (D-4), not here. Recording
      // continuing past the final onset (R-16) falls out of this reducer imposing no cutoff of its own: it
      // records every `input` it is given until the controller sends `ended`, `stop` or `audioLost`.
      if (run.phase !== 'countIn' && run.phase !== 'running') return { run, effects: [] };
      const message = action.message;
      const next: PlayRun = { ...run, log: { ...run.log, messages: [...run.log.messages, message] } };
      const effects: PlayEffect[] = [];
      if (message.kind === 'noteOn' || message.kind === 'noteOff') {
        // FR-006: the musician's own note sounds through the live channel, whatever grading later makes of it.
        // A note-on at velocity 0 is a note-off (MIDI 1.0, the same rule the matcher uses).
        const on = message.kind === 'noteOn' && message.velocity > 0;
        effects.push({ type: 'soundInput', key: message.key, velocity: message.velocity, on });
      }
      return { run: next, effects };
    }

    case 'ended': {
      if (run.phase !== 'running') return { run, effects: [] };
      return { run: { ...run, phase: 'finished' }, effects: [{ type: 'runEnded', reason: 'reachedEnd' }] };
    }

    case 'stop': {
      // FR-008, SC-010: whatever is in the log up to this point is exactly what a partial Grade covers - the
      // reducer does not trim it; `complete: false` is the controller's own flag on the resulting GradeInput.
      if (run.phase !== 'countIn' && run.phase !== 'running') return { run, effects: [] };
      return { run: { ...run, phase: 'stopped' }, effects: [{ type: 'runEnded', reason: 'stopped' }] };
    }

    case 'audioLost': {
      // FR-046: audio device lost or sample rate changed - the run cannot be trusted from here, and grading
      // will mark it unreliable via the reliability warnings this event feeds.
      if (run.phase !== 'countIn' && run.phase !== 'running') return { run, effects: [] };
      return {
        run: {
          ...run,
          phase: 'aborted',
          reliability: [...run.reliability, { kind: 'audioLost', audioTimeSec: 0, detail: null }],
        },
        effects: [
          { type: 'runEnded', reason: 'audioLost' },
          { type: 'notice', code: 'playAudioLost' },
        ],
      };
    }

    case 'reliability': {
      // FR-044: losing (or regaining) the MIDI keyboard, an audio dropout or a dropped live message never
      // changes the phase - only the audio-clock-stamped event is recorded, for the Grade's reliability warnings.
      const next: PlayRun = { ...run, reliability: [...run.reliability, action.event] };
      const effects: PlayEffect[] = [];
      if (action.event.kind === 'midiDeviceLost') effects.push({ type: 'notice', code: 'playMidiLost' });
      else if (action.event.kind === 'midiDeviceBack') effects.push({ type: 'notice', code: 'playMidiBack' });
      return { run: next, effects };
    }

    default:
      return { run, effects: [] };
  }
}
