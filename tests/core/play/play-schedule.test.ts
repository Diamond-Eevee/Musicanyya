import { describe, expect, it } from 'vitest';
import {
  METRONOME_CHANNEL,
  METRONOME_KEY_BEAT,
  METRONOME_KEY_DOWNBEAT,
  METRONOME_VELOCITY_BEAT,
  METRONOME_VELOCITY_DOWNBEAT,
} from '../../../src/core/defaults.js';
import type { PlayScheduleOptions } from '../../../src/core/play/types.js';
import { EVENT_KIND } from '../../../src/core/schedule/compile.js';
import { compilePlaySchedule } from '../../../src/core/schedule/play-schedule.js';
import type { MeasureInfo } from '../../../src/core/score/model.js';
import type { ChannelSetup, PlaybackTimeline, SoundingEvent } from '../../../src/core/timeline/types.js';
import { loadFixture } from '../practice/helpers.js';

const METRONOME = {
  beatKey: METRONOME_KEY_BEAT,
  downbeatKey: METRONOME_KEY_DOWNBEAT,
  beatVelocity: METRONOME_VELOCITY_BEAT,
  downbeatVelocity: METRONOME_VELOCITY_DOWNBEAT,
};

function baseOptions(overrides: Partial<PlayScheduleOptions> = {}): PlayScheduleOptions {
  return {
    range: null,
    gradedNoteIds: new Set(),
    accompaniment: true,
    countInMeasures: 1,
    tempoPercent: 100,
    metronome: METRONOME,
    ...overrides,
  };
}

/** Note-on keys, excluding the Metronome channel unless `includeMetronome` is set. */
function noteOnKeys(schedule: ReturnType<typeof compilePlaySchedule>['schedule'], includeMetronome = false): number[] {
  const keys: number[] = [];
  for (let i = 0; i < schedule.eventKind.length; i++) {
    if (schedule.eventKind[i] !== EVENT_KIND.noteOn) continue;
    if (!includeMetronome && schedule.eventChannel[i] === METRONOME_CHANNEL) continue;
    keys.push(schedule.eventData1[i]!);
  }
  return keys;
}

function metronomeTicks(
  schedule: ReturnType<typeof compilePlaySchedule>['schedule'],
): { tick: number; downbeat: boolean }[] {
  const out: { tick: number; downbeat: boolean }[] = [];
  for (let i = 0; i < schedule.eventKind.length; i++) {
    if (schedule.eventKind[i] !== EVENT_KIND.noteOn) continue;
    if (schedule.eventChannel[i] !== METRONOME_CHANNEL) continue;
    out.push({ tick: schedule.eventTick[i]!, downbeat: schedule.eventData1[i] === METRONOME_KEY_DOWNBEAT });
  }
  return out.sort((a, b) => a.tick - b.tick);
}

function emptyChannels(): ChannelSetup[] {
  return Array.from({ length: 16 }, () => ({
    used: false,
    program: 0,
    bankMsb: 0,
    percussion: false,
    volume: null,
    pan: null,
  }));
}

function syntheticTimeline(overrides: Partial<PlaybackTimeline> = {}): PlaybackTimeline {
  return {
    ppq: 960,
    endTick: 1920,
    passes: [{ measureIndex: 0, passNo: 1, startTick: 0, lengthTicks: 1920 }],
    events: [],
    spans: [],
    tempo: [{ startTick: 0, qpmNum: 12000, qpmDen: 100 }],
    channels: emptyChannels(),
    leadInTicks: 0,
    ...overrides,
  };
}

function syntheticEvent(overrides: Partial<SoundingEvent> = {}): SoundingEvent {
  return {
    head: { noteId: 'n1', passIndex: 0 },
    members: ['n1'],
    part: 0,
    channel: 0,
    key: 60,
    velocity: 80,
    startTick: 0,
    endTick: 480,
    ...overrides,
  };
}

