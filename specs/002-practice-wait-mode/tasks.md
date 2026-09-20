# Tasks: Practice Mode (Wait for Input)

**Input**: Design documents from `specs/002-practice-wait-mode/`
**Amended**: 2026-09-20 after `/speckit.clarify` - T049-T052 were appended for the skip control and part
selection, and T002, T003, T008, T011, T019, T025, T026, T027, T031 and T042 were widened. Numbers are not
renumbered; the phase order below is what to follow.
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/)

<!--
  Format: `- [ ] T001 [P] [US1] Description with exact file path`
  States: `[ ]` open, `[~]` in progress with ` (claimed: <agent-id> <date>)`, `[x]` done (AGENTS.md section 4)
  - [P]   = can run in parallel (different files, no dependency on unfinished tasks)
  - [USn] = user story the task belongs to (omit for Setup/Foundational/Polish)
  - Tests come BEFORE implementation (Constitution IV) and must fail first.
-->

## Phase 1: Setup

- [x] T001 Confirm the new paths are covered by the build and test projects: `src/core/practice/**` in
  `tsconfig.core.json`, `tests/core/practice/**` in `vitest.config.ts`; no dependency is added in this feature, so
  `package.json` must stay unchanged
- [x] T002 [P] Add the nine practice constants from [data-model.md](data-model.md) §7 to `src/core/defaults.ts`
  (`PRACTICE_HAND_ATTRIBUTION`, `PRACTICE_CHORD_REQUIRE_SIMULTANEOUS`, `PRACTICE_REQUIRE_GRACE_NOTES`,
  `PRACTICE_EXPECT_INVISIBLE_NOTES`, `PRACTICE_EXPECT_UNPITCHED`, `PRACTICE_LOOP_OCCURRENCE`,
  `PRACTICE_PART_PRESELECTION`, `PRACTICE_HELP_AFTER_WRONG_ATTEMPTS`,
  `PRACTICE_RELEASE_OF_SUSTAINED_NOTE_BLOCKS`), each with a one-line comment naming the rule it encodes - none of
  them is a time window

---

## Phase 2: Foundational (blocks all user stories)

- [x] T003 Practice domain types in `src/core/practice/types.ts`, exactly the shapes in
  [contracts/practice-session.md](contracts/practice-session.md) and [data-model.md](data-model.md) §1-§6
  (`HandSelection`, `RequiredKey`, `ExpectedEvent`, `SoundingRef`, `Attempt`, `MarkState`, `PracticeMark`,
  `SessionPhase`, `PracticeSession`, `PracticeInput` (including the `skipNext` / `skipPrevious` commands),
  `PracticeEffect`, `PracticeNoticeCode`, `LoopRange`, `ResolvedLoop`) - types only, no logic. `MarkState` has all
  nine states, `playedAlong` and `skipped` included (clarifications of 2026-09-20)
- [x] T004 [P] Test helper `tests/core/practice/helpers.ts`: load a fixture by name and return
  `{ score, timeline }` through the existing `readXml` / `buildScore` / timeline builder, so every practice test
  starts from a real Score
- [x] T005 [P] Test helper `tests/fakes/midi-sequence.ts`: build ordered `PracticeInput[]` (note on/off, sustain,
  device loss) from a compact notation, plus a `stripTimestamps` helper for the timestamp-independence assertion

**Checkpoint**: foundation ready - user stories can proceed (in parallel if staffed).

---

## Phase 3: User Story 1 - Practise a piece hands together, one note at a time (Priority: P1) MVP

**Goal**: the mode itself - wait at each expected note or chord, advance only on the right keys, mark what was
played, reach the end of the Score. Both hands, no hand selection, no loop, no help yet.
**Independent Test**: open `musicxml/chords/c-major-scale-and-chords.musicxml`, switch to Practice, play the piece
on a MIDI keyboard: the cursor advances only on correct notes, wrong notes are marked without advancing, and the
session reports that the end was reached.

### Tests (write first, confirm they fail)

