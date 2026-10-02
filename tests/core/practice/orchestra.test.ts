import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LIVE_QUEUE_CAPACITY } from '../../../src/core/defaults.js';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    expect(withOboe(events, score, timeline).map((e) => e.orchestra[0]?.key)).toEqual(OBOE_KEYS);
  });

  // Owner decision 2026-10-02 (branch fix-morning-mood-chords): the Orchestra is not heard in Practice mode. Feature 019
  // played each Orchestra note with the musician's progress; now no event carries one, whatever hands are chosen.
  it('carries no Orchestra note on any event, for either hand or both (the Orchestra is silent in Practice)', () => {
    for (const selection of [RIGHT, LEFT, { preset: 'both', partIndex: 0, staves: [1, 2] } as HandSelection]) {
      const built = buildExpectedEvents(score, timeline, selection);
      expect(built.length).toBeGreaterThan(0);
      for (const event of built) expect(event.orchestra).toEqual([]);
    }
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

  it.each(['repertoire/advanced/grieg-morning-mood', 'repertoire/advanced/grieg-morning-mood-easier'])(
    '%s: no Practice event carries an Orchestra note',
    (itemId) => {
      const item = loadFixture(`../../../public/library/${itemId}.musicxml`);
      expect(item.score.parts.some((p) => p.orchestra)).toBe(true);
      for (const selection of [RIGHT, LEFT, { preset: 'both', partIndex: 0, staves: [1, 2] } as HandSelection]) {
        for (const event of buildExpectedEvents(item.score, item.timeline, selection))
          expect(event.orchestra).toEqual([]);
      }
    },
  );

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

// The matcher still plays the Orchestra notes an event carries (practice-session 1.8.0). Since buildExpectedEvents attaches
// none any more (owner decision 2026-10-02), these tests attach the oboe's notes by hand, one per right-hand event as feature
// 019 did, to keep that mechanism covered.
describe('orchestraOn / orchestraOff effects', () => {
  const { score, timeline, channel } = open();
  const events = withOboe(buildExpectedEvents(score, timeline, RIGHT), score, timeline);

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

/** The events with the oboe's note at the same index attached as their Orchestra note (on its channel, key, velocity and end
 *  from the timeline), as feature 019's buildExpectedEvents attached them on this fixture. */
function withOboe(
  events: readonly ExpectedEvent[],
  score: ReturnType<typeof open>['score'],
  timeline: ReturnType<typeof open>['timeline'],
): ExpectedEvent[] {
  return events.map((event, index) => {
    const note = oboe(score, index);
    const sounding = timeline.events.find((e) => e.head.noteId === note?.id);
    if (!note || !sounding) throw new Error(`no oboe note ${index}`);
    const ref = {
      noteId: note.id,
      key: sounding.key,
      endTick: sounding.endTick,
      velocity: sounding.velocity,
      channel: sounding.channel,
    };
    return { ...event, orchestra: [ref] };
  });
}

// Feature 019 T080 (RT review T036, and its own RT review): one Practice input may put the key's own note plus an `orchestraOff` per ended
// Orchestra note, an `orchestraOn` per new one and the accompaniment's notes into the worklet's live queue at once; a
// dropped note-off is a stuck note. On the densest real Orchestra score the most one input ever produces must stay within
// half of `LIVE_QUEUE_CAPACITY`, so a burst of keys on top cannot overflow it.
describe('live queue headroom on every Orchestra item (T080)', () => {
  // Every library item with an orchestration definition (Morning Mood first); a denser Orchestra added later is held to
  // the same margin.
  const root = path.resolve(__dirname, '../../..');
  const ITEMS = fs
    .readdirSync(path.join(root, 'content/library/orchestra'))
    .filter((f) => f.endsWith('.json'))
    .map(
      (f) =>
        (JSON.parse(fs.readFileSync(path.join(root, 'content/library/orchestra', f), 'utf8')) as { itemId: string })
          .itemId,
    );
  const LIVE = new Set(['soundOn', 'soundOff', 'orchestraOn', 'orchestraOff']);
  const SELECTIONS: HandSelection[] = [RIGHT, LEFT, { preset: 'both', partIndex: 0, staves: [1, 2] }];

  /** The most live messages any single input produces while every event of the piece is played: its keys pressed one by
   *  one (the last press satisfies the event), then released. At every event the input of a lost device is tried too (it
   *  releases everything that sounds at once), without going on from it. */
  function mostPerInput(itemId: string, selection: HandSelection) {
    const { score, timeline } = loadFixture(`../../../public/library/${itemId}.musicxml`);
    const events = buildExpectedEvents(score, timeline, selection);
    let session = startSession({
      scoreId: itemId,
      selection,
      events,
      startEventIndex: 0,
      loop: null,
      accompaniment: true,
      help: false,
    });
    let most = 0;
    let mostOnDeviceLost = 0;
    let ended = false;
    let t = 0;
    const live = (effects: readonly PracticeEffect[]) => effects.filter((e) => LIVE.has(e.type)).length;
    const apply = (input: PracticeInput) => {
      const result = applyInput(session, input);
      session = result.session;
      most = Math.max(most, 1 + live(result.effects)); // the key's own note goes through the queue too
      if (result.effects.some((e) => e.type === 'sessionEnded')) ended = true;
    };
    for (const event of events) {
      const keys = [...new Set(event.required.map((r) => r.key))];
      for (const key of keys) {
        t += 10;
        apply(buildSequence([`on:${key}@${t}`])[0] as PracticeInput);
      }
      const lost = applyInput(session, buildSequence([`lost:${keys.join(',')}@${t + 5}`])[0] as PracticeInput);
      mostOnDeviceLost = Math.max(mostOnDeviceLost, live(lost.effects));
      for (const key of keys) {
        t += 10;
        apply(buildSequence([`off:${key}@${t}`])[0] as PracticeInput);
      }
    }
    return { most, mostOnDeviceLost, events: events.length, ended };
  }

  it('there is at least one Orchestra item (Morning Mood)', () => {
    expect(ITEMS).toContain('repertoire/advanced/grieg-morning-mood');
  });

  it.each(ITEMS.flatMap((itemId) => SELECTIONS.map((s) => [itemId, s.preset, s] as const)))(
    '%s, %s: no input, and no lost device, produces more than half the live queue',
    (itemId, _name, selection) => {
      const { most, mostOnDeviceLost, events, ended } = mostPerInput(itemId, selection);
      expect(events).toBeGreaterThan(10);
      expect(ended).toBe(true); // the whole piece was played through
      expect(most).toBeGreaterThan(1);
      expect(most).toBeLessThanOrEqual(LIVE_QUEUE_CAPACITY / 2);
      expect(mostOnDeviceLost).toBeLessThanOrEqual(LIVE_QUEUE_CAPACITY / 2);
    },
  );
});
