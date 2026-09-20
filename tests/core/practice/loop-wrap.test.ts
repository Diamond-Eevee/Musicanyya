import { describe, expect, it } from 'vitest';
import { applyInput, startSession } from '../../../src/core/practice/matcher.js';
import type {
  ExpectedEvent,
  PracticeEffect,
  PracticeInput,
  PracticeSession,
  ResolvedLoop,
  SoundingRef,
} from '../../../src/core/practice/types.js';

/** One required key per event; the note id is `n<index>` unless a test shares ids across passes. */
function ev(
  index: number,
  key: number,
  over: { noteId?: string; passIndex?: number; accompaniment?: SoundingRef[] } = {},
): ExpectedEvent {
  return {
    index,
    passIndex: over.passIndex ?? index,
    measureIndex: index,
    onsetTick: index * 100,
    required: [{ key, noteIds: [over.noteId ?? `n${index}`], staff: 1 }],
    accompaniment: over.accompaniment ?? [],
  };
}

function loopOf(fromEventIndex: number, toEventIndex: number): ResolvedLoop {
  return { fromEventIndex, toEventIndex, fromPassIndex: fromEventIndex, toPassIndex: toEventIndex, occurrence: null };
}

// e0 e1 e2 e3 e4 on keys 60 62 64 65 67
const EVENTS = [ev(0, 60), ev(1, 62), ev(2, 64), ev(3, 65), ev(4, 67)];

function start(loop: ResolvedLoop | null, startEventIndex: number, events: readonly ExpectedEvent[] = EVENTS) {
  return startSession({
    scoreId: 'test',
    events,
    startEventIndex,
    loop,
    accompaniment: true,
    help: false,
  });
}

let clock = 0;
function apply(session: PracticeSession, input: Omit<PracticeInput, 'timeStampMs'>) {
  return applyInput(session, { ...input, timeStampMs: clock++ });
}

/** Presses and releases each key in turn; returns the session and every effect, in order. */
function play(session: PracticeSession, ...keys: number[]) {
  let current = session;
  const effects: PracticeEffect[] = [];
  for (const key of keys) {
    for (const input of [{ type: 'noteOn', key } as const, { type: 'noteOff', key } as const]) {
      const step = apply(current, input);
      current = step.session;
      effects.push(...step.effects);
    }
  }
  return { session: current, effects };
}

describe('the loop wraps at its last expected event (AS-3.1, FR-016)', () => {
  it('completing the last event of the slice returns the cursor to its first event and keeps waiting', () => {
    const { session, effects } = play(start(loopOf(1, 2), 1), 62, 64);

    expect(session.index).toBe(1);
    expect(session.phase).toBe('waiting');
    expect(effects.filter((e) => e.type === 'moveCursor')).toEqual([
      { type: 'moveCursor', eventIndex: 2, onsetTick: 200 },
      { type: 'moveCursor', eventIndex: 1, onsetTick: 100 },
    ]);
    expect(effects.some((e) => e.type === 'sessionEnded')).toBe(false);
  });

  it('goes round again and again without ending the session', () => {
    const { session, effects } = play(start(loopOf(1, 2), 1), 62, 64, 62, 64, 62, 64);

    expect(session.index).toBe(1);
    expect(session.phase).toBe('waiting');
    expect(effects.filter((e) => e.type === 'moveCursor' && e.eventIndex === 1)).toHaveLength(3);
    expect(effects.some((e) => e.type === 'sessionEnded')).toBe(false);
  });

  it('a wrong key inside the loop still does not advance it', () => {
    const { session } = play(start(loopOf(1, 2), 1), 62, 70, 64, 70);

    expect(session.index).toBe(1);
  });

  it('a loop that ends on the last event of the Score does not reach the end of the Score', () => {
    const { session, effects } = play(start(loopOf(3, 4), 3), 65, 67);

    expect(session.index).toBe(3);
    expect(session.phase).toBe('waiting');
    expect(effects.some((e) => e.type === 'sessionEnded')).toBe(false);
  });

  it('a one-event loop waits on that same event again', () => {
    const { session, effects } = play(start(loopOf(2, 2), 2), 64);

    expect(session.index).toBe(2);
    expect(session.phase).toBe('waiting');
    expect(effects.filter((e) => e.type === 'moveCursor')).toEqual([
      { type: 'moveCursor', eventIndex: 2, onsetTick: 200 },
    ]);
  });

  it('events before the slice are played once on the way in, events after it are never reached', () => {
    const { session } = play(start(loopOf(2, 3), 0), 60, 62, 64, 65, 64, 65);

    expect(session.index).toBe(2);
    expect(session.phase).toBe('waiting');
  });

  it('without a loop the same input goes on to the end of the Score', () => {
    const { session, effects } = play(start(null, 1), 62, 64, 65, 67);

    expect(session.phase).toBe('finished');
    expect(effects.at(-1)).toEqual({ type: 'sessionEnded', reason: 'reachedEnd' });
  });
});

