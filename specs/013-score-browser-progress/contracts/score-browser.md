# Contract: Score browser element, events and state

**Version**: `1.1.0` (1.0.0 new with feature 013; 1.1.0 with feature 018, MINOR: the rail starts collapsed and its open
folders are persisted, see [018 browser-view.md](../../018-browser-tree-collapse/contracts/browser-view.md))
**Owner**: `src/ui/elements/mx-score-browser.ts` (+ `mx-browser-rail`, `mx-browser-list`, `mx-browser-detail`,
`mx-browser-continue`, `mx-status-badge`), `src/ui/state/browserState.ts`, `src/app/browser-session.ts`.
**Requirements**: FR-001 to FR-007, FR-012 to FR-014, FR-016, FR-018, FR-019, FR-022, FR-025 to FR-028, SC-001,
SC-002, SC-003, SC-007. Research R-1, R-2, R-10, R-12 to R-17, R-20.

The UI renders what the core computes (Principle V): rows, folder summaries, status, trend and suggestions come from
`src/core/browser` and `src/core/progress`. The elements decide nothing and report the musician's choices as events.

## 1. Structure

```text
<mx-score-browser>                               one per app, mounted by session.ts into <mx-app>
  <dialog class="browser" aria-labelledby="browser-title">
    <header>  title "Scores" | search (type=search, label "Search scores") | Open file... | close (x, "Close")
    <div class="browser-toolbar">  filter controls (level, key, skill, status) | active filter chips + Clear all | sort
    <div class="browser-body">
      <mx-browser-rail>     role=tree: Continue, All, Learning > ..., Repertoire > ..., My files  (+ summary per folder)
      <mx-browser-list>     role=listbox of rows, or <mx-browser-continue> when folder = Continue and search empty
      <mx-browser-detail>   role=region "Details": metadata, progress, history, Open, Reset / Remove
    <p class="browser-status" aria-live="polite">   count / empty / change announcements
    <p class="browser-message" role="alert">        load failure of a chosen or dropped file (US3 #5)
```

Rail default state (1.1.0, 018): every folder with sub-folders is **collapsed**, except the ancestors of the chosen
folder, which are expanded when the index first loads in an app run. The open/closed state is part of the persisted
view (`view.expanded`) and survives reloads and restarts. The top-level entries *Continue*, *All*, *Learning*,
*Repertoire* and *My files* are always visible. (1.0.0 text, superseded: every folder expanded, collapsing kept for the
session only.)

Each `treeitem` (018):

```html
<div role="treeitem" class="browser-rail-item" data-key="section:learning/keys" aria-level="2"
     aria-selected="false" aria-expanded="false" tabindex="-1" style="--browser-rail-depth:1"
     data-contains-selected>                                   <!-- only when a hidden descendant is chosen -->
  <span class="browser-rail-toggle" aria-hidden="true"></span> <!-- only with sub-folders; else .browser-rail-toggle-space -->
  <span class="browser-rail-label">Keys<span class="visually-hidden">, contains the chosen folder</span></span>
  <span class="browser-rail-progress">2 of 109 played, 0 mastered</span>
</div>
```

- `aria-expanded` is present only on folders with sub-folders.
- `.browser-rail-toggle`: a CSS chevron (right = collapsed, down = expanded), hit area at least 24 x 24 px, colour from
  theme tokens. It is never focusable.
