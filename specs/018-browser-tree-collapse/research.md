# Research: Collapsible Browser Folder Tree (018)

No new dependency, Web API or asset. Every decision below builds on feature 013's score browser
(`src/ui/elements/mx-browser-rail.ts`, `src/ui/state/browserState.ts`, `src/core/browser/view-state.ts`).

## R-1. Where the tree state is stored

**Decision**: Add one optional field, `expanded: string[]` (section ids of the open folders, sorted and unique), to
the existing `BrowserViewState`. It is saved under the existing `localStorage` key `musicanyya.browser.v1`, whose
payload stays `{ version: 1, view }`. A payload with no `expanded` (written by 013) reads as `[]`, which means
everything is collapsed.

**Rationale**: The 013 record already holds the chosen folder and the selected item and is validated field by field
(`validateViewState`), so one record now covers FR-015's "one versioned record, read and written as a whole". The
change only adds a field. An older build reading the new payload ignores `expanded` and keeps working (safe rollback),
and a 013 payload upgrades in place with nothing lost (US4 #2). Storing the *open* folders, rather than the collapsed
ones, makes "start collapsed" (FR-007) and "new folders appear collapsed" (FR-009) the natural default. There is no
separate first-use flag: with no saved state the result (everything collapsed except the selection's ancestors) is
the same as with an empty `expanded`.

**Alternatives considered**: (a) A new key `musicanyya.browser.v2` with a one-off migration. Rejected: it leaves a dead
key behind and gains nothing over an optional field. (b) A separate key just for the rail. Rejected: it splits the
record FR-015 wants kept whole and doubles the storage handling. (c) Payload `version: 2`. Rejected: an older build
rejects version 2 and loses the whole view (folder, filters, selection) on rollback.

## R-2. Who owns the tree state

**Decision**: The open/closed state moves from the rail's private `collapsed` set (013: session only) into
`browserState.view.expanded`. The rail only renders it and asks for changes with `browserState.setView({ expanded })`
plus the existing bubbling `browserviewchange` event, exactly as it already does for `folder`. The pure helpers
(toggling, ancestor paths, validation against sections and their `formerIds`) live in `src/core/browser/tree-state.ts`
and are tested in Node.

**Rationale**: One store already persists the view (013 FR-006). Principle V keeps the logic in core with no DOM, and
the keyboard and the pointer then change the same state (FR-004).

**Alternatives considered**: Keeping the set in the element and persisting it from there. Rejected: a second source
of truth, untestable in Node, and lost whenever the element is recreated.

## R-3. Validating stored ids

**Decision**: `validateExpanded(raw, sections)` keeps strings only and caps them at `BROWSER_EXPANDED_MAX` (512)
entries. When `sections` is non-empty, each id is mapped to its current section (a section whose `formerIds` names it
replaces it), unknown ids are dropped, and the result is sorted and unique. When `sections` is empty (index not loaded
yet, or the library is unavailable), the stored ids are kept as they are, so a library outage does not erase the state
(edge case "Library unavailable"). `setView` re-validates with the known sections, as it already does for `folder`.

**Rationale**: This mirrors `currentSectionFolder` (013 R-15, 011 FR-020). The cap keeps a corrupt or hostile payload
from growing without bound; the real library has about 100 sections.

**Alternatives considered**: Dropping unknown ids even when no sections are known. Rejected: an offline start would
wipe the remembered tree.

## R-4. Revealing the selection (app start and opening)

**Decision**: `revealPath(expanded, sectionId, sections)` adds every ancestor of `sectionId` (not the section itself)
to `expanded`. It is applied in two places:
1. In `browserState.indexLoaded`, for the restored chosen folder when it is a section (FR-010, US3 #1 and #3), **only
   on the first successful index load of the app run** (a private `startRevealDone` flag in the store, set by that
   first load). Later loads (reopening the browser, the reload after a progress reset or a seed via `startRefresh`,
   a retry) leave `expanded` alone, so a path the musician collapsed during the session stays collapsed (US2 #2).
2. When an item is opened successfully, for the opened library item's own section (FR-016): in `openSucceeded`
   (browser opens) and in `fileOpened` (direct file opens, R-5; files have no section, so nothing is revealed).

The result is persisted like any other change (clarification 3). Selecting an item (in the list, search results or
*Continue*) does not call it (clarification 2).

**Rationale**: The spec asks for the reveal "on app start" (US3) and for the rail to stay "the way the musician left
it" (US2). Revealing on every load would reopen a path the musician just collapsed whenever the browser reloads its
data (analyze M1). The rule stays in one store and is testable without a DOM.

**Alternatives considered**: Revealing on every index load. Rejected (analyze M1): `startRefresh` after a reset and
every reopen would undo the musician's collapse during the session.
## R-5. The chosen folder after opening an item (US3 #5, FR-012)

**Decision**: Every successful open makes the item the selected item, for library items and *My files* files alike,
on both open paths:
- **Through the browser** (`BrowserSessionController.openItem`): `openSucceeded` sets `selected` for **both** library
  and file refs. Before, it set it for library refs only.
- **Directly** (*Open file...*, a drop, `Session.openFile` in `src/app/session.ts`): this path ends in
  `browserState.close()`, never in `openSucceeded`, and runs while the browser is closed too (analyze H1). On a
  successful load it now calls a new `browserState.fileOpened(ref)` (with `ref = fileRef(file.name)`, whose `fileKey`
  is the same `fileKey(fileName)` the *My files* entry uses) before `close()`. `fileOpened` applies the same rule in
  any phase and does not change the phase.

The rule: if the chosen folder does not list the opened item, the folder changes to the item's own folder (its
section for a library item, *My files* for a file). *Continue* and *All* count as listing every item; *My files*
lists files only; a section counts as listing an item when the item is in that section or anywhere below it. That is
exactly the existing private `inFolder(item, folder)` in `src/core/browser/query.ts`, which is exported and reused
rather than duplicated.
**Rationale**: US3 #5 requires that a restored *My files* selection lands in *My files* with the file selected, and
US3 #1 assumes the restored folder contains the restored item. Without this rule, opening a dropped file while a key
folder is chosen would restore a selection that is invisible. The rule only changes anything when the old folder could
not show the item, so it never moves a musician who opened from *All*, *Continue* or search.

**Alternatives considered**: (a) Leave the folder alone and accept a hidden selection. Rejected: it contradicts US3 #5.
(b) Always switch to the item's own folder. Rejected: it would move a musician away from *Continue* or a search they
are working through.

## R-6. Disclosure control markup and accessibility

**Decision**: Each `treeitem` that has sub-folders begins with a `<span class="browser-rail-toggle" aria-hidden="true">`
showing a chevron drawn in CSS (pointing right when collapsed, down when expanded; rotation without animation under
`prefers-reduced-motion`). Its hit area is at least 24 x 24 CSS px (WCAG 2.2, 2.5.8). Folders without sub-folders get
a blank space of the same width, so labels stay aligned. The state is exposed by the `treeitem`'s existing
`aria-expanded` (FR-017). The span is not focusable, because the WAI-ARIA tree pattern uses Right and Left for that.
A click on the span toggles the folder and stops there; a click anywhere else on the item chooses the folder and, if
it was collapsed, expands it (FR-002, FR-003). The rail keeps its single delegated `click` listener and `patchChildren` rendering
from 013, so a click that lands during an update still arrives.

**Rationale**: This follows the WAI-ARIA APG "Tree View" pattern, and the rail already implements its keyboard model.
A separate focusable button inside a `treeitem` would break that pattern (nested interactive content).

**Alternatives considered**: `<details>`/`<summary>`. Rejected: it does not fit the `role=tree` and roving-tabindex
model 013 already uses.

## R-7. The marker on a collapsed ancestor of the chosen folder (FR-006)

**Decision**: A collapsed folder whose hidden descendant is the chosen folder gets `data-contains-selected` and is
drawn with the selection accent as a left bar that is thinner and dimmer than the selected item's bar, plus a small
filled dot after the label. That gives a shape as well as a colour (Principle VI). For assistive technology a visually
hidden text "contains the chosen folder" is added to the label. `aria-selected` stays false.

**Rationale**: The musician can see where the list they are looking at lives without opening the tree.

**Alternatives considered**: Auto-expanding the path whenever the chosen folder would be hidden. Rejected: it would
undo the musician's collapse straight away (US1 #5 says the collapse sticks).

## R-8. Scrolling the restored selection into view (and a selection that no longer exists)

**Decision**: When `indexLoaded` restores a selection, `browserState` sets a one-shot flag,
`revealSelection: true`, in the session-only snapshot. On their next render, `mx-browser-list` scrolls the selected
row into view and `mx-browser-rail` scrolls the chosen folder into view (`scrollIntoView({ block: 'nearest' })`); the
list then clears the flag with `browserState.selectionRevealed()`. Neither element moves focus: search keeps the focus
as in 013 §5.

Before that, `indexLoaded` checks the restored `selected` against the loaded data. A library ref whose id is not in
`index.items`, or a file ref whose `fileKey` is not in `files`, is cleared to `null` and persisted. The detail pane
then shows its usual "nothing selected" state, and `revealSelection` stays false (FR-013, US3 #4; analyze M2). When
the index failed, library refs are kept, because nothing proves they are gone; file refs are still checked against
`files`.

**Rationale**: FR-010 asks for the item to be scrolled into view. A flag in the store keeps the elements as pure views
and makes the behaviour testable without layout. Clearing a selection that no longer exists keeps the detail pane from
showing a stale or empty item, and keeps the record from carrying a dead reference forever.

**Alternatives considered**: Scrolling on every render. Rejected: it would fight the musician's own scrolling.

## R-9. "Selected, not loaded" on app start

**Decision**: Nothing new loads. The app already starts with the browser open and no Score loaded (013 contract §5,
FR-001). The plan adds only an e2e assertion that after a reload with a stored selection the score area shows no
loaded Score, no Listen transport is running, and the detail pane shows the restored item.

**Rationale**: FR-011 is already true. It needs a regression test, not new code.

## R-10. Future server copy (US4)

**Decision**: No new port in this feature. Reading and writing the record stays in the two functions of
`src/ui/state/browserState.ts` (`loadInitialRawView`, `persistView`), and the record format is documented in
[contracts/browser-view.md](contracts/browser-view.md) 1.1.0 as the unit a later `PreferencesStore` port (behind a
user account) would read and write as a whole.

**Rationale**: Principle VIII, simplicity: a port with one implementation and no second user is speculative. The swap
point is already in one file, and the format is documented and versioned.

**Alternatives considered**: Introducing a `PreferencesStore` port now. Deferred to the feature that adds accounts.

## R-11. Several tabs

**Decision**: The last write wins. A tab does not listen to `storage` events (spec edge case).

**Rationale**: The same as 013's view state and theme. Live sync between tabs is out of scope.
