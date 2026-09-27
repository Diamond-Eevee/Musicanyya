# Tasks: Score browser with progress

**Input**: Design documents from `specs/013-score-browser-progress/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

<!--
  Format: `- [ ] T001 [P] [US1] Description with exact file path`
  States: `[ ]` open, `[~]` in progress with ` (claimed: <agent-id> <date>)`, `[x]` done (AGENTS.md section 4)
  - [P]   = can run in parallel (different files, no dependency on unfinished tasks)
  - [USn] = user story the task belongs to (omit for Setup/Foundational/Polish)
  - Tests come BEFORE implementation (Constitution IV) and must fail first.
  - No task touches an AudioWorklet, the scheduler, MIDI input timing or plugin callbacks (plan: "Real-time Paths
    Touched: none"; the Practice matcher's new `loopCompleted` effect is pure core wait-mode logic, and pausing Listen
    uses the existing transport command). So there is no RT review task. If an implementation turns out to touch one of
    those paths, add an RT review task with `rt-audio-reviewer` right after it.
-->

Owner decisions OD-1 to OD-6 are answered (2026-09-27, "respond with recommended": every recommendation approved;
spec Clarifications). Tasks marked **(OD-n)** implement the approved answer. Nothing in this list waits for the owner
except the SC-008 user check in T090, which only the owner can run.

MVP note: US1 (browse and open) and US2 (progress) are both P1. US1 alone already replaces the cramped panel and passes
its Independent Test with no stored progress. US2 makes it the feature the owner asked for.

## Phase 1: Setup

- [x] T001 Owner decision gate OD-1 to OD-6 (owner approved 2026-09-27: all recommendations) (plan.md "Owner decisions"): record each answer in `specs/013-score-browser-progress/spec.md` Clarifications and in the plan table. OD-1 approved -> FR-010 and FR-024 say "whole Score, all staves of the part"; OD-2 approved -> FR-024 adds "extra notes at most 10 % of the notes total". If declined: OD-1 -> `bestEligible`/`masteryEligible` ignore the scope (T035, T036, T049 change their expectations first); OD-2 -> `MASTERY_MAX_EXTRA_PERCENT = null` (T004); OD-3 -> T057 and T062 drop the Performance deletion; OD-4 -> the `resultRemoved` parts of T037, T046 and T054 are dropped; OD-5 -> T008 and T089 are removed and SC-007's automated part goes back to the owner; OD-6 -> T092 is removed. Blocks T008, T054, T057, T089, T092
- [x] T002 Apply `contracts/contract-changes.md` to the canonical contracts with their version lines: `specs/001-score-viewer-listen/contracts/ports.md` 1.5.0 (`ProgressStore`, `PerformanceStore.removeByScore`, `ScoreStore` deprecated), `specs/001-score-viewer-listen/contracts/storage.md` (IndexedDB schema 3, `musicanyya.browser.v1`), `specs/003-play-mode-grading/contracts/performance-log.md` (optional `complete`), `specs/002-practice-wait-mode/contracts/practice-session.md` 1.7.0 (`loopCompleted`), `specs/004-score-first-layout/contracts/ui-shell.md` 1.1.0 (Open -> browser, menu), `specs/005-practice-score-library/contracts/library-port.md` 1.3.0 (panel superseded), `specs/009-play-cursor-metronome/contracts/play-display.md` 2.1.0 (`newBest`)
- [x] T003 [P] Named constants of data-model.md section 11 in `src/core/defaults.ts` (`PROGRESS_FORMAT_VERSION`, `PROGRESS_RESULTS_MAX`, `MASTERY_NOTES_CORRECT_MIN_PERCENT`, `MASTERY_NOTES_ON_TIME_MIN_PERCENT`, `MASTERY_TEMPO_PERCENT_MIN`, `MASTERY_MIN_STRICTNESS`, `CONTINUE_ITEMS_MAX`, `MORE_PRACTICE_AFTER_RUNS`, `USER_FILE_VERSIONS_MAX`, and - moved here from `src/engine/config.ts` while implementing T014/T022, since `src/core/browser/query.ts` is pure and cannot import the engine layer - `BROWSER_SEARCH_MAX_CHARS`, re-exported from `src/engine/config.ts`), each with a one-line comment naming its FR, and in `src/engine/config.ts` (`USER_FILES_BYTES_BUDGET`, `UNDO_WINDOW_MS`, `BROWSER_ANNOUNCE_DEBOUNCE_MS`); a test in `tests/core/progress/constants.test.ts` pins `PROGRESS_RESULTS_MAX >= PERFORMANCES_PER_SCORE_MAX` (data-model section 3 invariant)
- [x] T004 [P] (OD-2) `MASTERY_MAX_EXTRA_PERCENT` in `src/core/defaults.ts` (10, or `null` if OD-2 is declined) with its comment
- [x] T005 [P] Test data builders in `tests/fakes/progress-builders.ts`: `result()`, `record()`, `userFile()`, `libraryIndexOf(n)` (a synthetic index of n items spread over a 3-level section tree with steps, like 011's 200-item synthetic index) and `historyOf(seed, n)` (a seeded random sequence of `played`/`resultRemoved`/`opened`/`practised` events with realistic counts). Every builder output is valid by data-model.md validation (no placeholder values)
- [x] T006 [P] Version-2 database fixture for the migration in `tests/fixtures/progress/db-v2.ts`: real `recentScores` records (bytes of `tests/fixtures/musicxml/engraving/fur-elise-bare.musicxml` and of one library file, `public/library/learning/keys/c-major/introduction.musicxml`, with their real SHA-256) and `performances` records for both (complete and stopped runs, one with `range`, one with preset `right`), recorded in the 003 `StoredPerformance` shape without `complete`
- [x] T007 [P] Seed files for pictures and e2e in `tests/fixtures/progress/`: `mixed-statuses.json` (one item each New/Practised/Played/Mastered, real library ids), `c-major-intro-mastered.json` (a mastering result on `learning/keys/c-major/introduction`), with a README row (own work, CC0) in `tests/fixtures/progress/README.md`
- [x] T008 (OD-5) Add dev dependency `@axe-core/playwright` 4.13.0 with `pnpm add -D @axe-core/playwright@4.13.0`; record it in the plan's Complexity Tracking (already there) and in Active Technologies in `docs/agents/reference.md` (mark "approved"); `THIRD_PARTY_NOTICES.md` only if it lists dev tools

---

## Phase 2: Foundational (blocks all user stories)

Types and the storage port every story reads. There are no new fakes for clock, MIDI or audio: this feature records
from stored Grades and needs none of them.

- [x] T009 [P] Progress types of data-model.md sections 2-5 in `src/core/progress/types.ts` (`ProgressResult`, `ResultScope`, `ProgressRecord`, `ProgressEvent`, `ItemRef`, `MasteryThresholds`, `UserFileEntry`) with the `DEFAULT_MASTERY_THRESHOLDS` value built from the T003/T004 constants
- [x] T010 [P] Browser types of data-model.md sections 6-9 in `src/core/browser/types.ts` (`BrowserItem`, `ItemProgressView`, `BrowserViewState`, `FolderSel`, `StatusFilter`, `Suggestion`)
- [x] T011 `ProgressStore` interface and `ProgressStoreResult` in `src/engine/ports.ts` as `contracts/progress-store.md` section 1, progress half only (`availability`, `listProgress`, `getProgress`, `apply`); the *My files* half is added to the port with its implementation in T066, so no adapter ever carries a stub (analyze A6); `ScoreStore` gets a `@deprecated` doc comment pointing at R-20 (depends on T009)
- [x] T012 [P] Extend `tests/architecture/layers.test.ts` (or confirm with a named assertion) so `src/core/progress/**` and `src/core/browser/**` import nothing from `src/engine`, `src/ui`, `src/app` and no DOM/Web API globals; run it and log the result

**Checkpoint**: `pnpm typecheck` green; `pnpm test -- tests/architecture tests/core/progress/constants.test.ts` green.

---

## Phase 3: User Story 1 - Browse and open from a big, comfortable window (Priority: P1) MVP

**Goal**: *Open* shows a near-full-screen browser with rail, list and detail, which opens any library item or closes
without side effects, and remembers where the musician was.
**Independent Test**: With no stored progress, open the browser, navigate *Learning > Keys > C major*, open the first
exercise - the Score is shown and the browser is closed; reopen the browser - it returns to *C major* with that item
selected.

### Tests (write first, confirm they fail)

- [x] T013 [P] [US1] `tests/core/browser/items.test.ts`: `buildBrowserItems` over the real `public/library/index.json` gives one row per item with title, subtitle (composer/arranger), `folderPath` (section titles root to leaf), level, keys, measures, duration, step and `libraryOrder` equal to 011's panel order (depth-first `buildSectionTree`, then step rank, `stepOrder`, title); status `new` for every row with no records; `searchText` contains title, composer, arranger, folder names (FR-026)
- [x] T014 [P] [US1] `tests/core/browser/query.test.ts` (folder and search part): a `section` folder lists that section and its sub-sections in library order; a non-empty search matches across every folder including *My files* rows (built with `userFile()`), each result keeps its `folderPath`, and the effective folder is reported as `all` while `view.folder` is unchanged (US1 #4); search is case- and accent-insensitive ("elise" finds "Für Elise"), and every whitespace-separated term must match; search text over `BROWSER_SEARCH_MAX_CHARS` is cut
- [x] T015 [P] [US1] `tests/core/browser/view-state.test.ts`: `validateViewState` keeps valid fields and replaces each invalid one alone with its default (data-model section 7); a `section` id missing from the index follows `formerIds` or becomes `continue`; `seedFromLibraryFilter` maps a stored `musicanyya.library.v1` payload (`sectionId`, `level`, `key`, `tag`) to the new state (R-15)
- [x] T016 [P] [US1] `tests/ui/score-browser/dialog.test.ts` (happy-dom): `mx-score-browser` opens with `showModal()`, focus in the search field (US1 #1); Escape with an empty search, the close button and a click on the backdrop (target = the dialog) each close it and emit `browserclose`; closing does not touch `scoreState`, `transportState` position or settings (US1 #3, FR-004); focus returns to the invoker
- [x] T017 [P] [US1] `tests/ui/score-browser/rail-list-detail.test.ts`: the rail renders *Continue*, *All*, the section tree and *My files* as `role="tree"` items, every folder expanded by default so each key folder is visible (`contracts/score-browser.md` section 1, analyze A4); selecting a folder emits `browserviewchange`; the list renders `role="listbox"` rows with title, subtitle, level, key and length; the detail pane shows metadata and, for library items, source and licence text equal to `mx-score-source`'s for the same item (FR-013); double click, Enter on the active row and the *Open* button each emit `browseropenitem` with the row's `ItemRef` (US1 #2)
- [x] T018 [P] [US1] `tests/ui/run-guard.test.ts` (extend) and `tests/ui/score-browser/open-rules.test.ts`: opening is refused while a Play run (count-in/running) or Practice session (waiting/blocked/interrupted) is active; with Listen playing, opening pauses the transport and the browser stays open while Listen is paused; a Play run or Practice session starting closes the browser (FR-007, R-2)
- [x] T019 [P] [US1] `tests/engine/browser-session.test.ts` (US1 part, fakes: `fake-library-catalog`, a `loadBytes` spy): `openItem(ref)` for a library ref goes through `LibrarySessionController.openItem` (same load path, FR-005) and closes the browser on success; a failed load keeps the browser open with the catalog's notice; the view state is written to `musicanyya.browser.v1` on every `browserviewchange` and read back on the next open (US1 #5); an index failure gives `indexError` with *My files* and *Continue* still listed (Edge Cases: library unavailable), and *Retry* reloads the index
- [x] T020 [P] [US1] `tests/e2e/score-browser.spec.ts` (US1 block) with helper `tests/e2e/helpers/browser.ts` (`openBrowser`, `closeBrowser`, `openScoreFile`, `rowByRef`): the app starts with the browser open when no Score is loaded (FR-001); the Independent Test above; reload keeps folder, search, sort and selection (US1 #5); at 1280, 900, 600 and 360 px the dialog keeps a visible margin at >= 1024 px (FR-002), shows the folder picker at 900 px and the detail as a panel over the list at 600 px, and `scrollWidth <= clientWidth` for the dialog and every pane (US1 #6); SC-001: from a loaded Score, a C major item opens in 3 actions (Open, the *C major* folder visible without expanding anything, double click)

### Implementation

- [x] T021 [P] [US1] `src/core/browser/items.ts` `buildBrowserItems(index | null, files, records, thresholds, compare)`: library rows and file rows as data-model section 6 (progress part returns `new`-status views until T043), with pre-folded `searchText` (NFD, strip marks, lower-case); `compare` (caller-supplied, like `filterItems`) only breaks a title tie within one folder/step, found needed while matching 011's panel order exactly (data-model.md section 6 note) (T013)
- [x] T022 [P] [US1] `src/core/browser/query.ts` `queryBrowser(items, view, collator)`: folder filter over section subtrees, search, sort `library`/`title` both directions, effective folder for search (T014; status, level/key/tag filters and the other sorts come in T082)
- [x] T023 [P] [US1] `src/core/browser/view-state.ts` `validateViewState`, `seedFromLibraryFilter`, `DEFAULT_BROWSER_VIEW` (T015)
- [x] T024 [US1] `src/ui/state/browserState.ts`: session state machine of data-model section 8 (`closed -> loading -> ready -> opening -> closed`, `indexError`), the view state with `localStorage` `musicanyya.browser.v1` read/write (try/catch, best effort, like `libraryState`), seeding from `musicanyya.library.v1` once (depends on T023)
- [x] T025 [P] [US1] Extract the source/licence text of `src/ui/elements/mx-score-source.ts` into `src/ui/format/score-source-text.ts` (pure function of a `LibraryItem`); `mx-score-source` uses it and its existing tests in `tests/ui/mx-score-source.test.ts` stay green unchanged
- [x] T026 [US1] `src/ui/elements/mx-score-browser.ts`: `<dialog>` shell per `contracts/score-browser.md` section 1 (header with search, *Open file...* placeholder hidden until US3, close button; toolbar slot; body grid; `aria-live` status line; `role="alert"` message line), `showModal()`/`close()` driven by `browserState`, Escape via `cancel`, backdrop click, focus to search and back to the invoker (T016)
- [x] T027 [P] [US1] `src/ui/elements/mx-browser-rail.ts`: `role="tree"` of *Continue*, *All*, sections (via `buildSectionTree`) and *My files*; selection emits `browserviewchange`; basic Up/Down/Enter (full APG keys in T084) (T017)
- [x] T028 [P] [US1] `src/ui/elements/mx-browser-list.ts`: `role="listbox"` rows with `data-ref`, keyed row reuse, `aria-activedescendant`, Up/Down/Enter and double click to open; `src/ui/elements/mx-browser-detail.ts`: metadata, source/licence (T025) and the *Open* button (T017)
- [x] T029 [US1] `src/ui/styles/browser.css` (imported by the app like `panels.css`): grid `16rem | 1fr | 22rem` at >= 1024 px, folder picker and breadcrumb 768-1023 px, detail panel over the list below 768 px, `--browser-margin` 24/12/0 px, `content-visibility: auto` + `contain-intrinsic-size` on rows, `:focus-visible` outline 2 px; browser strings in `src/ui/i18n/en.ts` (title "Scores", search label, folder names, "Library unavailable", "Retry", "Open", "Close", "{n} items") (T020 layout assertions)
- [x] T030 [US1] `src/app/browser-session.ts` `BrowserSessionController`: open (refuse during Play/Practice, pause playing Listen), load the index through the catalog, `openItem(ref)` for library refs through `LibrarySessionController`, close on success, keep open with a message on failure, persist view changes, `retryLibrary` (T019)
- [x] T031 [US1] Wire it in `src/app/session.ts`: mount `mx-score-browser` in `mx-app`; `mx-open-button` (`src/ui/elements/mx-open-button.ts`) opens the browser instead of the file chooser (it keeps `open()` for the drop-zone invitation, which now opens the browser); open the browser at start when no Score is loaded (FR-001); `src/ui/layout/menu-model.ts` Score menu = *Open...* (browser), *About this score* (the `scores` panel, now only `mx-score-source`, heading in `en.panels.scores`), attempts; stop mounting `mx-library`; `mx-recent-list` stays mounted in the `scores` panel under *About this score* until T068 replaces it with *My files*, so own files can still be reopened between US1 and US3 (analyze A2); `src/ui/state/runGuard.ts` also closes the browser on a Play/Practice start (T018); shortcuts in `src/ui/shortcuts.ts` ignored while the browser is open
- [x] T032 [US1] Existing e2e specs and tools that open files or use the old panel (`grep -l "mx-open-input\|setInputFiles\|mx-library\|mx-recent-list" tests/e2e tools/dev`): switch them to `helpers/browser.ts` (`openScoreFile`, `closeBrowser`) and the browser's library rows, without weakening any assertion; `tests/e2e/helpers/library.ts` opens items through the browser. Where a spec tested the old panel's own behaviour (`tests/e2e/library.spec.ts`, `tests/ui/mx-library*.test.ts`, `tests/ui/open-and-recent.test.ts`, `tests/ui/library-state.test.ts`), map every assertion to the browser test that now covers it and record the mapping in the log (the old files are removed only by T092, after OD-6)
- [x] T033 [US1] `tools/dev/screenshot.ts`: close the start-up browser before the picture unless `--browser` is given; `--browser` takes the picture with it open; document the flag in `docs/agents/reference.md` R7 and `specs/013-score-browser-progress/quickstart.md`
- [x] T034 [US1] Manual check: `pnpm screenshot --browser` and `--browser --width 900` / `--width 600`, look at each PNG against quickstart US1 steps 1 and 4, and name the pictures in the log

**Checkpoint**: US1 Independent Test passes (T020); full gate `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` green with summary lines; log entry; commit.

---

## Phase 4: User Story 2 - See my progress on every item (Priority: P1)

**Goal**: every item and folder shows status, best, last and trend; the detail pane shows the history; progress
survives trimming and reloads, older attempts are migrated, and a new best is announced.
**Independent Test**: Record two Play-mode attempts on one library item (first 70 %, then 85 % notes correct); open
the browser - the item shows *Played*, best 85 %, last 85 %, trend up; its folder counts it as played; after an app
reload the same figures are shown.

### Tests (write first, confirm they fail)

- [ ] T035 [P] [US2] `tests/core/progress/compare.test.ts`: `compareResults` orders by notes correct, then notes on time, then later `finishedAt`, with exact integer comparison (cases where float division would tie or flip, e.g. 2/3 vs 666666/1000000); `percentShown` rounds down and returns null for 0 of 0; `atLeast` at, one below and one above each threshold; `bestEligible` rejects stopped runs and partial scopes (OD-1) and accepts `complete: null`; `masteryEligible` rejects `complete: null`, tempo 99.9, strictness below `MASTERY_MIN_STRICTNESS`, and extras over `MASTERY_MAX_EXTRA_PERCENT` (OD-2); a shown "90 %" is never paired with not-mastered at a 90 % threshold (R-8)
- [ ] T036 [P] [US2] `tests/core/progress/scope.test.ts` over real fixtures (`tests/fixtures/musicxml/grand-staff-two-voices-per-staff.musicxml`, two staves; `tests/fixtures/musicxml/eight-measure-melody.musicxml`, one staff; for a two-staff Score with one staff empty in the selected part, `tests/fixtures/musicxml/hands-accompaniment.musicxml` if it has that shape, else a new hand-written fixture with its README row; analyze A14): `resultScope` is `whole` for range null + preset `both` on a two-staff piano Score, `partial` with `fromMeasure`/`toMeasure` for a range, `partial` with `hands: 'right'` for right-hand-only on a two-staff Score, and `whole` for `right` on a one-staff Score or a Score whose other staff has no notes (OD-1, R-7); `scopeFromStoredSettings` (legacy) gives `whole` only for range null + `both`
- [ ] T037 [P] [US2] `tests/core/progress/reduce.test.ts`: every event of data-model section 4 on null and existing records; `played` twice with the same `runId` counts once; 25 `played` keep 20 `results` newest first while `attempts`, `firstPlayedAt`, `best` and `masteredAt` stay right (US2 #5); `resultRemoved` of the best recomputes it from `results`, of the mastering result recomputes or clears `masteredAt`, of an unknown `runId` changes nothing (OD-4); `reset` returns null; `updatedAt` is the max event time; `opened`/`practised` out of order keep the newest values; the record carries `format: 1` (FR-030)
- [ ] T038 [P] [US2] `tests/core/progress/reduce-property.test.ts` (SC-004): for 200 seeded histories from `historyOf` (T005) with trimming and removals, the reduced record's best, last, previous and attempt count equal a naive recomputation over the full untrimmed event list (best only among results still in the record after a removal of the best, per data-model section 3); fixed seeds, deterministic
- [ ] T039 [P] [US2] `tests/core/progress/status.test.ts`: `deriveStatus` for no record / opened only (`new`), practised (`practised`), played (`played`), mastered (`mastered`, sticky after worse runs) (FR-011); `trend` up/down/same/null and the points delta (FR-012)
- [ ] T040 [P] [US2] `tests/core/progress/from-performance.test.ts`: `resultFromStoredPerformance` copies both figures and `counts.extra` from `summary`, `tempoPercent` and `strictness` from `settings`, `complete` from the record or `null` when absent (R-6), and the scope from the given one or the legacy rule
- [ ] T041 [P] [US2] `tests/core/browser/folders.test.ts`: `folderProgress` gives played (played or mastered), mastered and total per section including sub-folders, equal to the sums over each subtree's items (US2 #6, FR-014), and one entry for *My files*; `tests/core/browser/items.test.ts` (extend): an item whose `supersedes[].hash` has a record shows that progress as its own (Edge Cases: library replacement)
- [ ] T042 [P] [US2] `tests/core/practice/loop-completed.test.ts`: the matcher emits `loopCompleted` once each time the loop wraps after its last event was played, never when the wrap came from `skipNext`, never without a loop; existing practice tests stay green (R-9)
- [ ] T043 [P] [US2] `tests/engine/storage/progress-store.contract.ts` (progress cases of `contracts/progress-store.md` section 5: round trip per event, idempotence, trimming, removal recompute, mastery boundaries, skipped unreadable record with `skipped: 1`, concurrent `apply` both landing, never throws) run by `tests/engine/storage/memory-progress-store.test.ts` and `tests/engine/storage/indexeddb-progress-store.test.ts` (fake-indexeddb; plus `full` from an injected `QuotaExceededError` and `unavailable` with no `indexedDB`)
- [ ] T044 [P] [US2] `tests/engine/storage/progress-migration.test.ts`: opening version 3 over the T006 version-2 database keeps `recentScores` and `performances` untouched, creates the four new stores, and the first `ProgressStore` call builds records whose attempts, best (legacy `complete: null` counts for best, not *Mastered*), last/previous and opened dates match the fixture (FR-017, US2 #7); an injected failure writes nothing and the next call retries; a second store instance does not migrate twice; `onversionchange` closes the connection
- [ ] T045 [P] [US2] `tests/engine/storage/performance-store.test.ts` (extend): `complete` round-trips and an old record without it reads back without it; `removeByScore(scoreId)` removes only that Score's records and returns the count; `tests/engine/play-session.test.ts` (extend): a finished run stores `complete: true`, a stopped run `complete: false`, and `onStored` reports the stored performance
- [ ] T046 [P] [US2] `tests/engine/browser-session.test.ts` (US2 part, `MemoryProgressStore`): `opened` after a successful load only (with `as` = library ref or file ref), not after a failed one; `practised` on `sessionEnded('reachedEnd')` and on `loopCompleted` with the bars; `played` after `PerformanceStore.put` succeeded, with the scope from the loaded Score, and nothing when the put failed; `resultRemoved` after an attempt delete succeeded (OD-4); `newBest` true only when the Grade's result is best-eligible and beats the open Score's best; `practiceScoreId`/`playScoreId` = `contentHash` even when no copy was stored (R-3); IndexedDB unavailable -> memory store and one notice "Progress will not be kept on this device"; `full` -> one notice; `listProgress` with `skipped > 0` -> one notice that some stored progress could not be read, while the browser still lists everything else (Edge Cases, R-19; analyze A8)
- [ ] T047 [P] [US2] `tests/ui/grade-panel.test.ts` (extend): "New best" line with its star shape when `playState.newBest`, absent otherwise and for a stopped run (FR-016); `tests/ui/score-browser/progress-display.test.ts`: `mx-status-badge` renders a distinct SVG shape and a text label per status (and a tooltip) (FR-012, R-16); rows show best ("92 % correct · 85 % on time", tempo when not 100 %) and last plus trend; the detail shows attempts, first/last played, last practised with bars, best/last/previous in full words with tempo and strictness, and up to 20 history rows with scope, "Stopped early" and "Stopped early: not recorded" (FR-013); the rail shows "5 of 8 played, 2 mastered" (FR-014)
- [ ] T048 [P] [US2] `tests/e2e/score-browser.spec.ts` (US2 block): the Independent Test, on `learning/keys/c-major/introduction` with the two attempts recorded through the real path: whole-Score Play runs with the fake MIDI keyboard via `tests/e2e/helpers/play.ts`, pressing the correct keys of exactly the first k1 = ceil(0.70 N) and then k2 = ceil(0.85 N) expected notes (N read from the running session) and nothing else, so the figures are deterministic; assert *Played*, best = k2 of N, last = k2 of N, previous = k1 of N, trend up, and the *C major* folder counting it as played - exact values, no either-or (analyze A3); reload shows identical figures (SC-005); reset progress with undo (T057)

### Implementation

- [ ] T049 [P] [US2] `src/core/progress/compare.ts`, `src/core/progress/status.ts`, `src/core/progress/scope.ts`, `src/core/progress/from-performance.ts` (T035, T036, T039, T040)
- [ ] T050 [US2] `src/core/progress/reduce.ts` `applyProgressEvent` (depends on T049; T037, T038)
- [ ] T051 [P] [US2] `loopCompleted` in `src/core/practice/types.ts` and `src/core/practice/matcher.ts` (T042); `StoredPerformance.complete?: boolean` in `src/core/grade/types.ts`, written by `src/app/play-session.ts` `storePerformance` (T045)
- [ ] T052 [US2] Storage: `src/engine/storage/db.ts` version 3 (new stores, `onversionchange`), `src/engine/storage/memory-progress-store.ts` and `src/engine/storage/indexeddb-progress-store.ts` (the progress half of the port, T011), `src/engine/storage/progress-migration.ts` (performances and recentScores opened dates; the *My files* part is in T067), `PerformanceStore.removeByScore` in `src/engine/storage/indexeddb-performance-store.ts` and `tests/fakes/fake-performance-store.ts` (T043, T044, T045)
- [ ] T053 [US2] Progress in the browser model: `buildBrowserItems` fills `progress` from records (current hash + `supersedes` hashes), `src/core/browser/folders.ts` `folderProgress` (T041)
- [ ] T054 [US2] (OD-4) `BrowserSessionController` progress wiring in `src/app/browser-session.ts` and `src/app/session.ts`: store choice (IndexedDB, else memory + notice), `opened`/`practised`/`played`/`resultRemoved` at the points of R-18, the in-memory record of the open Score for `newBest`, `scoreId = contentHash` independent of the stored copy (R-3), notices in `src/ui/i18n/en.ts` (T046)
- [ ] T055 [P] [US2] `playState.newBest` in `src/ui/state/playState.ts` and the "New best" line in `src/ui/elements/mx-grade-panel.ts` (T047)
- [ ] T056 [US2] UI: `src/ui/elements/mx-status-badge.ts` (shapes of R-16, status tokens `--status-new/practised/played/mastered` in `src/ui/styles/tokens.css`), `src/ui/format/result-text.ts` (figures, tempo via `attemptTempo` with percent fallback, scope, strictness, relative dates with `Intl.RelativeTimeFormat`), rows/detail/rail summaries in `mx-browser-list.ts`, `mx-browser-detail.ts`, `mx-browser-rail.ts`, strings and tooltips in `en.ts` (T047)
- [ ] T057 [US2] (OD-3) Reset progress (FR-018): inline confirmation in the detail pane naming shared content when it applies, deferred commit with `UNDO_WINDOW_MS` and *Undo* (`pending` in `browserState`, one at a time, the second commits the first), toast in `mx-notice-tray` while the browser is closed; on commit: `apply(reset)` for every hash of the item and `PerformanceStore.removeByScore` for each; tests in `tests/engine/browser-session.test.ts` (undo cancels, deadline commits, page close inside the window removes nothing) written first
- [ ] T094 [US2] The `e2e-progress-seed` seam of `contracts/score-browser.md` section 8 (analyze A7): a dev-build-only `window` event handled in `src/app/session.ts` that applies seeded `ProgressEvent`s through `ProgressStore.apply` (and, from T066 on, seeded files through `putFile`), never compiled into production builds; `--seed-progress <json>` in `tools/dev/screenshot.ts`; a test in `tests/engine/browser-session.test.ts` that seeding goes through `apply` (no direct record writes). Needed by T058, T073 and T086-T088
- [ ] T058 [US2] Manual check (after T094): `pnpm screenshot --browser --seed-progress tests/fixtures/progress/mixed-statuses.json` and the same with `--greyscale`; a real Play run via `pnpm screenshot --item learning/keys/c-major/introduction --run --grade --play 40` showing "New best"; look at each PNG against quickstart US2 and name them in the log

**Checkpoint**: US2 Independent Test passes (T048); US1 still passes; full gate green; log entry; commit.

---

## Phase 5: User Story 3 - My own files, with their progress kept (Priority: P2)

**Goal**: files opened from the device are kept under *My files* with progress, a stored copy, version tracking,
removal with undo, and a clear message for invalid files.
**Independent Test**: Open an external `.musicxml` file via *Open file...*, do one Play-mode run, reload the app, open
the browser - the file is listed under *My files* with *Played* and its result, and opens again with one click without
choosing it from disk.

### Tests (write first, confirm they fail)

- [ ] T059 [P] [US3] `tests/core/progress/user-files.test.ts`: `fileKey` folds case and NFC ("Etude.xml" = "etude.xml", composed = decomposed "é"); `nextEntry` for a new name, the same name and content (touch, no new version), the same name with new content (old hash first in `earlierHashes`, capped at `USER_FILE_VERSIONS_MAX`), and the same content under another name (a separate entry with the same hash) (FR-021); `entryProgress` takes status, best, *Mastered* and trend from the current hash only, sums attempts and flags earlier-version results; `buildBrowserItems` puts the file name into a file row's `searchText`, so search finds a file by its name (FR-026, analyze A13)
- [ ] T060 [P] [US3] `tests/engine/storage/progress-store.contract.ts` (file cases of section 5: `putFile` new/same/new version/two names one copy, eviction order by `lastOpenedAt` within `USER_FILES_BYTES_BUDGET`, over-budget copy -> `stored: false`, quota -> `stored: false` not an error, `getFileBytes` `notFound` without a copy, `removeFile` with and without progress, a shared copy survives while another entry uses it, `listFiles` order)
- [ ] T061 [P] [US3] `tests/engine/storage/progress-migration.test.ts` (extend): `recentScores` records become *My files* entries with `origin: 'migrated'`, their bytes and dates; `removeMigratedLibraryCopies` drops the migrated entry whose hash equals a library item's `hash` or `supersedes` hash, keeps its progress, and runs once (`meta.migratedLibraryCleanup`) (R-6)
- [ ] T062 [P] [US3] `tests/engine/browser-session.test.ts` (US3 part): opening a file adds or updates its entry only after the Score loaded (US3 #1), and an invalid file leaves *My files* unchanged with a message naming the file and the load error (US3 #5); reopening from disk gives no duplicate and keeps progress (US3 #2); opening an entry with a copy loads its bytes with no file chooser; an entry without a copy gives the message "file not stored - open it again from disk to play" and opens the chooser, and choosing the same name reattaches the copy (US3 #3); remove "keep progress" / "remove progress" commit after the undo window, undo restores, and "remove progress" also removes the Performances of every hash (US3 #4, OD-3); the main window's drop zone adds to *My files* too
- [ ] T063 [P] [US3] `tests/ui/score-browser/my-files.test.ts`: *Open file...* button and file input with `accept=".musicxml,.xml,.mxl"` emit `browseropenfile`; a drop onto the dialog shows a highlight and emits `browseropenfile`; file rows show the title with the file name beneath, or the file name alone (US3); a row with `stored: false` shows "file not stored"; the detail pane's remove confirmation offers the two choices inline and no blocking dialog; earlier-version results are labelled "Earlier version of this file"
- [ ] T064 [P] [US3] `tests/e2e/score-browser.spec.ts` (US3 block): the Independent Test (a Play run on `tests/fixtures/musicxml/engraving/fur-elise-bare.musicxml` with the fake keyboard, reload, one-click reopen); reopening from disk, no duplicate; a `.musicxml` file with invalid content dropped onto the browser -> message, browser open, *My files* unchanged; remove with undo

### Implementation

- [ ] T065 [P] [US3] `src/core/progress/user-files.ts` (`fileKey`, `nextEntry`, `entryProgress`) and file rows plus the *My files* folder in `buildBrowserItems` (T059)
- [ ] T066 [US3] The *My files* half of the port in `src/engine/ports.ts` (`listFiles`, `putFile`, `getFileBytes`, `removeFile`, completing `contracts/progress-store.md` section 1) and in both adapters `src/engine/storage/memory-progress-store.ts` and `src/engine/storage/indexeddb-progress-store.ts`, with budget eviction (T060)
- [ ] T067 [US3] *My files* part of `src/engine/storage/progress-migration.ts` and `removeMigratedLibraryCopies`, called once by the controller after the index loads (T061)
- [ ] T068 [US3] Controller and session: `src/app/browser-session.ts` `openFile(file)` / `openItem(file ref)` / `removeFile` with the deferred commit; `src/app/session.ts` `loadBytes` calls `putFile` after a successful load instead of `scoreStore.put`, with the `opened` event `as: { kind: 'file', fileKey }`; `session.ts` stops writing `recentScores` and unmounts `mx-recent-list` (its reopen and remove flows are now *My files*, T062); `openFile` from `mx-drop-zone` takes the same path; the invalid-file message goes to the browser's message line when the browser is open, otherwise to the existing load error view (T062)
- [ ] T069 [US3] UI: *Open file...* and drop handling in `mx-score-browser.ts`, file rows and the remove flow in `mx-browser-list.ts` / `mx-browser-detail.ts`, strings in `en.ts` (T063)
- [ ] T070 [US3] Manual check against quickstart US3 steps 1-5 (`pnpm dev` in the built-in browser or scripted Playwright in the scratchpad, plus `pnpm screenshot --browser` of *My files*); name the pictures in the log

**Checkpoint**: US3 Independent Test passes (T064); US1 and US2 still pass; full gate green; log entry; commit.

---

## Phase 6: User Story 4 - Continue where I left off (Priority: P2)

**Goal**: the browser opens on *Continue* with the recent items and a *Suggested next* step.
**Independent Test**: Master the *Introduction* step of *C major*, open the browser - *Continue* shows that item first
among recent items and suggests the *Beginner* step of *C major*; opening the suggestion needs one click.

### Tests (write first, confirm they fail)

- [ ] T071 [P] [US4] `tests/core/progress/suggest.test.ts` over the real library index: `continueItems` lists up to `CONTINUE_ITEMS_MAX` by `lastOpenedAt` newest first and skips records whose item no longer exists (US4 #1); `suggestNext`: an unmastered recent stepped item -> `continue` it (US4 #2); mastered *C major - Introduction* -> *C major - Beginner*; mastered *Beginner* with *Introduction* never played -> *Intermediate* (not back to *Introduction*); mastered *Advanced* -> the folder's first unmastered song; everything in *C major* mastered -> the next key folder's first unmastered main step, skipping a fully mastered folder; extras (`stepOrder` >= 10) never suggested as next; `morePractice` after `MORE_PRACTICE_AFTER_RUNS` whole complete runs without *Mastered*; most recent item not stepped -> the most recent stepped one in history; no history -> `firstSteps` with the first key folder's first main step and the *Repertoire > Beginner* section id (US4 #3) (R-10)
- [ ] T072 [P] [US4] `tests/ui/score-browser/continue.test.ts`: `mx-browser-continue` renders the recent cards with status, best and "last played ..." text, the *Suggested next* card with its reason, the optional *More practice* card, and the welcome with a link that selects *Repertoire > Beginner*; activating a card emits `browseropenitem` (one action)
- [ ] T073 [P] [US4] `tests/e2e/score-browser.spec.ts` (US4 block): the Independent Test with the mastering result seeded through `e2e-progress-seed` (`tests/fixtures/progress/c-major-intro-mastered.json`) and, separately, through one real mastering Play run with the fake keyboard; a fresh profile opens on *Continue* with the welcome; SC-001's second half: from a loaded Score, a recently opened item opens in 2 actions (Open, then its *Continue* card) when the last view was *Continue* (analyze A5)

### Implementation

- [ ] T074 [US4] `src/core/progress/suggest.ts` (`continueItems`, `suggestNext`, `morePractice`) (T071)
- [ ] T075 [US4] `src/ui/elements/mx-browser-continue.ts`, shown when the folder is *Continue* and search is empty; the default folder is *Continue* (data-model section 7); strings in `en.ts` (T072)
- [ ] T076 [US4] Manual check: `pnpm screenshot --browser --seed-progress tests/fixtures/progress/c-major-intro-mastered.json` and one with no progress; look at them against quickstart US4 and name them in the log

**Checkpoint**: US4 Independent Test passes (T073); US1-US3 still pass; full gate green; log entry; commit.

---

## Phase 7: User Story 5 - Find the right thing fast (Priority: P3)

**Goal**: filters, sorts and chips across the browser, and the complete keyboard and screen-reader model.
**Independent Test**: Filter *Status: played, not mastered* and sort *Best result, lowest first* - the list shows
exactly those items in ascending order of best result; operate the whole flow from opening the browser to opening a
Score without touching the pointer.

### Tests (write first, confirm they fail)

- [ ] T077 [P] [US5] `tests/core/browser/query.test.ts` (extend): filters level, key, tag and every `StatusFilter` combine with AND (US5 #1: key G major + status New lists only never-attempted G-major items); sort by `lastPlayed` and `best` in both directions, items without a best last in both, ties in library order; `best` ascending gives the "needs work" order of the Independent Test
- [ ] T078 [P] [US5] `tests/core/browser/query-timing.test.ts` (SC-003 core budget): `buildBrowserItems` + `queryBrowser` over `libraryIndexOf(500)` with 10,000 results (20 per record) for folder, search and filter changes each take <= 20 ms (median of 5 runs after one warm-up)
- [ ] T079 [P] [US5] `tests/ui/score-browser/filters.test.ts`: filter controls for level, key, skill and status; each active filter appears as a removable chip, *Clear all* clears them (US5 #1); no match shows "No items match these filters" and *Clear filters* (US5 #2); the sort control offers library order, title, last played and best result in both directions (FR-027)
- [ ] T080 [P] [US5] `tests/ui/score-browser/keyboard.test.ts`: `/` focuses search (not while typing in a field); Escape clears a non-empty search, then closes; rail APG tree keys (Up/Down/Right/Left/Home/End/Enter) with roving `tabindex`; list Up/Down/Home/End/PageUp/PageDown move the active row and the detail follows; Tab order search -> filters -> sort -> rail -> list -> detail -> close, cyclic; the `aria-live` line announces "{n} items" (debounced by `BROWSER_ANNOUNCE_DEBOUNCE_MS`) and status changes (FR-028)
- [ ] T081 [P] [US5] `tests/e2e/score-browser.spec.ts` (US5 block): the Independent Test (seeded mixed progress; asserts exact rows and order); the keyboard-only flow from the *Open* button to an open Score with `page.keyboard` only, focus visible at every step, and focus back on *Open* after closing (US5 #3)

### Implementation

- [ ] T082 [US5] `queryBrowser` filters and sorts in `src/core/browser/query.ts` (T077, T078)
- [ ] T083 [US5] Toolbar in `mx-score-browser.ts`: filter controls, chips, *Clear all*, sort control, empty-state *Clear filters*; strings in `en.ts` (T079)
- [ ] T084 [US5] Keyboard and announcements in `mx-score-browser.ts`, `mx-browser-rail.ts` and `mx-browser-list.ts` (T080)
- [ ] T085 [US5] Manual check: quickstart US5 steps 1-3 (filter + sort picture with `pnpm screenshot --browser --seed-progress ...`, keyboard-only run in the built-in browser or scripted Playwright); name the pictures in the log

**Checkpoint**: US5 Independent Test passes (T081); US1-US4 still pass; full gate green; log entry; commit.

---

## Phase 8: Polish & Cross-Cutting

- [ ] T086 [P] SC-002 and SC-003 in the e2e browser (`tests/e2e/score-browser-timing.spec.ts`): *Open* -> dialog open and first list rows painted <= 300 ms with the full library and 200 seeded *My files* entries; folder, search and filter changes <= 100 ms with 500 items (the 181 library items plus 319 seeded *My files* entries, analyze A10) and 10,000 results (measured with `performance.now()` around the action and a `requestAnimationFrame` after the render; median of 5); log the measured values
- [ ] T087 [P] Real files and the library (AGENTS.md "check behaviour on real files"): open three files from `tests/fixtures/musicxml/real` through *Open file...* and every library folder through the rail in one e2e pass (`tests/e2e/score-browser.spec.ts`), with no load failure the old panel did not also have; log the result
- [ ] T088 [P] Electron (FR-031, after T094): extend `tests/e2e/electron-smoke.spec.ts` to open the browser, open a library item and see a progress record written after an `e2e-progress-seed` (same code path as the browser Shell)
- [ ] T095 [P] SC-006 second half (analyze A9): `tests/e2e/score-browser-memory-store.spec.ts` starts the app with `window.indexedDB` removed by a Playwright init script; the US1 Independent Test and one recorded result pass on the memory store and the notice "Progress will not be kept on this device" is shown; `tests/architecture/progress-store-usage.test.ts` asserts that no file outside `src/engine/storage` and the store choice in `src/app/browser-session.ts` names `IndexedDbProgressStore` or `MemoryProgressStore`
- [ ] T089 (OD-5) SC-007: `tests/e2e/score-browser-a11y.spec.ts` runs axe (`@axe-core/playwright`, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) on the browser in each view (Continue, a folder, search results, detail with history, My files, remove confirmation, narrow width) and expects zero violations; fix what it finds
- [x] T096 Pre-existing gap found live migrating `tests/e2e/piano-keyboard.spec.ts` for T032: `mx-app`'s bar-fold
  (`fitBar()`, `src/ui/elements/mx-app.ts`) did not fit the bar's contents even in `.mx-bar-compact` mode once a
  Score is loaded at <= ~800px width (measured live: 1009px of content in 799px, `layout.css`'s compact rules). No
  prior test caught it because every narrow-width case opened a bar menu before loading a Score (less content, no
  overflow) - FR-001 now makes the browser modal block that ordering (the menu is behind it until a Score is open),
  so `tests/e2e/piano-keyboard.spec.ts`'s 800x600 case was the first to open a menu afterwards; the resulting
  overflow made the focused "View" menu button sit past the viewport edge, and the browser's own
  focus-follows-scroll auto-scrolled `mx-app` (a valid, if `overflow: hidden`, scroll container) sideways, which is
  what the test's key-position assertions caught. `tests/e2e/helpers/panels.ts`'s `barFitted()` now also accepts
  "folded already" as settled, not only "fits", so it does not hang forever on an unreachable exact fit. Root cause
  fixed per owner decision (2026-09-27): `layout.css`'s "relocate mode-controls/size-controls to the View popup"
  rule, previously phone-only (`max-width: 480px`), widened to `max-width: 900px` - the same already-built
  relocation (`mx-view-panel.ts` already carries a second `mx-mode-switch`/`mx-size-controls`) now also covers the
  ~800-900px band a loaded Score's full bar content needs it at; verified live (`mx-app.scrollWidth` 1009px -> 800px
  at 800x600, no residual auto-scroll, all 88 keys back on screen)
- [ ] T090 Full `quickstart.md` manual verification with screenshots (every story), naming each picture in the log; SC-008 is the owner's own 5-person check: write down the exact steps and the seed to use in the log under "needs owner: SC-008 run", and never mark it done without the owner's result
- [ ] T091 Constitution review of the branch diff with the `constitution-auditor` agent; findings summarised in the log and fixed or turned into tasks
- [ ] T092 (OD-6) Remove the retired code and its tests: `src/ui/elements/mx-library.ts`, `src/ui/elements/mx-recent-list.ts`, `src/engine/storage/indexeddb-score-store.ts`, the `ScoreStore` port and `RecentScoreSummary` in `src/engine/ports.ts`, `RECENT_SCORES_MAX`, the panel-only parts of `src/ui/state/libraryState.ts` and `scoreState.setRecent`, `tests/ui/mx-library.test.ts`, `tests/ui/mx-library-filters.test.ts`, `tests/ui/open-and-recent.test.ts`, `tests/engine/storage/indexeddb-score-store.test.ts` and the old-panel parts of `tests/e2e/library.spec.ts`, only after T032's assertion mapping shows each covered; `ports.md` records the removal (1.5.0 -> 2.0.0, MAJOR)
- [ ] T093 Docs: `README.md` (how to find Scores, My files, progress), `docs/agents/reference.md` (R7 screenshot flags, Active Technologies "implemented"), `specs/001-score-viewer-listen/contracts/storage.md` final index check, `quickstart.md` commands; full gate `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` (the known-flaky Electron specs re-run alone per R7 and both results logged) green with summary lines in the log

## Dependencies & Execution Order

- Setup (T001-T008) -> Foundational (T009-T012) -> US1 (T013-T034) -> US2 (T035-T058) -> US3 (T059-T070) -> US4
  (T071-T076) -> US5 (T077-T085) -> Polish (T086-T093).
- T001 is done (all owner decisions approved); the (OD-n) tasks implement the approved answers.
- T068 unmounts `mx-recent-list` only together with *My files* (T031 keeps it until then).
- US2 needs US1's browser and controller (T026-T031). US3 needs US2's store (T052) and item progress (T053). US4 needs
  US2's `opened` events and records (T054) and uses US3's file refs for file items (T065). US5 needs US1's elements and
  US2's status for the status filter.
- Within US1: T021-T023 before T024; T024 before T026-T028; T030 before T031; T031 before T032-T034.
- Within US2: T049 -> T050 -> T052 -> T053/T054; T051 before T054; T056 after T053; T057 after T054 and T056; T094
  after T054 and before T048, T058, T073 and T086-T088.
- Within US3: T065 and T066 before T068; T067 after T066; T069 after T068.
- T078 (timing) must stay green after every later change to `src/core/browser`. T086 and T089 need all stories done.
- T092 needs T032's mapping and OD-6 approved. T093 is last.


## Parallel Opportunities

- Setup: T003, T004, T005, T006 and T007 together; T002 alongside them.
- Foundational: T009, T010 and T012 together; then T011.
- US1 tests T013-T020 together; then T021, T022, T023 and T025 in parallel; T027 and T028 in parallel after T026.
- US2 tests T035-T048 together; T049, T051 and T055 in parallel.
- US3 tests T059-T064 together; T065 alongside T066.
- US4 tests T071-T073 together.
- US5 tests T077-T081 together.
- Polish: T086, T087, T088 and T095 together.
