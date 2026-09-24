# Research: Library Fidelity Audit

Phase 0 for feature 007. Facts marked **verified** were checked on 2026-09-23. Sources were read from the Mutopia
piece pages (`piece-info.cgi?id=N`, fields "Copyright", "Source", file links) and the Mutopia search. LilyPond MIDI
behaviour comes from the LilyPond 2.24 Notation Reference. The domain questions (comparison semantics, editions,
folk-tune versions, theory rules) were answered by the `music-domain-expert` role. Its findings are summarised in R5,
R8, R11 and R15; where it said "my recollection, not checked", this document says **to verify**.

---

## R1. Where the sources live, and why they are committed

**Decision**: Commit each approved source's machine-readable files **unchanged** under
`content/library/sources/<source-id>/`, with a `source.json` manifest (contract `source-manifest.md`) that records the
URL, edition, licence as stated by the publisher, the date obtained, the owner's approval date, and a SHA-256 per
file. Scans (PDF) are recorded by URL only and not committed.

**Rationale**: FR-016 and SC-003 require that re-running a comparison gives the same result. Only files pinned by
hash make that true offline, on every agent's machine and in CI. Mutopia `.ly` and `.mid` files are small (a few KB
to about 60 KB), so the whole set is well under 1 MB. `content/` is not served, so nothing new ships to users.
Scans are large, and a visual check is not re-run by a machine anyway (FR-019), so a URL is enough for them.

**Alternatives considered**:

- **Download at test time**: needs the network, and Mutopia can change or move files, so the result is not
  reproducible.
- **Record URLs only**: nobody could re-run the check against the exact bytes that were compared.
- **Store under `tests/fixtures/`**: those are behaviour fixtures, one behaviour per file. Sources are content
  provenance and belong with `content/library/`.

## R2. Two independent readings of every source

**Decision**: A Mutopia source is read twice:

- **notation**: our LilyPond-subset reader of the `.ly`;
- **sound**: our MIDI reader of the `.mid` that Mutopia generated with LilyPond from the same `.ly`.

An item is compared with the notation reading on every aspect (bars, repeats, pitch, onset, duration, spelling,
grace notes). The notation reading is compared with the sound reading on pitch, onset and duration. Both must give
the recorded result (`data-model.md` §4.1a).

**Rationale**: The MIDI is LilyPond's own interpretation of the file, so it is independent of any code we write.
But it has no bars, repeats or spelling, and FR-005 requires bar count and repeat structure. Our `.ly` reader gives
all of those, but on its own it would be "our code checking our code". The chain gives both properties:

- whatever our reader gets wrong about the notes, the MIDI catches;
- whatever the MIDI cannot express, our reader supplies.

