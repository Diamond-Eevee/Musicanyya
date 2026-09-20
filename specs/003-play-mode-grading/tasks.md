# Tasks: Play Mode and Grading

**Input**: Design documents from `specs/003-play-mode-grading/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/)

<!--
  Format: `- [ ] T001 [P] [US1] Description with exact file path`
  States: `[ ]` open, `[~]` in progress with ` (claimed: <agent-id> <date>)`, `[x]` done (AGENTS.md section 4)
  - [P]   = can run in parallel (different files, no dependency on unfinished tasks)
  - [USn] = user story the task belongs to (omit for Setup/Foundational/Polish)
  - Tests come BEFORE implementation (Constitution IV) and must fail first.
  - Tasks touching AudioWorklets, the scheduler, MIDI input timing or plugin callbacks get a follow-up RT review
    task (Constitution I).
-->

**Owner decisions**: the plan's four open decisions (D-1 ornaments, D-2 arpeggios, D-3 SC-015, D-4 count-in
window) are listed as T085-T088 at the end. This list **assumes the recommended answers**: D-3 softened (the live
marker stays a cheap pitch test, T044) and D-4 accepted (recording reaches back into the count-in, T023/T033).
D-1 and D-2 add tasks if accepted and change nothing if not.

---

## Phase 1: Setup

- [ ] T001 Confirm the new paths are covered by the build and test projects: `src/core/play/**`,
  `src/core/grade/**` in `tsconfig.core.json`, `src/workers/grade.worker.ts` in the workers project,
  `tests/core/play/**` and `tests/core/grade/**` in `vitest.config.ts`. No dependency is added in this feature, so
  `package.json` must stay unchanged
- [ ] T002 [P] Add the musical constants of [data-model.md](data-model.md) §10 to `src/core/defaults.ts`
  (`PLAY_COUNT_IN_MEASURES`, `COUNT_IN_MIN_SECONDS`, `COUNT_IN_INCLUDES_ANACRUSIS`, `METRONOME_CHANNEL`,
  `METRONOME_KEY_BEAT`, `METRONOME_KEY_DOWNBEAT`, `METRONOME_VELOCITY_BEAT`, `METRONOME_VELOCITY_DOWNBEAT`,
  `PLAY_STRICTNESS_DEFAULT`, `PLAY_GRADE_UNPLAYED_IS_MISSED`, `PLAY_BEAT_UNIT_SOURCE`,
  `PLAY_NEIGHBOUR_GAP_FRACTION`, `PLAY_WINDOW_ABSOLUTE_FLOOR_MS`, `PLAY_RETRIGGER_DEBOUNCE_MS`,
  `CALIBRATION_BEATS`, `CALIBRATION_TEMPO_QPM`, `CALIBRATION_MAX_SPREAD_MS`), each with a one-line comment naming
  the rule it encodes
- [ ] T003 [P] Add the platform limits of [data-model.md](data-model.md) §10 to `src/engine/config.ts`
  (`PERFORMANCES_PER_SCORE_MAX`, `PLAY_SETTINGS_MAX`, `GRADE_WORKER_TIMEOUT_MS`)

---

## Phase 2: Foundational (blocks all user stories)

- [ ] T004 Play domain types in `src/core/play/types.ts`, exactly the shapes in
  [contracts/play-run.md](contracts/play-run.md) and [data-model.md](data-model.md) §1, §2, §7 (`PlayRun`,
  `RunPhase`, `PlayAction`, `PlayEffect`, `PlayNoticeCode`, `PlayTickMap`, `PlayScheduleOptions`, `RunSettings`,
  `ReliabilityEvent`) - types only, no logic
- [ ] T005 [P] Grade domain types in `src/core/grade/types.ts`, exactly the shapes in
  [contracts/grading.md](contracts/grading.md) and [data-model.md](data-model.md) §3-§6, §8, §9 (`ExpectedNote`,
  `PitchResult`, `TimingResult`, `NoteResult`, `ExtraNote`, `ResultReason`, `StrictnessLevelName`,
  `StrictnessLevel`, `Window`, `GradeInput`, `Grade`, `GradeSummary`, `MeasureOverview`, `ReliabilityWarning`,
  `PerformanceLog`, `RecordedMessage`, `LatencyProfile`) - types only. `timing` is `TimingResult | null`, so the
  two-axis rule is in the type system
- [ ] T006 [P] Test helper `tests/core/grade/helpers.ts`: load a fixture by name and return
  `{ score, timeline, expected }`, reusing `tests/core/practice/helpers.ts` so every grading test starts from a
  real Score
- [ ] T007 [P] Test helper `tests/fakes/performance-log.ts`: build a `PerformanceLog` from a compact notation
  (pitch, beat offset, deliberate millisecond error), plus `shuffleSimultaneous` for the arrival-order
  independence assertion of FR-019 and `loadRecordedPerformance` for the JSON fixtures
- [ ] T008 Test `tests/core/tempo/rate.test.ts` (extend): `tickAtAudioTime` is the exact inverse of the existing
  tick-to-time conversion across tempo changes and tempo percentages, on integer boundaries - write it, see it
  fail
- [ ] T009 Implement `tickAtAudioTime` in `src/core/tempo/rate.ts`: the single place seconds become ticks
  (Constitution II, research R-06)
- [ ] T010 [P] Test `tests/engine/midi/clock-map.test.ts`: `performance.now()` timestamps map onto audio-context
  seconds from a `(contextTime, performanceTime)` pair; a new pair re-anchors without jumping; a missing pair
  falls back to the last known one - write it, see it fail
- [ ] T011 Implement `src/engine/midi/clock-map.ts` per research R-04, storing both the mapped `audioTimeSec` and
  the raw `timeStampMs`
- [ ] T012 [P] Test `tests/core/grade/windows.test.ts` (invariants part): for every level, `floorMs <= beats*375`
  and `capMs >= beats*1000` (clamp inertness, SC-014 first clause) and `onTime <= claim` after every clamp -
  asserted over the whole record, not per level
- [ ] T013 Add the `PLAY_STRICTNESS_LEVELS` record (Beginner, Standard, Strict) to `src/core/defaults.ts` with
  the values of [data-model.md](data-model.md) §6, each window as `{ beats, floorMs, capMs }`
- [ ] T014 [P] New MusicXML fixtures in `tests/fixtures/musicxml/` with origin and licence in the fixtures
  README: `window-beat-unit-6-8`, `neighbour-clamp-sixteenths-160`, `repeated-pitch-two-presses`,
  `unison-two-voices`, `anacrusis-count-in`, `range-start-mid-measure-rests`, `enharmonic-cs-db`,
  `transposing-part-sounding-pitch`, `first-note-early-into-count-in`, `last-note-late-past-end` (quickstart §3).
  Real files with real notation - no placeholders (AGENTS.md section 4)
- [ ] T015 [P] Recorded performance fixtures in `tests/fixtures/performances/`: the JSON `PerformanceLog` format
  of [contracts/performance-log.md](contracts/performance-log.md), one accurate take and one with known mistakes
  in measures 3 and 7 (the spec's US2 Independent Test), each naming its Score and settings

**Checkpoint**: foundation ready - user stories can proceed (in parallel if staffed).

---

## Phase 3: User Story 1 - Play a piece to the Metronome and get a Grade (Priority: P1) MVP

**Goal**: the mode itself - count-in, Metronome, the Score moving on the clock without waiting, the performance
recorded, and afterwards every expected note marked on two axes with a plain-words reason.
**Independent Test**: open `musicxml/chords/c-major-scale-and-chords.musicxml`, press Start in Play mode, play the
piece (or feed a recorded performance through the fake MIDI input), and confirm the count-in and Metronome run,
the cursor moves on the clock without waiting, and at the end every expected note carries a result with a readable
reason.

### Tests (write first, confirm they fail)

- [ ] T016 [P] [US1] `tests/core/grade/expected.test.ts`: `buildExpectedNotes` flattens 002's expected events one
  per required key; grace notes, ornaments, hidden, playback-only, unpitched and percussion notes and the
  unselected hand/part are never expected; a tie chain appears once at its onset; each repeat occurrence appears
  separately in Listen order (FR-017, FR-021, SC-005)
- [ ] T017 [P] [US1] `tests/core/grade/windows.test.ts` (resolution part): fraction of a beat resolves in ticks;
  the beat is the dotted quarter in 6/8 (`window-beat-unit-6-8`); floor and cap bite only outside 60-160 bpm; the
  neighbour clamp is applied **after** the floor and gives ±46.9 ms for sixteenths at 160 bpm
  (`neighbour-clamp-sixteenths-160`); adjacent claim windows meet at the midpoint with no gap and no overlap at
  40, 60, 120, 160 and 208 bpm (SC-014)
- [ ] T018 [P] [US1] `tests/core/grade/match.test.ts`: pass 1 claims same pitch, pass 2 only the same pitch class
  (octave error); a wrong letter is extra plus a missed note; two presses of one pitch claim the two written
  notes in order (`repeated-pitch-two-presses`); two same-pitch onsets milliseconds apart never cross-match
  (`unison-two-voices`); a note-on with velocity 0 never claims; chatter under `PLAY_RETRIGGER_DEBOUNCE_MS` is
  coalesced; matching is on sounding key (`enharmonic-cs-db`, `transposing-part-sounding-pitch`); pass 1
  completes before pass 2; shuffling simultaneous messages changes nothing (FR-019)
- [ ] T019 [P] [US1] `tests/core/grade/grade.test.ts` (invariants): every expected note appears exactly once;
  `timing === null` exactly when `pitch === "missed"`; every recorded note-on is either one result's `playedKey`
  or exactly one `ExtraNote`, never both; pedal and velocity change no result (FR-018, FR-023)
- [ ] T020 [P] [US1] `tests/core/grade/golden.test.ts`: grading a recorded performance fixture produces a
  snapshot-identical `Grade` including every reason code, and grading it twice is byte-identical (FR-025, SC-001)
- [ ] T021 [P] [US1] `tests/core/grade/summary.test.ts`: the two figures of FR-028 with counts out of totals, the
  six plain counts, `meanAsynchronyMs`, and `timingNotResolvable` where the claim window collapses to the on-time
  window (FR-028)
- [ ] T022 [P] [US1] `tests/core/play/play-schedule.test.ts`: graded notes are absent from the schedule and the
  accompaniment is present (FR-005); the range slice keeps only its passes; the count-in is whole measures, at
  least one and at least `COUNT_IN_MIN_SECONDS`, in the meter and tempo at the range start, with the downbeat
  accented; a pickup's missing beats are clicked (`anacrusis-count-in`); a range starting on rests still ends its
  count-in on the barline (`range-start-mid-measure-rests`); compound meters click in dotted beats; the tempo map
  is shifted with the events; no Score event ever lands on `METRONOME_CHANNEL` (FR-003, FR-004)
- [ ] T023 [P] [US1] `tests/core/play/run.test.ts`: the reducer moves `countIn -> running` on a tick comparison,
  never a timer; input during the count-in is recorded but the run only grades from the first expected note's
  early claim window (D-4); recording continues for the last note's late claim window past the final onset; a stop
  yields exactly the expected notes up to the stop, marked incomplete (SC-010); losing the MIDI keyboard appends
  a reliability event and does **not** change phase (FR-044); `audioLost` moves to `aborted` (FR-046)
- [ ] T024 [P] [US1] `tests/engine/worklets/score-player.timing.test.ts` (extend): with sub-block rendering, a
  scheduled event is applied at its own frame, not at the block boundary; a metronome click lands within 3 ms of
  its correct time and accumulates no drift over a simulated 10-minute run across tempo and meter changes
  (SC-002)
- [ ] T025 [P] [US1] `tests/engine/worklets/dispatch.test.ts` (extend) and `score-player.live.test.ts` (extend):
  the `channelVolume` message applies CC7 to the named channel at the next block and is handled in
  `port.onmessage`, not in `process()`

### Implementation

- [ ] T026 [US1] `src/core/grade/expected.ts`: `buildExpectedNotes(score, timeline, selection, range)` calling
  002's `buildExpectedEvents` and flattening it (research R-15)
- [ ] T027 [US1] `src/core/grade/windows.ts`: window resolution with the floor/cap clamp, the chord-spread
  addition and the per-side neighbour clamp, all in integer ticks with inclusive boundaries
- [ ] T028 [US1] `src/core/grade/match.ts`: the two passes as order-preserving assignments per pitch and per pitch
  class, with the tie-breaks of [contracts/grading.md](contracts/grading.md) §3
- [ ] T029 [US1] `src/core/grade/summary.ts`: the two figures, the counts, `meanAsynchronyMs`, the per-pass
  overview and the reliability warnings
- [ ] T030 [US1] `src/core/grade/grade.ts`: `gradePerformance` - latency compensation, audio time to ticks, sort,
  match, timing, reasons, summary - synchronous and pure
- [ ] T031 [US1] `src/workers/grade.worker.ts` and its message handling in the controller, per
  [contracts/grading.md](contracts/grading.md) §Worker protocol, with the `GRADE_WORKER_TIMEOUT_MS` notice path
- [ ] T032 [US1] `src/core/schedule/play-schedule.ts`: `compilePlaySchedule` and `PlayTickMap` (research R-03)
- [ ] T033 [US1] `src/core/play/run.ts`: `playRunReducer` and its effects
- [ ] T034 [US1] `src/engine/worklets/score-player.processor.ts`: render each block in the sub-blocks
  `DispatchState.splits` already contains, applying each event at its own frame via
  `synth.process(left, right, startIndex, sampleCount)`. No allocation, no new state (Constitution I)
- [ ] T035 [US1] RT review of T034 with `rt-audio-reviewer` (mandatory, Constitution I)
- [ ] T036 [US1] `channelVolume` message in `src/engine/worklets/score-player.processor.ts` and
  `AudioEngine.setChannelVolume` in `src/engine/audio/web-audio-engine.ts`; bump
  `specs/001-score-viewer-listen/contracts/worklet-protocol.md` to 1.2.0
- [ ] T037 [US1] RT review of T036 with `rt-audio-reviewer` (mandatory, Constitution I)
- [ ] T038 [US1] `AudioEngine.latencyProfile()` in `src/engine/audio/web-audio-engine.ts` returning the
  **assumed** profile (reported output latency + the 001 R-12 input estimate), and the port additions in
  `src/engine/ports.ts`; bump `specs/001-score-viewer-listen/contracts/ports.md` to 1.2.0
- [ ] T039 [US1] `src/app/play-session.ts`: the controller - compile the run schedule, drive the reducer from
  position reports, record every MIDI message through the clock map, grade through the worker when the run ends
  (research R-01)
- [ ] T040 [US1] `src/ui/elements/mx-mode-switch.ts`: add Play, with the unavailable reason where Web MIDI is
  missing (FR-001, FR-045), and `src/ui/state/playState.ts` for run and Grade state
- [ ] T041 [US1] `src/ui/score/grade-marks.ts` and the mark shapes in `src/ui/styles/score.css`: pitch as
  colour + shape, timing as a left/right caret, extras in a lane below the staff; the layer never covers a
  notehead and switches off (research R-11, FR-029, FR-035)
- [ ] T042 [US1] `src/ui/elements/mx-grade-panel.ts`: the two figures with counts out of totals, the six counts,
  and the plain-words reason for a selected mark (FR-028, FR-030)
- [ ] T043 [US1] `src/ui/i18n/en.ts`: one string per `ResultReason` code, naming what was expected, what was
  played, the octave distance (not only the direction) and the millisecond difference; plus the Play notices
- [ ] T044 [US1] Live pitch marking during the run in `src/app/play-session.ts` and `grade-marks.ts`: a cheap
  same-pitch test against the notes at the cursor, display only, replaced by the Grade (FR-011, FR-011a). Assumes
  the recommended answer to D-3 (T087)
- [ ] T045 [US1] `tests/ui/grade-marks.test.ts`: every result state is distinguishable by shape in greyscale and
  survives a colour-blind-safe check; the layer switches off and clears on a new run or mode change (SC-008,
  FR-035)
- [ ] T046 [US1] `tests/e2e/us1-play.spec.ts`: count-in, a run driven by fake MIDI, a Grade with marks and
  reasons, and a stopped run yielding a partial Grade

**Checkpoint**: US1 fully functional and testable on its own - the MVP. A musician can play a piece to the
Metronome and be told, note by note, what happened.

---

## Phase 4: User Story 2 - Understand the Grade and know what to practise (Priority: P2)

**Goal**: step through the mistakes, see which measures went worst, know how trustworthy the timing is, and send
the worst passage into Practice mode.
**Independent Test**: grade a recorded performance with known mistakes in measures 3 and 7, step through the
mistakes, confirm the Score scrolls to each one with its reason, confirm the measure overview shows 3 and 7 as the
worst, and confirm "practise this passage" opens Practice mode looping those measures.

### Tests (write first, confirm they fail)

- [ ] T047 [P] [US2] `tests/core/grade/overview.test.ts`: the per-measure overview is keyed by measure **pass**,
  so each occurrence of a repeated measure is counted separately, and the known-mistake fixture puts measures 3
  and 7 worst (FR-032, AS-1.9)
- [ ] T048 [P] [US2] `tests/core/grade/reliability.test.ts`: an audio dropout, a dropped live message and a MIDI
  device loss each mark the measure passes they overlap as unreliable, with the reason, and leave the rest of the
  Grade usable (FR-015, AS-2.5)
- [ ] T049 [P] [US2] `tests/engine/storage/latency-profile.test.ts`: a measured profile round-trips through
  `musicanyya.latency.v1`; a missing or invalid key yields an assumed profile; a calibration whose spread exceeds
  `CALIBRATION_MAX_SPREAD_MS` is rejected with a reason (research R-05)
- [ ] T050 [P] [US2] `tests/core/play/calibration.test.ts`: the tap calibration takes the median signed offset
  over `CALIBRATION_BEATS`, discards offsets beyond half a beat, and is a pure function of the taps (R-05)
- [ ] T051 [P] [US2] `tests/ui/mistake-stepper.test.ts`: stepping forwards and backwards visits every mistake
  repeatedly, in Score order, scrolling to each (FR-031)

### Implementation

- [ ] T052 [US2] Per-pass overview and reliability warnings in `src/core/grade/summary.ts`, with the pass label
  Practice already uses for repeats (research R-12, R-14)
- [ ] T053 [US2] Reliability capture in `src/app/play-session.ts`: stamp audio dropouts, `liveQueueDropped` and
  MIDI device loss/return with their audio time during the run
- [ ] T054 [US2] `src/ui/elements/mx-grade-panel.ts` (extend): the per-measure overview and the mistake stepper
  (FR-031, FR-032)
- [ ] T055 [US2] "Practise this passage" in `src/app/play-session.ts` and the panel: convert the selected passes
  with 002's `passIndicesToLoopRange` and open Practice mode with the same `HandSelection` (FR-033)
- [ ] T056 [US2] `src/core/play/calibration.ts`: the pure median-offset calculation and its rejection rule
- [ ] T057 [US2] `src/ui/elements/mx-latency-panel.ts`: show the profile the Grade used, say plainly when it was
  assumed, and run the tap calibration on request (FR-034, AS-2.4)
- [ ] T058 [US2] `SettingsStore.loadLatencyProfile` / `saveLatencyProfile` in `src/engine/ports.ts` and
  `src/engine/storage/local-settings-store.ts`, with the `musicanyya.latency.v1` key
- [ ] T059 [US2] Result layer switch and clearing on a new run or mode change in `src/ui/elements/mx-score-view.ts`
  (FR-035, AS-2.6, AS-2.7)

**Checkpoint**: US1 and US2 both work independently - a Grade can be acted on, and the musician knows how much to
trust its timing.

---

## Phase 5: User Story 3 - Set up the run: passage, tempo, hands (Priority: P3)

**Goal**: play only the passage being worked on, at a manageable tempo, with one hand or both, and remember it.
**Independent Test**: set measures 5-8 at 70% tempo with "right hand only", run it, and confirm the count-in and
Metronome use the reduced tempo, only measures 5-8 are graded, and only right-hand notes are expected.

### Tests (write first, confirm they fail)

- [ ] T060 [P] [US3] `tests/core/play/range.test.ts`: a written measure range resolves to passes with 002's
  `loopRangeToPassIndices`, the run starts and ends there, and the Grade covers exactly those notes (FR-036,
  AS-3.1)
- [ ] T061 [P] [US3] `tests/core/grade/tempo-percent.test.ts`: at 70% and at 140% the Metronome, the
  accompaniment and every window use the tempo actually played, and a performance deviating by a constant
  fraction of a beat gets identical results at 60 and 160 bpm (FR-037, SC-014 first clause)
- [ ] T062 [P] [US3] `tests/core/grade/hands.test.ts`: with one hand selected only its notes are expected, and
  keys played for the other hand or another part are played-along, never wrong or extra (FR-024, FR-038, AS-3.3)
- [ ] T063 [P] [US3] `tests/engine/storage/play-settings.test.ts`: run settings round-trip per Score through
  `musicanyya.play.v1`, fall back to the last-used settings then to the defaults, and evict beyond
  `PLAY_SETTINGS_MAX` (FR-040)
- [ ] T064 [P] [US3] `tests/core/play/metronome-mute.test.ts`: muting changes only the click - the schedule, the
  tick map and the Grade are identical with and without it (AS-3.6)

### Implementation

- [ ] T065 [US3] Range, tempo percentage and hand selection plumbed through `compilePlaySchedule` and
  `buildExpectedNotes` in `src/app/play-session.ts`
- [ ] T066 [US3] `src/ui/elements/mx-play-panel.ts`: range, tempo percentage, part and hand selection (the same
  presets and preselection as Practice), strictness, count-in length, Metronome mute and accompaniment switches
  (FR-036 to FR-039)
- [ ] T067 [US3] Metronome mute through `AudioEngine.setChannelVolume` in `src/app/play-session.ts` - never by
  recompiling the schedule (research R-02)
- [ ] T068 [US3] `SettingsStore.loadPlay` / `savePlay` in `src/engine/ports.ts` and
  `src/engine/storage/local-settings-store.ts`, with the `musicanyya.play.v1` key and the per-Score cap
- [ ] T069 [US3] `tests/e2e/us3-play-setup.spec.ts`: a range at a reduced tempo with one hand, settings surviving
  a reload

**Checkpoint**: US1, US2 and US3 all work independently - a real practice session is possible.

---

## Phase 6: User Story 4 - Keep attempts and replay them (Priority: P4)

**Goal**: keep recent attempts on the device, hear one back against the Score, re-grade it, delete it.
**Independent Test**: play a piece twice, confirm both attempts are listed with date, settings and summary,
replay the first one and confirm the notes heard are the ones that were played, then delete it.

### Tests (write first, confirm they fail)

- [ ] T070 [P] [US4] `tests/engine/storage/performance-store.test.ts`: the `performances` store is created by the
  version 1 -> 2 upgrade without touching `recentScores`; records round-trip; `byScoreFinished` lists newest
  first; writing beyond `PERFORMANCES_PER_SCORE_MAX` drops the oldest; deleting removes the recording;
  `unavailable` and `quotaExceeded` are reported, never thrown (FR-041, FR-043)
- [ ] T071 [P] [US4] `tests/core/play/replay.test.ts`: a stored log compiles to a schedule whose note events land
  at the recorded times against the Score, with the accompaniment the run used and no timer anywhere (FR-042,
  research R-10)
- [ ] T072 [P] [US4] `tests/core/grade/regrade.test.ts`: re-grading a stored performance at a different
  strictness yields a different Grade and a byte-identical stored log (FR-027, SC-011)

### Implementation

- [ ] T073 [US4] `src/engine/storage/indexeddb-performance-store.ts`: the store, the version 2 upgrade, the
  retention rule and the `StoreResult` failure behaviour
- [ ] T074 [US4] Store the finished run in `src/app/play-session.ts` with its settings, Latency profile, app
  version and summary (FR-014, FR-041)
- [ ] T075 [US4] `src/core/play/replay.ts`: compile a stored log into a `ScheduleMessage` on the live channel's
  instrument, merged with the run's accompaniment
- [ ] T076 [US4] `src/ui/elements/mx-attempts-list.ts`: the recent attempts with date, settings and summary, and
  the replay, re-grade and delete actions, stating how many attempts are kept (FR-041 to FR-043, AS-4.6)
- [ ] T077 [US4] Bump `specs/001-score-viewer-listen/contracts/storage.md` to IndexedDB schema 2 and record the
  new `localStorage` keys

**Checkpoint**: all four stories work independently.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T078 [P] `tests/core/grade/perf.test.ts`: a 500-measure run grades within the SC-006 budget, and the
  controller never blocks the main thread for more than 50 ms while it does (grading must go through the worker)
- [ ] T079 [P] `tests/e2e/us2-grade.spec.ts`: the same acceptance scenarios pass in the browser and in the
  Electron project from one build (FR-047, SC-012)
- [ ] T080 [P] MIDI hot-plug during a run: unplug and replug within one run, recording resumes within 3 seconds,
  the run never stops and the gap is on the Grade (SC-013) - `tests/core/play/device-loss.test.ts`
- [ ] T081 [P] Update `docs/agents/reference.md` if anything in the toolchain or the commands changed, and
  `quickstart.md` if a command changed
- [ ] T082 Run the `quickstart.md` manual verification script for all four user stories on a real MIDI keyboard
- [ ] T083 Constitution audit of the finished feature with `constitution-auditor`, in particular Principle I over
  T034 and T036 and Principle II over the one-clock and latency-compensation path
- [ ] T084 Full quality gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` - all green

---

## Blocked on owner decisions (plan.md "Open owner decisions")

These are not scheduled. T087 should be answered before Phase 3 starts; the others can be answered any time.

- [ ] T085 **D-1 ornaments**: if accepted, parse `<ornaments>`, `<trill-mark>`, `<mordent>`, `<turn>` and
  `<tremolo>` in `src/core/musicxml/build.ts`, carry them on `Note`, treat presses of an ornamented note's pitch
  and its diatonic neighbours within its written duration as played-along, and update
  `docs/musicxml-support.md` and `SUPPORT_MATRIX`. Add fixture `trill-realisation`
- [ ] T086 **D-2 written arpeggios**: if accepted, parse `<arpeggiate>` in `src/core/musicxml/build.ts`, add
  `PLAY_ARPEGGIO_SPREAD_BEATS = 0.5` and use it in place of the chord spread there; update
  `docs/musicxml-support.md`. Add fixture `arpeggiate-chord`
- [ ] T087 **D-3 SC-015**: if SC-015 stands as written, T044 changes from a cheap pitch test to a live mirror of
  the matcher and gains its own tests; if it is softened (the recommendation), amend SC-015 in `spec.md` to a
  measured rate over the reference fixtures and record the disagreement mechanism
- [ ] T088 **D-4 FR-003**: if the owner prefers the literal reading, remove the count-in reach-back from T023 and
  T033 and amend [data-model.md](data-model.md) §2; the design and this list assume the recommended fix

---

## Dependencies & Execution Order

- Setup (T001-T003) -> Foundational (T004-T015) -> US1 (T016-T046) -> US2 (T047-T059) -> US3 (T060-T069) ->
  US4 (T070-T077) -> Polish (T078-T084).
- Within a story: tests -> core -> engine -> UI -> RT review.
- Notable cross-task dependencies:
  - T009 (`tickAtAudioTime`) blocks T030, and T011 (clock map) blocks T039: nothing can be graded before input
    and Score share one clock.
  - T013 (the strictness record) blocks T027, which blocks T028 and T030.
  - T032 (the run schedule) blocks T033 and T039; T034/T036 (worklet) block T039's Metronome behaviour.
  - T031 (the worker) blocks T039's grading path and T078's main-thread assertion.
  - T038 (the assumed profile) is enough for US1; T056-T058 (the measured profile) belong to US2 and must not be
    pulled into the MVP.
  - T052 (per-pass overview) depends on T029; T055 depends on 002's `passIndicesToLoopRange`, already in the tree.
  - T073 (the store) blocks T074 and T076; T075 depends on T032's accompaniment schedule.
  - T035 and T037 must follow T034 and T036 respectively, before either is merged (Constitution I).

## Parallel Opportunities

- **Setup**: T002 and T003 together.
- **Foundational**: T005, T006, T007 together; T012 and T014 and T015 together once T005 is in.
- **US1 tests**: T016 to T025 are ten independent test files and can all be written in parallel.
- **US1 implementation**: T026, T027 and T032 touch different files and can start together once their tests fail;
  T034 and T036 are the same file and must **not** be parallel.
- **US2 tests**: T047 to T051 together. **US3 tests**: T060 to T064 together. **US4 tests**: T070 to T072
  together.
- **Polish**: T078, T079, T080 and T081 together.
- Stories US2, US3 and US4 touch mostly different files and can be staffed in parallel once US1's checkpoint is
  passed; the shared files to watch are `src/app/play-session.ts` (US2 T053/T055, US3 T065/T067, US4 T074) and
  `src/ui/elements/mx-grade-panel.ts` (US1 T042, US2 T054).
