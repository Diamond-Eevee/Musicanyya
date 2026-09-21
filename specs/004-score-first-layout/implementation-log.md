# Implementation Log: Score-First Application Window

Feature `004-score-first-layout`. Newest entry at the bottom.

## 2026-09-21 - claude-opus-5 (/speckit.tasks)

- Done: generated `tasks.md` - 79 tasks in 7 phases (Setup 4, Foundational 15, US1 18, US2 11,
  US3 10, US4 10, Polish 11) from `plan.md`, `spec.md`, `research.md`, `data-model.md` and the three
  contracts.
- In progress: none.
- Decisions:
  - The Verovio unit spike (research R-2) is **T001**, the very first task, and **T002** corrects
    `contracts/score-layout.md` before any UI work if the measurement differs - as the plan requires.
  - No per-task RT review: this feature edits no AudioWorklet, scheduler, metronome or MIDI-timing
    code (plan "Real-time Paths Touched": none). The single RT-adjacent claim is contract guarantee
    G-4, reviewed once in Polish as **T104** with `rt-audio-reviewer`.
  - Research R-8 is honoured by **T004**, which re-checks the five inherited open tasks
    (001 T138/T139/T141, 003 T082/T110) against the new layout and records the verdict, rather than
    adopting or dropping them silently.
  - Existing suites are updated by **T036** (unit) and **T037** (e2e) with the rule "selectors only,
    no assertion weakened or skipped" (plan Risks).
  - Task numbering leaves gaps between phases (T037 -> T040, T050 -> T060, T069 -> T080, T089 -> T100)
    so new work found during implementation gets a free number inside its own phase.
- Problems / open questions: none. No owner decision is blocking.
- Handoff: next = `/speckit.analyze`, then `/speckit.implement` starting at T001
  (`tests/verovio/page-units.test.ts`); tree clean after this commit.

## 2026-09-21 - claude-opus-5 (/speckit.analyze)

- Analyze: 16 findings (CRITICAL 0, HIGH 4, MEDIUM 7, LOW 5); tasks.md as of 1a31af2. Read-only run;
  nothing in spec/plan/tasks/code was changed.
- Done: cross-artifact consistency and constitution check of spec.md, plan.md, tasks.md against
  constitution v1.1.1. Requirement coverage 100% nominal (22 FR + 10 SC, all mapped), 2 partial.
  No constitution principle violated; implementation is not blocked.
- Top recommendations (all four HIGH share one root cause - the `zoomPercent` -> `scale` rename reaches
  further into the existing suite than tasks.md accounts for; cheapest to fix before T014):
  - A1 HIGH: the existing zoom shortcut is bare `+`/`=`/`-`/`_` (`src/app/session.ts` `onKeyDown`), which
    `ui-shell.md` section 4 and T032/T024 replace with `Ctrl/Cmd` only. Spec Assumptions promise existing
    shortcuts keep working, and `tests/e2e/us1-open-view.spec.ts:32` presses bare `+`. Keep both forms.
  - A2 HIGH: `tests/e2e/us1-open-view.spec.ts:35` asserts `zoomPercent === 110` in localStorage; T037
    governs that file but says "selectors only, assertions unchanged", so it cannot fix the field rename.
    Split the rename into its own task worded as a correction.
  - A3 HIGH: `tests/fakes/memory-settings-store.ts` declares `UserSettings` v1 with `zoomPercent`; T014
    breaks typecheck and no task touches the fake.
  - A4 HIGH: `tests/engine/storage/local-settings-store.test.ts` (8 `zoomPercent` refs) fails after T015;
    T036 lists only three `tests/ui/` files.
  - A7 MEDIUM: `MIN_PAGE_UNITS` / `MAX_PAGE_UNITS` are referenced by `score-layout.md` section 2 with no
    value anywhere (Constitution II: no magic numbers).
  - A5/A9/A10/A11 MEDIUM: 175% scaling untested (FR-013 vs SC-006); no Electron-shell layout assertion;
    SC-007's 50 ms-during-run clause uncovered for panel open/close; malformed-MusicXML edge case has no task.
- Problems / open questions: none blocking. The owner has not yet said whether the recommended edits to
  tasks.md, `contracts/ui-shell.md`, `contracts/score-layout.md` and the spec's Assumptions should be applied.
