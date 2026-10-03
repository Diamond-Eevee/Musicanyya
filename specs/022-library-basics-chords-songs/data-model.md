# Data Model: Library Basics, Chord Lessons and More Songs (022)

**Date**: 2026-10-03 | **Spec**: [spec.md](spec.md) | **Research**: [research.md](research.md)

All entities are content or dev-time data except §8 (score model) and §1 (level rules, core). Canonical homes after
the feature: level criteria - `specs/005-practice-score-library/data-model.md` §4 (this section is folded in);
constants - `src/core/defaults.ts`.

## 1. Level rules (research R1, owner decision OD-1)

`checkLevel` / `computeLevel` (`src/core/library/levels.ts`) keep criteria 1, 2, 3, 4, 7, 14, 15, 16, 17, 18, 19,
27, 28 unchanged, retire 5, 6, 8, 9, 10, 11, 12, 13, 20, 21, 22, 23, 24, 25 (26 was already allowed everywhere), and
add:

**Criterion 29 - one focus (Introduction only)**. Count the features present; fail when the count exceeds
`INTRODUCTION_FOCUS_FEATURES_MAX` (1):

| Feature id | Present when (facts) |
|---|---|
| `short-notes` | `hasShortNotes` (new fact: a value shorter than a quarter, **not** counting the eighth that completes a dotted-quarter beat in a simple metre - part of `dotted-rhythm` - nor eighths in a compound metre 6/8, 9/8, 12/8 - part of `metre`) |
| `dotted-rhythm` | `hasDottedRhythm` (new fact: a dotted value shorter than a dotted half in a simple metre; a dotted quarter in a compound metre is its beat and belongs to `metre`) |
| `ties` | `hasTies` |
| `repeats` | `repeatKind !== 'none'` |
| `pickup` | `hasPickup` (new fact: the first measure is `implicit` and shorter than the metre) |
| `metre` | any of `metres` outside `INTRODUCTION_SIMPLE_METRES` (`2/4`, `3/4`, `4/4`) |
| `tuplets` | `hasTuplets` |
| `grace-ornaments` | `graceNoteCount + ornamentCount > 0` |
| `accidentals` | `accidentalMarkCount - minorScaleAccidentalCount > 0` **and** `keys.length === 1`; the minor-scale count is subtracted only when the key is minor (a G♯ in C major is chromatic - T008) |
| `pedal` | `hasPedal` |
| `changes` | `keys.length > 1` or `metres.length > 1` or `tempoChanges > 0` |

So a dotted quarter + eighth is one feature (`dotted-rhythm`), and 6/8 with dotted quarters and eighths is one
feature (`metre`) - analyze H2. The list is `INTRODUCTION_FOCUS_FEATURES` (ordered ids) in `src/core/defaults.ts`; the level-check failure lists
criterion `29`. The facts of the retired criteria are still computed and written (display, filters, step order).

**Constants**: removed (no longer read) - `LEVEL_SHORTEST_VALUE_BEATS_MIN`, `LEVEL_LONGEST_RUN_MAX`,
`LEVEL_TEMPO_CHANGES_MAX`, `LEVEL_KEY_FIFTHS_MAX`, `LEVEL_KEY_CHANGES_MAX`, `LEVEL_KEY_CHANGE_EXERCISE_MAX`,
`LEVEL_ACCIDENTALS_PER_16_MEASURES_MAX`, `LEVEL_METRES`, `LEVEL_METRE_CHANGES_MAX`, `LEVEL_TIE_CHAIN_NOTES_MAX`,
`LEVEL_TIE_BARLINES_MAX`, `LEVEL_TUPLETS`, `LEVEL_GRACE_NOTES_PER_4_MEASURES_MAX`,
`LEVEL_ORNAMENTS_PER_4_MEASURES_MAX`, `LEVEL_REPEAT_KINDS`, `LEVEL_BACKWARD_REPEATS_MAX`, `LEVEL_PEDAL` (a constant
still imported elsewhere stays, with its comment saying it no longer gates levels). Added -
`INTRODUCTION_FOCUS_FEATURES_MAX = 1`, `INTRODUCTION_FOCUS_FEATURES`, `INTRODUCTION_SIMPLE_METRES`.

**Existing items (FR-006)**: every item whose computed level falls below its assigned level gains `raisedBecause`
(generated exercises through their definition's meta; songs through `meta.raisedBecause` in the song definition,
song-definition 1.2.0; downloaded pieces in their sidecar). Assigned levels never change.

## 2. Sections (research R2)

