# Tasks: Live Piano and Audio Setup

**Input**: Design documents from `specs/021-live-piano-audio-setup/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/live-sound.md, contracts/audio-setup.md,
contracts/top-bar.md, contracts/contract-changes.md, quickstart.md

<!--
  Format: `- [ ] T001 [P] [US1] Description with exact file path`
  States: `[ ]` open, `[~]` in progress with ` (claimed: <agent-id> <date>)`, `[x]` done, `[-]` dropped by the owner
  (AGENTS.md section 4). [deep] / [standard] / [light] = tier when it differs from the phase's **Model** line.
  Tests come BEFORE implementation (Constitution IV) and must fail first, for the reason named on the task.
  Real-time paths: no AudioWorklet processor change (plan). MIDI input routing and timing change (live router, calibration
  tap mapping, run-start anchor), so US1 and US2 end with an RT review.
  US1 creates the `#midi-controls` slot and `mx-midi-status` with only the live-sound marker and the locked hint (FR-003,
  FR-007 belong to US1); US3 adds the MIDI states and the popover to the same element.
  No owner decision blocks any task (plan, "Decisions and open items"). T053 is a spike whose failure changes US5's
  outcome, not its tasks: it is reported to the owner.
  Revised 2026-10-02 after analyze (A1-A9, owner: "go with recommended"): the start-up MIDI request moved from US3 (T046)
  into US1 (T017); new T068 (SC-004 key-to-sound check); T013, T017, T027, T055, T064 extended; T012, T048 reworded.
  No task was started before the revision.
-->

## Phase 1: Setup

**Model**: light (gemini-3.7-flash or claude-haiku-4-5; every standard and deep model fits too)

- [x] T001 Append a baseline entry to `specs/021-live-piano-audio-setup/implementation-log.md` with the summary lines of
  `pnpm test`, `pnpm lint` and `pnpm typecheck` on the branch before any code change (AGENTS.md 2.6), and set the
  `**Status**` line of `specs/021-live-piano-audio-setup/spec.md` from "Draft" to "In progress"
- [x] T002 [P] Fold the contract changes into the earlier features' documents, contract first (AGENTS.md section 6),
  exactly as listed in `specs/021-live-piano-audio-setup/contracts/contract-changes.md`:
  `specs/001-score-viewer-listen/contracts/ports.md` 2.2.0 -> 2.3.0, `specs/003-play-mode-grading/contracts/play-run.md`
  2.3.0 -> 2.4.0, `specs/003-play-mode-grading/contracts/performance-log.md` ("Latency profile": optional
  `outputDeviceId`, both stored forms read), `specs/001-score-viewer-listen/contracts/storage.md` (key table row
  `musicanyya.audio.v1`), `specs/001-score-viewer-listen/contracts/electron-bridge.md` 1.0.0 -> 1.1.0,
  `specs/004-score-first-layout/contracts/ui-shell.md` 1.5.0 -> 1.6.0 - each version line names "feature 021" and links
  the 021 contract that holds the full text
- [x] T003 [P] Add the named constants of `specs/021-live-piano-audio-setup/data-model.md` section 6, each with a
  one-line comment naming its research section: `CALIBRATION_COUNT_IN_BEATS = 4`, `CALIBRATION_MIN_TAPS = 8`,
  `CALIBRATION_MIN_CLICK_LEVEL = 50` next to `CALIBRATION_BEATS` in `src/core/defaults.ts`;
  `AUDIO_OUTPUT_FALLBACK_MAX_MS = 2000`, `MIDI_STATUS_UPDATE_MAX_MS = 1000`, `LOCKED_HINT_MS = 8000` in
  `src/engine/config.ts`; mirror the `src/core/defaults.ts` rows into the data-model constants table if a value differs
  (it must not)

---

## Phase 2: Foundational - port types, fakes, e2e seams (blocks Phases 3-7)

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)

- [x] T004 Add the ports 2.3.0 members to `src/engine/ports.ts` (contracts/live-sound.md section 1, audio-setup.md
  sections 3-4: `prepare`, `setLatencyCalibration`, `outputCapability`, `listOutputs`, `setOutput`, `activeOutputId`,
  event `outputFallback`, types `OutputChoice` / `OutputCapability`; `SettingsStore`: `saveLatencyProfile(profile,
  outputDeviceId?)`, `loadLatencyOutputDeviceId`, `clearLatencyProfile`, `loadAudioOutput`, `saveAudioOutput`), with
  stub implementations that keep today's behaviour in `src/engine/audio/web-audio-engine.ts` (`prepare` = no-op
  resolve, output = `systemDefaultOnly`), `src/engine/storage/local-settings-store.ts`, and the fakes
  `tests/fakes/fake-audio-engine.ts` (records `prepare`, `setLatencyCalibration:<total|null>`, `setOutput:<id>` in
  `commands`; settable `outputs`, `capability`, `fireOutputFallback()`) and `tests/fakes/memory-settings-store.ts`.
  Evidence: `pnpm typecheck` exit 0, `pnpm test` summary equal to the T001 baseline
