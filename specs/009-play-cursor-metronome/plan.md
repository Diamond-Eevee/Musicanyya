# Implementation Plan: Play Mode Cursor, Audible Metronome and Practice-Style Grade Marks

**Branch**: `009-play-cursor-metronome` | **Date**: 2026-09-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/009-play-cursor-metronome/spec.md`

## Summary

During a Play run the Score shows Listen mode's cursor. It stands at the first note during the count-in, then moves
with the audible position. The Metronome is heard as a real wood-block click with an accented downbeat. After the
run, the Grade is drawn in Practice's visual language: green noteheads for correct notes; grey noteheads with a
skip icon for missed notes (the same icon replaces Practice's skip chevron); red discs at the pitch actually played
for wrong pitches and extra keys; timing carets as before. Rings, crosses and diamonds go.

Approach (research.md): the Metronome was scheduled sample-accurately for the count-in only (B-9: no click after it, added in
R-14), and the worklet never selected any instrument. It drops program and controller events and ignores the channel setup (B-1, B-2), so the click played as
a one-tick piano note (spike R-01). The processor now applies the channel setup in its message handler, which also
makes every Score part sound as its General MIDI instrument (001 FR-015). A muted click no longer carries over to the
next run (R-02). The cursor reuses Listen's drawing, driven by the run's already latency-compensated position
through a pure `playCursorAt` (R-04). The Grade becomes a pure mark set (`gradeMarks`, R-06, R-08). That set is
drawn with 008's classes, disc placement (generalised to `placeKeys`, R-07) and disc renderer, from cached geometry
(R-09). Selection and the mistake stepper cover extras too (R-10).

## Technical Context

**Language/Version**: TypeScript (strict), HTML5, CSS3; no UI frameworks
**Runtime Dependencies**: none new (spessasynth_core 4.3.22 already has `programChange` and `setDrums`, R-01)
**Storage**: none (no format, setting or store changes; Performance log and Grade unchanged)
**Testing**: Vitest in Node (grade marks, cursor position, `placeKeys`, schedule invariants, processor setup with a
fake synth, a real-synth click render with the shipped SF2); happy-dom UI tests (mark classes, drawing calls, hit
test, stepper); Playwright e2e (cursor during a run, computed green fill under the highlight, Grade marks, Electron)
**Shells / Delivery Targets**: browser and Electron (same build); Native audio plugin not involved
**Target Browsers**: latest 2 Chrome + Edge (reference); Firefox; Safari = view + Listen only (no Web MIDI)
**Performance Goals**: cursor within 50 ms of the sound (001 SC-004), 60 fps with cursor and Grade marks (SC-009);
clicks within 3 ms of their beat (SC-002)
**Real-time Paths Touched**: AudioWorklet message handler (`schedule`, `soundBank`); `process()` itself unchanged.
RT review required.
**Constraints**: no allocation in `process()`; channel setup applied only between render blocks; core stays DOM-free;
no per-frame DOM measuring of every graded note (R-09)
**Scale/Scope**: scores up to 500 measures; Grades with hundreds of marks; up to 16 channels

## Constitution Check

*GATE: must pass before Phase 0 research; re-checked after Phase 1 design (both passes below).*

| # | Principle | Question | Status |
|---|---|---|---|
| I | Real-Time Safety | Program/drum/controller setup is stored in pre-allocated state (64-byte copy, fixed controller list) and applied in `port.onmessage` only - bounded, handler-only, may allocate inside the synth (the `soundBank` precedent, Complexity Tracking); `process()` gains nothing; the click stays scheduled on the audio clock in the compiled schedule; RT review task | PASS |
| II | One Clock, Measured Latency | Cursor reads `positionRunTick`, the audible (latency-compensated) position on the audio clock; no timer; extra-key columns chosen in integer timeline ticks; no new tolerance (test-only thresholds are test constants) | PASS |
| III | Score Fidelity & Note Identity | Marks address Note IDs (classes on the Note's own element); tie chains come from the timeline's `members`; discs reuse 008's placement from the one Score model; no engraving change | PASS |
| IV | Test-First, Deterministic | `gradeMarks`, `extraColumn`, `playCursorAt`, `notesAtTick`/`passAtTick`, `placeKeys` are pure and tested first in Node; golden test of a Grade's mark set; real-synth test fails on today's code (R-03) | PASS |
| V | Layered, Framework-Free | Rules in `core/grade`, `core/play`, `core/timeline`, `core/notation`; UI measures and draws; engine change inside the worklet behind the existing synth port; no framework; browser works alone | PASS |
| VI | Musician-First Feedback | Results differ by shape: green head (none) / grey head + skip icon / disc / caret (FR-020, SC-006), except two rare cases FR-020 names (an extra beside a missed or wrong note; a wrong key no staff can show), which the explanation and the stepper resolve; nothing modal; each mark explainable, discs selectable (FR-022); overlays switchable. Two bounded exceptions carried over from 008, both owner-accepted: disc over the head in its column; correct vs ungraded by colour only (Complexity Tracking) | PASS with owner-accepted exceptions |
| VII | Pedagogy as Data | No Advice change | PASS (n/a) |
| VIII | Simplicity, Web-First | P1 = US1 + US2, each usable alone; no dependency, asset or setting; reuse of Listen's cursor and 008's marks instead of new renderers | PASS |

## Project Structure

### Documentation (this feature)

```text
specs/009-play-cursor-metronome/
|-- spec.md
|-- plan.md                 # this file
|-- research.md             # B-1..B-8, R-01..R-13, click spike, music-domain-expert review
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- play-display.md     # 1.0.0, plus amendments: worklet-protocol 1.4.0, play-run 1.2.0, pressed-keys 2.1.0
|-- checklists/requirements.md
`-- tasks.md                # /speckit.tasks
```

