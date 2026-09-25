# Feature Specification: Play Mode Cursor, Audible Metronome and Practice-Style Grade Marks

**Feature Branch**: `009-play-cursor-metronome`
**Created**: 2026-09-25
**Status**: Draft
**Input**: User description: "in play mode, please add metronome, and moving bar forward like in listen. Also to have
consistency with practice mode, I'd like instead of these purple circles have red dots for wrongly played keys, and
green for correctly."

## Background

Feature 003 (Play mode and grading) already asks for a count-in, a Metronome that clicks for the whole run, and a
cursor that follows the run (003 FR-003, FR-004, FR-007). What the owner experiences today is different:

- **No moving cursor during a run.** The view scrolls along with the run, but no cursor bar is drawn and no note is
  highlighted, so the musician cannot see where the music is. Listen mode draws a vertical bar through the current
  measure at the current note, with a dot at its top, and highlights the notes sounding.
- **No recognisable Metronome.** The click is planned as a wood-block sound, but what reaches the speakers is not
  heard as a metronome click (it is not played with a percussion sound). The exact cause is for the plan to confirm.
- **Grade marks that do not match Practice.** After a run, a missed note gets a reddish-purple ring and a wrong pitch
  an orange cross above the note. The rings are sized to the whole note, stem and beam included, so on dense music
  they overlap into a tangle (owner's screenshot of "Für Elise"). Extra notes are counted but not drawn on the
  Score. Practice mode (feature 008) now shows a correct note as a **green notehead** and a wrong key as a **red
  disc** at the pitch actually pressed. The owner wants the Grade to use the same look.

This feature makes those three things work as the owner expects. It changes how a run is shown and heard, not how it
is graded: results, windows, counts and the Performance log stay as 003 defines them.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See where the music is during a run (Priority: P1)

The musician starts a Play run. During the count-in the cursor stands at the first note of the passage. When the
count-in ends, the cursor moves through the Score exactly as it does in Listen mode: a bar through the current
measure at the current note, with the notes due now highlighted. It moves at the tempo being played and never waits.
When the run ends, the cursor goes away and the Grade is shown.

**Why this priority**: in Play mode the Score does not wait, so a musician who loses their place cannot find it again
without a cursor. This is what the owner asked for first, and it is useful even with today's Metronome and marks.

**Independent Test**: open `repertoire/beginner/fur-elise-theme-16-bar`, choose Play, press Start and play nothing.
The cursor stands at the first note during the count-in, then moves note by note in time with the accompaniment and
the Metronome, looking like Listen mode's cursor, and it is gone when the Grade appears.

**Acceptance Scenarios**:

1. **Given** a Score is open in Play mode, **When** the musician presses Start, **Then** during the count-in the
   cursor stands at the first written moment of the passage being played.
2. **Given** the count-in has ended, **When** the run goes on, **Then** the cursor moves through the Score at the
   tempo being played, looking the same as the Listen mode cursor, and it reaches each written moment when that
   moment is heard (click or accompaniment).
3. **Given** a run is under way and the musician plays nothing, **When** the cursor reaches a note, **Then** it does
   not wait: it moves on at the tempo.
4. **Given** a run with a tempo of 60% and a passage of measures 5-8, **When** it plays, **Then** the cursor starts
   at measure 5, moves at 60% of the written tempo and stops at the end of measure 8.
5. **Given** a Score with repeats or a tempo change, **When** it is played, **Then** the cursor follows the same
   order and the same timing as Listen mode.
6. **Given** a run is under way, **When** the musician presses a correct key, **Then** nothing is marked on the
   Score yet: the note turns green only when the Grade is shown (FR-027, owner review 2026-09-25).
7. **Given** a run is under way, **When** the musician stops it or it reaches the end, **Then** the cursor
   disappears and the Grade's marks are shown.
8. **Given** the cursor layer is switched off, **When** a run plays, **Then** no cursor is drawn and nothing else
   about the run changes.
9. **Given** one hand holds a long note (a whole-measure chord) while the other hand moves, **When** the run goes on,
   **Then** the bar moves to each new note as it starts and does not stay on the long note (FR-001, owner review
   2026-09-25).

---

### User Story 2 - Hear a real Metronome during a run (Priority: P1)

The musician presses Start and hears a clear, dry click on every beat: first a count-in, then the whole run. The
first beat of each measure sounds different, so the musician always knows where the bar starts. The click sounds
like a metronome, not like a piano note, and it is in step with the cursor and the accompaniment. The musician can
mute it, as today.

**Why this priority**: playing in time is what Play mode grades, and a musician cannot keep time without a pulse.
Constitution VI asks for the Metronome to be on by default for beginners.

**Independent Test**: open `learning/chords/c-major-scale-and-chords`, choose Play, switch the accompaniment off and
press Start without playing. Every beat of the count-in and the run is a click, not a piano note; the first beat of
every measure is accented; muting the Metronome during the run silences only the click.

**Acceptance Scenarios**:

1. **Given** Play mode with the Metronome on (the default), **When** the musician presses Start, **Then** a count-in
   of whole measures is clicked, as 003 FR-003 defines, and the clicks go on for the whole run.
2. **Given** a run is playing, **When** the musician listens, **Then** every click is an unpitched, percussive sound
   clearly different from the instrument sound of the Score and from the keys the musician plays.
3. **Given** a run is playing, **When** a measure starts, **Then** its first beat is accented and can be told apart
   from the other beats by ear.
4. **Given** a Score with a tempo change or a meter change, **When** it is played, **Then** the clicks follow the
   change and the accent stays on the first beat of every measure.
5. **Given** a run is playing, **When** the musician mutes the Metronome, **Then** only the click stops; the cursor,
   the accompaniment, the recording and the Grade are unchanged.
6. **Given** a run is playing, **When** the musician compares click, cursor and accompaniment, **Then** they are in
   step: the cursor reaches each beat as its click is heard.

---

### User Story 3 - Grade marks in the Practice look (Priority: P2)

After a run, the musician sees the result the same way Practice shows it: every note played correctly has a green
notehead, and every wrong key they pressed is a red disc on the staff at the pitch they actually played, with the
ledger lines and accidental it needs. There are no more purple rings or orange crosses. Early and late are still
shown beside the note. Selecting a green note or a red disc says in plain words what happened, as today.

**Why this priority**: it brings Play and Practice to one visual language and removes the tangle of rings on dense
music. The Grade is still usable and correct without it, so it follows the two P1 stories.

**Independent Test**: grade a recorded performance of "Für Elise" (fake MIDI input) that has correct notes, one wrong
pitch, one wrong octave, one missed note and one extra key. Correct noteheads are green, the wrong pitch and the
wrong octave appear as red discs at the pitches played, the extra key appears as a red disc where it was played, the
missed note has the missed marking, and no ring or cross is drawn anywhere.

**Acceptance Scenarios**:

1. **Given** a finished run, **When** the Grade is shown, **Then** each note whose pitch result is correct has a green
   notehead (hollow heads stay hollow; stems, beams, dots and accidentals keep their printed colour) and no outline.
2. **Given** a note played with a wrong pitch, **When** the Grade is shown, **Then** a red disc sits in that note's
   column at the pitch actually played, with ledger lines, an accidental and an ottava label where needed, exactly
   as Practice draws it.
3. **Given** a note played one octave too low, **When** the Grade is shown, **Then** the red disc sits one octave
   below the written note (or carries an ottava label if it was folded onto the staff).
4. **Given** an extra key press, **When** the Grade is shown, **Then** a red disc sits at the pitch played, in the
   column of the written moment nearest to when it was played.
5. **Given** a missed note, **When** the Grade is shown, **Then** its notehead is grey with the grey skip icon below it
   (the marker Practice now also uses for a skipped note), and no ring is drawn.
6. **Given** a note played early or late, **When** the Grade is shown, **Then** its timing marking is shown beside
   it as today, whether its notehead is green or it has a red disc.
7. **Given** a Grade, **When** the musician selects a green note, a red disc or a missed note, **Then** the plain-words
   explanation of 003 FR-030 is shown ("D5 played, E5 written", "late by 120 ms", "nothing played here"), worded
   as FR-022a says for chords and octave lines.
8. **Given** a Grade, **When** the musician steps through the mistakes, **Then** each red disc and each missed note is
   visited in turn and brought into view.
9. **Given** a Grade on dense music (sixteenth notes, chords, two staves), **When** the musician looks at it, **Then**
   no mark spreads over neighbouring notes the way today's rings do.
10. **Given** a Grade, **When** the marks layer is switched off, a new run starts or the mode changes, **Then** all
    green heads and red discs disappear.

---

### Edge Cases

- **MIDI keyboard unplugged mid-run**: the cursor and the Metronome carry on, as 003 already requires for the clock.
- **Audio device lost or sample rate changed mid-run**: the run ends as 003 defines; the cursor and the clicks stop
  with it and the Grade covers the notes up to that point.
- **Browser tab hidden during a run**: the clicks keep time; when the tab is shown again the cursor is at the right
  place at once, not catching up.
- **Anacrusis (pick-up measure)**: the count-in follows 003 FR-003; the cursor waits at the pick-up note and the
  accent stays on the first beat of each full measure.
- **Tempo and meter changes, tempo percentage**: clicks, cursor and accompaniment all follow them together.
- **Repeats, endings and jumps**: the cursor follows Listen mode's order. A note played on several passes is green
  only if every pass was correct (FR-024); the same wrong key on two passes is one disc; stepping through the
  mistakes visits each occurrence, and its explanation names the pass.
- **Extra key during a long rest**: the disc goes to the nearest note onset of the graded part, which may be the
  next measure's first note; its explanation gives the exact measure and beat.
- **A wrong key that is the other hand's written note**: the disc stays on the graded note's staff (FR-017a).
- **Rests and whole-measure rests**: the cursor behaves as it does in Listen mode (stands at the measure start or at
  the rest).
- **Chords**: each chord note is green or not on its own; a wrong key in a chord is its own red disc in the chord's
  column. Several discs a second apart stay readable as separate noteheads, as in Practice.
- **Ties**: a tied note is graded once at its onset (003 FR-021); the tied continuation takes the same colour as the
  onset, as Practice does; a missed tie shows its marker at the first note only.
- **Keys the Score has but does not grade** (the other hand, another part, grace notes, ornaments): no red disc, as
  in 003 FR-024 (played-along).
- **Sustain pedal**: never creates a green note or a red disc.
- **Many extra keys at one moment** (a hand landing on a cluster): each gets its own disc; discs do not hide each
  other.
- **Extra key pressed during the count-in**: not graded (003 FR-003), so no disc.
- **Stopping a run early**: the Grade is incomplete (003 FR-008) and only the notes up to the stop are marked.
- **Metronome muted before Start**: the count-in is silent but the cursor still stands through it and then moves.
- **Very fast passages**: the cursor stays smooth; the marks stay readable (no ring tangles).
- **Replay of a stored run** (003 US4): its marks use the new look.

## Clarifications

### Session 2026-09-25

- Q: The reddish-purple ring marks a missed note; how does a missed note look once the ring goes? -> A: a grey
  notehead plus the small marker Practice uses for a skipped note (008 FR-009), so missed reads the same in both
  modes and differs from correct and from ungraded notes by shape (FR-016).
- Q: During a run, does a wrong key show a red disc while held, as in Practice? -> A: no; red appears only with the
  Grade, as 003 FR-011 says today, so a key played slightly early for the next note never flashes red and then
  turns out correct (FR-027).
- Q: May a Grade disc cover the written notehead in its column, the bounded Constitution VI exception accepted for
  Practice in 008? -> A: yes, same as Practice; recorded in plan Complexity Tracking, no constitution change (FR-021).
- Q: In the owner's screenshot nearly every note is missed; was that a real attempt? -> A: no, a test run; no grading
  problem to follow up.

### Session 2026-09-25 (owner review of the implemented feature)

- Q: During a run, correct keys turn their notes green (003 FR-011, 008 FR-017, kept by FR-027). Keep that? -> A: no.
  Owner: "green and red dots should be shown only after hitting stop, or going to the end. It's a grade and should be
  shown after." During a run the Score shows the cursor and its highlight only; every mark appears with the Grade
  (FR-027, FR-008 withdrawn, AS-1.6). This replaces the live "correct" marking of 003 FR-011 in Play mode.
- Q: The bar stays on a long note (a whole-measure left-hand chord) while the right hand moves on. Which note should
  it follow? -> A: owner: "It should follow current played note." The bar stands at the note that started most
  recently among the notes sounding; the highlight still covers every note sounding (FR-001, AS-1.9). Listen mode
  draws the same cursor (FR-001), so it gets the same rule.
- Q (constitution audit, MEDIUM): with the on-screen piano off (the default), a key pressed during a run now has no
  visual response, while the constitution's budget asks for visual feedback within 50 ms of a key press. Accept, or
  add a neutral "key is down" sign? -> A: accept (owner: "Go with recommendations"). During a Play run the feedback
  for a key is its sound, plus the on-screen piano when the musician switches it on; the run is judged afterwards
  (FR-027, plan Complexity Tracking).
- Q (from the US2 checkpoint): the processor now applies a Score's own `<volume>`/`<pan>` (001's design, dropped
  before), so e.g. `ode-to-joy` is 3.5 % (+0.3 dB) louder in Listen. Accept, or apply only drum flag, bank and
  program? -> A: accept (owner: "Go with recommendations"; Assumptions).

