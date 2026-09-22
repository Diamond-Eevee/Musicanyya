# Data Model: Practice Score Library

Feature `005-practice-score-library`. Formats are specified in `contracts/`; this file is the meaning
behind them - entities, validation, the shelf's shape, the level criteria and the content plan.

---

## 1. Entities

| Entity | What it is | Key fields | Lives in |
|---|---|---|---|
| **LibraryIndex** | the whole shelf as the app reads it | `version`, `generated`, `sections[]`, `items[]` | generated `public/library/index.json` |
| **LibrarySection** | one folder of the shelf | `id` (path-like), `title`, `description`, `parent`, `order` | index |
| **LibraryItem** | one Score on the shelf | `id`, `section`, `file`, `bytes`, `hash`, `meta`, `facts`, `levelCheck` | index |
| **ItemMetadata** | what a human decided about an item | `title`, `composer`, `arranger`, `kind`, `level`, `tags[]`, `trains`, `hands`, `arrangement`, `provenance`, `expected` | authored `<name>.json` |
| **Provenance** | where the item came from | `authored`: author, created, basedOn / `downloaded`: source, obtained, licence, credit, unmodified | inside ItemMetadata |
| **ItemFacts** | what the parsed Score actually is | measures, notes, duration, keys, metres, tempo, range, span, staves, shortest division, notes per beat, accidentals, notation flags, fingering coverage, notices | derived by the generator |
| **LevelCriteria** | what a level demands | one threshold per criterion id (SS4) | values in `src/core/defaults.ts` (the project's constants table); `checkLevel` in `src/core/library/levels.ts` |
| **LevelCheck** | whether an item meets its level | `level`, `pass`, `failed[]` | index, recomputed by the test |
| **SkillTag** | what an item trains | closed enum (contract SS1) | ItemMetadata |
| **ExerciseDefinition** | one drill, defined once for many keys | metre, tempo, keys[], steps[], meta template | `content/library/exercises/*.json` |
| **LibraryFilter** | the musician's current narrowing | section, level, key, tag, text | `libraryState` + `localStorage` |

**Identity.** An item's `id` is its path under `public/library/` without the extension
(`learning/chords/triads-c-major`). It is the anchor for a future Advice file, so renaming a file is
a breaking change, not a refactor (contract SS3).

**Relationships.** Section 1-* Item. Item 1-1 ItemMetadata (a score with no sidecar is an error, not
an untitled item). ExerciseDefinition 1-* Item (one per key). Item -> Score is *derivation*, never
storage: the index describes a file, the app always parses the file itself.

## 2. The shelf

```text
learning/                     Exercises written for this app
  chords/                     One exercise per key, same drill in all of them
    triads-<key>              24 items: 12 major keys, 12 minor keys
    changes/                  Chord-change drills (SS5.2)
  (later: scales/, arpeggios/, five-finger/, intervals-cadences/, rhythm/ - spec "Suggested additions")
repertoire/                   Pieces
  beginner/
  intermediate/
  advanced/
```

Section titles and descriptions are authored in `tools/library/sections.ts` (one small table, the
only place the shelf's wording lives) and copied into the index by the generator. A folder with no
items is not emitted, so the shelf never shows an empty shelf-board.

## 3. Validation and failure behaviour

| Rule | On violation |
|---|---|
| Sidecar exists for every score file | library check **fails** (FR-025); at run time the item is skipped + notice |
| Sidecar validates against the schema | item skipped + notice; the rest of the library lists |
| `licence` in {`CC0-1.0`, `public-domain`} | library check **fails** (FR-017) - never a warning |
| `origin: downloaded` -> `source`, `obtained` present **and** an entry in `THIRD_PARTY_NOTICES.md` | library check **fails** (FR-020) |
| File is non-empty and loads without error | library check **fails** (FR-021, FR-022) |
| Load notices == `meta.expected.notices` | library check **fails** (FR-023) - a *new* notice is a regression |
| `levelCheck.pass` is true | library check **fails** (FR-009) - fix the level or the piece |
| Every note of an exercise carries a fingering (`fingeringCoverage == 1` when `kind == "exercise"`) | library check **fails** (FR-006) |
| `index.version != 1` | whole index rejected, one notice, app otherwise normal |
| Item bytes > `MAX_FILE_BYTES` | item skipped + notice (the same limit a dragged-in file faces) |
| A Score with no sounding note ("silent", FR-021) | library check **fails** - a file that parses is not yet a piece of music |
| Total bytes of `public/library/` over the SC-008 budget | library check **fails**, so a heavy item is caught at commit time rather than at Polish |

**Derived facts are display-only.** `facts.tempoBpm`, `facts.durationSeconds` and the rest exist for
the list, the filters and the level check. Playback, Practice and grading always use the tempo map
built from the file (Principle II: one clock, one source of truth).

## 4. Level criteria

From the `music-domain-expert` review (2026-09-22), with two corrections marked below. The criteria
live in code, not in content, so they are versioned with the checker that applies them. The
**threshold values** go in `src/core/defaults.ts` as named constants (`LEVEL_*`), because that file
is this project's constants table (AGENTS.md SS6, Principle II: every tolerance named, documented and
configurable); `src/core/library/levels.ts` holds only the criterion definitions and `checkLevel`.

**Model: nested caps.** Beginner ⊂ Intermediate ⊂ Advanced. `checkLevel` computes each metric from
`ItemFacts`, derives the **lowest level whose caps the item satisfies**, and compares it with the
assigned level:

- assigned **below** computed -> the library check fails (the item is harder than its shelf says);
- assigned **equal** -> pass;
- assigned **above** computed -> allowed **only** with `meta.raisedBecause` and a reviewer recorded
  (SS4.2). This is how the judgement a script cannot make stays visible instead of hidden.

| # | Criterion (computed from the parsed Score) | Beginner | Intermediate | Advanced |
|---|---|---|---|---|
| 1 | Pitch span, highest − lowest (semitones) | ≤ 36 | ≤ 48 | ≤ 88 |
| 2 | Absolute pitch bounds (MIDI) | 36–84 | 28–96 | 21–108 |
| 3 | Hand independence: fraction of measures whose two staves have different onset sets | ≤ 0.35 | ≤ 1.0 | ≤ 1.0 |
| 4 | Voices per staff | 1 | ≤ 2 | ≤ 4 |
| 5 | Shortest sounding duration, in beats (`PLAY_BEAT_UNIT_SOURCE`) | ≥ 0.5 | ≥ 0.25 | ≥ 0.125 |
| 6 | Longest unbroken run of shortest-value notes in one hand | ≤ 4 | ≤ 32 | unlimited |
| 7 | Tempo, quarter-equivalent BPM | 50–100 | 40–152 | 30–208 |
| 8 | Tempo changes | 0 | ≤ 2 | unlimited |
| 9 | Key signature, max \|fifths\| | ≤ 2 | ≤ 4 | ≤ 7 |
| 10 | Key changes | 0 | ≤ 2 | unlimited |
| 11 | Accidentals outside the key signature, per 16 measures | ≤ 2 | ≤ 12 | unlimited |
| 12 | Metre | 4/4, 3/4, 2/4 | + 6/8, 3/8, 2/2, 12/8 | any, incl. `senza-misura` |
| 13 | Metre changes | 0 | ≤ 1 | unlimited |
| 14 | Measures (written) | 8–32 | 16–96 | ≤ 250 |
| 15 | Duration after repeat expansion | ≤ 90 s | ≤ 240 s | ≤ 480 s |
| 16 | Largest simultaneous interval in one hand (semitones) | ≤ 9 | ≤ 12 | ≤ 14, wider only under `<arpeggiate>` |
| 17 | Largest leap in one hand between consecutive onsets | ≤ 12 | ≤ 24 | unlimited |
| 18 | Mean note density (notes/s) | ≤ 2.5 | ≤ 6 | ≤ 12 |
| 19 | Peak note density (max notes/s in any 2 s window) | ≤ 5 | ≤ 12 | ≤ 24 |
| 20 | Ties | within a bar or across one barline, chain ≤ 2 | any | any |
| 21 | Tuplets | none | 3:2 only | any ratio that divides `<divisions>` evenly |
| 22 | Grace notes | none | ≤ 1 per 4 measures | unlimited |
| 23 | Ornaments (trill / turn / mordent / tremolo) | none | ≤ 1 per 4 measures | unlimited |
| 24 | Repeat structure | none, or one backward repeat | + voltas | + D.C./D.S./To Coda/Fine |
| 25 | Written `<pedal>` | forbidden | allowed, recorded as a limitation | allowed, recorded |
| 26 | `<octave-shift>` | allowed (see correction B) | allowed | allowed |
| 27 | Parts / staves | 1 part, 2 staves | 1 part, 2 staves | 1 part, 2 staves |
| 28 | Load report | no warnings; notices only if recorded in `meta.expected.notices`, and an **authored** item must have none | same | same |

**Correction A (`<harmony>`)**: verified in `src/core/musicxml/build.ts` - the unsupported-element
check runs over the **direct children of `<measure>`**, and neither `harmony` nor `figured-bass` is in
`supportedElements`, so a chord symbol emits an `info unsupportedElement` notice and increments
`skippedElementCount`. Authored library files therefore label chords with
`<direction><direction-type><words>`, never `<harmony>`. A downloaded item that uses `<harmony>`
records the notice in `meta.expected.notices`.

**Correction B (`<octave-shift>`)**: the expert flagged this as a playback defect (8va passages
sounding an octave wrong) and proposed forbidding it. **That is not the case, and the criterion was
changed back to "allowed".** MusicXML's `<pitch>` is the *sounding* pitch - the W3C reference defines
`<octave-shift>` as marking "where notes are shifted up or down from their performed values because
of printing difficulty" - so ignoring it in the time model is exactly right, and the printed octave is
Verovio's business. `tests/fixtures/musicxml/octave-shift-8va.musicxml` writes the sounding pitches
(C5 D5 under an `up` shift), consistent with that reading. No defect, no task.

**Correction C (four measurement refinements, found implementing `checkLevel` against real US1/US2
content - T045/T048)**: the literal criteria as tabled above produced obviously wrong verdicts on
already-shipped, already-reviewed content, so the *checker*'s formulas were refined; the table's
thresholds are unchanged.

1. **Criterion 3 (hand independence)** originally counted a measure as independent whenever the two
   staves' onset sets merely differed. A melody over one held whole-note chord differs on *every*
   measure by that reading (four onsets vs. one) yet needs no ongoing two-hand coordination - it is
   the easiest possible two-hand texture, not the hardest (found on `ode-to-joy.musicxml`). Fixed: a
   measure only counts when **both** staves have two or more onsets and those onset sets differ.
2. **Criterion 6 (longest run of shortest-value notes)** fired on every chord exercise, because a
   piece written entirely in half notes has *every* onset "at the shortest value" by definition - 14
   consecutive half-note chords is not a technical run. Fixed: the criterion only evaluates when the
   shortest notated value is faster than a quarter note.
3. **Criteria 18/19 (density)** counted every `Note`, so a three-note chord counted as three attacks
   instead of one physical action. Fixed: both criteria count note *attacks* (one per onset, chords
   collapsed), the same unit `peakNotesPerSecond` already used.
4. **Criterion 9 (key-signature accidentals)** does not apply to `kind: "exercise"` items. FR-005
   requires the 24-key chord family to be equally playable in every key by design, and every exercise
   family spells its accidentals explicitly (never relies on the signature for a raised leading tone,
   §5.1) - the sight-reading burden a key signature implies for a *piece* does not apply to a shape
   drilled in every key alike.
5. **Criterion 14's minimum** (a level's shortest allowed length) does not apply to `kind: "exercise"`
   items or to `arrangement: true` pieces - a technique drill and a deliberately excerpted arrangement
   (the Für Elise theme US1 opens, §5.3) are short by design, not because they are unfinished. The
   *maximum* still applies to both, and both bounds still apply in full to a non-arrangement piece.
