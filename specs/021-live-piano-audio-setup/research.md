# Research: Live Piano and Audio Setup (feature 021)

Phase 0 of [plan.md](plan.md). Every decision: **Decision / Rationale / Alternatives considered**. Facts about the
current code were read on branch `021-live-piano-audio-setup` at `c4fffee`; Web and Electron facts were checked on
2026-10-02 (sources at the end).

## R-1 Why the keys are silent today (root causes)

**Findings** (code read, not assumed):

1. `WebAudioEngine.unlock()` (creates the `AudioContext` and the worklet) and `ensureSoundLoaded()` are called only from
   `Session.handlePlay()` (`src/app/session.ts`). Before the first Play there is no worklet node, so
   `liveNoteOn()` posts to `this.node?.port` = nothing.
2. `session.ts` sounds a MIDI note only `if (practiceState.get().mode !== 'play')`; in Play mode it relies on
   `PlaySessionController`, which sounds input (`soundInput` effect, `src/core/play/run.ts`) **only while its run is
   `countIn` or `running`**. Play mode outside a run therefore sounds nothing - the owner's "I need to click Play the
   track".
3. Also found: in Play mode the **sustain pedal is never sounded** (the session skips it in Play mode and the reducer
   emits `soundInput` only for notes), and a note arriving before the run's first clock pair (`audioTimeSec === null`)
   is dropped before the reducer, so it is neither recorded nor sounded.
4. Live notes bypass the worklet's `heldNotes` tracking, so `schedule` / `stop` / `pause` / `seek` (which call
   `allNotesOff()` for the schedule) never cut a held live key. Only `liveAllOff()` does, and only on MIDI device loss.
   FR-006 already holds for runs; it must be kept.

## R-2 Starting the Audio engine at program start

**Decision**: split engine start-up from the user gesture. New port method `AudioEngine.prepare()` creates the
`AudioContext` (`latencyHint: 'interactive'`, as today), the worklet node and starts loading the piano sound, and
**never needs a gesture**. The session calls `prepare()` then `ensureSoundLoaded()` at start-up. `unlock()` keeps its
meaning (resume the context; idempotent) and is called from a one-shot **first-activation listener**
(`pointerdown` and `keydown`, capture phase, on `window`) as well as from `handlePlay()`.

- **Desktop app**: Electron's `webPreferences.autoplayPolicy` defaults to `no-user-gesture-required`, so the context
  starts `running` without any click (FR-001). The window sets it **explicitly** (electron-bridge 1.1.0) so a future
  Electron default change cannot silently break FR-001.
- **Browser**: a context created before user activation stays `suspended`; the worklet module, node and SoundFont can
  still be loaded meanwhile, so the first click only resumes it (FR-002). The engine already models this as
  `{ kind: 'suspended', reason: 'browserPolicy' }` (ports.md) - now actually emitted.

**Rationale**: the SoundFont (already in Cache Storage after the first visit) loads while the musician looks at the
browser, so the first key after the first click sounds at once. No session is active at start-up, so the SF2 parse in
the worklet does not violate the 50 ms rule of constitution I (it is the same work the first Play does today).

**Alternatives considered**: (a) unlock on the first MIDI key - rejected: a MIDI message is not user activation in
Chromium, `resume()` would stay pending; (b) a "Turn on sound" button - rejected: one more click than "any click" and
the spec asks for no click in the desktop app; (c) load the sound lazily on first key - rejected: the first notes would
be silent for seconds.

## R-3 One owner of the live sound

**Decision**: `session.ts`'s MIDI listener is the **single live-sound router**: it sounds every note-on, note-off and
sustain message in every mode and state, before any state update (as today for Listen and Practice).
`PlaySessionController` no longer touches the engine for input: it still records every message, and the reducer still
emits `soundInput` (pure core, unchanged tests), but the controller applies only `runEnded` (play-run 2.3.0 -> 2.4.0).

**Rationale**: "exactly once in every state" (FR-004, SC-003) is provable only if one place decides. The old split
(session outside Play mode, controller inside a live run) is exactly what left Play mode idle silent and the pedal mute
in runs (R-1). Mode or run-phase changes between a key's note-on and note-off can no longer route the two halves to
different owners. Sounding first, then updating state, keeps FR-008 (no added delay).

