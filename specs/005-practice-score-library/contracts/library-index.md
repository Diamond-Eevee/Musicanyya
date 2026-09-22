# Contract: library content formats (`item.json` + generated `index.json`)

**Version**: `1.0.0` - new. Two related formats: the **authored item metadata** written beside every
score, and the **generated index** the app actually reads.

**Owner**: `tools/library/build-index.ts` (writes), `src/core/library/index-model.ts` (reads and
validates), `src/engine/library/http-catalog.ts` (fetches).

**Location**: `public/library/index.json`; sidecars at `public/library/<path>/<name>.json` beside
`<name>.musicxml` or `<name>.mxl`.

---

## 1. Authored item metadata (`<name>.json`)

Everything a human decides. Never generated, never rewritten by a tool.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Musicanyya library item metadata v1",
  "type": "object",
  "required": ["version", "title", "kind", "level", "tags", "provenance", "reviewedBy", "reviewedOn"],
  "additionalProperties": false,
  "properties": {
    "version":   { "const": 1 },
    "title":     { "type": "string", "minLength": 1, "maxLength": 200 },
    "subtitle":  { "type": "string", "maxLength": 200 },
    "composer":  { "type": ["string", "null"], "maxLength": 200 },
    "arranger":  { "type": ["string", "null"], "maxLength": 200 },
    "kind":      { "enum": ["exercise", "piece"] },
    "level":     { "enum": ["beginner", "intermediate", "advanced"] },
    "tags":      { "type": "array", "items": { "$ref": "#/$defs/skillTag" }, "minItems": 1, "maxItems": 8 },
    "trains":    { "type": "string", "maxLength": 300 },
    "hands":     { "enum": ["right", "left", "both"] },
    "arrangement": { "type": "boolean", "default": false },
    "provenance": { "$ref": "#/$defs/provenance" },
    "expected":  { "$ref": "#/$defs/expected" },
    "reviewedBy": { "type": "string", "description": "who checked the music itself - a person or an agent id" },
    "reviewedOn": { "type": "string", "format": "date" },
    "raisedBecause": { "type": "string", "maxLength": 300,
                       "description": "required when the assigned level is above the computed one (data-model SS4)" },
    "limitations": { "type": "array", "items": { "type": "string" }, "maxItems": 5,
                     "description": "what the app does not do with this item, e.g. \"written pedal is not played\"" }
  },
  "$defs": {
    "skillTag": {
      "enum": ["chords", "chord-changes", "scales", "arpeggios", "five-finger", "hands-together",
               "hands-separate", "steady-eighths", "dotted-rhythm", "triplets", "ties", "repeats",
               "pedal", "octave-shift", "ornaments", "sight-reading", "dynamics", "phrasing"]
    },
    "provenance": {
      "oneOf": [
        {
          "type": "object",
          "required": ["origin", "licence", "author", "created"],
          "additionalProperties": false,
          "properties": {
            "origin":  { "const": "authored" },
            "licence": { "const": "CC0-1.0" },
            "author":  { "type": "string" },
            "created": { "type": "string", "format": "date" },
            "basedOn": { "type": "string", "maxLength": 300 },
            "note":    { "type": "string", "maxLength": 500 }
          }
        },
        {
          "type": "object",
          "required": ["origin", "licence", "source", "obtained"],
          "additionalProperties": false,
          "properties": {
            "origin":   { "const": "downloaded" },
            "licence":  { "enum": ["CC0-1.0", "public-domain"] },
            "source":   { "type": "string", "format": "uri" },
            "sourcePath": { "type": "string" },
            "obtained": { "type": "string", "format": "date" },
            "credit":   { "type": "string", "maxLength": 300 },
            "unmodified": { "type": "boolean", "default": true },
            "note":     { "type": "string", "maxLength": 500 }
          }
        }
      ]
    },
    "expected": {
      "type": "object",
      "description": "Load notices this item is known to produce (FR-023). An unlisted notice fails the sweep.",
      "additionalProperties": false,
      "properties": {
        "notices": { "type": "array", "items": { "type": "string" } }
      }
    }
  }
}
```

**Rules**

- `licence` accepts only `CC0-1.0` and `public-domain` (FR-017). Any other value fails the licence
  check - it is not a warning.
- `origin: "downloaded"` **requires** `source` and `obtained`, and the file must also appear in
  `THIRD_PARTY_NOTICES.md` (FR-020); the licence test asserts both.
- `credit` is shown wherever the item is shown when present, even though CC0 requires no attribution
  (FR-019, US4 scenario 3).
- `arrangement: true` must be reflected in `title` or `subtitle` (FR-007), e.g. "Fur Elise (main
  theme, arranged for this app)".
- `reviewedBy` / `reviewedOn` record who checked the *music* - the level check is arithmetic and
  cannot hear a wrong note (data-model SS4.1). `raisedBecause` is required whenever the assigned level
  sits above the level the criteria compute, and the licence test enforces its presence.
- `limitations` is shown with the item. It exists for honest gaps, e.g. Satie's written pedal, which
  the engine does not schedule.
- `hands` is authored, not derived: which hands the learner is *meant* to use can differ from which
  staves carry notes (an exercise may rest one hand deliberately).

## 2. Generated index (`index.json`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Musicanyya library index v1",
  "type": "object",
  "required": ["version", "generated", "sections", "items"],
  "additionalProperties": false,
  "properties": {
    "version":   { "const": 1 },
    "generated": { "type": "string", "format": "date-time" },
    "sections": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "title", "path"],
        "additionalProperties": false,
        "properties": {
          "id":       { "type": "string", "pattern": "^[a-z0-9-]+(/[a-z0-9-]+)*$" },
          "title":    { "type": "string" },
          "description": { "type": "string" },
          "path":     { "type": "string" },
          "parent":   { "type": ["string", "null"] },
          "order":    { "type": "integer" }
        }
      }
    },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "section", "file", "bytes", "hash", "meta", "facts"],
        "additionalProperties": false,
        "properties": {
          "id":      { "type": "string", "pattern": "^[a-z0-9-]+(/[a-z0-9-]+)*$" },
          "section": { "type": "string" },
          "file":    { "type": "string", "description": "path relative to library root, URL-encoded on fetch" },
          "bytes":   { "type": "integer", "minimum": 1 },
          "hash":    { "type": "string", "description": "content hash of the score file (engine/files/hash.ts)" },
          "meta":    { "description": "the authored metadata of SS1, verbatim" },
          "facts":   { "$ref": "#/$defs/facts" },
          "levelCheck": { "$ref": "#/$defs/levelCheck" }
        }
      }
    }
  },
  "$defs": {
    "facts": {
      "type": "object",
      "description": "Derived by the generator through readXml + buildScore. Display and filtering only.",
      "required": ["measures", "notes", "durationSeconds", "keys", "metres", "tempoBpm",
                   "lowestMidi", "highestMidi", "maxSpanSemitones", "staves", "shortestDivision",
                   "notesPerBeat", "accidentals", "notices"],
      "properties": {
        "measures":        { "type": "integer" },
        "notes":           { "type": "integer" },
        "durationSeconds": { "type": "number" },
        "keys":            { "type": "array", "items": { "type": "string" }, "description": "e.g. [\"C major\"]" },
        "metres":          { "type": "array", "items": { "type": "string" }, "description": "e.g. [\"4/4\"]" },
        "tempoBpm":        { "type": ["number", "null"] },
        "tempoDefaulted":  { "type": "boolean" },
        "lowestMidi":      { "type": "integer" },
        "highestMidi":     { "type": "integer" },
        "maxSpanSemitones":{ "type": "integer", "description": "largest simultaneous interval within one hand" },
        "staves":          { "type": "integer" },
        "handsWithNotes":  { "enum": ["right", "left", "both"] },
        "shortestDivision":{ "type": "integer", "description": "1 = whole, 4 = quarter, 16 = sixteenth ..." },
        "notesPerBeat":    { "type": "number" },
        "accidentals":     { "type": "integer", "description": "key-signature accidentals, max over the piece" },
        "hasTies":         { "type": "boolean" },
        "hasTuplets":      { "type": "boolean" },
        "hasGraceNotes":   { "type": "boolean" },
        "hasOctaveShift":  { "type": "boolean" },
        "hasRepeats":      { "type": "boolean" },
        "hasPedal":        { "type": "boolean" },
        "fingeringCoverage": { "type": "number", "minimum": 0, "maximum": 1 },
        "notices":         { "type": "array", "items": { "type": "string" } }
      }
    },
    "levelCheck": {
      "type": "object",
      "required": ["level", "pass", "failed"],
      "properties": {
        "level":  { "enum": ["beginner", "intermediate", "advanced"] },
        "pass":   { "type": "boolean" },
        "failed": { "type": "array", "items": { "type": "string" }, "description": "criterion ids that failed" }
      }
    }
  }
}
```