### Session 2026-09-25 (plan open points; owner: "resolve everything, go with recommended")

- Q: A small ">" under a notehead reads as an accent (`music-domain-expert`); keep Practice's skip chevron for the
  missed marking, or change the marker? -> A: change it, in both modes: a grey **skip icon** (a solid right-pointing
  triangle with a bar at its tip, like a media "skip" sign) replaces the chevron for a missed note in Play and for a
  skipped note in Practice, at the same place below the notehead (FR-016, FR-016a).
- Q: After the channel-setup fix, multi-instrument Scores sound as their instruments in Listen mode; accept? -> A: yes,
  that is 001 FR-015 (Assumptions).
- Q: Adopt the expert's explanation wording for chords and octave lines? -> A: yes: a wrong key inside a chord is
  explained without pairing it to one written note, and a note played an octave off where an octave line is in force
  says so (FR-022a).
- Q (constitution audit, HIGH): the planning changes below rewrote FR-017, FR-024 and SC-005 and added FR-017a; does
  the owner accept them? -> A: yes, accepted as recommended.
- Q (constitution audit, MEDIUM): 008 accepted "correct vs not-yet-played by colour only" for Practice, where that
  state is temporary; in a Grade, correct (green) and ungraded notes (the other hand, another part, notes after a
  stop) differ by colour only for as long as the Grade is shown. Accept the extension, or add a shape to correct
  notes? -> A: accept the extension (recommended: a shape on every correct note is the outline look the owner asked
  to remove); every Grade result still differs from every other result by shape (FR-020). Plan Complexity Tracking.

