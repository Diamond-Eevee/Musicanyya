# Implementation Plan: Metronome and Orchestra Volume, Morning Mood with Orchestra

**Branch**: `019-metronome-orchestra-volume` | **Date**: 2026-10-01 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/019-metronome-orchestra-volume/spec.md`

## Summary

Two user levels on top of the main Volume - **Metronome** and **Orchestra** - in a non-modal **Levels** popover next
to the toolbar Volume slider, remembered in the user settings (format version 3). The Metronome level reuses the
click channel's CC7 path (`muted ? 0 : level`); the Orchestra level is MIDI expression (CC11) on dedicated Orchestra
channels, applied by the `score-player` worklet, so sustained notes follow at once and the Score's own part balance
is kept (research R-5 to R-7).

An **Orchestra** is a MusicXML part whose every staff is marked `<staff-details print-object="no">` (standard
MusicXML). It is parsed as `Part.orchestra` with every note `printed: false` - which already keeps notes out of
Practice, Play, grading and marks (017) - cut out of the render copy so Verovio never engraves it, left out of the
cursor's visual spans, played on its own channels in Listen and Play (independent of the Accompaniment setting) and,
in Practice, started with the musician's progress through new `orchestraOn/Off` effects on its own channel
(R-1 to R-10).

The library gains Grieg's **Morning Mood** in the composer's own piano arrangement (Schirmer 1899, public domain,
Internet Archive `31761045200615`; **owner approval of the source needed, OD-1**), transcribed twice independently and
compared mechanically, then checked visually against the print (R-14, R-15). Its Orchestra - flute and oboe doubling
the melody in Grieg's alternation, strings sustaining the left-hand harmony, optional horns at the climax - is
generated from a reviewed orchestration definition by a dev tool (cellos on the left-hand melody, horns on the quiet
return, in the style of Grieg), and machine-checked (every Orchestra note doubles a
piano pitch class sounding at that moment) (R-16). The browser marks items that have an Orchestra (R-17).

## Technical Context

**Language/Version**: TypeScript 7 (strict), HTML5, CSS3; no UI frameworks
**Runtime Dependencies**: none new (spessasynth_core 4.3.22 already handles CC11; verovio 6.3 unchanged)
**Storage**: `localStorage` `musicanyya.settings.v1` object version 2 -> 3 (two integers); no IndexedDB change
**Testing**: Vitest (core, worklet harness, offline render, settings, library tools, regeneration); Playwright (Levels
panel, Morning Mood engraving, persistence in browser and Electron)
**Shells / Delivery Targets**: browser and Electron (same code); Native audio plugin not shipped - the port changes
(`setOrchestraLevel`, live `channel`) are part of the `AudioEngine` contract it will implement
**Target Browsers**: latest 2 Chrome + Edge (reference); Firefox; Safari = view + Listen (Orchestra and levels work there
too: no Web MIDI needed)
**Performance Goals**: a level change heard within 100 ms (next render block, <= 3 ms; SC-001); no dropout while a
slider moves for 10 s (SC-009); peak synth voices for Morning Mood < 50 % of the 350-voice cap (R-11); opening Morning
Mood within the existing load budget (render copy stays one linear pass)
**Real-time Paths Touched**: AudioWorklet message handler (`orchestraLevel`, schedule setup CC11, `live.channel`
validation) and `process()` live drain (reads one more pre-allocated slot) -> RT review mandatory
**Constraints**: no allocation in `process()`; Note IDs of printed notes unchanged; Grades of existing Scores
unchanged (golden tests); core runs in Node; library content CC0 / public domain only, checked mechanically
**Scale/Scope**: one new library item (~90 bars, piano + 3-4 Orchestra parts); 16 MIDI channels (13 melodic free)

## Constitution Check

*GATE: must pass before Phase 0 research; re-checked after Phase 1 design (below: post-design status).*

| # | Principle | Question | Status |
|---|---|---|---|
| I | Real-Time Safety (Web and Native) | New code in AudioWorklet/plugin callbacks allocation-, await- and log-free? Sounds scheduled ahead on the audio clock (no timers)? Heavy work off the main thread? | [x] Levels are controller changes applied in `port.onmessage` into pre-allocated state; the live queue gets a pre-allocated channel array; Orchestra notes are schedule events (Listen/Play) or live messages applied at the next block (Practice, as today's accompaniment). No timer decides a sound. RT review task required. |
| II | One Clock, Measured Latency | All events on the audio-clock timeline, MIDI timestamps mapped onto it? Integer ticks in core? Latency compensated? Tolerances named & configurable? | [x] Orchestra events are ordinary timeline events (integer ticks, same tempo map, same count-in shift); levels never touch timing. New constants named in `defaults.ts` (data-model §7). |
| III | Score Fidelity, Engraving & Note Identity | Canonical score model + Note IDs (= SVG ids)? Verovio engraving? Unsupported MusicXML degrades gracefully? | [x] One model (`Part.orchestra`). Printed Note IDs unchanged. Orchestra notes are sounding-only, not playable (constitution 1.3.1 clarification of Principle III, owner-approved 2026-10-01, OD-4): they keep a Note ID as their schedule key, have no SVG element, and are never expected, graded, marked, counted, offered or Advice anchors (orchestra-score §6, enforced by T020-T025). The 017 `print-object="no"` notes still render hidden elements; this is a new case, not a precedent. Verovio engraves the piano only; other hidden-staff uses: warning + printed; library piano part checked mechanically (double entry) and visually. |
| IV | Test-First Core, Deterministic Grading | Tests first? Core testable in Node with fakes? Golden tests for grading? | [x] Parser, render copy, channels, schedules, practice effects, facts and tools all pure and Node-tested first; offline render tests for levels; existing grading goldens must not change; new golden for a Morning Mood run with and without Orchestra (SC-005, task T076). |
| V | Layered, Framework-Free, Platform-Agnostic | No UI frameworks? core has no DOM/Web APIs? Platform features behind ports? Browser works without Electron/plugin? Electron secure defaults? Device loss recoverable? | [x] Core decides what is Orchestra and what plays; engine maps levels to controllers behind `AudioEngine`; UI only renders and reports slider values. Plain custom element + popover. A new worklet node gets the held levels again (device change). |
| VI | Musician-First Feedback | Colour + shape, nothing modal during a session, explainable results, overlays never hide notes? | [x] Non-modal popover usable during a session; disabled slider explains why; browser marker = glyph + text; nothing changes the score overlays. |
| VII | Pedagogy as Data | Advice as schema-validated JSON anchored to Note IDs/measures? Invalid entries skipped, not fatal? | [x] Not affected; the orchestration is data (JSON definition, schema in the contract), and Advice must never anchor to Orchestra notes (orchestra-score §6). |
| VIII | Simplicity, Web-First Delivery | P1 is a usable MVP? Web APIs before libraries? New runtime deps justified below? | [x] US1 (Metronome level) alone is useful on every Score; no new dependency; CC11 reuses the synth's standard controller rather than a mixer graph. |

**Post-design re-check (after Phase 1)**: all eight pass. III passed after the constitution audit's CRITICAL finding
(2026-10-01) was resolved by owner decision OD-4: constitution 1.3.0 -> 1.3.1 clarifies "playable note" (see
Complexity Tracking).

## Project Structure

### Documentation (this feature)

```text
specs/019-metronome-orchestra-volume/
|-- spec.md
|-- plan.md                     # this file
|-- research.md                 # R-1 .. R-18
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- orchestra-score.md          # new 1.0.0
|   |-- mixer-levels.md             # new 1.0.0
|   |-- orchestration-definition.md # new 1.0.0
|   `-- contract-changes.md         # version bumps of 001/002/003/004/005/007/013 contracts
|-- checklists/requirements.md
`-- tasks.md                    # /speckit:tasks
```

### Source Code (repository root)

```text
src/core/
|-- defaults.ts                         # METRONOME_LEVEL_DEFAULT, ORCHESTRA_LEVEL_DEFAULT, MIXER_LEVEL_STEP, EXPRESSION_CONTROLLER, test tolerances
|-- score/model.ts                      # Part.orchestra
|-- musicxml/build.ts                   # staff-details print-object detection, warnings
|-- musicxml/render-copy.ts             # removals
|-- musicxml/support.ts                 # SUPPORT_MATRIX row
|-- musicxml/write.ts                   # (dev-only writer) staff-details print-object, sound dynamics
|-- timeline/instruments.ts             # Orchestra channels, ChannelSetup.orchestra
|-- timeline/timeline.ts, types.ts      # spans without Orchestra notes
|-- schedule/compile.ts                 # orchestraMask, mergeSchedules
|-- schedule/play-schedule.ts           # keep Orchestra events regardless of accompaniment
|-- play/metronome.ts                   # metronomeChannelVolume(muted, level)
|-- practice/expected.ts, matcher.ts, types.ts   # ExpectedEvent.orchestra, orchestraOn/Off
|-- grade/expected.ts                   # (verify) Orchestra never expected / played-along
`-- library/facts.ts, levels.ts, types.ts        # facts from printed parts, orchestra fact, arpeggiate exception (conditional)
src/engine/
|-- ports.ts                            # setOrchestraLevel, live channel, UserSettings v3
|-- audio/web-audio-engine.ts           # orchestraLevel message, held level, live channel
|-- worklets/score-player.processor.ts  # orchestraLevel, CC11 setup, live channel
|-- worklets/live-queue.ts              # channel slot
`-- storage/local-settings-store.ts     # settings v3
src/workers/score.worker.ts             # removals, summary.parts[].orchestra
src/app/session.ts, play-session.ts     # levels wiring, Practice orchestra effects, Metronome level
src/ui/
|-- elements/mx-transport.ts            # Levels button
|-- elements/mx-levels-panel.ts         # new popover panel
|-- elements/mx-browser-list.ts, mx-browser-detail.ts   # orchestra marker / instruments
|-- state/transportState.ts, viewState.ts               # levels, panel 'sound'
`-- i18n/en.ts, styles/*                # strings, styles
tools/library/orchestra/                # new: generator CLI (pnpm library:orchestra)
tools/library/fidelity/orchestra.ts     # new: checkOrchestra (O1-O5), wired into records/cli
content/library/orchestra/grieg-morning-mood.json          # orchestration definition
content/library/sources/ia-31761045200615-grieg-op46-schirmer/source.json   # scan manifest (after OD-1)
content/library/sources/own-grieg-op46-no1-transcription-a/  # transcription A (.ly) + source.json
content/library/sources/own-grieg-op46-no1-transcription-b/  # transcription B (.ly) + source.json
content/library/audit/repertoire/advanced/grieg-morning-mood.json
public/library/repertoire/advanced/grieg-morning-mood.{musicxml,json}, public/library/index.json
tests/fixtures/musicxml/orchestra/      # own-work fixtures (orchestra-score §7)
tests/core/..., tests/engine/..., tests/library/..., tests/e2e/levels.spec.ts, tests/e2e/orchestra.spec.ts
docs/musicxml-support.md, THIRD_PARTY_NOTICES.md, docs/agents/reference.md (R7 commands)
```

