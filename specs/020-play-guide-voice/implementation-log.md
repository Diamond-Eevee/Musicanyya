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

## 2026-10-02 - claude-sonnet-5.5 (implement: US1, US2, US3 code)
- T018: `compilePlaySchedule` (`src/core/schedule/play-schedule.ts`): has-an-Orchestra check, `freeMelodicChannel`, graded events
  moved to the guide channel with velocity `min(127, max(1, round(v * GUIDE_VELOCITY_SCALE)))` and the run shift, guide channel
  setup in the run's channel copy only (`orchestra: true`, program `GUIDE_PROGRAM`, volume / pan from the defaults), `guideChannel`
  returned (null when nothing is graded in range or no channel is free). Evidence: T013 `tests/core/play/guide-voice.test.ts`
  `Tests  21 passed (21)`; T015 / T016 `tests/engine/guide-render.test.ts` `Tests  11 passed (11)`; `pnpm test -- tests/core`
  unchanged otherwise. Measured by a throwaway render (deleted): at Orchestra level 0 / 60 / 100 the guide is 99.3 / 15.8 / 6.9 dB
  below the piano playing the same notes (SC-002 asks 6 dB at the default level, 60); peak voices on `fur-elise-complete`
  12 guided vs 4 unguided, cap 350.
- T019: `PlaySessionController.start` passes `guide: true`. Evidence: `tests/engine/play-session.test.ts` `Tests  36 passed (36)`;
  e2e `guide-voice.spec.ts` + `electron-playback.spec.ts` on chromium, firefox and electron: `11 skipped`, `10 passed`.
- T020 RT review (`rt-audio-reviewer`, commit fe5608a): PASS WITH ADVISORIES, no blocking finding. Confirmed: no worklet / scheduler /
  MIDI code changed (two src files in the diff); one tick-to-time path (same shift, tempo map, `compileSchedule` ordering); the
  count-in is silent for the guide by construction; the guide is applied through the existing setup path (CC7 / CC10 defaults,
  CC11 = held Orchestra level, `orchestraLevel` re-send) and its notes are in `heldNotes`, so schedule load / pause / stop / seek release them;
  at most 44 setup controllers (limit 64); `channelSetup` bytes `[1, 4, 0, 0]`. **Advisory A1 (needs owner, FR-008):** the guide gives
  way "first" only by headroom, not by priority - spessasynth_core steals the lowest-priority voice (velocity, envelope, attenuation;
  no channel / CC term), so past the cap a quiet live note could go before a guide note. The measured peak is about 3.4 % of the cap, so the cap is
  not reached in the library. research R-6 corrected. Recommendation: accept FR-008 as "met by headroom" (no engine change); the
  alternative is a design change. Other advisories not acted on: A2 (guide voices still sound silently at level 0 - FR-012 is met),
  A3 (a NaN velocity guard; timeline velocities are integers), A4 (unison between hands on one channel: the same as before), A6
  (no signal when no channel is free; contract rule 2), A7 (one density case only).
- T024: `src/ui/i18n/en.ts` `levels.guideVoice` replaces `levels.noOrchestra`; `mx-levels-panel` never disables the Orchestra slider and
  shows / hides the hint (id kept as `mx-levels-no-orchestra`). Evidence: `tests/ui` `Tests  913 passed (913)`; `levels.spec.ts` on
  chromium, firefox and electron `12 skipped`, `18 passed`; `pnpm lint` exit 0.
