# Implementation Plan: Play Mode and Grading

**Branch**: `003-play-mode-grading` | **Date**: 2026-09-20 (clarified 2026-09-20; owner decisions D-1 to D-4
answered and `/speckit.analyze` findings folded in on 2026-09-20) | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/003-play-mode-grading/spec.md`

## Summary

Play mode runs the Score on the audio clock and never waits; afterwards the recorded performance is graded note by
note on two axes - pitch (correct / wrong pitch / missed) and, for every note a key press claimed, timing (on time
/ early / late). The design adds two pure core modules, `src/core/play` (the run state machine and the run/Score
tick mapping) and `src/core/grade` (expected notes, the two-pass matcher, the windows, the summary), plus one new
pure compiler, `compilePlaySchedule`, that builds each run's own schedule: the graded notes removed, the range
sliced out, the count-in in front, and the Metronome as ordinary scheduled events on a dedicated percussion
channel. That last choice is the heart of the plan - the "sample-accurate metronome" the constitution asks for
becomes a property of the existing dispatch path rather than new real-time code (R-02).

Three things this feature must build that no earlier feature has: the mapping from Web MIDI timestamps onto the
audio clock (R-04), a real **Latency profile** with the calibration FR-034 offers - the spec assumed feature 001
had one and it does not (R-05) - and persistence for Performance logs in IndexedDB (R-09), the open question
feature 002 left behind. Grading itself runs in a new `grade.worker.ts` around a synchronous pure function, because
the constitution names long-performance grading as work that belongs off the main thread (R-08).

No new runtime dependency. The only change inside the AudioWorklet is to render each block in the sub-blocks
`dispatch.ts` already computes, so events land on their own frame (R-02).

Two things the owner's answers of 2026-09-20 added to this plan: the **MusicXML subset grows** by `<ornaments>`,
`<trill-mark>`, `<mordent>`, `<turn>`, `<tremolo>` and `<arpeggiate>` (D-1, D-2), and FR-024's **played-along
keys** become explicit data in `GradeInput` rather than a rule the matcher could not see (R-18). Both are
fairness fixes: without them a well-played trill is the worst-scoring thing in the piece, a chord the Score asks
to be rolled reads as late, and every accompaniment key the musician plays is reported as extra.

## Technical Context

**Language/Version**: TypeScript (strict), HTML5, CSS3; no UI frameworks
**Runtime Dependencies**: none new (`verovio`, `spessasynth_core`, `@rgrove/parse-xml` already present)
**Storage**: IndexedDB `musicanyya` version 1 -> 2, adding the `performances` object store (at most 20 per Score,
oldest dropped); new `localStorage` keys `musicanyya.play.v1` (run settings per Score) and
`musicanyya.latency.v1` (the measured Latency profile). `recentScores` and the existing settings keys are
untouched. `SettingsStore` gains four methods (ports 1.1.0 -> 1.2.0)
**MusicXML scope added**: `<arpeggiate>`, `<ornaments>` with `<trill-mark>`, `<mordent>`, `<turn>` and
`<tremolo>` (owner decisions D-1 and D-2); `docs/musicxml-support.md` and `SUPPORT_MATRIX` grow with them.
`<glissando>` and `<slide>` stay unsupported and keep being reported by the load report (R-17)
**Testing**: Vitest - unit tests for the schedule compiler, the run reducer, window resolution and the matcher;
golden snapshot tests for whole Grades from recorded performances (FR-025, SC-001); existing fakes
(`fake-midi-access`, `fake-audio-engine`, `fake-clock`, `midi-sequence`, `recording-synth`); Playwright e2e
driving a fake MIDI device for US1 and US3
**Shells / Delivery Targets**: browser and Electron, identical behaviour from one build (FR-047, SC-012); Native
audio plugin explicitly out of scope
**Target Browsers**: Chrome + Edge (reference, Web MIDI); Firefox where Web MIDI is permitted; Safari has no Web
MIDI, so Play mode reports itself unavailable there and Listen mode is unaffected (FR-045)
**Performance Goals**: Metronome click within 3 ms of its correct time with no accumulated drift (SC-002); Grade of
a 500-measure run within 1 s with no main-thread task > 50 ms (SC-006); key press -> visual feedback <= 50 ms
(FR-011); reported timing difference within 5 ms of an injected offset (SC-004)
**Real-time Paths Touched**: **yes, two, both small**. (1) The worklet renders each block in the sub-blocks
`DispatchState.splits` already contains, applying each event at its own frame instead of applying all events and
rendering once - no allocation, no new state. (2) A new `channelVolume` message (CC7 on one channel) for muting the
Metronome. Both carry a mandatory `rt-audio-reviewer` review (T035, T037). Nothing else on the RT *path* changes:
the Metronome is scheduled data, and grading never runs while the musician plays. Four tasks are on the
**timing** code the same reviewer owns - `tickAtAudioTime` (T009), the MIDI clock map (T011), the latency
compensation in `gradePerformance` (T030) and the schedule compiler (T032) - and they carry reviews T090 and
T091
**Constraints**: `src/core/play` and `src/core/grade` are pure TypeScript (no DOM, no Web API, no clock, no
randomness) and run in Node; grading is deterministic to the reason code; positions and windows are integer ticks,
milliseconds only at the boundaries; nothing modal during a run
**Scale/Scope**: Scores up to 500 measures and 4 staves; runs up to 10 minutes; logs of a few thousand messages

## Constitution Check

*GATE: must pass before Phase 0 research; re-check after Phase 1 design.*

| # | Principle | Question | Status |
|---|---|---|---|
| I | Real-Time Safety (Web and Native) | New code in AudioWorklet/plugin callbacks allocation-, await- and log-free? Sounds scheduled ahead on the audio clock (no timers)? Heavy work off the main thread? | [x] The Metronome and the count-in are **scheduled events**, not new RT code (R-02): they ride the existing dispatch path, so no timer and no second scheduler exists anywhere in this feature. The two RT changes are sub-block rendering over the pre-allocated `splits` array and a `channelVolume` message handled in `port.onmessage`; neither allocates, awaits, logs or throws, and both get an `rt-audio-reviewer` review (T035, T037), as does the
timing code the same role owns: the tick/audio-time conversion and MIDI clock map (T090) and the latency
compensation and schedule compiler (T091). Grading runs in `grade.worker.ts` (R-08), never on the main thread and never during a run (FR-026). Recording a MIDI message is an array push on the main thread, off the RT path |
| II | One Clock, Measured Latency | All events on the audio-clock timeline, MIDI timestamps mapped onto it? Integer ticks in core? Latency compensated? Tolerances named & configurable? | [x] Input timestamps are mapped onto the audio clock with the same `(contextTime, performanceTime)` pairing the cursor uses, and both the mapped and the raw time are stored (R-04). Grading compares **integer ticks**; seconds become ticks in exactly one function, the inverse of `tempo/rate.ts` (R-06). Latency is compensated once, before any window is applied, from a named `LatencyProfile` that says whether it was measured or assumed - and this feature builds the profile and the calibration that feature 001 never had (R-05). Every window is a named constant in `src/core/defaults.ts` (data-model section 10); there are no magic numbers in the matcher |
| III | Score Fidelity, Engraving & Note Identity | Canonical score model + Note IDs (= SVG ids)? Verovio engraving? Unsupported MusicXML degrades gracefully? | [x] Expected notes carry the `noteIds` of every notehead at their key and onset, so a result marks exactly the note it refers to, and the mark layer reuses feature 001's SVG ids. Expected notes are built by calling 002's `buildExpectedEvents` rather than re-deriving them (R-15), so Play expects exactly what Practice expects and Listen plays (FR-017, SC-005). What the loader skipped is never expected, and the existing load report still explains it. The subset grows
deliberately, with fixtures and `docs/musicxml-support.md` + `SUPPORT_MATRIX`, by `<arpeggiate>` and the four
`<ornaments>` elements the owner approved (D-1, D-2); `<glissando>` and `<slide>` stay skipped and reported |
| IV | Test-First Core, Deterministic Grading | Tests first? Core testable in Node with fakes? Golden tests for grading? | [x] Every task writes its test first. Both new core modules are pure and run in Node; recorded performances are JSON fixtures, and a whole Grade is a golden snapshot (SC-001). Determinism is designed in rather than hoped for: the matcher's visiting order is normative in `contracts/grading.md`, the log is sorted by `(tick, key)` so arrival order cannot matter, and the comparison is in integers |
| V | Layered, Framework-Free, Platform-Agnostic | No UI frameworks? core has no DOM/Web APIs? Platform features behind ports? Browser works without Electron/plugin? Electron secure defaults? Device loss recoverable? | [x] Layering is core (`play/`, `grade/`, `schedule/`) <- engine (ports, +4 additive methods) <- ui (custom elements) <- app (`play-session.ts`). No framework. MIDI and storage stay behind their ports, so tests use the fakes. The browser build is primary; Electron adds nothing here (FR-047). Device loss is explicitly designed for: the MIDI keyboard can go and come back inside one run (FR-044), and audio loss stops the run with an honest, marked-unreliable Grade (FR-046) |
| VI | Musician-First Feedback | Colour + shape, nothing modal during a session, explainable results, overlays never hide notes? | [x] Two result axes get two visual channels - shape for pitch, left/right position for timing - so nothing depends on hue and the whole layer survives greyscale (R-11, SC-008). Every mark carries a structured reason code the UI turns into plain words (R-13), which makes FR-030 a type-level guarantee. Notices are never modal (FR-009), the layer switches off (FR-035), and the default strictness is the most forgiving level (FR-039) |
| VII | Pedagogy as Data | Advice as schema-validated JSON anchored to Note IDs/measures? Invalid entries skipped, not fatal? | [x] Not applicable: Advice files stay out of scope and the only pedagogical content used is the fingering already written in the MusicXML. The reason codes are structured and localisable, so an Advice source can later attach to the same Note IDs without changing the matcher |
| VIII | Simplicity, Web-First Delivery | P1 is a usable MVP? Web APIs before libraries? New runtime deps justified below? | [x] US1 alone is a working Play mode with a Grade. No new runtime dependency and no new Web API beyond those 001 already uses. The one place the design chose *more* structure - a dedicated grading worker - is required by Constitution I, not by taste, and it holds no logic of its own |

## Project Structure

### Documentation (this feature)

```text
specs/003-play-mode-grading/
|-- spec.md                    # /speckit.specify + /speckit.clarify
|-- plan.md                    # this file (/speckit.plan)
|-- research.md                # Phase 0 (/speckit.plan)
|-- data-model.md              # Phase 1 (/speckit.plan)
|-- quickstart.md              # Phase 1 (/speckit.plan)
|-- contracts/                 # Phase 1 (/speckit.plan)
|   |-- play-run.md            # core Play API, run schedule, engine/worklet additions (new, 1.0.0)
|   |-- grading.md             # gradePerformance, the normative matcher, worker messages (new, 1.0.0)
|   `-- performance-log.md     # persisted log, IndexedDB 1 -> 2, play + latency settings (new, format 1)
`-- tasks.md                   # /speckit.tasks (NOT created by /speckit.plan)
```

Amended when the corresponding task lands (as feature 002 did in its T030):
`specs/001-score-viewer-listen/contracts/ports.md` (1.1.0 -> 1.2.0),
`worklet-protocol.md` (1.1.0 -> 1.2.0), `storage.md` (IndexedDB schema 1 -> 2).

### Source Code (repository root)

```text
src/
|-- core/
|   |-- play/                  # NEW, pure TS
|   |   |-- types.ts           # PlayRun, RunPhase, RunSettings, PlayTickMap, PlayEffect, ReliabilityEvent
|   |   `-- run.ts             # playRunReducer: actions -> run + effects (no clock, no timers)
|   |-- grade/                 # NEW, pure TS
|   |   |-- types.ts           # ExpectedNote, PlayedAlongSpan, NoteResult, ExtraNote, Grade, GradeSummary, ResultReason
|   |   |-- expected.ts        # buildExpectedNotes + buildPlayedAlongSpans (ungraded keys, ornament spans)
|   |   |-- windows.ts         # strictness level -> resolved windows in ticks at an onset (floor/cap, neighbour clamp)
|   |   |-- match.ts           # the two-pass matcher (normative order, deterministic)
|   |   |-- summary.ts         # the two figures, the counts, the per-pass overview, reliability warnings
|   |   `-- grade.ts           # gradePerformance: the whole pipeline, synchronous and pure
|   |-- schedule/
|   |   `-- play-schedule.ts   # NEW: compilePlaySchedule (range slice, graded notes dropped, count-in, Metronome)
|   |-- musicxml/build.ts      # + <arpeggiate> and <ornaments> on Note (D-1, D-2)
|   |-- timeline/instruments.ts# + METRONOME_CHANNEL reserved beside PERCUSSION_CHANNEL and LIVE_CHANNEL (R-19)
|   |-- tempo/rate.ts          # + tickAtAudioTime (the inverse conversion, one place only)
|   `-- defaults.ts            # + the Metronome, count-in, strictness, arpeggio/ornament and calibration constants
|-- engine/
|   |-- ports.ts               # + AudioEngine.setChannelVolume / latencyProfile, SettingsStore play + latency (1.2.0)
|   |-- config.ts              # + PERFORMANCES_PER_SCORE_MAX, PLAY_SETTINGS_MAX, GRADE_WORKER_TIMEOUT_MS
|   |-- midi/clock-map.ts      # NEW: performance.now() timestamps -> audio-clock seconds (R-04)
|   |-- audio/web-audio-engine.ts  # + channelVolume message, + latencyProfile()
|   |-- worklets/
|   |   `-- score-player.processor.ts  # sub-block rendering over splits; channelVolume (RT REVIEW)
|   `-- storage/
|       |-- indexeddb-performance-store.ts  # NEW: performances store, DB version 2, 20 per Score
|       `-- local-settings-store.ts         # + musicanyya.play.v1 and musicanyya.latency.v1
|-- workers/
|   `-- grade.worker.ts        # NEW: thin wrapper around gradePerformance (R-08)
|-- ui/
|   |-- elements/
|   |   |-- mx-mode-switch.ts  # + Play
|   |   |-- mx-play-panel.ts   # NEW: range, tempo, part/hands, strictness, count-in, Metronome, accompaniment
|   |   |-- mx-grade-panel.ts  # NEW: the two figures, counts, per-measure overview, mistake stepper
|   |   |-- mx-attempts-list.ts# NEW: stored attempts - replay, re-grade, delete
|   |   |-- mx-latency-panel.ts# NEW: the profile, and the tap calibration (FR-034)
|   |   `-- mx-score-view.ts   # + the result layer, switchable off
|   |-- score/
|   |   `-- grade-marks.ts     # NEW: NoteResult -> mark classes, beside practice-marks.ts (R-11)
|   |-- state/
|   |   `-- playState.ts       # NEW: run and Grade state for the UI
|   |-- styles/score.css       # + result mark shapes (greyscale-safe)
|   `-- i18n/en.ts             # + reason wording, Play strings, reliability wording
`-- app/
    |-- session.ts             # + Play mode hand-off (mode switch, score/timeline sharing)
    `-- play-session.ts        # NEW: the only place engine, worker, store and run meet (R-01)

