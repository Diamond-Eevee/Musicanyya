# Contract: song definition (`content/library/songs/*.json`) and `pnpm library:songs`

**Version**: `1.2.0` (1.2.0, 2026-10-03, feature 022-library-basics-chords-songs, MINOR: optional `leftHand.pattern` (`block`, `waltz`, `repeated`, `broken`), `simplifies`, `meta.raisedBecause`, `melody.joinShortBars`, `melody.pickupBeats`; paired songs ordered simplified first; audit rule set `song-chords-v2`. Change request: `specs/022-library-basics-chords-songs/contracts/song-definition-1.2.md`; 1.1.0, 2026-09-26, US3 as built: `meta.composer`; `topVoice` is the highest note of each chord *of the named voice*; the left-hand voicing avoids the melody; a short last bar; the sidecar's `subtitle`; 1.0.0 new).

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
        "transpose": { "type": "string", "pattern": "^[+-](P1|m2|M2|m3|M3|P4|A4|d5|P5|m6|M6|m7|M7|P8)$" },
        "joinShortBars": { "type": "boolean", "default": false, "description": "join a short written bar inside the piece with the bars after it (1.2.0, §2.2)" },
        "pickupBeats": { "type": "number", "exclusiveMinimum": 0, "description": "re-bar the selected bars with a pickup of this many beats, less than one bar (1.2.0, §2.2)" }
      }
    },
    "leftHand": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "pattern": { "enum": ["block", "waltz", "repeated", "broken"], "default": "block" }
      },
      "description": "how the left hand plays each chord (1.2.0, §2.2)"
    },
    "simplifies": { "type": "string", "description": "the id of the song (same folder, level intermediate) this beginner song simplifies; written into the sidecar (library-index 1.5.0) (1.2.0)" },
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
        "raisedBecause": { "type": "string", "description": "written into the sidecar when the assigned level is above the computed one (1.2.0, 022 FR-006)" },
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

### 2.2 Version 1.2.0 (feature 022)

- **Left-hand patterns** (`leftHand.pattern`):
  - `block` - the held block chord of §2 step 3 (the default; songs without `leftHand` stay byte-identical).
  - `waltz` - 3/4 (or 6/8 per dotted beat group): the lowest note of the chord's voicing alone on the first beat of
    the bar (and where the chord starts), the other two notes on the other beats. In root position that is the root;
    where the voicing is inverted to keep off the melody it is the inversion's bass.
  - `repeated` - the block triad struck on every beat (dotted beat in 6/8), each a beat long.
  - `broken` - root, fifth, third, fifth in eighths (6/8: root, fifth, third per dotted beat) from the root-position
    triad of the register rule, an octave lower where it would share a key with the melody (an Alberti bass in close
    position).

  Every pattern keeps the 1.1.0 register and melody-avoidance rules per strike and stays within "comfortable"
  (constitution VII). A pattern other than `block` names itself in the sidecar: the subtitle reads "Arrangement: the
  tune with left-hand <pattern words>" and the first departure "The left-hand <pattern words> is our own (CC0)."
- **Simplified versions**: `simplifies` names a song of the same folder; the builder refuses unless that definition
  exists, is `intermediate` and this one is `beginner` (`meta.level` stays `beginner | intermediate`). A simplified
  song's id ends in `-simplified`, its title in " (simplified)", and its `departures` list what was simplified
  (022 FR-035). `simplifies` is written into the sidecar (library-index 1.5.0).
- **Ordering** (replaces §2 step 6 for paired songs): a simplified song and the song it `simplifies` get consecutive
  `stepOrder` values in their folder, simplified first. Unpaired songs are ordered as in 1.1.0 (Beginner first, then
  Intermediate, each by title) and come first; the pairs follow them, ordered by the full song's title. So the 10
  songs of 1.1.0 (unpaired) keep their `stepOrder`; the builder test pins those 10 values.
- **`meta.raisedBecause`**: copied into the sidecar (022 FR-006, 005 data-model §4).
- **`melody.joinShortBars`** (default `false`): a source may print a phrase end as a bar line inside a bar (Leoni,
  Mutopia 525: `\bar "||"` after beat 3 of a 4/4 bar), so its reading has short written bars in the middle of the
  piece, which §2.1 refuses. With `joinShortBars`, a short bar other than the first is joined with the bars after it
  while together they make at most one bar of the metre, never across a repeat sign or into an ending; the joined bar
  keeps the first bar's start, and the item's bars are numbered in order (0 for a pickup). The melody is unchanged
  note for note, so the audit's melody check is unchanged; the definition's `departures` say the phrase lines are left
  out.
- **`melody.pickupBeats`** (> 0, less than one bar): a source may bar a tune differently from the familiar print (St.
  Anne, Mutopia 1290, starts on beat 1; hymnals give it a one-beat pickup). With `pickupBeats`, the selected bars -
  which must start with a full bar and hold no repeat sign or ending - are cut again: a pickup of that many beats (bar
  0), full bars, and a last bar that completes the pickup. Every note keeps its onset and length (the audit's melody
  check is unchanged); the definition's `departures` say so.
- The id pattern is unchanged.


## 3. Audit (audit-record 1.2; 1.5 for songs built with 1.2.0)

Each song's record has claim `arrangement` and two checks: `mechanical` with aspects `["melody"]`, the source, the
alignment (item staff 1 vs the source staff/voice, `transpose` as defined) and `expectedDifferences: 0`; and
`theory` with `ruleSet: "song-chords-v1"` (every left-hand chord matches its printed name in the shelf key and every
name is in the level's allowed set - research R9). Songs built with song definition 1.2.0 use `ruleSet:
"song-chords-v2"` (audit-record 1.5.0: left-hand notes are grouped by the chord name above them, so `waltz`, `repeated` and `broken`
are checked note by note; the per-bar limit counts chord changes; the Beginner minor set is `i, iv, v, V, VII`);
existing records keep v1.

## 4. Versioning

MINOR for optional fields; MAJOR for a changed id pattern or a changed default.
