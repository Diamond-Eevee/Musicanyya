# Feature Specification: Library Fidelity Audit

**Feature Branch**: `007-library-fidelity-audit`
**Created**: 2026-09-23
**Status**: Draft
**Input**: User description: "Library fidelity audit: check every bundled practice-library item against
reality. The Advanced Für Elise (complete) turned out to be an AI reconstruction written from memory
(bridges, B section and C-section opening invented; 59 bars instead of 106), even though it passed a
music-domain-expert review and the level checks - that review had nothing authoritative to compare against.
It was replaced on 2026-09-23 by a mechanical conversion of the Mutopia Project's public-domain LilyPond
source, every note checked against Mutopia's own MIDI (feature 005, T087-T088). The other items were
produced the same way and may contain the same kind of invented or wrong music. Goal: every item in the
library is verified against an authoritative source, or honestly relabelled, fixed, replaced or removed.
Compare mechanically wherever a machine-readable source exists, not by an agent's impression; record per
item what was compared, against what, and the result. Arrangements must say so and must match the original
in every passage they claim to quote. Prefer converting a faithful public-domain source over keeping
hand-written music. Generated exercises are checked against music theory by an independent check, not
against a download. Item IDs stay stable where the piece stays; level minimums must still hold or the gap
is reported to the owner. reviewedBy only names a review that compared against a source. Deliverable
includes an audit report listing every item and its evidence. Out of scope: new pieces beyond
replacements, UI changes."

## Background

The practice library (feature 005) ships 58 items: 17 repertoire pieces (7 Beginner, 5 Intermediate,
5 Advanced) and 41 Learning exercises (triads in every key, chord-change drills, and one C major scale
and chords exercise). Each item has passed the library's automatic checks: licence, level, loading
and engraving. Each also names a reviewer. None of those checks can tell whether the notes are the
right notes.

The Für Elise case showed the gap. An item described as "the complete piece" had been written from
general knowledge. Its own sidecar disclosed that whole sections were never compared with a source,
and it was still approved. A musician practising it would have learned music Beethoven did not write.
The only fix that proved anything was a mechanical comparison against a published edition.

This feature applies that standard to everything else on the shelf.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every piece that claims to be the original is the original (Priority: P1)

A musician opens a repertoire piece that does not say it is arranged, for example *Prelude in E minor,
Op. 28 No. 4* or *Fröhlicher Landmann*. They practise it in Practice or Play mode. They can trust
that every note, rhythm, repeat and bar is what the composer wrote in a recognised public-domain
edition. Where the library holds only part of a piece, the title says so, and every bar it does hold
matches the edition.

**Why this priority**: this is the failure that has already happened. A student who practises wrong
notes learns them, and a Grade against wrong notes is meaningless. The Advanced and Intermediate
originals are also the items most likely to contain invented passages, because they are long.

**Independent Test**: pick any non-arrangement repertoire item. Its audit record names the source edition,
the comparison made (bar count, pitches, onsets, durations, repeats) and a zero-difference result, or it
lists every difference and what was done about it. Deliberately changing one pitch in the item makes the
same comparison fail and name that bar.

**Acceptance Scenarios**:

1. **Given** a non-arrangement piece with a public-domain machine-readable source, **When** it is audited,
   **Then** every note is compared with the source for pitch, onset and duration, and bar count and
   repeat structure are compared too. The result is recorded, and any difference is either resolved or
   the item's status says it is unverified.
2. **Given** a piece whose hand-written file differs from its source, **When** a faithful public-domain
   source exists, **Then** the item is replaced by a conversion of that source. It keeps its library ID,
   and its provenance says where it came from.
3. **Given** a piece that is only part of the original (an exposition, an opening strain), **When** it is
   audited, **Then** its title or subtitle says which part it holds, and every bar it holds matches the
   corresponding bars of the source.
4. **Given** a piece for which no public-domain source can be found at all, **When** the audit finishes,
   **Then** it is not presented as the original. It is removed, and the reason is recorded among the
   library's rejected items.

---

### User Story 2 - Arrangements say what they are, and what they quote is right (Priority: P2)