This is the Für Elise method (902 notes against Mutopia's MIDI), extended to structure and made repeatable.

**Alternatives considered**:

- **MIDI only**: it misses repeats, bar count and spelling (FR-005).
- **`.ly` reader only**: nothing independent checks it.
- **Rendered PDF compared by image**: not mechanical.

## R3. MIDI reader

**Decision**: Write our own Standard MIDI File reader, `tools/library/fidelity/midi.ts`, of roughly 150 lines:

- formats 0 and 1;
- running status;
- note-on with velocity 0 read as note-off;
- meta events skipped except time signature;
- no SMPTE division; any other file shape fails with the byte offset.

**Rationale**: The format is small and fixed. The reader is dev-time only. Principle VIII asks for no dependency
without need. Tests use hand-built byte arrays plus one real Mutopia file.

**Alternatives considered**: `@tonejs/midi` (MIT) and `midi-file` (MIT) both work, but each is a new dependency for
about 150 lines. `@tonejs/midi` also converts ticks to seconds and floats, which we must avoid (R5).

## R4. LilyPond reader and converter

**Decision**:

- **Scope**: an own reader for the LilyPond **subset the audited sources use** (`contracts/fidelity-tools.md` §3.1),
  failing loudly on anything else.
- **Converter**: the same reader drives it, writing through the existing dev-only MusicXML writer (R13).
- **Proof of each conversion**: the MIDI cross-check (R2 step 2).
- **Proof of the reader**: tests with tiny own-work `.ly` fixtures, one per construct, plus every real source's
  MIDI cross-check.

**Rationale**:

- FR-007 requires replacing differing items by a **conversion**.
- The Für Elise converter was a one-off script outside the repository. Its method cannot be re-run, reviewed or
  reused.
- Failing loudly on unknown constructs is what stops a skipped `\repeat` from producing plausible but wrong music.

**Alternatives considered**:

- **python-ly (`ly musicxml`)**:
  - GPL;
  - needs a Python toolchain on every agent's machine;
  - its MusicXML export is documented as incomplete (repeats/voltas, multiple voices).
- **Installing LilyPond** (for example to re-render MIDI with `\unfoldRepeats`): a GPL toolchain dependency for all
  agents, and it still produces no MusicXML.
- **MuseScore import**: MuseScore 4 does not import LilyPond.
- **Hand transcription from the PDF**: the failure mode this feature exists to end.

## R5. Comparison semantics against LilyPond MIDI

**Decision**:

1. **Time**: onsets and durations are exact rationals in quarter notes (`data-model.md` §1), from the MIDI header
   division and from the item's divisions. Tempo events, velocity and controllers (pedal CC64) are ignored.
2. **Order**: compare in **written** order when the MIDI is folded, and in **played** order when the source's
   `\midi` score uses `\unfoldRepeats`. `midiOrder` is recorded per source after grepping the `.ly` for
   `unfoldRepeats` and `articulate`. D.C./D.S./Coda text is never followed by LilyPond MIDI.
3. **Ties** are merged into one note on every side before comparing.
4. **Grace notes**:
   - LilyPond's MIDI places them before the main note, taking their time from the **previous** note;
   - the main note's onset is not moved.
   - So grace notes are excluded from the note comparison on all sides and compared as notation (pitch, principal
     note, order) between item and `.ly` reading. In the MIDI step, the note before a grace group may sound shorter
     by exactly the grace time.
5. **Articulations and ornaments**:
   - Without `\articulate`, trills, turns and mordents sound as the main note, and staccato may shorten a note.
   - A MIDI note shorter than written is accepted only where the `.ly` reading shows an articulation or a following
     grace group.
   - Anything else is a difference.
   - If a source's `\midi` score uses `\articulate`, every note may sound shorter, so the MIDI step would lose its
     power over durations. For such a source, the MIDI step compares `pitch` and `onset` only. Its record says
     "durations checked against the notation only", and its manifest notes `\articulate` (analyze A6).
6. **Ottava**: pitches in the `.ly` are already at sounding pitch under `\ottava`, so the MIDI sounds right. An
   "8va" written only as text markup is not transposed. The reader reports it, and the record names it as a source
   defect.
7. **Arpeggio signs and fermatas** have no timing effect in the MIDI; chord notes start together.
8. **Unison between voices**: LilyPond MIDI may merge or cut two voices sounding the same pitch at once. This is
   accepted only where the `.ly` reading shows the unison.
9. **Hands**: MIDI tracks follow staves, and `\change Staff` notes can land on either track. So staff is compared
   between item and `.ly` reading only, never against MIDI tracks.
10. **Alignment is per bar, declared in the record** (`data-model.md` §4.2), never searched. A missing bar is then
    reported once, not as every later note being wrong.

**Rationale**: these are exactly the ways LilyPond's default MIDI legitimately differs from the notation (LilyPond
2.24 Notation Reference: "Supported notation for MIDI", "Enhancing MIDI output", "Using repeats with MIDI"). Each is
tied to something visible in the notation reading, so a real error cannot hide behind a general tolerance.

**Alternatives considered**:

- A timing tolerance (for example ±1 tick): it would hide a planted duration error on short notes and is a magic
  number (Principle II).
- Comparing in seconds: tempo maps differ, and floats make "0 differences" unreliable.

## R6. Repeats and played order

**Decision**: `repeats` compares, per written bar, the repeat-start, repeat-end, times and ending numbers between
item and `.ly` reading. `playedOrder` unfolds both with one shared rule and compares the bar sequence:

- item side: the app's own `buildTimeline` repeat expansion;
- source side: the same expansion applied to the `.ly` reading's bars.

When the MIDI is unfolded, the MIDI step also compares in played order.

**Rationale**: the spec's edge case wants a missing repeat caught "even when every written bar matches". Unfolding
the item with the app's own code also proves that what the app plays is right.

**Alternatives considered**: comparing repeat barlines only misses a wrong jump target in a structure the app
unfolds differently.

## R7. Melody quotes in arrangements (US2)

**Decision**:

- **Melody line**: the highest sounding note per onset of a named staff (default staff 1), ties merged, over the
  bar range the record declares.
- **Source line**: from a named staff/voice of the source (for example the soprano of an SATB hymn).
- **Order**: pitch order must match exactly.
- **Rhythm**: compared too, unless the item's `departures` names a rhythmic change for that range. In that case
  rhythm differences are listed as allowed and not counted.
