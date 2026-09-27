# Tasks: Tempo as an Editable BPM Number

**Input**: Design documents from `specs/012-tempo-bpm-field/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

<!--
  Format: `- [ ] T001 [P] [US1] Description with exact file path`
  States: `[ ]` open, `[~]` in progress with ` (claimed: <agent-id> <date>)`, `[x]` done (AGENTS.md section 4)
  - [P]   = can run in parallel (different files, no dependency on unfinished tasks)
  - [USn] = user story the task belongs to (omit for Setup/Foundational/Polish)
  - Tests come BEFORE implementation (Constitution IV) and must fail first.
  - No worklet or plugin code changes, but the worklet's tempo message now carries a fractional percent at a higher
    rate (research R-11), so US2 ends with an RT review task.
-->

All owner decisions are answered (spec Clarifications, 2026-09-26). Nothing in this list waits for the owner.

MVP note: US1 removes the slider and US2 makes the number editable; both are P1 and ship together (plan Summary). US1
alone is testable (the tempo is shown), but between US1 and US2 the transport tempo cannot be changed.

## Phase 1: Setup

- [x] T001 Apply `contracts/contract-changes.md` to the canonical contracts with their version lines: `specs/001-score-viewer-listen/contracts/worker-messages.md` 1.3.0 (`TimelineDto.tempo`, three new glyphs), `specs/001-score-viewer-listen/contracts/worklet-protocol.md` 1.4.1 (fractional percent), `specs/004-score-first-layout/contracts/view-settings.md` 2.1.0 (`tempoPercent` deprecated: not written, ignored when read), note in `specs/001-score-viewer-listen/contracts/storage.md`, `specs/003-play-mode-grading/contracts/play-run.md` 2.1.0, `specs/003-play-mode-grading/contracts/performance-log.md` (play-settings validation, `lastUsed.tempoPercent` not applied), `specs/003-play-mode-grading/contracts/grading.md` 1.2.1; `specs/001-score-viewer-listen/data-model.md` section 2 (`TempoMark.beat`, `isDefault`) and section 10 (constants of 012 data-model section 7)
- [x] T002 [P] New hand-written fixtures in `tests/fixtures/musicxml/` with rows in `tests/fixtures/musicxml/README.md` (Hand-written, feature 012, CC0): `tempo-change-90-60.musicxml` (4/4, quarter = 90 with sound in m1, quarter = 60 with sound in m5, 8 measures, an end-repeat at m6 back to m1, so the second pass returns from 60 to 90), `tempo-beat-inherit-6-8.musicxml` (6/8 dotted quarter = 60 with sound 90 in m1; `<sound tempo="120"/>` direction without metronome in m3; `<time>` 2/4 in m5 with no mark; `<sound tempo="80"/>` in m6), `tempo-circa-range.musicxml` ("c. 90" in m1, "90-100" in m3, "fast" in m5, no sound values), `tempo-whole-unit.musicxml` (2/2, whole = 30, no sound), `tempo-absurd.musicxml` (sound 5000 in m1, sound 0 in m2, quarter = 60 in m3); each is valid MusicXML 4.0 that opens in the app

---

## Phase 2: Foundational (blocks all user stories)

The model, the parser and the tempo display map every story reads.

### Tests (write first, confirm they fail)

- [x] T003 [P] Beat tests in new `tests/core/tempo/beat-unit.test.ts` (contracts/tempo-display.md): `beatOf` gives the quarter-note length of every note-type-value from maxima (32) to 1024th (1/256), one assertion each; 1, 2, 3 dots give x3/2, x7/4, x15/8; 4 dots and an unknown type give null; `metronomeBeatAt` gives dotted quarter for 6/8, 9/8, 12/8, eighth for 3/8, half for 2/2, quarter for 4/4 and for a measure without `<time>`; `parsePerMinute`: "90", " 92.5 ", "c. 90", "ca.90", "circa 90", "90-100", "90–100" -> 90 / 92.5, "fast", "", "c." -> null; `beatLabel`: "quarter", "dotted quarter", "double-dotted half"
- [x] T004 [P] Parser tests in new `tests/core/musicxml/tempo-marks.test.ts`, one assertion per bullet: `tempo-dotted-beat-unit` gives qpm 90 and beat dotted quarter; `tempo-sound-vs-metronome` gives qpm 140 (sound wins) and beat quarter; `31c-MetronomeMarks`: the "dotted quarter = 100" mark gives qpm 150 with a dotted-quarter beat, the two metric modulations give no mark, the parenthesised "dotted quarter = 77" gives qpm 115.5; `tempo-whole-unit` gives qpm 120 (today 30, R-2 fix); `tempo-circa-range` gives 90 (m1) and 90 (m3), and nothing for "fast"; `tempo-absurd` drops 5000 and 0 and keeps 60; `tempo-beat-inherit-6-8` m3 mark has `beat: null`; `tempo-none-default` gives one mark with `isDefault: true`, all others `isDefault: false`; inline cases: `<beat-unit-tied>` and `<metronome-note>` give no mark, a `<sound tempo>` in the same direction as a modulation still gives a mark with `beat: null`
- [x] T005 [P] Display-map tests in new `tests/core/tempo/tempo-display.test.ts`: rules 1-6 of contracts/tempo-display.md, one test each; `tempo-change-90-60` gives segments 90 / 60 / 90 / 60 in playback order (the repeat back to m1 re-applies 90 after the 60 section; a map that did not re-apply would stay at 60); `tempo-beat-inherit-6-8` gives beatSource mark (shown 60) -> inherited in m3 (120 qpm shown 80) -> metronome quarter at the 2/4 change in m5 (shown 120) -> m6 shown 80; a beat-only change starts a segment; the global lead-in shift matches `PlaybackTimeline.tempo`; invariant: for every note onset of every fixture in `tests/fixtures/musicxml/` and every file in `tests/fixtures/musicxml/real`, the display segment's qpm equals `tempoAtTick(timeline.tempo, tick)`
- [x] T006 [P] DTO test in new `tests/core/timeline/timeline-dto.test.ts`: `buildTimelineDto` returns the passes and spans the score worker sends today (equal to the current inline construction on `scale-c-major-q100`) plus `tempo` equal to `buildTempoDisplayMap` (worker-messages 1.3.0)

### Implementation

- [x] T007 Constants in `src/core/defaults.ts` and re-exports in `src/engine/config.ts`: `TEMPO_BPM_STEP` = 1, `TEMPO_MARK_QPM_MIN` = 10, `TEMPO_MARK_QPM_MAX` = 1000, `TEMPO_BEAT_DOTS_MAX` = 3, `TEMPO_BPM_DIGITS_MAX` = 4 (data-model section 7; `TEMPO_PERCENT_STEP` is removed in T031)
- [x] T008 `TempoBeat` and `TempoMark.beat` / `isDefault` in `src/core/score/model.ts`; new `src/core/tempo/beat-unit.ts` with `beatOf`, `metronomeBeatAt` (reusing `beatTicksAt`'s meter rule from `src/core/timeline/beat.ts`), `parsePerMinute`, `beatLabel` (T003 green)
- [x] T009 Parser in `src/core/musicxml/build.ts`: every beat unit and 0-3 dots via `beatOf`, `parsePerMinute`, no x1 fallback, modulation / `<metronome-note>` / `<beat-unit-tied>` give no tempo from the mark, qpm bounds, `beat` set from the direction's `<metronome>`, default mark `isDefault: true` (T004 green); review and accept the `tests/core/musicxml/__snapshots__/build.test.ts.snap` diff (only the new fields, plus any whole/16th-unit tempo fix, each named in the log)
- [x] T010 New `src/core/tempo/tempo-display.ts`: `buildTempoDisplayMap`, `displaySegmentIndexAt`, `writtenBpm`, `shownBpm`, `bpmLimits`, `percentForBpm` (T005 green)
- [x] T011 New `src/core/timeline/dto.ts` `buildTimelineDto(timeline, score)`; `src/workers/score.worker.ts` uses it; `TimelineDto` in `src/ui/elements/mx-score-view.ts` gains `tempo` (T006 green)

**Checkpoint**: `pnpm test -- tests/core` green; `pnpm typecheck` green; no visible change yet.

---

## Phase 3: User Story 1 - See the Score's tempo as a number (Priority: P1) MVP

**Goal**: The transport shows "Tempo 90 BPM" from the MusicXML, with the beat symbol when it is not a quarter, "default"
when there is no tempo, the tempo in force at the cursor, and "written NN" when the tempo differs. Every Score opens at
its written tempo.
**Independent Test** (spec US1): open a library item marked quarter = 90 -> "90 BPM"; a Score without a tempo -> the
default, marked as such; Listen across a tempo change -> the number changes at the cursor.

### Tests (write first, confirm they fail)

- [x] T012 [P] [US1] Field display tests in new `tests/ui/tempo-field.test.ts` (contracts/tempo-field.md DOM contract): shows `shownBpm` and "BPM"; no `[data-id="tempo-beat"]` for a quarter beat; a dotted-quarter beat renders an `aria-hidden` SVG when glyphs are given and the text label "dotted quarter" when glyphs are null; a 16th beat renders the text label; `data-default` and "default" for `isDefault`; `[data-id="tempo-written"]` hidden at percent 100 and when the whole numbers are equal, shown as "written 90" at percent 80; `aria-valuenow/min/max` and `aria-valuetext` ("72 beats per minute, dotted quarter note"); a new model updates the value when the input is not focused; the element is hidden for a null segment
- [x] T013 [P] [US1] Transport tests in `tests/ui/transport.test.ts`: there is one `mx-tempo-field` and no `input.tempo` range; after a practice-state or transport change re-renders the transport, the same field element instance is still attached (identity), with focus kept
- [x] T014 [P] [US1] Position tests in new `tests/ui/score-view-tempo-position.test.ts` (using `tests/ui/helpers/score-view-harness.ts`): Listen playing at a tick inside the second segment publishes index 1 to `tempoPositionState`; the same frame repeated notifies no listener; a Play run cursor in a later segment publishes its index; Listen stopped after a measure click publishes the segment at `startTick` (FR-004); a Practice session waiting at an expected event in the second segment publishes index 1
- [x] T015 [P] [US1] FR-015 tests: `tests/core/transport/transport.test.ts` - `newScore` resets `tempoPercent` to 100 and keeps volume and follow; `tests/engine/storage/settings-v2.test.ts` and `tests/engine/storage/local-settings-store.test.ts` - a stored `tempoPercent: 70` is ignored on load, and a save writes no `tempoPercent` (view-settings 2.1.0); `tests/ui/transport.test.ts` - `applySavedSettings` no longer takes a tempo
- [x] T016 [P] [US1] Glyph harvest test in `tests/verovio/glyphs.test.ts`: `noteheadHalf`, `noteheadWhole` and `flag8thUp` are non-empty path strings in font units, like `notehead`
- [x] T017 [P] [US1] Library tests: `tests/ui/mx-library.test.ts` - item details read "Tempo: 72 BPM"; new `tests/library/tempo-beat.test.ts` - every item in `public/library/index.json`, opened from its file, has a first tempo mark with a quarter beat and `shownBpm(first segment, 100) === Math.round(facts.tempoBpm)` (R-10, FR-021, SC-001 for the library)
- [x] T018 [P] [US1] SC-001 test in new `tests/core/tempo/tempo-display-real.test.ts`: for every fixture with a usable mark and every file in `tests/fixtures/musicxml/real`, `shownBpm(segment at tick 0, 100)` equals the first mark's sound tempo expressed in the mark's note value, rounded half up, when the first tempo direction has a `<sound tempo>`, and otherwise its `per-minute` number (via `parsePerMinute`), and a file without any usable tempo gives `isDefault`; the expected value is computed from the raw XML by the test, independently of the parser
- [x] T019 [P] [US1] E2E in new `tests/e2e/tempo-field.spec.ts` (US1 block): a library item at 72 shows "72 BPM" with reset disabled and no hint; `tempo-dotted-beat-unit` shows 60 and a beat symbol; `tempo-none-default` shows "default"; on `tempo-change-90-60` Listen play shows 90 then 60 after the cursor passes m5; stopped, a measure click reseeks the shown tempo; opening a second Score shows its own written tempo

### Implementation

- [x] T020 [P] [US1] Glyph harvest in `src/workers/glyphs.ts` (SMuFL E0A3 noteheadHalf, E0A2 noteheadWhole, E240 flag8thUp added to the snippet and `GLYPH_IDS`) and `ready.glyphs` in `src/workers/verovio.worker.ts` (T016 green)
- [x] T021 [P] [US1] New `src/ui/state/tempoPositionState.ts` (segment index, "no change, no cost" like `runPositionState`); `src/ui/elements/mx-score-view.ts` publishes it in the Listen, Practice and Play branches of its frame loop from `TimelineDto.tempo` (T014 green)
- [x] T022 [US1] New `src/ui/elements/mx-tempo-field.ts` display part: `model` setter, number, unit, beat symbol from harvested glyphs (stem line, dot circle) or text label, written/default hint, ARIA; styles in `src/ui/styles/` (one line, number and unit at least the size of the other transport labels, hint wraps below at 375 px); strings in `src/ui/i18n/en.ts` (`bpm`, `writtenTempo`, `defaultTempo`, beat labels, `tempoValueText`) (T012 green)
- [x] T023 [US1] `src/ui/elements/mx-transport.ts`: create one persistent `mx-tempo-field` and re-attach it on every render instead of the range input; `src/app/session.ts` feeds its model from `TimelineDto.tempo`, `tempoPositionState` and the transport percent, publishes rest positions (Listen `startTick`, Practice start measure, Play range start; data-model section 5), and passes the harvested glyphs (T013 green)
- [x] T024 [US1] No carry-over (FR-015): `transportReducer` `newScore` resets `tempoPercent` in `src/core/transport/transport.ts`; `UserSettings` without `tempoPercent` in `src/engine/ports.ts`; `validate`/save in `src/engine/storage/local-settings-store.ts`; `applySavedSettings(volume, follow)` in `src/ui/state/transportState.ts`; `session.ts` stops persisting the tempo; `tests/fakes/memory-settings-store.ts` follows (T015 green)
- [x] T025 [US1] Library details "Tempo: NN BPM" in `src/ui/elements/mx-library.ts` and `src/ui/i18n/en.ts`; comment in `src/core/library/facts.ts` that `tempoBpm` is quarter notes per minute (R-10) (T017 green)
- [x] T026 [US1] `docs/musicxml-support.md` and `SUPPORT_MATRIX` in `src/core/musicxml/support.ts`: metronome mark row (all note values, up to 3 dots, "c. 90", ranges, parentheses, modulation / metronome-note / beat-unit-tied ignored, qpm bounds); `tests/core/musicxml/support-doc-sync.test.ts` stays green
- [x] T027 [US1] Run T018 and T019 green; check `pnpm screenshot --item learning/key-changes/a-major-to-a-minor/beginner` and `--file tests/fixtures/musicxml/tempo-dotted-beat-unit.musicxml` pictures (quickstart US1 1-3) and name them in the log

**Checkpoint**: spec US1 Independent Test passes; `pnpm test`, `pnpm lint`, `pnpm typecheck` green; log entry; commit.

---

## Phase 4: User Story 2 - Type the tempo to practise at (Priority: P1)

**Goal**: Any whole BPM can be typed, stepped by 1 or reset, is clamped to 25-200 % of the written tempo, plays exactly
and applies live; typing never triggers shortcuts.
**Independent Test** (spec US2): on a Score written at 90, type 72 and play in Listen: beats at 72 per minute and the
Metronome at 72; reset -> 90.

### Tests (write first, confirm they fail)

- [x] T028 [P] [US2] Factor tests in `tests/core/transport/transport.test.ts`: `clampTempoPercent` keeps 101.111 (no step), clamps 10 -> 25 and 500 -> 200, turns NaN and Infinity into 100; the `tempoPercent` action stores a fractional value
- [x] T029 [P] [US2] SC-002 tests in `tests/core/tempo/rate.test.ts` and `tests/engine/worklets/dispatch.test.ts`, driven the way the app drives them: typed 91 on a 90-qpm Score -> `percentForBpm(seg90, 91)` -> `transportReducer` `tempoPercent` action -> the stored percent; with that percent, 91 consecutive beats span 60 s within 1 ms (`audioTimeAtTick`) and the dispatched frames of 91 quarter-note events are 60/91 s apart within one frame at 48 kHz; also 6/8 dotted quarter typed 61 on 60. Fails on the current code because `clampTempoPercent` rounds 101.11 to 100 (91 beats would take 60.67 s)
- [x] T030 [P] [US2] Field editing tests in `tests/ui/tempo-field.test.ts`: Enter applies and emits `tempochange` with `percentForBpm` and `source: 'typed'`; blur applies; Escape, empty and "abc" restore and emit nothing; 500 and 10 on a 90 segment emit the limits and show 180 and 23; ArrowUp/ArrowDown and the +/- buttons emit +/-1 BPM with `source: 'step'`; the buttons are disabled at the limits; reset emits 100 with `source: 'reset'` and is disabled at 100; a model update while the input is focused and edited does not replace the typed text; applying the value already shown emits nothing
- [x] T031 [P] [US2] Shortcut and Escape tests: typing Space and digits in `input[data-id="tempo-bpm"]` does not toggle playback (`tests/ui/help-shortcuts.test.ts`); Escape in the field restores the value and does not close an open panel (`tests/ui/escape-precedence.test.ts`)
- [x] T032 [P] [US2] E2E in `tests/e2e/tempo-field.spec.ts` (US2 block) and `tests/e2e/us2-listen.spec.ts` updated from the slider to the field: type 72 + Enter -> "72 BPM", "written 90", engine tempo 80 %; three + presses during Listen playback -> 75 while the audible position keeps increasing with no stop, no restart and no `ended` (SC-006); 500 -> 180; "abc" + Escape -> previous value; reset -> 90; on `tempo-change-90-60` with the cursor in the 60 section, 45 -> after the repeat the 90 section shows 68 (US2 scenario 9); SC-003: from a stopped Score, one fill of "72" plus Enter sets 72 and one reset click returns to the written tempo; Practice: during a session on `tempo-change-90-60`, + changes the tempo while the session keeps waiting at the same expected note and does not restart (FR-013)

### Implementation

- [x] T033 [US2] Remove `TEMPO_PERCENT_STEP` from `src/core/defaults.ts` and `src/engine/config.ts`; `clampTempoPercent` without a step in `src/core/transport/transport.ts`; doc comments in `src/engine/worklets/dispatch.ts`, `src/engine/ports.ts`, `src/core/play/types.ts` (no "integer", no "step 5") (T028 green, T029 still green)
- [x] T034 [US2] Editing in `src/ui/elements/mx-tempo-field.ts`: showing / editing states (data-model section 6), apply rule (at most `TEMPO_BPM_DIGITS_MAX` digits, no inline regex constant), Escape (stop propagation), ArrowUp/ArrowDown, -/+ buttons, reset, `tempochange` event; strings for button labels in `src/ui/i18n/en.ts` (T030, T031 green)
- [x] T035 [US2] Wire `tempochange` in Listen and Practice to `transportState.setTempo` in `src/ui/elements/mx-transport.ts` / `src/app/session.ts` (T032 green)
- [x] T036 [US2] RT review with `rt-audio-reviewer` of the tempo-change path (`src/engine/audio/web-audio-engine.ts` `setTempoPercent`, the worklet's `tempo` message handler and `recomputeSegmentFrames` in `src/engine/worklets/score-player.processor.ts` / `dispatch.ts`) for fractional percents and step auto-repeat (~30 messages/s); findings summarised in the log
- [x] T053 [US2] Worklet tests first (found by the T036 RT review, existing defects the new behaviour exposes), new `tests/engine/worklets/score-player.tempo.test.ts`, driving `createScorePlayerProcessor` directly: (a) one and 30 rapid fractional `tempo` messages during playback keep the reported tick continuous (sum of per-block advances), every note-on happens exactly once and none is dropped; (b) `tempo` while paused keeps the paused tick and resume continues from it; (c) `pause` then `play` after any pause length continues from the paused tick, the reported tick while paused stays at the paused tick, `play` after idle blocks starts at the return tick, `play` after `ended` restarts from the return tick; (d) `tempo` with NaN, ±Infinity or a non-number is ignored; 500, 10, 0 and a negative clamp to 200, 25, 25 and 25; (e) a position report carries the ticks-per-frame of the segment the tick is in (multi-tempo schedule), not the last segment's
- [x] T054 [US2] Fix in `src/engine/worklets/score-player.processor.ts` (T053 green): a `holdTick` playhead used while not playing; `tempo` re-anchors the segment frames at the current tick and frame without resetting the event cursor (no event rescan); `pause`/bare `play` re-anchor at `holdTick`; `play` after `ended` reloads from the return tick; `tempo` validated and clamped to `TEMPO_PERCENT_MIN..MAX`; position report rate of the current segment; and (T057 re-review finding N1) `dispatchBlock` in `src/engine/worklets/dispatch.ts` dispatches an already-due event, and reaches the end, at the block start instead of dropping it (a tempo change that slows playback can give an undispatched event a frame just before the block; tests in `score-player.tempo.test.ts` and `dispatch.test.ts`)
- [x] T055 [P] [US2] Strengthen the SC-006 test in `tests/e2e/tempo-field.spec.ts`: the first sample is taken only after the cursor has passed the third note, so a jump back to the start fails (the first version passed against the defect T054 fixes)
- [x] T056 [US2] `specs/001-score-viewer-listen/contracts/worklet-protocol.md` 1.4.2: `tempo` is position-preserving and validated, `pause`/`play` resume at the paused tick, position reports carry the current segment's rate
- [x] T057 [US2] Re-run the RT review with `rt-audio-reviewer` on the T054 diff (closes T036); findings summarised in the log


**Checkpoint**: spec US2 Independent Test passes (quickstart US2 1-6); full gate `pnpm lint`, `pnpm typecheck`,
`pnpm test`, `pnpm test:e2e`; log entry; commit. US1 + US2 = MVP.

---

## Phase 5: User Story 3 - The same tempo number in Play mode and in the Grade (Priority: P2)

**Goal**: Play setup chooses the run tempo in BPM with the same field; the transport shows and edits the same value in
Play mode; both are read-only during a run; attempts show "90 BPM (75% of written)"; every Grade regrades identically.
**Independent Test** (spec US3): Score written at 120, Play mode, set 90, run: the Metronome clicks at 90 and the
attempt shows "90 BPM (75% of written)".

### Tests (write first, confirm they fail)

- [x] T037 [P] [US3] Play settings tests in `tests/engine/storage/play-settings.test.ts`: a stored `tempoPercent` of 83.333 is kept; stored 70 still loads; 10, 300, "80" and NaN fall back to the default; for a Score never played, `loadPlay` returns `lastUsed` with `tempoPercent` 100 while strictness and count-in still come from `lastUsed` (R-9)
- [x] T038 [P] [US3] Binding tests in new `tests/ui/tempo-binding.test.ts` for new `tempoFieldBinding(mode, transport, playSetup, run)`: Listen and Practice use the transport percent, unlocked; Play uses the Play settings percent and the range-start segment; locked during `countIn` and `running`, unlocked after the run ends
- [x] T039 [P] [US3] Setup panel tests in `tests/ui/setup-panel.test.ts`: `mx-play-panel` has an `mx-tempo-field` and no `select[data-id="tempo"]`; its segment is the one at the range start; `tempochange` from typing 90 on a 120 Score emits `{ tempoPercent: 75 }` exactly (FR-018); the field is read-only while a run is active
- [x] T040 [P] [US3] Attempt tempo tests: core `attemptTempo` in `tests/core/tempo/tempo-display.test.ts` (contracts/tempo-display.md 1.1.0) returns `{ bpm, percent, beat }` for the display segment at the attempt's range start - 75 % of 120 -> 90 / 75; 70 % -> 84 / 70; 100 x 91 / 120 -> 91 / 76; a range starting in a later 60 section -> 45; a 6/8 dotted-quarter Score at 60 and 80 % -> 48 with a dotted-quarter beat (FR-021); UI text in `tests/ui/attempts-list.test.ts` and `tests/ui/grade-panel.test.ts`: "90 BPM (75% of written)", "84 BPM (70% of written)", "91 BPM (76% of written)", and the dotted case shows the beat symbol or label
- [x] T041 [P] [US3] Reproducibility tests: `tests/core/grade/regrade.test.ts` - a run at `tempoPercent` 100 x 91 / 120 regrades to a deep-equal Grade; `tests/engine/storage/performance-store.test.ts` - that Performance record round-trips `settings.tempoPercent` bit-exactly; `tests/core/grade/golden.test.ts` snapshots unchanged (no `-u`)
- [x] T042 [P] [US3] E2E: `tests/e2e/us3-play-setup.spec.ts` and `tests/e2e/helpers/play.ts` move from the percentage `<select>` to the field; `tests/e2e/tempo-field.spec.ts` (US3 block): Play setup 90 -> transport shows 90; both read-only during count-in and run; the attempts list shows "90 BPM (75% of written)"; `tests/e2e/play-cursor.spec.ts` updated where it sets a tempo

### Implementation

- [x] T043 [US3] `validPlay` accepts a finite `tempoPercent` in [25, 200] and `loadPlay` does not apply `lastUsed.tempoPercent` to a Score never played, in `src/engine/storage/local-settings-store.ts` (T037 green)
- [x] T044 [US3] New `src/ui/state/tempoBinding.ts` `tempoFieldBinding`; `src/app/session.ts` uses it so that in Play mode the transport field edits the Play setup (`onPlaySetupChange({ tempoPercent })`) and both fields lock during a run (T038 green)
- [x] T045 [US3] `src/ui/elements/mx-play-panel.ts`: `mx-tempo-field` replaces the percentage list, segment at the range start (T039 green)
- [x] T046 [US3] `attemptTempo` in `src/core/tempo/tempo-display.ts` (the UI only renders it, Constitution V); attempt tempo text in `src/ui/elements/mx-attempts-list.ts` and `src/ui/elements/mx-grade-panel.ts`, string `attemptTempo` ("{bpm} BPM ({percent}% of written)") in `src/ui/i18n/en.ts` (T040 green)
- [x] T047 [US3] Run T041 and T042 green; comment updates in `src/core/play/types.ts` and `src/core/grade/types.ts` (fractional percent)

**Checkpoint**: spec US3 Independent Test passes (quickstart US3 1-4); full gate; log entry; commit.

---

## Phase 6: Polish & Cross-Cutting

- [x] T048 [P] Review of the fixtures (T002), the parser rules and the display semantics with `music-domain-expert`; findings in the log
- [x] T058 (new, found by T048) Owner said "apply the recommendation": R-4's beat fallback counts quarter notes,
  not the meter's beat, when no printed metronome mark has appeared anywhere in the Score yet (reserving the
  meter-derived fallback for an established unit broken by a later time-signature change). `tempo-display.ts`'s
  `fallbackBeat`/`hadPrintedMark`; spec.md FR-003 + Edge Cases + a new Clarifications entry, research.md R-4/R-10,
  data-model.md section 3 updated; `tempo-display-real.test.ts` and `tempo-beat.test.ts` (the "except..." test
  retired - every library item counts quarters now) updated first and confirmed failing, then green. Verified with
  `pnpm screenshot --item repertoire/advanced/fur-elise-complete`: "72 BPM", no beat symbol (previously "144 BPM"
  with an eighth-note glyph).
- [x] T049 [P] Phone width (SC-004): `pnpm screenshot --item learning/key-changes/a-major-to-a-minor/beginner --width 375` and with the Play setup open; number, unit, beat symbol and step buttons fully visible, play buttons on screen; an e2e assertion at 375 px in `tests/e2e/tempo-field.spec.ts` (element boxes inside the viewport, no overflow); FR-006: the computed font size of the number and of "BPM" is at least that of another transport label (Volume at 1600 px; Play/Stop at 375 px, since Volume itself is hidden there)
- [x] T059 (new, found by T049) The bar never fit at 375 px at all, in any feature, before this one (confirmed on
  `main`): mode-switch (209px) and size-controls (145px) alone left no room once the tempo field (wider than the
  slider it replaced) joined the row. Owner chose "icon-only, nothing removed", then (once the gap was measured at
  ~450px, too large for icon-only alone) "fold mode-switch and Score-size into the View popup" (the same relocation
  `mx-size-controls` already had - a second `mx-mode-switch` instance added to `mx-view-panel.ts`, reachable one tap
  away via the "More" menu). Found and fixed while wiring the second instance: native `<input type="radio">`
  grouping is global by `name`, not scoped to the custom element, so two `mx-mode-switch`es fought over which was
  checked until each got its own instance-unique radio name (`tests/ui/mode-switch.test.ts` pins this). Also:
  short labels for mode-switch/Open-score at moderately narrow widths, Volume/Follow/the "written" hint hidden
  outright at <=480 px (nowhere else to put them). 17 e2e call sites across 13 files that queried the bar's
  `mx-mode-switch` by tag alone (now ambiguous with the popup's second instance) rescoped to `#mode-controls
  mx-mode-switch`.
- [x] T050 Run the full `quickstart.md` manual verification with screenshots, naming each picture in the log
- [x] T051 Constitution review of the branch diff with `constitution-auditor`; findings in the log
- [x] T052 Update `specs/001-score-viewer-listen/data-model.md` section 10 check, `README.md` (tempo control description if present), `docs/agents/reference.md` if anything in the toolchain changed; full gate `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` (including the Electron specs, FR-022) green with summary lines in the log

## Dependencies & Execution Order

- Setup (T001-T002) -> Foundational (T003-T011) -> US1 (T012-T027) -> US2 (T028-T036) -> US3 (T037-T047) -> Polish
- US2 needs US1's field and transport host (T022, T023). US3 needs the field's editing (T034) and the binding of T023.
- T009 needs T008; T010 needs T008 and T009; T011 needs T010. T023 needs T020, T021, T022. T035 needs T034.
- T033 must follow T024 (both edit `local-settings-store.ts` / defaults) and precede T043.
- T036 (RT review) after T033-T035; its findings are T053-T057, which precede the US2 checkpoint.

## Parallel Opportunities

- T001 and T002.
- Foundational tests T003, T004, T005, T006 together.
- US1 tests T012-T019 together; then T020 and T021 in parallel with T022.
- US2 tests T028-T032 together.
- US3 tests T037-T042 together; T043, T045 and T046 touch different files once T044's binding exists.
- Polish T048 and T049.