- [x] T005 [P] Extend the e2e MIDI seam in `src/app/session.ts` (the `e2e-ready` / `e2e-midi` block): a new
  `e2e-midi-device` window event with detail `{ connected: boolean }` that emits `devices` (and `deviceLost` with the
  held keys on disconnect) for `fake-midi-1`, and a `e2e-ready` detail option `{ midi: 'none' | 'denied' |
  'notSupported' }` to start in those states; add helpers `connectFakeMidi(page)` / `disconnectFakeMidi(page)` in
  `tests/e2e/helpers/midi.ts` (new). Evidence: an existing MIDI e2e spec (`tests/e2e/pressed-keys.spec.ts`) still green
  on chromium
- [x] T006 [P] Add `spyOnLiveMessages(page)` to `tests/e2e/helpers/live-spy.ts` (new), modelled on
  `tests/e2e/helpers/schedule-spy.ts`: wraps the engine's worklet node `port.postMessage` and records `{ kind, key }`
  of every `type: 'live'` message, plus `audioContextState(page)` returning `mxSession.audioEngine`'s context state
  (or `null` when no context exists)
- [x] T007 [P] [light] Replace every caption assertion on a transport button
  (`toHaveText('Play' | 'Pause' | 'Stop' | 'Start')` on `.play-btn` / `.stop-btn` / the Start button) with
  `toHaveAccessibleName(...)` of the same word in `tests/e2e/electron-playback.spec.ts`, `guide-voice.spec.ts`,
  `helpers/practice.ts`, `levels.spec.ts`, `lookahead.spec.ts`, `mode-switch-run.spec.ts`, `piano-keyboard.spec.ts`,
  `play-tempo.spec.ts`, `pressed-keys.spec.ts`, `score-browser.spec.ts`, `tempo-field.spec.ts`, `us1-layout.spec.ts`,
  `us1-play.spec.ts`, `us1-practice.spec.ts`, `us2-listen.spec.ts`, `us2-panels.spec.ts`, `us3-run-chrome.spec.ts`,
  `us4-overlays.spec.ts` (about 55 lines; `grep -rnE "toHaveText\(['\"](Play|Pause|Stop|Start)['\"]" tests/e2e` must
  return nothing afterwards). Same state checked, by name instead of caption (US4 removes captions; log the reason).
  Evidence: those specs green on chromium before any US4 change

**Checkpoint**: foundation ready - `pnpm lint`, `pnpm typecheck`, `pnpm test` green; `pnpm test:e2e:smoke` green.

---

## Phase 3: User Story 1 - The piano always plays (Priority: P1) MVP

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)
**Goal**: every MIDI key and the pedal sound, exactly once, from start-up, in every mode and state.
**Independent Test**: desktop app, no Score, no click: a key sounds. Play mode without a run: keys sound. Start and stop
a run: keys sound once. Browser: after one click anywhere, keys sound (spec US1).

### Tests (write first, confirm they fail)

- [x] T008 [P] [US1] Live router unit test `tests/engine/live-router.test.ts` (fake engine, fake MIDI input, the
  session's MIDI listener): for each of at least 20 states of FR-004 (no Score; Score loading; Listen stopped / playing /
  paused; Practice idle / waiting / looping; Play mode idle / counting in / running / finished; replay; Grade, browser,
  Setup and Levels popups open; calibration placeholder state; after a mode switch; after a Score change) one
  note-on/note-off pair yields exactly one `liveNoteOn` and one `liveNoteOff`, one pedal down/up exactly one
  `liveSustain` each (SC-003); and no `liveAllOff` on a mode switch, run start, run stop or Score change (FR-006).
  Must fail today on the Play-mode states (silent) and the pedal during a run
- [x] T009 [P] [US1] Change the expected value in `tests/engine/play-session.test.ts` (the test asserting
  `liveNoteOn:60,70`, research R-3): the controller records the message and sends **no** live command; add the pedal
  and the "no clock pair yet" message to the same test (recorded when a clock pair exists, never sounded by the
  controller). Must fail today (the controller sounds the note). Log the expected-value change and its reason