- **Transposition**: a transposition departure ("transposed to F major") is applied as a declared interval before
  comparing.
- **Invented bars**: bars the arrangement invents (named in `departures`) are not compared. They are listed in the
  report as "own material".

**Rationale**: FR-011 requires "melodic pitch and order" to match, with rhythm free only where declared. FR-012
requires added material to be named, not verified against anything.

**Alternatives considered**: fuzzy sequence alignment (edit distance) would "match" a wrong melody with a small
score and needs a threshold. Rejected for the same reason as tolerances (R5).

**Addendum (2026-09-24, T054)**: how the record says that rhythm is free.

- **Decision**: the check carries `melodyRhythm: "allowedByDeparture"`, and `checkRecord` requires the sidecar to be
  an arrangement with `departures`. Allowed rhythm differences are returned apart (`MelodyResult.allowed`) and
  printed, never counted.
- **Rationale**: `departures` are free text for musicians. Parsing them for "rhythm" would be brittle and would
  change meaning with wording.
- **Alternatives**:
  - reading the allowance from the aspects (melody without `onset`/`duration`): overloads aspects that mean
    whole-item note checks elsewhere;
  - a keyword in `departures`: brittle, as above.
- **Pitch**: compared as sounding pitch (MIDI) after `transpose`. Enharmonic spelling is a separate `spelling`
  difference, only when the check lists `spelling`, so E-flat for D-sharp is never a "wrong note".
- **Rhythm**: onset from the start of the declared range, plus duration, so the ranges may differ in length (a
  renotated quote).

## R8. Theory check independence (US3)

**Decision**:

- **Code**: `tools/library/fidelity/theory.ts` computes spelling by **letter arithmetic** (root, root + 2 letters,
  root + 4 letters, alterations from semitone distances). It uses its own scale tables. It reads each file with the
  app's `readXml` only.
- **What the exercises are expected to contain**: the claim table `exercise-claims.ts`, written by hand from each
  family's **title and `trains` text**. It is never read from `content/library/exercises/`.
- **Independence enforcement**: an architecture test asserts that nothing under `tools/library/fidelity/` imports
  `src/core/library/exercise/**` or reads `content/library/exercises/**`.
- **Rules**: `data-model.md` §5, including the music-domain-expert's list of keys needing care:
  - G-sharp minor V = D-sharp, F-double-sharp, A-sharp;
  - E-flat minor iv = A-flat, C-flat, E-flat;
  - B-flat minor iv = E-flat, G-flat, B-flat;
  - F-sharp major V = C-sharp, E-sharp, G-sharp.
- **Probe of the shipped G-sharp minor triads file**: its V chord is spelled D#, F##, A# (the file's bar 2).

**Rationale**: FR-013 says the check must not reuse the generator's logic. The generator spells from the key
signature's `fifths` and degree tables. The check uses a different method (letter steps plus semitone counts), so
one shared bug cannot pass both.

**Alternatives considered**:

- Re-running the generator and diffing: that is the existing golden test and it is not independent.
- A music21-style library: Python, and a new toolchain.

## R9. Records, report and `reviewedBy`

**Decision**:

- **Records**: one per item at `content/library/audit/<item-id>.json` (contract `audit-record.md`), plus a
  generated `docs/library-audit.md`.
- **Reviewer fields**: the sidecar's `reviewedBy`/`reviewedOn` must equal the record's `checkedBy`/`date`.
- **Test**: `tests/library/fidelity.test.ts` enforces coverage, re-run results, outcome and claim consistency, the
  reviewer rule and report freshness.
- **Existing Für Elise evidence**: the Advanced Für Elise's evidence (FR-001) is carried into its record. Its
  source is committed, and the check is re-run by the new tool, so the old one-off result becomes repeatable.

**Rationale**:

- One file per item keeps merges simple and makes the record sit where the item's id says.
- A generated report cannot disagree with the records.
- Tying `reviewedBy` to a record makes a plausibility review impossible to record there (FR-018, SC-006).

**Alternatives considered**:

- One big JSON: merge conflicts, and it is hard to read one item.
- A hand-written report: it goes stale, and nothing proves its claims.
- A new sidecar field pointing at the record: redundant, because the id already determines the path.

## R10. Replace first; what happens to titles and levels

**Decision**, per non-exercise item:

1. **Source with notation**: convert the source bars the item claims (the whole piece for an "original", the named
   part for an excerpt) with `library:convert-ly`, and compare.
