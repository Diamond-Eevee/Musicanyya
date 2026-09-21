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

**Owner decisions**: all four (D-1 ornaments, D-2 arpeggios, D-3 SC-015, D-4 count-in window) were **answered
with the recommendation on 2026-09-20** and are written into `spec.md`, `data-model.md` and the contracts. D-1
and D-2 are accepted, so ornament and arpeggio parsing are real work here (T085, T086, T101, T102); D-3 is
softened (the live marker stays a cheap same-pitch test, T044); D-4 is accepted (recording and matching reach
back into the count-in, T023/T033). T087 and T088 were the amendment tasks and are done.

**`/speckit.analyze` (2026-09-20)** added T089-T103 and reworded a dozen tasks. New task IDs are appended rather
than renumbered, so IDs stay stable; **file order is execution order**, not numeric order.

---

## Phase 1: Setup

- [x] T001 Verify (do not edit unless something is missing) that the new paths are already covered: `src/core/**`
  in `tsconfig.core.json` covers `src/core/play` and `src/core/grade`; `src/workers/**` is in
  `tsconfig.engine.json`; the vitest `core` project already includes `tests/core/**` and `engine` includes
  `tests/engine/**`. No dependency is added in this feature, so `package.json` must stay unchanged
- [x] T002 [P] Add the musical constants of [data-model.md](data-model.md) §10 to `src/core/defaults.ts`
  (`PLAY_COUNT_IN_MEASURES`, `COUNT_IN_MIN_SECONDS`, `COUNT_IN_INCLUDES_ANACRUSIS`, `METRONOME_CHANNEL`,
  `METRONOME_KEY_BEAT`, `METRONOME_KEY_DOWNBEAT`, `METRONOME_VELOCITY_BEAT`, `METRONOME_VELOCITY_DOWNBEAT`,
  `PLAY_STRICTNESS_DEFAULT`, `PLAY_BEAT_UNIT_SOURCE`, `PLAY_ARPEGGIO_SPREAD_BEATS`,
  `ORNAMENT_NEIGHBOUR_STEPS`, `PLAY_NEIGHBOUR_GAP_FRACTION`, `PLAY_WINDOW_ABSOLUTE_FLOOR_MS`,
  `PLAY_RETRIGGER_DEBOUNCE_MS`,
  `CALIBRATION_BEATS`, `CALIBRATION_TEMPO_QPM`, `CALIBRATION_MAX_SPREAD_MS`), each with a one-line comment naming
  the rule it encodes
- [x] T003 [P] Add the platform limits of [data-model.md](data-model.md) §10 to `src/engine/config.ts`
  (`PERFORMANCES_PER_SCORE_MAX`, `PLAY_SETTINGS_MAX`, `GRADE_WORKER_TIMEOUT_MS`)

---

## Phase 2: Foundational (blocks all user stories)

- [x] T004 Play domain types in `src/core/play/types.ts`, exactly the shapes in
  [contracts/play-run.md](contracts/play-run.md) and [data-model.md](data-model.md) §1, §2, §7 (`PlayRun`,
  `RunPhase`, `PlayAction`, `PlayEffect`, `PlayNoticeCode`, `PlayTickMap`, `PlayScheduleOptions`, `RunSettings`,
  `ReliabilityEvent`) - types only, no logic
- [x] T005 [P] Grade domain types in `src/core/grade/types.ts`, exactly the shapes in
  [contracts/grading.md](contracts/grading.md) and [data-model.md](data-model.md) §3-§6, §8, §9 (`ExpectedNote`,
  `PitchResult`, `TimingResult`, `NoteResult`, `ExtraNote`, `ResultReason`, `StrictnessLevelName`,
  `StrictnessLevel`, `Window`, `GradeInput`, `Grade`, `GradeSummary`, `MeasureOverview`, `ReliabilityWarning`,
  `PerformanceLog`, `RecordedMessage`, `LatencyProfile`, and `PlayedAlongSpan` / `PlayedAlongPress` of section 4)
  - types only. `timing` is `TimingResult | null`, so the two-axis rule is in the type system
- [x] T006 [P] Test helper `tests/core/grade/helpers.ts`: load a fixture by name and return
  `{ score, timeline, expected }`, reusing `tests/core/practice/helpers.ts` so every grading test starts from a
  real Score
- [x] T007 [P] Test helper `tests/fakes/performance-log.ts`: build a `PerformanceLog` from a compact notation
  (pitch, beat offset, deliberate millisecond error), plus `shuffleSimultaneous` for the arrival-order
  independence assertion of FR-019 and `loadRecordedPerformance` for the JSON fixtures
- [x] T008 Test `tests/core/tempo/rate.test.ts` (extend): `tickAtAudioTime` is the exact inverse of the existing
  tick-to-time conversion across tempo changes and tempo percentages, on integer boundaries - write it, see it
  fail
- [x] T009 Implement `tickAtAudioTime` in `src/core/tempo/rate.ts`: the single place seconds become ticks
  (Constitution II, research R-06)
- [x] T010 [P] Test `tests/engine/midi/clock-map.test.ts`: `performance.now()` timestamps map onto audio-context
  seconds from a `(contextTime, performanceTime)` pair; a new pair re-anchors without jumping; a missing pair
  falls back to the last known one - write it, see it fail
- [x] T011 Implement `src/engine/midi/clock-map.ts` per research R-04, storing both the mapped `audioTimeSec` and
  the raw `timeStampMs`
