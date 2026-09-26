# Contract change: exercise definition 1.0.0 -> 1.1.0

**Changes**: `specs/005-practice-score-library/contracts/exercise-definition.md` (canonical; folded in by the first
generator task, then kept here as history).

**Kind**: MINOR. Every 1.0.0 file (chord-only families) stays valid and generates byte-identical output (the existing
goldens are the guard). `version` stays `1`.

## 1. New and changed top-level properties

```json
"form": { "enum": ["chords", "pattern", "key-change"], "default": "chords" },
"step": { "enum": ["introduction", "beginner", "intermediate", "advanced"] },
"stepOrder": { "type": "integer", "minimum": 0, "maximum": 99, "default": 0 },
"section": { "type": "string",
  "description": "may contain the placeholder {key} (form pattern/chords) or {pair} (form key-change), e.g. learning/keys/{key}" },
"fileStem": { "type": "string", "pattern": "^[a-z0-9-]+$",
  "description": "fixed stem written into every key's folder (e.g. \"introduction\"); when absent the 1.0.0 rule <family>-<key-slug> applies" },
"sections": { "type": "array", "minItems": 1, "items": { "$ref": "#/$defs/section" } },
"keyPairs": { "type": "array", "minItems": 1, "items": { "$ref": "#/$defs/keyPair" } },
"supersedes": { "type": "object", "additionalProperties": { "type": "array", "items": { "type": "string" } },
  "description": "key slug (or pair slug) -> old item ids this generated item replaces; hashes are looked up from the old files by the build tool" }
```

`meta.level` gains `introduction`. `meta.tags` may include `key-changes`.

Rules:

- `form: "chords"` (default) = 1.0.0 behaviour; `steps` required, `sections`/`keyPairs` forbidden.
- `form: "pattern"` requires `keys` and `sections`; forbids `steps` and `keyPairs`.
- `form: "key-change"` requires `keyPairs` and `sections`; forbids `keys` and `steps`; every section names `inKey`.
- `step` present => `fileStem` required and `section` must contain `{key}` or `{pair}`.

## 2. `$defs`

```json
"section": {
  "type": "object", "additionalProperties": false, "required": ["bars", "right", "left"],
  "properties": {
    "bars":     { "type": "integer", "minimum": 1, "maximum": 16 },
    "inKey":    { "enum": ["from", "to"], "description": "key-change form only" },
    "label":    { "type": "string", "maxLength": 60, "description": "words direction at the section start, e.g. \"A - right hand: scale, left hand: chords\"" },
    "barline":  { "enum": ["regular", "light-light", "light-heavy"], "default": "regular", "description": "barline at the section end" },
    "mirror":   { "type": "integer", "minimum": 0,
                  "description": "index of an earlier section to repeat with the hands swapped (scale an octave lower in the left hand, chords an octave higher in the right); right/left must then be {\"mirror\": true}" },
    "right":    { "$ref": "#/$defs/handPart" },
    "left":     { "$ref": "#/$defs/handPart" }
  }
},
"handPart": {
  "oneOf": [
    { "type": "object", "additionalProperties": false, "required": ["scale"],
      "properties": { "scale": {
        "type": "object", "additionalProperties": false, "required": ["form", "shape", "value"],
        "properties": {
          "form":  { "enum": ["major", "harmonic", "melodic"] },
          "shape": { "type": "array", "items": { "type": "integer", "minimum": 1, "maximum": 8 }, "minItems": 1,
                     "description": "scale degrees in order, 1 = tonic, 8 = tonic an octave up; one entry per note" },
          "value": { "enum": ["whole", "half", "quarter", "eighth"] },
          "lastValue": { "enum": ["whole", "half", "quarter"], "description": "value of the final note, e.g. the closing whole note" }
        } } } },
    { "type": "object", "additionalProperties": false, "required": ["chords"],
      "properties": { "chords": { "type": "array", "minItems": 1, "items": { "$ref": "#/$defs/patternChord" } } } },
    { "type": "object", "additionalProperties": false, "required": ["mirror"], "properties": { "mirror": { "const": true } } },
    { "type": "object", "additionalProperties": false, "required": ["rest"], "properties": { "rest": { "const": true } } }
  ]
},
"patternChord": {
  "type": "object", "additionalProperties": false, "required": ["degree", "duration"],
  "properties": {
    "degree":    { "type": "string", "description": "as ExerciseStep.degree, e.g. I, V, vi, ii, iv, VI" },
    "quality":   { "enum": ["major", "minor", "diminished", "augmented"] },
    "inversion": { "enum": [0, 1, 2] },
    "duration":  { "enum": ["whole", "half", "quarter", "eighth", "dotted-half", "dotted-quarter"] },
    "voicing":   { "enum": ["triad", "broken", "root-fifth"], "default": "triad",
                   "description": "broken = 1-3-5-3 in the duration's value; root-fifth = alternating root and fifth" },
    "label":     { "type": "string" }
  }
},
"keyPair": {
  "type": "object", "additionalProperties": false, "required": ["from", "to", "relation"],
  "properties": {
    "from":     { "$ref": "#/$defs/key" },
    "to":       { "$ref": "#/$defs/key" },
    "relation": { "enum": ["relative", "parallel"] }
  }
}
```

(`#/$defs/key` is the 1.0.0 key object.)

## 3. Generation rules (pure, `src/core/library/exercise/generate.ts`)

- Bars within a section are filled left to right; the parts of both hands in a section must each fill exactly
  `bars x measure length` (the generator throws, naming the definition and section, otherwise).
- Scale spelling: letter arithmetic from the tonic (`scales.ts`); harmonic minor raises 7, melodic raises 6 and 7 going
  up and restores them going down; every altered note carries `<accidental>`. Fingering from the table in data-model §6.
- Register: data-model §5 (tonic octave per key; chords I at T-12 / T+12 with IV and V below; `octaveShift` still applies).
- Key-change form: the generator writes `<key>` (with `<cancel>` when accidentals disappear) in the first bar of the first
  `inKey: "to"` section when the fifths differ; the preceding bar ends light-light; a words direction names the new key.
- Titles: `{key} - introduction` etc. (key-change: `{from} to {to} - introduction`) - the theory check parses them.
- Output passes `planEngraving(doc, 'library')` with no inserts left (as 1.0.0).

## 4. Versioning

MINOR for new optional forms or fields; MAJOR if a 1.0.0 definition would generate different output.
