import { describe, expect, it } from 'vitest';
import { PERCUSSION_CHANNEL } from '../../../src/core/defaults.js';
import { buildExpectedEvents } from '../../../src/core/practice/expected.js';
import { handOptions, partOptions } from '../../../src/core/practice/hands.js';
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

// Feature 019 (practice-session 1.8.0, orchestra-score.md sections 5 and 6): Orchestra notes follow the musician through
// the accompaniment's timing rules on their own channel, and are never expected, marked or used to judge a key.
//
// piano-and-oboe: the right hand plays C5 D5 E5 F5 | G5(h) E5(h) | C5 C5 G4 G4 | C5(w), the left hand one whole note a bar,
// and the oboe (an Orchestra part) plays on the same beats a third above: E5 F5 G5 A5 | B5(h) G5(h) | E5 E5 B4 B4 | E5(w).

const RIGHT: HandSelection = { preset: 'right', partIndex: 0, staves: [1] };
const LEFT: HandSelection = { preset: 'left', partIndex: 0, staves: [2] };
const RH_KEYS = [72, 74, 76, 77, 79, 76, 72, 72, 67, 67, 72];
const OBOE_KEYS = [76, 77, 79, 81, 83, 79, 76, 76, 71, 71, 76];

function open(name = 'orchestra/piano-and-oboe.musicxml') {
  const { score, timeline } = loadFixture(name);
  const channel = timeline.channels.findIndex((c) => c.orchestra);
  return { score, timeline, channel };
}

