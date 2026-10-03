# Contract: audio setup - latency popup, calibration, output device

**Version**: `1.0.0` (new, feature 021). Owners: `src/ui/elements/mx-latency-panel.ts`, new
`src/app/calibration-session.ts`, new `src/ui/state/latencyState.ts`, `src/core/play/calibration.ts`, new
`src/core/play/calibration-schedule.ts`, `src/engine/audio/web-audio-engine.ts`, `src/engine/audio/output-device.ts`
(new), `src/engine/storage/local-settings-store.ts`, `electron/policy.ts`, `electron/main.ts`. Decisions: research R-6
to R-9. Spec: US2, US5, FR-009 to FR-015, FR-024 to FR-026.

## 1. Latency popup (panel `'latency'`, Setup > Latency)

Content, in order (all strings in `src/ui/i18n/en.ts` under `latency.panel`):

1. **Output latency**: "{n} ms" from `AudioEngine.latency().outputLatencyMs`, rounded; "Turns on with the sound" while
   `liveSound` is `locked` (a context that runs reports its latency even while the SoundFont still loads: SC-005); "Not reported by this browser" when null.
2. **Latency profile in use**: "Assumed (not calibrated)" or "Calibrated {date}: {total} ms" (total =
   output + input). When the current output device differs from the calibration's: "Calibrated with another output -
   calibrate again for the best timing".
3. Buttons: **Calibrate** (enabled when `liveSound === 'ready'`), **Use assumed latency** (only when calibrated).
4. While calibrating: instructions ("Play any key on the beat. No MIDI keyboard? Tap the space bar."), "Count-in..."
   or "{tapsCollected} / {CALIBRATION_BEATS}", **Stop** button.
5. After a calibration: the result ("Calibrated: {total} ms") or the failure reason
   (`notEnoughTaps`: "Too few taps on the beat - try again and play with every click.";
   `spreadTooLarge`: "The taps were too uneven to measure - try again, steady with the clicks.").
6. **Sound output** (section 3).

No `playState.grade` dependency (research R-8). The panel renders `latencyState` and dispatches `calibrate-start`,
`calibrate-stop`, `latency-reset`, `output-change` events; it computes no timing (constitution V).

## 2. Calibration

Core (pure, Node-tested):

```ts
// src/core/play/calibration-schedule.ts
export interface CalibrationSchedule {
  schedule: ScheduleMessage;            // Metronome-only, METRONOME_CHANNEL
  clickTimesSec: readonly number[];     // run-relative audio seconds of the CALIBRATION_BEATS counted clicks
  endSec: number;                       // last click + half a beat
}
export function compileCalibrationSchedule(ppq: number): CalibrationSchedule;
// CALIBRATION_COUNT_IN_BEATS accented clicks (METRONOME_KEY_DOWNBEAT), then CALIBRATION_BEATS clicks
// (METRONOME_KEY_BEAT), one per beat at CALIBRATION_TEMPO_QPM, encoded through compileSchedule.

// src/core/play/calibration.ts (existing, extended)
export function calibrateLatency(taps: readonly Tap[], msPerBeat: number, outputLatencyMs: number,
  measuredAt: string): CalibrationResult;
// Tap: { expectedTimeMs, tapTimeMs } on the audio clock (ms). Offsets beyond msPerBeat/2 ignored;
// < CALIBRATION_MIN_TAPS valid -> notEnoughTaps; spread > CALIBRATION_MAX_SPREAD_MS -> spreadTooLarge;
// else median T -> { outputLatencyMs, inputLatencyMs: T - outputLatencyMs, source: 'measured', measuredAt }.
```

`measuredAt` becomes a parameter (today `new Date()` inside the core - not deterministic, constitution IV).

App (`CalibrationController`):

- `start()`: only when no Listen / Practice / Play run is active and `liveSound === 'ready'`. Loads the calibration
  schedule, sets the Metronome channel volume (note below), plays, anchors `startAudioTimeSec` with
  `MidiClockMap.toAudioTime(now)` right after `play()` (the same code as `PlaySessionController.start()`, extracted to
  one shared helper `anchorRunStart()`).
- Taps: MIDI note-on (any key) mapped with `MidiClockMap.toAudioTime(timeStampMs)`; with no MIDI device connected,
  `keydown` Space mapped from `KeyboardEvent.timeStamp`; the Space shortcut (play/pause) is suppressed while calibrating.
- Ends at `endSec` (from position reports, never a timer deciding sound) -> `calibrateLatency(...)` with the current
  reported output latency -> `done` (save, `setLatencyCalibration`, schedule re-delivery flag) or `failed`.
- `cancel()`: on Stop, popup close, or any run start (FR-015); stops the engine, saves nothing.

Note on the Metronome level: calibration needs an audible click. It uses the musician's Metronome level, but never
less than `CALIBRATION_MIN_CLICK_LEVEL` (new constant, 50 %), and ignores a Play-setup mute. Nothing is restored
afterwards: every run that uses the click channel (Play, a replay) sets its own level at its start (play-run R-02), and
Listen and Practice have no clicks.

## 3. Sound output

