# Implementation log: 021-live-piano-audio-setup

## 2026-10-02 - claude-opus-5.5 (specify, plan)
- Done: spec (owner answered the driver question: "keep it minimum" - output-device choice, no driver selector,
  Native audio plugin later); plan, research R-1 to R-12, data-model, contracts live-sound 1.0.0, audio-setup 1.0.0,
  top-bar 1.0.0, contract-changes (ports 2.3.0, play-run 2.4.0, electron-bridge 1.1.0, ui-shell 1.6.0, storage and
  performance-log additive), quickstart; reference Active Technologies / Recent Changes.
- Model fit: specify and plan are tier `deep`; claude-opus-5.5 fits.
- Decisions: one live router in session.ts, the Play controller stops sounding input (R-3); calibration on a
  Metronome-only schedule, taps mapped with the Play run's own clock map and start anchor, stored so output + input =
  measured round trip (R-9); output choice in the desktop app only (browsers need microphone permission, R-6).
- Spec corrected during planning: FR-011 / US2 said the calibrated profile is used by Practice and the cursor; Practice
  judges no timing and the cursor follows the reported output latency, so it now says "every new Play run and its
  Grade".
- Problems / open questions: drift found - `musicanyya.latency.v1` is written as a bare profile, the contract names a
  `{ version, profile }` wrapper (fix in data-model section 3). Risk: Electron permission check for audio media must be
  proven by a spike before the output UI (R-6). No owner decision blocks.
- Handoff: next = /speckit:tasks (tier standard); tree clean after the plan commit.

## 2026-10-02 - claude-opus-5.5 (tasks)
- Done: tasks.md, 67 tasks (Setup 3, Foundational 4, US1 14, US2 16, US3 10, US4 5, US5 9, Polish 6); 7 light, 60
  standard, 0 deep. Every FR-001 to FR-028 maps to at least one test task and one implementation task.
- Model fit: tasks is tier `standard`; claude-opus-5.5 fits (higher tier).
- Decisions: US1 creates the `#midi-controls` slot and `mx-midi-status` with only the live-sound marker and the locked
  hint (FR-003 and FR-007 belong to US1); US3 completes it. The ~55 e2e caption assertions on transport buttons move to
  accessible names in Foundational (T007), before US4 removes the captions - same state checked. US5 starts with a
  spike (T053) on the Electron permission check; its failure changes US5's outcome (system default only), not its tasks.
- Problems / open questions: none; no owner decision gate.
- Handoff: next = /speckit:analyze, then /speckit:implement from T001; tree clean after the tasks commit.

## 2026-10-02 - claude-opus-5.5 (analyze)
- Analyze: 12 findings (CRITICAL 0, HIGH 2, MEDIUM 4, LOW 6); tasks.md as of ad4e44a. Owner: "go with recommended" -
  remediations applied in 09afc26 (tasks.md only; spec, plan and contracts unchanged).
- Top items: A1 (HIGH) start-up MIDI request was in US3 (T046) but US1's "no click" needs it - moved into T017; A2 (HIGH)
  SC-004 had no task - new T068 measures key-to-worklet time against a baseline from the T001 commit; A3-A6 (MEDIUM)
  SC-006 grade part, SoundFont failure at start-up, hidden-tab resume, saved output missing at start-up - added to T027,
  T013/T017, T013, T055.
- Model fit: analyze is tier `deep`; claude-opus-5.5 fits.
- Handoff: next = /speckit:implement from T001 (68 tasks); tree clean.

## 2026-10-02 - claude-sonnet-5.5 (implement, baseline)
- Baseline on commit 067fe83, before any code change (T001): `pnpm typecheck` exit 0 (`tsc --build tsconfig.json`);
  `pnpm lint` exit 0 (`Found 318 warnings. Found 13 infos.`, no errors); `pnpm test`
  `Test Files  321 passed (321)`, `Tests  7119 passed (7119)`, exit 0.
- Model fit: Phase 1 is tier `light`, Phases 2-8 `standard`; claude-sonnet-5.5 fits both. No question needed.
- Owner decisions open: none. Checklist `requirements.md` 24/24 done.