- [x] T010 [P] [US1] Engine unit tests in `tests/engine/audio/web-audio-engine.test.ts`: `prepare()` with no gesture
  creates one context and one worklet node and emits `suspended` / `browserPolicy` when the (stubbed) context stays
  suspended; `unlock()` after it creates no second context; `prepare()` twice is idempotent; live messages before
  `prepare()` resolves are dropped without throwing and after it reach the node port; `ensureSoundLoaded()` works
  before `unlock()`. Must fail today (`prepare` is a stub)
- [x] T011 [P] [US1] Worklet regression tests in `tests/engine/worklets/` (new file `live-across-schedule.test.ts`,
  with the existing worklet shim): a live note held across a `schedule`, `play`, `stop`, `pause` and `seek` message keeps
  sounding until its note-off; the live channel's sustain (CC64) and program survive a new `schedule` (research R-12).
  Expected to pass today (pins FR-006 before the router change); if it fails, record it and add a fix task
- [x] T012 [P] [US1] Practice reset test in `tests/engine/` (new file `practice-held-key.test.ts`): a musician holding
  key K while Practice's accompaniment also used K, then switching mode, keeps K sounding until released (research
  R-12); record whether it fails today and, if it does, add a fix task (next free number) before T018 (analyze A7)
- [x] T013 [P] [US1] e2e `tests/e2e/live-piano.spec.ts` (chromium): (a) fresh page, no click, `e2e-midi` note-on ->
  no live message reaches the worklet, the context is suspended, the hint "Click anywhere on the page to turn the sound
  on" is visible once (a second note does not show it again); (b) one click on an empty part of the page, then a note
  -> exactly one live note-on reaches the worklet with the context running, no Score open (SC-002); (c) Play mode, no
  run: note -> one live note-on; (d) during a Play run and after stopping it: one live note-on per key (no double);
  (e) the page hidden and shown again (visibility emulation) -> the next note still reaches a running context without a
  new click (research R-12, analyze A5); (f) the SoundFont request routed to a 404 at start-up -> the `soundFontMissing`
  notice once, the top-bar marker shows "Sound failed to load", keys still drawn on the on-screen keyboard (spec edge
  case, analyze A4). Uses T005/T006 helpers. Must fail today on (a) hint, (b), (c) and (f)
- [x] T014 [P] [US1] e2e `tests/e2e/electron-live-piano.spec.ts` (electron project): window shown, no click at all,
  wait until the sound is loaded, `e2e-midi` note-on -> one live note-on reaches the worklet and the context is
  running (SC-001). Must fail today (no context before Play)

- [x] T068 [P] [US1] SC-004 check, `tests/e2e/live-latency.spec.ts` (chromium): the time from dispatching an `e2e-midi`
  note-on to its live message being posted to the worklet port (T006 spy, `performance.now()` both ends), median of 50
  presses in Listen mode while stopped (a state that sounds today). Run it on the T001 commit first and record the
  baseline median in the log; after T018 the median must be within 2 ms of it (SC-004, FR-008). The same spec repeated
  in Play mode idle must meet the same bound (fails today: no message at all)

### Implementation

- [x] T015 [US1] Implement `prepare()` in `src/engine/audio/web-audio-engine.ts` (contracts/live-sound.md section 1):
  create the context and the worklet without resuming; emit `suspended` / `browserPolicy` when the context is not
  running; `unlock()` reuses it; `ensureSoundLoaded()` no longer requires `unlock()`. T010 green
- [x] T016 [P] [US1] Set `webPreferences.autoplayPolicy: 'no-user-gesture-required'` explicitly in `electron/main.ts`
  with a comment linking electron-bridge 1.1.0; extend `tests/electron/policy.test.ts` only if the window options are
  exported there (otherwise T014 is the evidence)
- [x] T017 [US1] Start-up sequence in `src/app/session.ts` (live-sound.md section 2): call `prepare()` and
  `ensureSoundLoaded()` after mounting, install the one-shot first-activation `unlock()` listener (`pointerdown`,
  `keydown`, capture, on `window`, removed once running); request MIDI access at start-up where the Shell has Web MIDI
  (`midiInput.request()`, no gesture; research R-5, live-sound.md section 2 step 1 - without it the desktop app hears no
  keyboard until "Connect" is clicked, analyze A1); keep `handlePlay()`'s own `unlock()` and the `soundReady` /
  `engineUnlocked` flags consistent (set from engine state events, not only from `handlePlay`); a SoundFont that fails
  to load at start-up raises the existing `soundFontMissing` notice once (analyze A4). T014 green
- [x] T069 [US1] Fix found by T012: `releasePracticeSound` in `src/app/practice-sound.ts` (extracted from `session.ts` by T012,
  unchanged) skips an accompaniment key that is in `session.heldKeys`, the musician still holds it (FR-006); the Orchestra
  release stays as it is (own channel). `tests/engine/practice-held-key.test.ts` green. The Practice core's own `soundOff`
  effect for a unison key the musician holds is not in FR-006's list (mode switch, run start or stop, Score change): logged
  as an open observation, not changed
