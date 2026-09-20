# Contract: ports (engine layer interfaces)

**Version**: `1.1.0` (internal TypeScript contract between `src/engine` adapters and `src/ui`/`src/app`).
1.1.0 (feature 002, T030): `SettingsStore` gains `loadPractice` and `savePractice`; nothing existing changed.
Signatures are normative in shape; names may be refined during implementation, but every change must be reflected
here and the version bumped (MINOR for additions, MAJOR for breaking changes).

Constitution V: platform capabilities sit behind these ports. The UI depends on the ports, never on a concrete
adapter. Adapters in feature 001: `WebAudioEngine`, `WebMidiInput`, `IndexedDbScoreStore`,
`LocalStorageSettingsStore`, `BrowserEnvironmentProbe`. Fakes implement the same ports for tests (R-15).

```ts
// ---- shared ----
export type Unsubscribe = () => void;
export interface Emitter<E> { on(listener: (event: E) => void): Unsubscribe; }

// ---- AudioEngine (Web Audio engine now; Native audio plugin client later) ----
export type AudioEngineState =
  | { kind: "idle" }                                  // no AudioContext yet (needs a user gesture)
  | { kind: "loadingSound"; loadedBytes: number; totalBytes: number | null }
  | { kind: "ready" }
  | { kind: "suspended"; reason: "hidden" | "deviceChanged" | "browserPolicy" }
  | { kind: "error"; code: AudioErrorCode; detail: string };

export type AudioErrorCode = "notSupported" | "soundFontLoadFailed" | "workletLoadFailed" | "contextFailed";

export interface LatencyInfo {
  outputLatencyMs: number | null;       // base + output latency, null if the browser does not report it
  keyToSoundMs: number | null;          // estimate (R-12), null until enough key events were seen
  method: "reported" | "estimated";
}

export interface PositionUpdate {       // produced on the main thread from worklet reports (R-11)
  audibleTick: number;                  // integer ticks on the unrolled timeline
  playing: boolean;
}

export type AudioEngineEvent =
  | { type: "state"; state: AudioEngineState }
  | { type: "transport"; transport: TransportSnapshot }   // data-model §5
  | { type: "ended" }
  | { type: "latency"; latency: LatencyInfo }
  | { type: "dropout"; total: number };

export interface AudioEngine extends Emitter<AudioEngineEvent> {
  readonly kind: "webAudio" | "nativePlugin";
  /** Must be called from a user gesture handler; creates/resumes the AudioContext. Idempotent. */
  unlock(): Promise<void>;
  /** Loads (or reuses) the built-in instrument sound; progress arrives as "state" events. */
  ensureSoundLoaded(): Promise<void>;
  /** Replaces the engine schedule (stops playback first). */
  load(schedule: EngineSchedule): void;              // data-model §4
  play(): void; pause(): void; stop(): void;
  seekTick(tick: number): void;
  setTempoPercent(percent: TempoPercent): void;      // 25..200, multiple of 5
  setVolume(volume: Volume): void;                   // 0..100
  /** Live input (US3), applied as soon as possible. */
  liveNoteOn(key: number, velocity: number): void;
  liveNoteOff(key: number): void;
  liveSustain(down: boolean): void;
  liveAllOff(): void;
  /** Called every animation frame by the UI; returns the audible position (R-11). */
  audiblePosition(nowMs: number): PositionUpdate | null;
  latency(): LatencyInfo;
  diagnostics(): AudioDiagnostics;                   // data-model §6
  dispose(): Promise<void>;
}

// ---- MidiInput (Web MIDI now; plugin-reported input later) ----
export type MidiAvailability = "notRequested" | "available" | "notSupported" | "denied";
export interface MidiDevice { id: string; name: string; manufacturer: string; connected: boolean; }
export type MidiInputEvent =
  | { type: "devices"; devices: readonly MidiDevice[] }
  | { type: "availability"; availability: MidiAvailability }
  | { type: "noteOn"; deviceId: string; key: number; velocity: number; timeStampMs: number }
  | { type: "noteOff"; deviceId: string; key: number; timeStampMs: number }
  | { type: "sustain"; deviceId: string; down: boolean; timeStampMs: number }
  | { type: "deviceLost"; deviceId: string; heldKeys: readonly number[] };

export interface MidiInput extends Emitter<MidiInputEvent> {
  availability(): MidiAvailability;
  /** Must be called from a user gesture; resolves with the resulting availability. */
  request(): Promise<MidiAvailability>;
  devices(): readonly MidiDevice[];
}
// timeStampMs is MIDIMessageEvent.timeStamp (performance.now() domain), kept for later mapping onto the audio clock.

// ---- ScoreStore (recent Scores, IndexedDB) ----
export interface RecentScoreSummary { id: string; fileName: string; title: string | null; composer: string | null;
  byteLength: number; lastOpened: string /* ISO 8601 */; }
export type StoreResult<T> = { ok: true; value: T } | { ok: false; error: "unavailable" | "quotaExceeded" | "notFound" };

export interface ScoreStore {
  list(): Promise<StoreResult<readonly RecentScoreSummary[]>>;           // newest first, max 10
  put(file: { fileName: string; bytes: ArrayBuffer; title: string | null; composer: string | null })
    : Promise<StoreResult<RecentScoreSummary>>;                           // upsert by content hash, trims to 10
  get(id: string): Promise<StoreResult<{ summary: RecentScoreSummary; bytes: ArrayBuffer }>>;
  remove(id: string): Promise<StoreResult<void>>;
}

// ---- SettingsStore (tiny UI preferences, localStorage) ----
export interface SettingsStore {
  load(): UserSettings;                 // defaults on missing/invalid data (contracts/storage.md)
  save(settings: UserSettings): void;   // never throws; storage errors are reported once as a notice

  // 1.1.0, feature 002 (specs/002-practice-wait-mode/contracts/practice-settings.md)
  loadPractice(scoreId: string | null): PracticeSettings;              // Score's own, else last-used defaults, else built-in
  savePractice(scoreId: string | null, settings: PracticeSettings): void;   // no-op for a null id
}

// ---- EnvironmentProbe ----
export interface EnvironmentProbe { detect(): Promise<Environment>; }   // data-model §7
```

## Rules

- Ports are the only way UI code touches audio, MIDI or storage. `src/core` never imports this file.
- `AudioEngine.audiblePosition` is the only source of cursor/highlight timing for the UI (R-11).
- Every async method resolves; failures are values or `error` states, never unhandled rejections.
- The Native audio plugin (later feature) will implement `AudioEngine` (`kind: "nativePlugin"`) and report MIDI
  input through `MidiInput`; this contract is designed so that swap needs no UI change.