- `data-contains-selected`: a thinner, dimmer accent bar plus a filled dot after the label (shape and colour). "Chosen"
  is the folder the rail shows as selected, i.e. `effectiveFolder(view)`: *All* while a search is active (US1 #4), so
  no marker appears during a search.

Layout: CSS grid `rail 16rem | list 1fr | detail 22rem` at >= 1024 px. From 768 to 1023 px, the rail becomes a folder
picker button with a breadcrumb in the toolbar. Below 768 px, the detail pane becomes a panel over the list with a
Back button (US1 #6). Below 768 px there is no area outside the dialog, so it closes with its close button or Escape only. No horizontal
scrolling at 320 px and above (e2e checks `scrollWidth <= clientWidth` at 1280,
900, 600 and 360 px). The dialog margin is `--browser-margin` (24 px, 12 px below 1024 px, 0 below 768 px) (FR-002).

## 2. Row and detail content

Row: status badge (shape + text, R-16) | title (bold) and subtitle (composer, or the file name under a title) | folder
path (only in search results, "All", or status filters across folders) | level chip | key | length ("1:20") | best
("92 % correct · 85 % on time", tempo when not 100 %) | last result plus trend arrow. A *My files* row with
`stored === false` shows "file not stored - open it again from disk to play".

Detail: title, composer/arranger, level, keys, measures, length, skills; for library items the source and licence
(the same text as `mx-score-source`, from one shared formatter). Then progress: status with its tooltip, attempt count,
first and last played, last practised with its bars, best (both figures in full words, tempo, strictness, date), last
and previous. Then history: up to 20 results newest first with date, tempo, both figures, scope ("Bars 5-8", "Right
hand"), "Stopped early", "Stopped early: not recorded" for `complete === null`, and "Earlier version of this file".
Then the actions: **Open** (primary), *Reset progress*, and for files *Remove from My files*.

Continue view: up to 8 recent items as cards (status, title, best, "last played 3 days ago"), a *Suggested next* card
(with the reason: "Next step after C major - Introduction"), optionally a *More practice* card, and a welcome with the
first step and a link to *Repertoire > Beginner* when there is no history (US4 #3).

## 3. Events (bubbling `CustomEvent`s handled by `session.ts` -> `BrowserSessionController`)

| Event | Detail | Meaning |
|---|---|---|
| `browseropenitem` | `{ ref: ItemRef }` | open this library item or *My files* entry (double click, Enter, Open, card) |
| `browseropenfile` | `{ file: File }` | *Open file...* or a drop onto the browser |
| `browserclose` | `{}` | close button, Escape (search empty), backdrop click |
| `browserremovefile` | `{ fileKey: string; keepProgress: boolean }` | confirmed inline; starts the undo window |
| `browserresetprogress` | `{ ref: ItemRef }` | confirmed inline; starts the undo window |
| `browserundo` | `{}` | cancel the pending removal or reset |
| `browserretrylibrary` | `{}` | the "Library unavailable" retry |
| `browserviewchange` | `{ view: Partial<BrowserViewState> }` | folder, search, filter, sort, selection or rail open folders (`expanded: string[]`, 018) changed (persisted) |

The controller answers through `browserState`, which the elements subscribe to. `browseropenitem` for a file with
`stored === false` puts the message "file not stored - open it again from disk to play" in the message line and opens
the file chooser. It never fails silently.

## 4. Keyboard (FR-028)

| Key | Where | Action |
|---|---|---|
| `/` | anywhere in the browser, not typing | focus search |
| Escape | search non-empty | clear search (focus stays) |
| Escape | otherwise | close; focus returns to the invoker |
| Click / tap on `.browser-rail-toggle` | rail, folder with sub-folders | toggle that folder only: no folder change, list and selection unchanged (018) |
| Click / tap elsewhere on the item | rail | choose the folder (list updates); if it has sub-folders and is collapsed, also expand it; never collapses (018) |
| Up / Down / Home / End | rail | move focus between visible folders |
| Right | rail | collapsed -> expand; expanded -> focus its first child (persisted, 018) |
| Left | rail | expanded -> collapse; else focus parent (persisted, 018) |
| Enter / Space | rail | choose the folder and expand it if collapsed, same as a name click (list updates, focus stays) (018) |
| Up / Down / Home / End / PageUp / PageDown | list | move the active row (selection follows, detail updates) |
| Enter | list | open the active item |
| Tab / Shift+Tab | everywhere | search -> filters -> sort -> rail -> list -> detail -> close, cyclic inside the dialog |

The app shortcuts (`src/ui/shortcuts.ts`: Space, Escape, size keys) are ignored while the browser is open.

## 5. Opening and closing rules

- `openBrowser(invoker)`: refused (no-op) while a Play run or Practice session is active. If Listen is playing, it
  calls `transportState.pause()` first (R-2). It loads the data (`loading`), restores the view state (FR-006), focuses
  search, and selects the item of the open Score when the view state has no selection.
- The app starts with the browser open when no Score is loaded (FR-001).
- It closes on: successful open of an item or file, `browserclose`, a Play run or Practice session starting
  (`guardPanelsDuringRuns`). Closing never changes the loaded Score, its position or its settings (FR-004).
- (018) On the first successful index load of an app run, the ancestors of a chosen section folder are expanded and
  saved. Later loads (reopening the browser, the refresh after a reset or seed, a retry) leave the tree as it is.
- (018) On every index load, a restored selection that no longer exists (library item not in the index, file not in
  *My files*) is cleared silently; an existing one is scrolled into view in the list (and the chosen folder in the
  rail) without moving focus.
- (018) On a successful open, the item becomes the selected item (library and *My files*), whether it was opened
  through the browser (`openSucceeded`) or directly with *Open file...* or a drop (`fileOpened`, also while the browser
  is closed). If the chosen folder cannot list it, the folder becomes the item's own folder (its section, or *My
  files*). For a library item, the ancestors of its section are expanded and saved.
- (018) Restoring never loads a Score or starts audio; the app still starts with the browser open and no Score loaded.
- A pending undo action survives closing. Its toast ("File removed - Undo") is shown in the notice tray while the
  browser is closed.

## 6. Announcements (`aria-live="polite"`)

"{n} items" after a folder, search or filter change (debounced by `BROWSER_ANNOUNCE_DEBOUNCE_MS`, 300 ms); "No items match these filters" plus a *Clear
filters* button (US5 #2); "{title} removed from My files. Undo available for 8 seconds."; "Progress of {title}
reset."; "New best for {title}" (after a run, when the browser next opens on that item).

## 7. Grade panel addition (FR-016)

`mx-grade-panel` shows a "New best" line with a star shape above the figures when `playState.get().newBest` is true.
It never shows it for a stopped run or a partial scope.

## 8. Test hooks

`data-testid` values: `browser`, `browser-search`, `browser-rail`, `browser-list`, `browser-detail`,
`browser-open-file`, `browser-continue`, `browser-suggested`. 018 adds the selectors `.browser-rail-toggle` and
`[data-contains-selected]`. Row element: `data-ref="library:<id>"` or
`data-ref="file:<fileKey>"`, plus `data-status`. The e2e seam `window` event `e2e-progress-seed` seeds records and files for SC-002/SC-003 measurements. Its detail is a
list of `{ ref, event }` seeds, or `{ files, events }` where each file is `{ fileName, text, title, composer }` (stored
through `putFile`, T086). Like `e2e-midi`, `e2e-ready` and `e2e-synthetic-grade` it is present in every build, the
packaged one included (the Electron e2e depends on that); it is applied through the ordinary `ProgressStore.apply`, so a
seeded history is as valid as a played one. Correction (T090): T094 and this section first said "dev builds only";
no build flag ever removed it.
