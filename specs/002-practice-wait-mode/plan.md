# Implementation Plan: Practice Mode (Wait for Input)

**Branch**: `002-practice-wait-mode` | **Date**: 2026-09-20 (clarified 2026-09-20) | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/002-practice-wait-mode/spec.md`

## Summary

Practice mode waits at each expected note or chord until the musician plays it, then advances; it judges **which**
notes, never **when**. The design adds one pure core module and no new machinery: `src/core/practice/` turns the
Score plus the existing unrolled `PlaybackTimeline` into a list of **expected events** (every required note sharing
a notated onset, filtered by the practised part and the hand selection, deduped by key) and reduces MIDI
note-on/note-off into per-note results and a cursor position. The UI reuses the Verovio SVG, the highlight layer
and the cursor overlay from feature 001; sound reuses
the AudioEngine's existing live-input methods for both the musician's own notes and the accompaniment of the
unselected hand, which is driven by the cursor rather than by a clock. No new runtime dependency, no new
AudioWorklet code and no new worklet or worker message; the only engine change is two added `SettingsStore`
methods for per-Score practice settings.

## Technical Context

**Language/Version**: TypeScript (strict), HTML5, CSS3; no UI frameworks
**Runtime Dependencies**: none new (`verovio`, `spessasynth_core`, `@rgrove/parse-xml` already present)
**Storage**: a new `localStorage` key `musicanyya.practice.v1` for per-Score practice settings (hand selection,
loop range, help and accompaniment switches), keyed by the existing content-hash Score id and capped at 20 entries;
the existing `musicanyya.settings.v1` format is untouched, and `SettingsStore` gains two methods (ports 1.0.0 ->
1.1.0). No new IndexedDB store (R-07)
**Testing**: Vitest - unit tests for expected-event building and the matcher, golden replay tests for determinism
(FR-028/SC-004), existing fakes (`tests/fakes/fake-midi-access.ts`, `fake-audio-engine.ts`); Playwright e2e driving
a fake MIDI device for US1 and US2
**Shells / Delivery Targets**: browser and Electron, identical behaviour from one build (FR-029); Native audio
plugin out of scope
**Target Browsers**: Chrome + Edge (reference, Web MIDI); Firefox where Web MIDI is available; Safari has no Web
MIDI, so Practice mode reports itself unavailable there and Listen mode is unaffected (R-02)
**Performance Goals**: key press -> mark on Score and on-screen keyboard <= 50 ms (SC-002); accompaniment note
within 50 ms of the note that carries it (SC-012); starting a session anywhere in a 500-measure Score <= 1 s
(SC-011); no main-thread task > 50 ms during a session
**Real-time Paths Touched**: **none new**. No AudioWorklet change, no scheduler change, no new MIDI timing path.
Practice has no tempo-driven schedule at all; the musician's notes and the accompaniment go through the existing
`liveNoteOn`/`liveNoteOff`/`liveSustain` methods, which the worklet applies at its next block on the audio clock.
**Constraints**: `src/core/practice` is pure TypeScript (no DOM, no Web APIs, runs in Node); the matcher is a
deterministic reducer so the same input sequence always yields the same results; nothing modal during a session
**Scale/Scope**: Scores up to 500 measures and 4 staves; expected-event list built once per session start

## Constitution Check

*GATE: must pass before Phase 0 research; re-check after Phase 1 design.*

| # | Principle | Question | Status |
|---|---|---|---|
| I | Real-Time Safety (Web and Native) | New code in AudioWorklet/plugin callbacks allocation-, await- and log-free? Sounds scheduled ahead on the audio clock (no timers)? Heavy work off the main thread? | [x] No worklet or plugin code is added or changed. Practice never schedules by tempo, so there is nothing to schedule ahead: the musician's notes and the unselected hand's notes are applied through the existing live-input path, which the worklet consumes on the audio clock at its next block. No `setTimeout`/`setInterval` decides when any sound starts or stops - the accompaniment's note-off is decided by the cursor passing the note's end, which is a user event, not a timer. Building expected events is O(notes) once per session start, off the critical path. |
| II | One Clock, Measured Latency | All events on the audio-clock timeline, MIDI timestamps mapped onto it? Integer ticks in core? Latency compensated? Tolerances named & configurable? | [x] Expected events carry integer ticks from the existing unrolled timeline. Practice judges pitch only, never time, so no latency compensation can change a result and none is applied to judging; MIDI `timeStampMs` is carried through and recorded so a session replays exactly (FR-028, R-09). **Timing tolerances: none, by design** - the nine named constants in `src/core/defaults.ts` (data-model §7) are structural rules such as "grace notes are never required", not time windows. Feature 003 adds the timed side. |
| III | Score Fidelity, Engraving & Note Identity | Canonical score model + Note IDs (= SVG ids)? Verovio engraving? Unsupported MusicXML degrades gracefully? | [x] Expected events and every practice mark are keyed by Note ID, the same ids Verovio puts on the SVG and the schedule uses, so the highlight layer from 001 marks them directly. Notes the loader skipped are simply never expected, and the existing load report still explains them. |
| IV | Test-First Core, Deterministic Grading | Tests first? Core testable in Node with fakes? Golden tests for grading? | [x] Every task writes its test first. `src/core/practice` has no DOM or Web API dependency, so the matcher runs in Node against fixtures. A recorded input sequence replayed against a Score is a golden test: the per-note results are snapshotted (SC-004). |
| V (note) | Vocabulary | The constitution's Domain Vocabulary describes Practice mode as offering "optional loops, slower tempo and hands separately". This feature delivers loops and hands separately; **slower tempo does not apply**, because nothing plays against a clock in wait mode - the musician sets the pace by playing. That is a narrowing of the vocabulary's wording, not a behavioural conflict, and it is recorded here so a constitution audit does not read it as drift. | [x] |
| V | Layered, Framework-Free, Platform-Agnostic | No UI frameworks? core has no DOM/Web APIs? Platform features behind ports? Browser works without Electron/plugin? Electron secure defaults? Device loss recoverable? | [x] Layering is core (`practice/`) <- engine (unchanged ports) <- ui (custom elements) <- app (session wiring). No framework. MIDI stays behind the existing `MidiInput` port, so tests use the fake. The browser build is the primary target; Electron adds nothing here. `deviceLost` already reports held keys, which is exactly what the matcher needs to release them and keep its position (FR-021). |
| VI | Musician-First Feedback | Colour + shape, nothing modal during a session, explainable results, overlays never hide notes? | [x] Each state (waiting, correct-so-far, correct, wrong pitch, wrong octave, extra, held-over, played-along, skipped) gets a distinct shape or marking as well as a colour (FR-010, SC-009, R-08); played-along and skipped carry no message, because neither is a mistake, and every message names the next physical action instead of a verdict (FR-039, R-10). Problems are non-blocking notices, never dialogues (FR-020). The help overlay explains what is expected and is placed so it never covers the note (FR-024). |
| VII | Pedagogy as Data | Advice as schema-validated JSON anchored to Note IDs/measures? Invalid entries skipped, not fatal? | [x] Not applicable in this feature: the only pedagogical content used is the fingering already written in the MusicXML and already engraved. Advice files stay out of scope, and the help overlay is built so an Advice source can be added later without changing the matcher. |
| VIII | Simplicity, Web-First Delivery | P1 is a usable MVP? Web APIs before libraries? New runtime deps justified below? | [x] US1 alone is a working Practice mode. No new runtime dependency and no new Web API beyond Web MIDI, which feature 001 already uses. Complexity Tracking is empty. |

## Project Structure

### Documentation (this feature)

```text
specs/002-practice-wait-mode/
|-- spec.md              # /speckit.specify
|-- plan.md              # this file (/speckit.plan)
|-- research.md          # Phase 0 (/speckit.plan)
|-- data-model.md        # Phase 1 (/speckit.plan)
|-- quickstart.md        # Phase 1 (/speckit.plan)
|-- contracts/           # Phase 1 (/speckit.plan)
|   |-- practice-session.md   # core Practice API + events (new, 1.0.0)
|   `-- practice-settings.md  # persisted per-Score practice settings (new key, format 1; ports 1.0.0 -> 1.1.0)
`-- tasks.md             # /speckit.tasks (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
|-- core/
|   |-- practice/            # NEW, pure TS
|   |   |-- types.ts         # ExpectedEvent, Attempt, PracticeMark, PracticeSession, HandSelection, LoopRange
|   |   |-- hands.ts         # voice -> home staff attribution and the selectable hand options (R-05)
|   |   |-- expected.ts      # Score + PlaybackTimeline + HandSelection -> ExpectedEvent[]
|   |   |-- matcher.ts       # deterministic reducer: input events -> marks, cursor, effects
|   |   `-- loop.ts          # written measure range -> resolved slice of the unrolled timeline (R-06)
|   `-- defaults.ts          # + PRACTICE_HELP_AFTER_WRONG_ATTEMPTS and friends
|-- engine/
|   |-- ports.ts             # + SettingsStore.loadPractice / savePractice (1.0.0 -> 1.1.0); everything else unchanged
|   `-- storage/
|       `-- local-settings-store.ts  # + the musicanyya.practice.v1 key (no migration of settings.v1)
|-- ui/
|   |-- elements/
|   |   |-- mx-mode-switch.ts      # NEW: Listen | Practice
|   |   |-- mx-practice-panel.ts   # NEW: part and hand selection, loop, accompaniment and help switches,
|   |   |                          #      and the skip forward / back control (FR-004a)
|   |   |-- mx-practice-help.ts    # NEW: expected key, note name, written fingering
|   |   |-- mx-piano-keys.ts       # + expected-key highlight for help
|   |   `-- mx-score-view.ts       # + practice marks and waiting cursor
|   |-- score/
|   |   |-- practice-marks.ts      # NEW: Note ID -> mark class, beside highlight.ts
|   |   `-- cursor-overlay.ts      # + waiting cursor (sits on the expected event)
|   |-- state/
|   |   `-- practiceState.ts       # NEW: session state for the UI
|   `-- i18n/en.ts                 # + practice strings and feedback wording
`-- app/
    `-- session.ts                 # + Practice session wiring (mode switch, MIDI routing, accompaniment)

