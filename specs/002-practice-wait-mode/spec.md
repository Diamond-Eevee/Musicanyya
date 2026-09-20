# Feature Specification: Practice Mode (Wait for Input)

**Feature Branch**: `002-practice-wait-mode`
**Created**: 2026-09-20
**Status**: Draft
**Input**: User description: "Practice mode (wait-for-input), the second of the app's three session modes after
Listen. The app waits at each note or chord until the player plays the correct key(s) on the MIDI keyboard, then
advances. Both hands, chords, colour-and-shape feedback, and the Listen/Practice mode switch. Play mode with
grading is a separate later feature."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Practise a piece hands together, one note at a time (Priority: P1)

The musician opens a Score, switches from Listen mode to **Practice mode** and presses Start. The cursor sits on the
first note or chord and nothing moves until they play it on their MIDI keyboard. When they play the right key (or
all the keys of the chord), that note is marked correct and the cursor moves to the next one. A wrong key is marked
as wrong and the cursor stays where it is, so they can try again without the music running away from them. They work
through the piece at their own speed and reach the end.

**Why this priority**: this *is* Practice mode. Waiting for the correct note is the one behaviour that separates it
from Listen, and on its own it already lets a musician learn a piece hands together. Everything else in this feature
makes it more comfortable.

**Independent Test**: open `musicxml/chords/c-major-scale-and-chords.musicxml`, switch to Practice, and play the
piece on a MIDI keyboard: the cursor advances only on correct notes, wrong notes are marked without advancing, and
the session reports that the end was reached.

**Acceptance Scenarios**:

1. **Given** a Score is open in Practice mode at the first note, **When** the musician plays the correct key,
   **Then** that note is marked correct and the cursor moves to the next expected note or chord.
2. **Given** the cursor is waiting on a note, **When** the musician plays a wrong key, **Then** the wrong key is
   marked as a wrong note, the expected note stays marked as waiting, and the cursor does not move.
3. **Given** the cursor is waiting on a chord, **When** the musician holds down all the chord's keys at the same
   time - in any order, at any speed, rolled or together - **Then** the chord is marked correct and the cursor
   advances.
4. **Given** the cursor is waiting on a chord and only some of its keys are held, **Then** the chord does not
   advance, and the keys already held are shown as correct-so-far.
5. **Given** a note the Score ties or sustains across the beat, **Then** it is expected once, where it begins, and is
   never asked for again while it lasts.
5b. **Given** a key that is expected next is already held down - left over from earlier playing, or sustained by
   another voice - **Then** the app says so and asks for it to be released and played again, instead of waiting in
   silence.
6. **Given** the musician plays keys that are not part of the expected note or chord, **Then** they are marked as
   wrong while the chord is still incomplete and as extra once its keys are all held, and the expected note still
   advances as soon as the right keys are held.
7. **Given** the musician plays the right note letter in the wrong octave, **Then** it is marked as wrong and the
   feedback says the octave is wrong.
8. **Given** the musician plays a note, **Then** they hear it through the app's instrument sound, as they do outside
   Practice mode.
8b. **Given** the musician lets a long note go earlier than written, **Then** practice still advances: note lengths
   are never a condition for moving on.
9. **Given** the last note of the Score has been played correctly, **Then** the session ends, the app says the end
   was reached, and the Score stays on screen with the practice marks visible.
9b. **Given** the cursor waits on a note the musician cannot play - below the range of their keyboard, or on a
   broken key - **When** they move on, **Then** that note is marked skipped and the cursor waits at the next
   expected event; moving back returns to the previous one.
10. **Given** a Score with repeats, endings or jumps, **When** practising, **Then** the notes are expected in exactly
    the order Listen mode plays them.
11. **Given** the musician switches between Listen and Practice, **Then** the current session stops, the marks from
    the finished session are cleared, and the other mode starts from the same place in the Score.

---

### User Story 2 - Practise one hand, and start anywhere (Priority: P2)

The musician chooses to practise the right hand only, the left hand only, or both. They also click a measure to start
from there instead of the beginning - for example the passage they keep getting wrong.

