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
every expected note is marked on the Score as correct, wrong pitch, missed, early or late, extra keys are shown
where they were played, and a short summary says how the performance went overall. Selecting any marked note says
in plain words why it was marked that way ("late by 120 ms", "played E instead of F").

**Why this priority**: this *is* Play mode. Playing in time without the app waiting, and being told afterwards what
was right and what was not, is the whole point; everything else in this feature makes that result easier to act on.

**Independent Test**: open `musicxml/chords/c-major-scale-and-chords.musicxml`, press Start in Play mode, play the
piece (or feed a recorded performance through the fake MIDI input), and confirm the count-in and Metronome run, the
cursor moves on the clock without waiting, and at the end every expected note carries a result with a readable
reason.

**Acceptance Scenarios**:

1. **Given** a Score is open in Play mode, **When** the musician presses Start, **Then** a count-in of full measures
   is clicked first, with the downbeat accented, and nothing played during the count-in is graded.
2. **Given** a run is under way, **When** the musician plays nothing at all, **Then** the Score and the Metronome
   carry on to the end at the written tempo and every expected note is marked missed.
3. **Given** a run is under way, **When** the musician plays the right key close enough to the written moment,
   **Then** that note is marked correct.
4. **Given** a run is under way, **When** the musician plays the right key noticeably before or after the written
   moment, **Then** the note is marked early or late and the Grade says by how much.
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
13. **Given** a run is under way, **When** a key claims an expected note, **Then** that note is marked correct or
    wrong pitch straight away, while early, late, missed and extra appear only with the Grade at the end.

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
2. **Given** a Grade is on screen, **Then** an overview per measure shows how many notes were correct, wrong,
   missed or extra, so the worst passages are visible at a glance.
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
  have some notes correct and some late.
- **Repeats, endings and jumps**: every occurrence is graded separately, in the order Listen mode plays.
- **Grace notes and ornaments**: never graded; playing them is neutral, and not playing them costs nothing.
- **Hidden, playback-only, unpitched and percussion notes**: never graded, as in Practice mode.
- **Wrong octave, wrong hand, extra notes**: an unclaimed key press is extra; a right letter at the wrong octave is
  wrong pitch with the direction named.
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

## Requirements *(mandatory)*

### Functional Requirements

#### The run

- **FR-001**: The app MUST offer Play mode alongside Listen and Practice mode, switchable at any time, with the
  active mode always visible.
- **FR-002**: In Play mode the Score MUST advance on the audio clock at the selected tempo and MUST NEVER wait for
  the musician's input.
- **FR-003**: Every run MUST begin with a count-in of whole measures clicked by the Metronome, with the downbeat
  accented; the count-in length MUST be a named, configurable value, and nothing played during the count-in is
  graded.
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
  input outside Play mode, and MUST mark each expected note correct or wrong pitch as soon as a key claims it.
  Early, late, missed and extra MUST NOT be marked during the run; they appear with the Grade.
- **FR-011a**: The marking during the run is display only. The Grade MUST be computed from the Performance log
  after the run, and wherever it disagrees with a live mark, the Grade's result MUST replace it.

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
- **FR-018**: Every expected note MUST end the run with exactly one result: correct, wrong pitch (including wrong
  octave), missed, early or late. Every recorded key press that no expected note claims MUST be reported as extra.
- **FR-019**: A key press MUST be claimed by at most one expected note, and an expected note by at most one key
  press. Matching MUST prefer the same pitch at the nearest written moment within the claim window, and MUST NOT
  depend on the order in which simultaneous messages arrive.
- **FR-020**: Every timing threshold - the on-time window, the early and late windows, the window beyond which a
  note counts as missed, the claim window in which a key press may be matched, and the allowance for a spread
  chord - MUST be a named, documented, configurable value expressed as a fraction of a beat at the tempo actually
  played, bounded by a named minimum and a named maximum in milliseconds, so that slow and fast pieces are judged
  comparably while no window is ever tighter than human timing precision or wide enough to reach a neighbouring
  written note.
