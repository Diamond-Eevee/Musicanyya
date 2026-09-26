# Implementation Plan: Tempo as an Editable BPM Number

**Branch**: `012-tempo-bpm-field` | **Date**: 2026-09-26 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/012-tempo-bpm-field/spec.md`

## Summary

Replace the unlabelled tempo slider with a **tempo field** that reads "Tempo [-] 72 BPM [+] [reset] written 90":
the Score's written tempo from its MusicXML, counted in the note value of the metronome mark (a beat symbol when it is
not a quarter note), editable to any whole BPM, following the tempo in force at the cursor. The same field replaces
Play mode's percentage list, and attempts show "90 BPM (75% of written)".

Approach (research R-1 to R-11):

1. **Keep the engine's one tempo factor.** Everything downstream (worklet, schedule, Metronome, grading) keeps taking
   `tempoPercent`; the UI converts BPM <-> percent with pure core functions. The factor becomes any number in
   [25, 200] instead of a multiple of 5, so any whole BPM plays exactly and stored Performances regrade identically.
2. **Remember the mark's note value.** The parser reads every `<beat-unit>` with up to three dots into
   `TempoMark.beat`, reads "c. 90" and "90-100" as 90, drops metric modulations and absurd values, and fixes the
   silent "x1" fallback for whole/16th/breve units.
3. **A tempo display map** (core, built in the score worker next to the tempo map) says, for every tick, the played
   tempo, its beat (mark / inherited until a `<time>` change / Metronome's beat) and whether it is the default.
4. **`mx-tempo-field`**, a persistent custom element (text input + steppers + reset + beat glyph harvested from
   Verovio), fed by the transport factor or the Play settings and by a `tempoPositionState` published from the score
   view's existing frame loop.
5. **No carry-over**: the transport factor is no longer persisted and resets to 100 % on every Score open; a first
   Play setup starts at 100 %, a replayed Score keeps its remembered Play tempo.

No new dependency, no change inside `AudioWorklet.process()`, no grading formula change.

## Technical Context

**Language/Version**: TypeScript (strict), HTML5, CSS3; no UI frameworks
**Runtime Dependencies**: none new
**Storage**: `localStorage` as today: `musicanyya.settings.v1` (format 2, contract 2.1.0: `tempoPercent` no longer
written or read), `musicanyya.play.v1` (`RunSettings.tempoPercent` may be fractional); IndexedDB Performance records
unchanged in shape
**Testing**: Vitest (core in Node: beat units, per-minute parsing, display map, BPM <-> percent round trips, parser
fixtures, transport reducer, settings validation; UI in happy-dom: `mx-tempo-field`, transport, Play setup, attempts
list); Playwright e2e (type/step/reset in Listen, Play setup and lock during a run, phone width)
**Shells / Delivery Targets**: browser and Electron (same code); Native audio plugin untouched (it follows the factor
as today)
**Target Browsers**: latest 2 Chrome + Edge (reference); Firefox; Safari = view + Listen only (no Web MIDI)
**Performance Goals**: a confirmed tempo reaches the Audio engine in the same task (no added latency beyond today's
slider); the number follows a tempo change at the cursor within one frame; no per-frame DOM work when the segment is
unchanged; SC-002 beat spacing within 1 ms of 60/BPM
**Real-time Paths Touched**: none in code; the worklet's existing `tempo` message may now carry a fractional percent
and arrive once per step press (RT review planned, R-11)
**Constraints**: core stays DOM-free; no main-thread task > 50 ms (display map is O(marks x passes), built in the score
worker); the tempo field is never rebuilt while focused; typing never triggers shortcuts
**Scale/Scope**: Scores up to `MAX_MEASURES`; tempo maps with hundreds of segments (display lookup is a binary or
linear scan per frame only when the tick crosses a segment)

## Constitution Check

*GATE: must pass before Phase 0 research; re-check after Phase 1 design.*

| # | Principle | Question | Status |
|---|---|---|---|
| I | Real-Time Safety (Web and Native) | New code in AudioWorklet/plugin callbacks allocation-, await- and log-free? Sounds scheduled ahead on the audio clock (no timers)? Heavy work off the main thread? | [x] No worklet or plugin code changes; the tempo message and its handler are as today (R-11). No timer decides sound; the field reacts to events and the score view's existing frame loop. Display map built in the score worker. RT review of the tempo-change path planned. |
| II | One Clock, Measured Latency | All events on the audio-clock timeline, MIDI timestamps mapped onto it? Integer ticks in core? Latency compensated? Tolerances named & configurable? | [x] Tempo still one tempo map x one factor, the single tick <-> time conversion site (`rate.ts`). Display segments use the same integer ticks. New limits are named constants (`TEMPO_BPM_STEP`, `TEMPO_MARK_QPM_MIN/MAX`, `TEMPO_BEAT_DOTS_MAX`). |
| III | Score Fidelity, Engraving & Note Identity | Canonical score model + Note IDs (= SVG ids)? Verovio engraving? Unsupported MusicXML degrades gracefully? | [x] One Score model, extended (`TempoMark.beat`, `isDefault`); unreadable or absurd marks are dropped like today, the Score opens. Engraving untouched; the beat glyph uses Verovio's own Leipzig shapes (R-7). The x1 unit bug fix improves fidelity (logged in `docs/musicxml-support.md`). |
| IV | Test-First Core, Deterministic Grading | Tests first? Core testable in Node with fakes? Golden tests for grading? | [x] Tasks are test-first; all new logic is pure core. Grading formulas unchanged; golden results must stay byte-identical; old stored percentages regrade identically (SC-005); fractional percentages round-trip exactly (R-1). |
| V | Layered, Framework-Free, Platform-Agnostic | No UI frameworks? core has no DOM/Web APIs? Platform features behind ports? Browser works without Electron/plugin? Electron secure defaults? Device loss recoverable? | [x] Custom element, no framework; core -> engine -> ui direction kept (`tempo-display.ts` in core, field in ui). No new port. Browser alone suffices. |
| VI | Musician-First Feedback | Colour + shape, nothing modal during a session, explainable results, overlays never hide notes? | [x] Nothing modal; invalid input silently restores. The tempo is stated as a number, unit and note symbol (not colour). Attempts state BPM and percent, which makes a Grade's tempo explainable. |
| VII | Pedagogy as Data | Advice as schema-validated JSON anchored to Note IDs/measures? Invalid entries skipped, not fatal? | [x] Not touched. |
| VIII | Simplicity, Web-First Delivery | P1 is a usable MVP? Web APIs before libraries? New runtime deps justified below? | [x] US1+US2 (the transport field) are the MVP. No dependency, no font file; the library index is not regenerated (R-10); the engine factor is reused instead of a new tempo representation (R-1). |

**Post-design re-check (after Phase 1)**: all eight still pass; no violation, so Complexity Tracking stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/012-tempo-bpm-field/
|-- spec.md
|-- plan.md              # this file
|-- research.md          # R-1 .. R-11
|-- data-model.md        # TempoBeat, TempoMark, TempoDisplaySegment, tempo factor, reference position, field states
|-- quickstart.md
|-- contracts/
|   |-- tempo-display.md     # core API 1.0.0 (new)
|   |-- tempo-field.md       # mx-tempo-field 1.0.0 (new)
|   `-- contract-changes.md  # bumps to 001/003/004 contracts
|-- checklists/requirements.md
`-- tasks.md             # /speckit.tasks
```

