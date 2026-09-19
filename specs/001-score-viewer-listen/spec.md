# Feature Specification: Score Viewing & Listen Mode (browser first, desktop shell ready)

**Feature Branch**: `001-score-viewer-listen`
**Created**: 2026-09-19
**Status**: Draft
**Input**: User description: "Score viewing and Listen mode in the browser. A musician opens a MusicXML score
(.musicxml, .xml or compressed .mxl) via a file picker or drag-and-drop and sees it engraved like a printed music
book; vertical scrolling, zoom 50-200%, recent scores remembered in the browser. Listen mode with realistic built-in
sound, tempo/meter changes, repeats, endings, D.C./D.S./Coda/Fine, moving cursor and highlighted sounding notes,
play/pause/stop, start from a clicked measure, tempo 25-200% without pitch change, volume. Unsupported notation is
skipped with a notice; broken files never crash the app. The browser version must be deployable online (standard
browser audio latency, MIDI keyboard input). The same app must also run as a minimal Electron desktop app, and the
app must detect whether it runs in the browser or in Electron. Focus on the web app; the low-latency plugin comes
later."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open and read a score (Priority: P1)

A musician opens the app in their browser, chooses a MusicXML file from their computer (with a file picker or by
dragging it onto the page) and sees the music engraved like a page of a printed music book: title, composer, part
names, staves, clefs, key and time signatures, notes, rests, accidentals, ties, slurs, beams, tuplets, grace notes,
dynamics, fingering written in the file, repeat signs, endings, tempo markings and measure numbers. They scroll
through the whole piece and zoom to read comfortably. Scores they opened before are listed and can be reopened with
one click, without picking the file again.

**Why this priority**: every mode (Listen, Practice, Play) starts with a correctly loaded, well-engraved Score. On its
own this is already a useful online score reader.

**Independent Test**: open every file of the reference fixture set in the browser; each supported one displays
completely and correctly, each malformed one shows a clear message while the app keeps working; reload the page and
reopen a score from the recent list.

**Acceptance Scenarios**:

1. **Given** the app is open, **When** the user picks a `.musicxml`, `.xml` or `.mxl` file, **Then** the Score is
   shown from its first measure with title, composer, part names and all notation listed above.
2. **Given** a Score is shown, **When** the user drags another MusicXML file onto the page, **Then** that Score
   replaces the current one.
3. **Given** a Score is shown, **When** the user zooms between 50% and 200% or resizes the window, **Then** the
   systems re-flow to the page width, the music stays sharp, and the measure that was in view stays in view.
4. **Given** a file with notation the app does not support, **When** it is opened, **Then** the Score still opens,
   the unsupported parts are skipped, and a non-blocking notice lists what was skipped and in which measures.
5. **Given** a Score is open, **When** the user opens a broken or non-MusicXML file, **Then** a clear error message
   appears and the previously open Score stays open.
6. **Given** the user opened scores before, **When** they return to the app later in the same browser, **Then** the
   last 10 scores are listed (newest first) and each one reopens with one click.
7. **Given** the user wants to know what is supported, **When** they open the help page, **Then** it lists the
   supported notation.

---

### User Story 2 - Listen to a score (Priority: P2)

The musician presses Play and hears the Score with a realistic built-in instrument sound: piano for piano parts, and
each other part with its own instrument. A cursor moves through the music and the notes that are sounding are
highlighted, in time with what is heard. The page follows the cursor. The musician can pause, resume, stop, start
from any measure by clicking it, slow the music down or speed it up without changing its pitch, and set the volume.

**Why this priority**: hearing the piece while following the notation is the first practice aid, and it proves the
timing foundation that Practice and Play modes will build on.

**Independent Test**: open the reference fixtures for tempo changes, repeats, endings, jumps and ties, press Play,
and confirm by ear and eye that playback, cursor and highlighting follow the notation; change tempo and volume during
playback.

**Acceptance Scenarios**:

