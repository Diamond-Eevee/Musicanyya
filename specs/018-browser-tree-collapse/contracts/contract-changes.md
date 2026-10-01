# Contract changes to earlier features (feature 018)

Applied by the implementation tasks, contract first, then code (AGENTS.md section 6). Reasons: [research.md](../research.md).

| Contract | From -> to | Change |
|---|---|---|
| `013/contracts/score-browser.md` | 1.0.0 -> **1.1.0** (MINOR) | §1 rail default: collapsed and persisted (was: expanded, session only); disclosure control markup and the `data-contains-selected` marker. §3 `browserviewchange` may carry `expanded`. §4 rail rows: pointer toggle; name click, Enter and Space also expand. §5 reveal on index load and on open; `openSucceeded` selects file refs too and may change the folder. Full text: [browser-view.md](browser-view.md). |
| `013/data-model.md` §7, §8 | additive | `BrowserViewState.expanded`; `revealSelection`, `selectionRevealed()`; the `openSucceeded` rule ([data-model.md](../data-model.md)). |
| `001/contracts/storage.md` | `localStorage` table, additive | The row for `musicanyya.browser.v1` names "rail open folders" as well and points to 018 browser-view.md §5. IndexedDB unchanged (version 3). |