2. **Current item has 0 differences**: keep it. Outcome `verified`; the file is unchanged, so Note IDs are unchanged.
3. **Otherwise**: replace it by the conversion (FR-007), keeping the id (FR-020). Outcome `replaced`.
4. **Deliberate arrangement**: keep the arrangement if its quotes match (R7) and its departures are listed
   (FR-010). If a quote is wrong, fix the quoted bars from the source (outcome `fixed`) and re-check.
5. **Invented bars in a non-arrangement** (Satie mm. 33-37, Burgmüller No. 5 mm. 12-16):
   - preferred: replace with the complete piece, if the probe keeps it at a level (next rule);
   - otherwise: relabel as an arrangement/excerpt with `departures` naming the invented bars. Outcome `relabelled`.
6. **Levels**:
   - Run `tools/library/probe.ts` on the result. If the computed level differs, the item moves to the computed
     level. It may keep a higher assigned level only with the existing `raisedBecause` rule; below the computed
     level is not allowed by `checkLevel`.
   - An item may keep its level through a **declared** departure (for example Burgmüller No. 2's octave change)
     only as a labelled arrangement.
   - The preferred order is: faithful at the computed level first; a labelled arrangement only when the move would
     break a level minimum. The choice is logged.
   - Every level shortfall goes into the report and the hand-off (FR-022, owner decision D-3).

**Rationale**: FR-007 and the spec's assumption "replacements may change a piece's length and level". Keeping ids
keeps saved progress (SC-007).

**Alternatives considered**:

- Hand-fixing the differing bars: forbidden by FR-007 for originals.
- Keeping the level by silently simplifying: that is what produced the undisclosed octave change in Burgmüller
  No. 2.

## R11. Per-item source inventory (verified 2026-09-23 unless marked)

### Table A - Mutopia sources, each page says "Copyright: Public Domain" (owner decision D-1)

| Source id (planned) | Mutopia id | Work | Edition (as Mutopia states it) | Files | Used for |
|---|---|---|---|---|---|
| `mutopia-931-beethoven-woo59` | 931 | Beethoven, Für Elise WoO 59 | Breitkopf & Härtel, 1888 | .ly, .mid | advanced/fur-elise-complete (re-run), intermediate/fur-elise-theme, beginner/fur-elise-theme-16-bar (quote) |
| `mutopia-5-bach-bwv846` | 5 | Bach, WTC I Prelude 1, BWV 846 | "Unknown" | .ly, .mid | advanced/bach-prelude-bwv846 |
| `mutopia-468-chopin-op28-no4` | 468 | Chopin, Prelude Op. 28 No. 4 | Peters, 1879 | .ly, .mid | advanced/chopin-prelude-op28-no4 |
| `mutopia-472-chopin-op28-no20` | 472 | Chopin, Prelude Op. 28 No. 20 | Edition Peters | .ly, .mid | advanced/chopin-prelude-op28-no20 |
| `mutopia-37-satie-gymnopedie1` | 37 | Satie, Gymnopédie No. 1 | Dover Edition | .ly, .mid | advanced/satie-gymnopedie-no1 |
| `mutopia-203-burgmuller-op100-no2` | 203 | Burgmüller, Op. 100 No. 2 | Collection Litolff | .ly, .mid | intermediate/burgmuller-op100-no2 |
| `mutopia-214-burgmuller-op100-no5` | 214 | Burgmüller, Op. 100 No. 5 | Collection Litolff | .ly, .mid | intermediate/burgmuller-op100-no5 |
| `mutopia-804-clementi-op36-no1` | 804 | Clementi, Sonatina Op. 36 No. 1 | Sonatina Album, G. Schirmer, 1893 | .ly, MIDI **zipped** (the zip's URL and hash, and the extracted movement-1 file's hash, are both recorded) | intermediate/clementi-sonatina-op36-no1-mvt1 |
| `mutopia-1283-new-britain` | 1283 | "New Britain" hymn tune, SATB | cyberhymnal (1831) | .ly, .mid | beginner/amazing-grace (melody) - verified 2026-09-24: the tune is the Soprano; the file's ABC notes name Excell's 1900 harmonization, and the tune is the familiar modern form (R15) |
| `mutopia-1247-greensleeves-hymntune` | 1247 | "Greensleeves" hymn tune, SATB | cyberhymnal | .ly, .mid | beginner/greensleeves (melody) - checked 2026-09-24: E minor, tune in the Soprano, with D-sharp (raised 7th) and both C-sharp and C (6th) |
| `mutopia-528-ode-to-joy` | 528 | Beethoven, "Ode to Joy", SATB hymn | "Various" | .ly, .mid | beginner/ode-to-joy: pitch order only; the symphony's rhythm by scan (table B) |
| `mutopia-2236-mozart-ah-vous-dirai-je` | 2236 | Mozart, "Ah vous dirai-je, Maman" theme, 2 guitars | Paris: Porro, plate 79 | .ly (zipped), .mid | beginner/twinkle-twinkle-little-star (melody) - 2026-09-24: the theme is `\score` 9 of 13 ("Allegro (Thema)"), tune in guitar 1 (`themaA`), C major 2/4; the MIDI holds all 13 pieces (theme = tracks 17-18) |

**Rejected sources**:

- **Mutopia 659**: Schumann Op. 68 No. 10 "Le gai laboureur" (Peters). The page says **"Creative Commons
  Attribution-ShareAlike 2.5"**. It fails FR-006. It was the only Op. 68 No. 10 on Mutopia (searched "laboureur",
  "Landmann", "jeunesse", "Jugend", "Op. 68"). The shipped item says its notes were "extracted programmatically
  from Mutopia's rendered MIDI", so the item itself is derived from a non-compliant source. This is owner decision
  D-2.