describe('the marks of a finished pass (quickstart US3: the loop does not clear them)', () => {
  it('leaves the marks of the pass in place, except the notes the cursor is back on', () => {
    const { session } = play(start(loopOf(1, 2), 1), 62, 64);

    expect(session.marks.get('n2')).toBe('correct');
    expect(session.marks.has('n1')).toBe(false);
  });

  it('turns the notes the cursor comes back to into waiting notes, and says so in an effect', () => {
    const { effects } = play(start(loopOf(1, 2), 1), 62, 64);

    expect(effects.filter((e) => e.type === 'markNotes').at(-1)).toEqual({
      type: 'markNotes',
      marks: [{ noteId: 'n1', state: 'waiting' }],
    });
  });

  it('each note of the next pass is reset when the cursor reaches it, not before', () => {
    const wrapped = play(start(loopOf(1, 3), 1), 62, 64, 65).session;
    expect([wrapped.index, wrapped.marks.get('n2'), wrapped.marks.get('n3')]).toEqual([1, 'correct', 'correct']);

    const second = play(wrapped, 62).session;
    expect([second.index, second.marks.has('n2'), second.marks.get('n3')]).toEqual([2, false, 'correct']);
  });

  it('a repeated passage that reuses the same Note IDs starts blank on its second pass, with no loop set', () => {
    // m0 m1 m0 m1: events 2 and 3 are the same notes as events 0 and 1
    const repeated = [
      ev(0, 60, { noteId: 'a' }),
      ev(1, 62, { noteId: 'b' }),
      ev(2, 60, { noteId: 'a' }),
      ev(3, 62, { noteId: 'b' }),
    ];
    const { session } = play(start(null, 0, repeated), 60, 62);

    expect(session.index).toBe(2);
    expect(session.marks.has('a')).toBe(false);
    expect(session.marks.get('b')).toBe('correct');
  });
});

describe('arriving back on a key that is still down (FR-009a)', () => {
  it('waits for the release, and says why, when the first note of the loop is held over the wrap', () => {
    // 62 (e1) stays down while 64 (e2) is played; the wrap lands on e1, whose key is already down
    let step = apply(start(loopOf(1, 2), 1), { type: 'noteOn', key: 62 });
    step = apply(step.session, { type: 'noteOn', key: 64 });

    expect(step.session.index).toBe(1);
    expect(step.session.phase).toBe('blocked');
    expect(step.session.marks.get('n1')).toBe('heldOver');
    expect(step.effects).toContainEqual({ type: 'showHelp', eventIndex: 1, reason: 'heldOver' });

    const released = apply(step.session, { type: 'noteOff', key: 62 });
    expect(released.session.phase).toBe('waiting');
  });
});

describe('skipping inside a loop (FR-004a)', () => {
  it('skipping the last event of the slice wraps like playing it does, and marks it skipped', () => {
    const step = apply(start(loopOf(1, 2), 2), { type: 'skipNext' });

    expect(step.session.index).toBe(1);
    expect(step.session.phase).toBe('waiting');
    expect(step.session.marks.get('n2')).toBe('skipped');
    expect(step.effects.some((e) => e.type === 'sessionEnded')).toBe(false);
  });

  it('skipping back never leaves the loop: at its first event it does nothing', () => {
    const step = apply(start(loopOf(1, 2), 1), { type: 'skipPrevious' });

    expect(step.session.index).toBe(1);
    expect(step.effects).toEqual([]);
  });

  it('skipping back inside the slice still goes back one event', () => {
    const step = apply(start(loopOf(1, 3), 2), { type: 'skipPrevious' });

    expect(step.session.index).toBe(1);
  });
});

