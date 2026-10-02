# Tasks: Guide Voice in Play Mode

**Input**: Design documents from `specs/020-play-guide-voice/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/guide-voice.md, contracts/contract-changes.md,
quickstart.md

<!--
  Format: `- [ ] T001 [P] [US1] Description with exact file path`
  States: `[ ]` open, `[~]` in progress with ` (claimed: <agent-id> <date>)`, `[x]` done, `[-]` dropped by the owner
  (AGENTS.md section 4). [deep] / [standard] / [light] = tier when it differs from the phase's **Model** line.
  Tests come BEFORE implementation (Constitution IV) and must fail first, for the reason named on the task.
  Real-time paths: no worklet, scheduler, MIDI-timing or plugin code changes (plan, Technical Context); schedules get more
  tick-0 controllers (Phase 3) and the run schedule more notes on one more channel (Phase 4), so both phases end with an
  RT review.
  Phase 3 (FR-015, owner request 2026-10-02) comes before US1 because the guide channel relies on its CC7 / CC10
  defaults (research R-3, R-10). US2's level test (T015) sits in US1's test group: US2 has no level code of its own
  (research R-4), so it must be written and seen failing before the guide exists (analyze A1, 2026-10-02).
  US1 wires the live Play run only; US3 wires the stored-run path (replay and regrade) so its test can fail first.
  Revised 2026-10-02 after analyze (A1-A6, A9) and the owner's request to fix the volume/pan carry-over here; renumbered
  before any task was started.
-->

## Phase 1: Setup

**Model**: light (gemini-3.7-flash or claude-haiku-4-5; every standard and deep model fits too)

- [x] T001 Append a baseline entry to `specs/020-play-guide-voice/implementation-log.md` with the summary lines of
  `pnpm test`, `pnpm lint` and `pnpm typecheck` on the branch before any code change (AGENTS.md 2.6), and set the
  `**Status**` line of `specs/020-play-guide-voice/spec.md` from "Draft" to "In progress"
- [x] T002 [P] Fold the contract changes into the earlier features' documents, contract first (AGENTS.md section 6),
  exactly as listed in `specs/020-play-guide-voice/contracts/contract-changes.md`:
  `specs/003-play-mode-grading/contracts/play-run.md` 2.2.0 -> 2.3.0 (the `guide` option and `guideChannel` field in the
  "The run schedule" block; rule 1 amended and the new rules from guide-voice.md §2),
  `specs/019-metronome-orchestra-volume/contracts/mixer-levels.md` 1.0.0 -> 1.1.0 (§1 item 2 and §5 from guide-voice.md
  §3), `specs/001-score-viewer-listen/contracts/worklet-protocol.md` 1.6.1 -> 1.7.0 (the CC7 / CC10 setup rule and the
  `orchestraMask` wording) - each version line names "feature 020" and links
  `specs/020-play-guide-voice/contracts/guide-voice.md` or `research.md` R-10
- [x] T003 [P] Add the named constants of `specs/020-play-guide-voice/data-model.md` §4 to `src/core/defaults.ts`
  (`GUIDE_PROGRAM = 4`, `GUIDE_VELOCITY_SCALE = 0.6`, `GUIDE_QUIETER_MIN_DB = 6` next to `ORCHESTRA_LEVEL_DEFAULT`;
  `DEFAULT_CHANNEL_VOLUME = 100`, `DEFAULT_CHANNEL_PAN = 64` next to `MAX_SETUP_CONTROLLERS`), each with a one-line
  comment naming its research section (020 R-5 / R-10), and check every value against the table

---

## Phase 2: Foundational - the `guide` option and the render helper (blocks Phases 3-6)

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)

- [x] T004 Add the required `guide: boolean` to `PlayScheduleOptions` in `src/core/play/types.ts` and
  `guideChannel: number | null` to `PlaySchedule` in `src/core/schedule/play-schedule.ts`, returning
  `guideChannel: null` and changing nothing else yet (guide-voice.md §1). Pass `guide: false` in both production callers
  (`src/app/play-session.ts` `start`, `src/app/session.ts` `prepareStoredRun`), in `renderPlayRun`
  (`tests/engine/helpers/listen-render.ts`) and in every existing test option builder that calls `compilePlaySchedule`
  (`tests/core/play/play-schedule.test.ts`, `range.test.ts`, `metronome-mute.test.ts`, `replay.test.ts`,
  `tests/core/grade/tempo-percent.test.ts`, `tests/core/schedule/setup-events.test.ts`, and any other the typecheck
  names). Evidence: `pnpm typecheck` exit 0 and `pnpm test -- tests/core tests/engine` with the same summary line as the
  T001 baseline (no behaviour change)
- [x] T005 Extend the offline render helper `renderPlayRun` in `tests/engine/helpers/listen-render.ts` (analyze A2) with
  optional, backward-compatible options: a fixture path outside `public/library` (as `renderListen` takes), a graded
  note set or hand/part selection (built with `buildExpectedNotes` as the session does), `guide`, the Orchestra level
  (sent as the session does, through the `orchestraLevel` message), a per-frame callback to send `orchestraLevel`,
  `stop` or `pause` mid-run (as `renderListen`'s `extra` does in `tests/engine/orchestra-level.test.ts`), and the peak
  active voice count in the result (as `orchestra-render.test.ts` reads it). Evidence: every existing caller unchanged
  and `pnpm test -- tests/engine` with the same summary line as after T004

**Checkpoint**: the option exists everywhere, the helper can render a guided run, and nothing sounds different.

---

## Phase 3: Volume and pan never carry over (FR-015, owner request 2026-10-02)

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)
**Goal**: every schedule sets volume and pan on every channel it uses (except the Metronome's), so no part keeps what a
previous Score, run or Guide voice left on its channel.
**Independent Test** (spec SC-009): render a Score that turns its channel down and to the left, then on the same synth a
Score with no `<volume>` / `<pan>` on that channel: it sounds exactly as when played first.

### Tests (write first, confirm they fail)

- [x] T006 [P] Own-work fixtures `tests/fixtures/musicxml/channels/turned-down-left.musicxml` (one piano part, eight
  quarter notes, `<volume>40</volume>`, `<pan>-90</pan>`) and `tests/fixtures/musicxml/channels/plain.musicxml` (the
  same notes, no `<volume>` or `<pan>`), each with an origin and licence line (own work, CC0) in
  `tests/fixtures/musicxml/README.md`; check both load without warnings (`buildScore`)
- [x] T007 [P] Extend `tests/core/schedule/compile.test.ts` (data-model §5): every used channel except
  `METRONOME_CHANNEL` has tick-0 CC7 = `volume ?? DEFAULT_CHANNEL_VOLUME` and CC10 = `pan ?? DEFAULT_CHANNEL_PAN`;
  a part with `<volume>` / `<pan>` keeps its own values; unused channels get no controller; a Play schedule's Metronome
  channel gets no CC7 / CC10 (guard for R-10's exclusion - passes today, named as such in the log); setup events still
  sort before note events at tick 0; a timeline with all 16 channels used yields at most 48 tick-0 controllers
  (`<= MAX_SETUP_CONTROLLERS`). Fails today: parts without `<volume>` / `<pan>` get no CC7 / CC10
- [x] T008 [P] New `tests/engine/channel-carryover.test.ts` (SC-009): render `turned-down-left.musicxml` then
  `plain.musicxml` on the same synth and worklet (the helper's sequential rendering, or two schedules through one
  processor); the second render equals `plain.musicxml` rendered on a fresh synth within
  `ORCHESTRA_SILENT_TOLERANCE_DBFS` of difference, in both stereo channels. Fails today: the plain part plays at CC7 40,
  panned left

### Implementation

- [x] T009 Implement the CC7 / CC10 defaults in `compileSchedule` (`src/core/schedule/compile.ts`) per data-model §5,
  skipping `METRONOME_CHANNEL`; update the function's doc comment. Evidence: T007 and T008 green
- [x] T010 Update every schedule snapshot or exact-event assertion that lists tick-0 setup events and now gains the CC7 /
  CC10 events (e.g. `tests/core/schedule/setup-events.test.ts`, worklet-harness tests under `tests/engine/worklets/`),
  naming each changed expectation and the reason (FR-015, R-10) in the log; confirm that the rendered Listen goldens
  (`tests/engine/listen-render-golden.test.ts`) and the Grade goldens did **not** change. Evidence: full `pnpm test`
  summary line
- [x] T011 RT review with `rt-audio-reviewer` (Constitution I): the setup controllers are applied in the message handler
  only, the count stays under `MAX_SETUP_CONTROLLERS`, and the Metronome channel's `channelVolume` can never be
  overridden by a deferred setup (`setupPending` / `soundReady()`); summarise findings in the log
- [x] T035 [P] Added after the T011 RT review (advisory 1): in `tests/core/play/replay.test.ts` pin that a merged replay
  schedule over a run schedule that uses every melodic channel and percussion keeps its tick-0 controllers within
  `MAX_SETUP_CONTROLLERS` (14 channels x 3 + the live channel's CC7 / CC10 = 44), and that the live channel
  (`LIVE_CHANNEL`) gets CC7 = `DEFAULT_CHANNEL_VOLUME` and CC10 = `DEFAULT_CHANNEL_PAN`
- [x] T036 [P] Added after the T011 RT review (advisory 2): in `tests/engine/worklets/score-player.setup.test.ts` pin that a
  `channelVolume` on `METRONOME_CHANNEL` sent before the sound is ready is not overridden when the deferred setup of a
  compiled run-style schedule is applied by `soundReady()` (no CC7 reaches the Metronome channel from the setup), while
  another channel's default CC7 does arrive
- [x] T012 Checkpoint: the phase's Independent Test (T008) plus a listen in the dev app (quickstart "FR-015"), full gate
  (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`), log entry with each command's summary line, commit