- [x] T018 [US1] Live router in `src/app/session.ts` (live-sound.md section 3): sound every note-on / note-off / pedal
  first, with no mode or run condition; in `src/app/play-session.ts` stop applying the `soundInput` effect to the engine
  (still passed to `callbacks.onEffect`). T008 and T009 green; T011, T012 still green
- [x] T019 [US1] Live-sound state in `src/ui/state/midiState.ts` (`liveSound`, `lockedHintShown`, data-model section 1)
  derived in `src/app/session.ts` from engine `state` events only; the first note-on while `locked` sets
  `lockedHintShown`
- [x] T020 [US1] Add the slot `#midi-controls` after `#menu-controls` in `src/ui/elements/mx-app.ts` and a first
  `src/ui/elements/mx-midi-status.ts` showing only the live-sound marker (speaker + lock / speaker + dots / speaker +
  cross, `src/ui/icons/midi-icons.ts` new) and the locked hint bubble for `LOCKED_HINT_MS` (contracts/top-bar.md
  section 2, its live-sound parts); strings in `src/ui/i18n/en.ts` (`midi.soundLocked`, `midi.soundLoading`,
  `midi.soundFailed`, `midi.lockedHint`). T013 green
- [x] T021 [US1] RT review with `.claude/agents/rt-audio-reviewer.md` of the live router (`src/app/session.ts` MIDI
  listener), `src/app/play-session.ts` input path and `WebAudioEngine.prepare()` / live posting: no added work before
  the engine call, no timers deciding sound, exactly-once routing; findings summarised in the log, blocking ones fixed