**Structure Decision**: every layer is touched, each for its own concern: core decides what an Orchestra is and when it
sounds, engine turns levels into controller values, UI only shows and reports the levels, tools and content produce
the library item. No new layer, package or dependency.

## Complexity Tracking

No constitution violation and no new runtime dependency. Additions worth naming:

| Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Worklet `orchestraLevel` message + `orchestraMask` | Live level that reaches sustained notes and keeps part balance (FR-005) | Velocity scaling cannot reach sounding notes; CC7 overwrites the Score's part volumes (R-5) |
| `live.channel` in the worklet queue | Orchestra instruments keep their own sound in Practice (FR-014, FR-015) | Playing Orchestra notes on the live (piano) channel would make the oboe a piano |
| Dev tool `pnpm library:orchestra` + checker | Orchestra notes checked by machine, regenerable, reusable for later items (R-16) | Hand-written parts would be unchecked choices, against the library rule |
| Two transcriptions of the piano part | The only mechanical check possible without a machine-readable PD source (R-15) | A single transcription checked by eye repeats the 2026-09-23 Für Elise failure |
| Orchestra notes have Note IDs but no SVG element (Constitution III as clarified in 1.3.1, OD-4) | FR-012 / SC-004: no Orchestra staff, label or space may be engraved | Hidden staves inside Verovio are unreliable (R-2, R-18); a separate playback-only id namespace would split the one Score model |

