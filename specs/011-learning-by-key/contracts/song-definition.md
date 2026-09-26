# Contract: song definition (`content/library/songs/*.json`) and `pnpm library:songs`

**Version**: `1.1.0` (1.1.0, 2026-09-26, US3 as built: `meta.composer`; `topVoice` is the highest note of each chord *of the named voice*; the left-hand voicing avoids the melody; a short last bar; the sidecar's `subtitle`; 1.0.0 new).

**Owner**: `tools/library/build-songs.ts` (dev-only, Node). **Read by**: nothing at run time (layers test).

A song item = the melody of an approved public-domain source (right hand) + our own CC0 block chords (left hand).

## 1. Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Musicanyya song definition v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["version", "id", "title", "source", "melody", "key", "tempoBpm", "chords", "meta"],
  "properties": {
    "version": { "const": 1 },
    "id":      { "type": "string", "pattern": "^learning/keys/[a-z0-9-]+/song-[a-z0-9-]+$", "description": "the item id to write" },
    "title":   { "type": "string", "maxLength": 80 },
    "source":  { "type": "string", "description": "an approved source-manifest id under content/library/sources/" },
    "melody": {
      "type": "object", "additionalProperties": false, "required": ["staff", "voice", "bars"],
      "properties": {
        "staff":     { "type": "integer", "minimum": 1, "description": "source staff (LilyPond staff order)" },
        "voice":     { "type": "string", "description": "source voice name, e.g. \"Soprano\"; the top voice when the staff is polyphonic" },
        "topVoice":  { "type": "boolean", "default": false, "description": "the melody voice holds chords: take the highest note of each chord of the named voice (guitar sources)" },
        "bars":      { "type": "string", "pattern": "^\\d+-\\d+$|^all$" },
        "transpose": { "type": "string", "pattern": "^[+-](P1|m2|M2|m3|M3|P4|A4|d5|P5|m6|M6|m7|M7|P8)$" }
      }
    },
    "key":      { "type": "object", "required": ["tonic", "mode", "fifths"], "description": "the shelf key (after transposition); the exercise-definition key object" },
    "tempoBpm": { "type": "number", "minimum": 30, "maximum": 160 },
    "chords": {
      "type": "array", "minItems": 1,
      "items": {
        "type": "object", "additionalProperties": false, "required": ["bar", "degree"],
        "properties": {
          "bar":       { "type": "integer", "minimum": 0, "description": "written bar of the item (0 = pickup)" },
          "beat":      { "type": "number", "minimum": 1, "default": 1 },
          "degree":    { "type": "string", "description": "I, IV, V, i, iv, VII ..." },
          "quality":   { "enum": ["major", "minor", "diminished", "augmented"] },
          "inversion": { "enum": [0, 1, 2], "default": 0 },
          "until":     { "type": "string", "description": "\"bar:beat\" the chord lasts until; default: the next chord or the end" }
        }
      }
    },
    "meta": {
      "type": "object", "additionalProperties": false, "required": ["level", "trains", "reviewedBy", "reviewedOn"],
      "properties": {
        "level":      { "enum": ["beginner", "intermediate"] },
        "trains":     { "type": "string" },
        "composer":   { "type": "string", "maxLength": 200, "description": "printed as the composer of the item (e.g. \"Traditional (French)\")" },
        "departures": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
        "reviewedBy": { "type": "string" },
        "reviewedOn": { "type": "string", "format": "date" }
      }
    }
  }
}
```

## 2. What the tool writes

`pnpm library:songs` (all definitions) / `pnpm library:songs --song <id>`:

1. Refuses when the source is not approved (`approvedByOwner` missing) - same rule as `library:convert-ly`.
2. Reads the source with the 007 LilyPond reader, takes the melody (staff/voice/bars, `topVoice`, `transpose`) and
   cross-checks it against the source MIDI's matching track (007 §3.4); refuses on any difference.
3. Writes one part, two staves: staff 1 = the melody (with its pickup, ties and repeats as in the source); staff 2 = one
   block triad per chord entry, close position with the root in C3-B3 (lower octave when the triad would pass E4), each
   held until the next chord (tied across barlines, split into standard values), fingering 5-3-1 / 5-3-1 / 5-2-1 by
   inversion; RH melody fingering is left to the arranger's fixed rule: none written (songs are exempt from the 005
   fingering requirement - FR-012 of 011 names exercises only).
4. Chord names as `<direction><words>` above staff 1 at each chord (never `<harmony>`).
5. Tempo mark from `tempoBpm`; key signature from `key`; runs `planEngraving(doc, 'library')` and applies the inserts.
6. Writes the sidecar: `kind: "piece"`, `step: "song"`, `stepOrder` = 10 x the song's position in its folder (beginner
   songs first, then intermediate, each by title), unique per folder (analyze A5), `provenance.note` =
   "Melody from <edition> (<source url>), public domain; left-hand chords our own (CC0)" (analyze A1),
   `tags: ["chords", "hands-together"]`, `arrangement: true`, `departures` (at least "Left-hand block chords are our own
   (CC0)"; plus the transposition when present), `provenance: { origin: "authored", licence: "CC0-1.0", author,
   created, basedOn: <source id> }`, `hands: "both"`.
7. Writes nothing and exits 1 when the chords do not cover every bar from the first full bar to the last.

### 2.1 As built (1.1.0)

- **Bars**: the selected source bars are laid end to end; a range `N-M` renumbers the item from bar 1, `all` keeps the source
  numbers (a pickup is bar 0). Only the first bar (a pickup) and the last bar (the short bar that completes it) may be shorter
  than the metre; both are written `implicit`, so the app raises no measure-length notice. A source with a shorter bar in the
  middle (a pickup inside a repeated section, a first ending) is refused.
- **Melody**: the named `staff` and `voice`; with `topVoice` the highest note of each chord of that voice, without it a chord in
  the voice is refused. Durations are cut at barlines and at chord onsets and written as standard single-dotted values, tied.
- **Left-hand voicing**: the plan's own voicing (root position unless the entry names `inversion`, the root in C3-B3, the
  whole triad an octave lower when its top would pass E4) stands wherever it lies wholly below the melody sounding over the
  chord. Otherwise the builder chooses another inversion (only the named one when the plan names one) or an octave lower,
  preferring a voicing wholly below the melody, then one that never shares a key with it, the nearest to the previous chord's
  register; it refuses when every voicing shares a key with the melody. (Music review 2026-09-26: a held chord tone under the
  same key in the right hand cannot be played by one pianist.)
- **Sidecar**: also `subtitle` "Arrangement: the tune with left-hand block chords" (the library guard, spec FR-007, wants the
  word "arrangement" in the title or subtitle), `arranger` "Musicanyya practice material" and `composer` from `meta.composer`.
- **Tempo**: `tempoBpm` is quarter notes per minute, written as a quarter-note metronome mark also in 6/8.


## 3. Audit (audit-record 1.2)

Each song's record has claim `arrangement` and two checks: `mechanical` with aspects `["melody"]`, the source, the
alignment (item staff 1 vs the source staff/voice, `transpose` as defined) and `expectedDifferences: 0`; and
`theory` with `ruleSet: "song-chords-v1"` (every left-hand chord matches its printed name in the shelf key and every
name is in the level's allowed set - research R9).

## 4. Versioning

MINOR for optional fields; MAJOR for a changed id pattern or a changed default.