- [x] T012 [P] Test `tests/core/grade/windows.test.ts` (invariants part): for every level, `floorMs <= beats*375`
  and `capMs >= beats*1000` (clamp inertness, SC-014 first clause) and `onTime <= claim` after every clamp -
  asserted over the whole record, not per level
- [x] T013 Add the `PLAY_STRICTNESS_LEVELS` record (Beginner, Standard, Strict) to `src/core/defaults.ts` with
  the values of [data-model.md](data-model.md) §6, each window as `{ beats, floorMs, capMs }`, including
  `arpeggioSpread` (D-2)
- [x] T014 [P] New MusicXML fixtures in `tests/fixtures/musicxml/` with origin and licence in the fixtures
  README: `window-beat-unit-6-8`, `neighbour-clamp-sixteenths-160`, `repeated-pitch-two-presses`,
  `unison-two-voices`, `anacrusis-count-in`, `range-start-mid-measure-rests`, `enharmonic-cs-db`,
  `transposing-part-sounding-pitch`, `first-note-early-into-count-in`, `last-note-late-past-end`,
  `chord-spread-rolled`, `played-along-both-hands`, `metronome-channel-collision` (a Score whose parts reach
  channel 14) - see quickstart §3. `arpeggiate-chord` and `trill-realisation` come with T085/T086. Real files
  with real notation - no placeholders (AGENTS.md section 4)
- [x] T015 [P] Recorded performance fixtures in `tests/fixtures/performances/`: the JSON `PerformanceLog` format
  of [contracts/performance-log.md](contracts/performance-log.md), one accurate take and one with known mistakes
  in measures 3 and 7 (the spec's US2 Independent Test), each naming its Score and settings
- [x] T090 RT review of T009 and T011 with `rt-audio-reviewer` (mandatory): the tick <-> audio-time conversion and
  the MIDI timestamp mapping are timing code in that role's scope (Constitution II, and this file's own rule).
  It must confirm one conversion site, no `performance.now()` at receipt, no float accumulation of musical time
- [x] T094 [P] Test `tests/core/timeline/instruments.test.ts` (extend): no Score part is ever allocated to
  `METRONOME_CHANNEL`, neither by an explicit `<midi-channel>` hint (`metronome-channel-collision`) nor by the
  round-robin fallback when channels run out - write it, see it fail (research R-19)
- [x] T095 Reserve `METRONOME_CHANNEL` in `src/core/timeline/instruments.ts` beside `PERCUSSION_CHANNEL` and
  `LIVE_CHANNEL`, and record the reserved channel in the channel table of
  `specs/001-score-viewer-listen/contracts/worklet-protocol.md` (bumped with T036)
- [x] T102 [P] Test `tests/core/musicxml/build.test.ts` (extend): `<arpeggiate>` on a chord and `<ornaments>` with
  `<trill-mark>`, `<mordent>`, `<turn>` or `<tremolo>` are parsed onto `Note`; a Score without them is unchanged;
  an unknown ornament child is skipped and reported, never fatal (Constitution III) - write it, see it fail
- [x] T085 Parse `<ornaments>`, `<trill-mark>`, `<mordent>`, `<turn>` and `<tremolo>` in
  `src/core/musicxml/build.ts` and carry them on `Note` (owner decision D-1); add the ornament rows to
  `SUPPORT_MATRIX` in `src/core/musicxml/support.ts` and to `docs/musicxml-support.md`
  (`tests/core/musicxml/support-doc-sync.test.ts` enforces the pair). Add fixture `trill-realisation`
- [x] T086 Parse `<arpeggiate>` in `src/core/musicxml/build.ts` and carry it on the chord's notes (owner decision
  D-2); add its row to `SUPPORT_MATRIX` and `docs/musicxml-support.md`. Add fixture `arpeggiate-chord`.
  `<glissando>` and `<slide>` stay unsupported and keep being reported by the load report (research R-17)
- [x] T104 [P] New MusicXML fixture `eight-measure-melody` in `tests/fixtures/musicxml/`: an 8-measure, 4/4,
  single-part, single-voice melody at a clear tempo (found missing during T015 - no existing fixture is long
  enough and simple enough to name specific "mistakes in measures 3 and 7" or a "measures 5-8" range against;
  US2's and US3's Independent Tests need one). Used by T015's performance-log fixtures and reusable by US2/US3

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

- [x] T016 [P] [US1] `tests/core/grade/expected.test.ts`: `buildExpectedNotes` flattens 002's expected events one
  per required key; grace notes, ornaments, hidden, playback-only, unpitched and percussion notes and the
  unselected hand/part are never expected; a tie chain appears once at its onset; each repeat occurrence appears
  separately in Listen order (FR-017, FR-021, SC-005)
- [x] T017 [P] [US1] `tests/core/grade/windows.test.ts` (resolution part): fraction of a beat resolves in ticks;
  the beat is the dotted quarter in 6/8 (`window-beat-unit-6-8`); floor and cap bite only outside 60-160 bpm; the
  neighbour clamp is applied **after** the floor and gives ±46.9 ms for sixteenths at 160 bpm
  (`neighbour-clamp-sixteenths-160`); adjacent claim windows meet at the midpoint with no gap and no overlap at
  40, 60, 120, 160 and 208 bpm (SC-014)