## Phase 0: Research (`research.md`)

R-1 encoding, R-2 render copy, R-3 note identity, R-4 channels, R-5 Orchestra level (CC11), R-6 Metronome level,
R-7 scale and defaults, R-8 Practice, R-9 Play and replay, R-10 grading, R-11 voices, R-12 UI, R-13 settings,
R-14 source, R-15 transcription and verification, R-16 Orchestra generation, R-17 facts/level/browser marker,
R-18 domain-expert answers. No `NEEDS CLARIFICATION` left in the Technical Context.

## Phase 1: Design

- [data-model.md](data-model.md): Score/timeline/schedule/practice fields, settings v3, facts, orchestration
  definition, source-manifest origin, the library item, named constants.
- [contracts/](contracts/): orchestra-score 1.0.0, mixer-levels 1.0.0, orchestration-definition 1.0.0, and the
  version bumps in contract-changes.md.
- [quickstart.md](quickstart.md): commands and manual verification per story.
- `docs/agents/reference.md`: Active Technologies and Recent Changes updated (no new technology).
- Constitution Check re-run: passes (above).

## Decisions and open items

- Decided: Orchestra encoding = standard `<staff-details print-object="no">` on every staff (R-1).
- Decided: Orchestra level = CC11 on dedicated channels; Metronome level = existing click-channel CC7 (R-5, R-6).
- Decided: Levels popover next to Volume, defaults Metronome 100 % / Orchestra 60 %, step 5 (R-7, R-12).
- Decided: Orchestra plays in every mode regardless of the Accompaniment setting; silenced only by its level (FR-016).
- Decided: instruments flute, oboe, strings, cellos and horns, generated as doublings of the piano part in the style
  of Grieg's orchestration (R-16, R-18); the owner asked for "strings and oboe, up to you".
