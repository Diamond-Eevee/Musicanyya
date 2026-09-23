# Contract: authoritative source manifest (`content/library/sources/<source-id>/source.json`)

**Version**: `1.0.0` - new.

**Owner**: `tools/library/fidelity/sources.ts` (reads and validates). **Written by**: a person or agent when a
source is added, after the owner approved it. **Read by**: the fidelity tool and `tests/library/fidelity.test.ts`.
Never read by the app, never shipped (`content/` is outside `public/`).

## 1. Folder layout

```text
content/library/sources/
  README.md                                  # what may go here (licence rule), how to add a source
  mutopia-931-beethoven-woo59/
    source.json                              # this contract
    fur_Elise_WoO59.ly                       # notation, byte-for-byte as downloaded
    fur_Elise_WoO59.mid                      # sound, byte-for-byte as downloaded
```

Files are committed **unchanged** (hash-checked). A scan (PDF) is **not** committed: it is recorded by URL only
(research R1), because scans are large and a visual check is not re-run by a machine anyway.

## 2. Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Musicanyya authoritative source manifest v1",
  "type": "object",
  "required": ["version", "id", "work", "edition", "publisher", "url", "licence", "obtained", "files", "approvedByOwner"],
  "additionalProperties": false,
  "properties": {
    "version":   { "const": 1 },
    "id":        { "type": "string", "pattern": "^[a-z0-9-]+$", "description": "equals the folder name" },
    "work":      { "type": "string", "maxLength": 200 },
    "edition":   { "type": "string", "maxLength": 200, "description": "the printed edition the source reproduces, e.g. \"Breitkopf & Härtel, 1888\"; \"unknown\" only when the publisher says so" },
    "publisher": { "type": "string", "maxLength": 200 },
    "url":       { "type": "string", "format": "uri" },
    "identifier":{ "type": "string", "maxLength": 100 },
    "licence":   { "enum": ["public-domain", "CC0-1.0"] },
    "credit":    { "type": "string", "maxLength": 300 },
    "obtained":  { "type": "string", "format": "date" },
    "approvedByOwner": { "type": "string", "format": "date" },
    "files": {
      "type": "array", "minItems": 1,
      "items": {
        "type": "object",
        "required": ["role", "url", "format"],
        "additionalProperties": false,
        "properties": {
          "role":   { "enum": ["notation", "sound", "scan"] },
          "path":   { "type": "string", "description": "relative to the source folder; required unless role = scan" },
          "url":    { "type": "string", "format": "uri" },
          "sha256": { "type": "string", "pattern": "^[0-9a-f]{64}$" },
          "format": { "enum": ["lilypond", "midi", "musicxml", "pdf"] },
          "midiOrder": { "enum": ["written", "played"] },
          "midiNoteTracks": { "type": "array", "items": { "type": "integer", "minimum": 0 } }
        }
      }
    }
  }
}
```

## 3. Rules

- `licence` is `public-domain` or `CC0-1.0` only (FR-006). A source whose page shows any other licence (for example
  Mutopia's `Creative Commons Attribution-ShareAlike`) is never added, not even for reference; it is recorded in
  `content/library/sources/README.md` under "Rejected sources" with the reason.
- A file with `path` must have `sha256`; the fidelity test re-hashes it and fails on any change (FR-016).
- `role: "sound"` requires `midiOrder` and `midiNoteTracks`, both established by inspecting the file once and
  recorded, not guessed at every run.
- `approvedByOwner` is the date the owner approved this source (spec assumption; AGENTS.md section 6). A source
  without it may be downloaded to the agent's scratch space for inspection, but may not be committed or cited.
- Every source that an item's MusicXML was **converted from** also appears in `THIRD_PARTY_NOTICES.md` (FR-023).
  A source used only for comparison is listed there too, under a "Reference sources" heading, so every committed
  third-party file is accounted for.

## 4. Versioning

MINOR for new optional fields or file formats; MAJOR for a changed `id` rule or a removed field.
