# Implementation Plan: Guide Voice in Play Mode

**Branch**: `020-play-guide-voice` | **Date**: 2026-10-02 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/020-play-guide-voice/spec.md`

## Summary

In a Play run on a Score without an Orchestra, the musician's own expected notes (the graded notes of the chosen part,
hand and range) are played softly by an electric piano (GM program 5, "Tine Electric Piano" in the bundled bank) as the
**Guide voice**, governed by the existing Orchestra level.

The whole mechanism is one change in the core run-schedule compiler: `compilePlaySchedule` today **drops** graded
events; with the new required option `guide: true` and no Orchestra in the timeline, it **moves** them onto a free
melodic channel set up with `GUIDE_PROGRAM`, scales their velocity by `GUIDE_VELOCITY_SCALE`, and marks that channel as
governed by the Orchestra level in the run timeline, so it lands in the existing `orchestraMask` (research R-1 to R-5).
The count-in shift, range, tempo map, replay merge, CC11 level path, level persistence and device-loss re-send are all
reused from features 003 and 019. The worklet, engine, settings, grading and Performance log do not change. The Levels
panel stops disabling the Orchestra slider and explains that it sets the Guide voice on Scores without an Orchestra
(R-7).

Owner request (2026-10-02, after analyze): a part's volume and pan can carry over from the previously played Score,
because `compileSchedule` sends CC7 / CC10 only for parts with `<volume>` / `<pan>` and nothing resets them (R-10).
Fixed here in the core: every used channel except the Metronome's gets CC7 and CC10 at tick 0, the General MIDI
defaults when the Score gives none (spec FR-015, SC-009).

## Technical Context

**Language/Version**: TypeScript 7 (strict), HTML5, CSS3; no UI frameworks
**Runtime Dependencies**: none new (spessasynth_core 4.3.22 and GeneralUser GS 2.0.3 already bundled; program 4 is
present, research R-5)
**Storage**: none (no settings or log field; the Orchestra level `musicanyya.settings.v1` v3 is reused)
**Testing**: Vitest (core play-schedule, replay, grading golden, engine offline render); Playwright (Levels panel,
Play-mode schedule capture in browser and Electron)
**Shells / Delivery Targets**: browser and Electron (same code); Native audio plugin not shipped (honours
`orchestraMask` and channel programs when it ships, FR-014)
**Target Browsers**: latest 2 Chrome + Edge (reference); Firefox; Safari = view + Listen only (Play needs Web MIDI, so
no Guide voice there)
**Performance Goals**: level change heard within 100 ms (existing CC11 path, SC-006); guide onsets within 1 sample of
the scheduled frames (SC-001); peak synth voices with the guide < 50 % of the cap (R-6); compiling the run schedule
stays one linear pass over the timeline events
**Real-time Paths Touched**: none in code (no worklet, scheduler or MIDI change). The run schedule gets more note events
on one more channel, and every schedule more tick-0 controllers (applied in the existing message-handler setup path,
never in `process()`); the RT review confirms the voice headroom, the setup-controller bound and the Metronome channel
ordering (R-10).
**Constraints**: Grades and Performance logs unchanged; Listen and Practice schedules change only by the tick-0 CC7 /
CC10 defaults (R-10), so a Score played first on a fresh synth sounds exactly as before; with `guide: false` the play
schedule differs from 2.2.0 only by those defaults; core runs in Node
**Scale/Scope**: two core functions (`compilePlaySchedule`, `compileSchedule`), one UI element, one string, five
constants; 0-1 extra channel per run; up to 32 more tick-0 controller events per schedule (48 max, under
`MAX_SETUP_CONTROLLERS` = 64)

## Constitution Check

*GATE: must pass before Phase 0 research; re-checked after Phase 1 design (below: post-design status).*

| # | Principle | Question | Status |
|---|---|---|---|
| I | Real-Time Safety (Web and Native) | New code in AudioWorklet/plugin callbacks allocation-, await- and log-free? Sounds scheduled ahead on the audio clock (no timers)? Heavy work off the main thread? | [x] No RT code changes. Guide notes are ordinary events of the precompiled run schedule played by the existing sample-accurate worklet; the level is the existing CC11 message path. Voice headroom measured (R-6); RT review task confirms. |
| II | One Clock, Measured Latency | All events on the audio-clock timeline, MIDI timestamps mapped onto it? Integer ticks in core? Latency compensated? Tolerances named & configurable? | [x] Guide events reuse the run's tick shift and tempo map in the same function (no second tick-to-time conversion). New values named in `defaults.ts` (data-model §4). |
| III | Score Fidelity, Engraving & Note Identity | Canonical score model + Note IDs (= SVG ids for printed notes)? Verovio engraving? Unsupported MusicXML degrades gracefully? | [x] Score model, Note IDs and engraving untouched; the guide is derived from the same graded set the Grade uses. A Score that can be graded can be guided; no free channel -> no guide, run unaffected. |
| IV | Test-First Core, Deterministic Grading | Tests first? Core testable in Node with fakes? Golden tests for grading? | [x] Core tests first (guide-voice contract §5); `guide: false` byte-equality pins today's behaviour; grading golden with guided/unguided contexts and levels 0/60/100 (SC-004); offline render for timing, silence and loudness. |
| V | Layered, Framework-Free, Platform-Agnostic | No UI frameworks? core has no DOM/Web APIs? Platform features behind ports? Browser works without Electron/plugin? Electron secure defaults? Device loss recoverable? | [x] Core decides who is guided and how; engine untouched behind `AudioEngine`; UI only changes a hint. Device loss: the engine already re-sends the Orchestra level to a new node. |
| VI | Musician-First Feedback | Colour + shape, nothing modal during a session, explainable results, overlays never hide notes? | [x] The level stays in the non-modal Levels popover; the hint explains what the slider does on this Score; no overlay or Grade display changes. |
| VII | Pedagogy as Data | Advice as schema-validated JSON anchored to Note IDs/measures? Invalid entries skipped, not fatal? | [x] Not affected (guide events are never Advice anchors). |
| VIII | Simplicity, Web-First Delivery | P1 is a usable MVP? Web APIs before libraries? New runtime deps justified below? | [x] US1 + US2 are one small core change plus a hint; no dependency, no new setting, no new message. |

**Post-design re-check (after Phase 1)**: all eight pass; no Complexity Tracking entry needed.

## Project Structure

### Documentation (this feature)

```text
specs/020-play-guide-voice/
|-- spec.md
|-- plan.md                    # this file
|-- research.md                # R-1 .. R-9
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- guide-voice.md         # new 1.0.0
|   `-- contract-changes.md    # play-run 2.3.0, mixer-levels 1.1.0, worklet-protocol 1.7.0
|-- checklists/requirements.md
`-- tasks.md                   # /speckit:tasks
```

### Source Code (repository root)

```text
src/core/
|-- defaults.ts                       # GUIDE_PROGRAM, GUIDE_VELOCITY_SCALE, GUIDE_QUIETER_MIN_DB, DEFAULT_CHANNEL_VOLUME, DEFAULT_CHANNEL_PAN
|-- play/types.ts                     # PlayScheduleOptions.guide
|-- schedule/play-schedule.ts         # guide channel, moved graded events, PlaySchedule.guideChannel
`-- schedule/compile.ts               # CC7 / CC10 defaults for every used channel but the Metronome's (R-10)
src/app/
|-- play-session.ts                   # start(): guide: true
`-- session.ts                        # prepareStoredRun(): guide: true (regrade + replay)
src/ui/
|-- elements/mx-levels-panel.ts       # slider never disabled; guide hint
`-- i18n/en.ts                        # levels.guideVoice (replaces levels.noOrchestra)
tests/core/play/guide-voice.test.ts   # new
tests/core/play/play-schedule.test.ts, range.test.ts, metronome-mute.test.ts, replay.test.ts,
tests/core/grade/tempo-percent.test.ts, tests/core/schedule/setup-events.test.ts   # add guide: false to options
tests/core/schedule/compile.test.ts, setup-events.test.ts   # CC7 / CC10 defaults (R-10)
tests/engine/play-session.test.ts     # guided/unguided Grade equality (SC-004)
tests/engine/helpers/listen-render.ts # renderPlayRun: fixture paths, graded set, guide, Orchestra level, stop/pause, voice peak
tests/engine/guide-render.test.ts     # new: offline render SC-001/002/003/006, stop/pause, voices
tests/engine/channel-carryover.test.ts # new: SC-009
tests/e2e/levels.spec.ts              # disabled-slider assertions -> guide hint (spec FR-010)
tests/e2e/guide-voice.spec.ts         # new: schedule capture browser; Electron assertion in the Play spec
specs/003-play-mode-grading/contracts/play-run.md, specs/019-metronome-orchestra-volume/contracts/mixer-levels.md,
specs/001-score-viewer-listen/contracts/worklet-protocol.md   # version bumps (contract-changes.md)
```

