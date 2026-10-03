# Research: Library Basics, Chord Lessons and More Songs (022)

**Date**: 2026-10-03 | **Agent**: claude-opus-5.5 | **Spec**: [spec.md](spec.md)

Facts below were checked in the code on branch `022-library-basics-chords-songs` (base `38867c7`). No new runtime
dependency and no new dev dependency.

---

## R1. Level rules: notation is never banned (owner decision OD-1, 2026-10-03)

**Facts found**: `src/core/library/levels.ts` (`failingCriteria`) gives every level caps from `src/core/defaults.ts`.
At Introduction the shortest value must be one beat (criterion 5: no eighth notes), no tie (20), no repeat (24), only
4/4 and 3/4 (12); Beginner forbids sixteenths, 6/8, triplets, grace notes, ornaments, pedal and voltas. Spec FR-014
(Basics = Introduction) and FR-010 (eighths, ties, repeats, 6/8) could not both hold.

**Decision** (owner, during planning: "change the restrictions ... it should just specify that it should be playable
by human hand"; option "drop bans, keep pace"): the level check keeps only criteria about **reach** and **pace**:

| Kept | Criterion | Retired (no longer checked) | Criterion |
|---|---|---|---|
| pitch range / bounds | 1, 2 | shortest note value | 5 |
| hand independence | 3 | longest run at the shortest value | 6 |
| voices per staff | 4 | tempo changes | 8 |
| tempo range | 7 | key-signature size | 9 |
| measures range | 14 | key changes | 10 |
| duration in seconds | 15 | accidentals per 16 bars | 11 |
| widest chord in one hand | 16 | allowed metres | 12 |
| widest leap | 17 | metre changes | 13 |
| mean / peak density | 18, 19 | tie chains / tie barlines | 20 |
| one part, grand staff | 27 | tuplets | 21 |
| no unexpected notices | 28 | grace notes / ornaments | 22, 23 |
| | | repeat kinds / backward repeats | 24 |
| | | pedal | 25 |

**Follow-up (owner, same day: "introduction means that we should focus on one thing ... eighth notes are ok if they
are alone ... don't combine difficult things together in introduction")**: a new **criterion 29, "one focus"**,
Introduction only: at most one of the features {notes shorter than a beat, dotted rhythm below a dotted half, tie,
repeat/volta, pickup, metre other than 2/4 3/4 4/4, tuplet, grace note/ornament, accidental outside the key signature,
pedal, key/metre/tempo change} may occur. Each feature is read from facts already measured (`shortestDivision`,
`hasTies`, `repeatKind`, `metres`, `hasTuplets`, `graceNoteCount`, `ornamentCount`, `accidentalMarkCount`, `hasPedal`,
`keys`, `tempoChanges`) plus two new facts, `hasPickup` and `hasDottedRhythm` (library-index 1.5.0). The feature list
is a named constant (`INTRODUCTION_FOCUS_FEATURES_MAX = 1` plus the list in `src/core/defaults.ts`). Basics lessons
meet it by design (spec FR-012). Counting rules: the raised 6th/7th of a minor key are the key, not accidentals
(`minorScaleAccidentalCount` is subtracted); in an item with a key change, the accidentals belong to that change (the
new key's notes and the courtesy naturals) and are not a second feature. Dry run over today's index: with these two
rules all 42 Introduction items pass; without them the 10 parallel key-change Introduction exercises would fail.

The facts behind the retired criteria are still measured and stay in `index.json` (filters, step order, display);
only the level decision stops using them. The exercise-only variants B5 (minor-scale accidentals) and B6 (one key
change) die with criteria 11 and 10; B7 and B8 (reach) stay. The constitution is untouched: playability ("possible" /
"comfortable", `PLAYABLE_LIMITS`) is a separate check and is unchanged.

**Consequence for existing items (FR-006)**: a dry run of the kept criteria over today's `index.json` facts shows
16 items without `raisedBecause` that would measure below their assigned level - the 13 key-change "intermediate"
exercises, the two key-change "minor-and-major"/"major-and-minor" extras (Advanced -> Introduction), the songs Silent
Night and O Come O Come Emmanuel (Intermediate -> Beginner) and Bach's Prelude BWV 846 (Advanced -> Intermediate).
25 items already carry `raisedBecause`. Each of the 16 keeps its level and gains a `raisedBecause` naming what the
retired criteria used to measure (generated exercises: in their exercise definition; songs: in the song definition;
Bach: in its sidecar). No item moves; no id changes. The exact list is re-measured by the real check in the task.

**Rationale**: the owner's rule; levels now mean "how far the hands reach and how fast/long/busy the music is",
which a learner experiences directly, while notation is taught by order (Basics) rather than hidden.

**Alternatives considered**: exempt only Basics from the bans (owner rejected); keep only hand reach (owner rejected:
"Introduction" would no longer mean slow and short); move the 16 items down a level (rejected: FR-004/FR-006, saved
filters and progress would shift).

## R2. Where the new content lives

**Decision**:
- `basics` - a new **top-level** section "Basics", `order` 1; Learning becomes 2, Repertoire 3. One flat folder;
  lessons are ordered by `stepOrder` (10, 20, ...) with no `step` - `filterItems` already sorts "no step" items by
  `stepOrder` and then title, so no core change is needed for teaching order.
- `learning/chord-lessons` - "Chords" (spec FR-002), `order` 3 under Learning, with three subfolders in order:
  `single-chords` ("One chord"), `switches` ("Chord switches"), `progressions` ("Progressions").
- New songs: in their key's folder `learning/keys/<key>/` as `song-<slug>` (full) and `song-<slug>-simplified`, with
  `step: "song"` like the 10 existing songs (spec FR-003).

**Rationale**: `learning/chords` cannot be reused: it is a `formerId` of Learning > Keys (feature 011 FR-020) and 42
old item ids under it redirect through `tools/library/successors.ts`; a new section with that id would capture old
saved filters and links. Item ids carry no lesson number so a lesson can be inserted later without renaming.

**Alternatives considered**: Basics under Learning (rejected: spec Assumptions - the first thing a beginner sees);
numbered ids `basics/01-...` (rejected: insertion would rename ids, FR-004).

## R3. One authored "lesson definition" format for Basics and chord lessons

**Facts found**: the exercise generator (`src/core/library/exercise/`, contract exercise-definition 1.3) is built
around keys, scale degrees and the four steps; it cannot express a single repeated pitch with ties, slurs, staccato,
a pickup or repeat signs, and its qualities are triads only. `pnpm library:convert-ly` needs an approved downloaded
source with a MIDI file and audits fidelity to it. Hand-written MusicXML is forbidden (items are reproducible from a
definition).

**Decision**: a new dev-only format `content/library/lessons/*.json` (contract [lesson-definition.md](contracts/lesson-definition.md)
1.0.0) and builder `pnpm library:lessons` (`tools/library/build-lessons.ts` + `tools/library/lessons/`). A lesson
lists its bars explicitly per staff in a compact token notation (pitch, value, dot, tie, slur, staccato, accent,
fingering, chord, chord symbol), plus metre, tempo, pickup, repeat barlines and the printed explanation line. It
writes through the existing `src/core/musicxml/write.ts` (which already writes ties, slurs, articulations, repeats,
`implicit` measures and `<words>`), then `planEngraving(doc, 'library')` like the song builder. A definition may list
`transpositions` (FR-021, FR-022): one item per key, id suffix `-in-<key-slug>`.

**Rationale**: one small, explicit format covers every Basics and chord lesson; explicit notes let the author voice-
lead chord switches deliberately; output stays reproducible and goldens/regeneration tests can cover it.

**Alternatives considered**: extend exercise-definition with a "lesson" form (rejected: the generator's key/step
machinery and melody rules do not apply, and every addition risks the 160+ exercise goldens); author `.ly` files and
convert (rejected: convert-ly's audit is fidelity to a downloaded source; our lessons have none).

## R4. Chord symbols and chord names

**Decision**: chord symbols are `<direction><words>` above staff 1, as the songs do (`<harmony>` is not in the
parser's supported elements and would raise a notice; `docs/musicxml-support.md` lists it as Ignored). Chord-lesson
names use: root `A`-`G` with `♯`/`♭`, then one of `` (major), `m`, `°`, `+`, `sus2`, `sus4`, `maj7`, `7`, `m7`, `ø7`,
then optional `/<bass>` (inversion, e.g. `C/E`). Unicode `♯ ♭ ° ø` as in the existing songs.

## R5. Four-note chords stay "comfortable" (constitution VII)

**Decision**: chord lessons are exercises, so the "comfortable" tier applies (at most 3 keys per hand, struck span
<= 12, held span <= 9). A seventh chord is written **split**: left hand the root (optionally with the fifth), right
hand third-fifth-seventh or third-seventh; the lesson's `voicing` note says which. A seventh chord with its fifth left
out declares `omit: ["5"]` on that chord. Triads in all inversions fit one hand (second inversion spans 9 semitones).

## R6. Independent checks (audit-record 1.5.0)

Like `theory.ts` and `song-chords.ts`, each check reads only the finished MusicXML (plus the claim in the item's
audit record), never the definition or the builder:

- **`lesson-claims-v1`** (Basics): the printed explanation exists on bar 1; a lesson whose claim says `singlePitch`
  uses one pitch only; the notation features used (note values, dots, rests, ties, slurs, staccato, accents, metres,
  pickup, repeats, bass clef, hands together) are a subset of what this lesson and earlier lessons (by `stepOrder`)
  introduce; a tie joins equal pitches only, a slur only different ones.
- **`chord-lessons-v1`**: at every chord symbol, the notes sounding together in both staves spell exactly the named
  chord (pitch classes by letter arithmetic; `omit` honoured), the lowest note is the slash bass or the root, and
  each claimed common tone of a switch is held or re-struck on the same key.
- **`song-chords-v2`**: v1 plus left-hand patterns (R7): every left-hand note under a chord name is a tone of that
  chord; changes (not strikes) are counted per bar; the minor-key beginner set also allows `v` and `VII` (R8). v1
  records stay on v1.

## R7. Songs come in pairs: full (Intermediate) and simplified (Beginner)

**Decision**: each new song is built twice from one source melody (spec FR-035):
- **Full**, Intermediate: the left hand moves - `leftHand.pattern` `waltz` (root, then the chord twice, 3/4),
  `repeated` (the chord struck on every beat or dotted beat), or `broken` (root-fifth-third-fifth, eighths) - over a
  richer progression (up to two chords per bar, the level's wider chord set).
- **Simplified**, Beginner: one held block chord per bar from the primary chords, sidecar `simplifies: <full id>`,
  title "Song - <name> (simplified)", departures say what was simplified.

Song-definition 1.2.0 (MINOR): optional `leftHand.pattern`, optional `simplifies`, pair ordering (each simplified
song directly before its full version, analyze H3). Default `block` keeps every
existing song byte-identical. After R1, a 6/8 tune no longer forces Intermediate, so a 6/8 song can have a Beginner
simplified version if its pace fits.

**Alternatives considered**: simplify the melody instead (rejected: the tune must stay recognisable and match its
source in the audit); one version per song (rejected: owner clarification, Piano Marvel model).

## R8. Beginner chords in minor songs

**Decision**: `song-chords-v2` allows `i, iv, v, V, VII` for a Beginner minor song (v1: `i, iv, V`). Modal folk tunes
(Aeolian/Dorian, like Greensleeves' relatives) harmonise with `v` and `VII` without the raised leading tone; forcing
`V` would put accidentals against the tune. Music review by `music-domain-expert` in the tasks.

## R9. Staccato is heard in Listen (spec US1 scenario 5)

**Facts found**: `<staccato>` is parsed (`build.ts` supported elements) but playback ignores it - only `<accent>`
changes playback (velocity boost, `timeline/dynamics.ts`). `<slur>` is Ignored for playback; notes already sound for
their full written value, which is legato.

**Decision**: the score model `Note` gains `staccato: boolean`; the timeline ends the sounding event of an untied
staccato note at `STACCATO_SOUNDING_FRACTION` (0.5, new named constant in `src/core/defaults.ts`) of its written
duration. Visual spans, expected notes, Practice and grading are unchanged (they use onsets and written spans). Tie
chains ignore staccato. Real-time code is not touched (the scheduler already sends note-offs at the event end tick).
**Side effect**: the four existing scores with staccato dots (Burgmüller Op. 100 Nos. 2 and 5, both Morning Moods)
sound shorter where marked - closer to the print. **Owner OD-3 (2026-10-03, "go with recommended")**: yes, for every
Score.

**Where the shorter sound reaches (constitution audit T072)**: the timeline's `SoundingEvent.endTick` is read by
playback and also by two consumers that are not about sound:
- **Grading** (F1, fixed): Play mode's played-along spans (003 R-18, `buildPlayedAlongSpans`) took their end from the
  sounding end, so an ungraded staccato note pressed in the second half of its written length counted as extra. They
  now end at the head note's written end (its visual span), so every Grade is what it was before staccato sounded -
  checked on the four repertoire Scores (their played-along spans equal those of main) and pinned by
  `tests/core/grade/played-along.test.ts`.
- **Playability** (F2, kept): `handStretches` counts a note as held while it sounds. The hand lets go of a staccato
  note when its short sound ends, so it is not held while the hand starts the next note - the musically right reading.
  No library item's stretches change (audit check of all six Scores with staccato); pinned by
  `tests/library/playability.test.ts`.

**Alternatives considered**: write staccato quarters as eighth + rest in the lesson (rejected: the score would lie);
a shorter fraction per level (rejected: one documented constant is enough).

## R10. Explanation text (spec FR-013)

**Decision**: `trains` (shown as "Trains" in the item details, max 300 characters) holds the plain-words explanation;
one line of at most 60 characters is printed as italic `<words>` above staff 1 at bar 1 (`scoreText`). Screenshot
check per lesson (quickstart) that it does not collide with the tempo mark.

## R11. New skill tags

**Decision**: add `note-values`, `rests`, `articulation`, `time-signatures`, `reading`, `inversions`,
`seventh-chords` to `SKILL_TAGS` (`src/core/library/types.ts`) with English labels in `src/ui/i18n/en.ts`
(library-index 1.5.0, MINOR). An unknown tag skips an item in `index-model.ts`, so the core list must grow with the
content.

## R12. Song sources and the multi-part record (FR-031, FR-034)

**Decision**: source-manifest 1.4.0 (MINOR) adds optional `multiPart` = `{ available, where?, licence?, note? }`;
every source used by a new song records it (SC-007). Songs use only public-domain or CC0 sources (sources README:
songs written for this project stay CC0 and are never based on CC BY / CC BY-SA). Each source needs the owner's
approval before download (OD-2). Candidate list: see R13.

## R13. Song candidates

Source search by `music-domain-expert` (2026-10-03, Mutopia piece pages checked for licence, `.ly` and `.mid`;
bar counts and ranges approximate until each file is downloaded and inspected with
`pnpm library:fidelity --inspect-midi`). All are public-domain SATB hymn/carol settings with the tune in the
Soprano - so every one already **is** a multi-part source for a later Orchestra (FR-034: `multiPart.available: true`,
`where` = its own page).

**Shortlist - approved by the owner (OD-2, 2026-10-03, "go with recommended": all 10 as listed; none rejected)**

| # | Tune | Mutopia | Key / metre | Notes |
|---|---|---|---|---|
| 1 | The First Noel | [1243](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1243) | D major, 3/4 | two-eighth upbeats; D4-D5 |
| 2 | O Haupt voll Blut und Wunden (Passion Chorale, Bach) | [107](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=107) | D minor, 4/4 | fermatas (ignored by playback) |
| 3 | It Came Upon the Midnight Clear (Willis, "Carol") | [1231](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1231) | B-flat major, 6/8 | ties across barlines; one F-sharp |
| 4 | In the Bleak Midwinter (Holst, "Cranham", 1906) | [1233](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1233) | F major, 4/4 | Holst d. 1934: public domain |
| 5 | Lobe den Herren (Praise to the Lord) | [1256](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1256) | sounds F major, 3/4 | `	ranspose` wrapper |
| 6 | Nuż my dziś krześcijani (Polish carol, 1586) | [856](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=856) | G minor, 2/2 | narrow range; little known |
| 7 | Leoni (The God of Abraham Praise) | [525](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=525) | F minor, 4/4 | four flats |
| 8 | St. Denio (Immortal, Invisible; Welsh) | [1291](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1291) | sounds G major (verify), 3/4 | `	ranspose` wrapper |
| 9 | Tryggare kan ingen vara (Swedish folk) | [1299](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1299) | D major, 3/4 | 8 bars + pickup |
| 10 | Hark the Herald Angels Sing (Mendelssohn) | [1261](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1261) | F major, 4/4 | no pickup |

**Swap (owner, 2026-10-03, after download in T057; first recorded as 2026-10-04, a misdating corrected in T072)**: 856 (German note names, bars re-measured as 4/2) and 525
(a `\chordmode` line with `/+` bass notes) cannot be read by our LilyPond reader; the owner chose "swap for reserves".
St. Anne (1290) reads and replaces 856 (slug `o-god-our-help-in-ages-past`). Aamulla varhain (1020) does not read
either (`\new ChordNames`, a start-repeat bar outside `\repeat`), so Leoni's place is **open**: with Passion Chorale
the only minor tune left, FR-030's "two minor songs" needs one more minor source - needs owner (see the log).

**Leoni kept (owner, 2026-10-03: "extend reader")** - Decision: the LilyPond reader skips chord-name lines
(`\chordmode` / `\chords` blocks like lyrics; a `ChordNames` context gives no note) and lets a `\header` field name an
earlier one (`mutopiatitle = \title`); Leoni (525) is downloaded again unchanged (T076). Rationale: chord names print
above the staff and are no notes, so nothing the fidelity check compares is lost, and the owner-approved minor tune
stays. Alternatives: another minor source (a new approval and search), amending FR-030 (spec change). Found on
download: the file is written in F minor but wrapped in `\transpose f e`, so it **sounds E minor** (row 7 above is
the written key); its MIDI plays the chord names as track 1, so `midiNoteTracks` is `[2, 3]`. All 10 sources'
MIDI agree with the reading of their notation (0 differences each, 2026-10-03).

**Leoni's phrase lines (T077)** - Decision: `melody.joinShortBars` joins the 3- and 1-beat written bars that Leoni's
mid-bar `\bar "||"` makes back into its 4/4 bars. Rationale: the app reads a short bar inside a piece as a pickup
(beat offset) and raises a measure-length notice otherwise; LilyPond's own measures are 4/4. Alternatives: writing the
split bars with `implicit` (wrong beats in the second half), reading the page bars differently in the reader (would
change every audited reading).

**St. Anne's barring (T078; owner 2026-10-03, "re-bar with pickup", after the T063 music review)** - Decision:
`melody.pickupBeats` re-bars the source (which starts the tune on beat 1) with a one-beat pickup, as hymnals print it;
listed as a departure. Rationale: in the source's barring every stressed syllable falls on beat 2 or 4. Alternatives:
keep the source barring (stresses wrong), drop the tune.

**Chord length under a moving left hand (T062)** - found by `song-chords-v2`: a `waltz` or `broken` chord that lasts one
beat (a pickup, a change on the last beat) cannot sound its three notes, so those plans change chord at most once a
bar (waltz) or every two beats (broken) and leave short pickups without a chord; `repeated` strikes the whole triad
every beat and keeps the two-changes-a-bar plans.

Reserves: St. Louis / O Little Town of Bethlehem (1292), Aamulla varhain (1020, minor, voice and piano - no multi-part),
Old Hundredth (194), St. Anne (1290). Variety (FR-030): keys D, F, G, B-flat major and D, G, F minor; three minor;
five in 3/4 or 6/8. A song may be transposed onto a key shelf with fewer accidentals (listed as a departure), as
Greensleeves was.

**Facts the owner should know**: none of the familiar modal folk tunes (God Rest Ye Merry Gentlemen, Coventry Carol,
Drunken Sailor, The Ash Grove, Londonderry Air, Early One Morning, Barbara Allen, Simple Gifts, Salley Gardens, The
Water Is Wide, Lavender's Blue ...) has a public-domain or CC0 source with `.ly` and `.mid` on Mutopia (title search),
so "like Greensleeves" is met by hymn and carol tunes. Rejected in the search: The Last Rose of Summer (1093, endings,
sixteenths, triplets), John Barleycorn (814, pickup inside a repeat, 32nds), Flee As a Bird (376, sixteenths), John
Anderson My Jo (1103, chords in the melody voice, grace note).

## R14. What is not touched

No Orchestra parts (FR-045; Play uses the Guide voice). No change to grading, Practice, the audio engine, MIDI, the
Electron bridge or the Native audio plugin. No RT path touched, so no RT review is required; the timeline change (R9)
is core code covered by unit and golden tests.