A beginner opens *Amazing Grace* or the 16-bar Für Elise. They can see that it is an arrangement.
Wherever it presents the real tune (the melody of a folk song, Beethoven's opening motif), the tune
matches a recognised public-domain version. Where the arrangement departs from the original (simpler
rhythm, a bass line of its own, a written-out continuation), the item says so in words a musician
understands.

**Why this priority**: arrangements are allowed to differ from the original, which is why they can
hide invented material. A beginner who later meets the real piece should not have to unlearn a wrong
melody.

**Independent Test**: for any arrangement, the audit record lists which bars quote the original, what they
were compared against, and the result. The item's own description names every deliberate departure.

**Acceptance Scenarios**:

1. **Given** an arrangement, **When** it is audited, **Then** its title or subtitle marks it as an
   arrangement, and its description lists each deliberate departure (renotated metre, simplified rhythm,
   own accompaniment, own continuation).
2. **Given** a passage that an arrangement presents as the original tune, **When** it is compared with a
   public-domain source of that tune, **Then** its melodic pitches and their order match. Rhythmic
   changes are allowed only where the item's description names them.
3. **Given** a folk or traditional tune with several accepted versions, **When** it is audited, **Then**
   the record names the version it follows (for example the first published or best-known public-domain
   printing), and the melody matches that version.

---

### User Story 3 - Every exercise is theoretically correct (Priority: P2)

A learner works through *B♭ minor triads* or *C major - ii-V-I*. Every chord contains the right notes
for its name, inversion and key, spelled the way the key requires (B♭ minor uses D♭, not C♯). Every
progression is the one its title names.

**Why this priority**: exercises are generated from definitions. One wrong rule repeats the same error
in every key, and learners use these exercises to build habits.

**Independent Test**: an independent check, which does not reuse the generator's own logic, derives the
expected chords for each exercise from its title and key. It compares them with the file's notes and
spelling and reports zero differences. Feeding it an exercise with one wrongly spelled chord tone makes
it fail and name the chord.

**Acceptance Scenarios**:

1. **Given** a triad exercise in any key, **When** it is checked, **Then** every chord's root, third and
   fifth, its inversion and the spelling of each note match the key and the exercise's stated contents.
2. **Given** a chord-change drill, **When** it is checked, **Then** the sequence of chords matches the
   Roman-numeral progression in its title, in its key, including major/minor quality and any stated
   inversions.
3. **Given** the hand-written C major scale and chords exercise, **When** it is checked, **Then** its
   scale and chords are verified by the same rules.

---

### User Story 4 - The owner can read one report and trust the shelf (Priority: P3)

The owner opens one audit report. It lists every item with what it claims to be, the source it was
checked against, how it was checked, the result and the action taken. Every "verified" can be traced to
evidence that can be re-run.

**Why this priority**: the audit is only useful if its conclusions can be checked, and this is also how
the next "a little weird" is caught early. It comes after the fixes because it summarises them.

**Independent Test**: every item on the shelf appears in the report exactly once. Every "verified" entry
names a source and a comparison that someone else can repeat and get the same result.

**Acceptance Scenarios**:

1. **Given** the finished audit, **When** the report is compared with the shelf, **Then** every item
   appears exactly once, and none are missing or extra.
2. **Given** a report entry marked verified, **When** its comparison is re-run from the recorded source,
   **Then** it produces the same result.
3. **Given** an item's reviewer field, **When** it is read, **Then** it names a review that compared the
   item with a source or a theory check, not a plausibility review.

---

### Edge Cases

- **Source and item disagree because the source is wrong** (a typo in a public-domain engraving): the
  difference is recorded, checked against a second independent source (for example a first-edition
  scan), and the item follows the majority. The decision is recorded.
- **Editions legitimately differ** (Für Elise bar counts vary between editions): the record names the
  edition followed. An item is judged against that edition only.
- **Repeats and voltas**: the comparison is made both on the written bars and on the order in which
  they are played, so a missing repeat or a wrong ending is caught even when every written bar matches.
- **Grace notes, ornaments, tuplets and ties**: grace notes and ornaments are compared as notation (pitch
  and position), since playback sources may realise them differently. Tied notes are compared as one
  sounding note.
- **Octave-shift (8va) passages**: sounding pitch is compared, not written position.
- **A source exists only as a scanned image**: the item is compared bar by bar against the scan. The
  record says the check was visual and names the bars, and such an item is never recorded as
  "mechanically verified".
- **The corrected item no longer meets its level's criteria** (the real piece is harder or easier than
  the invented one): the item moves to its computed level or keeps its level with the recorded reason
  the library already allows. The owner is told if a level falls below its minimum piece count.
