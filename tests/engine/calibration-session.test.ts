/**
 * Feature 021 US2 (audio-setup.md section 2, data-model.md section 4, research R-9): the `CalibrationController` against the
 * fakes - fake engine, fake MIDI keyboard, injected clock. It plays an audible beat on the audio clock, maps every tap with the
 * same clock map a Play run uses, ends from position reports (never a timer), and saves nothing unless it measured.
 */
import { describe, expect, it } from 'vitest';
import { CalibrationController, type CalibrationState } from '../../src/app/calibration-session.js';
import {
  BASE_PPQ,
  CALIBRATION_BEATS,
  CALIBRATION_COUNT_IN_BEATS,
  CALIBRATION_MIN_CLICK_LEVEL,
  CALIBRATION_MIN_TAPS,
  CALIBRATION_TEMPO_QPM,
  METRONOME_CHANNEL,
} from '../../src/core/defaults.js';
import type { LatencyProfile } from '../../src/core/grade/types.js';
import { compileCalibrationSchedule } from '../../src/core/play/calibration-schedule.js';
import { metronomeChannelVolume } from '../../src/core/play/metronome.js';
import { EVENT_KIND } from '../../src/core/schedule/compile.js';
import { FakeAudioEngine } from '../fakes/fake-audio-engine.js';
import { FakeMidiInput } from '../fakes/fake-midi-input.js';
import { MemorySettingsStore } from '../fakes/memory-settings-store.js';

const SECONDS_PER_BEAT = 60 / CALIBRATION_TEMPO_QPM;
const OUTPUT_LATENCY_MS = 12;
const START_MS = 1000; // performance.now() when the run starts; the clock pair maps it to audio time 10 s
const AUDIO_AT_START_SEC = 10;
const ASSUMED: LatencyProfile = { outputLatencyMs: 0, inputLatencyMs: 0, source: 'assumed', measuredAt: null };

/** `performance.now()` milliseconds of an audio-clock instant `sec` after the run's start. */
const msAt = (sec: number) => START_MS + sec * 1000;
/** Run-relative second of the i-th counted click. */
const clickSec = (i: number) => (CALIBRATION_COUNT_IN_BEATS + i) * SECONDS_PER_BEAT;

interface Options {
  runActive?: boolean;
  soundReady?: boolean;
  metronomeLevel?: number;
}

function setup(options: Options = {}) {
  const engine = new FakeAudioEngine();
  engine.currentClockPair = { contextTime: AUDIO_AT_START_SEC, performanceTime: START_MS };
  engine.latency = () => ({ outputLatencyMs: OUTPUT_LATENCY_MS, keyToSoundMs: null, method: 'reported' });
  const midi = new FakeMidiInput();
  const store = new MemorySettingsStore();
  const states: CalibrationState[] = [];
  const flags = { runActive: options.runActive ?? false, soundReady: options.soundReady ?? true };
  let invalidated = 0;
  const controller = new CalibrationController(
    engine,
    midi,
    store,
    {
      isRunActive: () => flags.runActive,
      isSoundReady: () => flags.soundReady,
      metronomeLevel: () => options.metronomeLevel ?? 60,
      onChange: (state) => states.push(state),
      onScheduleInvalidated: () => {
        invalidated++;
      },
    },
    () => START_MS,
    () => '2026-10-02T12:00:00.000Z',
  );
  const tap = (sec: number, key = 60) =>
    midi.fire({ type: 'noteOn', deviceId: 'kb', key, velocity: 90, timeStampMs: msAt(sec) });
  /** Reports the position at `sec` after the run's start, as the app's frame loop does. */
  const reportAt = (sec: number) => controller.reportPosition(msAt(sec));
  /** Taps every counted click `lateMs` late, then reports the end. */
  const tapAllLate = (lateMs: number, count = CALIBRATION_BEATS) => {
    for (let i = 0; i < count; i++) tap(clickSec(i) + lateMs / 1000);
  };
  const endSec = compileCalibrationSchedule(BASE_PPQ).endSec;
  return {
    engine,
    midi,
    store,
    states,
    flags,
    controller,
    tap,
    reportAt,
    tapAllLate,
    endSec,
    invalidated: () => invalidated,
  };
}

