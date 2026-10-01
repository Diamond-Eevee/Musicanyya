# Feature Specification: Collapsible Browser Folder Tree

**Feature Branch**: `018-browser-tree-collapse`
**Created**: 2026-10-01
**Status**: Draft
**Input**: User description: "add tree view collapsing for improved UX, the view should start collapsed. But on app run,
the previous selected track should be selected (not loaded), and tree view remember the last collapsed state. It should
be saved in local storage for now, later with possibility to push to store in the server via user."

## Clarifications

### Session 2026-10-01

- Q: What does clicking the name of a collapsed folder do? -> A: It chooses the folder (shows its items) and expands
  it; clicking the name of an expanded folder only chooses it and never collapses it. Only the disclosure control (and
  Left) collapses.
- Q: During a session, does selecting an item hidden inside a collapsed folder reveal it in the rail? -> A: Only when
  the item is opened (loaded): opening reveals its folder by expanding the ancestors; selecting from search results or
  *Continue* leaves the rail unchanged.
- Q: Is the ancestor expansion done on app start (and on opening) saved as the remembered tree state? -> A: Yes - it
  is saved like any other expansion; there is no separate temporary state.

## Context

The score browser (feature 013) has a folder rail: *Continue*, *All*, the library's section tree (*Learning > Keys >
C major*, *Learning > Key changes > C major -> A minor*, *Repertoire > ...*) and *My files*. Today every folder starts
expanded and can only be collapsed with the keyboard (Left / Right), for the current session only. With 24 key folders
and 56 key-change folders the rail is a long scrolling list, and the musician has to scroll past folders they do not
use to reach the ones they do.

This feature makes the tree collapsible by pointer as well as keyboard, starts it collapsed on first use, remembers
which folders the musician left open, and brings the musician back - on the next app start - to the item they last
selected, shown selected but **not** opened. "Track" in the request means a browser item (a library piece/step or a
*My files* file).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Collapse and expand folders (Priority: P1)

A folder that has sub-folders shows a disclosure control (e.g. a triangle) that shows whether it is open or closed.
Clicking or tapping the control opens or closes that folder; its sub-folders appear or disappear underneath it.
Choosing a folder (clicking its name) still shows its items, as today, and also opens it if it was closed, so drilling
down is one click per level; it never closes an open folder. The keyboard keeps working as it does now
(Right opens, Left closes, Enter / Space choose).

**Why this priority**: Without a pointer control there is no way for a mouse or touch user to shorten the rail; every
other story builds on folders being collapsible.

**Independent Test**: Open the browser, click the disclosure control of *Keys* - its 24 key folders disappear and the
control shows "closed"; click it again - they reappear. The item list does not change during either click.

**Acceptance Scenarios**:

1. **Given** *Keys* is expanded, **When** the musician clicks its disclosure control, **Then** its key folders are
   hidden, the control shows the collapsed state, and the folder selection and item list are unchanged.
2. **Given** *Keys* is collapsed, **When** the musician clicks its disclosure control, **Then** its key folders are
   shown again with the same open/closed state each of them had before.
3. **Given** *Keys* is collapsed, **When** the musician clicks the name *Keys*, **Then** *Keys* becomes the chosen
   folder, its items are listed, and it expands to show its key folders.
4. **Given** *Keys* is expanded, **When** the musician clicks the name *Keys*, **Then** *Keys* becomes the chosen
   folder and stays expanded (a name click never collapses).
5. **Given** the selected folder is *C major* inside *Keys*, **When** the musician collapses *Keys*, **Then** the item
   list still shows *C major*'s items and *Keys* is marked as containing the selected folder.
6. **Given** keyboard focus is on a collapsed folder, **When** the musician presses Right, **Then** it expands; Left
   on an expanded folder collapses it (existing behaviour, unchanged).
7. **Given** a folder without sub-folders (*Continue*, *All*, *My files*, a key folder), **Then** it shows no
   disclosure control.

---

### User Story 2 - Start collapsed and remember what I opened (Priority: P1)

The first time the browser is shown, every folder with sub-folders is collapsed, so the rail fits on screen as a short
list of top-level entries. From then on, the open/closed state of every folder is remembered across reloads and app
restarts: the rail looks the way the musician left it.

**Why this priority**: This is the core of the request - a short rail by default, without making the musician
re-open the same folders every session.

**Independent Test**: Clear the app's saved state, start the app - the rail shows *Continue*, *All*, *Learning*,
*Repertoire* (collapsed) and *My files* only. Expand *Learning > Keys*, reload - *Learning* and *Keys* are still
expanded and everything else is collapsed.

**Acceptance Scenarios**:

1. **Given** no saved tree state, **When** the browser is first shown, **Then** every folder that has sub-folders is
   collapsed (except the ancestors of a restored selection, see User Story 3).
2. **Given** the musician expanded *Learning* and *Keys* and collapsed *Repertoire*, **When** they reload or restart
   the app, **Then** the rail shows exactly that open/closed state.
