# Feature Specification: Play Mode and Grading

**Feature Branch**: `003-play-mode-grading`
**Created**: 2026-09-20
**Status**: Draft
**Input**: User description: "Play mode / grading"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Play a piece to the Metronome and get a Grade (Priority: P1)

The musician opens a Score, switches to **Play mode** and presses Start. A count-in is clicked, then the Metronome
keeps time and the cursor moves through the Score at the written tempo - it never waits. The musician plays along on
their MIDI keyboard as well as they can, right to the end. The moment the run is over, the app shows what happened:
every expected note is marked on the Score as correct, wrong pitch or missed, every note that was played also
carries whether it was on time, early or late, extra keys are shown where they were played, and a short summary
says how the performance went overall. Selecting any marked note says
in plain words why it was marked that way ("late by 120 ms", "one octave too low", "nothing played here").

**Why this priority**: this *is* Play mode. Playing in time without the app waiting, and being told afterwards what
was right and what was not, is the whole point; everything else in this feature makes that result easier to act on.

**Independent Test**: open `musicxml/chords/c-major-scale-and-chords.musicxml`, press Start in Play mode, play the
piece (or feed a recorded performance through the fake MIDI input), and confirm the count-in and Metronome run, the
cursor moves on the clock without waiting, and at the end every expected note carries a result with a readable
reason.

**Acceptance Scenarios**:

1. **Given** a Score is open in Play mode, **When** the musician presses Start, **Then** a count-in of full measures
   is clicked first, with the downbeat accented, and nothing played during the count-in is graded except a first
   note played inside its early claim window.
2. **Given** a run is under way, **When** the musician plays nothing at all, **Then** the Score and the Metronome
   carry on to the end at the written tempo and every expected note is marked missed.
3. **Given** a run is under way, **When** the musician plays the right key close enough to the written moment,
   **Then** that note is marked correct and on time.
4. **Given** a run is under way, **When** the musician plays the right key noticeably before or after the written
   moment, **Then** the note is still marked correct in pitch but its timing is marked early or late, and the
   Grade says by how much.
5. **Given** a run is under way, **When** the musician plays a key that no expected note can claim, **Then** it is
   marked extra at the point in the Score where it was played.
6. **Given** a run is under way, **When** the musician plays the right letter in the wrong octave, **Then** the note
   is marked wrong pitch and the reason names the octave.
7. **Given** the run reaches the end of the Score, **Then** it stops by itself, the Grade appears, and the Score
   stays on screen with every result marked on it.
8. **Given** a Grade is on screen, **When** the musician selects any marked note, **Then** the app states in plain
   words why it was marked that way, including how far off the timing was.
9. **Given** a Score with repeats, endings or jumps, **When** it is played, **Then** the notes are expected in
   exactly the order Listen mode plays them, and each occurrence of a repeated measure is graded separately.
10. **Given** a run is under way, **When** the musician stops it before the end, **Then** a partial Grade is shown
    that covers only the notes up to the stopping point and is clearly marked as incomplete.
11. **Given** a chord, **When** its keys are played slightly spread rather than exactly together, **Then** each note
    of the chord is graded on its own against the written moment.
12. **Given** a run is under way, **When** the musician plays a note, **Then** they hear it through the app's
    instrument sound, as they do in Listen and Practice mode.
13. **Given** a run is under way, **When** a key of the written pitch is played for an expected note, **Then** that
    note is marked correct straight away, while its timing result (on time, early or late) and the wrong-pitch,
    missed and extra results appear only with the Grade at the end.
14. **Given** a chord the Score writes as arpeggiated, or a note carrying a written ornament, **When** they are
    played as written, **Then** the chord is not marked late for being rolled and the presses that realise the
    ornament are played-along, never extra.

---

### User Story 2 - Understand the Grade and know what to practise (Priority: P2)

After the run the musician wants more than marks on a page. They step from mistake to mistake, see which measures
went worst, read what the app measured, and send the worst passage straight into Practice mode as a loop.

**Why this priority**: a Grade that cannot be acted on is a number, not a lesson, and the constitution requires
every Grade to be explainable. It builds on US1's results and can be tested on its own.