- T026 (test, ticked because its e2e half failed as expected, `Expected length: 1 / Received length: 0`): core half in
  `tests/core/play/replay.test.ts` passes once T018 exists (analyze A10: `mergeSchedules` carries the mask), e2e half in
  `tests/e2e/guide-voice.spec.ts` (replay through the Attempts list; the Grade on screen after the replay equals the live run's).
- T027: `SessionController.prepareStoredRun` passes `guide: true` (replay and regrade). Evidence: `guide-voice.spec.ts` +
  `us4-attempts.spec.ts` on chromium, firefox, electron `4 skipped`, `11 passed`; `pnpm test` -> `Test Files  320 passed (320)`,
  `Tests  6738 passed (6738)`.
- Checkpoints T021 (US1), T025 (US2), T028 (US3), taken together at commit after 63f5f0f..: no keyboard was available and
  nothing here can be heard, so the sound is proved offline and the app's behaviour in the browser and Electron. Independent
  Tests:
  - US1 (quickstart steps 1, 4, 5, 6, no keyboard): count-in silent and notes from the first beat on the run's clock - SC-001 at 50 / 100 / 150 %
    (`guide-render.test.ts`) and the loaded schedule in browser and Electron (`guide-voice.spec.ts`, `electron-playback.spec.ts`);
    right hand only with accompaniment off - `guide-voice.test.ts` (right-hand keys on the guide channel, left hand absent);
    Morning Mood and Listen get no guide - e2e. Steps 2 and 3 (play along, wrong note by ear) need a keyboard and ears: **not run; for the
    owner (with OD-1)**. The Grade is identical with the guide at level 0 / 60 / 100 and against an unguided schedule (`play-session.test.ts`).
  - US2 (quickstart steps 1-3): a picture of the Levels panel on Greensleeves (library item, no Orchestra) in the dev app: Orchestra slider
    enabled at 60 %, hint "No orchestra in this score: sets the guide voice in Play mode" beneath it (DOM: `disabled` false,
    `aria-describedby` = the hint); 0 % fades the guide out - `guide-render.test.ts` (level 0 equals the unguided run within
    -90 dBFS, a mid-note change is much quieter within 3 blocks); level kept on reload and across Scores and the hint gone on Morning
    Mood - `levels.spec.ts` and `levels-panel.test.ts`.
  - US3 (quickstart step 1): replay of an attempt loads a schedule with the guide channel and shows the live run's Grade - e2e through
    the e2e MIDI path (`guide-voice.spec.ts`, replay test); at level 0 the replay equals the unguided one by the same CC11 path.
  - Full gate: `pnpm typecheck` exit 0; `pnpm lint` exit 0 (`Found 318 warnings.` `Found 13 infos.`); `pnpm test` -> `Test Files  320
    passed (320)`, `Tests  6738 passed (6738)`; `pnpm test:e2e` -> `763 skipped`, `1280 passed (14.3m)`, **exit 1**: one failure,
    `score-browser-timing.spec.ts:190` (SC-003) on Electron, `filter change` 114.6 ms against the 100 ms budget, while I was running other jobs
    on the machine; rerun alone on chromium and electron: `6 passed (27.2s)` (filter 41.1 / 24.0 ms). That file and the code it
    exercises are not touched by this feature; the full suite is rerun with nothing else running at T034.
  - `src/core/musicxml/support.ts` and `docs/musicxml-support.md`: the `<midi-instrument>` row says a part with no `<volume>` / `<pan>`
    plays at the defaults (T031); `tests/core/musicxml/support-doc-sync.test.ts` green (`Tests  463 passed (463)` over `tests/core/musicxml`).
    The README does not describe the Orchestra slider, so it is unchanged.

## 2026-10-02 - claude-sonnet-5.5 (implement: polish, audit, hand-off)
- T032 (quickstart manual verification), what was run and how: FR-015 steps 1-2 - the schedules the app sent were read in the in-app
  browser (CC7 51 / CC10 1, then 100 / 64), not heard. US1 steps 1, 4, 5, 6 - by offline render and e2e schedule capture (see the
  checkpoint entry), not heard; steps 2 and 3 (play along, wrong note) **not run** (no MIDI keyboard, no ears). US2 steps 1 and 3 - a picture of the Levels panel
  looked at (enabled slider, hint) and `levels.spec.ts`; step 2 (fade at 0 % by ear) - offline render. US3 - e2e replay through the e2e MIDI path.
  Owner listening check (OD-1, SC-007) **not run**: T029 is open.
- T033 constitution audit (`constitution-auditor`, branch diff): PASS WITH FINDINGS, no violation of principles I-VIII. Findings and what was done:
  1 MAJOR (FR-008 "give way first" is met by headroom only; the same as RT advisory A1) - **needs owner**, unchanged: recommended is to reword
  FR-008 and the edge case to "met by voice headroom, verified by the T015 peak below VOICE_HEADROOM_FRACTION x cap"; I did not change the spec
  (AGENTS.md section 7). 2 MAJOR (merge gate: T029, T030, T034 open, listening check not done) - open. 3 MINOR (the Domain Vocabulary has no
  "Guide voice" or "Orchestra" entry; a PATCH amendment is advisable, owner's call) - **needs owner**, not done. 4, 5, 8, 9 fixed (named
  `VELOCITY_MIN` / `VELOCITY_MAX`; `ChannelSetup.orchestra` comment; the `prepareStoredRun` comment; `docs/agents/reference.md` Recent
  Changes). 6, 7 notes, no action.
- Final gate, commit 'refactor(core): named velocity bounds...': `pnpm lint` exit 0 (`Found 318 warnings.` `Found 13 infos.`); `pnpm typecheck` exit 0;
  `pnpm test` exit 0 (`Test Files  320 passed (320)`, `Tests  6738 passed (6738)`); `pnpm test:e2e` **exit 1**: `763 skipped`, `1280 passed (14.3m)`,
  one failure, `score-browser-timing.spec.ts:190` (SC-003, feature 013) on Electron, `filter change` 110.6 ms against the 100 ms budget. It passes alone
  (filter 24.0 ms Electron, 41.1 ms chromium). Not resolved: filter-change medians on Electron in whole-project runs - this branch 79.4 (Phase 3
  code, passed), 114.6, 110.6, 101.0 (failed) and 92.5 (a run in which Electron tests were failing for an unrelated reason, see below);
  base commit ce880a3 (code of main) 58.9 and 72.9 (both passed). That looks like a real shift of some 30 ms, or machine noise: I could not tell which in
  the time I had, and the code the test exercises (the Score browser) is not touched by this feature. **Needs a decision**: rerun
  on a quiet machine, or investigate (first suspect: nothing in `src/` that the browser uses changed; the e2e suite has 19 more tests, which changes which specs
  run beside it). Side effect to know about: to compare I made a git worktree of ce880a3 with `node_modules` as a junction; one of the base runs
  damaged the shared Electron install (`Electron failed to install correctly` in the next HEAD run). The worktree and junction are removed (the
  `node_modules` folder is intact) and `electron-smoke` + `electron-playback` pass again (`10 passed`), but `node_modules/electron/dist` was re-extracted.
- T034 not ticked (the e2e gate is not green and T029 / T030 are open). Spec `**Status**` stays "In progress".
- Decisions: the guide goes in `compilePlaySchedule` as designed (R-1); `renderListen` / `renderPlayRun` gained test-only options (`before`, `dry`, `graded`, ...).
- Problems / open questions - needs owner: (a) OD-1 / T029 listening check on two items without an Orchestra (hands-together piece, single-hand
  exercise; try the default level 60 %; alternatives `GUIDE_PROGRAM` 5 / 11 / 89, `GUIDE_VELOCITY_SCALE`); (b) FR-008 wording (headroom, not priority);
  (c) Domain Vocabulary entry for "Guide voice" (PATCH amendment); (d) the e2e timing failure above.
- Handoff: next = T029 (owner listening), then T030 -> T034; run `pnpm test:e2e` again on a quiet machine first; tree clean at the next commit.

## 2026-10-02 - claude-sonnet-5.5 (owner feedback on the sound, OD-1 partial)
- Owner, after trying the guide: too quiet even at Orchestra level 100; "at 100 % it should be as expressive and loud as the piano, so the
  user hears both". Cause: `GUIDE_VELOCITY_SCALE` 0.6 left the guide 6.9 dB below the piano at level 100 and squashed its dynamics.
- Decision (owner's requirement, my pick of the value): `GUIDE_VELOCITY_SCALE` 0.6 -> **0.9** (`src/core/defaults.ts`, data-model section 4, plan,
  research R-5 with the measurements). Offline, dB below the piano playing the same notes at level 60 / 100: melody 9.1 / 0.2,
  dynamics-marks 8.5 / -0.4 (0.6 was 15.8 / 6.9). The default level (60) stays about 9 dB under the piano, so SC-002 (6 dB) and FR-004 hold;
  the sound (program 4) is unchanged. Evidence: `tests/core/play`, `guide-render.test.ts`, `play-session.test.ts` `Tests  141 passed (141)`; `pnpm test` below.
- Not changed: the spec (FR-004 "clearly quieter at the default level" still true). Following the player's touch or widening the Score's dynamics
  were discussed and are not part of this change (the spec rules out reacting to input).
- T029 stays open: the owner should listen again at 60 % and 100 % on two items without an Orchestra and confirm, or ask for another value.

## 2026-10-02 - claude-sonnet-5.5 (sound changes after owner listening; session end)
- Owner feedback on the sound, in order: (1) "volume better, but the Rhodes is too mellow and sinks into the piano" -> program 5 (FM Electric Piano),
  scale 1 (offline: 10.4 / 1.5 dB under the piano at level 60 / 100 on the melody); (2) "still too mellow" -> **Clavinet, `GUIDE_PROGRAM = 7`, scale 1**
  (current, `src/core/defaults.ts`, data-model section 4, plan, research R-5 "Change 3", reference Recent Changes). The owner also tried oboe on the right hand
  with strings on the left through a temporary audition split by key ("almost loved it"); that code was removed (not committed).
- Not verified for the clavinet: the guide's loudness against the piano (only the tine and FM presets were measured) and the tests. **The owner asked not to run
  tests while checking by ear, and the session ended before they were run**: `tests/engine/guide-render.test.ts` asserts the guide is at least
  `GUIDE_QUIETER_MIN_DB` (6 dB) under the piano at the default level (SC-002) and may need a different `GUIDE_VELOCITY_SCALE` with the clavinet. Only
  `pnpm typecheck` was run on this change (exit 0). The last full unit run (320 files, 6738 tests) was with program 5 / scale 1 before the clavinet.
- Deferred to the owner's next specify (not part of 020): a per-hand guide sound setting in the Play setup - Clavinet, FM Electric Piano, Vibraphone, Flute,
  Oboe, Strings for each hand (oboe right / strings left was liked); the open questions were the default, two dropdowns vs radio buttons (recommended: two dropdowns
  under "Guide sound", not "accompaniment"), and remembered vs per-run (recommended: remembered with the user settings). The spec's "one sound, no choice in the UI" (FR-003,
  Out of Scope) and a split of the guide by hand (staff) in `compilePlaySchedule` would change with it.
