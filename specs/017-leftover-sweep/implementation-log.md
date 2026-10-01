# Implementation log: 017-leftover-sweep

## 2026-09-30 - claude-opus-5.5 (specify, plan, tasks)
- Owner request (2026-09-30): "wrap up everything, open new branch with anything that is left, so main has no
  leftovers", tasks rated by model. Model fit: specify/plan are deep, claude-opus-5.5 fits.
- Before branching, the merged `main` (ebd5e79, 016 merged by the owner after gemini-3.8-flash's T050/T055) was
  re-verified: `pnpm lint` 0 errors (317 warnings); `pnpm typecheck` exit 0; `pnpm test` Test Files 284 passed (284) |
  Tests 6137 passed (6137); `pnpm test:e2e` 1105 passed, 692 skipped, 3 failed - `lookahead.spec.ts:363` (chromium,
  glide timing; then passed alone once, failed alone 3/3 once), `score-browser.spec.ts:343` (firefox, 013 T112; 3/3
  alone), `chrome-look.spec.ts:159` firefox (a Firefox driver protocol error closing a *skipped* test's context; skips
  cleanly alone). Audio clock measured back at 1.0x (3.007 s audio per 3.012 s wall, still 88.2 kHz).
- Done: spec.md (5 stories, FR-001..FR-012, SC-001..SC-004), plan.md, tasks.md (30 tasks, phases by tier: light 3,
  standard 17, deep 4, owner 3, polish 3), checklist (all pass). T002: the 16 open tasks of 001, 003, 004, 005, 011
  and 013 are marked `[>]` "moved to 017 T0xx" in their own tasks.md; `status.ps1` now shows 001-016 all done.
  New task T017: the lookahead glide flake. Encoding fix while copying: 005's lines read "Burgm�ller"/"F�r Elise".
- Problems / open questions: needs owner: OD-1 (T018, title rule when both work-title and movement-title exist);
  needs owner: the checks of Phase 4 (T025 real MIDI keyboard, T026 learner test, T027 five-person SC-008).
- Handoff: next = analyze (implement step 1), then T001 -> T003 -> US1 (T004-T015); tree clean at the commit.

## 2026-09-30 - claude-opus-5.5 (analyze, OD-1, baseline)
- Analyze (read-only, tasks.md as of 788f82e): 0 CRITICAL, 0 HIGH. Every FR-001..FR-012 maps to tasks, every
  SC-001..SC-004 has a verifying task, constitution check pass. LOW: T020's "1080p laptop screen" is met with
  `pnpm screenshot --width 1920 --height 1080` (stated on the task).
- T018 OD-1: **owner approved** (2026-09-30) - the Score title is `<movement-title>` when present, else
  `<work><work-title>`; no second field, so 001's data-model is unchanged. T019 implements it.
- T001 baseline (branch = main ebd5e79 + docs only): `pnpm test` Test Files 284 passed (284) | Tests 6137 passed
  (6137); `pnpm lint` 0 errors, 317 warnings, 13 infos; `pnpm typecheck` exit 0 (run on main before branching, same
  sources).

## 2026-09-30 - claude-opus-5.5 (implement - US1 code, US2 title)
- Done: T003-T014 (US1 code; RT review T015 running), T019.
  - T003 (from 001 T165): `LIVE_QUEUE_CAPACITY = 64` in `src/core/defaults.ts` (+ 001 data-model constants table);
    the worklet imports `LIVE_CHANNEL`. Existing worklet tests (the 64-entry drop test, LIVE_CHANNEL 15) green: 69.
  - T004/T005 (from 001 T162): `score-player.live-validation.test.ts` - 15 failed as expected (malformed live
    messages queued unchecked), 1 passed (well-formed edges); `toLiveMessage()` in the handler -> 16 passed.
  - T006-T009 (from 001 T163/T164): the held-note `Set` half of 001 T163 was already done on main (Uint8Array bitmap
    + held count). An allocation probe was measured and rejected (V8 `total_allocated_bytes`: an allocating loop
    reported fewer bytes than a non-allocating one - escape analysis and noise), so T006/T008 were reworded (tasks.md):
    behaviour of the extracted `soundOffChannels` helper, and identity of the reused `position`/`ended` objects.
    `score-player.no-alloc.test.ts` 4 failed as expected (no helper; fresh object per report), then green.
    `score-player.tempo.test.ts` now copies each report it keeps - it stored references, and the object is reused
    now (harness change, assertions unchanged).
  - T010/T011 (from 001 T166): `score-player.port.test.ts` 10 failed as expected (no handler), then green with
    `createPortMessageHandler` (envelope check, everything inside `try`).
  - T012/T013 (from 001 T167): finding - at the 1024-event limit dispatch does not lose events, it defers them to the
    next block (late by up to one block; lost only if the end falls in that block, where all-notes-off follows), so
    "loses events" in 001 T167 was imprecise; the lateness was uncounted. Tests (dispatch, processor, engine,
    diagnostics view) failed as expected; now `deferredInBlock`/`deferredTotal` in `DispatchState`,
    `position.dispatchDeferred` (worklet-protocol **1.5.0**, additive), `AudioDiagnostics.dispatchDeferred`, row
    "Events played late (block full)". 001 data-model diagnostics shape updated (it also lacked `liveQueueDropped`).
    `WORKLET_PROTOCOL_VERSION` in web-audio-engine.ts said 1.3.0 -> 1.5.0 (informational).
  - T014 (from 001 T168): invariant stated at the drain (full drain, no early exit; port messages never interleave
    with `process()`); the existing 64-entry test proves a full queue is applied in one block.
  - T019 (from 001 T155, OD-1): **already implemented on main** since 2026-09-23 (ac5c1fe, feature 006's title block):
    `score.title = movementTitle || workTitle || null`, which is exactly the owner's rule; `<movement-title>` is in
    `SUPPORT_MATRIX` / docs as Supported. Added `tests/core/musicxml/movement-title.test.ts` on the three real files
    and minimal documents as a guard - it passes from the start, recorded openly (001 T155 described older code).
- Checks: `pnpm test` Test Files 288 passed (288) | Tests 6172 passed (6172) before T019's test (+3 now); lint 0 errors;
  typecheck exit 0.

## 2026-09-30 - claude-opus-5.5 (implement - RT review, US1 follow-ups, T016)
- Session start: 8 uncommitted files from 11:27-11:29 (T016 fix + tests; T015's N1 rename in tests only), no claim
  suffix, not logged. Owner (asked): "no one, adopt it" - adopted and checked, not redone blind.
- T015 RT review (rt-audio-reviewer, ran 11:24-11:27 in the previous session; its report recovered from the
  transcript): **PASS WITH ADVISORIES**, nothing blocking in T003-T014. N1 the full-block probe counted a backlog
  again in every block it lasted (3000 events: 2928 counted, 1976 late) - fixed: lateness is counted in the dispatch
  loop when an event sounds before-its-frame (also after a tempo re-anchor), field renamed `dispatchDeferred` ->
  `lateEvents` (worklet-protocol 1.5.0, never released), row "Events played late"; new test: a backlog over 2 blocks
  counts each late event once. N2 the probe's O(B^2) cost - gone with N1. N4 contract/ports did not say `liveDropped`
  also counts malformed live messages - fixed. N3, N5, N6 -> new tasks T031-T033. Advisory: spessasynth's own
  noteOn/process may allocate (library internals, residual risk, not measured). Commit 0dc0640.
- T016 (from 013 T112) **cause found**: the browser is open from start-up and first loads its library index; a file
  dropped in that window failed to the load-error view hidden behind the dialog (only `browserWasReady` drops sent
  `openFailed`), so `.browser-message` stayed empty - load made that window longer. Fix `browserState.fileFailed()`
  (any open phase; kept through `indexLoaded`; also for a too-large file). Tests: `file-failed.test.ts` 4 failed
  (`fileFailed is not a function`) -> 4 passed; new e2e test holds `library/index.json` so the moment is certain:
  failed on the old code in chromium and firefox (`Received string: ""`), passes now. Evidence: 4 full `pnpm test:e2e`
  runs (8 workers, 12.8-13.4 min each; the first log file holds two runs): the score-browser tests passed in every
  browser in all 4. Other failures in those runs: `lookahead.spec.ts:363` chromium 4/4 (T017); `piano-keyboard.spec.ts:531`
  chromium 2/4 + firefox 1/4 (new T035); electron `lookahead.spec.ts:69` 1/4 (new T036); run 2 had 9 electron tests
  fail at launch with "The process cannot access the file because it is being used by another process" /
  "Electron failed to install correctly" while I ran vitest from a worktree sharing `node_modules` - environment.
  Summaries: run 1 `2 failed | 694 skipped | 1108 passed` (x2), run 2 `10 failed | 694 skipped | 1100 passed`,
  run 3 `3 failed | 694 skipped | 1107 passed`. Commit 9755166.
- T031-T034 (commit 205b950), each test first, failing for the expected reason:
  - T032: `score-player.tick-validation.test.ts` 21 failed (NaN/negative ticks threw "Cannot read properties of
    undefined (reading 'startTick')" in the handler; others played from the wrong place) -> 21 passed. Rule: a
    non-finite tick counts as absent (play plays on, stop -> 0, seek ignored), a finite one is clamped to
    [0, endTick]. Each case compares with the run of the equivalent valid messages. `stop` with `null` left out (the
    old `?? 0` already handled it).
  - T033: `score-player.volume.test.ts` 5 failed (output stayed 1.0) -> passed: `applyGain` scales the block in place
    per sample after `renderBlock`, ramp over `VOLUME_RAMP_FRAMES`. `listen-render-golden` then measured 0.83x: the
    golden was recorded while the volume did nothing (unity), so its helper now passes `volume: 100` (reason in the
    helper) - the level bound is unchanged.
  - T031: allocation is not measurable (as T006/T008), so `live-queue.test.ts` tests the extracted `LiveQueue` ring
    (typed-array slots, `push`/`consume(n)`, 1000 wrap cycles) and `liveKindOf`; failed (module missing) -> passed;
    the processor drain now consumes exactly what it applied (T014's invariant is structural).
  - RT review of T031-T033 (rt-audio-reviewer): **PASS WITH ADVISORIES**, nothing blocking; render path allocation-
    free, ring and ramp correct, every renderBlock path gets the gain once, validTick safe with reloadSchedule/atEnd.
    NON-BLOCKING: the saved volume never reached the worklet -> new task T034, done: `web-audio-engine.test.ts` new
    test failed -> passed (volume sent after `init`, `Session.start` hands the saved volume to the engine). Advisories
    done in T034: initial `volume` option validated (test failed without the guard), `LiveQueue` capacity >= 1 (test
    failed without the guard). Advisory kept: `validTick` accepts fractional ticks (harmless for frame math; held
    ticks are fractional already). Advisory kept: a throw mid-`renderBlock` sends one unscaled block before the
    processor goes silent.
  - worklet-protocol 1.5.1 (PATCH). The T031-T033 code was written in a detached worktree during the e2e runs (so
    the runs' builds stayed T016-only) and copied back; worktree removed.
- T017 finding so far (not fixed): in the failing run the glide itself takes ~400 ms, but it starts ~300 ms after
  the click (timeline: `gliding` first at 305 ms, still at scrollTop 0 until 384 ms). Measured in Node on the same
  fixture at 1280 px: `getPageWithElement` 1.7 ms, all 500 measures 76 ms, one page render 11 ms - so the Verovio
  worker's answer is not the delay; next: instrument measureclick -> seek -> position -> follow on the main thread.
- Checks: `pnpm test` Test Files 293 passed (293) | Tests 6215 passed (6215); `pnpm typecheck` exit 0; `pnpm lint`
  0 errors (316 warnings, 13 infos).
- **Checkpoint (US1)**: T003-T015 and follow-ups T031-T034 done, both RT reviews without blocking findings. Full gate
  at 205b950: lint 0 errors, typecheck exit 0, unit as above, `pnpm test:e2e` `1 failed | 694 skipped | 1109 passed`
  (12.9 min) - the one failure is `lookahead.spec.ts:363` chromium (T017, open; arrival 681 ms). US1's Independent
  Test (spec: the audio-thread fixes proven by their unit tests, RT review clean) holds.
- Problems / open questions: needs owner: with T033 the playback volume scales the whole worklet output, so the
  sound of the user's own keys (live input, same synth) follows the volume slider too, and starts at the default 80
  instead of unity. Recommendation: keep it (one volume, like a master volume); the alternative is a separate
  "keyboard volume", which is a new setting (spec change). Not blocking any task.
- Handoff: next = T017 (instrument measureclick -> seek -> audible cursor -> follow; suspect the follow waits for the
  output-latency-delayed audible cursor), then T035, T036, T020; tree clean at the log commit.

## 2026-09-30 - claude-opus-5.5 (implement - US3 e2e reliability: T017, T035, T037)
- T017 (lookahead.spec.ts:363, FR-009) **cause: the measurement** - with temporary probes (tests/e2e/zz-probe-017,
  deleted) run inside full `pnpm test:e2e` loads: the test pressed Play, waited a fixed 1 s and clicked, but under load
  the sound was still loading then (transport `loading`, no engine on the score view for 100-450 ms); the view cannot
  follow before playback starts (FR-014), so the loading time counted as arrival (681-864 ms). Fix: the test waits for
  transport `playing` first (no product change). Measured during playback under full load (12 samples): the seek's
  report back in 2-14 ms, glide start 32-35 ms after the click. Evidence: 3 full runs, `lookahead.spec.ts:363` green in
  each - distant 432/432/433 ms, back 382/381/398 ms (bound 500); run 1 fully green (`694 skipped | 1110 passed`),
  runs 2-3 `1 failed | 694 skipped | 1109 passed` (T037). Commit b6459c1.
  - **Withdrawn on the way (recorded openly)**: my first reading of the probe blamed a slow audio-thread round trip
    (229-446 ms) and I built a pending-seek display change (worklet-protocol 1.6.0, `seekSeq`, `PositionSync.beginSeek`,
    RT-reviewed: pass with advisories, tests written test-first). The later probe showed those numbers were the
    not-yet-started playback, not the round trip (2-14 ms while playing), so the change solved nothing: reverted before
    any commit, together with its research.md entry and contract bump. Nothing of it is on the branch.
- T035 (piano-keyboard.spec.ts:531, 010 T021) **cause: two small bugs**. (1) The latency poll (`session.ts`, every
  1 s) compared the fractional output latency with the rounded value it had stored, so it emitted a MIDI-state change
  every second forever. (2) The on-screen piano rebuilt its hint list on every MIDI or Practice notification; a hint
  resolved by Playwright and measured across a rebuild was detached (`boundingBox()` null). A first theory (a late
  Practice-session start clearing the feedback) was checked with a probe that delayed `AudioContext.resume` 500 ms and
  a clear-tracer run 24 times under load - refuted: nothing cleared the feedback. Fix: compare whole ms; rebuild the
  hints only when the feedback map changed (reset when the list is recreated). Tests (piano-keyboard.spec.ts): "three
  MIDI-state notifications change no hint" failed on the old code in chromium and firefox (`Received: 6`); "the poll
  never notifies an unchanged latency" failed on the old code (5-6 repeats in 3.5 s). A first version asserting "no
  rebuild in 3.5 s" was dropped: a real latency change (the value settling once) is a legitimate rebuild. Evidence: 3
  full runs, the piano tests green in all; runs 2-3 fully green (`696 skipped | 1116 passed`), run 1 `1 failed` (T037).
  Commit 64da25b.
- T037 (us3-run-chrome.spec.ts:116, FR-009 Grade popup) **cause: a product bug**. Probe under load (2 of 20
  samples): the run was stopped in its count-in, and the Grade was published while `playState.run.phase` still said
  `countIn` - `playState.run` is copied from the controller once per animation frame (score view loop), the grade
  worker answered before the next frame, `isRunActive()` read the stale phase as a run in progress, and the Grade was
  never opened. Fix: `onPlayGraded` publishes the controller's current run before deciding. Test (us3-run-chrome):
  frames slowed to 1.5 s on demand, stop in the count-in - failed on the old code in chromium and firefox (`Received:
  hidden`), passes now; the guard "never over a run that has started since" is unchanged (a new run is what
  `getRun()` returns then). Evidence: 3 full runs in a row, **all fully green** (exit 0, `697 skipped | 1119 passed` each, 12.7 min) - no failure of any
  kind, T036's test included. Commit: this one.
- Checks: `pnpm test` Test Files 293 passed (293) | Tests 6215 passed (6215); `pnpm typecheck` exit 0; `pnpm lint` 0 errors
  (316 warnings, 13 infos).
- Handoff: next = T036 (electron `lookahead.spec.ts:69`, seen once in ~20 runs: Start stayed "Start" for 5 s - first
  suspicion the first SoundFont load in electron under load; measure first), then T020 (manual verification with
  `pnpm screenshot`), deep tasks, owner checks, polish T028-T030. Owner question still open: live input follows the
  playback volume (log entry above).

## 2026-09-30 - claude-opus-5.5 (implement - T036)
- T036 (electron-project `lookahead.spec.ts:69`, Practice Start still "Start" after 5 s; 1 failure in ~20 full runs):
  **not reproduced, no defect found, no code changed.** The `electron` project runs this spec in Playwright's default
  Chromium page (no `browserName`), not in the Electron app. Probe (tests/e2e/zz-probe-036, deleted), 10 samples each
  in the `electron` and `chromium` projects inside a full `pnpm test:e2e` load: click received 30-66 ms after the
  click, transport `loading` (the SoundFont) then `playing` after 1.32-1.63 s - far inside the 5 s the test allows.
  That run: `1139 passed`, 0 failed. Since the one failure, the test passed in every full run (about 12). The failure
  was in the run where I ran vitest and tsc from a side worktree at the same time, the run whose nine electron-app
  tests could not even launch ("the process cannot access the file"): attributed to that extra load. Lesson (also for
  the owner): no other heavy job (vitest, tsc, builds) on this machine during a full e2e run. Evidence of the 3 green
  runs: the T037 runs (f7ba8b1), all three fully green with this test included.

## 2026-09-30 - claude-opus-5.5 (implement - T020, 004 manual verification)
- How: 004 `quickstart.md` "Manual verification", window 1920 x 1080 (the 1080p laptop screen, maximised). `pnpm screenshot
  --width 1920 --height 1080` for the static steps; for steps it cannot drive (menus, Escape, Tab, resizing, size keys,
  reload) a temporary Playwright walkthrough (tests/e2e/zz-t020-walkthrough, deleted) in chromium at 1920 x 1080 saving
  one PNG per step, and the in-app browser pane at the same viewport for re-checks. 39 pictures in
  `tests/.generated/017/t020/` (git-ignored), every one looked at. Two script results were my measurement, not the
  app, and were re-checked: focus after Escape (checked once, too early - us2-panels.spec.ts asserts `toBeFocused()`
  and is green) and "7 of 15 controls reached by Tab" (15 = 7 theme radios + 3 hidden mode radios + 5 checkboxes =
  exactly 7 tab stops, all reached).
- US1: `us1-1920.png` one slim bar, no side/bottom panel, full-width music, two complete systems readable - pass.
  `us1-960.png` music re-flows, no horizontal scrollbar, **but the bar's More menu is cut off** - fail -> T038
  (measured: 925-984 px overflow by up to 55 px with a Score open; 900 and >= 990 fit). `us1-empty.png`,
  `us1-5-empty-before-drop.png` one invitation; `us1-5-after-drop.png` a file dropped on the area opens - pass.
- US2: `us2-1-menu-{score,setup,view,help}.png`, `us2-2-panel-{browser,scores,attempts,setup,midi,latency,view,help,
  diagnostics,environment}.png`: every entry opens over the music, 0 score DOM mutations, the music never moved -
  pass; **Setup (in Listen), Recent attempts (none yet) and Latency (audio not started) open empty** -> T041.
  `us2-3-second-popup.png` the first closes - pass. Escape closes, focus returns (see above) - pass. `us2-5-view-
  tabbed.png` Tab reaches every control, Escape closes - pass. `us2-6-run-after-play.png` Play closes the popup, the
  run starts, no dialog - pass. `us2-7-menu-during-run.png` / `-after-stop.png`: entries greyed during the run and back
  after Stop, except "Open..." which stays enabled by 013's later decision (the browser may open during Listen and
  pauses it) - pass as amended by 013.
- US3: `us3-1-setup-popup.png`, `us3-1-setup-chosen.png` Practice setup (help, loop; parts/hands appear only for a
  Score that has them - the fixture has one staff; the two-staff case is us1-practice.spec.ts, green).
  `us3-2-practice-running.png` no setup controls; the bar shows mode, measure and Stop - pass. `us3-3-device-lost.png`
  notice in the corner, nothing modal, layout unchanged, run continues - pass, **but the notice appears twice** ->
  T040 (confirmed live: one `deviceLost`, two notices). The same picture shows the run status past the edge: measured,
  that is the single frame before the bar's scheduled re-fit (75 px over at once, 1920/1920 and `mx-bar-no-word` 600 ms
  later) - by design, not a defect. `us3-2b-after-stop.png` Stop ends the run in one press - pass. `us3-4-play-
  grade.png` (`pnpm screenshot --run --grade`) the Grade over the music with per-note marks - pass (dismissing keeps
  the marks: us3-run-chrome.spec.ts, green).
- US4: #1-2 a full Listen pass at 1920 x 1080 with the cursor's system never covered is `us4-overlays.spec.ts` at
  exactly this size, green in every full run today. `us4-3-piano-on.png` the music keeps clear of the strip (207 px
  bottom inset) - pass. `us4-4-layer-{cursor,marks,advice,notices}-off.png`, `us4-4-layer-pianoKeys-on.png`: the
  switches change at once and the piano strip appears at once; with nothing running the cursor/marks/advice layers
  have nothing to draw, so those effects are the e2e tests' (marks: play-grade-marks, pressed-keys, us1-layout).
- Score size: `size-1-larger-x3.png`, `size-2-largest.png` staves 153 -> 306 px (2.0x) at 200 %, re-flow, never a
  horizontal scrollbar; Ctrl+0 / Ctrl+= / Ctrl+- / + / - step and reset - pass. `size-4-after-reload.png` **size and
  piano keys lost after a reload** -> cause found: the settings write is debounced 500 ms and never flushed when the
  page goes away (by hand, with a pause, both are kept) -> T039.
- Also seen: the load notice "... default tempo was used. - measure 0", and a previous Score's load notice staying over
  the next Score -> T042.
- Behaviour neutrality: `pnpm test` green (Test Files 293 passed (293) | Tests 6215 passed (6215)); grading unchanged
  (golden grading tests in that run).
- Result: T020 done; 004's script fails in two places it names (US1 #4 at half width, Score size #4 on a quick
  reload) and shows three smaller defects - T038-T042 (standard tier). Handoff: next = T038-T042, then the deep tasks
  (T021-T024), owner checks (T025-T027), polish (T028-T030).

## 2026-09-30 - claude-opus-5.5 (implement - T020 findings T038-T042; deep T021, T044, T045; T046)
- Each fix test first, failing for the expected reason on the old code (numbers in the commits):
  - T039 (0f1d958): settings writes were debounced 500 ms and never flushed on unload. `SettingsStore.flushPending()`
    (ports 2.1.0), called on `pagehide` and when hidden. Unit tests (method missing) + e2e reload-at-once (100 % instead of
    120 %, chromium + firefox).
  - T040 (65264af): one disconnect = two notices (session's general one + Practice's / Play's own). General notice only
    when neither runs. e2e: 2 -> 1 for Play and Practice; a Listen case guards the general notice (passes on old code).
  - T042 (6cbb63e): document-level load entries used '0' as a measure label ("- measure 0"); now none. The buildScore
    golden changed in exactly those entries (59 x `["0"]` -> `[]`, verified by the diff). **Notice lifetime across
    Scores split off as owner decision T043** (no spec rule exists).
  - T041 (6bcf234): Setup (Listen), Recent attempts (outside Play) and Latency (before a Play run) opened empty; a hint
    line each (`mx-panel-hint`, latency empty text). e2e (no text on old code) + unit; pictures looked at
    (`tests/.generated/017/t041`).
  - T038 (063d3a3, corrected in a432826): bar overflow 925-984 px with a Score open. First fix moved mode switch and size
    controls together as a measured `fitBar()` step - the next full e2e run failed pressed-keys' zoom tests (chromium,
    firefox, electron): during a Practice run at 1280 px the size controls left the bar, and no popup can open during a
    run. Measured: before T038 that bar already overflowed by 39 px at 1280 during a run. Correction: the mode switch
    moves first, the size controls only last; at 1280 during a run the bar fits and keeps zoom; below ~1100 px during a
    run zoom stays on the keys. e2e at 930/960/984 (7-69 px over on old code) and a run-at-1280 test (39 px over on old
    code); `barFitted()` now waits for an exact fit. Bar looked at, 960 and 390 px.
  - T021 (90b9fff, deep): the percussion "gap" = Cowbell's `<measure-repeat>`: Verovio drew the simile sign instead of
    the 4 encoded (played) notes. Render copy leaves the sign out (`withoutMeasureRepeats`), notes engraved, every Note ID
    drawn (Constitution III). Alternatives and reasoning in 001 research R-9; `<measure-repeat>` Partial. **Owner may want
    to know**: a measure-repeat sign is now shown as its notes.
  - T046 (68137af): the empty `it('assigns first-part measure ids only')` got its assertion (passes from the start; a
    mutation turns it red).
  - T044 (e533177, deep): a `<sound tempo>` directly in `<measure>` was ignored. Now read; one mark per position per part,
    later wins as the tempo map always did, a `<metronome>` alone never overrides a sound. A first merge rule kept the
    earlier of two sounds - caught by comparing played tempo: Dvořák m. 155 ("rit." 106 then printed 100) would have
    changed 100 -> 106; fixed and tested. Compiled tempo of all 23 real/spec fixtures and 181 library pieces compared
    before/after: identical except the four W3C examples that now play their written tempo. real-scores pins mark
    counts (per part): eight updated with the reason on the field.
  - T045 (70f6741, deep): the drum kit on an F clef is drawn below the staff by Verovio itself (original file, no render
    copy: MEI loc -3/-7 = treble positions). Recorded (`<unpitched>` Partial) with a characterisation test; the
    render-copy workaround is new task T047.
- Found in passing: a measure-level `<sound>` is also ignored for jumps (dacapo, segno ...) and dynamics - not in any
  task yet; noted here for the owner/next agent.
- Full e2e after T038's correction and T021: `701 skipped | 1159 passed` (exit 0). Unit: Test Files 297 passed (297) |
  Tests 6232 passed (6232); typecheck exit 0; lint 0 errors.
- Needs owner: T043 (load notices across Scores, recommendation in the task); live input follows the playback volume
  (earlier entry); T022-T024 need downloads of public-domain sources (asks permission); T025-T027 are the owner's checks.
- Handoff: next = T047 (deep) or polish T028-T030; tree clean at the log commit.

## 2026-09-30 19:40 - claude-opus-5.5 (continue - T043, T029; T048 found)
- Session start: 5 uncommitted files (measure-repeat sign kept where no notes are encoded; malformed `volume` gain
  ignored), unexplained by the last hand-off; the owner said to adopt them as T029 work. Their tests passed (12).
- Evidence for commits after the last entry: T047 (d3ba5f8) and T028 (5efb5c1), see their commit bodies.
- Done: T043 (7c795b4). **Owner approved the recommendation**: when another Score opens, the previous Score's load
  notices go; device, storage, audio and failed-open notices stay until dismissed (001 FR-005, 017 FR-013). Load
  notices are tagged (`Notice.load`) and never merged with a same-code notice raised outside a load. Three tests in
  `open-and-drop.test.ts`, all three failed on the old code.
- Done: T029. `constitution-auditor` on `main...HEAD` plus the working tree: **no CRITICAL/HIGH**; findings and fixes:
  1. MEDIUM (III, docs): the `<measure-repeat>` row said the sign is never drawn; now "notes engraved in place of the
     sign; with no encoded notes the sign stays and plays as rests" (SUPPORT_MATRIX + docs).
  2. MEDIUM (III, missing task): a measure-level `<sound>` ignores jumps and dynamics silently - new task **T048**,
     and the gap is written in the `<direction>` row.
  3. LOW (IV): `measureHasNotes` found the measure only by `<measure ` / `<measure>`; now `/<measure[\s>]/`. New test
     (unpitched-only measure; a line break after `<measure`) failed on the old match.
  4. LOW (I): the worklet `volume` change needed an RT check - `rt-audio-reviewer` ran: **PASS, nothing blocking**.
     Its advisories: mid-ramp case untested -> new test (fails on the old handler, as does the malformed-gain test);
     the 1.5.1 summary of `worklet-protocol.md` now states the rule (PATCH, no shape change). Not acted on (advisory,
     pre-existing, off the render quantum): one `liveDropped` post per dropped live message.
  5. LOW: the measure-repeat sign shown as its notes (T021) - owner information, see below.
  6. LOW: log evidence for T047/T028/T043 - this entry.
- Checks: unit `Test Files 298 passed (298) | Tests 6245 passed (6245)` (exit 0); typecheck exit 0; lint 0 errors; e2e (all projects, before the last `measureHasNotes` regex fix) `1159 passed | 701 skipped` (exit 0). A first unit run timed out once on the Grosse Fuge real-score test (5 s) while e2e loaded the CPU; alone it passed 109/109, and the full run above was clean.
- Needs owner (information, no action unless you object): since T021 a measure-repeat sign whose measure also
  encodes its notes is engraved as those notes, so every played note can be marked (Constitution III).
  T022-T024 need downloads of public-domain sources (ask first); T025-T027 are the owner's own checks.
- Handoff: next = T048 (deep, measure-level `<sound>` jumps/dynamics), then T030 (full gate x3); T022-T024 wait for download permission, T025-T027 for the owner; tree clean at the T029 commit.

## 2026-09-30 20:55 - claude-opus-5.5 (implement - T048, T030 gate)
- Session start: tree clean; `pnpm test` `Tests 6245 passed (6245)`, `pnpm lint` 0 errors - matches the last entry.
  Model fit: T048 is deep, this model fits.
- Done: T048 (af3de42). A `<sound>` directly in `<measure>` is now read for dynamics and jumps (dacapo, dalsegno,
  tocoda with time-only; fine, segno, coda targets) by the same code as a `<sound>` in a `<direction>`
  (`readSoundPlayback` in `build.ts`). `tests/core/musicxml/measure-sound.test.ts`: 3 tests build each document with
  the `<sound>` in the measure and in a direction and compare navigation, sound dynamics and the played schedule;
  all 3 failed on the old code (empty jumps/targets/soundDynamics). A 4th test (unusable dynamics value ignored) was
  dropped before commit because it also passed on the old code. Real files: a probe fingerprinted the whole compiled
  schedule of all 204 real fixtures, spec examples and library pieces before and after - identical; none contains
  such a `<sound>`. `<direction>` row of `SUPPORT_MATRIX` / `docs/musicxml-support.md` updated (gap removed).
  Not RT code: no RT review needed.
- T030 [~]: full gate three times in a row at af3de42, each run: lint exit 0 (0 errors, 316 warnings), typecheck
  exit 0, unit `Test Files 299 passed (299) | Tests 6248 passed (6248)` exit 0, e2e `701 skipped | 1159 passed`
  exit 0 (12.9-13.0 min). `status.ps1` shows no open task in 001-016 (SC-001). Kept `[~]` (mine): T022-T024 would
  change library files, so the gate must run again after them before the branch is ready to merge.
- Needs owner: T022-T024 need permission to download public-domain sources (Petzold/Bach Anh. 114, 115, 126;
  Joplin *The Entertainer*; Chopin Op. 9 no. 2); T025-T027 are the owner's own checks. Alternatively the owner may
  agree to record T022-T027 as not done, which makes the branch mergeable (T030's rule).
- Handoff: next = T022-T024 once downloads are allowed (then T030 gate x3 again), else owner agreement on
  T022-T027; tree clean at the log commit.

## 2026-09-30 23:55 - claude-opus-5.5 (continue - owner answers; T049-T051, T022, T024; T023 blocked)
- Owner answers (2026-09-30): **downloads allowed** for T022-T024; **T025-T027: write the steps, keep them open** (the
  branch is not merge-ready until the owner reports the results).
- Done: T049, T050, T051 (ee4c07c) - three LilyPond constructs the new sources use and the tools refused: `\repeat
  "volta" 2`, a top-level `\markup`, and Mutopia 263's hidden scaled note carrying a tie (`\hideNotes bes4*1/4 ~`).
  Tests (`tests/tools/lilypond/read.test.ts`, `to-musicxml.test.ts`, `tests/core/musicxml/write.test.ts`) each failed
  on the old code for the expected reason ("expected word, found 'volta'"; "LilyPond 1:1: \markup"; "a note value
  scaled with *n/m", no `print-object`). A test that the unquoted/visible form still behaves was folded into the
  failing tests rather than kept alone (it passed on the old code). Also: a tie no later note of its own voice
  continues is not written (LilyPond prints none); a probe over all 22 sources found one only in Mutopia 263, so no
  existing item changes. Contract fidelity-tools 1.13.0. Tools tests `Tests 1205 passed (1205)`.
- Done: T022 (ced1f5e). Petzold Minuets BWV Anh. 114, 115 and Musette BWV Anh. 126 (Mutopia 75, 76, 79; "Copyright:
  Public Domain" on each page and in each .ly, checked 2026-09-30). `library:convert-ly`: notation vs sound 0,
  conversion vs notation 0 differences each (32 bars/203 notes/1 grace, 32/199, 20/171). `pnpm library:fidelity`:
  `185 records, 0 failed`. Screenshots looked at (`test-results/screenshots/<id>.png`): notes, key, metre, repeats,
  mordents and fermata as expected. Review: `music-domain-expert` on the three sidecars - must-fix: tag `phrasing`
  unjustified on both minuets (no slurs) -> `steady-eighths`; 115's trains omitted E/B naturals and the B flat/F major
  key plan; the Musette's left hand leaps on D, then A and E, doubling the right hand in bars 3-4/7-8, and the second
  half ends in A major over an E pedal (D sharp is a neighbour note, no E major); should-fix: bars of each ornament,
  Pralltriller wording in `limitations`, `ties` tag on the Musette, "appendix of doubtful works" for BWV Anhang. All
  applied. My own first check had already caught a false "C sharp" in 115 and a false `dynamics` tag on the Musette.
  Both minuets load with an info notice (`unsupportedElement` inverted-mordent: bars 30; 8, 9, 15, 31) recorded as
  `expected` + `limitations` (criterion 28) - owner question T052.
  Expected values changed, with reason: `tests/fixtures/library-identity.json` regenerated by `tools/library/identity.ts`
  - diff is the 3 new items only, no removed line (its side effect on `performance-logs/fur-elise-theme.json`, a
  reformat only, was reverted); `tests/library/out-of-scope-hashes.json` gains the 6 new files (the test comment says
  items added later are recorded when added). Unit after: `Test Files 299 passed (299) | Tests 6267 passed (6267)`.
- T023 **blocked, T053 (owner)**: Mutopia 263 (public domain) converts with 0 differences, but (1) level criterion 16
  fails at Advanced - bars 58 and 66 hold B flat5-G5-D5 over a moving G4 in one hand, 15 semitones, cap 14; (2) its
  ties into the second endings (bars 38 via `\repeatTie`, 92 implicitly) are not written as tie stops, so the app
  re-attacks those notes on the second pass where the source MIDI holds them (bar 92 gives 3 `brokenTie` notices; bar
  38 re-attacks silently - `resolveTies` replaces an open chain without a notice). The comparator did not see it: its
  MusicXML reading links ties by pitch alone, the app also needs the stop. Item and source removed again; hashes and
  the reason are in `content/library/sources/README.md`.
- Done: T024 - not added: the only machine-readable Op. 9 no. 2 is Mutopia 1590, **CC BY-SA 3.0** (licence rule:
  never used, not even for reference - so it was not downloaded). Recorded in 005 data-model §5.3 and the sources
  README's rejected table.
- New owner decision gates: **T052** (realise `<inverted-mordent>` like `<mordent>`; recommend yes), **T053** (The
  Entertainer: leave out, or add with a criterion-16 exception plus the converter's tie fix; recommend leave out).
- needs owner: **T025 (003 T082) - Play mode on a real MIDI keyboard.** Run `pnpm dev`, connect the keyboard, open each
  file with *Open score*, switch to **Play**, press Start, and follow `specs/003-play-mode-grading/quickstart.md` §4
  exactly: US1 steps 1-7 on `tests/fixtures/musicxml/chords/c-major-scale-and-chords.musicxml` (5a on
  `tests/fixtures/musicxml/trill-realisation.musicxml`), US2 1-5, US3 1-4, US4 1-4. Write per step "as expected" or
  what happened instead, with the date, under "T025 run" in this log.
- needs owner: **T026 (011 T083, SC-005) - learner test.** For each tester (the owner alone, or at least 3 people):
  clean profile (private window), `pnpm dev`, *Learning > Keys > C major > 1 Introduction*, **Practice** mode, both
  hands, no rehearsal - the first attempt counts. An observer tallies every key the app marks wrong (red key and mark
  on the Score) until the last note. Pass: at most 3 wrong notes per tester. Record per tester: wrong-note count,
  completed yes/no, date, under "T026 run".
- needs owner: **T027 (013 T090, SC-008) - five first-time users.** Exactly `specs/013-score-browser-progress/
  quickstart.md` "SC-008": clean profile per person, seed `tests/fixtures/progress/greensleeves-one-result.json` via the
  console line given there, say "Open *Greensleeves* from the beginner repertoire and tell me your best result on it",
  time from first click to the spoken number. Right answer: **78 % correct, 70 % on time**. Pass: 4 of 5 within 30 s,
  unprompted. Record per person: time, success, where they hesitated, under "SC-008 run".

## 2026-10-01 00:45 - claude-opus-5.5 (continue - audit of the new diff, T054, T030 gate x3)
- Constitution audit (`constitution-auditor`, `git diff 9d31d01..HEAD`): **no CRITICAL/HIGH**. Confirmed: unprinted notes
  are excluded from expected notes and marks (`src/core/practice/expected.ts:79`, `src/core/grade/marks.ts:85`); no
  new dependency; licensing and notices complete; the library pins only add entries. Findings and fixes (d36607a):
  MEDIUM (IV) the unterminated-tie rule had no own test -> split out as **T054**, test `c'4 ~ d'4` / `c'4 ~ c'4` fails
  with the rule switched off ("expected ... not to contain '<tie'") and passes with it; LOW `<note print-object="no">`
  row added to SUPPORT_MATRIX/docs (checked: Verovio renders such a note `visibility="hidden"`); LOW the out-of-scope
  `describe` names the later additions; LOW T051's text did not cover the tie rule -> T054. Not done (optional): a test
  for `\hideNotes` with no `\unHideNotes`.
- Gate incident: stopping the earlier gate task killed only its wrapper, so two gates ran at once on one preview port
  (150/137 e2e failures, results discarded; the leftover `vite preview` was stopped). The one lone round of that mix
  failed 2 e2e tests: webkit `lookahead.spec.ts:201` (sweep over every repertoire piece: `page.evaluate` timed out at
  180 s) and electron `score-browser-timing.spec.ts:152` (SC-003 100 ms). Alone, the sweep passes on webkit and
  chromium in 33 s with the new pieces; neither recurred below.
- T030 [~]: full gate three times in a row at d36607a, alone - each run: lint exit 0 (0 errors, 316 warnings),
  typecheck exit 0, unit `Test Files 299 passed (299) | Tests 6268 passed (6268)` exit 0, e2e `707 skipped | 1165
  passed` exit 0 (13.0-13.2 min). No open task in 001-016 (SC-001). Kept `[~]` (mine): T052/T053 may change code, and
  T025-T027 wait for the owner, so the branch is not ready to merge.
- Needs owner: **T052** (realise the inverted mordent like the mordent? recommend yes), **T053** (The Entertainer: leave
  out, or add with a criterion-16 exception + converter tie fix? recommend leave out), **T025-T027** (steps in the
  previous entry).
- Handoff: next = owner answers to T052/T053 (then T023 or its close-out, and T030 gate x3 again); T025-T027 results
  from the owner; tree clean at the log commit.

## 2026-10-01 11:10 - claude-opus-5.5 (continue - owner answers T052/T053; T055-T058; gate blocked by a start timeout)
- Session start: hand-off verified - lint exit 0 (0 errors, 316 warnings), unit `Tests 6268 passed (6268)` exit 0.
- Owner answers (2026-10-01): **T052 yes** (realise the inverted mordent like the mordent); **T053 (a) leave The
  Entertainer out** -> T023 closed as not added (005 data-model and sources README say so); **T025-T027**: the owner
  reports the C major Introduction "working ok" in Practice (T026), but gave no wrong-note count, which T026 needs ->
  T026 stays open; T025/T027 not run yet. The owner also found a bug while doing it (T056).
- Done: T055 (f92b1e3). 003 spec D-1/FR-024 and data-model first, then test first: new fixture
  `inverted-mordent.musicxml` (G4 in C major); `build.test.ts` "parses <inverted-mordent> ... without a notice" failed
  with `expected [ null, null, null ] to deeply equal [ 'inverted-mordent', null, null ]`, `played-along.test.ts` "an
  inverted mordent is realised like a mordent" failed with `expected [] to deeply equal [ 65, 69 ]`; both pass after
  `Note.ornament` gains `'inverted-mordent'` and `build.ts` parses it. `SUPPORT_MATRIX` + `docs/musicxml-support.md`
  row. Expected values changed, with reason: `trill-realisation`'s "unknown ornament" is now `<schleifer/>` (it was
  the inverted mordent); snapshots (that fixture: element name and source offsets only; the new fixture);
  community-suite snapshot loses `unsupportedElement:inverted-mordent: 1`; real-scores `skipped` Dvorak 33 -> 12 and
  Janacek 352 -> 285, exactly their inverted-mordent counts (21, 67 - counted in the unzipped files). The two Petzold
  minuets lose their `expected` notice and `limitations` (out-of-scope hashes re-recorded, test comment says why);
  index rebuilt (ornamentCount 114: 4 -> 5, 115: 2 -> 6; Intermediate cap 1 per 4 bars still met: 0.625, 0.75).
  `pnpm library:fidelity --check`: `185 records, 0 failed`. Screenshot of 115 looked at: Pralltriller signs engraved,
  `notices: none`. Unit `Test Files 299 passed (299) | Tests 6273 passed (6273)`.
- Done: T056/T057 (2aed39b). Owner: Practice running -> Play left the session running and the button on Stop. Cause:
  the transport's stop is routed by the mode now in force, and the mode subscriber only left Practice for Listen.
  Test `tests/e2e/mode-switch-run.spec.ts` failed first on chromium (3 failed: transport `"playing"`, expected
  `"stopped"`, for Practice->Play, Listen->Practice, Listen->Play); fix: every switch stops the engine directly, and
  leaving Practice drops its session; `9 passed` on chromium, firefox, electron.
- Constitution audit (`constitution-auditor`, `git diff b1073ab..0316d58`): **no CRITICAL/HIGH**; no weakened test
  (each new assertion fails on the old code), expected-value changes justified, layering kept. MEDIUM: log entry
  missing (this one); no e2e for the switches into Listen and out of Play -> added; that exposed **T058**: a run
  stopped by leaving Play is graded asynchronously and `onPlayGraded` then showed its Grade (and popup) in Listen or
  Practice, against 003 FR-035 ("cleared when ... the mode changes") - fails on the code before T057 too (run phase
  `"stopped"`, expected null; checked on a fresh build). Fixed (c6a9bfd): a Grade arriving after the mode changed is
  not shown; the attempt is still stored. LOW, fixed: README "Waits for the owner", `types.ts` comment, a `\repeatTie`
  line broken by my own edit script, the double stop documented (idempotent: same message, same state). Not covered,
  new task **T059**: AS-1.11's "the other mode starts from the same place" (looks unmet since 002).
- Test-run incident: stopping a gate left its `vite preview` on :4173 again, and `reuseExistingServer` then served a
  stale build to my e2e runs (results discarded; the server was killed and every result above re-run on a fresh build).
- T030 [~] **gate not green**. Round 1 at c6a9bfd: lint exit 0 (316 warnings), typecheck exit 0, unit `Test Files 299
  passed (299) | Tests 6273 passed (6273)`, e2e exit 1 (18.6 min, usual 13): `20 failed | 713 skipped | 1163 passed`.
  17 of 20 are a run that did not start in time: a Practice Start never turned into Stop within 5 s (`piano-keyboard`
  12, `pressed-keys` 4), and `theme-a11y`'s Play run had no phase after 15 s (at `startPlay`, before any Grade). 3 are
  timing budgets: `lookahead` glide arrival 567 ms vs 500 and frame interval 39.7 ms vs 20, `score-browser-timing`
  search 107.5 ms vs 100.
  Not caused by today's changes: `piano-keyboard.spec.ts` on chromium with `session.ts` from before T057 gives `18
  passed`, then `7 failed | 11 passed` twice, the same "Start" vs "Stop" failure (current code: 18 passed, then 5
  failed). The spec runs on 8 workers at once and each first Start loads the SoundFont; `startPlay` already waits 15
  s for that, `startPracticeOnOpenScore` 5 s. My new spec waits 15 s for its own starts (18 passed x2).
- Needs owner: **gate flake** - (a) close other heavy apps and I rerun the gate x3 as is, or (b) raise
  `startPracticeOnOpenScore`'s Start->Stop wait to 15 s like `startPlay` (a wait, not a measured threshold; touches a
  shared helper). Recommend (a) first, (b) if it recurs. **T026**: the wrong-note count of your run. **T025, T027**:
  steps in the 2026-09-30 23:55 entry.
- Handoff: next = owner answer on the gate flake, then T030 gate x3; T059 (test first); T025-T027 owner results. Before
  any gate: no `vite preview` on :4173. Tree clean at the log commit.
