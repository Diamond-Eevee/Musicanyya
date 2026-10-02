# Feature Specification: Live Piano and Audio Setup

**Feature Branch**: `021-live-piano-audio-setup`
**Created**: 2026-10-02
**Status**: In progress
**Input**: User description: "improvements: move midi keyboard to the topbar for easier access, run piano engine on the
program start, so users can play piano even without selecting music, Play/stop icons, instead of captions, for some
reason after clicking play, the piano doesnt play when I press keys, I need to click "play the track" for it to work.
Piano keys should always work, Latency and driver selection "dxx, wasapi, asio etc" is not working please fix."

## Clarifications

### Session 2026-10-02

- Q: Driver selection (DirectSound / WASAPI / ASIO) - build the Native audio plugin here, offer output-device choice for
  the built-in sound, or latency only? -> A: Keep it minimum. The browser cannot use ASIO. In the desktop app, offer
  WASAPI / DirectSound selection only if a ready library with a licence we may use connects easily; otherwise latency
  and output only. Finding: no such library exists for the app's built-in sound - choosing a Windows driver means moving
  the sound output and the piano itself into native code, which is the Native audio plugin (ADR-0003, a new runtime
  dependency and a large piece of work). The desktop app's built-in sound already plays through the standard Windows
  shared-mode output (WASAPI shared). So: US5 is output-device choice and an honest driver note; no driver selector, no
  latency-setting choice; the Native audio plugin stays a later feature. FR-024 to FR-026, SC-010, Out of Scope.

## Context

What the owner sees today, and why (checked in the current app before writing this spec):

- **The piano is silent until the first Play.** The Audio engine starts, and the piano sound loads, only when a Listen,
  Practice or Play run is started. Before that, MIDI key presses are drawn on the on-screen keyboard but make no sound,
  and with no Score open there is no way to make them sound at all.
- **In Play mode the keys are silent outside a run.** In Play mode only a running Play run sounds the musician's keys;
  after choosing Play mode, and between runs, pressing keys makes no sound until a run (or Listen) is started.
- **The MIDI keyboard is three clicks away.** Its connect button and device list sit in a popup under Setup > MIDI
  keyboard; the top bar shows nothing about whether a keyboard is connected.
- **The transport buttons are words** ("Play", "Pause", "Start", "Stop", "Skip Back", "Skip Forward").
- **Latency does not work.** Setup > Latency shows only "Your latency is shown here after a Play run" until a Play run
  has been graded. Its calibration plays no beat to tap along to, and a calibrated value, although stored, is never used
  by a Play run or its Grade.
- **There is no driver selection.** The app offers no choice of audio output device or of a low-latency Audio backend
  (ASIO, WASAPI, DirectSound and the like). Browsers and the desktop app's built-in sound cannot reach those drivers;
  only the planned **Native audio plugin** (ADR-0003: a separate low-latency program for ASIO, WASAPI, CoreAudio, ALSA,
  JACK) can, and it has not been built yet - the Environment panel reports it as "Not yet available".

Terms used below (constitution Domain Vocabulary): **Audio engine**, **Audio backend**, **Latency profile**, **Shell**
(browser or desktop app), **Listen / Practice / Play mode**, **Metronome**, **Performance log**, **Grade**. In addition:

- **Live piano**: the sound of the musician's own MIDI keyboard, played through the app's built-in piano sound.
- **Top bar**: the slim bar at the top of the window holding the mode switch, the transport, the Score size and the
  menus (feature 004).
- **Sound is locked**: the state, in a browser only, before the user has clicked or typed anywhere on the page; browsers
  do not allow a page to make sound before that.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The piano always plays (Priority: P1)

A musician opens the app, switches on their MIDI keyboard and plays - before choosing any music. They hear the piano.
They open a Score, switch between Listen, Practice and Play, start and stop runs, open and close popups: whatever the
app is doing, every key they press sounds, exactly once.

**Why this priority**: it is the bug the owner hit first, and the most basic promise of a piano app: a key that makes no
sound feels broken. It also makes the app usable as a plain practice piano.

**Independent Test**: Start the desktop app with a MIDI keyboard connected (or the fake MIDI keyboard in tests), open no
Score, press a key: it sounds. Open a Score, choose Play mode, press a key without starting a run: it sounds. Start and
stop a Play run, press a key: it sounds, once. In the browser, the first click anywhere on the page is enough to make the
keys sound.

**Acceptance Scenarios**:

1. **Given** the desktop app has just started and no Score is open, **When** the musician presses a key, **Then** the
   piano sounds as soon as the piano sound has loaded, with no click on Play or anywhere else needed.