## 3. Reading rules (`src/core/library/index-model.ts`)

- **Per item, not per file**: an item that fails validation is **skipped and reported** as a notice;
  the rest of the library still lists (FR-022 spirit, Principle VII rule).
- A `version` that is not `1` is a hard stop: the whole index is rejected with one notice, and the
  app behaves as if no library shipped (the Open button and recents still work).
- Unknown fields are ignored, never fatal - a newer index must not break an older build beyond the
  fields it understands.
- `facts` are **never** used for playback, timing or grading. They exist for the list, the filters
  and the level check. The Score the app plays always comes from parsing the file itself.
- Item ids are stable: they are the path under `public/library/` without the extension. Renaming a
  file is a breaking change to a user's recents and to any future Advice anchor, so it is a
  deliberate act, not a refactor.

## 4. Generation and verification

- `pnpm library:index` regenerates `index.json` from the files on disk.
- `tests/library/index.test.ts` regenerates it in memory and asserts byte equality with the committed
  file (minus `generated`), so a forgotten regeneration fails CI (FR-025).
- `tests/library/licence.test.ts` asserts: every score file has a sidecar; every sidecar validates;
  every `downloaded` item appears in `THIRD_PARTY_NOTICES.md`; no file is 0 bytes (FR-021); every
  item carries `reviewedBy`/`reviewedOn`, and any item whose assigned level exceeds its computed one
  carries `raisedBecause`.
- `tests/library/sweep.test.ts` loads every item and asserts `facts.notices` equals
  `meta.expected.notices` (FR-023) and that the load produced no error (FR-022).
- The same suites also assert, so that FR-025 has teeth beyond the obvious cases:
  - **counts**: at least 24 chord exercises and 12 chord-change drills (SC-004), and the repertoire
    spread of FR-008 including more than one composer and more than one key signature per level;
  - **shelf size**: the total bytes of `public/library/` stay inside the SC-008 budget (FR-026);
  - **not silent**: every item has at least one sounding note (FR-021);
  - **labelled arrangements**: `arrangement: true` requires the word in `title` or `subtitle`
    (FR-007);
  - **content-only extensibility**: a temporary item written into a copy of the tree appears in a
    regenerated index with no source change (FR-016).
- These suites live under `tests/library/`, which needs its own project in `vitest.config.ts` - the
  config filters by explicit include globs, so a new folder is invisible to `pnpm test` until it is
  registered.

## 5. Versioning

MINOR for added optional fields and new `skillTag` values; MAJOR for a removed or retyped field, or a
change to how ids are formed. The app reads `version` first and refuses anything it does not know.
