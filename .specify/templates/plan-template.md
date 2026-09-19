# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link to spec.md]
**Input**: Feature specification from `specs/[###-feature-name]/spec.md`

## Summary

[Primary requirement from the spec + chosen technical approach from research]

## Technical Context

<!-- Defaults come from the constitution's Platform & Technology Constraints.
     Replace with feature-specific detail; mark unknowns NEEDS CLARIFICATION. -->

**Language/Version**: TypeScript (strict), HTML5, CSS3; no UI frameworks
**Runtime Dependencies**: [e.g. verovio (WASM); each one justified in Complexity Tracking]
**Storage**: [e.g. IndexedDB stores / none]
**Testing**: Vitest (unit, golden snapshots, fakes); Playwright (e2e) where needed
**Shells / Delivery Targets**: [browser / Electron / Native audio plugin - which ones this feature touches]
**Target Browsers**: latest 2 Chrome + Edge (reference); Firefox; Safari = view + Listen only (no Web MIDI)
**Performance Goals**: [e.g. key press -> visual feedback <= 50 ms, 60 fps overlay, first page rendered <= 2 s]
**Real-time Paths Touched**: [AudioWorklet / lookahead scheduler / MIDI input timing / plugin callbacks / none]
**Constraints**: [e.g. no allocation in process(), no main-thread task > 50 ms during a session, core runs in Node]
**Scale/Scope**: [e.g. scores up to 500 measures, 4 staves]

## Constitution Check

*GATE: must pass before Phase 0 research; re-check after Phase 1 design.*

| # | Principle | Question | Status |
|---|---|---|---|
| I | Real-Time Safety (Web and Native) | New code in AudioWorklet/plugin callbacks allocation-, await- and log-free? Sounds scheduled ahead on the audio clock (no timers)? Heavy work off the main thread? | [ ] |
| II | One Clock, Measured Latency | All events on the audio-clock timeline, MIDI timestamps mapped onto it? Integer ticks in core? Latency compensated? Tolerances named & configurable? | [ ] |
| III | Score Fidelity, Engraving & Note Identity | Canonical score model + Note IDs (= SVG ids)? Verovio engraving? Unsupported MusicXML degrades gracefully? | [ ] |
| IV | Test-First Core, Deterministic Grading | Tests first? Core testable in Node with fakes? Golden tests for grading? | [ ] |
| V | Layered, Framework-Free, Platform-Agnostic | No UI frameworks? core has no DOM/Web APIs? Platform features behind ports? Browser works without Electron/plugin? Electron secure defaults? Device loss recoverable? | [ ] |
| VI | Musician-First Feedback | Colour + shape, nothing modal during a session, explainable results, overlays never hide notes? | [ ] |
| VII | Pedagogy as Data | Advice as schema-validated JSON anchored to Note IDs/measures? Invalid entries skipped, not fatal? | [ ] |
| VIII | Simplicity, Web-First Delivery | P1 is a usable MVP? Web APIs before libraries? New runtime deps justified below? | [ ] |

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
|-- spec.md              # /speckit.specify
|-- plan.md              # this file (/speckit.plan)
|-- research.md          # Phase 0 (/speckit.plan)
|-- data-model.md        # Phase 1 (/speckit.plan)
|-- quickstart.md        # Phase 1 (/speckit.plan)
|-- contracts/           # Phase 1 (/speckit.plan) - IPC commands/events, file formats
`-- tasks.md             # /speckit.tasks (NOT created by /speckit.plan)
```

### Source Code (repository root)

<!-- Target layout from AGENTS.md section 3. Keep only the parts this feature touches and
     add concrete file paths. -->

```text
src/
|-- core/            # pure TS: score model, MusicXML parser, tempo map/timeline, wait mode, grading, advice (no DOM)
|-- engine/          # ports (AudioEngine, MidiInput, Storage, Clock) + adapters (Web Audio, Web MIDI, IndexedDB, plugin client)
|   `-- worklets/    # AudioWorklet processors (RT code)
|-- ui/              # DOM + custom elements: score view (Verovio SVG + canvas overlay), transport, modes, results
`-- workers/         # Web Workers (Verovio, parsing)
electron/            # Electron main + preload (Electron features only)
native/              # Native audio plugin (plugin features only)
content/advice/      # Advice JSON + schema
tests/               # Vitest unit/golden tests, e2e/, fixtures/musicxml/ (origin + licence notes)
```

**Structure Decision**: [Which of the above this feature touches and why]

## Complexity Tracking

> Fill ONLY if the Constitution Check has violations or a new dependency/layer is added.

| Violation / Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| [e.g. new npm package X] | [need] | [why Web APIs / existing code are insufficient] |

## Phase 0: Research (`research.md`)

For each NEEDS CLARIFICATION or technology choice: **Decision**, **Rationale**,
**Alternatives considered**. Include spikes/measurements where latency or
MusicXML behaviour is uncertain.

## Phase 1: Design

- `data-model.md`: entities, fields, validation rules, state machines (e.g. session state).
- `contracts/`: port interfaces (AudioEngine, MidiInput, Storage), worker/worklet message formats, Electron preload
  bridge / plugin protocol, persisted formats (Performance log, settings, Advice JSON Schema) - all versioned.
- `quickstart.md`: how to run and manually verify each user story.
- Update the `Active Technologies` section in `AGENTS.md` if new tech was added.
- Re-run the Constitution Check above.