### Source Code (repository root)

```text
src/core/
|-- defaults.ts                 # constants (data-model section 7); TEMPO_PERCENT_STEP removed
|-- score/model.ts              # TempoBeat; TempoMark.beat, .isDefault
|-- musicxml/build.ts           # read beat unit + dots, parsePerMinute, bounds, default mark flagged
|-- tempo/beat-unit.ts          # NEW beatOf, metronomeBeatAt, parsePerMinute, beatLabel
|-- tempo/tempo-display.ts      # NEW buildTempoDisplayMap, displaySegmentIndexAt, writtenBpm, shownBpm, bpmLimits, percentForBpm
|-- transport/transport.ts      # clampTempoPercent without step; 'newScore' resets tempoPercent to 100
`-- library/facts.ts            # unchanged meaning (R-10); comment only
src/engine/
|-- ports.ts                    # UserSettings without tempoPercent; doc comments
|-- config.ts                   # re-exports without TEMPO_PERCENT_STEP
|-- storage/local-settings-store.ts  # settings 2.1.0; Play tempoPercent finite 25..200; lastUsed tempo not applied
`-- worklets/dispatch.ts        # doc comment only ("25..200", not "integer")
src/workers/
|-- score.worker.ts             # TimelineDto.tempo
|-- glyphs.ts                   # harvest noteheadHalf, noteheadWhole, flag8thUp
`-- verovio.worker.ts           # ready.glyphs carries them
src/app/session.ts              # no tempo persistence; tempoPositionState rest positions; Play-mode binding of the transport field; lock during runs
src/ui/
|-- elements/mx-tempo-field.ts  # NEW (contracts/tempo-field.md)
|-- elements/mx-transport.ts    # persistent mx-tempo-field instead of the range input
|-- elements/mx-play-panel.ts   # mx-tempo-field instead of the percentage <select>
|-- elements/mx-attempts-list.ts, mx-grade-panel.ts  # "90 BPM (75% of written)"
|-- elements/mx-library.ts      # "Tempo: 90 BPM"
|-- elements/mx-score-view.ts   # TimelineDto.tempo; publishes tempoPositionState
|-- state/tempoPositionState.ts # NEW
|-- state/transportState.ts     # applySavedSettings without tempo
|-- i18n/en.ts                  # BPM, written, default, reset, beat labels, attempt tempo text
`-- styles/*.css                # tempo field layout, phone width
tests/
|-- core/tempo/beat-unit.test.ts, tempo-display.test.ts   # NEW
|-- core/musicxml/…             # metronome-mark cases, snapshot updates for TempoMark fields
|-- core/transport/transport.test.ts, core/tempo/rate.test.ts, engine/worklets/dispatch.test.ts  # fractional percent
|-- engine/storage/…            # settings 2.1.0, play settings
|-- ui/tempo-field.test.ts      # NEW; transport, setup-panel, attempts-list, grade-panel updated
|-- library/…                   # every library item's first mark counts quarters (R-10)
|-- fixtures/musicxml/          # NEW tempo fixtures (quickstart)
`-- e2e/tempo-field.spec.ts     # NEW; us2-listen, us3-play-setup, helpers/play.ts updated from slider/select to the field
docs/musicxml-support.md        # metronome-mark row: note values, dots, c./ranges, modulation ignored
```

**Structure Decision**: Core (model, parser, new tempo-display) carries all rules and is tested in Node; the engine
changes only persistence/validation; the UI gets one new element reused in two places. Existing e2e tests that drive
the slider or the percentage list change because the control changes (behaviour change, recorded in the log), not
to go green more easily.

## Complexity Tracking

No violations and no new dependency or layer.

## Phase 0: Research (`research.md`)

Done: R-1 factor, R-2 parsing, R-3 sound vs mark, R-4 beat inheritance (owner-approved), R-5 default tempo, R-6 input
element, R-7 beat glyphs, R-8 persistent field + position store, R-9 persistence, R-10 library consistency, R-11 RT.
The `music-domain-expert` answered R-2 to R-5 and R-7; its "c. 90" and beat-carry recommendations were approved by the
owner and written into the spec.

## Phase 1: Design

Done: [data-model.md](data-model.md), [contracts/tempo-display.md](contracts/tempo-display.md),
[contracts/tempo-field.md](contracts/tempo-field.md), [contracts/contract-changes.md](contracts/contract-changes.md),
[quickstart.md](quickstart.md). No new technology, so Active Technologies in `docs/agents/reference.md` is unchanged;
Recent Changes has the 012 entry.