**Checkpoint**: no channel carries volume or pan from one schedule to the next.

---

## Phase 4: User Story 1 - Hear my part softly during a Play run (Priority: P1) MVP

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)
**Goal**: a live Play run on a Score without an Orchestra plays the musician's expected notes with the electric piano,
softly, on the run's clock; Grades unchanged.
**Independent Test** (spec US1): open a library exercise without an Orchestra in Play mode, start a run and play
nothing - the expected notes sound in a soft electric piano in time with the cursor and the clicks, none during the
count-in; the right notes blend, a wrong one clashes; the Grade equals one without the guide.

### Tests (write first, confirm they fail)

- [ ] T013 [P] [US1] New `tests/core/play/guide-voice.test.ts` (guide-voice.md §2 and §5), one assertion per bullet,
  all with `guide: true` unless named:
  - on `eight-measure-melody.musicxml` with every note graded: `guideChannel` is the lowest unused melodic channel, its
    setup has program `GUIDE_PROGRAM` and the default CC7 / CC10, and its bit is set in `schedule.orchestraMask`;
  - each graded event appears once on the guide channel with key unchanged, velocity
    `max(1, round(v * GUIDE_VELOCITY_SCALE))` and ticks shifted by the run shift; none remains on its own channel;
  - no guide note-on before `tickMap.countInTicks`;
  - on `grand-staff-right-hand-only.musicxml` (or another two-staff fixture) with only the right hand graded: only
    right-hand events are guided; with `accompaniment: true` the left hand stays on its own channel unchanged, with
    `accompaniment: false` it is absent and the guide events are still there (rule 3);
  - with a range: only graded events inside the range are guided;
  - a tied note is one guide note for its full tied length; a chord gives simultaneous guide note-ons;
  - the Orchestra fixture `tests/fixtures/musicxml/orchestra/piano-and-oboe.musicxml` gets `guideChannel: null` and a
    schedule equal to the `guide: false` one, and so does the real
    `public/library/repertoire/advanced/grieg-morning-mood.musicxml` (SC-005);
  - a timeline whose Orchestra part has no playable instrument (`orchestra/orchestra-no-program.musicxml`, no used
    Orchestra channel) gets a guide channel;
  - a timeline with every melodic channel used gets `guideChannel: null` and the `guide: false` schedule;
  - `guide: false` gives `guideChannel: null` and the same schedule as after Phase 3 (byte-equal typed arrays);
  - compiling twice gives byte-equal schedules (rule 5);
  - on a real library item without an Orchestra (`public/library/repertoire/beginner/greensleeves.musicxml`), both hands
    graded: the guide note count equals the number of graded sounding events (AGENTS.md: check real files too).
  Fails today: `guideChannel` is always null and graded events are dropped