**Structure Decision**: core owns the decision, the events and the channel defaults; app passes one flag; UI changes
one hint. No engine, worklet, worker, storage or tool change.

## Complexity Tracking

No constitution violation, no new dependency, layer or setting.

## Phase 0: Research (`research.md`)

R-1 where the guide is made, R-2 "has an Orchestra", R-3 guide channel, R-4 level path, R-5 sound and loudness,
R-6 voices, R-7 Levels panel, R-8 grading/input/display untouched, R-9 shells, R-10 volume/pan carry-over (owner
request). No `NEEDS CLARIFICATION` left.

## Phase 1: Design

- [data-model.md](data-model.md): option, result field, derived guide events and channel, decision states, constants,
  strings.
- [contracts/](contracts/): guide-voice 1.0.0; play-run 2.3.0, mixer-levels 1.1.0, worklet-protocol 1.7.0.
- [quickstart.md](quickstart.md): commands and manual checks per story, the listening check.
- `docs/agents/reference.md`: Recent Changes updated; no new technology.
- Constitution Check re-run: passes.

## Decisions and open items

- Decided (owner, spec Clarifications 2026-10-02): the Guide voice plays only the musician's expected notes.
- Decided: Guide voice = graded events moved to a free channel in `compilePlaySchedule`, behind a required `guide`
  option (R-1); level = Orchestra level via `orchestraMask` (R-4); electric piano program 4, velocity x 0.9 (R-5; was 0.6 until the owner asked for parity with the piano at level 100).
- Decided: the Levels panel's Orchestra slider is always enabled; the hint explains the Guide voice (R-7). Two e2e
  assertions in `tests/e2e/levels.spec.ts` change with the spec (FR-010 replaces 019 FR-010).
- **needs owner (OD-1, at the end)**: listening check SC-007 on two items without an Orchestra; may change
  `GUIDE_VELOCITY_SCALE` or `GUIDE_PROGRAM` (alternatives in the bank: FM electric piano, vibraphone, warm pad).
- Decided by the owner (2026-10-02): fix the volume/pan carry-over in this feature (R-10, FR-015, SC-009): CC7 / CC10
  defaults for every used channel except the Metronome's, in `compileSchedule`; the guide-only `GUIDE_CHANNEL_VOLUME`
  of the first draft is dropped.
- Decided (analyze 2026-10-02, owner: "resolve with recommended"): A1 T013-equivalent level test moved into US1's tests;
  A2 render-helper extension is its own foundational task; A3 stop/pause release asserted; A4 level sweep (SC-006)
  asserted; A5 SC-004 test location fixed above; A6 Listen schedule has no guide channel (e2e); A9 FR-003 "mellow".
