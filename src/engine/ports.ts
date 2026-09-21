import type { LatencyProfile } from '../core/grade/types.js';
import type { HandSelection } from '../core/practice/types.js';
import type { ScheduleMessage } from '../core/schedule/compile.js';
import type { ClockPair } from './midi/clock-map.js';

// ---- shared ----
export type Unsubscribe = () => void;
export interface Emitter<E> {
  on(listener: (event: E) => void): Unsubscribe;
}

// ---- AudioEngine (Web Audio engine now; Native audio plugin client later) ----
export type AudioEngineState =
  | { kind: 'idle' } // no AudioContext yet (needs a user gesture)
  | { kind: 'loadingSound'; loadedBytes: number; totalBytes: number | null }
  | { kind: 'ready' }
  | { kind: 'suspended'; reason: 'hidden' | 'deviceChanged' | 'browserPolicy' }
  | { kind: 'error'; code: AudioErrorCode; detail: string };

export type AudioErrorCode = 'notSupported' | 'soundFontLoadFailed' | 'workletLoadFailed' | 'contextFailed';

export interface LatencyInfo {
  outputLatencyMs: number | null; // base + output latency, null if the browser does not report it
  keyToSoundMs: number | null; // estimate (R-12), null until enough key events were seen
  method: 'reported' | 'estimated';
}

export interface PositionUpdate {
  // produced on the main thread from worklet reports (R-11)
  audibleTick: number; // integer ticks on the unrolled timeline
  playing: boolean;
}

export type TransportPhase = 'stopped' | 'loading' | 'playing' | 'paused';
export interface TransportSnapshot {
  phase: TransportPhase;
  startTick: number;
  positionTick: number;
  tempoPercent: number;
  volume: number;
  follow: boolean;
}

export interface AudioDiagnostics {
  sampleRate: number | null;
  baseLatencyMs: number | null;
  outputLatencyMs: number | null;
  dropoutsSincePlay: number;
  dropoutsTotal: number;
  dropoutMethod: 'browserStats' | 'clockDrift' | 'none';
  reportsPerSecond: number;
  lastReportAgeMs: number | null;
  /** A `live` (MIDI-in / accompaniment) message dropped because the worklet's 64-entry queue was full (T057). */
  liveQueueDropped: number;
}

export type AudioEngineEvent =
  | { type: 'state'; state: AudioEngineState }
  | { type: 'transport'; transport: TransportSnapshot } // data-model §5
  | { type: 'ended' }
  | { type: 'latency'; latency: LatencyInfo }
  | { type: 'dropout'; total: number };

// The worklet's schedule message (contracts/worklet-protocol.md, src/core/schedule/compile.ts).
export type EngineSchedule = ScheduleMessage;

export interface AudioEngine extends Emitter<AudioEngineEvent> {
  readonly kind: 'webAudio' | 'nativePlugin';
  /** Must be called from a user gesture handler; creates/resumes the AudioContext. Idempotent. */
  unlock(): Promise<void>;
  /** Loads (or reuses) the built-in instrument sound; progress arrives as "state" events. */
  ensureSoundLoaded(): Promise<void>;
  /** Replaces the engine schedule (stops playback first). */
  load(schedule: EngineSchedule): void; // data-model §4
  play(): void;
  pause(): void;
  stop(): void;
  seekTick(tick: number): void;
  setTempoPercent(percent: number): void; // 25..200, multiple of 5
  setVolume(volume: number): void; // 0..100
  /** CC7 on one channel, applied at the next block. Used to mute the Metronome without touching the schedule. */
  setChannelVolume(channel: number, volume: number): void; // 0..100
  /** Live input (US3), applied as soon as possible. */
  liveNoteOn(key: number, velocity: number): void;
  liveNoteOff(key: number): void;
  liveSustain(down: boolean): void;
  liveAllOff(): void;
  /** Called every animation frame by the UI; returns the audible position (R-11). */
  audiblePosition(nowMs: number): PositionUpdate | null;
  /** The `(contextTime, performanceTime)` pairing `AudioContext.getOutputTimestamp()` gives, the same one the
   *  cursor uses (R-04); null before the context exists. Feeds `MidiClockMap` so a recorded MIDI message's
   *  `timeStampMs` can be mapped onto the audio clock (play-run.md 1.1.1 -> 1.2.0). */
  clockPair(): ClockPair | null;
  latency(): LatencyInfo;
  /** The profile grading compensates with; `assumed` until a calibration is stored (data-model §8). */
  latencyProfile(): LatencyProfile;
  diagnostics(): AudioDiagnostics; // data-model §6
  dispose(): Promise<void>;
}