describe('start() (FR-009, FR-015)', () => {
  it('is refused while a Listen, Practice or Play run is active: nothing is loaded, played or changed', () => {
    const h = setup({ runActive: true });
    expect(h.controller.start()).toBe(false);
    expect(h.engine.commands).toEqual([]);
    expect(h.controller.getState().phase).toBe('idle');
  });

  it('is refused while the sound is not ready', () => {
    const h = setup({ soundReady: false });
    expect(h.controller.start()).toBe(false);
    expect(h.engine.commands).toEqual([]);
    expect(h.controller.getState().phase).toBe('idle');
  });

  it('loads the calibration schedule, sets the click channel, plays - in that order - and starts in the count-in', () => {
    const h = setup();
    expect(h.controller.start()).toBe(true);

    const expectedSchedule = compileCalibrationSchedule(BASE_PPQ).schedule;
    expect(h.engine.loaded).toHaveLength(1);
    const clicks = Array.from(h.engine.loaded[0]?.eventKind ?? []).filter((k) => k === EVENT_KIND.noteOn).length;
    expect(clicks).toBe(CALIBRATION_COUNT_IN_BEATS + CALIBRATION_BEATS);
    expect(Array.from(h.engine.loaded[0]?.eventTick ?? [])).toEqual(Array.from(expectedSchedule.eventTick));

    const order = h.engine.commands.filter((c) => ['load', 'play'].includes(c) || c.startsWith('setChannelVolume'));
    expect(order).toEqual(['load', `setChannelVolume:${METRONOME_CHANNEL},60`, 'play']);
    expect(h.engine.commands).toContain('setTempoPercent:100'); // the click tempo is the schedule's own
    expect(h.controller.getState()).toMatchObject({
      phase: 'countIn',
      tapsCollected: 0,
      beat: 0,
      result: null,
      failure: null,
    });
  });

  it.each([
    [20, CALIBRATION_MIN_CLICK_LEVEL],
    [0, CALIBRATION_MIN_CLICK_LEVEL],
    [CALIBRATION_MIN_CLICK_LEVEL, CALIBRATION_MIN_CLICK_LEVEL],
    [80, 80],
  ])(
    "the click level is max(Metronome level %i, the minimum): %i, whatever the Play setup's mute says",
    (level, expected) => {
      const h = setup({ metronomeLevel: level });
      h.controller.start();
      expect(h.engine.commands).toContain(
        `setChannelVolume:${METRONOME_CHANNEL},${metronomeChannelVolume(false, expected)}`,
      );
    },
  );
});

describe('taps (R-9 items 2 and 4)', () => {
  it('a MIDI note-on is mapped onto the audio clock with the clock map and measured against the nearest click', () => {
    const h = setup();
    h.controller.start();
    h.reportAt(clickSec(0)); // count-in over
    expect(h.controller.getState().phase).toBe('tapping');

    h.tap(clickSec(0) + 0.03);
    h.tap(clickSec(1) + 0.03);
    expect(h.controller.getState().tapsCollected).toBe(2);

    for (let i = 2; i < CALIBRATION_BEATS; i++) h.tap(clickSec(i) + 0.03);
    h.reportAt(h.endSec);
    const state = h.controller.getState();
    expect(state.phase).toBe('done');
    // The tap's audio time is the clock pair's: a tap 30 ms after a click is measured 30 ms late
    expect(state.result?.outputLatencyMs).toBe(OUTPUT_LATENCY_MS);
    expect((state.result?.outputLatencyMs ?? 0) + (state.result?.inputLatencyMs ?? 0)).toBeCloseTo(30, 5);
  });

  it('taps in the count-in, beyond half a beat from every counted click, and a second tap on one click are not counted', () => {
    const h = setup();
    h.controller.start();
    h.tap(0.2); // count-in
    h.tap(clickSec(0) - SECONDS_PER_BEAT / 2 - 0.05); // too early for the first counted click
    h.tap(clickSec(0) + 0.01);
    expect(h.controller.getState().tapsCollected).toBe(1);
    h.tap(clickSec(0) + 0.05); // the same click again
    expect(h.controller.getState().tapsCollected).toBe(1);
    // 0.425 s after click 3 is within half a beat of click 4 (0.325 s before it), so it is click 4's tap, counted once
    h.tap(clickSec(3) + SECONDS_PER_BEAT / 2 + 0.05);
    expect(h.controller.getState().tapsCollected).toBe(2);
  });

  it('a note-off or a pedal is not a tap', () => {
    const h = setup();
    h.controller.start();
    h.midi.fire({ type: 'noteOff', deviceId: 'kb', key: 60, timeStampMs: msAt(clickSec(0)) });
    h.midi.fire({ type: 'sustain', deviceId: 'kb', down: true, timeStampMs: msAt(clickSec(0)) });
    h.midi.fire({ type: 'noteOn', deviceId: 'kb', key: 60, velocity: 0, timeStampMs: msAt(clickSec(0)) });
    expect(h.controller.getState().tapsCollected).toBe(0);
  });

  it('the space bar taps only when no MIDI keyboard is connected', () => {
    const h = setup();
    h.midi.deviceList = [{ id: 'kb', name: 'Keys', manufacturer: 'X', connected: true }];
    h.controller.start();
    h.controller.tapSpace(msAt(clickSec(0)));
    expect(h.controller.getState().tapsCollected).toBe(0);

    h.midi.deviceList = [{ id: 'kb', name: 'Keys', manufacturer: 'X', connected: false }];
    h.controller.tapSpace(msAt(clickSec(0)));
    expect(h.controller.getState().tapsCollected).toBe(1);

    h.midi.deviceList = [];
    h.controller.tapSpace(msAt(clickSec(1)));
    expect(h.controller.getState().tapsCollected).toBe(2);
  });

  it('a tap with no calibration running is ignored', () => {
    const h = setup();
    h.tap(clickSec(0));
    h.controller.tapSpace(msAt(clickSec(0)));
    expect(h.controller.getState().tapsCollected).toBe(0);
    expect(h.engine.commands).toEqual([]);
  });
});