- [ ] T014 [P] [US1] Extend `tests/engine/play-session.test.ts` (fake engine, fake clock): `start()` loads a schedule whose
  `orchestraMask` includes a channel carrying the graded notes on a Score without an Orchestra; a recorded
  Performance log fed to the run gives the same Grade as the same log against an unguided schedule, and the Grade at
  Orchestra levels 0, 60 and 100 is identical (SC-004; levels set through the session, never read by the grader); the
  run's `expected` and the Performance log contain no guide event. Fails today: `start()` passes `guide: false`
- [ ] T015 [P] [US1] New `tests/engine/guide-render.test.ts` using the T005 helper, on `eight-measure-melody.musicxml`
  with every note graded and no input:
  - every guide note onset is at its scheduled frame (within 1 sample) at tempo 50, 100 and 150 %, and no guide onset
    falls inside the count-in (SC-001);
  - at Orchestra level `ORCHESTRA_LEVEL_DEFAULT`, the RMS of the guide rendering is at least `GUIDE_QUIETER_MIN_DB`
    below the RMS of the same notes rendered on the piano channel at the written velocity (SC-002);
  - after `stop`, and separately after `pause`, sent mid-note, no guide voice is active after the next render block and
    nothing more is heard (spec edge case "Stop, pause ...", analyze A3);
  - on the densest hands-together library item without an Orchestra (chosen by the most notes per second in
    `public/library/index.json` facts; name it in the log), the peak active voice count of a guided run stays below
    `VOICE_HEADROOM_FRACTION * VOICE_CAP` (R-6).
  Fails today: no guide events are scheduled