- **`github.com/musetrainer/library`** (all files): the repository calls itself "Public domain MusicXML files" but
  has no licence file (GitHub `license: null`, checked 2026-09-23). Every sampled file's `<source>` is a
  musescore.com user upload; the Für Elise upload says "All rights reserved" (feature 005, T087). The collection
  also includes copyrighted works (Paul de Senneville's "Mariage d'Amour", 1978, which it also lists as Chopin's
  "Spring Waltz"). It is rejected for all items, including as a reference (spec Clarifications 2026-09-23).

### Table B - public-domain printings for visual checks (URLs to be recorded at implement; **to verify**)

| Needed for | Printing | Why visual |
|---|---|---|
| bach-prelude-bwv846: edition (35 vs 36 bars) | Bach-Gesellschaft Ausgabe vol. 14 (1866), IMSLP public-domain scan. The CC0 *Open Well-Tempered Clavier* score PDF (welltemperedclavier.org / Internet Archive) is a second witness | Mutopia 5 names no edition, so the edition must be established by eye, bar count only |
| ode-to-joy: rhythm of the theme | Beethoven, Symphony No. 9, 4th mvt, low-strings entry of the theme, Breitkopf & Härtel Gesamtausgabe (IMSLP, PD) | the only machine-readable Mutopia version is a hymn setting |
| jingle-bells: the modern refrain | a pre-1928 US sheet-music printing with the modern chorus (Levy Sheet Music Collection / Library of Congress). **The 1857 first edition has a different chorus and cannot verify the item** | no machine-readable PD source found |
| mary-had-a-little-lamb: the familiar tune | a 19th-century printing of the "Goodnight, Ladies" / "Merrily We Roll Along" tune (the expert believes E. P. Christy, 1847; **to verify**). Lowell Mason's 1830s setting is a different tune | no machine-readable PD source found |
| amazing-grace: Excell form | E. O. Excell's arrangement (c. 1900-1910) in a PD hymnal scan, if Mutopia 1283 turns out not to be the modern form | the modern tune follows Excell, not Walker's 1835 shape-note setting |

### Table C - what each repertoire item claims, and the expected path (confirmed or overturned by the comparison)