describe('compilePlaySchedule', () => {
  it('drops graded notes from the schedule and keeps the accompaniment (FR-005)', () => {
    const { score, timeline } = loadFixture('anacrusis-count-in.musicxml');
    // measure 1's notes: C4=60, D4=62, E4=64, F4=65 (in written order)
    const gradedNote = score.parts[0]!.notes.find((n) => n.measureIndex === 1 && n.step === 'C');
    expect(gradedNote).toBeDefined();

    const { schedule } = compilePlaySchedule(
      timeline,
      score.measures,
      baseOptions({ gradedNoteIds: new Set([gradedNote!.id]) }),
    );

    const keys = noteOnKeys(schedule);
    expect(keys).not.toContain(60); // C4 dropped
    expect(keys).toEqual(expect.arrayContaining([67, 69, 62, 64, 65])); // G4, A4 (pickup) + D4, E4, F4 kept
  });

  it('silences everything but the Metronome when accompaniment is false', () => {
    const { score, timeline } = loadFixture('anacrusis-count-in.musicxml');
    const { schedule } = compilePlaySchedule(timeline, score.measures, baseOptions({ accompaniment: false }));

    // Every note-on in the compiled schedule is on the Metronome channel; nothing of the Score sounds.
    let noteOnCount = 0;
    for (let i = 0; i < schedule.eventKind.length; i++) {
      if (schedule.eventKind[i] !== EVENT_KIND.noteOn) continue;
      noteOnCount++;
      expect(schedule.eventChannel[i]).toBe(METRONOME_CHANNEL);
    }
    expect(noteOnCount).toBeGreaterThan(0); // the Metronome itself still plays
  });

  it('slices events to the requested range and shifts them by the count-in (FR-036)', () => {
    const { score, timeline } = loadFixture('range-start-mid-measure-rests.musicxml');
    // Range = measure index 1 ("measure 2"), the single pass covering it.
    const passIndex = timeline.passes.findIndex((p) => p.measureIndex === 1);
    expect(passIndex).toBeGreaterThanOrEqual(0);

    const { schedule, tickMap } = compilePlaySchedule(
      timeline,
      score.measures,
      baseOptions({ range: { fromPassIndex: passIndex, toPassIndex: passIndex + 1 } }),
    );

    // Only measure 2's notes (G4=67, A4=69) should be scheduled - not measure 1's or measure 3's.
    const keys = noteOnKeys(schedule);
    expect(keys.sort()).toEqual([67, 69]);

    // The count-in ends on measure 2's downbeat: the leading two beats of rest still push the first note two
    // beats past countInTicks, the count-in itself must not slide forward to meet it.
    const firstNoteTick = Math.min(
      ...Array.from(schedule.eventTick).filter(
        (_, i) => schedule.eventKind[i] === EVENT_KIND.noteOn && schedule.eventChannel[i] !== METRONOME_CHANNEL,
      ),
    );
    expect(firstNoteTick).toBe(tickMap.countInTicks + 2 * timeline.ppq);
  });

  it('lasts at least one whole measure and at least COUNT_IN_MIN_SECONDS, with the downbeat accented (FR-003)', () => {
    const { score, timeline } = loadFixture('window-beat-unit-6-8.musicxml');
    const { tickMap, schedule } = compilePlaySchedule(timeline, score.measures, baseOptions());

    const clicks = metronomeTicks(schedule);
    expect(clicks.length).toBeGreaterThan(0);
    expect(clicks[0]!.tick).toBe(0);
    expect(clicks[0]!.downbeat).toBe(true);
    // 6/8 clicks in dotted beats (2 per measure): the second click must not be accented.
    expect(clicks.some((c) => !c.downbeat)).toBe(true);
    // At dotted-quarter = 60 (sound tempo 90 qpm), one measure is exactly 2 seconds - the floor, not more.
    expect(tickMap.countInTicks).toBe((timeline.ppq * 4 * 6) / 8);
  });

  it("clicks a pickup's missing beats after the count-in measures, on their own beat (R-16)", () => {
    const { score, timeline } = loadFixture('anacrusis-count-in.musicxml');
    const { tickMap, schedule } = compilePlaySchedule(timeline, score.measures, baseOptions());

    // The count-in part of the click track (009 T057: the run's own clicks follow it, tested below).
    const clicks = metronomeTicks(schedule).filter((c) => c.tick < tickMap.countInTicks);
    // 1 full measure of count-in (4 beats) + 2 pickup beats = 6 clicks; only the very first is a downbeat.
    expect(clicks).toHaveLength(6);
    expect(clicks.filter((c) => c.downbeat)).toHaveLength(1);
    expect(clicks[0]!.tick).toBe(0);
    expect(clicks[5]!.tick).toBe(5 * timeline.ppq);

    // The pickup (G4, A4) lands right where the count-in ends, at its own beat of the click.
    const pickupTicks = Array.from(schedule.eventTick).filter(
      (_, i) => schedule.eventKind[i] === EVENT_KIND.noteOn && schedule.eventChannel[i] !== METRONOME_CHANNEL,
    );
    expect(Math.min(...pickupTicks)).toBe(tickMap.countInTicks);
    expect(tickMap.countInTicks).toBe(6 * timeline.ppq);
  });

  it('sizes the count-in against the tempo actually played, not the nominal tempo (FR-037)', () => {
    const { score, timeline } = loadFixture('window-beat-unit-6-8.musicxml');
    // At 100%, one measure of this fixture is exactly the 2-second floor (see the test above).
    const at100 = compilePlaySchedule(timeline, score.measures, baseOptions({ tempoPercent: 100 }));
    expect(at100.tickMap.countInTicks).toBe((timeline.ppq * 4 * 6) / 8);

    // At double speed the same tick span plays in half the real time, so it must no longer clear the floor and
    // the count-in must grow to a second measure.
    const at200 = compilePlaySchedule(timeline, score.measures, baseOptions({ tempoPercent: 200 }));
    expect(at200.tickMap.countInTicks).toBe(2 * at100.tickMap.countInTicks);
  });

  it('never emits a Score event on METRONOME_CHANNEL (R-19)', () => {
    const timeline = syntheticTimeline({ events: [syntheticEvent({ channel: METRONOME_CHANNEL })] });
    expect(() => compilePlaySchedule(timeline, [], baseOptions())).toThrow(/METRONOME_CHANNEL/);
  });
});

