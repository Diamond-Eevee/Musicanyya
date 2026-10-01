# Feature Specification: Metronome and Orchestra Volume, Morning Mood with Orchestra

**Feature Branch**: `019-metronome-orchestra-volume`
**Created**: 2026-10-01
**Status**: In progress
**Input**: User description: "add volume for metronome and orchestra (the acompanianent other instruments for some
tracks, that might make playing easier, or make it funnier). Add morning mood piano two hands track to library, and add
some orchestra into it (other tracks that won't be visible on score sheets), like for example strings and oboe (up to
you what fits there)."

## Clarifications

### Session 2026-10-01

- Q: Which piano version of *Morning Mood* goes into the library (Mutopia has no machine-readable copy)? -> A: Grieg's
  own 1888 piano arrangement of Op. 46 No. 1, encoded from a public-domain print (Internet Archive; download approved
  by the owner first) and checked bar by bar against it; its level follows the library's criteria.
- Q: Should Listen and Practice mode also get an optional Metronome click now? -> A: No. The Metronome stays a Play mode
  feature; the Metronome level applies to the Play count-in and run (the latency calibration panel plays no click
  today, so it is not affected - corrected by the plan step, 2026-10-01).

## Context

Today the toolbar has one **Volume** slider: it sets the level of everything the app plays. The Metronome (feature 009)
sounds only in Play mode (count-in and run) and can only be muted ("Mute metronome click" in the Play setup); its level
cannot be changed, so a musician who finds the click too loud or too soft against the piano can only switch it off.

"Accompaniment" already exists in Practice and Play mode: the app plays the hand or parts of the Score that the
musician is not playing. Those notes are printed on the score sheet. This feature adds a new kind of accompaniment, the
**Orchestra**: extra instrument tracks (for example strings, oboe, flute) that belong to a library item, sound together
with the piano, and are **never printed** on the score sheet, never expected from the musician and never graded. They
make a piece fuller and more fun to play along with, and a melody doubled by an orchestral instrument can make the piece
easier to follow.

The first library item with an Orchestra is Grieg's *Morning Mood* (*Morgenstemning*, Peer Gynt Suite No. 1, Op. 46
No. 1) for piano two hands. Grieg's original orchestration has the flute and oboe trading the opening melody over
sustained strings, so this feature uses that colour: **flute and oboe** answering the melody, a **string section**
holding the harmony, and (optionally, at the climax) **horns**.

Terms used below:

- **Orchestra**: the set of a Score's non-printed instrument tracks, played by the app only.
- **Orchestra level**: how loud the Orchestra sounds, 0-100 %, on top of the main Volume.
- **Metronome level**: how loud the Metronome click sounds, 0-100 %, on top of the main Volume.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Set the Metronome level (Priority: P1)

The musician can make the Metronome click louder or softer instead of only switching it on or off. The level is set
next to the main Volume, can be changed while a run is playing, and is remembered the next time the app starts.

**Why this priority**: the click is the one sound every Play run has; when it drowns the piano or disappears under it,
the musician cannot practise in time. It works for every Score, with or without an Orchestra.

**Independent Test**: In Play mode on any library item, start a run, move the Metronome level from 100 % to 30 % during
the count-in and again during the run: the click gets quieter immediately, the piano and the accompaniment do not
change, the timing of the click does not change; reload the app: the level is still 30 %.

**Acceptance Scenarios**:

1. **Given** a Play run with the Metronome on, **When** the musician lowers the Metronome level, **Then** the next click
   (count-in or run) is quieter by the chosen amount, and no other sound changes level.
2. **Given** the Metronome level at 0 %, **When** a run starts, **Then** no click is heard, the count-in still lasts
   its measures and the cursor still moves as with an audible click.
3. **Given** the Metronome muted with "Mute metronome click", **When** the musician moves the Metronome level, **Then**
   the click stays silent, and un-muting it later plays it at the newly chosen level.
4. **Given** the musician set the Metronome level and closes the app, **When** they open it again (browser or desktop
   app), **Then** the Metronome level is the one they left.
5. **Given** the main Volume is lowered, **When** the Metronome clicks, **Then** the click follows the main Volume too
   (main Volume x Metronome level).

---

### User Story 2 - Play Morning Mood with an Orchestra (Priority: P1)

The library has *Morning Mood* for piano two hands. When the musician listens to it, practises it or plays it, the app
adds an Orchestra (flute and oboe answering the melody, strings holding the harmony) that is heard but not printed. The
score sheet shows only the two piano staves.

**Why this priority**: it is the piece the owner asked for and the first place where the Orchestra can be heard; the
Orchestra level (US3) has nothing to control without it.

