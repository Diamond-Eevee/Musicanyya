# Contract: persisted data (IndexedDB + localStorage)

**Version**: IndexedDB schema `1` -> **`2`** (feature 003, T077), settings format `1`. Research R-13. All data
stays on the user's device (FR-030). This file is the index of every store and key; a feature that adds one
documents its own shape in its own contracts and is cross-referenced here rather than duplicated.

## IndexedDB database `musicanyya` (version 2)

Object store `recentScores`, keyPath `id`, index `byLastOpened` on `lastOpened` - unchanged since version 1.

**Version 2** (feature 003) adds the object store `performances` (kept attempts, FR-041) without ever touching
`recentScores` - full shape, retention rule and failure behaviour in
[specs/003-play-mode-grading/contracts/performance-log.md](../../003-play-mode-grading/contracts/performance-log.md).
`onupgradeneeded` creates only the store that is missing, so a version-1 database upgrades in place; the two
stores' own `IndexedDbScoreStore` and `IndexedDbPerformanceStore` classes share one open/upgrade path
(`src/engine/storage/db.ts`) so this is true regardless of which one opens the database first.

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

Rules:

- Written only after a **successful** open (the Score parsed without a fatal error).
- At most `RECENT_SCORES_MAX = 10` records; after `put`, the oldest by `lastOpened` beyond 10 are deleted in the same
  transaction.
- A record whose bytes no longer parse (e.g. after a parser change) is shown with an error on open and can be
  removed; it is never deleted silently.
- Upgrades: `onupgradeneeded` migrates from older versions; an unknown newer version opens read-only and shows a
  `storageNewerVersion` notice.
- Failures (private mode, quota, blocked): `ScoreStore` returns `{ ok: false }`; the UI shows `storageUnavailable`
  once per session; opening files still works.

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

## Other `localStorage` keys (added by later features, documented in their own contracts)

| Key | Feature | Holds | Contract |
|---|---|---|---|
| `musicanyya.practice.v1` | 002 | Practice settings remembered per Score, `PRACTICE_SETTINGS_MAX = 20` | [002 practice-settings.md](../../002-practice-wait-mode/contracts/practice-settings.md) |
| `musicanyya.play.v1` | 003 | Play run settings remembered per Score, `PLAY_SETTINGS_MAX = 20` | [003 performance-log.md](../../003-play-mode-grading/contracts/performance-log.md) |
| `musicanyya.latency.v1` | 003 | The device's one measured Latency profile | [003 performance-log.md](../../003-play-mode-grading/contracts/performance-log.md) |

All three follow this file's own rule for `musicanyya.settings.v1`: invalid or unparsable content falls back to
built-in defaults and is overwritten on the next write; a storage failure is reported once (`storageUnavailable`)
and never throws.

## Cache Storage `musicanyya-soundfont-v1`

One entry: the request URL of `soundfonts/GeneralUser-GS-2.0.3.sf2` (relative to the app base). A new SoundFont
version gets a new file name; old cache names are deleted on start.