| id | title | parent | order | description |
|---|---|---|---|---|
| `basics` | Basics | - | 1 | Reading music from the first note: note lengths, rests, ties, slurs, time. |
| `learning` | Learning | - | 2 (was 1) | unchanged |
| `repertoire` | Repertoire | - | 3 (was 2) | unchanged |
| `learning/chord-lessons` | Chords | `learning` | 3 | Chords one at a time, switching between two, then progressions. |
| `learning/chord-lessons/single-chords` | One chord | `learning/chord-lessons` | 1 | One chord type and its inversions. |
| `learning/chord-lessons/switches` | Chord switches | `learning/chord-lessons` | 2 | From one chord to another with the least movement. |
| `learning/chord-lessons/progressions` | Progressions | `learning/chord-lessons` | 3 | Common chord sequences, in several keys. |

Defined in `tools/library/sections.ts` (`LIBRARY_SECTIONS`). No `formerIds`. The id `learning/chords` stays a former
id of Keys.

## 3. Lesson definition (contract [lesson-definition.md](contracts/lesson-definition.md))

One JSON file per lesson (or per transposed family) in `content/library/lessons/`. Fields: `id` (item id, or id
template with `{key}` when `transpositions` is given), `title`, `section`, `stepOrder`, `level`, `hands`, `tags`,
`trains` (explanation, <= 300 chars), `scoreText` (<= 60 chars, printed at bar 1; required in `basics`), `metre`,
`tempoBpm`, `key`, `pickup`, `claims` (what the independent check verifies), `simplifies` (optional item id),
`departures` (for a simplified lesson), `reviewedBy`/`reviewedOn`, `bars` (array; each `{ rh, lh, barline? }` token
strings), optional `transpositions` (keys).

**Validation**: every bar's token durations add up to the metre (the pickup bar and the matching last bar may be
shorter, both written `implicit`); every token parses; `stepOrder` unique per section; a `basics` lesson has
`scoreText`; in `basics`, `claims.introduces` is non-empty unless `claims.practice` is true (a lesson that only
combines earlier ideas, e.g. lessons 4 and 21); ids match `^(basics|learning/chord-lessons/[a-z-]+)/[a-z0-9-]+$`.

**Generated item**: `.musicxml` + sidecar `.json` beside it (library-index 1.5.0): `kind: "exercise"`, no `step`,
`stepOrder` from the definition, `provenance: { origin: "authored", licence: "CC0-1.0", author, created, note:
"Generated by tools/library/build-lessons.ts from content/library/lessons/<file> (contract lesson-definition 1.0.0);
never hand-edit" }`, `simplifies` when set. One part, two staves (criterion 27); a staff a lesson does not use holds
whole-bar rests.

## 4. Basics curriculum (spec FR-010 - FR-014)

Teaching order = `stepOrder` 10, 20, ... All Introduction, tempo 60 unless noted (50-72 range), one focus each
(criterion 29). Pitch: middle C (C4) unless noted; right hand unless noted; fingering on the first note and every
position change.

