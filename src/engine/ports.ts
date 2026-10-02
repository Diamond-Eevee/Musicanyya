import type { LatencyProfile, StoredPerformance } from '../core/grade/types.js';
import type { LibraryIndex } from '../core/library/types.js';
import type { RunSettings } from '../core/play/types.js';
import type { HandSelection } from '../core/practice/types.js';
import type { MasteryThresholds, ProgressEvent, ProgressRecord, UserFileEntry } from '../core/progress/types.js';
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

export type AudioErrorCode =
  | 'notSupported'
  | 'soundFontLoadFailed'
  | 'workletLoadFailed'
  | 'contextFailed'
  | 'processorFaulted'; // the AudioWorkletProcessor threw mid-session and was guarded off (tasks.md T161)

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
  /** A `live` (MIDI-in / accompaniment) message dropped: the worklet's queue (`LIVE_QUEUE_CAPACITY`) was full (T057),
   * or the message was malformed (017 T005). */
  liveQueueDropped: number;
  /** Schedule events that sounded after their own frame, at a later block's start: left over from a full block, or
   * re-anchored by a tempo change. Late, not lost; each counted once (017 T013). */
  lateEvents: number;
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
  setTempoPercent(percent: number): void; // any finite number in 25..200 (feature 012: not stepped)
  setVolume(volume: number): void; // 0..100
  /** CC7 on one channel, applied at the next block. Used to mute the Metronome without touching the schedule. */
  setChannelVolume(channel: number, volume: number): void; // 0..100
  /** The Orchestra level, 0..100 (feature 019, ports 2.2.0). Held by the engine, sent now and to every new worklet node; the
   *  worklet applies it as CC11 on the Orchestra channels. */
  setOrchestraLevel(level: number): void;
  /** Live input (US3), applied as soon as possible. */
  /** `channel` (0..15, feature 019): the channel the note plays on, for Orchestra notes; the live channel when omitted. */
  liveNoteOn(key: number, velocity: number, channel?: number): void;
  liveNoteOff(key: number, channel?: number): void;
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

// ---- Storage results ----
export type StoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: 'unavailable' | 'quotaExceeded' | 'notFound' };

// ---- PerformanceStore (stored attempts, IndexedDB) ----
/** `StoredPerformance` without its `log` - what the attempts list needs (contracts/performance-log.md). */
export type StoredPerformanceSummary = Omit<StoredPerformance, 'log'>;

export interface PerformanceStore {
  /** Upsert by `runId`; trims that Score's performances to `PERFORMANCES_PER_SCORE_MAX`, oldest first (FR-041). */
  put(performance: StoredPerformance): Promise<StoreResult<void>>;
  /** Newest first (`byScoreFinished`), summaries only - no recording bytes for a list view. */
  listByScore(scoreId: string): Promise<StoreResult<readonly StoredPerformanceSummary[]>>;
  get(runId: string): Promise<StoreResult<StoredPerformance>>;
  /** Removes the record and therefore its recording (FR-043). */
  remove(runId: string): Promise<StoreResult<void>>;
  /** Removes every stored Performance of one Score (013 ports.md 1.5.0, R-12: reset progress / remove file and
   *  progress, OD-3/OD-4), so the attempts list never disagrees with progress that no longer counts them. Returns
   *  the number removed. */
  removeByScore(scoreId: string): Promise<StoreResult<number>>;
}

// ---- ProgressStore (progress records, *My files* and their file copies; contracts/013 progress-store.md 1.0.0) ----
export type ProgressStoreError = 'unavailable' | 'full' | 'notFound' | 'corrupt';
export type ProgressStoreResult<T> = { ok: true; value: T } | { ok: false; error: ProgressStoreError };

export interface ProgressStore {
  /** 'available' | 'unavailable' (no IndexedDB, blocked, private mode). Never throws. */
  availability(): Promise<'available' | 'unavailable'>;
  /** All readable records. Unreadable or unknown-format records are skipped and counted in `skipped`. */
  listProgress(): Promise<ProgressStoreResult<{ records: readonly ProgressRecord[]; skipped: number }>>;
  getProgress(scoreKey: string): Promise<ProgressStoreResult<ProgressRecord | null>>;
  /** Applies one event with `applyProgressEvent` atomically (read, reduce, write in one transaction) and returns the
   *  new record, or null after `reset`. Idempotent for `played`/`resultRemoved` with the same runId. */
  apply(
    scoreKey: string,
    event: ProgressEvent,
    thresholds: MasteryThresholds,
  ): Promise<ProgressStoreResult<ProgressRecord | null>>;