- Open owner decisions (status script lists T029): (a) T029 listening check with the clavinet on two items without an Orchestra, at 60 % and 100 %; the owner
  wanted the guide "as expressive and loud as the piano" at 100 %; (b) FR-008 wording (met by headroom, not priority; recommended: reword); (c) a "Guide voice" entry in the
  constitution's Domain Vocabulary (PATCH amendment); (d) the Electron-only e2e timing failure `score-browser-timing.spec.ts:190` (SC-003): filter change 79-115 ms on this branch
  vs 59 / 73 ms on ce880a3 in whole-Electron-project runs, 24 ms alone; unresolved, not caused by anything in this feature that I could find.
- Handoff: next = `/speckit:continue` -> (1) run `pnpm test -- tests/engine/guide-render.test.ts tests/core/play tests/engine/play-session.test.ts` and fix SC-002 if the clavinet fails it
  (measure with the throwaway render used in this session: dB below the piano at level 60 / 100; tune `GUIDE_VELOCITY_SCALE`, keep 6 dB at 60 %); (2) after the owner's
  listening answer: T029 -> T030; (3) full gate on a quiet machine (`pnpm test:e2e`), decide the timing test; (4) T034 and set the spec Status to "Implemented". Tree clean at the commit that
  follows this entry; branch `020-play-guide-voice`, local only, nothing pushed.