6. **Criterion 20 (tie chains)** does not apply to `kind: "exercise"` items. A chord-change drill's
   tied common tone (§5.2) means "do not lift the finger that did not move" - trivial when both hands
   already play the same shape together - not a piece's held-note-against-a-moving-line coordination
   challenge, which is what the cap exists to gate.

None of these change a threshold in the table above, and none apply to a non-arrangement repertoire
piece, which every criterion above still gates normally.

### 4.1 What the check deliberately cannot see

Recorded so nobody mistakes a passing check for a musical verdict:

1. **Contrapuntal independence.** A Bach two-part Invention passes Intermediate on every number and is
   not Intermediate. The largest gap.
2. **Unnotated pedal.** Most public-domain engravings omit it; absence of `<pedal>` is not evidence.
3. **Ergonomics**: black-key patterns, thumb-under, hand redistribution - and downloaded files usually
   carry no fingering.
4. **Missing tempo.** If neither the file nor the metadata states one, the check **fails** rather than
   assuming a tempo.
5. **Endurance, voicing, rubato, tone.** Chopin Op. 28 No. 7 is 16 numerically trivial bars.
6. **Hand crossing** - only partly inferable.
7. **Repeated shapes.** A piece that repeats one chord shape for 25 bars scores like a hard chordal
   piece and is not one.

