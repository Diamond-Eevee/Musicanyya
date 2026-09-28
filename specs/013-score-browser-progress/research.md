# Research: Score browser with progress

**Feature**: `013-score-browser-progress` | **Date**: 2026-09-27 | **Plan**: [plan.md](plan.md)

Each entry: **Decision**, **Rationale**, **Alternatives considered**. Facts about the existing code were checked in the
repository on 2026-09-27 (file and line named where it matters). The music-domain questions (R-7 to R-10) were put to
the `music-domain-expert` role; its answers are summarised in those entries.

---

## R-1 The browser window: a modal `<dialog>`, not a popover panel

**Decision**: `mx-score-browser` renders a native `<dialog>` opened with `showModal()`. It covers the window minus a
margin (`inset: var(--browser-margin)`, 24 px at >= 1024 px, 0 below 768 px). Escape is the dialog's own `cancel` event.
A click outside means a click whose target is the `<dialog>` element itself (the backdrop area). The `closedby`
attribute is not used. Focus goes to the search field on open and returns to the invoking *Open* control on close.

**Rationale**: the spec asks for a near-full-screen window with keyboard focus inside it (US1 #1, FR-028, SC-007).
`showModal()` provides focus containment, an inert background, a `::backdrop` and top-layer stacking, all without
code. Principle VI forbids modal UI *during an active session* only. FR-007 keeps the browser closed during Play runs
and Practice sessions (R-2), so a modal browser never meets a session. `<dialog>`/`showModal()` has been Baseline
since March 2022 (Chrome 37, Firefox 98, Safari 15.4). `closedby` is newer and not in every target browser, so the
backdrop click is handled in code. happy-dom 20 implements `HTMLDialogElement.showModal()/close()`
(`node_modules/happy-dom/lib/nodes/html-dialog-element`), so unit tests can drive it. Playwright covers the native
inertness.

**Alternatives considered**: `popover="auto"` in `mx-panel` like every other tool (feature 004). It has no focus
containment, and the background stays interactive behind a window covering 95 % of it. It also pulls the browser
into `viewState.openPanel`, whose run guard closes panels while Listen is *paused* (R-2). A hand-made overlay `<div>`
needs its own focus trap, inert handling and Escape handling, which re-implements `<dialog>`.

## R-2 Runs and the browser (FR-007)

**Decision**: the browser has its own open flag in `browserState`. It is not a `PanelId`.
- The *Open* control and its menu entry are disabled while a Play run (count-in, running) or a Practice session
  (waiting, blocked, interrupted) is active.
- Opening the browser while Listen is **playing** pauses the transport first (`transportState.pause()`). A paused
  Listen position is kept, and closing the browser without opening anything leaves it unchanged (US1 #3).
- `guardPanelsDuringRuns` (`src/ui/state/runGuard.ts`) also closes the browser when a Play run or Practice session
  starts. Listen *paused* does not close it.

**Rationale**: `isRunActive()` (`src/ui/state/runActive.ts`) is true for a paused Listen too (`canStop`). Reusing
`viewState.openPanel` would close the browser as soon as it paused Listen. FR-007 asks for exactly this split: pause
Listen, refuse Play and Practice.

**Alternatives considered**: stopping Listen when the browser opens. The spec says "pause", and closing without a
choice must leave the position unchanged. Allowing the browser during Practice was rejected by FR-007.

## R-3 Score identity = content hash, independent of the stored copy

**Decision**: the progress key (`scoreKey`) is the lowercase hex SHA-256 of the file bytes. That value is already
`contentHash` from the score worker (`src/workers/score.worker.ts:21`), the library index's `hash`
(`tools/library/build-index.ts:239`, same `hashFile`) and today's `scoreId` for Practice/Play settings and stored
Performances. From this feature on, `Session` sets `practiceScoreId = playScoreId = contentHash` whenever the progress
store is **available**. The value no longer depends on whether a copy of the bytes could be stored
(`session.ts:1481` today ties it to `scoreStore.put` succeeding).

**Rationale**: FR-020 keeps an entry and its progress when its file copy is dropped, so the identity cannot depend on
the copy. The hash gives "identical content under another name is the same Score" (Edge Cases) and library/user-file
equality for free. Library items were never meant to be copied into the user's store: the catalog already caches
their bytes (`musicanyya-library-v1`).

**Alternatives considered**: library item `id` as the key for library items. It breaks the "same content = same
Score" rule, and superseded items need hash links anyway (`supersedes[].hash`). A random entry id per user file does
not survive clearing storage and re-opening the file.

## R-4 Storage boundary: one `ProgressStore` port fed with events

**Decision**: a new port `ProgressStore` (`src/engine/ports.ts`, contract
[progress-store.md](contracts/progress-store.md) 1.0.0) owns progress records **and** *My files* entries and their file
copies. Progress is changed only through **events** (`opened`, `practised`, `played`, `resultRemoved`, `reset`),
never by writing a record directly:

```ts
apply(scoreKey: string, event: ProgressEvent): Promise<StoreResult<ProgressRecord>>;
```

The adapter reads the record, applies the pure core reducer `applyProgressEvent` (`src/core/progress/reduce.ts`) and
writes it back in **one** IndexedDB `readwrite` transaction. Events carry their own time and, for results, the
`runId`, so applying an event twice changes nothing (idempotent). Two implementations ship in `src/engine/storage/`:
`IndexedDbProgressStore` and `MemoryProgressStore`. One contract test suite runs against both (SC-006).

**Rationale**:
- FR-029/FR-030: a server adapter can send the same events to an API and merge records by `updatedAt`, with no change
  to the browser, grading or sessions. Idempotent events make a retry or a later sync safe.
- Two tabs (Edge Cases): IndexedDB serialises `readwrite` transactions on the same store, so a read-modify-write
  inside one transaction never loses another tab's attempt. The reducer is synchronous, which is allowed inside a
  transaction (no `await` of foreign promises).
- Principle IV: every progress rule is a pure, Node-testable function. SC-004 is a property test that folds the
  events of a recorded history.

**Alternatives considered**: recomputing progress from stored Performances on every open. It fails FR-015/US2 #5,
because trimming to 20 attempts loses the best. `update(key, fn)` with a callback is not serialisable to a server.
Records written directly by the UI would put the rules outside the core. A separate database per concern gains
nothing, and `db.ts` already centralises the upgrade.

## R-5 IndexedDB version 3 and a lazy, guarded migration

**Decision**:
- `DB_VERSION` 2 -> **3**. `upgradeMusicanyyaDb` creates only missing stores: `progress` (keyPath `scoreKey`, index
  `byLastOpened`), `userFiles` (keyPath `fileKey`, index `byLastOpened`), `userFileBytes` (keyPath `hash`) and `meta`
  (keyPath `key`). `recentScores` and `performances` are untouched.
- Building progress from older data (FR-017) is **not** done in `onupgradeneeded`. The first `IndexedDbProgressStore`
  operation checks `meta['progressMigration']` and, if it is missing, runs one `readwrite` transaction over
  `recentScores`, `performances`, `progress`, `userFiles`, `userFileBytes` and `meta`. The transaction builds the
  records (R-6), then writes the flag. A second tab waiting on the same transaction sees the flag and does nothing.
- Every connection sets `db.onversionchange = () => db.close()`, so a later upgrade is not blocked by this tab.

**Rationale**: an exception inside `onupgradeneeded` aborts the open, and the app would lose *all* storage.
A failed lazy migration only fails that transaction. It is retried at the next open and reported as a notice.
`onversionchange` is missing today (`db.ts`). Without it, an old tab left open blocks the upgrade (`onblocked` ->
`unavailable`). The new code cannot fix an old tab, but it stops the problem from recurring.

**Alternatives considered**: migrating in the upgrade handler (atomic, but brittle, see above). A second database for
progress, which would need cross-database consistency.

## R-6 What older data becomes

**Decision**:
- Every stored Performance becomes one `played` event with `result.complete = null` ("not recorded"). Its `scope` is
  `whole` when `settings.range === null` and `settings.selection.preset === 'both'`, otherwise `partial` (R-7). Events
  are applied oldest first, so best, last and previous are what a live history would have produced.
- Every `recentScores` record becomes a *My files* entry with its bytes and `origin: 'migrated'`. Its `lastOpened`
  becomes the progress record's `firstOpenedAt`/`lastOpenedAt` (with `openedAs` = that entry).
- Once the library index is loaded, migrated entries whose hash equals a library item's `hash` or one of its
  `supersedes[].hash` are removed from *My files* (bytes too). Their progress stays, keyed by the hash, so it shows on
  the library item. This happens once and is recorded in `meta['migratedLibraryCleanup']`. Feature 001-012 put library
  items into the same "recent" list.
- `StoredPerformance` gains an optional `complete: boolean`, written from now on (performance-log contract MINOR). An
  absent field means "not recorded".
- A result whose `complete` is `null` counts for *Played*, the attempt count, last/previous and **best**, but not for
  *Mastered*. History shows it as "stopped early: not recorded".

**Rationale**: a stopped run is graded against **all** expected notes of the run. Every note after the stop is
*missed* (`src/app/play-session.ts:127` builds `expected` once at `start()`, and `tests/e2e/us2-grade.spec.ts:64-89`
pins it). A stopped old run can therefore only have a lower notes-correct figure than it would have had complete. It
can win "best" only if it stopped in the last tenth of the piece, which honours "nothing already earned is lost" (US2
#7). Totals cannot tell complete from stopped (expert finding), so completeness is not reconstructed. *Mastered* did not
exist before, so nothing earned is lost by not granting it from unknown runs.

**Finding for the owner (not blocking)**: 003 FR-008 says a stopped run's Grade covers "exactly the expected notes up
to the stopping point". The code (and its e2e test) grades the full range and marks the rest missed. This feature
depends only on the code's behaviour. The 003 wording should be corrected separately.

**Alternatives considered**: "complete := total equals the expected count, checked when the Score is next opened".
Every old run has the full total, so this marks stopped runs complete (the expert's finding). Re-grading old runs is
equally blind, because the log has no end marker. Treating old runs as incomplete would lose earned bests (US2 #7).

## R-7 Which runs count for best and *Mastered*

**Decision** (expert recommendation; see **Owner decision OD-1** in plan.md):
- A result's **scope** is `whole` when the run covered the whole Score (`range === null`) **and** every staff with
  notes of the selected part. That is `preset: 'both'`, or any preset whose staves include every staff of that part
  that has notes (a one-hand piece's `right` counts). Otherwise the scope is `partial`. `resultScope(score, settings)`
  in `src/core/progress/scope.ts` computes it when the run is recorded, while the Score is loaded.
- **Best** (FR-010, FR-023): complete (or legacy `null`, R-6) **and** `whole`.
- ***Mastered*** (FR-024): complete (`true`), `whole`, `tempoPercent >= MASTERY_TEMPO_PERCENT_MIN` (100), notes
  correct >= `MASTERY_NOTES_CORRECT_MIN_PERCENT` (90), notes on time >= `MASTERY_NOTES_ON_TIME_MIN_PERCENT` (80),
  strictness at or above `MASTERY_MIN_STRICTNESS` (`beginner`, so any level), and, pending **OD-2**, extra notes <=
  `MASTERY_MAX_EXTRA_PERCENT` (10) of the notes total.
- Every run, including partial and stopped runs, counts for *Played* and the attempt count. Every run appears in history
  labelled with its scope ("Bars 5-8", "Right hand"), tempo and strictness. Accompaniment on/off does not matter.
- *Mastered* is sticky: once a mastering result is recorded it stays until the result is removed (R-12) or progress is
  reset. `masteredAt` records when.

**Rationale**: "best" and "mastered" should mean *the piece*. Hands-separate and sectional practice are normal steps,
not the goal (expert). Beginner strictness is already fair for the target musicians (on-time within 1/6 beat, capped at
180 ms), and 90 %/80 % is demanding. Extra notes are in neither figure (`GradeSummary.counts.extra`), so key-mashing
could inflate notes-correct. OD-2 closes that gap using a count the grade panel already shows, so no new number is
invented (FR-009).

**Alternatives considered**: any complete run counts (the spec text as written). A right-hand-only 100 % would then
"master" a two-hand piece. Requiring `standard` strictness would punish beginners the defaults are designed for
(Principle VI).

## R-8 Comparing and showing results

**Decision**:
- `compareResults(a, b)` orders by notes correct, then notes on time, then the later `finishedAt` (FR-023). It uses
  exact integer cross-multiplication (`a.count * b.total` vs `b.count * a.total`), never floats. 0 of 0 counts as 0
  and is shown as "-".
- Percentages are shown **rounded down** (`Math.floor(count * 100 / total)`), and thresholds compare
  `count * 100 >= threshold * total`. A shown "90 %" can therefore never sit next to "not mastered" for a 90 %
  threshold.
- Row text: "92 % correct · 85 % on time" plus tempo ("at 80 %" when below 100 %). The detail pane uses the grade
  panel's own strings ("{count} of {total} notes correct", "{count} of {total} played notes on time"). Tempo text
  reuses feature 012's `attemptTempo` where the Score tempo is known, and falls back to "80 % tempo".

**Rationale**: exact comparison makes SC-004 deterministic. Among eligible runs of one content version the totals are
equal, so ratio order equals count order (expert). Rounding down plus integer thresholds keep display and status
consistent (Principle VI: explainable).

**Alternatives considered**: comparing float percentages (ties become platform-dependent). Rounding to nearest ("89.6 %"
shown as 90 % but not mastered).

## R-9 *Practised* (FR-011)

**Decision**: a `practised` event is recorded when a Practice session **reaches the end of the Score naturally**
(`sessionEnded` with `reason: 'reachedEnd'`) or **completes one full pass through its loop by playing**. For the loop
case, the core practice matcher gets a new effect `{ type: 'loopCompleted' }`, emitted when the loop wraps after the
loop's last event was played. Skipping does not emit it. The practice-session contract gains this as a MINOR change.
The event records the bars (`fromMeasure`, `toMeasure`, 1-based written numbers) for the detail pane ("Practised bars
5-8, 3 Sep").

**Rationale**: the spec already counts a loop end. The expert agrees that sectional practice is how pieces are
learned, and *Practised* claims effort, not quality. Today the matcher wraps silently (`src/core/practice/matcher.ts`
~L322 `arriveAt(wrapTo)`), so the event is additive and pure.

**Alternatives considered**: end of Score only (it ignores the main way to practise). Counting any Practice start
(it claims too much).

## R-10 *Continue* and *Suggested next* (FR-025, US4)

**Decision**, pure in `src/core/progress/suggest.ts`:
- *Continue* lists up to `CONTINUE_ITEMS_MAX` (8) progress records with `lastOpenedAt`, newest first, each resolved to
  the browser item it was last opened as (`openedAs`). A record whose item no longer exists is skipped.
- *Suggested next*: take the most recent record whose item is in a **stepped folder** (a section whose items carry
  `meta.step`).
  - If that item is not *Mastered*: suggest continuing it (spec US4 #2).
  - Otherwise: in that folder, the first **main** step item (`stepOrder` 0, rank order introduction < beginner <
    intermediate < advanced) above the highest mastered main step that is not mastered.
  - After the advanced step: the first unmastered `song` of the folder.
  - Then the next key folder in library order (depth-first section order), at its first unmastered main step,
    skipping fully mastered folders.
  - Extras (`stepOrder` >= 10) are never on the main path. After `MORE_PRACTICE_AFTER_RUNS` (3) whole, complete runs
    on a main item without *Mastered*, the same step's first extra is offered as a second card, "More practice".
  - No history: the first main step of the first key folder, plus a pointer to *Repertoire > Beginner* (US4 #3).

**Implementation decisions (T074, 2026-09-28)**:
- A *main* step is a non-song item with `stepOrder` 0 (the convention of `checkStepOrder`); an *extra* is a non-song item
  with any other `stepOrder`; songs (`step: song`, `stepOrder` 10 in the shelf) are neither, and are offered after the
  last main step. So "extras are never suggested" cannot hide a song.
- "Above the highest mastered main step" ranks with `STEP_RANK`. Later folders start from their first unmastered main
  step, then their first unmastered song ("fully mastered" includes the songs).
- **Wrap-around** (not in the original rule): when nothing lies ahead, the search continues in the earlier folders and
  finally in the anchor's own folder from its start, so `none` means every stepped item is mastered and never "nothing
  after here".
- `More practice` looks at the most recent stepped item only, counts whole, `complete === true` results in its pooled
  history (at most `PROGRESS_RESULTS_MAX`), and offers the first not-yet-mastered extra of the same step.
- Only records with `lastOpenedAt` and `openedAs` count as history. A record made by migration from performances alone has
  neither and joins *Continue* once the item is opened again.
- The view: `showsContinue(view)` (`src/core/browser/query.ts`) decides that `mx-browser-continue` replaces `mx-browser-list`
  (the list stays rendered but `hidden`, so its row logic is unchanged).

**Rationale**: the spec rule, with the expert's refinements. "Lowest unmastered" would send a musician who skipped
Introduction back to it. Extras exist for a musician who is stuck, not for everyone. Step metadata already exists
(`Step`, `STEP_RANK`, `stepOrder`, `src/core/library/types.ts`).

**Alternatives considered**: a new "next" field in the library index. Rejected: the folder structure stays owned by
the content (spec Context), and the order is already derivable.

## R-11 *My files*: identity, versions and file copies (FR-019 to FR-022)

**Decision**:
- `fileKey` = the file name, Unicode NFC-normalised and lower-cased (`name.normalize('NFC').toLowerCase()`). The entry
  shows the latest spelling. Windows and macOS file names are case-insensitive, so "Etude.xml" and "etude.xml" are the
  same file to the musician.
- An entry keeps `hash` (current content) and `earlierHashes` (newest first, max `USER_FILE_VERSIONS_MAX` = 10).
  Opening a known name with a new hash moves the old hash into `earlierHashes` (FR-021). The entry's display progress
  combines several records (`entryProgress`, pure): status, best and *Mastered* come from the current hash only; the
  history lists results of all versions, those from earlier hashes marked "earlier version of this file"; the attempt
  count is the sum.
- File bytes live in `userFileBytes`, keyed by hash, so identical content under two names is stored once. The total
  is capped at `USER_FILES_BYTES_BUDGET` (100 MiB). When a new copy would exceed it, the copies of the least recently
  opened entries are dropped first (their entries stay, marked "file not stored"). A single file larger than the
  budget, or a `QuotaExceededError`, leaves only the entry (US3 #3). Opening the same name from disk again reattaches
  the copy.
- The entry is written only after the Score loaded successfully, so an invalid file leaves *My files* unchanged (US3
  #5). This is the same order `loadBytes` uses today.

**Rationale**: the clarified FR-021 names the file name as the identity. 100 MiB holds about 1,500 typical
`.musicxml`/`.mxl` files (library median about 20 KB, large real scores 1-5 MB) and stays far below the per-origin
quota of every target browser (Chrome/Edge: up to 60 % of free disk; Firefox: up to 10 % of disk; Safari: about 1 GB
before prompting). Separating bytes from entries keeps `listFiles()` cheap for SC-002 (200 entries without bytes).

**Alternatives considered**: case-sensitive names (duplicates on Windows for the same file). Keeping every version's
bytes (the spec asks only for reopening the current file). The File System Access API's persistent file handles
(Chromium only, and out of scope: "folder access").

## R-12 Removing, resetting and undo (FR-018, FR-022)

**Decision**:
- Undo is a **deferred commit**. The UI hides the item or shows its reset state at once. The store call runs after
  `UNDO_WINDOW_MS` (8,000 ms) unless *Undo* is pressed. If the page closes inside the window, nothing is removed: the
  safe direction.
- The confirmation is inline in the detail pane (two buttons: "Remove file, keep progress" / "Remove file and
  progress"; "Reset progress" / "Cancel"), never a blocking dialog (spec Assumptions).
- **Reset progress** and **remove file and progress** also delete that Score's stored Performances (attempts and
  their recordings), for every hash the item covers. Otherwise the attempts list would still show runs the progress
  no longer counts, and SC-004 would compare against attempts that are not part of the progress. See **OD-3**.
- **Deleting one attempt** in the existing attempts list (003 FR-043) records `resultRemoved(runId)`. The result
  leaves the progress history and the attempt count drops by one. If it was the best or the mastering result, best
  and *Mastered* are recomputed from the results the record still holds. The record keeps `PROGRESS_RESULTS_MAX` = 20
  results, at least as many as the Performance store keeps, so it holds every attempt the attempts list shows. See
  **OD-4**.
- A reset removes the record for the item's hashes. Shared content (a *My files* entry identical to a library item)
  resets for both. The confirmation text says so when it applies.

**Rationale**: a deferred commit needs no "restore" operation in the port (simpler server contract), and it can never
leave half-restored state. The timer is UI-only and decides no sound (Principle I holds).

**Alternatives considered**: delete then restore from an in-memory snapshot (needs a restore API, and a restore can
fail). A blocking `confirm()` (spec: never). Keeping Performances on reset (the attempts list and progress disagree).

## R-13 Browser data flow and performance (SC-002, SC-003)

**Decision**:
- When the browser opens, it reads `progress.list()` (all records) and `files.list()` (entries without bytes) once.
  The library index comes from `LibraryCatalog.index()` (already cached in memory per session). The results are held
  in `browserState`. Events applied during the session update the cached record in place (the store returns the new
  record).
- One pure core function builds rows (`buildBrowserItems`), one filters, searches and sorts them (`queryBrowser`), and
  one gives folder summaries (`folderProgress`), all in `src/core/browser/`. No DOM work happens until the query
  result is known.
- The list renders every row (no virtualisation), with keyed row reuse, `content-visibility: auto` and
  `contain-intrinsic-size` on rows. That CSS is supported by Chrome/Edge 85, Firefox 125 and Safari 18; older engines
  just render everything.
- Budgets are tested, not assumed. A Node test runs `queryBrowser` over 500 items with 10,000 results (<= 20 ms, well
  inside SC-003's 100 ms). An e2e test measures open-to-first-list-paint with the real library plus 200 seeded
  *My files* entries (SC-002 <= 300 ms), and folder/search/filter updates with 500 items (SC-003 <= 100 ms).

**Rationale**: 181 library items today (`public/library/index.json`, 49 sections) plus hundreds of files is small.
Virtualisation would complicate keyboard navigation and screen-reader semantics (FR-028) for no measured gain.

**Alternatives considered**: a virtual list (complex, harms accessibility). A Web Worker for querying (the transfer
costs more than the work at this size).

## R-14 Keyboard and screen-reader model (FR-028, SC-007)

**Decision**:
- The rail is a `role="tree"` with a roving `tabindex`. Up/Down move, Right/Left open/close, Enter selects, and
  Home/End jump.
- The list is a `role="listbox"` with `aria-activedescendant`. Up/Down/Home/End/PageUp/PageDown move, Enter opens,
  and a double click opens.
- The detail pane is a labelled `region`. Its first control is *Open*.
- Tab order: search -> filter chips/controls -> sort -> rail -> list -> detail -> close.
- `/` focuses search (it is ignored while typing in a field). Escape clears a non-empty search, otherwise it closes
  the browser.
- One `aria-live="polite"` status line announces "12 items", "No items match these filters" and status changes after
  an event ("Marked as mastered").
- Focus is always visible (`:focus-visible` outline 2 px, contrast >= 3:1).
- SC-007's automated check uses **axe-core** through `@axe-core/playwright` 4.13.0 (MPL-2.0, devDependency only;
  pulls `axe-core` 4.13.0, MPL-2.0; verified on the npm registry 2026-09-27) with the tags `wcag2a`, `wcag2aa`,
  `wcag21a`, `wcag21aa`. This is a new **dev** dependency: **OD-5**.

**Rationale**: the APG tree and listbox patterns are what screen readers expect for a folder rail and a result list.
"No WCAG 2.1 AA violations" is only verifiable with a rules engine. axe-core is the de facto standard and MPL-2.0 is
permissive for a test-only tool. It ships nothing to users (Principle VIII covers runtime dependencies).

**Alternatives considered**: `role="grid"` for the list (heavier, and rows have a single action). Hand-written
accessibility assertions (they cannot claim "no WCAG 2.1 AA violations"). Lighthouse (a larger tool, and its
accessibility audit is axe underneath).

## R-15 Persisted browser view state (FR-006)

**Decision**: `localStorage` key `musicanyya.browser.v1`, `{ version: 1, view: BrowserViewState }`. It stores the
folder, search text, filters, sort and selected item. Every field is validated on its own, and an invalid field falls
back to its default (the same pattern as `libraryState`). A folder id no longer in the index follows `formerIds`
(feature 011). On first load, the old key `musicanyya.library.v1`'s `level`/`key`/`tag`/`sectionId` seed the new state.
The old key is then left alone.

**Rationale**: the constitution reserves `localStorage` for tiny UI preferences, and this is one. Unlike the old panel
(`libraryState` never persisted text), FR-006 asks for the search text to be restored too.

**Alternatives considered**: storing it in IndexedDB beside progress. It is a per-device preference, not progress, and
a server store must not sync it.

## R-16 Status badges and trend: colour, shape and text (FR-012, Principle VI)

**Decision**: every badge has an inline SVG shape **and** a text label. *New* is an outlined circle, *Practised* a
half-filled circle, *Played* a filled circle and *Mastered* a star. Colours come from the Okabe-Ito tokens in
`tokens.css`: `--status-new` grey, `--status-practised` sky blue, `--status-played` blue, `--status-mastered` bluish
green. Trend is an up/down triangle or an equals sign, with text for screen readers ("up 15 points"). Each badge has a
tooltip ("Practised in Practice mode", "Played in Play mode"; expert). A greyscale screenshot check
(`pnpm screenshot --greyscale`) is part of the quickstart.

**Rationale**: it follows the existing marks' rule (shape carries the meaning, colour decorates), and the text label
makes the badge readable without either.

## R-17 Opening files from inside the browser (FR-019, US3 #1, #5)

**Decision**: *Open file...* in the browser uses the existing `<input type=file accept=".musicxml,.xml,.mxl">`
(`SCORE_FILE_ACCEPT`). A drop onto the dialog is handled by the dialog (`dragover`/`drop`), with a visible drop
highlight. Both call the same `Session.openFile` path. On a load failure the browser stays open and shows the file name
and the problem in its message line (reusing the `LoadError` text of feature 001). *My files* is not touched. The main
window's existing drop zone keeps working and also adds the file to *My files*.

**Rationale**: FR-005 requires one load path. The File System Access API's `showOpenFilePicker` is Chromium-only and
the input covers every browser.

## R-18 Where progress events come from (FR-015, FR-016)

**Decision** (`src/app/browser-session.ts` owns the calls; `session.ts` forwards):
- `opened`: after a Score **successfully** loads from any entry point. It carries `openedAs`
  (`{ kind: 'library', id }` or `{ kind: 'file', fileKey }`).
- `practised`: on `sessionEnded('reachedEnd')` or `loopCompleted` (R-9).
- `played`: after `PerformanceStore.put` succeeds, from the stored run's summary, settings, `complete` and the scope
  computed with the loaded Score (R-7). A storage failure of the Performance also skips the event, so progress and
  attempts never disagree.
- **New best** (FR-016): `onGraded` runs before storing (`play-session.ts:371-372`). The controller compares the
  Grade's result with the best held by the in-memory record of the open Score (loaded when the Score opened).
  `playState` gets `newBest: boolean`, and `mx-grade-panel` shows "New best" with a star shape. The stored event later
  confirms it.
- `resultRemoved`: after `PerformanceStore.remove` succeeds.
- Regrading an attempt at another strictness (003 FR-027) never writes back (SC-011), so it records nothing.

## R-19 Library unavailable, storage unavailable

**Decision**:
- Index failure: the rail shows *Continue* and *My files* normally, and the library root shows "Library unavailable"
  with *Retry* (the existing `libraryretry` flow). *Continue* items that are library items stay listed, from their
  progress records; opening one uses the catalog as today, so a cached copy opens offline and an uncached one gives
  the existing notice.
- IndexedDB unavailable or blocked: `Session` falls back to `MemoryProgressStore` for the session, so the browser
  keeps working. A notice says "Progress will not be kept on this device" (FR-029 "unavailable" state). A `full` result
  from a write gives "Storage is full - progress could not be saved". A single unreadable or wrong-version record is
  skipped with one notice, never blocking the list (Edge Cases).

## R-20 Replacing the old *Scores* panel contents and the empty start

**Decision**:
- The bar's *Open* button opens the browser. The Score menu entry "Recent scores" becomes "Open..." (browser). The
  `scores` panel keeps only `mx-score-source`, retitled "About this score".
- `mx-library` and `mx-recent-list` are no longer mounted, and the `ScoreStore` port and `IndexedDbScoreStore` are no
  longer used at run time (the migration reads `recentScores` directly). Deleting those files needs **OD-6**.
- With no Score loaded, the browser opens once at start-up (FR-001). The drop-zone invitation stays behind it for when
  the browser is closed.
- e2e helpers get `openScoreFile(page, path)`, which uses the browser's own file input. Tests that relied on the empty
  start close the browser first. `tools/dev/screenshot.ts` closes it before taking its picture unless `--browser` is
  given (a new flag, so the quickstart can show the browser).

**Rationale**: FR-001 says the browser *replaces* the library and recent lists as the place to find Scores. The score
source (licence, feature 005/011) still needs a home for the open Score.

**Alternatives considered**: keeping the old panel too (two ways to do one thing).

## R-21 No new runtime technology

**Decision**: no new runtime dependency. Everything uses Web Platform APIs already in the stack (IndexedDB, `<dialog>`,
Custom Elements, CSS `content-visibility`, `Intl.Collator`, `Intl.DateTimeFormat`/`RelativeTimeFormat` for "3 days
ago"). The only addition is the test-only `@axe-core/playwright` (OD-5).
