# Research: Learning by key

Phase 0 of `/speckit.plan`. Inputs: spec.md (clarified 2026-09-26), the feature 005 generator and index, the feature 007
audit tools, and a `music-domain-expert` design report (2026-09-26, summarised in R4-R7 and R12). Owner decisions are marked
**D-n**; all three were answered on 2026-09-26 with the recommendation (plan.md).

## R1 - Layout and item ids

**Decision**: `public/library/learning/keys/<key-slug>/<stem>` and `public/library/learning/key-changes/<from>-to-<to>/<stem>`.
Stems: `introduction`, `beginner`, `intermediate`, `advanced` for the main step items; the old family name for moved drills
(e.g. `i-v-vi-iv`); `song-<slug>` for songs. So ids read `learning/keys/c-major/introduction`,
`learning/key-changes/c-major-to-a-minor/beginner`, `learning/keys/g-major/song-skip-to-my-lou`.

**Rationale**: the id is the path (005 contract §3), so folders must be real directories; short stems keep ids readable
and identical across keys (FR-011). Key slugs reuse the generator's existing `keySlug` (`c-sharp-minor`, `e-flat-minor`).

**Alternatives**: keep flat files with a `folder` field in the sidecar - rejected, the id would no longer be the path and
the shelf on disk would not match the shelf on screen; one folder per step inside each key - rejected, one item per folder
adds a click for nothing (SC-001).

## R2 - Key order and names

**Decision**: circle of fifths from C, sharps first, each major followed by its relative minor: C, Am, G, Em, D, Bm, A,
F#m, E, C#m, B, G#m, F#, Ebm, Db, Bbm, Ab, Fm, Eb, Cm, Bb, Gm, F, Dm. Folder titles "C major", "A minor", "F# major",
"Eb minor" (the generator's display names). F# major is paired with **Eb minor** (enharmonic relative of Gb major / D#
minor), because the 24-key set already chose Eb minor over D# minor (005 data-model §5.1: D# minor's V needs C double
sharp); the folder description says "relative minor, written as Eb minor".

**Rationale**: the order musicians learn keys in; relative pairs share a key signature, so neighbouring folders share it.

