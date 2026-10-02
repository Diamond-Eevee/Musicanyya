/**
 * Feature 021 US2 (contracts/audio-setup.md section 2, research R-9): the calibration's own Metronome-only schedule. The
 * clicks are ordinary schedule events on METRONOME_CHANNEL, so the worklet plays them on the audio clock with no change.
 */
import { describe, expect, it } from 'vitest';
import {
  BASE_PPQ,
  CALIBRATION_BEATS,
  CALIBRATION_COUNT_IN_BEATS,
  CALIBRATION_TEMPO_QPM,
  METRONOME_CHANNEL,
  METRONOME_KEY_BEAT,
  METRONOME_KEY_DOWNBEAT,
  METRONOME_VELOCITY_BEAT,
  METRONOME_VELOCITY_DOWNBEAT,
} from '../../../src/core/defaults.js';
import { compileCalibrationSchedule } from '../../../src/core/play/calibration-schedule.js';
import { EVENT_KIND } from '../../../src/core/schedule/compile.js';

const SECONDS_PER_BEAT = 60 / CALIBRATION_TEMPO_QPM; // 0.75 s at 80 QPM

function noteOns(schedule: ReturnType<typeof compileCalibrationSchedule>['schedule']) {
  const out: { tick: number; key: number; velocity: number; channel: number }[] = [];
  for (let i = 0; i < schedule.eventKind.length; i++) {
    if (schedule.eventKind[i] !== EVENT_KIND.noteOn) continue;
    out.push({
      tick: schedule.eventTick[i] ?? -1,
      key: schedule.eventData1[i] ?? -1,
      velocity: schedule.eventData2[i] ?? -1,
      channel: schedule.eventChannel[i] ?? -1,
    });
  }
  return out;
}

describe('compileCalibrationSchedule (021 R-9)', () => {
  const calibration = compileCalibrationSchedule(BASE_PPQ);
  const clicks = noteOns(calibration.schedule);

  it('has CALIBRATION_COUNT_IN_BEATS accented clicks, then CALIBRATION_BEATS ordinary ones, all on the Metronome channel', () => {
    expect(clicks).toHaveLength(CALIBRATION_COUNT_IN_BEATS + CALIBRATION_BEATS);
    expect(clicks.every((c) => c.channel === METRONOME_CHANNEL)).toBe(true);

    const countIn = clicks.slice(0, CALIBRATION_COUNT_IN_BEATS);
    const counted = clicks.slice(CALIBRATION_COUNT_IN_BEATS);
    expect(countIn.every((c) => c.key === METRONOME_KEY_DOWNBEAT && c.velocity === METRONOME_VELOCITY_DOWNBEAT)).toBe(
      true,
    );
    expect(counted.every((c) => c.key === METRONOME_KEY_BEAT && c.velocity === METRONOME_VELOCITY_BEAT)).toBe(true);
  });

  it('puts one click on every beat at CALIBRATION_TEMPO_QPM, starting at tick 0', () => {
    clicks.forEach((click, beat) => {
      expect(click.tick).toBe(beat * BASE_PPQ);
    });
    expect(Array.from(calibration.schedule.tempoQpmNum)).toEqual([CALIBRATION_TEMPO_QPM]);
    expect(Array.from(calibration.schedule.tempoQpmDen)).toEqual([1]);
    expect(Array.from(calibration.schedule.tempoTick)).toEqual([0]);
  });

  it('gives the counted clicks as run-relative seconds, 0.75 s apart at 80 QPM, the first at 3.0 s', () => {
    expect(calibration.clickTimesSec).toHaveLength(CALIBRATION_BEATS);
    expect(calibration.clickTimesSec[0]).toBeCloseTo(CALIBRATION_COUNT_IN_BEATS * SECONDS_PER_BEAT, 9);
    expect(calibration.clickTimesSec[0]).toBeCloseTo(3.0, 9);
    for (let i = 1; i < calibration.clickTimesSec.length; i++) {
      expect((calibration.clickTimesSec[i] ?? 0) - (calibration.clickTimesSec[i - 1] ?? 0)).toBeCloseTo(0.75, 9);
    }
  });

  it('ends half a beat after the last click', () => {
    const last = calibration.clickTimesSec[CALIBRATION_BEATS - 1] ?? 0;
    expect(calibration.endSec).toBeCloseTo(last + SECONDS_PER_BEAT / 2, 9);
  });

  it('sizes the schedule to the clicks and works at any ppq (ticks scale, seconds do not)', () => {
    const coarse = compileCalibrationSchedule(480);
    expect(coarse.schedule.ppq).toBe(480);
    expect(noteOns(coarse.schedule).map((c) => c.tick)).toEqual(clicks.map((_, beat) => beat * 480));
    expect(coarse.clickTimesSec).toEqual(calibration.clickTimesSec);
    expect(coarse.endSec).toBe(calibration.endSec);
    expect(calibration.schedule.endTick).toBeGreaterThan(clicks[clicks.length - 1]?.tick ?? Number.POSITIVE_INFINITY);
  });

  it('follows the worklet-protocol ordering rules: setup first at tick 0, then events sorted by tick, noteOff before noteOn', () => {
    const s = calibration.schedule;
    for (let i = 1; i < s.eventTick.length; i++) {
      expect(s.eventTick[i] ?? 0).toBeGreaterThanOrEqual(s.eventTick[i - 1] ?? 0);
    }
    // Program changes (setup) come before every note, all at tick 0
    const firstNote = Array.from(s.eventKind).findIndex((k) => k === EVENT_KIND.noteOn);
    expect(firstNote).toBeGreaterThan(0);
    for (let i = 0; i < firstNote; i++) {
      expect(s.eventTick[i]).toBe(0);
      expect([EVENT_KIND.controlChange, EVENT_KIND.programChange]).toContain(s.eventKind[i]);
    }
    // A click that ends where the next begins: the noteOff sorts first
    for (let i = 1; i < s.eventTick.length; i++) {
      if (s.eventTick[i] === s.eventTick[i - 1]) {
        expect(s.eventKind[i - 1] === EVENT_KIND.noteOn && s.eventKind[i] === EVENT_KIND.noteOff).toBe(false);
      }
    }
    // Only the Metronome channel is used, and it carries no controller of its own: its volume is the session's
    // channelVolume (020 R-10), and the click must not be Orchestra
    expect(s.channelSetup.length).toBe(64);
    for (let channel = 0; channel < 16; channel++) {
      expect(s.channelSetup[channel * 4]).toBe(channel === METRONOME_CHANNEL ? 1 : 0);
    }
    expect(Array.from(s.eventKind).filter((k) => k === EVENT_KIND.controlChange)).toEqual([]);
    expect(s.orchestraMask ?? 0).toBe(0);
  });
});
