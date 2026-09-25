# Tasks: Play Mode Cursor, Audible Metronome and Practice-Style Grade Marks

**Input**: Design documents from `specs/009-play-cursor-metronome/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/play-display.md](contracts/play-display.md), [quickstart.md](quickstart.md)

<!--
  Format: `- [ ] T001 [P] [US1] Description with exact file path`
  States: `[ ]` open, `[~]` in progress with ` (claimed: <agent-id> <date>)`, `[x]` done (AGENTS.md section 4)
-->

**Real-time code is touched in one place**: the `score-player` worklet's message handler (T022). It is followed by an
`rt-audio-reviewer` task (T026). `process()` must stay unchanged; if any task ends up editing it, the scheduler or
MIDI input timing, add an RT review task next to it (Constitution I).

**Tests that change because the specified behaviour changed** (spec FR-016, FR-016a, FR-019): assertions on the
Grade's rings, crosses and diamonds (`tests/ui/grade-marks.test.ts`, `tests/e2e/us1-play.spec.ts`) and on Practice's
skip chevron shape (`tests/ui/pressed-keys.test.ts`). Each change is named in `implementation-log.md` with the FR that
changed it; every replaced assertion gets a new assertion for the new mark, and nothing is weakened.

---

## Phase 1: Setup

- [x] T001 [P] Add `MAX_SETUP_CONTROLLERS = 64` under "Audio worklet scheduling" in `src/core/defaults.ts`, and add it
  to the constants table of `specs/001-score-viewer-listen/data-model.md` (data-model section 5)
- [x] T002 [P] Add a hand-made fixture `tests/fixtures/musicxml/grade/grade-marks.musicxml` (own work, CC0, noted in
  `tests/fixtures/musicxml/README.md`): one piano part on a grand staff with a repeated measure, a three-note chord,
  a tie across a barline, an 8va passage, a whole-measure rest in the right hand, a grace note and a key signature
  with one sharp; it opens without notices (checked by T029's first test)

---

## Phase 2: Foundational (blocks all user stories)

- [x] T003 Unit tests for a new key step `sleep:<ms>` (wall-clock wait, 1-60000 ms) in `tests/tools/key-steps.test.ts`:
  parsed to `{ kind: 'sleep', ms }`, rejects `sleep:0`, `sleep:-5`, `sleep:abc` and `sleep:60001` with the step named in
  the error; existing steps unchanged. Run it and see it fail (unknown step)
- [x] T004 Implement `sleep:<ms>` in `tools/dev/key-steps.ts` and honour it in the e2e helper `pressKeys` in
  `tests/e2e/helpers/practice.ts` (a real wait between dispatches)
- [x] T005 Add the e2e helper `startPlay(page, itemId, { accompaniment?, tempoPercent?, range? })` in
  `tests/e2e/helpers/play.ts`: fake a granted MIDI device through the `e2e-midi` path, switch to Play, set the
  options through the Play panel, press Start; plus `waitForGrade(page)` (reused by T011, T036, T046)
- [x] T006 Add the dev-only options `--run` (Play mode, Start, then the `--keys` steps) and `--grade` (wait for the
  Grade before the picture) to `tools/dev/screenshot.ts`; document them in the file header, in `README.md` and in the
  toolchain section of `docs/agents/reference.md` (quickstart "Seeing it" already describes them)
- [x] T007 Verify T006: run `pnpm screenshot -- --item repertoire/beginner/fur-elise-theme-16-bar --run --keys
  "sleep:3500" --out tests/.generated/009/t007-before.png`, look at the picture (today: no cursor during the run) and
  record what it shows in `specs/009-play-cursor-metronome/implementation-log.md`

**Checkpoint**: a Play run can be driven and pictured without a MIDI keyboard; the "before" picture is logged.

---

## Phase 3: User Story 1 - See where the music is during a run (Priority: P1) MVP

**Goal**: Listen mode's cursor during a Play run: standing at the first note in the count-in, then moving with the
audible position, highlighting the notes due; gone when the run ends (FR-001 to FR-008).
**Independent Test**: open `repertoire/beginner/fur-elise-theme-16-bar`, choose Play, press Start and play nothing:
the cursor stands at the first note during the count-in, then moves note by note in time with the accompaniment and
the Metronome, looking like Listen mode's cursor, and it is gone when the Grade appears.

### Tests (write first, confirm they fail)

- [x] T008 [P] [US1] Record Listen's current cursor logic as a golden before moving it (contract section 1): copy the
  inline expressions of `updateCursor` in `src/ui/elements/mx-score-view.ts` (the `timeline.spans` filter and the
  `timeline.passes` find) verbatim into `tests/core/timeline/listen-cursor-reference.ts`; generate
  `tests/core/timeline/__snapshots__/listen-cursor.golden.json` (note IDs and pass index at every quarter of a beat)
  over `tests/fixtures/musicxml/grade/grade-marks.musicxml`, `chords/c-major-scale-and-chords.musicxml` and three
  files from `tests/fixtures/musicxml/real`. Then, in `tests/core/timeline/position.test.ts`, assert that `notesAtTick`
  and `passAtTick` from `src/core/timeline/position.ts` reproduce the golden exactly, plus the empty-passes case
  (null). Run it: fails (module missing)
- [x] T009 [P] [US1] Unit tests for `playCursorAt` in `tests/core/play/cursor.test.ts` (data-model section 1): null for
  a null run and for `idle`, `finished`, `stopped`, `aborted`; `countIn` -> `{ timelineTick: rangeStartTick, countIn:
  true }` whatever `positionRunTick` says; `running` maps with the PlayTickMap formula; a range starting at measure 5
  starts there; a position before the count-in end clamps to `rangeStartTick`; a late position past the end clamps
  to `rangeEndTick - 1`; `positionRunTick` is used with no extra offset (it is already the audible position, SC-001).
  Run it: fails (module missing)
- [x] T010 [P] [US1] Score-view unit tests in `tests/ui/score-view-play-cursor.test.ts` (happy-dom, the harness of
  `tests/ui/score-view.test.ts`, a recording canvas context): (a) `countIn`: a cursor bar is drawn at the first note's x
  and no note has `.playing`; (b) `running`: the notes at the tick, including a graded note the run does not sound, get
  `.playing` and the bar is at their x; (c) the run becomes `finished`, is stopped, or the mode is switched to Listen or
  Practice: `.playing` is removed and no bar is drawn in the next frame (FR-006); (d) `overlays.cursor` off: no bar,
  highlights and marks unchanged; (e) with a Grade on screen during a replay, the bar is drawn before the Grade marks
  (call order); (f) Listen still draws exactly as before (bar at the sounding note). Run it: (a)-(e) fail
- [x] T011 [P] [US1] E2E test `tests/e2e/play-cursor.spec.ts` with `startPlay` (T005) on
  `repertoire/beginner/fur-elise-theme-16-bar`, accompaniment on, nothing played: during the count-in no `.playing`
  note and `runPositionState` at the first measure; after the count-in the first note gets `.playing`, then later
  notes in order, and the view follows; with tempo 60 % and range 5-8 the first highlighted note is in measure 5;
  after the Grade no note has `.playing`; a correct key at the first note gives a green head whose computed notehead
  fill equals `--practice-correct-color` while it is highlighted (research R-05). Run it: fails (no `.playing` in Play)

### Implementation

- [x] T012 [US1] Create `src/core/timeline/position.ts` with `notesAtTick` and `passAtTick` (contract section 1),
  imported directly like the other core modules; T008 passes
- [x] T013 [US1] Create `src/core/play/cursor.ts` with `playCursorAt` (data-model section 1); T009 passes
- [x] T014 [US1] Make the Listen path of `updateCursor` in `src/ui/elements/mx-score-view.ts` use `notesAtTick` /
  `passAtTick` instead of the inline code (no behaviour change: T010 (f) and the existing Listen tests stay green)
- [x] T015 [US1] Draw the Play cursor in `src/ui/elements/mx-score-view.ts`: every frame, `playCursorAt(run)` ->
  `drawCursorOverlay` at the first note of `notesAtTick` (bar only during the count-in), `applyHighlights` when
  running, cleared when the position becomes null; canvas order clear -> cursor -> Grade marks; `followPlayCursor`
  reuses the same position; replay gets it through the same `PlayRun`. T010 and T011 pass
- [x] T016 [US1] Amend `specs/003-play-mode-grading/contracts/play-run.md` to 1.2.0 for the cursor (contract 5.2,
  first bullet's `playCursorAt` part and the cursor wording)
- [x] T017 [US1] Checkpoint: run the Independent Test with `pnpm screenshot -- --item
  repertoire/beginner/fur-elise-theme-16-bar --run --keys "sleep:3500" --out tests/.generated/009/t017-cursor.png`
  and look at it (bar and highlighted notes mid-run); run `pnpm test -- tests/core/timeline tests/core/play
  tests/ui`, `pnpm typecheck`, `pnpm lint`, the new e2e spec; log with summary lines; commit

**Checkpoint**: US1 works on its own: the Play run shows Listen's cursor.

---

## Phase 4: User Story 2 - Hear a real Metronome during a run (Priority: P1)

**Goal**: the click is a drum-kit wood block with an accented downbeat, in step with the run; mute survives runs
correctly; every part sounds as its General MIDI instrument (FR-009 to FR-013, research R-01 to R-03).
**Independent Test**: open `learning/chords/c-major-scale-and-chords`, choose Play, switch the accompaniment off and
press Start without playing: every beat of the count-in and the run is a click, not a piano note; the first beat of
every measure is accented; muting during the run silences only the click.

### Tests (write first, confirm they fail)

- [x] T018 [P] [US2] Guard test in `tests/core/schedule/setup-events.test.ts`: `compileSchedule` and
  `compilePlaySchedule` emit `programChange` and `controlChange` events only at tick 0, on every fixture under
  `tests/fixtures/musicxml` (incl. `real/`) and every library item. The design relies on this invariant (research
  R-01); it is expected to PASS on today's code - log it as a guard, not as a failing test
- [x] T056 [US2] Found by T018 (a Score without `<time>`, e.g. `tests/fixtures/musicxml/backup-forward-two-voices.musicxml`, has
  `nominalTicks: 0`): `compilePlaySchedule` never returns, because its count-in loop `while (secondsOf(measureCount *
  nominalTicks) < COUNT_IN_MIN_SECONDS)` cannot grow a zero-length measure, so Play on such a file would freeze the tab
  (Constitution III: a file must never hang the app). Test first in `tests/core/play/play-schedule.test.ts`: it terminates
  and counts in whole default 4/4 measures (the `beatTicksAt` / `beatsPerMeasure` default for no time signature) lasting
  at least `COUNT_IN_MIN_SECONDS`, downbeat on every fourth click; see it hang (run it under a timeout), then fix
  `src/core/schedule/play-schedule.ts` (`nominalTicks` falls back to `beatTicks * beatsInMeasure` when it is 0)
- [x] T057 [US2] Found by T020 (research B-9, R-14): `compilePlaySchedule` clicks only the count-in, not the run. Tests first in
  `tests/core/play/play-schedule.test.ts`, each with its own assertion: (a) 4/4, several measures: one click per beat of
  every pass on `METRONOME_CHANNEL` at `countInTicks + k * beat`, the first beat of each measure accented, the run's first
  click at run tick `countInTicks`; (b) `meter-change.musicxml`: each measure clicks in its own meter, 6/8 in dotted
  beats with two clicks per measure; (c) a pickup (`anacrusis-count-in.musicxml`): the run's first click (the pickup note's
  beat) is NOT accented and the next measure's first beat is; (d) a repeat (`repeat-simple.musicxml`): the repeated
  measure clicks again on its second pass, downbeat accented; (e) a range: only the range's passes are clicked, after the
  count-in; (f) `accompaniment: false` and `gradedNoteIds` do not remove clicks; (g) no click at or after the run's
  end tick; (h) count-in clicks unchanged. The two existing tests that count ALL Metronome events (the pickup test's
  "6 clicks", the 6/8 test) are narrowed to the count-in (`tick < tickMap.countInTicks`), named in the log as changed by
  the whole-run requirement (FR-009), nothing else weakened. Run them and see them fail
- [x] T058 [US2] Implement the run clicks in `src/core/schedule/play-schedule.ts` (research R-14); T057 passes, the rest of
  `tests/core/play` stays green; note the Play schedule wording in `specs/003-play-mode-grading/contracts/play-run.md` 1.2.0
  when T024 finishes it
- [x] T019 [P] [US2] Processor setup tests with a recording fake synth in
  `tests/engine/worklets/score-player.setup.test.ts`: (a) with the sound ready, a `schedule` whose `channelSetup` marks
  channel 14 percussion and channel 0 program 40 with bank 1, plus tick-0 CC7/CC10, calls, per used channel,
  `setDrums(isPercussion)`, bank select, `programChange`, then the controllers, all before the first `noteOn` is
  rendered; (b) a `schedule` before the sound is ready applies nothing until the processor is told the sound is
  ready, then applies it once; (c) a second `schedule` re-applies its own setup; (d) unused channels are not touched;
  (e) more than `MAX_SETUP_CONTROLLERS` tick-0 controllers: the first 64 applied, exactly one `status: error`, no
  throw; (f) `processBlock` never calls `programChange`, `setDrums` or `controllerChange` for kinds 2/3 (spy during
  rendering); (g) the compiled schedule of `tests/fixtures/musicxml/real/mozart-quartet-k387.mxl` applies each part's
  program (001 FR-015). Run it: fails (no setup applied)
- [x] T020 [P] [US2] Real-synth click test `tests/engine/metronome-click.test.ts` (pattern of
  `tests/engine/synth-onset.test.ts`, real `SpessaSynthProcessor` and `public/soundfonts/GeneralUser-GS-2.0.3.sf2`, 48
  kHz): compile the Play schedule, accompaniment off, of `learning/chords/c-major-scale-and-chords` at 100 %, of
  `tests/fixtures/musicxml/tempo-change-mid-measure-offset.musicxml` and `meter-change.musicxml` at 50 % and 150 %, of
  `anacrusis-count-in.musicxml` and of `repeat-simple.musicxml` (SC-002; where each click is scheduled stays proven
  by 003's `tests/core/play/play-schedule.test.ts`), render it
  through `createScorePlayerProcessor` with a synth port that maps `programChange` / `setDrums` to the real synth;
  assert: exactly one click per count-in and run beat; each click's first non-silent frame within 3 ms of its
  scheduled frame (SC-002); peak within `CLICK_ATTACK_MAX_MS = 10` ms; energy 300-500 ms after it below
  `CLICK_TAIL_MAX_RATIO = 0.01` of its first 50 ms; every downbeat peak above the beat peaks (research R-03); every
  beat click's peak at least the peak of a mezzo-forte piano note (C4, velocity 80) rendered the same way (FR-012).
  Run it: fails today (attack about 48 ms)
- [x] T021 [P] [US2] Test in `tests/engine/play-session.test.ts`: after a run started with `metronomeMuted: true`, a
  run started with `metronomeMuted: false` sets the Metronome channel volume to full (100 on the port's 0..100 scale, NOT 1: RT review finding) after loading its schedule; a muted
  start sets 0 (research R-02). Run it: the unmuted case fails

- [x] T053 [P] [US2] Golden fingerprint before the channel-setup change (analyze M6), in
  `tests/engine/listen-render-golden.test.ts`: render the first 10 s of the Listen schedule of
  `repertoire/beginner/ode-to-joy` through today's processor with the real synth, store the RMS of every 50 ms window in
  `tests/engine/__golden__/ode-to-joy-listen.json`, and assert the render matches it (tolerance 1e-6 per window). It
  records today's sound, so it passes now; it MUST be committed before T022 and stay green after it (piano Scores
  sound as before)

### Implementation

- [x] T022 [US2] Implement the channel setup in `src/engine/worklets/score-player.processor.ts` (data-model section 4,
  contract 5.1): pre-allocated `channelSetup` copy and tick-0 controller list filled in the `schedule` handler;
  `applyChannelSetup()` in the handler when the sound is ready; a `soundReady()` entry point on the factory that the
  AudioWorklet wrapper calls after `addSoundBank`; optional synth port methods `programChange` and `setDrums` mapped
  by the wrapper to `this.synth.programChange` and `this.synth.midiChannels[ch]?.setDrums`; `applyEvent` keeps
  ignoring kinds 2/3. T019 and T020 pass; `tests/engine/synth-onset.test.ts` and the other worklet tests stay green
- [x] T023 [US2] In `src/app/play-session.ts` `start()`, always call
  `setChannelVolume(METRONOME_CHANNEL, metronomeChannelVolume(muted))` (0 muted, 100 otherwise, `src/core/play/metronome.ts`) after `load` (research R-02), and the same call in the live mute handler of `src/app/session.ts`; T021 passes
- [x] T024 [US2] Amend `specs/001-score-viewer-listen/contracts/worklet-protocol.md` to 1.4.0 (contract 5.1) and
  finish `specs/003-play-mode-grading/contracts/play-run.md` 1.2.0 with the volume rule (contract 5.2)
- [x] T025 [US2] Check the side effect on real files: in Listen, compile and render the first 10 s of
  `tests/fixtures/musicxml/real/mozart-quartet-k387.mxl` and of one library piano item with the real synth; the
  quartet's parts use their programs, and the piano item still matches the golden fingerprint T053 recorded before
  T022 (T053 green after T022); log both results
- [x] T026 [US2] RT review of T022 (and T023) with the `rt-audio-reviewer` agent: `process()` unchanged, setup only in
  `port.onmessage`, no allocation added to the render path, mute ordering; summarise its findings in the log and fix
  any HIGH finding before the checkpoint
- [x] T027 [US2] Checkpoint: run the Independent Test's automated part (T019, T020, T021 green), `pnpm typecheck`,
  `pnpm lint`; take the `--run` screenshot on `learning/chords/c-major-scale-and-chords` to confirm the run still
  works; log with summary lines; "needs owner:" the SC-004 listening check (the agent cannot hear); commit

**Checkpoint**: US2 works on its own: the Metronome is a click, proven by the render test.

---

## Phase 5: User Story 3 - Grade marks in the Practice look (Priority: P2)

**Goal**: green heads for correct notes, grey heads with the skip icon for missed and wrong notes, red discs for wrong
pitches and extras, carets as before; no rings or crosses; discs selectable; stepper covers extras; Practice's skip
chevron becomes the skip icon; chord and octave-line wording (FR-014 to FR-026, FR-016a, FR-017a, FR-022a).
**Independent Test**: grade a recorded performance of "Für Elise" that has correct notes, one wrong pitch, one wrong
octave, one missed note and one extra key: correct heads green, the wrong pitch and the octave error as red discs at
the pitches played, the extra as a red disc where it was played, the missed note with the missed marking, no ring or
cross anywhere.

### Tests (write first, confirm they fail)

- [x] T028 [P] [US3] Tests for `placeKeys` in `tests/core/notation/place-discs.test.ts`: for every existing
  `placeDiscs` case, `placeKeys` with the equivalent `notesAtColumn` gives identical placements (the 008 goldens stay
  untouched); `preferredStaff` wins over rules (1)-(3) when its clef is placeable and is ignored for an unplaceable
  clef; `previous = []` gives no stickiness. Run it: fails (function missing)
- [x] T029 [P] [US3] Core tests for `gradeMarks` and `extraColumn` in `tests/core/grade/marks.test.ts`, with Grades
  produced by the real `gradePerformance` from synthetic Performance logs on
  `tests/fixtures/musicxml/grade/grade-marks.musicxml`
  (data-model section 2, research R-08): the fixture opens without notices; the rules table row by row; a note correct
  on pass 1 and missed on pass 2 of the repeat is `missed`; the same wrong key on both passes is ONE disc with two
  refs, two different wrong keys are two discs; timing union (pass 1 late + pass 2 early -> both, on time never hides
  one); the class on every chain notehead, carets on the chain's first notehead only; `skipIcons`: one per (column,
  staff) with a missed head, a chord with two missed notes on one staff gives one icon listing both, a missed tie
  joins the icon of its first note's column only; extra key
  column: nearest onset, the earlier one exactly between two, an unselected-hand onset counts, a grace note does not,
  across the barline when nearer, after the last onset -> last onset, a press in the whole-measure rest -> nearest
  note onset; FR-017a: a wrong key equal to the left hand's written note goes on the right-hand staff; a wrong octave
  under the 8va folds as 008 does; invariants: every NoteId once, no duplicate (column, key), no disc key equal to a
  correct head's key in its column, an unplaceable key has no disc but a mistake entry; `mistakes` order (pass, tick);
  determinism (two calls deep-equal); a golden snapshot of the whole mark set. Run it: fails (module missing)
- [x] T030 [P] [US3] Real-file sweep in `tests/core/grade/marks-real.test.ts`: for every file in
  `tests/fixtures/musicxml/real` and every library item, grade three synthetic logs (nothing played, every note played
  correctly, every note one semitone high) and assert the data-model invariants and "all correct -> no disc, all
  green", "nothing played -> no disc, all missed", "semitone high -> one disc per expected note's (column, key)".
  Run it: fails (module missing)
- [x] T031 [P] [US3] Rewrite `tests/ui/grade-marks.test.ts` for the new look (behaviour change, FR-016/FR-019, logged):
  with a recording canvas context, discs are drawn first, then skip icons, then carets; no `arc` stroke ring, no cross
  and no diamond path is ever drawn; `visible: false` draws nothing; `gradeHeadClass('correct') === 'mx-mark-correct'`,
  `gradeHeadClass('missed') === 'mx-mark-skipped'`; `discAt` hits inside a disc ellipse and misses just outside it and
  between two discs a second apart; `caretBox` puts the early caret left of an accidental and of a head displaced
  left, the late caret right of dots and of a head displaced right, never intersecting any head of the column (FR-018);
  drawing the same mark set and geometry twice records identical canvas calls (SC-008). Run it: fails
- [x] T032 [P] [US3] Tests in `tests/ui/pressed-keys.test.ts` and `tests/ui/disc-layout.test.ts` (behaviour change,
  FR-016, FR-016a, logged): `drawStateChevron({ kind: 'skipped' })` draws a filled, closed right-pointing triangle
  plus a bar at its tip inside the given box; `skipIconBox` for a single head is below it, for a chord a third apart
  and a chord with a second (displaced head) it is below the lowest head and intersects no head, for a stem-down chord
  it stays clear of the stem at the heads' left edge; `kind: 'heldOver'` is unchanged. Run it: fails
- [x] T033 [P] [US3] Tests in `tests/ui/mistake-stepper.test.ts`: the stepper is built from `GradeMarkSet.mistakes`;
  extras are included; order is pass then tick; `current` is a `GradeMarkRef`; next/previous wrap as today. Run it:
  fails
- [x] T034 [P] [US3] Tests in `tests/ui/grade-panel.test.ts` and `tests/ui/reason-text.test.ts`: a `note` ref on a
  repeated note shows one line per pass with the pass named; an `extra` ref shows its reason; FR-022a: a wrong pitch
  in a chord reads "B4 played in this chord; E4 not played" (never pairing the key to one written note); a wrong
  octave equal to the octave line in force reads "played without the 8va" (and "without the 8vb" under an 8vb, using
  `octaveShiftAt`'s sign: +1 for 8va); every other reason text is unchanged; a `disc` ref standing for a wrong pitch
  and an extra of the same key shows both explanations (FR-022). Run it: fails
- [x] T035 [P] [US3] Score-view tests in `tests/ui/score-view-grade.test.ts` (happy-dom): a Grade puts
  `mx-mark-correct` / `mx-mark-skipped` on exactly the marked notes and removes them on a new run and on a mode change;
  `overlays.marks` off removes classes and canvas marks; during a live run (no Grade yet) no disc, skip icon, caret or
  grey head is drawn, only the live green heads (FR-027); a click on a disc selects `{ kind: 'disc' }` before the
  notehead and measure handlers; a second frame without scroll or relayout calls `getBoundingClientRect` zero times for
  the marks (research R-09), while a relayout or zoom (a `domEpoch` bump) re-measures and the marks move with their
  notes (FR-025); a `data-grade-discs` seam lists each drawn disc's key, staff and column (like 008's `data-discs`). Run
  it: fails
- [x] T036 [P] [US3] E2E test `tests/e2e/play-grade-marks.spec.ts` with `startPlay` on
  `repertoire/beginner/fur-elise-theme-16-bar`, accompaniment off: keys timed with `sleep:` steps give correct notes,
  one wrong pitch, one wrong octave, one missed note and one extra key; after the Grade: the green heads are exactly
  the correct results, `data-grade-discs` holds exactly the wrong-pitch and extra keys, no ring or cross (seam and
  `tests/ui/no-dashed-lines.test.ts` style check), clicking a disc shows its reason, the stepper visits every disc and
  grey note and each visited mark is scrolled into view (FR-023), marks off hides all. Run it: fails

### Implementation

- [x] T037 [US3] Add `placeKeys` (with `preferredStaff`) to `src/core/notation/place-discs.ts` and make `placeDiscs` a
  wrapper; export from `src/core/notation/index.ts`; T028 passes and the existing notation tests stay green
- [x] T038 [US3] Create `src/core/grade/marks.ts` with `gradeMarks` and `extraColumn` (data-model section 2); T029
  and T030 pass
- [x] T039 [US3] Add `skipIconBox` and `caretBox` to `src/ui/score/disc-layout.ts`; change the `skipped` branch of
  `drawStateChevron` in `src/ui/score/pressed-keys.ts` to draw the skip icon into a given box; make Practice's caller in
  `src/ui/elements/mx-score-view.ts` group skipped notes by column and staff (one icon below the lowest head) (FR-016,
  FR-016a, research R-13); update the doc comments; T032 passes; Practice's existing tests for skipped notes stay green
- [x] T040 [US3] Rewrite `src/ui/score/grade-marks.ts` (contract section 3): `drawGradeMarks` from cached geometry
  (discs via `drawPressedKeyDiscs`, then skip icons via `drawStateChevron` in `skipIconBox` boxes, then carets in
  `caretBox` boxes), `gradeHeadClass`, `discAt`;
  delete the ring, cross and diamond code; T031 passes
- [x] T041 [US3] Replace `selectedNoteId` with `selectedMark: GradeMarkRef` in `src/ui/state/playState.ts` and build the
  stepper from `GradeMarkSet.mistakes` in `src/ui/state/mistake-stepper.ts`; update every caller; T033 passes
- [x] T042 [US3] Add the FR-022a wording to `src/ui/format/reason-text.ts` and `src/ui/i18n/en.ts`, and explain `note`
  refs (every pass) and `extra` refs in `src/ui/elements/mx-grade-panel.ts`; T034 passes
- [x] T043 [US3] Grade drawing in `src/ui/elements/mx-score-view.ts`: `gradeMarks` once per Grade; classes with
  `applyNoteMarks` + `gradeHeadClass` (re-applied on page mount); geometry cached per `domEpoch` and scroll offset
  (heads, accidentals, disc columns through `layoutDiscs`, skip-icon and caret boxes, staff geometry); disc hit test
  first in the click handler; the `data-grade-discs` and `data-grade-marks` seams (contract section 3); remove the
  per-frame measuring loop; T035 and T036 pass
- [x] T044 [US3] Update the existing tests that asserted the old marks (`tests/e2e/us1-play.spec.ts` and any other
  found by searching for the ring/cross assertions), each with a new assertion for the new mark; amend
  `specs/008-pressed-keys-on-score/contracts/pressed-keys.md` to 2.1.0 and finish
  `specs/003-play-mode-grading/contracts/play-run.md` 1.2.0 with the Grade wording (contract 5.2, 5.3)
- [x] T054 [US3] Add the `e2e-synthetic-grade` seam in `src/app/session.ts` beside `e2e-midi` (contract section 3):
  build a `nothing` / `correct` / `semitoneHigh` Performance log from the open Score's expected notes and grade it
  through the normal grade worker, so e2e tests get a Grade without playing a whole run
- [x] T055 [US3] E2E overlap sweep `tests/e2e/grade-marks-overlap.spec.ts` (SC-007, FR-026, analyze M3): for every
  library item and `tests/fixtures/musicxml/grade/grade-marks.musicxml`, dispatch `e2e-synthetic-grade` with
  `nothing` and with `semitoneHigh`, then read `data-grade-marks` for every page scrolled into view: no skip-icon or
  caret box intersects any head or accidental box (discs are the FR-021 exception and are excluded). Write it after
  T054 and before T039/T040/T043 are finished, and see it fail on the chevron placement; it passes after T043
- [x] T045 [US3] Checkpoint: run the Independent Test with `pnpm screenshot -- --item
  repertoire/beginner/fur-elise-theme-16-bar --run --grade --keys "<the T036 steps>" --out
  tests/.generated/009/t045-grade.png` and look at it; run `pnpm test`, `pnpm typecheck`, `pnpm lint`, the US3 e2e
  spec; log with summary lines; commit

**Checkpoint**: US3 works on its own: the Grade uses Practice's look.

---

## Phase 6: Polish & Cross-Cutting

- [x] T046 [P] Electron: extend `tests/e2e/electron-playback.spec.ts` with a Play run that shows the cursor
  (`.playing` during the run) and Grade marks (`data-grade-discs`, green classes) in the desktop app (SC-010). The
  Metronome needs no Electron-specific test: it is the same worklet code, proven by T019/T020 in Node; say so in the log
- [x] T047 [P] Frame-rate check in `tests/e2e/play-frame-rate.spec.ts`: a Play run with accompaniment on the large
  generated score (`tests/tools/gen-large-score.ts`), then a replay with its Grade on screen; the 95th percentile of
  animation-frame intervals over 5 s is at most 20 ms in Chromium on the reference machine (SC-009: 60 fps is 16.7 ms;
  the named test allowance `FRAME_P95_MAX_MS = 20` in the test file covers browser scheduling jitter); log the
  measured values
- [x] T048 Greyscale check (SC-006): convert the T045 picture to greyscale into `tests/.generated/009/t048-grey.png`,
  look at it, and record in the log that correct, wrong pitch, missed, extra, early and late are each recognisable
- [x] T049 Real-file look: `pnpm screenshot -- --file tests/fixtures/musicxml/real/schumann-dichterliebe-15.mxl --run
  --grade --keys "sleep:6000"` and one intermediate library item; look at both (no mark spreads over neighbouring
  notes, SC-007); log
- [x] T050 Run the `quickstart.md` manual verification; everything that needs ears or a real keyboard (US2 listening,
  SC-004; a real MIDI keyboard run) is handed to the owner with "needs owner:" in the log, not reported as done
- [x] T051 Constitution review of the whole diff with the `constitution-auditor` agent; summarise its findings in the
  log and resolve or raise every HIGH or CRITICAL one
- [x] T052 Full quality gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, each with its summary line
  in the log; confirm the grading goldens (`tests/core/grade/golden.test.ts` and its snapshots) are unchanged, which is
  FR-028's evidence; final hand-off entry
- [x] T059 Found by T051 (constitution audit, HIGH, Constitution III: a bad file never hangs): `<beat-type>` and `<beats>` are
  untrusted and the click loops step by the beat, so `-4`, `1000000`, `7` or an absurd numerator meant a loop that never ends
  or a fractional tick. Test first in `tests/core/play/play-schedule.test.ts` (hostile meters read as 4/4, absurd measure length
  has a bounded number of clicks; it hung before the fix), then `meterOf` in `src/core/timeline/beat.ts` (shared by the
  grading windows, whose results for valid meters are unchanged) and `RUN_CLICKS_PER_PASS_MAX` in `play-schedule.ts`
- [x] T060 Found by T026/T051 (RT review LOW, audit MEDIUM): `heldNotes` in `score-player.processor.ts` was a `Set` touched by
  `noteOn`/`noteOff` inside `process()`, now once per Metronome beat as well; replaced by a pre-allocated `Uint8Array` (Constitution I).
  The existing pause/stop release tests cover it

---

## Phase 7: Owner review of the implemented feature (2026-09-25)

**Input**: the owner's two UX issues (spec Clarifications, "owner review of the implemented feature"): (1) no mark
during a run, green and red appear only with the Grade (FR-027 changed, FR-008 withdrawn, AS-1.6); (2) the bar follows
the note that started last, not a long note held under a moving part (FR-001, AS-1.9; Listen's cursor too).

**Tests that change because the specified behaviour changed**: the Play and Listen cursor cases that expected the bar at
the first note in span order (`tests/ui/score-view-play-cursor.test.ts` b, e, f), and every test of the live "correct"
marking (`tests/engine/play-session.test.ts` T044, `tests/ui/grade-marks.test.ts` live marks, `tests/e2e/us1-play.spec.ts`,
`tests/e2e/pressed-keys.spec.ts` "Play mode", `tests/e2e/play-cursor.spec.ts` green under the highlight). Each replaced
assertion gets an assertion of the new behaviour.

### Tests (write first, confirm they fail)

- [x] T061 [P] [US1] `cursorNotesAtTick` in `tests/core/timeline/position.test.ts`: on `grade/grade-marks.musicxml` the
  held whole note is not returned while the right hand moves (beat 2: A4 only; beat 3: the chord B4 D5 G5 only; beat 1:
  G4 and G3, the same onset); on every golden fixture at every quarter beat the result is exactly the sounding notes of
  the latest start (so empty exactly when nothing sounds), and each file has moments with an older note held underneath
- [x] T062 [P] [US1] `tests/ui/score-view-play-cursor.test.ts`: the bar stands at the notes that started last, in Play
  and in Listen: new case (g) on measure 1 (the bar at A4 and at the chord, not at the held G3, while G3 stays
  highlighted); cases (a), (b), (e), (f) use the new reference
- [x] T063 [P] [US3] No mark during a run: `tests/engine/play-session.test.ts` (keys pressed during the run give
  `soundInput` and no other effect, replacing the three T044 tests); `tests/ui/score-view-play-cursor.test.ts` case (h)
  (a running run marks no note and `playState` has no live marking; the Grade marks them after the run), replacing the
  live-mark describe of `tests/ui/grade-marks.test.ts`; `tests/e2e/us1-play.spec.ts`, `tests/e2e/pressed-keys.spec.ts`
  ("Play mode") and `tests/e2e/play-cursor.spec.ts` (a correct key pressed during the run: no note marked in any frame
  for 1 s (`marksDuringRun` in `tests/e2e/helpers/play.ts`), then green with the Grade)

### Implementation

- [x] T064 [US1] `cursorNotesAtTick` in `src/core/timeline/position.ts`; `src/ui/elements/mx-score-view.ts` draws the
  bar of Listen and Play at those notes (highlights unchanged: every note sounding)
- [x] T065 [US3] Remove the live marking: the `liveMark` effect (`src/core/play/types.ts`), `checkLiveMark` and
  `liveMarkedOnsets` (`src/app/play-session.ts`), its handler (`src/app/session.ts`), `liveMarkedNoteIds` and
  `addLiveMark` (`src/ui/state/playState.ts`), the live classes (`src/ui/elements/mx-score-view.ts`); the live-run case of
  `tests/ui/score-view-grade.test.ts` (it fed the removed `addLiveMark`) now sets a running run and asserts no mark
- [x] T066 Documents: contracts `003 play-run.md` 2.0.0 (the `liveMark` effect is removed) and `009 play-display.md`
  2.0.0 (`cursorNotesAtTick`, the bar rule, no `liveMarkedNoteIds`), research R-15, `quickstart.md` US1 steps 3 and 5,
  003 `spec.md` FR-011 marked as superseded
- [ ] T067 Checkpoint: picture of the owner's example (`learning/chords/c-major-scale-and-chords`) during a run with a
  correct key pressed (bar at the right-hand note, no green) and after the Grade; full gate; log entry

## Dependencies & Execution Order

- Setup (T001-T002) -> Foundational (T003-T007) -> US1 (T008-T017), US2 (T018-T027), US3 (T028-T045) -> Polish
  (T046-T052).
- US1 and US2 are independent of each other (different files: the score view and core position code vs the worklet
  and play session). US3 depends on US1 only through `src/ui/elements/mx-score-view.ts` (the canvas frame order of
  T015): do T043 after T015.
- Within US1: T008 -> T012 -> T014; T009 -> T013; T010/T011 -> T015 (after T012, T013); T016 after T015.
- Within US2: T053 committed before T022; T019/T020 -> T022 -> T025 -> T026; T021 -> T023; T024 after T022 and
  T023.
- Within US3: T028 -> T037 -> T038 (uses `placeKeys`); T029/T030 -> T038; T032 -> T039 -> T040 (draws the icon);
  T031 -> T040; T033 -> T041; T034 -> T042 (after T041: the panel reads `selectedMark`); T035/T036 -> T043 (after T038,
  T040, T041); T054 -> T055 -> (T039, T040, T043); T044 after T043.
- T057 -> T058 before T020 can pass (its click count needs the run clicks); T056 before T018 can be ticked (its guard test compiles every fixture); T001 before T022; T002 before T008 and T029; T005 before T011, T036, T046; T004 before T036.

## Parallel Opportunities

- Setup: T001 and T002.
- US1 tests: T008, T009, T010, T011 together.
- US2 tests: T018, T019, T020, T021, T053 together; US2 can run in parallel with US1 as a separate lane
  (docs/agents/reference.md R6).
- US3 tests: T028 to T036 together (all different files); implementation T037, T039, T041 in parallel, then T038,
  T040, T042, then T043.
- Polish: T046 and T047 together.