// 009 T056: a Score without <time> has measures with nominalTicks 0; the count-in loop once could not grow a zero-length
// measure and never returned (found by tests/core/schedule/setup-events.test.ts, which compiles every fixture).
describe('compilePlaySchedule on a Score without a time signature (009 T056)', () => {
  it('terminates and counts in whole default 4/4 measures lasting at least COUNT_IN_MIN_SECONDS, downbeat every 4th click', () => {
    const { score, timeline } = loadFixture('backup-forward-two-voices.musicxml');
    expect(score.measures[0]?.time).toBeNull();
    expect(score.measures[0]?.nominalTicks).toBe(0);

    const { schedule, tickMap } = compilePlaySchedule(timeline, score.measures, baseOptions());

    const measureTicks = 4 * timeline.ppq; // no time signature: beatTicksAt / beatsPerMeasure default to 4 quarters
    expect(tickMap.countInTicks % measureTicks).toBe(0);
    expect(tickMap.countInTicks).toBeGreaterThan(0);
    // 100 qpm by default (Score without a tempo), so one 4/4 measure lasts 2.4 s: one measure already covers 2 s
    expect(tickMap.countInTicks).toBe(measureTicks);

    const clicks = metronomeTicks(schedule).filter((c) => c.tick < tickMap.countInTicks);
    expect(clicks.map((c) => c.tick)).toEqual([0, 960, 1920, 2880]);
    expect(clicks.map((c) => c.downbeat)).toEqual([true, false, false, false]);
  });
});