1. **Given** a Score is open, **When** the user presses Play (or the Space key), **Then** sound starts at the start
   position, at the notated tempo, and a cursor and highlighted notes follow the sound.
2. **Given** playback is running, **When** the user presses Pause and later Play, **Then** playback resumes exactly
   where it paused; **When** the user presses Stop, **Then** sound stops and the cursor returns to where playback last
   started.
3. **Given** a Score is open, **When** the user clicks a measure (stopped or playing), **Then** playback starts or
   jumps to the beginning of that measure.
4. **Given** playback is running, **When** the user changes the tempo between 25% and 200% (5% steps), **Then** the
   speed changes smoothly, all tempo markings scale by the same percentage, and the pitch does not change.
5. **Given** a Score with repeats, first/second endings, D.C./D.S., Coda and Fine, **When** it plays, **Then**
   playback follows them as notated, and the cursor follows every jump.
6. **Given** notes tied across a barline, **When** they play, **Then** they sound as one sustained note.
7. **Given** a Score with several instruments, **When** it plays, **Then** each part sounds as its instrument;
   parts with no or an unknown instrument use piano, and a notice says so.
8. **Given** the instrument sound has not been loaded yet, **When** the user presses Play for the first time,
   **Then** loading progress is shown, and playback starts automatically when it is ready.
9. **Given** playback reaches the end, **Then** it stops and the cursor returns to where playback started.
10. **Given** the user scrolls away during playback, **Then** the page stops following until the user presses
    "Follow" or starts playback again.

---

### User Story 3 - Play a MIDI keyboard through the app (Priority: P3)

The musician connects a MIDI keyboard. The app recognises it, and every key they press is heard with the built-in
piano sound and shown on screen. They can play along while the Score plays. The app shows how long it takes from key
press to sound on this computer, so the musician knows what to expect from the browser.

**Why this priority**: MIDI input is the basis of Practice and Play modes; checking early that keyboards work in the
browser (and how fast) reduces risk for the next features. Viewing and listening work without it.

**Independent Test**: connect a MIDI keyboard to a computer with the app open in Chrome, allow MIDI access, play
notes and chords, unplug and replug the keyboard, and check the latency readout.

**Acceptance Scenarios**:

1. **Given** the app is open and a MIDI keyboard is connected, **When** the user allows MIDI access, **Then** the
   keyboard is listed by name and marked as active.
2. **Given** an active keyboard, **When** the user presses and releases keys (including chords and the sustain
   pedal), **Then** each note sounds with the built-in piano while held (or sustained) and the pressed keys are shown
   on an on-screen keyboard.
3. **Given** a Score is playing, **When** the user plays on the keyboard, **Then** their notes sound together with
   the playback without disturbing it.
4. **Given** an active keyboard, **When** it is unplugged, **Then** a non-blocking notice says so; **When** it is
   plugged in again, **Then** it is recognised again without reloading the page.
5. **Given** the browser has no MIDI support or the user denied access, **Then** the app explains why keyboards are
   not available and how to fix it, and everything else keeps working.
6. **Given** sound is running, **Then** the app shows the estimated time from key press to sound in milliseconds.

---

### User Story 4 - Same app online and on the desktop (Priority: P4)

The same version of the app can be put on an ordinary web host and used from its web address, and it also runs as a
desktop app window (Electron Shell) on Windows. The app knows where it runs and shows it, together with what is
available there: built-in sound, MIDI keyboard input, and the low-latency audio plugin (not available yet; it will
come to the desktop app in a later feature).

**Why this priority**: it proves early that one code base serves both delivery targets, so the later Electron and
low-latency plugin work does not require rework. Musicians get value from US1-US3 without it.

**Independent Test**: publish the build to a static web host and open it over HTTPS in Chrome; start the desktop
app on Windows; in both, open and play the same Score and compare the "About / environment" panel.

**Acceptance Scenarios**:

1. **Given** the app's files are put on a standard static web host, **When** a user opens the address in Chrome or
   Edge, **Then** US1-US3 work without any server-side software.
