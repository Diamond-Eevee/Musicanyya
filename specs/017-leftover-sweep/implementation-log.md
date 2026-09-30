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
