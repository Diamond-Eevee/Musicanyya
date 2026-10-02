import {
  CALIBRATION_BEATS,
  CALIBRATION_COUNT_IN_BEATS,
  CALIBRATION_TEMPO_QPM,
  CALIBRATION_WINDOW_BEATS,
  METRONOME_CHANNEL,
  METRONOME_KEY_BEAT,
  METRONOME_KEY_DOWNBEAT,
  METRONOME_VELOCITY_BEAT,
  METRONOME_VELOCITY_DOWNBEAT,
} from '../defaults.js';
import { compileSchedule, type ScheduleMessage } from '../schedule/compile.js';
import type { ChannelSetup, PlaybackTimeline, SoundingEvent } from '../timeline/types.js';

/** The calibration's own schedule (contracts/audio-setup.md section 2, research R-9). */
export interface CalibrationSchedule {
  /** Metronome-only: clicks on `METRONOME_CHANNEL`, played by the worklet like any schedule. */
  schedule: ScheduleMessage;
  /** Run-relative audio seconds of the `CALIBRATION_BEATS` counted clicks (the count-in clicks are not listed). */
  clickTimesSec: readonly number[];
  /** Run-relative audio seconds at which the calibration is over: the last click and half a beat. */
  endSec: number;
}

const SECONDS_PER_BEAT = 60 / CALIBRATION_TEMPO_QPM;

function click(tick: number, downbeat: boolean): SoundingEvent {
  return {
    head: { noteId: '', passIndex: -1 },
    members: [],
    part: -1,
    channel: METRONOME_CHANNEL,
    key: downbeat ? METRONOME_KEY_DOWNBEAT : METRONOME_KEY_BEAT,
    velocity: downbeat ? METRONOME_VELOCITY_DOWNBEAT : METRONOME_VELOCITY_BEAT,
    startTick: tick,
    endTick: tick + 1,
  };
}

/**
 * `CALIBRATION_COUNT_IN_BEATS` accented clicks, then `CALIBRATION_BEATS` ordinary ones, one per beat at
 * `CALIBRATION_TEMPO_QPM`, encoded through `compileSchedule` so the worklet-protocol ordering rules hold by construction.
 * The Metronome channel carries no volume of its own (020 R-10): its level is the session's `channelVolume`.
 */
export function compileCalibrationSchedule(ppq: number): CalibrationSchedule {
  const beats = CALIBRATION_COUNT_IN_BEATS + CALIBRATION_BEATS;
  const events: SoundingEvent[] = [];
  for (let beat = 0; beat < beats; beat++) events.push(click(beat * ppq, beat < CALIBRATION_COUNT_IN_BEATS));

  const channels: ChannelSetup[] = Array.from({ length: 16 }, (_, channel) => ({
    used: channel === METRONOME_CHANNEL,
    program: 0,
    bankMsb: 0,
    percussion: channel === METRONOME_CHANNEL,
    volume: null,
    pan: null,
    orchestra: false,
  }));

  const timeline: PlaybackTimeline = {
    ppq,
    endTick: beats * ppq,
    passes: [],
    events,
    spans: [],
    tempo: [{ startTick: 0, qpmNum: CALIBRATION_TEMPO_QPM, qpmDen: 1 }],
    channels,
    leadInTicks: 0,
  };

  const clickTimesSec = Array.from(
    { length: CALIBRATION_BEATS },
    (_, i) => (CALIBRATION_COUNT_IN_BEATS + i) * SECONDS_PER_BEAT,
  );
  const lastClickSec = clickTimesSec[CALIBRATION_BEATS - 1] ?? 0;
  return {
    schedule: compileSchedule(timeline),
    clickTimesSec,
    endSec: lastClickSec + SECONDS_PER_BEAT * CALIBRATION_WINDOW_BEATS,
  };
}