- [x] T006 [P] [US1] `tests/core/practice/expected.test.ts`: grouping and filtering per
  [data-model.md](data-model.md) §2 - grouping on the **notated** onset (a `grace-acciaccatura` fixture proves that
  grouping on `SoundingEvent.startTick` would split a written chord), one tie chain = one event
  (`tie-across-barline`, `tie-chain-three`), dedupe by sounding key keeping every Note ID (`chord-basic`,
  `grand-staff-two-voices-per-staff`), grace notes never required, hidden (`printed === false`) and unpitched
  (`percussion-unpitched`) notes never required, events with no required keys dropped (FR-035, FR-036)
- [x] T007 [P] [US1] `tests/core/practice/order.test.ts`: the expected-event order equals the order Listen plays
  for `repeat-simple`, `volta-1-2`, `dc-al-fine` and `tie-into-volta` (FR-003, SC-005)
- [~] T008 [P] [US1] `tests/core/practice/matcher.test.ts`: correct key advances and wrong key never does
  (SC-001); chord accepted only when all required keys are held together, in any order and at any speed, with
  `correctSoFar` while partial (FR-005, SC-003); **the wrong-versus-extra rule** - an unexpected key pressed while
  required keys are still unplayed is `wrongPitch`, or `wrongOctave` on a pitch-class match, while a key pressed
  once every required key is held, or left over from earlier playing, is `extra`, and neither ever blocks (FR-007,
  data-model §4 rule 3); **played-along** - a key the event lists in `accompaniment` (grace note, another part) is
  marked `playedAlong`, never judged and never counted (FR-007, FR-027); every expected note needs a fresh press
  (FR-009); a required key already down puts the event in `blocked` with the held-over mark (FR-009a); releasing a
  long note early never blocks (FR-037); sustain ignored for judging (FR-026) (claimed: antigravity-gemini-3.1-pro 2026-09-20)
- [ ] T009 [P] [US1] `tests/core/practice/device-loss.test.ts`: `deviceLost` releases the reported held keys,
  keeps the event index, and the session returns to `waiting` on the next input without restarting (FR-021)
- [ ] T010 [P] [US1] `tests/core/practice/replay.test.ts`: golden snapshots of the marks and the ordered effects
  for recorded input lists over the C major exercise and `chord-basic`; plus the guarantee that stripping every
  `timeStampMs` changes nothing (FR-028, SC-004, contract guarantee 2)
- [ ] T011 [P] [US1] `tests/ui/practice-marks.test.ts`: each of the nine `MarkState`s - `playedAlong` and
  `skipped` included - renders a distinct shape class as well as a colour, the waiting cursor sits on the expected
  event, and no mark covers the notehead it refers to (FR-010, SC-009, R-08)
- [ ] T049 [P] [US1] `tests/core/practice/skip.test.ts` (write before T050): `skipNext` marks the event's
  required notes `skipped` and moves the cursor on without a `correct`; `skipPrevious` returns to the previous
  event and clears its marks; neither touches `wrongAttemptsOnCurrent`; a forward skip past the last event ends
  the session as `stopped`, not `reachedEnd` (FR-004a, data-model §4 rule 6)

### Implementation

- [ ] T012 [US1] `src/core/practice/expected.ts` - `buildExpectedEvents(score, timeline, selection)` per
  [data-model.md](data-model.md) §2, with `selection` accepting every staff of the practised part for now
  (depends on T006, T007)
- [ ] T013 [US1] `src/core/practice/matcher.ts` - `startSession` and the pure `applyInput` reducer returning
  `SessionStep { session, effects }`, no I/O and no timestamp reads (depends on T008, T009, T010)
- [ ] T014 [US1] `src/ui/score/practice-marks.ts` plus the waiting cursor in `src/ui/score/cursor-overlay.ts` and
  the mark styles in `src/ui/styles/` - shape **and** colour, drawn in the overlay layer, never inside the Verovio
  SVG; includes dimming the unselected hand's notes (FR-032) (depends on T011)
- [ ] T015 [P] [US1] Practice strings in `src/ui/i18n/en.ts`: mark names and the message ids from R-10
  (`practice.octave.higher`, `practice.octave.lower`, `practice.extra.heldOver`, `practice.extra.notInChord`,
  `practice.repress`) plus the notice codes - each naming the next physical action, none suggesting a score
  (FR-039)
