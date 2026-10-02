import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CHANNEL_PAN,
  DEFAULT_CHANNEL_VOLUME,
  GUIDE_PROGRAM,
  GUIDE_VELOCITY_SCALE,
  LIVE_CHANNEL,
  METRONOME_CHANNEL,
  METRONOME_KEY_BEAT,
  METRONOME_KEY_DOWNBEAT,
  METRONOME_VELOCITY_BEAT,
  METRONOME_VELOCITY_DOWNBEAT,
  PERCUSSION_CHANNEL,
} from '../../../src/core/defaults.js';
import { buildExpectedNotes } from '../../../src/core/grade/expected.js';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import type { PlayScheduleOptions } from '../../../src/core/play/types.js';
import { handOptions, partOptions } from '../../../src/core/practice/hands.js';
import type { HandSelection } from '../../../src/core/practice/types.js';
import { EVENT_KIND, type ScheduleMessage } from '../../../src/core/schedule/compile.js';
import { compilePlaySchedule } from '../../../src/core/schedule/play-schedule.js';
import type { NoteId, Score } from '../../../src/core/score/model.js';
import { buildTimeline } from '../../../src/core/timeline/timeline.js';
import type { ChannelSetup, PlaybackTimeline, SoundingEvent } from '../../../src/core/timeline/types.js';
import { decodeXml } from '../../../src/engine/files/decode.js';
import { loadFixture } from '../practice/helpers.js';

// Feature 020, US1 (specs/020-play-guide-voice/contracts/guide-voice.md sections 2 and 5): in a Play run on a Score without an
// Orchestra, the musician's own graded notes are moved to a free melodic channel as the Guide voice instead of being dropped.

const libraryDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../public/library');

const METRONOME = {
  beatKey: METRONOME_KEY_BEAT,
  downbeatKey: METRONOME_KEY_DOWNBEAT,
  beatVelocity: METRONOME_VELOCITY_BEAT,
  downbeatVelocity: METRONOME_VELOCITY_DOWNBEAT,
};

function options(overrides: Partial<PlayScheduleOptions> = {}): PlayScheduleOptions {
  return {
    range: null,
    gradedNoteIds: new Set(),
    accompaniment: true,
    countInMeasures: 1,
    tempoPercent: 100,
    metronome: METRONOME,
    guide: true,
    ...overrides,
  };
}

interface Loaded {
  score: Score;
  timeline: PlaybackTimeline;
}

function loadLibrary(file: string): Loaded {
  const { doc } = readXml(decodeXml(fs.readFileSync(path.join(libraryDir, file))));
  const { score } = buildScore(doc);
  return { score, timeline: buildTimeline(score).timeline };
}

/** The graded set of a hand selection over the whole Score (what the session passes as `gradedNoteIds`). */
function gradedOf({ score, timeline }: Loaded, selection: HandSelection): Set<NoteId> {
  return new Set(buildExpectedNotes(score, timeline, selection, null).flatMap((n) => n.noteIds));
}

/** The session's default choice: the preselected part, both hands. */
function bothHands(loaded: Loaded): HandSelection {
  const selection = handOptions(loaded.score, partOptions(loaded.score).preselected)[0];
  if (!selection) throw new Error('the Score has nothing to practise');
  return selection;
}

const RIGHT: HandSelection = { preset: 'right', partIndex: 0, staves: [1] };

interface NoteOn {
  tick: number;
  key: number;
  velocity: number;
}

function noteOns(schedule: ScheduleMessage, channel: number): NoteOn[] {
  const out: NoteOn[] = [];
  for (let i = 0; i < schedule.eventKind.length; i++) {
    if (schedule.eventKind[i] !== EVENT_KIND.noteOn || schedule.eventChannel[i] !== channel) continue;
    out.push({
      tick: schedule.eventTick[i] as number,
      key: schedule.eventData1[i] as number,
      velocity: schedule.eventData2[i] as number,
    });
  }
  return out.sort((a, b) => a.tick - b.tick || a.key - b.key);
}

