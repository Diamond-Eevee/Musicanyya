# Contract: persisted data (IndexedDB + localStorage)

**Version**: IndexedDB schema `1` -> `2` (feature 003, T077) -> **`3`** (feature 013-score-browser-progress),
settings format `1`. Research R-13 (001), R-5/R-6 (013). All data stays on the user's device (FR-030). This file is
the index of every store and key; a feature that adds one documents its own shape in its own contracts and is
cross-referenced here rather than duplicated.

## IndexedDB database `musicanyya` (version 3)

Object store `recentScores`, keyPath `id`, index `byLastOpened` on `lastOpened` - unchanged since version 1. As of
version 3 it is **read only once**, by the progress migration below; nothing writes to it any more (013 R-3, R-20:
`ScoreStore`/`IndexedDbScoreStore` were removed, ports.md 2.0.0).

**Version 2** (feature 003) adds the object store `performances` (kept attempts, FR-041) without ever touching
`recentScores` - full shape, retention rule and failure behaviour in
[specs/003-play-mode-grading/contracts/performance-log.md](../../003-play-mode-grading/contracts/performance-log.md).
`onupgradeneeded` creates only the store that is missing, so a version-1 database upgrades in place; the two
stores' own classes (`IndexedDbPerformanceStore`, and until 013 `IndexedDbScoreStore`) share one open/upgrade path
(`src/engine/storage/db.ts`) so this is true regardless of which one opens the database first.

**Version 3** (feature 013-score-browser-progress) adds four object stores for the `ProgressStore` port: `progress`
(keyPath `scoreKey`), `userFiles` (keyPath `fileKey`), `userFileBytes` (keyPath `hash`) and `meta` (keyPath `key`) -
full shape, migration and adapter rules in
[specs/013-score-browser-progress/contracts/progress-store.md](../../013-score-browser-progress/contracts/progress-store.md)
1.0.0. `onupgradeneeded` again creates only the stores that are missing, so version-1 and version-2 databases both
upgrade in place. Every connection sets `onversionchange = () => db.close()` (013 R-5), so an old tab left open
does not block a later upgrade. A one-shot lazy migration (not run inside `onupgradeneeded`) builds `progress` and
`userFiles` records from the existing `recentScores` and `performances` stores the first time a `ProgressStore`
operation runs; it is recorded in `meta['progressMigration']` so it runs at most once.

```ts
interface RecentScoreRecord {
  id: string;            // lowercase hex SHA-256 of `bytes` (same file -> same entry)
  fileName: string;      // as chosen by the user, UTF-8, non-ASCII allowed
  title: string | null;  // from the Score (work-title / movement-title), for display
  composer: string | null;
  bytes: ArrayBuffer;    // the original file content (.musicxml/.xml/.mxl), <= MAX_FILE_BYTES
  byteLength: number;
  lastOpened: string;    // ISO 8601, set on every successful open
  schema: 1;
}
```

Rules (as they were while `ScoreStore` wrote this store, up to feature 013; now only the migration reads it):

- Written only after a **successful** open (the Score parsed without a fatal error).
- At most `RECENT_SCORES_MAX = 10` records; after `put`, the oldest by `lastOpened` beyond 10 are deleted in the same
  transaction.
- A record whose bytes no longer parse (e.g. after a parser change) is shown with an error on open and can be
  removed; it is never deleted silently.
- Upgrades: `onupgradeneeded` migrates from older versions; an unknown newer version opens read-only and shows a
  `storageNewerVersion` notice.
- Failures (private mode, quota, blocked): `ScoreStore` returned `{ ok: false }`; the UI showed `storageUnavailable`
  once per session; opening files still worked.

## localStorage key `musicanyya.settings.v1`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Musicanyya UI settings v1",
  "type": "object",
  "properties": {
    "version": { "const": 1 },
    "volume": { "type": "integer", "minimum": 0, "maximum": 100, "default": 80 },
    "tempoPercent": { "type": "integer", "minimum": 25, "maximum": 200, "multipleOf": 5, "default": 100 },
    "zoomPercent": { "type": "integer", "minimum": 50, "maximum": 200, "default": 100 },
    "follow": { "type": "boolean", "default": true }
  },
  "required": ["version"],
  "additionalProperties": true
}
```

Rules: read once at start; each field is validated separately and falls back to its default when missing or
invalid; unknown fields are preserved on write; writes are debounced (`SETTINGS_WRITE_DEBOUNCE_MS = 500`).

This version-1 shape is superseded by
[004/contracts/view-settings.md](../../004-score-first-layout/contracts/view-settings.md) (format version 2), whose
2.1.0 (feature 012-tempo-bpm-field) deprecates `tempoPercent`: no longer written, ignored when read. Its 2.2.0
(feature 019-metronome-orchestra-volume) is object version 3: `metronomeLevel` and `orchestraLevel` (integers 0..100,
defaults 100 and 60); versions 1 and 2 still read, the writer always writes 3
([019 mixer-levels.md](../../019-metronome-orchestra-volume/contracts/mixer-levels.md) section 2).

## Other `localStorage` keys (added by later features, documented in their own contracts)

| Key | Feature | Holds | Contract |
|---|---|---|---|
| `musicanyya.practice.v1` | 002 | Practice settings remembered per Score, `PRACTICE_SETTINGS_MAX = 20` | [002 practice-settings.md](../../002-practice-wait-mode/contracts/practice-settings.md) |
| `musicanyya.play.v1` | 003 | Play run settings remembered per Score, `PLAY_SETTINGS_MAX = 20` | [003 performance-log.md](../../003-play-mode-grading/contracts/performance-log.md) |
| `musicanyya.latency.v1` | 003 | The device's one measured Latency profile | [003 performance-log.md](../../003-play-mode-grading/contracts/performance-log.md) |
| `musicanyya.library.v1` | 005/011 | The old library panel's filter state | [005 library-port.md](../../005-practice-score-library/contracts/library-port.md) §3. Superseded by `musicanyya.browser.v1` (013): read once to seed the new key, then left alone, never written again. |
| `musicanyya.browser.v1` | 013 | Score browser view state (folder, search, filters, sort, selection, rail open folders) | [013 score-browser.md](../../013-score-browser-progress/contracts/score-browser.md); record format: [018 browser-view.md](../../018-browser-tree-collapse/contracts/browser-view.md) §5 |
| `musicanyya.theme.v1` | 016 | User theme choice (`{version: 1, choice}`) | [016 theme.md](../../016-modern-look-logo/contracts/theme.md) §2 |

All of the above follow this file's own rule for `musicanyya.settings.v1`: invalid or unparsable content falls back
to built-in defaults and is overwritten on the next write; a storage failure is reported once
(`storageUnavailable`) and never throws. Note: IndexedDB schema remains unchanged at version 3 for feature 016.

## Cache Storage `musicanyya-soundfont-v1`

One entry: the request URL of `soundfonts/GeneralUser-GS-2.0.3.sf2` (relative to the app base). A new SoundFont
version gets a new file name; old cache names are deleted on start.
