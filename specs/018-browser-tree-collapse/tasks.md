# Tasks: Collapsible Browser Folder Tree

**Input**: Design documents from `specs/018-browser-tree-collapse/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/browser-view.md, contracts/contract-changes.md

<!--
  Format: `- [ ] T001 [P] [US1] Description with exact file path`
  States: `[ ]` open, `[~]` in progress with ` (claimed: <agent-id> <date>)`, `[x]` done, `[-]` dropped by the owner
  (AGENTS.md section 4). [deep] / [standard] / [light] = tier when it differs from the phase's **Model** line.
  Tests come BEFORE implementation (Constitution IV) and must fail first, for the reason named on the task.
  US1 and US2 are both P1 and are delivered by the same rail change, so they share Phase 3 (their tests come first
  there); the persistence tests come in Phase 2 because the stored field is foundational.
  No real-time path is touched (plan: Real-time Paths Touched = none), so there is no RT review task.
  No owner decision is open (plan: Decisions and open items), so there is no owner decision gate.
-->

## Phase 1: Setup

**Model**: light (gemini-3.7-flash or claude-haiku-4-5; every standard and deep model fits too)

- [x] T001 Append a baseline entry to `specs/018-browser-tree-collapse/implementation-log.md` with the summary lines of
  `pnpm test`, `pnpm lint` and `pnpm typecheck` on the branch as it is before any code change (AGENTS.md 2.6)
- [x] T002 [P] Fold the contract changes into the earlier features' documents, contract first (AGENTS.md section 6),
  exactly as listed in `specs/018-browser-tree-collapse/contracts/contract-changes.md`:
  `specs/013-score-browser-progress/contracts/score-browser.md` version `1.0.0` -> `1.1.0`, where §1 "Rail default
  state" is replaced by browser-view.md §1, the §4 rail rows by browser-view.md §2, a §3 note about `expanded` is
  added, and §5 gets the browser-view.md §4 bullets; `specs/013-score-browser-progress/data-model.md` §7 gets the
  `expanded` field and §8 gets `revealSelection`/`selectionRevealed()`, `fileOpened(ref)`, the open rule, the
  first-load-only reveal and the clearing of a missing selection (each with a "(018)" note); `specs/001-score-viewer-listen/contracts/storage.md` gets the `musicanyya.browser.v1` row text
  "Score browser view state (folder, search, filters, sort, selection, rail open folders)" and a link to 018
  browser-view.md §5
- [x] T003 [P] Add `export const BROWSER_EXPANDED_MAX = 512; // Most open-folder ids kept from a stored browser view
  (018 R-3)` beside `BROWSER_SEARCH_MAX_CHARS` in `src/core/defaults.ts`, and check that it matches the row in
  `specs/018-browser-tree-collapse/data-model.md` §5

---

## Phase 2: Foundational - the stored tree state (blocks all user stories)

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)

### Tests (write first, confirm they fail)

- [x] T004 [P] Unit tests for the pure tree-state helpers in `tests/core/browser/tree-state.test.ts` (data-model.md
  §2), one assertion per bullet, using a small section fixture with `formerIds`:
  - `validateExpanded`: non-array -> `[]`; non-strings dropped; more than `BROWSER_EXPANDED_MAX` -> the first 512;
    with sections: a former id becomes its replacement, an unknown id is dropped, the result is sorted and unique;
    with no sections: ids kept (deduplicated, sorted)
  - `setExpanded` adds and removes, and returns the **same** array instance when nothing changes
  - `ancestorsOf` returns root-first parents without the id itself, `[]` for a root, and stops at an unknown parent
    and at a parent cycle
  - `revealPath` adds the ancestors only, and returns the same instance when they are already present
  - `containsChosen` is true only for a strict ancestor of a chosen section; false for the section itself, for
    `continue`/`all`/`myFiles` and for unrelated sections
  Fails today: the module `src/core/browser/tree-state.ts` does not exist
- [x] T005 [P] Extend `tests/core/browser/view-state.test.ts`: `DEFAULT_BROWSER_VIEW.expanded` is `[]`; a stored 013
  view without `expanded` validates to `expanded: []` with folder, search, filters, sort and selected unchanged
  (US4 #2, FR-015); an invalid `expanded` (a string, an object) becomes `[]` without touching the other fields; a
  valid one goes through `validateExpanded` (a former id is replaced). Fails today: `BrowserViewState` has no
  `expanded`
- [x] T006 [P] [US2] Store persistence tests in the new file `tests/ui/score-browser/tree-persistence.test.ts`, with a
  fresh `createBrowserStateStore()` per case and a stubbed `localStorage`:
  1. no stored record -> `view.expanded` is `[]` after `indexLoaded` with folder `continue` (US2 #1, FR-007);
  2. `setView({ expanded: ['learning'] })` writes `{ version: 1, view }` whose `view.expanded` is `['learning']`, and a
     new store built afterwards reads it back (US2 #2, FR-008);
  3. a stored `expanded` with a removed id and a former id -> after `indexLoaded` the removed id is gone and the
     former id is replaced (US2 #3, FR-009);
  4. a corrupt record (`"{not json"`) and a `localStorage` whose `getItem`/`setItem` throw -> `expanded: []`, no
     exception, and `setView({ expanded })` still updates the in-memory view (US2 #4, FR-014, SC-006);
  5. `indexFailed` keeps the stored ids unchanged, and a later retry ending in `indexLoaded` applies them (edge case
     "Library unavailable", R-3).
  Fails today: the view has no `expanded`, so no case can see the field

### Implementation

- [x] T007 Add `expanded: readonly string[]` to `BrowserViewState` in `src/core/browser/types.ts` (comment: 018
  data-model §1), then implement `src/core/browser/tree-state.ts` (data-model.md §2, R-3, R-4; pure, no DOM) so T004
  passes
- [x] T008 Set `expanded: []` in `DEFAULT_BROWSER_VIEW` and have `validateViewState` call `validateExpanded(r.expanded,
  sections)` in `src/core/browser/view-state.ts`; export the existing `inFolder` from `src/core/browser/query.ts`
  without changing its logic (R-5); fix every `BrowserViewState` literal that `pnpm typecheck` reports; and check in
  `src/ui/state/browserState.ts` that `indexFailed` and `persistView` keep and write `expanded` (change them only if
  T006 shows they do not). T005 and T006 pass

**Checkpoint**: `pnpm test -- tests/core/browser tests/ui/score-browser/tree-persistence.test.ts` and `pnpm typecheck`
green. The view stores `expanded`, but the rail does not use it yet.

---

## Phase 3: User Stories 1 and 2 - Collapse/expand, start collapsed, remember (Priority: P1) MVP

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)
**Goal**: A pointer-clickable disclosure control; a name click chooses the folder and expands it; the rail renders
`view.expanded`, so it starts collapsed and its state is remembered.
**Independent Tests**: spec US1 (click the triangle of *Keys*: its key folders hide and the list is unchanged; click
again: they return; a name click on a collapsed *Keys* chooses and expands it) and spec US2 (with no saved state only
the five top-level entries show; expand *Learning* and *Keys*, reload: the same state).

### Tests (write first, confirm they fail)

- [x] T009 [US1] Rail tests in the new file `tests/ui/score-browser/rail-tree.test.ts` (same DOM setup and index
  fixture as `tests/ui/score-browser/rail-list-detail.test.ts`), one assertion per acceptance scenario of spec US1:
  1. a click on `.browser-rail-toggle` of an expanded folder removes its descendants from the rail, sets
     `aria-expanded="false"` and leaves `view.folder`, `view.selected` and the list rows unchanged (US1 #1, FR-002,
     SC-005);
  2. a second click restores the descendants with their own previous states (US1 #2, FR-005);
  3. a click on the label of a collapsed folder chooses it and expands it (US1 #3, FR-003);
  4. a click on the label of an expanded folder chooses it and it stays expanded (US1 #4);
  5. collapsing the parent of the chosen folder keeps the list and gives that parent `data-contains-selected` and
     the visually hidden text (US1 #5, FR-006);
  6. Right on a collapsed folder expands it, Left collapses it, Enter on a collapsed folder chooses and expands it,
     and each one changes `browserState.get().view.expanded` (US1 #6, FR-004);
  7. *Continue*, *All*, *My files* and a key folder have neither `.browser-rail-toggle` nor `aria-expanded`, and
     every folder with sub-folders has `aria-expanded` (US1 #7, FR-001, FR-017);
  8. each toggle dispatches `browserviewchange` with `{ view: { expanded } }`;
  9. with `view.expanded: []` the rail shows only the top-level entries (US2 #1, FR-007);
  10. two quick clicks on the same `.browser-rail-toggle` leave the folder in its original state, and the rendered
      rail matches `view.expanded` after each click (edge case "Fast repeated clicks", analyze L2).
  Fails today: there is no `.browser-rail-toggle`, a label click never expands, and the rail ignores `view.expanded`
- [x] T010 [P] [US2] e2e `tests/e2e/score-browser-tree.spec.ts` (new): (a) clear storage and load: the rail shows
  exactly *Continue*, *All*, *Learning*, *Repertoire*, *My files*, with `aria-expanded="false"` on *Learning* and
  *Repertoire*; at a 1280 x 768 viewport the rail's `scrollHeight <= clientHeight` (SC-001); (b) expand *Learning*
  and *Keys* with the triangle, collapse *Repertoire*, reload: the same `aria-expanded` values (US2 #2, SC-002);
  (c) seed a corrupt record, reload: collapsed rail, no `role="alert"` message, toggling works (US2 #4, SC-006);
  (d) at a 900 x 768 viewport, open the folder-picker overlay (`.browser-folder-picker`): the rail inside it shows
  the same remembered open/closed state as at 1280 px, and toggling there is saved (edge case "Narrow window",
  analyze M4); (e) from a fresh profile, *Learning > Keys > C major* is chosen and listed after exactly three label
  clicks (SC-004, analyze L1).
  Fails today: the rail starts expanded and has no triangle

### Implementation

- [x] T011 [US1] Rework `src/ui/elements/mx-browser-rail.ts` per contracts/browser-view.md §1-§2 and R-6/R-7: remove
  the private `collapsed` set; derive `expanded` from `browserState.get().view.expanded` with `isExpanded`; render
  `.browser-rail-toggle` (or `.browser-rail-toggle-space`), `data-contains-selected` and the visually hidden text via
  `containsChosen`; in the single `click` listener a toggle click calls `setExpanded`, and any other click chooses
  the folder and also expands it if it is collapsed; Enter/Space do the same as a name click; every change goes
  through `browserState.setView({ expanded })` plus `browserviewchange`; rewrite the class comment (the 013 text
  "Every folder starts expanded ... for the session only" is superseded). T009 passes
- [x] T012 [P] [US1] Styles in `src/ui/styles/browser.css`: a chevron drawn in CSS for `.browser-rail-toggle` (right
  when collapsed, down when `[aria-expanded="true"]`), a hit area of at least 24 x 24 px, a
  `.browser-rail-toggle-space` of equal width, the `[data-contains-selected]` bar (thinner and dimmer than the
  selected bar) plus a dot, and no rotation transition under `prefers-reduced-motion`; theme tokens only (no literal
  colours)
- [x] T013 [US1] Adapt the existing tests that assume the 013 all-expanded rail, without weakening them: run
  `pnpm test -- tests/ui/score-browser` and `pnpm test:e2e -- tests/e2e/score-browser`, and for each test that fails
  because a nested folder is no longer visible (e.g. in `rail-list-detail.test.ts`, `keyboard.test.ts`,
  `score-browser*.spec.ts`), seed `view.expanded` (unit) or `musicanyya.browser.v1` (e2e), or click its way there.
  What each test asserts stays the same. Log every changed test with the reason ("018: rail starts collapsed",
  AGENTS.md section 4). T010 passes, and both commands end green
- [x] T025 [US1] Keep the folder-picker overlay open on a toggle-only change (found while writing T010 (d)): in
  `src/ui/elements/mx-score-browser.ts` the `browserviewchange` listener (line 266) removes
  `browser-rail-overlay-open` on every change, so a disclosure toggle inside the 768-1023 px overlay would close it.
  Close it only when the change has a key other than `expanded`. Test first in `tests/ui/score-browser/dialog.test.ts`:
  an `expanded`-only event leaves the overlay open, a `folder` event closes it. T010 (d) passes

**Checkpoint**: Verify the US1 and US2 Independent Tests with `pnpm screenshot`: a fresh profile (five entries,
nothing open), and the rail with *Learning* open and *Keys* closed while *C major* is chosen (the marker), in the
Night and Paper themes. Look at the PNGs. Full gate `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`
green; log entry; commit.

---

## Phase 4: User Story 3 - Back to my last selected item, without loading it (Priority: P2)

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)
**Goal**: On index load the path to the chosen folder opens and the selection is scrolled into view. Opening an item
selects it (also for *My files*), reveals its folder, and moves the folder only when needed. Nothing is loaded on
start.
**Independent Test**: spec US3. Select *C major > Introduction* without opening it, collapse *Learning*, reload:
*Learning* and *Keys* are open, *C major* is chosen, *Introduction* is selected and in view, and no Score is loaded.

### Tests (write first, confirm they fail)

- [x] T014 [P] [US3] Store tests in `tests/ui/score-browser/open-rules.test.ts` (extend):
  1. stored folder `section:learning/keys/c-major` with `expanded: []` -> after the first `indexLoaded`,
     `expanded` is `['learning', 'learning/keys']` and is persisted (US3 #1, #3, FR-010, clarification 3);
  1b. then collapse *Learning* with `setView`, call `startRefresh()` and `indexLoaded` again (as after a reset), and
     also `close()`, `open()`, `indexLoaded`: *Learning* stays collapsed each time (R-4 first load only, US2 #2,
     analyze M1);
  2. `revealSelection` is true after `indexLoaded` with a stored selection, false without one, and false after
     `selectionRevealed()` (R-8);
  3. `openSucceeded` for a library item opened from folder *All* sets `selected`, keeps the folder `all`, and adds its
     section's ancestors to `expanded` (FR-016, US3 #6);
  4. `openSucceeded` for a library item while a different key folder is chosen moves the folder to the item's section
     (R-5);
  5. `openSucceeded` for a *My files* ref while a section is chosen sets `selected` to the file ref and the folder to
     `myFiles` (US3 #5, FR-012);
  6. a stored selection whose item no longer exists (a library id not in the index; a `fileKey` not in `files`) ->
     after `indexLoaded` `view.selected` is `null` and persisted, `revealSelection` is false, the folder is kept,
     and `message` is null (US3 #4, FR-013, R-8, analyze M2); with `indexFailed` a library selection is kept and a
     missing file selection is cleared. The "remembered folder gone" half of FR-013 is already covered by 013's
     `tests/core/browser/view-state.test.ts`; say so in the log (analyze L6);
  7. `setView({ selected })` (list click, search, *Continue*) never changes `expanded` (FR-016, clarification 2);
  8. `fileOpened(ref)` with the store `closed` and with it `ready`: sets `selected` to the file ref, moves a section
     folder to `myFiles`, keeps *All*/*Continue*, persists, and leaves `phase` unchanged (FR-012, US3 #5, R-5,
     analyze H1).
  Fails today: no reveal, no `revealSelection`, no `fileOpened`, and file refs are not selected on open
- [x] T015 [P] [US3] Scroll tests in the new file `tests/ui/score-browser/reveal-selection.test.ts`: with
  `revealSelection` true, `mx-browser-list` calls `scrollIntoView({ block: 'nearest' })` once on the selected row and
  calls `browserState.selectionRevealed()`, and `mx-browser-rail` scrolls the chosen folder into view; focus does not
  move (R-8). Fails today: no such behaviour
- [x] T016 [P] [US3] e2e in `tests/e2e/score-browser-tree.spec.ts` (extend, after T010): (a) seed a record with folder
  `learning/keys/c-major`, selected `learning/keys/c-major/introduction` and `expanded: []`, then load: *Learning* and
  *Keys* are expanded, *C major* has `aria-selected="true"`, the *Introduction* row is selected and inside the list's
  visible box, the detail pane shows its title, no Score is rendered in the score area, and the Listen transport is
  not playing (US3 #1, #2, FR-011, SC-003); (b) open *Au clair de la lune* from a search under *All*, reload: *All*
  is chosen, the item is selected, and *Learning > Keys* is expanded (FR-016); (c) open a MusicXML fixture file via
  *Open file...* while a key folder is chosen, reload: *My files* is chosen and that file is selected, not loaded
  (US3 #5); (d) seed a record whose selected library id does not exist, then load: the detail pane shows its
  nothing-selected state and there is no `role="alert"` message (US3 #4, analyze M2). Also add one case to
  `tests/e2e/score-browser-timing.spec.ts`: with a seeded selection inside a collapsed path, the browser with the
  revealed path and selected row appears within the same 300 ms budget its existing cases use (013 SC-002; SC-003,
  analyze M3). Fails today: no reveal, and the file is not selected

### Implementation

- [x] T017 [US3] `src/ui/state/browserState.ts` per data-model.md §3: in `indexLoaded`, call `revealPath` for a
  section folder **on the first successful load only** (private `startRevealDone`), clear a `selected` that no longer
  exists (R-8), and persist when either changed; add `revealSelection` to `BrowserSnapshot` (initial value, `reset`)
  and `selectionRevealed()`; implement the open rule as one private method used by `openSucceeded` and the new
  `fileOpened(ref)` (data-model.md §3), with `inFolder`, the item's `sectionId` from
  `data.index.items`, and `revealPath`, for library and file refs; update the method comments (the old "A *My files*
  ref ... is left as the view had it" no longer holds). T014 passes
- [x] T024 [US3] In `Session.openFile` (`src/app/session.ts`), call `browserState.fileOpened(fileRef(file.name))`
  after a successful `loadBytes` and before `browserState.close()`, whether the browser was open or closed; no other
  change (R-5, analyze H1). The direct-open part of T016 (c) passes
- [x] T018 [US3] Scroll into view in `src/ui/elements/mx-browser-list.ts` and `src/ui/elements/mx-browser-rail.ts`
  (R-8). T015 and T016 pass

**Checkpoint**: Verify the US3 Independent Test via T016 and `pnpm screenshot` after seeding the record (look at the
PNG: path open, item selected, empty score area); full gate green; log entry; commit.

---

## Phase 5: User Story 4 - Ready to follow me to other devices later (Priority: P3)

**Model**: light (gemini-3.7-flash or claude-haiku-4-5; every standard and deep model fits too)
**Goal**: The remembered state is one documented, versioned record with a single reader and writer.
**Independent Test**: spec US4 (review). The record matches contracts/browser-view.md §5, and only `browserState.ts`
reads or writes it.

- [x] T019 [US4] Run `rg -n "BROWSER_VIEW_STORAGE_KEY|musicanyya.browser.v1" src` and record the output in the log. It
  must list only `src/ui/state/browserState.ts`; otherwise stop and ask. If `rg` is not installed, use
  `git grep -n -E "BROWSER_VIEW_STORAGE_KEY|musicanyya.browser.v1" -- src` (analyze L5). Then add one assertion to
  `tests/e2e/score-browser-tree.spec.ts` case (b) of T010: the stored record has `version` 1 and exactly the six
  `view` fields of contracts/browser-view.md §5, and record the run in the log (US4 #1). US4 #2 is covered by T005

**Checkpoint**: US4 review recorded in the log.

---

## Phase 6: Polish & Cross-Cutting

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)

- [x] T020 Run every check of `specs/018-browser-tree-collapse/quickstart.md` "Manual verification" (US1-US4) with
  `pnpm screenshot` and the dev build. Store the PNGs in `tests/.generated/018/`, look at each one, and log the result
  per step
- [ ] T021 [deep] Constitution audit of the full diff `main..018-browser-tree-collapse` with the
  `constitution-auditor` agent; summarise its findings in the log and fix every finding or turn it into a task
- [ ] T022 [light] Full gate `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` on the final commit; record
  each summary line and exit code in the log
- [ ] T023 [light] Update `docs/agents/reference.md` only if a command or setup changed (none expected; record "no
  change" in the log), and set **Status** in `specs/018-browser-tree-collapse/spec.md` to `Implemented`

## Additions found while implementing

- [x] T026 [light] Add a `--storage <key>=<json>` option to `tools/dev/screenshot.ts` (repeatable): before the first
  navigation it stores that `localStorage` value only when the key has no value yet (same `addInitScript` shape as
  `--theme`), and list it in the option comment at the top of the file and in `docs/agents/reference.md` ("Running and
  seeing the app", the `pnpm screenshot` examples). Needed by the Phase 3 and 4 checkpoints and by T020, which must
  look at a rail with a seeded `musicanyya.browser.v1` record (a chosen folder under a closed parent). Check by running
  it with `--storage 'musicanyya.browser.v1={...}'` and reading the PNG

## Dependencies & Execution Order

- Setup (T001-T003) -> Foundational (T004-T008) -> US1+US2 (T009-T013) -> US3 (T014-T018) -> US4 (T019) -> Polish
  (T020-T023).
- T002 (contracts) comes before any code (contract first). T003 comes before T007 (`validateExpanded` uses the
  constant).
- T007 before T008 (types first). T013 runs after T011 (it adapts tests to the new rail).
- US3 needs the rail reading `view.expanded` (T011) and persistence (T008). US4 (T019) needs T010.
- T025 needs T011 (the rail dispatches the toggle events) and has the next free number after T024; it runs in Phase 3
  before the checkpoint.
- T018 and T024 need T017 (`revealSelection`, `fileOpened`). T016 extends the file T010 creates. T024 has the next
  free number (after T023) but belongs to Phase 4 and runs before its checkpoint.

## Parallel Opportunities

- Phase 1: T002 and T003.
- Phase 2: T004, T005 and T006 (three test files).
- Phase 3: T009 and T010; T012 (CSS) alongside T011.
- Phase 4: T014, T015 and T016 (three files); then T018 and T024 in parallel after T017 (different files).
