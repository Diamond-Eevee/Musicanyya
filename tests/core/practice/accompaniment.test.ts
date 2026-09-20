import { describe, expect, it } from 'vitest';
import { buildExpectedEvents } from '../../../src/core/practice/expected.js';
import { applyInput, startSession } from '../../../src/core/practice/matcher.js';
import type {
  ExpectedEvent,
  HandSelection,
  PracticeEffect,
  PracticeInput,
  PracticeSession,
} from '../../../src/core/practice/types.js';
import { buildSequence } from '../../fakes/midi-sequence.js';
import { loadFixture } from './helpers.js';

const RIGHT: HandSelection = { preset: 'right', partIndex: 0, staves: [1] };

function begin(events: readonly ExpectedEvent[], accompaniment: boolean): PracticeSession {
  return startSession({
    scoreId: 'test',
    selection: RIGHT,
    events,
    startEventIndex: 0,
    loop: null,
    accompaniment,
    help: false,
  });
}

/** Feeds the inputs one by one and returns the effects of each step. */
function steps(session: PracticeSession, inputs: readonly PracticeInput[]) {
  const perStep: PracticeEffect[][] = [];
  let current = session;
  for (const input of inputs) {
    const result = applyInput(current, input);
    current = result.session;
    perStep.push([...result.effects]);
  }
  return { session: current, perStep };
}

const sounds = (effects: readonly PracticeEffect[]) =>
  effects.flatMap((e) => (e.type === 'soundOn' || e.type === 'soundOff' ? [`${e.type}:${e.key}`] : []));