**Checkpoint**: US1 Independent Test passes (T013, T014, T068 and the quickstart US1 steps 1-6 with a real keyboard
where available). Checkpoint gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e:smoke`, and
`tests/e2e/live-piano.spec.ts` + `tests/e2e/live-latency.spec.ts` (chromium) + `tests/e2e/electron-live-piano.spec.ts`
(electron). Log, commit.

---

## Phase 4: User Story 2 - Latency that works (Priority: P2)

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)
**Goal**: the Latency popup shows the latency at any time; calibration plays an audible beat, measures like grading,
and its result is used by every new Play run.
**Independent Test**: fresh profile, no Play run: the popup shows a latency value; calibrate with taps 30 ms late ->
"Calibrated: 30 ms" (+-5), kept after reload; the next Play run's log carries it; old logs regrade unchanged (spec US2).

### Tests (write first, confirm they fail)

- [x] T022 [P] [US2] Core test `tests/core/play/calibration-schedule.test.ts`: `compileCalibrationSchedule(ppq)`
  gives `CALIBRATION_COUNT_IN_BEATS` downbeat-key clicks then `CALIBRATION_BEATS` beat-key clicks on
  `METRONOME_CHANNEL`, one per beat at `CALIBRATION_TEMPO_QPM`; `clickTimesSec` are the counted clicks' run-relative
  seconds (0.75 s apart at 80 QPM, first at 3.0 s); `endSec` = last click + half a beat; the schedule passes the
  worklet-protocol ordering checks used by `tests/core/schedule` tests. Fails today (no module)
- [x] T023 [P] [US2] Extend `tests/core/play/calibration.test.ts` for the new signature
  `calibrateLatency(taps, msPerBeat, outputLatencyMs, measuredAt)`: 16 taps exactly 30 ms late with output 12 ms ->
  `inputLatencyMs` 18, total 30 within 5 ms (SC-006); 7 valid taps -> `notEnoughTaps`; spread > 60 ms ->
  `spreadTooLarge`; taps beyond half a beat ignored; `measuredAt` returned as given (deterministic). Fails today
  (signature, min taps)
- [x] T024 [P] [US2] Storage tests in `tests/engine/storage/latency-profile.test.ts`: the writer writes
  `{ version: 1, profile, outputDeviceId }`; the reader accepts that and the bare profile of builds 003-020, rejects
  invalid content (-> `assumed` placeholder); `clearLatencyProfile()` removes the key; `loadLatencyOutputDeviceId()`.
  Fails today on the wrapper and clear
- [x] T025 [P] [US2] Engine test in `tests/engine/audio/web-audio-engine.test.ts`: `latencyProfile()` returns the
  calibration after `setLatencyCalibration(p)` and the assumed profile (reported output, input 0) after
  `setLatencyCalibration(null)`. Fails today (stub)
- [x] T026 [P] [US2] Controller test `tests/engine/calibration-session.test.ts` (fake engine, fake MIDI, fake clock):
  `start()` refused while a run is active or sound is not ready; loads the calibration schedule, sets the Metronome
  channel to `max(level, CALIBRATION_MIN_CLICK_LEVEL)` ignoring a mute, plays, anchors with `anchorRunStart()`; MIDI taps
  mapped with the clock map; Space taps only when no MIDI device is connected; ends from position reports at `endSec`
  (no timer); `done` saves the profile with the active output id and calls `setLatencyCalibration`; `failed` keeps the
  previous profile; `cancel()` and any run start -> `cancelled`, nothing saved; afterwards the Score schedule is marked
  for re-delivery. Fails today (no controller)
- [x] T027 [P] [US2] Grading regression in `tests/engine/play-session.test.ts` (or a new
  `tests/engine/latency-in-log.test.ts`): a Play run started after `setLatencyCalibration(p)` stores `p` in its
  Performance log; with a calibrated profile of total 30 ms, a recorded performance whose every note is played exactly
  30 ms after its onset grades every note correct and on time (SC-006, through the grade worker path, not
  `gradePerformance` inline); regrading a stored log recorded with an assumed profile gives a Grade identical to the
  existing golden (FR-014). The first two parts fail today (`latencyProfile()` always assumed)
- [x] T028 [P] [US2] e2e `tests/e2e/latency-setup.spec.ts` (chromium): fresh storage, no Play run: Setup > Latency
  shows a ms value within 1 s after the first click (SC-005) and "Assumed (not calibrated)"; Calibrate with the fake
  MIDI keyboard tapping 30 ms after each click (`pressInTime` timing from `tests/e2e/helpers/play.ts`) -> "Calibrated:"
  30 +-5 ms; reload -> still calibrated; random taps -> the failure text, previous profile kept; "Use assumed latency"
  -> back to assumed; starting Listen during calibration cancels it. Fails today

### Implementation

- [x] T029 [P] [US2] `src/core/play/calibration-schedule.ts` (new) per contracts/audio-setup.md section 2, encoded with
  `compileSchedule`. T022 green
- [x] T030 [P] [US2] Extend `src/core/play/calibration.ts` (min taps, output/input split, injected `measuredAt`) and its
  callers. T023 green
- [x] T031 [US2] Extract the run-start anchor of `PlaySessionController.start()` into `anchorRunStart()` in
  `src/app/run-anchor.ts` (new) and use it there (no behaviour change: `tests/engine/play-session.test.ts` unchanged
  apart from T009)
- [x] T032 [P] [US2] Storage in `src/engine/storage/local-settings-store.ts` and `tests/fakes/memory-settings-store.ts`:
  wrapper writer, both-form reader, `clearLatencyProfile`, `loadLatencyOutputDeviceId`. T024 green
- [x] T033 [P] [US2] `setLatencyCalibration` / `latencyProfile()` in `src/engine/audio/web-audio-engine.ts`. T025 green
- [x] T034 [US2] `CalibrationController` in `src/app/calibration-session.ts` (new) and the store
  `src/ui/state/latencyState.ts` (new, data-model section 4). T026 green
- [x] T035 [US2] Wire in `src/app/session.ts`: load the stored calibration at start-up into the engine; panel events
  `calibrate-start`, `calibrate-stop`, `latency-reset`; cancel on any run start (FR-015); schedule re-delivery after a
  calibration; remove the old `latencycalibrated` listener. T027 green
- [x] T036 [US2] Rework `src/ui/elements/mx-latency-panel.ts` to render `latencyState` only (contracts/audio-setup.md
  section 1 items 1-5, no timing code, no `playState.grade`), strings in `src/ui/i18n/en.ts` `latency.panel.*`; suppress
  the Space play/pause shortcut while calibrating in `src/ui/shortcuts.ts`. T028 green
- [x] T037 [US2] RT review with `.claude/agents/rt-audio-reviewer.md` of `src/app/calibration-session.ts`,
  `src/app/run-anchor.ts` and the calibration schedule: clicks on the audio clock, taps mapped like grading, end not
  timer-driven; findings summarised in the log, blocking ones fixed

**Checkpoint**: US2 Independent Test passes (T028 and quickstart US2 steps 1-5). Checkpoint gate + `latency-setup.spec.ts`
(chromium). Log, commit.

---

## Phase 5: User Story 3 - MIDI keyboard in the top bar (Priority: P3)

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)
**Goal**: the top bar always shows the keyboard state and opens its popover in one click; MIDI is requested at start-up.
**Independent Test**: start with the fake keyboard: its name in the bar, no click; disconnect -> "disconnected" within
a second; click -> popover; Setup has no MIDI entry; popover usable during a Play run (spec US3).

### Tests (write first, confirm they fail)

- [x] T038 [P] [US3] Unit `tests/ui/midi-status.test.ts`: `midiStatus()` (data-model section 2) for every availability
  x devices x lost combination, labels, the "{n} keyboards" label, and a distinct icon id per display state. Fails today
- [x] T039 [P] [US3] Update `tests/ui/menu.test.ts`: Setup = `setup`, `latency`; the `more` menu has no `midi`; and
  `tests/ui/midi-panel.test.ts` for the new popover content (contracts/top-bar.md section 3: device text states, connect
  / try again, help texts, latency line). Fail today
- [x] T040 [P] [US3] e2e `tests/e2e/midi-topbar.spec.ts` (chromium): fake keyboard at start -> bar shows "Fake" with
  no click; `disconnectFakeMidi` -> "MIDI keyboard disconnected" within `MIDI_STATUS_UPDATE_MAX_MS`; reconnect -> "Fake";
  click the control -> popover lists the device; `e2e-ready` with `midi: 'denied'` / `'notSupported'` -> the right label
  and help; during a Play run the popover opens, the run keeps running and the cursor's box does not intersect it
  (SC-007, SC-008, FR-027). Fails today
- [x] T041 [P] [US3] Move the `'midi'` panel out of the menu-driven lists in `tests/e2e/helpers/panels.ts`,
  `tests/e2e/us2-panels.spec.ts`, `tests/e2e/theme-a11y.spec.ts` and `tests/e2e/panels-look.spec.ts`: the same checks
  (look, contrast, accessibility) opened through the bar control instead of Setup (helper `openMidiPopover(page)` in
  `tests/e2e/helpers/midi.ts`). Fails today (no bar control)

### Implementation

- [x] T042 [P] [US3] `src/ui/state/midiStatus.ts` (new) and the remaining state icons in `src/ui/icons/midi-icons.ts`.
  T038 green
- [x] T043 [US3] Complete `src/ui/elements/mx-midi-status.ts` (contracts/top-bar.md section 2: states, label,
  `aria-*`, toggles panel `'midi'`, Escape returns focus) and its compact fit (icon only) in `src/ui/elements/mx-app.ts`
  and the bar CSS (`src/ui/styles/`)
- [x] T044 [US3] Rework `src/ui/elements/mx-midi-panel.ts` as the popover (contracts/top-bar.md section 3), all
  strings to `src/ui/i18n/en.ts` `midi.*`. T039 (panel part) green
- [x] T045 [US3] Menu and run rules: remove `entry('midi')` from Setup in `src/ui/layout/menu-model.ts`;
  `RUN_OK_PANELS` in `src/ui/state/viewState.ts` and its use in `src/ui/state/runGuard.ts` and `closeForRun()`.
  T039 (menu part) green
- [x] T046 [US3] In `src/app/session.ts` (the start-up request itself is T017): "Connect" / "Try again" in the popover
  call `request()` from the click; the e2e seam's start states (`none`, `denied`, `notSupported`) reach `midiState`.
  T040, T041 green
- [x] T047 [US3] Picture check: `pnpm screenshot --item <a beginner library id>` in light and dark theme, bar with the
  control in roomy and compact width, popover open; look at each PNG and describe it in the log (AGENTS.md section 8)

**Checkpoint**: US3 Independent Test passes (T040 and quickstart US3 steps 1-4). Checkpoint gate + `midi-topbar.spec.ts`,
`us2-panels.spec.ts`, `theme-a11y.spec.ts`, `panels-look.spec.ts` (chromium). Log, commit.

---

## Phase 6: User Story 4 - Icon transport buttons (Priority: P4)

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)
**Goal**: transport buttons show icons, keep their names, gain tooltips.
**Independent Test**: each mode: icons, no captions, same accessible names, tooltips; legible in both themes (spec US4).

### Tests (write first, confirm they fail)

- [x] T048 [US4] Measure, before any US4 change, the captioned "Stop" button's height and the bar's content width at
  1280 x 800 with a Score open on the current build (a short Playwright script writing to `tests/.generated/`), and
  record both numbers in the log, the height as `TRANSPORT_BUTTON_MIN_PX` (new constant, UI config next to the other
  bar values, and its row in the data-model constants table) and the bar width as the baseline T049 compares with
- [x] T049 [US4] e2e `tests/e2e/transport-icons.spec.ts` (chromium): in Listen, Practice and Play mode every transport
  button contains an `svg`, has empty visible text, its accessible name as before and a `title` with the shortcut where
  it has one; play icon swaps to pause / stop while running; disabled skip buttons have a dashed border; each button is
  at least `TRANSPORT_BUTTON_MIN_PX` square; the bar content width is below the T048 baseline (SC-009). Fails today

### Implementation

- [x] T050 [P] [US4] `src/ui/icons/transport-icons.ts` (new): play, pause, stop, skip back, skip forward as inline SVG
  strings (`currentColor`, `aria-hidden="true"`, `focusable="false"`)
- [x] T051 [US4] `src/ui/elements/mx-transport.ts`: icons instead of `textContent`, unchanged `aria-label`, `title`
  with shortcut (contracts/top-bar.md section 5); disabled style (opacity + dashed border) and the minimum size in the
  transport CSS (`src/ui/styles/`). T049 green; T007's specs still green
- [x] T052 [US4] Picture check: `pnpm screenshot` in light and dark theme for Listen, Practice (running) and Play; look
  at each PNG and describe icons, disabled state and spacing in the log

**Checkpoint**: US4 Independent Test passes (T049 and quickstart US4). Checkpoint gate + `transport-icons.spec.ts` and the
T007 specs touching the transport (`mode-switch-run.spec.ts`, `us2-listen.spec.ts`, `us1-practice.spec.ts`) on chromium.
Log, commit.

---

## Phase 7: User Story 5 - Choose the audio output (Priority: P5)

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)
**Goal**: the desktop app chooses the output device, falls back when it vanishes; every Shell explains drivers honestly.
**Independent Test**: desktop: devices listed by name, choice moves the sound and survives a restart; device loss ->
default within 2 s with a notice; browser: "System default output" and the ASIO line, no driver choice (spec US5).

### Spike (decides what the desktop app can offer)

- [x] T053 [US5] Spike (research R-6): in a throwaway branch-local script under `tests/.generated/` or an e2e spec on
  the electron project, add `session.setPermissionCheckHandler` allowing `media` (audio) for the app origin and check
  (a) `enumerateDevices()` returns labelled `audiooutput` entries, (b) `AudioContext.setSinkId(<non-default id>)`
  resolves, (c) `getUserMedia({ audio: true })` still rejects with the request handler unchanged. Record the result in
  `research.md` R-6 and the log. If (a) or (b) fails: T057-T060 implement `systemDefaultOnly` for the desktop app too,
  T056 asserts that, and the owner is told at the next hand-off (spec US5 outcome changes, not scope). Remove the
  throwaway script
  Outcome 2026-10-02: (a) and (b) pass; (c) was false for the shipped app (its permission handler never ran). Owner approved
  ("Fix it: install handlers, allow midi + midiSysex"): T054 and T057 cover the fix; research R-6 "Spike result". No throwaway
  file was left in the repository.

### Tests (write first, confirm they fail)

- [x] T054 [P] [US5] `tests/electron/policy.test.ts`: `decidePermissionCheck('media', appOrigin, { mediaType: 'audio' })`
  true; video, other origins and every other permission false; `decidePermission` (requests) unchanged - `media` still
  false. Fails today (no function)
- [x] T055 [P] [US5] Unit `tests/engine/audio/output-device.test.ts` (fake `mediaDevices`, fake context with
  `setSinkId`): capability rules (desktop + setSinkId + labels -> choosable, else `systemDefaultOnly` with reason);
  the saved-or-default rule at start and on `devicechange`; a saved device missing at start-up -> default and
  `outputFallback` once (FR-024, analyze A6); `outputFallback` emitted once per loss; return of the device
  switches back silently; `setOutput` rejection keeps the previous device; storage round trip of `musicanyya.audio.v1`
  (in `tests/engine/storage/local-settings-store.test.ts`). Fails today
- [x] T056 [P] [US5] e2e `tests/e2e/electron-audio-output.spec.ts` (electron project; with the T053 outcome): the
  Latency popup lists the system default plus labelled devices; choosing another sets `AudioContext.sinkId`; restart
  -> still chosen; a simulated `devicechange` without the device -> default within `AUDIO_OUTPUT_FALLBACK_MAX_MS` and
  the `audioOutputLost` notice once; the path line and the ASIO line are shown. And in `tests/e2e/latency-setup.spec.ts`
  (chromium): "System default output - change it in your system's sound settings.", the ASIO line, no `select`. Fail
  today

### Implementation

- [x] T057 [P] [US5] `decidePermissionCheck` in `electron/policy.ts` and `session.setPermissionCheckHandler` in
  `electron/main.ts` (contracts/audio-setup.md section 3, "Desktop permission"). T054 green
- [x] T058 [US5] `src/engine/audio/output-device.ts` (new) and the output members of
  `src/engine/audio/web-audio-engine.ts` (`outputCapability`, `listOutputs`, `setOutput`, `activeOutputId`,
  `outputFallback`), storage `loadAudioOutput` / `saveAudioOutput` in `src/engine/storage/local-settings-store.ts`.
  T055 green
- [x] T059 [US5] Wire in `src/app/session.ts`: restore the saved output at start-up, `output-change` from the panel, the
  `audioOutputLost` notice (string in `src/ui/i18n/en.ts` `notices.audioOutputLost`), re-read the shown latency after a
  change; the calibration's output id (data-model section 3) compared for the "calibrated with another output" line
- [x] T060 [US5] "Sound output" section of `src/ui/elements/mx-latency-panel.ts` (contracts/audio-setup.md sections 1
  item 6 and 3: select or system-default line, output path line by Shell, ASIO line), strings in
  `src/ui/i18n/en.ts`. T056 green
- [x] T061 [US5] Picture check: `pnpm screenshot` of the Latency popup in the browser (and a manual desktop-app look via
  `pnpm electron:dev` with the device list) in light and dark theme; describe in the log

**Checkpoint**: US5 Independent Test passes (T056 and quickstart US5 steps 1-3). Checkpoint gate +
`electron-audio-output.spec.ts` (electron) and `latency-setup.spec.ts` (chromium). Log, commit.

---

## Phase 8: Polish & Cross-Cutting

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)

- [x] T062 [P] [light] Update `specs/021-live-piano-audio-setup/quickstart.md` and `README.md` where behaviour is
  described (sound from start-up, MIDI in the top bar, output choice in the desktop app); the toolchain section of
  `docs/agents/reference.md` only if a command changed (none planned)
- [x] T063 [P] [light] Update `docs/agents/reference.md` Active Technologies / Recent Changes from "planned" to
  "implemented" with the T053 outcome
- [ ] T064 Run the quickstart's manual script for US1-US5 (`pnpm dev`, `pnpm electron:dev`, a real MIDI keyboard where
  available, `pnpm screenshot` pictures) and record each step's result in the log, plus the spec's "very long session"
  edge case: leave the desktop app idle at least 30 minutes, then a key must sound without a click (analyze A9);
  anything not checkable on this machine is named as such
- [ ] T065 Constitution audit with `.claude/agents/constitution-auditor.md` over the feature diff; findings summarised in
  the log, blocking ones fixed or turned into tasks
- [ ] T066 Full gate, once: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e:smoke` and `pnpm test:e2e` (all
  browsers) green; summary lines in the log (constitution "Test tiers")