- [ ] T016 [US1] `src/ui/elements/mx-mode-switch.ts` and the transport's Practice behaviour: Listen | Practice,
  Start/Stop instead of Play/Pause, and the switch disabled with its reason when the `MidiInput` port is not
  `available` (FR-001, FR-022, FR-033, R-02)
- [ ] T017 [US1] `src/ui/state/practiceState.ts` - the session view state the elements subscribe to
- [ ] T018 [US1] `src/app/session.ts` wiring: route `MidiInput` events into the matcher, apply every effect
  (marks, cursor, `liveNoteOn`/`liveNoteOff`, notices, session end), deliver **no** schedule to the audio engine in
  Practice mode, and clear the marks when the mode is switched (FR-002, FR-011, FR-012, FR-019, FR-020)
  (depends on T013, T014, T016, T017)
- [ ] T050 [US1] Skip handling in `src/core/practice/matcher.ts` and the skip forward / back control in the
  transport, wired in `src/app/session.ts` - available whenever a session is running, disabled when it is not
  (depends on T049, T013, T018)
- [ ] T019 [US1] `tests/e2e/us1-practice.spec.ts` (Playwright, fake MIDI device): wait, wrong note, chord,
  held chord under moving notes, skip past a note, reach the end
- [ ] T020 [US1] RT review with `rt-audio-reviewer` (`.claude/agents/rt-audio-reviewer.md`) of T018: confirm that
  Practice introduces no timer-driven sound, no scheduler or worklet change, and that the live-note path is used as
  feature 001 intended (Constitution I and II; plan.md claims "no new real-time paths" - this is where that claim
  is checked)

**Checkpoint**: US1 fully functional and testable on its own - a musician can practise a whole piece hands
together.

---

## Phase 4: User Story 2 - Practise one hand, and start anywhere (Priority: P2)

**Goal**: hand selection with the unselected hand sounding as the cursor passes it, starting from a clicked
measure, and both remembered per Score.
**Independent Test**: practise "right hand only" from measure 5 of the C major exercise - only right-hand notes are
expected, the left hand is heard as the cursor passes it, and the session starts at measure 5.

### Tests (write first, confirm they fail)

- [ ] T021 [P] [US2] Fixture `tests/fixtures/musicxml/cross-staff-beaming.musicxml`: a left-hand voice with notes
  printed on the treble staff (`<staff>1</staff>` on notes belonging to the lower voice), plus its row in the
  fixture list in `docs/musicxml-support.md` if that file lists fixtures
- [ ] T022 [P] [US2] `tests/core/practice/hands.test.ts`: a voice's home staff is the staff holding most of its
  written duration; the cross-staff fixture assigns those notes to the left hand although they are printed on
  staff 1; `handOptions` gives one unlabelled line for a single-staff Score and exposes a third staff separately
  (FR-034, R-05)
- [ ] T023 [P] [US2] `tests/core/practice/selection.test.ts`: only the selected staves are required, the rest
  become `accompaniment`; a unison across hands is one required key marking both noteheads (FR-038); an octave
  doubling stays two required keys
- [ ] T024 [P] [US2] `tests/core/practice/accompaniment.test.ts`: `soundOn` when the cursor reaches the note's
  onset event and `soundOff` when the cursor passes its `endTick`, nothing emitted when accompaniment is off, and
  no effect is ever produced by a timer (FR-031, FR-032, SC-012, R-03)
- [ ] T025 [P] [US2] `tests/engine/storage/practice-settings.test.ts`: per-Score load and save, fallback to the
  last-used defaults then the built-in defaults, the 20-entry cap evicting oldest-`updated` first, invalid or
  corrupt data resetting without throwing, and a null Score id never persisting; the practised part is remembered
  with them
  ([contracts/practice-settings.md](contracts/practice-settings.md))
- [ ] T026 [P] [US2] `tests/core/practice/start-at-measure.test.ts`: starting at a measure picks the first
  expected event of that measure for the current selection; where the measure is played more than once, the
  occurrence used is the one the cursor is in, else the first at or after it - the loop rule of R-06 - and
  changing the selection mid-session restarts from the current measure (FR-015, AS-2.4)
