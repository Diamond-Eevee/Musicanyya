# Feature Specification: Beamed Notes and Complete Engraving

**Feature Branch**: `006-beamed-note-engraving`
**Created**: 2026-09-23
**Status**: Draft
**Input**: User description: "improve showing notes (connected notes) and check if anything else is not missing"

The owner compared the app's engraving of *Für Elise (theme, arranged for this app)* with a reference
engraving of the same Score. In the app every eighth and sixteenth note stands alone with its own flag;
in the reference, notes that belong to the same beat are connected by beams, as in any printed piano
book. A check of the whole bundled practice library (feature 005) on 2026-09-23 found:

| Finding | Scope | Effect on the musician |
|---|---|---|
| No beams anywhere | 17 of 17 repertoire pieces, 2 078 flagged notes; 0 beams in the library | Rhythm is hard to read; the page looks unlike a printed book; beginners cannot see where the beat falls |
| Accidentals missing | 117 notes in 21 of 58 library items | **The page shows a different pitch from the one the app plays and grades.** E.g. *Für Elise* bar 1: the D after D sharp has no natural sign, so it reads as D sharp; in the A-minor triad drill the G sharp of the V chord is printed as G natural |
| The exercise generator writes neither beams nor accidentals | Every generated learning exercise, now and future | The two faults above come back each time exercises are regenerated |

Both faults come from the bundled files, not from scores the user opens: an imported score that already
says where its beams and accidentals go is shown correctly today.

## Clarifications

### Session 2026-09-23

- Q: Should the app complete missing beams and accidentals for scores the user opens? -> A: Yes,
  automatically, only where the file gives no information; never alter what the file encodes; list the
  additions in the load report (User Story 3, FR-010, FR-011).
- Q: Where should title and composer appear (missing from the owner's app screenshot)? -> A: On the page,
  above the first system, like a printed edition, with the arranger when named (FR-017, SC-008).
- Q: How should reminder (courtesy) accidentals look? -> A: Printed plainly, without brackets, only in
  the bar right after the change; accidentals a file already prints are kept as they are (FR-008).
- Q: How are eighths grouped in 4/4? -> A: In half-bar groups of four (beats 1-2, 3-4), never across the
  middle of the bar; sixteenths per beat (Assumptions, beat grouping).
- Q: (analyze F1, F2, F5, F6 - owner accepted the recommendations) -> A: courtesy signs in opened Scores only
  for parts that print no accidentals at all; malformed beam data is left as encoded; a printed accidental that
  contradicts the pitch is kept and reported; the practice-history reset for library pieces is accepted.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Beamed rhythms in the practice library (Priority: P1)

A pianist opens a library piece such as *Für Elise* and sees the eighth and sixteenth notes connected by
beams grouped by beat, exactly as a printed edition would show them, on both staves and in every mode.

**Why this priority**: This is what the owner asked for. Beams show the beat at a glance; flagged notes
make even a simple piece look cluttered and hide the rhythm, which matters most to the learners the
library is for.

**Independent Test**: Open *Für Elise (theme)* from the Scores panel. Bar 1 shows its six sixteenths under
one beam, the pickup's two sixteenths are beamed together, and in bar 2 the bass figure A-E-A is one
beamed group of three sixteenths; no eighth or shorter note that shares a beat with a neighbour in the
same voice keeps a separate flag.

**Acceptance Scenarios**:

1. **Given** any library piece containing eighth notes or shorter, **When** it is opened, **Then** notes
   of the same voice and staff that fall in the same beat group are connected by beams, with the number
   of beam lines matching their value (one for eighths, two for sixteenths, three for thirty-seconds).
2. **Given** a beat group that contains a rest (e.g. *Für Elise* bar 2, "A eighth, sixteenth rest, C E A"),
   **When** it is shown, **Then** the beaming follows standard practice: the notes after the rest are
   beamed together and the lone note before it keeps its flag.
3. **Given** a beamed Score, **When** the user runs Listen, Practice or Play, **Then** the cursor, note
   highlights, Practice marks and Grade marks attach to the same notes as before, and the Score sounds and
   is graded exactly as it did before beams were added.
4. **Given** a piece in 3/8, 6/8, 2/4, 3/4 or 4/4, **When** it is shown, **Then** the beam groups follow
   the metre's beat (see Assumptions for the grouping rules).

---

### User Story 2 - The printed pitch is the pitch the app expects (Priority: P1)

A pianist reads the notes on the page, plays them, and is never marked wrong because the page showed a
different pitch from the one the app expected. Every sharp, flat and natural needed to read the note
correctly is printed, following the rule that an accidental lasts until the end of the bar.

**Why this priority**: This is a correctness fault in the app's core promise (Constitution III: the Score
the musician sees is the Score that is played and graded). A learner who plays the printed G natural in
the A-minor triad drill is told they are wrong. It outranks cosmetics; it shares P1 with beams because
the owner asked for "anything else missing" and this is the most harmful gap found.