- **A replacement source is shorter or longer than the item it replaces**: the item's title,
  description and level follow the replacement. Its library ID stays.
- **A source's licence turns out to be unclear**: the source is not used, and the item is handled as if
  no source existed.

## Requirements *(mandatory)*

### Functional Requirements

**Scope and records**

- **FR-001**: Every item in the bundled library MUST be audited: all repertoire pieces and all Learning
  exercises. The Advanced Für Elise, already verified on 2026-09-23, is included in the report with its
  existing evidence.
- **FR-002**: Every item MUST end with exactly one outcome: *verified*, *fixed* (corrected and then
  verified), *replaced* (by a conversion of an authoritative source), *relabelled* (its claims corrected
  to match what it is), or *removed*.
- **FR-003**: For every item the audit MUST record: what the item claims to be (original, excerpt,
  arrangement or exercise), the source or rule it was checked against, the method (mechanical note
  comparison, theory check, or visual comparison against a scan), the differences found, the outcome,
  and the date.
- **FR-004**: The audit MUST produce one report listing every item and its record (FR-003), readable by
  the owner without opening any score file.

**Repertoire: originals and excerpts**

- **FR-005**: Every repertoire item that does not declare itself an arrangement MUST be compared with an
  authoritative public-domain source. Where the source is machine-readable, the comparison MUST be
  mechanical and cover bar count, repeat and ending structure, and every note's pitch, onset and
  duration.
- **FR-006**: Only sources that satisfy the library's standing licence rule MAY be used as
  replacements: CC0, clear public domain, or the project's own work. Sources used only for reference
  (for example a first-edition scan) MUST themselves be public domain.
- **FR-007**: Where a faithful, licence-compliant, machine-readable source exists and the item differs
  from it, the item MUST be replaced by a conversion of that source rather than corrected by hand,
  unless the item is deliberately an arrangement (FR-010).
- **FR-008**: An item that holds only part of a piece MUST say which part in its title or subtitle, and
  every bar it holds MUST match the corresponding source bars.
- **FR-009**: An item for which no licence-compliant source can be found MUST NOT be presented as the
  original. It MUST be removed, with the reason recorded in the library's rejected-items list.

**Repertoire: arrangements**

- **FR-010**: Every arrangement MUST be marked as an arrangement in its title or subtitle, and its
  description MUST list each deliberate departure from the original.
- **FR-011**: Every passage that an arrangement presents as the original tune MUST match a named
  public-domain version of that tune in melodic pitch and order. Rhythmic differences are allowed only
  where FR-010 lists them.
- **FR-012**: Material the arrangement adds (accompaniment, continuation, simplification) MUST NOT be
  described as the composer's.

**Exercises**

- **FR-013**: Every Learning exercise MUST be checked by a rule check that is independent of the
  generator that produced it. The check derives the expected chords (notes, inversion, spelling, quality
  and progression) from the exercise's stated key and contents, and compares them with the file.
- **FR-014**: The independent check MUST be able to detect a single wrong or wrongly spelled note, and
  MUST name the chord it is in.
- **FR-015**: An error the check finds in a generated exercise MUST be fixed at its origin (the
  definition or rule that produced it) so that every affected exercise is corrected together.

**Evidence, reproducibility and honesty**

- **FR-016**: Every mechanical comparison MUST be repeatable from the recorded source: re-running it MUST
  give the same result.
- **FR-017**: Every comparison method MUST be shown to catch a planted error (one changed pitch, one
  changed duration, one missing bar, one missing repeat) before its "no differences" results are
  trusted.
- **FR-018**: An item's reviewer record MUST name only a review that compared the item with a source or a
  theory check. A plausibility review with no source MUST NOT be recorded as the reviewer.
- **FR-019**: A visual comparison against a scan MUST be recorded as visual, with the bars compared, and
  MUST NOT be reported as mechanical verification.

**Stability and shelf rules**

