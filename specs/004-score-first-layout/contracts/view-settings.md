# Contract: view settings (`musicanyya.settings.v1`, format version 2)

**Version**: `2.0.0` - MAJOR, because the `zoomPercent` field is renamed to `scale` and a required
`overlays` object is added. Supersedes the settings section of
[`001/contracts/storage.md`](../../001-score-viewer-listen/contracts/storage.md); the storage **key**
is unchanged, so no user loses their settings.

**Owner**: `src/engine/storage/local-settings-store.ts`, `src/engine/ports.ts` (`UserSettings`)

---

## 1. Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Musicanyya UI settings v2",
  "type": "object",
  "required": ["version"],
  "properties": {
    "version":      { "const": 2 },
    "volume":       { "type": "integer", "minimum": 0,  "maximum": 100, "default": 100 },
    "tempoPercent": { "type": "integer", "minimum": 25, "maximum": 200, "multipleOf": 5, "default": 100 },
    "scale":        { "type": "integer", "minimum": 50, "maximum": 200, "multipleOf": 10, "default": 100 },
    "follow":       { "type": "boolean", "default": true },
    "overlays": {
      "type": "object",
      "properties": {
        "cursor":    { "type": "boolean", "default": true },
        "marks":     { "type": "boolean", "default": true },
        "advice":    { "type": "boolean", "default": true },
        "pianoKeys": { "type": "boolean", "default": false },
        "notices":   { "type": "boolean", "default": true }
      },
      "additionalProperties": false
    }
  }
}
```

## 2. Reading rules (unchanged in spirit)

- Every field is validated **on its own**; anything invalid or missing falls back to its default.
- Unknown fields are preserved on save, so a newer build's settings survive an older build.
- Unparsable JSON, or storage that throws, yields all defaults and one `storageUnavailable` notice.

## 3. Migration from version 1

| Stored | Loaded as |
|---|---|
| `version: 1` with a valid `zoomPercent` | `scale = zoomPercent`, `version: 2`, default `overlays` |
| `version: 1` without `zoomPercent` | `scale = 100`, default `overlays` |
| no file at all | all defaults |

The migration is silent (no notice) and one-way: the next `save()` writes `version: 2` and drops
`zoomPercent`. A user who downgrades gets the default size back, which is acceptable for a UI
preference and is stated here so the behaviour is not a surprise.

## 4. Write policy

Unchanged: debounced by `SETTINGS_WRITE_DEBOUNCE_MS` (500 ms), never throws, one notice per session if
storage is blocked. `openPanel` is **not** persisted (`data-model.md` section 2).
