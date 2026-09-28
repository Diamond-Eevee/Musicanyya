# Contract change: exercise definition 1.2.0 -> 1.3.0

**Changes**: `specs/005-practice-score-library/contracts/exercise-definition.md` (canonical; folded in by the first
generator task of feature 014, then kept here as history).

**Kind**: MINOR. Every 1.2.0 file stays valid and generates byte-identical output (the existing goldens of the
per-key steps and Songs are the guard). `version` stays `1`.

## 1. New hand part `melody` (pattern and key-change forms)

`handPart.oneOf` gains:

```json
{ "type": "object", "additionalProperties": false, "required": ["melody"],
  "properties": { "melody": { "$ref": "#/$defs/melodyPart" } } }
```

```json
"melodyPart": {
  "type": "object", "additionalProperties": false, "minProperties": 1,
  "properties": {
    "major": { "type": "array", "minItems": 1, "items": { "$ref": "#/$defs/melodyPhrase" } },
    "minor": { "type": "array", "minItems": 1, "items": { "$ref": "#/$defs/melodyPhrase" } }
  }
},
"melodyPhrase": {
  "type": "object", "additionalProperties": false, "required": ["position", "notes"],
  "properties": {
    "position": { "type": "integer", "minimum": -3, "maximum": 10,
                  "description": "the step under the thumb at the phrase start (five-finger position)" },
    "notes": { "type": "array", "minItems": 1, "items": { "$ref": "#/$defs/melodyNote" } }
  }
},
"melodyNote": {
  "type": "object", "additionalProperties": false, "required": ["value"],
  "properties": {
    "step":   { "type": "integer", "minimum": -3, "maximum": 10,
                "description": "1 = the key's tonic in octave 4; 8 = the tonic above; 0, -1, -2, -3 = the 7th, 6th, 5th, 4th below" },
    "value":  { "enum": ["whole", "half", "quarter", "eighth", "dotted-half", "dotted-quarter"] },
    "alter":  { "enum": [-1, 0, 1], "default": 0,
                "description": "against the natural scale (major / natural minor); +1 on a minor 6th or 7th = raised" },
    "rest":   { "const": true, "description": "a rest of `value`; `step` must be absent" },
    "finger": { "type": "integer", "minimum": 1, "maximum": 5 },
    "shift":  { "const": true, "description": "the note starts a new hand position; its finger is written" }
  }
}
```

Rules: `melody` is allowed in `right` only, and not in a mirrored section. A note has exactly one of `step` / `rest`.
In a `minor` phrase every note on degree 6 or 7 (steps -1, 0, 6 and 7) states `alter` explicitly (0 or 1).

## 2. Top-level `melody` (chords form, drills only)

```json
"melody": {
  "type": "object", "additionalProperties": false, "required": ["sectionA", "sectionB", "final"],
  "properties": {
    "sectionA": { "$ref": "#/$defs/melodyPart" },
    "sectionB": { "$ref": "#/$defs/melodyPart" },
    "final":    { "$ref": "#/$defs/melodyPart" }
  }
}
```

Allowed only when `family` starts with `changes`. Each part fills its section exactly: `sectionA` one bar per cycle
chord, every bar ending in a quarter rest (where the left hand rests); `sectionB` one bar per cycle chord; `final`
one bar. The right hand's triads are then not written; the left hand is generated exactly as in 1.2.0.

## 3. Generation rules (pure, `src/core/library/exercise/`)

- Variant: item *i* of the family (order of `keys` / `keyPairs`) takes `variants[i mod length]` per section.
- Pitch: tonic in octave 4 (`12 * 5 + tonic pitch class`), letter arithmetic from the tonic letter, alteration from
  the natural scale plus `alter`; every sounding altered note gets its `<accidental>` from the engraving pass.
- Staff 1, voice 1; single notes only (no `<chord/>`); beams completed by the engraving pass as for all items.
- Fingering: computed per note (data-model §1, research R6) and written only on the first note of a phrase, a note
  with `shift`, and a thumb-under / finger-over; `finger` overrides the computed value.
- The words direction of the chord (roman numeral / label) moves to the left hand's staff for sections with a melody
  (placement below), so the right hand's staff shows the melody and its fingering only.
- A part that does not fill its section, a step outside MIDI 21-108, a missing minor `alter`, or `melody` in the left
  hand throws, naming the definition, section, variant and note.
- The build tool (`tools/library/build-exercises.ts`) runs the melody rule check (contract fidelity-tools 1.12
  `checkMelodyRules`) on every generated item with a melody and writes nothing when any finding remains.

## 4. Versioning

MINOR for new optional forms or fields; MAJOR if a 1.2.0 definition would generate different output.