**Independent Test**: Open the A-minor triad drill: the V chord shows G sharp with a sharp sign. Open
*Für Elise (theme)*: in bar 1 the D after D sharp carries a natural sign. A library-wide check reports
zero notes whose printed pitch (key signature + accidentals earlier in the bar) differs from the pitch the
app plays.

**Acceptance Scenarios**:

1. **Given** a note whose pitch differs from what the key signature and earlier accidentals in the bar
   imply, **When** the Score is shown, **Then** that note carries the accidental (sharp, flat, natural,
   double sharp or double flat) that makes the printed pitch equal the played pitch.
2. **Given** a note that repeats an altered pitch later in the same bar and staff, **When** shown,
   **Then** no redundant accidental is printed; if a different form of that letter name came in between
   (D sharp, D natural, D sharp), each change is printed.
3. **Given** a note tied over a barline, **When** shown, **Then** the tied continuation does not repeat
   the accidental, and the next untied note of that pitch in the new bar does get one if needed.
4. **Given** a new bar after an altered note, **When** the same letter name returns unaltered in the
   next bar, **Then** a plain courtesy accidental (no brackets) is printed on its first occurrence in that
   bar, so a learner is not left guessing; the bar after that gets no reminder.

---

### User Story 3 - Scores the user opens that lack beam or accidental information (Priority: P2)

A user opens a MusicXML file of their own, exported by a tool that leaves out beam groups or printed
accidentals. The app completes what is missing automatically, for display only, and only where the file
gives no information; nothing the file encodes is changed, and the load report lists what was added.

**Why this priority**: Most notation editors write this information, so the fault is rarer outside the
library; but a user who hits it sees the same wrong pitches as in User Story 2.

**Independent Test**: Open a test file that encodes the *Für Elise* theme with pitches and durations only
(no beams, no printed accidentals). It is shown with the same beams and accidentals as the library
version; a file that does encode beams and accidentals is shown exactly as encoded.

**Acceptance Scenarios**:

1. **Given** a file that encodes its own beams, **When** it is opened, **Then** its beaming is shown
   unchanged, even where it differs from the app's default grouping (the editor's choice wins).
2. **Given** a file that encodes some beams in a voice and leaves other notes unbeamed, **When** opened,
   **Then** the app does not add beams to that voice (a partly beamed voice is a deliberate choice).
3. **Given** a file with no beam information in a voice, **When** opened, **Then** that voice is beamed
   by the grouping rules in Assumptions, and the load report says how many beam groups were added.
4. **Given** a file where a note's printed pitch would differ from its played pitch (no accidental where
   one is needed), **When** opened, **Then** the missing accidental is shown and counted in the load
   report; accidentals the file does print are kept as they are, including courtesy ones.
5. **Given** a file completed this way, **When** the user plays it in any mode, **Then** Note IDs,
   playback and grading are exactly as they would be without the completion.

---

### User Story 4 - The library stays correct (Priority: P2)

Whoever adds or regenerates library items cannot publish a piece with unbeamed rhythms or a printed
pitch that differs from the played pitch: the library's publishing check (feature 005) refuses it and
names the bar and note.

**Why this priority**: Without it the faults return the next time exercises are regenerated or a piece
is added. It protects User Stories 1 and 2 but delivers no new picture on its own.

**Independent Test**: Remove the natural sign from *Für Elise* bar 1 in a copy of the library and run the
library check: it fails, naming the item, bar 1 and the note. Remove a beam group: it fails the same way.
Regenerate all learning exercises: the check passes with no hand edits.

**Acceptance Scenarios**:

1. **Given** a library item with a note whose printed pitch differs from its played pitch, **When** the
   library check runs, **Then** it fails and names item, bar, staff and note.
2. **Given** a library item with eighth notes or shorter and no beams where the metre calls for them,
   **When** the check runs, **Then** it fails the same way.
3. **Given** the learning exercises are regenerated, **When** the check runs, **Then** every generated
   item has beams and accidentals without hand editing.

---

### User Story 5 - Engraving checklist for everything else (Priority: P3)

The owner gets a written list, per notation element, of what the app's engraving of the library shows
compared with a reference engraving, so "is anything else missing?" has a checked answer and each real
gap becomes a fix or a recorded decision.

**Why this priority**: It answers the second half of the request. The two known gaps are already covered
by User Stories 1 and 2; this story makes sure nothing else is overlooked.