**Independent Test**: grade a recorded performance with known mistakes in measures 3 and 7, then step through the
mistakes, confirm the Score scrolls to each one with its reason, confirm the measure overview shows 3 and 7 as the
worst, and confirm "practise this passage" opens Practice mode looping those measures.

**Acceptance Scenarios**:

1. **Given** a Grade is on screen, **When** the musician asks for the next mistake, **Then** the Score scrolls to
   it, it is highlighted, and its reason is shown - repeatedly, forwards and backwards, through every mistake.
2. **Given** a Grade is on screen, **Then** an overview per measure shows how many notes were correct, wrong
   pitch, missed or extra and how many were early or late, so the worst passages are visible at a glance.
3. **Given** a Grade is on screen, **When** the musician chooses "practise this passage" on a measure or a selected
   range, **Then** Practice mode opens with a loop over that range and the same part and hand selection.
4. **Given** a Grade is on screen, **Then** the Latency profile used for it is shown; where that latency was never
   measured, the app says so and offers to measure it, because the timing results may otherwise be shifted.
5. **Given** a run in which audio dropouts occurred or MIDI messages were dropped, **Then** the Grade says so and
   marks the affected stretch as unreliable rather than reporting it as a clean result.
6. **Given** a Grade is on screen, **Then** every result state is distinguishable by shape or marking as well as by
   colour, and the result layer can be switched off to read the plain Score.
7. **Given** a Grade is on screen, **When** the musician starts a new run or changes mode, **Then** the previous
   marks are cleared from the Score.

---

### User Story 3 - Set up the run: passage, tempo, hands (Priority: P3)

The musician plays only the passage they are working on, at a tempo they can manage, with one hand or both, and
decides whether the other hand and the other parts sound along.

**Why this priority**: real practice is a passage at a reduced tempo, not the whole piece at concert speed. Play
mode is usable without it, so it comes after the Grade itself.

**Independent Test**: set a range of measures 5-8 at 70% tempo with "right hand only", run it, and confirm the
count-in and Metronome use the reduced tempo, only measures 5-8 are graded, and only right-hand notes are expected.

**Acceptance Scenarios**:

1. **Given** a measure range is set, **When** the run starts, **Then** it starts at that range with a count-in, ends
   at its last measure, and the Grade covers exactly the notes in it.
2. **Given** a tempo percentage is set, **Then** the Metronome, the accompaniment and the cursor all follow the
   reduced or raised tempo, and the timing of every note is judged against that tempo, not the written one.
3. **Given** "right hand only" is selected, **Then** only that hand's notes are expected and graded; the other hand
   sounds in time unless the musician silences it, and keys played for it are never marked wrong or extra.
4. **Given** a Score with several parts, **Then** the part that is graded is preselected and changeable exactly as
   in Practice mode, and the other parts sound as accompaniment.
5. **Given** the count-in length, the Metronome sound and the timing strictness are changed, **Then** the next run
   uses them, and the settings are remembered for that Score on this device.
6. **Given** the Metronome is muted, **Then** the run and the Grade are unchanged - only the click is silent.

---

### User Story 4 - Keep attempts and replay them (Priority: P4)

The musician plays the same piece again and again. The app keeps the recent attempts for that Score on the device
with their date, settings and result, lets them play a stored attempt back to hear exactly what they played against
the Score, and lets them delete what they no longer want.

**Why this priority**: hearing your own attempt is the fastest way to believe a mark, and seeing the last few
attempts shows whether the work is paying off. Everything else works without it.

**Independent Test**: play a piece twice, confirm both attempts are listed with date, settings and summary, replay
the first one and confirm the notes heard are the ones that were played, then delete it.

**Acceptance Scenarios**:

1. **Given** a run has finished, **Then** it is stored for that Score with its date, its settings and its summary,
   and it is listed among the recent attempts.
2. **Given** a stored attempt, **When** the musician replays it, **Then** the notes that were actually played are
   heard in their recorded timing against the Score, with the cursor moving and the marks visible.
3. **Given** a stored attempt, **When** it is graded again with the same settings, **Then** the result is identical
   to the one stored.
