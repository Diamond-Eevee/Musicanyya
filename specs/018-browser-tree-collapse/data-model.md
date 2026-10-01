# Data Model: Collapsible Browser Folder Tree (018)

Extends 013's [data-model.md](../013-score-browser-progress/data-model.md) sections 7 and 8. Everything not named
here is unchanged.

## 1. Browser view state (persisted) - 013 section 7 + `expanded`

```ts
interface BrowserViewState {
  folder: FolderSel;
  search: string;
  filters: { level; key; tag; status };
  sort: { by; dir };
  selected: ItemRef | null;
  expanded: readonly string[];   // NEW (018): section ids of the open rail folders, sorted, unique
}
```

- Default: `expanded: []` (every folder collapsed, FR-007).
- Stored as `localStorage` `musicanyya.browser.v1` = `{ version: 1, view }` (format: [contracts/browser-view.md]
  (contracts/browser-view.md) 1.1.0). A stored `view` without `expanded` (013) reads as `[]` (R-1).
- Validation (`validateExpanded(raw, sections)`, R-3), applied per field like the rest of the view:
  - not an array -> `[]`; non-string entries dropped; at most `BROWSER_EXPANDED_MAX` entries kept (the first ones);
  - `sections` known (non-empty): each id is replaced by the section that has it in `formerIds` when it is not a
    current id; ids matching no section are dropped; the result is sorted (code-unit order) and unique;
  - `sections` empty (index not loaded / unavailable): ids kept as they are (deduplicated, sorted), so an outage never
    erases the tree state.
- Only section ids appear. *Continue*, *All* and *My files* have no sub-folders and are never in `expanded`.
- A section id in `expanded` that has no sub-folders in the current tree is harmless and kept: it shows no disclosure
  control and is not "expanded" in the UI.

## 2. Tree-state helpers (pure, `src/core/browser/tree-state.ts`)

| Function | Result |
|---|---|
| `validateExpanded(raw: unknown, sections: readonly LibrarySection[]): string[]` | Section 1 rules |
| `isExpanded(expanded, sectionId): boolean` | membership |
| `setExpanded(expanded, sectionId, open: boolean): string[]` | new sorted, unique array; the same array when unchanged |
| `ancestorsOf(sectionId, sections): string[]` | parent chain, root first, without `sectionId`; stops at an unknown parent or a cycle (as `buildSectionTree` does) |
| `revealPath(expanded, sectionId, sections): string[]` | `expanded` plus `ancestorsOf(sectionId)`; the same array when nothing was added (R-4) |
| `containsChosen(sectionId, chosen: FolderSel, sections): boolean` | true when `chosen` is a section strictly below `sectionId` (R-7 marker); the rail passes `effectiveFolder(view)`, so there is no marker during a search |

`inFolder(item, folder)` in `src/core/browser/query.ts` is exported (unchanged logic) for R-5.

Because "the same array when unchanged" holds, callers can skip persisting and re-rendering when nothing changed.

## 3. Browser UI state (session only) - 013 section 8 additions

New snapshot field: `revealSelection: boolean`. It is a one-shot request for the list and rail to scroll the restored
selection and chosen folder into view (R-8).

| Transition | Change (new in 018) |
|---|---|
| `indexLoaded` (loading -> ready) | view validated with real sections (incl. `expanded`); `selected` cleared when it names a library item not in `index.items` or a file not in `files` (R-8); **only on the first successful load of the app run** (private `startRevealDone`, then set true): if `folder` is a section, `expanded = revealPath(expanded, folder.id)` (R-4); persist when `selected` or `expanded` changed; `revealSelection = (selected !== null)` |
| `indexFailed` | `expanded` kept as stored (no sections, R-3); a file `selected` not in `files` is cleared, a library one is kept; `startRevealDone` unchanged; `revealSelection = (selected !== null)` |
| `openSucceeded` (opening -> closed) | the open rule below, for `openingRef` (library **and** file refs) (R-4, R-5) |
| `fileOpened(ref)` (NEW, any phase, phase unchanged) | the open rule below, for a direct file open (*Open file...*, drop; called by `Session.openFile` on a successful load, before `close()`) (R-5) |
| `setView({ expanded })` | validated against known sections and persisted (rail toggle, name click, keyboard) |
| `selectionRevealed()` | `revealSelection = false` |
| `reset()` | `revealSelection = false`, view back to defaults |

**The open rule** (one private method used by both transitions): `selected = ref`. When the chosen folder does not
list the item (`inFolder` false), `folder` becomes the item's section (library) or `myFiles` (file). For a library
item, `expanded = revealPath(expanded, item.section)`. The result is persisted. A library item is looked up in
`data.index.items` by `ref.id`; if it is not found (the index was not loaded), only `selected` is set.

## 4. Rail entry (render model, `mx-browser-rail`)

`RailEntry` gains `containsChosen: boolean`. `expanded` now comes from `view.expanded` (`hasChildren &&
isExpanded(view.expanded, id)`) instead of the element's private `collapsed` set, which is removed.

## 5. Named constants added

| Constant | Value | Where | Meaning |
|---|---|---|---|
| `BROWSER_EXPANDED_MAX` | 512 | `src/core/defaults.ts` | Most open-folder ids kept from a stored view (R-3) |