### 4.2 Review fields (added to the item metadata)

`reviewedBy` and `reviewedOn` are required on every item; `raisedBecause` is required when the
assigned level is above the computed one. The library check enforces their *presence*, never the
judgement - which is what SC-006's "a musician agrees with at least 90% of the level assignments"
actually rests on.

## 5. Content plan

### 5.1 Chord exercise template (`triads`, one definition -> 24 items)

| Property | Value |
|---|---|
| Parts / staves | 1 part, `<staves>2</staves>`, G2 / F4 |
| Metre / divisions / tempo | 4/4, `divisions` 4, quarter = 66 (`<metronome>` + `<sound tempo>`) |
| Length | 8 written measures, no repeats, `light-heavy` final barline; 15 chord events (14 half + 1 whole), ≈ 29 s |
| Voices | RH voice 1 / staff 1, LH voice 5 / staff 2, one `<backup><duration>16</duration></backup>` per measure |
| Texture | both hands play the same shape, LH exactly one octave below RH |
| Labels | `<direction><direction-type><words>` (never `<harmony>` - correction A) |
| Fingering | on every note (FR-006) |

Chord order, identical in all 24 keys:

| Measure | Beats 1–2 | Beats 3–4 | What it teaches |
|---|---|---|---|
| 1 | I | IV | the primary triads |
| 2 | V | I | |
| 3 | I | I⁶ | the three shapes of the tonic |
| 4 | I⁶⁴ | I | |
| 5 | I | IV⁶⁴ | the close-position cadence |
| 6 | V⁶ | I | |
| 7 | IV⁶⁴ | V⁶ | the change alone |
| 8 | I (whole) | | close |

