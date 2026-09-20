# Contract: persisted data (IndexedDB + localStorage)

**Version**: IndexedDB schema `1`, settings format `1`. Research R-13. All data stays on the user's device
(FR-030).

## IndexedDB database `musicanyya` (version 1)

Object store `recentScores`, keyPath `id`, index `byLastOpened` on `lastOpened`.

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

## Cache Storage `musicanyya-soundfont-v1`

One entry: the request URL of `soundfonts/GeneralUser-GS-2.0.3.sf2` (relative to the app base). A new SoundFont
version gets a new file name; old cache names are deleted on start.
