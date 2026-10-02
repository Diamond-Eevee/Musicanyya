# Data Model: Live Piano and Audio Setup (feature 021)

Entities, state machines and named constants this feature adds or changes. Decisions: [research.md](research.md).

## 1. Live sound state (UI store, `src/ui/state/midiState.ts`)

`midiState` gains one field:

```ts
type LiveSound = 'locked' | 'loading' | 'ready' | 'failed';
interface MidiStateFields {
  // existing: availability, devices, pressedKeys, sustainDown, latencyMs
  liveSound: LiveSound;        // new, initial 'loading'
  lockedHintShown: boolean;    // new, true once the "click to turn on sound" hint was shown this page load
}
```

Derived in `session.ts` from `AudioEngine` `state` events, nowhere else:

| Engine state | `liveSound` |
|---|---|
| `idle` (before `prepare()` resolves) | `loading` |
| `suspended`, reason `browserPolicy` | `locked` |
| `loadingSound` | `loading` (unless `locked`: locked wins - the musician must click first) |
| `ready` | `ready` |
| `suspended`, reason `hidden` / `deviceChanged` | unchanged (the engine resumes by itself; a run handles `deviceChanged` as today) |
| `error` | `failed` |

State machine (browser; the desktop app goes straight from `loading` to `ready`):

```text
loading --(context suspended by browser policy)--> locked
locked  --(first pointerdown/keydown anywhere -> unlock())--> loading | ready
loading --(sound loaded, context running)--> ready
any     --(engine error)--> failed      (terminal until reload; keys still drawn)
```

The engine holds its `loadingSound` / `ready` reports while the context is locked and releases them when it runs, so
"locked wins" needs no rule in `session.ts`. A first note-on while still `loading` (before `locked` is known) counts for
the hint: it is shown as soon as the state turns `locked`.

Rules: every MIDI message is sent to the engine in every state (the engine ignores it while nothing can sound);
`lockedHintShown` becomes true on the first note-on while `locked` and never goes back during the page load.

## 2. MIDI keyboard state (shown in the top bar)

Unchanged fields (`availability`, `devices`); new **display state** computed by a pure function
`midiStatus(availability, devices, lostRecently)` in `src/ui/state/midiStatus.ts`:

| Display state | When | Icon shape | Label |
|---|---|---|---|
| `connected` | availability `available` and >= 1 device connected | keyboard + check | device name, or "{n} keyboards" |
| `none` | `available`, no device | keyboard outline | "No MIDI keyboard" |
| `lost` | the last connected device was lost and none connected | keyboard + cross | "MIDI keyboard disconnected" |
| `notRequested` | not asked yet (request pending or failed silently) | keyboard + question mark | "Connect MIDI keyboard" |
| `denied` | permission denied | keyboard + slash | "MIDI not allowed" |
| `notSupported` | no Web MIDI | keyboard + slash | "MIDI not supported" |

`lost` turns into `connected` on reconnect and into `none` only when the user opens the popover (so a loss is never
missed).

## 3. Latency profile (existing entity, constitution vocabulary)

`LatencyProfile` (`src/core/grade/types.ts`) is **unchanged** - it is stored in every Performance log, so its shape stays
(performance-log contract unchanged). Meaning made precise:

| Field | Assumed profile | Calibrated profile |
|---|---|---|
| `outputLatencyMs` | reported `baseLatency + outputLatency` now | reported output latency at calibration time |
| `inputLatencyMs` | 0 (no estimate tracked) | `T - outputLatencyMs`, `T` = median tap offset |
| `source` | `'assumed'` | `'measured'` (UI word: "calibrated") |
| `measuredAt` | `null` | ISO 8601 of the calibration |

Invariant: for a calibrated profile, `outputLatencyMs + inputLatencyMs = T` (grading compensates with the sum).

**Profile in use** (engine): `calibration ?? assumed`, where `calibration` is set by
`AudioEngine.setLatencyCalibration()` from the stored file at start-up and after each calibration.

Stored file `musicanyya.latency.v1` (performance-log contract "Latency profile", amended additively here):

```ts
interface LatencyProfileFile {
  version: 1;
  profile: LatencyProfile;      // source 'measured'
  outputDeviceId?: string;      // new, optional: the output the calibration was made with ('' = system default)
}
```

Missing or invalid file -> no calibration (assumed in use). Clearing ("Use assumed latency") removes the key.

Drift found while planning: `LocalSettingsStore.saveLatencyProfile()` writes the bare `LatencyProfile`, not the
contract's `{ version, profile }` wrapper, and its reader expects the bare form. Fix: the writer writes the contract's
wrapper (with `outputDeviceId`); the reader accepts both the wrapper and the bare form (written by builds 003-020) and
ignores anything else.

