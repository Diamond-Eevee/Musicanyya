# Feature Specification: Guide Voice in Play Mode

**Feature Branch**: `020-play-guide-voice`
**Created**: 2026-10-02
**Status**: In progress
**Input**: User description: "if music xml etc doesn't have orchestra specified (Morning Mood track has orchestra
specified for example), in play mode the app should autoplay using some subtile rhodes instrument (or other sound that
will help user distinguish that is playing correctly, and won't cover piano sound too mucch). It should go to
"orchestra volume" so user can turn it off."

## Clarifications

### Session 2026-10-02

- Q: Which notes does the Guide voice play? -> A: Only the musician's own expected notes (the chosen part, hand and
  range), never the accompaniment, whether "Hear other parts" is on or off. FR-002.
- Owner request (after analyze): fix in this feature that a part's loudness and stereo position can carry over from the
  previously opened Score (found while planning the Guide voice, plan research R-10). FR-015, SC-009.

## Context

Feature 019 added the **Orchestra**: non-printed instrument tracks that sound with the piano. Only Scores that carry
such tracks have one (today *Morning Mood*); for every other Score the Orchestra level control is disabled with "This
score has no orchestra".

In Play mode the app moves on without waiting and plays only the accompaniment (the parts or hand the musician is not
playing, when "Hear other parts" is on). The notes the musician is asked to play are silent unless the musician plays
them. A musician therefore has no sound reference for their own part during a run: they cannot hear whether what they
play is the right pitch at the right time until the Grade arrives.

This feature adds the **Guide voice**: in Play mode, on a Score **without an Orchestra**, the app quietly plays the
musician's own expected notes with a soft, clearly different sound (an electric piano of the "Rhodes" kind). When the
musician plays correctly, their piano and the Guide voice sound together as one; a wrong pitch clashes and a late or
early note is heard as a doubled attack. The Guide voice is controlled by the existing Orchestra level, so the musician
can make it softer or switch it off there.

Terms used below:

- **Guide voice**: the soft, non-piano sound that plays the musician's expected notes during a Play run on a Score
  without an Orchestra. It is not a part of the Score, not printed, not graded.
- **Orchestra level** (019): the 0-100 % level of the Orchestra; on a Score without an Orchestra it now sets the level
  of the Guide voice.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hear my part softly during a Play run (Priority: P1)

A musician starts a Play run on a Score that has no Orchestra (a library exercise, a song, or their own MusicXML file).
Along with the Metronome and the accompaniment, the app quietly plays the notes the musician is expected to play, with a
soft electric-piano sound, in time with the cursor. Playing along, the musician hears at once whether their notes match.

**Why this priority**: it is the whole request: a sound reference that tells the musician, during the run, whether they
play correctly - without covering their own piano sound.

**Independent Test**: Open a library exercise without an Orchestra, choose Play mode, start a run and play nothing: the
expected notes are heard in a soft electric-piano sound, in time with the cursor and the Metronome. Play the right notes:
piano and Guide voice sound together and the piano stays clearly louder. Play a wrong note: the clash is audible. The
Grade is the same as without the Guide voice.

**Acceptance Scenarios**:

1. **Given** a Score without an Orchestra in Play mode, **When** a run starts, **Then** the Guide voice is silent during
   the count-in and plays every expected note of the run from the first beat, on the same clock as the Metronome and the
   cursor.
2. **Given** a Play run with the Guide voice, **When** the musician plays the expected notes at the expected time,
   **Then** the musician's piano sound is clearly louder than the Guide voice, and the Guide voice has a recognisably
   different (non-piano) sound.
3. **Given** a Play run, **When** the musician chose one hand, one part or a play range, **Then** the Guide voice plays
   exactly the notes the musician is expected to play in that choice - never the accompaniment (Clarifications
   2026-10-02).
4. **Given** a Play run with the Guide voice, **When** the run is graded, **Then** the Grade, the Performance log and the
   per-note marks are identical to the same input without the Guide voice; Guide voice notes are never input, never lit
   on the on-screen piano and never coloured on the score.