2. **Given** the browser app has just opened and sound is locked, **When** the musician clicks or types anywhere on the
   page (opening the score browser, choosing a menu, any click), **Then** sound is unlocked and the next key press sounds;
   no Score and no Play is needed.
3. **Given** sound is still locked in the browser, **When** the musician presses a MIDI key, **Then** the key is shown
   on the on-screen keyboard and a non-modal hint in the top bar says that one click on the page turns the sound on.
4. **Given** Play mode is chosen and no run is going, **When** the musician presses keys, **Then** they sound (and are not
   recorded or graded).
5. **Given** a Play run is counting in or running, **When** the musician presses a key, **Then** it sounds exactly once
   and is recorded, as today.
6. **Given** Listen playback is running, Practice is waiting, a run has just ended, a popup (score browser, Grade, Setup)
   is open, or a Score is loading, **When** the musician presses a key, **Then** it sounds.
7. **Given** a key or the sustain pedal is held, **When** the musician switches mode, starts or stops a run, or opens
   another Score, **Then** the held note keeps sounding until released and no note is left hanging after release.
8. **Given** the piano sound is still loading at start-up, **When** the musician presses keys, **Then** they are shown
   on the on-screen keyboard, the top bar says the sound is loading, and keys sound from the moment it has loaded.

---

### User Story 2 - Latency that works (Priority: P2)

A musician opens Setup > Latency at any time. They see the latency of their setup straight away, can calibrate it by
playing along to a beat they hear, and from then on every Play run and its Grade use the calibrated value. They can go
back to the assumed value.

**Why this priority**: the owner reported it as broken. Fair grading depends on it (constitution II): with a wrong
latency, correctly timed notes are marked early or late.

**Independent Test**: With no Play run ever made, open Setup > Latency: the current output latency and the Latency
profile in use (assumed) are shown. Start calibration: a beat is heard, the musician plays along on the MIDI keyboard
(or taps a computer key), and a measured value is shown and kept after restarting the app. The next Play run's Grade
names the calibrated profile; replaying an older Performance log still gives its old Grade.

**Acceptance Scenarios**:

1. **Given** the app has just started and no Play run was made, **When** the musician opens Setup > Latency, **Then** it
   shows the sound output latency of the current setup (once sound is on) and the Latency profile in use, marked
   "assumed" or "calibrated", with the date of calibration.
2. **Given** the Latency popup is open, **When** the musician starts calibration, **Then** a count-in and an audible beat
   play on the audio clock, the musician plays along on any MIDI key (or taps the space bar without a keyboard), and
   progress is shown beat by beat.
3. **Given** calibration has collected enough consistent taps, **When** it ends, **Then** the measured value is shown,
   saved, survives a restart, and is used from then on by every new Play run and its Grade.
4. **Given** the taps were too uneven or too few, **When** calibration ends, **Then** the popup says why in plain words
   and the previous Latency profile stays in use.
5. **Given** a calibrated profile is in use, **When** the musician chooses "Use assumed latency", **Then** the assumed
   profile is used again for new runs.
6. **Given** an older Performance log graded with another Latency profile, **When** it is replayed or regraded, **Then**
   it is graded with the profile stored in that log, never with the new one.
7. **Given** calibration is running, **When** a Listen, Practice or Play run is started, **Then** calibration stops
   without saving and the run starts normally.

---

### User Story 3 - MIDI keyboard in the top bar (Priority: P3)

The top bar always shows the state of the MIDI keyboard: which one is connected, or that none is, or that it was
disconnected. One click on it opens its settings - connect, see the keyboards found - without going through a menu.

**Why this priority**: easier access requested by the owner; it also makes the cause of "no sound / no input" visible at
a glance. Valuable on its own, but the keys must sound first (US1).

**Independent Test**: Start the app with the fake MIDI keyboard: the top bar shows its name as connected, and the app
asked for MIDI access by itself. Unplug it: the top bar shows "disconnected" at once. Click the top-bar control: a small
popover lists the keyboards and offers to connect; Setup no longer has a MIDI keyboard entry.

**Acceptance Scenarios**:

1. **Given** the app starts, **When** the keyboard has not been connected yet, **Then** the top bar offers "Connect MIDI
   keyboard"; after the musician connects (one click in the popover), it shows the connected keyboard's name, or
   "No MIDI keyboard". (Owner decision 2026-10-03: MIDI access is requested by hand only, never at start-up.)