tests/
|-- core/play/                 # NEW: run reducer, tick map, schedule compiler (incl. count-in and meter)
|-- core/grade/                # NEW: expected notes, windows, matcher rules, golden Grades
|-- engine/midi/clock-map.test.ts          # NEW
|-- engine/storage/performance-store.test.ts # NEW
|-- engine/worklets/           # + sub-block rendering and channelVolume
|-- fixtures/performances/     # NEW: recorded PerformanceLog JSON beside the scores they belong to
|-- ui/                        # grade marks, panels, mistake stepper
`-- e2e/us1-play.spec.ts       # NEW: count-in, run, Grade, stop (fake MIDI)
```

**Structure Decision**: the feature is two new pure core modules plus UI, in the shape features 001 and 002 set.
The engine gains one new adapter (the performance store), one new pure helper (the clock map) and four additive
port methods; the worklet changes in two bounded ways. Play wiring goes into its own `src/app/play-session.ts`
rather than into `session.ts`, which is already 832 lines and owns Listen and Practice - a third mode's run,
Grade, attempt list and replay would make it the place every mode collides.

## Complexity Tracking

> Fill ONLY if the Constitution Check has violations or a new dependency/layer is added.

No violations and **no new runtime dependency**. Three additions are worth recording, none of them a new layer:

| Addition | Why needed | Simpler alternative rejected because |
|---|---|---|
| `src/workers/grade.worker.ts` | Constitution I names grading of long performances as work that must be off the main thread; SC-006 caps main-thread tasks at 50 ms while a 500-measure Grade is produced | Grading on the main thread "because it is probably fast enough" - the rule is a rule, and the dense-log case is exactly what nobody measures until it is slow. The worker holds no logic, so it costs no testability |
| IndexedDB store `performances` (DB version 1 -> 2) | A ten-minute run is tens of kilobytes of messages; `localStorage` is restricted to tiny UI preferences | A second database (two upgrade paths for no gain); `localStorage` (wrong tier, and it would evict Scores) |
| Sub-block rendering in the worklet | Applying all events then rendering once quantises every click to a render block (2.7-2.9 ms), which is the whole of SC-002's 3 ms budget | Leaving it: the budget would be spent before the first real jitter. `splits` is already computed and tested; using it allocates nothing |
| MusicXML: `<arpeggiate>` and the four `<ornaments>` elements (owner-approved, D-1 and D-2) | Without them FR-024's "playing an ornament is neutral" and FR-022's chord rule contradict the Grade a musician actually gets: a correct trill scores worst in the piece and a written arpeggio reads as late | Grading them as ordinary notes (the status quo) - rejected by the owner because it punishes correct playing; suppressing unclaimed presses without parsing - impossible, nothing in the model says a note is ornamented (R-17) |

