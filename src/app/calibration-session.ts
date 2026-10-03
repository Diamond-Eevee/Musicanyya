import {
  BASE_PPQ,
  CALIBRATION_BEATS,
  CALIBRATION_MIN_CLICK_LEVEL,
  CALIBRATION_TEMPO_QPM,
  METRONOME_CHANNEL,
} from '../core/defaults.js';
import { type CalibrationState, calibrateLatency, IDLE_CALIBRATION, type Tap } from '../core/play/calibration.js';
import { type CalibrationSchedule, compileCalibrationSchedule } from '../core/play/calibration-schedule.js';
import { metronomeChannelVolume } from '../core/play/metronome.js';
import { AUDIO_TIME_EPSILON_SEC } from '../engine/config.js';
import { MidiClockMap } from '../engine/midi/clock-map.js';
import type {
  AudioEngine,
  AudioEngineEvent,
  MidiInput,
  MidiInputEvent,
  SettingsStore,
  Unsubscribe,
} from '../engine/ports.js';
import { anchorRunStart } from './run-anchor.js';

export type { CalibrationState } from '../core/play/calibration.js';

/** What the app around the controller tells it, and what it tells the app (contracts/audio-setup.md section 2). */
export interface CalibrationCallbacks {
  /** A Listen, Practice or Play run is going on: a calibration may not start (FR-015). */
  isRunActive(): boolean;
  /** The context runs and the SoundFont is loaded, so the clicks can be heard. */
  isSoundReady(): boolean;
  /** The musician's Metronome level, 0..100. */
  metronomeLevel(): number;
  onChange(state: CalibrationState): void;
  /** The calibration's click schedule replaced the Score's in the engine: the Score's must be delivered again. */
  onScheduleInvalidated(): void;
}

const MS_PER_BEAT = 60000 / CALIBRATION_TEMPO_QPM;

/**
 * Feature 021 US2, research R-9: the Latency calibration. It plays an audible beat (a Metronome-only schedule on the audio
 * clock), anchors the beat with the same helper a Play run uses, maps every tap with the same `MidiClockMap`, ends from position
 * reports (never a timer, Constitution I/II) and turns the taps into a Latency profile with the core's `calibrateLatency`.
 * It saves and applies the profile only when it measured one; a failed, cancelled or refused calibration changes nothing.
 */
export class CalibrationController {
  private state: CalibrationState = IDLE_CALIBRATION;
  private readonly clockMap = new MidiClockMap();
  private schedule: CalibrationSchedule | null = null;
  private startAudioTimeSec = 0;
  /** The tap that answered each counted click, or null: one per click, the first one (a second is a bounce or a chord). */
  private taps: (Tap | null)[] = [];

  private readonly unsubMidi: Unsubscribe;
  private readonly unsubEngine: Unsubscribe;

  constructor(
    private readonly audioEngine: AudioEngine,
    private readonly midiInput: MidiInput,
    private readonly settingsStore: SettingsStore,
    private readonly callbacks: CalibrationCallbacks,
    private readonly now: () => number = () => performance.now(),
    private readonly nowISO: () => string = () => new Date().toISOString(),
  ) {
    this.unsubMidi = this.midiInput.on((event) => this.handleMidiEvent(event));
    this.unsubEngine = this.audioEngine.on((event) => this.handleEngineEvent(event));
  }

  getState(): CalibrationState {
    return this.state;
  }

  private isActive(): boolean {
    return this.state.phase === 'countIn' || this.state.phase === 'tapping';
  }

  /** Starts a calibration; false (and nothing changed) while any run or calibration is going on or the sound is not ready. */
  start(): boolean {
    if (this.isActive() || this.callbacks.isRunActive() || !this.callbacks.isSoundReady()) return false;
    // Without a (context time, performance time) pair there is no anchor for the beat: a Play run falls back to 0, a
    // calibration would measure against nothing (RT review T037)
    if (this.audioEngine.clockPair() === null) return false;

    const calibration = compileCalibrationSchedule(BASE_PPQ);
    this.schedule = calibration;
    this.taps = Array.from({ length: CALIBRATION_BEATS }, () => null);

    this.audioEngine.load(calibration.schedule);
    this.audioEngine.setTempoPercent(100); // the click tempo is the schedule's own
    // The click must be heard: the musician's Metronome level, never softer than the minimum, and a Play-setup mute does not
    // apply. The Play run sets the level it expects at its own start, so nothing is restored here.
    const level = Math.max(this.callbacks.metronomeLevel(), CALIBRATION_MIN_CLICK_LEVEL);
    this.audioEngine.setChannelVolume(METRONOME_CHANNEL, metronomeChannelVolume(false, level));
    this.audioEngine.play();

    const nowMs = this.now();
    this.startAudioTimeSec = anchorRunStart(this.clockMap, this.audioEngine, nowMs);
    this.set({ ...IDLE_CALIBRATION, phase: 'countIn', startedAtMs: nowMs });
    return true;
  }

