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
}

export type AudioEngineEvent =
  | { type: 'state'; state: AudioEngineState }
  | { type: 'transport'; transport: TransportSnapshot } // data-model §5
  | { type: 'ended' }
  | { type: 'latency'; latency: LatencyInfo }
  | { type: 'dropout'; total: number };

// Stub EngineSchedule (will be defined properly in data-model §4/contracts/worklet-protocol.md)
export type EngineSchedule = any;

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
  /** Live input (US3), applied as soon as possible. */
  liveNoteOn(key: number, velocity: number): void;
  liveNoteOff(key: number): void;
  liveSustain(down: boolean): void;
  liveAllOff(): void;
  /** Called every animation frame by the UI; returns the audible position (R-11). */
  audiblePosition(nowMs: number): PositionUpdate | null;
  latency(): LatencyInfo;
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
export interface SettingsStore {
  load(): UserSettings; // defaults on missing/invalid data (contracts/storage.md)
  save(settings: UserSettings): void; // never throws; storage errors are reported once as a notice
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