## 2026-10-02 - claude-sonnet-5.5 (gate on the clavinet; supersedes the "tests not run" note above)
- The owner meant "run the tests" (they only did not want temporary audition code while choosing the instrument). Run on the committed clavinet build (b5fed1c):
  `pnpm test -- tests/engine/guide-render.test.ts tests/core/play tests/engine/play-session.test.ts` -> `Test Files  12 passed (12)`, `Tests  141 passed (141)` (SC-002 holds);
  throwaway render (deleted), clavinet dB below the piano at Orchestra level 60 / 100: melody 10.4 / 1.5, dynamics-marks 10.3 / 1.4 - level with the piano at 100 %, about 10 dB under at the
  default, no change to `GUIDE_VELOCITY_SCALE` needed.
- Full gate: `pnpm lint` exit 0 (`Found 318 warnings.` `Found 13 infos.`); `pnpm typecheck` exit 0; `pnpm test` exit 0 (`Test Files  320 passed (320)`, `Tests  6738 passed (6738)`);
  `pnpm test:e2e` exit 0 (`763 skipped`, `1281 passed (14.0m)`, nothing else running). The SC-003 timing test passed this time (Electron filter change 74.2 ms, chromium 67.4 ms; budget 100):
  it is a load-sensitive budget, flaky in earlier runs (101-115 ms); no change in this feature touches the Score browser. Open decision (d) above is therefore downgraded to "known flaky".
- Still open: T029 (owner listening with the clavinet), T030, T034 (set the spec Status to "Implemented"); FR-008 wording and the Domain Vocabulary entry (owner); per-hand guide sounds (next specify).