function noteOffTicks(schedule: ScheduleMessage, channel: number, key: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < schedule.eventKind.length; i++) {
    if (schedule.eventKind[i] !== EVENT_KIND.noteOff || schedule.eventChannel[i] !== channel) continue;
    if (schedule.eventData1[i] === key) out.push(schedule.eventTick[i] as number);
  }
  return out.sort((a, b) => a - b);
}

/** The value of the tick-0 controller `controller` on `channel`, or undefined. */
function controllerAtZero(schedule: ScheduleMessage, channel: number, controller: number): number | undefined {
  for (let i = 0; i < schedule.eventKind.length; i++) {
    if (
      schedule.eventKind[i] === EVENT_KIND.controlChange &&
      schedule.eventTick[i] === 0 &&
      schedule.eventChannel[i] === channel &&
      schedule.eventData1[i] === controller
    ) {
      return schedule.eventData2[i];
    }
  }
  return undefined;
}

const scaled = (velocity: number) => Math.max(1, Math.round(velocity * GUIDE_VELOCITY_SCALE));

/** The Guide voice the contract promises: every sounding event inside the range whose members are graded, shifted by the run. */
function expectedGuide(
  timeline: PlaybackTimeline,
  graded: ReadonlySet<NoteId>,
  tickMap: { countInTicks: number; rangeStartTick: number; rangeEndTick: number },
): (NoteOn & { endTick: number })[] {
  const shift = tickMap.countInTicks - tickMap.rangeStartTick;
  return timeline.events
    .filter(
      (ev: SoundingEvent) =>
        ev.startTick >= tickMap.rangeStartTick &&
        ev.startTick < tickMap.rangeEndTick &&
        ev.members.some((id) => graded.has(id)),
    )
    .map((ev) => ({
      tick: ev.startTick + shift,
      key: ev.key,
      velocity: scaled(ev.velocity),
      endTick: ev.endTick + shift,
    }))
    .sort((a, b) => a.tick - b.tick || a.key - b.key);
}

const lowestFreeMelodicChannel = (timeline: PlaybackTimeline): number =>
  timeline.channels.findIndex(
    (c, i) => !c.used && i !== PERCUSSION_CHANNEL && i !== LIVE_CHANNEL && i !== METRONOME_CHANNEL,
  );

/** A SHA-256 over everything the worklet receives, so "the same schedule" means the same bytes. */
function digest(schedule: ScheduleMessage): string {
  const hash = createHash('sha256');
  hash.update(new Int32Array([schedule.ppq, schedule.endTick, schedule.orchestraMask ?? 0]));
  for (const array of [
    schedule.eventTick,
    schedule.eventKind,
    schedule.eventChannel,
    schedule.eventData1,
    schedule.eventData2,
    schedule.tempoTick,
    schedule.tempoQpmNum,
    schedule.tempoQpmDen,
    schedule.channelSetup,
  ]) {
    hash.update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
  }
  return hash.digest('hex');
}

const MELODY = 'eight-measure-melody.musicxml';

// The `guide: false` schedule of MELODY with every note graded, captured on the code as it was before `compilePlaySchedule` knew
// the guide (commit 302bdaa, after FR-015): the graded notes dropped, the Metronome, the tempo map and the setup as they are.
const GUIDE_FALSE_MELODY_DIGEST = '95af45562aa03416885b17496c780e3e47662b77873be7a741468abbe36d4eea';