- **Minor keys** use i, iv and a **major V** (harmonic minor): the natural-minor `v` has no leading
  tone, so the cadence the exercise exists to teach would disappear. The key signature is the natural
  minor; the raised 7th is written with an explicit `<alter>` + `<accidental>` so it is engraved
  rather than inferred.
- **Fingering is a rule, not a table**: the interval pattern of each shape is the same in every key -
  root position (3rd+3rd) RH 1 3 5 / LH 5 3 1; first inversion (3rd+4th) RH 1 2 5 / LH 5 3 1; second
  inversion (4th+3rd) RH 1 3 5 / LH 5 2 1. The wider gap always takes the fourth.
- **Register rule**: place the tonic so its MIDI number is in [57, 68] (A3–G♯4); the LH plays an
  octave lower. Per exercise the span is then tonic−13 … tonic+16 = 29 semitones, the family as a
  whole sits in G♯2–C6, at most 3 ledger lines - inside every Beginner cap in SS4.
- **Key set**: majors C, G, D, A, E, B, F♯, D♭, A♭, E♭, B♭, F (max 6 accidentals); minors A, E, B,
  F♯, C♯, G♯, E♭, B♭, F, C, G, D. **E♭ minor is chosen over D♯ minor** at the six-accidental slot
  (D♯ minor's V would need C𝄪). **G♯ minor keeps its double sharp** (V = D♯–F𝄪–A♯): it is the correct
  spelling, Verovio engraves it, and respelling it as A♭ minor would need 7 flats *and* F♭ - the item
  carries a note saying so rather than breaking FR-005's "only the key differs".
- No key signature with |fifths| > 6 in this family.

### 5.2 Chord-change drills (`changes`, one definition -> 16 items)

What makes a *change* drill different in notation: the written rest **is** the declared travel budget.

| | Per-key exercise | Change drill |
|---|---|---|
| Rhythm | continuous half notes | dotted half + quarter rest |
| Structure | through-composed 8 bars | a 2–4 chord cycle with a backward repeat |
| Second half | — | the same cycle with no rest (half + half): the lift time is taken away |
| Common tones | — | **tied**, so the learner stops lifting what does not move |
| Labels | Roman numerals | chord names *and* Roman numerals |

Frame: 4/4, `divisions` 4, quarter = 60, both hands the same shape an octave apart, fingering
everywhere, register rule as above. Bars 1–8 = section A (with lift, backward repeat), 9–12 =
section B (joined), 13 = tonic whole note. 13 written measures, ≈ 25 after expansion (≈ 100 s).
A 2- or 4-chord cycle fills the eight slots exactly; a 3-chord cycle holds its last chord for two.

| # | Drill | Cycle | Why |
|---|---|---|---|
| 1 | I–V–I in C | C · G⁶ · C · C | the smallest change: two notes move by step |
| 2 | I–IV–I in C | C · F⁶⁴ · C · C | the other primary change; common tone C tied |
| 3 | I–IV–V–I in C | C · F⁶⁴ · G⁶ · C | the full perfect cadence (FR-004) |
| 4 | I–IV–V–I in G | G · C⁶⁴ · D⁶ · G | the same with one black key |
| 5 | I–IV–V–I in F | F · B♭⁶⁴ · C⁶ · F | the same in a flat key |
| 6 | C major ↔ C minor | C · Cm · C · Cm | same-tonic quality change (FR-004): only the third moves |
| 7 | A minor ↔ A major | Am · A · Am · A | the same change upward |
| 8 | i–iv–V–i in A minor | Am · Dm⁶⁴ · E⁶ · Am | minor cadence with the raised leading tone |
| 9 | i–iv–V–i in D minor | Dm · Gm⁶⁴ · A⁶ · Dm | the same in a flat key |
| 10 | I–vi–IV–V in C | C · Am · F · G | relative minor, two common tones |
| 11 | I–V–vi–IV in C | C · G · Am · F | the most transferable four-chord loop |
| 12 | ii–V–I in C | Dm · G · C · C | root motion by fourths |
| 13 | I–vi–ii–V in C | C · Am · Dm · G | turnaround; minimal hand travel |
| 14 | Diatonic ladder in C | C Dm Em F G Am B° C | major/minor/diminished by shape |
| 15 | Tonic inversions in C | C · C⁶ · C⁶⁴ · C | the shapes that make the rest easy |
| 16 | Plagal then perfect in C | F⁶⁴ · C · G⁶ · C | "amen" against V–I |

Twelve is the requirement (FR-004/SC-004); sixteen is the planned set. A 12-bar blues does **not**
fit this template and would be a separate family, not an exception to this one.

**Deliberately not in this feature**: measuring the change gap (time from releasing chord A to
completing chord B) and its consistency. The expert proposed named constants for it; that is a new
Practice measurement with its own UI and grading questions, and the spec asks only that the drills
exist. Recorded in `research.md` as a follow-up candidate.

### 5.3 Repertoire shortlist

Every piece below is public-domain music that **we engrave ourselves** unless a CC0 file turns up
(research R-1); "binding criterion" is the SS4 row that decides its level, and the numbers are
confirmed per file by the index generator before an item ships.

*Für Elise, placed:*

| Version | Level | Binding criterion |
|---|---|---|
| WoO 59, complete | Advanced | 5 - the C-section run is 32nds (0.125 beat); it fails Intermediate on that cap alone |
| A–B–A theme, simplified (our arrangement) | Intermediate | 5 - shortest value a 16th; span ≤ 48. **This is the item User Story 1 opens** |
| Theme, 16 bars, melody + single bass (our arrangement) | Beginner (optional) | 5 - eighths; hand independence ≈ 0 |

*Beginner (target 6, planned 10):* Czerny Op. 821 (substituted for Op. 599 - see the note below) nos.
1, 5, 11, 18 or nearest verifiable equivalents (criteria 5, 1/16, 5, 3);
Gurlitt Op. 117 nos. 1–3 (14: 8–16 bars); Köhler Op. 190 no. 1 (1); Türk, two or three
*Kleine Handstücke* (9); Beethoven, *Ode to Joy* theme in our own two-hand setting (5); traditional
*Greensleeves* in A minor, our setting (12); *Für Elise* theme simplified (5). Schumann Op. 68 no. 1
is a candidate whose level depends on whether the engraving uses two voices per staff (criterion 4).

*Intermediate (target 5, planned 11):* Petzold, Minuet in G BWV Anh. 114 (5) and in G minor
Anh. 115 (3); Musette in D BWV Anh. 126 (19); Bach, Prelude in C BWV 846 (19 - numerically
Intermediate; Advanced only with `raisedBecause`); Burgmüller Op. 100 nos. 1, 2, 5 (19, 6/19, 5);
Schumann Op. 68 nos. 10 and 8 (3, 17); Clementi Sonatina Op. 36 no. 1 mvt I (7+19); Satie,
*Gymnopédie no. 1* (25+17 - written pedal, whose "not played" limitation is recorded); Chopin,
Prelude Op. 28 no. 7 (9 - flagged: numerically trivial, musically about tone).

*Advanced (target 4, planned 10):* *Für Elise* WoO 59 complete (5); Chopin Preludes Op. 28 nos. 4
(11), 15 (14+9) and 20 (16); Chopin Nocturne Op. 9 no. 2 (21 - **flagged**: 11:8 and 22:12 tuplets
may not divide `<divisions>` evenly, so it is tested before it ships); Beethoven, *Moonlight* mvt I
(4+25); Mozart K. 545 mvt I (6 - numerically Intermediate, `raisedBecause: human`); Bach, Invention
no. 1 BWV 772 (**the flagged case**: passes Intermediate on every number, Advanced by voice
independence the criteria cannot see); Debussy, *Clair de lune* (9+4+16); Joplin, *The Entertainer*
(17+14).

**Open at plan time, resolved per item at implement time**: the exact pitch extremes and bar counts
above are the expert's estimates, not measurements. Each is measured with the index generator (or
`pnpm tsx tests/tools/probe-real-scores.ts`) when the file exists, and the level is confirmed then -
never frozen from this table.