- Decided (spec corrected): the latency calibration plays no click today, so FR-006 covers the Play count-in and run
  only; Practice AS-6 / FR-015 say "no new note while waiting; sounding notes ring on" (the spec contradicted its own
  Assumptions).
- **Decided by the owner (OD-4, 2026-10-01): "Clarify"** - constitution amended to 1.3.1 with the wording below.
  Was: Constitution III says every *playable* note's Note ID is
  also its SVG element's id; 017 read "playable" as "played". Orchestra notes sound but are never engraved. Proposed
  PATCH clarification (via `/speckit:constitution`): "A playable note is a printed note the musician can be asked to
  play. Notes the Score marks as not printed (`<note print-object="no">`, parts whose every staff is
  `print-object="no"`) keep a Note ID as their schedule key but need no visible element, and MUST NOT be expected,
  graded, marked, counted in progress or used as Advice anchors." Alternative: engrave Orchestra parts (contradicts
  FR-012/SC-004) or drop the Orchestra.
- **needs owner (OD-1)**: approve the public-domain source - G. Schirmer, *First and Second Orchestra Suites from the
  Music to Peer Gynt*, arranged for pianoforte by the composer, *Morgenstimmung* ed. and fingered by Louis Oesterle,
  copyright 1899 (Internet Archive `31761045200615`) - for the piano part, including Oesterle's fingering. Blocks the
  library tasks (transcription, item, audit), not the levels or the Orchestra mechanism.
- **needs owner (OD-2, at the end)**: listening check SC-007 (recognisable piece, separate instruments, default
  Orchestra level); may change `ORCHESTRA_LEVEL_DEFAULT` or the definition's dynamics.
- Decided: implement the documented Advanced `<arpeggiate>` span exception - Morning Mood's rolled tenths need it
  (R-17, R-18); the regeneration test proves no other item changes level.
- **needs owner (OD-3, conditional)**: if the transcription confirms one-hand spans over 14 semitones that are not
  rolled (read from the print: bars 77-78, about two octaves over a low E in a second voice; bar 85), the item fails
  criterion 16 at every level. Raised with the measured facts after transcription A; options then: leave the item out
  (as *The Entertainer* in 017), or change the library's span rule for a note held in a second voice (a library rule
  change is the owner's).
- Inherited limitation (not fixed): in Practice, Orchestra notes between two expected events start together at the
  earlier one, as the accompaniment does today (R-8).