- [ ] T016 [P] [US2] Level tests in the same `tests/engine/guide-render.test.ts` (written here, before T018, because US2
  has no code of its own - research R-4, analyze A1): a guided run rendered at Orchestra level 100 differs from the
  unguided render by more than `ORCHESTRA_SILENT_TOLERANCE_DBFS` while at level 0 it equals it within that tolerance
  (SC-003); a sustained guide note's level follows a level change sent mid-note within the next render block, with no
  retriggered onset (FR-011); onsets identical at levels 0, 50 and 100; the level moved every render block for the
  whole run adds no late event and no dropped message, as 019's `orchestra-level.test.ts` sweep (SC-006, analyze A4).
  Fails today: no guide note exists to differ, follow or sweep
- [ ] T017 [P] [US1] New `tests/e2e/guide-voice.spec.ts` (browser) and one added test in
  `tests/e2e/electron-playback.spec.ts` (Electron), SC-008: open a fixture without an Orchestra, start a Play run
  through `tests/e2e/helpers/play.ts` (the `e2e-midi` seam), capture the loaded schedule by wrapping
  `mxSession.audioEngine.load` in the page (as `tests/e2e/levels.spec.ts` wraps `setOrchestraLevel`), and assert
  note-ons on a channel whose bit is set in `orchestraMask` and whose channel setup program is `GUIDE_PROGRAM`; on the
  Orchestra fixture, and in Listen mode on the first fixture (FR-007, analyze A6), the captured schedule has no channel
  with `GUIDE_PROGRAM`. Fails today: no guide channel

### Implementation