describe('accompaniment follows the cursor, never a clock (FR-031, R-03)', () => {
  // hands-accompaniment: RH E5(76) F5(77) rest G5(79); LH C3(48) half, D3(50) while RH rests, E3(52)
  const { score, timeline } = loadFixture('hands-accompaniment.musicxml');
  const events = buildExpectedEvents(score, timeline, RIGHT);

  it('starts a note when the expected note it is written with is satisfied, and stops it when the cursor passes its end', () => {
    const { perStep } = steps(
      begin(events, true),
      buildSequence(['on:76@10', 'off:76@20', 'on:77@30', 'off:77@40', 'on:79@50']),
    );

    expect(perStep.map(sounds)).toEqual([
      ['soundOn:48'], // C3 with E5
      [], // off:76
      ['soundOn:50'], // D3 has no right-hand note of its own; it sounds with the note before it (C3 still rings)
      [], // off:77
      ['soundOff:48', 'soundOff:50', 'soundOn:52'], // the cursor passed the end of C3 and D3; E3 starts
    ]);
  });

  it('orders the effects: marks, then sound, then the cursor', () => {
    const result = applyInput(begin(events, true), buildSequence(['on:76@10'])[0] as PracticeInput);
    const types = result.effects.map((e) => e.type);

    expect(types.indexOf('markNotes')).toBeLessThan(types.indexOf('soundOn'));
    expect(types.indexOf('soundOn')).toBeLessThan(types.indexOf('moveCursor'));
  });

  it('carries the key, the noteheads and a velocity, so the app needs no lookup', () => {
    const result = applyInput(begin(events, true), buildSequence(['on:76@10'])[0] as PracticeInput);
    const on = result.effects.find((e) => e.type === 'soundOn');

    expect(on).toMatchObject({ type: 'soundOn', key: 48 });
    expect(on && on.type === 'soundOn' ? on.noteIds.length : 0).toBe(1);
    expect(on && on.type === 'soundOn' ? on.velocity : 0).toBeGreaterThan(0);
  });

  it('lets the last notes ring until the musician lets go of every key, then releases them', () => {
    const played = steps(
      begin(events, true),
      buildSequence(['on:76@10', 'off:76@20', 'on:77@30', 'off:77@40', 'on:79@50']),
    );
    expect(played.session.phase).toBe('finished');
    expect(played.session.soundingAccompaniment.size).toBe(1); // E3 is still ringing

    const released = steps(played.session, buildSequence(['off:79@60']));
    expect(released.perStep.map(sounds)).toEqual([['soundOff:52']]);
    expect(released.session.soundingAccompaniment.size).toBe(0);
  });

  it('never sounds anything with accompaniment switched off', () => {
    const { perStep } = steps(
      begin(events, false),
      buildSequence(['on:76@10', 'off:76@20', 'on:77@30', 'off:77@40', 'on:79@50', 'off:79@60']),
    );

    expect(perStep.flatMap(sounds)).toEqual([]);
  });

  it('sounds nothing for a wrong key or a half-played chord: only satisfying an event moves the cursor', () => {
    const { perStep } = steps(begin(events, true), buildSequence(['on:61@10', 'off:61@20', 'on:50@30']));

    expect(perStep.flatMap(sounds)).toEqual([]);
  });

  it('a skip moves the cursor like an advance does, so it sounds the skipped event accompaniment', () => {
    const { perStep } = steps(begin(events, true), buildSequence(['skipNext@10']));

    expect(sounds(perStep[0] ?? [])).toEqual(['soundOn:48']);
  });

  it('going back releases everything that is ringing', () => {
    const { perStep } = steps(begin(events, true), buildSequence(['on:76@10', 'off:76@20', 'skipPrev@30']));

    expect(sounds(perStep[2] ?? [])).toEqual(['soundOff:48']);
  });

  it('losing the keyboard releases everything that is ringing, and the position is kept', () => {
    const { perStep, session } = steps(begin(events, true), buildSequence(['on:76@10', 'lost:76@20']));

    expect(sounds(perStep[1] ?? [])).toEqual(['soundOff:48']);
    expect(session.index).toBe(1);
    expect(session.soundingAccompaniment.size).toBe(0);
  });

  it('switching accompaniment off mid-session silences what rings and keeps it off', () => {
    const off: PracticeInput = { type: 'setAccompaniment', enabled: false, timeStampMs: 25 };
    const { perStep, session } = steps(begin(events, true), [
      ...buildSequence(['on:76@10', 'off:76@20']),
      off,
      ...buildSequence(['on:77@30']),
    ]);

    expect(sounds(perStep[2] ?? [])).toEqual(['soundOff:48']);
    expect(sounds(perStep[3] ?? [])).toEqual([]);
    expect(session.accompaniment).toBe(false);
  });

  it('switching accompaniment on mid-session sounds from the next event on', () => {
    const on: PracticeInput = { type: 'setAccompaniment', enabled: true, timeStampMs: 5 };
    const { perStep } = steps(begin(events, false), [on, ...buildSequence(['on:76@10'])]);

    expect(sounds(perStep[0] ?? [])).toEqual([]);
    expect(sounds(perStep[1] ?? [])).toEqual(['soundOn:48']);
  });

  it('is the same whatever the timestamps say: no timer, no clock (Constitution I, II)', () => {
    const inputs = buildSequence(['on:76@10', 'off:76@20', 'on:77@30', 'off:77@40', 'on:79@50', 'off:79@60']);
    const stripped = inputs.map((i) => ({ ...i, timeStampMs: 0 }));

    const a = steps(begin(events, true), inputs).perStep.map(sounds);
    const b = steps(begin(events, true), stripped).perStep.map(sounds);
    expect(b).toEqual(a);
  });
});

describe('a note struck again while it still rings is released first', () => {
  it('emits soundOff before the second soundOn of the same key', () => {
    const ref = { noteId: 'n1', key: 48, endTick: 10_000, velocity: 80 };
    const mk = (index: number, onsetTick: number, key: number, acc: ExpectedEvent['accompaniment']): ExpectedEvent => ({
      index,
      passIndex: 0,
      measureIndex: 0,
      onsetTick,
      required: [{ key, noteIds: [`r${index}`], staff: 1 }],
      accompaniment: acc,
    });
    const events = [mk(0, 0, 76, [ref]), mk(1, 100, 77, [{ ...ref, noteId: 'n2' }])];

    const { perStep } = steps(begin(events, true), buildSequence(['on:76@10', 'off:76@20', 'on:77@30']));

    expect(sounds(perStep[0] ?? [])).toEqual(['soundOn:48']);
    expect(sounds(perStep[2] ?? [])).toEqual(['soundOff:48', 'soundOn:48']);
  });
});