- [x] T018 [P] [US1] `tests/core/grade/match.test.ts`: pass 1 claims same pitch, pass 2 only the same pitch class
  (octave error); a wrong letter is extra plus a missed note; two presses of one pitch claim the two written
  notes in order (`repeated-pitch-two-presses`); two same-pitch onsets milliseconds apart never cross-match
  (`unison-two-voices`); a note-on with velocity 0 never claims; chatter under `PLAY_RETRIGGER_DEBOUNCE_MS` is
  coalesced; matching is on sounding key (`enharmonic-cs-db`, `transposing-part-sounding-pitch`); pass 1
  completes before pass 2; shuffling simultaneous messages changes nothing (FR-019)
- [x] T019 [P] [US1] `tests/core/grade/grade.test.ts` (invariants): every expected note appears exactly once;
  `timing === null` exactly when `pitch === "missed"`; every recorded note-on ends as exactly one of a result's
  `playedKey`, one `PlayedAlongPress` or one `ExtraNote` - never two of them, never twice; pedal and velocity
  change no result (FR-018, FR-023, FR-024)
- [x] T020 [P] [US1] `tests/core/grade/golden.test.ts`: grading a recorded performance fixture produces a
  snapshot-identical `Grade` including every reason code, and grading it twice is byte-identical (FR-025, SC-001)
- [x] T021 [P] [US1] `tests/core/grade/summary.test.ts`: the two figures of FR-028 with counts out of totals, the
  six plain counts, `meanAsynchronyMs`, and `timingNotResolvable` where the claim window collapses to the on-time
  window or falls below `PLAY_WINDOW_ABSOLUTE_FLOOR_MS`; played-along presses appear in no count (FR-028)
- [x] T022 [P] [US1] `tests/core/play/play-schedule.test.ts`: graded notes are absent from the schedule and the
  accompaniment is present (FR-005); the range slice keeps only its passes; the count-in is whole measures, at
  least one and at least `COUNT_IN_MIN_SECONDS`, in the meter and tempo at the range start, with the downbeat
  accented; a pickup's missing beats are clicked (`anacrusis-count-in`); a range starting on rests still ends its
  count-in on the barline (`range-start-mid-measure-rests`); compound meters click in dotted beats; the tempo map
  is shifted with the events; no Score event ever lands on `METRONOME_CHANNEL` (FR-003, FR-004)
- [x] T023 [P] [US1] `tests/core/play/run.test.ts`: the reducer moves `countIn -> running` on a tick comparison,
  never a timer; input during the count-in is recorded but the run only grades from the first expected note's
  early claim window (D-4); recording continues for the last note's late claim window past the final onset; a stop
  yields exactly the expected notes up to the stop, marked incomplete (SC-010); losing the MIDI keyboard appends
  a reliability event and does **not** change phase (FR-044); `audioLost` moves to `aborted` (FR-046)
- [x] T024 [P] [US1] `tests/engine/worklets/score-player.timing.test.ts` (extend): with sub-block rendering, a
  scheduled event is applied at its own frame, not at the block boundary; a metronome click lands within 3 ms of
  its correct time and accumulates no drift over a simulated 10-minute run across tempo and meter changes
  (SC-002)
- [x] T025 [P] [US1] `tests/engine/worklets/dispatch.test.ts` (extend, N/A - see log) and `score-player.live.test.ts` (extend):
  the `channelVolume` message applies CC7 to the named channel at the next block and is handled in
  `port.onmessage`, not in `process()`
- [x] T089 [P] [US1] `tests/core/grade/timing-accuracy.test.ts`: a synthetic performance played exactly on time is
  100% correct **and on time**, never early or late, at 40, 60, 120, 160 and 208 bpm (SC-003); a performance
  displaced by a known offset (+-15, +-40, +-200 ms) reports a `deltaMs` within 5 ms of what was injected once the
  Latency profile is compensated, with an assumed and with a measured profile (SC-004, FR-013). These are the only
  checks that latency compensation has the right sign and size
- [x] T092 [P] [US1] `tests/core/grade/played-along.test.ts`: keys of the ungraded hand or another part, and the
  presses that realise a written ornament (`trill-realisation`), become `PlayedAlongPress` - never wrong, never
  extra, counted in no figure; a press that *could* claim a graded note still claims it, because pass 3 runs last;
  a press outside every span stays extra (FR-024, SC-016, research R-18)
- [x] T101 [P] [US1] `tests/core/grade/chord-spread.test.ts`: a chord rolled by hand within the chord spread is on
  time for every member (`chord-spread-rolled`); the same roll is late without the spread; a chord the Score
  writes `<arpeggiate>` uses `PLAY_ARPEGGIO_SPREAD_BEATS` instead and is not late (`arpeggiate-chord`); a chord
  never shrinks its own members' windows (FR-022, SC-016)
- [x] T096 [P] [US1] `tests/engine/workers/grade-worker.test.ts`: the `grade` / `graded` / `error` messages of
  [contracts/grading.md](contracts/grading.md) round-trip as structured-cloneable data, `requestId` pairs
  request and reply, and a worker that never answers becomes a notice after `GRADE_WORKER_TIMEOUT_MS`, not a hang
- [x] T097 [P] [US1] `tests/engine/play-session.test.ts`: the controller against the fakes - every MIDI message is
  recorded through the clock map with both times, grading goes **through the worker** and never inline, the run
  reducer is driven by position reports only, and a finished run produces exactly one Grade (FR-012, FR-026)
- [x] T045 [P] [US1] `tests/ui/grade-marks.test.ts`: every result state is distinguishable by shape in greyscale
  and survives a colour-blind-safe check; the layer switches off and clears on a new run or mode change (SC-008,
  FR-035). *(Out of numeric order on purpose: it is a test and belongs before T041-T044, Constitution IV.)*

