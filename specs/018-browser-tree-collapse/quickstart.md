# Quickstart: Collapsible Browser Folder Tree (018)

Nothing new to install. Commands as in the project README:

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm test -- tests/core/browser tests/ui/score-browser
pnpm test:e2e -- tests/e2e/score-browser-tree.spec.ts
```

Full gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`.

To start fresh, open DevTools > Application > Local storage and delete `musicanyya.browser.v1`, or run
`localStorage.removeItem('musicanyya.browser.v1')` in the console.

## Manual verification

Screenshots: `pnpm screenshot` (the browser is open at start, with no Score loaded). Look at every PNG before
reporting a check as done (AGENTS.md section 8).

### US1 - Collapse and expand

1. Start fresh and click the triangle before *Learning*: it opens and shows *Keys* and *Key changes*, both closed. The
   list does not change.
2. Click the name *Keys*: it becomes the chosen folder, lists its items, and opens. Click *Keys* again: it stays open.
3. Click the triangle before *Keys*: the key folders hide. The list is unchanged.
4. Choose *C major*, then close *Keys* with its triangle: *Keys* shows the "contains the chosen folder" bar and dot.
5. Keyboard: focus the rail, use Up/Down to reach *Learning*, then Left to close it and Right to open it; Enter on a
   closed folder chooses it and opens it.
6. *Continue*, *All*, *My files* and every key folder show no triangle.

### US2 - Start collapsed and remember

1. Start fresh and reload: the rail shows only *Continue*, *All*, *Learning*, *Repertoire* and *My files*, all
   closed. With a 768 px tall window, the whole rail is visible without scrolling (SC-001).
2. Open *Learning* and *Keys*, close *Repertoire*, then reload: the same folders are open.
3. In the console, set `expanded` to `["learning", "no/such/section"]` in the stored record and reload: *Learning* is
   open and nothing else changes; no error appears.
4. Set the stored value to `"{not json"` and reload: everything is closed, no error appears, and toggling still works.

### US3 - Back to the last selected item, without loading it

1. Choose *Learning > Keys > C major*, single-click *Introduction* (do not open it), close *Learning* with its
   triangle, then reload.
2. Expect: *Learning* and *Keys* are open, *C major* is chosen, *Introduction* is selected and shown in the details,
   and the score area is empty (no Score loaded, nothing playing).
3. Open a file from disk (*Open file...*) while a key folder is chosen, then reload: *My files* is chosen and that
   file is selected, not loaded.
4. Choose *All*, search "lune", open *Au clair de la lune*, then reload: *All* is still chosen, the item is selected,
   and *Learning > Keys* (the item's path) is open.

### US4 - Ready for a server copy

Check by review: the record in `localStorage` matches [contracts/browser-view.md](contracts/browser-view.md) §5, and
`loadInitialRawView` / `persistView` are its only reader and writer
(`rg "musicanyya.browser.v1" src` lists only `browserState.ts`).