## Phase 0: Research (`research.md`)

Seventeen decisions recorded there: where Play's logic lives and why the run is pure too (R-01); the Metronome as
scheduled events, the click sound and the block-quantisation fix (R-02); one purpose-built schedule per run with
the count-in in front (R-03); mapping MIDI timestamps onto the audio clock (R-04); what the Latency profile
actually is today and what "offer to measure it" means, including the correction to the spec's assumption (R-05);
windows as fractions of a beat compared in ticks (R-06); the two-pass matcher and the rules that keep it honest
(R-07); grading in a worker around a pure function (R-08); Performance logs in IndexedDB, 20 per Score (R-09);
replay as a compiled schedule rather than timers (R-10); two axes of marks that survive greyscale (R-11); what
makes a stretch of a Grade unreliable (R-12); reasons as structured data, words only in the UI (R-13); the
per-measure overview and the hand-off to Practice mode (R-14); expected notes from Practice mode's builder
(R-15); the count-in's length, its downbeat rule and the recording that outruns the run at both ends (R-16); and
the ornament, arpeggio and glissando fairness gap that this feature cannot close alone (R-17).

The grading semantics were reviewed by the `music-domain-expert` role on 2026-09-20. It supplied the window
values and their derivation, the clamp-inertness invariant, the neighbour-clamp rule that makes SC-014's second
clause true by construction, the order-preserving matcher, the count-in rules of R-16 - and nine findings against
the spec, five of which are folded into the design above and four of which are the owner's to decide (below).