describe('compilePlaySchedule with the Guide voice (feature 020, guide-voice.md section 2)', () => {
  const melody = loadFixture(MELODY);
  const allGraded = gradedOf(melody, bothHands(melody));
  const guided = compilePlaySchedule(melody.timeline, melody.score.measures, options({ gradedNoteIds: allGraded }));

  it('every note of the melody is graded (29 notes), so the tests below are about all of them', () => {
    expect(allGraded.size).toBe(melody.score.parts[0]?.notes.length);
    expect(allGraded.size).toBe(29);
  });

  it('the guide channel is the lowest unused melodic channel, set up with GUIDE_PROGRAM and the default volume and pan', () => {
    const channel = lowestFreeMelodicChannel(melody.timeline);
    expect(channel).toBe(1); // the piano is on channel 0
    expect(guided.guideChannel).toBe(channel);
    const { channelSetup } = guided.schedule;
    expect([...channelSetup.subarray(channel * 4, channel * 4 + 4)]).toEqual([1, GUIDE_PROGRAM, 0, 0]);
    expect(controllerAtZero(guided.schedule, channel, 7)).toBe(DEFAULT_CHANNEL_VOLUME);
    expect(controllerAtZero(guided.schedule, channel, 10)).toBe(DEFAULT_CHANNEL_PAN);
  });

  it('the guide channel is in orchestraMask, so the Orchestra level governs it, and no other channel is', () => {
    expect(guided.schedule.orchestraMask).toBe(1 << (guided.guideChannel as number));
  });

  it('each graded event appears once on the guide channel: key unchanged, velocity scaled, ticks shifted by the run', () => {
    const channel = guided.guideChannel as number;
    const expected = expectedGuide(melody.timeline, allGraded, guided.tickMap);
    expect(expected).toHaveLength(29);
    expect(noteOns(guided.schedule, channel)).toEqual(
      expected.map(({ tick, key, velocity }) => ({ tick, key, velocity })),
    );
    for (const ev of expected) expect(noteOffTicks(guided.schedule, channel, ev.key)).toContain(ev.endTick);
  });

  it('no graded event remains on its own channel', () => {
    expect(noteOns(guided.schedule, 0)).toEqual([]);
  });

  it('no guide note-on starts before the count-in is over', () => {
    const ticks = noteOns(guided.schedule, guided.guideChannel as number).map((n) => n.tick);
    expect(guided.tickMap.countInTicks).toBeGreaterThan(0);
    expect(Math.min(...ticks)).toBe(guided.tickMap.countInTicks); // the first note is on the first beat of the run
  });

  it('with a range only the graded events inside the range are guided', () => {
    const from = melody.timeline.passes.findIndex((p) => p.measureIndex === 2);
    const ranged = compilePlaySchedule(
      melody.timeline,
      melody.score.measures,
      options({ gradedNoteIds: allGraded, range: { fromPassIndex: from, toPassIndex: from + 2 } }),
    );
    const expected = expectedGuide(melody.timeline, allGraded, ranged.tickMap);
    expect(expected).toHaveLength(8); // measures 3 and 4
    const guide = noteOns(ranged.schedule, ranged.guideChannel as number);
    expect(guide).toEqual(expected.map(({ tick, key, velocity }) => ({ tick, key, velocity })));
    expect(guide[0]?.tick).toBe(ranged.tickMap.countInTicks);
  });

  it('a tied note is one guide note for its full tied length', () => {
    const tie = loadFixture('tie-across-barline.musicxml');
    const graded = gradedOf(tie, bothHands(tie));
    const run = compilePlaySchedule(tie.timeline, tie.score.measures, options({ gradedNoteIds: graded }));
    const channel = run.guideChannel as number;
    const guide = noteOns(run.schedule, channel);
    expect(guide).toHaveLength(1);
    const [only] = expectedGuide(tie.timeline, graded, run.tickMap);
    expect(only).toBeDefined();
    expect((only?.endTick ?? 0) - (only?.tick ?? 0)).toBe(8 * tie.timeline.ppq); // two tied whole notes
    expect(noteOffTicks(run.schedule, channel, guide[0]?.key as number)).toEqual([only?.endTick]);
  });

  it('a chord gives simultaneous guide note-ons', () => {
    const chord = loadFixture('chord-basic.musicxml');
    const graded = gradedOf(chord, bothHands(chord));
    const run = compilePlaySchedule(chord.timeline, chord.score.measures, options({ gradedNoteIds: graded }));
    const guide = noteOns(run.schedule, run.guideChannel as number);
    expect(guide.map((n) => n.key)).toEqual([60, 64, 67]);
    expect(new Set(guide.map((n) => n.tick)).size).toBe(1);
  });
});