## 4. Calibration run (app layer, `src/app/calibration-session.ts`)

```ts
type CalibrationPhase = 'idle' | 'countIn' | 'tapping' | 'done' | 'failed' | 'cancelled';
interface CalibrationState {
  phase: CalibrationPhase;
  tapsCollected: number;           // valid taps so far, shown as "n / CALIBRATION_BEATS"
  beat: number;                    // beats heard so far (0 during the count-in)
  result: LatencyProfile | null;   // 'done' only
  failure: 'notEnoughTaps' | 'spreadTooLarge' | null;   // 'failed' only
  startedAtMs: number | null;      // performance.now() when the beat was anchored, while running; the e2e helper times taps from it
}
```

```text
idle --start (no run active, sound ready)--> countIn --(count-in clicks over)--> tapping
tapping --(last click + half a beat)--> done | failed
countIn | tapping --(cancel, or any run starts, or sound lost)--> cancelled
done | failed | cancelled --start--> countIn
```

- Taps: MIDI note-on (any key, any velocity > 0) or, with no MIDI keyboard connected, the space bar. A tap belongs to
  the nearest click within half a beat; others are ignored.
- `done` saves the file, calls `setLatencyCalibration`, and marks the Score schedule for re-delivery.
- Exposed to the UI through a store `latencyState` (`src/ui/state/latencyState.ts`): calibration state, profile in use,
  current reported output latency, output section (5).

## 5. Audio output setting (`musicanyya.audio.v1`)

```ts
interface AudioOutputFile {
  version: 1;
  outputDeviceId: string | null;   // null = system default
}
interface OutputChoice {           // what the UI lists
  id: string;                      // '' = system default
  label: string;
  available: boolean;
}
type OutputCapability =
  | { kind: 'choosable' }                                   // desktop app with setSinkId and labelled devices
  | { kind: 'systemDefaultOnly'; reason: 'browser' | 'notSupported' };
```

Rule (applied at start-up and on every `devicechange`): **active = saved device if present in the list, else system
default**. A change from saved to default because the device vanished emits notice `audioOutputLost` once; the device
coming back switches back silently.

Output path description (FR-026), a pure function of the Shell: Windows desktop -> "Windows audio (shared mode)";
macOS desktop -> "macOS audio"; Linux desktop -> "System audio"; browser -> "Browser audio".

## 6. Named constants (`src/core/defaults.ts`)

| Constant | Value | Status |
|---|---|---|
| `CALIBRATION_BEATS` | 16 | existing |
| `CALIBRATION_TEMPO_QPM` | 80 | existing |
| `CALIBRATION_MAX_SPREAD_MS` | 60 | existing |
| `CALIBRATION_COUNT_IN_BEATS` | 4 | **new**: accented clicks before taps count |
| `CALIBRATION_MIN_TAPS` | 8 | **new**: fewer valid taps -> `notEnoughTaps` (half of `CALIBRATION_BEATS`) |
| `CALIBRATION_WINDOW_BEATS` | 0.5 | **new**: a tap belongs to a click within this many beats; the calibration ends this long after the last click |
| `AUDIO_TIME_EPSILON_SEC` | 0.000001 | **new** (`src/engine/config.ts`): audio-clock times closer than this are the same instant |
| `CALIBRATION_MIN_CLICK_LEVEL` | 50 | **new**: the calibration click is never softer than this % of the Metronome channel, and a Play-setup mute is ignored |
| `AUDIO_OUTPUT_FALLBACK_MAX_MS` | 2000 | **new** (`src/engine/config.ts`): FR-025 bound, used by the e2e check |
| `MIDI_STATUS_UPDATE_MAX_MS` | 1000 | **new** (`src/engine/config.ts`): FR-019 bound, used by the e2e check |
| `LOCKED_HINT_MS` | 8000 | **new** (`src/engine/config.ts`): how long the "click to turn the sound on" hint stays (FR-003) |
| `TRANSPORT_BUTTON_MIN_PX` | measured | **new** (UI layer): smallest transport button side, fixed from the 020 build by the task (FR-023) |

## 7. Menu and panel model (`src/ui/layout/menu-model.ts`, `src/ui/state/viewState.ts`)

- Setup menu entries: `setup`, `latency` (was `setup`, `midi`, `latency`).
- `RUN_OK_PANEL: PanelId` becomes `RUN_OK_PANELS: ReadonlySet<PanelId> = new Set(['sound', 'midi'])`.
- Panel `'midi'` is opened only by `mx-midi-status`; panel `'latency'` keeps its menu entry and is idle-only.