// ---- MidiInput (Web MIDI now; plugin-reported input later) ----
export type MidiAvailability = 'notRequested' | 'available' | 'notSupported' | 'denied';
export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
  connected: boolean;
}
export type MidiInputEvent =
  | { type: 'devices'; devices: readonly MidiDevice[] }
  | { type: 'availability'; availability: MidiAvailability }
  | { type: 'noteOn'; deviceId: string; key: number; velocity: number; timeStampMs: number }
  | { type: 'noteOff'; deviceId: string; key: number; timeStampMs: number }
  | { type: 'sustain'; deviceId: string; down: boolean; timeStampMs: number }
  | { type: 'deviceLost'; deviceId: string; heldKeys: readonly number[] };

export interface MidiInput extends Emitter<MidiInputEvent> {
  availability(): MidiAvailability;
  /** Must be called from a user gesture; resolves with the resulting availability. */
  request(): Promise<MidiAvailability>;
  devices(): readonly MidiDevice[];
}
// timeStampMs is MIDIMessageEvent.timeStamp (performance.now() domain), kept for later mapping onto the audio clock.

// ---- ScoreStore (recent Scores, IndexedDB) ----
export interface RecentScoreSummary {
  id: string;
  fileName: string;
  title: string | null;
  composer: string | null;
  byteLength: number;
  lastOpened: string /* ISO 8601 */;
}
export type StoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: 'unavailable' | 'quotaExceeded' | 'notFound' };

export interface ScoreStore {
  list(): Promise<StoreResult<readonly RecentScoreSummary[]>>; // newest first, max 10
  put(file: {
    fileName: string;
    bytes: ArrayBuffer;
    title: string | null;
    composer: string | null;
  }): Promise<StoreResult<RecentScoreSummary>>; // upsert by content hash, trims to 10
  get(id: string): Promise<StoreResult<{ summary: RecentScoreSummary; bytes: ArrayBuffer }>>;
  remove(id: string): Promise<StoreResult<void>>;
}

export interface UserSettings {
  version: 1;
  volume: number;
  tempoPercent: number;
  zoomPercent: number;
  follow: boolean;
}

// ---- SettingsStore (tiny UI preferences, localStorage) ----
export interface PracticeSettings {
  /** The part and staves to practise; null = never chosen, so the preselected part and both hands apply. */
  selection: HandSelection | null;
  /** The loop as measure-pass indices on the unrolled timeline; null = no loop. Never carried between Scores. */
  loop: { fromPassIndex: number; toPassIndex: number } | null;
  accompaniment: boolean;
  help: boolean;
}

export interface SettingsStore {
  load(): UserSettings; // defaults on missing/invalid data (contracts/storage.md)
  save(settings: UserSettings): void; // never throws; storage errors are reported once as a notice

  /** Practice settings for a Score id, falling back to the musician's last-used defaults, then to the built-in
   *  ones. A null id (Score not stored) returns the defaults and never persists (ports 1.1.0). */
  loadPractice(scoreId: string | null): PracticeSettings;
  /** Stores the settings for that Score id and updates the last-used defaults. No-op for a null id. */
  savePractice(scoreId: string | null, settings: PracticeSettings): void;

  loadLatencyProfile(): LatencyProfile;
  saveLatencyProfile(profile: LatencyProfile): void;
}

// ---- EnvironmentProbe ----
export interface Environment {
  shell:
    | { kind: 'browser'; browser: { name: string; version: string } | null }
    | {
        kind: 'electron';
        appVersion: string;
        electronVersion: string;
        chromeVersion: string;
        platform: string;
        bridgeVersion: string;
      };
  builtInSound: Capability; // AudioContext + AudioWorklet
  midiInput: Capability; // Web MIDI + permission state
  audioPlugin: Capability; // 001: unavailable, reason "notYetAvailable"
  recentScores: Capability; // IndexedDB
  compressedFiles: Capability; // DecompressionStream('deflate-raw')
  secureContext: boolean;
}
export type Capability = { available: true } | { available: false; reason: CapabilityReason };
export type CapabilityReason =
  | 'notSupported'
  | 'permissionDenied'
  | 'notRequested'
  | 'insecureContext'
  | 'notYetAvailable'
  | 'desktopOnly'
  | 'storageBlocked';

export interface EnvironmentProbe {
  detect(): Promise<Environment>;
} // data-model §7
