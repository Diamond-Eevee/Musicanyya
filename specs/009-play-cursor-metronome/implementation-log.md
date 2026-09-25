# Implementation log: 009-play-cursor-metronome

## 2026-09-25 18:15 - claude-opus-5.5 (analyze)
- Analyze: 16 findings (CRITICAL 1, HIGH 1, MEDIUM 7, LOW 7); tasks.md as of 3c4c3af
- Top recommendations: (C1) the skip icon sits in the old chevron box just below its notehead, where the next chord
  tone a third below is printed - it covers a written note (Constitution VI, FR-016, FR-026; Practice has the same
  defect since 008): place it clear of every head in its column (e.g. below the lowest head of the chord on that
  staff) and test chords a second and a third apart; (H1) add a test that no disc, skip icon or Grade mark is drawn
  during a live run (FR-027); (M1-M3) extend click tests to tempo/meter changes, anacrusis and 50/150 % (SC-002),
  cursor removal on stop and mode change (FR-006), and an automated no-overlap check over the library (SC-007)
- Handoff: next = resolve C1 in plan/contract/tasks (`/speckit.plan` edit or manual), then `/speckit.implement` from T001

## 2026-09-25 18:22 - claude-opus-5.5 (analyze remediation)
- Done: all 16 analyze findings resolved with the recommended option (owner). C1: skip icon below the lowest head of
  its column on that staff, both modes (spec FR-016/FR-016a, research R-13, contract `skipIconBox`); H1: T035 asserts
  no Grade mark during a live run; M1 T020 covers tempo/meter change, anacrusis, repeat, 50/150 %; M2 T010(c) stop and
  mode change; M3 new T054 (`e2e-synthetic-grade` seam) + T055 overlap sweep over the library; M4 `disc` ref explains
  all its refs; M5 SC-005 wording; M6 new T053 golden render before T022; M7 `caretBox` clear of accidentals; L1-L6
  folded into T031, T036, T034, T046, T047, T052; L7 unchanged (guard test by design).
- Handoff: next = `/speckit.implement` from T001 (US1 and US2 can run as parallel lanes); tree clean after this commit

## 2026-09-25 19:05 - claude-sonnet-5 (implement: Setup, Foundational, US1 tests)
- Session start: baseline before any change: `pnpm test` Test Files 196 passed, Tests 2286 passed; `pnpm lint` exit 0 (289 warnings, 13 infos, as before); `pnpm typecheck` exit 0. It matched the last hand-off.
- Done: T001-T011. T001 `MAX_SETUP_CONTROLLERS` + 001 constants table. T002 fixture `grade/grade-marks.musicxml` (opens with an empty load report, 6 passes: measure 1 twice). T003/T004 `sleep:<ms>` (parser, e2e `pressKeys`, screenshot `pressKeys`); `tests/tools/key-steps.test.ts` Tests 18 passed. T005 `tests/e2e/helpers/play.ts` (`startPlay`, `waitForGrade`, `playPhase`); proven by running T011's spec (it reaches the count-in and asserts on it). T006 `--run` / `--grade` in `tools/dev/screenshot.ts`, README, reference R7. T007 below.
- T007 "before" picture (`tests/.generated/009/t007-before.png`, `pnpm screenshot --item repertoire/beginner/fur-elise-theme-16-bar --run --keys "sleep:3500"`): the status bar reads "Play · Count-in · Measure 1", the first five measures are shown, and there is NO cursor bar and no highlighted note anywhere. Notices: none, console errors: none. This is today's behaviour (B-4).
- Tests written first (US1), each run and seen to fail for the expected reason:
  - T008 `tests/core/timeline/position.test.ts` + `listen-cursor-reference.ts` + `__snapshots__/listen-cursor.golden.json` (generated from the verbatim inline expressions of `updateCursor`, five files: the new fixture, the chord fixture, three real pieces): fails, module `position.js` missing.
  - T009 `tests/core/play/cursor.test.ts`: fails, module `cursor.js` missing.
  - T010 `tests/ui/score-view-play-cursor.test.ts` (new shared harness `tests/ui/helpers/score-view-harness.ts` + `recording-canvas.ts`: a real fixture Score, fake pages with `g.note > g.notehead`, fake geometry, recording canvas): `Tests 10 failed | 1 passed (11)`; (a)-(e) fail (no cursor in Play), (f) Listen passes as specified.
  - T011 `tests/e2e/play-cursor.spec.ts` (chromium): `3 failed, 1 passed`: the cursor-order, range-5-8 and green-under-highlight tests fail (no `.playing` in Play); the "gone after the Grade" test passes today only because nothing is highlighted yet.