4. **Given** a stored attempt, **When** the musician changes the timing strictness and grades it again, **Then** a
   new Grade is shown and the stored recording is unchanged.
5. **Given** the musician deletes an attempt, **Then** it disappears from the list and its recording is removed from
   the device.
6. **Given** more attempts exist than the app keeps, **Then** the oldest are dropped, and the app says how many it
   keeps.

---

### Edge Cases

- **MIDI keyboard unplugged mid-run**: a non-blocking notice appears, the clock and the Metronome carry on (Play
  mode never waits), the notes that could not be received are marked missed, and the Grade says the keyboard was
  lost from that point. Replugging resumes recording within the same run.
- **No MIDI keyboard, or MIDI access refused**: Play mode explains why it cannot run and leaves Listen mode fully
  usable. The on-screen keyboard and the computer keyboard never stand in for a MIDI keyboard.
- **Audio device lost or sample rate changed mid-run**: the run stops with a notice, and the partial Grade is marked
  unreliable instead of reporting timings measured against a broken clock.
- **Latency never measured**: the run is allowed, the Grade shows the assumed Latency profile, and the app says the
  timing results may be shifted and offers to measure it.
- **Sustain pedal held down**: pedal messages are recorded but never create, satisfy or excuse an expected note.
- **Ties and long notes**: a tied or sustained note is expected once, at its onset; releasing it early or holding it
  past its written end changes no result.
- **Chords**: each note of a chord is graded on its own against the chord's written moment, so a rolled chord can
  have some notes on time and some late - unless the Score writes the chord as arpeggiated, where the wider
  written-arpeggio allowance applies (FR-022).
- **Repeats, endings and jumps**: every occurrence is graded separately, in the order Listen mode plays.
- **Grace notes and ornaments**: never graded; playing them is neutral, and not playing them costs nothing. The
  presses that realise a written ornament are played-along (FR-024), so a well-played trill produces no extra
  notes.
- **Hidden, playback-only, unpitched and percussion notes**: never graded, as in Practice mode.
- **Wrong octave, wrong hand, extra notes**: a right letter at the wrong octave is wrong pitch, with the direction
  to move named. Any other key the Score does not write there is extra, and the note it was meant for is missed -
  the app never guesses which written note a wrong letter was aiming at.
- **The musician drifts a whole beat or more**: a key press is only ever claimed by an expected note within the
  claim window, so drifting produces missed notes and extra notes rather than a stream of notes matched to the
  wrong neighbours.
- **The musician stops playing halfway**: the rest is marked missed and the Grade is still shown.
- **Tempo and meter changes, fermatas, ritardando**: the clock follows the Score's tempo map; a fermata is held for
  its written length, and the musician follows the app, not the other way round.
- **Unsupported or malformed MusicXML**: whatever Listen mode can play, Play mode can grade; anything the loader
  skipped is never expected and the existing load report still explains it.
- **Very fast passages and repeated pitches**: a repeated pitch must be pressed again to count; two presses of the
  same pitch inside one claim window claim the two written notes in order, not the same one twice.
- **Very long Scores**: a 500-measure run is graded and displayed without a noticeable pause.
- **Scrolling away during a run**: following stops until the musician presses Follow, exactly as in Listen mode; the
  run itself carries on.
- **Score with only unpitched or percussion parts**: the app reports that there is nothing to grade.

## Clarifications

### Session 2026-09-20

- Q: How much judgement is visible while the musician is still playing? -> A: Pitch live, timing afterwards. A
  note turns correct or wrong pitch the moment a key claims it; early, late, missed and extra appear only with the
  Grade. The live marking is display only - the Grade is computed from the Performance log and replaces it where
  the two disagree (FR-011, FR-011a).
- Q: Do the timing windows stay fixed in milliseconds at every tempo, or scale with the beat? -> A: They scale with
  the beat, bounded by a named millisecond floor and a named millisecond cap, so a slow piece and a fast one are
  judged comparably, no window is tighter than human timing precision, and no window can reach a neighbouring
  written note (FR-020, SC-014).
- Q: What does the Grade's summary report? -> A: Two figures - notes correct and timing accuracy - plus the plain
  counts of correct, wrong pitch, missed and extra. No single combined score, no stars, levels or pass marks in
  this feature (FR-028).