// 009 T057 (research B-9, R-14; FR-009, FR-010, FR-011, SC-002): the Metronome clicks for the whole run, not only the
// count-in - one click per beat of every pass in range, the first beat of each measure accented.
describe('compilePlaySchedule clicks every beat of the run (009 T057)', () => {
  /** The run's clicks, as ticks relative to the end of the count-in, with their accent. */
  function runClicks(fixture: string, overrides: Partial<PlayScheduleOptions> = {}) {
    const { score, timeline } = loadFixture(fixture);
    const { schedule, tickMap } = compilePlaySchedule(timeline, score.measures, baseOptions(overrides));
    const all = metronomeTicks(schedule);
    return {
      score,
      timeline,
      schedule,
      tickMap,
      all,
      countIn: all.filter((c) => c.tick < tickMap.countInTicks),
      run: all
        .filter((c) => c.tick >= tickMap.countInTicks)
        .map((c) => ({ ...c, tick: c.tick - tickMap.countInTicks })),
    };
  }
  const beats = (n: number, ppq: number, first = 0) => Array.from({ length: n }, (_, i) => (first + i) * ppq);

  it("(a) 4/4: one click per beat of every measure at countInTicks + k * beat, the first beat of each measure accented, the first click on the count-in's downbeat", () => {
    const { timeline, score, run, tickMap } = runClicks('eight-measure-melody.musicxml');
    expect(score.measures[0]?.time).toEqual({ beats: '4', beatType: 4 }); // written once, in force to the end
    expect(score.measures.slice(1).every((m) => m.time === null)).toBe(true);
    const measures = timeline.passes.length;
    expect(run.map((c) => c.tick)).toEqual(beats(measures * 4, timeline.ppq));
    expect(run.map((c) => c.downbeat)).toEqual(Array.from({ length: measures * 4 }, (_, i) => i % 4 === 0));
    expect(run[0]?.tick).toBe(0); // at run tick countInTicks: the downbeat that ends the count-in
    expect(tickMap.countInTicks).toBeGreaterThan(0);
  });

  it('(b) each measure clicks in its own meter: 3/4 after 4/4, and dotted beats in 6/8', () => {
    const change = runClicks('meter-change.musicxml');
    const ppq = change.timeline.ppq;
    expect(change.run.map((c) => c.tick)).toEqual(beats(7, ppq)); // 4 beats of 4/4, then 3 of 3/4
    expect(change.run.map((c) => c.downbeat)).toEqual([true, false, false, false, true, false, false]);

    const compound = runClicks('window-beat-unit-6-8.musicxml');
    expect(compound.run.map((c) => c.tick)).toEqual([0, (3 * compound.timeline.ppq) / 2]); // dotted quarter beats
    expect(compound.run.map((c) => c.downbeat)).toEqual([true, false]);
  });

  it("(c) a pickup starts on its own beat: its first click is not accented, the next measure's first beat is", () => {
    const { timeline, run } = runClicks('anacrusis-count-in.musicxml');
    // the pickup's 2 beats, then 4 beats of measure 1
    expect(run.map((c) => c.tick)).toEqual(beats(6, timeline.ppq));
    expect(run.map((c) => c.downbeat)).toEqual([false, false, true, false, false, false]);
  });

  it('(d) a repeated measure clicks again on its second pass, downbeat accented', () => {
    const { timeline, run } = runClicks('repeat-simple.musicxml');
    expect(timeline.passes.map((p) => p.measureIndex)).toEqual([0, 1, 0, 1]);
    expect(run.map((c) => c.tick)).toEqual(beats(16, timeline.ppq));
    expect(run.map((c) => c.downbeat)).toEqual(Array.from({ length: 16 }, (_, i) => i % 4 === 0));
  });

  it('(e) a range clicks only its own passes, after the count-in', () => {
    const whole = runClicks('eight-measure-melody.musicxml');
    const ranged = runClicks('eight-measure-melody.musicxml', { range: { fromPassIndex: 2, toPassIndex: 4 } });
    expect(ranged.run.map((c) => c.tick)).toEqual(beats(8, ranged.timeline.ppq)); // measures 3 and 4 only
    expect(ranged.run.map((c) => c.downbeat)).toEqual([true, false, false, false, true, false, false, false]);
    expect(ranged.all).toHaveLength(ranged.countIn.length + 8);
    expect(ranged.all.length).toBeLessThan(whole.all.length);
    // the count-in is what it was
    expect(ranged.countIn.map((c) => c.downbeat)).toEqual(whole.countIn.map((c) => c.downbeat));
  });

  it('(f) turning the accompaniment off or grading every note does not remove a click', () => {
    const plain = runClicks('eight-measure-melody.musicxml');
    const silent = runClicks('eight-measure-melody.musicxml', { accompaniment: false });
    const allGraded = runClicks('eight-measure-melody.musicxml', {
      gradedNoteIds: new Set(plain.timeline.events.flatMap((e) => e.members)),
    });
    expect(silent.all).toEqual(plain.all);
    expect(allGraded.all).toEqual(plain.all);
  });

  it('(g) no click at or after the end of the run', () => {
    const { schedule, all } = runClicks('eight-measure-melody.musicxml');
    const lastClick = Math.max(...all.map((c) => c.tick));
    expect(lastClick + 1).toBeLessThanOrEqual(schedule.endTick); // the click's own note-off is inside the run too
  });

  it('(h) the count-in clicks are what they were: one measure of four beats, the first accented', () => {
    const { countIn, timeline } = runClicks('eight-measure-melody.musicxml');
    expect(countIn.map((c) => c.tick).slice(0, 4)).toEqual(beats(4, timeline.ppq));
    expect(countIn.map((c) => c.downbeat).slice(0, 4)).toEqual([true, false, false, false]);
    expect(countIn.length % 4).toBe(0);
  });

  it('(i) a measure without its own <time> clicks in the meter in force, also when the range starts in it', () => {
    const measure = (index: number, time: MeasureInfo['time']): MeasureInfo => ({
      index,
      id: `m${index}`,
      label: String(index + 1),
      startTick: index * 2880,
      lengthTicks: 2880,
      nominalTicks: 2880,
      implicit: false,
      beatOffsetTicks: 0,
      time,
    });
    const measures = [measure(0, { beats: '3', beatType: 4 }), measure(1, null), measure(2, null)];
    const timeline = syntheticTimeline({
      endTick: 3 * 2880,
      passes: [0, 1, 2].map((i) => ({ measureIndex: i, passNo: 1, startTick: i * 2880, lengthTicks: 2880 })),
    });

    const whole = compilePlaySchedule(timeline, measures, baseOptions());
    const run = metronomeTicks(whole.schedule).filter((c) => c.tick >= whole.tickMap.countInTicks);
    expect(run.map((c) => c.tick - whole.tickMap.countInTicks)).toEqual([
      0, 960, 1920, 2880, 3840, 4800, 5760, 6720, 7680,
    ]);
    expect(run.map((c) => c.downbeat)).toEqual([true, false, false, true, false, false, true, false, false]);

    // a range that starts in measure 3, which writes no <time>: the count-in is three beats a measure too
    const ranged = compilePlaySchedule(
      timeline,
      measures,
      baseOptions({ range: { fromPassIndex: 2, toPassIndex: 3 } }),
    );
    const countIn = metronomeTicks(ranged.schedule).filter((c) => c.tick < ranged.tickMap.countInTicks);
    expect(ranged.tickMap.countInTicks % 2880).toBe(0);
    expect(countIn.map((c) => c.downbeat)).toEqual(countIn.map((_, i) => i % 3 === 0));
  });
});