| # | id (`basics/...`) | Title | Introduces (`claims.introduces`) | Single pitch | Hands |
|---|---|---|---|---|---|
| 1 | `middle-c-quarter-notes` | Middle C and the beat | staff, treble clef, middle C, quarter note, 4/4 | yes | right |
| 2 | `half-notes` | Half notes | half note | yes | right |
| 3 | `whole-notes` | Whole notes | whole note | yes | right |
| 4 | `mixing-note-lengths` | Whole, half and quarter | (none new: combines 1-3) | yes | right |
| 5 | `quarter-rests` | Quarter rests | quarter rest | yes | right |
| 6 | `half-and-whole-rests` | Half and whole rests | half rest, whole rest | yes | right |
| 7 | `three-four-time` | Three beats in a bar | 3/4 | yes | right |
| 8 | `dotted-half-notes` | Dotted half notes | dotted half note | yes | right |
| 9 | `steps-c-d-e` | Steps: C, D, E | steps, fingers 1-2-3 | no | right |
| 10 | `five-finger-position` | Five fingers, five notes | C position C-G | no | right |
| 11 | `bass-clef-left-hand` | Bass clef and the left hand | bass clef, left hand (C3 position) | no | left |
| 12 | `hands-take-turns` | Hands take turns | hands alternating | no | both |
| 13 | `hands-together` | Hands together | hands together (slower hand's onsets inside the faster's) | no | both |
| 14 | `eighth-notes` | Eighth notes | eighth note (pairs, beamed) | yes | right |
| 15 | `dotted-quarter-and-eighth` | Dotted quarter and eighth | dotted quarter + eighth | yes | right |
| 16 | `ties-in-a-bar` | Ties: hold, don't play again | tie within a bar | yes | right |
| 17 | `ties-across-the-bar-line` | Ties across the bar line | tie across a bar line | yes | right |
| 18 | `ties-and-slurs` | Tie or slur? | slur (different pitches) vs tie | no | right |
| 19 | `legato` | Legato: connected notes | (none new: the slur of 18 as a legato phrase; practice) | no | right |
| 20 | `staccato` | Staccato: short notes | staccato | no | right |
| 21 | `legato-and-staccato` | Legato and staccato | (combines 19-20) | no | right |
| 22 | `pickup` | Starting before the bar: the pickup | pickup (upbeat) | no | right |
| 23 | `repeat-signs` | Repeat signs | repeat barlines | no | right |
| 24 | `six-eight-time` | Six-eight time | 6/8 (dotted-quarter beat), tempo = dotted quarter 48 (72 qpm, Introduction's limit) | yes | right |

Lessons 4, 19 and 21 set `claims.practice: true` (no new idea; 19 after the music review of T038). A staff that holds only whole-bar rests (with its
clef) is not counted as notation the lesson uses - every lesson has a grand staff (criterion 27), so lessons 1-10
show a bass clef and whole rests in the unused staff before lessons 5, 6 and 11 introduce them (analyze M1).
Lessons 18 and 21 combine ideas already introduced; criterion 29 still counts features, so lesson 21 (slurs and
staccato are not focus features) passes, and 18 contains ties only. Lesson 4 is not "one new idea" but practice, as
FR-012 allows (at most one new idea). The tie lessons' `trains` and score text say the app checks when a note starts,
not how long it is held (spec Edge Cases).

## 5. Chord lesson catalogue (spec FR-020 - FR-023, FR-035)

All exercises, "comfortable" tier, chord symbols above staff 1. `[T]` = transposed into the listed keys (one item
each). Levels after R1: reach decides (triad root position: Introduction possible, 7 semitones; inversions up to 9:
Beginner; split sevenths: Beginner if the right-hand span <= 9, else Intermediate).

**One chord** (`learning/chord-lessons/single-chords/`)

| id | Title | Chords | Level |
|---|---|---|---|
| `major-triads` | Major chords | C, F, G (right hand, then left) | beginner |
| `minor-triads` | Minor chords | Am, Dm, Em | beginner |
| `major-chord-inversions` | Major chord inversions | C, C/E, C/G; F, F/A, F/C | beginner |
| `minor-chord-inversions` | Minor chord inversions | Am, Am/C, Am/E | beginner |
| `diminished-and-augmented` | Diminished and augmented | B°, C+, then back to C | intermediate |
| `diminished-and-augmented-simplified` | Diminished and augmented (simplified) | B°, C+ held two bars each, right hand only | beginner |
| `suspended-chords` | Suspended chords | Csus2 -> C, Csus4 -> C | beginner |
| `seventh-chords` | Seventh chords | Cmaj7, C7, Cm7, Bø7 (split, R5) | intermediate |
| `seventh-chords-simplified` | Seventh chords (simplified) | same, held two bars, fifth left out (Bø7 keeps its lowered fifth, in the left hand) | beginner |

**Chord switches** (`learning/chord-lessons/switches/`)

| id | Title | Switch | Keys | Level |
|---|---|---|---|---|
| `major-to-minor-in-{key}` [T] | Major to minor | C -> Cm (one finger moves) | C, G, D | beginner |
| `minor-to-major-step-down-in-{key}` [T] | ii to I | Dm -> C | C, F, G | beginner |
| `one-to-four-in-{key}` [T] | I to IV | C -> F/C (common tone C) | C, G, F | beginner |
| `one-to-five-in-{key}` [T] | I to V | C -> G/B (common tone G) | C, G, F | beginner |
| `minor-one-to-five-in-{key}` [T] | i to V | Am -> E/G♯ | A minor, E minor, D minor | beginner |

**Progressions** (`learning/chord-lessons/progressions/`)

| id | Title | Progression | Keys | Level |
|---|---|---|---|---|
| `one-four-one-in-{key}` [T] | I-IV-I | C - F/C - C | C, G, F | beginner |
| `one-five-one-in-{key}` [T] | I-V-I | C - G/B - C | C, G, F | beginner |
| `one-four-five-one-in-{key}` [T] | I-IV-V-I | C - F/C - G/B - C | C, G, F, D | beginner |
| `two-five-one-in-{key}` [T] | ii-V-I | Dm7 - G7 - Cmaj7 (split) | C, F, B♭ | intermediate |
| `two-five-one-simplified-in-{key}` [T] | ii-V-I (simplified) | Dm - G - C triads, one per bar | C, F, B♭ | beginner |
| `twelve-bar-blues-in-{key}` [T] | Twelve-bar blues | I7-IV7-V7, left hand root-fifth, right hand shells, two strikes per bar | C, G | intermediate |
| `twelve-bar-blues-simplified-in-{key}` [T] | Twelve-bar blues (simplified) | I-IV-V triads held a whole bar | C, G | beginner |

Titles of transposed items add the key ("I to IV in G major"; a simplified one ends " (simplified)"). G major items are
written a fifth up and D minor a fourth up from the C/A minor written key, to keep both staves near the staff (T049
music review). That is 9 + 5 families + 7 families = 21 definitions, 44 items (9 + 15 + 20). A simplified lesson sets `simplifies` to the full
lesson of the same key.

## 6. Songs (spec FR-030 - FR-035)

Each tune = two song definitions (song-definition 1.2.0) from one approved source:

| Item | id | Level | Left hand | Chords |
|---|---|---|---|---|
| Full | `learning/keys/<key>/song-<slug>` | intermediate | `leftHand.pattern` `waltz` / `repeated` / `broken` | intermediate set, <= 2 changes per bar |
| Simplified | `learning/keys/<key>/song-<slug>-simplified` | beginner | `block` (held) | beginner set (minor: i, iv, v, V, VII), <= 1 change per bar |

`stepOrder` (folder-unique, 10 x position): the builder orders songs by pair - a simplified song and its full
version sort together, simplified first; unpaired songs keep the 1.1.0 order and come first, then the pairs by the full
song's title. The 10 existing songs keep their `stepOrder` (song-definition 1.2.0, analyze H3). Sidecar title "Song - <name>" / "Song - <name> (simplified)", `simplifies` on the simplified one.

## 7. Library index additions (contract [library-index-1.5.md](contracts/library-index-1.5.md))

- Sidecar `simplifies?: string` - the item id this one simplifies; the item must exist, have a higher level, and the
  same section. Read by library tests only; the app ignores it.
- Skill tags `note-values`, `rests`, `articulation`, `time-signatures`, `reading`, `inversions`, `seventh-chords`.
- Facts `hasPickup: boolean`, `hasDottedRhythm: boolean`, `hasShortNotes: boolean` (§1).
- Section order: `basics` 1, `learning` 2, `repertoire` 3.

## 8. Score model: staccato (research R9)

`Note.staccato: boolean` (`src/core/score/model.ts`), set by `build.ts` from `<articulations><staccato/>`. In
`src/core/timeline/timeline.ts`, a tie chain of one member whose note is staccato gets sounding `endTick =
startTick + max(1, round(durationTicks x STACCATO_SOUNDING_FRACTION))`; visual spans keep the written end.
`STACCATO_SOUNDING_FRACTION = 0.5` in `src/core/defaults.ts`.

## 9. Source manifest addition (contract [source-manifest-1.4.md](contracts/source-manifest-1.4.md))

`multiPart?: { available: boolean; where?: string; licence?: string; note?: string }` - required (by the library
test) for every source a 022 song is based on.

## 10. Audit records (contract [audit-record-1.5.md](contracts/audit-record-1.5.md))

| Item | Checks |
|---|---|
| Basics lesson | `theory`, `ruleSet: "lesson-claims-v1"`, `expectedDifferences: 0` |
| Chord lesson | `theory`, `ruleSet: "chord-lessons-v1"`, `expectedDifferences: 0` |
| Song (both versions) | `mechanical` melody vs source (as 011) + `theory`, `ruleSet: "song-chords-v2"` |

## 11. Constants table (additions/removals in `src/core/defaults.ts`)

| Name | Value | Meaning |
|---|---|---|
| `INTRODUCTION_FOCUS_FEATURES_MAX` | 1 | criterion 29 |
| `INTRODUCTION_FOCUS_FEATURES` | the 11 ids of §1 | criterion 29 feature list |
| `INTRODUCTION_SIMPLE_METRES` | `['2/4','3/4','4/4']` | criterion 29 `metre` feature |
| `STACCATO_SOUNDING_FRACTION` | 0.5 | staccato playback length (R9) |
| removed | see §1 | retired criteria |