- Q: Is early/late a result in its own right, or a second axis beside pitch? -> A: Two axes. Every expected note
  carries a pitch result (correct, wrong pitch, missed); every note a key press claimed also carries a timing
  result (on time, early, late) with its signed difference. The two figures of FR-028 come from the two axes, and
  the counts stay correct, wrong pitch, missed and extra (FR-018, FR-029, FR-032).
- Q: When does a key press claim an expected note as wrong pitch rather than counting as extra? -> A: Only on an
  octave error. Matching runs in two passes over the claim window: same pitch first (correct), then same pitch
  class (wrong pitch). Anything left over is extra, and the expected note it was meant for is missed; the app never
  matches a wrong letter to a written note (FR-019, FR-030).
- Q: What exactly is the timing-accuracy figure of FR-028? -> A: The share of the notes that were played whose
  timing result is on time, stated as a count out of a total as well as a percentage, with the early and late
  counts beside it. Millisecond detail stays per note and per measure (FR-028, FR-030, FR-032).
- Q: Which timing strictness levels exist, and what is the default? -> A: Exactly three - Beginner (default,
  most forgiving), Standard and Strict - each a complete set of the FR-020 windows with its own fractions of a
  beat and millisecond bounds (FR-039).
- Q: What are the count-in default and the number of attempts kept? -> A: The count-in defaults to one full
  measure of the meter where the run starts, configurable but never less than one measure; the app keeps the 20
  most recent attempts per Score, oldest dropped first, and states the limit (FR-003, FR-041).

### Session 2026-09-20 (owner decisions after planning)

Four questions the plan raised (D-1 to D-4) were put to the owner, and all four were answered with the
recommendation:

- Q: Should a correctly played **ornament** (trill, mordent, turn, tremolo) cost the musician anything? -> A: No
  (D-1, accepted). Ornaments stay ungraded, and the presses that realise them are **played-along**: the
  ornamented note's own pitch and its diatonic neighbours, within its written duration, are never extra. This
  adds `<ornaments>`, `<trill-mark>`, `<mordent>`, `<turn>` and `<tremolo>` to the supported MusicXML subset
  (FR-024, SC-016).
- Q: How is a **written arpeggio** (`<arpeggiate>`) judged, when the Score itself asks for the chord to be
  rolled? -> A: With a named, wider spread allowance in place of the ordinary chord spread (D-2, accepted). This
  adds `<arpeggiate>` to the supported MusicXML subset (FR-022, SC-016).
- Q: Must the marks shown while playing agree with the Grade for **100%** of the notes they cover (SC-015)? -> A:
  No (D-3, softened). The live marker stays a cheap same-pitch test and may be overturned by the Grade, which
  always wins (FR-011, FR-011a); SC-015 becomes a measured agreement rate over the reference fixtures.
- Q: Does "nothing played during the count-in is graded" apply to a first note played slightly **early**? -> A:
  No (D-4, accepted). The exclusion is the count-in minus the first expected note's early claim window, so the
  commonest beginner tendency is judged early rather than missed (FR-003).

## Requirements *(mandatory)*

### Functional Requirements

#### The run

- **FR-001**: The app MUST offer Play mode alongside Listen and Practice mode, switchable at any time, with the
  active mode always visible.
- **FR-002**: In Play mode the Score MUST advance on the audio clock at the selected tempo and MUST NEVER wait for
  the musician's input.
- **FR-003**: Every run MUST begin with a count-in of whole measures clicked by the Metronome, with the downbeat
  accented. The count-in length MUST be a named, configurable value of at least one measure, defaulting to one
  full measure of the meter in force where the run starts; whole measures MUST be added to any count-in - the
  default or a chosen one - that would otherwise be shorter than a named minimum duration, because one fast
  measure establishes no pulse. Input played during the count-in MUST be recorded but MUST NOT be graded, except
  within the first expected note's early claim window (FR-020), so that a first note played slightly early is
  judged early rather than missed.
- **FR-004**: The Metronome MUST click for the whole run, following the Score's tempo map including tempo and meter
  changes, accenting the downbeat, and MUST stay in step with the notes the app sounds. Muting the Metronome MUST
  change nothing except the click being silent.