2. **Given** the desktop app is started on Windows, **Then** it shows the same app in its own window, and US1-US3
   work the same way (including opening files and MIDI input).
3. **Given** the app runs in either Shell, **When** the user opens the "About / environment" panel, **Then** it shows
   the Shell (browser with its name and version, or desktop app), and whether built-in sound, MIDI input and the
   low-latency audio plugin are available, with a short reason when something is not.
4. **Given** the desktop app is running, **Then** it cannot be used by web pages or files to run programs on the
   user's computer (it only shows the app itself).

---

### Edge Cases

- A very large Score (500+ measures, several parts): it opens, and scrolling and playback stay smooth.
- Multiple parts and staves, several voices per staff (piano grand staff with two voices per staff).
- Tempo and meter changes mid-piece, including mid-measure; a Score without a tempo marking.
- Pickup measure, chords, grace notes, tuplets, full-measure and multi-measure rests.
- Navigation markings combined with repeats and endings; clicking a measure inside a repeated section starts at its
  first pass.
- A compressed `.mxl` containing several files: the main score declared in the archive is used.
- Files with non-ASCII titles, part names or file names.
- A file that is huge, deeply nested or crafted to exhaust memory: it is rejected with a message, the app stays
  responsive.
- The user opens a new Score while one is playing: playback stops cleanly first.
- The browser tab is hidden or the computer is busy during playback: timing stays correct; if sound breaks up, it is
  counted and shown in diagnostics.
- The audio output device changes (e.g. headphones plugged in) during playback: sound continues on the new device or
  playback pauses with a notice; it never gets stuck.
- The browser blocks sound until the user interacts with the page: the first Play press starts sound without extra
  steps.
- The browser's storage is full or cleared: recent scores are missing or not saved, with a notice; nothing else
  breaks.
- MIDI: keyboard unplugged while keys are held (no stuck notes); several keyboards connected (all are used);
  permission denied; browser without MIDI support.
- The same Score is opened in two tabs: both work independently.

## Requirements *(mandatory)*

### Functional Requirements

**Opening and display**

- **FR-001**: Users MUST be able to open MusicXML files in uncompressed (`.musicxml`, `.xml`) and compressed (`.mxl`)
  form with a file picker and by drag-and-drop.
- **FR-002**: System MUST display the Score as engraved notation of printed-book quality, including title, composer,
  part names, clefs, key and time signatures, notes, rests, accidentals, ties, slurs, beams, tuplets, grace notes,
  chords, dynamics, fingering written in the file, multiple voices and staves, repeat signs, endings, tempo markings
  and measure numbers.
- **FR-003**: The score view MUST lay out systems to fit the window width and scroll vertically, re-flowing on resize
  and zoom; users MUST be able to zoom between at least 50% and 200%, and the notation MUST stay sharp at every zoom.
- **FR-004**: System MUST give every playable note a stable Note ID, so that the note highlighted is exactly the note
  being played (and, in later features, practised, graded and annotated with Advice).
- **FR-005**: When a file contains unsupported notation, System MUST open it anyway, skip what it cannot handle, and
  show a non-blocking notice listing the skipped elements with their measure numbers.
- **FR-006**: When a file cannot be read, is not MusicXML, or exceeds safe size limits, System MUST show a clear
  error and MUST NOT crash, hang, or lose the currently open Score.
- **FR-007**: System MUST remember the 10 most recently opened Scores in the user's browser (or desktop app) and let
  the user reopen any of them with one click, without choosing the file again, and remove entries from the list.
- **FR-008**: The supported notation subset MUST be documented and visible to users on a help page.

**Listen mode**

- **FR-009**: Users MUST be able to Play, Pause, Resume and Stop, with on-screen controls and keyboard shortcuts
  (at least Space = play/pause).
- **FR-010**: Users MUST be able to set the start position by clicking any measure, before or during playback.
- **FR-011**: Playback MUST follow tempo markings, tempo changes and meter changes; users MUST be able to scale the
  tempo between 25% and 200% in 5% steps during playback, without pitch change.
