# Feature Specification: Pressed Keys on the Score

**Feature Branch**: `008-pressed-keys-on-score`
**Created**: 2026-09-25
**Status**: Draft
**Input**: User description: "in practice mode show on sheets which keys user is pressing. If they are pressing wrong
keys red elliptic disk or something. Also correctly pressed notes should become green. We should remove the current
dotted rectangles, they don't look very nice."

## Clarifications

### Session 2026-09-25

- Q: Is a green notehead with no extra shape enough for "correct" under Constitution VI? -> A: Yes, green notehead
  only; correct and wrong differ by shape and position (FR-010).
- Q: Should Play mode's live dashed "correct so far" ring also become a green notehead? -> A: Yes, same style
  (FR-017); the after-run Grade marks stay as they are.
- Q (analyze A1): skipped and correct heads both sit behind the cursor; how are they told apart without colour? ->
  A: a skipped note is a grey head plus a small right-pointing "skip" chevron below it (FR-009, FR-010).
- Q (analyze A2): when do green marks clear on a loop or repeat? -> A: note by note, as the session reaches each note
  again (today's behaviour), not the whole passage at once (FR-012).
- Q (analyze A14): overlap as in the reference picture, or shift aside? -> A: shift aside; a disc never hides a
  written head (FR-006).
- Q (implement): hands separately, a key that plays the other hand's written note: red disc or green? -> A: green
  notehead (`playedAlong`, "never a mistake", 002 contract); no disc, progress not blocked (Edge Cases, FR-004).
- Q (constitution review T064): correct vs not-yet-played differ by colour only -> A: accepted as the plan
  Complexity Tracking row (position behind the band is the non-colour cue); no constitution change.
- Q (implement T068): releasing a held-over key clears its orange mark together with its hint? -> A: yes (FR-009a
  reading confirmed).
- Owner's reference picture: green noteheads (hollow heads stay hollow) for played notes, solid red discs at the
  pressed pitches in the cursor column that disappear on release -> matches FR-001, FR-004, FR-005; red disc size,
  hollow-head colouring and the sideways shift for a second (FR-006) refined from it.

## Background

Today Practice mode marks the Score with outlines drawn around the noteheads: a dashed blue ring around the note it
is waiting for, a dashed sky-blue ring around a chord note held so far, a solid green ring around a played note and
a dashed grey square around a skipped one. Keys that are not written at the current position (wrong pitch, wrong
octave, extra) are shown only on the on-screen keyboard, never on the Score, so a musician reading the music does
not see *where* their hand actually is. The owner finds the dashed outlines unattractive.

This feature makes the Score itself answer "what am I pressing?": a pressed key that matches a written note turns
that notehead green; a pressed key that is not written there appears as a red disc on the staff, at the
line or space of the pitch actually pressed. The dashed outlines go.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Correct notes turn green (Priority: P1)

A musician practising a piece presses the key the Score is waiting for. The written notehead itself turns green -
no ring, no box around it - and stays green after the cursor has moved on, so the passage behind the cursor reads as
"played". The dashed outlines of today are gone from Practice mode.

**Why this priority**: It replaces the outlines the owner dislikes with a cleaner mark on every correct note, which
is what the musician sees most often. Alone it already changes the look of every practice session.

**Independent Test**: Open "Für Elise" from the library, choose Practice, play the first four notes correctly: each
notehead turns green as its key goes down, stays green, and no dashed ring or square is drawn anywhere on the Score.

**Acceptance Scenarios**:

1. **Given** Practice is waiting at a single note, **When** the musician presses that key, **Then** the notehead
   turns green at once and the cursor moves on.
2. **Given** Practice is waiting at a three-note chord, **When** the musician presses two of its keys and holds
   them, **Then** those two noteheads are green and the third stays in its printed colour.
3. **Given** the situation of scenario 2, **When** the musician lets go of one held key before the chord is complete,
   **Then** that notehead returns to its printed colour, because the key is no longer pressed.
4. **Given** a completed chord, **When** the cursor moves on, **Then** all its noteheads stay green.
5. **Given** a session with green notes, **When** a new session starts, **Then** every note is back in its printed
   colour; **and when** a loop or repeat brings the session back into a passage, **Then** each note of it returns
   to its printed colour as the session reaches it again.
6. **Given** Practice is active at any position, **When** the musician looks at the Score, **Then** no dashed ring,
   dashed square or other dashed outline is drawn on it.

---

### User Story 2 - Wrong keys appear on the staff as red discs (Priority: P1)

A musician presses a key that is not written at the current position. A red disc appears on the staff, in
the cursor's column, on the line or space of the pitch they actually pressed - with ledger lines and an accidental
where the pitch needs them. The musician can see at a glance that they are, say, a third too high, or an octave too
low, without looking away from the music. When they let go of the key, the disc disappears.

**Why this priority**: It is the half of the request that shows information the Score does not show today at all:
where the hand really is. It is testable on its own, even with today's correct-note marks.

**Independent Test**: Open "Für Elise", choose Practice, and at the first note (E5) press D5 and hold it: a red disc
sits on the D5 position of the treble staff, level with the cursor, next to the black E5. Release D5: the disc is
gone. Press E4: a red disc appears one octave below E5.

**Acceptance Scenarios**:

1. **Given** Practice is waiting at E5, **When** the musician presses and holds D5, **Then** a red disc
   appears in the cursor's column on the D5 position of the staff, and the cursor does not move.
2. **Given** the red disc of scenario 1, **When** the musician releases D5, **Then** the disc disappears.
3. **Given** Practice is waiting at E5, **When** the musician presses E4 (wrong octave), **Then** the red disc appears
   on the E4 position, one octave below the written note, with ledger lines if E4 needs them on the chosen staff.
4. **Given** Practice is waiting at a note in a piece with no sharps or flats, **When** the musician presses a black
   key, **Then** the red disc carries an accidental so that the pitch it shows is exactly the key pressed.
5. **Given** the musician holds several wrong keys at once, **When** they look at the Score, **Then** each held wrong
   key has its own red disc, and discs a second apart remain readable as separate noteheads.
6. **Given** a key held over from the previous chord (extra), **When** the next event becomes current, **Then** that
   key is shown as a red disc too, together with today's hint saying which key to lift.
7. **Given** a red disc is shown, **When** the musician then presses the correct key, **Then** the written note turns
   green and the cursor moves on, whatever wrong keys are still held; each still-held wrong key keeps its disc, now
   in the new cursor column.
8. **Given** a red disc, **When** its position is compared to the notes written at that moment, **Then** it never
   covers a written notehead: where the pitch coincides with a written note of another voice or staff, the disc is
   placed beside it.

---

### User Story 3 - The other Practice states without dashed outlines (Priority: P2)

The less frequent Practice states - a key already held when its note arrives (held-over), a grace note played along,
a note skipped by moving the cursor forward - get marks in the same style as the green and red noteheads, so the
Score never mixes the new look with the old outlines.

**Why this priority**: These states are rare in normal practice; they only need to be consistent and still
distinguishable once P1 has changed the main look.

**Independent Test**: In a fixture with a grace note and a repeated note, play the grace note (it turns green like a
correct note), hold a key into the next event that needs it (the held-over mark and hint appear), and skip ahead one
event (the skipped note is grey with a small skip chevron below it); no dashed outline appears in any of these.

**Acceptance Scenarios**:

1. **Given** a grace note, **When** the musician plays it, **Then** its notehead turns green like any correct note.
2. **Given** a required key is already down when its event becomes current, **When** the musician looks at the
   Score, **Then** that notehead is marked as held-over, distinct from green and from red by shape as well as
   colour, and today's "release and play again" hint is shown.
3. **Given** the musician skips an event forward, **When** the cursor has moved on, **Then** the skipped noteheads are
   grey with a small right-pointing chevron below each, distinct from printed, green and red noteheads by shape as
   well as colour.
4. **Given** Practice is waiting at an event, **When** nothing is pressed, **Then** the waiting note carries no ring;
   the cursor alone shows where the session is.

### Edge Cases

- **Unison and shared pitches**: one key satisfies a pitch written twice at the same moment (two voices, or both
  hands): every one of those noteheads turns green (002 FR-038).
- **Ties**: a note tied from an earlier onset is not played again; its continuation noteheads turn green together
  with the onset that was played.
- **Hands separately**: the practised hand's notes are the ones the session waits for. A key that plays a written
  note of the other hand is played along, never a mistake (002): that notehead turns green, no red disc is drawn,
  and it does not block progress, exactly as today's matching treats it.
- **Repeats, voltas and loops**: the same written note is played again on the second pass; its green mark is cleared
  when the session enters that passage again, so the second pass starts clean.
- **Where to draw a wrong key on a grand staff**: a key pressed while no staff is obviously its own (e.g. G4 between
  the hands) needs a stable, predictable staff choice (see Assumptions).
- **Very high or low keys**: pitches outside the staff get the ledger lines they need, up to a named limit; beyond it
  the disc is drawn one (or two) octaves closer to the staff at that octave's correct position, with an "8va"/"8vb"
  ("15ma"/"15mb") label beside it, never parked at a wrong position.
- **Chord still incomplete when a key is released**: the green of that notehead is withdrawn (scenario 1.3);
  nothing is ever green for a key that is not down or has not been played.
- **Sustain pedal**: pedalling never creates a red disc or a green note (002 FR-026).
- **MIDI keyboard unplugged mid-session**: all red discs disappear at once (no key can be held); green notes stay;
  the existing pause notice is shown.
- **Marks layer switched off**: neither green nor red marks appear, and the session behaves exactly the same.
- **Page turn / scroll**: the red discs follow the cursor's column wherever the cursor is shown; green notes stay
  attached to their notes when the Score scrolls or reflows (zoom, window resize).
- **Malformed or unusual MusicXML** (hidden notes, percussion, notes without a visible head): no green or red mark
  is drawn where there is no visible notehead; the session is unaffected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: In Practice mode, a written note of the practised part MUST be shown in green while its key is pressed
  as part of the current event, and MUST stay green once its event is accepted.
- **FR-002**: The green mark MUST be a change of the notehead itself, not an outline drawn around it, and MUST NOT
  hide or distort the notehead, its stem, accidental, articulation or fingering.
- **FR-003**: A chord note whose key is released before the chord is accepted MUST lose its green mark.
- **FR-004**: Every key held during a Practice session that is not a written note of the current event (wrong pitch,
  wrong octave, extra) MUST be shown on the Score as a red disc in the current cursor column, at the staff
  position of the pitch pressed, with the ledger lines and accidental that pitch needs.
- **FR-005**: A red disc MUST be shown while its key is held and MUST disappear when the key is released, when the
  session ends or when the MIDI keyboard is lost.
- **FR-006**: A red disc MUST NOT hide any written notehead: where its position coincides with a written note, or
  lies a step (a second) above or below one so the two would overlap, it MUST be shifted sideways, as engravers
  offset a second in a chord, so that the written notehead stays fully readable.
- **FR-007**: The accidental on a red disc MUST name the key pressed unambiguously, read against the key signature
  and the accidentals already in force in the bar on that staff: a sign is shown whenever the disc's pitch differs
  from what its letter would mean there without one. A disc never changes how later written notes read.
- **FR-008**: Green and red marks MUST appear within the same time budget as any other Practice feedback (002 SC-002:
  50 ms from the key press) and MUST disappear within the same budget after the release.
- **FR-009**: Practice mode MUST NOT draw any dashed outline (ring, square or other) on the Score. The waiting state
  MUST be shown by the cursor alone; skipped notes MUST be shown as a grey head with a small skip chevron below it; held-over notes MUST have a mark in the same
  notehead-based style that differs from green and red by shape as well as colour.
- **FR-010**: Correct, wrong (red disc), held-over and skipped MUST be distinguishable without colour vision. A
  correct note is the written notehead in green with no added shape; it is told apart from a wrong key by shape and
  position (a wrong key is an added disc where nothing of the practised event is written), from held-over and
  skipped by their own marks, and from a not-yet-played note by lying behind the cursor.
- **FR-011**: The on-screen keyboard feedback and the text hints for wrong octave, extra and held-over (002 FR-023,
  FR-039) MUST keep working unchanged alongside the new marks.
- **FR-012**: Green marks MUST be cleared when a new session starts; when a loop, repeat, volta or jump brings the
  session back into a passage, each note's mark MUST be cleared as the session reaches that note again.
- **FR-013**: The marks MUST follow their notes when the Score scrolls, turns page, zooms or reflows.
- **FR-014**: Switching the marks layer off MUST hide both the green and the red marks without affecting the session.
- **FR-015**: The marks MUST behave identically in the browser and in the desktop app, from the same build.
- **FR-016**: The same sequence of MIDI input events on the same Score MUST always produce the same green and red
  marks at every moment (reproducible, testable without a keyboard).
- **FR-017**: The live "correct so far" mark shown during a Play-mode run MUST use the same green-notehead style,
  without its dashed ring; the Grade marks shown after the run are unchanged.

### Key Entities

- **Pressed key**: a key currently held on the MIDI keyboard during a Practice session, with its pitch and whether
  it matches a written note of the current event.
- **Note mark**: the Practice state shown on a written note (by Note ID): printed, green (correct), held-over,
  skipped.
- **Pressed-key disc**: a red disc for a pressed key that is not written at the current event; it has a pitch,
  a staff, a column (the cursor's) and exists only while the key is held.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of trials on the reference fixtures, a correct key press turns its notehead green, and a wrong
  key press shows a red disc on exactly the staff position of the pitch pressed, within 50 ms of the key press.
- **SC-002**: In 100% of trials, releasing a wrong key removes its disc within 50 ms, and no disc is ever left on
  the Score for a key that is not held.
- **SC-003**: Across every library item and the real MusicXML fixtures, zero dashed outlines are drawn on the Score
  in Practice mode or during a Play-mode run.
- **SC-004**: A red disc never overlaps a written notehead in any reference fixture, including dense chords and
  two-voice staves.
- **SC-005**: In a greyscale rendering, a reviewer can tell correct, wrong, held-over and skipped notes apart for
  100% of the marks in the reference screenshots.
- **SC-006**: Replaying the same recorded input events on the same Score reproduces identical marks at every step.
- **SC-007**: A musician shown a red disc can name the key they are pressing from the Score alone (the disc's staff
  position and accidental) in 100% of the reference cases, including black keys and wrong octaves.

## Assumptions

- "Correct" in Practice means what it means today (002): the key pressed is one of the written notes of the current
  event of the practised hand(s). The matching rules themselves do not change; only how they are shown.
- The green is the colour-blind-safe bluish-green already used for "correct" (Okabe-Ito), and the red is the
  vermilion already used for wrong pitch, so both remain distinguishable for common colour-vision deficiencies.
- A red disc is a solid disc, slightly smaller than a written notehead (no stem, no flag), so it reads as "your
  key", not as a printed note (owner's reference picture, 2026-09-25).
- Green applies to the notehead's own shape: filled heads (quarter and shorter) become solid green, hollow heads
  (half and whole notes) become green outlines with the hollow kept. Stems, beams, fingering and lyrics stay black.
- Wrong keys are shown only while held (the user asked to show "which keys the user is pressing"); there is no
  lasting record of wrong keys on the Score in Practice mode (Play mode's Grade already provides that).
- Staff choice for a red disc on a grand staff: a key that matches a written note at the cursor goes on that note's
  staff; otherwise the practised hand's staff when one hand is practised (unless it would need more than 3 ledger
  lines and the other staff fewer); with both hands, the staff whose notes at the cursor are nearest in pitch, and
  when neither has notes there, the staff needing fewer ledger lines (ties: C4 and above on the upper staff). The
  staff is fixed when the key goes down and kept until it is released, so a held disc never jumps between staves.
- The disc is placed where the pitch is printed: octave-shift lines (8va/8vb) and octave clefs are taken into account.
- Spelling of a pressed key, first rule that applies: the spelling that pitch already has at the cursor or earlier in
  the bar on that staff; the key's own scale note; a white key as its natural; a black key as a sharp in C and sharp
  keys, a flat in flat keys (in a minor key, the raised 7th as its leading tone). No double sharps or flats.
- Practice gets a visible cursor of its own: a translucent band behind the current event's column (as in the owner's
  reference picture), replacing the dashed ring that is today the only sign of where the session waits.
- Dots and accidentals of a correct note stay black, like stems: only the notehead turns green.
- The on-screen keyboard keeps its current feedback; this feature adds the Score view, it does not remove the
  keyboard's.
- Both Shells (browser, Electron) are needed; the Native audio plugin is not involved.

## Out of Scope

- Changing what counts as correct, wrong or extra, or any Practice matching or timing rule.
- The Grade marks shown after a Play-mode run (crosses, rings, carets, diamonds).
- Showing pressed keys on the Score in Listen mode, or red discs for wrong keys during a Play-mode run.
- Colouring whole stems, beams or chords; only noteheads are marked.
- Recording wrong keys for later review in Practice mode.