**Alternatives considered**: (a) keep the split and change the session's condition to "not while a Play run is live" -
rejected: still two owners, the pedal and the no-clock-pair case still need special rules, and a phase change between
note-on and note-off can still double or drop a half; (b) remove `soundInput` from the core reducer - rejected for now:
a breaking core change for no behavioural gain; the effect is documented as informational.

**Expected-value change** (to log at implementation): `tests/engine/play-session.test.ts` asserts that the controller
sends `liveNoteOn:60,70`; after this change it must assert that the controller sends **no** live command, and a new
session-level test asserts the router sends exactly one.

## R-4 The "sound is locked" hint and the loading state

**Decision**: a small UI store field `midiState.liveSound: 'locked' | 'loading' | 'ready' | 'failed'`, derived in
`session.ts` from engine `state` events (`suspended/browserPolicy` -> locked; `loadingSound` -> loading; `ready` ->
ready; `error` -> failed). The top-bar MIDI control shows it (FR-003, FR-007). The locked hint appears once per page
load, on the first MIDI key while locked, and disappears on unlock.

**Rationale**: the MIDI control is where a musician looks when a key makes no sound; one store, no new element.

**Alternatives considered**: a notice in the notice tray - rejected: notices persist and stack; the state is transient.

## R-5 MIDI access at start-up

**Decision**: the session calls `midiInput.request()` at start-up (no gesture) where Web MIDI exists. Chrome 124+
gates **all** Web MIDI behind a permission prompt; the prompt therefore appears at start-up once and is remembered by
the browser. Electron grants `midi` for the app origin (unchanged policy), so no prompt there. If the request is
denied or unsupported, the top-bar control shows that state and offers "Connect" (which calls `request()` again from a
click).

**Rationale**: spec assumption "asking at start-up is welcome in a piano app"; the prompt was already there, only
later.

**Alternatives considered**: query `navigator.permissions` first and only auto-request when already granted - kept as
an option if the owner finds the start-up prompt intrusive (not chosen: one more code path, and a first-time user
would then see no keyboard until they find the control).

## R-6 Choosing the audio output device

**Decision**: offered **in the desktop app only**, using `AudioContext.setSinkId()` and
`navigator.mediaDevices.enumerateDevices()` (`audiooutput` entries). The browser shows "System default output" and the
one-line explanation (FR-024 "where the Shell allows it", spec US5 scenario 2).

Facts that decide it:

- `AudioContext.setSinkId()` exists in Chrome / Edge 110+ only; Firefox and Safari do not support it.
- In Chromium, `enumerateDevices()` returns device labels (and selecting a non-default output is allowed) only after
  the page holds **microphone** permission; asking a musician for the microphone to choose their speakers is wrong, so
  the browser does not offer the choice.
- In Electron the permission *check* is answered by the app (`session.setPermissionCheckHandler`). Allowing the check
  `media` (audio only) for the app origin is expected to expose output-device labels and allow `setSinkId` **without**
  granting capture: the permission *request* handler still denies `media`, so `getUserMedia` keeps failing.
  **This is to be proven by a spike task before the UI is built** (tasks: spike + e2e asserting labels are present,
  `setSinkId` works and `getUserMedia({audio:true})` still rejects). If the spike fails, the desktop app also shows
  "System default output" and the owner is told; nothing else in the feature depends on it.

Behaviour:

- The saved choice is a device id (`musicanyya.audio.v1`, contracts/audio-output.md). Rule: **use the saved device
  when it is present, else the system default** - applied at start-up and on every `devicechange` event. So a lost
  device falls back to the default (FR-025, notice `audioOutputLost`) and a returning device is used again without a
  click.
- Changing the device is allowed only while no run is active (the Latency popup closes for runs anyway).
- After a change the shown output latency is re-read (it may differ per device).

**Alternatives considered**: (a) `MediaDevices.selectAudioOutput()` - Firefox only, and Firefox lacks
`AudioContext.setSinkId`; (b) an `<audio>` element fed by a `MediaStreamAudioDestinationNode` with
`HTMLMediaElement.setSinkId` - adds a buffer (latency) on the live path, rejected; (c) native device enumeration in the
Electron main process - needs a native module (new runtime dependency), rejected (owner: "keep it minimum").

