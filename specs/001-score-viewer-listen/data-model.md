# Data Model: Score Viewing & Listen Mode (feature 001)

Types are TypeScript-shaped and normative in structure (names may be refined in implementation, contracts updated).
Rules come from research R-8 (MusicXML semantics) and R-10..R-13. `Ticks` are integers on the Score's PPQ.

## 1. Canonical Score model (`src/core/score/model.ts`, pure)

```ts
type Ticks = number;                 // integer
type NoteId = string;                // research R-8.2, contracts/render-copy.md
type MeasureId = string;             // "ms-{index}"

interface Score {
  title: string | null; composer: string | null;
  ppq: number;                       // lcm(960, all divisions), <= MAX_PPQ
  parts: Part[];
  measures: MeasureInfo[];           // notation order, shared across parts (index = position in the first part)
  tempoMarks: TempoMark[];           // notated order, merged across parts
  navigation: NavigationMarks;       // repeats, endings, jump targets and jumps per measure (R-8.3)
  defaultTempoUsed: boolean;
}

interface MeasureInfo {
  index: number; id: MeasureId; label: string;       // label = MusicXML number attribute (display only)
  startTick: Ticks;                                  // in notation order (no repeats)
  lengthTicks: Ticks; nominalTicks: Ticks;           // content length vs time signature
  implicit: boolean; beatOffsetTicks: Ticks;         // pickup support (later Metronome/Practice)
  time: { beats: string; beatType: number } | null;  // new time signature starting here
}

interface Part {
  index: number; xmlId: string; name: string;
  staves: number;
  instruments: Instrument[];                         // first = default
  notes: Note[];                                     // playable notes only, sorted by (measure, onset, staff, voice, key)
  dynamics: DynamicMark[]; wedges: Wedge[];
  transpositions: Transposition[];                   // with start measure/onset
}

interface Instrument {
  xmlId: string; name: string;
  program: number;                                   // GM 0..127 (MusicXML 1-based minus 1); fallback 0 (piano)
  bank: number | null; channelHint: number | null;   // MusicXML midi-channel minus 1
  percussion: boolean; unpitchedKey: number | null;  // midi-unpitched minus 1
  volume: number | null; pan: number | null;         // CC7 / CC10 values
  fallback: boolean;                                 // true -> "unknown instrument, piano used" notice
}

interface Note {
  id: NoteId;
  part: number; staff: number; voice: string;
  measureIndex: number;
  onsetInMeasure: Ticks; onsetQuarters: { num: number; den: number };  // reduced fraction (Note ID)
  durationTicks: Ticks;                              // 0 for grace notes
  writtenKey: number; soundingKey: number;           // MIDI numbers (transposition applied to sounding)
  unpitched: boolean;
  grace: null | { index: number; slash: boolean; stealPrevious: number | null; stealFollowing: number | null; makeTime: number | null };
  tie: { start: boolean; stop: boolean };            // from <tie> (or <tied> when no <tie>)
  chord: boolean;
  instrument: string | null;                         // <instrument id> override
  velocityOverride: number | null;                   // <note dynamics>
  accent: boolean;
  fingerings: Fingering[];                           // R-8.8, never affects playback
  printed: boolean;                                  // print-object
  source: { start: number; end: number };            // offsets of the <note> element in the decoded text
}

interface Fingering { text: string; finger: 1 | 2 | 3 | 4 | 5 | null; substitution: boolean; alternate: boolean; placement: "above" | "below" | null }
```

Validation (builder): out-of-range values are clamped or dropped with a Load report entry; nothing throws.

## 2. Load report (`src/core/score/load-report.ts`)

```ts
type Severity = "info" | "warning";
interface LoadReportEntry { code: LoadNoticeCode; severity: Severity; measureLabels: string[]; element?: string; detail?: string }
interface LoadReport { entries: LoadReportEntry[]; skippedElementCount: number }
type LoadNoticeCode =
  | "unsupportedElement" | "timingRounded" | "divisionsInvalid" | "cursorClamped" | "measureLengthMismatch"
  | "measureRepeatOnlyRests" | "brokenTie" | "jumpTargetMissing" | "jumpInferredFromText" | "endingNoMatch"
  | "repeatTooDeep" | "unrollGuardHit" | "tempoTextIgnored" | "instrumentFallback" | "unpitchedWithoutSound"
  | "defaultTempo" | "middleBarlineRepeat";
```

Entries with the same code are grouped for the notice ("Skipped: 3 x `<harmony>` in m. 4, 7, 9").

## 3. Playback timeline (`src/core/timeline/`)