2. **Given** a keyboard is connected, **When** it is unplugged or plugged back in, **Then** the top-bar control shows
   the new state within a second, without reloading, and held notes are released on loss.
3. **Given** any state, **When** the musician clicks the top-bar MIDI control, **Then** a non-modal popover shows the
   keyboards found, their state, a button to connect or retry, and - where MIDI is unsupported or denied - what to do
   about it in plain words.
4. **Given** a run is active, **When** the musician looks at the top bar, **Then** the MIDI state is still shown and
   the popover can be opened without stopping the run or covering the Score's current system.
5. **Given** the Setup menu, **When** it is opened, **Then** it no longer has a "MIDI keyboard" entry; its other
   entries are unchanged.

---

### User Story 4 - Icon transport buttons (Priority: P4)

The transport buttons show the familiar media icons - play, pause, stop, start/stop practice, skip back, skip forward -
instead of words, so the top bar is shorter and easier to scan.

**Why this priority**: a visual improvement the owner asked for; no behaviour depends on it.

**Independent Test**: Open a Score in each mode: every transport button shows an icon, no caption; hovering or focusing
it shows its name and keyboard shortcut; a screen reader announces the same name as today; the play icon turns into
pause (Listen, Play) or stop (Practice) while running.

**Acceptance Scenarios**:

1. **Given** Listen mode, stopped, **When** the transport is shown, **Then** it shows a play icon and a stop icon, no
   words; while playing, the play icon becomes a pause icon.
2. **Given** Practice mode, **When** the transport is shown, **Then** the start button shows a play icon that becomes a
   stop icon while practising, and the skip buttons show skip-back and skip-forward icons.
3. **Given** any icon button, **When** it is hovered or focused, **Then** a tooltip shows its name (and its keyboard
   shortcut where it has one), and its accessible name is unchanged from today's caption.
4. **Given** a disabled button, the light or dark theme, or a larger Score size, **When** the transport is shown,
   **Then** the icons stay legible, the disabled state is visible by more than colour alone, and the click target is no
   smaller than today's button.

---

### User Story 5 - Choose the audio output (Priority: P5)

A musician opens the audio setup and chooses where the sound goes (speakers, headphones, an audio interface). For
low-latency drivers the app says plainly what is possible today and why.

**Why this priority**: the owner reported "driver selection (DirectSound, WASAPI, ASIO...)" as not working. Kept to the
minimum (Clarifications): the built-in sound can choose its output device; the drivers themselves are only reachable
through the Native audio plugin, a later feature, and the app says so instead of offering a choice that does nothing.

**Independent Test**: Open Setup > Latency in the desktop app: the output devices are listed; choose another one and the
piano and Listen playback sound there; the choice survives a restart. The popup names the sound output in use and says
that ASIO and other low-latency drivers need the Native audio plugin, not yet available.

**Acceptance Scenarios**:

1. **Given** the Shell allows choosing an output device, **When** the musician picks one while no run is active,
   **Then** all app sound (live piano, Listen, Metronome, Orchestra, Guide voice) moves to it, the choice is saved, and
   the shown latency is updated.
2. **Given** the Shell does not allow it (some browsers), **When** the audio setup is opened, **Then** it says that the
   system's default output is used and that it is changed in the system's sound settings.
3. **Given** the chosen output device disappears (headphones unplugged), **When** it is lost, **Then** sound continues on
   the system default within two seconds, a notice says so, and keys keep sounding.
4. **Given** any Shell, **When** the audio setup is shown, **Then** it names the sound output in use and says in one line
   that ASIO and other low-latency drivers need the Native audio plugin, not yet available - no driver selector is
   shown.

---

### Edge Cases

- **MIDI keyboard unplugged / replugged**: held notes are released, the top bar shows the state within a second, input
  and sound resume on reconnect without reloading (constitution V); a running Practice or Play run reports it as today.
- **Audio device lost or sample rate changed**: sound recovers on the default device without reloading; a run that was
  active is ended as today (audioLost), keys sound again afterwards.
- **Sound fails to load** (missing or corrupt sound file): a notice says so; keys are still shown on the on-screen
  keyboard; the rest of the app works.
- **Sound locked in the browser** and a MIDI key pressed: shown, not sounded, hint shown once per page load (not per key).
- **No Web MIDI** (Safari, Firefox without permission): the top-bar control says so and what works without it (view and
  Listen); the computer keyboard can still drive latency calibration.
- **Several MIDI keyboards**: all connected keyboards are heard and listed, as today.
- **Chords, fast passages, sustain pedal** outside any Score: every key sounds; the pedal holds notes; the built-in voice
  limit drops the oldest notes, never the newest.