describe('accompaniment at the wrap (R-03, R-12: no timer ever releases a sound)', () => {
  const held = (key: number, endTick: number): SoundingRef => ({ noteId: `acc${key}`, key, endTick, velocity: 80 });
  const events = [
    ev(0, 60),
    ev(1, 62, { accompaniment: [held(48, 999)] }),
    ev(2, 64, { accompaniment: [held(50, 999)] }),
  ];

  it('releases what rings and does not start the last event`s notes: the cursor is already back at the start', () => {
    const played = play(start(loopOf(1, 2), 1, events), 62, 64);

    const sounded = played.effects.filter((e) => e.type === 'soundOn' || e.type === 'soundOff');
    expect(sounded).toEqual([
      { type: 'soundOn', key: 48, noteIds: ['acc48'], velocity: 80 },
      { type: 'soundOff', key: 48 },
    ]);
    expect(played.session.soundingAccompaniment.size).toBe(0);
  });
});

describe('setLoop while a session runs (FR-016)', () => {
  it('a loop set with the cursor outside it moves the cursor to the loop`s first event', () => {
    const step = apply(start(null, 0), { type: 'setLoop', loop: loopOf(2, 3) });

    expect(step.session.loop).toEqual(loopOf(2, 3));
    expect(step.session.index).toBe(2);
    expect(step.session.phase).toBe('waiting');
    expect(step.effects).toContainEqual({ type: 'moveCursor', eventIndex: 2, onsetTick: 200 });
  });

  it('also when the cursor is past the loop', () => {
    const step = apply(start(null, 4), { type: 'setLoop', loop: loopOf(1, 2) });

    expect(step.session.index).toBe(1);
  });

  it('a loop set with the cursor inside it leaves the cursor and the marks where they are', () => {
    const before = play(start(null, 0), 60, 62).session; // now on e2, e0 and e1 marked correct
    const step = apply(before, { type: 'setLoop', loop: loopOf(1, 3) });

    expect(step.session.index).toBe(2);
    expect(step.session.marks).toEqual(before.marks);
    expect(step.effects).toEqual([]);
  });

  it('releases what the accompaniment left ringing when the cursor jumps', () => {
    const events = [
      ev(0, 60, { accompaniment: [{ noteId: 'acc', key: 48, endTick: 999, velocity: 80 }] }),
      ev(1, 62),
      ev(2, 64),
    ];
    const ringing = play(start(null, 0, events), 60).session;
    expect(ringing.soundingAccompaniment.size).toBe(1);

    const step = apply(ringing, { type: 'setLoop', loop: loopOf(2, 2) });

    expect(step.effects).toContainEqual({ type: 'soundOff', key: 48 });
    expect(step.session.soundingAccompaniment.size).toBe(0);
  });

  it('clearing the loop lets practice go on from the current position to the end (AS-3.3)', () => {
    const looping = play(start(loopOf(1, 2), 1), 62).session;
    const cleared = apply(looping, { type: 'setLoop', loop: null });
    expect(cleared.session.loop).toBeNull();
    expect(cleared.effects).toEqual([]);

    const { session, effects } = play(cleared.session, 64, 65, 67);
    expect(session.phase).toBe('finished');
    expect(effects.at(-1)).toEqual({ type: 'sessionEnded', reason: 'reachedEnd' });
  });

  it('changing the loop to another one applies the new slice from then on', () => {
    const first = apply(start(loopOf(1, 2), 1), { type: 'setLoop', loop: loopOf(3, 4) });
    expect(first.session.index).toBe(3);

    const { session } = play(first.session, 65, 67);
    expect(session.index).toBe(3);
  });

  it('is ignored once the session has ended: a new session takes its loop from its start options', () => {
    const finished = play(start(null, 4), 67).session;
    expect(finished.phase).toBe('finished');

    const step = apply(finished, { type: 'setLoop', loop: loopOf(1, 2) });

    expect(step.session).toBe(finished);
    expect(step.effects).toEqual([]);
  });
});

describe('a loop is deterministic and never reads time (FR-028, contract guarantee 2)', () => {
  it('the same inputs give the same session and effects with every timestamp changed', () => {
    const keys = [62, 64, 62, 70, 64];
    const run = (offset: number) => {
      let session = start(loopOf(1, 2), 1);
      const effects: PracticeEffect[] = [];
      keys.forEach((key, i) => {
        for (const type of ['noteOn', 'noteOff'] as const) {
          const step = applyInput(session, { type, key, timeStampMs: offset + i * 137 });
          session = step.session;
          effects.push(...step.effects);
        }
      });
      return { index: session.index, marks: [...session.marks], effects };
    };

    expect(run(0)).toEqual(run(90000));
  });
});