**Independent Test**: Open *Morning Mood* from the library browser: the score sheet shows two piano staves only. Press
Play in Listen mode: piano, flute/oboe and strings are heard together, in time with the cursor, through the whole
piece. In Practice and Play mode the musician is asked to play only piano notes.

**Acceptance Scenarios**:

1. **Given** the library browser, **When** the musician looks in Repertoire, **Then** *Morning Mood* (Grieg) is listed
   in its level, with its composer and a mark that it has an Orchestra.
2. **Given** *Morning Mood* is open, **When** the score sheet is shown, **Then** only the piano's treble and bass staves
   are engraved; no orchestral staff, instrument name or extra system space appears.
3. **Given** Listen mode, **When** the musician presses Play, **Then** the piano part and the Orchestra sound together
   on one clock, each orchestral instrument with its own recognisable sound (flute, oboe, strings), and the cursor
   follows the piano notes.
4. **Given** Practice or Play mode, **When** the musician chooses what to play, **Then** only the piano (both hands, the
   right hand or the left hand) can be chosen; the Orchestra is never offered as a part to play.
5. **Given** a Play run, **When** it is graded, **Then** the Grade contains piano notes only; Orchestra notes are never
   marked missed, and the musician pressing a key at the same pitch as an Orchestra note is judged exactly as if the
   Orchestra were silent.
6. **Given** Practice mode (wait mode), **When** the musician reaches each piano note or chord, **Then** the Orchestra
   moves on with the musician's progress the same way the existing accompaniment does: it starts no new note while the
   app waits for input, and notes already sounding ring on as accompaniment notes do today.
7. **Given** the on-screen piano is shown, **When** the Orchestra plays, **Then** its notes are not lit on the on-screen
   piano; only piano notes are.

---

### User Story 3 - Set the Orchestra level (Priority: P2)

The musician can make the Orchestra louder (fuller, more fun) or softer (to hear their own playing), down to silent,
without changing the piano or the Metronome. The level is remembered.

**Why this priority**: the Orchestra already plays at a sensible default level with US2; the control makes it
adjustable to taste and to the musician's need.

**Independent Test**: On *Morning Mood* in Listen mode, move the Orchestra level from its default to 0 % and back while
playing: the Orchestra fades out and returns at once, the piano stays as loud as before; reload: the level is kept. On a
Score without an Orchestra the control says that this Score has no Orchestra.

**Acceptance Scenarios**:

1. **Given** a Score with an Orchestra is playing (any mode), **When** the musician changes the Orchestra level,
   **Then** every orchestral instrument changes level together, at once, without a click or gap, and the piano and the
   Metronome do not change.
2. **Given** the Orchestra level at 0 %, **When** the Score plays, **Then** no orchestral note is heard, and everything
   else (piano, cursor, Metronome, grading) behaves exactly as with the Orchestra audible.
3. **Given** a Score without an Orchestra, **When** the musician looks at the Orchestra level control, **Then** it is
   shown disabled with an explanation ("This score has no orchestra"), and the remembered level is not changed.
4. **Given** the musician set the Orchestra level, **When** they open another Score with an Orchestra, or restart the
   app, **Then** the same level applies.

---

### User Story 4 - Find pieces with an Orchestra (Priority: P3)

In the library browser the musician can see which items come with an Orchestra, so they can pick one for fun.

**Why this priority**: with one such item today it is a small convenience; it grows in value as more items get one.

**Independent Test**: In the library browser, *Morning Mood* shows an "with orchestra" mark and its detail lists the
instruments (piano; flute, oboe, strings); items without an Orchestra show no mark.

**Acceptance Scenarios**:

1. **Given** the library browser, **When** an item with an Orchestra is listed, **Then** it shows a mark (shape and text,
   not colour alone) saying it has an Orchestra, and its details name the orchestral instruments.

---

### Edge Cases

- **Start from a measure, loops and play ranges**: the Orchestra starts with the piano at the chosen measure, plays only
  inside the loop or range, and restarts with it; Orchestra notes that started before the start point are not struck.
- **Count-in**: the Orchestra is silent during the count-in and enters on the first beat with the piano.
- **Tempo changes and the tempo field**: the Orchestra follows every tempo change in the Score and the musician's tempo
  setting exactly like the piano; it never drifts from the piano or the Metronome.
- **Stop, pause, mode switch, opening another Score**: every sounding Orchestra note stops; nothing keeps ringing into
  the next Score.
- **Hands separately / accompaniment off**: the Orchestra plays whatever hand the musician chose and whether or not the
  existing accompaniment (the other piano hand) is on; only the Orchestra level silences it.
- **Wrong, extra or no input**: never affected by the Orchestra; Orchestra notes are not "expected" notes.
- **MIDI keyboard unplugged mid-run**: the Orchestra and Metronome carry on with the clock, as the piano accompaniment
  does today.