**Alternatives**: alphabetical - rejected (C, C minor, C# minor ... splits relatives and puts 6-accidental keys early);
majors then minors - rejected, the relative pair is the useful neighbour.

## R3 - Step and ordering metadata

**Decision**: sidecar fields `step` (`introduction | beginner | intermediate | advanced | song`) and `stepOrder` (0 = the
step's main exercise, 10, 20 ... = extra practice at that step), contract library-index 1.2. The panel sorts by step rank,
`stepOrder`, then title. A step may hold one main item plus extras; FR-006 and FR-010 apply to main items (`stepOrder: 0`).

**Rationale**: the existing drills that fit C major (I-V-vi-IV, turnaround, diatonic ladder) must stay (FR-005) without
pretending to be the main step; title sorting alone would put "C major - advanced" before "C major - beginner".

**Alternatives**: derive the step from `level` - rejected, songs and extras need their own place; encode order in the file
name (`1-introduction`) - rejected, ids would carry presentation.

## R4 - The Introduction level and the level-criteria blockers

**Decision**: add `introduction` to `Level` below `beginner`, nested caps as today (Introduction subset of Beginner). Caps
(defaults.ts, data-model §5): tempo 40-72 qpm; shortest value 1 beat; longest run 4; voices per staff 1; span 36, bounds
MIDI 36-84; largest interval in one hand 7; largest leap 12; mean/peak density 1.5/3 attacks per second; key changes 0;
accidentals per 16 bars 2; metres 4/4, 3/4; 4-16 bars; <= 60 s; no ties, tuplets, grace notes, ornaments, pedal or
repeats; hand independence (see D-2) 0.

The expert found four places where the current criteria cannot express the exercises the owner asked for. Each is an
owner decision because it changes published level criteria (005 FR-009); the recommendation is shown and bundled as
**D-2**:

| # | Finding | Recommendation |
|---|---|---|
| B1 | Criterion 3 counts a bar as "hands independent" whenever the two staves' onset sets differ, so a scale over a held chord scores ~0.8 (Beginner cap 0.35). This is already why `c-major-scale-and-chords` computes Intermediate. | A bar is independent only when **neither** hand's onsets are a subset of the other's. A held chord under a moving hand is the first hands-together skill of every method. Applies to all items; the level check is re-run over repertoire and any re-levelled piece is reported in the log. |
| B5 | Criterion 11 (accidentals, Beginner 2 per 16 bars) fails every harmonic-minor exercise: the raised 7th is written on every occurrence. Already why the 12 minor `triads-*` compute Intermediate. | For `kind: exercise`, accidentals that raise the leading tone (and the 6th in melodic minor) are not counted - same reasoning as the existing criterion 9 exemption for exercises. |
| B6 | Criterion 10 (key changes, Beginner 0) fails every parallel key-change drill. | Key-change exercises (tag `key-changes`) may have 1 key change at any level. |
| B7 | IV below I in both hands gives a 38-semitone span (T-19..T+19); Beginner cap 36. The current C exercise already spans 38. F# major does not fit bounds 36-84 at all. | For exercises, span cap 38 and bounds 35-85 at Introduction and Beginner. |

**B8 (added 2026-09-26 during implementation, owner answered "exempt exercises up to 19")**: criterion 17 (largest leap in one
hand, 12 at Introduction/Beginner) fails every generated step where the hands swap: the right hand goes from the scale's last note
(T) to a chord rooted at T+12 whose top is T+19. The chords cannot sit lower without colliding with the left-hand scale on the
same keys. For exercises the cap is 19 at Introduction and Beginner (`LEVEL_EXERCISE_MAX_LEAP_SEMITONES`); pieces keep 12. Rejected:
scales that start at the top (less familiar shape), and computing leaps per section (changes every item's facts).

**Rationale**: the alternative - calling the steps Introduction/Beginner while the computed level says Intermediate -
breaks FR-022 and SC-002 and misleads the learner.

**Alternatives**: `raisedBecause` on every item - rejected, it documents a mismatch instead of fixing the measure; custom
registers per key - rejected, breaks FR-011 (same shape in every key).

## R5 - Step-order check (FR-010)

**Decision**: pure `checkStepOrder(items)` in `src/core/library/step-order.ts`, run by `pnpm library:index` per key folder
and per key-change folder over the main items, in step order. Facts compared: `tempoBpm`, `notesPerBeat`,
`handIndependenceFraction` (after B1), and a **new fact `chordChangesPerBar`** (mean per written bar of chord attacks - a
staff sounding 2+ notes at one onset - that differ from the previous chord attack in that staff). Each must be
non-decreasing, and at least one must rise, between consecutive steps; otherwise the index is not written.

**Rationale**: the spec wrote "chord changes per bar" as if derived already; it is not (expert B3). `notesPerBeat` counts
chord members, so it cannot stand in.

**Alternatives**: compare computed levels - rejected, too coarse (Beginner and Intermediate can compute the same level).

## R6 - Generator: the pattern form and the four step shapes

**Decision**: exercise-definition 1.1 adds a **pattern form**: `sections[]`, each with a bar count and, per hand, either a
`scale` part (form major / harmonic / melodic, direction up / down / up-down, value quarter / eighth, octave offset) or a
`chords` part (the existing step list), plus `swapHands` to mirror a section. New module `scales.ts` spells one-octave
scales by letter arithmetic from the key and holds the fingering table (data-model §6). One definition per step, 24 keys
each:

| Step | Tempo | Bars | Shape (A = RH scale, B = hands swapped) |
|---|---|---|---|
| Introduction | q=60 | 10 | A b1-5: RH 1234 / 5678 / 8765 / 4321 / 1 (whole); LH root triads, whole notes: I V I V I. B b6-10 mirrored. |
| Beginner | q=72 | 10 | Same scale; chords in root position: I (whole) / V-I / I-IV / IV-V / I (whole). Mirrored. |
| Intermediate | q=80 | 15 | A, B as Beginner with close voice leading (I, V6, IV64). C b11-15, both hands chords: RH halves I-I6 / I64-I6 / I-IV64 / V6-I / I; LH broken root triads in quarters (1-3-5-3, fingers 5-3-1-3). Minor: melodic minor scale. |
| Advanced | q=96 | 9 | b1-2 RH scale in eighths up / down, LH halves I-V / I-IV; b3 RH quarters I vi6 IV64 V6; b4 I ii64 V6 I (minor: i iv64 V6 i); LH root-and-fifth eighths; b5-8 mirrored; b9 I (whole). |

Measured by the expert: tempo 60/72/80/96; notes per beat ~1.6/2.05/2.6/3.5; chord changes per bar 1/2/2/4. Under the
B1 rule every step measures hand independence 0 (each bar's slower hand is a subset of the faster hand), so the step
order rests on tempo, notes per beat and chord changes (analyze A9). Where a step's computed level is below its step
name (e.g. Advanced computing Intermediate), the definition carries `raisedBecause` (analyze A3). Minor keys: harmonic minor for Introduction, Beginner, Advanced and every V;
melodic for Intermediate. Register (data-model §5): RH scale tonic T in octave 4 for C, Db, D, Eb, E, F and octave 3 for
F#, G, Ab, A, Bb, B; chords I at T-12 (LH) / T+12 (RH) with IV and V below.

**Rationale**: FR-011 by construction; the Beginner shape is the pasted image's pattern (FR-008); the Introduction halves
the chord rate (FR-007: one chord per bar, I and V only, 17% slower).

**Alternatives**: hand-write 96 files - rejected (005 R-exercises: generation is what makes "same drill in every key"
true); extend the chord `step` with a `scale` voicing - rejected, a scale is many notes per step and fingering depends on
the whole run.

### R6 fingering source (T002, 2026-09-26)

**Source**: Franklin Taylor, *Scales and Arpeggios for the Pianoforte, with preparatory exercises* (Novello, Ewer and Co.,
Music Primers and Educational Series, plate 10209, c. 1900; the author died in 1919). Internet Archive item
`scalesarpeggiosf00tayluoft`; page images only (`https://archive.org/download/scalesarpeggiosf00tayluoft/page/n<leaf>.jpg`),
read by eye on 2026-09-26. No IMSLP/LOC. The book prints two-octave scales in groups of four notes with the finger on the
notes where the pattern changes; the first octave from the tonic is what this table takes. Descending fingering is the
reverse of ascending (the universal rule; spot-checked on the printed descending groups of C, E and F major, not compared
note by note for every key). The top note of a one-octave scale takes the finger the book gives at that point of the
pattern (RH 5 for the C-shape keys, where the two-octave scale continues with 1).

| Printed page (leaf) | Scales read |
|---|---|
| p.4 (n9) | C, G, D, A major |
| p.5 (n10) | E, B, F# (Gb), F, Bb major |
| p.6 (n11) | Eb, Ab, Db major; A, E harmonic minor |
| p.7 (n12) | B, F#, C#, G#, Eb (D#) harmonic minor |
| p.8 (n13) | D, G, C, F, Bb harmonic minor |
| p.9 (n14) | A, E, B, F#, C#, G# melodic minor |
| p.10 (n15) | D, G, C, F, Bb, Eb melodic minor |

**Outcome per row of data-model §6** (RH / LH ascending):

- Agree with the book, no change: C, G, D, A, E major and A, E, C, G, D minor (RH 1 2 3 1 2 3 4 5, LH 5 4 3 2 1 3 2 1);
  B major and B minor (RH 1 2 3 1 2 3 4 5, LH 4 3 2 1 4 3 2 1); F major and F minor (RH 1 2 3 4 1 2 3 4, LH 5 4 3 2 1 3 2 1);
  F# major (both hands); Db major (both hands); every LH of the flat keys and of C#, G# minor (3 2 1 4 3 2 1 3; Eb minor
  2 1 4 3 2 1 3 2; F# minor 4 3 2 1 3 2 1 4); Bb minor RH 2 1 2 3 1 2 3 4 and LH 2 1 3 2 1 4 3 2 (was "verify", now confirmed).
- **Corrected to the book (RH)**: Ab major 3 4 1 2 3 1 2 3 -> **2 3 1 2 3 1 2 3**; Eb major 3 1 2 3 4 1 2 3 -> **2 1 2 3 4 1 2 3**;
  Bb major 4 1 2 3 1 2 3 4 -> **2 1 2 3 1 2 3 4**; F# minor, C# minor and G# minor 3 4 1 2 3 1 2 3 -> **2 3 1 2 3 1 2 3**;
  Eb minor 3 1 2 3 4 1 2 3 -> **2 1 2 3 4 1 2 3**. The draft rows followed the common modern method books; the book
  starts these scales on a finger one lower. The book is the public-domain source, so it wins (recorded, not silently resolved).
- G# minor LH (was "verify"): **3 2 1 4 3 2 1 3** confirmed.
- **Melodic minor differs from harmonic** in three places: F# minor RH **2 3 1 2 3 4 1 2** and C# minor RH
  **2 3 1 2 3 4 1 2** (harmonic 2 3 1 2 3 1 2 3), and Bb minor LH **2 1 4 3 2 1 3 2** (harmonic 2 1 3 2 1 4 3 2). Every other
  melodic minor fingering equals the harmonic one; the melodic minor table is the harmonic table plus these three rows.

## R7 - Key-change exercises

**Decision**: exercise-definition 1.1 adds a **key-change form**: `keyPairs[]` (from, to, relation) and `sections[]` that
name the key they are in. Steps: Introduction (q=60, 12 bars), Beginner (q=72, 11 bars), Intermediate (q=80, 9 bars,
voice-led pivot progression, both hands chords: I, vi, ii6 = iv6, V of the new key, i, iv64, V6, i, i whole; analyze A6). **No Advanced** (expert: there is nothing harder that still ends in the second key
without becoming a piece). Relative change: pivot IV = VI (or ii = iv), then V of the new key, then i; key signature
unchanged, a light-light double barline and a words direction naming the new key. Parallel change: the shared dominant is
the pivot; light-light barline, new `<key>` (with `<cancel>`) at the arrival bar. The existing `same-tonic` and
`a-minor-major` drills become extras in the matching folders.

Folders: 16 chosen by the owner, plus **A minor <-> A major** so `a-minor-major` has a home (spec FR-014 names it, FR-015
did not list A) - part of **D-3**. `facts.keys` must not count a same-fifths relative change as a key change; the fact
scanner already de-duplicates consecutive equal names.

**Rationale**: the pivot is how a learner hears the change coming; the double barline and new signature are standard
practice.

**Alternatives**: 4 steps like keys - rejected by the expert; direct changes with no pivot - rejected, abrupt for
Introduction level.

## R8 - Theory check v2

**Decision**: the independent theory check (007) gets rule set `exercise-theory-v2`: claims for the four step titles
("C major - introduction" ...) and key-change titles ("C major to A minor - introduction"), with **key segments** (a key
claim per bar range) and scale claims per section and hand, including melodic-minor direction. v1 records stay valid.
It still derives tones by letter arithmetic and never reads the generator or its definitions (architecture test).

**Rationale**: every shelf item needs an audit record that re-runs (007 FR-001); the generator must not check itself.

## R9 - Songs

**Decision**: songs are built from **Mutopia public-domain sources** (`.ly` + `.mid`, the 007 route): a song definition
(`content/library/songs/<id>.json`, contract song-definition.md) names the approved source, the melody's staff/voice and
bars, an optional transposition, and a chord plan (one chord per bar or half bar, degree + inversion). `pnpm library:songs`
converts the source melody with the 007 LilyPond reader, writes it to the right hand, writes the left-hand block chords
from the plan (close position around C3, primary chords for beginner songs), engraves chord names as `<words>`, and
completes engraving. Audit: a mechanical `melody` check against the source (existing aspect, with `transpose`) plus a new
theory check `song-chords` - every left-hand chord equals the triad its printed name says, and every name is in the
level's allowed set (beginner: I, IV, V / i, iv, V; at most one change per bar). Provenance: `origin: authored`,
`licence: CC0-1.0`, `basedOn` the source; `arrangement: true` with `departures` naming the added left hand.

Sources need owner approval (content/library/sources/README.md) - **D-1**. Candidates: see "R9 candidates" below.

**Rationale**: memory of 007: agent-written melodies can be invented; a mechanical comparison against a public-domain
source is the only accepted proof. The chords are ours and are checked by theory, not by a source.

**Alternatives**: Internet Archive scans with visual checks - fallback only (report shows "verified (visual)"); writing
melodies from memory - rejected (007).

### R9 candidates

Search of 2026-09-26 (read-only; Mutopia title search plus a crawl of its Folk, Hymn, Song, March, Popular/Dance and
Gospel listings; Internet Archive for the rest). **Finding: Mutopia has almost none of the nursery/folk titles**
(Frere Jacques, Saints, Aura Lee, Skip to My Lou, London Bridge, Drunken Sailor ... are absent); what it has under
"Copyright: Public Domain" is mostly carols, hymn tunes and a guitar collection of airs. Every page below states exactly
"Copyright: Public Domain"; files at `https://www.mutopiaproject.org/ftp/<path>.ly` / `.mid`.

| # | Song | Source | Key, metre (source) | Shelf key | Chords | Notes |
|---|---|---|---|---|---|---|
| 1 | Au clair de la lune | Mutopia 1111 (Horetzky No. 21, guitar), `HoretzkyF/horetzky21/horetzky21` | C, 2/4 | C major | I, V | top voice extracted; ideal first song |
| 2 | Good King Wenceslas | Mutopia 905 (melody only, Hutchins), `Anonymous/GoodKingWenceslas/GoodKingWenceslas` | A, 4/4 | **G major** (transposed -M2) | I, IV, V | cleanest source; transposed because A major's 3 sharps exceed the beginner key cap (analyze A2) |
| 3 | The Holly and the Ivy | Mutopia 644 (melody), `Traditional/thehollyandtheivy/thehollyandtheivy` | F, 3/4 | F major | I, IV, V | pickup |
| 4 | Joy to the World | Mutopia 1223 (SATB), `HandelGF/antioch/antioch` | D, 2/4 | D major | I, IV, V | soprano line |
| 5 | O Come, All Ye Faithful | Mutopia 1220 (SATB), `WadeJF/adeste_fideles/adeste_fideles` | G, 4/4 | G major | I, IV, V | soprano line, pickup |
| 6 | Silent Night | Mutopia 1295 (SATB), `GruberFX/stille_nacht/stille_nacht` | Bb, 6/8 | Bb major | I, IV, V | intermediate song: 6/8 is not a beginner metre (analyze A2); (Mutopia 521 is CC BY-SA - not this one) |
| 7 | Auld Lang Syne | Mutopia 1121 (Horetzky No. 31, guitar), `HoretzkyF/horetzky31/horetzky31` | D, 2/4 | D major | I, IV, V | top voice extracted |
| 8 | O Come, O Come, Emmanuel | Mutopia 1300 (SATB), `Traditional/veniemma/veniemma` | E minor (Aeolian), 4/4 | E minor | i, iv, V, VII | modal; intermediate song (VII) |
| 9 | Greensleeves | already approved `mutopia-1247-greensleeves-hymntune` | E minor, 6/8 | **A minor** (transposed +P4) | i, III, VII, iv, V | intermediate song; different item from the repertoire piece |
| (10) | Home, Sweet Home | Mutopia 435, `BishopHR/homeshome/homeshome` | F, 4/4 | F major | I, IV, V | reserve |
| (11) | It's Me, O Lord | Mutopia 1003 (SATB), `Traditional/its_me_oh_Lord/its_me_oh_Lord` | D, 2/4 | D major | I, IV, V | reserve |

Result: 9 songs in 7 keys (C, G, D, F, Bb, E minor, A minor), 2 minor - meets FR-016 / SC-004 with every melody
mechanically comparable. **Level risk (analyze A2)**: beginner songs must pass the beginner caps as pieces (metres 4/4,
3/4, 2/4; key fifths <= 2; shortest value >= half a beat). Dotted eighth-sixteenth figures (*Joy to the World*,
*Auld Lang Syne*) break the shortest-value cap, so those songs may compute intermediate. Every song is level-checked
before its definition is committed (T063); if fewer than 6 beginner songs remain, the reserves (10, 11) need the owner's
source approval first - stop and ask. Internet Archive scans (e.g. *God Rest You Merry* in Bramley & Stainer, IA
`christmascarolsn00staiiala`; *Go Down, Moses*, IA `cu31924022492304` p. 142) would need hand encoding and only a visual
check - kept as a fallback, not planned.

**Rejected**: Mutopia 521 Stille Nacht (CC BY-SA 2.0), 1641 Old Folks at Home (CC BY-SA 3.0), 1832 Amazing Grace
(CC BY-SA), Swedish dances (CC BY 2.5); *House of the Rising Sun*, *Kumbaya*, *Scarborough Fair* (the familiar tune is a
1947 source), *Hush Little Baby*, *Happy Birthday*, 1960s versions of *Michael, Row* - copyright risk; not found in a clean
public-domain source: Frere Jacques, London Bridge, Skip to My Lou, Red River Valley, Shenandoah, Wayfaring Stranger,
Aura Lee. Rows go into `content/library/sources/README.md` "Rejected sources" when implemented.

**Consequence for the spec**: the songs are mostly **carols and hymn tunes**, not the nursery/folk songs the spec's
Assumptions named as examples - part of **D-1**.

Allowed chord sets (song-chords check): beginner songs I, IV, V (minor i, iv, V), at most one change per bar;
intermediate songs add ii, iii, vi (minor III, VI, VII) and two changes per bar.

## R10 - Continuity (FR-020)

**Decision**: per-Score settings are keyed by the file's SHA-256 (`local-settings-store.ts`), and the library filter by
section id. So: every successor sidecar lists `supersedes: [{id, hash}]` of the old items it replaces; opening a library
item first copies settings from the first old hash that has some, when the new hash has none
(`adoptScoreSettings`, library-port 1.2 §4). Sections carry `formerIds`; a persisted `sectionId` is moved to its successor.
Recent scores store the bytes the user opened, so they keep opening their copy (no error, no redirect) - the spec's US4
wording is narrowed accordingly (see "Spec corrections").

**Alternatives**: keying settings by item id - rejected, a user's own files have no id; migrating all settings at start-up
- rejected, needs the index before the store and gains nothing.

## R11 - Tree panel

**Decision**: native `<details>`/`<summary>` per section, built from `parent` + `order`; roots and their children open,
key and key-change folders closed; a filter opens every folder with a match and hides the rest; open state kept for the
session in `libraryState` (library-port 1.2 §2).

**Rationale**: ~160 items always expanded would bury Repertoire; `<details>` is accessible, keyboard-operable and
framework-free (Principle V, VIII).

**Alternatives**: a section picker drop-down - rejected, hides the tree; a custom tree widget - rejected, reimplements
`<details>`.

## R12 - Fate of the existing 41 items

The expert counted **41** shelf items (24 triads, 16 change items from 13 families, 1 hand-written), not 37 as the
proposal said.

| Old item(s) | New place |
|---|---|
| `c-major-scale-and-chords` | superseded by `learning/keys/c-major/beginner` |
| `triads-<key>` x 24 | superseded by each key's `intermediate` (its section C covers I-IV-V-I, tonic inversions and IV64-V6) |
| `changes-i-v-i-c-major` | superseded by `learning/keys/c-major/introduction` (I-V only) |
| `changes-i-iv-i-c-major`, `changes-plagal-perfect-c-major`, `changes-cadence-{c,g,f}-major` | superseded by C / G / F `beginner` |
| `changes-tonic-inversions-c-major` | superseded by C `intermediate` |
| `changes-minor-cadence-{a,d}-minor` | superseded by A minor / D minor `beginner` |
| `changes-i-vi-iv-v-c-major`, `changes-ii-v-i-c-major` | superseded by C `advanced` |
| `changes-i-v-vi-iv-c-major`, `changes-turnaround-c-major`, `changes-diatonic-ladder-c-major` | kept as C major / Advanced extras (`stepOrder` 10, 20, 30) - I-V-vi-IV and iii occur nowhere else (FR-005) |
| `changes-same-tonic-c-major` | kept as extra in *C major -> C minor* |
| `changes-a-minor-major-a-minor` | kept as extra in *A minor -> A major* (D-3) |

Audit records: a moved item's record moves with it (new `itemId`, same checks). A superseded item's record is deleted
with the old file; the successor's record lists the old ids in a new optional `supersedes` field, and the report's Notes
say what replaced what (audit-record 1.2). Coverage (007 rule 1) therefore stays "records = shelf ids + removed ids".

## R13 - Index size

~160 items x ~2.6 KB per entry = ~420 KB, one fetch per session with network-first caching (library-port 1.1). Within
the 005 panel budget (200 items); the synthetic test grows to 200 items in a 3-level tree.

## Spec corrections (made in spec.md after the owner's answers)

- Proposal text: 41 existing items, not 37.
- FR-004 / US2: key-change folders hold Introduction, Beginner and Intermediate (R7), not Advanced.
- FR-006 / FR-010: "each step" means the step's main item; a step may also hold extra practice items (R3).
- FR-015: plus the A minor <-> A major pair (D-3).
- US4 / FR-020: "remembered" = the library filter and per-Score settings; recent scores keep opening their stored copy (R10).