**Why this priority**: practising hands separately is how pieces are actually learned, and starting in the middle is
what makes a practice tool usable on a real piece instead of only on the first line.

**Independent Test**: with the same file, practise "right hand only" from measure 5, confirm only right-hand notes
are expected and the session starts at measure 5.

**Acceptance Scenarios**:

1. **Given** Practice mode with "right hand only" selected, **Then** only the notes of the upper staff are expected,
   and left-hand notes are not waited for.
2. **Given** Practice mode with "left hand only" selected, **Then** only the notes of the lower staff are expected.
3. **Given** the musician clicks a measure before starting, **When** the session starts, **Then** the first expected
   note is the first required note of that measure for the selected hand(s); where that measure is played more than
   once, the occurrence used is the one the cursor is in, else the first at or after it.
4. **Given** a hand selection is changed while a session is running, **Then** the session restarts cleanly from the
   current measure with the new selection.
5. **Given** the same pitch is written in both hands at the same time and both hands are selected, **Then** one key
   press satisfies both notes.
6. **Given** "right hand only" is selected, **When** the musician plays the expected right-hand notes, **Then** the
   left-hand notes written at those positions are heard as the cursor passes them, and are never waited for.
7. **Given** the musician switches the accompaniment off, **Then** the unselected hand is shown but stays silent.
8. **Given** "right hand only" is selected, **When** the musician plays the left hand along as well, **Then** those
   keys sound and are marked played-along, are never marked wrong or extra, and never bring up the help.

---

### User Story 3 - Loop a difficult section until it is fluent (Priority: P3)

The musician marks a stretch of measures and practises it on repeat: when the end of the loop is reached, the cursor
jumps back to its start and waits again, as often as they want, until they stop.

**Why this priority**: repetition of a short passage is the core of practice; without it the musician has to restart
by hand every time. It is not needed for the mode to work, so it comes after P1 and P2.

**Independent Test**: set a loop over measures 3-4, practise through it twice, and confirm the cursor returns to the
start of measure 3 each time without stopping the session.

**Acceptance Scenarios**:

1. **Given** a loop is set over a range of measures, **When** the last expected note in the range is played
   correctly, **Then** the cursor returns to the first expected note of the range and waits.
2. **Given** a loop is set, **Then** the looped measures are clearly marked in the Score.
3. **Given** a loop is cleared, **Then** practice continues from the current position to the end of the Score.
4. **Given** a loop range is set backwards (end before start), **Then** the app corrects it to a valid range instead
   of refusing it.

---

### User Story 4 - Help when I am stuck (Priority: P4)

When the musician repeatedly plays the wrong key for the same note, the app shows them what it is waiting for: the
expected key lit on the on-screen keyboard, the note's name, and the fingering written in the Score. They can also
ask for this help at any time.

**Why this priority**: it turns a wall into a lesson, and it uses information the app already has. Practice works
without it.

**Independent Test**: play the wrong note three times in a row on the same expected note and confirm the expected key
is shown on the on-screen keyboard together with its note name and written fingering.

**Acceptance Scenarios**:

1. **Given** the musician plays a wrong key several times on the same expected note, **Then** the app shows the
   expected key on the on-screen keyboard, without moving the cursor on by itself.
2. **Given** help is shown, **When** the correct key is played, **Then** the help disappears and practice continues
   normally.
3. **Given** the expected note has a fingering written in the MusicXML, **Then** that fingering is part of the help.
4. **Given** the musician asks for help directly, **Then** the same help appears immediately for the expected note.
5. **Given** help is shown, **Then** it never covers the note it refers to and can be switched off for the session.

---

### Edge Cases

- **MIDI keyboard unplugged mid-session**: a non-blocking notice appears, the session keeps its position and waits;
  replugging the keyboard resumes practice without restarting or losing the marks.
- **No MIDI keyboard, or MIDI not allowed by the browser**: the app explains why Practice mode cannot run and leaves
  Listen mode fully usable; clicking the on-screen keyboard does not stand in for a MIDI keyboard.