**Independent Test**: The checklist exists, covers every element listed in FR-014 for every repertoire
piece, and each "missing" row points to a fix in this feature or to a new, named follow-up.

**Acceptance Scenarios**:

1. **Given** the library, **When** the audit is done, **Then** each element in FR-014 is marked present,
   missing (with the pieces and bars affected) or not used, for every repertoire piece.
2. **Given** a gap that makes the page contradict what is played or graded, **When** it is found,
   **Then** it is fixed in this feature; a purely visual gap may instead become a named follow-up.

---

### Edge Cases

- **Rests inside a beat**: beams never cross rests; a lone note left by the break keeps its flag.
- **Chords**: a chord is beamed as one unit with its neighbours; all its notes keep their Note IDs.
- **Two voices on one staff**: each voice is beamed separately; beams never join notes of different
  voices.
- **Notes printed on the other staff** (cross-staff): beams follow the voice, not the staff it is printed
  on; existing hand assignment for Practice (feature 002) is unchanged.
- **Grace notes**: grace notes are beamed among themselves only, never with main notes.
- **Tuplets** (triplet eighths): beamed as one group per tuplet.
- **Pickup (anacrusis) and incomplete bars**: grouped by their position in the metre, not from the start
  of the partial bar (the *Für Elise* pickup is one beamed pair on the last beat).
- **Metre change mid-piece**: grouping follows the metre in force in each bar.
- **Ties across barlines and repeats/voltas**: accidentals are judged per written bar, so a volta bar
  starts from the key signature, not from the previous ending.
- **Key change mid-piece**: accidentals are judged against the key signature in force; a change of key
  cancels earlier accidentals.
- **Malformed or contradictory beam data in an opened file** (a beam that starts but never ends): the
  Score still opens (Constitution III); the faulty beams are left as encoded (the engraver shows what it
  can), the voice gets no added beams, and the load report says so.
- **Very long titles or several composer/arranger credits**: they wrap above the first system and never
  overlap the music.
- **Very long, very fast scores** (the complete *Für Elise*, Bach Prelude): opening time must not grow
  noticeably (SC-005).

## Requirements *(mandatory)*

### Functional Requirements

**Beams**

- **FR-001**: Every bundled library piece MUST show notes of eighth value or shorter connected by beams
  according to the grouping rules in Assumptions, in each voice of each staff.
- **FR-002**: Beam groups MUST break at beat-group boundaries and at rests (per standard practice), MUST
  never join different voices, and MUST include chords as single units.
- **FR-003**: The number of beam lines MUST match note values within the group, including mixed values
  (e.g. an eighth and two sixteenths share one primary beam, the sixteenths add a secondary beam).
- **FR-004**: A Score that encodes its own beams MUST be shown with exactly those beams.
- **FR-005**: Adding beams MUST NOT change any Note ID, playback timing, pitch, Practice step, or Grade
  for any library item (compared before/after, note by note).

**Accidentals**

- **FR-006**: For every note shown, the printed pitch (clef, key signature, accidentals printed earlier in
  the same bar and staff, ties) MUST equal the pitch the app plays and grades. The one exception is an
  opened file that itself prints an accidental contradicting the note's pitch: that sign is kept (FR-009)
  and the load report names the bar and note.
- **FR-007**: Accidentals MUST follow common practice: they last to the end of the bar in the same staff
  and octave; they are not repeated on tied continuations; redundant accidentals are not printed.
- **FR-008**: In library items, and in parts of opened Scores that print no accidentals at all (a part that
  prints accidentals has made its own reminder choices), a courtesy
  (reminder) accidental MUST be printed plainly, without brackets, on the first note of a letter name
  (any octave) in the bar immediately after one where that letter name carried a different alteration,
  within the same staff. Reminders are never carried further than that one bar, and never printed on a
  tied continuation.
- **FR-009**: A Score that encodes its own printed accidentals MUST be shown with those accidentals
  (including any courtesy accidentals the file adds).

**Opened scores**

- **FR-010**: For a Score the user opens, the app MUST automatically, without asking, (a) beam every voice
  that carries no beam information, by the grouping rules in Assumptions, and (b) show every accidental
  needed for the printed pitch to equal the played pitch (FR-006, FR-007) where the file prints none. This
  completion is for display only and applies in every Shell.
- **FR-011**: Whatever the app completes for an opened Score MUST be listed in the load report (count of
  beam groups and accidentals added), and MUST never alter what the file does encode.

**Keeping the library correct**

- **FR-012**: The library publishing check MUST fail, naming item, bar, staff and note, when a printed
  pitch differs from the played pitch or when a piece with eighth notes or shorter has no beams.
