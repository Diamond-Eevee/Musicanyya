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