| Item | Claims | Known issue before comparison | Expected path (R10) |
|---|---|---|---|
| advanced/fur-elise-complete | original, complete | none; verified 2026-09-23 by a one-off script | re-run with the committed source -> `verified` |
| advanced/bach-prelude-bwv846 | original | "verification" was one bar compared by pixels, plus a guitar-tab chord list | compare with Mutopia 5; edition by scan; `verified` or `replaced` |
| advanced/chopin-prelude-op28-no4 | original, complete | sidecar admits bar 23 bass octave uncertain; bar 9 fixed "not re-checked against the LilyPond source" | compare; likely `replaced` |
| advanced/chopin-prelude-op28-no20 | original | pedal collapsed to one press (disclosed); bar 3 E-flat/E-natural edition point | compare with Mutopia 472; record the bar 3 reading as that edition's |
| advanced/satie-gymnopedie-no1 | "our own engraving", `arrangement: false` | bars 33-37 invented, contradicting `arrangement: false`; key described as B minor (usually D major) | `replaced` by the complete conversion (about 78 bars, **to verify**) |
| intermediate/burgmuller-op100-no2 | original, `arrangement: false` | bar 31 moved up an octave for the level, undisclosed as an arrangement | `replaced` faithfully; level per R10 (may compute Advanced) |
| intermediate/burgmuller-op100-no5 | arrangement, opening strain + own close | bars 12-16 invented (disclosed) | `replaced` by the complete piece if it stays Intermediate; else `relabelled` with `departures` and quotes checked |
| intermediate/clementi-sonatina-op36-no1-mvt1 | `arrangement: true` (exposition, tempo 144) | an excerpt with an editorial tempo is not an arrangement | convert the exposition (bars 1-15); `replaced`, claim `excerpt`; tempo change stated; `arrangement: false` |
| intermediate/fur-elise-theme | arrangement, "simplified" | what is simplified is not listed | melody/quote check against Mutopia 931; `departures` listed; `fixed` or `relabelled` |
| intermediate/schumann-op68-no10 | original, complete | derived from a CC BY-SA 2.5 file | owner decision D-2 (recommended `removed`) |
| beginner/fur-elise-theme-16-bar | arrangement | quotes pickup + bar 1 only; departures in prose | melody check on quoted bars; `departures` list; `relabelled` or `verified` |
| beginner/amazing-grace | arrangement | quality of the "verified" tune claim (Wikipedia/hymnary prose) | melody check vs Mutopia 1283 (or Excell scan) |
| beginner/greensleeves | arrangement | claims "natural A-minor throughout"; the familiar tune raises the 6th/7th | melody check vs Mutopia 1247; likely `fixed` |
| beginner/jingle-bells | arrangement, refrain | modern-tune source not yet found | visual vs table B printing |
| beginner/mary-had-a-little-lamb | arrangement | tune source not yet found | visual vs table B printing |
| beginner/ode-to-joy | arrangement, first two phrases | bars 4 and 8 dotted rhythm flattened; transposition to C undeclared | melody vs Mutopia 528 + symphony scan; `departures` list |
| beginner/twinkle-twinkle-little-star | arrangement | - | melody vs Mutopia 2236 theme |

**Exercises** (41): 24 triads (12 major + 12 minor), 16 chord-change drills, and the hand-written C major scale and
chords item. All get the theory check (R8). The one hand-written item (`c-major-scale-and-chords`) is also checked
for its scale (letters and semitone pattern), per US3 scenario 3.

## R12. Planted errors

**Decision**: `tests/tools/fidelity/planted.test.ts` mutates a copy of a verified item (and, for theory, one file
per family) once per error kind, and asserts exactly the expected difference and bar (contract
`fidelity-tools.md` §5). The planted cases are: pitch, duration, missing bar, missing repeat, spelling, grace note,
melody note, and for theory a respelled tone, a moved tone and a swapped inversion per family. These tests are
written before any "0 differences" result is recorded (FR-017, SC-004).

**Rationale**: a comparator that reports "0 differences" because it compared nothing is the most likely bug. A
planted error per kind is the cheapest proof that it works.

## R13. Extending the MusicXML writer

**Decision**: Extend `src/core/musicxml/write.ts` additively, with optional fields only:

- repeat barlines and `<ending>`;
- `<grace/>`;
- `<time-modification>`;
- `<octave-shift>`;
- mid-piece `<attributes>` (clef, key, time);
- `16th`/`32nd` types;
- slurs, dynamics, `<pedal>`;
- tempo direction with `<sound tempo>`.

The converter writes through it.

**Addendum (2026-09-24, T027/T029)**: writing the converter showed more marks that a printed edition carries and
the app already reads, so they were added the same way (optional, exercise output unchanged): `<articulations>`
(staccato, accent, tenuto), `<ornaments>` (trill, mordent, inverted mordent, turn), `<fermata>`, `<arpeggiate>`,
hairpins (`<wedge>`), whole-bar rests (`<rest measure="yes"/>`), any number of dots, bold tempo words and italic
expression words, `<key><mode>`, and `<rights>`/`<source>` in the identification (as in the Für Elise item). Marks
that change what the app plays or grades (dynamics, ornaments, arpeggios) are never dropped by the converter: an
unsupported one fails the conversion. Display-only marks the writer cannot express are dropped and listed by
`library:convert-ly`.

**Rationale**:

- One writer for both generated exercises and converted pieces.
- It is already dev-only and guarded out of the bundle (T086).
- The exercise goldens (`tests/core/library/exercise/goldens.test.ts`) prove its existing output is byte-identical.
- The app's `readXml` + `buildScore` round-trip checks every new element on read.