- **FR-013**: Generated learning exercises MUST come out beamed and with correct accidentals, so that
  regenerating them needs no hand edits to pass FR-012.

**Engraving audit**

- **FR-014**: An engraving checklist MUST record, for each repertoire piece, whether these elements are
  shown as a printed edition would: beams, accidentals (incl. courtesy), stem direction, rest placement
  in multi-voice staves, ties, slurs and phrase marks, dynamics and hairpins, tempo and expression text,
  articulations, fingering, pedal marks, ornaments, repeats/voltas/jumps, title and composer, bar numbers
  at the start of each system. Rows marked missing MUST list pieces and bars.
- **FR-015**: Each gap found by FR-014 that makes the page contradict playback or grading MUST be fixed in
  this feature; other gaps MUST be either fixed or recorded as a named follow-up with the owner's
  agreement.
- **FR-016**: The MusicXML support documentation MUST state how beams and printed accidentals are handled
  (shown as encoded, completed when absent, or both).

**Title and composer**

- **FR-017**: Every Score MUST show its title and composer (and arranger, when the file names one)
  above the first system of the first page, as a printed edition does (feature 001 FR-002), in every
  mode and every Shell. A Score without a title shows its file name there; missing composer or arranger
  lines are simply left out.

The feature applies to every Shell (browser and Electron); it has no audio or MIDI timing component.

### Key Entities

- **Beam group**: consecutive notes and chords of one voice on one staff, all eighth value or shorter,
  within one beat group, drawn connected; carries the number of beam lines per note.
- **Beat grouping**: the division of a bar into beat groups for a given metre; decides where beam groups
  start and end.
- **Printed accidental**: the sign shown before a note (sharp, flat, natural, double sharp, double flat,
  optionally a courtesy form) - distinct from the note's sounding pitch, which it must make readable.
- **Engraving checklist**: per repertoire piece and per notation element, present / missing / not used,
  with pieces and bars for each gap.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the bundled library, 100% of eighth-or-shorter notes that share a beat group with a
  neighbour of the same voice are beamed (today 0 of 2 078 flagged notes).
- **SC-002**: In the bundled library, 0 notes have a printed pitch that differs from the played pitch
  (today 117 notes in 21 items).
- **SC-003**: For every library item, Note IDs, the played note sequence and a reference Play-mode Grade
  are identical before and after the change.
- **SC-004**: A musician shown *Für Elise (theme)* in the app next to a printed edition finds no
  difference in beaming or accidentals in bars 0-8.
- **SC-005**: Opening the largest library piece takes no more than 10% longer than before the change.
- **SC-006**: Each opened test file that encodes its own beams and accidentals is shown with 100% of
  them unchanged.
- **SC-007**: The engraving checklist covers 100% of repertoire pieces and all elements in FR-014; every
  "missing" row has a fix or a named follow-up.
- **SC-008**: 100% of library items, and an opened test file with title, composer and arranger, show
  those names above the first system in Listen, Practice and Play mode.

## Assumptions

- **Beat grouping (standard engraving practice; the 4/4 rule confirmed by the owner 2026-09-23)**:
  simple metres beam by the beat (2/4, 3/4, 4/4 by the quarter); in 4/4, eighths are beamed in half-bar
  groups of four (beats 1-2 and 3-4), never across the middle of the bar, while sixteenths and shorter
  are beamed one beat at a time; in 3/4, a bar of six uninterrupted eighths is beamed as one group; compound metres
  (6/8, 9/8, 12/8) beam by the dotted quarter; 3/8 and other short x/8 metres beam the whole bar as one
  group, as the reference *Für Elise* does; 2/2 beams by the half note. Unusual metres fall back to one
  group per beat.
- The fix for the library is made in the bundled files and the exercise generator (so the files are
  correct for any other MusicXML viewer too), not only in how the app draws them.
- Pitches, rhythms, fingering and every other musical content of the library are already correct and
  are not changed; only beams and printed accidentals are added.
- Completing the library files changes their content, so Practice and attempt history saved for a library
  piece before this feature no longer shows for it (history is keyed by file content; no release has shipped).
- The *Für Elise* reference comparison uses the owner's screenshot and the library item's cited source
  (Mutopia Project, piece-info id 931).
- Stem direction, rest placement, ties, dynamics and fingering already appear correct in the owner's
  screenshot; the audit (User Story 5) confirms this rather than assuming it.

## Out of Scope

- Letting the user edit beams or accidentals.
- Changing the engraving font, spacing, page layout or the score-first layout (feature 004).
- New notation the library does not use (e.g. feathered beams, cross-bar beams, tremolo beams).
- Adding new pieces to the library.
- Any change to grading tolerances, Practice wait rules or playback.