```ts
interface MeasurePass { measureIndex: number; passNo: number; startTick: Ticks; lengthTicks: Ticks }  // unrolled order
interface NoteOccurrence { noteId: NoteId; passIndex: number }        // key of the schedule (R-8.2)

interface SoundingEvent {                                             // one attack (ties merged)
  head: NoteOccurrence; members: NoteId[];                            // tie chain members in order
  part: number; channel: number; key: number /* sounding */; velocity: number;
  startTick: Ticks; endTick: Ticks;                                   // unrolled ticks; grace timing applied
}
interface VisualSpan { noteId: NoteId; startTick: Ticks; endTick: Ticks }   // highlight span per notehead per pass

interface PlaybackTimeline {
  ppq: number; endTick: Ticks;
  passes: MeasurePass[];
  events: SoundingEvent[];          // sorted by startTick
  spans: VisualSpan[];              // sorted by startTick
  tempo: TempoSegment[];            // on unrolled ticks, first at 0
  channels: ChannelSetup[];         // 16 entries
  leadInTicks: Ticks;               // grace notes before the first beat (>= 0)
}
interface TempoSegment { startTick: Ticks; qpmNum: number; qpmDen: number }   // exact quarter notes per minute
interface ChannelSetup { used: boolean; program: number; bankMsb: number; percussion: boolean; volume: number | null; pan: number | null }
```

Rules: unrolling per R-8.3; ties resolved on the unrolled order (R-8.4); grace timing after unrolling (R-8.1);
velocity per R-8.6; channels per R-8.7 (channel 9 = percussion, channel 15 = live input, others allocated in part
order, parts with the same program share a channel beyond 14 melodic parts); seek rule: a measure index maps to its
**first** pass.

## 4. Engine schedule (`src/core/schedule/compile.ts`)

`PlaybackTimeline` -> the `ScheduleMessage` arrays of contracts/worklet-protocol.md: program/bank/volume/pan changes at
tick 0 per used channel, then each `SoundingEvent` as noteOn at `startTick` and noteOff at `endTick`; sorted by tick
with noteOff before noteOn and control changes first at equal ticks. Ticks are shifted by `leadInTicks` so all are
>= 0. `endTick < TICK_LIMIT (2^31)` is guaranteed or the build fails with `fileTooComplex`.

## 5. Transport (`src/core/transport/transport.ts`, pure reducer)

```ts
type TransportPhase = "stopped" | "loading" | "playing" | "paused";
interface TransportSnapshot { phase: TransportPhase; startTick: Ticks; positionTick: Ticks; tempoPercent: TempoPercent; volume: Volume; follow: boolean }
type TempoPercent = number;   // 25..200, multiple of 5
type Volume = number;         // 0..100
```

```text
stopped --play--> loading (sound not ready) --soundReady--> playing
stopped --play--> playing (sound ready)
playing --pause--> paused --play--> playing
playing|paused --stop--> stopped (positionTick = startTick)
playing --ended--> stopped (positionTick = startTick)
any --seekMeasure(m)--> same phase, startTick = positionTick = first pass of m
any --newScore--> stopped (startTick = 0)
loading --soundFailed--> stopped + notice
```

`follow` becomes false on manual scroll during `playing` and true on "Follow" or a new `play` from `stopped`.

## 6. Audio engine state and diagnostics (`src/engine/audio/`)

`AudioEngineState` per contracts/ports.md.

```ts
interface AudioDiagnostics {
  sampleRate: number | null; baseLatencyMs: number | null; outputLatencyMs: number | null;
  dropoutsSincePlay: number; dropoutsTotal: number; dropoutMethod: "browserStats" | "clockDrift" | "none";
  reportsPerSecond: number; lastReportAgeMs: number | null;
}
```

```text
idle --unlock (user gesture)--> ready? no: loadingSound --soundReady--> ready
ready --context interrupted / device change--> suspended --resume ok--> ready
any --fatal--> error (viewing still works; notice explains)
```

Device change: the AudioContext follows the default output; if it is suspended or interrupted, playback pauses with
an `audioDeviceChanged` notice and resumes on the next Play.

## 7. Environment (`src/engine/environment/probe.ts`)

```ts
interface Environment {
  shell: { kind: "browser"; browser: { name: string; version: string } | null }
       | { kind: "electron"; appVersion: string; electronVersion: string; chromeVersion: string; platform: string; bridgeVersion: string };
  builtInSound: Capability;         // AudioContext + AudioWorklet
  midiInput: Capability;            // Web MIDI + permission state
  audioPlugin: Capability;          // 001: unavailable, reason "notYetAvailable"
  recentScores: Capability;         // IndexedDB
  compressedFiles: Capability;      // DecompressionStream('deflate-raw')
  secureContext: boolean;
}
type Capability = { available: true } | { available: false; reason: CapabilityReason };
type CapabilityReason = "notSupported" | "permissionDenied" | "notRequested" | "insecureContext" | "notYetAvailable" | "desktopOnly" | "storageBlocked";
```

