import { describe, expect, it } from 'vitest';
import { buildExpectedEvents } from '../../../src/core/practice/expected.js';
import { applyInput, startSession } from '../../../src/core/practice/matcher.js';
import type { HandSelection, PracticeEffect, PracticeSession } from '../../../src/core/practice/types.js';
import { buildSequence } from '../../fakes/midi-sequence.js';
import { loadFixture } from './helpers.js';

function playSession(
  session: PracticeSession,
  inputs: string[],
): { session: PracticeSession; effects: PracticeEffect[] } {
  const practiceInputs = buildSequence(inputs);
  let currentSession = session;
  const allEffects: PracticeEffect[] = [];
  for (const input of practiceInputs) {
    const step = applyInput(currentSession, input);
    currentSession = step.session;
    allEffects.push(...step.effects);
  }
  return { session: currentSession, effects: allEffects };
}

describe('matcher', () => {
  const selection: HandSelection = { preset: 'both', partIndex: 0, staves: [1, 2] };

  it('correct key advances and wrong key never does', () => {
    const { score, timeline } = loadFixture('scale-c-major-q100.musicxml');
    const events = buildExpectedEvents(score, timeline, selection);
    const session = startSession({
      scoreId: 'test',
      events,
      startEventIndex: 0,
      loop: null,
      accompaniment: false,
      help: false,
    });

    // First note is C4 (60)
    let result = playSession(session, ['on:61@100', 'off:61@150']); // play C#4
    expect(result.session.index).toBe(0); // did not advance
    expect(result.session.log.length).toBeGreaterThan(0);

    result = playSession(result.session, ['on:60@200', 'off:60@250']);
    expect(result.session.index).toBe(1); // advanced!
  });

  it('accepts chords only when all required keys are held, with correctSoFar', () => {
    const { score, timeline } = loadFixture('grand-staff-two-voices-per-staff.musicxml');
    const events = buildExpectedEvents(score, timeline, selection);
    const session = startSession({
      scoreId: 'test',
      events,
      startEventIndex: 0,
      loop: null,
      accompaniment: false,
      help: false,
    });

    // keys: C5(72), E4(64), C3(48), G2(43)
    const step1 = playSession(session, ['on:43@100']);
    expect(step1.session.index).toBe(0);
    expect(Array.from(step1.session.marks.values())).toContain('correctSoFar');

    const step2 = playSession(step1.session, ['on:48@150']);
    expect(step2.session.index).toBe(0);

    const step3 = playSession(step2.session, ['on:64@200']);
    expect(step3.session.index).toBe(0);

    const step4 = playSession(step3.session, ['on:72@250']);
    expect(step4.session.index).toBe(1);
  });

  it('every expected note needs a fresh press, already down blocks', () => {
    const { score, timeline } = loadFixture('scale-c-major-q100.musicxml');
    const events = buildExpectedEvents(score, timeline, selection);
    const session = startSession({
      scoreId: 'test',
      events,
      startEventIndex: 0,
      loop: null,
      accompaniment: false,
      help: false,
    });

    // First is C4(60), second is D4(62)
    const step1 = playSession(session, ['on:62@50']);
    const step2 = playSession(step1.session, ['on:60@100']);

    expect(step2.session.index).toBe(1); // advanced to D4
    expect(step2.session.phase).toBe('blocked'); // D4 is already held!
    expect(Array.from(step2.session.marks.values())).toContain('heldOver');

    const step3 = playSession(step2.session, ['off:62@150']);
    expect(step3.session.phase).toBe('waiting'); // unblocked

    const step4 = playSession(step3.session, ['on:62@200']);
    expect(step4.session.index).toBe(2); // advanced
  });

  it('played-along keys are marked but not judged', () => {
    const { score, timeline } = loadFixture('grace-acciaccatura.musicxml');
    const sel: HandSelection = { preset: 'right', partIndex: 0, staves: [1] };
    const events = buildExpectedEvents(score, timeline, sel);
    const session = startSession({
      scoreId: 'test',
      events,
      startEventIndex: 0,
      loop: null,
      accompaniment: false,
      help: false,
    });

    const acc = events[0].accompaniment[0];
    expect(acc).toBeDefined();

    const step1 = playSession(session, [`on:${acc?.key}@100`]);
    expect(Array.from(step1.session.marks.values())).toContain('playedAlong');
    expect(step1.session.wrongAttemptsOnCurrent).toBe(0);
  });

  it('releasing a long note early never blocks', () => {
    const { score, timeline } = loadFixture('scale-c-major-q100.musicxml');
    const events = buildExpectedEvents(score, timeline, selection);
    const session = startSession({
      scoreId: 'test',
      events,
      startEventIndex: 0,
      loop: null,
      accompaniment: false,
      help: false,
    });

    const step1 = playSession(session, ['on:60@100']);
    expect(step1.session.index).toBe(1);

    const step2 = playSession(step1.session, ['off:60@150']);
    expect(step2.session.phase).toBe('waiting');
    expect(step2.session.index).toBe(1);
  });

  it('extra key when blocked', () => {
    const { score, timeline } = loadFixture('scale-c-major-q100.musicxml');
    const events = buildExpectedEvents(score, timeline, selection);
    const session = startSession({
      scoreId: 'test',
      events,
      startEventIndex: 0,
      loop: null,
      accompaniment: false,
      help: false,
    });

    const step1 = playSession(session, ['on:62@50', 'on:60@100']);
    expect(step1.session.phase).toBe('blocked');

    const step2 = playSession(step1.session, ['on:64@150']);
    expect(step2.session.log[step2.session.log.length - 1]?.state).toBe('extra');
  });

  it('T056: wrong / wrong-octave / extra presses carry a keyFeedback effect for the on-screen keyboard, since they have no notehead', () => {
    const { score, timeline } = loadFixture('scale-c-major-q100.musicxml');
    const events = buildExpectedEvents(score, timeline, selection);
    const session = startSession({
      scoreId: 'test',
      events,
      startEventIndex: 0,
      loop: null,
      accompaniment: false,
      help: false,
    });

    // First note is C4 (60). A wrong pitch with no octave relation gets a mark but no message.
    const wrongPitch = playSession(session, ['on:61@100']);
    const wrongPitchEffect = wrongPitch.effects.find((e) => e.type === 'keyFeedback');
    expect(wrongPitchEffect).toEqual({ type: 'keyFeedback', key: 61, state: 'wrongPitch' });

    // Playing the right letter an octave too high says which way to move (R-10).
    const octaveHigh = playSession(session, ['on:72@100']); // C5, required is C4 (60)
    expect(octaveHigh.effects).toContainEqual({
      type: 'keyFeedback',
      key: 72,
      state: 'wrongOctave',
      messageId: 'practice.octave.lower',
    });

    // ... and an octave too low says the other way.
    const octaveLow = playSession(session, ['on:48@100']); // C3
    expect(octaveLow.effects).toContainEqual({
      type: 'keyFeedback',
      key: 48,
      state: 'wrongOctave',
      messageId: 'practice.octave.higher',
    });

    // Once every required key is already held, a further key is extra and says to release it, not the octave message.
    const step1 = playSession(session, ['on:62@50', 'on:60@100']);
    expect(step1.session.phase).toBe('blocked');
    const step2 = playSession(step1.session, ['on:64@150']);
    expect(step2.effects).toContainEqual({
      type: 'keyFeedback',
      key: 64,
      state: 'extra',
      messageId: 'practice.extra.notInChord',
    });
  });

  it('sustain ignored for judging', () => {
    const { score, timeline } = loadFixture('scale-c-major-q100.musicxml');
    const events = buildExpectedEvents(score, timeline, selection);
    const session = startSession({
      scoreId: 'test',
      events,
      startEventIndex: 0,
      loop: null,
      accompaniment: false,
      help: false,
    });

    const step1 = playSession(session, ['sus:down@50']);
    expect(step1.session.phase).toBe('waiting');
    expect(step1.session.index).toBe(0);

    const step2 = playSession(step1.session, ['on:60@100']);
    expect(step2.session.index).toBe(1);
  });

  it('a chord from the C major exercise is complete when all three keys are held, in any order (SC-003)', () => {
    const { score, timeline } = loadFixture('chords/c-major-scale-and-chords.musicxml');
    const events = buildExpectedEvents(score, timeline, { preset: 'both', partIndex: 0, staves: [1] });
    const session = startSession({
      scoreId: 'test',
      events,
      startEventIndex: 4,
      loop: null,
      accompaniment: false,
      help: false,
    });

    const partial = playSession(session, ['on:67@10', 'on:60@20']);
    expect(partial.session.index).toBe(4);
    expect(partial.session.marks.size).toBe(2); // both held keys marked correctSoFar

    const complete = playSession(partial.session, ['on:64@30']);
    expect(complete.session.index).toBe(5);
  });
});