### Source Code (repository root)

```text
src/engine/worklets/score-player.processor.ts  # channel setup stored on `schedule`, applied in the handler and after
                                               #   `soundBank`; synth port + wrapper: programChange, setDrums (US2)
src/core/defaults.ts                           # MAX_SETUP_CONTROLLERS (US2)
src/core/schedule/play-schedule.ts             # run clicks for every pass (R-14), count-in without <time> terminates (T056)
src/app/play-session.ts                        # start(): always set the Metronome channel volume (US2, R-02)
src/core/timeline/position.ts                  # NEW: notesAtTick, passAtTick (moved from the view, US1)
src/core/play/cursor.ts                        # NEW: playCursorAt (US1)
src/ui/elements/mx-score-view.ts               # Play cursor + highlights; Listen uses core/timeline/position;
                                               #   Grade: mark set, classes, cached geometry, disc hit test (US1, US3)
src/core/notation/place-discs.ts, index.ts     # placeKeys (+ preferredStaff); placeDiscs becomes a wrapper (US3)
src/core/grade/marks.ts                        # NEW: gradeMarks, extraColumn (US3)
src/ui/score/grade-marks.ts                    # rewritten: discs, then skip icons and carets, from geometry; gradeHeadClass; discAt
src/ui/score/pressed-keys.ts                   # drawStateChevron 'skipped' -> skip icon in a given box (FR-016a)
src/ui/score/disc-layout.ts                    # skipIconBox, caretBox: marks clear of every head (research R-13)
src/app/session.ts                             # e2e-synthetic-grade seam beside e2e-midi (e2e only)
src/ui/format/ (grade reasons)                 # chord and octave-line wording (FR-022a)
src/ui/state/playState.ts, mistake-stepper.ts  # selectedMark / GradeMarkRef; stepper from GradeMarkSet.mistakes
src/ui/elements/mx-grade-panel.ts              # explain note refs (every pass) and extra refs
tools/dev/screenshot.ts, tools/dev/key-steps.ts # --run, --grade; `sleep:<ms>` step (dev-only, quickstart)
tests/core/play/cursor.test.ts                 # NEW
tests/core/timeline/position.test.ts           # NEW (equivalence with the old inline Listen logic)
tests/core/grade/marks.test.ts                 # NEW, incl. golden mark set and invariants
tests/core/notation/place-discs.test.ts        # placeKeys, preferredStaff; existing placeDiscs goldens unchanged
tests/core/schedule/*.test.ts                  # program/controller events only at tick 0
tests/engine/worklets/score-player.setup.test.ts # NEW: fake-synth setup order, late sound bank, controller cap
tests/engine/metronome-click.test.ts           # NEW: real-synth click attack/decay/accent (R-03)
tests/engine/play-session.test.ts              # volume reset at start
tests/ui/grade-marks.test.ts                   # rewritten for the new look (behaviour change, logged)
tests/ui/mistake-stepper.test.ts, grade-panel.test.ts, score-view.test.ts
tests/e2e/play-cursor.spec.ts, play-grade-marks.spec.ts, grade-marks-overlap.spec.ts # NEW; old ring asserts adjusted
tests/tools/key-steps.test.ts                  # sleep step
```

**Structure Decision**: two new pure core modules (`core/play/cursor.ts`, `core/grade/marks.ts`) and one extracted
(`core/timeline/position.ts`); one additive notation entry point; the engine change stays inside the worklet processor
behind its existing synth port; UI changes are confined to the score view, the Grade drawing and Play state.

## Complexity Tracking

