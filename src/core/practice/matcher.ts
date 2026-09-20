import type { NoteId } from '../score/model.js';
import type {
  Attempt,
  MarkState,
  PracticeEffect,
  PracticeInput,
  PracticeSession,
  SessionStep,
  StartOptions,
} from './types.js';

export function startSession(options: StartOptions): PracticeSession {
  return {
    scoreId: options.scoreId,
    selection: { preset: 'both', partIndex: 0, staves: [] }, // mock for now
    events: options.events,
    index: options.startEventIndex,
    phase: options.events.length === 0 ? 'finished' : 'waiting',
    marks: new Map(),
    heldKeys: new Set(),
    wrongAttemptsOnCurrent: 0,
    loop: options.loop,
    accompaniment: options.accompaniment,
    help: options.help,
    log: [],
  };
}

export function applyInput(session: PracticeSession, input: PracticeInput): SessionStep {
  if (session.phase === 'finished' || session.phase === 'idle') {
    return { session, effects: [] };
  }

  const marks = new Map(session.marks);
  const heldKeys = new Set(session.heldKeys);
  const log = [...session.log];

  const next: PracticeSession = {
    ...session,
    marks,
    heldKeys,
    log,
  };
  const effects: PracticeEffect[] = [];

  const addMark = (noteIds: readonly NoteId[], state: MarkState) => {
    for (const id of noteIds) {
      marks.set(id, state);
    }
    effects.push({ type: 'markNotes', marks: noteIds.map((id) => ({ noteId: id, state })) });
  };

  const addLog = (key: number, state: Attempt['state']) => {
    log.push({ key, eventIndex: next.index, state, timeStampMs: input.timeStampMs });
  };

  const currentEvent = next.events[next.index];

  if (input.type === 'deviceLost') {
    for (const k of input.heldKeys ?? []) {
      heldKeys.delete(k);
    }
    next.phase = 'interrupted';
    effects.push({ type: 'notice', code: 'practiceDeviceLost' });
    return { session: next, effects };
  }

  if (input.type === 'skipNext') {
    if (currentEvent) {
      const noteIds = currentEvent.required.flatMap((r) => r.noteIds);
      addMark(noteIds, 'skipped');
      next.index++;
      next.wrongAttemptsOnCurrent = 0;
      if (next.index >= next.events.length) {
        next.phase = 'finished';
        effects.push({ type: 'sessionEnded', reason: 'stopped' });
      } else {
        const nextEv = next.events[next.index];
        if (nextEv) {
          effects.push({ type: 'moveCursor', eventIndex: next.index, onsetTick: nextEv.onsetTick });
          next.phase = 'waiting';
        }
      }
    }
    return { session: next, effects };
  }

  if (input.type === 'skipPrevious') {
    if (next.index > 0) {
      next.index--;
      next.wrongAttemptsOnCurrent = 0;
      const prevEv = next.events[next.index];
      if (prevEv) {
        const noteIds = prevEv.required.flatMap((r) => r.noteIds);
        for (const id of noteIds) {
          marks.delete(id);
        }
        effects.push({ type: 'markNotes', marks: noteIds.map((id) => ({ noteId: id, state: 'waiting' })) });
        effects.push({ type: 'moveCursor', eventIndex: next.index, onsetTick: prevEv.onsetTick });
        next.phase = 'waiting';
      }
    }
    return { session: next, effects };
  }

  if (input.type === 'sustain') {
    return { session: next, effects };
  }

  if (input.type === 'noteOff') {
    if (input.key !== undefined) {
      heldKeys.delete(input.key);

      if (next.phase === 'blocked' && currentEvent) {
        let stillBlocked = false;
        for (const req of currentEvent.required) {
          if (heldKeys.has(req.key)) {
            stillBlocked = true;
            break;
          }
        }
        if (!stillBlocked) {
          next.phase = 'waiting';
          effects.push({ type: 'hideHelp' });
        }
      }
    }
    return { session: next, effects };
  }

  if (input.type === 'noteOn' && input.key !== undefined) {
    if (next.phase === 'interrupted') {
      next.phase = 'waiting';
      effects.push({ type: 'notice', code: 'practiceDeviceBack' });
    }

    const key = input.key;
    if (heldKeys.has(key)) {
      return { session: next, effects };
    }
    heldKeys.add(key);

    if (!currentEvent) {
      return { session: next, effects };
    }

    const isRequired = currentEvent.required.find((r) => r.key === key);
    const isAccompaniment = currentEvent.accompaniment.find((a) => a.key === key);

    if (isRequired) {
      addMark(isRequired.noteIds, 'correctSoFar');

      let allHeld = true;
      for (const req of currentEvent.required) {
        if (!heldKeys.has(req.key)) {
          allHeld = false;
          break;
        }
      }

      if (allHeld) {
        for (const req of currentEvent.required) {
          addMark(req.noteIds, 'correct');
        }

        next.index++;
        next.wrongAttemptsOnCurrent = 0;

        if (next.index >= next.events.length) {
          next.phase = 'finished';
          effects.push({ type: 'sessionEnded', reason: 'reachedEnd' });
        } else {
          const nextEv = next.events[next.index];
          if (nextEv) {
            effects.push({ type: 'moveCursor', eventIndex: next.index, onsetTick: nextEv.onsetTick });

            let isBlocked = false;
            for (const req of nextEv.required) {
              if (heldKeys.has(req.key)) {
                isBlocked = true;
                addMark(req.noteIds, 'heldOver');
              }
            }
            if (isBlocked) {
              next.phase = 'blocked';
              effects.push({ type: 'showHelp', eventIndex: next.index, reason: 'heldOver' });
            }
          }
        }
      }
    } else if (isAccompaniment) {
      addMark([isAccompaniment.noteId], 'playedAlong');
    } else {
      let allHeld = true;
      for (const req of currentEvent.required) {
        if (!heldKeys.has(req.key)) {
          allHeld = false;
          break;
        }
      }

      if (allHeld) {
        addLog(key, 'extra');
      } else {
        next.wrongAttemptsOnCurrent++;
        let pitchClassMatch = false;
        for (const req of currentEvent.required) {
          if (Math.abs(req.key - key) % 12 === 0) {
            pitchClassMatch = true;
            break;
          }
        }
        if (pitchClassMatch) {
          addLog(key, 'wrongOctave');
        } else {
          addLog(key, 'wrongPitch');
        }
      }
    }
  }

  return { session: next, effects };
}
