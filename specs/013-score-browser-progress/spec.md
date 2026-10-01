# Feature Specification: Score browser with progress

**Feature Branch**: `013-score-browser-progress`
**Created**: 2026-09-27
**Status**: Draft
**Input**: User description: "inapp open music xml browser, with stored grade, max score, previous score etc.
Can be a big, even full screen, or almost full scren modal window for user comfort. We will have categories, like:
chords -> c major|others -> (c major files list), songs -> begginer|other -> song list. Also possibility to open
external file (the grading of external files will be saved also, identified by their name/id or whatever). Progess
saven in local storage for now, but should be abstract so we can change it with saving to server using apis easily.
Please improve my design, and do nice UX."

## Clarifications

### Session 2026-09-27

- Q: An edited user file opened again under the same name? -> A: Same *My files* entry, earlier results marked
  "earlier version" and not counted toward best/*Mastered* (FR-021).
- Q: What makes one result better? -> A: Notes correct first, notes on time as tie-break (FR-023).
- Q: Do slowed-tempo runs count? -> A: Yes for *Played* and best (tempo shown); *Mastered* needs 100 % tempo or
  faster (FR-024).
- Owner decisions of the plan (answered "respond with recommended", 2026-09-27):
  - OD-1: best and *Mastered* count only runs over the whole Score with every staff of the part that has notes;
    bar-range and one-hand runs count for *Played* and the attempt count and are shown, labelled (FR-010, FR-024).
  - OD-2: *Mastered* also needs extra notes at most a named, configurable share of the notes total, default 10 %
    (FR-024).
  - OD-3: resetting an item's progress, and removing a file together with its progress, also deletes its stored
    attempts (FR-018, FR-022).
  - OD-4: deleting one stored attempt removes it from progress too (FR-015).
  - OD-5: the automated accessibility check (SC-007) may use the test-only tool `@axe-core/playwright`.
  - OD-6: the side panel's library list and *Recent* list, and their storage code, are removed once the browser
    covers them.
- Q: Which view does the browser open on - *Continue* (US4) or the last view (FR-006)? -> A: The last view (FR-006);
  *Continue* is the view on first use and always the first entry of the rail (analyze A1).

## Context and design direction

Today the built-in library (feature 005, reorganised by key in feature 011) is a list inside the side *Scores*
panel, the user's own files appear only as a short *Recent* list (last 10), and Play-mode Grades are visible only
per Score, after opening it (feature 003 attempts list). A musician cannot see, before opening anything, which
pieces they have already played, how well, or what to do next.

This feature replaces that with one **Score browser**: a large, near-full-screen window that is the single place to
find, open and track everything the musician plays. Design choices made on the owner's behalf ("improve my design"):

- **One place for everything**: built-in library folders and the musician's own files (*My files*) side by side,
  with the same progress display for both.
- **Progress at a glance**: every item and every folder shows its status (not started / practised / played /
  mastered), and played items show their best and last result, so "what next?" is answered without opening scores.
- **A home view, not a file dialog**: the browser opens on *Continue* (recently played items and the suggested next
  step), then lets the musician drill into folders (e.g. *Learning > Keys > C major*, *Repertoire > Beginner*).
- **A detail pane** for the selected item: what it is, its progress history, and one clear *Open* action.
- **Fast by keyboard and pointer alike**: search, filters and sort; arrow keys, Enter and Escape; one click from
  any visible item to an open Score.

Mapping of the owner's example categories onto the existing library: "chords -> C major" is *Learning > Keys >
C major* (and *Learning > Key changes*); "songs -> beginner" is *Repertoire > Beginner*. The folder structure itself
stays owned by the library content (feature 005/011); this feature only presents it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse and open from a big, comfortable window (Priority: P1)

The musician presses *Open* (or the app starts with no Score) and a large browser window covers almost the whole
screen. A folder rail on the left shows the library's categories (*Learning > Keys > C major ...*, *Key changes*,
*Repertoire > Beginner / Intermediate / Advanced*) plus *My files*. The main area lists the items of the selected
folder with title, composer, level, key and length. Selecting an item shows its details; *Open* (or double-click, or
Enter) loads it and closes the browser. Escape or the close button returns to the current Score untouched.

**Why this priority**: It is the foundation every other story draws into; alone it already replaces the cramped
side-panel list with a comfortable, navigable browser.

**Independent Test**: With no stored progress, open the browser, navigate *Learning > Keys > C major*, open the
first exercise - the Score is shown and the browser is closed; reopen the browser - it returns to *C major* with
that item selected.

**Acceptance Scenarios**:

1. **Given** the app is open with any or no Score, **When** the musician presses *Open*, **Then** the browser opens
   covering nearly the whole window, with the folder rail, item list and detail pane visible, and keyboard focus in
   the search field.
2. **Given** the browser is open on *Repertoire > Beginner*, **When** the musician double-clicks an item (or selects
   it and presses Enter or *Open*), **Then** that Score opens exactly as it would from any other entry point and the
   browser closes.
3. **Given** the browser is open over a loaded Score, **When** the musician presses Escape, clicks the close button
   or clicks outside the window, **Then** the browser closes and the loaded Score, its position and settings are
   unchanged.
4. **Given** the musician types "elise" in search, **When** results appear, **Then** matching items from every
   folder (including *My files*) are listed with their folder path, and the folder selection is shown as "All".
5. **Given** the musician closes and reopens the browser (also after an app reload), **Then** it shows the folder,
   search, filters, sort and selection they last used.
6. **Given** the window is narrow (tablet / small laptop), **Then** the rail collapses to a breadcrumb/folder
   picker and the detail pane becomes a panel over the list, with nothing cut off and no horizontal scrolling.

---

### User Story 2 - See my progress on every item (Priority: P1)

Every item in the browser shows the musician's progress: a status badge (*New*, *Practised*, *Played*,
*Mastered*), and for played items the **best result**, the **last result** and the change between the last two
results (up / down / same). The detail pane adds the number of attempts, when it was last played, the tempo each
figure was reached at, and a small history of recent results. Folders show a summary (e.g. "C major - 5 of 8 played,
2 mastered") so the musician can see how far through a key or level they are.

**Why this priority**: This is the core of the owner's request (stored grade, max score, previous score). Without it
the browser is only a nicer file list.

**Independent Test**: Record two Play-mode attempts on one library item (first 70 %, then 85 % notes correct);
open the browser - the item shows *Played*, best 85 %, last 85 %, trend up; its folder counts it as played; after
an app reload the same figures are shown.

**Acceptance Scenarios**:

1. **Given** a Score has never been opened in Practice or Play, **Then** its row shows *New* and no figures.
2. **Given** the musician completed a Practice session on an item but never played it in Play mode, **Then** it
   shows *Practised* and when, but no Grade figures.
3. **Given** an item has Play-mode attempts, **Then** its row shows the best and last result using the same two
   Grade figures the grade panel uses (notes correct, notes on time), and the detail pane lists the recent attempts
   newest first with date, tempo, both figures and whether the run was complete.
4. **Given** the musician improves on their best, **When** the Grade appears after the run, **Then** the grade panel
   says it is a new personal best, and the browser shows the new best afterwards.
5. **Given** older attempts are dropped from the stored attempt history because of its size limit, **Then** the best
   result, the attempt count and the first-played date are still correct.
6. **Given** a folder, **Then** its summary counts (played, mastered, total) equal the counts of its items, including
   sub-folders.
7. **Given** attempts were recorded before this feature existed, **When** the browser is first opened after the
   update, **Then** those attempts are reflected in the progress shown - nothing already earned is lost.

---

### User Story 3 - My own files, with their progress kept (Priority: P2)

The musician can open a MusicXML file from their computer from inside the browser (*Open file...* button, or by
dropping a file onto the browser). Every file opened this way appears under *My files* with the same progress
display as library items, and stays there across sessions so it can be reopened with one click. An entry shows the Score's title (or the file
name when the Score has none) with the file name beneath it. The musician can remove a file from *My files*, choosing whether its progress is kept or deleted.

**Why this priority**: The owner explicitly wants external files graded and remembered; it builds on US1 and US2
but is not needed for the library workflow.

**Independent Test**: Open an external `.musicxml` file via *Open file...*, do one Play-mode run, reload the app,
open the browser - the file is listed under *My files* with *Played* and its result, and opens again with one click
without choosing it from disk.

**Acceptance Scenarios**:

1. **Given** the browser is open, **When** the musician chooses *Open file...* and picks a supported file (or drops
   it onto the browser), **Then** the Score opens, the browser closes, and the file is added to *My files*.
2. **Given** a file in *My files*, **When** the musician opens the same file again from disk, **Then** no duplicate
   entry appears and its existing progress is shown.
3. **Given** a file whose stored copy is no longer available on this device (e.g. storage was cleared except the
   progress, or the space limit was reached), **Then** its entry and progress remain, marked "file not stored -
   open it again from disk to play", and opening it from disk reattaches it.
4. **Given** the musician removes a file from *My files*, **When** they confirm with "remove file, keep progress" or
   "remove file and progress", **Then** exactly that happens, and the choice can be undone for a few seconds.
5. **Given** the dropped or chosen file is not valid MusicXML, **Then** the browser stays open, shows a clear message
   naming the file and the problem, and *My files* is unchanged.

---

### User Story 4 - Continue where I left off (Priority: P2)

The first entry of the browser's rail is a *Continue* view (and the view shown the first time the browser opens):
the last few items the musician opened (with progress), and a *Suggested next* card - the next step in the folder they were working in (e.g. after mastering *C major - Beginner*, suggest
*C major - Intermediate*; after the last step of a key, the next key in the library's order).

**Why this priority**: It turns the browser from a catalogue into a practice companion, but depends on US1 and US2.

**Independent Test**: Master the *Introduction* step of *C major*, open the browser on *Continue* - it shows that item
first among recent items and suggests the *Beginner* step of *C major*; opening the suggestion needs one click.

**Acceptance Scenarios**:

1. **Given** the musician has opened items before, **When** they view *Continue*, **Then** it lists up to
   8 recently opened items, newest first, each with status and best result.
2. **Given** the most recent item is in a stepped folder (a key or key-change folder) and it is mastered, **Then**
   *Suggested next* is the next step in that folder; if it is not mastered, the suggestion is to continue that item.
3. **Given** the musician has no history, **Then** the browser opens on *Continue*, which shows a short welcome with a suggested first item
   (the first step of the first key folder) and a pointer to *Repertoire > Beginner*.

---

### User Story 5 - Find the right thing fast (Priority: P3)

Search, filter and sort work across the whole browser: filter by level, key, skill and status (e.g. "not yet
mastered"), and sort by library order, title, last played, or best result (lowest first = "needs work"). Everything
works by keyboard: arrow keys move through folders and items, Enter opens, `/` focuses search, Escape clears search
or closes.

**Why this priority**: Valuable as the library and *My files* grow, but the browser is usable without it.

**Independent Test**: Filter *Status: played, not mastered* and sort *Best result, lowest first* - the list shows
exactly those items in ascending order of best result; operate the whole flow from opening the browser to opening a
Score without touching the pointer.

**Acceptance Scenarios**:

1. **Given** filters for key "G major" and status "New", **Then** only never-attempted G-major items are listed,
   and the active filters are visible as removable chips with a "Clear all" action.
2. **Given** a filter combination matches nothing, **Then** the list says so and offers "Clear filters".
3. **Given** only the keyboard, **When** the musician opens the browser, searches, moves to a result and presses
   Enter, **Then** the Score opens; focus is always visible and returns to the *Open* button when the browser closes.

### Edge Cases

- **A run is active** (Play run, Practice session, or Listen playing): the browser follows the existing rule that
  starting a run closes any panel (nothing modal during a session, Principle VI). Opening the browser while Listen
  is playing pauses playback; the browser cannot be opened during a Play run.
- **Opening another Score from the browser while one is loaded** discards nothing that is stored: finished attempts
  are already saved; an unfinished Play run cannot exist because of the rule above.
- **Library unavailable** (offline, index missing or malformed): *My files*, *Continue* and library items already
  available offline still work; the library folders show a clear "library unavailable" message instead of an empty
  list.
- **On-device storage unavailable or full** (private browsing, quota): the browser and Score opening still work;
  a notice says progress will not be kept; nothing crashes. Stored progress that is unreadable or from an unknown
  version is ignored item by item with a notice, never blocking the browser.
- **A library item is replaced by a newer version** (the library's "supersedes" mechanism): its progress carries
  over to the replacement.
- **The same content under two names** (a user file identical to a library item, or the same file under another
  name): it is one Score for progress purposes; the progress appears on both the library item and the *My files*
  entry.
- **A user file edited on disk and opened again**: same *My files* entry, earlier results marked "earlier version"
  and excluded from best and *Mastered* (FR-021).
- **Malformed or unsupported MusicXML** chosen or dropped: US3 scenario 5; items that open with load notices behave
  as today (notices shown, Score usable).
- **Very large collections**: hundreds of *My files* and thousands of attempts stay fast to browse (SC-003).
- **Incomplete runs** (stopped early): shown in history as incomplete, never counted as best or toward *Mastered*.
- **MIDI device lost** during a run: unchanged behaviour of feature 003; the browser is not involved.
- **Two app tabs/windows open at once**: progress written in one is visible in the other the next time its browser
  opens; neither loses the other's attempts.

## Requirements *(mandatory)*

### Functional Requirements

**Browser window**

- **FR-001**: The app MUST offer one *Score browser* reachable from the *Open* control and shown automatically when
  the app starts with no Score loaded; it replaces the library list and *Recent* list of the side *Scores* panel as
  the place to find Scores.
- **FR-002**: The browser MUST cover nearly the whole app window (leaving a visible margin around it) on screens of
  1024 px width and above, and adapt to narrower windows without horizontal scrolling or clipped content (US1 #6).
- **FR-003**: The browser MUST show a folder rail (the library's section tree plus *My files*, and *Continue* at the
  top), an item list for the selected folder or search, and a detail pane for the selected item.
- **FR-004**: The browser MUST close on Escape, its close button, or a click outside it, leaving the loaded Score and
  its state unchanged; opening an item MUST close it.
- **FR-005**: Opening an item from the browser MUST behave exactly like opening that Score from any other entry point
  (same load, notices, settings adoption).
- **FR-006**: The browser MUST remember, across sessions, the folder, search text, filters, sort and selected item
  last used, and restore them on open.
- **FR-007**: The browser MUST NOT be open during a Play run or Practice session, following the existing "a run closes
  panels" rule; opening it during Listen playback MUST pause playback.

**Progress**

- **FR-008**: The app MUST keep, per Score, a *progress record*: status, first and last opened, last practised,
  number of Play-mode attempts, best result, last result and previous result, each result with its date, tempo and
  completeness.
- **FR-009**: A *result* MUST consist of the two Grade figures already used by the grade panel (notes correct, notes
  on time) and never a new, unexplained number (Principle VI).
- **FR-010**: The *best result* MUST be chosen among complete runs over the whole Score with every staff of the part
  that has notes, by the rule in FR-023; bar-range and one-hand runs are shown and counted for *Played* but never
  best. (OD-1, 2026-09-27.)
- **FR-011**: Status MUST be derived as: *New* (never practised or played), *Practised* (a Practice session reached
  the end of the Score or the loop, no Play attempt), *Played* (at least one Play attempt), *Mastered* (a complete Play
  run meeting the mastery thresholds of FR-024).
- **FR-012**: Every item row MUST show its status as a badge that differs in both colour and shape/icon
  (Principle VI), and for played items the best result, the last result and the trend between the last two results.
- **FR-013**: The detail pane MUST show the item's metadata (title, composer/arranger, level, key(s), length, source
  and licence for library items), the progress record, and the most recent attempts (up to the stored attempt limit)
  with date, tempo, both figures and completeness.
- **FR-014**: Each folder MUST show a progress summary: items played, items mastered and total, counting sub-folders.
- **FR-015**: The progress record MUST be updated when a Play run's Grade is stored and when a Practice session ends,
  and MUST stay correct when old attempts are trimmed from the attempt history (US2 #5). Deleting a stored attempt
  MUST remove it from progress too (OD-4).
- **FR-016**: After a run whose result becomes the new best, the grade panel MUST say so ("New best").
- **FR-017**: On first use, progress MUST be built from attempts already stored by earlier versions, so no earned
  result is lost.
- **FR-018**: The musician MUST be able to reset one item's progress (with confirmation and a short undo); a reset
  also deletes the item's stored attempts (OD-3).

**My files**

- **FR-019**: The browser MUST let the musician open a MusicXML file (`.musicxml`, `.xml`, `.mxl`) from their device
  via a button and by dropping it onto the browser; every file opened this way MUST be listed in *My files* with the
  same progress display as library items.
- **FR-020**: *My files* MUST keep a stored copy of each file for one-click reopening, within a storage budget; when a
  copy cannot be kept, the entry and its progress MUST remain with a "file not stored" state (US3 #3).
- **FR-021**: A *My files* entry MUST be identified by its file name: opening a file with the same name but changed
  content MUST reuse the entry and keep its history, mark the results recorded before the change as "earlier
  version", and count only results from the current content toward best result and *Mastered*. Identical content
  under another name is the same Score (see Edge Cases). (Clarified 2026-09-27.)
- **FR-022**: The musician MUST be able to remove a *My files* entry, choosing "keep progress" or "remove progress too"
  (which also deletes its stored attempts, OD-3), with a short undo.

**Grading rules for progress**

- **FR-023**: "Best result" MUST be the run with the highest notes-correct figure, ties broken by the higher
  notes-on-time figure, then by the later run; both figures are always shown. (Clarified 2026-09-27.)
- **FR-024**: *Mastered* MUST require a complete Play run over the whole Score with every staff of the part that has
  notes, with notes correct and notes on time at or above named, configurable thresholds and extra notes at most a
  named, configurable share of the notes total, played at 100 % of the written tempo or faster (OD-1, OD-2). Runs at any tempo count for *Played* and the best result, and the
  tempo MUST be shown next to every result. (Clarified 2026-09-27.)

**Continue, search, filters**

- **FR-025**: *Continue* MUST list up to 8 most recently opened items (library and *My files*) with status and best
  result, and a *Suggested next* item derived from the step order of the most recent stepped folder (US4).
- **FR-026**: Search MUST match title, composer, arranger, folder name and file name across all folders, and show each
  result's folder path.
- **FR-027**: Filters MUST include level, key, skill and status; sort MUST offer library order, title, last played and
  best result (both directions); active filters MUST be visible and individually removable.
- **FR-028**: The browser MUST be fully operable by keyboard (arrows, Enter, Escape, `/` for search, Tab order through
  rail, list and detail pane), with visible focus, and MUST announce list and status changes to screen readers.

**Storage boundary**

- **FR-029**: Progress MUST be kept on the device for now, behind one storage boundary with a documented contract, so
  a server-backed store can replace or complement it later without changing the browser, grading or session
  behaviour. The contract MUST cover reading, writing, listing and deleting progress and user-file entries, and
  reporting "unavailable" and "full" states.
- **FR-030**: Progress records MUST carry a format version and the time they were last changed, so records can later
  be merged with a server copy; this feature MUST NOT sync with any server.
- **FR-031**: Browser, progress and *My files* MUST work identically in the browser Shell and the Electron Shell; the
  Native audio plugin is not involved.

### Key Entities

- **Browser item**: something the musician can open - a library item or a *My files* entry - with its display
  metadata and the Score identity its progress is keyed by.
- **Progress record**: per Score identity - status, first/last opened, last practised, attempt count, best, last and
  previous result, format version, last changed time.
- **Result**: the two Grade figures of one Play run plus its date, tempo (percent of written tempo), completeness
  and, for user files, whether it was recorded on an earlier version of the file;
  derived from the stored performance, never computed differently from the Grade.
- **User file entry**: a file the musician opened from their device - display title, original file name, when added,
  whether a stored copy is available, and its Score identity.
- **Folder progress**: derived counts (played, mastered, total) for a library folder or *My files*.
- **Browser view state**: last folder, search, filters, sort and selection - a per-device preference.
- **Mastery thresholds**: named, configurable minimums for notes correct and notes on time, and a maximum share of
  extra notes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From a loaded Score, a musician can open any library item they can see in the browser in at most
  3 actions (open browser, choose folder, open item), and any recently opened item in at most 2.
  (018 note: this holds while the item's folder is visible in the rail. The rail now starts collapsed, so a fresh
  profile first opens the path with name clicks, [018 SC-004](../018-browser-tree-collapse/spec.md); the browser
  then remembers the open folders, so a returning musician keeps the 3 actions.)
- **SC-002**: The browser appears within 300 ms of pressing *Open* with the full library and 200 *My files*
  entries, measured in the end-to-end test browser on the development machine.
- **SC-003**: With 500 items and 10,000 stored attempts, changing folder, search or filter updates the list within
  100 ms.
- **SC-004**: For every item, the best, last and previous results and attempt count shown in the browser equal those
  recomputed from the stored attempts (100 % agreement in an automated check), including after attempts are trimmed.
- **SC-005**: Progress shown after an app reload is identical to progress shown before it.
- **SC-006**: A second implementation of the progress storage contract (an in-memory one used by tests) passes the
  same contract test suite as the on-device one, and the app runs on it with no change outside the storage layer.
- **SC-007**: Every flow in US1-US5 can be completed by keyboard alone, and an automated accessibility check of the
  browser reports no violations of WCAG 2.1 AA.
- **SC-008**: In the owner's manual check (quickstart), 4 of 5 first-time users find and open a named item from *Learning > Keys* or
  *Repertoire* and correctly state its best result, without help, in under 30 seconds.

## Assumptions

- "Local storage" in the request means *on this device*; the storage technology is a plan decision (attempts are
  already kept on the device today).
- The library's folder structure (Learning > Keys / Key changes, Repertoire > Beginner / Intermediate / Advanced) is
  the category structure the owner described; no new categories or content are added.
- Recently opened user files are not limited to the current 10; *My files* keeps entries until removed, and keeps file
  copies within a storage budget set in the plan.
- The per-Score attempt history keeps its current limit (20); the progress record is kept separately so best and
  counts survive trimming.
- Practice mode gives no Grade (constitution vocabulary), so it only contributes the *Practised* status and date.
- Default mastery thresholds (FR-024): notes correct >= 90 % and notes on time >= 80 %, extra notes <= 10 % of the
  notes total, at 100 % tempo or faster.
- Removing items and resetting progress use a small inline confirmation and a timed undo, never a blocking dialog.
- No accounts, sign-in or server sync in this feature; FR-029/FR-030 only prepare for it.
- English UI strings via the existing i18n catalogue.

## Out of Scope

- Server storage, accounts, sync between devices, sharing progress.
- Editing, renaming or organising *My files* into user-made folders or playlists.
- Adding, removing or re-levelling library content.
- Streaks, goals, practice-time statistics, charts beyond the short result history.
- Folder access to the device's file system (watching a folder of scores).