describe("the Guide voice follows the musician's choice of hand and the Accompaniment setting (rule 3)", () => {
  const hands = loadFixture('hands-accompaniment.musicxml'); // right hand E5 F5 G5; left hand C3 D3 E3 on the same piano channel
  const right = gradedOf(hands, RIGHT);
  const LEFT_KEYS = [48, 50, 52];
  const RIGHT_KEYS = [76, 77, 79];
  const run = (accompaniment: boolean, guide = true) =>
    compilePlaySchedule(hands.timeline, hands.score.measures, options({ gradedNoteIds: right, accompaniment, guide }));

  it('with only the right hand graded, only right-hand events are guided', () => {
    const guided = run(true);
    expect(noteOns(guided.schedule, guided.guideChannel as number).map((n) => n.key)).toEqual(RIGHT_KEYS);
  });

  it('with accompaniment on the left hand stays on its own channel, unchanged', () => {
    const guided = run(true);
    const unguided = run(true, false);
    expect(noteOns(guided.schedule, 0).map((n) => n.key)).toEqual(LEFT_KEYS);
    expect(noteOns(guided.schedule, 0)).toEqual(noteOns(unguided.schedule, 0));
  });

  it('with accompaniment off the left hand is absent and the guide events are still there', () => {
    const guided = run(false);
    expect(noteOns(guided.schedule, 0)).toEqual([]);
    expect(noteOns(guided.schedule, guided.guideChannel as number).map((n) => n.key)).toEqual(RIGHT_KEYS);
  });

  it('the accompaniment is never copied to the guide channel', () => {
    const guided = run(true);
    const guideKeys = noteOns(guided.schedule, guided.guideChannel as number).map((n) => n.key);
    for (const key of LEFT_KEYS) expect(guideKeys).not.toContain(key);
  });
});