Browser name/version come from `navigator.userAgentData` where present (display only, never for decisions); the
shell kind comes only from `window.musicanyyaShell` (contracts/electron-bridge.md).

## 8. MIDI input (`src/engine/midi/web-midi-input.ts`)

`MidiDevice`, `MidiAvailability`, `MidiInputEvent` per contracts/ports.md. Per-device held-key set and sustain state;
`deviceLost` carries the held keys, and the session sends `liveAllOff` for them. Latency samples: ring of
`LATENCY_SAMPLES` dispatch delays; `keyToSoundMs = median + one block + base + output latency`.

## 9. Stored data

`RecentScoreRecord` and `UserSettings` per contracts/storage.md; SoundFont in Cache Storage.

```ts
interface UserSettings { version: 1; volume: Volume; tempoPercent: TempoPercent; zoomPercent: number; follow: boolean }
```

## 10. Named constants (`src/core/defaults.ts`, `src/engine/config.ts`)

| Constant | Value | Where / why |
|---|---|---|
| `BASE_PPQ` | 960 | R-8.1 |
| `MAX_PPQ` | 2^24 | R-8.1 guard |
| `TICK_LIMIT` | 2^31 | schedule arrays are `Int32Array` |
| `DEFAULT_TEMPO_QPM` | 100 | spec assumption, R-8.5 |
| `GRACE_NOTE_TICKS` | PPQ/8 | R-8.1 |
| `GRACE_MAX_STEAL_RATIO` | 0.5 | R-8.1 |
| `GRACE_MIN_REMAINING_TICKS` | PPQ/16 | R-8.1 |
| `MAX_REPEAT_DEPTH` | 4 | R-8.3 |
| `UNROLL_GUARD_FACTOR` / `UNROLL_HARD_CAP` | 10 / 20000 | R-8.3 loop guard |
| `INFER_JUMPS_FROM_TEXT` | true | R-8.3 |
| `DYNAMIC_VELOCITY` | ppp 20 ... fff 124 | R-8.6 |
| `DEFAULT_VELOCITY` | 80 | R-8.6 |
| `SFORZANDO_BOOST` / `ACCENT_BOOST` | 24 / 12 | R-8.6 |
| `WEDGE_TARGET_WINDOW_TICKS` / `WEDGE_DEFAULT_DELTA` | PPQ / 16 | R-8.6 |
| `VELOCITY_MIN` / `VELOCITY_MAX` | 1 / 127 | R-8.6 |
| `PERCUSSION_CHANNEL` / `LIVE_CHANNEL` | 9 / 15 | R-8.7, R-10 |
| `LIVE_VELOCITY_DEFAULT` | from key velocity | R-12 |
| `TEMPO_PERCENT_MIN` / `MAX` / `STEP` / `DEFAULT` | 25 / 200 / 5 / 100 | FR-011 |
| `VOLUME_DEFAULT` | 80 | FR-016 |
| `ZOOM_MIN` / `ZOOM_MAX` / `ZOOM_DEFAULT` | 50 / 200 / 100 | FR-003 |
| `RECENT_SCORES_MAX` | 10 | FR-007 |
| `MAX_FILE_BYTES` | 64 MiB | R-5 |
| `MAX_UNCOMPRESSED_BYTES` / `MAX_ZIP_ENTRIES` | 256 MiB / 1000 | R-6 |
| `MAX_XML_CHARS` / `MAX_ELEMENT_DEPTH` / `MAX_PARTS` / `MAX_MEASURES` | 64 Mi / 64 / 64 / 10000 | R-7 |
| `POSITION_REPORT_BLOCKS` | 4 | R-10 (<= 94 Hz) |
| `VOLUME_RAMP_FRAMES` | 256 | R-10 |
| `POSITION_HISTORY` | 32 | R-11 |
| `DROPOUT_CHECK_MS` / `DROPOUT_TOLERANCE_MS` | 500 / 20 | R-10 |
| `LATENCY_SAMPLES` | 32 | R-12 |
| `RELAYOUT_DEBOUNCE_MS` | 150 | R-9 |
| `SETTINGS_WRITE_DEBOUNCE_MS` | 500 | R-13 |
| `FOLLOW_MARGIN` | middle 60 % of the viewport | FR-014 |