### Session 2026-09-25 (analyze findings; owner: "resolve all with recommended")

- C1: the skip icon sat in the old chevron box just below its notehead, where the next chord tone a third below is
  printed -> it goes below the lowest head of its column on that staff, one icon per column and staff, in both modes
  (FR-016, FR-016a; fixes the same defect in Practice since 008).
- M4: a disc standing for several results explains all of them (FR-022). M5: SC-005 counts only discs a staff can
  show. M7: the early marking goes left of the accidental and displaced heads (FR-018).

### Changes from planning (2026-09-25)

- Found during implementation (T020, 2026-09-25): the Metronome has a second cause. The Play schedule clicks only during the
  count-in, so the clicks stop when the run starts (research B-9, R-14). FR-009, FR-010, FR-011 and SC-002 already require
  the whole run, so no requirement changes; the implementation gains the run clicks (tasks T057, T058).

- The Metronome cause is confirmed (research R-01): the click's instrument is never selected, so it plays as a short
  piano note. The same cause makes every part of every Score sound as piano in Listen mode; the fix therefore also
  restores 001 FR-015 ("each part sounds as its General MIDI instrument"). Piano-only Scores sound as before in
  notes, timing and timbre; a Score's own `<volume>`/`<pan>` now applies (see Assumptions).