**Czerny descoped entirely (found at implement time, T053).** Op. 599 is not on the Mutopia Project
(its Czerny holdings are Op. 821 and Op. 840 only), and IMSLP's Op. 599 is a raster scan with no
text/vector source - no way to read the actual notes off it in this environment (no PDF-rendering
tool available, and OCR of 19th-century engraved music is unreliable for pitch content). Op. 821,
"160 Eight-Measure Exercises", was tried as a substitute since it is genuinely on Mutopia with literal
LilyPond source text - but sampling 11 of its 19 digitized numbers found every one uses continuous
16ths/32nds, tuplets or grace notes at Allegro-or-faster tempi (confirmed by an independent source,
practisingthepiano.com, describing the opus as bridging *intermediate to advanced* technique, not
beginner). Forcing any of them to `level: "beginner"` would fail the level check outright (data-model
§3: assigned below computed fails, and there is no `raisedBecause` escape hatch in that direction).
**Decision: skip this shelf slot rather than mislabel content.** The Beginner and Intermediate shelves
both clear their FR-008 targets without it (Gurlitt/Köhler/Türk plus the existing items for Beginner;
Petzold/Burgmüller/Schumann/Clementi/Satie plus the existing item for Intermediate - see the counts in
`implementation-log.md`). The 11 verified Op. 821 numbers (Mutopia piece-info ids 2060-2085, typeset
by Manuel Castejon Limas from the Peters 1888 plate) are kept here as a reference for a future session
that wants more Intermediate velocity studies: most would need per-piece facts checked against the
Intermediate caps rather than the Beginner ones, since preliminary reading suggests several (e.g.
nos. 8, 11) may fit Intermediate on the numbers.