- **FR-005**: The app MUST NOT sound the notes the musician is being graded on; the other parts and the unselected
  hand MUST sound in time as accompaniment and MUST be silenceable.
- **FR-006**: Notes the musician plays MUST sound through the app's instrument, as they do in Listen and Practice
  mode.
- **FR-007**: The cursor MUST follow the run on the audio clock under the same Follow rules as Listen mode.
- **FR-008**: The musician MUST be able to stop a run at any time; stopping MUST produce a Grade covering exactly
  the expected notes up to the stopping point, clearly marked as incomplete.
- **FR-009**: Nothing MUST interrupt a run with a modal dialogue; problems appear as non-blocking notices.
- **FR-010**: Play mode MUST require a MIDI keyboard; the on-screen keyboard and the computer keyboard are display
  and help only and MUST NOT produce graded input.
- **FR-011**: During the run the app MUST show which keys are being played, within the same time budget as MIDI
  input outside Play mode, and MUST mark an expected note correct as soon as a key of the same pitch is played
  for it *(this clause superseded, see below)*. Wrong pitch, early, late, missed and extra MUST NOT be marked during the run; they appear with the
  Grade.
- **FR-011a**: The marking during the run is display only. The Grade MUST be computed from the Performance log
  after the run, and wherever it disagrees with a live mark, the Grade's result MUST replace it.
  *Superseded 2026-09-25 by feature 009's owner review (009 spec FR-027, research R-15): no note is marked during
  the run, correct ones included; every mark comes with the Grade. FR-011a and SC-015 therefore no longer apply.*

#### Recording the performance

- **FR-012**: Every MIDI input message received during a run MUST be recorded into a **Performance log** with its
  time on the audio clock, including note on, note off and pedal.
- **FR-013**: Input timestamps MUST be mapped onto the audio clock and compensated by the Latency profile before any
  timing is judged.
- **FR-014**: The Performance log MUST record everything needed to reproduce the Grade: which Score, the tempo used,
  the measure range, the part and hand selection, the timing strictness, the Latency profile, and the app version.
- **FR-015**: Input messages that had to be dropped, and audio dropouts during the run, MUST be counted and MUST
  appear on the Grade as a reliability warning for the stretch they affect.
- **FR-016**: Performance logs MUST stay on the musician's device; nothing is uploaded.

#### Grading

- **FR-017**: The expected notes MUST come from the same Score and the same playback order as Listen mode,
  including repeats, endings and jumps, and MUST exclude grace notes, ornaments, hidden or playback-only notes,
  unpitched and percussion notes, and the notes of parts and hands that are not being graded.
- **FR-018**: Every expected note MUST end the run with a result on two independent axes. The **pitch result**
  is exactly one of correct, wrong pitch (including wrong octave) or missed. A note whose pitch result is correct or
  wrong pitch - that is, one a key press claimed - MUST additionally carry a **timing result** of exactly one of on
  time, early or late, together with the signed timing difference; a missed note has no timing result. Every
  recorded key press that no expected note claims MUST be reported as extra, unless FR-024 marks it played-along.
- **FR-019**: A key press MUST be claimed by at most one expected note, and an expected note by at most one key
  press. Matching MUST run in two passes over the claim window and MUST NOT depend on the order in which
  simultaneous messages arrive:
  1. **Same pitch**: each expected note claims the unclaimed key press of the same pitch nearest to its written
     moment. These notes get the pitch result correct.
  2. **Same pitch class**: each still-unclaimed key press claims the nearest still-unclaimed expected note within
     the claim window whose pitch class it matches - an octave error. These notes get the pitch result wrong pitch.

  A key press left over after both passes is played-along where FR-024 covers it and extra otherwise, and an
  expected note left over is missed. A key press whose pitch class matches no expected note in its claim window
  MUST NEVER claim one: it is extra (or played-along), and the note the musician meant is missed.