5. **Given** a Score **with** an Orchestra (e.g. *Morning Mood*), **When** a Play run starts, **Then** no Guide voice
   plays; the Orchestra plays as in feature 019.
6. **Given** Listen or Practice mode, **When** the Score plays, **Then** no Guide voice plays (Listen mode already plays
   the piano part; Practice mode waits for the musician).

---

### User Story 2 - Turn the Guide voice down or off with the Orchestra level (Priority: P1)

The musician who finds the Guide voice too loud, or who wants to play without help, moves the Orchestra level: the Guide
voice gets softer, down to silent at 0 %. The control is no longer disabled on Scores without an Orchestra; it tells the
musician that it sets the Guide voice there.

**Why this priority**: the Guide voice must never be forced on the musician; a test of the musician's own memory or a
noisy room needs it off. Without this story US1 would be a regression for anyone who does not want it.

**Independent Test**: On a Score without an Orchestra, in Play mode, move the Orchestra level from its default to 0 %
during a run: the Guide voice fades out at once, the piano, the accompaniment and the Metronome do not change, and the
cursor and timing do not change. Reload the app: the level is kept. Open *Morning Mood*: the same level applies to its
Orchestra.

**Acceptance Scenarios**:

1. **Given** a Score without an Orchestra, **When** the musician looks at the Orchestra level control, **Then** it is
   enabled, and its explanation says it sets the Guide voice on this Score (e.g. "No orchestra in this score: sets the
   guide voice in Play mode").
2. **Given** a Play run with the Guide voice, **When** the musician changes the Orchestra level, **Then** the Guide voice
   changes level at once, without a click, gap or retriggered note, and no other sound changes level.
3. **Given** the Orchestra level at 0 %, **When** a Play run plays, **Then** no Guide voice note is heard and everything
   else (piano, accompaniment, Metronome, cursor, Grade) behaves exactly as without the Guide voice.
4. **Given** the musician set the Orchestra level, **When** they restart the app or open another Score (with or without
   an Orchestra), **Then** the same remembered level applies - one level for the Orchestra and the Guide voice.
5. **Given** the main Volume is lowered, **When** the Guide voice plays, **Then** it follows the main Volume too (main
   Volume x Orchestra level), like the Orchestra.

---

### User Story 3 - Hear the Guide voice in the replay of a graded run (Priority: P3)

After a Play run, the musician replays it. The replay plays what they played together with the Guide voice at the
current Orchestra level, so they can hear where they left the expected notes.

**Why this priority**: useful for reviewing a run, but the Grade already shows each note's result; the run itself (US1)
is where the help matters most.

**Independent Test**: Grade a run with a few deliberate wrong notes, then replay it: the Guide voice plays the expected
notes, and the wrong notes are heard clashing with it; at Orchestra level 0 % the replay sounds as it does today.

**Acceptance Scenarios**:

1. **Given** a graded run on a Score without an Orchestra, **When** the musician replays it, **Then** the Guide voice
   plays the expected notes of that run's choice (hand, part, range, tempo) at the current Orchestra level, in time with
   the replayed input.

---

### Edge Cases

- **Count-in, start from a measure, play ranges and loops**: the Guide voice is silent during the count-in, starts with
  the run at the chosen measure, plays only inside the range, and no note that started before the start point is struck.
- **Tempo changes and the tempo setting**: the Guide voice follows the Score's tempo map and the musician's tempo
  setting exactly, like the Metronome and the accompaniment; it never drifts.
- **Stop, pause, mode switch, opening another Score**: every sounding Guide voice note stops at once; none rings into the
  next run or Score.
- **Chords, ties, grace notes, repeats/voltas, several voices on one staff**: the Guide voice plays each expected chord
  as one chord, a tied note once for its full tied length, grace notes as the Score plays them in Listen mode, and the
  repeats and voltas in the same order as the run.
- **Notes the musician is not asked to play (accompaniment)**: they keep sounding as accompaniment with the piano sound,
  following "Hear other parts" and the main Volume; the Guide voice never doubles them, and with "Hear other parts" off
  they stay silent (Clarifications 2026-10-02).
- **Wrong, extra or no input**: the Guide voice plays its notes regardless; it never reacts to input, never stops or
  waits, and never affects the Grade.
- **The musician's keyboard makes its own sound** (no app sound for input): the Guide voice still plays; nothing else
  changes.
- **MIDI keyboard unplugged mid-run**: the Guide voice carries on with the clock, like the accompaniment.
- **Audio device changes or disappears**: when sound comes back the Guide voice is at the current Orchestra level, never
  at full level by mistake.
- **Too many simultaneous voices**: the musician's own notes and the accompaniment are never dropped in favour of Guide
  voice notes; Guide voice notes give way first.
- **Malformed or unusual MusicXML** (no tempo, missing instrument data, odd parts): the Guide voice uses the same expected
  notes the Grade uses; if a Score can be graded it can be guided, and a problem never stops the run.
- **Very fast passages**: the Guide voice plays every expected note; no note is skipped or merged.
- **A Score opened after another one**: each part sounds at the loudness and stereo position its own Score gives it (or
  the standard ones when the Score gives none), never at what the previous Score set for the same sound channel
  (FR-015).
- **Score with an Orchestra whose Orchestra cannot be loaded** (all orchestral tracks skipped with a warning): the Score
  counts as having no Orchestra and gets the Guide voice.

## Requirements *(mandatory)*

### Functional Requirements

#### Guide voice

- **FR-001**: In Play mode, on a Score without an Orchestra (feature 019, FR-012), the app MUST play a Guide voice during
  every run.
- **FR-002**: The Guide voice MUST play the notes the musician is expected to play in the run, as chosen in the Play
  setup (part, hand, range), and only those - never the accompaniment, whether "Hear other parts" is on or off
  (Clarifications 2026-10-02) - with the Score's pitches, onsets and durations.
- **FR-003**: The Guide voice MUST use one soft, mellow, non-piano sound from the built-in sound, chosen so that it is
  clearly distinguishable from the piano and does not cover it (default: an electric piano of the "Rhodes" kind). The
  sound is a named, configurable setting of the app, not a user choice in this feature.
- **FR-004**: At the default Orchestra level, the Guide voice MUST sound clearly quieter than the piano playing the same
  notes (named, configurable relative loudness).
- **FR-005**: The Guide voice MUST be scheduled on the same audio clock and tempo map as the Metronome, the accompaniment
  and the cursor (Constitution II); it MUST be silent during the count-in and MUST follow start-from-measure, ranges,
  loops, tempo changes, the tempo setting, stop and Score changes as listed under Edge Cases.
- **FR-006**: Guide voice notes MUST NOT be input: they MUST NOT be recorded in the Performance log, graded, counted as
  extra, lit on the on-screen piano, coloured on the score, or anchored by Advice. The same Score + Performance log +
  settings MUST give the same Grade with the Guide voice at any level or absent.
- **FR-007**: The Guide voice MUST NOT play on a Score that has an Orchestra, and MUST NOT play in Listen or Practice
  mode.
- **FR-008**: The Guide voice MUST NOT take sound voices from the musician's own notes or the accompaniment: when the
  built-in sound runs out of voices, Guide voice notes give way first.
- **FR-009**: The replay of a graded run on a Score without an Orchestra MUST include the Guide voice for that run's
  choice, at the current Orchestra level (US3).

#### Orchestra level

- **FR-010**: On a Score without an Orchestra, the Orchestra level control MUST be enabled and MUST set the Guide voice
  level; its explanation MUST say so (replaces 019 FR-010's disabled state and "This score has no orchestra").
- **FR-011**: The Guide voice MUST follow the Orchestra level and the main Volume (main Volume x Orchestra level x the
  Guide voice's relative loudness), with the same rules as the Orchestra in 019 FR-004 and FR-005: effective at once,
  no clicks, gaps, timing shifts or retriggered notes, no other sound changes level.
- **FR-012**: At Orchestra level 0 % the Guide voice MUST be silent; switching it off needs no other setting.
- **FR-013**: There MUST be one remembered Orchestra level shared by the Orchestra and the Guide voice (019 FR-007); this
  feature adds no new stored setting.
- **FR-014**: The Guide voice MUST behave identically in the browser and in the desktop app, and MUST be honoured by
  every Audio engine the app offers.

#### Part loudness never carries over (owner request 2026-10-02)

- **FR-015**: Whenever a Score is played (Listen, Practice accompaniment, Play run, replay), every part MUST sound at the
  loudness and stereo position its own Score specifies, or at the standard defaults when the Score specifies none -
  never at a value left over from a previously played Score, run or Guide voice.

### Key Entities

- **Guide voice**: derived per Play run from the run's expected notes; has one sound (instrument) and a relative
  loudness; exists only while a run or its replay plays; never part of the Score's playable notes or the Performance log.
- **Orchestra level** (existing, 019): now also the level of the Guide voice on Scores without an Orchestra.
- **Score** (existing): "has an Orchestra" (019) decides whether a Play run gets the Orchestra or the Guide voice.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In an offline rendering of a Play run on a Score without an Orchestra, every Guide voice note onset is at
  the same audio-clock time (within 1 sample) as the expected note's scheduled time, at 50 %, 100 % and 150 % tempo,
  and no Guide voice note sounds during the count-in.
- **SC-002**: In an offline rendering at the default Orchestra level, the Guide voice playing an expected note is at
  least 6 dB quieter than the piano sound of the same note at the same velocity.
- **SC-003**: With the Orchestra level at 0 %, the rendered output of a Play run equals (to rounding) today's output
  without the Guide voice.
- **SC-004**: Grading the same Performance log with the Guide voice at 0 %, at the default level and at 100 % gives
  identical Grades, and no Grade or Performance log contains a Guide voice note.
- **SC-005**: On *Morning Mood* (a Score with an Orchestra), no Guide voice note is scheduled in any mode.
- **SC-006**: Changing the Orchestra level during a run is heard within 100 ms, and no audio dropout is counted while it
  is moved continuously for 10 seconds.
- **SC-007**: In a listening check on at least two library items without an Orchestra (one hands-together piece, one
  single-hand exercise), the owner hears the Guide voice as a distinct, soft sound that helps them tell right notes from
  wrong ones without covering the piano, and accepts the default level.
- **SC-008**: The Guide voice works in the browser and the desktop app in 100 % of the Play-mode end-to-end runs that
  cover it.
- **SC-009**: In an offline rendering, a Score whose parts specify no loudness or stereo position, played right after a
  Score that turned the same channels down and to one side, equals (to rounding) the same Score played first.

## Assumptions

- "Play mode" is meant literally: the Guide voice plays during Play runs (and their replay). Listen mode already plays
  the piano part; Practice mode waits for the musician, so a guide sounding before the musician plays would give the
  answer away and one sounding after would come too late. Both stay as today.
- "Autoplay" means the Guide voice starts with every run on its own; there is no extra on/off switch. The Orchestra level
  at 0 % is the off switch, as the request says ("It should go to orchestra volume so user can turn it off").
- One shared Orchestra level: a musician who silences the Orchestra also silences the Guide voice, and vice versa. The
  Guide voice's own relative loudness (FR-004) keeps it subtle at the same level at which the *Morning Mood* Orchestra
  is clearly audible.
- The sound is the electric piano ("Rhodes"-type) that the app's built-in sound already includes; no new sound asset or
  dependency is needed. If the listening check (SC-007) prefers another soft sound from the same bank
  (e.g. vibraphone or a soft pad), the named setting changes, not the spec.
- The Guide voice plays notes at the Score's own dynamics, scaled down by its relative loudness; it does not imitate the
  musician's touch.
- Scores from the musician's own files are treated like library items: no Orchestra means the Guide voice.

## Out of Scope

- A separate Guide voice level, an on/off switch, or a choice of Guide voice sound in the UI.
- A Guide voice in Listen or Practice mode.
- A Guide voice on Scores that have an Orchestra (also not as an addition to the Orchestra).
- Reacting to the musician's input (e.g. muting the Guide voice once the musician plays correctly, or playing it only on
  missed notes).
- The Native audio plugin's own implementation (it honours the Guide voice when it ships, FR-014).