describe('releasing a key before the event is complete (008 FR-003, T067)', () => {
  const chordSession = () => {
    const { score, timeline } = loadFixture('chords/c-major-scale-and-chords.musicxml');
    const events = buildExpectedEvents(score, timeline, { preset: 'both', partIndex: 0, staves: [1] });
    const session = startSession({
      scoreId: 'test',
      events,
      startEventIndex: 4, // the C-E-G chord
      loop: null,
      accompaniment: false,
      help: false,
    });
    const noteOf = (key: number) => events[4]?.required.find((r) => r.key === key)?.noteIds ?? [];
    return { session, noteOf };
  };

  it('(a) takes the released key’s note back to no mark; the key still held keeps correctSoFar', () => {
    const { session, noteOf } = chordSession();
    const held = playSession(session, ['on:60@10', 'on:64@20']);
    expect(held.session.marks.get(noteOf(64)[0] as string)).toBe('correctSoFar');

    const released = playSession(held.session, ['off:64@30']);
    expect(released.session.marks.has(noteOf(64)[0] as string)).toBe(false);
    expect(released.session.marks.get(noteOf(60)[0] as string)).toBe('correctSoFar');
    expect(released.session.index).toBe(4);
    expect(released.effects).toContainEqual({
      type: 'markNotes',
      marks: noteOf(64).map((noteId) => ({ noteId, state: 'waiting' })),
    });
    expect(released.effects.filter((e) => e.type === 'markNotes')).toHaveLength(1); // only that key's note
  });

  it('(b) pressing the released key again completes the chord as before', () => {
    const { session } = chordSession();
    const step = playSession(session, ['on:60@10', 'on:64@20', 'off:64@30', 'on:64@40']);
    expect(step.session.index).toBe(4); // 67 is not held yet
    const done = playSession(step.session, ['on:67@50']);
    expect(done.session.index).toBe(5);
  });

  it('(c) releasing a key after its event was accepted changes no mark', () => {
    const { session, noteOf } = chordSession();
    const accepted = playSession(session, ['on:60@10', 'on:64@20', 'on:67@30']);
    expect(accepted.session.index).toBe(5);
    expect(accepted.session.marks.get(noteOf(60)[0] as string)).toBe('correct');

    const released = playSession(accepted.session, ['off:60@40', 'off:64@50', 'off:67@60']);
    for (const key of [60, 64, 67]) expect(released.session.marks.get(noteOf(key)[0] as string)).toBe('correct');
    expect(released.effects.filter((e) => e.type === 'markNotes')).toEqual([]);
  });

  it('(d) releasing a held-over key clears its held-over mark (its hint goes away then, FR-009a)', () => {
    // Event 3 (F4, key 65) is followed by the chord; hold 65 through the arrival of an event that needs it: use the
    // repeated-pitch fixture, where the same key is required twice in a row.
    const { score, timeline } = loadFixture('repeated-pitch-two-presses.musicxml');
    const events = buildExpectedEvents(score, timeline, { preset: 'both', partIndex: 0, staves: [1] });
    const key = events[0]?.required[0]?.key as number;
    expect(events[1]?.required.some((r) => r.key === key)).toBe(true);
    const session = startSession({
      scoreId: 'test',
      events,
      startEventIndex: 0,
      loop: null,
      accompaniment: false,
      help: false,
    });

    const held = playSession(session, [`on:${key}@10`]); // accepted; the key stays down, event 1 needs it
    expect(held.session.phase).toBe('blocked');
    const noteId = events[1]?.required.find((r) => r.key === key)?.noteIds[0] as string;
    expect(held.session.marks.get(noteId)).toBe('heldOver');

    const released = playSession(held.session, [`off:${key}@20`]);
    expect(released.session.phase).toBe('waiting');
    expect(released.session.marks.has(noteId)).toBe(false);
    expect(released.effects).toContainEqual({ type: 'markNotes', marks: [{ noteId, state: 'waiting' }] });
    // ...and the note that was played first stays correct
    const first = events[0]?.required.find((r) => r.key === key)?.noteIds[0] as string;
    expect(released.session.marks.get(first)).toBe('correct');
  });

  it('(e) releasing a key the event does not require changes no mark', () => {
    const { session, noteOf } = chordSession();
    const step = playSession(session, ['on:60@10', 'on:61@20', 'off:61@30']);
    expect(step.session.marks.get(noteOf(60)[0] as string)).toBe('correctSoFar');
    expect(step.session.marks.size).toBe(1);
  });
});
