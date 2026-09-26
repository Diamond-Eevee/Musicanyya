# Contract: exercise definition (`content/library/exercises/*.json`)

**Version**: `1.1.0` (1.0.0 new; 1.1.0, 2026-09-26, feature 011: the `pattern` and `key-change` forms, `step`, `stepOrder`, `fileStem`, `supersedes`, `raisedBecause`, §1a-§2a; change request `specs/011-learning-by-key/contracts/exercise-definition-1.1.md`). Every 1.0.0 file stays valid and generates byte-identical output.

**Owner**: `src/core/library/exercise/` (pure generation), `tools/library/build-exercises.ts`
(writes the generated scores).

**Read by**: nothing at run time. This format exists so that a whole exercise **family** - the same
drill in 24 keys - is defined once and generated, which is what makes FR-005 (identical structure
across keys) true by construction rather than by discipline.

---

## 1. Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Musicanyya exercise definition v1",
  "type": "object",
  "required": ["version", "family", "titleTemplate", "section", "metre", "tempoBpm", "keys", "steps", "meta"],
  "additionalProperties": false,
  "properties": {
    "version": { "const": 1 },
    "family":  { "type": "string", "pattern": "^[a-z0-9-]+$", "description": "file-name stem prefix, e.g. \"triads\"" },
    "titleTemplate": { "type": "string", "description": "e.g. \"{key} triads\" - {key} is substituted" },
    "section": { "type": "string", "description": "index section id, e.g. \"learning/chords\"" },
    "metre":   { "type": "string", "pattern": "^\\d+/\\d+$" },
    "tempoBpm": { "type": "integer", "minimum": 30, "maximum": 200 },
    "beatUnit": { "enum": ["quarter", "eighth", "half", "dotted-quarter"], "default": "quarter" },
    "keys": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/key" },
      "description": "every key this family is generated in"
    },
    "steps": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/step" },
      "description": "the drill, in order; one step = one notated event per hand"
    },
    "repeatBar": { "type": "boolean", "default": false, "description": "engrave a repeat around the steps" },
    "meta": {
      "description": "the item-metadata template (contracts/library-index.md SS1) minus title/provenance.created;
                      the generator fills title from titleTemplate and stamps the generation date"
    }
  },
  "$defs": {
    "key": {
      "type": "object",
      "required": ["tonic", "mode"],
      "additionalProperties": false,
      "properties": {
        "tonic": { "type": "string", "pattern": "^[A-G](#|b)?$" },
        "mode":  { "enum": ["major", "minor"] },
        "fifths": { "type": "integer", "minimum": -7, "maximum": 7,
                    "description": "key signature; authored, never inferred, so remote keys are spelled deliberately" },
        "octaveShift": { "type": "integer", "minimum": -1, "maximum": 1, "default": 0,
                    "description": "moves the whole exercise so a high or low tonic stays inside the hand's range" }
      }
    },
    "step": {
      "type": "object",
      "required": ["degree", "duration"],
      "additionalProperties": false,
      "properties": {
        "degree":   { "type": "string", "description": "roman-numeral degree of the key, e.g. \"I\", \"IV\", \"V\", \"i\", \"iv\", \"V\" (major V in minor is written \"V\")" },
        "quality":  { "enum": ["major", "minor", "diminished", "augmented"],
                      "description": "overrides the quality the degree implies; used for the harmonic-minor dominant" },
        "inversion": { "enum": [0, 1, 2], "default": 0 },
        "duration": { "type": "string", "enum": ["whole", "half", "quarter", "eighth", "dotted-half", "dotted-quarter"] },
        "restAfter": { "type": "string", "enum": ["none", "eighth", "quarter", "half"], "default": "none",
                      "description": "lift time between chords - what makes a chord-CHANGE drill different from a chord exercise" },
        "hands": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "left":  { "$ref": "#/$defs/handPart" },
            "right": { "$ref": "#/$defs/handPart" }
          }
        },
        "label": { "type": "string", "maxLength": 20, "description": "chord name engraved above the step, e.g. \"C\", \"Am\"" }
      }
    },
    "handPart": {
      "type": "object",
      "required": ["voicing"],
      "additionalProperties": false,
      "properties": {
        "voicing": { "enum": ["triad", "root", "root-fifth", "octave", "rest"] },
        "octave":  { "type": "integer", "minimum": 1, "maximum": 7, "description": "scientific octave of the lowest sounding note" },
        "fingering": { "type": "array", "items": { "type": "integer", "minimum": 1, "maximum": 5 },
                       "description": "low note to high note; length must match the voicing's note count" }
      }
    }
  }
}
```

## 2. Generation rules

1. **One definition, many files.** For each entry in `keys`, the generator produces
   `<family>-<key-slug>.musicxml` and its metadata sidecar in `section`'s folder, e.g.
   `public/library/learning/chords/triads-c-major.musicxml`.
2. **Spelling is authored, not computed.** `fifths` fixes the key signature, and degree-to-pitch
   uses that signature, so no key produces a double accidental by accident. A key whose literal
   transposition would need a double sharp or double flat is either given the enharmonic spelling in
   `keys` or left out of the family, and the reason is recorded in the family's README row.
3. **Fingering is part of the definition** (FR-006): every generated note carries
   `<notations><technical><fingering>`. The generator fails loudly if a `handPart` lists a fingering
   whose length does not match its voicing - a silent mismatch would put the wrong finger under a
   note in 24 files at once.
4. **Range guard.** After transposition the generator checks every sounding pitch against the
   88-key range and against the family's declared comfortable range; `octaveShift` is how a key is
   brought back in, and an uncorrectable key is an error, never a quietly transposed file.
5. **Determinism.** Generation depends only on the definition: no timestamps inside the MusicXML, no
   random ids, notes in a fixed order. Re-running `pnpm library:exercises` on an unchanged definition
   produces byte-identical files, which is what lets the golden snapshots mean something.
6. **The generator never writes outside its family's folder**, and never touches a file whose sidecar
   says `provenance.origin` is `downloaded`.
7. **Generated output is completed** (feature 006): before it is returned, every generated file is piped
   through `planEngraving(doc, 'library')` + `applyInserts` (`specs/006-beamed-note-engraving/contracts/
   engraving-completion.md`) - `<beam>` for eighths and shorter, `<accidental>` wherever the printed
   pitch would otherwise read wrong. `planEngraving` on an already-generated file must plan zero
   inserts (determinism, rule 5, still holds - completion is deterministic too).

---

## 1.1.0 additions (feature 011)

### 1a. New and changed top-level properties

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

`meta.level` gains `introduction`. `meta.tags` may include `key-changes`. `meta` gains optional `raisedBecause`
(string, copied to every generated sidecar): required when the step's level is above the level `checkLevel` computes for
any generated key (library-index rule, analyze A3); the generator's tests fail when it is missing or superfluous.

Rules:

- `form: "chords"` (default) = 1.0.0 behaviour; `steps` required, `sections`/`keyPairs` forbidden.
- `form: "pattern"` requires `keys` and `sections`; forbids `steps` and `keyPairs`.
- `form: "key-change"` requires `keyPairs` and `sections`; forbids `keys` and `steps`; every section names `inKey`.
- `step` present => `fileStem` required and `section` must contain `{key}` or `{pair}`.

### 1b. `$defs`

```json
"section": {
  "type": "object", "additionalProperties": false, "required": ["bars", "right", "left"],
  "properties": {
    "bars":     { "type": "integer", "minimum": 1, "maximum": 16 },
    "inKey":    { "enum": ["from", "to"], "description": "key-change form only" },
    "label":    { "type": "string", "maxLength": 60, "description": "words direction at the section start; {scale} becomes \"major scale\", \"harmonic minor scale\" or \"melodic minor scale\"" },
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
          "form":  { "enum": ["harmonic", "melodic"], "description": "the minor form a minor key uses; a major key always uses the major scale" },
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
                   "description": "the duration is the whole entry: broken = root-third-fifth-third in four equal notes (a whole becomes four quarters); root-fifth = root then fifth in two equal notes" },
    "label":     { "type": "string" },
    "minor":     { "type": "object", "additionalProperties": false,
                   "properties": { "degree": { "type": "string" }, "quality": { "enum": ["major", "minor", "diminished", "augmented"] }, "inversion": { "enum": [0, 1, 2] }, "label": { "type": "string" } },
                   "description": "what the chord is in a minor key when it differs from the major key's (I -> i, ii -> iv), so one definition serves all 24 keys" }
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

### 2a. Generation rules (pure, `src/core/library/exercise/generate.ts`)

- Bars within a section are filled left to right; the parts of both hands in a section must each fill exactly
  `bars x measure length` (the generator throws, naming the definition and section, otherwise).
- Scale spelling: letter arithmetic from the tonic (`scales.ts`); harmonic minor raises 7, melodic raises 6 and 7 going
  up and restores them going down; every altered note carries `<accidental>`. Fingering from the table in data-model §6.
- Register: data-model §5 (tonic octave per key; a chord's bass is the unique pitch of its bass pitch class in [anchor-7, anchor+4], the anchor being the tonic chord's root, T-12 left and T+12 right; so I sits at the anchor and IV and V below it; `octaveShift` no longer applies to pattern sections).
- Key-change form: the generator writes `<key>` (with `<cancel>` when accidentals disappear) in the first bar of the first
  `inKey: "to"` section when the fifths differ; the preceding bar ends light-light; a words direction names the new key.
- Titles: `{key} - introduction` etc. (key-change: `{from} to {to} - introduction`) - the theory check parses them.
- Output passes `planEngraving(doc, 'library')` with no inserts left (as 1.0.0).

## 3. Verification

- `tests/core/library/exercise/*.test.ts`: pure tests of degree-to-pitch, inversion, fingering length
  and the range guard, written before the generator (Principle IV).
- Golden snapshots of the generated MusicXML for a representative set of keys (C major, F# major,
  Eb minor, A minor) - a diff in any of them is a deliberate review, not a surprise.
- Round-trip: every generated file is fed through `readXml` + `buildScore` in the same test run, and
  the resulting notes are compared with the degrees the definition asked for. This is what stops a
  writer bug from producing plausible-looking but wrong music.
- The generated files then face the ordinary library gates (sweep, licence, level check) like any
  other item, plus the engraving guard (`tests/library/engraving-guard.test.ts`, feature 006 FR-012):
  `planEngraving(doc, 'library')` must yield no inserts.
- `tests/core/library/exercise/engraving.test.ts` (feature 006): every generated item, for every
  definition, plans zero engraving inserts on its own.

## 4. Versioning

MINOR for new optional step or hand fields and new voicings; MAJOR for a changed degree notation or a
changed file-naming rule (ids would move, and ids are stable by contract).