- **Audio device changes or disappears**: the levels are re-applied when sound comes back; a restored audio output
  never plays the Orchestra or the click at full level by mistake.
- **Moving a level very fast or many times**: no audible click, crackle or dropout; no note is cut or doubled.
- **Too many simultaneous voices** (piano + Orchestra): piano notes are never dropped in favour of Orchestra notes.
- **Malformed or unexpected Orchestra content in a file**: a track the app cannot use is skipped and reported; the
  piano part still opens, plays and grades.
- **Replay of a graded run**: the replay plays the Orchestra at the current Orchestra level, like the run itself.
- **Level 0 on both Metronome and Orchestra, main Volume up**: only the piano is heard; nothing reports an error.

## Requirements *(mandatory)*

### Functional Requirements

#### Levels

- **FR-001**: Users MUST be able to set a Metronome level from 0 % to 100 % in steps of at most 5 %.
- **FR-002**: Users MUST be able to set an Orchestra level from 0 % to 100 % in steps of at most 5 %.
- **FR-003**: Both level controls MUST be reachable from the main toolbar, next to (or together with) the main Volume, in
  every mode, with at most one click, and MUST be usable during an active Listen, Practice or Play session without
  stopping it and without anything modal (Constitution VI).
- **FR-004**: The sound each one controls MUST be its level multiplied by the main Volume; the main Volume keeps its
  meaning as the level of everything.
- **FR-005**: A level change MUST take effect on the very next sound of that kind (and on sustained Orchestra notes
  at once), without clicks, gaps, timing shifts or retriggered notes, and MUST change no other sound's level.
- **FR-006**: The Metronome level MUST apply wherever the Metronome sounds (today: the Play mode count-in and run). Muting the Metronome keeps working as today and is independent of the Metronome level: muted is silent
  at any level; un-muted plays at the level.
- **FR-007**: Both levels MUST be remembered per user across app restarts, in the browser and in the desktop app, like
  the main Volume, and MUST be the same for every Score.
- **FR-008**: Defaults: Metronome level 100 % (today's loudness, so nothing changes for existing users); Orchestra
  level at a default that keeps the Orchestra clearly quieter than the piano (named, configurable value).
- **FR-009**: Levels MUST NOT affect timing, the cursor, Practice behaviour, Grades or Performance logs beyond being
  recorded as a setting; the same Score + Performance log + settings MUST give the same Grade at any level.
- **FR-010**: When the open Score has no Orchestra, the Orchestra level control MUST be shown disabled with a short
  explanation; it MUST NOT be hidden in a way that moves the other toolbar controls.
- **FR-011**: Each level control MUST have an accessible name and show its value as a number (e.g. "Metronome 60 %").

#### Orchestra

- **FR-012**: A Score MAY contain an Orchestra: one or more instrument tracks marked as not printed. The app MUST play
  them and MUST NOT engrave them (no staff, no instrument name, no space reserved on the score sheet).
- **FR-013**: Orchestra notes MUST NOT be expected, waited for, graded, counted in progress, offered as a part or hand to
  play, anchored by Advice, coloured on the score or lit on the on-screen piano.
- **FR-014**: Each orchestral track MUST sound with its own instrument (e.g. flute, oboe, string ensemble, horn) from the
  built-in sound, not with the piano sound.
- **FR-015**: The Orchestra MUST be scheduled on the same clock and tempo map as the piano part and the Metronome
  (Constitution II): in Listen and Play mode it plays in time with the Score; in Practice mode it follows the
  musician's progress with the same rules as the existing accompaniment (its notes start when the musician reaches
  their onset; no new note starts while the app waits; sounding notes ring on as accompaniment notes do).
- **FR-016**: The Orchestra MUST play independently of the existing Accompaniment setting and of the hand selection;
  only the Orchestra level silences it.
- **FR-017**: The Orchestra MUST follow start-from-measure, loops, play ranges, count-in, tempo changes, the tempo
  setting, stop and Score changes as listed under Edge Cases.
- **FR-018**: Orchestra notes MUST NOT take sound voices from piano notes: when the built-in sound runs out of voices,
  Orchestra notes give way first.
- **FR-019**: The Orchestra MUST behave identically in the browser and in the desktop app, and MUST be honoured by every
  Audio engine the app offers.

#### Morning Mood in the library

- **FR-020**: The library MUST contain Grieg's *Morning Mood* (Peer Gynt Suite No. 1, Op. 46 No. 1) for piano two
  hands (treble and bass staff), in Repertoire, in the level that matches its difficulty under the library's existing
  level criteria. The piano part is Grieg's own piano arrangement of Op. 46 No. 1 (published 1888), encoded from a
  public-domain print and checked bar by bar against that print (Clarifications 2026-10-01).