## R-7 Driver selection (ASIO / WASAPI / DirectSound)

**Decision**: no driver selector (owner, spec Clarifications). Chromium on Windows renders through WASAPI shared mode;
DirectSound would only add latency. The Latency popup names the output path ("Windows audio, shared mode" on Windows
desktop, "Browser audio" elsewhere) and states that ASIO and other low-latency drivers need the Native audio plugin,
not yet available (FR-026). The Native audio plugin (ADR-0003) stays a later feature; its ASIO licence route is an owner
decision there.

**Alternatives considered**: a Node audio addon (RtAudio / PortAudio bindings) in Electron with the JS synth - rejected:
JavaScript in an ASIO callback cannot be allocation- and GC-free (constitution I), it is a new native runtime
dependency, and it is the job ADR-0003 gives to the plugin.

## R-8 Latency popup without a Play run

**Decision**: the Latency popup reads, at any time: the engine's reported output latency (`AudioEngine.latency()`,
available once the context exists - at start-up in the desktop app, after the first click in the browser), the
**Latency profile in use** (`AudioEngine.latencyProfile()`), its source and date, and the output section (R-6, R-7).
It no longer depends on `playState.grade`.

**Rationale**: FR-009, SC-005; the data was always available, the panel just read the wrong source.

## R-9 Calibration that works

Today `mx-latency-panel` starts a `setInterval` that plays nothing, takes space-bar taps on `performance.now()`, and the
saved profile is never read back (`loadLatencyProfile()` has no caller; `WebAudioEngine.latencyProfile()` always returns
`assumed`). The UI also computes timing, which constitution V forbids.

**Decision**:

1. **Clicks on the audio clock**: a core function `compileCalibrationSchedule()` builds a Metronome-only schedule
   (`CALIBRATION_COUNT_IN_BEATS` accented count-in clicks, then `CALIBRATION_BEATS` clicks at
   `CALIBRATION_TEMPO_QPM`) on `METRONOME_CHANNEL` through the existing `compileSchedule` encoding. The worklet plays it
   like any schedule - **no worklet change**.
2. **Measured exactly like a Play run is graded**: a new app-layer `CalibrationController`
   (`src/app/calibration-session.ts`) loads and plays that schedule, anchors the start with the same code path as
   `PlaySessionController.start()` (`MidiClockMap.toAudioTime(now)` right after `play()`), and maps each tap's
   `timeStampMs` onto the audio clock with the same `MidiClockMap`. Any systematic bias of that anchoring is then
   present in both calibration and grading and cancels out.
3. **Result**: `calibrateLatency()` (core, existing, extended) takes taps in ms on the audio clock; the median signed
   offset `T` is the whole round trip. The stored profile is `{ outputLatencyMs: reported output latency at
   calibration, inputLatencyMs: T - outputLatencyMs, source: 'measured', measuredAt }`, so grading's existing
   `compensation = output + input` equals `T` exactly - no grading change, golden tests unchanged.
4. **Taps**: any MIDI note-on (the key also sounds, R-3); without a MIDI keyboard the space bar
   (`KeyboardEvent.timeStamp`, same `performance.now()` domain). While calibrating, the space bar does not reach the
   play/pause shortcut.
5. **Validation**: offsets beyond half a beat are mis-taps (existing rule); new: fewer than `CALIBRATION_MIN_TAPS`
   valid taps -> `notEnoughTaps` (today only zero taps fails); spread over `CALIBRATION_MAX_SPREAD_MS` ->
   `spreadTooLarge` (existing).
6. **Use**: the session gives the stored profile to the engine at start-up and after a calibration
   (`AudioEngine.setLatencyCalibration(profile | null)`, ports 2.3.0); `latencyProfile()` returns it when set, else
   the assumed one. Every new Play run already copies `latencyProfile()` into its Performance log; replay and regrade
   already use the log's own copy (FR-014 holds today - kept by a regression test).