### Implementation

- [x] T026 [US1] `src/core/grade/expected.ts`: `buildExpectedNotes(score, timeline, selection, range)` calling
  002's `buildExpectedEvents` and flattening it, carrying `arpeggiated` from the chord (research R-15, D-2)
- [x] T027 [US1] `src/core/grade/windows.ts`: window resolution with the floor/cap clamp, the chord-spread
  addition (or `arpeggioSpread` where the chord is written `<arpeggiate>`) and the per-side neighbour clamp, all
  in integer ticks with inclusive boundaries. The neighbour clamp is final: a window under
  `PLAY_WINDOW_ABSOLUTE_FLOOR_MS` is **not** raised, it is flagged for `timingNotResolvable`
  ([contracts/grading.md](contracts/grading.md) §2 rules 6 and 7)
- [x] T028 [US1] `src/core/grade/match.ts`: the two passes as order-preserving assignments per pitch and per pitch
  class, with the tie-breaks of [contracts/grading.md](contracts/grading.md) §3
- [x] T105 [US1] Add `step: string` (the written pitch letter, `'C'`-`'B'`) to `Note` in `src/core/score/model.ts`,
  populated in `src/core/musicxml/build.ts` from the same local already parsed for `writtenKey` (found missing
  while starting T093 - `buildPlayedAlongSpans`'s diatonic ornament neighbours need the letter name to step by,
  and `Note` currently keeps only the resolved MIDI key, having already discarded it). Update the two
  Note-literal test factories (`tests/core/timeline/timeline.test.ts`, `tests/core/timeline/instruments.test.ts`)
  for the new required field. **Known limitation, not fixed here**: the neighbour's accidental is left natural
  (no key signature is tracked anywhere in the Score model yet), so a diatonic neighbour is exactly right in C
  major/A minor and only letter-correct elsewhere - flagged as a follow-up rather than expanding this task's
  scope into key-signature parsing
- [x] T093 [US1] `buildPlayedAlongSpans` in `src/core/grade/expected.ts` and pass 3 in `src/core/grade/match.ts`:
  spans from 002's `ExpectedEvent.accompaniment` (`source: "ungraded"`) and from ornamented notes (their own key
  plus `ORNAMENT_NEIGHBOUR_STEPS` diatonic neighbours over the written duration, `source: "ornament"`); a
  leftover press inside a span becomes a `PlayedAlongPress` instead of an `ExtraNote`. Add `playedAlong` to
  `GradeInput` and to `Grade` (grading contract 1.0.0 -> 1.1.0, research R-18, FR-024)
- [x] T029 [US1] `src/core/grade/summary.ts`: the two figures, the counts, `meanAsynchronyMs`, the per-pass
  overview and the reliability warnings; `playedAlong` presses are counted in nothing
- [x] T030 [US1] `src/core/grade/grade.ts`: `gradePerformance` - latency compensation, audio time to ticks, sort,
  match (passes 1, 2 and the played-along pass 3), timing, reasons, summary including `timingNotResolvable` -
  synchronous and pure. The count-in filter is "no press earlier than `firstOnsetTick - claimEarly(first)`", and
  matching continues for `claimLate(last)` past the final onset (D-4)
- [x] T031 [US1] `src/workers/grade.worker.ts` and its message handling in the controller, per
  [contracts/grading.md](contracts/grading.md) §Worker protocol, with the `GRADE_WORKER_TIMEOUT_MS` notice path
- [x] T032 [US1] `src/core/schedule/play-schedule.ts`: `compilePlaySchedule` and `PlayTickMap` (research R-03).
  It **asserts** that no Score event is on `METRONOME_CHANNEL` (T095 guarantees it upstream) rather than dropping
  events silently
- [x] T091 [US1] RT review of T030 and T032 with `rt-audio-reviewer` (mandatory): the latency compensation and the
  run's schedule compiler are timing code in that role's scope - one conversion site, integer ticks throughout,
  the count-in and clicks scheduled as data with no timer anywhere (Constitution I and II)
- [x] T033 [US1] `src/core/play/run.ts`: `playRunReducer` and its effects
- [x] T034 [US1] `src/engine/worklets/score-player.processor.ts`: render each block in the sub-blocks
  `DispatchState.splits` already contains, applying each event at its own frame via
  `synth.process(left, right, startIndex, sampleCount)`. No allocation, no new state (Constitution I)
- [x] T035 [US1] RT review of T034 with `rt-audio-reviewer` (mandatory, Constitution I)
- [x] T036 [US1] `channelVolume` message in `src/engine/worklets/score-player.processor.ts` and
  `AudioEngine.setChannelVolume` in `src/engine/audio/web-audio-engine.ts`; bump
  `specs/001-score-viewer-listen/contracts/worklet-protocol.md` to 1.2.0
- [x] T037 [US1] RT review of T036 with `rt-audio-reviewer` (mandatory, Constitution I)
- [x] T038 [US1] `AudioEngine.latencyProfile()` in `src/engine/audio/web-audio-engine.ts` returning the
  **assumed** profile (reported output latency + the 001 R-12 input estimate), and the port additions in
  `src/engine/ports.ts`; bump `specs/001-score-viewer-listen/contracts/ports.md` to 1.2.0
- [x] T039 [US1] `src/app/play-session.ts`: the controller - compile the run schedule, drive the reducer from
  position reports, record every MIDI message through the clock map, grade through the worker when the run ends
  (research R-01)
