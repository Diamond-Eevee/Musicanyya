import { PRACTICE_HELP_AFTER_WRONG_ATTEMPTS } from '../defaults.js';
import type { NoteId } from '../score/model.js';
import type {
  Attempt,
  ExpectedEvent,
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
    selection: options.selection ?? { preset: 'both', partIndex: 0, staves: [] },
    events: options.events,
    index: options.startEventIndex,
    phase: options.events.length === 0 ? 'finished' : 'waiting',
    marks: new Map(),
    heldKeys: new Set(),
    soundingAccompaniment: new Map(),
    wrongAttemptsOnCurrent: 0,
    loop: options.loop,
    accompaniment: options.accompaniment,
    help: options.help,
    helpShown: false,
    log: [],
  };
}

export function applyInput(session: PracticeSession, input: PracticeInput): SessionStep {
  const marks = new Map(session.marks);
  const heldKeys = new Set(session.heldKeys);
  const log = [...session.log];
  const sounding = new Map(session.soundingAccompaniment);

  const next: PracticeSession = {
    ...session,
    marks,
    heldKeys,
    soundingAccompaniment: sounding,
    log,
  };
  const effects: PracticeEffect[] = [];

  /** Silences every accompaniment note that rings (R-03). */
  const releaseAll = () => {
    for (const key of sounding.keys()) effects.push({ type: 'soundOff', key });
    sounding.clear();
  };

  if (input.type === 'setAccompaniment') {
    next.accompaniment = input.enabled === true;
    if (!next.accompaniment) releaseAll();
    return { session: next, effects };
  }

  if (session.phase === 'finished' || session.phase === 'idle') {
    // The last accompaniment notes ring until the musician lets go of every key: there is no cursor left to pass
    // them, and a timer must not decide when a sound stops (Constitution I).
    if (sounding.size === 0) return { session, effects: [] };
    if (input.type === 'noteOn' && input.key !== undefined) heldKeys.add(input.key);
    if (input.type === 'noteOff' && input.key !== undefined) heldKeys.delete(input.key);
    if (input.type === 'deviceLost') {
      for (const k of input.heldKeys ?? []) heldKeys.delete(k);
    }
    if (heldKeys.size === 0 || input.type === 'deviceLost') releaseAll();
    return { session: next, effects };
  }

  /** The cursor passes an event: what has ended is released, then the notes written under it start (FR-031). */
  const soundAccompanimentOf = (event: ExpectedEvent) => {
    if (!next.accompaniment) return;
    for (const [key, endTick] of sounding) {
      if (endTick <= event.onsetTick) {
        effects.push({ type: 'soundOff', key });
        sounding.delete(key);
      }
    }
    for (const ref of event.accompaniment) {
      // The musician already holds this key, so the pitch is sounding: a second instance of one key on the
      // synth would swap which of the two a later note-off releases, cutting the musician's own note.
      if (heldKeys.has(ref.key)) continue;
      if (sounding.has(ref.key)) effects.push({ type: 'soundOff', key: ref.key });
      effects.push({ type: 'soundOn', key: ref.key, noteIds: [ref.noteId], velocity: ref.velocity });
      sounding.set(ref.key, ref.endTick);
    }
  };

  const addMark = (noteIds: readonly NoteId[], state: MarkState) => {
    for (const id of noteIds) {
      marks.set(id, state);
    }
    effects.push({ type: 'markNotes', marks: noteIds.map((id) => ({ noteId: id, state })) });
  };

  const addLog = (key: number, state: Attempt['state']) => {
    log.push({ key, eventIndex: next.index, state, timeStampMs: input.timeStampMs });
  };

  /** Help shown for the event being left no longer applies (R-15): fires `hideHelp` at most once per `showHelp`. */
  const hideHelpIfShown = () => {
    if (!next.helpShown) return;
    next.helpShown = false;
    effects.push({ type: 'hideHelp' });
  };

  /**
   * Puts the cursor on an event. Marks left on its notes by an earlier pass are cleared first - a repeat or a loop
   * plays the same Note IDs again, and a note still marked correct would hide that the app waits for it - then the
   * cursor moves, then a required key that is already down blocks the event (FR-009a).
   */
  const arriveAt = (index: number) => {
    const event = next.events[index];
    if (!event) return;
    hideHelpIfShown();
    next.index = index;
    next.wrongAttemptsOnCurrent = 0;

    const stale: NoteId[] = [];
    for (const req of event.required) for (const id of req.noteIds) if (marks.delete(id)) stale.push(id);
    for (const ref of event.accompaniment) if (marks.delete(ref.noteId)) stale.push(ref.noteId);
    if (stale.length > 0)
      effects.push({ type: 'markNotes', marks: stale.map((noteId) => ({ noteId, state: 'waiting' })) });

    effects.push({ type: 'moveCursor', eventIndex: index, onsetTick: event.onsetTick });
    next.phase = 'waiting';
    let blocked = false;
    for (const req of event.required) {
      if (heldKeys.has(req.key)) {
        blocked = true;
        addMark(req.noteIds, 'heldOver');
      }
    }
    if (blocked) {
      next.phase = 'blocked';
      effects.push({ type: 'showHelp', eventIndex: index, reason: 'heldOver' });
      next.helpShown = true;
    }
  };

  /** Where the cursor goes when the current event is passed inside a loop: back to its first event (FR-016), else
   *  null. The accompaniment of the loop's last event is not started: the cursor is already back at the start, so
   *  nothing would release it (R-12: no timer ever decides when a sound stops). */
  const wrapTarget = (): number | null =>
    next.loop !== null && next.index === next.loop.toEventIndex ? next.loop.fromEventIndex : null;

  const currentEvent = next.events[next.index];

  if (input.type === 'requestHelp') {
    // One switch for both ways help can appear (R-15): off means off, whether it is asked for or not.
    if (next.help && currentEvent) {
      effects.push({ type: 'showHelp', eventIndex: next.index, reason: 'requested' });
      next.helpShown = true;
    }
    return { session: next, effects };
  }

  if (input.type === 'deviceLost') {
    for (const k of input.heldKeys ?? []) {
      heldKeys.delete(k);
    }
    releaseAll();
    next.phase = 'interrupted';
    effects.push({ type: 'notice', code: 'practiceDeviceLost' });
    return { session: next, effects };
  }

  if (input.type === 'setLoop') {
    next.loop = input.loop ?? null;
    const loop = next.loop;
    if (loop && (next.index < loop.fromEventIndex || next.index > loop.toEventIndex)) {
      // Setting a loop means "practise this now": a cursor outside it goes to its first event.
      const interrupted = next.phase === 'interrupted';
      releaseAll();
      arriveAt(loop.fromEventIndex);
      if (interrupted) next.phase = 'interrupted';
    }
    return { session: next, effects };
  }

  if (input.type === 'skipNext') {
    if (currentEvent) {
      const noteIds = currentEvent.required.flatMap((r) => r.noteIds);
      addMark(noteIds, 'skipped');
      const wrapTo = wrapTarget();
      const skippingLast = next.index + 1 >= next.events.length;
      if (wrapTo !== null) {
        releaseAll();
        arriveAt(wrapTo);
      } else if (skippingLast) {
        // Skipping the last event ends the session, so its accompaniment would only ring with no cursor left to
        // release it: it is not started (RT review).
        hideHelpIfShown();
        next.index++;
        next.wrongAttemptsOnCurrent = 0;
        next.phase = 'finished';
        // What still rings goes now unless a key is down, in which case the finished branch releases it at key-up.
        if (heldKeys.size === 0) releaseAll();
        effects.push({ type: 'sessionEnded', reason: 'stopped' });
      } else {
        soundAccompanimentOf(currentEvent);
        arriveAt(next.index + 1);
      }
    }
    return { session: next, effects };
  }

  if (input.type === 'skipPrevious') {
    // A loop is not left backwards: at its first event there is nothing before it to go back to.
    const atLoopStart = next.loop !== null && next.index === next.loop.fromEventIndex;
    if (next.index > 0 && !atLoopStart) {
      hideHelpIfShown();
      releaseAll();
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
        const wrapTo = wrapTarget();
        if (wrapTo !== null) {
          releaseAll();
          arriveAt(wrapTo);
        } else {
          soundAccompanimentOf(currentEvent);
          if (next.index + 1 >= next.events.length) {
            hideHelpIfShown();
            next.index++;
            next.wrongAttemptsOnCurrent = 0;
            next.phase = 'finished';
            effects.push({ type: 'sessionEnded', reason: 'reachedEnd' });
          } else {
            arriveAt(next.index + 1);
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
        // No notehead to mark: the on-screen keyboard carries the feedback instead (T056, owner decision 2026-09-20).
        effects.push({ type: 'keyFeedback', key, state: 'extra', messageId: 'practice.extra.notInChord' });
      } else {
        next.wrongAttemptsOnCurrent++;
        let matchedReqKey: number | undefined;
        for (const req of currentEvent.required) {
          if (Math.abs(req.key - key) % 12 === 0) {
            matchedReqKey = req.key;
            break;
          }
        }
        if (matchedReqKey !== undefined) {
          addLog(key, 'wrongOctave');
          const messageId = key > matchedReqKey ? 'practice.octave.lower' : 'practice.octave.higher';
          effects.push({ type: 'keyFeedback', key, state: 'wrongOctave', messageId });
        } else {
          addLog(key, 'wrongPitch');
          effects.push({ type: 'keyFeedback', key, state: 'wrongPitch' });
        }
        // FR-023: help appears by itself once the wrong attempts on this event reach the threshold, unless it is
        // already shown (R-15) or the musician switched it off.
        if (next.help && !next.helpShown && next.wrongAttemptsOnCurrent >= PRACTICE_HELP_AFTER_WRONG_ATTEMPTS) {
          effects.push({ type: 'showHelp', eventIndex: next.index, reason: 'stuck' });
          next.helpShown = true;
        }
      }
    }
  }

  return { session: next, effects };
}