- **Sustain pedal held down**: notes kept sounding by the pedal are not treated as new key presses, and a pedalled
  note that is expected again must be played again.
- **Notes held from the previous chord**: a key still held from an earlier expected note counts for the next one only
  where the Score actually ties or sustains it; otherwise it must be pressed again.
- **A long note in one hand under moving notes in the other**: the held note must not be demanded again while the
  other hand moves on (e.g. the whole-note chords in the C major exercise).
- **Unison across hands**: the same pitch expected in both hands at once is satisfied by one key press.
- **Rests**: rests are not waited for; the cursor moves over them to the next sounding note.
- **Grace notes and ornaments**: grace notes are shown and accepted if played - marked played-along, never wrong -
  but are never waited for; ornament signs (trills, turns) are not expanded into expected notes.
- **Unsupported or malformed MusicXML**: whatever Listen mode can play, Practice can expect; anything the loader
  skipped is not expected and the existing load report still explains it.
- **A required key outside the connected keyboard's range**: a 61-key controller cannot play a note written below
  it; the musician moves on with the skip control and the note is marked skipped, rather than the session waiting
  for a key that does not exist.
- **Very fast passages**: expected notes arrive as fast as the musician plays them; nothing in Practice depends on
  the written tempo.
- **Very long Scores**: a 500-measure Score can be practised from any measure without a noticeable pause when
  starting.
- **Scrolling away during a session**: following stops until the musician presses Follow, exactly as in Listen mode;
  the session itself keeps waiting.
- **Same note repeated (repeated key)**: a repeated pitch must be released and pressed again to count as the next
  note.
- **Unpitched or percussion parts**: not expected in Practice; a Score with only such parts reports that there is
  nothing to practise, and such a part is never offered as the practised part.
- **A Score with several pitched parts** (voice and piano, a quartet): the app practises one part - preselected as
  the most keyboard-like one, changeable by the musician - and the rest sounds as accompaniment; the preselection
  is shown, never silent, so a wrong guess is visible before the first note.

## Clarifications

### Session 2026-09-20

- Q: How is a key judged that the Score writes at the current position but does not require (a note of the
  unselected hand, a grace note)? -> A: Accepted, never wrong - it sounds and is marked with its own neutral
  "played along" state, is never counted as wrong or extra, and never feeds the help trigger. Only keys the Score
  does not write at that position are judged.
- Q: What decides whether an unexpected key is marked wrong pitch or extra? -> A: While the current event still has
  unplayed required keys, every unexpected press is an attempt at it: wrong pitch, or wrong octave when its pitch
  class matches a required key. "Extra" is only a key pressed once all required keys are already held, or one left
  over from earlier playing. No distance threshold and no new constant.
- Q: In a Score with more than one part, which part is practised? -> A: The app preselects the most keyboard-like
  part (the first pitched part with two or more staves, else the first pitched part) and lets the musician change
  it in the practice panel; the hand presets apply to that part's staves, and every other part sounds as
  accompaniment under FR-031.
- Q: Starting from a chosen measure inside a repeat - which occurrence? -> A: The same rule as a loop range (R-06,
  `PRACTICE_LOOP_OCCURRENCE`): the occurrence the cursor is in, otherwise the first one at or after it. Practice
  then follows the unrolled order to the end, repeats and voltas included.
- Q: How does a musician get past a note they cannot play (outside the controller's range, a broken key, a parser
  misread), given that the app waits for ever? -> A: A skip control - move to the next expected event, and back to
  the previous one, at any time. The passed note is marked skipped: its own neutral state, never wrong, never part
  of the help counter.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST offer Practice mode alongside Listen mode, switchable at any time, with the active mode
  always visible.
- **FR-002**: In Practice mode the app MUST NOT play the Score by itself; the Score advances only through the
  musician's MIDI input.
- **FR-003**: The app MUST derive the expected notes from the same Score and the same playback order as Listen mode,
  including repeats, endings and jumps.