- [x] T040 [US1] `src/ui/elements/mx-mode-switch.ts`: add Play, with the unavailable reason where Web MIDI is
  missing (FR-001, FR-045) and the `playNothingToGrade` notice for a Score with nothing gradable (spec edge
  case), and `src/ui/state/playState.ts` for run and Grade state
- [x] T041 [US1] `src/ui/score/grade-marks.ts` and the mark shapes in `src/ui/styles/score.css`: pitch as
  colour + shape, timing as a left/right caret, extras in a lane below the staff; the layer never covers a
  notehead and switches off (research R-11, FR-029, FR-035)
- [x] T042 [US1] `src/ui/elements/mx-grade-panel.ts`: the two figures with counts out of totals, the six counts,
  and the plain-words reason for a selected mark (FR-028, FR-030)
- [x] T043 [US1] `src/ui/i18n/en.ts`: one string per `ResultReason` code, naming what was expected, what was
  played, the octave distance (not only the direction) and the millisecond difference; plus the Play notices
- [x] T044 [US1] Live pitch marking during the run in `src/app/play-session.ts` and `grade-marks.ts`: a cheap
  same-pitch test against the notes at the cursor marking **correct only**, display only, replaced by the Grade
  (FR-011, FR-011a; `liveMark` carries no `pitch` since play-run 1.1.0). D-3 is decided: the marker never
  establishes a wrong pitch, and SC-015 measures the agreement rate over the reference fixtures
