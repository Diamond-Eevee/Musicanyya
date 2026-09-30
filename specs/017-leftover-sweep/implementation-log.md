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