- **Play mode count-in**: a key pressed during the count-in sounds once and is recorded (no double sound).
- **Mode switch or Score change with keys held**: no stuck notes, no cut-off notes the musician still holds.
- **Calibration**: no taps, too few, too uneven, or taps on the wrong beat - explained, previous profile kept; a run
  started meanwhile cancels it.
- **Malformed or unsupported MusicXML**: irrelevant to the live piano: keys keep sounding while the error is shown.
- **Very long sessions**: leaving the app open and idle for hours does not stop the live piano.

## Requirements *(mandatory)*

### Functional Requirements

**Live piano (US1)**

- **FR-001**: The desktop app MUST start the Audio engine and load the piano sound at program start, without any click,
  so that keys sound with no Score open.
- **FR-002**: The browser app MUST start the Audio engine and load the piano sound at start-up as far as the browser
  allows, and unlock sound on the user's first click or key press anywhere on the page - not only on Play.
- **FR-003**: While sound is locked (browser only), a MIDI key press MUST be shown on the on-screen keyboard and MUST
  bring up one non-modal top-bar hint that a click turns the sound on.
- **FR-004**: Every MIDI note-on, note-off and sustain-pedal message MUST sound through the live piano in every mode and
  state - no Score, Score loading, Listen stopped or playing, Practice idle or waiting, Play mode idle, counting in,
  running or finished, replay, any popup open - exactly once per message.
- **FR-005**: In Play mode outside a run, key presses MUST sound and MUST NOT be recorded in any Performance log.
- **FR-006**: Switching mode, starting or stopping a run, or opening another Score MUST NOT cut off a held key and MUST
  NOT leave a note sounding after its key and the pedal are released.
- **FR-007**: While the piano sound is loading, the top bar MUST say so; keys pressed in that time are shown but silent.
- **FR-008**: The live piano MUST keep today's key-press-to-sound latency (no added delay) and MUST NOT be delayed by
  screen updates (constitution I).

**Latency (US2)**

- **FR-009**: Setup > Latency MUST show, at any time and without a Play run, the current sound output latency (once
  sound is on) and the Latency profile in use, labelled "assumed" or "calibrated" with its date.
- **FR-010**: Calibration MUST play an audible count-in and beat on the audio clock and accept taps from any MIDI key,
  or from the space bar when no MIDI keyboard is connected; it MUST show progress per beat.
- **FR-011**: A successful calibration MUST be saved, kept across restarts, and used from then on by every new Play
  run and its Grade (Practice judges no timing; the cursor follows the reported output latency); its value MUST be
  stored in each new Performance log (constitution IV).
- **FR-012**: A failed calibration MUST say why (too few taps, too uneven) and keep the previous profile in use.
- **FR-013**: The musician MUST be able to go back to the assumed Latency profile.
- **FR-014**: Replaying or regrading a stored Performance log MUST use the Latency profile stored in that log.
- **FR-015**: Starting a Listen, Practice or Play run MUST stop a running calibration without saving it.

**MIDI keyboard in the top bar (US3)**

- **FR-016**: The top bar MUST always show the MIDI keyboard state: connected (with the keyboard's name; a count when
  several), no keyboard, disconnected, not supported, or permission denied - each distinguished by icon shape as well
  as colour (constitution VI).
- **FR-017**: The app MUST NOT ask for MIDI access by itself (owner decision 2026-10-03; it had been "at start-up"): the
  top-bar control offers "Connect MIDI keyboard" until the musician connects, and again after a refusal.
- **FR-018**: Clicking the top-bar MIDI control MUST open a non-modal popover with the keyboards found and their state,
  a connect / retry action, the live input latency where known, and plain-word help for "not supported" and "denied".
- **FR-019**: The top-bar MIDI state MUST update within one second of a keyboard being connected or disconnected,
  without reloading.
- **FR-020**: The "MIDI keyboard" entry MUST be removed from the Setup menu; the popover replaces it.

**Icon transport (US4)**

- **FR-021**: Every transport button (play, pause, stop, Practice start/stop, skip back, skip forward) MUST show an icon
  instead of a caption; the play icon MUST change to pause (Listen, Play) or stop (Practice) while running.
- **FR-022**: Each icon button MUST keep today's accessible name and MUST show it, with its keyboard shortcut where it
  has one, as a tooltip on hover and focus.
- **FR-023**: Icon buttons MUST be legible in light and dark themes, MUST NOT shrink the click target below today's, and
  MUST show the disabled state by more than colour alone.