- [ ] T018 [US1] Implement the guide in `compilePlaySchedule` (`src/core/schedule/play-schedule.ts`) per guide-voice.md
  §2 and data-model.md §3: has-an-Orchestra check, guide channel choice, graded events moved with scaled velocity,
  guide channel setup in the run timeline only, `guideChannel` returned. Evidence: T013, T015 and T016 green, the rest
  of `pnpm test -- tests/core` unchanged
- [ ] T019 [US1] Pass `guide: true` in `PlaySessionController.start` (`src/app/play-session.ts`) only (the stored-run
  path is US3). Evidence: T014 and T017 (browser and Electron) green; `pnpm typecheck` and `pnpm lint` exit 0
- [ ] T020 [US1] RT review with `rt-audio-reviewer` (Constitution I): confirm no worklet, scheduler or MIDI-timing code
  changed, the guided schedule keeps the worklet-protocol ordering rules, CC7 / CC10 / CC11 on the guide channel are
  applied in the existing setup path, and the T015 voice peak; summarise findings in the log
- [ ] T021 [US1] Checkpoint: run the US1 Independent Test (quickstart US1 steps 1, 4, 5, 6 without a keyboard; 2 and 3
  only if a MIDI keyboard is available - say which were run), full gate, log entry with each command's summary line,
  commit

**Checkpoint**: US1 fully functional and testable on its own.

---

## Phase 5: User Story 2 - Turn the Guide voice down or off with the Orchestra level (Priority: P1)

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)
**Goal**: the Orchestra slider is enabled on Scores without an Orchestra, explains that it sets the Guide voice, and
silences it at 0 % (the sound part is proved by T016).
**Independent Test** (spec US2): on a Score without an Orchestra in Play mode, move the Orchestra level to 0 % during a
run - the guide fades out at once, nothing else changes; reload - the level is kept; on *Morning Mood* the same level
applies and the hint is gone.

### Tests (write first, confirm they fail)

- [ ] T022 [P] [US2] Update `tests/ui/levels-panel.test.ts`: with no Score open and with a loaded Score whose
  `summary.parts` has no `orchestra: true`, the Orchestra slider is enabled, the hint `en.levels.guideVoice` is visible
  and is the slider's `aria-describedby`; with an Orchestra part, enabled, no hint, no `aria-describedby`; switching
  Scores never changes `transportState.orchestraLevel`. Fails today: the slider is disabled with "This score has no
  orchestra"
- [ ] T023 [P] [US2] Update `tests/e2e/levels.spec.ts` (the disabled-slider assertions, today at lines 80-81 and
  230-231): on a Score without an Orchestra the slider is enabled and the panel says "No orchestra in this score: sets
  the guide voice in Play mode"; the value set on the Orchestra fixture (25) is still shown. Log that these
  expectations changed with spec FR-010 (replaces 019 FR-010), not to go green. Fails today: the slider is disabled

### Implementation

- [ ] T024 [US2] In `src/ui/i18n/en.ts` replace `levels.noOrchestra` with `levels.guideVoice` (data-model.md §6) and in
  `src/ui/elements/mx-levels-panel.ts` never disable the Orchestra slider; show the guide hint (and set
  `aria-describedby`) when the open Score has no Orchestra or none is open (guide-voice.md §3); update the element's doc
  comment. Evidence: T022 and T023 green; `pnpm lint` and `pnpm typecheck` exit 0
- [ ] T025 [US2] Checkpoint: run the US2 Independent Test (quickstart US2; picture of the Levels panel opened in the dev
  app on an item without an Orchestra, looked at before reporting), full gate, log entry, commit

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 6: User Story 3 - Hear the Guide voice in the replay of a graded run (Priority: P3)

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)
**Goal**: replaying a graded run on a Score without an Orchestra plays the Guide voice with the recorded input.
**Independent Test** (spec US3): grade a run with a few wrong notes and replay it - the guide plays the expected notes
with the recorded ones; at 0 % the replay sounds as before.

### Tests (write first, confirm they fail)