describe('when a run gets no Guide voice (rule 6)', () => {
  it('a Score with an Orchestra: guideChannel is null and the schedule equals the guide: false one', () => {
    const loaded = loadFixture('orchestra/piano-and-oboe.musicxml');
    const graded = gradedOf(loaded, RIGHT);
    expect(graded.size).toBeGreaterThan(0);
    const on = compilePlaySchedule(loaded.timeline, loaded.score.measures, options({ gradedNoteIds: graded }));
    const off = compilePlaySchedule(
      loaded.timeline,
      loaded.score.measures,
      options({ gradedNoteIds: graded, guide: false }),
    );
    expect(on.guideChannel).toBeNull();
    expect(on.schedule).toEqual(off.schedule);
    expect(digest(on.schedule)).toBe(digest(off.schedule));
  });

  it('the real Morning Mood (SC-005): guideChannel is null and the schedule equals the guide: false one', () => {
    const loaded = loadLibrary('repertoire/advanced/grieg-morning-mood.musicxml');
    expect(loaded.timeline.channels.some((c) => c.used && c.orchestra)).toBe(true);
    const graded = gradedOf(loaded, bothHands(loaded));
    expect(graded.size).toBeGreaterThan(0);
    const on = compilePlaySchedule(loaded.timeline, loaded.score.measures, options({ gradedNoteIds: graded }));
    const off = compilePlaySchedule(
      loaded.timeline,
      loaded.score.measures,
      options({ gradedNoteIds: graded, guide: false }),
    );
    expect(on.guideChannel).toBeNull();
    expect(digest(on.schedule)).toBe(digest(off.schedule));
  });

  it('an Orchestra part with no playable instrument counts as none: the run gets a Guide voice', () => {
    const loaded = loadFixture('orchestra/orchestra-no-program.musicxml');
    expect(loaded.timeline.channels.some((c) => c.used && c.orchestra)).toBe(false); // nothing to play for the Orchestra part
    const graded = gradedOf(loaded, RIGHT);
    expect(graded.size).toBeGreaterThan(0);
    const run = compilePlaySchedule(loaded.timeline, loaded.score.measures, options({ gradedNoteIds: graded }));
    expect(run.guideChannel).toBe(lowestFreeMelodicChannel(loaded.timeline));
    expect(noteOns(run.schedule, run.guideChannel as number).length).toBe(
      expectedGuide(loaded.timeline, graded, run.tickMap).length,
    );
  });

  it('every melodic channel in use: guideChannel is null and the schedule equals the guide: false one', () => {
    const melody = loadFixture(MELODY);
    const channels: ChannelSetup[] = melody.timeline.channels.map((c, i) =>
      i === PERCUSSION_CHANNEL || i === LIVE_CHANNEL || i === METRONOME_CHANNEL ? c : { ...c, used: true, program: i },
    );
    const full = { ...melody.timeline, channels };
    expect(lowestFreeMelodicChannel(full)).toBe(-1);
    const graded = gradedOf(melody, bothHands(melody));
    const on = compilePlaySchedule(full, melody.score.measures, options({ gradedNoteIds: graded }));
    const off = compilePlaySchedule(full, melody.score.measures, options({ gradedNoteIds: graded, guide: false }));
    expect(on.guideChannel).toBeNull();
    expect(digest(on.schedule)).toBe(digest(off.schedule));
  });

  it('nothing graded: there is nothing to guide, no channel is taken', () => {
    const melody = loadFixture(MELODY);
    const run = compilePlaySchedule(melody.timeline, melody.score.measures, options());
    expect(run.guideChannel).toBeNull();
    expect(run.schedule.orchestraMask).toBe(0);
  });

  it('guide: false gives guideChannel null and the same bytes as before this feature, however much is graded', () => {
    const melody = loadFixture(MELODY);
    const graded = gradedOf(melody, bothHands(melody));
    const run = compilePlaySchedule(
      melody.timeline,
      melody.score.measures,
      options({ gradedNoteIds: graded, guide: false }),
    );
    expect(run.guideChannel).toBeNull();
    // Pinned from the schedule compiled after FR-015 (Phase 3) and before the guide existed: the graded notes are dropped and
    // nothing else moves. A change here means `guide: false` is no longer today's behaviour.
    expect(digest(run.schedule)).toBe(GUIDE_FALSE_MELODY_DIGEST);
    expect(noteOns(run.schedule, 0)).toEqual([]);
  });

  it('compiling twice gives byte-equal schedules (rule 5)', () => {
    const melody = loadFixture(MELODY);
    const graded = gradedOf(melody, bothHands(melody));
    const a = compilePlaySchedule(melody.timeline, melody.score.measures, options({ gradedNoteIds: graded }));
    const b = compilePlaySchedule(melody.timeline, melody.score.measures, options({ gradedNoteIds: graded }));
    expect(a.schedule).toEqual(b.schedule);
    expect(digest(a.schedule)).toBe(digest(b.schedule));
  });
});

describe('the Guide voice on a real library item (AGENTS.md: check real files too)', () => {
  it('Greensleeves, both hands graded: one guide note per graded sounding event', () => {
    const loaded = loadLibrary('repertoire/beginner/greensleeves.musicxml');
    expect(loaded.timeline.channels.some((c) => c.used && c.orchestra)).toBe(false);
    const graded = gradedOf(loaded, bothHands(loaded));
    const run = compilePlaySchedule(loaded.timeline, loaded.score.measures, options({ gradedNoteIds: graded }));
    const expected = expectedGuide(loaded.timeline, graded, run.tickMap);
    expect(expected.length).toBeGreaterThan(20);
    expect(run.guideChannel).not.toBeNull();
    expect(noteOns(run.schedule, run.guideChannel as number)).toEqual(
      expected.map(({ tick, key, velocity }) => ({ tick, key, velocity })),
    );
  });
});
