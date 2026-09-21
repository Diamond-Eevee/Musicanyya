import { describe, expect, it } from 'vitest';
import { LIVE_CHANNEL, METRONOME_CHANNEL } from '../../../src/core/defaults.js';
import type { PerformanceLog } from '../../../src/core/grade/types.js';
import { compileReplay } from '../../../src/core/play/replay.js';
import { compilePlaySchedule } from '../../../src/core/schedule/play-schedule.js';
import { audioTimeAtTick } from '../../../src/core/tempo/rate.js';
import type { TempoSegment } from '../../../src/core/timeline/types.js';
import { loadFixture } from '../practice/helpers.js';

const METRONOME = { beatKey: 77, downbeatKey: 76, beatVelocity: 88, downbeatVelocity: 110 };

/** Same conversion `PlaySessionController` uses (contracts/grading.md step 1): the compiled schedule's own tempo
 *  map, in run-tick space (0 = count-in start), not `PlaybackTimeline.tempo`. */
function runTempoOf(schedule: {
  tempoTick: Int32Array;
  tempoQpmNum: Int32Array;
  tempoQpmDen: Int32Array;
}): TempoSegment[] {
  return Array.from(schedule.tempoTick, (_, i) => ({
    startTick: schedule.tempoTick[i] as number,
    qpmNum: schedule.tempoQpmNum[i] as number,
    qpmDen: schedule.tempoQpmDen[i] as number,
  }));
}

function eventsOnChannel(
  schedule: {
    eventTick: Int32Array;
    eventKind: Uint8Array;
    eventChannel: Uint8Array;
    eventData1: Uint8Array;
    eventData2: Uint8Array;
  },
  channel: number,
): { tick: number; kind: number; key: number; velocity: number }[] {
  const result: { tick: number; kind: number; key: number; velocity: number }[] = [];
  for (let i = 0; i < schedule.eventTick.length; i++) {
    if (schedule.eventChannel[i] === channel) {
      result.push({
        tick: schedule.eventTick[i] as number,
        kind: schedule.eventKind[i] as number,
        key: schedule.eventData1[i] as number,
        velocity: schedule.eventData2[i] as number,
      });
    }
  }
  return result;
}