- [ ] T026 [P] [US3] Extend `tests/core/play/replay.test.ts`: `compileReplay` over a guided run schedule keeps every guide
  event and the guide channel's bit in `orchestraMask` next to the live-channel events (`mergeSchedules` carries the
  mask - this half passes once T018 is done; say so in the log, analyze A10). And in
  `tests/engine/replay-session.test.ts` (or the session-level test that drives `attemptreplay`): replaying a stored
  performance of a Score without an Orchestra loads a schedule with guide note-ons on a mask channel, and a regrade of
  the same performance gives the stored Grade (FR-009, SC-004). Fails today: `prepareStoredRun` passes `guide: false`

### Implementation

- [ ] T027 [US3] Pass `guide: true` in `SessionController.prepareStoredRun` (`src/app/session.ts`), which serves replay
  and regrade. Evidence: T026 green; `pnpm test -- tests/core/grade tests/engine` unchanged otherwise
- [ ] T028 [US3] Checkpoint: run the US3 Independent Test (quickstart US3; needs a MIDI keyboard or the e2e MIDI path -
  say which), full gate, log entry, commit

**Checkpoint**: all three stories and FR-015 work independently.

---

## Phase 7: Polish & Cross-Cutting

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)

- [ ] T029 Owner decision gate OD-1 (plan, Decisions; SC-007): the owner listens to two items without an Orchestra (one
  hands-together piece, one single-hand exercise) at the default level and accepts the guide, or names a change to
  `GUIDE_VELOCITY_SCALE` or `GUIDE_PROGRAM` (alternatives: 5 FM electric piano, 11 vibraphone, 89 warm pad). Blocks
  T030 and the merge; a change re-runs T015 and T016
- [ ] T030 [light] Apply the OD-1 answer to `src/core/defaults.ts` and `specs/020-play-guide-voice/data-model.md` §4 (or
  log "accepted unchanged"), then `pnpm test -- tests/engine/guide-render.test.ts tests/core/play` green
- [ ] T031 [P] [light] Update user-facing docs: the Play mode / Levels description in `README.md` (if it describes the
  Orchestra slider) and `specs/020-play-guide-voice/quickstart.md` if any command changed during implementation;
  `docs/musicxml-support.md` gets one line that a part without `<volume>` / `<pan>` plays at the General MIDI defaults
  (100, centre) - FR-015
- [ ] T032 Run the whole `specs/020-play-guide-voice/quickstart.md` manual verification and record which steps were run
  and how (picture, e2e MIDI path, real keyboard)
- [ ] T033 Constitution audit with `constitution-auditor` over the branch diff; summarise findings in the log and fix or
  task every finding
- [ ] T034 Final gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` (exit codes and summary lines in the
  log); every task ticked with evidence or `[-]`; set the spec `**Status**` to "Implemented"; hand-off entry

## Dependencies & Execution Order

- Setup (T001-T003) -> Foundational (T004-T005) -> Phase 3 FR-015 (T006-T012) -> US1 (T013-T021) -> US2 (T022-T025)
  and US3 (T026-T028) -> Polish (T029-T034).
- T003 before every test and code task (they import the constants); T002 before T009 and T018 (contract first).
- Phase 3 before US1: the guide channel takes its CC7 / CC10 from T009's defaults, and T013's `guide: false` equality
  is against the post-Phase-3 schedule.
- Within US1: T013-T017 written and failing -> T018 -> T019 -> T020 -> T021. T016 belongs to US2 but must fail before
  T018.
- US2's UI tasks (T022-T024) depend only on Phase 2 and may run beside US1; its checkpoint T025 needs T016 green.
- US3 needs T018 and the T004 option; it is independent of US2.
- T029 (owner) blocks T030 and the merge; T033 before T034.

## Parallel Opportunities

- T002 and T003 (different files).
- Phase 3 tests T006, T007, T008 (different files; T008 uses T006's fixtures, so start T008 after T006 is written).
- US1 tests T013, T014, T015 + T016 (one shared file, one agent), T017 (two e2e files).
- US2 UI tasks T022-T024 in parallel with US1's implementation.
- US3 test T026 in parallel with US2.
- Polish T031 in parallel with T032.