- **FR-012**: Playback MUST follow repeat signs, numbered endings, Da Capo, Dal Segno, To Coda / Coda and Fine as
  notated (by default, repeats are not taken again after a D.C./D.S. jump unless the Score says otherwise); tied notes
  MUST sound as one sustained note.
- **FR-013**: A cursor MUST show the current playback position and the sounding notes MUST be highlighted by colour
  and shape, in sync with what is heard (output latency compensated).
- **FR-014**: The view MUST follow the cursor during playback; manual scrolling suspends following until the user
  re-enables it or playback restarts.
- **FR-015**: System MUST produce realistic built-in instrument sound without external software or hardware; each
  part MUST sound as its General MIDI instrument; parts with no or an unrecognised instrument MUST use piano; the piano
  sound MUST be of good quality.
- **FR-016**: Users MUST be able to set the playback volume.
- **FR-017**: Loading the instrument sound MUST NOT delay displaying a Score; while it loads for the first time,
  progress MUST be shown; after the first time it MUST load from the user's device.

**MIDI keyboard**

- **FR-018**: System MUST detect connected MIDI keyboards (after the user grants access where the browser requires
  it), list them by name, and use all connected keyboards as input.
- **FR-019**: Notes, chords and the sustain pedal played on a keyboard MUST sound through the built-in piano and be
  shown on an on-screen keyboard; they MUST mix with Listen playback without disturbing it.
- **FR-020**: Keyboards connected or disconnected while the app is open MUST be recognised without reloading; a
  disconnect MUST never leave notes sounding.
- **FR-021**: When MIDI input is unavailable (unsupported browser, denied permission), System MUST explain why and
  how to fix it, without affecting viewing and listening.
- **FR-022**: System MUST show the estimated key-press-to-sound latency and the audio output latency in milliseconds.

**Shells (browser and desktop)**

- **FR-023**: The app MUST work as a set of static files served by any standard web host over HTTPS, with no
  server-side logic, in current Chrome and Edge (all features) and Firefox (all features where the browser allows MIDI
  access); in browsers without MIDI support (e.g. Safari), viewing and Listen mode MUST work, with an explanation that
  keyboards are not supported there.
- **FR-024**: The same app build MUST also run in a desktop app window (Electron Shell) on Windows, with the same
  behaviour for US1-US3, including opening files and MIDI input.
- **FR-025**: The app MUST detect at start whether it runs in a browser or in the desktop app, and which
  capabilities are available (built-in sound, MIDI input, low-latency audio plugin), and show this in an
  "About / environment" panel with reasons for anything unavailable.
- **FR-026**: Features that need the desktop app or the low-latency audio plugin MUST be hidden or shown as
  unavailable with a reason in the browser, never cause errors. (In this feature the plugin is always reported as
  "not available yet".)
- **FR-027**: The desktop app MUST only show the app itself: it MUST NOT let content from files or the web run
  programs or access the computer beyond what the browser version can.

**General**

- **FR-028**: Nothing modal may interrupt active playback; all notices are non-blocking.
- **FR-029**: Volume, tempo percentage, zoom and follow settings MUST be remembered between visits.
- **FR-030**: Scores and settings MUST stay on the user's device; nothing is uploaded.
- **FR-031**: Sound dropouts during playback MUST be counted and shown in a diagnostics area.

### Key Entities

- **Score**: a loaded musical work - title, composer, parts, measures, tempo and meter map, repeat and jump structure,
  and a load report of skipped/unsupported elements.
- **Part**: one instrument in the Score; name, staves, intended instrument sound.
- **Measure**: a numbered bar with its time signature, key and notes; the unit for "start from here".
- **Note**: a playable note with its Note ID, pitch, onset, duration, voice, staff, tie links and fingering.
- **Playback timeline**: the Score unrolled into the order it is actually played (repeats, endings and jumps
  expanded), with timing at the current tempo percentage.