- **FR-020**: An item that keeps the same piece MUST keep its library ID, so saved progress and recent
  scores keep working.
- **FR-021**: Every changed or replaced item MUST still pass the library's existing checks: licence,
  level, loading, engraving and Note ID stability across engraving completion.
- **FR-022**: If fixes, replacements or removals leave a level below its minimum piece count (feature
  005 FR-008: Beginner 7, Intermediate 5, Advanced 5), the audit MUST report the gap to the owner and
  MUST NOT fill it with new pieces (out of scope).
- **FR-023**: Every item replaced from an external source MUST carry downloaded provenance and an entry
  in the project's third-party notices.

### Key Entities

- **Library item**: one score on the shelf, with its claims (title, subtitle, arrangement flag,
  description, provenance, level) and its notes.
- **Authoritative source**: a public-domain or CC0 edition of a piece, identified precisely enough to be
  fetched again (publisher/project, identifier, date obtained), and machine-readable or a scan.
- **Audit record**: per item, the claim, source or rule, method, differences found, outcome and date
  (FR-003).
- **Audit report**: all audit records together, plus the level counts after the audit and any gaps
  reported to the owner.
- **Theory rule set**: the independent definition of what a named chord, inversion, spelling and
  progression must contain in a given key, used to check exercises (FR-013).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of library items (58 at the time of writing) appear in the audit report exactly once,
  each with one outcome.
- **SC-002**: 0 items that do not declare themselves arrangements or excerpts remain on the shelf without
  a comparison against a named authoritative source.
- **SC-003**: For every item verified mechanically, 100% of its notes were compared, and the recorded
  difference count is reproduced exactly when the comparison is re-run.
- **SC-004**: Each comparison method detects 100% of the planted errors in FR-017 (one per error kind).
- **SC-005**: The independent exercise check covers all 41 Learning exercises and reports 0 remaining
  errors, and it detects a single planted wrong or wrongly spelled note in each exercise family.
- **SC-006**: 0 reviewer records name a review without a source or theory check after the audit.
- **SC-007**: 100% of items that keep their piece keep their library ID.
- **SC-008**: Every level either still meets its minimum piece count after the audit, or the shortfall
  is reported to the owner with the reason.
- **SC-009**: The owner can find any item's source, method and result in the report in under one minute.

## Assumptions

- **Authoritative sources** are, in order of preference: a machine-readable public-domain or CC0 edition
  (Mutopia Project LilyPond with its MIDI, OpenScore CC0 MusicXML), then a public-domain printed edition
  or first-edition scan (for example IMSLP public-domain scans) for visual comparison. Commercial or
  "all rights reserved" editions, including community uploads with such a notice, are never used, even
  for reference.
- **Folk and traditional tunes** (Amazing Grace, Greensleeves, Jingle Bells, Mary Had a Little Lamb,
  Twinkle Twinkle) are checked against a named public-domain printing of the melody. Where versions
  differ, the best-known public-domain version is acceptable if the record names it.
- **Ode to Joy** is checked against Beethoven's Symphony No. 9 theme in a public-domain edition.
- **Mechanical comparison beats review**: a music-domain review may add judgement (for example whether a
  simplification is sensible), but it never replaces the comparison.
- **Replacements may change a piece's length and level**: a complete original may replace a shortened
  hand-written version if the full piece is available. The item's description and level then follow the
  real music (FR-021, FR-022).
- **The already-verified Advanced Für Elise** needs no new comparison. Its evidence (all 902 non-grace
  notes against Mutopia's MIDI) is carried into the report.
- **The owner will approve each new external source** before it is added, as for any added asset. The
  standing licence rule (CC0 / clear public domain / own work) already decides which sources may be
  proposed.
- **Short first-ending and final bars** in faithful conversions raise the existing measure-length
  information notice. They are recorded as expected for that item, as for Für Elise. Changing how the
  app reports them is a separate matter.

## Out of Scope

- Adding new pieces or exercises beyond replacements of existing items (a level gap is reported, not
  filled).
- Any change to the app's screens, the library browser or how items are displayed.
- Changing the level criteria themselves.
- Changing how the app reports short bars that complete a pickup.
- Verifying user-opened files. This feature covers only the bundled library.