- **FR-004**: The app MUST wait at each expected note or chord until the musician plays it, however long that takes,
  unless the musician moves on themselves (FR-004a).
- **FR-004a**: The musician MUST be able to move to the next expected event, and back to the previous one, at any
  time during a session. A note passed this way MUST be marked skipped - never wrong, never extra, never counted
  towards the help in FR-023 - and the session MUST continue normally from the new position.
- **FR-005**: A chord MUST be accepted when all of its expected pitches are held down at the same time, in any order
  and with no time limit between them.
- **FR-006**: A single note MUST be accepted on the key press, not on the key release.
- **FR-007**: Keys pressed that are not required MUST NOT advance the cursor and MUST NOT block the expected note
  from being accepted afterwards. A key the Score writes at the current position but does not require (the
  unselected hand, another part, a grace note) MUST be marked played-along and MUST NOT be judged. Any other
  unexpected key pressed while the current event still has unplayed required keys MUST be marked wrong pitch -
  wrong octave when its pitch class matches a required key; a key pressed once all required keys are already held,
  or one left over from earlier playing, MUST be marked extra.
- **FR-008**: A note the Score ties or sustains from an earlier onset MUST belong to that earlier expected event and
  MUST NOT be expected a second time.
- **FR-009**: Every expected note MUST require a fresh key press - a release followed by a press, or a press after
  its event became the current one - rather than counting a key that happens to be down already.
- **FR-009a**: When a required key is already held as its event becomes current, the app MUST show that at once and
  ask for it to be released and played again, so the session never waits in silence for a key that cannot arrive.
- **FR-010**: Each note touched by the session MUST be shown in one of the states waiting, correct, wrong pitch,
  wrong octave, extra, held-over, played-along or skipped, and these states MUST be distinguishable by shape or
  marking as well as by colour.
- **FR-011**: A played key MUST be marked on the Score and on the on-screen keyboard within the same time budget as
  MIDI input outside Practice mode.
- **FR-012**: Notes played by the musician MUST sound through the app's instrument, as they do outside Practice mode.
- **FR-013**: The musician MUST be able to practise the right hand only, the left hand only, or both hands.
- **FR-014**: When one hand is selected, the notes of the other hand MUST NOT be expected and MUST NOT block progress.
- **FR-015**: The musician MUST be able to start a session from a chosen measure as well as from the beginning.
  Where the chosen measure is played more than once (a repeat, an ending), the session MUST start at the occurrence
  the cursor is in, otherwise at the first occurrence at or after it - the same rule a loop range uses - and MUST
  then follow the played order to the end, repeats and jumps included.
- **FR-016**: The musician MUST be able to set, change and clear a loop over a range of measures, and the loop MUST
  restart at its first expected note when its last expected note is played.
- **FR-017**: The cursor MUST follow the expected note and keep it on screen under the same Follow rules as Listen
  mode.
- **FR-018**: Reaching the end of the Score (or stopping the session) MUST end the session with a plain statement
  that the end was reached, leaving the practice marks on screen; no Grade and no score are produced.
- **FR-019**: Starting a new session MUST clear the marks of the previous one.
- **FR-020**: Nothing in Practice mode may interrupt the session with a modal dialogue; problems appear as
  non-blocking notices.
- **FR-021**: Losing the MIDI keyboard mid-session MUST pause the wait with a notice and keep the position; getting it
  back MUST resume without restarting the session.
- **FR-022**: When Practice mode cannot run (no MIDI keyboard, or MIDI access refused), the app MUST say why and keep
  the rest of the app usable.
- **FR-023**: After repeated wrong attempts on the same expected note, the app MUST show what it is waiting for: the
  key on the on-screen keyboard, the note name, and the fingering written in the Score if there is one.
- **FR-024**: The help in FR-023 MUST also be available on request, MUST never cover the notes it refers to, and MUST
  be switchable off.
- **FR-025**: Practice MUST work on a Score with any number of staves and voices, expecting all sounding notes of the
  selected hand(s) at a given position.