- **FR-021**: A note the Score ties or sustains from an earlier onset MUST be graded once, at that onset, and MUST
  NOT be expected again.
- **FR-022**: Each note of a chord MUST be graded on its own against the chord's written moment, within the chord
  spread allowance.
- **FR-023**: Note lengths, releases, velocity, dynamics and pedalling MUST NOT affect any result; the app MAY
  report them as information.
- **FR-024**: Keys the Score writes at a position without grading them - the unselected hand, another part, a grace
  note - MUST be marked played-along and MUST NEVER count as wrong or extra, exactly as in Practice mode.
- **FR-025**: Grading MUST be deterministic: the same Score, Performance log and settings MUST always produce an
  identical Grade, including every per-note reason.
- **FR-026**: Grading MUST NOT disturb the run: it works on the recorded log, and no part of it may block the screen
  or the audio while the musician is playing.
- **FR-027**: A stored Performance log MUST be gradable again with different strictness settings, producing a new
  Grade without altering the stored recording.

#### The Grade and its explanation

- **FR-028**: The Grade MUST summarise the run as two separate figures - how many of the expected notes were
  played correctly, and how accurately the notes that were played were timed - together with the plain counts of
  correct, wrong pitch, missed and extra notes, and the passage, tempo and strictness the run covered. No single
  combined score, level, star rating or pass mark is produced in this feature.
- **FR-029**: Every expected note MUST be marked on the Score with its result, distinguishable by shape or marking
  as well as by colour, and extra notes MUST be shown where they were played.
- **FR-030**: Every mark MUST be explainable in plain words on request, naming what was expected, what was played
  and by how much the timing was off (for example "late by 120 ms", "played E instead of F", "one octave too low").
- **FR-031**: The musician MUST be able to step forwards and backwards through the mistakes of a Grade, with the
  Score scrolling to each one.
- **FR-032**: The Grade MUST include a per-measure overview showing where the run went worst.
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
- **FR-039**: The musician MUST be able to choose the timing strictness from named levels; the default MUST be the
  most forgiving level, suitable for a beginner.
- **FR-040**: Run settings (range, tempo, part, hands, count-in, Metronome, strictness, accompaniment) MUST be
  remembered per Score on the device.

#### Keeping performances

- **FR-041**: Finished runs MUST be kept for their Score with their date, settings and summary, up to a stated
  limit, oldest dropped first.
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
- **Note result**: what happened to one expected note - correct, wrong pitch, missed, early or late - with the key
  press that claimed it, the timing difference, and the plain-words reason.
- **Extra note**: a recorded key press that no expected note claimed, with where in the Score it was played.
- **Strictness level**: a named set of timing windows (on-time, early, late, missed, claim window, chord spread)
  applied to a run.
- **Run settings**: range, tempo percentage, graded part, hand selection, count-in length, Metronome sound,
  accompaniment and strictness, remembered per Score.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Grading the same Performance log against the same Score with the same settings gives identical
  results, including every reason, in 100% of trials.
- **SC-002**: Every Metronome click sounds within 3 ms of its correct time, with no accumulated drift over a
  10-minute run, including across tempo and meter changes.
- **SC-003**: A synthetic performance played exactly on time is marked correct for 100% of its notes at every tempo
  from 40 to 208 beats per minute, and never early or late.
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
- **SC-015**: The pitch marks shown while playing agree with the Grade for 100% of the notes they cover; only
  timing results and extra notes are added afterwards.

## Assumptions

- Play mode judges **which notes and when**: pitch and timing. Note lengths, velocity, dynamics, pedalling and
  evenness are not graded in this feature.
- The performance is graded **after** the run, from the recorded Performance log, so grading can never disturb the
  timing of the run itself. What the musician sees while playing (keys, and correct or wrong pitch) is display
  only and is superseded by the Grade.
- Timing windows are relative to the beat with a millisecond floor and cap, so the strictness levels of FR-039 are
  sets of those fractions and bounds rather than raw millisecond numbers.
- Fairness rests on the Latency profile from feature 001: input and output latency are compensated before any
  timing is judged, and a Grade computed with an assumed rather than a measured latency says so.
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