3. **Given** a saved state that names a folder which no longer exists (library changed), **When** the browser is shown,
   **Then** that entry is ignored, a folder that was renamed/moved keeps its state where the library records the move,
   and new folders appear collapsed.
4. **Given** the saved state cannot be read (corrupt, storage unavailable or full), **When** the browser is shown,
   **Then** it falls back to everything collapsed without an error message, and collapsing/expanding still works for
   the session.

---

### User Story 3 - Back to my last selected item, without loading it (Priority: P2)

When the app starts, the browser shows the folder and the item the musician last selected, with that item selected
(highlighted, its details shown) and scrolled into view. The folders leading to it are expanded so it is visible. The
item is **not** opened: no Score is loaded and nothing plays until the musician opens it themselves.

**Why this priority**: It turns "start collapsed" from a step backwards into a convenience: the musician lands on what
they were working on, one action away from opening it, while the rest of the tree stays tidy.

**Independent Test**: Select the *C major* folder and its item *Introduction* (single click, do not open). Restart the
app. The rail shows *Learning > Keys > C major* expanded and chosen, *Introduction* is selected in the list and shown
in the detail pane, and the score area shows no loaded Score from that item.

**Acceptance Scenarios**:

1. **Given** the musician last selected item X in folder F, **When** the app starts, **Then** F is the chosen folder,
   every ancestor folder of F is expanded, X is selected and scrolled into view, and X's details are shown.
2. **Given** the same start, **Then** no Score is loaded from X and no audio starts; the musician opens X with the
   usual *Open* action.
3. **Given** the musician last selected an item and then collapsed one of its ancestor folders, **When** the app
   starts, **Then** that ancestor is expanded again so the selected folder is visible (the selection wins over the
   remembered collapsed state for its own path only; other folders keep their remembered state). The expanded
   ancestors are saved as the new remembered state.
4. **Given** the last selected item no longer exists (library item removed, *My files* entry removed), **When** the app
   starts, **Then** the browser shows the remembered folder (or *Continue* if that is gone too) with no item selected
   and no error.
5. **Given** the last selected item is a *My files* file, **When** the app starts, **Then** *My files* is the chosen
   folder and that file is selected (not opened).
6. **Given** the last opened (not just selected) item, **When** the app starts, **Then** it is treated as the last
   selected item (opening an item also selects it).

---

### User Story 4 - Ready to follow me to other devices later (Priority: P3)

The remembered tree state and selection are kept as part of the musician's own browser preferences, in one place,
separate from the code that displays them, so that a later feature can store them on a server under the musician's
account and restore them on another device without changing how the browser behaves.

**Why this priority**: Requested as a future possibility; this feature only keeps the door open, it does not add
accounts or a server.

**Independent Test**: Review: the remembered preferences (open folders, chosen folder, selected item) form one
versioned, documented record that can be read and written as a whole; replacing its storage location does not change
any acceptance scenario above.

**Acceptance Scenarios**:

1. **Given** the remembered preferences, **Then** they are one versioned record with a documented format, read and
   written as a whole.