- **FR-020**: Every timing threshold MUST be a named, documented, configurable value expressed as a fraction of a
  beat at the tempo actually played, bounded by a named minimum and a named maximum in milliseconds, so that slow
  and fast pieces are judged comparably while no window is ever tighter than human timing precision or wide enough
  to reach a neighbouring written note. The configured thresholds are the **on-time window** (each side), the
  **claim window** in which a key press may be matched, the allowance for a **spread chord** and the wider
  allowance for a **written arpeggio**. The early and late windows and the boundary beyond which a note counts as
  missed are not configured separately: they are the claim window and its complement, because a press that no note
  may claim is exactly what makes a note missed.
- **FR-021**: A note the Score ties or sustains from an earlier onset MUST be graded once, at that onset, and MUST
  NOT be expected again.
- **FR-022**: Each note of a chord MUST be graded on its own against the chord's written moment, within the chord
  spread allowance. Where the Score writes the chord as **arpeggiated**, the wider written-arpeggio allowance of
  FR-020 MUST be used instead, so that rolling a chord the Score asks to be rolled is not marked late.
- **FR-023**: Note lengths, releases, velocity, dynamics and pedalling MUST NOT affect any result; the app MAY
  report them as information.
- **FR-024**: Keys the Score writes at a position without grading them - the unselected hand, another part, a grace
  note - MUST be marked played-along and MUST NEVER count as wrong or extra, exactly as in Practice mode. The
  presses that realise an **ornament** (trill, mordent, turn, tremolo) MUST be treated the same way: the
  ornamented note's own pitch and its diatonic neighbours, within its written duration, are played-along, so that
  playing the ornament well costs nothing and leaving it out costs nothing.
- **FR-025**: Grading MUST be deterministic: the same Score, Performance log and settings MUST always produce an
  identical Grade, including every per-note reason.
- **FR-026**: Grading MUST NOT disturb the run: it works on the recorded log, and no part of it may block the screen
  or the audio while the musician is playing.
- **FR-027**: A stored Performance log MUST be gradable again with different strictness settings, producing a new
  Grade without altering the stored recording.

#### The Grade and its explanation

- **FR-028**: The Grade MUST summarise the run as two separate figures - the share of the expected notes whose
  pitch result is correct, and the share of the notes that were played whose timing result is on time - together
  with the plain counts of correct, wrong pitch, missed and extra notes, the counts of early and late, and the
  passage, tempo and strictness the run covered. Both figures MUST be stated as a count out of a total as well as
  a percentage ("38 of 44 notes on time"). No single combined score, level, star rating or pass mark is produced
  in this feature.
- **FR-029**: Every expected note MUST be marked on the Score with its pitch result and, where it was played,
  with its timing result, distinguishable by shape or marking as well as by colour, and extra notes MUST be shown
  where they were played.
- **FR-030**: Every mark MUST be explainable in plain words on request, naming what was expected, what was played
  and by how much the timing was off (for example "late by 120 ms", "F3 played, F4 written - one octave too low",
  "F4 written, nothing played here", "D4 played, no note written for it here").
- **FR-031**: The musician MUST be able to step forwards and backwards through the mistakes of a Grade, with the
  Score scrolling to each one.
- **FR-032**: The Grade MUST include a per-measure overview showing where the run went worst, counting the pitch
  results (correct, wrong pitch, missed) and the extra notes of each measure, and how many of its played notes were
  early or late.
- **FR-033**: The musician MUST be able to send a measure or a selected range from the Grade straight into Practice
  mode as a loop, keeping the same part and hand selection.
- **FR-034**: The Grade MUST show the Latency profile it was computed with, and MUST say plainly where that latency
  was assumed rather than measured, offering to measure it.
- **FR-035**: The result layer MUST be switchable off, MUST NOT hide the notes it refers to, and MUST be cleared
  when a new run starts or the mode changes.

#### Setting up a run

- **FR-036**: The musician MUST be able to play and be graded on a chosen range of measures as well as on the whole
  Score, with the count-in preceding the range.
- **FR-037**: The musician MUST be able to change the tempo as a percentage of the written tempo; the Metronome, the
  accompaniment, the cursor and the timing judgement MUST all use the tempo actually played.
- **FR-038**: The musician MUST be able to choose the graded part and the hand selection, with the same preselection
  and the same hand presets as Practice mode.