- Handoff: next = apply the A1-A4 edits (manual, ~4 task edits plus two contract amendments), then
  `/speckit.implement` from T001; tree clean at 1a31af2 plus this log entry.

## 2026-09-21 - claude-sonnet-5 (/speckit.implement, analyze edits applied)

- Done: the owner approved "apply all recommendations" for the analyze findings; applied as an edit pass
  before any code. `tasks.md` 79 -> 82 tasks; no task renumbered.
  - A1: bare `+`/`=`/`-`/`_` Score-size keys are kept and `Ctrl/Cmd +/-/0` added beside them; all size keys
    now live in `src/ui/shortcuts.ts` (T024, T032, T034; `contracts/ui-shell.md` section 4; spec Assumptions).
    The contract's "Space: ignored while focus is in a form control" contradicted "unchanged" and was not
    tested, so it was dropped; the form-control guard applies to the bare `+`/`-` keys only.
  - A2: new T038 - the `zoomPercent` assertion in `us1-open-view.spec.ts` is corrected to `scale`
    (value unchanged); T037 now excludes it.
  - A3/A4: T014 also updates `tests/fakes/memory-settings-store.ts`, T015 also restates
    `tests/engine/storage/local-settings-store.test.ts` in v2 terms, so the tree typechecks after each task.
  - A7: `MIN_PAGE_UNITS` = 400 and `MAX_PAGE_UNITS` = 10000 (provisional until T001), in T003 and
    `contracts/score-layout.md` section 1. T003 pointed at a constants table in `data-model.md` that does
    not exist; it now points at the contract's table.
  - A5: T101 also asserts 175% scaling (FR-013). A9: new T111 (Electron layout assertion). A10: T041 also
    asserts no main-thread task over 50 ms while a panel opens and closes during a run. A11: new T039
    (malformed MusicXML keeps the layout score-first).
- Problems / open questions: the earlier analyze log recorded only findings A1-A5, A7, A9-A11 by name;
  A6, A8 and A12-A16 (MEDIUM/LOW) were not written down and are therefore not applied. Re-run
  `/speckit.analyze` to regenerate them if they matter.
- Handoff: next = T001 (`tests/verovio/page-units.test.ts`); tree clean at this commit.

## 2026-09-21 - claude-sonnet-5 (/speckit.implement, Phase 1 Setup)

- Done: T001-T004.
  - T001: `tests/verovio/page-units.test.ts` (18 tests, green). Measured with `verovio 6.3.0`, `svgViewBox: 1`:
    outer viewBox = `pageWidth * scale / 100` (height likewise, only with `adjustPageHeight: 0`); inner viewBox
    = `10 * pageWidth`; interline = 180 inner units always. The assumed rule 1 and rule 4 are confirmed.
  - T002 (a correction, not a rule change): research R-2 finding 2 was wrong. Verovio's `scale` never changes
    engraving density under `svgViewBox: 1`, so today's zoom keys change a stored number and nothing on
    screen (feature 001 defect that this feature fixes). `contracts/score-layout.md` -> 1.1.1 with the pinned
    relation table; `research.md` R-2 corrected and its spike marked verified.
  - T003: `SCORE_SCALE_*`, `MIN_PAGE_UNITS` (400), `MAX_PAGE_UNITS` (10000; both accepted verbatim by Verovio,
    checked in T001) in `src/engine/config.ts`; `ZOOM_*` kept as deprecated aliases until T107.
  - T004: none of the five inherited tasks is invalidated (verdict table in `tasks.md`); 003 T082 should run
    after this feature merges.
- In progress: none.
- Decisions: the T001 test drives the Verovio toolkit directly for the `adjustPageHeight` 0/1 comparison and
  the worker's `handleMessage` for the width relation, because the worker hard-codes `adjustPageHeight: 1`
  until T030. T030 now says to add the failing worker-path height test first, so the tree stays green until
  then. T021 named a fixture path that does not exist (the same-named file under `tests/fixtures/musicxml/chords/`
  has 2 measures); it now uses `large-score.musicxml`.
- Problems / open questions: none.
- Handoff: next = Phase 2 tests T005-T010, then T011-T019; run `pnpm test -- tests/ui tests/engine` first;
  tree clean at this commit.

