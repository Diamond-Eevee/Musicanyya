# Contract: Score browser rail tree state and the persisted view record

**Version**: `1.1.0` of the 013 score-browser contract ([013 score-browser.md](../../013-score-browser-progress/contracts/score-browser.md)
1.0.0 -> **1.1.0**, MINOR: additive field, changed rail default). The changes below are folded into that file by the
implementation tasks (AGENTS.md section 6); this file is the source until then.

## 1. Rail structure and default state (replaces the 013 §1 paragraph "Rail default state")

Rail default state: every folder with sub-folders is **collapsed**, except the ancestors of the chosen folder, which are
expanded when the index first loads in an app run. The open/closed state is part of the persisted view (`view.expanded`) and survives
reloads and restarts. The top-level entries *Continue*, *All*, *Learning*, *Repertoire* and *My files* are always
visible.

Each `treeitem`:

```html
<div role="treeitem" class="browser-rail-item" data-key="section:learning/keys" aria-level="2"
     aria-selected="false" aria-expanded="false" tabindex="-1" style="--browser-rail-depth:1"
     data-contains-selected>                                   <!-- only when a hidden descendant is chosen -->
  <span class="browser-rail-toggle" aria-hidden="true"></span> <!-- only with sub-folders; else .browser-rail-toggle-space -->
  <span class="browser-rail-label">Keys<span class="visually-hidden">, contains the chosen folder</span></span>
  <span class="browser-rail-progress">2 of 109 played, 0 mastered</span>
</div>
```

- `aria-expanded` is present only on folders with sub-folders (FR-001, FR-017).
- `.browser-rail-toggle`: a CSS chevron (right = collapsed, down = expanded), hit area at least 24 x 24 px, colour
  from theme tokens. It is never focusable (R-6).
- `data-contains-selected`: a thinner, dimmer accent bar plus a filled dot after the label (shape and colour, R-7).
  "Chosen" here is the folder the rail shows as selected, i.e. `effectiveFolder(view)`: *All* while a search is
  active (013 US1 #4), so no marker appears during a search.

## 2. Pointer and keyboard (replaces the 013 §4 rail rows)

| Input | Where | Action |
|---|---|---|
| Click / tap on `.browser-rail-toggle` | folder with sub-folders | toggle that folder only: no folder change, list and selection unchanged (FR-002) |
| Click / tap elsewhere on the item | any folder | choose it (list updates); if it has sub-folders and is collapsed, also expand it; never collapses (FR-003) |
| Up / Down / Home / End | rail | move focus between visible folders (unchanged) |
| Right | rail | collapsed -> expand; expanded -> focus its first child (unchanged, now persisted) |
| Left | rail | expanded -> collapse; else focus parent (unchanged, now persisted) |
| Enter / Space | rail | choose the folder and expand it if collapsed (same as a name click) |

Every expand or collapse calls `browserState.setView({ expanded })` and dispatches
`browserviewchange` with `{ view: { expanded } }` (013 §3, persisted).

## 3. Events (013 §3)

`browserviewchange` detail `view: Partial<BrowserViewState>` may now carry `expanded: string[]`. No new events.

## 4. Opening and closing (additions to 013 §5)

- On the first successful index load of an app run, the ancestors of a chosen section folder are expanded and saved.
  Later loads (reopening the browser, the refresh after a reset or seed, a retry) leave the tree as it is (R-4).
- On every index load, a restored selection that no longer exists (library item not in the index, file not in
  *My files*) is cleared silently; an existing one is scrolled into view in the list (and the chosen folder in the
  rail) without moving focus (R-8).
- On a successful open, the item becomes the selected item (library and *My files*), whether it was opened through
  the browser (`openSucceeded`) or directly with *Open file...* or a drop (`fileOpened`, also while the browser is
  closed). If the chosen folder cannot list it, the folder becomes the item's own folder (its section, or *My
  files*). For a library item, the ancestors of its section are expanded and saved (R-4, R-5).
- Restoring never loads a Score or starts audio (FR-011); the app still starts with the browser open and no Score
  loaded.

## 5. Persisted record `musicanyya.browser.v1` (`localStorage`)

```json
{
  "version": 1,
  "view": {
    "folder": { "kind": "section", "id": "learning/keys/c-major" },
    "search": "",
    "filters": { "level": null, "key": null, "tag": null, "status": null },
    "sort": { "by": "library", "dir": "asc" },
    "selected": { "kind": "library", "id": "learning/keys/c-major/introduction" },
    "expanded": ["learning", "learning/keys"]
  }
}
```

- `expanded` is optional (absent = `[]`). Validation: [data-model.md](../data-model.md) section 1. Readers ignore
  unknown fields, so a 013 build reading this record keeps working.
- The record is read and written as a whole, and only by `loadInitialRawView` / `persistView` in
  `src/ui/state/browserState.ts`. This is the unit a later per-user server copy would store (R-10). Write failures
  (storage full or unavailable) are ignored and the session keeps working (FR-014).

## 6. Test hooks (013 §8 additions)

- `.browser-rail-toggle` and `[data-contains-selected]` are stable selectors for unit and e2e tests.
- e2e seeds the record with `localStorage.setItem('musicanyya.browser.v1', ...)` before navigation.