- Decisions: `notesAtTick` / `passAtTick` take the compact `TimelineDto` shape the view holds (passes carry `endTick`), not core's `PlaybackTimeline` (passes carry `lengthTicks`): the view never has the latter and the golden must compare with the verbatim inline code. Contract 1.0.0 -> 1.0.1 (signature type only), recorded with T012.
- Problems / open questions: none. `pnpm test -- <path>` runs the whole suite (the `--` is passed through); use `pnpm vitest run <path>` for a single file.
- Handoff: next = T012 -> T013 -> T014 -> T015 (US1 implementation), then T016, T017; then US2 (T018-T027, T053), US3; tree clean at the commit after this entry

## 2026-09-25 19:40 - claude-sonnet-5 (implement: US1 checkpoint)
- Done: T012-T017 (US1). `src/core/timeline/position.ts` (`notesAtTick`, `passAtTick`), `src/core/play/cursor.ts` (`playCursorAt`); `mx-score-view.ts`: Listen uses `notesAtTick`/`passAtTick`; the Play cursor is drawn every frame (bar at the first note due, `.playing` on the notes due, none in the count-in), frame order clear -> cursor -> Grade marks, `followPlayCursor` reuses the same position, leaving Play for Listen or Practice clears highlights, marks and canvas. Contracts: play-run.md 1.2.0 (cursor part), play-display.md 1.0.1 (structural timeline type, see the earlier decision).
- Evidence: T008 golden and T009: `pnpm vitest run tests/core/timeline/position.test.ts tests/core/play/cursor.test.ts` Tests 27 passed. T010: `tests/ui/score-view-play-cursor.test.ts` 11 passed (was 10 failed | 1 passed). Checkpoint runs: `pnpm vitest run tests/core/timeline tests/core/play tests/ui` Test Files 69 passed, Tests 552 passed; full `pnpm vitest run` Test Files 199 passed, Tests 2333 passed; `pnpm typecheck` exit 0; `pnpm lint` exit 0, 289 warnings (unchanged). T011: `pnpm exec playwright test tests/e2e/play-cursor.spec.ts --project=chromium` 4 passed (was 3 failed); the existing Play/Practice specs (`us1-play`, `us2-grade`, `us3-play-setup`, `us3-run-chrome`, `us4-attempts`, `us4-overlays`, `us1-practice`, chromium) 17 passed.
- Independent Test, looked at `tests/.generated/009/t017-cursor.png` (`--run --keys "sleep:5200"`): the orange cursor bar with its dot at the top runs through measure 1 of the treble and bass staff at the first note, that note is highlighted (blue), the status bar reads "Play · Measure 1", no notices, no console errors. During the count-in (T007 picture, before the change) there was nothing. Not checked here: firefox and the Electron shell (T046 covers Electron).
- Decisions: the highlight set is kept in the view's existing `soundingNoteIds` (shared by Listen and Play), so leaving Play clears it through the same path. Firefox not run in this session.
- Problems / open questions: none.
- Handoff: next = US2: T053 (commit BEFORE T022), T018-T021 tests, then T022 -> T027; US3 after. Tree clean at the commit after this entry.