- **FR-039**: The musician MUST be able to choose the timing strictness from exactly three named levels -
  **Beginner**, **Standard** and **Strict**. Each level is a complete, documented set of the FR-020 windows
  (on-time, claim window, chord spread, written arpeggio) with its own fractions of a beat and millisecond
  bounds, and every level MUST respect the bounds of FR-020. Beginner MUST be the default and the most forgiving;
  Strict MUST be the tightest.
- **FR-040**: Run settings (range, tempo, part, hands, count-in, Metronome, strictness, accompaniment) MUST be
  remembered per Score on the device.

#### Keeping performances

- **FR-041**: Finished runs MUST be kept for their Score with their date, settings and summary, up to a named,
  documented limit of the 20 most recent per Score, oldest dropped first; the limit MUST be stated to the musician
  where the attempts are listed.
- **FR-042**: A stored performance MUST be replayable: the recorded notes are heard in their recorded timing against
  the Score, with the cursor moving and the marks visible.
- **FR-043**: The musician MUST be able to delete a stored performance, which removes its recording from the device.

#### Robustness and shells

- **FR-044**: Losing the MIDI keyboard mid-run MUST show a non-blocking notice, MUST NOT stop the clock, and MUST be
  recorded on the Grade; reconnecting MUST resume recording within the same run.
- **FR-045**: When Play mode cannot run (no MIDI keyboard, or MIDI access refused), the app MUST say why and keep
  the rest of the app usable.
- **FR-046**: Losing the audio device, or a sample-rate change mid-run, MUST stop the run with a notice and mark the
  partial Grade unreliable.
- **FR-047**: Play mode MUST behave identically in the browser and in the desktop app, from the same build.

### Key Entities

- **Play run**: one attempt at a Score or a range of it in Play mode - which Score, which range, tempo, part and
  hand selection, strictness, when it started, and whether it is counting in, running, stopped or finished.
- **Performance log**: the recorded MIDI input of a run on the audio clock, with the Latency profile and the
  settings used - everything needed to reproduce the Grade.
- **Grade**: the evaluation of one Performance log against one Score: the per-note results, the per-measure
  overview, the summary, and the reliability warnings that apply to it.
- **Note result**: what happened to one expected note - a pitch result (correct, wrong pitch, missed) and, for a
  note that was played, a timing result (on time, early, late) - with the key press that claimed it, the signed
  timing difference, and the plain-words reason.
- **Extra note**: a recorded key press that no expected note claimed and that is not played-along, with where in
  the Score it was played.
- **Played-along press**: a recorded key press the Score accounts for without grading it - the unselected hand,
  another part, a grace note, or the realisation of a written ornament. It is never wrong, never extra, and
  counts towards nothing (FR-024).
- **Strictness level**: one of Beginner (default), Standard or Strict - a named set of timing windows (on-time,
  claim window, chord spread, written arpeggio) applied to a run.
- **Run settings**: range, tempo percentage, graded part, hand selection, count-in length, Metronome sound,
  accompaniment and strictness, remembered per Score.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Grading the same Performance log against the same Score with the same settings gives identical
  results, including every reason, in 100% of trials.
- **SC-002**: Every Metronome click sounds within 3 ms of its correct time, with no accumulated drift over a
  10-minute run, including across tempo and meter changes.
- **SC-003**: A synthetic performance played exactly on time is marked correct and on time for 100% of its notes
  at every tempo from 40 to 208 beats per minute, and never early or late.
- **SC-004**: The timing difference the Grade reports for a synthetic performance is within 5 ms of the offset that
  was injected, once the Latency profile is compensated.
- **SC-005**: For 100% of the reference fixtures with repeats, endings, jumps, ties, chords and several voices, the
  expected notes and their order match what Listen mode plays.
- **SC-006**: The Grade of a 500-measure run appears within 1 second of the run ending, and the app stays responsive
  while it is produced - scrolling and every control keep reacting within 50 ms.
- **SC-007**: A 10-minute run completes with zero audio dropouts on the reference machine, no lost input messages,
  and every recorded message accounted for in the Grade.
- **SC-008**: 100% of marked notes offer a plain-words reason, and 100% of the result states are distinguishable in
  greyscale and by shape on a colour-blind-safe check.