**Audio output (US5)** - kept to the minimum (Clarifications).

- **FR-024**: Where the Shell allows it, the musician MUST be able to choose the audio output device in Setup > Latency
  while no run is active; all app sound MUST go there; the choice MUST be saved and restored at start-up, falling back
  to the system default with a notice if the device is missing.
- **FR-025**: When the chosen output device is lost, sound MUST continue on the system default within two seconds,
  with a notice, without reloading.
- **FR-026**: The audio setup MUST name the sound output in use and say that ASIO and other low-latency drivers need the
  Native audio plugin (not yet available); it MUST NOT show a driver selector or any choice that does nothing.

**General**

- **FR-027**: Nothing this feature adds (hints, popovers, notices) may be modal or cover the current system of the Score
  during an active run (constitution VI).
- **FR-028**: All of the above MUST work in the browser and in the desktop app (output choice where the Shell allows
  it); the desktop app MUST NOT need any extra install.

### Key Entities

- **Live piano state**: whether sound is locked, loading, ready or failed; drives the top-bar hint and the sound of keys.
- **MIDI keyboard state**: availability (supported, permission, requested), the keyboards found and their connection
  state; shown in the top bar.
- **Latency profile** (constitution): input, output and MIDI offsets; source "assumed" or "calibrated", with the date of
  calibration; one profile in use at a time; each Performance log keeps a copy of the one it used.
- **Audio output setting**: the chosen output device, or the system default; saved per installation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the desktop app, a key pressed 5 seconds after the window appears (piano sound already downloaded once)
  sounds, with no click made in the app, in 100 % of test runs.
- **SC-002**: In the browser, after one click anywhere on the page, the next key press sounds in 100 % of test runs, with
  no Score open and no Play pressed.
- **SC-003**: Across a scripted sequence covering every mode and state of FR-004 (at least 20 states), every key press
  sounds exactly once: 0 silent and 0 doubled key presses.
- **SC-004**: Key-press-to-sound latency of the live piano is no worse than before this feature (same measurement, same
  machine, within 2 ms).
- **SC-005**: Setup > Latency shows a latency value within 1 second of opening, on a fresh install with no Play run.
- **SC-006**: A calibration with taps exactly 30 ms late (fake MIDI keyboard) yields a profile within 5 ms of 30 ms; the
  next Play run's Grade with notes played 30 ms late marks them on time; regrading an older Performance log gives an
  identical Grade to before.
- **SC-007**: The top bar shows a MIDI keyboard being connected or disconnected within 1 second in 100 % of test runs.
- **SC-008**: Opening the MIDI keyboard settings takes 1 click from anywhere in the app (today 2 plus finding the menu).
- **SC-009**: Every transport button has no visible caption, an accessible name equal to today's, and a tooltip; the
  top bar is narrower than today at the default window size.
- **SC-010**: A chosen output device is used for all sound and is restored after a restart in 100 % of test runs on a
  Shell that allows the choice; the app offers 0 driver choices that cannot be used.

## Assumptions

- The desktop app may start sound without a click; browsers require one interaction first, which this feature cannot
  remove, only reduce to "any click anywhere".
- MIDI access is requested only when the musician asks for it (the top-bar control); a start-up request was tried and
  dropped on 2026-10-03 because it froze the Windows MIDI service on the owner's machine.
- All connected MIDI keyboards are listened to, as today; choosing one keyboard among several is not requested.
- Icons replace captions only on the transport buttons; other top-bar buttons (Levels, Follow, size, Open score, menus)
  keep their words.
- Calibration measures the musician's input offset by playing along to an audible beat (the method already in the core);
  measuring output latency with a microphone loop-back is not needed.
- The keys of the on-screen keyboard are shown pressed in every state, as today; only the sound changes.
- The output device is per installation (this browser profile or this desktop install), not per Score.
- The desktop app's built-in sound uses the operating system's standard shared output (WASAPI shared on Windows), as
  today; this feature does not change the path the sound takes.

## Out of Scope

- Making sound in a browser before the first user interaction (browsers forbid it).
- Recording or grading free playing outside a Play run.
- Choosing the instrument sound of the live piano, or splitting / layering keyboards.
- Icons for buttons other than the transport.
- Selecting an Audio backend (ASIO, WASAPI exclusive, DirectSound, ...) and the Native audio plugin that would make it
  possible (ADR-0003) - a later feature (Clarifications).
- A latency-setting choice (lowest latency / balanced / most stable) for the built-in sound; the lowest-latency setting
  stays in use, as today.
