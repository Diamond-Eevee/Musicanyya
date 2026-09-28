# Data model: Melody over chords (014)

All of this is authoring-time data (`content/library/exercises/*.json`) and dev-only checking. Nothing new is read
at run time; the app sees ordinary library items (contract library-index 1.2, unchanged).

## 1. Melody part (new hand part, contract exercise-definition 1.3)

| Field | Type | Rule |
|---|---|---|
| `melody.major` | `MelodyPhrase[]` | variants for a section in a major key; required when any key/pair puts the section in major |
| `melody.minor` | `MelodyPhrase[]` | variants for a section in a minor key; required likewise |
| `MelodyPhrase.position` | integer -3..10 | the step under the thumb when the phrase starts (introduction/beginner fingering, R6) |
| `MelodyPhrase.notes` | `MelodyNote[]` (>= 1) | fills exactly the section's bars (generator throws otherwise) |
| `MelodyNote.step` | integer -3..10 | 1 = tonic in octave 4 (R5); 2..7 up the scale; 8 = tonic above; 9, 10; 0 = the 7th below; -1, -2, -3 = 6th, 5th, 4th below |
| `MelodyNote.value` | `whole` `half` `quarter` `eighth` `dotted-half` `dotted-quarter` | the written value |
| `MelodyNote.alter` | -1 / 0 / +1, default 0 | against the key's natural scale (major, natural minor): +1 on a minor 6th/7th = raised; any other use only in the chords form's mode-changing drills (§3) |
| `MelodyNote.rest` | `true` | a rest of `value` instead of a note (`step` omitted) |
| `MelodyNote.finger` | 1-5 | optional override of the computed finger (R6); the rule check still applies |
| `MelodyNote.shift` | `true` | this note starts a new position (the finger is written) |

Variant choice: item *i* of the family (in `keys`/`keyPairs` order) uses `variants[i mod variants.length]` for each
section; every section chooses independently.

Validation (generator, throws naming family, section and note): the part fills the section; every step spells inside
MIDI 21-108; a minor 6th/7th has an explicit `alter` (0 or +1) in minor phrases; `melody` only in the right hand.

## 2. Pitch of a melody note

`referenceTonic = 12 * (4 + 1) + tonicPitchClass(key)` (the tonic in octave 4). Letter by arithmetic from the tonic
letter (`letterAtDegree`), alteration from the natural scale plus `alter`, MIDI from the step's semitone offset
(steps below 1 counted down from the tonic). Accidentals are written by the engraving pass as today.

## 3. Drills (chords form, contract exercise-definition 1.3 §2)

Top-level optional `melody` with the same shape as §1, plus a fixed layout: `sectionA` (one bar per cycle chord,
each bar ending in a quarter rest together with the left hand; repeated), `sectionB` (one bar per cycle chord) and
`final` (one bar, ending on step 1 or 8). When present it replaces the right hand's triads; the left hand is
generated exactly as today. Drills in one key that change mode (same tonic, minor and major) spell the melody over
a minor-quality chord with `alter: -1` on the third (and sixth where used); the rule check requires any `alter` note
to be a tone of the sounding chord or a step between two such tones.

## 4. Difficulty ladder (`src/core/defaults.ts`, new named constant `MELODY_LADDER`)

| Level | shortestValueBeats | rangeSemitones | maxLeapSteps | shiftsMax | nctPlacement | nctRun | lhAttacksPerBar | parallelOctaves |
|---|---|---|---|---|---|---|---|---|
| introduction | 2 | 7 (five notes) per section | 1 | 1, at the key change (T068) | second half of bar | 1 | 1 | allowed |
| beginner | 1 | 7 per section | 2 (a third) | 1, at a section start | weak beats | 1 | 1 (house rule, R7) | allowed |
| intermediate | 0.5 | 12 per section | 4 (a fifth), to a chord note | unlimited, thumb-under / finger-over | also off-beat eighths | 2 | as today | forbidden |
| advanced | 0.5 (dotted allowed) | 16 (a tenth) | 7 (an octave), to a chord note | unlimited | as intermediate | 2 | as today | forbidden |

Four boolean fields of each row carry the level rules the table's text implies (T072; the checker compares no level by
name):

| Level | shiftsAtSectionStartOnly | crossingIsShift | dottedValues | eighthsInPairs |
|---|---|---|---|---|
| introduction | true | true | false | false |
| beginner | true | true | false | false |
| intermediate | false | false | false | true |
| advanced | false | false | true | false |

A repeated note is 0 steps. Also: melody in C4-A5 (advanced C6; `MELODY_REGISTER_MIDI`); at least 3 semitones above
the left hand at every instant (`MELODY_MIN_CLEARANCE_SEMITONES`); dotted values only at advanced (`dottedValues`); at
intermediate the melody's eighths stand in pairs on the beat and no melody eighth coincides with a left-hand eighth
(`eighthsInPairs`).
The existing `LEVEL_*` criteria keep applying through `checkLevel`.

## 5. Melody rule check result (`tools/library/fidelity/melody-rules.ts`)

`MelodyFinding = { itemId, bar, beat, rule, message }` with `rule` one of: `key`, `chord-tone`, `non-chord-tone`,
`minor-degree`, `augmented-second`, `cross-relation`, `clash`, `parallel-octaves`, `register`, `hand-gap`, `leap`,
`range`, `value`, `shift`, `fingering`, `ending`, `key-change`, `variation`, `static`, `doubled`. An item passes with zero
findings. `doubled` = both hands strike the same block chord at one onset (FR-001; a single closing tonic chord is
allowed). `static` = within one item, one melody pitch is held or repeated for more than two bars in a row (FR-008;
the closing note of the item is exempt).

## 6. Items and identity

| Group | Definitions | Items | Sections changed |
|---|---|---|---|
| Relative key changes | `key-change-relative-{introduction,beginner,intermediate}.json` | 24 | every section: right hand -> `melody` |
| Parallel key changes | `key-change-parallel-{introduction,beginner,intermediate}.json` | 30 | same |
| Drills | `changes-{i-v-vi-iv,turnaround,diatonic-ladder,same-tonic,a-minor-major}.json` | 5 | top-level `melody`; `supersedes` removed |

Item id, title, section, level, tempo, metre and bar count unchanged (FR-004). New file bytes -> new content hash ->
no progress (FR-012). `tools/library/successors.ts`: the 5 entries whose `newId` is a drill gain
`resetBy: '014'`. `trains` texts are reviewed per family and updated where they no longer describe the music.

## 7. Audit records

Each of the 59 records moves to rule set `exercise-theory-v3` (`checks[0].ruleSet`), `checkedBy` / `date` updated;
their claims in `exercise-claims.ts` give the right hand as `{ kind: 'melody', level }`, the left hand as today.
`docs/library-audit.md` is regenerated.