7. **Back to assumed**: `SettingsStore.clearLatencyProfile()` and `setLatencyCalibration(null)` (FR-013).
8. **Interplay**: calibration runs only with no run active; starting a run cancels it without saving (FR-015). After
   calibration the Score's schedule must be delivered again (the same `scheduleDelivered = false` path a Play run uses).

**Rationale**: constitution II (one clock, compensation measured), IV (deterministic: the profile is data stored in each
log), V (the UI renders state, the app layer times).

**Alternatives considered**: (a) keep the tap timing in the panel on `performance.now()` - rejected: no audible beat,
UI computing timing, and a different clock from grading; (b) anchor on the first worklet position report (more precise
in absolute terms) - rejected: grading anchors differently, so the calibration would not cancel grading's bias; (c)
measure output latency with a microphone loop-back - out of scope (spec assumption).

**Also stored**: the output device id the calibration was made with (`musicanyya.latency.v1` file gains optional
`outputDeviceId`); when the current output differs, the popup suggests calibrating again (constitution II: a profile
belongs to a device configuration). The profile is still used.

## R-10 MIDI keyboard in the top bar

**Decision**: a new bar slot `#midi-controls` holding a new element `mx-midi-status` (a button: icon + keyboard name),
between `#menu-controls` and `#run-status` (ui-shell 1.5.0 -> 1.6.0). It opens the existing panel id `'midi'` as a
non-modal popover (like Levels, feature 019), whose content is the reworked `mx-midi-panel`. The Setup menu (and the
overflow menu) lose the `midi` entry. `'midi'` joins `'sound'` as a panel allowed during runs (`RUN_OK_PANELS`).

- States, each with its own icon **shape** (constitution VI): connected (keyboard with a check), none (keyboard
  outline), disconnected (keyboard with a cross), not supported / denied (keyboard with a slash), plus the live-sound
  overlays locked (speaker with a lock) and loading (speaker with dots).
- Compact bar fit step: the name hides first (`mx-bar-compact`), the icon stays; the control never moves to the View
  popup.
- The popover shows devices, connect / retry, live input latency (moved from today's panel) and plain-word help.

**Alternatives considered**: a dedicated sidebar - rejected (score-first layout, feature 004); keeping the Setup entry
as well - rejected: two ways to one panel with no benefit (FR-020).

## R-11 Icon transport buttons

**Decision**: inline SVG icons (own drawing, `currentColor`, `aria-hidden="true"`) in `src/ui/icons/transport-icons.ts`;
each button keeps today's `aria-label` text and gains `title` = name plus shortcut (Space for play/pause, Esc for stop).
Disabled: lower opacity **and** a dashed outline (not colour alone). Minimum hit area stays at today's button size
(measured in an e2e test against the current value).

**Rationale**: no dependency (constitution VIII), themes for free through `currentColor` (feature 016 themes).

**Alternatives considered**: an icon font or icon library (new dependency, rejected); Unicode media symbols
(U+25B6 etc. - rendering differs by font and some become emoji, rejected).

## R-12 Risks to verify in tasks

- Practice `resetPractice()` sends `liveNoteOff` for accompaniment keys on the live channel; if the musician holds the
  same key, it is cut (FR-006). Covered by a test; fix by giving accompaniment its own channel only if the test fails.
- `schedule` messages re-apply channel setup; confirm by a worklet test that the live channel's sustain (CC64) and
  program survive a new schedule (FR-006).
- Browsers may suspend the context when the tab is hidden; returning to the tab must resume without a click
  (sticky activation) - covered by the existing `suspended/hidden` handling plus an e2e check.

## Sources

- Electron `webPreferences.autoplayPolicy` (default `no-user-gesture-required`):
  https://www.electronjs.org/docs/latest/api/structures/web-preferences
- `AudioContext.setSinkId()` (Chrome/Edge 110+, not Firefox/Safari; non-default device needs permission):
  https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/setSinkId
- Device labels need media permission: https://developer.mozilla.org/en-US/docs/Web/API/MediaDeviceInfo
- `speaker-selection` permission policy:
  https://developer.mozilla.org/docs/Web/HTTP/Headers/Feature-Policy/speaker-selection
- Web MIDI behind a permission prompt from Chrome 124: https://developer.chrome.com/blog/web-midi-permission-prompt
