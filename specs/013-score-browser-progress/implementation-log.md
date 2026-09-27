# Implementation Log: Score browser with progress

## 2026-09-27 - claude-opus-5-5 (plan)
- Done: `/speckit.plan`. `plan.md`, `research.md` (R-1 to R-21), `data-model.md`, `contracts/progress-store.md`
  1.0.0, `contracts/score-browser.md` 1.0.0, `contracts/contract-changes.md` and `quickstart.md`. The Active
  Technologies and Recent Changes sections of `docs/agents/reference.md` are updated. The Constitution Check passes
  before and after design.
- Decisions: progress is an event-reduced record per content hash behind a new `ProgressStore` port (IndexedDB v3 +
  memory adapter). The browser is a modal `<dialog>`, never open during Play/Practice sessions, and it pauses Listen.
  Score identity no longer depends on a stored copy. Old attempts migrate with completeness "not recorded" (they count
  for best, not *Mastered*). The `music-domain-expert` review is summarised in research R-6 to R-10: whole-Score,
  all-hands scope for best/*Mastered*, exact integer comparison, floor display, a completed loop counts as *Practised*,
  and the *Suggested next* rules.
- Problems / open questions: the music-domain expert found that 003 FR-008's wording differs from the code (a stopped
  run is graded over all expected notes; the unplayed ones are missed). This is information only; it does not block
  013.
- needs owner: OD-1 best and *Mastered* only from whole-Score, all-hands runs (recommended: yes)
- needs owner: OD-2 *Mastered* also needs extra notes <= 10 % of the notes total; spec FR-024 gains it (recommended: yes)
- needs owner: OD-3 reset progress / remove file and progress also delete that Score's stored attempts (recommended: yes)
- needs owner: OD-4 deleting one attempt removes it from progress too (recommended: yes)
- needs owner: OD-5 add dev dependency `@axe-core/playwright` 4.13.0 (MPL-2.0, test only) for SC-007 (recommended: yes)
- needs owner: OD-6 delete retired `mx-library`, `mx-recent-list`, `IndexedDbScoreStore`/`ScoreStore` and their tests (recommended: yes)
- Handoff: next = `/speckit.tasks` (the plan assumes the recommendations; OD-2 changes spec FR-024 once approved).
  Nothing is implemented yet.

## 2026-09-27 - claude-opus-5-5 (tasks)
- Done: `/speckit.tasks`. `tasks.md` has 93 tasks: Setup 8, Foundational 4, US1 22, US2 24, US3 12, US4 6, US5 9,
  Polish 8. 57 of them are marked [P]. Tests come first in every story, and each story ends with a checkpoint that
  runs its Independent Test.
- Decisions: there is no RT review task, because no worklet, scheduler, MIDI-timing or plugin path is touched; the
  tasks.md header says to add one if that changes. App-controller tests go in `tests/engine/` (`tests/app/` is not a
  Vitest project), so the plan and quickstart paths are corrected.
- Problems / open questions: T001 is the owner decision gate for OD-1 to OD-6, still open. Tasks marked (OD-n) assume
  the recommendation.
- Handoff: next = `/speckit.analyze`, then `/speckit.implement` from T001 (ask OD-1 to OD-6 first).

## 2026-09-27 - claude-opus-5-5 (analyze)
- Analyze: 18 findings (CRITICAL 0, HIGH 3, MEDIUM 8, LOW 7); tasks.md as of be47c6d; coverage 31/31 FR, 8/8 SC.
- Top recommendations: (A1) US4 "opens on Continue" conflicts with FR-006/US1 #5 "restore the last view". Keep
  FR-006; *Continue* is the first-use default and sits at the top of the rail. (A2) T031 unmounts the Recent list in
  US1, but *My files* only arrives in US3, so own files cannot be reopened in between and the old recent e2e tests fail
  at the US1 checkpoint. Keep it mounted until T068. (A3) T048 has an either-or assertion; make it deterministic
  (k1/k2 correct notes of N). (A4) The rail's default expansion is unspecified, and SC-001's 3 actions depends on it.
  (A6) T052 stubs the file half of the port; add that half in US3 instead. (A7) the `e2e-progress-seed` seam is hidden
  inside the manual-check task T058, but earlier tasks need it.
- Handoff: next = apply the recommendations (the owner said "respond with recommended"), then `/speckit.implement`
  from T002.

## 2026-09-27 - claude-opus-5-5 (analyze remediation)
- Done: T001. The owner's "respond with recommended" approves OD-1 to OD-6 and every analyze recommendation. The
  answers are in the spec Clarifications, and FR-010, FR-015, FR-018, FR-022 and FR-024, the Assumptions and the Key
  Entities are reworded; the plan table is marked answered.
- Analyze fixes: A1 US4 wording; the browser restores the last view, and *Continue* is the first-use default at the
  top of the rail. A2 T031 keeps the Recent list until T068. A3 T048 deterministic (k1/k2 of N on
  `learning/keys/c-major/introduction`). A4 rail fully expanded by default (score-browser contract section 1, T017,
  T020). A5 SC-001 two-action path in T073. A6 the port's file half moves to T066, so there are no stubs. A7 the
  `e2e-progress-seed` seam is its own task, T094. A8 skipped-record notice in T046. A9 new T095 (app on the memory
  store, SC-006). A10 500 items = 181 library + 319 files in T086. A12 `BROWSER_ANNOUNCE_DEBOUNCE_MS` named (T003,
  data model, contract). A13 file name searchable (T059). A14 scope fixtures named (T036). A16 the earlier-version
  flag is derived, not stored (data model). A17 no backdrop area below 768 px (contract). A11 is resolved by T001.
  A15 (FR-010/FR-023 overlap) and A18 (003 FR-008 wording) are left as notes.
- Handoff: next = `/speckit.implement` from T002 (Setup), then Foundational T009-T012. The tree is clean after this
  commit.

## 2026-09-27 15:10 - claude-sonnet-5 (implement: Setup + Foundational)
- Done: T002-T012 (T001 was already done). T002 applied `contract-changes.md` to all seven canonical contracts
  (`ports.md` 1.5.0, `storage.md` schema 3 + `musicanyya.browser.v1`, `performance-log.md` optional `complete`,
  `practice-session.md` 1.7.0 `loopCompleted`, `ui-shell.md` 1.1.0, `library-port.md` 1.3.0, `play-display.md` 2.1.0).
  T003/T004 added the named constants (`src/core/defaults.ts`, `src/engine/config.ts`) with
  `tests/core/progress/constants.test.ts` pinning the `PROGRESS_RESULTS_MAX >= PERFORMANCES_PER_SCORE_MAX` invariant.
  T005 added `tests/fakes/progress-builders.ts` (`result`, `record`, `userFile`, `libraryIndexOf`, `historyOf`,
  smoke-verified). T006 added `tests/fixtures/progress/db-v2.ts` (real bytes + real SHA-256 of
  `fur-elise-bare.musicxml` and library `c-major/introduction.musicxml`, verified against `hashFile` in a throwaway
  test). T007 added the two seed JSON fixtures and their README row. T008 installed `@axe-core/playwright` 4.13.0
  (plan/reference.md already recorded it as approved). T009/T010 added `src/core/progress/types.ts` and
  `src/core/browser/types.ts` (data-model sections 2-9). T011 added the `ProgressStore` port (progress half only)
  to `src/engine/ports.ts` and marked `ScoreStore`/`RecentScoreSummary` `@deprecated`. T012 extended
  `tests/architecture/layers.test.ts` with a named assertion for `src/core/progress/**` and `src/core/browser/**`.
- Decisions: T009/T010 (Foundational, pure type declarations) were implemented ahead of T005 (Setup), because T005's
  builders need to return values typed against `ProgressResult`/`ProgressRecord`/`UserFileEntry`/`BrowserItem` -
  otherwise the builder file would either duplicate the data-model shapes or type-check against nothing. This is an
  execution-order swap only; every dependency in tasks.md still holds (T009 depends on T003/T004, done first).
  `PerformanceStore.removeByScore` is documented in the two contract files (ports.md, performance-log.md) as part of
  1.5.0/T002, matching the existing pattern of a contract naming a signature before its code lands (e.g. ports.md's
  own history for `latencyProfile`), but is **not** yet added to the `PerformanceStore` TypeScript interface - adding
  it now would break `IndexedDbPerformanceStore`'s and `session.ts`'s typecheck with no adapter to implement it until
  T052/T045. It lands with T052, test-first, as tasks.md already sequences it.
- Checks: `pnpm typecheck` green; `pnpm test` full suite green (235 files, 4417 tests, including the new
  `tests/core/progress/constants.test.ts` and the extended `tests/architecture/layers.test.ts`, 6 assertions).
  `pnpm lint` has 2 pre-existing errors unrelated to this feature (`src/engine/worklets/dispatch.ts`,
  `src/ui/elements/mx-latency-panel.ts`, both untouched by this branch and already present before T002) - flagged to
  the user, not fixed here (out of scope for 013).
- Handoff: next = `/speckit.implement` from T013 (US1 tests). Foundational checkpoint passed. Tree is clean after
  this commit.

## 2026-09-27 16:05 - claude-sonnet-5 (implement: US1 pure core - items/query/view-state)
- Done: T013-T015 (tests) and T021-T023 (implementation) of US1 - the pure `src/core/browser` slice only
  (`buildBrowserItems`, `queryBrowser`/`effectiveFolder`, `validateViewState`/`seedFromLibraryFilter`/
  `DEFAULT_BROWSER_VIEW`). Every test was written and confirmed to fail for the right reason (missing module, or -
  for T013's ordering test - a real mismatch) before its implementation made it pass.
- Decisions: (1) `buildBrowserItems`'s signature in data-model.md section 6 was missing a `compare` parameter.
  Matching 011's exact panel order needs a locale-aware collator for title ties (found via a real failing case:
  "l'Arabesque (25 Etudes faciles...)" sorts before every "Prelude"/"Sonatina" title under `Intl.Collator` but after
  all of them under plain ordinal `<`/`>`, because of the lower-case leading letter). `buildBrowserItems` now takes
  `compare` as its 5th parameter, exactly like `filterItems` (Principle V: the core stays Web-API-free, the caller
  builds the collator). data-model.md and tasks.md T013/T021 are corrected to say so. (2) `BROWSER_SEARCH_MAX_CHARS`
  was placed in `src/engine/config.ts` in data-model.md section 11, but the pure `src/core/browser/query.ts` needs
  it to cut an overlong search itself (T014's own test asserts this). Moved the constant's definition to
  `src/core/defaults.ts` (re-exported from `engine/config.ts`, the same pattern already used for `MAX_FILE_BYTES`);
  data-model.md and T003's task text are corrected. Both corrections follow AGENTS.md section 3 ("a later step
  shows an earlier document is wrong, fix that document first").
- Checks: `pnpm typecheck` green; `pnpm test` full suite green (238 files, 4437 tests, +20 new: 5 items.test.ts, 6
  query.test.ts, 9 view-state.test.ts). `pnpm lint` clean on every file this session touched (the 2 pre-existing,
  unrelated errors noted in the previous entry are unchanged).
- Handoff: next = US1's UI/wiring slice, T016-T020 (tests: dialog, rail/list/detail, run-guard/open-rules,
  browser-session, e2e) then T024-T034 (`browserState`, `mx-score-browser`/`mx-browser-rail`/`mx-browser-list`/
  `mx-browser-detail`, `browser.css`, `BrowserSessionController`, `session.ts` wiring, e2e helper migration,
  screenshot flag). This is a substantially larger, UI-heavy slice (new custom elements + app wiring + e2e); stopping
  here at a clean, fully-tested, fully-green boundary rather than starting it partially. Tree is clean after this
  commit.

## 2026-09-27 17:05 - claude-sonnet-5 (implement: US1 dialog shell - T016, T024-T026)
- Done: T016 (`tests/ui/score-browser/dialog.test.ts`, 8 tests: `showModal()`/focus on open; Escape clears a
  non-empty search then closes on an empty one; close button and backdrop click each close and emit
  `browserclose`; a click inside the header does not close it; `scoreState`/`transportState` are unchanged by
  open+close (FR-004); focus returns to the invoker). Confirmed it failed first with "Failed to resolve import
  ../../../src/ui/elements/mx-score-browser.js" (the module did not exist yet), then implemented against it.
  T024 `src/ui/state/browserState.ts`: the `closed -> loading -> ready -> opening -> closed` machine of
  data-model.md §8 (`indexError` folded into `ready` per the diagram), `BrowserSnapshot` with `phase`, `data`,
  `view`, `pending` (typed per §8 but no mutator yet - no US1 task drives it), `message`, `openingRef`; the view is
  read from `musicanyya.browser.v1` (try/catch, best effort like `libraryState`) or, if that key is absent, seeded
  once from `musicanyya.library.v1` via `seedFromLibraryFilter` (R-15); the raw payload is kept and re-validated
  against the real `LibrarySection[]` in `indexLoaded`/`indexFailed`, the same "resolve once data arrives" shape
  `libraryState.indexLoaded`'s `currentSectionId` already uses, so a persisted `section` folder is not lost to an
  empty-sections fallback before the index loads. T025 extracted `mx-score-source.ts`'s licence-line logic into
  `src/ui/format/score-source-text.ts` (`scoreSourceLines(item): string[]`, plain text - the caller escapes and
  wraps), so the browser's future detail pane (T028) can show the identical text (contracts/score-browser.md §2);
  `tests/ui/mx-score-source.test.ts` passed unchanged (6/6). T026 `src/ui/elements/mx-score-browser.ts`: the
  `<dialog>` shell (header with search input, hidden *Open file...* placeholder for US3, close button; toolbar and
  body slots; `aria-live` status line; `role="alert"` message line), driven by `browserState.phase`;
  `showModal()`/`close()` and search focus follow the `mx-panel`'s own `wasOpen` guard pattern (a state
  change that does not cross the closed/open boundary is a no-op, and the very first render never treats "already
  closed" as a close transition); Escape is handled via the dialog's `cancel` event (`preventDefault` first, so a
  non-empty search is cleared instead of the dialog closing); a backdrop click is `event.target === dialog`.
  Added the `browser` section to `src/ui/i18n/en.ts` (title, search label, close, open, retry, item-count strings)
  since T026 needed real text now; T029 still owns the rail/list/detail-specific strings and `browser.css`.
- Decisions: (1) `PendingAction`/`pending` and the removal/reset mutators are part of data-model.md §8's full
  snapshot, but no US1 task (T016-T020) exercises them - they start at US2/US3. Declared the field (typed, always
  `null` for now) rather than omitting it, so `BrowserSnapshot` matches the data model exactly and later code
  reading it is correctly typed; no placeholder mutator methods were added (AGENTS.md "No placeholders" is about
  fake behaviour, not an honestly-unpopulated field of a documented shape). (2) `loadLibraryFilterSeed` reads
  `musicanyya.library.v1` directly with its own minimal validation, rather than through `libraryState.getFilter()`,
  because `libraryState` already defaults to "no filter" for a fresh app and that default is indistinguishable
  from a persisted-but-empty filter - reading the raw key is the only way to tell "never set" from "set to
  nothing" (R-15's "seed once" would otherwise wrongly turn folder `all` on for every first-ever session).
- Checks: `pnpm typecheck` green; `pnpm test` full suite green (239 files, 4445 tests, +8 new); `pnpm lint` clean on
  every file touched this session (the pre-existing `src/engine/worklets/dispatch.ts` error and
  `src/ui/elements/mx-latency-panel.ts` warning are unchanged, both untouched by this branch).
- Handoff: next = T017-T020 (remaining US1 tests: rail/list/detail, run-guard/open-rules, browser-session
  controller, e2e), then T027-T034 (rail/list/detail elements, `browser.css` + remaining i18n, the
  `BrowserSessionController`, wiring into `session.ts`, old e2e/tooling migration, screenshot flag, manual check).
  This dialog shell is a clean, fully-tested, fully-green boundary - the rail/list/detail elements and the
  controller are each substantial pieces of their own. Tree is clean after this commit.

## 2026-09-27 17:35 - claude-sonnet-5 (implement: US1 rail/list/detail - T017, T027, T028)
- Done: T017 (`tests/ui/score-browser/rail-list-detail.test.ts`, 7 tests across the three elements): the rail
  renders *Continue*, *All*, the section tree and *My files* as `role="treeitem"` rows with every folder expanded
  (`aria-expanded="true"`); selecting one emits `browserviewchange` and updates `browserState.view.folder`; the
  list renders `role="option"` rows with title, subtitle, level, key and length (`1:20` for 80 s), double click and
  Enter on the active row both emit `browseropenitem`; the detail pane (`role="region"`) shows metadata and its
  `.score-source-line` text equals `scoreSourceLines(item)` (T025) for the same item, and its Open button emits
  `browseropenitem` with the selected `ItemRef`. Confirmed it failed first ("Failed to resolve import
  .../mx-browser-detail.js"), then implemented against it - all 7 passed on the first run after the three elements
  were written.
  T027 `src/ui/elements/mx-browser-rail.ts`: `role="tree"` list built from `buildSectionTree` (reused directly, the
  same call `mx-library` already makes) plus the two fixed *Continue*/*All* rows and the trailing *My files* row;
  every row with children gets `aria-expanded="true"` (no collapsing yet - SC-001 only needs "visible without an
  extra click"); a roving `tabindex` plus basic Up/Down/Enter, full APG (Left/Right, Home/End) deferred to T084 as
  the task names.
  T028 `src/ui/elements/mx-browser-list.ts` and `mx-browser-detail.ts`: the list calls `buildBrowserItems`/
  `queryBrowser` itself with its own `Intl.Collator` (the same pattern `mx-library` uses for `filterItems` -
  Principle V keeps the collator out of the pure core); `aria-activedescendant` follows an `activeRef` that
  Up/Down move and click/select set; double click and Enter both dispatch `browseropenitem`. The detail pane looks
  up the full `LibraryItem` (for `scoreSourceLines`) or `UserFileEntry` by the selected `ItemRef` directly from
  `browserState.data` - it does not yet show progress/history (data-model.md §2's `ItemProgressView` is still
  `emptyProgressView()` until T053; T028's own task text scopes the detail pane to "metadata, source/licence and
  the Open button", matching this).
- Decisions: keyed row reuse (mentioned in T028's task text as a perf technique) was not built - `mx-browser-list`
  replaces its `innerHTML` on every render, matching every other list-rendering element in this codebase
  (`mx-library`, `mx-recent-list`). Nothing in T017 or SC-007 (checked in T013's own test, over the real 200-ish
  item library) requires more than that yet; a keyed-diff rewrite is better justified once T082 (US5, more filters
  and sorts) or a real perf regression asks for it, not sketched in speculatively now.
- Checks: `pnpm typecheck` green; `pnpm test` full suite green (240 files, 4452 tests, +7 new); `pnpm lint` clean on
  every file touched this session after `biome check --write` fixed one import-order and one formatting nit in the
  new files (the two pre-existing, unrelated findings in `src/core/play/calibration.ts` and
  `src/engine/worklets/dispatch.ts` are untouched by this branch).
- Handoff: next = T018-T020 (run-guard/open-rules tests, the `BrowserSessionController` test, e2e), then T029-T034
  (`browser.css` + remaining i18n strings, the controller itself, wiring into `session.ts`, old e2e/tooling
  migration, the screenshot `--browser` flag, the manual check). The three US1 elements (dialog, rail, list,
  detail) are now a clean, fully-tested, fully-green boundary with no controller wired to them yet - `session.ts`
  wiring (T031) is a large, separate piece of its own. Tree is clean after this commit.

## 2026-09-27 17:50 - claude-sonnet-5 (implement: US1 browser.css + strings - T029)
- Done: T029 `src/ui/styles/browser.css`, imported from `src/app/main.ts` right after `panels.css` (T029's own
  wording, "imported by the app like panels.css"). `--browser-margin` (24px / 12px / 0, at >= 1024px / 768-1023px /
  below 768px, `@media (max-width: ...)`, matching this codebase's existing `layout.css` convention rather than
  `min-width`); `dialog.browser` uses `inset: var(--browser-margin)` (R-1's "covers the window minus a margin",
  overriding the platform's own centred-dialog default); `.browser-body` is a 3-column grid (`16rem 1fr 22rem`) at
  >= 1024px, 2 columns (list + detail, rail hidden) from 768-1023px, and 1 column (list only, detail as an overlay
  panel) below 768px; `.browser-row` gets `content-visibility: auto` + `contain-intrinsic-size` (SC-007);
  `:focus-visible` gets a 2px outline. Added `en.browser.folderPicker` ("Folders") and `en.browser.back` ("Back")
  - the two remaining strings the CSS's `.browser-folder-picker`/`.browser-breadcrumb`/`.browser-back` selectors
  anticipate.
- Decisions: the CSS file defines rules for a folder-picker button, a breadcrumb and a Back button
  (`.browser-folder-picker`, `.browser-breadcrumb`, `.browser-back`) that contracts/score-browser.md §1 requires at
  the 768-1023px and sub-768px breakpoints, but no matching DOM elements exist yet - `mx-score-browser.ts` (T026)
  renders an empty `.browser-toolbar`, and `mx-browser-rail`/`mx-browser-list`/`mx-browser-detail` (T027/T028)
  are not yet mounted into `.browser-body` (that is T031's job). Rather than pull that wiring into this CSS-only
  task, the actual buttons and their toggle behaviour are deferred to T031 ("wire it in session.ts"), which is
  where the whole assembly is put together anyway; T029's rules are inert until then, which is harmless (no
  selector matches, so nothing renders differently). Flagging this explicitly per AGENTS.md section 3 so it is not
  mistaken for a finished responsive interaction - T020's e2e layout assertions (900px/600px) will only pass once
  T031 adds the buttons.
- Checks: `pnpm typecheck` green; `pnpm lint` clean on every file touched. `pnpm test` full suite: 4451/4452 passed;
  the one failure (`tests/library/regeneration.test.ts`, a 5000ms timeout) is pre-existing flakiness under full
  parallel load, unrelated to this change - it passes in isolation (confirmed by running it alone twice) and
  touches none of the files this session edited.
- Handoff: next = T030 (`BrowserSessionController`) and its test T019, then T031 (wiring `session.ts`, including
  the folder-picker/breadcrumb/back-button behaviour this CSS anticipates), T018 (run-guard/open-rules test),
  T032-T034 (old e2e/tooling migration, screenshot flag, manual check), and T020 (e2e, once the wiring exists to
  drive it against). Tree is clean after this commit.

## 2026-09-27 18:20 - claude-sonnet-5 (implement: US1 run guards + BrowserSessionController - T018, T019, T030)
- Done: T018 extended `tests/ui/run-guard.test.ts` (a new describe block: a Play run reaching count-in, and a
  Practice session starting to wait, both close an open browser; Listen playing or pausing does not) and added
  `tests/ui/score-browser/open-rules.test.ts` (`BrowserSessionController.open()` refuses during a Play run
  count-in/running or a Practice session waiting/blocked/interrupted, opens during finished/stopped/aborted or
  idle/finished, pauses a playing Listen before opening and leaves an already-paused Listen's position untouched).
  T019 added `tests/engine/browser-session.test.ts` (fakes: `FakeLibraryCatalog`, a `loadBytes` spy): `openItem`
  for a library ref goes through the same load path and closes the browser on success; a failed item load keeps
  the browser `ready` with the catalog's notice as `browserState.message`; an index failure gives `indexError` and
  `retryLibrary` reloads it. Confirmed every new test failed first ("Cannot find module .../browser-session.js"),
  then implemented against it.
  T030 `src/app/browser-session.ts` `BrowserSessionController`: builds and owns its own `LibrarySessionController`
  (retiring the old *Scores* panel's separate instance, R-20) so `openItem` for a library ref is the identical
  path a dragged-in file takes (FR-005); its `onNotice` callback redirects a load failure into
  `browserState.openFailed({code})` instead of the global notice tray while the browser is the one asking
  (`phase === 'opening'`), so the dialog "never fails silently" (contracts §3) without duplicating
  `library-session.ts`'s own fetch logic. `open()` refuses while `isPlayOrPracticeActive()` (new in `runActive.ts`
  - narrower than `isRunActive()`: only a Play run count-in/running or a Practice session waiting/blocked/
  interrupted, not a playing or paused Listen, matching R-2's own split) and pauses a playing Listen first;
  `guardPanelsDuringRuns` (`runGuard.ts`) now also closes the browser on the edge into
  `isPlayOrPracticeActive()`, so a run that starts *while the browser is open* closes it too (`open()`'s own guard
  only stops it from ever opening over an *already* active run/session).
- Decisions: (1) T019's own "the view state is written to `musicanyya.browser.v1` ... and read back" assertion
  cannot run where `tasks.md` put it - `tests/engine/**` runs under Node (`vitest.config.ts`), which has no
  `localStorage` (confirmed: `localStorage.getItem` throws `TypeError: Cannot read properties of undefined`).
  Moved that one assertion to a new describe block in `tests/ui/score-browser/open-rules.test.ts` (happy-dom, a
  real `localStorage`); `BrowserSessionController`'s behaviour is identical either way, only the test's
  environment needed to change. Per AGENTS.md section 3 ("a later step shows an earlier document is wrong, fix
  that document first, and say so in the log"), tasks.md's T019 description is corrected by this note rather than
  silently working around it. (2) `BrowserSessionController.openItem` takes `index: LibraryIndex | null` as a
  parameter rather than reading `browserState.get().data.index` itself, so the pure "which index was this called
  with" question stays visible at the call site and in the unit test, matching how `Session.openLibraryItem`
  already threads its own `index` through explicitly.
- Checks: `pnpm typecheck` green; `pnpm lint` clean on every file touched (one import-order and one formatting nit
  fixed by `biome check --write`; the pre-existing `src/core/play/calibration.ts` finding is unrelated). `pnpm test`
  full suite: 4464/4465 passed, +13 new; the one failure is the same pre-existing `tests/library/regeneration.test.ts`
  timeout flakiness under full parallel load noted in the previous log entry (passes in isolation, touches no file
  this branch has edited).
- Handoff: next = T031 (wiring `session.ts`: mount `mx-score-browser`, `mx-open-button` opens it, the Score menu's
  *Open...* entry, the folder-picker/breadcrumb/back-button behaviour `browser.css` (T029) already anticipates,
  starting the app with the browser open when no Score is loaded), then T032-T034 (old e2e/tooling migration, the
  screenshot `--browser` flag, the manual check) and T020 (e2e, once the wiring exists to drive it against). T031
  is the last piece before the US1 Independent Test and Checkpoint can be verified end to end. Tree is clean after
  this commit.

## 2026-09-27 19:10 - claude-sonnet-5 (implement: US1 wiring into session.ts - T031)
- Done: T031, wiring the browser into the running app.
  `src/app/session.ts`: `BrowserSessionController` replaces the standalone `LibrarySessionController` field
  (retired - `BrowserSessionController` now builds and owns its own, R-20); mounts `mx-score-browser` into `#mx-main`
  and appends `mx-browser-rail`/`mx-browser-list`/`mx-browser-detail` into its `.browser-body` once connected;
  `document` gets one `openbrowser` listener (`mx-open-button` and the score menu's *Open...* entry each remember
  their own invoker and dispatch it, so this only calls the guarded `this.browserController.open()`); a
  `browseropenitem` listener calls `browserController.openItem(ref, browserState.get().data.index)`; a
  `browserretrylibrary` listener calls `retryLibrary()`; the *Scores* panel's tools drop `mx-library` (`scores:
  [scoreSource, recentList]` - `mx-recent-list` stays per T031's own text, until T068 replaces it with *My files*);
  the old `loadLibraryIndex`/`openLibraryItem`/`clearOpenedLibraryItem` private methods and the `viewState`-driven
  lazy-index-fetch-on-panel-open are deleted (dead code, nothing dispatches `openlibraryitem`/`libraryretry`
  anymore); `openFile`/`reopenRecent` call `browserController.clearOpenedItem()` directly; FR-001 - `start()` opens
  the browser once at the end if `scoreState.getStatus().kind === 'empty'`.
  `src/ui/elements/mx-open-button.ts`: the button's own click and its public `open()` (called by the drop-zone
  invitation) now remember the invoker and dispatch `openbrowser` instead of clicking the file input directly; the
  hidden `<input type="file">` and its `fileopen` event are unchanged, so every existing e2e spec that sets files
  on `mx-open-button input[type=file]` directly (not through a click) keeps working untouched - checked across the
  whole `tests/e2e/` tree before deciding not to touch those files in this task (T032 is next).
  `src/ui/layout/menu-model.ts` + `mx-menu.ts`: a `MenuEntry.panel` may now be `'browser'` (not a `PanelId`, R-2/R-20)
  - `entry('browser', false, false)` (`needsScore: false`, `idleOnly: false`, since its own guard is the narrower
  `isPlayOrPracticeActive()` inside `BrowserSessionController.open()`, which already safely no-ops when refused,
  matching the bar's own Open button which was never disabled either); `mx-menu`'s `activate()` dispatches a
  `bubbles, composed` `openbrowser` event for it instead of calling `viewState.openPanel`. The score menu is now
  *Open...*, *About this score*, *Recent attempts* (`en.panels.scores` relabelled from "Recent scores" to "About
  this score", `en.panels.browser` added as "Open…").
  `src/ui/elements/mx-browser-list.ts`: added the "Library unavailable" + Retry banner (`browserState.data.
  indexError`) that Edge Cases and T020's Independent Test need - not built in T027/T028, whose own task text
  didn't call for it, but nothing else in the US1 slice owned it either.
  `src/ui/elements/mx-score-browser.ts` (T026, this session): added the folder-picker button, breadcrumb and Back
  button contracts/score-browser.md §1 describes for the 768-1023px and sub-768px breakpoints - `browser.css`
  (T029) already had rules for `.browser-folder-picker`/`.browser-breadcrumb`/`.browser-back` waiting for real
  elements. The folder picker toggles `.browser-rail-overlay-open` on `mx-browser-rail` (closed again by any
  `browserviewchange`, i.e. picking a folder or a row); a `browserviewchange` carrying a `selected` field opens
  `.browser-detail-overlay-open` on `mx-browser-detail`; Back only removes that class (the selection itself is
  untouched, so reopening the same row shows it again without re-querying).
- A real bug, found only by manual verification, not by any unit test: `dialog.browser { display: flex; ... }`
  (T029's own CSS) matched the dialog element **regardless of the `open` attribute**, so at equal specificity with
  the User-Agent's own `dialog:not([open]) { display: none }` rule, the *author* rule always won (origin beats
  specificity in the cascade) - `browserState.close()` correctly removed the `open` attribute and called
  `dialog.close()`, but the dialog stayed visually on screen regardless. happy-dom's tests never caught this
  because it renders no CSS at all. Caught by starting the real dev server (`preview_start`) and driving the app in
  the browser pane end to end: opening a library item, watching it actually load behind a dialog that never
  visually closed. Fixed by scoping the rule to `dialog.browser[open]`. Re-verified after the fix: opening
  "C major - introduction" from the browser now correctly closes the dialog and shows the loaded Score; the *Open*
  button, the score menu's *Open...* entry, Escape, and reload-preserves-selection (`musicanyya.browser.v1`) all
  behave as designed; the 900px folder-picker overlay and the 600px detail-overlay-with-Back both work as built.
- Checks: `pnpm typecheck` green; `pnpm lint` clean on every file touched (the two pre-existing, unrelated findings
  in `src/core/play/calibration.ts`/`src/engine/worklets/dispatch.ts` are untouched by this branch); `pnpm test`
  full suite green (242 files, 4471 tests, +26 new/updated since the last log entry, including fixes to
  `tests/ui/menu.test.ts` for the redesigned score menu). Manually verified live in the browser pane per the note
  above (not yet through `pnpm test:e2e` - the existing e2e suite has not been run or migrated: that is T032).
- Handoff: next = T032 (migrate the e2e suite: most specs that set files directly on `mx-open-button input[type=
  file]` should need no change, but every spec that starts from an empty Score now meets the auto-opened browser
  first and must close it, per R-20 - this needs an actual `pnpm test:e2e` run to find out which, not a guess),
  `tests/e2e/helpers/browser.ts` (`openBrowser`, `closeBrowser`, `openScoreFile`, `rowByRef`), T033 (`--browser`
  screenshot flag), T034 (manual check), then T020 (the new e2e spec) and the US1 checkpoint gate (`pnpm test:e2e`
  green, Independent Test, full log entry). This is a clean, fully-tested, fully-green (per the unit suite) boundary,
  but e2e is unverified beyond the interactive check above - flagging that honestly rather than guessing at its
  state. Tree is clean after this commit.

## 2026-09-27 16:56 - claude-sonnet-5 (implement: T032 - migrate the e2e suite off the old panel)

- Session start: found the previous session's T032 work already in the working tree, uncommitted (helper
  `tests/e2e/helpers/browser.ts`, migrated specs, `mx-browser-list.ts`'s dblclick-race fix). Explained exactly by
  the last log entry's own handoff (next = T032, same files) - continued it rather than asking, per AGENTS.md
  step 4 ("uncommitted changes you cannot explain" only blocks when the log doesn't already account for them).
- Done: T032. `grep -l "mx-open-input\|setInputFiles\|mx-library\|mx-recent-list" tests/e2e tools/dev` (re-run, not
  guessed) showed every remaining hit is a spec that sets files directly on `mx-open-button input[type=file]` with
  no interaction in between that would meet the auto-opened browser first (verified file by file, not assumed) -
  except three that did, all fixed:
  - `tests/e2e/static-host.spec.ts` and `tests/e2e/electron-smoke.spec.ts`: each opened the environment/diagnostics
    panel (an unrelated check - the *host* browser's own name, not the score browser) before loading any file;
    FR-001's auto-opened dialog now blocks the bar underneath it. Fixed with `closeBrowser(page)` right after the
    empty-state check.
  - `tests/e2e/us1-open-view.spec.ts`: reopens a recent file from the Score menu after a `page.reload()`, which
    restarts with no Score and the browser open again. Same fix.
  - `tests/e2e/electron-pressed-keys.spec.ts`'s on-screen-piano test never opens a Score at all, just the View
    menu; same fix.
  - Along the way, `openPanel`'s "About this score" menu entry (`data-panel="scores"`) turned out to be disabled
    whenever no Score is loaded (`menu-model.ts`'s `entry('scores', true)`, unchanged since before T031) - but that
    panel now also holds the recent list (T031), which is exactly what you reach for with *nothing* open. Changed
    to `needsScore: false`; `tests/ui/menu.test.ts` updated to match (a real behaviour fix, not a weakened
    assertion: `mx-score-source` already renders empty with no item, so nothing regresses for "About this score"
    itself). This is why `tests/ui/menu.test.ts` is in this diff.
- Two of `helpers/browser.ts`'s own functions had a real race, found only by running e2e for real (never on
  chromium/webkit - Electron's `firstWindow()` resolves before the app's own bootstrap script has necessarily run,
  where Playwright's `page.goto()` waits longer): a check-then-click "is it open already?" can run *before* FR-001's
  own auto-open decision, click the Open button while it is still reachable, and then watch FR-001 open the dialog
  underneath the click's own retry loop, which never succeeds because the header now permanently covers the button.
  Fixed `openBrowser` (retry the click itself, tolerating an interception, until the dialog is visible) and
  `closeBrowser` (poll briefly for the dialog to appear before deciding there is nothing to close) so either order
  of "FR-001 opens it" vs. "the check runs" works. Caught by `--project=electron`, reproduced standalone with
  `-g "packaged shelf" --workers=1`.
- A second, unrelated real bug, also only caught by running e2e for real: `electron-smoke.spec.ts`'s "no aside
  reserves space" layout contract (feature 004 FR-001) failed because `mx-score-browser` - a light-DOM host mounted
  straight into `#mx-main`, T031 - has no CSS of its own, so it defaults to `position: static` and counts as a flow
  child even though its only content (the `<dialog>`) is independently `position: fixed`. Fixed with
  `mx-score-browser { position: fixed }` in `browser.css` (browser.css already had the identical instinct for the
  dialog itself). The same underlying gap made `us3-run-chrome.spec.ts`'s `visibleOverlays()` helper flag
  `mx-score-browser` as "shown" whenever its own box passed `checkVisibility()`, regardless of whether the dialog
  inside was open - fixed by adding it to that helper's existing `emptyContainer` treatment (same as
  `mx-drop-zone`/`#panel-host`: judged by whether anything is visible *inside*, not the container's own box).
- A third real, pre-existing bug, exposed (not caused) by the required reordering: `mx-app`'s bar-fold
  (`fitBar()`) did not fit the bar's contents even compact once a Score is loaded at <= ~800-900px width, because
  no prior test had ever opened a bar menu *after* loading a Score at a narrow width (every one used to do it on
  the empty, lighter bar first; FR-001 now forces that order). The overflow left the focused "View" menu button
  past the viewport edge, and the browser's own focus-follows-scroll auto-scrolled `mx-app` (a valid scroll
  container despite `overflow: hidden`) sideways - `tests/e2e/piano-keyboard.spec.ts`'s 800x600 fit check caught
  the resulting off-screen keys. Root-caused and fixed per owner decision (asked via AskUserQuestion, chose "extend
  the existing breakpoint"): `layout.css`'s "relocate mode-controls/size-controls to the View popup" rule, previously
  phone-only (`max-width: 480px`), widened to `max-width: 900px` - reuses the relocation `mx-view-panel.ts` already
  had, loses nothing. Logged as T096 (added then ticked, same session). `tests/e2e/helpers/panels.ts`'s
  `barFitted()` also now accepts "folded already" as settled, not only "exactly fits" (defensive; still correct
  once the bar genuinely fits again).
- A fourth issue, found live and **not fixed**: `tests/e2e/library.spec.ts`'s "C major -> C minor" key-change test
  fails reproducibly on WebKit only (chromium and Electron green) - opening that item through the score browser
  dialog renders its key signature twice (12 `g.keyAccid` instead of 6) on page 1. Ruled out: a missing wait (poll
  doesn't help, the wrong state is stable), the test's own query scoping (fixed independently - it read only
  `document.querySelector('.mx-score-page')`, always page 1; now flattens every page, kept regardless), the
  dialog's mere DOM presence (drag-and-drop bypassing it entirely renders correctly on the same branch), and a
  `refit()` re-layout-after-close patch (tried, no effect, reverted - not in this diff). Documented in
  `docs/known-bugs.md` with everything ruled out and the specific wrong state, and spun off as background task
  `task_028b771b`. Asked the user how to leave it for this checkpoint (AskUserQuestion): leave it red and report
  honestly, per the existing `play-grade-marks.spec.ts` precedent - not skipped, not weakened.
- Checks: `pnpm typecheck` clean; `pnpm lint` (biome) clean on every file this diff touches (pre-existing findings
  in `calibration.ts`/`dispatch.ts`/`menu.test.ts:160` untouched); `pnpm test` 242 files / 4472 tests green.
  `pnpm test:e2e --project=chromium` 333 passed / 8 skipped, 0 failed (two re-runs; a `us1-open-view`/`piano-
  keyboard` pair failed on the first full run before the fixes above, both green after). `--project=electron`
  green except the known WebKit-only bug does not apply there (Electron uses chromium); one `us2-panels.spec.ts`
  SC-007 100ms-timing test flaked in both directions across five solo re-runs (2 failed, 3 passed) - pre-existing,
  untouched by this diff, timing-sensitive by design; not investigated further (out of scope, matches the
  established "known flaky under load" pattern in `docs/agents/reference.md` R7, though not yet added to that
  list). `--project=webkit`: green except the one documented, tracked bug above.
- Decisions: `entry('scores', true)` -> `entry('scores')` in `menu-model.ts` (owner-independent - the old
  behaviour was a bug against T031's own stated intent, not a design choice); `layout.css`'s breakpoint widened to
  900px (owner decision, asked and answered - see above); the WebKit key-signature bug left red rather than
  skipped/weakened (owner decision, asked and answered - see above).
- T032's own required mapping (old-panel-behaviour assertions -> what covers them now): `tests/e2e/library.spec.ts`
  itself is migrated in place (every assertion kept, only the opening mechanism changed - see the diff). The panel
  component's own unit tests (`tests/ui/mx-library.test.ts`, `tests/ui/mx-library-filters.test.ts`,
  `tests/ui/open-and-recent.test.ts`, `tests/ui/library-state.test.ts`) still test `mx-library`/`mx-recent-list`/
  `libraryState` directly and still pass, because those components still exist (unmounted from the live app since
  T031, not deleted) - `tests/ui/score-browser/rail-list-detail.test.ts` and the other US1 unit suites are their
  replacement for the *mounted, reachable* behaviour: folder tree -> `mx-browser-rail`'s section tests; item list,
  search, sort, selection -> `mx-browser-list`'s tests (plus this session's own double-click race regression
  test); recent/open flow -> `browser-session.test.ts`. T092 (OD-6) removes the old files together once that
  mapping is confirmed complete - not yet re-verified item by item against T092's own file list, flagging that
  honestly rather than assuming this note alone satisfies it.
- Handoff: next = T033 (`tools/dev/screenshot.ts` `--browser` flag + docs), T034 (manual check, needs T033), then
  T020 (`tests/e2e/score-browser.spec.ts`, the new US1 e2e spec) and the US1 checkpoint gate. Tree is **not** clean:
  everything in this entry's diff is uncommitted (same as inherited at session start) - committing is the very next
  step, before T033. `docs/known-bugs.md`'s WebKit entry and background task `task_028b771b` need no further
  action from the next agent unless picking that fix up directly.
