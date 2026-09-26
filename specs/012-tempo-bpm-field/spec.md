# Feature Specification: Tempo as an Editable BPM Number

**Feature Branch**: `012-tempo-bpm-field`
**Created**: 2026-09-26
**Status**: Draft
**Input**: User description: "this tempo is not very readable. Please show it as editable number like 90BPM. Take it
from music xml." (with a screenshot of the transport bar: the word "Tempo" followed by an unlabelled slider)

## Background

The transport bar shows the tempo as a slider with no number next to it. The slider stands for a percentage of the
written tempo (25% to 200%, in steps of 5%), but the screen shows neither the percentage nor the tempo it produces, so
the musician cannot tell how fast the music will go, cannot set a tempo their teacher asked for ("practise it at
72"), and cannot see what tempo the Score itself asks for. The Play mode setup has its own tempo choice, a list of
percentages ("75% of written tempo"), and past attempts are labelled the same way.

The Score already knows its written tempo: the app reads the metronome mark or sound tempo from the MusicXML file and
plays at it (a Score without one plays at a default tempo, with a notice). This feature makes that tempo visible and
editable as a plain number of beats per minute, e.g. **90 BPM**, everywhere a tempo is chosen or shown.

## Clarifications

### Session 2026-09-26

- Q: Which note does one BPM count (FR-003)? → A: The note of the written metronome mark (6/8 "dotted quarter = 60"
  shows 60 with a dotted-quarter symbol); without a mark, the beat the Metronome clicks.
- Q: What tempo does a Score start at when opened (FR-015)? → A: Always its written tempo; no carry-over from the
  previous Score (Play mode keeps its per-Score run tempo).
- Q: (plan, music-domain review) Is "c. 90" readable? → A: Yes, as 90; a range "90-100" uses 90 (Edge Cases).
- Q: (plan) Which note does a later sound-only tempo change count? → A: The earlier mark's note value, until the next
  time-signature change; then the Metronome's beat (FR-003).
- (analyze A1, A7, A9, A13, owner said "use the recommendations") Listen and Practice have no Metronome, so US2,
  FR-013, SC-002 and SC-006 speak of the beats of the music; the tempo bounds of research R-2 are stated as new; the
  field holds four digits; the Assumptions name the extra `<metronome>` forms.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the Score's tempo as a number (Priority: P1)

A musician opens a Score. Next to the transport buttons they see its written tempo as a number, e.g. "Tempo 90 BPM",
taken from the tempo marking in the MusicXML file. While the music plays, the number shows the tempo the music is
actually being played at.

**Why this priority**: This is the owner's complaint: the tempo is unreadable today. Seeing the tempo is useful on its
own, even before it can be typed.

**Independent Test**: Open a library item whose MusicXML has a metronome mark of 90 per quarter note; the transport
shows "90 BPM". Open a Score without any tempo marking; it shows the default tempo and says that it is a default.

**Acceptance Scenarios**:

1. **Given** a Score whose first tempo marking is "quarter = 90", **When** it is opened, **Then** the transport shows
   the tempo as the whole number 90 with the unit "BPM".
2. **Given** a Score with no tempo marking (or a text-only one such as "Allegro"), **When** it is opened, **Then** the
   transport shows the default tempo the app plays it at, marked as a default rather than as the written tempo.
3. **Given** a Score whose tempo changes in measure 17 from 90 to 60, **When** Listen mode plays past measure 17,
   **Then** the number changes from 90 to 60 when the cursor reaches the change.
4. **Given** the musician has slowed the tempo down, **When** they look at the tempo, **Then** they can also see the
   written tempo it is compared with (e.g. "72 BPM, written 90").
5. **Given** a Score in 6/8 marked "dotted quarter = 60", **When** it is opened, **Then** the transport shows 60 BPM
   with a dotted-quarter note symbol, matching the printed marking and the Metronome's clicks.
6. **Given** the musician set 72 BPM on one Score, **When** they open another Score written at 120, **Then** the new
   Score starts at 120 BPM.

---

### User Story 2 - Type the tempo to practise at (Priority: P1)

The musician types a tempo, e.g. 72, and the music and the cursor (and, in Play mode, the Metronome) follow exactly
that tempo. They can
also nudge it up or down one step at a time, and get back to the written tempo with one action.

**Why this priority**: The owner asked for an *editable* number. Setting a precise tempo is how musicians practise
(a teacher's "take it at 72", or working a piece up a few BPM a day); the percentage slider cannot do it.

**Independent Test**: Open a Score written at 90, type 72 into the tempo field and play in Listen mode; the beats of
the music come at 72 per minute. Press the reset control; the field shows 90 again.

**Acceptance Scenarios**:

1. **Given** a Score written at 90 BPM, **When** the musician types 72 and confirms (Enter or leaving the field),
   **Then** the field shows "72 BPM" and playback and cursor run at 72 beats per minute (in Play mode the Metronome
   too, US3).
2. **Given** a Score written at 90 BPM, **When** the musician types 91, **Then** the music plays at exactly 91 beats
   per minute - any whole number in the allowed range is accepted, not only multiples of a step.
3. **Given** Listen mode is playing, **When** the musician confirms a new tempo, **Then** the music continues from
   where it is at the new tempo, without stopping, restarting or a gap in the sound.
4. **Given** the tempo field, **When** the musician presses the up / down step controls (buttons or arrow keys),
   **Then** the tempo goes up / down by 1 BPM per press and takes effect as with a typed value.
5. **Given** a changed tempo, **When** the musician uses the reset control, **Then** the tempo returns to the Score's
   written tempo.
6. **Given** a Score written at 90 BPM, **When** the musician types 10 or 500, **Then** the tempo is set to the nearest
   allowed limit and the field shows that limit, so what is shown is always what is played.
7. **Given** the tempo field, **When** the musician types something that is not a number, empties the field, or presses
   Escape, **Then** the field goes back to the tempo in force and nothing else changes.
8. **Given** the musician is typing digits or a space in the tempo field, **When** they press a key that is also a
   keyboard shortcut (e.g. Space for play), **Then** the key goes into the field and does not trigger the shortcut.
9. **Given** a Score with a tempo change from 90 to 60, **When** the musician sets the tempo to 45 while the tempo in
   force is 60, **Then** the whole Score is played in the same proportion (the 90 section at 67.5, shown as 68), so
   the written relationship between sections is kept.

---

### User Story 3 - The same tempo number in Play mode and in the Grade (Priority: P2)

In Play mode the musician chooses the tempo of a run in BPM, the same way as in the transport, and every past attempt
tells them the tempo it was played at in BPM.

**Why this priority**: Play mode still lists "75% of written tempo"; after US1-US2 the app would show two different
ways of stating one thing. Consistency matters, but the transport tempo (US1-US2) is what the owner asked about.

**Independent Test**: Open a Score written at 120, choose Play mode, set the tempo to 90, do a run; the run's Metronome
clicks at 90, and the attempts list shows the attempt at "90 BPM (75% of written)".

**Acceptance Scenarios**:

1. **Given** Play mode on a Score written at 120, **When** the musician sets the tempo to 90, **Then** the count-in,
   the Metronome, the accompaniment and the grading windows all use 90 BPM, exactly as they use a percentage today.
2. **Given** Play mode, **When** the musician looks at the transport and the Play setup, **Then** both show the same
   tempo; there are never two different tempos on the screen for the next run.
3. **Given** a Play run in progress, **When** the musician looks at the tempo, **Then** it shows the run's tempo and
   cannot be changed until the run ends (the Grade depends on it).
4. **Given** an attempt recorded before this feature (stored as a percentage), **When** the attempts list is shown,
   **Then** it shows that attempt's tempo in BPM (with the percentage), and regrading it gives the same Grade as
   before.
5. **Given** a Play run at 90 BPM on a Score written at 120, **When** the Grade is regraded, **Then** the result is
   identical to the first grading.

---

### Edge Cases

- **No tempo, text-only tempo, unreadable number**: a marking with no sound value and no readable metronome number
  (e.g. "Allegro", or a metric modulation such as "quarter = dotted quarter") gives the default tempo, shown as a
  default, and the existing notice is kept. An approximate mark ("c. 90", "ca. 90") counts as 90, and a range
  ("60-70") uses its first, slower number.
- **Marking and sound tempo disagree**: the field shows the tempo that is played (the sound tempo), as playback does
  today.
- **Tempo changes and repeats**: the number shown is the tempo in force at the cursor, before and after repeats and
  jumps; changing it scales the whole Score (US2 scenario 9).
- **Seeking**: clicking a measure in a later section shows the tempo in force there, before playback starts.
- **Rounding**: the field always shows a whole number. When scaling produces a fraction in another section (e.g.
  67.5), the music plays the exact value and the field shows it rounded.
- **Compound and cut-time meters**: see FR-003; the number is never shown against a different beat than the one the
  Metronome clicks in, without saying which beat it is.
- **Very slow or very fast written tempos**: the allowed range is relative to the written tempo (FR-008), so a Score
  written at 40 can go down to 10 BPM and one written at 200 up to 400; the field has room for four digits (a
  fast marking in short notes can exceed 999).
- **Practice mode**: the field works as in Listen mode; wait mode still waits for the correct notes, and the tempo sets
  the pace of the accompaniment and the cursor between them, as the percentage does today.
- **Small screens**: the field, its unit and its controls stay usable at phone width without hiding the play buttons.
- **Audio device loss or MIDI unplugged mid-run**: nothing new; the tempo stays as set.
- **Malformed MusicXML**: a tempo value of zero, negative or not a number is ignored as today; a tempo below 10 or
  above 1000 quarter notes per minute is now ignored the same way (new, research R-2). The Score still opens
  (Constitution III).

## Requirements *(mandatory)*

### Functional Requirements

**Showing the tempo**

- **FR-001**: The transport MUST show the tempo as a whole number followed by the unit "BPM" (e.g. "90 BPM"),
  replacing the unlabelled tempo slider.
- **FR-002**: When a Score is opened, the tempo MUST be taken from the Score's first tempo marking in the MusicXML file
  (its sound tempo, else its metronome mark). A Score with no usable marking MUST show the default tempo it is played
  at, marked as a default (e.g. "100 BPM (default)").
- **FR-003**: The number MUST count beats of the note value of the written metronome mark in force (6/8 marked
  "dotted quarter = 60" shows 60; "half = 60" shows 60). A later tempo change without its own metronome mark keeps
  that note value until the next time-signature change. Where no metronome mark gives a note value (none yet, or
  after a time-signature change, or the default tempo), it MUST count the beat the Metronome clicks at that point. When the beat is not a quarter
  note, the beat MUST be shown next to the number (e.g. a dotted-quarter note symbol).
- **FR-004**: While music plays, the number MUST follow the tempo in force at the cursor (tempo changes, repeats,
  jumps), and after a seek it MUST show the tempo in force at the new position.
- **FR-005**: When the tempo differs from the written tempo in force, the written tempo MUST also be visible (e.g.
  "written 90").
- **FR-006**: The field MUST be readable: the number and unit at least the size of the other transport labels, with
  an accessible name that says it is the tempo in beats per minute.

**Changing the tempo**

- **FR-007**: The musician MUST be able to type a whole number of BPM; it takes effect on Enter or when the field loses
  focus. Escape, an empty field or text that is not a number MUST restore the tempo in force without changing
  anything.
- **FR-008**: The allowed tempo MUST be 25% to 200% of the written tempo in force (today's range), expressed in whole
  BPM. A value outside it MUST be set to the nearest limit, and the field MUST show the value actually used.
- **FR-009**: Any whole BPM in the allowed range MUST be played exactly; the tempo MUST NOT be rounded to a coarser
  step (such as 5% of the written tempo).
- **FR-010**: Step controls (up/down buttons and the arrow keys in the field) MUST change the tempo by 1 BPM per step.
- **FR-011**: A reset control MUST return the tempo to the written tempo; it MUST be disabled while the tempo already
  is the written tempo.
- **FR-012**: A changed tempo MUST apply to the whole Score in proportion: every written tempo is scaled by the same
  factor, so a Score's tempo changes keep their relationship.
- **FR-013**: In Listen and Practice mode a new tempo MUST take effect immediately without stopping playback, and the
  audio and the cursor MUST stay in step, as with the slider today. (Listen and Practice have no Metronome; Play
  mode's Metronome follows the run's tempo, FR-018.)
- **FR-014**: Keys typed into the tempo field MUST NOT trigger keyboard shortcuts.
- **FR-015**: When a Score is opened, the tempo MUST start at its written tempo (100%); a tempo chosen for an earlier
  Score MUST NOT carry over. (Play mode keeps its per-Score remembered run tempo, FR-016.)

**Play mode and the Grade**

- **FR-016**: The Play mode setup MUST choose the run's tempo in BPM with the same kind of field (FR-001 to FR-011),
  replacing the percentage list; it is still remembered per Score as the Play settings are today.
- **FR-017**: In Play mode the transport and the Play setup MUST show the same tempo (the next run's tempo); during a
  run the tempo MUST be shown but not be changeable.
- **FR-018**: The count-in, the Metronome, the accompaniment and the grading windows of a run MUST use the tempo chosen
  in BPM exactly as they use the percentage today (003 FR-037).
- **FR-019**: The attempts list and the Grade MUST state the tempo of an attempt in BPM together with its percentage of
  the written tempo (e.g. "90 BPM (75% of written)").
- **FR-020**: An attempt stored before this feature MUST still be shown (its BPM derived from its stored percentage)
  and MUST regrade to the identical Grade; a new attempt MUST store its tempo so that regrading it is identical too
  (Constitution IV).

**Consistency**

- **FR-021**: Every place that states a Score's tempo (transport, Play setup, attempts list, library item details)
  MUST state it in the same way (same beat, FR-003; whole BPM).
- **FR-022**: The feature MUST work the same in both Shells (browser and Electron); it needs no Native audio plugin
  change beyond following the tempo as it does today.

### Key Entities

- **Written tempo**: the tempo the Score asks for at a point in the music, read from the MusicXML tempo markings (or
  the default when there is none); a Score may have several (tempo changes).
- **Chosen tempo**: what the musician sets, shown in BPM for the current position; it scales all written tempos by one
  factor (the percentage the app uses today).
- **Beat**: the note value one BPM counts (FR-003).
- **Run settings / Grade settings**: the Play run's tempo, now chosen in BPM and stored so the Grade stays
  reproducible.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every Score in the library and the real MusicXML fixtures that has a tempo marking, the tempo shown
  on opening equals the tempo of its first marking as played (FR-002, counted in the beat of FR-003); for every Score
  without one, it shows the default and says so. 100% of cases.
- **SC-002**: A typed tempo is played exactly: over one minute of Listen playback at any whole BPM in the allowed
  range, the beats of the music (and, in Play mode, the Metronome's clicks) are spaced 60/BPM seconds apart within
  1 ms.
- **SC-003**: A musician can set a named tempo (e.g. 72) in one typing action plus Enter, under 5 seconds, and return
  to the written tempo with one action.
- **SC-004**: The full tempo text of any allowed value (up to four digits, the unit and the beat symbol) is visible
  without truncation at phone width (375 px) and on desktop, and the play buttons stay visible.
- **SC-005**: Regrading every stored attempt (old percentage-based and new BPM-based) gives a Grade identical to its
  first grading - 100% reproducible.
- **SC-006**: Changing the tempo during Listen or Practice playback causes no audible gap or restart, and the cursor
  stays in step with the audio within the existing cursor tolerance.

## Assumptions

- "BPM" means beats per minute of the beat in FR-003; the written tempo is the first tempo marking of the Score, read
  as the app already reads it (sound tempo first, else the metronome mark), with the existing default when there is
  none. No new MusicXML elements are supported; more forms of `<metronome>` are read (every note value, up to three
  dots, "c. 90", ranges; research R-2).
- The allowed range stays 25%-200% of the written tempo, now at whole-BPM precision instead of 5% steps.
- One step is 1 BPM; a reset-to-written control is part of the field. Larger jumps are done by typing.
- The tempo is one factor over the whole Score; setting a separate tempo per section is not offered.
- Play mode keeps its own remembered, per-Score tempo (as today), shown and chosen in BPM; the transport shows it in
  Play mode so the two cannot disagree.
- Volume and Follow stay as they are; only the tempo control changes.

## Out of Scope

- Gradual tempo changes (ritardando, accelerando) - still not played (docs/musicxml-support.md).
- Tap tempo, automatic speed-up trainers ("add 2 BPM after each clean run").
- Editing or writing the tempo marking into the Score or the MusicXML file; the engraved marking is unchanged.
- Changing the tempo during a Play run.
- Changes to how grading windows depend on tempo (003).