- **Transport state**: stopped / playing / paused, current position, start position, tempo percentage, volume.
- **Recent score**: a previously opened Score kept on the user's device, with its title, file name and when it was
  last opened.
- **MIDI keyboard**: a connected MIDI input device with its name and connection state.
- **Environment**: the Shell the app runs in and the capabilities available there (built-in sound, MIDI input,
  low-latency audio plugin), with reasons for anything unavailable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Score of up to 200 measures is displayed within 3 seconds of choosing the file, and a 500-measure
  Score within 8 seconds, on the reference machine.
- **SC-002**: 100% of the reference fixtures declared supported open and display without errors; 100% of malformed
  fixtures produce an error message with zero crashes or hangs.
- **SC-003**: Every played note starts within 3 ms of its correct time as computed from the Score and tempo,
  including after tempo changes, repeats, jumps and tempo-percentage changes.
- **SC-004**: The cursor and highlighting are never more than 50 ms ahead of or behind the sound actually heard.
- **SC-005**: Once the instrument sound is loaded, sound starts within 150 ms of pressing Play; the first-ever load
  of the instrument sound completes within 15 seconds on a 25 Mbit/s connection.
- **SC-006**: A key pressed on a MIDI keyboard is shown on screen within 50 ms, and on the reference machine in Chrome
  the key-press-to-sound latency is at most 50 ms (the measured value is always displayed).
- **SC-007**: A 10-minute Score plays from start to end with zero sound dropouts in Chrome on the reference machine,
  also while the user scrolls and zooms.
- **SC-008**: 100% of the US1-US3 acceptance scenarios pass both on the published website and in the desktop app,
  from the same build.
- **SC-009**: After unplugging and replugging a MIDI keyboard, it works again within 3 seconds without reloading, in
  100% of trials, with no stuck notes.
- **SC-010**: A first-time user can open a Score and hear it playing within 30 seconds (instrument sound already
  cached) without instructions.

## Assumptions

- Reference machine: a mid-range Windows 10/11 desktop or laptop with current Chrome; performance criteria are
  measured there. Other browsers and operating systems are best effort.
- No user accounts and no server: everything (recent Scores, settings) stays in the user's browser or desktop app.
  Recent Scores keep a copy of the file content, because a website cannot reopen a file by its path.
- MusicXML 3.0-4.0 "partwise" files from common notation programs (MuseScore, Sibelius, Finale, Dorico) are the main
  input; "timewise" files are reported as unsupported with advice to re-export.
- A Score without a tempo marking plays at 100 quarter notes per minute, and this is shown.
- Grace notes are played briefly before the beat; ornaments such as trills are shown but not played.
- Dynamics (p, f, crescendo) affect playback volume where marked.
- The built-in instrument sound is one General MIDI sound set of roughly 30 MB, downloaded once on first playback
  and then kept on the device.
- Browsers only allow sound after a user action; the first Play (or key press after a click) starts it.
- Browser key-press-to-sound latency depends on the operating system and browser; professional low latency is the
  job of the later low-latency audio plugin in the desktop app.
- The desktop app in this feature is a development-ready build that runs on Windows; macOS and Linux desktop builds
  may work but are not verified yet.
- Only one Score is open at a time per window.

## Out of Scope

- Practice mode, Play mode, Grade, Performance logs and the Metronome (later features).
- Advice files (fingering and tips beyond what is written in the MusicXML).
- The low-latency audio plugin (ASIO, WASAPI, CoreAudio, ALSA, JACK) and choosing audio devices or buffer sizes.
- Signed installers, auto-update, app-store distribution, and verified macOS/Linux desktop builds.
- Offline installation of the website (working without internet after the first visit).
- MIDI output to external instruments; muting/soloing parts; per-part volume.
- Editing, transposing, printing or exporting Scores; importing formats other than MusicXML.
- Page view or horizontal single-line layout.
- Accounts, cloud storage, sharing.