- **FR-021**: The piano part MUST meet the library's standing rules: public domain, CC0 or written for this project
  only; recorded with its source and licence in the library sources and the third-party notices; every note checked against a
  named public-domain source, never accepted on review alone.
- **FR-022**: *Morning Mood* MUST have an Orchestra of flute and oboe (answering and doubling the melody, as in Grieg's
  orchestration), a string section (sustained harmony and bass) and optionally horns at the climax, arranged for this
  project after Grieg's public-domain orchestration. The Orchestra MUST fit the piano part: same length, same measures,
  same tempo marks, and no orchestral note that clashes with the piano's harmony at that moment.
- **FR-023**: Opening, playing, practising and grading *Morning Mood* MUST work like any other library item (Note IDs,
  progress, cursor, Grade) - the Orchestra adds sound only.
- **FR-024**: Library items with an Orchestra MUST be marked in the library browser by shape and text, and their details
  MUST name the orchestral instruments (US4).

### Key Entities

- **Orchestra**: the non-printed instrument tracks of a Score; each has an instrument (sound) and notes on the Score's
  timeline; belongs to exactly one Score; never part of the playable notes.
- **Orchestra level / Metronome level**: two user settings (0-100 %), stored with the main Volume and Follow, applied
  on top of the main Volume.
- **Library item** (existing): gains "has an Orchestra" and the list of orchestral instruments as information shown in
  the browser.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Changing the Metronome or Orchestra level during playback is heard within 100 ms, and in an offline
  rendering of a run the click onsets and all note onsets are at the same audio-clock times (within 1 sample) at
  levels 100 %, 50 % and 0 %.
- **SC-002**: In an offline rendering of *Morning Mood* with the Orchestra level at 0 %, the output equals (to rounding)
  the rendering of the piano part alone; with the Metronome level at 0 %, the output of a Play run equals the run with
  the Metronome muted.
- **SC-003**: Every Orchestra note onset of *Morning Mood* is at the same audio-clock time as the piano note it lines up
  with in the Score, in Listen and Play mode, at 50 %, 100 % and 150 % tempo.
- **SC-004**: The *Morning Mood* score sheet shows exactly two staves per system and the same number of systems as the
  piano part alone, at every zoom level.
- **SC-005**: Grading the same Performance log of *Morning Mood* at Orchestra levels 0 % and 100 % gives identical
  Grades, and no Grade of *Morning Mood* contains an Orchestra note.
- **SC-006**: 100 % of *Morning Mood*'s piano notes match the named public-domain print of Grieg's piano arrangement in
  the library fidelity check.
- **SC-007**: In a listening check, the owner recognises *Morning Mood*, hears the flute/oboe and the strings as
  separate instruments in time with the piano, and judges the default Orchestra level as supporting, not drowning, the
  piano.
- **SC-008**: Both levels survive an app restart in the browser and in the desktop app in 100 % of test runs.
- **SC-009**: No audio dropout is counted while either level is moved continuously for 10 seconds during playback.

## Assumptions

- "Orchestra" means extra instruments that are never printed, separate from the existing accompaniment (the other
  piano hand or the Score's other printed parts, which keep following the main Volume). One Orchestra level controls
  all orchestral instruments together; per-instrument levels are not needed now.
- The Metronome stays a Play mode feature (009 kept Listen and Practice without a click); its level applies where it
  sounds (Clarifications 2026-10-01).
- The Orchestra in Practice mode follows the musician like today's accompaniment; a sustained string chord rings on
  while the app waits, the same way accompaniment notes do today.
- Levels are a plain linear-feeling 0-100 % scale shown as a slider with its value, like the main Volume.
- The orchestral sounds come from the built-in SoundFont already bundled (it has flute, oboe, strings and horn); no new
  sound asset is needed.
- The Orchestra is a library feature in this release; *Morning Mood* is the only item that gets one now. More items
  can get an Orchestra later with the same mechanism.
- The Orchestra arrangement is our own work after Grieg's public-domain orchestration (Grieg died in 1907); its fit
  with the piano part is checked mechanically (length, measures, harmony) and by the owner's listening check, since
  an orchestral arrangement has no single "correct" source to compare note by note.
- Scores from the user's own files gain an Orchestra only if they already carry non-printed tracks the same way library
  items do; no special handling beyond FR-012/FR-013.

## Out of Scope

- A Metronome in Listen or Practice mode (Clarifications 2026-10-01), Metronome sound choice,
  subdivisions or a visual beat.
- Per-instrument levels, panning, reverb or a full mixer.
- Adding, editing, choosing or importing an Orchestra for a Score; showing the Orchestra as notation on demand.
- An Orchestra for library items other than *Morning Mood*.
- The Native audio plugin's own implementation (it honours the levels when it ships, FR-019).