- [x] T107 [US1] Wire `PlaySessionController` (T039) into `src/app/session.ts` for real: construct it once alongside
  the existing `audioEngine`/`midiInput`/a real `GradeWorkerLike`; branch `handlePlay`/`pause`/`stop` and the
  `measureclick` handler for `mode === 'play'` the same way they already branch for `'practice'`; drive
  `reportPosition(nowMs)` from the same rAF loop that already ticks the cursor in `mx-score-view` (T039's own
  design note - nothing calls it yet, `PlaySessionController` is exercised only by `tests/engine/play-session.test.ts`'s
  fakes so far); build a default `RunSettings` from `partOptions`/`handOptions` (whole Score, the first
  keyboard-like pitched part, `PLAY_STRICTNESS_LEVELS`'s most forgiving level per FR-039) until US3 (T065/T066)
  lets the musician change it; raise `playNothingToGrade` (`buildExpectedNotes(...).length === 0`, mirroring
  `startPractice`'s own `practiceNothingToPlay` check) instead of starting a run with nothing to grade; wire the
  controller's callbacks to `playState.setRun`/`setGrade` and `noticeState`. Also wire `mx-score-view.ts`'s render
  loop to call `drawGradeMarks` when `mode === 'play'` (switched off and cleared the same way `drawPracticeState`
  already is, FR-035) and its `onClick` to call `playState.selectNote(id)` on a `g.note` click in Play mode, the
  way it already resolves a `.measure` click - `mx-grade-panel.ts` (T042) already reads `playState.selectedNoteId`
  and has nothing to select yet. **Found missing while implementing
  T040** (2026-09-21): no task in this phase names `src/app/session.ts`, but T046's e2e test and the US1
  Checkpoint both need a working "switch to Play, press Play, get a Grade" path, which only this wiring provides
- [x] T046 [US1] `tests/e2e/us1-play.spec.ts`: count-in, a run driven by fake MIDI, a Grade with marks and
  reasons, and a stopped run yielding a partial Grade; plus the three things only an end-to-end run shows - the
  musician's own notes sound through the app's instrument (FR-006), the cursor follows and stops following under
  Listen mode's Follow rules (FR-007), and starting a run from an open Score takes at most two actions (SC-009)
- [x] T109 [US1] Two gaps found and fixed while writing T046 (both needed for it to pass against the real app, not
  just the fakes `tests/engine/play-session.test.ts` already covered): (1) `playState.run` (`src/ui/state/playState.ts`)
  was set once by `startPlay()` and never refreshed, so `run.phase` stayed frozen at `'countIn'` forever even
  though `PlaySessionController`'s own internal run kept advancing correctly - `PlayPositionReporter`
  (`src/ui/elements/mx-score-view.ts`) gained a `getRun()` method, and the one per-frame driver (`tick()`, T039's
  own design) now calls `playState.setRun(...)` every frame alongside `reportPosition`, cheap even at 60fps since
  `createStore`'s `deepEqual` only notifies `mx-grade-panel`'s one subscriber when something actually changed. (2)
  FR-007 (cursor follow) was entirely unwired: `drawPlayState()` only ever drew marks, and `startPlay()` never
  called `setPlayback()`, so `mx-score-view` had no timeline to follow-scroll against. Added `followPlayCursor()`
  (mirrors `drawPracticeState`'s own follow call - no cursor rectangle, Play's canvas is the marks layer), which
  converts `run.positionRunTick` back to timeline-tick space via `run.tickMap` (contracts/play-run.md's own tick
  formula) and calls the existing `followScrollTo`; `startPlay()` now also calls `setPlayback()` so a Score opened
  straight into Play (never having used Listen first) still has a timeline to follow against

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

- [x] T047 [P] [US2] `tests/core/grade/overview.test.ts`: the per-measure overview is keyed by measure **pass**,
  so each occurrence of a repeated measure is counted separately, and the known-mistake fixture puts measures 3
  and 7 worst (FR-032, AS-1.9)
- [x] T048 [P] [US2] `tests/core/grade/reliability.test.ts`: an audio dropout, a dropped live message and a MIDI
  device loss each mark the measure passes they overlap as unreliable, with the reason, and leave the rest of the
  Grade usable (FR-015, AS-2.5)
- [x] T049 [P] [US2] `tests/engine/storage/latency-profile.test.ts`: a measured profile round-trips through
  `musicanyya.latency.v1`; a missing or invalid key yields an assumed profile; a calibration whose spread exceeds
  `CALIBRATION_MAX_SPREAD_MS` is rejected with a reason (research R-05)
- [x] T050 [P] [US2] `tests/core/play/calibration.test.ts`: the tap calibration takes the median signed offset
  over `CALIBRATION_BEATS`, discards offsets beyond half a beat, and is a pure function of the taps (R-05)
- [x] T051 [P] [US2] `tests/ui/mistake-stepper.test.ts`: stepping forwards and backwards visits every mistake
  repeatedly, in Score order, scrolling to each (FR-031)

### Implementation

- [x] T052 [US2] Per-pass overview and reliability warnings in `src/core/grade/summary.ts`, with the pass label
  Practice already uses for repeats (research R-12, R-14)
- [x] T053 [US2] Reliability capture in `src/app/play-session.ts`: stamp audio dropouts, `liveQueueDropped` and
  MIDI device loss/return with their audio time during the run
- [x] T098 [US2] Audio loss detection (FR-046): map the engine's `suspended{reason:'deviceChanged'}` and a
  changed `AudioContext.sampleRate` to the reducer's `audioLost` action in `src/app/play-session.ts`, with the
  test first in `tests/engine/play-session.test.ts` - the run stops, the partial Grade is produced and the whole
  Grade is marked unreliable. Nothing else raises `audioLost`, which is why T023 alone did not cover it
- [x] T054 [US2] `src/ui/elements/mx-grade-panel.ts` (extend): the per-measure overview and the mistake stepper
  (FR-031, FR-032)
- [x] T055 [US2] "Practise this passage" in `src/app/play-session.ts` and the panel: convert the selected passes
  with 002's `passIndicesToLoopRange` and open Practice mode with the same `HandSelection` (FR-033)
- [x] T056 [US2] `src/core/play/calibration.ts`: the pure median-offset calculation and its rejection rule
- [x] T057 [US2] `src/ui/elements/mx-latency-panel.ts`: show the profile the Grade used, say plainly when it was
  assumed, and run the tap calibration on request (FR-034, AS-2.4)
- [x] T058 [US2] `SettingsStore.loadLatencyProfile` / `saveLatencyProfile` in `src/engine/ports.ts` and
  `src/engine/storage/local-settings-store.ts`, with the `musicanyya.latency.v1` key
- [x] T059 [US2] Result layer switch and clearing on a new run or mode change in `src/ui/elements/mx-score-view.ts`
  (FR-035, AS-2.6, AS-2.7)

**Checkpoint**: US1 and US2 both work independently - a Grade can be acted on, and the musician knows how much to
trust its timing.

---

## Phase 5: User Story 3 - Set up the run: passage, tempo, hands (Priority: P3)

**Goal**: play only the passage being worked on, at a manageable tempo, with one hand or both, and remember it.
**Independent Test**: set measures 5-8 at 70% tempo with "right hand only", run it, and confirm the count-in and
Metronome use the reduced tempo, only measures 5-8 are graded, and only right-hand notes are expected.

### Tests (write first, confirm they fail)

- [x] T060 [P] [US3] `tests/core/play/range.test.ts`: a written measure range resolves to passes with 002's
  `loopRangeToPassIndices`, the run starts and ends there, and the Grade covers exactly those notes (FR-036,
  AS-3.1) (claimed: antigravity-3.1-pro 2026-09-21)
- [x] T061 [P] [US3] `tests/core/grade/tempo-percent.test.ts`: at 70% and at 140% the Metronome, the
  accompaniment and every window use the tempo actually played, and a performance deviating by a constant
  fraction of a beat gets identical results at 60 and 160 bpm (FR-037, SC-014 first clause) (claimed: antigravity-3.1-pro 2026-09-21)
- [x] T062 [P] [US3] `tests/core/grade/hands.test.ts`: with one hand selected only its notes are expected, and
  keys played for the other hand or another part are played-along, never wrong or extra - the hand-selection view
  of the played-along path T092/T093 built for US1 (FR-024, FR-038, AS-3.3) (claimed: antigravity-3.1-pro 2026-09-21)
- [x] T063 [P] [US3] `tests/engine/storage/play-settings.test.ts`: run settings round-trip per Score through
  `musicanyya.play.v1`, fall back to the last-used settings then to the defaults, and evict beyond
  `PLAY_SETTINGS_MAX` (FR-040)
- [x] T064 [P] [US3] `tests/core/play/metronome-mute.test.ts`: muting changes only the click - the schedule, the
  tick map and the Grade are identical with and without it (AS-3.6)

### Implementation

- [x] T065 [US3] Range, tempo percentage and hand selection plumbed through `compilePlaySchedule` and
  `buildExpectedNotes` in `src/app/play-session.ts`
- [x] T066 [US3] `src/ui/elements/mx-play-panel.ts`: range, tempo percentage, part and hand selection (the same
  presets and preselection as Practice), strictness, count-in length, Metronome mute and accompaniment switches
  (FR-036 to FR-039)
- [x] T067 [US3] Metronome mute through `AudioEngine.setChannelVolume` in `src/app/play-session.ts` - never by
  recompiling the schedule (research R-02)
- [x] T068 [US3] `SettingsStore.loadPlay` / `savePlay` in `src/engine/ports.ts` and
  `src/engine/storage/local-settings-store.ts`, with the `musicanyya.play.v1` key and the per-Score cap
- [x] T069 [US3] `tests/e2e/us3-play-setup.spec.ts`: a range at a reduced tempo with one hand, settings surviving
  a reload

**Checkpoint**: US1, US2 and US3 all work independently - a real practice session is possible.

---

## Phase 6: User Story 4 - Keep attempts and replay them (Priority: P4)

**Goal**: keep recent attempts on the device, hear one back against the Score, re-grade it, delete it.
**Independent Test**: play a piece twice, confirm both attempts are listed with date, settings and summary,
replay the first one and confirm the notes heard are the ones that were played, then delete it.

### Tests (write first, confirm they fail)

- [x] T070 [P] [US4] `tests/engine/storage/performance-store.test.ts`: the `performances` store is created by the
  version 1 -> 2 upgrade without touching `recentScores`; records round-trip; `byScoreFinished` lists newest
  first; writing beyond `PERFORMANCES_PER_SCORE_MAX` drops the oldest; deleting removes the recording;
  `unavailable` and `quotaExceeded` are reported, never thrown (FR-041, FR-043)
- [x] T071 [P] [US4] `tests/core/play/replay.test.ts`: a stored log compiles to a schedule whose note events land
  at the recorded times against the Score, with the accompaniment the run used and no timer anywhere (FR-042,
  research R-10)
- [x] T072 [P] [US4] `tests/core/grade/regrade.test.ts`: re-grading a stored performance at a different
  strictness yields a different Grade and a byte-identical stored log (FR-027, SC-011). Passed immediately - a
  purity/contract test of the already-correct `gradePerformance` and `resolveWindows`, not paired with new
  production code (no separate regrade function exists; the app re-derives `GradeInput` from a stored
  performance the same way a live run's `start()` does, per contracts/grading.md's worker protocol note).

### Implementation

- [x] T073 [US4] `src/engine/storage/indexeddb-performance-store.ts`: the store, the version 2 upgrade, the
  retention rule and the `StoreResult` failure behaviour. Shares the `musicanyya` DB open/upgrade path with
  `IndexedDbScoreStore` via new `src/engine/storage/db.ts` (DB_VERSION bumped 1 -> 2 there), so the version 2
  upgrade adds `performances` without ever touching `recentScores` regardless of which store opens the DB first.
- [x] T074 [US4] Store the finished run in `src/app/play-session.ts` with its settings, Latency profile, app
  version and summary (FR-014, FR-041). `PlaySessionController` gains a `PerformanceStore` dependency
  (contracts/play-run.md bumped to 1.1.3); `APP_VERSION` (new, `src/engine/config.ts`, from `package.json`) and
  the log rebasing of research R-20 live in `storePerformance`/`rebaseToRunStart`. A `scoreId === null` run (Score
  never stored) has nothing to key an attempt by, so nothing is written; a `PerformanceStore.put` failure still
  shows the Grade, with a new `playAttemptNotStored` notice (`PlayNoticeCode`, additive).
- [x] T075 [US4] `src/core/play/replay.ts`: compile a stored log into a `ScheduleMessage` on the live channel's
  instrument, merged with the run's accompaniment. New `mergeSchedules` in `src/core/schedule/compile.ts` unions
  two compiled schedules on disjoint channels (reused as-is, not re-derived, by both replay and any future caller).
- [x] T076 [US4] `src/ui/elements/mx-attempts-list.ts`: the recent attempts with date, settings and summary, and
  the replay, re-grade and delete actions, stating how many attempts are kept (FR-041 to FR-043, AS-4.6). New
  `src/app/replay-session.ts` (`ReplaySessionController`) drives `mx-score-view`'s existing Play-mode cursor-follow
  seam (`PlayPositionReporter`) for a replay, exactly as `PlaySessionController` does for a live run - no second
  cursor mechanism. Re-grade uses the stored run's own settings with only `strictness` swapped for whatever the
  Play settings panel currently shows (AS-4.4); replay also re-grades (unchanged settings) so the marks are
  visible (FR-042) alongside the replayed audio. `tests/e2e/us4-attempts.spec.ts` covers the full Independent
  Test in a real browser: two attempts kept and listed, replayed, re-graded at a different strictness, deleted.
- [x] T077 [US4] Bump `specs/001-score-viewer-listen/contracts/storage.md` to IndexedDB schema 2 and record the
  new `localStorage` keys (`musicanyya.practice.v1`, `musicanyya.play.v1`, `musicanyya.latency.v1`), cross-
  referencing each feature's own contract rather than duplicating its shape.

**Checkpoint**: all four stories work independently.

---

## Phase 7: Polish & Cross-Cutting

- [x] T078 [P] `tests/core/grade/perf.test.ts`: a 500-measure run grades within the SC-006 budget, and the
  controller never blocks the main thread for more than 50 ms while it does (grading must go through the worker)
- [ ] T079 [P] `tests/e2e/us2-grade.spec.ts`: the same acceptance scenarios pass in the browser and in the
  Electron project from one build (FR-047, SC-012)
- [ ] T080 [P] MIDI hot-plug during a run: unplug and replug within one run, recording resumes within 3 seconds,
  the run never stops and the gap is on the Grade (SC-013) - `tests/core/play/device-loss.test.ts`
- [x] T099 [P] `tests/ui/play-notices.test.ts`: no notice raised during a run is modal - none traps focus, blocks
  the Score or stops the clock (FR-009) - and neither the on-screen keyboard nor the computer keyboard ever
  produces a recorded or graded message in Play mode (FR-010)
- [x] T100 [P] `tests/architecture/no-upload.test.ts`: nothing in the Play path calls `fetch`,
  `XMLHttpRequest`, `navigator.sendBeacon` or a WebSocket - Performance logs stay on the device (FR-016)
- [x] T103 [P] `tests/core/play/long-run.test.ts`: a simulated 10-minute run at 208 bpm accounts for every
  recorded message - each note-on ends as exactly one result's `playedKey`, one `PlayedAlongPress` or one
  `ExtraNote`, with `droppedMessages` zero and no dropout (SC-007)
- [x] T106 [P] Fix the tempo-space mismatch `gradePerformance` (`src/core/grade/grade.ts`) has between its two
  uses of `GradeInput.tempo`: Step 1's `tickAtAudioTime` call needs run-tick space (0 = count-in start), but
  `resolveWindows` and `passAtTick` key their lookups by `ExpectedNote.onsetTick`/`message.tick`, which are
  timeline-tick space - the opposite (contracts/grading.md 1.1.2, found implementing T039). Give `GradeInput` a
  second tempo field (or derive timeline-space internally from `tickMap`) so window sizing and reliability-event
  pass attribution use the correct segment whenever a run's `countInTicks - rangeStartTick` shift is non-zero
  **and** a tempo change falls inside the graded range. Test first: a fixture with a mid-range tempo change,
  played through a range that does not start at tick 0, asserting the resolved window matches the tempo
  actually in force at that onset
- [ ] T081 [P] Update `docs/agents/reference.md` if anything in the toolchain or the commands changed, and
  `quickstart.md` if a command changed
- [ ] T082 Run the `quickstart.md` manual verification script for all four user stories on a real MIDI keyboard
- [ ] T083 Constitution audit of the finished feature with `constitution-auditor`, in particular Principle I over
  T034 and T036, Principle II over the one-clock and latency-compensation path, and Principle III over the
  MusicXML subset the owner's D-1 and D-2 added
- [ ] T084 Full quality gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` - all green

---

## Owner decisions - answered 2026-09-20

All four were answered with the recommendation. The two that were pure document amendments are done; the two that
are real work are scheduled in Phase 2 (T085, T086) with their tests (T102) and their grading behaviour in US1
(T092, T093, T101).

- [x] T087 **D-3 SC-015**: softened. `spec.md` SC-015 is now "at least 95% over the reference fixtures", AS-1.13
  and FR-011 mark only "correct" live, and the disagreement mechanism is recorded in
  [contracts/play-run.md](contracts/play-run.md) (1.1.0). T044 stays a cheap same-pitch test
- [x] T088 **D-4 FR-003**: accepted. FR-003, AS-1.1, [data-model.md](data-model.md) §1 and §2 and
  [contracts/performance-log.md](contracts/performance-log.md) rule 4 now state one rule: matching reaches back
  by the first note's early claim window and forward by the last note's late claim window (T023, T030, T033)

---

## Dependencies & Execution Order

- Setup (T001-T003) -> Foundational (T004-T015, T090, T094, T095, T102, T085, T086, T104) -> US1 (T016-T046,
  T089, T091, T092, T093, T096, T097, T101) -> US2 (T047-T059, T098) -> US3 (T060-T069) -> US4 (T070-T077) ->
  Polish (T078-T084, T099, T100, T103). File order is execution order.
- T104 (found missing during T015): blocks T015, and is a reusable Score for US2's and US3's Independent Tests.
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
  - T035 and T037 must follow T034 and T036 respectively, before either is merged (Constitution I); T090 follows
    T009 and T011, T091 follows T030 and T032, for the same reason on the timing path.
  - T094 blocks T095, and T095 must land before T022 and T032 assert the Metronome channel invariant.
  - T102 blocks T085 and T086 (test first); T085/T086 block T092, T093 and T101, because nothing can be
    played-along or arpeggiated until the loader says a note is ornamented or a chord is rolled.
  - T093 blocks T030's played-along pass and T062's hand view of it; T089 depends on T030 and on T038's assumed
    profile, and is the gate for believing any timing number this feature produces.
  - T096 blocks T031, T097 blocks T039, T098 depends on T033's `audioLost` transition.
  - T107 depends on T039 (the controller) and T040 (Play mode, `playState.ts`); T046's e2e run and the US1
    Checkpoint both depend on T107.

## Parallel Opportunities

- **Setup**: T002 and T003 together.
- **Foundational**: T005, T006, T007 together; T012, T014, T015, T094 and T102 together once T005 is in.
- **US1 tests**: T016 to T025 plus T045, T089, T092, T096, T097 and T101 are independent test files and can all
  be written in parallel.
- **US1 implementation**: T026, T027 and T032 touch different files and can start together once their tests fail;
  T034 and T036 are the same file and must **not** be parallel.
- **US2 tests**: T047 to T051 together. **US3 tests**: T060 to T064 together. **US4 tests**: T070 to T072
  together.
- **Polish**: T078, T079, T080, T081, T099, T100 and T103 together.
- Stories US2, US3 and US4 touch mostly different files and can be staffed in parallel once US1's checkpoint is
  passed; the shared files to watch are `src/app/play-session.ts` (US2 T053/T055, US3 T065/T067, US4 T074) and
  `src/ui/elements/mx-grade-panel.ts` (US1 T042, US2 T054).
