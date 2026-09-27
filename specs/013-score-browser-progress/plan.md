# Implementation Plan: Score browser with progress

**Branch**: `013-score-browser-progress` | **Date**: 2026-09-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/013-score-browser-progress/spec.md`

## Summary

Replace the side *Scores* panel's library tree and 10-item *Recent* list with one **Score browser**: a near-full-screen
modal `<dialog>` (outside sessions only) with a folder rail (*Continue*, *All*, the library's section tree, *My
files*), an item list and a detail pane. Every item shows its **progress**: a status badge (*New*, *Practised*,
*Played*, *Mastered*; shape + colour + text), its best and last result, and the trend. Folders show "5 of 8 played, 2
mastered". The user's own files are kept under *My files* with their progress and a stored copy for one-click
reopening.

Approach (research R-1 to R-21):

1. **Progress is its own record, changed only by events.** A pure core reducer (`src/core/progress`) folds `opened`,
   `practised`, `played`, `resultRemoved` and `reset` events into a per-Score record keyed by the content hash. The
   record holds best, last, previous, attempts, *Mastered* and the last 20 results. Best and counts survive trimming
   of stored attempts, and the rules are Node-tested, including the SC-004 property test.
2. **One storage boundary.** A new `ProgressStore` port (progress + *My files* + file copies) has an IndexedDB adapter
   (database version 3, four new stores, lazy one-shot migration from the old `recentScores` and `performances`) and a
   memory adapter. The memory adapter is used by the shared contract test suite (SC-006) and as the run-time fallback
   when IndexedDB is unavailable. Events are idempotent and records carry `format` + `updatedAt`, so a server adapter
   can come later (FR-029/FR-030).
3. **Fair, explainable rules.** A result is the Grade's own two figures (FR-009). Best is compared exactly (integer
   cross-multiplication). Best and *Mastered* count only whole-Score, all-hands runs (**OD-1**). *Mastered* needs
   >= 90 % correct, >= 80 % on time and >= 100 % tempo, plus an extra-notes limit (**OD-2**). All thresholds are
   named constants.
4. **Pure browser model.** `src/core/browser` builds rows from the library index, *My files* and progress, and does
   search, filters, sort, folder summaries and *Suggested next*. The custom elements only render (Principle V). There
   is no virtualisation. Budgets are measured (SC-002/SC-003).
5. **Wiring.** A `BrowserSessionController` (`src/app/browser-session.ts`, Node-testable like `LibrarySessionController`)
   records events at the existing points (Score loaded, Practice reached the end or completed a loop, attempt stored
   or deleted). It detects "New best" for the grade panel and owns the deferred-commit undo. The Score identity no
   longer depends on a stored copy (R-3).

No change inside `AudioWorklet.process()`, the scheduler, MIDI timing or grading formulas.

## Technical Context

**Language/Version**: TypeScript 7 (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), HTML5, CSS3;
no UI frameworks
**Runtime Dependencies**: none new. Test-only: `@axe-core/playwright` 4.13.0 (MPL-2.0) for SC-007, pending **OD-5**
**Storage**: IndexedDB `musicanyya` version 2 -> **3** (`progress`, `userFiles`, `userFileBytes`, `meta`; `recentScores`
read once by the migration, `performances` unchanged plus an optional `complete` field); `localStorage`
`musicanyya.browser.v1` (browser view state, replaces `musicanyya.library.v1`); library bytes stay in Cache Storage
(`musicanyya-library-v1`)
**Testing**: Vitest. Core in Node: reducer, comparisons at integer boundaries, scope, status, trend, suggestions, query
and folder summaries, and the SC-004 property test over random histories with trimming and removals. Engine: the
`ProgressStore` contract suite on both adapters (fake-indexeddb), migration from a version-2 database, fault
injection. App: `BrowserSessionController` with fakes (`tests/engine/browser-session.test.ts`). UI in happy-dom: dialog, rail/list/detail, keyboard,
announcements. Playwright e2e: US1-US5 flows, reload (SC-005), narrow widths, timings (SC-001 to SC-003), keyboard-only
flow, and axe (SC-007, OD-5).
**Shells / Delivery Targets**: browser and Electron (same build; IndexedDB and `<dialog>` behave identically in
Electron 44's Chromium, FR-031); Native audio plugin not involved
**Target Browsers**: latest 2 Chrome + Edge (reference); Firefox; Safari = view + Listen only (no Web MIDI). The browser
and progress work in all of them (`<dialog>` Baseline 2022; `content-visibility` degrades gracefully)
**Performance Goals**: browser visible <= 300 ms after *Open* with the full library + 200 files (SC-002); list update
<= 100 ms for 500 items / 10,000 results (SC-003; the core query is budgeted at <= 20 ms in Node); no main-thread task
> 50 ms while a session runs (the browser is closed during Play/Practice sessions, and progress writes are small
async IndexedDB transactions after a run)
**Real-time Paths Touched**: none. The Practice matcher gains a pure `loopCompleted` effect (core, not an RT path). The
Listen pause on open uses the existing transport command.
**Constraints**: core stays DOM-free; the store never throws; a single unreadable record never blocks the browser;
nothing modal during a session (the browser cannot open during Play/Practice, and a run start closes it); every
threshold is a named constant; UTF-8 without BOM
**Scale/Scope**: 181 library items in 49 sections today (design target 500 items); up to hundreds of *My files*
entries within a 100 MiB copy budget; 20 results per record (10,000 results at 500 items)

## Constitution Check

*GATE: must pass before Phase 0 research; re-check after Phase 1 design.* Re-checked after Phase 1: **PASS**, no
violations. The one addition (a test-only dev dependency) is recorded in Complexity Tracking and waits on OD-5.

| # | Principle | Question | Status |
|---|---|---|---|
| I | Real-Time Safety (Web and Native) | New code in AudioWorklet/plugin callbacks allocation-, await- and log-free? Sounds scheduled ahead on the audio clock (no timers)? Heavy work off the main thread? | [x] No RT code changes. The undo timer (R-12) and the announcement debounce are UI-only and decide no sound. Progress writes happen after a run's Grade, as async IndexedDB transactions with a small synchronous reducer (O(20) per event). The browser query is O(n log n) on <= 500 rows, measured, and never runs during a session. |
| II | One Clock, Measured Latency | All events on the audio-clock timeline, MIDI timestamps mapped onto it? Integer ticks in core? Latency compensated? Tolerances named & configurable? | [x] Timing and grading are untouched: results are copied from the stored Grade summary (FR-009). Every mastery threshold, limit and budget is a named constant (data-model.md sections 4 and 11), and thresholds are passed as a `MasteryThresholds` value so tests and later settings can change them. |
| III | Score Fidelity, Engraving & Note Identity | Canonical score model + Note IDs (= SVG ids)? Verovio engraving? Unsupported MusicXML degrades gracefully? | [x] Unchanged load path (FR-005): library items, *My files* and dropped files all go through `Session.loadBytes`. Invalid files show the existing load error inside the browser and add nothing (US3 #5). Score identity = content hash, the same key already used by Note-ID-keyed attempts. |
| IV | Test-First Core, Deterministic Grading | Tests first? Core testable in Node with fakes? Golden tests for grading? | [x] All rules are pure core functions, written test-first. SC-004 is a deterministic property test (seeded). The store contract suite runs on two adapters (SC-006). Grading is untouched, so no golden change. Migration is tested from recorded version-2 fixtures. |
| V | Layered, Framework-Free, Platform-Agnostic | No UI frameworks? core has no DOM/Web APIs? Platform features behind ports? Browser works without Electron/plugin? Electron secure defaults? Device loss recoverable? | [x] Custom Elements + native `<dialog>`, no framework. `src/core/progress` and `src/core/browser` have no DOM or Web APIs. Storage sits behind the new `ProgressStore` port (IndexedDB + memory adapters; a server adapter later changes nothing else, FR-029). The UI computes no status or grade: it renders core output. Browser Shell and Electron are identical (FR-031). |
| VI | Musician-First Feedback | Colour + shape, nothing modal during a session, explainable results, overlays never hide notes? | [x] Badges and trend use shape + colour + text (R-16, greyscale screenshot check). The modal browser is impossible during Play/Practice sessions, and a run start closes it (R-1, R-2). Listen is paused, not interrupted. Results are the grade panel's own two figures, with tempo, scope and strictness shown (R-8). *Mastered* thresholds are shown in the detail pane. Confirmations are inline with undo, never blocking. |
| VII | Pedagogy as Data | Advice as schema-validated JSON anchored to Note IDs/measures? Invalid entries skipped, not fatal? | [x] No Advice change. *Suggested next* derives from existing library content data (`step`, `stepOrder`, section order), not from code tables (R-10). |
| VIII | Simplicity, Web-First Delivery | P1 is a usable MVP? Web APIs before libraries? New runtime deps justified below? | [x] P1 (US1 + US2) alone replaces the cramped panel and shows progress. Web APIs only (IndexedDB, `<dialog>`, Custom Elements, `Intl`). No runtime dependency. The memory adapter is needed by SC-006 and doubles as the storage-unavailable fallback, so it is not speculative. Retired code is removed rather than kept (OD-6). |

## Owner decisions (asked once; the plan assumes the recommendation)

| Id | Decision | Recommendation | If declined |
|---|---|---|---|
| OD-1 | Best and *Mastered* count only runs over the **whole Score with all staves** of the part. Bar-range and one-hand runs count for *Played*/attempts and show in history, labelled. | Yes (music-domain expert, R-7) | FR-010/FR-024 read literally: any complete run counts, so a right-hand-only 100 % masters a two-hand piece. |
| OD-2 | *Mastered* also needs **extra notes <= 10 %** of the notes total (`MASTERY_MAX_EXTRA_PERCENT`). This closes key-mashing, since extras are in neither figure. Spec FR-024 gains this condition. | Yes | The constant is `null`, and the condition is off. |
| OD-3 | **Reset progress** and **Remove file and progress** also delete that Score's stored attempts and recordings (after the undo window). | Yes (R-12) | Attempts stay in the attempts list while the progress says *New*, and SC-004 is measured from the reset on. |
| OD-4 | **Deleting one attempt** (003 attempts list) removes it from progress too. Best/*Mastered* are recomputed from the kept results. | Yes (R-12) | Progress keeps it (a deleted run can remain the best). |
| OD-5 | Add dev dependency **`@axe-core/playwright` 4.13.0** (MPL-2.0; test only, ships nothing) for SC-007's WCAG 2.1 AA check. | Yes (R-14) | SC-007's automated part cannot be met. It needs a spec change or a manual audit. |
| OD-6 | **Delete** the retired files (not created by this feature): `src/ui/elements/mx-library.ts`, `mx-recent-list.ts`, `src/engine/storage/indexeddb-score-store.ts`, the `ScoreStore` port, their tests and the panel-only parts of `libraryState.ts`. | Yes (R-20) | They stay unused and marked deprecated, and the dead code is left in the repository. |

Also reported (no decision needed for 013): 003 FR-008's wording ("covering exactly the expected notes up to the
stopping point") differs from the code, which grades all notes and marks the rest *missed* (R-6).

## Project Structure

### Documentation (this feature)

```text
specs/013-score-browser-progress/
|-- spec.md              # /speckit.specify (+ clarifications)
|-- plan.md              # this file
|-- research.md          # Phase 0: R-1 .. R-21
|-- data-model.md        # Phase 1: result, progress record + reducer, My files, rows, view state, suggestions
|-- quickstart.md        # Phase 1: commands + manual verification per story
|-- contracts/
|   |-- progress-store.md     # ProgressStore port 1.0.0, IndexedDB v3 stores, migration, contract suite
|   |-- score-browser.md      # element structure, events, keyboard, open/close rules 1.0.0
|   `-- contract-changes.md   # bumps to 001 ports/storage, 002 practice-session, 003 performance-log, 004 ui-shell, 005 library-port, 009 play-display
|-- checklists/requirements.md
`-- tasks.md             # /speckit.tasks (NOT created here)
```

### Source Code (repository root)

```text
src/core/
|-- defaults.ts                    # + MASTERY_*, PROGRESS_*, CONTINUE_ITEMS_MAX, MORE_PRACTICE_AFTER_RUNS, USER_FILE_VERSIONS_MAX
|-- progress/                      # NEW, pure
|   |-- types.ts                   # ProgressResult, ResultScope, ProgressRecord, ProgressEvent, ItemRef, MasteryThresholds
|   |-- compare.ts                 # compareResults, percentShown, atLeast, bestEligible, masteryEligible
|   |-- scope.ts                   # resultScope(score, settings), scopeFromStoredSettings (legacy)
|   |-- reduce.ts                  # applyProgressEvent
|   |-- status.ts                  # deriveStatus, trend
|   |-- from-performance.ts        # resultFromStoredPerformance (migration + live recording)
|   |-- user-files.ts              # fileKey, nextEntry (new / same / new version), entryProgress
|   `-- suggest.ts                 # continueItems, suggestNext, morePractice
|-- browser/                       # NEW, pure
|   |-- types.ts                   # BrowserItem, BrowserViewState, FolderSel, StatusFilter
|   |-- items.ts                   # buildBrowserItems (library + files + records, supersedes merge)
|   |-- query.ts                   # queryBrowser (folder, search folding, filters, sort)
|   |-- folders.ts                 # folderProgress over buildSectionTree
|   `-- view-state.ts              # validateViewState, seedFromLibraryFilter
|-- practice/matcher.ts            # + loopCompleted effect (R-9)
|-- practice/types.ts              # + PracticeEffect variant
`-- grade/types.ts                 # StoredPerformance.complete?: boolean
src/engine/
|-- ports.ts                       # + ProgressStore, ProgressStoreResult; PerformanceStore.removeByScore; ScoreStore deprecated
|-- config.ts                      # + USER_FILES_BYTES_BUDGET, UNDO_WINDOW_MS, BROWSER_SEARCH_MAX_CHARS
`-- storage/
    |-- db.ts                      # DB_VERSION 3, new stores, onversionchange
    |-- indexeddb-progress-store.ts   # NEW
    |-- memory-progress-store.ts      # NEW (tests + fallback)
    |-- progress-migration.ts         # NEW, lazy one-shot migration + migrated-library cleanup
    `-- indexeddb-performance-store.ts  # + removeByScore
src/app/
|-- browser-session.ts             # NEW BrowserSessionController (events, new best, undo, fallback, library cleanup)
|-- session.ts                     # wire browser + controller; scoreId = contentHash; Open -> browser; stop writing recentScores
|-- play-session.ts                # store `complete`; notify controller after store
`-- library-session.ts             # openItem returns the item for `opened` (as: library ref)
src/ui/
|-- elements/
|   |-- mx-score-browser.ts        # NEW dialog shell, search, toolbar, file input, drop
|   |-- mx-browser-rail.ts         # NEW tree + folder summaries
|   |-- mx-browser-list.ts         # NEW listbox rows
|   |-- mx-browser-detail.ts       # NEW detail, history, actions, inline confirmations
|   |-- mx-browser-continue.ts     # NEW Continue + Suggested next cards
|   |-- mx-status-badge.ts         # NEW badge (shape + colour + text)
|   |-- mx-open-button.ts          # opens the browser (file input moves into the browser)
|   |-- mx-grade-panel.ts          # "New best"
|   `-- mx-score-source.ts         # formatter shared with the detail pane
|-- format/result-text.ts          # NEW: figures, tempo, scope, relative dates
|-- state/browserState.ts          # NEW session state + persisted view state
|-- state/playState.ts             # + newBest
|-- state/runGuard.ts              # also closes the browser on Play/Practice start
|-- layout/menu-model.ts           # Score menu: Open..., About this score, attempts
|-- i18n/en.ts                     # browser strings, statuses, tooltips, notices
`-- styles/browser.css             # NEW; tokens.css + status colours
tools/dev/screenshot.ts            # --browser, --seed-progress; closes the start-up browser otherwise
tests/
|-- core/progress/*.test.ts, core/browser/*.test.ts
|-- engine/storage/progress-store.contract.ts + memory-/indexeddb-progress-store.test.ts + progress-migration.test.ts
|-- engine/browser-session.test.ts   # app controllers are tested in the Node engine project, like session-library.test.ts
|-- ui/score-browser/*.test.ts
|-- fixtures/progress/*.json       # seeds for e2e/screenshots (mixed statuses, c-major-intro-mastered, 200 files, 500 items)
`-- e2e/score-browser.spec.ts (+ helpers/browser.ts; existing specs switch to helpers.openScoreFile)
```

**Structure Decision**: all four layers are touched, inward-only. The rules live in two new pure core modules. The
storage boundary is one new port with two adapters. The browser session controller sits in `src/app` next to the
existing library and play controllers, so `session.ts` only forwards. The UI adds one dialog made of small elements.
Existing e2e specs change only in how they open a file (the browser now covers the empty start); the risk and the
helper are in R-20.

## Complexity Tracking

| Violation / Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Dev dependency `@axe-core/playwright` 4.13.0 (+ `axe-core`), MPL-2.0, test only (**OD-5**) | SC-007 requires an automated check reporting no WCAG 2.1 AA violations | Hand-written assertions cannot establish "no WCAG 2.1 AA violations". Lighthouse is larger and uses axe internally. Nothing ships to users. |
| IndexedDB schema 2 -> 3 with a data migration | FR-017 (earned results kept), FR-020 (file copies), FR-015 (progress survives trimming) | Deriving progress from Performances on each open loses bests after trimming. Keeping `recentScores` as *My files* mixes library items in and caps it at 10. |

## Phase 0: Research

Done: [research.md](research.md) R-1 to R-21. There are no remaining NEEDS CLARIFICATION items. The six owner
decisions above refine behaviour; the plan assumes the recommendations.

## Phase 1: Design

Done: [data-model.md](data-model.md), [contracts/progress-store.md](contracts/progress-store.md),
[contracts/score-browser.md](contracts/score-browser.md), [contracts/contract-changes.md](contracts/contract-changes.md),
[quickstart.md](quickstart.md). `docs/agents/reference.md` Active Technologies and Recent Changes are updated.
Constitution Check re-evaluated after design: **PASS**.

Next: `/speckit.tasks`.