- **SC-009**: A musician with a Score already open can start a run in at most two actions and under 10 seconds.
- **SC-010**: Stopping a run yields a Grade covering exactly the expected notes up to the stopping point - none
  missing and none from after the stop - in 100% of trials.
- **SC-011**: Re-grading a stored performance at a different strictness changes only the results, never the stored
  recording, verified by comparing the recording before and after.
- **SC-012**: 100% of the acceptance scenarios pass both in the browser and in the desktop app from the same build.
- **SC-013**: After unplugging and replugging the MIDI keyboard mid-run, recording resumes within 3 seconds, the run
  never stops, and the gap is reported on the Grade, in 100% of trials.
- **SC-014**: A performance whose notes all deviate by the same fraction of a beat receives the same results at 60
  and at 160 beats per minute; and across the reference fixtures no claim window ever reaches a neighbouring
  written note, at any tempo from 40 to 208 beats per minute.
- **SC-015**: Over the reference fixtures, the pitch marks shown while playing agree with the Grade for at least
  95% of the notes they cover, and every disagreement is a note the Grade re-assigned to a different key press.
  *No longer applies (009 owner review, 2026-09-25): no pitch marks are shown while playing (009 FR-027).*
  The Grade always wins (FR-011a); only timing results, wrong-pitch results and extra notes are added afterwards.
- **SC-016**: A performance that plays every written ornament and every written arpeggio correctly produces no
  extra notes and no late results from them, across the ornament and arpeggio fixtures.

## Assumptions

- Play mode judges **which notes and when**: pitch and timing. Note lengths, velocity, dynamics, pedalling and
  evenness are not graded in this feature.
- The performance is graded **after** the run, from the recorded Performance log, so grading can never disturb the
  timing of the run itself. What the musician sees while playing (keys, and correct or wrong pitch) is display
  only and is superseded by the Grade.
- Timing windows are relative to the beat with a millisecond floor and cap, so the strictness levels of FR-039 are
  sets of those fractions and bounds rather than raw millisecond numbers.
- Fairness rests on the Latency profile: input and output latency are compensated before any timing is judged,
  and a Grade computed with an assumed rather than a measured latency says so. Feature 001 provides only a
  reported output latency and an input estimate, so this feature builds the profile itself and the calibration
  FR-034 offers.
- The app does not sound the notes being graded. The musician's own playing is what is heard for the graded part;
  other parts and the unselected hand are accompaniment on the same clock as the Metronome.
- The graded part, the hand presets and hand attribution follow Practice mode exactly (the most keyboard-like part
  preselected and changeable; hands are presets over that part's staves).
- A MIDI keyboard is required, as in Practice mode. Velocity and aftertouch are recorded but not judged.
- The Metronome has one built-in click sound with an accented downbeat; choosing click sounds is a later concern.
- Tempo percentage applies to the whole run, not to a section of it, and the Grade records the tempo actually
  played.
- The written tempo drives the run: fermatas, ritardando and tempo changes come from the Score's tempo map, and the
  app does not follow the musician.
- Performances are kept on the device only, as recorded MIDI, never as audio; there are no accounts and no server.
- Reference machine, supported MusicXML range, browser and desktop targets, the built-in instrument sound, the
  cursor and Follow behaviour, and the on-screen keyboard are the same as in features 001 and 002.
- The Native audio plugin is not required: Play mode runs on the Web Audio engine, and the plugin later improves
  latency without changing any rule here.

## Out of Scope

- Progress across sessions: statistics, streaks, charts, "notes you always miss", goals and awards.
- A single combined score, stars, levels or a pass mark over the two figures of FR-028.
- Sharing, publishing or sending a Grade anywhere, teacher reporting, leaderboards and accounts.
- Grading dynamics, articulation, pedalling, note lengths, evenness or tone.
- Sight-reading drills, automatic tempo increase ("speed trainer") and rhythm tapping.
- Advice files beyond the fingering written in the MusicXML.
- Exporting a performance as an audio file or a MIDI file.
- The Native audio plugin, audio-device selection and audio backends.
- Changes to Listen and Practice mode beyond the hand-off in FR-033.
