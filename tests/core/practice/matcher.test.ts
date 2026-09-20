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
});