## 2026-09-21 - claude-sonnet-5 (/speckit.implement, Phase 2 Foundational - checkpoint)

- Done: T005-T019. Checkpoint verified: the panel state machine, the fit arithmetic and settings v2 are green
  in Node. Gate so far: `pnpm test` (vitest) 870 passed / 2 skipped, `tsc --build` clean; Biome is clean on every
  file this feature touches (see Problems for the baseline).
  - Tests written first and seen to fail for the right reason (missing modules/exports; the v1 store returning
    the old shape): T005 `view-state`, T006 `fit`, T007 `anchor`, T008 `settings-v2`, T009 `panel`, T010 `menu`.
    The Escape case in T010 was mutation-checked (removing `stopPropagation` makes it fail).
  - Implementation: `src/ui/layout/{fit,anchor,menu-model,invoker}.ts`, `viewState` (scale, openPanel, overlays,
    `createViewStateStore()` for tests), `UserSettings` v2 + `OverlayFlags` (`ports.ts`), `OVERLAYS_DEFAULT`
    (`config.ts`), v1 -> v2 migration in `local-settings-store.ts` (also drops `zoomPercent` on the next save and
    now rejects an array as a settings file), `mx-panel`, `mx-menu`, `panels.css`, menu/panel labels in `en.ts`.
- Decisions:
  - `MIN_PAGE_UNITS` 400 -> **200**: writing T006 showed a 1280x720 window (about 670 px of Score) at 200 % asks for
    a page 335 units tall, which 400 would have clamped, contradicting the contract's own "real windows never
    reach it". Verovio still returns 200 x 200 verbatim (T001 test updated). Contract, T003 and config updated.
  - `fitLayout()` returns `{ pageWidth, pageHeight, scale }` only. `adjustPageHeight: 0` is a worker constant
    (T030), so the message shape stays unchanged; contract rule 4 and T022 reworded.
  - The rename `zoomPercent` -> `scale` reached `session.ts` and `mx-score-view.ts` in this phase (mechanical:
    field, event payload `zoomchange`, `SCORE_SCALE_*`), because T013/T014 would otherwise leave the tree not
    compiling until T028/T034. Behaviour is unchanged; the bare `+`/`-` handler still lives in `session.ts` until
    T032/T034.
  - Focus return (FR-005) needs a DOM node, which the store must not hold: `src/ui/layout/invoker.ts` (contract
    `ui-shell.md` sections 5 and 6 amended). Panels take focus only when a control opened them, so the Grade panel
    a run finishes with never steals Space from play/pause.
  - `mx-panel` is named by `aria-label` copied from its `heading` attribute (an `aria-labelledby` cannot reach an
    `<h2>` in the shadow root); `ui-shell.md` section 3 amended. `view-settings.md` volume default corrected to 80
    (`VOLUME_DEFAULT`; the contract said 100).
- Problems / open questions: `pnpm lint` already fails on this branch before any 004 change - 26 Biome errors
  (import order, formatting) in feature 003's files, including `src/core/play/run.ts` and `calibration.ts`.
  T103 requires `src/core` to stay untouched by this feature, so they are not fixed here; a separate clean-up task
  was flagged. The T109 gate cannot pass `pnpm lint` until that lands or the owner says otherwise.
  Note for T027: `layout.css` also carries content rules for the asides (`.mx-help-panel table`,
  `.mx-diagnostics-list`, `mx-practice-panel`, ...) that must survive the rewrite.
- Handoff: next = Phase 3 (US1) tests T020-T025 (`tests/e2e/us1-layout.spec.ts` first, then the unit tests),
  then T026-T039; start with `pnpm test -- tests/ui` (all green) and `pnpm typecheck`; tree clean at this commit.

## 2026-09-21 - claude-sonnet-5 (/speckit.implement, Phases 3-4 US1 + US2 - checkpoint)