describe('the course of a calibration (data-model.md section 4)', () => {
  it('moves from the count-in to tapping and counts the beats heard, from position reports only', () => {
    const h = setup();
    h.controller.start();
    h.reportAt(1.0);
    expect(h.controller.getState()).toMatchObject({ phase: 'countIn', beat: 0 });
    h.reportAt(clickSec(0) + 0.01);
    expect(h.controller.getState()).toMatchObject({ phase: 'tapping', beat: 1 });
    h.reportAt(clickSec(4) + 0.01);
    expect(h.controller.getState().beat).toBe(5);
  });

  it('ends exactly at endSec (the last click and half a beat), not before, with no timer involved', () => {
    const h = setup();
    h.controller.start();
    h.tapAllLate(30);
    h.reportAt(h.endSec - 0.01);
    expect(h.controller.getState().phase).toBe('tapping');
    h.reportAt(h.endSec);
    expect(h.controller.getState().phase).toBe('done');
  });

  it('done: saves the profile with the active output id, gives it to the engine, stops, and marks the Score schedule for re-delivery', () => {
    const h = setup();
    h.controller.start();
    h.tapAllLate(30);
    h.reportAt(h.endSec);

    const saved = h.store.loadLatencyProfile();
    expect(saved).toEqual({
      outputLatencyMs: OUTPUT_LATENCY_MS,
      inputLatencyMs: 18,
      source: 'measured',
      measuredAt: '2026-10-02T12:00:00.000Z',
    });
    expect(h.store.loadLatencyOutputDeviceId()).toBe(h.engine.activeOutputId());
    expect(h.engine.commands).toContain('setLatencyCalibration:30');
    expect(h.engine.latencyProfile()).toEqual(saved);
    expect(h.engine.commands[h.engine.commands.length - 1] === 'stop' || h.engine.commands.includes('stop')).toBe(true);
    expect(h.invalidated()).toBe(1);
    expect(h.controller.getState().result).toEqual(saved);
  });

  it('failed: too few taps keeps the previous profile - nothing saved, the engine calibration untouched', () => {
    const h = setup();
    const previous: LatencyProfile = {
      outputLatencyMs: 5,
      inputLatencyMs: 20,
      source: 'measured',
      measuredAt: '2026-09-01T00:00:00.000Z',
    };
    h.store.saveLatencyProfile(previous, 'speakers');
    h.engine.setLatencyCalibration(previous);
    h.engine.commands.length = 0;

    h.controller.start();
    h.tapAllLate(30, CALIBRATION_MIN_TAPS - 1);
    h.reportAt(h.endSec);

    expect(h.controller.getState()).toMatchObject({ phase: 'failed', failure: 'notEnoughTaps', result: null });
    expect(h.store.loadLatencyProfile()).toEqual(previous);
    expect(h.store.loadLatencyOutputDeviceId()).toBe('speakers');
    expect(h.engine.commands.filter((c) => c.startsWith('setLatencyCalibration'))).toEqual([]);
    expect(h.engine.latencyProfile()).toEqual(previous);
    expect(h.invalidated()).toBe(1); // the click schedule replaced the Score's: it is delivered again either way
  });

  it('failed: uneven taps are spreadTooLarge', () => {
    const h = setup();
    h.controller.start();
    for (let i = 0; i < CALIBRATION_BEATS; i++) h.tap(clickSec(i) + (i % 2 === 0 ? 0 : 0.2));
    h.reportAt(h.endSec);
    expect(h.controller.getState()).toMatchObject({ phase: 'failed', failure: 'spreadTooLarge' });
  });

  it('can be started again after done, failed or cancelled', () => {
    const h = setup();
    h.controller.start();
    h.reportAt(h.endSec); // no taps: failed
    expect(h.controller.getState().phase).toBe('failed');
    expect(h.controller.start()).toBe(true);
    expect(h.controller.getState()).toMatchObject({ phase: 'countIn', tapsCollected: 0, failure: null });
    h.controller.cancel();
    expect(h.controller.start()).toBe(true);
    expect(h.controller.getState().phase).toBe('countIn');
  });

  it('start() is refused while a calibration is already running', () => {
    const h = setup();
    h.controller.start();
    expect(h.controller.start()).toBe(false);
    expect(h.engine.commands.filter((c) => c === 'load')).toHaveLength(1);
  });
});