```ts
// engine (ports 2.3.0)
interface AudioEngine {
  outputCapability(): OutputCapability;                    // data-model section 5
  listOutputs(): Promise<readonly OutputChoice[]>;         // [] when systemDefaultOnly; first entry = system default
  setOutput(deviceId: string | null): Promise<void>;       // null = system default; rejects -> stays where it was
  activeOutputId(): string;                                // '' = system default
}
type AudioEngineEvent = /* existing */ | { type: 'outputFallback'; lostDeviceId: string };
```

- `choosable` only when the Shell is the desktop app, `AudioContext.prototype.setSinkId` exists, and
  `enumerateDevices()` returns labelled `audiooutput` entries (research R-6).
- Rule (data-model section 5) applied by the engine at `prepare()` and on every `navigator.mediaDevices` `devicechange`;
  the fallback emits `outputFallback` once per loss within `AUDIO_OUTPUT_FALLBACK_MAX_MS`; the session turns it into the
  notice `audioOutputLost` ("The chosen sound output was disconnected; playing through the system default.").
- Timing rules (RT review of US5, 2026-10-02): moving the audio context to another device changes the output latency and can
  glitch, so (a) the moves the musician did not ask for - the start-up apply of the saved device and the silent return of
  a device - wait while a Listen / Practice / Play run, a replay or a calibration is going (`canSwitch`, supplied by the
  session; `WebAudioEngine.resumeOutput()` applies the waiting move, called once a second by the session) while (b) a lost
  device falls back at once, ends a calibration that was timing the click (`CalibrationController.cancel()`), and a Play
  run keeps the profile it started with (its log is not rewritten); (c) every call into the platform (`enumerateDevices`,
  `setSinkId`) is bounded by `AUDIO_OUTPUT_FALLBACK_MAX_MS` and a timeout counts as a failure; (d) a choice and a device
  change are handled one after the other; (e) a failed device list leaves what was learnt before; (f) the musician's last
  choice is also held in memory, so blocked storage cannot undo it; (g) `prepare()` and the first note never wait for any of it.
- UI: a `<select>` "Sound output" listing the choices (disabled during a run - the popup is idle-only anyway), the path
  line ("Windows audio (shared mode)" / "Browser audio" ...), and the fixed line
  "ASIO and other low-latency drivers need the Native audio plugin, which is not available yet." No other driver UI.
- `systemDefaultOnly`: the select is replaced by "System default output - change it in your system's sound settings."

### Desktop permission (electron/policy.ts)

- Both handlers are installed on `session.defaultSession` once `app` is ready (they used to be registered on
  `session-created`, which does not fire for the default session: the app then granted every permission - spike T053).
- Permission **check** handler (new, `session.setPermissionCheckHandler`): returns true only for `media` with
  `mediaType` `audio` (or unspecified) from the app origin - this exposes output-device labels and allows `setSinkId`.
- Permission **request** handler (`decidePermission`): `midi` **and `midiSysex`** from the app origin (the web page asks
  for `midiSysex` when it calls `requestMIDIAccess()` in this Electron; owner approved, 2026-10-02), everything else
  denied - `getUserMedia` is rejected (no microphone capture).
- Proven by the spike task before the UI task (research R-6, "Spike result"): labels present, `setSinkId` resolves, MIDI
  still opens, `getUserMedia` rejected; had it failed, `outputCapability()` would return `systemDefaultOnly` in the
  desktop app too and the owner would be told.

## 4. Persisted data

| Key | Shape | Rules |
|---|---|---|
| `musicanyya.latency.v1` | `{ version: 1, profile: LatencyProfile, outputDeviceId?: string }` | writer always writes this; reader also accepts the bare `LatencyProfile` of builds 003-020; invalid -> no calibration; "Use assumed latency" removes the key |
| `musicanyya.audio.v1` (new) | `{ version: 1, outputDeviceId: string \| null }` | invalid -> system default; written on each change |

`SettingsStore` (ports 2.3.0): `loadLatencyProfile()` keeps its signature (a stored calibration has
`source: 'measured'`; nothing stored -> the zero `assumed` placeholder, which the session treats as "no calibration");
new `loadLatencyOutputDeviceId(): string | null`; `saveLatencyProfile(profile, outputDeviceId?)` (optional second
argument, additive); new `clearLatencyProfile()`; new `loadAudioOutput(): string | null` and
`saveAudioOutput(id: string | null)`.

## 5. Tests that pin this contract

- Core: `compileCalibrationSchedule` click count, accents, spacing at 80 QPM, channel; `calibrateLatency` with taps
  exactly 30 ms late -> total 30 ms within 5 ms (SC-006), < 8 taps -> `notEnoughTaps`, uneven -> `spreadTooLarge`,
  invariant output + input = T, deterministic `measuredAt`.
- Engine: `latencyProfile()` returns the calibration when set, the assumed one after `setLatencyCalibration(null)`.
- Storage: both stored forms read; writer form; invalid content -> null; audio key round trip.
- App: a Play run started after calibration stores the calibrated profile in its Performance log; regrading an older
  stored log gives the identical Grade (golden, FR-014).
- e2e (chromium): fresh profile, no Play run: popup shows a latency value within 1 s of opening (SC-005); calibration
  with the fake MIDI keyboard tapping 30 ms late (`pressInTime` helper) -> "Calibrated: 30 ms" +-5, survives reload.
- e2e (electron): output list labelled; choosing the second fake/virtual device moves `AudioContext.sinkId`; survives a
  restart; `getUserMedia({ audio: true })` still rejects. Browser: the "System default output" line, no select.