- Done: T020-T050 (US1 and US2 were implemented together; see Decisions). Independent tests verified:
  - US1: at 1280x720 ... 2560x1440 the Score view is the full window width and (window - bar) tall, the bar is
    at most 48 px, nothing else reserves flow space, no horizontal scrollbar (`us1-layout.spec.ts`, chromium,
    firefox, webkit); at 1920x1080 at least two systems of the two-staff fixture are fully visible (SC-002).
  - US2: every one of the nine hand-opened tools opens over the Score in two activations, one at a time, with
    the Score's SVG element and scroll position untouched (an in-page tag survives), and closes with Escape, the
    close button and a click outside, returning focus to its menu button; open/close under 100 ms; starting
    Listen, Practice or Play closes an open popup with no dialog; no long task while a popup opens/closes during a
    run (`us2-panels.spec.ts`).
  - Gate so far: vitest 933 passed / 2 skipped; `tsc --build` clean; Biome clean on every feature file; all
    chromium e2e green (32 tests; 1 skipped on webkit for audio); the new specs also pass on firefox and webkit.
- Decisions:
  - US1 and US2 landed together: removing the three asides (T026) forces the tools to be re-parented into
    `#panel-host` (T045), otherwise the existing e2e suites cannot reach Help, MIDI, the Practice/Play setup or
    the Grade. Each task was still ticked only against its own test.
  - `session.ts` cannot be unit-tested (it creates Workers), so T043 tests `mountPanels()`
    (`src/ui/layout/panel-host.ts`), the one function session calls; T043 reworded.
  - `mx-help-notation`, `mx-diagnostics` and `mx-environment-panel` used to hide themselves until a toggle
    button was pressed; they now show exactly while their popup is the open one (driven by `viewState`), and keep
    `toggle()` so their own tests are unchanged.
  - Settings persist from the store: `session.ts` keeps `UserSettings` in memory (`persistUserSettings`) instead of
    re-reading storage, which also fixes an old race where a volume change inside the 500 ms write debounce
    overwrote a pending zoom. Only a change to `scale` or `overlays` writes settings, not opening a popup.
  - The empty-state invitation is `mx-drop-zone` itself (an overlay that listens on its parent, so a drop anywhere
    over the Score area is accepted); its Open button asks the bar's single `mx-open-button` to open the chooser
    (`openrequest`), so there is never a second file input.
  - `mx-score-view`: page = `fitLayout()` of the scroll container, `ResizeObserver` + the existing 150 ms
    debounce, page height from the first rendered SVG `viewBox` (falls back to the requested shape, then to 1600
    px only with no viewport at all, so the 8 existing score-view tests pass unchanged). A scale change relays out
    even when the viewport cannot be measured; a resize does not (rule 3). `scrollbar-gutter: stable` keeps the
    fitted width independent of how many pages there are.
  - Piano keys are hidden unless `overlays.pianoKeys` (FR-015; the switch UI is US4). The Grade popup opens when a
    Play run is graded (`onPlayGraded`); T064's own test comes with US3.
  - Existing e2e specs (T037/T038) only gained "open the popup first" steps (`tests/e2e/helpers/panels.ts`), with
    three deliberate exceptions, each with a comment in the spec:
    - `us1-play` follow-scroll test: a page is now exactly one screenful, so the two-measure fixture has nothing
      to scroll; it uses `large-score.musicxml` and a 1000 px offset (a page within one screen of the viewport
      stays mounted; measure 1 is not mounted from far away, an old limitation).
    - `us1-practice`: switching hands / accompaniment / clearing the loop *during* a session used to be done in
      the always-visible panel; FR-007 hides setup during a run, so those three controls are clicked directly in
      the DOM. The session's live-change handling they prove is unchanged (and now unreachable from the UI - see
      Problems).