## Phase 1: Design

- `data-model.md`: the Play run and its state machine, the tick map and schedule options, the Performance log,
  expected notes, the two result axes with their invariants, the strictness levels and their windows, run
  settings, the Latency profile, the stored performance and the Grade, and the named constants.
- `contracts/play-run.md`: the run reducer, its effects, `compilePlaySchedule`, and the additive engine and
  worklet changes (ports 1.2.0, worklet protocol 1.2.0).
- `contracts/grading.md`: `gradePerformance`, the normative four steps (one axis, resolved windows, the two-pass
  match, timing and summary) and the worker messages.
- `contracts/performance-log.md`: the persisted log, IndexedDB schema 1 -> 2 with its upgrade rule, retention, and
  the two new `localStorage` keys.
- `quickstart.md`: how to run and manually verify each user story, the fixtures each success criterion needs, and
  what to suspect when a result looks wrong.
- `docs/agents/reference.md`: Active Technologies and Recent Changes updated (no new technology; the note records
  the grading worker, the performances store and the two RT changes).

### Post-design re-check (Constitution)

Re-run after the documents above were written. All eight rows still pass, and the design made four things sharper:

- **I**: writing `contracts/play-run.md` forced the Metronome question into the open. Scheduling clicks as data
  rather than writing a metronome removed an entire real-time component from the feature; what is left is one
  bounded message and a rendering change that uses an array the code already fills. That is the smallest RT
  surface this feature could have had, and it is the reason the gate passes without an exception.
- **II**: the spec's assumption that feature 001 provides a Latency profile turned out to be false (R-05). The
  honest consequence - build the profile and the calibration here - is bigger than the spec implied, so it is
  named in the plan, in the log and (as a scope note) below, rather than absorbed quietly.
- **IV**: making the matcher's **visiting order** normative in the contract is what turns "grading is
  deterministic" from an aspiration into something a reviewer can check. The first draft left the order implicit,
  which would have made SC-001 pass by accident on small fixtures and fail on a trill.
- **VI**: two result axes need two visual channels; the draft that coloured one and outlined the other broke on
  missed notes, which have no timing result at all (R-11).
- **II again, after the domain review**: the first draft satisfied SC-014 with a millisecond floor and cap, which
  cannot satisfy it - at 160 bpm a 150 ms floor overlaps a stream of sixteenths 94 ms apart. The fix is a clamp
  expressed as a fraction of the *gap* to the neighbouring onset, applied after the floor, at exactly 0.5 so
  adjacent windows meet at the midpoint. That single rule also makes the repeated-pitch guarantee a theorem
  rather than a policy, because two same-pitch windows then cannot overlap (R-06, R-07).