  /** Ends a running calibration without a result (Stop, the popup closing, any run starting, the sound lost). */
  cancel(): void {
    if (!this.isActive()) return;
    this.audioEngine.stop();
    this.set({ ...IDLE_CALIBRATION, phase: 'cancelled' });
    this.callbacks.onScheduleInvalidated();
  }

  /** Called with every animation frame while a calibration runs, like a Play run's position reports: it moves the count-in on
   *  to tapping, counts the beats heard, and ends the calibration at its end time on the audio clock. */
  reportPosition(nowMs: number): void {
    const schedule = this.schedule;
    if (!this.isActive() || !schedule) return;
    this.clockMap.updatePair(this.audioEngine.clockPair());
    const audioTimeSec = this.clockMap.toAudioTime(nowMs);
    if (audioTimeSec === null) return;
    const runSec = audioTimeSec - this.startAudioTimeSec + AUDIO_TIME_EPSILON_SEC;

    if (runSec >= schedule.endSec) {
      this.finish();
      return;
    }
    const beat = schedule.clickTimesSec.filter((sec) => sec <= runSec).length;
    const phase = beat > 0 ? 'tapping' : 'countIn';
    this.set({ ...this.state, phase, beat });
  }

  /** The space bar, as a tap, when no MIDI keyboard is connected (the keyboard's own timestamps are `performance.now()`). */
  tapSpace(timeStampMs: number): void {
    if (this.midiInput.devices().some((device) => device.connected)) return;
    this.recordTap(timeStampMs);
  }

  dispose(): void {
    this.unsubMidi();
    this.unsubEngine();
  }

  private handleMidiEvent(event: MidiInputEvent): void {
    if (event.type === 'noteOn' && event.velocity > 0) this.recordTap(event.timeStampMs);
  }

  private handleEngineEvent(event: AudioEngineEvent): void {
    // The worklet reached the end of the click schedule (on the audio clock, a little after `endSec`): the calibration ends
    // even if no position report came (a hidden tab draws no frames)
    if (event.type === 'ended') {
      if (this.isActive()) this.finish();
      return;
    }
    // Sound suspended or lost: the beat is no longer what was anchored
    if (event.type === 'state' && (event.state.kind === 'suspended' || event.state.kind === 'error')) this.cancel();
  }

  /** Maps a tap onto the audio clock and gives it to the nearest counted click, if it is within half a beat of it. */
  private recordTap(timeStampMs: number): void {
    const schedule = this.schedule;
    if (!this.isActive() || !schedule) return;
    this.clockMap.updatePair(this.audioEngine.clockPair());
    const audioTimeSec = this.clockMap.toAudioTime(timeStampMs);
    const firstClickSec = schedule.clickTimesSec[0];
    if (audioTimeSec === null || firstClickSec === undefined) return;

    const runMs = (audioTimeSec - this.startAudioTimeSec) * 1000;
    const index = Math.round((runMs - firstClickSec * 1000) / MS_PER_BEAT);
    const clickSec = schedule.clickTimesSec[index];
    if (clickSec === undefined || this.taps[index]) return;

    this.taps[index] = {
      expectedTimeMs: (this.startAudioTimeSec + clickSec) * 1000,
      tapTimeMs: audioTimeSec * 1000,
    };
    this.set({ ...this.state, tapsCollected: this.state.tapsCollected + 1 });
  }

  private finish(): void {
    const taps = this.taps.filter((tap): tap is Tap => tap !== null);
    const outputLatencyMs = this.audioEngine.latency().outputLatencyMs ?? 0;
    const result = calibrateLatency(taps, MS_PER_BEAT, outputLatencyMs, this.nowISO());
    this.audioEngine.stop();
    if (result.ok) {
      this.settingsStore.saveLatencyProfile(result.value, this.audioEngine.activeOutputId());
      this.audioEngine.setLatencyCalibration(result.value);
      this.set({ ...this.state, phase: 'done', result: result.value, failure: null, startedAtMs: null });
    } else {
      this.set({ ...this.state, phase: 'failed', result: null, failure: result.reason, startedAtMs: null });
    }
    this.callbacks.onScheduleInvalidated();
  }

  private set(next: CalibrationState): void {
    const prev = this.state;
    if (
      prev.phase === next.phase &&
      prev.tapsCollected === next.tapsCollected &&
      prev.beat === next.beat &&
      prev.result === next.result &&
      prev.failure === next.failure &&
      prev.startedAtMs === next.startedAtMs
    ) {
      return;
    }
    this.state = next;
    this.callbacks.onChange(next);
  }
}
