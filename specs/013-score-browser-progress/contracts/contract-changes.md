# Contract changes to earlier features (feature 013)

Each change is applied to the named contract file with the version bump shown, as part of the implementation tasks
(AGENTS.md section 6: contract first, then code). Reasons: [research.md](../research.md).

| Contract | From -> to | Change |
|---|---|---|
| `001/contracts/ports.md` | 1.4.0 -> **1.5.0** (MINOR) | Adds the `ProgressStore` port ([progress-store.md](progress-store.md) 1.0.0). `PerformanceStore` gains `removeByScore(scoreId): Promise<StoreResult<number>>` (R-12). `ScoreStore` is **deprecated**: no longer used at run time (R-20); removal waits for OD-6. |
| `001/contracts/storage.md` | IndexedDB schema 2 -> **3** | Index entry: version 3 adds `progress`, `userFiles`, `userFileBytes`, `meta` (full shape in progress-store.md section 2); `recentScores` is read once by the migration and never written again. New `localStorage` key `musicanyya.browser.v1` (score-browser view state, R-15). `musicanyya.library.v1` is read once to seed it, then no longer written. |
| `003/contracts/performance-log.md` | performance record schema 1, **additive** | `StoredPerformance` gains optional `complete?: boolean` (true = reached the end, false = stopped early), written from now on; absent = "not recorded" (R-6). Schema number stays 1: every old record is valid. |
| `002/contracts/practice-session.md` | 1.6.0 -> **1.7.0** (MINOR) | New effect `{ type: 'loopCompleted' }`, emitted when the loop wraps after its last event was **played** (not skipped) (R-9). Existing effects unchanged. |
| `004/contracts/ui-shell.md` | 1.0.0 -> **1.1.0** (MINOR) | The bar's *Open* control opens the Score browser (a modal `<dialog>` outside sessions, R-1), not the file chooser; the browser is not a `PanelId` and has its own run rule (R-2). Menu: Score > "Recent scores" becomes "Open..." (browser) and "About this score" (the `scores` panel, now only `mx-score-source`). |
| `005/contracts/library-port.md` | 1.2.0 -> **1.3.0** (MINOR) | Port unchanged. The panel sections (§2-§4 "Panel behaviour", filter state) are superseded by the Score browser ([score-browser.md](score-browser.md)); `filterItems`, `buildSectionTree` and step order stay and are reused. Settings adoption via `supersedes` unchanged; progress also follows `supersedes` (data-model.md section 6). |
| `009/contracts/play-display.md` | 2.0.0 -> **2.1.0** (MINOR) | `playState` gains `newBest: boolean` shown by `mx-grade-panel` (FR-016). |

Engine constants (`src/engine/config.ts`) and core defaults (`src/core/defaults.ts`) gain the constants in data-model.md
section 11; `RECENT_SCORES_MAX` was removed with the deprecated `IndexedDbScoreStore` (T092/OD-6; ports.md 2.0.0).