- **FR-025a**: Practice MUST expect the notes of ONE part at a time. The app MUST preselect the most keyboard-like
  part - the first pitched part with two or more staves, otherwise the first pitched part - and the musician MUST
  be able to choose a different pitched part. The hand presets of FR-013 and FR-034 apply to the staves of the
  chosen part.
- **FR-025b**: The parts that are not chosen MUST never be expected; they MUST sound as the cursor passes them and
  MUST be silenceable, under the same rules as the unselected hand (FR-031, FR-032).
- **FR-025c**: Changing the practised part MUST restart the session from the current measure with the new part, as
  changing the hand selection does (US2, scenario 4).
- **FR-026**: The sustain pedal MUST NOT create or satisfy expected notes.
- **FR-027**: Grace notes MUST be accepted if played but never waited for: playing one marks it played-along, and
  it is never wrong, never extra and never counted towards the help in FR-023. Unexpanded ornaments MUST NOT create
  expected notes.
- **FR-028**: The same recorded sequence of MIDI input events on the same Score MUST always produce the same
  sequence of per-note results.
- **FR-029**: Practice mode MUST behave identically in the browser and in the desktop app, from the same build.
- **FR-030**: Practice sessions MUST stay on the musician's device; nothing is uploaded.
- **FR-031**: When one hand is selected, the notes of the other hand MUST sound as the cursor passes them - that is,
  at the moment the musician satisfies the expected note they are written with - so the musician hears the
  accompaniment in step with their own playing and never against a clock of its own.
- **FR-032**: The unselected hand's notes MUST be visibly distinct from the expected ones, MUST never be waited for,
  and MUST be silenceable for the session. A musician who plays the unselected hand along MUST NOT be corrected for
  it: those keys are marked played-along, exactly as in FR-007.
- **FR-033**: Practice mode MUST require a MIDI keyboard; the on-screen keyboard and the computer keyboard are
  display and help only, and MUST NOT satisfy expected notes.
- **FR-034**: Which hand a note belongs to MUST follow the hand that plays it, not the staff it is printed on, so
  cross-staff writing is practised by the correct hand. "Right hand" and "left hand" are presets over the Score's
  staves; a Score with one staff offers a single line without calling it a hand, and a Score with more than two
  staves (for example an organ pedal line) makes the extra staves selectable too.
- **FR-035**: Notes the Score hides from the page (invisible or playback-only notes) and unpitched or percussion
  notes MUST never be expected. Where the Score sounds them, they may still be heard; they are simply never waited
  for, because a musician cannot play what is not shown.
- **FR-036**: A position with no required notes - only grace notes, only notes of the unselected hand, only hidden
  or unpitched notes - MUST be passed over, never waited on.
- **FR-037**: Releasing a note earlier than written MUST NOT stop the session from advancing; note lengths are never
  a condition. The app MAY point out that the Score holds the note longer, as information only.
- **FR-038**: Where a required pitch is written more than once at the same moment (a unison between hands, or two
  voices sharing a key), one key press MUST satisfy all of them and MUST mark every one of those notes.
- **FR-039**: Feedback MUST name the relation and the next physical action rather than pass a verdict: a right
  letter in the wrong octave says which octave to move to, an extra key left over from an earlier chord says which
  key to lift, and no wording, counter or symbol may suggest a score or a mark.

### Key Entities

- **Practice session**: one run through a Score (or a loop range) in Practice mode - which Score, which hand
  selection, where it started, where the cursor is now, and whether it is waiting, running or finished.
- **Expected event**: the next thing the musician must play - one note or a chord, identified by Note IDs, with the
  pitches it requires and which hand each belongs to.
- **Attempt**: one key press judged against the current expected event - correct, wrong pitch (including wrong
  octave), extra, or played-along for a key the Score writes at that position without requiring it.
- **Practice marks**: the per-note results shown on the Score for the current session, including the notes passed
  over with the skip control.