tests/
|-- core/practice/           # NEW: expected-event building, matcher rules, golden replays
|-- ui/                      # practice marks, mode switch, help overlay
|-- fakes/                   # existing fake MIDI access and fake audio engine, reused
`-- e2e/us1-practice.spec.ts # NEW: wait, wrong note, chord, hands separately (fake MIDI)
```

**Structure Decision**: the feature is almost entirely a new pure core module plus UI. The engine layer is
untouched except for the settings store's version bump, because everything Practice needs from the platform (MIDI
events, live notes, storage) already exists behind ports from feature 001. That keeps the matcher testable in Node
and keeps the RT paths closed to this feature.

## Complexity Tracking

> Fill ONLY if the Constitution Check has violations or a new dependency/layer is added.

No violations and no new dependencies: nothing to track.

## Phase 0: Research (`research.md`)

Decisions recorded there: where wait-mode logic lives and why it is a pure reducer (R-01); Web MIDI availability per
browser and what Practice does without it (R-02); how the unselected hand sounds without a clock (R-03); expected-
event grouping and the held/tied/repeated-pitch rules (R-04); hand selection from staves, including cross-staff
notation (R-05); loop ranges over an unrolled timeline with repeats and voltas (R-06); per-Score settings storage
and its migration (R-07); colour-and-shape feedback that survives greyscale (R-08); determinism and how sessions
are replayed in tests (R-09).

