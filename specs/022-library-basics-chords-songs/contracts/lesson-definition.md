# Contract: lesson definition (`content/library/lessons/*.json`) and `pnpm library:lessons`

**Version**: `1.0.0` (1.0.0, 2026-10-03, feature 022: new).

**Owner**: `tools/library/build-lessons.ts` + `tools/library/lessons/` (dev-only, Node). **Read by**: nothing at run
time (`tests/architecture/layers.test.ts` keeps `tools/` out of the bundle).

A lesson item = authored notes (CC0) for one Basics lesson or one chord lesson, written explicitly bar by bar.

## 1. Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Musicanyya lesson definition v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["version", "id", "title", "section", "stepOrder", "level", "hands", "tags", "trains", "metre",
               "tempoBpm", "key", "claims", "bars", "author", "reviewedBy", "reviewedOn"],
  "properties": {
    "version":   { "const": 1 },
    "id":        { "type": "string", "pattern": "^(basics|learning/chord-lessons/(single-chords|switches|progressions))/[a-z0-9{}-]+$",
                   "description": "item id; contains \"{key}\" exactly when transpositions is given" },
    "title":     { "type": "string", "maxLength": 80, "description": "may contain {keyName}" },
    "section":   { "type": "string", "description": "must equal the id without its last segment" },
    "stepOrder": { "type": "integer", "minimum": 10, "description": "unique in the section; transposed items get stepOrder + index" },
    "level":     { "enum": ["introduction", "beginner", "intermediate"] },
    "raisedBecause": { "type": "string" },
    "hands":     { "enum": ["right", "left", "both"] },
    "tags":      { "type": "array", "items": { "type": "string" }, "minItems": 1, "description": "SKILL_TAGS (library-index 1.5.0)" },
    "trains":    { "type": "string", "maxLength": 300, "description": "the plain-words explanation (Basics) or what the lesson trains" },
    "scoreText": { "type": "string", "maxLength": 60, "description": "printed in italics above staff 1 at bar 1; required in basics" },
    "metre":     { "type": "string", "pattern": "^\\d+/(2|4|8)$" },
    "tempoBpm":  { "type": "number", "minimum": 30, "maximum": 160, "description": "quarter notes per minute; a 6/8 lesson prints a dotted-quarter mark of tempoBpm / 1.5, which must be a whole number" },
    "key":       { "type": "object", "required": ["tonic", "mode", "fifths"], "description": "the exercise-definition key object" },
    "pickup":    { "type": "boolean", "default": false },
    "claims": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "introduces":  { "type": "array", "items": { "type": "string" }, "description": "notation feature ids (section 3); non-empty in basics unless practice" },
        "singlePitch": { "type": "boolean" },
        "practice":    { "type": "boolean", "description": "basics: the lesson only combines earlier ideas; introduces may be empty" },
        "commonTones": { "type": "array", "items": { "type": "object", "required": ["bar", "beat", "pitch"],
                         "properties": { "bar": { "type": "integer" }, "beat": { "type": "number" }, "pitch": { "type": "string" } } },
                         "description": "a switch keeps this key down (or strikes it again) from the previous chord" }
      }
    },
    "simplifies":  { "type": "string", "description": "the item id (after {key} resolution) this lesson simplifies" },
    "departures":  { "type": "array", "items": { "type": "string" }, "description": "what was simplified; required with simplifies" },
    "transpositions": { "type": "array", "items": { "type": "object", "required": ["slug", "tonic", "mode", "fifths", "interval"] },
                        "description": "one item per entry; interval like \"+P5\" / \"-M2\" from the written key" },
    "bars": {
      "type": "array", "minItems": 1,
      "items": {
        "type": "object", "additionalProperties": false, "required": ["rh", "lh"],
        "properties": {
          "rh": { "type": "string", "description": "staff 1 tokens" },
          "lh": { "type": "string", "description": "staff 2 tokens" },
          "barline": { "enum": ["repeat-start", "repeat-end", "repeat-both", "final"] }
        }
      }
    },
    "author":     { "type": "string", "description": "who wrote the notes (agent id or name); the sidecar's provenance.author (FR-043)" },
    "reviewedBy": { "type": "string" },
    "reviewedOn": { "type": "string", "format": "date" }
  }
}
```

## 2. Token notation (one staff of one bar, tokens separated by spaces)

```
token     := [symbol] head ":" value [dot] [tie] [marks] [finger]
symbol    := "{" chordName "}"              e.g. {C/E} {Dm7} {Bø7}   (printed above staff 1 at this onset)
head      := pitch | "<" pitch (" " pitch)+ ">" | "r" | "R"     (R = whole-bar rest)
pitch     := letter accidental? octave      e.g. C4  F#3  Bb3  (# and b; scientific octave, C4 = middle C)
value     := "w" | "h" | "q" | "e" | "s"    (whole, half, quarter, eighth, sixteenth)
dot       := "."                            (one dot)
tie       := "~"                            (tied to the next note of this staff; equal pitches required)
marks     := ( "(" | ")" | "!" | ">" | "_" )*    slur start, slur end, staccato, accent, tenuto
finger    := "@" digit ( "-" digit )*       fingering; one digit per chord note, bottom to top
```

Example (lesson 16, ties in a bar): `"rh": "C4:h~@1 C4:q C4:q"`, `"lh": "R:w"`.

Rules: durations of a staff add up to the metre (pickup: the first bar is shorter and the last bar completes it);
eighths are beamed by beat by `planEngraving`; a chord's fingering lists one digit per note; a symbol may appear on
either staff's token but is always printed above staff 1. `R` fills its staff's whole bar (its value is not read) and
stands alone in that staff of that bar.

**Fingering** (the library requires a finger on every note of an exercise): a note written without `@` takes the finger
last written for the same pitch on its staff, and the note a tie continues always takes its start's finger; a pitch
whose first note on a staff has no `@` is an error. So an author writes `@` at the first note of each hand position
and at every position change (FR-044), and the builder prints the carried fingers.

## 3. Notation feature ids (`claims.introduces`)

`staff`, `treble-clef`, `bass-clef`, `middle-c`, `whole`, `half`, `quarter`, `eighth`, `sixteenth`, `dotted-half`,
`dotted-quarter`, `whole-rest`, `half-rest`, `quarter-rest`, `eighth-rest`, `tie`, `tie-across-barline`, `slur`,
`staccato`, `accent`, `tenuto`, `metre-4-4`, `metre-3-4`, `metre-2-4`, `metre-6-8`, `pickup`, `repeat`, `steps`,
`five-finger-position`, `left-hand`, `hands-alternate`, `hands-together`, `chord`, `chord-symbol`.

A staff holding only whole-bar rests, and its clef, is not counted as used notation (every item has a grand staff).
Tempo marks, key signatures, bar numbers and the printed explanation are never counted.

## 4. What the tool writes

`pnpm library:lessons` (all) / `--lesson <id>`:

1. Validates every definition (schema, token grammar, bar sums, unique `stepOrder`, `section` = id prefix,
   `scoreText` in basics, `introduces` non-empty in basics unless `practice`, `simplifies` target exists and has a higher level); on any error writes nothing, exits 1,
   listing file, bar and token.
2. Per item (per transposition): one part "Piano", two staves (treble, bass), key, metre, tempo mark
   (`<metronome>` + `<sound tempo>`), the `scoreText` as italic `<words>` above staff 1 at bar 1, chord symbols as
   `<words>` above staff 1, pickup/last bar `implicit`, repeat barlines; then `planEngraving(doc, 'library')`.
3. Writes `public/library/<id>.musicxml` and the sidecar (data-model §3). Never touches a sidecar whose
   `provenance.origin` is `downloaded`; keeps `created` stamps of unchanged items (`tools/library/stamps.ts`).
4. Output is byte-stable for the same definitions (golden + regeneration test).

## 5. Versioning

MINOR for optional fields or new tokens/feature ids; MAJOR for a changed id pattern, token meaning or default.