- Problems / open questions:
  - `us1-play.spec.ts:46` (a timing-sensitive live-mark check 3 s after the run starts) failed once in three full
    parallel runs and passes 3/3 alone; it is not layout related and was not weakened.
  - Live setup changes during a Practice session are no longer reachable from the UI (FR-007). If the owner wants
    them back (e.g. switching hand mid-piece), that is a spec change, not a bug here.
  - Cosmetic: the Diagnostics popup shows its title twice (the panel heading and the element's own `<h2>`).
    Elements are "unchanged" by design; left as is.
  - `pnpm lint` still fails on 26 pre-existing errors in feature 003's files (see the previous entry).
- Handoff: next = Phase 5 (US3): tests T060-T064 (`mx-run-status`, `us3-run-chrome.spec.ts`, `setup-panel`),
  then T065-T069; T068's Grade popup is already opened by `onPlayGraded`, so its test (T064) should pass on
  first run after `mx-run-status` exists; run `pnpm test` and `npx playwright test --project=chromium` first
  (needs `npx vite build`); tree clean at this commit.

## 2026-09-21 - claude-sonnet-5 (/speckit.implement, Phases 5-6 US3 + US4 + T100/T101 - checkpoint)

- Done: T060-T069 (US3), T080-T089 (US4), T100, T101. Independent tests verified in the browser:
  - US3: while a run is active the bar shows mode, measure and a working Stop (`mx-run-status`, a polite live
    region), no setup control is visible or reachable, and nothing but the Score, the bar and notices is on screen;
    a lost keyboard is a notice plus a status with no dialog and no layout jump; a finished Play run opens the Grade
    as a dismissible popup and dismissing it leaves the marks on the notes (`us3-run-chrome.spec.ts`).
  - US4: over a full Listen run of a 100-measure score (new fixture, 15 s), sampled 10 times a second at 1920x1080 and
    1280x720 with the piano strip on and a notice shown, the system holding the cursor is never under the bar, the
    strip or a notice (`us4-overlays.spec.ts`).
  - T100/T101: the size and overlay switches survive a reload; 10 presses of "larger" double the staff height; no
    control is clipped and there is no horizontal scrollbar at 1280x720 ... 2560x1440 at 100/150/175 % display
    scaling, idle and during a Play run (25 tests in `us1-layout.spec.ts`).
  - Gate so far: vitest 983 passed / 2 skipped; `tsc --build` clean; Biome clean on every feature file; chromium e2e
    all green (55 tests, 1 skipped for audio on webkit).
- Decisions:
  - **Every menu entry is disabled during a run** (not just Setup). The debug run showed why: a 100-measure score at
    1920x1080 is one page, so nothing can scroll clear of a popup and a popup would cover the cursor's system. SC-004
    already says the on-screen count during a run is zero, and FR-007 hides the setup. A first version with popup-aware
    follow-scroll (a top inset) was written and backed out as speculative; only the piano strip declares an inset.
    FR-031's "diagnostics while playing" (feature 001 R-14) is therefore only available before starting - starting
    already closed it (FR-006) - and is a candidate for a later "keep diagnostics open" decision by the owner.
  - The bar is one row (`white-space: nowrap`). When its contents would overflow, `mx-app` switches on a compact mode
    in the next animation frame: the four menus fold into one "More" menu (`OVERFLOW_MENU`, every entry once) and the
    transport sliders shorten. At 1280 px this is what fits a Play run's status in. The e2e helpers wait for the bar to
    settle (`barFitted`) and pick whichever menu is visible.
  - `mx-run-status` derives everything from the existing stores; the only new state is `runPositionState`, published by
    `mx-score-view` (it already works out the measure under the cursor each frame), and `insetState` (piano strip).
    The Stop button is created/removed, never rebuilt, so keyboard focus survives measure updates.
  - The 100-measure fixture is named `large-score-100-measures-fast.musicxml` so the core golden snapshot test skips it
    (it skips `large-score*`); the first name auto-wrote 8,000 snapshot lines, which were reverted.
  - The cursor system is measured from the measure's `g.staff` children: the `g.system` / `g.measure` boxes include the
    tempo mark that sticks out above the page and is clipped there, not covered.
- Problems / open questions:
  - `pnpm lint` still has the 26 pre-existing errors in feature 003's files (previous entries).
  - The Diagnostics popup still shows its title twice (panel heading + the element's own `<h2>`); cosmetic.
- Handoff: next = Polish: T102-T106 (behaviour neutrality is covered by the unchanged core suites; T104 RT review of G-4
  with `rt-audio-reviewer`; T105 `constitution-auditor`), T107 (remove the `ZOOM_*` aliases), T108, T109, T110, T111
  (Electron layout assertion). Run `pnpm test` and `npx playwright test --project=chromium` (after `npx vite build`)
  first; tree clean at this commit.

## 2026-09-21 - claude-sonnet-5 (/speckit.implement, Polish and reviews - session end)

- Done: T102-T107 and T111. 79 tasks became 82 (T038, T039, T111 added by the analyze pass); 80 are done.
  - T102/T103: every core, timing, Practice and grading suite passes unchanged (`tests/core/grade/golden.test.ts` and
    the other goldens included, so a stored attempt grades identically); `git diff main -- src/core` is empty;
    `tests/architecture/layers.test.ts` is green.
  - T104 (RT review of G-4, `rt-audio-reviewer`): **no blocking findings**; no AudioWorklet, scheduler, metronome or
    MIDI-timing file is in the diff. Applied its advisories: `mx-run-status` writes its live region only when the text
    changes; `subscribeRunActive` fires only when "a run is active" flips (it used to fire every frame of a Play run);
    `runPositionState.set` returns early when unchanged; a relayout that a newer one has overtaken drops its result
    (`relayoutEpoch`); starting an attempt replay closes the popups (FR-006). The e2e timing test is in
    `us1-layout.spec.ts` (resize mid-run: zero worklet posts, zero long tasks, run continues; a pause at the end proves
    the probe is live).
  - T105 (constitution audit, `constitution-auditor`): **no CRITICAL findings**, compliant with notes. Fixed: F1 the run
    guard now also covers a run that is still loading its sound (`isRunActive` counts transport `loading`;
    `guardPanelsDuringRuns()` closes any popup on the flip to active and whenever one is opened while active); F3 the
    Grade popup no longer opens over a run that started since grading began; F4 switching the notices layer off hides
    notes about a score but never a failure (a file that would not open, sound/engine/storage/grade failures); F9 an
    open menu list closes when a run starts; F8 the `!` fields carry a comment. Not fixed (see below): F5, F6, F7, F10.
  - T107: the `ZOOM_*` aliases are gone. T106: quickstart, `ui-shell.md`, `data-model.md`, `score-layout.md` brought in line
    (compact bar, no popup during a run, the run status's inputs, the fixtures).
  - T111: the Electron smoke test asserts the same layout (window-wide Score view, bar <= 48 px, no aside).
- Gate: vitest 995 passed / 2 skipped; `tsc --build` clean; Biome clean on every file this feature touches; e2e:
  chromium 54 passed / 1 skipped, firefox and webkit pass the new specs, Electron smoke passes. A full four-browser
  parallel run had 16 failures that all passed when the files were rerun serially, except two firefox ones, both fixed or
  explained: a keyboard-menu test that assumed the menu the bar shows (Firefox makes the bar compact at 1280 where
  Chromium does not; the test now walks to the entry) and `us1-play.spec.ts:46`, a live-mark check 3 s after the run
  starts that is timing-sensitive under load and fails on and off, unrelated to layout.
- Problems / open questions:
  - needs owner: **no popup can be opened during a run** (every menu entry is disabled while Listen/Practice/Play can be
    stopped or is starting). FR-006 only says popups close when a run starts; SC-004 (nothing on screen but the Score, the
    bar and notices during a run) and FR-007 (no setup during a run) point the same way, and a debug run showed a
    100-measure score is one page, so nothing could scroll clear of a popup. The cost: the audio diagnostics can no longer
    be read during playback (feature 001 R-14). If the owner wants Diagnostics kept reachable, it needs a design (a
    small corner readout, say), not a popup. The spec's Assumptions/FR-006 should be amended to say which it is.
  - needs owner: **live setup changes during a Practice session are no longer reachable from the UI** (FR-007): switching
    hand, accompaniment or the loop mid-piece now means stopping first. The session's live-change code and the e2e that
    proves it (driven through the DOM, documented in `us1-practice.spec.ts`) remain; keep or delete is the owner's call.
  - `pnpm lint` fails on 25 errors in feature 003's files (format and import order, including `src/core/play/run.ts` and
    `calibration.ts`); a separate clean-up task was flagged. T109 cannot be ticked until it lands.
  - T108 (the manual quickstart script on the physical 1080p laptop) is left open: everything in it that a browser can
    check is covered by the e2e tests above, and screenshots at 1920x1080 and 1280x720 were inspected, but the owner's
    screen and sight requirement are theirs to confirm.
  - Audit F10 (three stacked notices vs. the follow band at 1280x720) is untested; F7 (tests and implementation land in
    one commit per phase, so red-first is only visible in the log); the Diagnostics popup still shows its title twice.
- Handoff: next = the owner decisions above, then the lint clean-up, then T108/T109/T110's commit. Run `pnpm test` and
  `npx vite build && npx playwright test --project=chromium` first; tree clean at this commit.