- [ ] T070 Electron specs on a machine with a healthy MIDI service: `electron-audio-output.spec.ts` ("Web MIDI still opens"),
  `electron-live-piano.spec.ts`, `electron-playback.spec.ts` and the rest of the electron project (T066 includes them). Added
  2026-10-02: on the development machine the Windows MIDI service (`midisrv`) was stuck after parallel Electron runs, so the app
  hung asking for and closing MIDI; the owner was asked to restart it. Not ticked until those specs are green
- [ ] T067 [light] Set `specs/021-live-piano-audio-setup/spec.md` `**Status**` to "Implemented", tick the requirements
  checklist's last notes line, final log entry with the hand-off

## Dependencies & Execution Order

- Setup (T001-T003) -> Foundational (T004-T007) -> US1 (P1) -> US2 -> US3 -> US4 -> US5 -> Polish.
- US1 is the MVP and must come first: US2's calibration taps rely on the live router (keys sound while tapping), and
  US3 extends the `mx-midi-status` element US1 creates (T020).
- US2 depends on US1 only through the router (T018). US4 depends only on Foundational (T007) and can run in parallel
  with US2/US3 if staffed. US5 depends on US2's Latency popup rework (T036) for its section (T060), and on T053.
- Within a story: tests -> core -> engine -> app -> UI -> RT review / picture check -> checkpoint.
- T068's baseline is measured on the T001 commit before T015-T018 change anything.
- Notable cross-task dependencies: T009 before T018 (expected-value change seen failing first); T012's outcome may add a
  fix task before T019; T031 before T034 (shared anchor); T048 before T049-T051 (baseline measured on the old build);
  T053 before T056-T060.

## Parallel Opportunities

- Setup: T002 and T003.
- Foundational: T005, T006, T007 after T004.
- US1 tests: T008-T014 and T068 all `[P]` (different files); then T016 alongside T015.
- US2 tests: T022-T028; implementation T029, T030, T032, T033 together.
- US3 tests: T038-T041; T042 alongside T044.
- US4: T050 alongside T049 once T048 is recorded.
- US5: T054, T055, T056 after T053; T057 alongside T058.
- Polish: T062, T063.