2. **Given** a record written by an older version of this format (e.g. 013's view without tree state), **When** it is
   read, **Then** it is upgraded without losing the chosen folder, filters, sort or selection.

### Edge Cases

- **Library unavailable** (offline, index missing): only *Continue*, *All* and *My files* are shown; the remembered
  tree state is kept unchanged (not erased) and applies again once the library loads.
- **Search or filters active**: the rail's open/closed state is not changed by searching or filtering.
- **A run starts** (Play / Practice): the browser closes as today; the tree state is remembered as it was.
- **Narrow window** (013 US1 #6, breadcrumb rail): the remembered state applies when the full rail is shown again.
- **Several tabs/windows** of the browser version: the last change written wins; a tab does not have to pick up another
  tab's changes live.
- **Selection inside a collapsed folder during the session** (e.g. via search results or *Continue*): selecting an item
  does not change the rail; **opening** it expands its ancestors (FR-016), and app start does the same (User Story 3).
- **Fast repeated clicks** on a disclosure control: each click toggles once; the rail never ends in a state different
  from the last visible one.
- **Accessibility**: the open/closed state is announced by assistive technology for every folder that has sub-folders,
  and the disclosure control is reachable without a pointer (existing keyboard support).
- Not affected by this feature: MIDI devices, audio devices, MusicXML content, grading.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every rail folder that has sub-folders MUST show a disclosure control that shows its open/closed state;
  folders without sub-folders MUST NOT show one.
- **FR-002**: Activating the disclosure control by pointer (click/tap) MUST toggle that folder only, without changing
  the chosen folder, the item list, the selected item or the scroll position of the item list.
- **FR-003**: Choosing a folder by its name (pointer, Enter or Space) MUST keep its 013 behaviour (show its items) and
  MUST expand it if it is collapsed; it MUST NOT collapse an expanded folder.
- **FR-004**: The existing keyboard behaviour (Right/Left expand/collapse, Up/Down/Home/End move, Enter/Space choose)
  MUST keep working and MUST change the same remembered state as the pointer.
- **FR-005**: Collapsing a folder MUST hide all its descendants; expanding it MUST restore each descendant's own
  remembered open/closed state.
- **FR-006**: When the chosen folder is hidden inside a collapsed folder, the visible collapsed ancestor MUST show that
  it contains the chosen folder.
- **FR-007**: With no remembered tree state, every folder with sub-folders MUST start collapsed, except the ancestors of
  the restored chosen folder (FR-010).
- **FR-008**: The open/closed state of every folder MUST be remembered across reloads and app restarts in the browser
  and the Electron Shell, stored on the musician's device.
- **FR-009**: Remembered entries for folders that no longer exist MUST be ignored; folders whose identity moved (the
  library's recorded former ids) MUST keep their state; folders the record does not mention MUST start collapsed.
- **FR-010**: On app start the browser MUST restore the last chosen folder and the last selected item (013 FR-006),
  expand every ancestor of that folder, scroll the selected item into view and show its details. The expansion MUST be
  saved as the remembered tree state (no separate temporary state).
- **FR-011**: Restoring the selection on app start MUST NOT load a Score, change the loaded Score, or start any audio.
- **FR-012**: Opening an item MUST also make it the selected item, for library items and *My files* files alike, so the
  last opened item is restored as selected (FR-010).
- **FR-013**: When the remembered item or folder no longer exists, the browser MUST fall back silently (folder ->
  *Continue*; item -> none selected) as 013 already does for folders.
- **FR-014**: When remembered state cannot be read or written, the browser MUST fall back to the defaults (FR-007)
  without an error message and keep working for the session.
- **FR-015**: Tree state, chosen folder and selected item MUST be kept as one versioned preferences record with a
  documented format, upgraded in place from the 013 record without losing any of its fields, so that a later feature
  can store it under a user account on a server.
- **FR-016**: Opening (loading) a library item MUST expand every ancestor of its folder and save that state; merely
  selecting an item (list, search results, *Continue*) MUST NOT change the open/closed state of any folder.
- **FR-017**: The open/closed state of each folder that has sub-folders MUST be exposed to assistive technology.

### Key Entities *(include if the feature involves data)*

- **Browser preferences** (extends 013's remembered view): chosen folder, search text, filters, sort, selected item
  (013), plus the **expanded folders** - the set of library folders the musician left open. Versioned; belongs to the
  musician (today: one per device; later: per user account).
- **Folder**: a library section with an identity that survives renames through the library's former ids; has zero or
  more sub-folders.
- **Selected item**: a reference to a library item or a *My files* file; independent from the loaded Score.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On first use with the full library, the whole rail is visible without scrolling in a window 768 px tall
  (no more than 6 top-level entries shown).
- **SC-002**: After any sequence of expand/collapse actions, a reload or restart shows the identical open/closed state
  in 100% of the automated test cases (browser Shell).
- **SC-003**: After an app restart, the last selected item is selected, visible and its details shown within the time
  the browser already takes to appear (013 SC-002), and in 0 of the test cases is a Score loaded or audio started by
  the restore.
- **SC-004**: A musician can reach and choose any library folder from the collapsed default in at most one click per
  tree level (3 name clicks for *Learning > Keys > C major*), and an item they last selected in 0 actions after
  restart.
- **SC-005**: A disclosure click never changes the item list or the selection (0 failures in automated tests).
- **SC-006**: Corrupt or unavailable stored state never shows an error and always yields the default collapsed rail
  (automated tests for corrupt, missing and failing storage).

## Assumptions

- "Track" means a browser item (library piece/step or *My files* file); "selected" means highlighted with its details
  shown, as in 013, distinct from "opened/loaded".
- "Start collapsed" means: on first use, every folder with sub-folders is closed; the top-level entries (*Continue*,
  *All*, *Learning*, *Repertoire*, *My files*) stay visible. The ancestors of a restored selection are the only
  exception (User Story 3).
- "On app run" includes a page reload in the browser Shell and a restart of the Electron Shell.
- The restored folder and item are those of 013 FR-006 (already remembered); this feature adds tree state, the ancestor
  expansion and the guarantee that nothing is loaded.
- This changes 013 behaviour that said the rail starts expanded and that collapsed state is session-only (013
  contracts/score-browser.md section 1, US1 "a key folder is visible without an extra click"); that document is updated
  in the plan step. 013 SC-001 ("open any item they can see ... in at most 3 actions") still holds for visible items;
  reaching an item inside a collapsed folder costs the disclosure actions of SC-004.
- Storage is on the device only (local browser storage) for now; the record layout is chosen so a server copy can be
  added later.
- Only one musician per device/browser profile; no merge of state between tabs.

## Out of Scope

- User accounts, sign-in, and storing preferences on a server (only made possible, FR-015).
- Expand all / collapse all commands, drag-and-drop or re-ordering of folders.
- Changes to the item list, detail pane, search, filters or sort beyond what FR-010/FR-012 need.
- Automatically opening (loading) the last Score on start - explicitly not wanted.
- Native audio plugin Shell (it has no score browser).
