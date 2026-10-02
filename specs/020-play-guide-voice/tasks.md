# Tasks: Guide Voice in Play Mode

**Input**: Design documents from `specs/020-play-guide-voice/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/guide-voice.md, contracts/contract-changes.md,
quickstart.md

<!--
  Format: `- [ ] T001 [P] [US1] Description with exact file path`
  States: `[ ]` open, `[~]` in progress with ` (claimed: <agent-id> <date>)`, `[x]` done, `[-]` dropped by the owner
  (AGENTS.md section 4). [deep] / [standard] / [light] = tier when it differs from the phase's **Model** line.
  Tests come BEFORE implementation (Constitution IV) and must fail first, for the reason named on the task.
  Real-time paths: no worklet, scheduler, MIDI-timing or plugin code changes (plan, Technical Context); the run schedule
  gets more events on one more channel, so US1 ends with an RT review of the voice headroom and the unchanged RT code.
  US1 wires the live Play run only; US3 wires the stored-run path (replay and regrade) so its test can fail first.
-->

## Phase 1: Setup

**Model**: light (gemini-3.7-flash or claude-haiku-4-5; every standard and deep model fits too)

- [ ] T001 Append a baseline entry to `specs/020-play-guide-voice/implementation-log.md` with the summary lines of
  `pnpm test`, `pnpm lint` and `pnpm typecheck` on the branch before any code change (AGENTS.md 2.6), and set the
  `**Status**` line of `specs/020-play-guide-voice/spec.md` from "Draft" to "In progress"
- [ ] T002 [P] Fold the contract changes into the earlier features' documents, contract first (AGENTS.md section 6),
  exactly as listed in `specs/020-play-guide-voice/contracts/contract-changes.md`:
  `specs/003-play-mode-grading/contracts/play-run.md` 2.2.0 -> 2.3.0 (the `guide` option and `guideChannel` field in the
  "The run schedule" block; rule 1 amended and the new rules from guide-voice.md §2),
  `specs/019-metronome-orchestra-volume/contracts/mixer-levels.md` 1.0.0 -> 1.1.0 (§1 item 2 and §5 from guide-voice.md
  §3), `specs/001-score-viewer-listen/contracts/worklet-protocol.md` 1.6.1 -> 1.6.2 (wording of `orchestraMask` only) -
  each version line names "feature 020" and links `specs/020-play-guide-voice/contracts/guide-voice.md`
- [ ] T003 [P] Add the named constants of `specs/020-play-guide-voice/data-model.md` §4 to `src/core/defaults.ts` next to
  `ORCHESTRA_LEVEL_DEFAULT` (`GUIDE_PROGRAM = 4`, `GUIDE_VELOCITY_SCALE = 0.6`, `GUIDE_CHANNEL_VOLUME = 100`,
  `GUIDE_QUIETER_MIN_DB = 6`), each with a one-line comment naming its research section (020 R-3 / R-5), and check
  every value against the table

---

## Phase 2: Foundational - the `guide` option (blocks US1 and US3)

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)

- [ ] T004 Add the required `guide: boolean` to `PlayScheduleOptions` in `src/core/play/types.ts` and
  `guideChannel: number | null` to `PlaySchedule` in `src/core/schedule/play-schedule.ts`, returning
  `guideChannel: null` and changing nothing else yet (guide-voice.md §1). Pass `guide: false` in both production callers
  (`src/app/play-session.ts` `start`, `src/app/session.ts` `prepareStoredRun`) and in every existing test option
  builder that calls `compilePlaySchedule` (`tests/core/play/play-schedule.test.ts`, `range.test.ts`,
  `metronome-mute.test.ts`, `replay.test.ts`, `tests/core/grade/tempo-percent.test.ts`,
  `tests/core/schedule/setup-events.test.ts`, and any other the typecheck names). Evidence: `pnpm typecheck` exit 0
  and `pnpm test -- tests/core tests/engine` with the same summary line as the T001 baseline (no behaviour change)

**Checkpoint**: the option exists everywhere and nothing sounds different.

---

## Phase 3: User Story 1 - Hear my part softly during a Play run (Priority: P1) MVP

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)
**Goal**: a live Play run on a Score without an Orchestra plays the musician's expected notes with the electric piano,
softly, on the run's clock; Grades unchanged.
**Independent Test** (spec US1): open a library exercise without an Orchestra in Play mode, start a run and play
nothing - the expected notes sound in a soft electric piano in time with the cursor and the clicks, none during the
count-in; the right notes blend, a wrong one clashes; the Grade equals one without the guide.

### Tests (write first, confirm they fail)

- [ ] T005 [P] [US1] New `tests/core/play/guide-voice.test.ts` (guide-voice.md §2 and §5), one assertion per bullet,
  all with `guide: true` unless named:
  - on `eight-measure-melody.musicxml` with every note graded: `guideChannel` is the lowest unused melodic channel, its
    setup has program `GUIDE_PROGRAM`, CC7 `GUIDE_CHANNEL_VOLUME`, and its bit is set in `schedule.orchestraMask`;
  - each graded event appears once on the guide channel with key unchanged, velocity
    `max(1, round(v * GUIDE_VELOCITY_SCALE))` and ticks shifted by the run shift; none remains on its own channel;
  - no guide note-on before `tickMap.countInTicks`;
  - on `grand-staff-right-hand-only.musicxml` (or another two-staff fixture) with only the right hand graded: only
    right-hand events are guided; with `accompaniment: true` the left hand stays on its own channel unchanged, with
    `accompaniment: false` it is absent and the guide events are still there (rule 3);
  - with a range: only graded events inside the range are guided;
  - a tied note is one guide note for its full tied length; a chord gives simultaneous guide note-ons;
  - the Orchestra fixture `tests/fixtures/musicxml/orchestra/piano-and-oboe.musicxml` gets `guideChannel: null` and a
    schedule equal to the `guide: false` one (SC-005 mechanism), and so does the real
    `public/library/repertoire/advanced/grieg-morning-mood.musicxml` (SC-005);
  - a timeline whose Orchestra part has no playable instrument (no used Orchestra channel) gets a guide channel;
  - a timeline with every melodic channel used gets `guideChannel: null` and the `guide: false` schedule;
  - `guide: false` gives `guideChannel: null` and the same schedule as before this feature (byte-equal typed arrays);
  - compiling twice gives byte-equal schedules (rule 5);
  - on a real library item without an Orchestra (`public/library/repertoire/beginner/greensleeves.musicxml`), both hands
    graded: the guide note count equals the number of graded sounding events (AGENTS.md: check real files too).
  Fails today: `guideChannel` is always null and graded events are dropped
- [ ] T006 [P] [US1] Extend `tests/engine/play-session.test.ts` (fake engine, fake clock): `start()` loads a schedule whose
  `orchestraMask` includes a channel carrying the graded notes on a Score without an Orchestra; a recorded
  Performance log fed to the run gives the same Grade as the same log against an unguided schedule, and the Grade at
  Orchestra levels 0, 60 and 100 is identical (SC-004; levels set through the session, never read by the grader); the
  run's `expected` and the Performance log contain no guide event. Fails today: `start()` passes `guide: false`
- [ ] T007 [P] [US1] New `tests/engine/guide-render.test.ts` using `renderPlayRun` from
  `tests/engine/helpers/listen-render.js` (offline render, as `tests/engine/orchestra-render.test.ts`): on
  `eight-measure-melody.musicxml` with every note graded and no input,
  - every guide note onset is at its scheduled frame (within 1 sample) at tempo 50, 100 and 150 %, and no guide onset
    falls inside the count-in (SC-001);
  - at Orchestra level `ORCHESTRA_LEVEL_DEFAULT`, the RMS of the guide rendering is at least `GUIDE_QUIETER_MIN_DB`
    below the RMS of the same notes rendered on the piano channel at the written velocity (SC-002);
  - on the densest hands-together library item without an Orchestra (chosen by the most notes per second in
    `public/library/index.json` facts; name it in the log), the peak active voice count of a guided run stays below
    `VOICE_HEADROOM_FRACTION * VOICE_CAP` (R-6).
  Fails today: no guide events are scheduled
- [ ] T008 [P] [US1] New `tests/e2e/guide-voice.spec.ts` (browser) and one added test in
  `tests/e2e/electron-playback.spec.ts` (Electron), SC-008: open a fixture without an Orchestra, start a Play run
  through `tests/e2e/helpers/play.ts`, capture the loaded schedule by wrapping `mxSession.audioEngine.load` in the page
  (as `tests/e2e/levels.spec.ts` wraps `setOrchestraLevel`), and assert note-ons on a channel whose bit is set in
  `orchestraMask` and whose channel setup program is `GUIDE_PROGRAM`; on the Orchestra fixture the captured schedule has
  no channel with `GUIDE_PROGRAM`. Fails today: no guide channel

### Implementation

- [ ] T009 [US1] Implement the guide in `compilePlaySchedule` (`src/core/schedule/play-schedule.ts`) per guide-voice.md
  §2 and data-model.md §3: has-an-Orchestra check, guide channel choice, graded events moved with scaled velocity,
  guide channel setup in the run timeline only, `guideChannel` returned. Evidence: T005 green, the rest of
  `pnpm test -- tests/core` unchanged
- [ ] T010 [US1] Pass `guide: true` in `PlaySessionController.start` (`src/app/play-session.ts`) only (the stored-run
  path is US3). Evidence: T006, T007 and T008 (browser and Electron) green; `pnpm typecheck` and `pnpm lint` exit 0
- [ ] T011 [US1] RT review with `rt-audio-reviewer` (Constitution I): confirm no worklet, scheduler or MIDI-timing code
  changed, the guided schedule keeps the worklet-protocol ordering rules, CC7/CC11 on the guide channel are applied
  in the existing setup path, and the T007 voice peak; summarise findings in the log
- [ ] T012 [US1] Checkpoint: run the US1 Independent Test (quickstart US1 steps 1, 4, 5, 6 without a keyboard; 2 and 3
  only if a MIDI keyboard is available - say which were run), full gate (`pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:e2e`), log entry with each command's summary line, commit

**Checkpoint**: US1 fully functional and testable on its own.

---

## Phase 4: User Story 2 - Turn the Guide voice down or off with the Orchestra level (Priority: P1)

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)
**Goal**: the Orchestra slider is enabled on Scores without an Orchestra, explains that it sets the Guide voice, and
silences it at 0 %.
**Independent Test** (spec US2): on a Score without an Orchestra in Play mode, move the Orchestra level to 0 % during a
run - the guide fades out at once, nothing else changes; reload - the level is kept; on *Morning Mood* the same level
applies and the hint is gone.

### Tests (write first, confirm they fail)

- [ ] T013 [P] [US2] Extend `tests/engine/guide-render.test.ts`: a guided run rendered at Orchestra level 100 differs
  from the unguided render by more than `ORCHESTRA_SILENT_TOLERANCE_DBFS` while at level 0 it equals it within that
  tolerance (SC-003); a sustained guide note's level follows a level change sent mid-note within the next render block,
  with no retriggered onset (FR-011, SC-006); onsets identical at levels 0, 50 and 100. US2 has no level code of its
  own (research R-4), so this test MUST be written and seen failing before T009 (it fails today: no guide note exists
  to differ or to follow)
- [ ] T014 [P] [US2] Update `tests/ui/levels-panel.test.ts`: with no Score open and with a loaded Score whose
  `summary.parts` has no `orchestra: true`, the Orchestra slider is enabled, the hint `en.levels.guideVoice` is visible
  and is the slider's `aria-describedby`; with an Orchestra part, enabled, no hint, no `aria-describedby`; switching
  Scores never changes `transportState.orchestraLevel`. Fails today: the slider is disabled with "This score has no
  orchestra"
- [ ] T015 [P] [US2] Update `tests/e2e/levels.spec.ts` (the assertions at the former lines 80-81 and 230-231): on a Score
  without an Orchestra the slider is enabled and the panel says "No orchestra in this score: sets the guide voice in
  Play mode"; the value set on the Orchestra fixture (25) is still shown. Log that these expectations changed with spec
  FR-010 (replaces 019 FR-010), not to go green. Fails today: the slider is disabled

### Implementation

- [ ] T016 [US2] In `src/ui/i18n/en.ts` replace `levels.noOrchestra` with `levels.guideVoice` (data-model.md §5) and in
  `src/ui/elements/mx-levels-panel.ts` never disable the Orchestra slider; show the guide hint (and set
  `aria-describedby`) when the open Score has no Orchestra or none is open (guide-voice.md §3); update the element's doc
  comment. Evidence: T014 and T015 green; `pnpm lint` and `pnpm typecheck` exit 0
- [ ] T017 [US2] Checkpoint: run the US2 Independent Test (quickstart US2; picture of the Levels panel opened in the dev
  app on an item without an Orchestra, looked at before reporting), full gate, log entry, commit

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Hear the Guide voice in the replay of a graded run (Priority: P3)

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)
**Goal**: replaying a graded run on a Score without an Orchestra plays the Guide voice with the recorded input.
**Independent Test** (spec US3): grade a run with a few wrong notes and replay it - the guide plays the expected notes
with the recorded ones; at 0 % the replay sounds as before.

### Tests (write first, confirm they fail)

- [ ] T018 [P] [US3] Extend `tests/core/play/replay.test.ts`: `compileReplay` over a guided run schedule keeps every guide
  event and the guide channel's bit in `orchestraMask` next to the live-channel events (`mergeSchedules` carries the
  mask). And in `tests/engine/replay-session.test.ts` (or the session-level test that drives `attemptreplay`): replaying
  a stored performance of a Score without an Orchestra loads a schedule with guide note-ons on a mask channel, and a
  regrade of the same performance gives the stored Grade (FR-009, SC-004). Fails today: `prepareStoredRun` passes
  `guide: false`

### Implementation

- [ ] T019 [US3] Pass `guide: true` in `SessionController.prepareStoredRun` (`src/app/session.ts`), which serves replay
  and regrade. Evidence: T018 green; `pnpm test -- tests/core/grade tests/engine` unchanged otherwise
- [ ] T020 [US3] Checkpoint: run the US3 Independent Test (quickstart US3; needs a MIDI keyboard or the e2e MIDI path -
  say which), full gate, log entry, commit

**Checkpoint**: all three stories work independently.

---

## Phase 6: Polish & Cross-Cutting

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)

- [ ] T021 Owner decision gate OD-1 (plan, Decisions; SC-007): the owner listens to two items without an Orchestra (one
  hands-together piece, one single-hand exercise) at the default level and accepts the guide, or names a change to
  `GUIDE_VELOCITY_SCALE` or `GUIDE_PROGRAM` (alternatives: 5 FM electric piano, 11 vibraphone, 89 warm pad). Blocks
  T022 and the merge; a change re-runs T007 and T013
- [ ] T022 [light] Apply the OD-1 answer to `src/core/defaults.ts` and `specs/020-play-guide-voice/data-model.md` §4 (or
  log "accepted unchanged"), then `pnpm test -- tests/engine/guide-render.test.ts tests/core/play` green
- [ ] T023 [P] [light] Update user-facing docs: the Play mode / Levels description in `README.md` (if it describes the
  Orchestra slider) and `specs/020-play-guide-voice/quickstart.md` if any command changed during implementation;
  `docs/musicxml-support.md` needs no change (no parsing change) - say so in the log
- [ ] T024 Run the whole `specs/020-play-guide-voice/quickstart.md` manual verification and record which steps were run
  and how (picture, e2e MIDI path, real keyboard)
- [ ] T025 Constitution audit with `constitution-auditor` over the branch diff; summarise findings in the log and fix or
  task every finding
- [ ] T026 Final gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` (exit codes and summary lines in the
  log); every task ticked with evidence or `[-]`; set the spec `**Status**` to "Implemented"; hand-off entry

## Dependencies & Execution Order

- Setup (T001-T003) -> Foundational (T004) -> US1 (T005-T012) -> US2 (T013-T017) and US3 (T018-T020) -> Polish
  (T021-T026).
- T003 before T005-T009 (tests and code import the constants); T002 before T009 (contract first).
- Within US1: T005-T008 and T013 written and failing -> T009 -> T010 -> T011 -> T012.
- US2's render test T013 is written before T009 (it has no code of its own to fail against); its UI part (T014-T016)
  depends only on Phase 2.
- US3 needs T009 (the guide exists) and the T004 option; it is independent of US2.
- T021 (owner) blocks T022 and the merge; T025 before T026.

## Parallel Opportunities

- T002 and T003 (different files).
- US1 tests T005, T006, T007, T008 (four different files).
- US2 tests T013, T014, T015, and US2's UI work (T014-T016) in parallel with US1 implementation.
- US3 test T018 in parallel with US2.
- Polish T023 in parallel with T024.
