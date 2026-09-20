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

    const clicks = metronomeTicks(schedule);
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