## 2026-10-02 - claude-sonnet-5.5 (implement, Phase 1-2 checkpoint)
- Done: T001-T007. T002 folded the contract changes into ports 2.3.0, play-run 2.4.0, performance-log, storage,
  electron-bridge 1.1.0 and ui-shell 1.6.0 (the bridge object is unchanged, so `bridgeVersion` stays "1.0.0"; only the
  contract's own version line moves). T003 named constants in `src/core/defaults.ts` and `src/engine/config.ts`, values as
  in data-model section 6 (no table change). T004 ports 2.3.0 members with no-op stubs (engine, `LocalSettingsStore`) and
  working fakes (`FakeAudioEngine` records `prepare`, `setLatencyCalibration:<total|null>`, `setOutput:<id>`;
  `MemorySettingsStore` keeps the latency profile, its output id and the audio output). T005 e2e seam: `e2e-midi-device`
  event and `e2e-ready` detail `{ midi: 'none' | 'denied' | 'notSupported' }` in `src/app/session.ts`, helpers
  `connectFakeMidi` / `disconnectFakeMidi` / `startFakeMidiAs` in `tests/e2e/helpers/midi.ts` (the new events are first
  exercised by T040). T006 `tests/e2e/helpers/live-spy.ts`: hooks the engine's `node` field, so it wraps the worklet port
  whether the node exists yet or not; records `{ kind, key, at }`. T007: 53 caption assertions in 18 e2e specs became
  `toHaveAccessibleName(...)` of the same word (reason: US4 removes the captions; same state checked); the grep from the
  task returns nothing.
- Evidence: T004 `pnpm typecheck` exit 0, `pnpm test` `Test Files  321 passed (321)`, `Tests  7119 passed (7119)` (equal to
  the T001 baseline), `pnpm lint` exit 0 `Found 318 warnings. Found 13 infos.` (equal). T005 `pressed-keys.spec.ts` chromium
  `23 passed`. T007 the 16 non-electron specs (plus every spec whose name matches, 120+ tests) on chromium: `214 passed, 4
  skipped, 1 failed` - the failure was `lookahead.spec.ts:591` (frame p95 21.3 ms against 20 ms) while a vitest run shared
  the CPU; alone it passed (`p95 17.8 ms`, `1 passed`). `electron-playback.spec.ts` on the electron project `4 passed`.
- Checkpoint gate (Foundational): `pnpm lint` exit 0 (318 warnings, 13 infos, as baseline), `pnpm typecheck` exit 0,
  `pnpm test` `Tests  7119 passed (7119)`, `pnpm test:e2e:smoke` `9 passed`.
- Decisions: the live router is extracted into `src/app/live-router.ts` (`routeLiveInput`) so Node tests can drive the
  real routing; `session.ts` will call it first in its MIDI listener (T018). Today's behaviour moves there unchanged first
  (T008) so the test is red for the right reasons.
- Handoff: next = T008-T014, T068 (US1 tests, written but T008-T010 not yet committed: they are red on purpose), then
  T015-T021; tree clean at the commit after this entry.

## 2026-10-02 - claude-sonnet-5.5 (implement, US1 tests written, session end)
- Done: T008-T014 and T068 (US1 tests, written first). New task T069 (fix for T012, below). Extracted for testability, no
  behaviour change: `src/app/live-router.ts` (`routeLiveInput`, today's mode condition moved in unchanged; T018 removes it and
  makes `session.ts` call it first) and `src/app/practice-sound.ts` (`releasePracticeSound`, moved out of `session.ts`).
- Red on purpose (`pnpm test`: `Test Files  4 failed | 320 passed (324)`, `Tests  17 failed | 7149 passed (7166)`, each for the
  reason the task names): T008 `live-router.test.ts` 8 failed - Play-mode states silent (expected 1 got 0), pedal silent in a run,
  and one state sounding twice (mode Listen with a live Play run: 2); T009 `play-session.test.ts` 1 failed (the controller sounds
  `liveNoteOn:60,70`, expected-value change per research R-3: the controller must send no live command; the "no clock pair yet"
  case I added passes today, as intended); T010 `web-audio-engine.test.ts` 7 failed (`prepare` is a stub); T012
  `practice-held-key.test.ts` 1 failed (`releasePracticeSound` cuts key 60 the musician holds). T011
  `live-across-schedule.test.ts` passes today (8 passed), as the task expected: it pins FR-006 before the router change.
- e2e, all red today for the right reason: T013 `live-piano.spec.ts` 6 failed on chromium (no context before Play; (d) pedal
  silent in a run); T014 `electron-live-piano.spec.ts` 1 failed (`audioContextState` null: no context before Play). T068
  `live-latency.spec.ts`: Listen stopped passes, median key-to-worklet `0.000 ms` over 50 presses (below `performance.now()`
  resolution; the post is synchronous in the same call) - this is the baseline (`BASELINE_MEDIAN_MS = 0`, bound +2 ms); Play
  mode idle fails (`Received length: 0`, no message). Measured on the working tree, not a checkout of the T001 commit: the
  tree's live path for Listen is unchanged since then (only stubs, fakes, seams and two extractions).
- Decision (contract first, `contracts/live-sound.md` section 1 and `research.md` R-2 addendum): while the context is not
  running the engine posts no live note-on or pedal-down to the worklet (silent, no burst of late notes on unlock, bounded live
  queue); a note-off or pedal-up is posted whenever its note-on or pedal-down was, `liveAllOff` always. The first design queued
  everything and conflicted with T013 (a) ("no live message reaches the worklet" before the first click). T010's tests follow it.
- Decision: the engine, once the context turns `running` after a suspended start, reports its state again (`ready` when the
  sound is loaded) from its `statechange` handler, so `liveSound` goes `locked` -> `ready` (T010's last test).
- New task T069 (open): `releasePracticeSound` must spare accompaniment keys in `session.heldKeys` (T012 red). Observation not
  changed: the Practice core's own `soundOff` effect for a unison key the musician holds also cuts it; it is outside FR-006's list.
- Notes for the next agent: Playwright cannot import `src/engine/config.ts` (package.json import): use
  `tests/e2e/helpers/config.ts` `configNumber(name)`. Electron e2e needs `pnpm exec vite build -c vite.electron.config.ts` first.
  Shell quirk here: backslashes in bash heredocs are dropped - write regexes with the Edit tool. `pnpm lint` now shows 321
  warnings (baseline 318): the new tests' non-null assertions / casts; clean up at the US1 checkpoint if cheap.
- Problems / open questions: none for the owner.
- Handoff: next = T015 (engine `prepare()` per the revised live rule, `statechange` re-report) -> T016, T017, T069, T018-T021,
  then the US1 checkpoint (T013, T014, T068 green; `pnpm test` fully green again; smoke). Tier standard (sonnet fits). Work tree
  clean at the wip commit after this entry.

## 2026-10-02 - claude-sonnet-5.5 (implement, US1 checkpoint)
- Done: T015-T021 and T069 (US1 complete). T015 `WebAudioEngine.prepare()` / `ensureContext()`; the engine holds its `loadingSound` /
  `ready` reports while the browser keeps the context locked and releases them when it runs. T016 `autoplayPolicy` in
  `electron/main.ts` (window options are not exported to unit tests, so T014 is the evidence). T017 `startLiveSound()` in
  `session.ts`: prepare, SoundFont, first-activation unlock listener, MIDI request at start-up; flags `soundReady` /
  `engineUnlocked` now also set from the engine's `ready` event; a `browserPolicy` suspension no longer calls the transport's
  `pause()` (it would have paused the engine). T069 `releasePracticeSound` spares keys in `session.heldKeys`. T018 `routeLiveInput`
  unconditional; `PlaySessionController` no longer sounds `soundInput`. T019 `midiState.liveSound` / `lockedHintShown`, derived in
  `deriveLiveSound`. T020 `#midi-controls` slot, `mx-midi-status` (marker + hint), `src/ui/icons/midi-icons.ts`, `en.midi.*`.
- RT review (T021, rt-audio-reviewer, 2 blocking, 4 non-blocking): BLOCKING 1 - the Play controller subscribed to the MIDI input
  before the session's listener, so in a run the key sounded after the controller's clock mapping, reducer and UI callbacks
  (latency regression, and a throw there would silence the key): fixed, the router is now a field initializer that subscribes
  first (`session.ts`), the live-router test harness registers it first and a new test pins "key sounded before the controller
  handles it" (verified red with the old order). BLOCKING 2 - the engine posted live notes whenever the context ran, though the
  worklet queues them without draining until its SoundFont is ready (Electron runs from start-up): burst of late notes, possible
  dropped note-off: fixed, the gate is "running AND sound loaded" (`soundLoaded`, set by the worklet's `soundReady`), new unit test.
  Non-blocking: cached rejected `prepare()` / worklet promise stopped the retry on the first click: fixed (not cached, new test).
  Accepted and documented (live-sound.md): a pedal held down across the unlock is not re-sent. Observed, left: `WebMidiInput.emit`
  has no per-listener try/catch (with the router first a throw elsewhere cannot silence a key); `locked` can flash for a few ms in
  Electron if the context is not yet `running` when the worklet module has loaded (self-corrects on `statechange`).
- Expected-value changes: `tests/engine/audio/web-audio-engine.test.ts` live-message tests now first report the sound loaded (stronger
  contract after RT finding 2; the suspended-context tests are unchanged). `live-router.test.ts` harness registers the router before the
  Play controller (as the app now does).
- Decision: a key pressed while `liveSound` is still `loading` (locked is known about 50 ms after page load) gives its hint the moment
  it turns `locked` (`keyPressedWhileLoading`; data-model section 1, research R-4 addendum) - T013 (a) pressed a key inside that window.
  The hint is a top-layer popover (`popover="manual"`), because the Score browser is a modal dialog open at start-up and covered it
  (seen in a screenshot, not caught by Playwright's visibility check).
- Evidence: `pnpm test` `Test Files  324 passed (324)`, `Tests  7169 passed (7169)`; `pnpm typecheck` exit 0; `pnpm lint` exit 0
  `Found 320 warnings. Found 13 infos.` (baseline 318; +2 from the US1 tests' casts / non-null assertions, not cleaned up);
  `pnpm test:e2e:smoke` `9 passed`; `live-piano.spec.ts` + `live-latency.spec.ts` chromium `8 passed` (T013 a-f, T068 median key-to-worklet
  0.000 ms in Listen stopped and Play idle, baseline 0, bound +2 ms); `electron-live-piano.spec.ts` electron `1 passed`;
  `electron-playback.spec.ts` electron `4 passed`; `pressed-keys`, `guide-voice`, `piano-keyboard`, `us4-overlays` chromium `47 passed`.
  Not run: the quickstart US1 steps with a real MIDI keyboard (none attached); the full e2e suite (full gate, once at the end).
- Model fit: Phase 3 is tier `standard`; claude-sonnet-5.5 fits. No question needed.
- Open observation (not changed): the Practice core's own `soundOff` effect for a unison key the musician holds also cuts it; it is
  outside FR-006's list (mode switch, run start or stop, Score change).
- Problems / open questions: none for the owner.
- Handoff: next = US2 (T022 onward; tier standard, sonnet fits). Tree clean at the commit after this entry.

## 2026-10-02 - claude-sonnet-5.5 (implement, US2 checkpoint)
- Done: T022-T037 (US2 complete). Tests first (wip commit 7e51eeb, 16 red as named: no `calibration-schedule` / `calibration-session` module,
  old `calibrateLatency` signature and 7-tap acceptance, no storage wrapper / clear, stub `setLatencyCalibration`, real engine's
  `latencyProfile()` always assumed, no Latency popup elements). Then: `compileCalibrationSchedule` (T029), `calibrateLatency(taps,
  msPerBeat, outputLatencyMs, measuredAt)` with `CALIBRATION_MIN_TAPS`, `CalibrationState` / `IDLE_CALIBRATION` in core (T030),
  `anchorRunStart()` in `src/app/run-anchor.ts` used by `PlaySessionController.start()` (T031, `play-session.test.ts` unchanged),
  storage wrapper + both-form reader + `clearLatencyProfile` (T032), engine `setLatencyCalibration` / `latencyProfile()` (T033),
  `CalibrationController` + `latencyState` with the `__LATENCY_STATE__` seam (T034), session wiring (T035: stored calibration at
  start-up, `calibrate-start|stop` / `latency-reset` events, rAF position reports while calibrating, cancel before any run start /
  replay / popup close, Space tap, schedule re-delivery), reworked `mx-latency-panel` (T036) and Space no longer play/pause while
  calibrating (`shortcuts.ts`).
- RT review (T037, rt-audio-reviewer; 1 blocking, 8 non-blocking). BLOCKING: an attempt replay was not a run for `isRunActive()`, so
  a calibration could start during one (its `engine.load()` kills the replay audio, and the replay's Metronome-level write could mute the
  click): fixed, the controller's `isRunActive` also counts a replay in count-in or running. Fixed too: tempo change / seek during a
  calibration cancel it (they moved the click or silenced it); a Score load cancels it; a missing clock pair refuses `start()` (a Play
  run falls back to 0, a calibration would measure against nothing); the engine's `ended` event is a second finish trigger (hidden tab,
  no frames); `onScheduleInvalidated` re-delivers the Score at once so the cursor does not sit on the click schedule's first measures;
  the Space tap ignores text-entry focus; the tolerances are named (`CALIBRATION_WINDOW_BEATS` 0.5, `AUDIO_TIME_EPSILON_SEC` 1e-6,
  data-model constants table); the contract no longer promises a Metronome-level restore (nothing restores it: every run sets its own).
  Accepted, not changed: no plausibility bound on the measured round trip T (a tap pairing across a 375 ms+ path would be saved - needs
  an owner-visible limit, open observation) and "first tap wins" pairing per click; Space handling under Firefox/WebKit to be seen at the
  full gate (all browsers).
- Decisions: the output latency shows once the context runs, also while the SoundFont still loads (SC-005 on a fresh page); "Turns on with
  the sound" only while `locked` (contract amended). The Latency popup now has content before any run, so the 017 T041 empty-state hint
  for it is gone: `us2-panels.spec.ts` no longer lists `latency` there (FR-009 supersedes it). T027 parts 1-2: part 1 fails today on the real
  engine as the task said; part 2 (SC-006 through the real grade-worker handler) passed from the start because grading already
  compensates with `output + input` and `FakeAudioEngine.latencyProfile()` already returns the calibration (T004) - kept as the guard
  the task asks for. FR-014 part: the existing goldens are untouched and green; the new test regrades a stored log with a different profile
  in use.
- Evidence: `pnpm test` `Test Files  327 passed (327)`, `Tests  7236 passed (7236)`; `pnpm typecheck` exit 0; `pnpm lint` exit 0
  `Found 315 warnings. Found 14 infos.` (baseline 318 warnings); `pnpm test:e2e:smoke` `9 passed`; `latency-setup.spec.ts` +
  `live-piano.spec.ts` + `live-latency.spec.ts` + `us2-panels.spec.ts` chromium `22 passed`; `electron-live-piano.spec.ts` +
  `electron-playback.spec.ts` electron `5 passed`. The popup was looked at in a screenshot (idle and calibrating). Not run: quickstart US2
  steps by hand with a real keyboard and speakers (cannot hear the click here); full e2e suite (full gate, once at the end).
- Model fit: Phase 4 is tier `standard`; claude-sonnet-5.5 fits.
- Problems / open questions: none for the owner.
- Handoff: next = US3 (T038 onward; tier standard, sonnet fits). Tree clean at the commit after this entry.

## 2026-10-02 - claude-sonnet-5.5 (implement, US3 checkpoint)
- Done: T038-T047 (US3 complete). Tests first (wip commit b586d86, red as named: no `midiStatus` module, no `lostRecently`, no bar control
  `button.midi-button`, `midi` still in Setup and not run-safe, old popover strings). Then: `midiStatus()` + the six keyboard icons (T042),
  `mx-midi-status` with the keyboard button before the live-sound marker (T043), `mx-midi-panel` reworked as the popover - status line,
  device list with "Connected" / "Disconnected" as text, Connect / Try again, help, latency; built with DOM nodes (device names are no
  longer put through `innerHTML`) and redrawn only when what it shows changes (T044), `entry('midi')` removed and `RUN_OK_PANELS`
  (`sound`, `midi`) in `viewState.ts` / `runGuard.ts` (T045), `lostRecently` kept by `session.ts` from the `devices` / `deviceLost`
  events (T046; "Connect" / "Try again" use the existing `request-midi` -> `midiInput.request()` from the click, the e2e seam's start states
  already reach `midiState`), picture check (T047).
- Decisions: (1) `denied` and `notSupported` share "keyboard + slash" in data-model section 2 but T038 requires a distinct icon per state;
  `notSupported` is drawn with a dashed outline (data-model table amended). (2) The popover hangs under the control: `mx-midi-status` sets
  `--mx-midi-anchor-left` when it opens and `panels.css` clamps it inside the window (22 rem wide at most) - the other popups keep their
  top-right place (contract amended). (3) A press on the control while the popover is open records "was open" on `pointerdown`, because the
  popover's light dismiss closes it before the `click` and the click would reopen it. (4) The Score browser is a modal dialog at start-up
  (feature 013), so the bar - the MIDI control included - is inert until it is closed; the e2e spec closes it first. Not changed (013 owns it).
  (5) FR-027 e2e check: the `.playing` notes of the Play cursor, at the first beats of the run, do not intersect the popover.
- Observations (not changed): at 1280 px a Score open already puts the bar in its compact form (before this feature too), so the keyboard
  name is hidden there and only the shape shows; US4's icon buttons should free room (SC-009). The bar needs about 38 px more width in
  compact form: measured with the control hidden and shown, the narrowest width at which the bar fits (a Score open) went from about
  683 px to about 721 px. Below that the bar was already not fitting (640 px and less before, now 700 px and less).
- Picture check (T047), scratch script on the built app (not `pnpm screenshot`, which cannot open the popover or fake the keyboard states),
  eight-measure-melody open, Paper and Night themes, 1600 and 760 px wide, the popover open: the control sits after the menus with the
  keyboard shape and the name ("Fake"); at 760 px only the shape shows, the popover (title "MIDI keyboard", Close button, status line with
  the shape, "Fake (Musicanyya) - Connected", "Latency: 60 ms") hangs under the right part of the bar and covers the top of the Score's
  right end without hiding the first measures. Lost: tick -> cross, the words "MIDI keyboard disconnected"; denied: keyboard struck through,
  "MIDI not allowed", a "Try again" button and the help sentence; not supported: dashed keyboard struck through, "MIDI not supported" and its
  help. Text and shapes are readable in both themes; the six shapes are told apart at 4x zoom (tick, plain, cross, question mark, slash,
  dashed + slash).
- Expected-value changes: `tests/ui/menu.test.ts` (Setup = `setup`, `latency`; the "reaches every panel" test also leaves out `midi`; the
  overflow-menu test opens `latency`); `tests/ui/midi-panel.test.ts` popover tests rewritten for the contract (the old ones asserted the
  old English strings and a button while available); `tests/e2e/us2-panels.spec.ts`, `theme-a11y.spec.ts`, `panels-look.spec.ts` open the
  MIDI popover through the bar control instead of Setup (same checks: look, contrast, axe in all six themes).
- Evidence: `pnpm test` `Test Files  329 passed (329)`, `Tests  7262 passed (7262)`; `pnpm typecheck` exit 0; `pnpm lint` exit 0
  `Found 314 warnings. Found 14 infos.` (baseline 315); `pnpm test:e2e:smoke` `9 passed`; `midi-topbar.spec.ts` + `us2-panels.spec.ts` +
  `theme-a11y.spec.ts` + `panels-look.spec.ts` + `live-piano.spec.ts` chromium `45 passed`. Earlier run of those plus `live-latency` and
  `latency-setup`: `51 passed`. Not run: the quickstart US3 steps with a real MIDI keyboard (none attached); the full e2e suite (full gate,
  once at the end). No RT review: US3 changes no input routing or timing (the live router and the clock mapping are untouched).
- Model fit: Phase 5 is tier `standard`; claude-sonnet-5.5 fits.
- Problems / open questions: none for the owner.
- Handoff: next = US4 (T048 first: measure the captioned Stop button and the bar width on the current build, before any US4 change; then T049
  -> T050-T052; tier standard, sonnet fits). Tree clean at the commit after this entry.

## 2026-10-02 - claude-sonnet-5.5 (implement, US4 checkpoint)
- Done: T048-T052 (US4 complete). T048 (measured on the US3 head, before any US4 change; 1280 x 800, Score `eight-measure-melody` open,
  scratch script, JSON in `tests/.generated/021-t048-baseline.json`): the captioned Stop button is 42.17 x **27.59** px, Play 39.14 x 27.59,
  Practice's Start 42.47 x 27.59, Skip Back 72.44 x 27.59, Skip Forward 94.13 x 27.59; the bar settles in `mx-bar-no-word,mx-bar-compact`;
  its content width (span of the visible slots without the run status, forced into that compact form) is **1081.1 px** in Listen and
  **1213.8 px** in Practice. `TRANSPORT_BUTTON_MIN_PX` = 28 (27.59 rounded up; `src/engine/config.ts`, data-model constants table).
  T049 `transport-icons.spec.ts` red as named (no `svg`, widths equal to the baseline), then T050 `src/ui/icons/transport-icons.ts` and T051
  `mx-transport` (icons, `aria-label` unchanged, `title` with the shortcut, class `mx-transport-btn`, CSS in `layout.css`), T052 pictures.
- Regressions found at this checkpoint and fixed (they were US3's, not US4's; the US3 gate did not run these specs): `tempo-field.spec.ts`
  (3 phone-width tests) and `play-tempo.spec.ts` ("after a Play run at 200 BPM ...") failed on the US3 commit and passed before it - the MIDI
  control's 34 px overflowed the 375 px bar by 4 px, and a Play run's status then pushed the mode switch off a 1280 px bar. Fix: the compact
  MIDI button has a 3 px padding (28 px wide) and the compact bar's slot gap is 4 px (was 6) - `layout.css`, contract section 5a. Both
  specs and the 375 px fit are green again. Lesson for the next checkpoint: run every spec that touches the bar (`tempo-field`,
  `play-tempo`, `mode-switch-run`, `us1-layout`), not only the story's own.
- Expected-value changes: T007 had changed 55 caption assertions; three more were missed by its grep and are changed the same way (same
  state, by name): `mode-switch-run.spec.ts` line 138 (`toHaveText(next === 'listen' ? 'Play' : 'Start')` -> `toHaveAccessibleName`),
  `score-browser-tree.spec.ts` (`hasText: 'Pause'` count 0 would pass trivially without a caption -> `[aria-label="Pause"]`),
  `tools/dev/screenshot.ts` (waited for `hasText: 'Stop'` -> `[aria-label="Stop"]`).
- Picture check (T052): `pnpm screenshot` of the bar, Paper and Night, 1280 x 800: Listen (play triangle, stop square, no captions), Practice
  running (stop square, skip back = bar + left triangle, skip forward = right triangle + bar), Play counting in (pause bars + stop square).
  Idle Practice at 2x zoom (scratch script): the two skip buttons are drawn with a dashed border and a lighter icon in both themes, the
  enabled Start button keeps its solid border. Spacing is even, icons are centred and readable, the MIDI control follows the menus.
  The bar content width is now smaller than the baseline in both modes (the spec prints it as an annotation).
- Evidence: `pnpm test` `Test Files  330 passed (330)`, `Tests  7266 passed (7266)`; `pnpm typecheck` exit 0; `pnpm lint` exit 0
  `Found 314 warnings. Found 14 infos.`; `pnpm test:e2e:smoke` `9 passed`; chromium, the story's spec `transport-icons.spec.ts` plus all T007
  specs and the other bar/panel specs (22 files) `235 passed, 2 skipped`; electron `electron-playback` + `electron-live-piano` `5 passed`.
  Not run: the full e2e suite (full gate, once at the end); firefox/webkit for the new specs (they skip them; the markup is shared).
- Model fit: Phase 6 is tier `standard`; claude-sonnet-5.5 fits.
- Problems / open questions: none for the owner.
- Handoff: next = US5 (T053 spike first; tier standard, sonnet fits). Tree clean at the commit after this entry.

## 2026-10-02 - claude-sonnet-5.5 (implement, US5 checkpoint)
- Done: T053-T061 (US5), plus T062 and T063 (documents). Tests first (wip commit 193193d, red as named). T053 spike (scratch scripts driving the built
  desktop app; nothing left in the repository): labels and `AudioContext.setSinkId` work, **but the desktop app's permission handler never ran**
  (it was registered on `session-created`, which does not fire for the default session), so the shipped app granted every permission and
  `getUserMedia({audio:true})` resolved; and Chromium asks for `midiSysex` on `requestMIDIAccess()`, so installing the old midi-only policy would have
  broken Web MIDI. Owner decision (asked in this session, answer "Fix it: install handlers, allow midi + midiSysex (Recommended)"): handlers
  installed on `session.defaultSession`, `midi` + `midiSysex` for the app origin only, audio-only `media` check, `media` request refused (research R-6 "Spike
  result", electron-bridge 1.1.0, audio-setup section 3, policy tests). T057 `decidePermissionCheck` / `decidePermission` / `installPermissionHandlers`
  (the dev server origin is trusted only when the app is not packaged). T058 `src/engine/audio/output-device.ts` (`OutputDevices`: capability,
  list, saved-or-default rule, one notice per loss, `outputPath`) + engine members + `LocalSettingsStore` `loadAudioOutput` / `saveAudioOutput`
  (`musicanyya.audio.v1`). T059 session wiring (`refreshOutputs`, `changeOutput`, `outputFallback` -> notice `audioOutputLost`, restore at start-up).
  T060 "Sound output" section of the Latency popup (select or the system-default line, output path, ASIO line) and `latencyState.output`.
- RT review (rt-audio-reviewer on the engine / session / Electron changes; the plan had listed no RT path for US5, a sink move is one): 1 BLOCKING,
  5 non-blocking, 2 advisory. BLOCKING B1 - moves the musician did not ask for (start-up apply, a device's return) were not gated against a run or a
  calibration: a calibration would have been anchored on device A and measured with device B's latency, a Play run's compensation snapshot would
  go stale. Fixed: `canSwitch` (supplied by the session: run, replay, calibration) defers those moves, `WebAudioEngine.resumeOutput()` applies them (called each
  second), a lost device still falls back at once and now cancels a running calibration. Also fixed: N1 every `setSinkId` bounded by
  `AUDIO_OUTPUT_FALLBACK_MAX_MS` (timeout = failure); N2 `setOutput` queued with the refreshes; N3 `dispose()` lets go of the context so work in flight
  ends quietly; N4 a failed device list keeps what was learnt, `activeId` set only after a successful move, the musician's choice kept in memory too;
  N5 the popup refreshes the list on opening, not on every state change; A1 `clockPair()` ignores an all-zero pair; `prepare()` never waits for the device
  list. 11 new unit tests (mutation-checked: no gate -> the two gating tests fail, no bound -> the stall test times out); they were written after
  the fix, not before. Not done: a session-level test of the cancel-on-fallback wiring (covered by `CalibrationController.cancel()` tests and the Electron
  spec's fallback), and the review's A1 behaviour right after a real `sinkchange` (no hardware check possible here).
- Constitution audit (T065, constitution-auditor): COMPLIANT WITH NOTES, no blocking finding. Medium: no RT review for US5 (done above), switch-back during
  a run (fixed above), transient list failure (fixed). Low, fixed: `desktop` now comes from `probeEnvironment()`, the dev origin only when not packaged,
  the `localStorage` key noted in research. Low, accepted: calibration beat arithmetic written in core and in the app (fixed tempo, pinned by a core test),
  bare 16 / 128 literals for channel / key counts (counts, not tolerances), "Live piano" is spec vocabulary the constitution's Domain Vocabulary does not
  list (an owner call: a PATCH amendment if wanted), `mx-latency-panel` sums output + input for display.
- Decisions: the output list shows the system default as "System default" (the engine's label, the UI string is `en.latency.panel.systemDefault`); the
  select returns to the output in use after a device that cannot be used (no message - open observation); a Play run that meets a forced fallback keeps the
  profile it started with and its log is not rewritten.
- Environment problem (not a product defect, found at this checkpoint): the first Electron e2e run was parallel (3 desktop apps at once). Afterwards the
  Windows MIDI service (`midisrv`) on this machine stopped answering: `requestMIDIAccess()` never resolves in the desktop app and quitting the app never
  finishes ("Waiting for the debugger to disconnect"); the same app quits in 0.1 s with MIDI turned down, a trivial Electron app is fine, and the old
  commit behaves the same. The owner was asked to restart the service (answer: "You restart it"); a restart needs an elevated shell, my attempt raised a
  UAC prompt that was not answered, so the service is unchanged. Consequences: the Electron spec runs its device-choice test with the MIDI
  request turned down before the page makes it (`launch({ midi: false })`) and kills a stuck app after 15 s; **`electron-audio-output.spec.ts` "Web MIDI
  still opens" fails on this machine (availability stays `notRequested`)** and `electron-live-piano` / `electron-playback` were not re-run after the
  hang began - new task T070 keeps this open. The desktop-idle check of T064 uses the same MIDI-off launch.
- Picture check (T061), scratch script, Paper and Night, browser and desktop app (window screenshot of the popup): "Latency" popup with the output latency,
  the profile, Calibrate, then a rule and the Sound output section - desktop: a labelled "Sound output" select (System default first), "Windows audio
  (shared mode)" and the ASIO sentence; browser: "System default output - change it in your system's sound settings.", "Browser audio" and the ASIO
  sentence. Text is readable in both themes; the section is set apart by a rule (spacing was tightened after the first look).
- Evidence: `pnpm test` `Test Files  331 passed (331)`, `Tests  7318 passed (7318)`; `pnpm typecheck` exit 0; `pnpm lint` exit 0 `Found 314 warnings. Found 14 infos.`;
  `pnpm test:e2e:smoke` `9 passed`; chromium `latency-setup` + `live-piano` + `lookahead` `24 passed` (an earlier `lookahead` SC-004 frame-interval failure
  happened while a desktop app and two review agents were running and passed on rerun); chromium regression run of the bar / panel / latency specs (24 files)
  `241 passed, 1 failed (that lookahead flake), 2 skipped`; electron `electron-audio-output.spec.ts` `3 passed, 1 failed` (the MIDI test, above).
- Docs: README (live piano, Latency and output, transport), `docs/agents/reference.md` (implemented, the permission finding, the MIDI-service warning),
  quickstart (the electron command, the notice wording).
- Model fit: Phases 7 and 8 are tier `standard`; claude-sonnet-5.5 fits (T062, T063 are `light`, done by a standard model).
- Problems / open questions: **needs owner:** (1) restart the Windows MIDI service (elevated PowerShell: `Restart-Service midisrv`) or reboot, so T070 and the
  full gate can run the Electron project; (2) the desktop app now refuses the microphone and every permission except MIDI (and the audio device check):
  say if anything else (file system writes, notifications) is expected to work there.
- Handoff: next = T064 (manual script, including the 31-minute idle check running in the background at the time of writing), T066 (full gate, needs
  the MIDI service for the electron project), T067, T070. Tree clean at the commit after this entry.

## 2026-10-03 - claude-sonnet-5.5 (implement, full gate attempt, not complete)
- Full browser gate: `playwright test --project=chromium --project=firefox --project=webkit` -> `889 passed, 8 failed, 741 skipped (10.7m)`. The 8 failures,
  all fixed in tests (no `src/` change since the US5 commit):
  - `chrome-look.spec.ts` (g), `static-host.spec.ts`: still asserted the button caption ("Pause" / "Stop") that US4 removed; T007's grep missed them. Now
    assert the `aria-label` (same state, by name).
  - `brand.spec.ts` (e) on all three browsers: the roomy bar at 1600 px did not fit with the MIDI control's words in a browser that has no MIDI
    ("MIDI not supported" + "Sound failed to load": about 150 px more in Firefox) or with the "locked" marker (10 px over in Chromium). The test is about the order
    the bar gives things up in, so it now starts from the usual state (keyboard connected, sound on) through the `__MIDI_STATE__` seam; the
    assertions are unchanged. The bar itself adapts to the degraded states by folding, as designed.
  - `transport-icons.spec.ts` width test: flaked under load because the "Loading sound..." status widens the transport while the SoundFont loads; it now
    waits for that status to go and for the width to settle.
  - `brand.spec.ts` (a) on Firefox: passed on rerun (load).
  After the fixes: brand, chrome-look, static-host, transport-icons, midi-topbar, latency-setup on the three browsers `58 passed, 1 failed, 40 skipped`; smoke `9 passed`.
- **Open: `latency-setup.spec.ts` Firefox "Calibrate ... 30 ms (+-5)"** measures 21-24 ms in 3 of 6 runs (passes in the others), on a loaded and on a quiet
  machine; Chromium is stable. A bias of about 6-9 ms on Firefox, not yet explained (candidates: Firefox's timer precision, how it reports
  `getOutputTimestamp()`, the test's own tap timing). Nothing was changed; the test was not weakened. Needs a look or an owner decision (e.g. a wider bound or
  skipping Firefox with a stated reason).
- Electron project: not run in this gate. The MIDI service of this machine is stuck (see the US5 entry); the owner will restart the PC after the e2e run.
  T070 stays open and T066 cannot be ticked until the electron specs run green on a machine with a healthy MIDI service.
- T064: the owner dropped the 30-minute idle check (2026-10-03: "I don't like the test that takes 31 minutes each time"); it is commented out of the task. A scratch run
  had reached 25 minutes with the audio context `running` and the engine `ready`. The rest of the quickstart script was covered by the e2e specs and the pictures
  of each story; not checked by hand: a real MIDI keyboard, real speakers (no click or sound can be heard here), unplugging a real output device.
- Handoff: next = after the PC restart, run `pnpm exec vite build -c vite.electron.config.ts` and `pnpm test:e2e --project=electron` (T070, then T066 with the
  summary lines), look at the Firefox calibration bias, then T067 (spec status "Implemented", final log). Tree clean at the commit after this entry.

## 2026-10-03 - claude-sonnet-5.5 (implement, Electron project run)
- After the owner restarted the PC the MIDI service answered again (the app closed in 0.1 s with MIDI granted). Electron project, one worker:
  `playwright test --project=electron --workers=1` -> `431 passed, 3 failed, 112 skipped (26.8m)`. The 3 failures: `electron-smoke` "packaged shelf" and
  `piano-keyboard` "latency poll notifies only when ..." passed on rerun (load, not related); `levels.spec` "Orchestra level survives a restart" failed because
  its two tests shared one user-data directory (`beforeAll`) and, with a single worker, the first test's second app was still open when the second test
  launched (single-instance lock): now one directory per test (`beforeEach` / `afterEach`).
- Finding: running the Electron project with the default 8 workers (8 desktop apps at once) wedged the Windows MIDI service again within minutes: every
  app opens the machine's real MIDI ports at start-up (T017) and the apps hung asking for and closing MIDI (14 failures, `midi-hyp` check TIMEOUT). The
  hardware (a MOTU interface) makes it visible; a machine without MIDI devices would not show it. The product is not affected (a single-instance
  lock allows one app per user). Fix: `pnpm test:e2e` now runs the browser projects and then `pnpm test:e2e:electron` (`--project=electron --workers=1`);
  reference.md says why. Changing a script is a toolchain change - say if you want it done differently (e.g. an environment switch that keeps the
  desktop app away from real MIDI ports during tests).
- The MIDI service is wedged again by that run; another restart is needed before the Electron project can be run once more with the final test files
  (levels per-test directory, electron-audio-output). The 4 `electron-audio-output` tests were green (3) / blocked (1: the MIDI one) before the first restart and are
  expected green on a healthy service; not confirmed yet. T070 and T066 stay open.

## 2026-10-03 - claude-sonnet-5.5 (owner decision: no MIDI at start-up)
- Owner decision: "These midi connect freezes again, it didn't happen before. Let's not autoconnect midi devices for now, only manual connection." The
  start-up `midiInput.request()` of T017 is removed (`session.ts` `startLiveSound`); MIDI access is requested only by the "Connect MIDI keyboard" button of the
  top-bar popover (`request-midi`), as before feature 021. The sound does not depend on it. Documents changed first: spec.md (US3 scenario 1, FR-017 now
  "MUST NOT ask by itself", assumption), research R-5 (superseded note), live-sound.md section 2, quickstart US3, README, reference.md, T017's text. The top
  bar shows "Connect MIDI keyboard" until the musician connects (already the `notRequested` state), so no UI change.
- Tests: `electron-audio-output.spec.ts` lost its "turn MIDI down before the page asks" workaround (nothing asks any more) and its MIDI test is now "MIDI is
  connected by hand only": the bar offers Connect, nothing is requested for 3 s, then Connect makes `availability` `available` (this one touches the real MIDI
  ports and needs a healthy MIDI service, so it was NOT run here: the service is wedged again by the 8-app parallel run). The other tests that do not touch MIDI:
  `electron-audio-output` (3) + `electron-live-piano` (1) `4 passed`, run serially.
- Evidence: `pnpm test` `Test Files  331 passed (331)`, `Tests  7318 passed (7318)`; `pnpm typecheck` exit 0; `pnpm lint` exit 0; smoke `9 passed`; chromium + firefox
  `live-piano`, `midi-topbar`, `us2-panels`, `latency-setup`, `theme-a11y`, `pressed-keys` `111 passed, 1 failed` (a Firefox `pressed-keys` Play test that passed twice
  on rerun).
- Still open: T070 / T066 (Electron project on a healthy MIDI service; now only the one Connect test touches real MIDI), the Firefox calibration bias, T067.

## 2026-10-03 10:40 - claude-sonnet-5.5 (continue: full gate, not green)
- Model fit: task tier standard, claude-sonnet-5.5 fits; no question needed.
- Gate evidence: `pnpm lint` exit 0 (314 warnings, 14 infos, none new); `pnpm typecheck` exit 0; `pnpm test` `Tests  7318 passed (7318)`;
  `pnpm test:e2e:smoke` `9 passed`. The first `pnpm test:e2e` hung (a WebKit worker idle for 20 minutes on `lookahead.spec.ts` (c), zero CPU; killed, not counted).
  Second run, browsers: `2 failed, 741 skipped, 895 passed (10.4m)`; Electron (`pnpm test:e2e:electron`, vite electron build first): `1 failed, 112 skipped, 433 passed (26.8m)`
  with the MIDI service healthy; the real-MIDI "MIDI is connected by hand only" test and `electron-audio-output` / `electron-live-piano` / `electron-playback` all passed.
- Failures, three kinds:
  1. **WebKit `score-browser-tree.spec.ts` "a file opened with Open file... ... after a reload" (US3 #5): fixed in the test.** Failed 1 of 3 repeats on a quiet machine. Cause: `fileLoaded`
     (`session.ts`, fire and forget) writes the *My files* entry after the Score is drawn, and the test reloaded as soon as the SVG showed. The test now waits for the
     `userFiles` entry in IndexedDB before the reload; every assertion is unchanged. After: `--repeat-each=10` `10 passed`. Not a 021 change (that code is not in the diff).
  2. **Electron `electron-smoke.spec.ts` "the packaged shelf opens ..." : not fixed, not caused by 021.** Fails every time when the file runs in order (`23.0s`, 5 passed 1 failed;
     `dialog.browser` never visible, "waiting for navigation to finish"), passes alone (`-g`, 8 of 8). It follows the test that sets `location.href = 'https://example.com'`
     (a denied/external navigation), and **the identical failure occurs on `main`** (worktree of `main`, built, same file: `5 passed, 1 failed`). So it is older than 021;
     it was seen as a "passes on rerun" flake in earlier gates because those reruns used `-g`. Needs a decision or a fix task (e.g. a fresh window or app per test, or
     `shell.openExternal` kept out of the test).
  3. **Firefox `latency-setup.spec.ts` "Calibrate ... 30 ms (+-5)": cause found, needs an owner decision.** 2 of 6 repeats fail (measured 22 and 24 ms). Measured in Firefox and
     Chromium for 6 s with `getOutputTimestamp()` sampled every 7 ms: the offset `performanceTime - contextTime*1000` has a range of **12.7 ms (sd 3.4 ms) in Firefox**
     against **0.7 ms (sd 0.15 ms) in Chromium**. Calibration (and a Play run) anchors the beat on one such pair (`anchorRunStart`) and maps every tap with a fresh one, so
     in Firefox the calibration carries a random error of several ms and the +-5 ms bound fails about every other run. The same uncertainty reaches Play-mode grading
     on Firefox. It is the browser's clock report, not the test.
- Decisions I did not take (AGENTS.md 7: behaviour, no weakening tests): either (a) smooth the clock pair in the clock map (e.g. the median offset of the last N pairs,
  with tests and an RT review; a new task, improves Firefox grading too), or (b) keep the code and widen the Firefox bound / skip it on Firefox with this finding as the stated reason.
- Not ticked: T066 (gate not green), T070 (the electron project is green except finding 2), T067 (waits for T066).
- Handoff: next = owner answers (Firefox calibration: a or b; electron-smoke order flake: fix task or accept), then T066 rerun of the affected specs plus `@smoke` (the full
  gate need not repeat if `src/` is unchanged; option (a) changes `src/` and needs the full gate again), then T067. Tree clean at the commit after this entry.

## 2026-10-03 11:30 - claude-sonnet-5.5 (owner decisions after the gate; T066, T070, T067 done)
- Owner decisions: (1) skip the Firefox calibration test for now and note it in known bugs; (2) fix the electron-smoke order failure.
- Firefox calibration: `latency-setup.spec.ts` "Calibrate ... 30 ms (+-5)" is `test.skip` on Firefox with the reason; the rest of that spec runs there. New entry in
  `docs/known-bugs.md` (cause measured, fix idea: smooth the clock pair in `MidiClockMap`). The product code is unchanged.
- electron-smoke: root cause found. The denied navigation (`location.href = 'https://example.com'`, end of the first test) leaves Playwright's view of the shared window
  "still navigating", so the next test ("packaged shelf") waited 5 s and failed every time the file ran in order (also on `main`). Fixing that exposed a second order
  dependence: the "score browser opens, shows seeded progress" test read the recent cards the earlier tests had left (the seed is dated 2026-09-20). Fix: one Electron app
  and one user-data directory per test (`beforeEach` / `afterEach`) in `electron-smoke.spec.ts`; the navigation check is its own test with the same assertion.
  Evidence: `--repeat-each=3` `21 passed (22.9s)` (was 5 passed 1 failed in order).
- Evidence for the tiers (no `src/` change since the gate run, so affected specs + smoke, constitution "Test tiers"): `pnpm lint` exit 0; `pnpm typecheck` exit 0;
  `pnpm test:e2e:smoke` `9 passed`; `score-browser-tree` + `latency-setup` on chromium, firefox, webkit `36 passed, 6 skipped`; electron `electron-smoke`, `electron-audio-output`,
  `electron-live-piano`, `electron-playback` `16 passed`. Together with the gate run above (`pnpm test` `7318 passed`; browsers `895 passed` + the three fixed specs; electron
  `433 passed` + the fixed one) every spec has passed since its last change. T066 and T070 are ticked on that basis; the full `pnpm test:e2e` was not run again as one command.
- T067: spec Status "Implemented", checklist note added.
- Handoff: feature complete; next = the constitution audit stays as logged (T065); merge only when the owner asks. Open elsewhere: the Firefox clock-pair smoothing (known bugs).
  Tree clean at the commit after this entry.