## 6. Library panel state

```text
idle ──open panel──> loadingIndex ──ok──> ready ──filter/section──> ready
                          │                 │
                          └──error──> indexError ──retry──> loadingIndex
                                            │
                     ready ──open item──> openingItem ──ok──> ready (Score loaded, panel closes)
                                               └──error──> ready + notice (panel stays open)
```

- The panel is a popover; `closeForRun()` (feature 004) dismisses it when a run starts, from any
  state. A fetch in flight is abandoned, never awaited on the way out.
- `indexError` keeps the recents list and the Open button usable - the library failing must not take
  the app's own file handling with it.
- `openingItem` is the only state that can end with the panel closing, and only on success: the
  musician asked for a Score and got one.
- The filter survives panel close (persisted); the section selection survives; the text box does not.

## 7. Where existing models are touched

| Existing | Change |
|---|---|
| `src/engine/ports.ts` | **+** `LibraryCatalog`, `CatalogResult`, `CatalogError` |
| `src/ui/state/viewState.ts` | none - the library lives in the existing `scores` panel |
| `src/app/session.ts` | **+** catalog wiring, **+** `openedLibraryItemId` (cleared when a user file is opened) |
| `src/ui/state/scoreState.ts` | unchanged; the library adds its own `libraryState` |
| `src/engine/storage/*` | unchanged - a library item opens and then lands in recents like any file |
| `musicxml/chords/c-major-scale-and-chords.musicxml` | moves to `public/library/learning/chords/`, README pointer left behind (owner decision D-3) |
