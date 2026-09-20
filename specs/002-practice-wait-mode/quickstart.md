# Quickstart: Practice Mode (feature 002)

## 1. Setup

Same toolchain as feature 001 (Node.js 22 LTS or newer, pnpm, `pnpm install`); nothing new to install, because this
feature adds no runtime dependency.

For **manual** verification you need a MIDI keyboard: Practice mode requires one (FR-033), and the on-screen
keyboard is display and help only. Automated tests need no hardware - they drive the `MidiInput` port through
`tests/fakes/fake-midi-access.ts`.

Practice mode needs Web MIDI, so verify in Chrome or Edge (Firefox where it is enabled). Safari has no Web MIDI: the
expected result there is that Practice reports itself unavailable with a reason, and Listen mode still works.

## 2. Develop, test, build

```bash
pnpm dev                          # Vite dev server -> http://localhost:5173
pnpm test -- tests/core/practice  # the matcher and expected-event tests alone
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e                     # Playwright, includes the fake-MIDI Practice run
```

Desktop app (the shell takes a single-instance lock, so close a running window first):

```bash
pnpm electron:dev
```

`pnpm electron:dev` builds the web bundle and the Electron bundle and then opens the window on the built files - it
is not a watch mode, so run it again after each change.

## 3. Test score

`musicxml/chords/c-major-scale-and-chords.musicxml` is the reference score for this feature, because it exercises
the two cases that matter most:

- **Section A** (measures 1-4): a whole-note or half-note left-hand chord *under* four moving right-hand quarters -
  the held chord must not be demanded again while the right hand moves on (FR-008).
- **Section B** (measures 5-8): the same with the hands swapped, so the same rule is checked in the other direction.

Also use from `tests/fixtures/musicxml/`: `repeat-simple` and `volta-1-2` (expected order follows the unrolled
timeline), `tie-across-barline` and `tie-chain-three` (tied notes are not re-demanded), `chord-basic` and
`tie-chord-partial` (chord rules), `grand-staff-two-voices-per-staff` (several voices per staff),
`grace-acciaccatura` (grace notes accepted but never waited for), `minimal-single-note` (single staff = one hand).

## 4. Manual verification

### US1 - Practise hands together, one note at a time

| # | Step | Expected |
|---|---|---|
| 1 | Open the C major exercise, switch to Practice, press Start | The first event (RH C4 + LH C3-E3-G3) is marked as waiting; nothing sounds by itself |
| 2 | Play C4 alone | Nothing advances; the keys held so far are shown as correct-so-far |
| 3 | Add C3, E3, G3 (in any order, slowly) | The event is marked correct and the cursor moves to the RH D4 |
| 4 | Keep the LH chord held; play D4 | It advances - the held chord is not demanded again |
| 5 | Play F#4 instead of E4 | The wrong key is marked wrong; the expected note stays waiting; the cursor does not move |
| 6 | Play E5 where E4 is expected | Marked wrong, and the feedback names the octave as the reason |
| 7 | Press and hold an extra key, then play the expected note | The extra key is marked extra; the expected note still advances |
| 8 | Play the same pitch twice in a row where the Score repeats it | The second one only counts after releasing and pressing again |
| 9 | Play to the last note | The session says the end was reached; marks stay on screen; no score or Grade appears |
| 9b | On a note you cannot play, use skip forward, then skip back | Forward marks it skipped and waits at the next event; back returns to it with its marks cleared, ready to be played |
| 10 | Switch to Listen and back | The session stops, marks are cleared, and the other mode starts from the same place |

With `tests/fixtures/musicxml/repeat-simple.musicxml` and `volta-1-2.musicxml`: the order of expected notes is the
order Listen plays, repeats and endings included.

### US2 - One hand, and starting anywhere

| # | Step | Expected |
|---|---|---|
| 1 | Select "right hand only" | Only upper-staff notes are expected |
| 2 | Play the right-hand part | The left-hand notes sound as the cursor passes them, and are never waited for |
| 3 | Switch the accompaniment off and repeat | The left hand is shown but silent |
| 3b | With "right hand only", play the left hand along as well | Those keys sound and are marked played-along - never wrong, never extra, and the help does not appear |
| 4 | Select "left hand only" in section B | Only lower-staff notes are expected |
| 5 | Click measure 5, then Start | The first expected note is the first note of measure 5 for the selected hand |
| 6 | Change the hand selection mid-session | The session restarts from the current measure with the new selection |
| 7 | Open `minimal-single-note.musicxml` | A single-staff Score counts as one hand; the selector reflects that |
| 8 | Open a Score with a voice part above the piano | The piano is preselected as the practised part, the part selector shows both, and choosing the other one restarts from the current measure |
| 9 | Click a measure inside a repeat, on the second time through | The session starts at the occurrence the cursor is in, not at the first one |

### US3 - Loop a section

| # | Step | Expected |
|---|---|---|
| 1 | Set a loop over measures 3-4 and practise to its end | The cursor returns to the first expected note of measure 3 and waits |
| 2 | Repeat twice | It loops again without stopping the session or clearing the marks |
| 3 | Set the range backwards (4 to 3) | The app corrects it to 3-4 |
| 4 | Clear the loop | Practice continues to the end of the Score |
| 5 | Set a loop inside `repeat-simple.musicxml` | The loop repeats the occurrence being played, and the Score marks which measures loop |

### US4 - Help when stuck

| # | Step | Expected |
|---|---|---|
| 1 | Play the wrong key three times on the same expected note | The expected key lights on the on-screen keyboard with its note name and the written fingering |
| 2 | Play the correct key | The help disappears and practice continues |
| 3 | Ask for help directly | The same help appears at once |
| 4 | Look at a note under the help | The help never covers the note it refers to |
| 5 | Switch help off | It stays off for the session |

### Cross-cutting

| # | Step | Expected |
|---|---|---|
| 1 | Unplug the MIDI keyboard mid-session | A non-blocking notice; the position is kept; held keys are released, not stuck |
| 2 | Plug it back in | Practice continues from the same expected note within 3 seconds, without restarting |
| 3 | Hold the sustain pedal and play | Pedalled notes do not satisfy or create expected notes |
| 4 | Open the app in Safari | Practice is reported unavailable with a reason; Listen still works |
| 5 | Run the same steps in the desktop app | Identical behaviour from the same build |
| 6 | Take a screenshot in greyscale | Waiting, correct, wrong, extra, played-along and skipped are still distinguishable by shape |