- [ ] T051 [P] [US2] `tests/core/practice/parts.test.ts`: `partOptions` preselects the first pitched part with two
  or more staves, else the first pitched part, never offers a part without pitched printed notes, and returns
  `preselected: -1` for a Score with nothing to practise; the parts that are not chosen become `accompaniment`
  (FR-025a, FR-025b). Needs a two-part fixture (voice + piano) - add it beside the existing fixtures

### Implementation

- [ ] T027 [US2] `src/core/practice/hands.ts` - voice-to-home-staff attribution and
  `handOptions(score, partIndex)` (depends on T021, T022)
- [ ] T052 [US2] `partOptions(score)` in `src/core/practice/hands.ts` and the practised-part filter in
  `expected.ts`; changing the part rebuilds the events and restarts from the current measure, as a hand change
  does (FR-025a-c) (depends on T051)
- [ ] T028 [US2] Extend `src/core/practice/expected.ts` with the selection filter and the `accompaniment` list, plus `resolveStartMeasure`
  (depends on T023, T026)
- [ ] T029 [US2] Extend `src/core/practice/matcher.ts` with the `soundOn`/`soundOff` accompaniment effects tied to
  cursor movement (depends on T024)
- [ ] T030 [US2] `SettingsStore.loadPractice` / `savePractice` in `src/engine/ports.ts`, the
  `musicanyya.practice.v1` key in `src/engine/storage/local-settings-store.ts`, and an in-memory settings store in
  `tests/fakes/`; bump `specs/001-score-viewer-listen/contracts/ports.md` to `1.1.0` (depends on T025)
- [ ] T031 [US2] `src/ui/elements/mx-practice-panel.ts` (part selection - shown only when the Score has more than
  one pitched part - hand selection, accompaniment switch) and the `src/app/session.ts` wiring for starting at a
  clicked measure and restarting on a selection change (depends on T027, T028, T029, T030, T052)
- [ ] T032 [US2] Extend `tests/e2e/us1-practice.spec.ts` with a hands-separate run: right hand only, left hand
  heard, start from a measure

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Loop a difficult section until it is fluent (Priority: P3)

**Goal**: loop a written measure range, resolved to the occurrence being played.
**Independent Test**: set a loop over measures 3-4, practise through it twice, and the cursor returns to the first
expected event of measure 3 each time without stopping the session.

### Tests (write first, confirm they fail)

- [ ] T033 [P] [US3] `tests/core/practice/loop.test.ts`: `resolveLoop` normalises a reversed range (AS-3.4),
  resolves to the occurrence the cursor is in or the first one after it, keeps a repeat sign that lies inside the
  range, returns null for a range with no required events for the current hand (R-06); and `loopRangeToPassIndices` / `passIndicesToLoopRange` round-trip correctly
- [ ] T034 [P] [US3] `tests/core/practice/loop-wrap.test.ts`: completing the last event of the slice moves the
  cursor to its first event, the session stays `waiting`, and the marks of the finished pass are handled as the
  spec requires

### Implementation

- [ ] T035 [US3] `src/core/practice/loop.ts` - `resolveLoop` per [data-model.md](data-model.md) §5, plus `loopRangeToPassIndices` and `passIndicesToLoopRange` for persistence
  (depends on T033)
- [ ] T036 [US3] Loop handling in `src/core/practice/matcher.ts`, plus the `practiceLoopEmpty` notice
  (depends on T034, T035)
- [ ] T037 [US3] Loop range selection in `src/ui/elements/mx-practice-panel.ts`, the looped measures marked in the
  Score, the "2nd time" pass label when the range occurs more than once, and the range persisted through
  `savePractice`

**Checkpoint**: US1-US3 all work independently.

---

## Phase 6: User Story 4 - Help when I am stuck (Priority: P4)

**Goal**: show what the app is waiting for - the key, the note name and the written fingering - after repeated
wrong attempts or on request.
**Independent Test**: play the wrong note three times on the same expected note and the expected key appears on the
on-screen keyboard with its note name and written fingering.

### Tests (write first, confirm they fail)