### Owner decisions (AGENTS.md section 7) - all four answered on 2026-09-20

Four findings changed user-visible behaviour, a success criterion or MusicXML scope, so they went to the owner.
**All four were answered with the recommendation**, and spec, data model, contracts and tasks now carry the
answers; nothing here is open.

| # | Question | Answer (2026-09-20) | Where it landed |
|---|---|---|---|
| D-1 | **Ornaments** (R-17). A correctly played trill produces presses no expected note can claim, so FR-018 reports them as extra and an excellent trill becomes the worst-scoring thing in the piece - while the spec's own edge case says playing an ornament "is neutral". Closing it needs `<ornaments>`, `<trill-mark>`, `<mordent>`, `<turn>` and `<tremolo>` parsing, which is new MusicXML scope | **Accepted.** Parse the ornament elements; presses of the ornamented note's pitch and its diatonic neighbours, within its written duration, are played-along | FR-024, SC-016, `ORNAMENT_NEIGHBOUR_STEPS`, `PlayedAlongSpan` (R-18), tasks T085, T102 |
| D-2 | **Written arpeggios** (R-17). `<arpeggiate>` means the chord *should* be rolled, so FR-022 marks a correct performance late. Also new MusicXML scope | **Accepted.** Parse `<arpeggiate>` and use `PLAY_ARPEGGIO_SPREAD_BEATS = 0.5` in place of the chord spread there | FR-022, SC-016, data-model section 6, tasks T086, T101 |
| D-3 | **SC-015 says the live marks and the Grade agree for 100% of the notes they cover**, but FR-011a exists precisely because they can disagree, and with the order-preserving matcher they provably can: a live "correct" can be overturned when a later press turns out to be that note's match | **Softened.** SC-015 becomes at least 95% over the reference fixtures with the disagreement mechanism documented; the live marker stays a cheap same-pitch test and marks only "correct" | SC-015, FR-011, AS-1.13, `liveMark` (play-run 1.1.0), task T044. *The live marker was removed by 009's owner review (009 research R-15, play-run 2.0.0)* |
| D-4 | **FR-003's "nothing played during the count-in is graded"**, read literally, makes an early first note impossible - and playing the first note slightly early is the commonest beginner tendency there is (R-16) | **Accepted.** The exclusion is the count-in minus the first expected note's early claim window | FR-003, AS-1.1, data-model sections 1 and 2, performance-log rule 4, tasks T023, T033 |

### Scope note

The Latency profile and its calibration (R-05, FR-034) are a bigger piece of work than the spec's Assumptions
suggested, because feature 001 supplies neither (the spec's Assumptions now say so). They are **not** on the P1
path: US1 grades correctly with an assumed profile that the Grade labels honestly, so the calibration sits with
US2, where FR-034 lives, and US1 stays free of it.

The fairness work D-1 and D-2 unlocked **is** on the P1 path, because it changes what a US1 Grade says about a
correct performance: the ornament and arpeggio tasks (T085, T086, T101, T102) and the played-along pass (T092,
T093) belong to US1, not to a later story.

### `/speckit.analyze` findings folded in (2026-09-20)

The read-only analysis found 22 issues (1 CRITICAL, 5 HIGH, 8 MEDIUM, 8 LOW). All are resolved in these
documents; the ones that changed the design rather than the wording are:

- **SC-003 and SC-004 had no task at all** - the two criteria that prove latency compensation is right. Now
  T089.
- **Timing-path tasks had no RT review**: `tickAtAudioTime`, the MIDI clock map, the latency compensation and
  the schedule compiler are in `rt-audio-reviewer`'s scope and in this file's own rule. Now T090 and T091.
- **FR-024 was not representable**: `GradeInput` carried only graded notes, so every accompaniment press would
  have been extra. Now `PlayedAlongSpan` (R-18, grading contract 1.1.0, T092, T093).
- **The count-in reach-back contradicted itself** in four places (data-model sections 1 and 2, performance-log
  rule 4, play-run). One rule now: "no press earlier than `firstOnsetTick - claimEarly(first)`".
- **`METRONOME_CHANNEL` was not reserved** by the instrument allocator, so a Score could be allocated to it
  (R-19, T094, T095).
- **`PLAY_WINDOW_ABSOLUTE_FLOOR_MS` was unused and contradicted** by the neighbour clamp. The clamp now wins
  explicitly and the floor became a `timingNotResolvable` reporting rule.