**Alternatives considered**: a separate writer in `tools/` means two writers that drift. Emitting strings in the
converter is untestable in isolation.

## R14. Goldens that depend on library content

**Decision**:

- **Replaced items' Note IDs**: they change because their notes change. The identity golden
  (`tests/fixtures/library-identity.json`) is re-captured for **those items only**, from the converter output
  **before** `library:engrave`. The engraved file is then compared against it, as T087 did.
- **The Grade golden `furEliseThemeGrade`**: it grades a saved performance against `intermediate/fur-elise-theme`.
  If that item's notes change (R10 `fixed`), the Grade legitimately changes. It is re-captured, and the log names
  the notes that changed.
- **Unchanged items**: their golden entries must not change. The test compares all entries, so any unintended
  change fails.

**Rationale**: AGENTS.md: "If behaviour really changed an expected value, say why in the log". The golden still
guards every unchanged item.

## R15. Edition decisions and folk-tune versions

(music-domain-expert findings; each becomes a line in the item's record)

- **BWV 846**: Henle and Bach-Gesellschaft have 35 bars. The "Schwencke bar" between bars 22 and 23 (36 bars)
  came in through Czerny's 1837 Peters edition. The record names which one Mutopia 5 follows (established from its
  bar count, and by eye against the BGA scan).
- **Chopin Op. 28 No. 20**:
  - Bar 3: the first editions have E natural, while Eigeldinger argues for E-flat. The record names the Peters
    reading that Mutopia 472 carries.
  - Bar count: taken from the `.ly` (the piece has the added quiet repeat of the last four bars).
- **Clementi Op. 36 No. 1**: "Spiritoso" is Clementi's marking. Any metronome mark is editorial (the 1797 first
  edition predates the metronome), so the Schirmer mark is named as editorial and the item's 144 is stated as a
  change, not as the composer's.
- **Satie**: length from the `.ly`. The key description follows the key signature (two sharps) without claiming B
  minor.
- **Amazing Grace**: the modern tune follows E. O. Excell (c. 1900-1910), not Walker 1835 (tenor melody). The record
  names the version.
- **Greensleeves**: Stainer's *Christmas Carols New and Old* (1871) "What Child Is This" form (**to verify**), with
  Chappell (1855-59) as a second witness. The familiar melody raises the 6th and 7th degrees, and the metre change
  to 3/4 is a departure.
- **Jingle Bells**: the modern chorus differs from the 1857 print (see table B).
- **Mary Had a Little Lamb**: the familiar tune is "Goodnight, Ladies" / "Merrily We Roll Along", not Lowell Mason's
  setting.
- **Twinkle**: the French tune was first printed in 1761. Mozart's K. 265 theme has identical pitches.
- **Ode to Joy**:
  - Rhythm: the theme's bars 4 and 8 are dotted quarter, eighth, half. The item's plain rhythm is a departure.
  - Key: the transposition from D to C is a departure.
  - Hymn forms drop the bar 12-13 anticipation, which the item (8 bars) does not reach.

## R16. Delivering corrected items to browsers that already have the old ones (analyze A1, FR-024)

**Decision**:

