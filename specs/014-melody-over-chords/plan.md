# Implementation Plan: Melody over chords in Learning exercises

**Branch**: `014-melody-over-chords` | **Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/014-melody-over-chords/spec.md`

## Summary

59 generated Learning items (54 key-change items, 5 chord-change drills) play the same block chord in both hands in
every bar. The right hand gets a single-note melody instead - scale steps of the key in force, a chord tone on every
chord start, the raised seventh where minor needs it, ending on the tonic - while the left hand keeps its chords
exactly. Melodies are authored as scale-step phrases in the exercise definitions (a new `melody` hand part, contract
exercise-definition 1.3; a few variants rotated across keys), spelled, placed and fingered by the pure generator, and
verified by an independent melody rule check (Difficulty ladder, harmony, fingering, register, variation) that runs
in the build, the audit (`exercise-theory-v3`) and a shelf sweep. Progress on the rewritten items starts fresh by
construction (new content hash); the 5 drills drop their `supersedes` links. No run-time code changes.

**Amendment 2026-09-28 (owner listening check T057, research R11)**: the introduction and beginner melodies move up to
the key step's level (quarter notes, scale runs up to an octave with thumb-under / finger-over; beginner adds leaps of
a third and half-bar chord changes), and the key-change items' left hand gets moving progressions of primary triads
(FR-002 amended; key change, section tonics and the chord before the change kept). The drills are unchanged. Work:
Phase 6 of `tasks.md` (ladder constants and checker tests, left-hand chord plans and their claims, re-composed
introduction/beginner phrases, then the parallel/relative intermediate re-checked, regeneration, review, gate, and a
new owner listening check).

## Technical Context

**Language/Version**: TypeScript (strict), HTML5, CSS3; no UI frameworks
**Runtime Dependencies**: none new
**Storage**: none new; progress stays keyed by content hash (feature 013)
**Testing**: Vitest (generator unit tests, goldens, melody rule check, shelf sweep, level/step-order checks);
Playwright e2e unchanged except where a test names a rewritten item's notes
**Shells / Delivery Targets**: browser and Electron see only regenerated static files under `public/library/`;
Native audio plugin not involved
**Target Browsers**: latest 2 Chrome + Edge (reference); Firefox; Safari = view + Listen only (no Web MIDI)
**Performance Goals**: no change (items are the same size class: <= 12 bars, one melody note per beat or fewer at
the lower levels)
**Real-time Paths Touched**: none
**Constraints**: generator stays pure (core runs in Node, no Date.now/fs); goldens of untouched families
byte-identical (SC-004); library files fully engraved on disk (feature 006); CC0 authored provenance
**Scale/Scope**: 11 definitions, 59 items, 59 audit records; about 6 new melody phrase sets x 2 modes x 2-3 variants

## Constitution Check

*GATE: must pass before Phase 0 research; re-check after Phase 1 design.*

| # | Principle | Question | Status |
|---|---|---|---|
| I | Real-Time Safety (Web and Native) | New code in AudioWorklet/plugin callbacks allocation-, await- and log-free? Sounds scheduled ahead on the audio clock (no timers)? Heavy work off the main thread? | [x] No RT code touched; the change is static content plus dev-time generation. |
| II | One Clock, Measured Latency | All events on the audio-clock timeline, MIDI timestamps mapped onto it? Integer ticks in core? Latency compensated? Tolerances named & configurable? | [x] Unchanged timeline. Generator uses integer ticks (DIVISIONS 4). The ladder's thresholds are a named constant (`MELODY_LADDER`, `src/core/defaults.ts`). |
| III | Score Fidelity, Engraving & Note Identity | Canonical score model + Note IDs (= SVG ids)? Verovio engraving? Unsupported MusicXML degrades gracefully? | [x] Items load through the unchanged path; files pass the library engraving guard (beams/accidentals on disk). Plain single-voice notes on staff 1, nothing new for the parser or Verovio. |
| IV | Test-First Core, Deterministic Grading | Tests first? Core testable in Node with fakes? Golden tests for grading? | [x] Generator tests and melody rule check tests first (planted faults per rule); new goldens for melody items; untouched goldens must stay byte-identical; grading untouched. |
| V | Layered, Framework-Free, Platform-Agnostic | No UI frameworks? core has no DOM/Web APIs? Platform features behind ports? Browser works without Electron/plugin? Electron secure defaults? Device loss recoverable? | [x] Generator in `src/core/library/exercise` (pure); checker in `tools/` (dev only, not shipped); layer test unchanged. |
| VI | Musician-First Feedback | Colour + shape, nothing modal during a session, explainable results, overlays never hide notes? | [x] Feedback unchanged; a finger is printed on every melody note (contract exercise-definition 1.3.1, research R6 amendment T062: the library requires full fingering coverage, feature 005 FR-006). |
| VII | Pedagogy as Data | Advice as schema-validated JSON anchored to Note IDs/measures? Invalid entries skipped, not fatal? | [x] Melodies are data in schema'd definitions (contract 1.3); no Advice change. |
| VIII | Simplicity, Web-First Delivery | P1 is a usable MVP? Web APIs before libraries? New runtime deps justified below? | [x] P1 (key-change items + ladder) ships alone; no dependency; reuses the level criteria, step order and theory reader. |

Post-design re-check (after Phase 1): all eight still pass; no Complexity Tracking entry needed.

## Project Structure

### Documentation (this feature)

```text
specs/014-melody-over-chords/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- exercise-definition-1.3.md   # melody hand part + drills' top-level melody
|   `-- audit-record-1.3.md          # exercise-theory-v3, checkMelodyRules (fidelity tools 1.12)
|-- checklists/requirements.md
`-- tasks.md                         # /speckit.tasks
```

### Source Code (repository root)

```text
src/core/
|-- defaults.ts                          # + MELODY_LADDER (data-model §4)
`-- library/exercise/
    |-- types.ts                         # + MelodyPart, MelodyPhrase, MelodyNote; ExerciseDefinition.melody
    |-- melody.ts                        # NEW: step -> pitch (octave-4 tonic), variant choice, fingering, events
    `-- generate.ts                      # handSegments: melody part; generateChangeItem: optional top-level melody