## Phase 1: Design

- `data-model.md`: ExpectedEvent, Attempt, PracticeMark, HandSelection, LoopRange, PracticeSession state machine
  (idle -> waiting -> advancing -> finished, plus interrupted), and the named constants.
- `contracts/practice-session.md`: the core Practice API and its event vocabulary, versioned 1.0.0.
- `contracts/practice-settings.md`: the persisted per-Score practice settings and the settings format 1 -> 2
  migration.
- `quickstart.md`: how to run Practice mode and a manual verification script per user story, using
  `musicxml/chords/c-major-scale-and-chords.musicxml`.
- `docs/agents/reference.md`: Active Technologies and Recent Changes updated (no new technology; the note records
  that Practice adds a pure core module and needs no new dependency).
### Post-design re-check (Constitution)

Re-run after the documents above were written; all eight rows still pass, with three things the design made
sharper:

- **I / II**: the design confirms there is no new real-time code and no timing tolerance anywhere. The one thing
  that could have introduced a timer - the accompaniment's note-off - is decided by the cursor passing the note's
  end (R-03), so it stays an effect of a user event.
- **III**: expected events are keyed by Note ID and mark *every* notehead at a shared key (FR-038), which the
  first draft would have left permanently "waiting" - the identity rule caught a real bug before implementation.
- **IV / VI**: the domain review changed the rules themselves (FR-008's wording, hand attribution by voice rather
  than printed staff, hidden notes never expected, empty events skipped). The spec was corrected rather than the
  design bent around it, and the golden replay tests in R-09 are what keep those rules honest.

### After the clarification session (2026-09-20)

`/speckit.clarify` ran after this plan and added five rules (spec `## Clarifications`, research R-11): the
played-along mark, the wrong-versus-extra rule, part preselection with a manual override, the start-measure
occurrence rule, and a skip control with its `skipped` mark. None of them touches the stack, a port or a
real-time path, so every Constitution row stands and Complexity Tracking stays empty. Two are worth naming:
**VI** gains two more states that must stay distinct in greyscale (played-along, skipped), and **I / II** are
unaffected, because a skip is a user event like any key press - it still decides nothing by a clock.
`PRACTICE_PART_PRESELECTION` joins the constants, making nine.

Complexity Tracking stays empty: no new dependency, no new layer, no new real-time surface.
