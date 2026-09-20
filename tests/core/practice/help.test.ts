import { describe, expect, it } from 'vitest';
import { PRACTICE_HELP_AFTER_WRONG_ATTEMPTS } from '../../../src/core/defaults.js';
import { buildExpectedEvents } from '../../../src/core/practice/expected.js';
import { applyInput, startSession } from '../../../src/core/practice/matcher.js';
import type {
  ExpectedEvent,
  HandSelection,
  PracticeEffect,
  PracticeSession,
} from '../../../src/core/practice/types.js';
import { loadFixture } from './helpers.js';

/** One required key per event; mirrors the minimal fixture style of tests/core/practice/loop-wrap.test.ts. */
function ev(index: number, key: number, noteId = `n${index}`): ExpectedEvent {
  return {
    index,
    passIndex: index,
    measureIndex: index,
    onsetTick: index * 100,
    required: [{ key, noteIds: [noteId], staff: 1 }],
    accompaniment: [],
  };
}

function start(events: readonly ExpectedEvent[], help: boolean): PracticeSession {
  return startSession({ scoreId: 'test', events, startEventIndex: 0, loop: null, accompaniment: false, help });
}

let clock = 0;
function on(session: PracticeSession, key: number) {
  return applyInput(session, { type: 'noteOn', key, timeStampMs: clock++ });
}
function off(session: PracticeSession, key: number) {
  return applyInput(session, { type: 'noteOff', key, timeStampMs: clock++ });
}

describe('T038: help effects (FR-023, FR-024, FR-009a, R-10, R-14/R-15)', () => {
  it('shows help by itself after PRACTICE_HELP_AFTER_WRONG_ATTEMPTS wrong attempts on the same event, when enabled', () => {
    // Required key 60; 62/63/65 are all a semitone-or-more off and not an octave of it, so each is wrongPitch.
    let session = start([ev(0, 60), ev(1, 62)], true);
    const wrongKeys = [62, 63, 65, 67, 68].slice(0, PRACTICE_HELP_AFTER_WRONG_ATTEMPTS);
    let last: { session: PracticeSession; effects: readonly PracticeEffect[] } = { session, effects: [] };
    for (const key of wrongKeys) {
      const step = on(session, key);
      session = step.session;
      last = step;
      session = off(session, key).session;
    }
    expect(session.wrongAttemptsOnCurrent).toBe(PRACTICE_HELP_AFTER_WRONG_ATTEMPTS);
    expect(last.effects).toContainEqual({ type: 'showHelp', eventIndex: 0, reason: 'stuck' });
  });

  it('never shows help by itself when the help setting is off, however many wrong attempts', () => {
    let session = start([ev(0, 60), ev(1, 62)], false);
    const allEffects: PracticeEffect[] = [];
    for (const key of [62, 63, 65, 67, 68]) {
      const step = on(session, key);
      session = step.session;
      allEffects.push(...step.effects);
      session = off(session, key).session;
    }
    expect(allEffects.some((e) => e.type === 'showHelp')).toBe(false);
  });

  it('shows help immediately on request, when enabled', () => {
    const session = start([ev(0, 60)], true);
    const step = applyInput(session, { type: 'requestHelp', timeStampMs: clock++ });
    expect(step.effects).toContainEqual({ type: 'showHelp', eventIndex: 0, reason: 'requested' });
  });

  it('does nothing on request when the help setting is off (FR-024 is switched off with the whole feature)', () => {
    const session = start([ev(0, 60)], false);
    const step = applyInput(session, { type: 'requestHelp', timeStampMs: clock++ });
    expect(step.effects.some((e) => e.type === 'showHelp')).toBe(false);
  });

  it('shows help immediately with reason heldOver, regardless of the help setting (FR-009a is not optional)', () => {
    // Key 60 required at both e0 and e1 (e.g. a repeated note across a barline): held from e0, still down at e1.
    const session = start([ev(0, 60), ev(1, 60, 'n1')], false);
    const step = on(session, 60);
    expect(step.session.index).toBe(1);
    expect(step.session.phase).toBe('blocked');
    expect(step.effects).toContainEqual({ type: 'showHelp', eventIndex: 1, reason: 'heldOver' });
  });

  it('hides help as soon as the event it was shown for is satisfied', () => {
    let session = start([ev(0, 60), ev(1, 62)], true);
    const requested = applyInput(session, { type: 'requestHelp', timeStampMs: clock++ });
    expect(requested.effects).toContainEqual({ type: 'showHelp', eventIndex: 0, reason: 'requested' });
    session = requested.session;

    const satisfied = on(session, 60);
    expect(satisfied.effects).toContainEqual({ type: 'hideHelp' });
    expect(satisfied.session.index).toBe(1);
  });

  it('setHelp(false) turns the whole feature off: hides help that was shown and mutes both future reasons', () => {
    let session = start([ev(0, 60), ev(1, 62)], true);
    const requested = applyInput(session, { type: 'requestHelp', timeStampMs: clock++ });
    session = requested.session;
    expect(session.helpShown).toBe(true);

    const off = applyInput(session, { type: 'setHelp', enabled: false, timeStampMs: clock++ });
    expect(off.effects).toContainEqual({ type: 'hideHelp' });
    expect(off.session.help).toBe(false);
    session = off.session;

    const stillNoHelp = applyInput(session, { type: 'requestHelp', timeStampMs: clock++ });
    expect(stillNoHelp.effects.some((e) => e.type === 'showHelp')).toBe(false);
  });

  it('setHelp(true) turns it back on for a later request', () => {
    let session = start([ev(0, 60)], false);
    session = applyInput(session, { type: 'setHelp', enabled: true, timeStampMs: clock++ }).session;
    const step = applyInput(session, { type: 'requestHelp', timeStampMs: clock++ });
    expect(step.effects).toContainEqual({ type: 'showHelp', eventIndex: 0, reason: 'requested' });
  });

  it('grace notes never count towards the help trigger (FR-027): playing one is playedAlong, not an attempt', () => {
    const selection: HandSelection = { preset: 'both', partIndex: 0, staves: [1] };
    const { score, timeline } = loadFixture('grace-acciaccatura.musicxml');
    const events = buildExpectedEvents(score, timeline, selection);

    let session = start(events, true);
    const allEffects: PracticeEffect[] = [];
    // The grace note is B3 (key 59); play it more times than the help threshold.
    for (let i = 0; i < PRACTICE_HELP_AFTER_WRONG_ATTEMPTS + 2; i++) {
      const step = on(session, 59);
      session = step.session;
      allEffects.push(...step.effects);
      session = off(session, 59).session;
    }
    expect(session.wrongAttemptsOnCurrent).toBe(0);
    expect(allEffects.some((e) => e.type === 'showHelp')).toBe(false);
  });
});