- After the `music-domain-expert` review (research R-08): FR-017 now defines "nearest written moment" exactly; new
  FR-017a keeps a wrong-pitch disc on its own note's staff; FR-024 and SC-005 now say how repeats combine (green only
  if every pass was correct, one disc per distinct wrong key, every timing error shown); a missed tie is marked at
  its first note only.

## Requirements *(mandatory)*

### Functional Requirements

#### Cursor during a run

- **FR-001**: During a Play run, from Start to the end of the run, the Score MUST show the same cursor as Listen
  mode: a bar through the current measure at the current written moment, with its marker, and the notes due at that
  moment highlighted - including the graded notes the app does not sound. The current written moment is the latest
  onset among the notes sounding, so the bar moves with every new note and never stays on a long note held while
  another part moves (owner review 2026-09-25; Listen mode's cursor follows the same rule).
- **FR-002**: During the count-in, the cursor MUST stand at the first written moment of the passage being played and
  MUST start moving when the count-in ends.
- **FR-003**: The cursor MUST follow the run's clock at the tempo actually played (003 FR-037), through tempo and
  meter changes, repeats, endings and jumps, within the chosen range, and MUST show what is being heard (the same
  latency compensation as Listen mode).
- **FR-004**: The cursor MUST NEVER wait for the musician's input, and MUST NOT change what is recorded or graded.
- **FR-005**: The view MUST follow the cursor under the same Follow rules as Listen mode (003 FR-007): scrolling away
  stops following until the musician asks to follow again.
- **FR-006**: The cursor MUST disappear when the run ends, is stopped or the mode changes.
- **FR-007**: The existing cursor layer switch MUST apply in Play mode too; switching it off hides only the cursor.
- **FR-008**: *Withdrawn (owner review 2026-09-25)*: no note is marked green during a run any more (FR-027), so the
  cursor's highlight never meets a green head.

#### Metronome

- **FR-009**: The Metronome MUST be heard during every Play run, for the count-in and for the whole run, as an
  unpitched percussive click that is clearly different from the instrument sound of the Score and from the keys the
  musician plays. It MUST never sound like a note of the Score's instrument.
- **FR-010**: The first beat of every measure MUST be accented so that it can be told apart from the other beats by
  ear.
- **FR-011**: The clicks MUST stay in step with the cursor and with the accompaniment, following the Score's tempo
  map, meter changes, the tempo percentage and the chosen range, as 003 FR-003 and FR-004 define.
- **FR-012**: At default settings the click MUST be clearly audible above the accompaniment and above the musician's
  own playing at a moderate dynamic.
- **FR-013**: The Metronome MUST be on by default, and muting it MUST keep working as today: live during a run, and
  changing nothing but the click being silent (003 FR-004).

#### Grade marks

- **FR-014**: A note whose pitch result is correct MUST be shown with a green notehead, the same look as a correct
  note in Practice mode (008 FR-001, FR-002): the notehead itself changes, hollow heads stay hollow, and no outline
  is drawn around it.
- **FR-015**: A note whose pitch result is wrong pitch (including wrong octave) MUST be shown with a red disc at the
  pitch actually played, in the column of that written note, drawn exactly as Practice draws a wrong key (008 FR-004,
  FR-006, FR-007: ledger lines, accidental, ottava label). Its written notehead MUST NOT be green, and carries the
  missed marking of FR-016, so the musician sees both what was written and what was played.
- **FR-016**: A missed note MUST be shown with a grey notehead plus a grey **skip icon** below it - a solid
  right-pointing triangle with a bar at its tip, which cannot be read as an accent - the **missed marking**. Hollow
  heads stay hollow, and the icon never covers any notehead or accidental: it goes below the lowest notehead
  written in its column on that staff (all voices), so in a chord it sits under the whole chord, and one icon stands
  for every missed head of that column on that staff (the grey heads show which).
- **FR-016a**: Practice mode's skipped note MUST use the same skip icon, with the same placement, in place of today's
  chevron (amends 008 FR-009, FR-010), so skipped and missed look the same in both modes. The held-over chevron is
  unchanged.
- **FR-017**: An extra key press MUST be shown as a red disc at the pitch played, in the column of the written
  moment nearest to it in the music: the nearest note onset of the graded part on either staff (the unselected hand
  included, grace notes excluded) within the run's passage, the earlier one when it lies exactly between two, across
  a barline if that is nearer. It goes on the staff Practice would choose for that pitch.
- **FR-017a**: A wrong-pitch disc MUST go on the staff of the written note it stands for, even where the key played
  equals a note written for the other hand at that moment, so it never looks like a mark on that other note.
- **FR-018**: The timing result of a played note (early, late) MUST keep its current marking beside the note; on
  time stays unmarked. The early marking goes left of the note's accidental and of any head displaced to that side,
  the late marking right of any displaced head and dots, so neither covers part of a written note.
- **FR-019**: A Grade MUST NOT draw a ring, a cross or any other outline around a notehead.
- **FR-020**: Correct, wrong pitch, missed, extra, early and late MUST be distinguishable without colour vision
  (Constitution VI): correct is an unmarked head; wrong pitch is the missed marking plus a red disc in the note's
  column; missed is the missed marking alone; extra is a red disc in a column whose written notes carry no missed
  marking or where nothing is written; early and late keep their side markings. Two cases cannot be told apart by
  shape alone and are resolved by the explanation (FR-022) and the mistake stepper: an extra key in a column whose
  note was missed or wrong reads like a wrong pitch there; a wrong key that no staff can show (percussion or TAB
  clef) gets no disc and reads like a missed note.
- **FR-021**: A red disc MUST stay in the column of its written moment and MAY cover a written notehead it meets
  there, exactly as in Practice (008 FR-006). This is the same bounded exception to Constitution VI ("overlays MUST
  NOT hide the notes they refer to") that the owner accepted for Practice, extended to the Grade.
- **FR-022**: Selecting a green note, a red disc or a missed note MUST show its plain-words explanation (003 FR-030);
  a red disc MUST be selectable in its own right, and its explanation MUST cover everything it stands for (a wrong
  pitch on one pass and an extra of the same key on another are both explained).
- **FR-022a**: Two explanations MUST be worded more precisely than 003 FR-030's defaults: (1) a wrong key in a chord
  names what was played in the chord and which written notes were not played ("B4 played in this chord; E4 not
  played"), never implying which written note the key was meant for; (2) a note played exactly the octave an octave
  line (8va / 8vb / 15ma / 15mb) in force would shift says so ("played without the 8va"). All other texts stay 003's.
- **FR-023**: Stepping through the mistakes (003 FR-031) MUST visit every red disc and every missed note in playing
  order and bring each into view.
- **FR-024**: Where a note occurs on several passes (repeats, jumps), its notehead MUST be green only if every pass
  was correct and otherwise carry the missed marking; one red disc MUST be drawn per distinct key played wrongly in
  that column, whatever the number of passes; every timing marking that occurred on any pass MUST be shown (on time
  never hides an early or late); and its explanation MUST list every pass.
- **FR-025**: The marks MUST follow their notes when the Score scrolls, turns page, zooms or reflows; the marks layer
  switch MUST hide all of them; they MUST be cleared when a new run starts or the mode changes (003 FR-035).
- **FR-026**: A mark MUST NOT spread over a neighbouring written note, apart from a red disc in its own column
  (FR-021).
- **FR-027**: During the run (count-in included), the Score MUST show no mark at all: no green notehead, no red
  disc, no missed or timing marking. Every mark appears with the Grade, when the musician stops the run or it reaches
  its end (owner review 2026-09-25; before, correct keys turned green during the run, 003 FR-011, 008 FR-017).
  During the run a key's feedback is its sound (003 FR-006) and, when the musician switches it on, the on-screen piano;
  the Score gives none (owner decision 2026-09-25, plan Complexity Tracking).
- **FR-028**: The Grade's results, counts, summary figures, per-measure overview and Performance log MUST be exactly
  what they are today; this feature changes only how the results are drawn.
- **FR-029**: The same Score, Performance log and settings MUST always produce the same marks.
- **FR-030**: The cursor, the Metronome and the marks MUST behave identically in the browser and in the desktop app,
  from the same build.

### Key Entities

- **Play run** (003): the timed attempt; this feature adds that its position is shown by the cursor.
- **Metronome** (constitution vocabulary): the click, count-in and accent; this feature makes it audible as a click.
- **Grade** (003): per-note pitch and timing results plus extra key presses; this feature changes only how each is
  drawn: green notehead, red disc, missed marking, timing marking.
- **Red disc** (008): a mark at the pitch of a key actually pressed that is not the written note, in the column of a
  written moment.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of Play runs over the reference fixtures, a cursor is visible from Start until the Grade
  appears, and at every moment it is within 50 ms of the sound actually heard (the Listen mode budget, 001 SC-004).
- **SC-002**: Over the reference fixtures, including tempo changes, meter changes, an anacrusis, repeats and tempo
  percentages of 50% and 150%, every beat of the count-in and the run has exactly one click, every click starts
  within 3 ms of its beat, and every first beat of a measure is the accented click.
- **SC-003**: In a recording of a run with the accompaniment off and no input, every sound is a metronome click:
  zero sounds are notes of the Score's instrument.
- **SC-004**: In a listening check, the owner identifies the click as a metronome and tells the accented first beat
  from the others without looking at the screen.
- **SC-005**: For every reference Grade, every graded notehead is green exactly when all its passes are correct, the
  red discs are exactly the distinct (written moment, key) pairs of its wrong pitches and extras that a staff can
  show (FR-020; without repeats: as many discs as those wrong pitches plus extras), and zero rings or crosses are
  drawn.
- **SC-006**: In a greyscale rendering of a Grade containing every result, a reviewer can tell correct, wrong pitch,
  missed, extra, early and late apart for every marked note.
- **SC-007**: On the owner's "Für Elise" example and on every library item, no Grade mark overlaps a neighbouring
  written note (the red disc in its own column excepted, FR-021).
- **SC-008**: Grading the same Performance log twice produces identical marks, pixel for pixel on the same screen.
- **SC-009**: The cursor animates at 60 frames per second on the reference machine during a run, as in Listen mode.
- **SC-010**: 100% of the acceptance scenarios pass both in the browser and in the desktop app.

## Assumptions

- The cursor is Listen mode's cursor, unchanged in look; the only difference is that in Play mode it also highlights
  notes the app does not sound (the musician's own part).
- "Moving bar" means Listen mode's playhead bar, not a moving page or a scrolling strip; the view already follows the
  run.
- The Metronome is a click only (no visual beat indicator); the existing mute setting is the only Metronome control.
  A volume control or a choice of click sounds is not added.
- The Metronome stays a Play mode feature; Listen and Practice keep having no click.
- "Red dots" and "green" mean the exact look of Practice mode after 008: green noteheads, solid red discs with ledger
  lines and accidentals.
- The early and late markings are kept because the owner did not ask to change them and timing is half of a Play
  Grade.
- An extra key is placed in the column of the nearest written moment because that is how Practice places a wrong key
  (the column of the current note); a disc floating between two notes would be hard to relate to the music.
- Grading itself (windows, strictness levels, matching, counts) is untouched. The owner's screenshot, where nearly
  every note is missed, came from a test run without real playing (Clarifications).
- No mark appears in Play mode during a run; green heads, red discs and every other marking appear with the Grade
  (Clarifications, owner review 2026-09-25).
- The desktop app needs nothing of its own; the Native audio plugin is not involved.
- After the Metronome fix, multi-instrument Scores sound as their instruments in Listen mode (001 FR-015); accepted
  by the owner 2026-09-25. Piano-only Scores, the whole library, sound as before in notes, timing and timbre; a
  Score's own `<volume>` and `<pan>` now apply (001's design), so a Score such as `ode-to-joy` (`<volume>80</volume>`)
  is 3.5 % (+0.3 dB) louder than before; accepted by the owner 2026-09-25.

## Out of Scope

- A Metronome in Listen or Practice mode.
- Metronome volume, sound choice, subdivisions, or a visual beat flash.
- Any change to grading, strictness levels, the summary figures or the Performance log.
- Changing Practice mode's marks, except the skipped note's marker shape (FR-016a).
- New MusicXML coverage.