| Violation / Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| **Exception to Constitution VI** ("Overlays ... MUST NOT hide the notes they refer to"), extended from Practice to the Grade: a red disc stays in its note's column and may partly cover a written notehead there | Owner decision 2026-09-25 (spec Clarifications, FR-021): the same look as Practice, where the owner accepted this exception after using it (008 plan Complexity Tracking). Bounds (unlike Practice, a Grade disc stays while the Grade is shown, not only while a key is held): the disc is at most `DISC_SIZE_RATIO` (0.85) of a head, so the head's staff position stays readable; it covers only heads of its own column; skip icons and carets are drawn outside the head and on top of discs; every disc is selectable and explained; the marks layer can be switched off. **Accepted by the owner 2026-09-25**, no constitution change | Moving discs aside (rejected by the owner in 008: reads as a mistake on the next note) |
| In a Grade, a correct note differs from an ungraded note (the unselected hand, another part, notes after a stop) by colour only, for as long as the Grade is shown (Constitution VI) | Extends the 008 row ("green notehead only", where the state was temporary). Raised by the constitution audit as MEDIUM; **the extension was accepted by the owner 2026-09-25** (spec Clarifications). Every Grade result state still differs from every other by shape (FR-020, SC-006); ungraded notes are not results | A tick or ring on every correct note (the outline look the owner asked to remove) |
| The worklet message handler now performs program changes (preset lookup, may allocate): bounded, handler-only, while the transport is stopped after `schedule` | Required to select the click's drum kit and each part's instrument (R-01). Done in `port.onmessage` between render blocks, the contract's existing "heavy exception" (like `soundBank`); `process()` unchanged | Forwarding program events from `process()` (allocation risk in the render callback); a separate click voice (second clock path) |

No new runtime dependency, asset or licence.

## Phase 0: Research

Done: [research.md](research.md). Baseline findings B-1 to B-8 from the code. R-01 was verified with a render spike
against spessasynth_core 4.3.22 and GeneralUser GS 2.0.3: today the click peaks at 48 ms like a soft piano note; with
the drum flag it peaks within 4 ms, decays by 300 ms and is 1.5-2x a mezzo-forte piano note. R-08 was reviewed by
`music-domain-expert`. No open NEEDS CLARIFICATION.

Changes back to the spec (2026-09-25, recorded in spec "Changes from planning"): the Metronome cause is confirmed,
and so is the side effect that restores 001 FR-015. FR-017 now defines the extra-key column exactly. New FR-017a
covers the wrong-pitch staff. FR-024 and SC-005 now say how repeats combine, and a missed tie is marked at its first
note.

## Phase 1: Design

Done: [data-model.md](data-model.md), [contracts/play-display.md](contracts/play-display.md),
[quickstart.md](quickstart.md). Contract amendments are applied during implementation by the tasks that change the
code: worklet-protocol 1.4.0, play-run 1.2.0, pressed-keys 2.1.0, and 001 data-model's constants table
(`MAX_SETUP_CONTROLLERS`).

Some existing tests change because the specified behaviour changed; each change is named in the implementation log:
- `tests/ui/grade-marks.test.ts` asserts rings and crosses.
- Play e2e tests assert ring marks.
- `tests/engine/synth-onset.test.ts` needs the new optional synth port methods.

**Constitution Check after design**: unchanged, all PASS (table above), with the two owner-accepted VI exceptions.

## Resolved points (owner, 2026-09-25: "resolve everything, go with recommended")

- **Missed marker looked like an accent** (`music-domain-expert`): the skip chevron is replaced by a skip icon (solid
  triangle with a bar) in both Practice (skipped) and Play (missed), spec FR-016, FR-016a. Amends 008 FR-009/FR-010.
- **Listen sound changes for multi-instrument Scores** (R-01): accepted; it is 001 FR-015.
- **Explanation wording** for chords and octave lines (expert): adopted, spec FR-022a.
- **Constitution audit** (2026-09-25, COMPLIANT WITH NOTES, 7 findings): (1) HIGH planning changes to FR-017/FR-017a/
  FR-024/SC-005 - accepted by the owner, spec Clarifications; (2) MEDIUM correct vs ungraded by colour only -
  extension accepted, Complexity Tracking; (3) MEDIUM draw order - discs first, skip icons and carets on top
  (contract); (4) MEDIUM "every result differs by shape" overstated - FR-020 names the two exceptions, Check row
  reworded; (5) LOW Grade disc bounds listed; (6) LOW Listen cursor behaviour captured as a golden test before the
  code moves (contract section 1); (7) LOW Principle I row reworded.

Analyze (2026-09-25, 16 findings: CRITICAL 1, HIGH 1, MEDIUM 7, LOW 7), all resolved with the recommended option
(owner): C1 skip icon below the lowest head of its column on that staff, in both modes (research R-13); H1 no Grade
mark during a live run tested; M1-M7 and L1-L7 folded into spec FR-016/FR-016a/FR-018/FR-022/SC-005, the contract,
data-model and tasks (new T053-T055). No open point remains.
