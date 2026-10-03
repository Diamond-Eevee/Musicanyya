# Implementation Plan: Library Basics, Chord Lessons and More Songs

**Branch**: `022-library-basics-chords-songs` | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/022-library-basics-chords-songs/spec.md`

## Summary

Grow the library's base with about 88 new items: a top-level **Basics** shelf (24 lessons, one idea each, Introduction),
a **Learning > Chords** shelf (21 lesson definitions, 44 items: single chords, two-chord switches, progressions, with
simplified versions), and **10 new songs** from public-domain SATB sources, each as a full Intermediate arrangement
with a moving left hand plus a simplified Beginner version. Both kinds of lesson come from one new dev-only authored
format (`content/library/lessons/*.json`, `pnpm library:lessons`) written through the existing MusicXML writer;
songs extend the song builder with left-hand patterns. Two rule changes, both decided by the owner: the level check
no longer bans any notation (levels = hand reach + pace, OD-1), and Introduction items keep "one focus"
(criterion 29). Staccato becomes audible in playback (R9). No Orchestra parts, no grading change.

## Technical Context

**Language/Version**: TypeScript (strict), HTML5, CSS3; no UI frameworks
**Runtime Dependencies**: none new
**Storage**: none new (static content under `public/library/`; existing cache by hash)
**Testing**: Vitest (library tests, level-check unit tests, timeline golden tests, builder goldens, independent
checks); Playwright smoke + library spec on chromium
**Shells / Delivery Targets**: browser and Electron (same static content); Native audio plugin not touched
**Target Browsers**: latest 2 Chrome + Edge (reference); Firefox; Safari = view + Listen only (no Web MIDI)
**Performance Goals**: unchanged; the library index grows from 186 to about 274 items (index load and tree render
stay within the existing budgets - checked by the existing library e2e timing)
**Real-time Paths Touched**: none (the timeline computes an earlier note-off tick for staccato notes; the scheduler
and AudioWorklet are unchanged)
**Constraints**: every new item "comfortable" (`PLAYABLE_LIMITS`), zero parser notices, reproducible from its
definition; existing ids, levels and progress unchanged
**Scale/Scope**: items of 8-32 bars, two staves, one part

## Constitution Check

*Re-checked after Phase 1 design: all pass.*

| # | Principle | Question | Status |
|---|---|---|---|
| I | Real-Time Safety | No AudioWorklet, scheduler or plugin code changes; staccato only changes the end tick the timeline computes before scheduling. | [x] pass |
| II | One Clock, Measured Latency | Integer ticks: `round(durationTicks x STACCATO_SOUNDING_FRACTION)`, min 1 tick; the fraction and every level threshold are named constants in `src/core/defaults.ts`. | [x] pass |
| III | Score Fidelity, Engraving & Note Identity | Items are MusicXML loaded by our parser, engraved by Verovio; chord symbols as `<words>` (no notice); Note IDs unchanged; visual spans keep written length; new songs audited note for note against their source. | [x] pass |
| IV | Test-First Core | Level criteria, criterion 29, new facts and staccato timeline are unit-tested first in Node; builders golden-tested; independent checks (lesson-claims-v1, chord-lessons-v1, song-chords-v2) test-first; grading untouched, its goldens must stay identical. | [x] pass |
| V | Layered, Framework-Free | Core changes in `src/core` only (levels, facts, model, timeline, tags); tools stay dev-only (layers test); UI change limited to tag labels; no framework. | [x] pass |
| VI | Musician-First Feedback | No feedback change; explanations as text above bar 1 do not cover notes (screenshot check). | [x] pass |
| VII | Pedagogy as Data | Lessons and songs are versioned JSON definitions; every item passes "comfortable"; seventh chords split between hands (R5); no Advice files added. | [x] pass |
| VIII | Simplicity, Web-First | P1 (Basics) needs no owner source approval and is usable alone; no dependency; one new format instead of stretching the exercise generator. | [x] pass |

## Project Structure

### Documentation (this feature)

```text
specs/022-library-basics-chords-songs/
|-- spec.md, plan.md, research.md, data-model.md, quickstart.md
|-- contracts/
|   |-- lesson-definition.md      # new 1.0.0
|   |-- library-index-1.5.md      # change request -> 005 library-index.md
|   |-- song-definition-1.2.md    # change request -> 011 song-definition.md
|   |-- audit-record-1.5.md       # change request -> 007 audit-record.md
|   `-- source-manifest-1.4.md    # change request -> 007 source-manifest.md
|-- checklists/requirements.md
`-- tasks.md                      # /speckit:tasks
```

### Source Code (repository root)

```text
src/core/defaults.ts                    # retired level constants, criterion 29 constants, STACCATO_SOUNDING_FRACTION
src/core/library/levels.ts              # kept criteria + criterion 29
src/core/library/facts.ts               # hasPickup, hasDottedRhythm
src/core/library/types.ts               # SKILL_TAGS +7, ItemFacts +2
src/core/library/index-model.ts         # new facts (optional), tags
src/core/score/model.ts                 # Note.staccato
src/core/musicxml/build.ts              # read <staccato>
src/core/timeline/timeline.ts           # staccato sounding end
src/ui/i18n/en.ts                       # tag labels
tools/library/sections.ts               # basics, learning/chord-lessons (+3), orders
tools/library/build-lessons.ts          # new: pnpm library:lessons
tools/library/lessons/                  # new: definition types, token parser, writer
tools/library/build-songs.ts            # leftHand.pattern, simplifies, raisedBecause
tools/library/songs/definition.ts       # song-definition 1.2.0 types
tools/library/build-index.ts            # simplifies validation, new facts
tools/library/fidelity/lesson-claims.ts # new rule set
tools/library/fidelity/chord-lessons.ts # new rule set
tools/library/fidelity/song-chords.ts   # v2 option
tools/library/fidelity/sources.ts, records.ts, cli.ts   # multiPart, new rule sets
content/library/lessons/*.json          # 24 Basics + 21 chord-lesson definitions
content/library/songs/*.json            # 20 new song definitions (10 tunes x 2)
content/library/sources/mutopia-*/      # 10 new approved sources (after OD-2)
content/library/audit/**                # one record per new item
content/library/exercises/*.json        # raisedBecause for existing key-change items (FR-006)
public/library/basics/**, public/library/learning/chord-lessons/**, public/library/learning/keys/*/song-*  # generated
public/library/index.json               # regenerated
docs/library-audit.md, docs/musicxml-support.md (staccato row), THIRD_PARTY_NOTICES.md (sources)
package.json                            # library:lessons script
tests/library/*.test.ts, tests/unit/... # tests per task
tests/e2e/library.spec.ts               # Basics shelf first, Chords shelf
```

**Structure Decision**: content-and-tooling feature; core touched only in the library level model, facts, tags and
one score-model field with its timeline effect.

## Complexity Tracking

| Violation / Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| New dev-only format + builder (`library:lessons`) | Basics needs explicit single-pitch rhythms, ties, slurs, staccato, pickups, repeats; chord lessons need sevenths, sus, slash chords | Extending the exercise generator would force key/degree machinery onto notation lessons and risk 160+ exercise goldens (R3) |
| Three new independent check rule sets | Each authored item needs an audit check that does not trust its builder (audit contract) | Reusing `theory.ts` claims cannot express "introduced so far" or split seventh chords |

## Phase 0: Research

[research.md](research.md): R1 level rules (OD-1, criterion 29), R2 sections, R3 lesson format, R4 chord names, R5
comfortable sevenths, R6 checks, R7 song pairs, R8 minor beginner chords, R9 staccato playback, R10 explanation text,
R11 tags, R12 multi-part record, R13 song candidates, R14 untouched areas.

## Phase 1: Design

[data-model.md](data-model.md) (level criteria, sections, curriculum, chord catalogue, songs, facts, staccato,
constants), [contracts/](contracts/), [quickstart.md](quickstart.md). Constitution Check re-run: pass.

Suggested delivery order (for `/speckit:tasks`): Setup -> Foundation (level rules + facts + tags + staccato + sections
+ lesson builder + lesson-claims check; FR-006 raisedBecause for existing items) -> US1 Basics (MVP) -> US2 chord
lessons (+ chord-lessons-v1) -> US3 songs (owner gate OD-2 first; song builder patterns + song-chords-v2) -> US4
multiPart records -> polish (contract folds, docs, full gate).

## Decisions and open items

- Decided (owner OD-1, 2026-10-03): no level bans notation; levels = reach + pace; Introduction "one focus"
  (criterion 29). Existing items keep their levels with `raisedBecause` (FR-006).
- Decided: `basics` top-level (order 1); `learning/chord-lessons` (title "Chords") because `learning/chords` is a
  former id of Keys.
- Decided: one lesson-definition format for Basics and chord lessons; songs as full/simplified pairs; 6/8 allowed.
- Decided: Beginner minor songs may use `v` and `VII` (song-chords-v2); music review in tasks.
- **needs owner (OD-2)**: approve the 10 song sources of research R13 (or swap in reserves) before download. Blocks
  US3 only.
- **needs owner (OD-3)**: staccato sounds at half length in Listen/Play for every Score, which also changes how the
  existing Burgmüller Nos. 2 and 5 and both Morning Moods sound where staccato is printed. Recommended: yes (closer to
  the print). If no: Basics lesson 20/21 keeps the dots but Listen sounds the same (spec US1 scenario 5 would then
  need changing).
