# Contract: Score browser element, events and state

**Version**: `1.0.0` (new with feature 013)
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

Layout: CSS grid `rail 16rem | list 1fr | detail 22rem` at >= 1024 px. From 768 to 1023 px, the rail becomes a folder
picker button with a breadcrumb in the toolbar. Below 768 px, the detail pane becomes a panel over the list with a
Back button (US1 #6). No horizontal scrolling at 320 px and above (e2e checks `scrollWidth <= clientWidth` at 1280,
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
| `browserviewchange` | `{ view: Partial<BrowserViewState> }` | folder, search, filter, sort or selection changed (persisted) |

The controller answers through `browserState`, which the elements subscribe to. `browseropenitem` for a file with
`stored === false` puts the message "file not stored - open it again from disk to play" in the message line and opens
the file chooser. It never fails silently.

## 4. Keyboard (FR-028)

| Key | Where | Action |
|---|---|---|
| `/` | anywhere in the browser, not typing | focus search |
| Escape | search non-empty | clear search (focus stays) |
| Escape | otherwise | close; focus returns to the invoker |
| Up / Down | rail | previous / next visible folder |
| Right / Left | rail | open / close folder, or move to first child / parent |
| Enter / Space | rail | select folder (list updates, focus stays) |
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
- A pending undo action survives closing. Its toast ("File removed - Undo") is shown in the notice tray while the
  browser is closed.

## 6. Announcements (`aria-live="polite"`)

"{n} items" after a folder, search or filter change (debounced 300 ms); "No items match these filters" plus a *Clear
filters* button (US5 #2); "{title} removed from My files. Undo available for 8 seconds."; "Progress of {title}
reset."; "New best for {title}" (after a run, when the browser next opens on that item).

## 7. Grade panel addition (FR-016)

`mx-grade-panel` shows a "New best" line with a star shape above the figures when `playState.get().newBest` is true.
It never shows it for a stopped run or a partial scope.

## 8. Test hooks

`data-testid` values: `browser`, `browser-search`, `browser-rail`, `browser-list`, `browser-detail`,
`browser-open-file`, `browser-continue`, `browser-suggested`. Row element: `data-ref="library:<id>"` or
`data-ref="file:<fileKey>"`, plus `data-status`. The e2e seam `window` event `e2e-progress-seed` (dev builds only,
like `e2e-midi`) seeds records and files for SC-002/SC-003 measurements.
