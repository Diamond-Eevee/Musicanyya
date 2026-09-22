# Contract: exercise definition (`content/library/exercises/*.json`)

**Version**: `1.0.0` - new.

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

## 3. Verification

- `tests/core/library/exercise/*.test.ts`: pure tests of degree-to-pitch, inversion, fingering length
  and the range guard, written before the generator (Principle IV).
- Golden snapshots of the generated MusicXML for a representative set of keys (C major, F# major,
  Eb minor, A minor) - a diff in any of them is a deliberate review, not a surprise.
- Round-trip: every generated file is fed through `readXml` + `buildScore` in the same test run, and
  the resulting notes are compared with the degrees the definition asked for. This is what stops a
  writer bug from producing plausible-looking but wrong music.
- The generated files then face the ordinary library gates (sweep, licence, level check) like any
  other item.

## 4. Versioning

MINOR for new optional step or hand fields and new voicings; MAJOR for a changed degree notation or a
changed file-naming rule (ids would move, and ids are stable by contract).