- **Practised part**: the one part of the Score whose notes are expected; every other part is accompaniment.
- **Hand selection**: right hand only, left hand only, or both, over the staves of the practised part.
- **Loop range**: the first and last measure of a repeated stretch, if one is set.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of trials, a wrong key never advances the cursor, and the correct key always does; the cursor
  moves without a correct key only when the musician moves it themselves (FR-004a).
- **SC-002**: A correct note is marked and the cursor moves on within 50 ms of the key press on the reference
  machine.
- **SC-003**: Chords are accepted however they are rolled: in 100% of trials, holding all the chord's keys down
  together advances the chord, whatever the order and however long the roll takes.
- **SC-004**: Replaying the same recorded performance against the same Score reproduces identical per-note results,
  every time.
- **SC-005**: For 100% of the reference fixtures with repeats, endings, jumps, ties and multiple voices, the order of
  expected notes matches the order Listen mode plays.
- **SC-006**: A musician with a Score already open can start practising in at most two actions and under 10 seconds.
- **SC-007**: A 20-minute practice session ends with no stuck notes, no lost key presses and no drift in which note
  is expected.
- **SC-008**: After unplugging and replugging the MIDI keyboard, practice continues from the same expected note
  within 3 seconds, in 100% of trials, without restarting the session.
- **SC-009**: Every feedback state (waiting, correct, wrong pitch, extra, played-along, skipped) is
  distinguishable in greyscale and by shape, verified on a colour-blind-safe check.
- **SC-010**: 100% of the acceptance scenarios pass both in the browser and in the desktop app from the same build.
- **SC-011**: Starting a session anywhere in a 500-measure Score begins waiting within 1 second.
- **SC-012**: When practising one hand, the other hand's notes are heard within 50 ms of the expected note they are
  written with, and never advance the cursor by themselves.

## Assumptions

- Practice mode judges **which notes**, never **when**: rhythm, note lengths and the written tempo play no part in
  whether a note is accepted. Timing judgement belongs to Play mode and grading (feature 003).
- A chord is satisfied by its pitches being held down simultaneously; the app does not impose a window between the
  first and last key of a rolled chord.
- The musician's own notes are what is heard for the hand they are practising; the app never plays an expected note
  for them (help shows the key visually instead).
- When one hand is selected, the other hand is the exception: it sounds as the cursor passes it, driven by the
  musician's own progress rather than by a clock.
- Hand attribution follows each voice's home staff - the staff that voice mostly lives on - so a note beamed across
  to the other staff is still practised by the hand that plays it. "Right hand" and "left hand" are presets over
  staff sets; a single-staff Score offers one line, and a Score with more than two staves exposes the extra ones.
- A voice that genuinely alternates between the hands is attributed to one of them; this only affects practising
  hands separately, never the order or grouping of notes when both hands are selected.
- One MIDI keyboard is assumed. Music written for two keyboards (organ manuals, two pianos) is practised as if on
  one, and the app says so rather than demanding two presses of the same key.
- Hand selection, the practised part, loop range and the help setting are session settings, remembered per Score on
  the device, not uploaded.
- Wrong octaves count as wrong pitches and say which way to move; an octave doubling written in the Score is not a
  unison, so both keys are still required.
- Reference machine, supported MusicXML range, browser and desktop targets, and the built-in instrument sound are
  the same as in feature 001.
- A MIDI keyboard is a normal piano-style controller; velocity and aftertouch are not judged.
- The Metronome does not run in Practice mode (it arrives with Play mode).
- The existing Listen-mode cursor, Follow behaviour, on-screen keyboard and instrument sound are reused as they are;
  this feature adds the waiting and the per-note feedback.

## Out of Scope

- Play mode, the Metronome, Grade, scores and Performance logs (feature 003).
- Any judgement of timing, rhythm, tempo, dynamics or evenness.
- Practice statistics across sessions: history, streaks, progress charts, "notes you always miss".
- Advice files beyond the fingering already written in the MusicXML (feature 007 territory).
- Automatic tempo increase ("speed trainer"), rhythm tapping, and sight-reading drills.
- Recording audio or MIDI to a file.
- The low-latency audio plugin and audio-device selection.