tools/library/
|-- build-exercises.ts                   # run checkMelodyRules; refuse to write on findings
|-- successors.ts                        # resetBy: '014' on the 5 drill entries
`-- fidelity/
    |-- melody-rules.ts                  # NEW: independent checker (data-model §5)
    |-- theory.ts                        # SectionHand melody; rule set v3
    |-- exercise-claims.ts               # right hand of key-change + drill claims -> melody
    `-- records.ts                       # THEORY_RULE_SETS + 'exercise-theory-v3'
content/library/
|-- exercises/key-change-{relative,parallel}-{introduction,beginner,intermediate}.json   # right: melody
|-- exercises/changes-*.json             # top-level melody; supersedes removed
`-- audit/learning/**                    # 59 records -> exercise-theory-v3
public/library/learning/**               # regenerated 59 items + index.json
docs/library-audit.md                    # regenerated
specs/005-practice-score-library/contracts/exercise-definition.md    # fold in 1.3
specs/007-library-fidelity-audit/contracts/{audit-record,fidelity-tools}.md   # fold in 1.3 / 1.12
tests/
|-- core/library/exercise/melody.test.ts          # NEW: spelling in 24 keys, octave, variants, fingering, throws
|-- core/library/exercise/goldens.test.ts         # + melody goldens (one per family)
|-- tools/fidelity/melody-rules.test.ts           # NEW: one planted fault per rule, clean fixture passes, independence
|-- library/melody-sweep.test.ts                  # NEW: all 59 items 0 findings, 0 doubled bars, variation
|-- library/identity.test.ts, library/index.test.ts   # exempt resetBy '014' entries (logged reason: FR-012)
`-- engine/ or core/browser/                      # leftover old-hash records cause no error (FR-012)
```

**Structure Decision**: Content and dev tooling only, plus a pure generator extension in `core`. No `engine`, `ui`,
`workers`, `electron` or `native` change.

## Complexity Tracking

None: no violations, no new dependency or layer.

## Phase 0: Research (`research.md`)

R1 authored phrases + rule check; R2 scope (59 items); R3 minor 6th/7th; R4 non-chord tones and clashes; R5 register
(octave-4 tonic); R6 fingering; R7 ladder vs existing level criteria and step order; R8 independent checker; R9
progress reset via content hash and dropped `supersedes`; R10 left hand unchanged. No open unknowns.

## Phase 1: Design

- `data-model.md`: melody part fields and validation, pitch rule, drill layout, `MELODY_LADDER`, finding rules,
  item table, audit records.
- `contracts/exercise-definition-1.3.md` (MINOR), `contracts/audit-record-1.3.md` (MINOR; fidelity tools 1.12).
- `quickstart.md`: regeneration commands and a screenshot-based manual check per story and for FR-012.
- `docs/agents/reference.md`: Active Technologies / Recent Changes updated (no new technology).

## Risks and notes for tasks

- **Authoring effort**: phrases must satisfy the checker in every key of a family; expect iterations. The build's
  refusal lists findings per item so variants can be fixed quickly.
- **Step order**: each key-change folder must stay introduction < beginner < intermediate on `notesPerBeat` and the
  other step-order facts; the sweep runs `checkStepOrder`.
- **Level check**: introduction's hand-independence 0 constrains phrases (research R7); runs of quarters are not
  counted (only runs faster than a quarter are), corrected in R11.
- **Tests that name old notes**: goldens and any e2e that reads a rewritten item's first notes change; each change is
  logged with the reason (behaviour changed by this feature), never loosened.
- **Owner listening check** (SC-005) is a final task before merge; items judged too hard are simplified.
- **Music review**: a `music-domain-expert` review of the authored phrases (findings summarised in the log) in
  addition to the mechanical check.