- [ ] T038 [P] [US4] `tests/core/practice/help.test.ts`: `showHelp` after `PRACTICE_HELP_AFTER_WRONG_ATTEMPTS`
  wrong attempts on the same event, immediately on request, immediately with reason `heldOver`, hidden as soon as
  the event is satisfied, and grace notes never counting towards it (FR-023, R-10)
- [ ] T039 [P] [US4] `tests/ui/practice-help.test.ts`: the expected key is lit on the on-screen keyboard with its
  note name and the fingering written in the Score, the overlay never covers the note it refers to, and the
  session switch turns it off (FR-024)

### Implementation

- [ ] T040 [US4] Help effects and the `wrongAttemptsOnCurrent` counter in `src/core/practice/matcher.ts` - counted
  internally, never shown as a tally (depends on T038)
- [ ] T041 [US4] `src/ui/elements/mx-practice-help.ts`, the expected-key highlight in
  `src/ui/elements/mx-piano-keys.ts`, and the wiring in `src/app/session.ts` (depends on T039, T040)

**Checkpoint**: all four stories work independently.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T042 [P] SC-009 check: screenshot every mark state in greyscale and confirm waiting, correct-so-far,
  correct, wrong pitch, wrong octave, extra, held-over, played-along and skipped stay distinguishable by shape
- [ ] T043 [P] Measure SC-002 (key press to mark <= 50 ms) and SC-011 (starting a session anywhere in a
  500-measure Score <= 1 s, using `pnpm gen:large-score`), and record both in the log
- [ ] T044 [P] Documentation pass: `docs/musicxml-support.md` (no parser change is expected in this feature -
  confirm, and record how grace, hidden and unpitched notes behave in Practice), `README.md` and
  `quickstart.md` if any command changed
- [ ] T045 [P] Contract check: `contracts/practice-session.md` and `contracts/practice-settings.md` match what was
  built, and `specs/001-score-viewer-listen/contracts/ports.md` carries the `1.1.0` bump from T030
- [ ] T046 Constitution audit of the branch with `constitution-auditor` (`.claude/agents/constitution-auditor.md`);
  fix CRITICAL and HIGH findings
- [ ] T047 Run [quickstart.md](quickstart.md) manual verification end to end (browser and desktop app, real MIDI
  keyboard) and fix findings; confirm SC-006 (start in 2 actions under 10s) and SC-007 (20-minute session no drift)
- [ ] T048 Full quality gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`; final
  `implementation-log.md` entry; commit

---

## Dependencies & Execution Order

- **Phases**: Setup -> Foundational -> US1 -> US2 -> US3 -> US4 -> Polish. Stories are in priority order; US2-US4
  could be staffed in parallel once US1's core exists, because each adds to a different part of the matcher.
- **Within a story**: tests -> core -> engine -> UI -> e2e -> RT review.
- **Hard dependencies**:
  - T003 (types) blocks every test and every implementation task.
  - T012 and T013 (US1 core) block T018, and everything in US2-US4 extends them.
  - T021 (cross-staff fixture) blocks T022; T022 blocks T027.
  - T025 blocks T030, which blocks T031's persistence and T037's loop persistence.
  - T035 blocks T036, which blocks T037.
  - T038/T040 block T041.
  - T049 blocks T050, which also needs T013 and T018 (the skip control is wired where every other effect is).
  - T051 blocks T052, which blocks T031's part selection.
  - T046-T048 run last, after every story is green.
- **Not a dependency**: nothing in this feature touches `src/engine/worklets/`, `src/core/schedule/` or
  `src/engine/audio/`, so the RT review in T020 is a confirmation task, not a gate on other work.

## Parallel Opportunities

- **Setup**: T002 alongside T001.
- **Foundational**: T004 and T005 together.
- **US1 tests**: T006, T007, T008, T009, T010, T011, T049 are seven independent files - the largest parallel block
  in the feature.
- **US1 implementation**: T015 (strings) alongside T012/T013; T014 alongside T012/T013 once T011 exists.
- **US2 tests**: T021, T022, T023, T024, T025, T026, T051 together.
- **US3 tests**: T033 and T034 together.
- **US4 tests**: T038 and T039 together.
- **Polish**: T042, T043, T044, T045 together, before T046-T048.
