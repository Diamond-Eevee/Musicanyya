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
1. In `browserState.indexLoaded`, for the restored chosen folder when it is a section (FR-010, US3 #1 and #3). This runs
   every time the index loads, which means app start and each time the browser is opened. Only the path to the chosen
   folder is affected, and that path is visible anyway unless the musician collapsed it after choosing it.
2. In `browserState.openSucceeded`, for the opened library item's own section (FR-016).

The result is persisted like any other change (clarification 3). Selecting an item (in the list, search results or
*Continue*) does not call it (clarification 2).

**Rationale**: With one rule in one store, start-up and opening behave the same, and the rule is testable without a
DOM.

**Alternatives considered**: Revealing only on the first load per session. Rejected: it needs a session flag and makes
a reopen behave differently from a reload for no benefit to the musician.

## R-5. The chosen folder after opening an item (US3 #5, FR-012)

**Decision**: `openSucceeded` sets `selected` for **both** library and *My files* refs. Before, it set it for library
refs only. If the chosen folder does not list the opened item, the folder changes to the item's own folder: its
section for a library item, *My files* for a file. *Continue* and *All* count as listing every item; a section counts
as listing it when the item is in that section or anywhere below it. That is exactly the existing private
`inFolder(item, folder)` in `src/core/browser/query.ts`, which is exported and reused rather than duplicated.

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

## R-8. Scrolling the restored selection into view

**Decision**: When `indexLoaded` restores a selection, `browserState` sets a one-shot flag,
`revealSelection: true`, in the session-only snapshot. On their next render, `mx-browser-list` scrolls the selected
row into view and `mx-browser-rail` scrolls the chosen folder into view (`scrollIntoView({ block: 'nearest' })`); the
list then clears the flag with `browserState.selectionRevealed()`. Neither element moves focus: search keeps the focus
as in 013 §5.

**Rationale**: FR-010 asks for the item to be scrolled into view. A flag in the store keeps the elements as pure views
and makes the behaviour testable without layout.

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
