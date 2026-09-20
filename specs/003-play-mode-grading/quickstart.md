# Quickstart: Play Mode and Grading (feature 003)

## 1. Setup

Same toolchain as features 001 and 002 (Node.js 22 LTS or newer, pnpm, `pnpm install`); nothing new to install,
because this feature adds no runtime dependency.

For **manual** verification you need a MIDI keyboard: Play mode requires one (FR-010), and neither the on-screen
keyboard nor the computer keyboard can produce graded input. Automated tests need no hardware - they drive the
`MidiInput` port through `tests/fakes/fake-midi-access.ts` and feed recorded performances through
`tests/fakes/midi-sequence.ts`.

Play mode needs Web MIDI, so verify in Chrome or Edge (Firefox where it is enabled). Safari has no Web MIDI: the
expected result there is that Play mode reports itself unavailable with a reason, and Listen mode still works
(FR-045).

## 2. Develop, test, build

```bash
pnpm dev                        # Vite dev server -> http://localhost:5173
pnpm test -- tests/core/grade   # matching, windows and the golden Grades alone
pnpm test -- tests/core/play    # the run state machine and the schedule compiler
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e                   # Playwright, includes the fake-MIDI Play run
```

Desktop app (the shell takes a single-instance lock, so close a running window first):

```bash
pnpm electron:dev
```

## 3. Test scores

- `tests/fixtures/musicxml/chords/c-major-scale-and-chords.musicxml` - the spec's Independent Test for US1:
  single notes and chords, both hands.
- `tests/fixtures/musicxml/meter-change.musicxml` and `tempo-change-mid-measure-offset.musicxml` - the Metronome
  must follow both without drifting (SC-002).
- `tests/fixtures/musicxml/repeat-simple.musicxml`, `volta-1-2.musicxml`, `ds-al-coda.musicxml` - each occurrence
  graded separately, in Listen order (SC-005).
- `tests/fixtures/musicxml/tie-chain-three.musicxml`, `tie-across-barline.musicxml` - a tied note is expected once
  (FR-021).
- `tests/fixtures/musicxml/large-score.musicxml` - 500 measures for SC-006.

New fixtures this feature needs (from the domain review; each with its origin and licence in the fixtures
README):

| Fixture | What it pins |
|---|---|
| `window-beat-unit-6-8` | A "beat" is the dotted quarter in 6/8, not the eighth (data-model section 6) |
| `neighbour-clamp-sixteenths-160` | Claim windows meet at the midpoint and never reach a neighbour (SC-014) |
| `repeated-pitch-two-presses` | Two presses of one pitch claim the two written notes in order |
| `unison-two-voices` | Two same-pitch onsets a few milliseconds apart do not cross-match |
| `anacrusis-count-in` | The pickup falls on its own beat of the click (R-16) |
| `range-start-mid-measure-rests` | The count-in ends on the barline, not on the first note |
| `enharmonic-cs-db` and `transposing-part-sounding-pitch` | Matching is on sounding key, not on spelling |
| `first-note-early-into-count-in`, `last-note-late-past-end` | Recording outruns the run at both ends (R-16) |

A **recorded performance** for the deterministic tests is a JSON `PerformanceLog` beside the fixture it belongs
to, in `tests/fixtures/performances/`, with its Score id and the settings it was recorded with. Golden Grades are
Vitest snapshots; regenerate them deliberately with `pnpm test -- -u` and read the diff before committing.

## 4. Manual verification per user story

Use a MIDI keyboard for all of these. Open a Score, switch to **Play**, and press Start.

### US1 - play a piece and get a Grade (P1)

1. Start a run on `c-major-scale-and-chords.musicxml`. Expect one full measure of count-in with an accented
   downbeat, then the Metronome and the cursor moving on their own. Nothing you play during the count-in is
   graded.
2. Play nothing at all for the whole run. Expect the run to reach the end by itself and every note marked missed.
3. Play it again, accurately. Expect the notes to mark correct as you play them, and no timing marks until the
   Grade appears at the end.
4. Play deliberately late in measure 3 and deliberately early in measure 5. Expect those notes correct in pitch
   with late and early timing marks, and the Grade to name the millisecond difference.
5. Play a wrong key in measure 2 and the right letter one octave down in measure 6. Expect an extra mark plus a
   missed note in measure 2, and a wrong-pitch mark naming the octave in measure 6.
6. Select any marked note. Expect a plain-words reason.
7. Stop a run halfway. Expect a Grade marked incomplete covering only the notes up to the stop.

### US2 - understand the Grade (P2)

1. Step forwards and backwards through the mistakes. Expect the Score to scroll to each one with its reason.
2. Read the per-measure overview; the measures you spoiled in US1 should be the worst.
3. Choose "practise this passage" on one of them. Expect Practice mode with a loop over that range and the same
   part and hand selection.
4. Check that the Grade names the Latency profile and says it was assumed; run the offered calibration and confirm
   a new Grade says measured.
5. Switch the result layer off. Expect a plain Score with no marks hidden behind anything.

### US3 - set up the run (P3)

1. Set measures 5-8, 70% tempo, right hand only. Expect the count-in and Metronome at the reduced tempo, only
   measures 5-8 graded, only right-hand notes expected, and the left hand sounding as accompaniment.
2. Mute the Metronome. Expect the run and the Grade to be identical - only the click is silent.
3. Change the strictness to Strict and play the same passage. Expect more early/late marks and no change to the
   pitch results.
4. Reload the page. Expect the range, tempo, hand and strictness to come back for that Score.

### US4 - keep attempts and replay them (P4)

1. Play the piece twice. Expect both attempts listed with date, settings and summary.
2. Replay the first one. Expect to hear what you played, in your timing, against the Score with the cursor moving.
3. Re-grade it at a different strictness. Expect a new Grade and an unchanged recording.
4. Delete it. Expect it to disappear from the list.

## 5. What to check when something looks wrong

- **Timing looks shifted for every note**: the Latency profile is probably assumed. The Grade says so; measure it
  (FR-034) and re-grade the same stored attempt to compare.
- **The Metronome and the notes drift apart**: that is an RT bug, not a tuning question - `pnpm test --
  tests/engine/worklets` first, then the `rt-audio-reviewer` role.
- **A repeat is graded once instead of twice**: the expected notes are being built per measure instead of per
  pass; check `buildExpectedNotes` against `timeline.passes`.
- **The Grade takes too long on a long Score**: check that grading actually went through `grade.worker.ts` - a
  main-thread fallback is a bug (Constitution I).