  // ---- My files (data-model.md §5) ----
  /** Entries without bytes, newest `lastOpenedAt` first, then `fileKey` ascending. */
  listFiles(): Promise<ProgressStoreResult<readonly UserFileEntry[]>>;
  /** Upsert by `fileKey` after a successful load: new entry, same content (touch), or new version (FR-021, via
   *  `nextEntry`). Tries to keep a copy of `bytes` within `USER_FILES_BYTES_BUDGET`, evicting least recently opened
   *  copies of *other* entries first. Returns the entry; `entry.stored === false` when no copy could be kept (not
   *  an error). */
  putFile(file: {
    fileName: string;
    bytes: ArrayBuffer;
    hash: string;
    title: string | null;
    composer: string | null;
    openedAt: string;
  }): Promise<ProgressStoreResult<UserFileEntry>>;
  /** The stored copy; `notFound` when the entry has none (`stored === false`) or does not exist. */
  getFileBytes(fileKey: string): Promise<ProgressStoreResult<{ entry: UserFileEntry; bytes: ArrayBuffer }>>;
  /** Removes the entry (and its copy, unless another entry shares the same hash). With `withProgress`, also resets
   *  the progress of `hash` and every `earlierHashes` (the caller deletes the Performances, contracts §4). */
  removeFile(fileKey: string, options: { withProgress: boolean }): Promise<ProgressStoreResult<void>>;
}

/** Which optional overlay layers are drawn (contracts/view-settings.md). */
export interface OverlayFlags {
  cursor: boolean;
  marks: boolean;
  advice: boolean;
  pianoKeys: boolean;
  notices: boolean;
}

export interface UserSettings {
  /** 3 since feature 019 (ports 2.2.0, view-settings 2.2.0): adds the two levels; versions 1 and 2 still read. */
  version: 3;
  volume: number;
  // `tempoPercent` removed in feature 012-tempo-bpm-field (FR-015, view-settings.md 2.1.0): the transport factor
  // is never carried over between Scores, so it is not persisted.
  /** Score size in percent, 50-200 in steps of 10; 100 = fitted to the viewport (v1 called this `zoomPercent`). */
  scale: number;
  follow: boolean;
  overlays: OverlayFlags;
  /** Metronome click level, integer 0..100, one value for all Scores (019 FR-007). */
  metronomeLevel: number;
  /** Orchestra level, integer 0..100, one value for all Scores (019 FR-007). */
  orchestraLevel: number;
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
  /** Writes every change still waiting for its debounced write, now: the page is going away (`pagehide`, hidden).
   *  Never throws (ports 2.1.0, 017 T039). */
  flushPending(): void;

  /** Practice settings for a Score id, falling back to the musician's last-used defaults, then to the built-in
   *  ones. A null id (Score not stored) returns the defaults and never persists (ports 1.1.0). */
  loadPractice(scoreId: string | null): PracticeSettings;
  /** Stores the settings for that Score id and updates the last-used defaults. No-op for a null id. */
  savePractice(scoreId: string | null, settings: PracticeSettings): void;

  /** Play settings for a Score id, falling back to the musician's last-used defaults, then to the built-in ones. */
  loadPlay(scoreId: string | null): RunSettings;
  /** Stores the settings for that Score id and updates the last-used defaults. No-op for a null id. */
  savePlay(scoreId: string | null, settings: RunSettings): void;

  /** Copies per-Score Practice and Play settings from the first of `fromHashes` that has an entry to `toHash`, when `toHash`
   *  has no entry of its own (feature 011, library-port 1.2 §4: an item that replaced another inherits its settings). A loop
   *  and a measure range belong to one Score and are not copied. Never overwrites, never deletes the old entry, never throws
   *  (storage errors are swallowed like every other write). Returns true when something was copied. */
  adoptScoreSettings(fromHashes: readonly string[], toHash: string): boolean;

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

// ---- LibraryCatalog (bundled practice score shelf; fetch + Cache Storage) ----
export type CatalogError = 'unavailable' | 'notFound' | 'malformedIndex' | 'tooLarge';
export type CatalogResult<T> = { ok: true; value: T } | { ok: false; error: CatalogError };

export interface LibraryCatalog {
  /** The parsed, validated index. Cached in memory for the session after the first success. */
  index(): Promise<CatalogResult<LibraryIndex>>;
  /** One item's raw bytes, by its `file` path from the index. Never larger than MAX_FILE_BYTES. With
   *  `expectedHash` (the index entry's `hash`) a cached copy is used only if its content hash equals it. */
  item(file: string, expectedHash?: string): Promise<CatalogResult<ArrayBuffer>>;
} // contracts/library-port.md §1