function begin(events: readonly ExpectedEvent[], options: { accompaniment?: boolean; loop?: boolean } = {}) {
  return startSession({
    scoreId: 'test',
    selection: RIGHT,
    events,
    startEventIndex: 0,
    loop: options.loop
      ? { fromPassIndex: 0, toPassIndex: 2, fromEventIndex: 0, toEventIndex: 1, occurrence: null }
      : null,
    accompaniment: options.accompaniment ?? true,
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

/** Plays the right-hand keys of the first `count` events, each pressed and released. */
const playFirst = (count: number): PracticeInput[] =>
  buildSequence(
    RH_KEYS.slice(0, count).flatMap((key, i) => [`on:${key}@${100 + i * 100}`, `off:${key}@${150 + i * 100}`]),
  );

const orchestraEffects = (effects: readonly PracticeEffect[]) =>
  effects.flatMap((e) =>
    e.type === 'orchestraOn'
      ? [`on:${e.channel}:${e.key}`]
      : e.type === 'orchestraOff'
        ? [`off:${e.channel}:${e.key}`]
        : [],
  );

describe('ExpectedEvent.orchestra', () => {
  const { score, timeline, channel } = open();
  const events = buildExpectedEvents(score, timeline, RIGHT);
  const oboe = score.parts[1]?.notes ?? [];

  it('the fixture is what these tests assume', () => {
    expect(channel).toBeGreaterThanOrEqual(0);
    expect(events).toHaveLength(11);
    expect(events.map((e) => e.required[0]?.key)).toEqual(RH_KEYS);
    expect(oboe).toHaveLength(11);
  });

  it('holds the Orchestra notes of [this onset, next onset) with their channel, key, velocity and end', () => {
    expect(events.map((e) => e.orchestra.map((o) => o.key))).toEqual(OBOE_KEYS.map((key) => [key]));
    for (const event of events) {
      const [ref] = event.orchestra;
      expect(ref?.channel).toBe(channel);
      expect(ref?.velocity).toBeGreaterThan(0);
      const sounding = timeline.events.find((e) => e.head.noteId === ref?.noteId);
      expect(ref?.endTick).toBe(sounding?.endTick);
    }
    expect(events.map((e) => e.orchestra[0]?.noteId)).toEqual(oboe.map((n) => n.id));
  });

  it('never puts an Orchestra note in required or accompaniment', () => {
    const orchestraIds = new Set(oboe.map((n) => n.id));
    for (const event of events) {
      expect(event.required.flatMap((r) => r.noteIds).filter((id) => orchestraIds.has(id))).toEqual([]);
      expect(event.accompaniment.filter((a) => orchestraIds.has(a.noteId))).toEqual([]);
    }
    // the printed left hand is still the accompaniment: one whole note on each bar's first event
    expect(events.map((e) => e.accompaniment.length)).toEqual([1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1]);
  });

  it('attaches Orchestra notes to the event they pass under, like the accompaniment (left hand only: four events)', () => {
    const leftEvents = buildExpectedEvents(score, timeline, LEFT);
    expect(leftEvents).toHaveLength(4);
    expect(leftEvents.map((e) => e.orchestra.length)).toEqual([4, 2, 4, 1]); // every oboe note of the bar
  });

  it('leaves an Orchestra note on the percussion channel out of every list', () => {
    const first = oboe[0]?.id;
    const mutated = {
      ...timeline,
      events: timeline.events.map((e) => (e.head.noteId === first ? { ...e, channel: PERCUSSION_CHANNEL } : e)),
    };
    const built = buildExpectedEvents(score, mutated, RIGHT);
    expect(built[0]?.orchestra).toEqual([]);
    expect(built[0]?.accompaniment.map((a) => a.noteId)).not.toContain(first);
    expect(built[1]?.orchestra).toHaveLength(1); // the others are unchanged
  });

  it('a Score without an Orchestra has an empty list on every event', () => {
    const { score: plain, timeline: plainTimeline } = open('orchestra/piano-and-oboe-twin.musicxml');
    for (const event of buildExpectedEvents(plain, plainTimeline, RIGHT)) expect(event.orchestra).toEqual([]);
  });
});

describe('what Practice and Play offer (FR-013)', () => {
  it('offers the piano part only, never the Orchestra part, and no hand of it', () => {
    const { score } = open();
    const options = partOptions(score);
    expect(options.parts.map((p) => p.name)).toEqual(['Piano']);
    expect(options.preselected).toBe(0);
    expect(handOptions(score, 0).length).toBeGreaterThan(0);
  });

  it('with the Orchestra part first in the file still offers the piano, by its own part index', () => {
    const { score } = open('orchestra/orchestra-first.musicxml');
    const options = partOptions(score);
    expect(options.parts.map((p) => [p.partIndex, p.name])).toEqual([[1, 'Piano']]);
    expect(options.preselected).toBe(1);
  });
});

describe('orchestraOn / orchestraOff effects', () => {
  const { score, timeline, channel } = open();
  const events = buildExpectedEvents(score, timeline, RIGHT);

  it('satisfying an event starts its Orchestra note on its own channel, before the cursor moves, with the accompaniment on', () => {
    const { perStep } = steps(begin(events), buildSequence(['on:72@10']));
    const [effects] = perStep;
    const on = effects?.find((e) => e.type === 'orchestraOn');
    expect(on).toMatchObject({ type: 'orchestraOn', channel, key: 76, noteId: oboe(score, 0)?.id });
    expect((on as { velocity: number }).velocity).toBe(events[0]?.orchestra[0]?.velocity);
    const types = effects?.map((e) => e.type) ?? [];
    expect(types.indexOf('orchestraOn')).toBeLessThan(types.indexOf('moveCursor'));
  });

  it('starts it just the same with the accompaniment off (FR-016)', () => {
    const { perStep } = steps(begin(events, { accompaniment: false }), buildSequence(['on:72@10']));
    expect(orchestraEffects(perStep[0] ?? [])).toEqual([`on:${channel}:76`]);
    expect((perStep[0] ?? []).some((e) => e.type === 'soundOn')).toBe(false); // the left hand stays silent
  });

  it('releases a note when the cursor passes its end and starts the next one', () => {
    const { perStep } = steps(begin(events), playFirst(2));
    expect(orchestraEffects(perStep[0] ?? [])).toEqual([`on:${channel}:76`]);
    expect(orchestraEffects(perStep[2] ?? [])).toEqual([`off:${channel}:76`, `on:${channel}:77`]);
  });

  it('keeps the held session state in soundingOrchestra, keyed by channel and key, with the end tick', () => {
    const { session } = steps(begin(events), playFirst(1));
    const ref = events[0]?.orchestra[0];
    expect([...session.soundingOrchestra.entries()]).toEqual([[`${channel}:76`, ref?.endTick]]);
  });

  it('setAccompaniment(false) releases the left hand and none of the Orchestra', () => {
    const { session: playing } = steps(begin(events), buildSequence(['on:72@10', 'off:72@20']));
    expect(playing.soundingOrchestra.size).toBe(1);
    const result = applyInput(playing, { type: 'setAccompaniment', enabled: false, timeStampMs: 30 });
    expect(orchestraEffects(result.effects)).toEqual([]);
    expect(result.effects.some((e) => e.type === 'soundOff')).toBe(true); // the left-hand C3 stops
    expect(result.session.soundingOrchestra.size).toBe(1);

    // and the next note still starts, accompaniment off
    const next = applyInput(result.session, { type: 'noteOn', key: 74, velocity: 80, timeStampMs: 40 });
    expect(orchestraEffects(next.effects)).toEqual([`off:${channel}:76`, `on:${channel}:77`]);
  });

  it('releases every sounding Orchestra note on stop of the device, on skipPrevious and on a loop jump', () => {
    const afterTwo = steps(begin(events), playFirst(2)).session; // the oboe's F5 is sounding
    expect(afterTwo.soundingOrchestra.size).toBe(1);

    const lost = applyInput(afterTwo, { type: 'deviceLost', heldKeys: [], timeStampMs: 500 });
    expect(orchestraEffects(lost.effects)).toEqual([`off:${channel}:77`]);
    expect(lost.session.soundingOrchestra.size).toBe(0);

    const back = applyInput(afterTwo, { type: 'skipPrevious', timeStampMs: 500 });
    expect(orchestraEffects(back.effects)).toEqual([`off:${channel}:77`]);
    expect(back.session.soundingOrchestra.size).toBe(0);

    // a loop over events 0-1: satisfying the last event wraps to the first and rings nothing from it
    const looping = steps(begin(events, { loop: true }), playFirst(1)).session;
    expect(looping.soundingOrchestra.size).toBe(1);
    const wrapped = applyInput(looping, { type: 'noteOn', key: 74, velocity: 80, timeStampMs: 600 });
    expect(wrapped.session.index).toBe(0);
    expect(wrapped.session.soundingOrchestra.size).toBe(0);
    expect(orchestraEffects(wrapped.effects)).toContain(`off:${channel}:76`);
    expect(orchestraEffects(wrapped.effects)).not.toContain(`on:${channel}:77`);
  });

  it('at the end the last Orchestra note rings until the musician lets go of every key, then stops', () => {
    const all = playFirst(11);
    const lastDown = all.slice(0, -1); // everything but the final key-up
    const { session, perStep } = steps(begin(events), lastDown);
    expect(session.phase).toBe('finished');
    expect(session.soundingOrchestra.size).toBe(1);
    expect(perStep.flatMap(orchestraEffects).at(-1)).toBe(`on:${channel}:76`);
    const release = applyInput(session, { type: 'noteOff', key: 72, timeStampMs: 5000 });
    expect(orchestraEffects(release.effects)).toEqual([`off:${channel}:76`]);
    expect(release.session.soundingOrchestra.size).toBe(0);
  });

  it('never marks an Orchestra note, and no key press ever excuses or judges one', () => {
    const orchestraIds = new Set((score.parts[1]?.notes ?? []).map((n) => n.id));
    const { session, perStep } = steps(begin(events), playFirst(11));
    const marked = perStep.flat().flatMap((e) => (e.type === 'markNotes' ? e.marks.map((m) => m.noteId) : []));
    expect(marked.length).toBeGreaterThan(0);
    expect(marked.filter((id) => orchestraIds.has(id))).toEqual([]);
    expect([...session.marks.keys()].filter((id) => orchestraIds.has(id))).toEqual([]);
  });

  it('a key at an Orchestra pitch gets exactly the feedback it gets in the same file without the Orchestra', () => {
    // at event 0 the right hand has C5 and the oboe E5: the musician presses E5
    const wrongKey = buildSequence(['on:76@10', 'off:76@20', 'on:76@30', 'off:76@40']);
    const twin = open('orchestra/piano-and-oboe-twin.musicxml');
    const twinEvents = buildExpectedEvents(twin.score, twin.timeline, RIGHT);

    const withOrchestra = steps(begin(events), wrongKey);
    const without = steps(begin(twinEvents), wrongKey);
    const noOrchestraSound = (effects: readonly PracticeEffect[]) =>
      effects.filter((e) => e.type !== 'orchestraOn' && e.type !== 'orchestraOff');
    expect(withOrchestra.perStep.map(noOrchestraSound)).toEqual(without.perStep.map(noOrchestraSound));
    expect(withOrchestra.session.log).toEqual(without.session.log);
    expect(withOrchestra.session.log).toHaveLength(2); // both presses are judged, none is excused as played along
  });
});

function oboe(score: ReturnType<typeof open>['score'], index: number) {
  return score.parts[1]?.notes[index];
}