describe('cancel (FR-015)', () => {
  it('cancel() stops the engine, saves nothing and marks the Score schedule for re-delivery', () => {
    const h = setup();
    h.controller.start();
    h.tapAllLate(30, 10);
    h.engine.commands.length = 0;
    h.controller.cancel();

    expect(h.controller.getState().phase).toBe('cancelled');
    expect(h.engine.commands).toContain('stop');
    expect(h.engine.commands.filter((c) => c.startsWith('setLatencyCalibration'))).toEqual([]);
    expect(h.store.loadLatencyProfile()).toEqual(ASSUMED);
    expect(h.invalidated()).toBe(1);
  });

  it('cancel() with nothing running does nothing at all', () => {
    const h = setup();
    h.controller.cancel();
    expect(h.engine.commands).toEqual([]);
    expect(h.invalidated()).toBe(0);
    expect(h.controller.getState().phase).toBe('idle');
  });

  it('cancel() after the end changes nothing: a finished result stays', () => {
    const h = setup();
    h.controller.start();
    h.tapAllLate(30);
    h.reportAt(h.endSec);
    h.controller.cancel();
    expect(h.controller.getState().phase).toBe('done');
    expect(h.invalidated()).toBe(1);
  });

  it('the sound suspending or failing mid-calibration cancels it', () => {
    for (const state of [
      { kind: 'suspended', reason: 'deviceChanged' } as const,
      { kind: 'error', code: 'processorFaulted', detail: 'x' } as const,
    ]) {
      const h = setup();
      h.controller.start();
      h.engine.fireEvent({ type: 'state', state });
      expect(h.controller.getState().phase).toBe('cancelled');
      expect(h.store.loadLatencyProfile()).toEqual(ASSUMED);
    }
  });

  it('a report or a tap after a cancel does nothing', () => {
    const h = setup();
    h.controller.start();
    h.controller.cancel();
    h.tapAllLate(30);
    h.reportAt(h.endSec);
    expect(h.controller.getState()).toMatchObject({ phase: 'cancelled', tapsCollected: 0 });
    expect(h.store.loadLatencyProfile()).toEqual(ASSUMED);
  });

  it('dispose() unsubscribes from MIDI and the engine', () => {
    const h = setup();
    h.controller.start();
    h.controller.dispose();
    h.tap(clickSec(0));
    expect(h.controller.getState().tapsCollected).toBe(0);
  });
});

describe('what the UI is told', () => {
  it('every change of the state is announced once, and a report that changes nothing announces nothing', () => {
    const h = setup();
    h.controller.start();
    const afterStart = h.states.length;
    h.reportAt(1.0);
    h.reportAt(1.1);
    expect(h.states.length).toBe(afterStart); // still the count-in, same beat: nothing new to show
    h.reportAt(clickSec(0) + 0.01);
    expect(h.states.length).toBeGreaterThan(afterStart);
    expect(h.states.every((s) => s.phase !== 'idle')).toBe(true);
  });
});
