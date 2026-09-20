# Contract: practice settings (persisted, per Score)

**Version**: practice settings format `1` (new). Also bumps the engine ports contract
(`specs/001-score-viewer-listen/contracts/ports.md`) from `1.0.0` to `1.1.0`: two methods are **added** to
`SettingsStore`, nothing existing changes. The global UI settings format stays at `1` - this feature does **not**
migrate `musicanyya.settings.v1` (R-07).

All data stays on the musician's device (FR-030).

## localStorage key `musicanyya.practice.v1`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Musicanyya practice settings v1",
  "type": "object",
  "properties": {
    "version": { "const": 1 },
    "defaults": { "$ref": "#/$defs/record" },
    "byScore": {
      "type": "object",
      "propertyNames": { "pattern": "^[0-9a-f]{64}$" },
      "additionalProperties": { "$ref": "#/$defs/record" }
    }
  },
  "required": ["version"],
  "additionalProperties": true,
  "$defs": {
    "record": {
      "type": "object",
      "properties": {
        "selection": {
          "type": "object",
          "properties": {
            "preset": { "enum": ["both", "right", "left", "custom"] },
            "partIndex": { "type": "integer", "minimum": 0 },
            "staves": { "type": "array", "items": { "type": "integer" } }
          },
          "required": ["preset", "partIndex", "staves"]
        },
        "loop": {
          "oneOf": [
            { "type": "null" },
            {
              "type": "object",
              "properties": {
                "fromPassIndex": { "type": "integer", "minimum": 0 },
                "toPassIndex": { "type": "integer", "minimum": 0 }
              },
              "required": ["fromPassIndex", "toPassIndex"]
            }
          ],
          "default": null
        },
        "accompaniment": { "type": "boolean", "default": true },
        "help": { "type": "boolean", "default": true },
        "updated": { "type": "string", "format": "date-time" }
      },
      "required": ["updated"],
      "additionalProperties": true
    }
  }
}
```

Field meanings:

- `selection` - the part and staves to practise, plus the preset name (FR-013, FR-025a, FR-034).
- `loop` - the loop range as **measure-pass indices on the unrolled timeline** (`PlaybackTimeline.passes`), not
  written measure numbers, so a looped passage inside a repeat is unambiguous (R-06). `null` means no loop.
- `accompaniment` - whether the unselected hand sounds as the cursor passes it (FR-031, FR-032).
- `help` - whether the stuck-help overlay may appear by itself (FR-023, FR-024).
- `updated` - ISO 8601, rewritten on every save; used for eviction.

## Rules

- **Key**: `byScore` is keyed by the same Score id as the recent-Scores store - the lowercase hex SHA-256 of the
  file bytes (`contracts/storage.md`). The same file therefore keeps its practice settings across sessions, whatever
  the file was renamed to.
- **No id, no persistence**: when the Score was opened without being stored (storage blocked, private mode), the
  session still works with `defaults`; nothing is written and no error is shown beyond the existing
  `storageUnavailable` notice.
- **`defaults`**: the settings last chosen by the musician, applied to a Score that has never been practised. This
  is what makes "I always practise hands separately" survive opening a new piece. A `defaults` record never carries
  a `loop`: pass indices mean something only inside the Score they were set on, so a loop set on one piece must not
  appear on another. (Amended when implemented, T030.)
- **Validation of `selection`**: `preset` in the enum, `partIndex` an integer >= 0, `staves` a non-empty array of
  integers >= 1 (stored ascending, without duplicates). Anything else reads as "no selection". A selection that
  no longer fits the Score (part or staff missing) is the session's concern, not the store's: it falls back to the
  preselected part and both hands.
- **Cap**: at most `PRACTICE_SETTINGS_MAX = 20` entries in `byScore`; on save, entries beyond that are dropped
  oldest-`updated` first. A dropped entry is not an error - the Score falls back to `defaults`.
- **Validation**: every field is validated on read and falls back to its default when missing or invalid; a record
  that is not an object is ignored. A corrupt or unparsable value under the key resets to defaults without
  throwing, exactly as the v1 settings store does.
- **Loop validation on load**: a stored loop is clamped to the current timeline and dropped if it no longer fits
  (for example after the parser changed how a Score unrolls). Dropping a loop never blocks the session.
- **Unknown fields** at the top level and inside a record are preserved on write, so a later feature can add
  fields without destroying data written by this one.
- **Writes** are debounced with the existing `SETTINGS_WRITE_DEBOUNCE_MS = 500` and never throw; a failed write is
  reported once per session as the existing `storageUnavailable` notice.

## Port addition (`SettingsStore`, ports.md 1.1.0)

```ts
export interface PracticeSettings {
  /** null = the musician never chose: the preselected part and both hands apply (FR-025a). */
  selection: { preset: "both" | "right" | "left" | "custom"; partIndex: number; staves: readonly number[] } | null;
  loop: { fromPassIndex: number; toPassIndex: number } | null;
  accompaniment: boolean;
  help: boolean;
}

export interface SettingsStore {
  // ... 1.0.0 members unchanged ...

  /** Practice settings for a Score id, falling back to the musician's last-used defaults, then to the
   *  built-in defaults. `scoreId` null (Score not stored) returns the defaults and never persists. */
  loadPractice(scoreId: string | null): PracticeSettings;

  /** Stores the settings for that Score id and updates the last-used defaults. No-op for a null id. */
  savePractice(scoreId: string | null, settings: PracticeSettings): void;
}
```

Test doubles implement the same two methods; `tests/fakes` gains an in-memory settings store so the matcher and the
session wiring can be tested without `localStorage`.
