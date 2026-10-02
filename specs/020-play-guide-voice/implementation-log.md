# Implementation Log: Guide Voice in Play Mode

## 2026-10-02 - claude-opus-5.5 (specify, plan)
- Done: spec (owner clarified FR-002: only the musician's own expected notes), requirements checklist (all pass), plan,
  research R-1..R-9, data-model, contracts guide-voice 1.0.0 + contract-changes (play-run 2.3.0, mixer-levels 1.1.0,
  worklet-protocol 1.6.2 wording), quickstart; reference Recent Changes. Model fit: `deep` steps on claude-opus-5.5 (fits).
- Decisions: the Guide voice is made in `compilePlaySchedule` by moving graded events to a free melodic channel
  (program 4, velocity x 0.6, CC7 100) marked into `orchestraMask`, so the existing Orchestra level, replay merge and
  device-loss re-send apply unchanged; no engine/worklet/setting change. Levels panel slider always enabled with a guide
  hint (spec FR-010 replaces 019 FR-010).
- Problems / open questions: needs owner: OD-1 listening check (SC-007) at the end - may tune `GUIDE_VELOCITY_SCALE` /
  `GUIDE_PROGRAM`. Observation outside scope: channel CC7 persists across schedules (plan, Decisions).
- Handoff: next = `/speckit:tasks`; gate not run (documents only); tree clean after the plan commit.

## 2026-10-02 - claude-opus-5.5 (tasks)
- Done: `tasks.md` generated: 26 tasks (Setup 3, Foundational 1, US1 8, US2 5, US3 3, Polish 6). Model fit: `standard`
  step on claude-opus-5.5 (listed under "also fits").
- Decisions: `guide` option added as a no-op first (T004) so every caller and test passes `guide: false` before any
  behaviour changes; US1 wires the live run, US3 the stored-run path (replay, regrade), so each story's test fails first;
  US2's render test (T013) has no code of its own (research R-4) and is therefore written before T009.
- Problems / open questions: needs owner: OD-1 listening check (T021), blocks T022 and the merge.
- Handoff: next = `/speckit:analyze`, then `/speckit:implement` from T001; gate not run (documents only).

## 2026-10-02 - claude-opus-5.5 (analyze)
- Analyze: 11 findings (CRITICAL 0, HIGH 0, MEDIUM 4, LOW 7); tasks.md as of 6873fb1. Model fit: `deep` step on
  claude-opus-5.5 (fits).
- Top recommendations: move T013 into US1's tests (file order puts it after T009, which it must precede); name the
  render-helper extension T007/T013 need (`renderPlayRun` reads `public/library` only, has no graded set, guide option
  or Orchestra level); add a stop/pause "guide notes released" assertion; reuse 019's level-sweep test for SC-006.
- Handoff: next = fix the MEDIUM findings in tasks.md (owner's call), then `/speckit:implement` from T001.

## 2026-10-02 - claude-opus-5.5 (analyze follow-up, owner: "take care of the CC7 carry-over here; resolve with recommended")
- Done: R-10 confirmed by code reading: `compileSchedule` sends CC7 / CC10 only for parts with `<volume>` / `<pan>`;
  neither the worklet (`applyChannelSetup`, `schedule`/`stop`/`pause` send only CC120/123) nor spessasynth_core
  (`programChange` keeps controllers; CC121 = RP-15, which excludes volume and pan) resets them. Spec FR-015 / SC-009,
  research R-10, data-model §4-§5, worklet-protocol 1.6.1 -> 1.7.0 in contract-changes, plan, quickstart, checklist
  (iteration 3). Guide-only `GUIDE_CHANNEL_VOLUME` dropped (the general fix covers it). Metronome channel excluded
  from the defaults: its CC7 is the session's `channelVolume`, and a deferred setup (`setupPending`) would override it.
- Analyze fixes applied: A1 (level test T016 in US1's tests), A2 (helper task T005), A3 (stop/pause in T015), A4 (sweep
  in T016), A5 (plan test location), A6 (Listen schedule check in T017), A9 (FR-003 "mellow"), A10 noted in T026.
  A7, A8 accepted as in 019; A11 (vocabulary) needs a constitution amendment - not done.
- tasks.md rewritten and renumbered before any task started: 34 tasks (Setup 3, Foundational 2, FR-015 7, US1 9,
  US2 4, US3 3, Polish 6).
- Handoff: next = `/speckit:implement` from T001 (or `/speckit:analyze` again to confirm); gate not run (documents only).

## 2026-10-02 - claude-sonnet-5.5 (implement: baseline, contracts)
- Baseline on `020-play-guide-voice` at ce880a3, before any code change (T001): `pnpm test` -> `Test Files  317 passed (317)`,
  `Tests  6684 passed (6684)`, exit 0; `pnpm lint` -> `Found 318 warnings.` `Found 13 infos.`, exit 0 (no errors; the
  warnings and infos are the ones already on the branch); `pnpm typecheck` -> `tsc --build tsconfig.json`, exit 0.
  Spec `**Status**`: Draft -> In progress.
- Model fit: `light` and `standard` tasks on claude-sonnet-5.5 (fits both, no question needed).
- Contracts folded, contract first (T002): `003/contracts/play-run.md` 2.2.0 -> 2.3.0 (`guide`, `guideChannel`, rule 1
  amended, new rules 7-9), `019/contracts/mixer-levels.md` 1.0.0 -> 1.1.0 (section 1 item 2, strings, section 5 row,
  section 6 wording), `001/contracts/worklet-protocol.md` 1.6.1 -> 1.7.0 (CC7 / CC10 setup rule, `orchestraMask` wording).
- T003: `GUIDE_PROGRAM = 4`, `GUIDE_VELOCITY_SCALE = 0.6`, `GUIDE_QUIETER_MIN_DB = 6`, `DEFAULT_CHANNEL_VOLUME = 100`,
  `DEFAULT_CHANNEL_PAN = 64` added to `src/core/defaults.ts`, each value checked against data-model section 4.
- T004: required `PlayScheduleOptions.guide` and `PlaySchedule.guideChannel` (always `null` for now). `guide: false` passed
  in `PlaySessionController.start`, `SessionController.prepareStoredRun`, `renderPlayRun` and the test option builders in
  `tests/core/play/{play-schedule,range,replay}.test.ts`, `tests/core/grade/tempo-percent.test.ts`,
  `tests/core/schedule/setup-events.test.ts`, `tests/engine/metronome-click.test.ts` (not on the task's list; it calls
  `compilePlaySchedule`). `metronome-mute.test.ts` builds no options, so it is unchanged. `tsc --build` does not cover
  `tests/`, so the callers were found with a search, not from the typecheck. Evidence: `pnpm typecheck` exit 0;
  `pnpm test` -> `Test Files  317 passed (317)`, `Tests  6684 passed (6684)` (same as the baseline).
- T005: `renderPlayRun` gained optional `source` ('library' | 'fixture'), `graded` ('all' | HandSelection | set; built with
  `buildExpectedNotes` as the session does), `guide`, `orchestraLevel` (sent as the engine does, before the schedule), and
  returns `noteOnFrames(channel)`, `countInEndFrame`, `schedule` and `guideChannel`. `beforeBlock` (stop, pause, level
  messages mid-run) and `peakVoices` already existed and are reused. A throwaway test (deleted) confirmed that
  `graded: 'all'` leaves no piano note-on on the piano channel and `source: 'fixture'` reads `tests/fixtures/musicxml`.
  Evidence: `pnpm typecheck` exit 0; `pnpm test` -> `Test Files  317 passed (317)`, `Tests  6684 passed (6684)`;
  `pnpm lint` exit 0 (318 warnings, 13 infos, unchanged).
- T006: fixtures `tests/fixtures/musicxml/channels/turned-down-left.musicxml` (volume 40 -> CC7 51, pan -90 -> CC10 1) and
  `channels/plain.musicxml` (no volume, no pan), origin and licence rows in `tests/fixtures/musicxml/README.md` (own work,
  CC0). Both load with an empty report (`report.entries` = `[]`) - asserted in `tests/engine/channel-carryover.test.ts`.
- T007 (test, ticked because it fails as expected): `tests/core/schedule/compile.test.ts` gained "tick-0 volume and pan on every
  used channel (020 FR-015)", 7 tests. Run: `Tests  3 failed | 16 passed` in that file - fails for the expected reason:
  "a used channel whose part gives no volume or pan gets the General MIDI defaults" (`expected undefined to be 100`),
  "a part that gives a volume or a pan keeps its own value, the other one defaults" (`expected undefined to be 64`) and
  "all 16 channels used ... under MAX_SETUP_CONTROLLERS" (`expected 16 to be 46`). The two Metronome-exclusion tests (the
  compileSchedule one and the compilePlaySchedule one) PASS today: they are guards for R-10's exclusion, as the task says.
  The unused-channel and tick-0-ordering tests also pass today (guards).
- T008 (test, ticked because it fails as expected): `tests/engine/channel-carryover.test.ts`; needed one helper addition,
  `renderListen`'s optional `before` (a fixture's Listen schedule played first on the same synth and processor; the
  task allowed "two schedules through one processor"). Run: `Tests  1 failed | 3 passed`; the failure is the SC-009
  comparison - `expected 0.04019591026008129 to be less than or equal to 0.000031622776601683795`
  (`ORCHESTRA_SILENT_TOLERANCE_DBFS` = -90 dBFS) - the plain part plays at CC7 51 and panned left. The "really sound
  different" guard (turned-down vs plain, so the comparison can fail) passes.
- T009: `compileSchedule` (`src/core/schedule/compile.ts`) now sets CC7 = `volume ?? DEFAULT_CHANNEL_VOLUME` and
  CC10 = `pan ?? DEFAULT_CHANNEL_PAN` at tick 0 on every used channel except `METRONOME_CHANNEL` (an explicit value on the
  Metronome channel would still be written, as before); doc comment updated. T007 green: `Tests  19 passed (19)` in
  `compile.test.ts`.
- T008 follow-up (test design, found while making it pass): the first fix run left a difference of 9.4e-3 against the
  3e-5 tolerance. A control run (plain after plain, no volume/pan carry-over possible) differed from a fresh synth by about
  the same, so the residue was not CC7 / CC10. Two causes, both of the synth and not of the part: (1) voices of the earlier
  Score still ringing out their release when the next schedule loads (the first render is cut at 3 s with a note held),
  (2) the synth's reverb / chorus tail and LFO phase (-76 dBFS after 12 s, about the same with the same Score twice).
  The test therefore plays the first Score to its end and 7 s beyond (`before.seconds` 12, the Score lasts 4.8 s) and renders
  `dry` (`renderListen` option, `synth.setSystemParameter('effectsEnabled', false)`). The tolerance is unchanged
  (`ORCHESTRA_SILENT_TOLERANCE_DBFS`). With the fix stashed, the test fails with `expected 0.04023909568786621 to be less
  than or equal to 0.000031622776601683795`; with the fix it passes - it detects the bug.
- T010, every expectation that changed and why (FR-015, R-10): (1) `tests/core/schedule/compile.test.ts` "puts
  control/program changes before notes at the same tick" - the channel now also gets CC7 and CC10, which sort before the
  program change, so the exact sequence is `[controlChange, controlChange, programChange, noteOn, noteOff]` (the rule under test,
  setup before notes, is unchanged). (2) `tests/fixtures/library-identity.json`, regenerated with `tools/library/identity.ts`:
  exactly one `scheduleDigest` changed - `repertoire/advanced/grieg-morning-mood.musicxml` (its generated Orchestra parts give
  no `<volume>` / `<pan>`); verified programmatically: the 185 files and every note identity are unchanged, the
  `furEliseThemeGrade` is identical, and the 184 other digests are identical (the generator also rewrote
  `tests/fixtures/performance-logs/fur-elise-theme.json` with only a JSON array reformatted; that file was restored).
  Not changed: the rendered Listen goldens (`tests/engine/listen-render-golden.test.ts`), the Grade goldens,
  `tests/core/schedule/setup-events.test.ts` (still holds: all setup events are at tick 0), the worklet harness tests.
  Evidence: `pnpm typecheck` exit 0; `pnpm test` -> `Test Files  318 passed (318)`, `Tests  6695 passed (6695)`;
  `pnpm lint` exit 0 (318 warnings, 13 infos, unchanged).
- T011 RT review (`rt-audio-reviewer`, claude subagent, commit 302bdaa): PASS WITH ADVISORIES, no blocking finding. Confirmed:
  setup controllers are applied only in `applyChannelSetup` from the message handler / `soundReady()` (`process()` untouched);
  worst case 42 controllers for a Score (46 / 48 theoretical), 44 for a merged replay, under `MAX_SETUP_CONTROLLERS` = 64;
  the Metronome channel never gets a CC7 from a (deferred) setup; the live channel (idempotent: it already sat at 100 / 64) and
  percussion (now defaulted, intended) are not regressions; the worklet does not depend on the program change coming first.
  Advisories taken as new tasks: T035 (replay merge controller count, `tests/core/play/replay.test.ts`) and T036 (deferred
  setup vs `channelVolume` on the Metronome channel, `tests/engine/worklets/score-player.setup.test.ts`) - both pass, and a
  mutation (Metronome exclusion removed) makes 5 tests fail. Not taken: a dev-time overlap assertion in `mergeSchedules`
  (advisory 3, unchanged callers always partition channels), and the Practice start order (advisory 5, behaviour unchanged for
  parts that already set volume and pan).
- T012 checkpoint (Phase 3, FR-015): Independent Test = `tests/engine/channel-carryover.test.ts` green (SC-009).
  Listen in the dev app (quickstart "FR-015") could not be a listening check; instead, in the in-app browser on `pnpm dev`, the
  app was given `turned-down-left` then `plain` through `mxSession.openFile` and the schedules the engine received were read:
  `ch0 CC7=51, CC10=1` then `ch0 CC7=100, CC10=64` - nothing carried over. **For the owner (sound):** quickstart FR-015 steps
  1-2 by ear. Full gate on the Phase 3 tree: `pnpm typecheck` exit 0; `pnpm lint` exit 0 (`Found 318 warnings.`
  `Found 13 infos.`, unchanged); `pnpm test` -> `Test Files  318 passed (318)`, `Tests  6697 passed (6697)`;
  `pnpm test:e2e` -> `752 skipped`, `1272 passed (14.0m)`, exit 0 (all four projects; run on the build made before T035 / T036,
  which are Vitest-only).

## 2026-10-02 - claude-sonnet-5.5 (implement: US1 and US2 tests)
- Test tasks, each ticked because it fails as expected (AGENTS.md section 4). Evidence:
  - T013 `tests/core/play/guide-voice.test.ts`: `Tests  11 failed | 10 passed (21)`; the 11 fail on `guideChannel` null / no guide
    events (`expected null to be 1`, `expected [] to deeply equal [ Array(29) ]`, ...). Passing today, as guards: the 29-note
    precondition, left hand unchanged with accompaniment on, accompaniment never copied, both Orchestra cases (fixture and the
    real Morning Mood, SC-005), every channel in use, nothing graded, `guide: false` digest, determinism. The `guide: false`
    digest `95af4556...d4eea` was captured on commit 302bdaa (after FR-015, before the guide). `eight-measure-melody` has 29
    notes, not 32 as the task's first draft assumed.
  - T014 `tests/engine/play-session.test.ts` (+ `FakeAudioEngine.loaded`): `Tests  3 failed | 33 passed (36)`; the 3 fail because
    `start()` loads no mask channel. The SC-004 Grade tests (levels 0 / 60 / 100, guided vs unguided) pass today (nothing
    reaches the grader); they guard the implementation.
  - T015 + T016 `tests/engine/guide-render.test.ts` (+ `renderPlayRun` options `source`, `graded`, `guide`, `orchestraLevel`,
    `dry`, results `noteOnFrames`, `countInEndFrame`, `schedule`, `guideChannel`, `finalVoices`): `Tests  11 failed (11)`, all on
    the missing guide (`expected null not to be null`, `expected 1.3e-7 to be greater than 3.16e-5`, `expected 0 to be greater
    than 0.001`). The onset and sweep tests also assert that 29 guide notes exist, so they cannot pass vacuously. The densest
    hands-together item without an Orchestra is picked from `public/library/index.json` by `peakNotesPerSecond`:
    `repertoire/advanced/fur-elise-complete` (13.5 notes/s, 156 s). Stop and pause are asserted as: every sounding guide note is
    given its note-off in the next block, no note-on after, no voice left after 40 s, silence after 20 s (dry).
  - T017 `tests/e2e/guide-voice.spec.ts` (+ `helpers/schedule-spy.ts`, `PlayOptions.beforeStart`) and the Electron test in
    `electron-playback.spec.ts`: chromium run: the Play-without-Orchestra test fails (`Expected length: 1, Received length: 0`);
    the Morning Mood and Listen tests pass today (guards, analyze A6). The Electron one is run at the checkpoint.
  - T022 `tests/ui/levels-panel.test.ts`: `Tests  4 failed | 6 passed (10)`. T023 `tests/e2e/levels.spec.ts`: 2 failed (the slider is
    still disabled). These two expectations changed with spec FR-010 (replaces 019 FR-010), not to go green.