describe('Replay (FR-042, research R-10) - a stored log compiles to a schedule, never a timer', () => {
  it('places recorded notes on the live channel at the recorded times, merged with the accompaniment', () => {
    const { score, timeline } = loadFixture('eight-measure-melody.musicxml');
    const { schedule } = compilePlaySchedule(timeline, score.measures, {
      range: null,
      gradedNoteIds: new Set(),
      accompaniment: true,
      countInMeasures: 1,
      tempoPercent: 100,
      metronome: METRONOME,
    });
    const runTempo = runTempoOf(schedule);

    // Two notes at known run ticks, converted to the audio-clock seconds a real run would have recorded
    // (research R-20: a stored log is already run-relative, so startAudioTimeSec is 0 here).
    const firstOnTick = 500;
    const firstOffTick = 700;
    const secondOnTick = 1200;
    const secondOffTick = 1400;
    const toSeconds = (tick: number) => audioTimeAtTick(tick, runTempo, timeline.ppq, 100);

    const log: PerformanceLog = {
      version: 1,
      messages: [
        {
          kind: 'noteOn',
          key: 60,
          velocity: 91,
          down: false,
          audioTimeSec: toSeconds(firstOnTick),
          timeStampMs: 0,
          deviceId: 'd',
        },
        {
          kind: 'noteOff',
          key: 60,
          velocity: 0,
          down: false,
          audioTimeSec: toSeconds(firstOffTick),
          timeStampMs: 0,
          deviceId: 'd',
        },
        {
          kind: 'noteOn',
          key: 64,
          velocity: 55,
          down: false,
          audioTimeSec: toSeconds(secondOnTick),
          timeStampMs: 0,
          deviceId: 'd',
        },
        {
          kind: 'sustain',
          key: 0,
          velocity: 0,
          down: true,
          audioTimeSec: toSeconds(secondOnTick),
          timeStampMs: 0,
          deviceId: 'd',
        },
        {
          kind: 'noteOff',
          key: 64,
          velocity: 0,
          down: false,
          audioTimeSec: toSeconds(secondOffTick),
          timeStampMs: 0,
          deviceId: 'd',
        },
      ],
      droppedMessages: 0,
    };

    const replay = compileReplay({
      log,
      tempo: runTempo,
      ppq: timeline.ppq,
      tempoPercent: 100,
      startAudioTimeSec: 0,
      accompaniment: schedule,
    });

    expect(replay.ppq).toBe(schedule.ppq);

    // The recorded notes land, as noteOn/noteOff pairs, at exactly the recorded (run-relative) ticks. (kind 2 is
    // the live channel's own programChange at tick 0, asserted on separately below.)
    const live = eventsOnChannel(replay, LIVE_CHANNEL)
      .filter((e) => e.kind === 0 || e.kind === 1)
      .sort((a, b) => a.tick - b.tick || a.kind - b.kind);
    expect(live).toEqual([
      { tick: firstOnTick, kind: 1, key: 60, velocity: 91 },
      { tick: firstOffTick, kind: 0, key: 60, velocity: 0 },
      { tick: secondOnTick, kind: 1, key: 64, velocity: 55 },
      { tick: secondOffTick, kind: 0, key: 64, velocity: 0 },
    ]);

    // Sustain never claims, satisfies or excuses a note (FR-023) - it is not something the schedule replays either.
    expect(live.some((e) => e.key === 0)).toBe(false);

    // The accompaniment the run used (here, the Metronome's clicks) is carried over unchanged.
    const originalMetronome = eventsOnChannel(schedule, METRONOME_CHANNEL);
    const replayMetronome = eventsOnChannel(replay, METRONOME_CHANNEL);
    expect(originalMetronome.length).toBeGreaterThan(0);
    expect(replayMetronome).toEqual(originalMetronome);

    // The live channel is marked used, with the ordinary default (Acoustic Grand Piano) instrument.
    expect(replay.channelSetup[LIVE_CHANNEL * 4]).toBe(1);
    expect(replay.channelSetup[LIVE_CHANNEL * 4 + 1]).toBe(0);

    // Pure and synchronous - no timer anywhere (Constitution I): the same input always compiles to the same
    // schedule, byte for byte.
    const again = compileReplay({
      log,
      tempo: runTempo,
      ppq: timeline.ppq,
      tempoPercent: 100,
      startAudioTimeSec: 0,
      accompaniment: schedule,
    });
    expect(Array.from(again.eventTick)).toEqual(Array.from(replay.eventTick));
    expect(Array.from(again.eventKind)).toEqual(Array.from(replay.eventKind));
    expect(Array.from(again.eventChannel)).toEqual(Array.from(replay.eventChannel));
    expect(Array.from(again.eventData1)).toEqual(Array.from(replay.eventData1));
    expect(Array.from(again.eventData2)).toEqual(Array.from(replay.eventData2));
  });

  it('drops a note-off with no matching note-on, and a zero-length retrigger, without throwing', () => {
    const { score, timeline } = loadFixture('eight-measure-melody.musicxml');
    const { schedule } = compilePlaySchedule(timeline, score.measures, {
      range: null,
      gradedNoteIds: new Set(),
      accompaniment: true,
      countInMeasures: 1,
      tempoPercent: 100,
      metronome: METRONOME,
    });
    const runTempo = runTempoOf(schedule);
    const toSeconds = (tick: number) => audioTimeAtTick(tick, runTempo, timeline.ppq, 100);

    const log: PerformanceLog = {
      version: 1,
      messages: [
        // An orphan note-off (e.g. a dropped note-on) - dropped, never thrown.
        {
          kind: 'noteOff',
          key: 62,
          velocity: 0,
          down: false,
          audioTimeSec: toSeconds(100),
          timeStampMs: 0,
          deviceId: 'd',
        },
        // A velocity-0 "noteOn" is a noteOff (contracts/grading.md step 3) - it never opens a note.
        {
          kind: 'noteOn',
          key: 65,
          velocity: 0,
          down: false,
          audioTimeSec: toSeconds(200),
          timeStampMs: 0,
          deviceId: 'd',
        },
      ],
      droppedMessages: 0,
    };

    const replay = compileReplay({
      log,
      tempo: runTempo,
      ppq: timeline.ppq,
      tempoPercent: 100,
      startAudioTimeSec: 0,
      accompaniment: schedule,
    });

    expect(eventsOnChannel(replay, LIVE_CHANNEL)).toEqual([]);
  });
});