// 009 constitution audit (III: a bad file never crashes or hangs): <beat-type> and <beats> come straight from the file, and
// the click loops step by the beat, so a negative, tiny or non-power-of-two denominator (or an absurd numerator) once meant a
// loop that never ended or a fractional tick. Such a meter is read as 4/4 (what `beatTicksAt` already answers for no <time>).
describe('compilePlaySchedule on a hostile time signature (009 audit)', () => {
  const measure = (index: number, time: MeasureInfo['time'], lengthTicks = 3840): MeasureInfo => ({
    index,
    id: `m${index}`,
    label: String(index + 1),
    startTick: index * lengthTicks,
    lengthTicks,
    nominalTicks: lengthTicks,
    implicit: false,
    beatOffsetTicks: 0,
    time,
  });
  const compile = (time: MeasureInfo['time'], passLength = 3840, nominal = 3840) => {
    const measures = [measure(0, time, nominal), measure(1, time, nominal)];
    const timeline = syntheticTimeline({
      ppq: 960,
      endTick: 2 * passLength,
      passes: [0, 1].map((i) => ({ measureIndex: i, passNo: 1, startTick: i * passLength, lengthTicks: passLength })),
    });
    return compilePlaySchedule(timeline, measures, baseOptions());
  };
  const clickTicks = (result: ReturnType<typeof compile>) => metronomeTicks(result.schedule);
  const reference = clickTicks(compile({ beats: '4', beatType: 4 }));

  for (const time of [
    { beats: '4', beatType: -4 },
    { beats: '4', beatType: 1_000_000 },
    { beats: '4', beatType: 7 },
    { beats: '4', beatType: 3 },
    { beats: '-3', beatType: 4 },
    { beats: '0', beatType: 4 },
    { beats: '1000000000', beatType: 4 },
    { beats: '4', beatType: Number.NaN },
  ]) {
    it(`reads ${time.beats}/${time.beatType} as 4/4: the same clicks, all on whole ticks, and it ends`, () => {
      const clicks = clickTicks(compile(time));
      expect(clicks).toEqual(reference);
      expect(clicks.every((c) => Number.isInteger(c.tick))).toBe(true);
    });
  }

  it('a measure of absurd length has a bounded number of clicks', () => {
    const clicks = clickTicks(compile({ beats: '4', beatType: 4 }, 960 * 100_000, 3840));
    expect(clicks.length).toBeLessThan(2000);
  });
});