- **Index**: `HttpLibraryCatalog.index()` becomes **network-first**, falling back to the cached index when offline.
- **Items**: `item(file, expectedHash)` uses a cached file only when its SHA-256 (`hashFile`, the same function
  that writes `index.json`'s `hash`) equals the index entry's `hash`. Otherwise it drops the entry and fetches.
- **What gets cached**: only bodies that match.
- **Cache name**: unchanged.
- **Contract**: `contracts/library-port-1.1.md`.

**Rationale**:

- Before this change, the adapter was cache-first for both the index and the items, and never checked anything
  (`src/engine/library/http-catalog.ts`, verified 2026-09-23). A musician who opened the library once would keep
  practising the invented Satie ending, or the old Für Elise, forever.
- The index already carries a content hash per item, so the check costs one digest per opened item and no new
  data.
- Network-first for a ~160 KB index is one request per session.

**Alternatives considered**:

- **Bumping the cache name** (`-v2`) on every library change: this relies on people remembering, and it throws away
  offline copies that are still valid. It is also exactly the step nobody remembered for Für Elise.
- **Content-hash URLs** (`item.musicxml?h=<hash>`): the same effect, but it leaves dead cache entries behind and
  changes the fetched URL in the desktop shell's `app://` handler.
- **A service worker**: the project has none (feature 005, D-2), and adding one is a larger change.

**Not changed**: Recents (`IndexedDbScoreStore`) keep the bytes the musician opened. Updating Recents is a separate
follow-up (spec Clarifications, analyze A2).

## R17. How the readers and the comparator meet the rules above (implementation, 2026-09-24)

**Decision**:

- **Bar pairing**: the comparator pairs bars by their **printed bar number** through the declared alignment
  (`itemBars` N-M maps onto `sourceBars` by a fixed offset). A deleted bar therefore gives one `barCount`
  difference plus the notes of that bar, never a cascade (contract `fidelity-tools.md` §5). A number printed twice
  (a split bar) is paired by its occurrence.
- **Positions**: a difference names the bar and the position in it (quarter notes after the bar line), so pickups,
  excerpts and MIDI files that start at 0 all compare the same way.
- **LilyPond octaves**: resolved in a pass after variables are expanded, in source order, as `\relative` itself
  works (a `\repeat unfold` body keeps its octaves on every pass; a chord's first note is the next reference).
  Durations are carried over in the parser, as LilyPond's parser does. `\ottava` changes nothing in pitch
  (research R5 rule 6; LilyPond 2.24 Notation Reference, "Ottava brackets": it sets `middleCPosition`).
- **Layout commands**: `\override`/`\set` of layout properties are skipped together with their Scheme value, since
  real Mutopia files are full of them. Properties that move notes in time or pitch fail, as do Scheme expressions
  anywhere else.
- **MIDI step** (R5 rules 4, 5, 8): grace notes are set aside in the MIDI by pitch, taking the latest MIDI note of
  that pitch before the principal note. The note before a grace group may end exactly where the group starts. An
  articulated note may be shorter. A unison may be merged (one MIDI note to the end of the later note) or cut (the
  first note ends where the second starts), and only where the notation shows two overlapping notes of one pitch.
  **Widened 2026-09-24 (T095, Satie Mutopia 37 bars 9-12)**: one MIDI channel has one state per key, so under a held
  note that another voice strikes again and again, each MIDI note ends where the next note on that key starts. The
  accepted ends are therefore the starts and ends of every note in the chain of overlapping notes on that key, not
  only of the notes that overlap this one. Without such a chain in the notation, the same MIDI is still a `duration`
  difference (compare.test.ts).
- **Written bars** (added after reading the real Mutopia 931 file): the reading's bars follow the printed page, not
  LilyPond's timing measures. A `\bar ""` hides a bar line, repeat and volta boundaries are bar lines, and
  `\set Timing.measurePosition` re-anchors the measures. That is how the 2.18 file writes its second ending
  (`a'8 \bar "" r16 b' \set Timing.measurePosition = #(ly:make-moment -1/8) c''16 d''`: one printed bar), and how
  the MusicXML item, converted from it, has it. A repeat starting at the beginning of the piece has no start-repeat
  bar line, as LilyPond prints none there (Notation Reference 2.24, "Long repeats"). Bar checks are still checked
  against LilyPond's own measures.
- **Played order**: the LilyPond reading's bars go through the app's own `unroll()`; the MusicXML reading takes
  `buildTimeline(score).timeline.passes`. Both use one repeat rule (R6).

**Rationale**: every rule is tied to something visible in the notation reading or declared in the record; nothing
is searched for and no tolerance is added (R5, data-model.md §9).

**Alternatives considered**: pairing bars by position would report every later bar after a deleted one; resolving
octaves while parsing would get variables used inside `\relative` wrong.

## R18. Fidelity standards for MusicXML expectations discovered (US1)

**Decision**:
Following the US1 audit (decisions D-1 to D-4 confirmed by the owner), these expectations are recorded:
- **BWV 846 bar count**: Mutopia 5 follows the 35-bar reading (omitting the "Schwencke bar"), which is supported by Henle and BGA editions.
- **Chopin Op. 28 No. 20 (bar 3)**: Mutopia 472's reading follows the Peters edition (E natural, rather than E-flat).
- **Clementi Sonatina Op. 36 No. 1 (Mvt 1)**: The tempo marking 144 is editorial and thus an arrangement departure from the original. Its `arrangement` flag is `false` after converting it faithfully, but we adjusted the tempo down to 144 in the MusicXML and declared it as a limitation, while the source's notes remain faithful. The item has been moved to the `advanced` level due to computed metrics.
- **Satie Gymnopédie No. 1**: The original complete conversion maintains exact length; the previous invented bars are dropped, aligning perfectly with the notation.
