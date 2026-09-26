# Implementation Plan: Learning by key

**Branch**: `011-learning-by-key` | **Date**: 2026-09-26 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/011-learning-by-key/spec.md`

## Summary

Turn the flat *Learning* shelf (24 `triads-<key>` drills, 13 chord-change drills, one hand-written scale-and-chords
piece) into **Learning > Keys > <key>** (24 folders, circle-of-fifths order, each major followed by its relative
minor) and **Learning > Key changes > <from> -> <to>** (16 folders: C, G, F, D major to and from their relative and
parallel minors). Every key folder holds the same four generated steps - Introduction, Beginner, Intermediate,
Advanced - plus the existing drills that fit it, plus public-domain **songs** (melody right hand, block chords left
hand).

Approach, all inside the existing library pipeline (feature 005 generation and index, feature 006 engraving guard,
feature 007 fidelity audit):

1. **Generate, don't hand-write.** The exercise definition format gains a *pattern* form (scale in one hand against
   chords in the other, hands swapping) and a *key-change* form (two keys, a new key signature mid-piece). One
   definition per step produces that step in all 24 keys (FR-011 by construction).
2. **A new *Introduction* level** below Beginner, with objective caps in `src/core/defaults.ts`, and a **step-order
   check** in `pnpm library:index` that refuses a key whose steps are not increasingly demanding (FR-010, SC-002).
3. **Songs from Mutopia public-domain sources**: a song definition names an approved source, the melody bars and a
   chord plan; a new tool builds the item from the converted source melody plus our CC0 left-hand chords. The audit
   checks the melody mechanically against the source and the chords by theory (FR-018).
4. **The panel becomes a folder tree** (native disclosure widgets), key folders closed by default, items ordered by
   step, so any Introduction is 3 selections away (SC-001).
5. **Continuity**: moved items keep settings through `supersedes` links in the index (content-hash aliases for the
   per-Score settings) and `formerIds` on sections for the persisted library filter (FR-020, SC-006).

No runtime dependency, no real-time path, no grading change.

## Technical Context

**Language/Version**: TypeScript (strict), HTML5, CSS3; no UI frameworks
**Runtime Dependencies**: none new
**Dev Dependencies**: none new (LilyPond reader/converter, MIDI reader and comparator from feature 007 are reused)
**Storage**: `localStorage` only as today - `musicanyya.practice.v1` / `musicanyya.play.v1` per-Score settings (keyed by
content hash) gain adoption from superseded hashes; `musicanyya.library.v1` filter keeps its shape. No new store.
**Testing**: Vitest (generator goldens, level/step-order checks, theory check, song builder, settings adoption, index
regeneration); Playwright e2e for the tree panel and opening one item per new section kind
**Shells / Delivery Targets**: browser and Electron (same `public/library/` shelf); Native audio plugin not involved
**Target Browsers**: latest 2 Chrome + Edge (reference); Firefox; Safari = view + Listen only (no Web MIDI)
**Performance Goals**: library index stays one fetch (~155 KB today, estimated <= 450 KB with ~160 items); the panel
renders the tree in <= 50 ms on the reference machine; opening an item unchanged from feature 005
**Real-time Paths Touched**: none
**Constraints**: generator, song builder and fidelity tools stay dev-only (layers test); every shelf file passes the
existing licence, engraving, level, notice and audit checks; `index.json` regenerated, never hand-edited
**Scale/Scope**: 24 keys x 4 steps = 96 generated items; 18 key-change folders x 3 steps = 54 items (R7, D-3); 5 moved
drills; 10 songs (R9 as built); 36 of today's 41 items superseded by generated successors (R12); ~164 items in total

## Constitution Check

*GATE: must pass before Phase 0 research; re-check after Phase 1 design.*

| # | Principle | Question | Status |
|---|---|---|---|
| I | Real-Time Safety (Web and Native) | No AudioWorklet, scheduler, MIDI or plugin code touched. | PASS (n/a) |
| II | One Clock, Measured Latency | Items carry their tempo in the file; the tempo map is built from the file as today. Integer divisions (4 per quarter, 8 where eighths need it). No new tolerances. | PASS |
| III | Score Fidelity, Engraving & Note Identity | Items are ordinary MusicXML parsed by the one Score model and engraved by Verovio; generated files ship fully engraved (006 guard); chord names are `<words>` directions, never `<harmony>`, so no load notice; Note IDs unaffected. | PASS |
| IV | Test-First Core, Deterministic Grading | Generator goldens, level and step-order checks, theory check and song builder are pure and tested in Node first; grading unchanged. | PASS |
| V | Layered, Framework-Free, Platform-Agnostic | Tree panel is plain custom-element DOM with `<details>`/`<summary>`; generation stays in `src/core/library/exercise` + `tools/` (dev-only, layers test); settings adoption lives behind the existing settings-store adapter; browser works alone. | PASS |
| VI | Musician-First Feedback | No session UI changes; the panel is not modal; step and level shown as text next to each item. | PASS |
| VII | Pedagogy as Data | Exercises and songs are data definitions (`content/library/exercises`, `content/library/songs`); Advice untouched; item ids stay stable from now on and old ids are linked by `supersedes`. | PASS |
| VIII | Simplicity, Web-First Delivery | P1 = regrouped shelf + Introduction step, usable alone; no new dependency; native disclosure widgets instead of a tree library. | PASS |

Post-design re-check (after Phase 1): all PASS; one deliberate rule change recorded in Complexity Tracking (criterion 10
exemption for key-change exercises, research R7).

## Project Structure

### Documentation (this feature)

```text
specs/011-learning-by-key/
|-- spec.md
|-- plan.md              # this file
|-- research.md          # Phase 0
|-- data-model.md        # Phase 1
|-- quickstart.md        # Phase 1
|-- contracts/
|   |-- library-index-1.2.md        # change request to 005 library-index (step, stepOrder, supersedes, formerIds, level)
|   |-- library-port-1.2.md         # change request to 005 library-port (tree panel, filter migration, settings adoption)
|   |-- exercise-definition-1.1.md  # change request to 005 exercise-definition (pattern + key-change forms)
|   |-- song-definition.md          # new: content/library/songs/*.json + pnpm library:songs
|   `-- audit-record-1.2.md         # change request to 007 audit-record (exercise-theory-v2, song checks)
|-- checklists/requirements.md
`-- tasks.md             # /speckit.tasks
```

### Source Code (repository root)

```text
src/core/
|-- defaults.ts                       # LEVEL_* gain an `introduction` entry; STEP_ORDER, STEP_ORDER_FACTS
`-- library/
    |-- types.ts                      # Level + 'introduction'; ItemMetadata.step/stepOrder; LibraryItem.supersedes;
    |                                 #   LibrarySection.formerIds; ItemFacts.chordChangesPerBar; SkillTag 'key-changes'
    |-- levels.ts                     # introduction caps; criterion 10 exemption for key-change exercises
    |-- facts.ts                      # chordChangesPerBar
    |-- step-order.ts                 # NEW: checkStepOrder(items of one key folder) (FR-010)
    |-- filter.ts                     # sort by section tree, then step, stepOrder, title
    |-- tree.ts                       # NEW: buildSectionTree(sections) - parent/child order for the panel
    `-- exercise/
        |-- types.ts                  # pattern + key-change definition forms
        |-- generate.ts               # generatePatternFamily, generateKeyChangeFamily
        |-- scales.ts                 # NEW: one-octave major / harmonic-minor scale spelling + fingering table
        `-- keys.ts                   # NEW: the 24-key table (slug, display name, fifths, circle order, relative)
src/engine/storage/local-settings-store.ts   # adoptScoreSettings(fromHashes, toHash)
src/app/library-session.ts                   # adopt settings from item.supersedes before loading bytes
src/ui/elements/mx-library.ts                # folder tree (<details>), step labels, auto-open on filter
src/ui/elements/mx-score-source.ts           # songs: "Arrangement (CC0)" + source note (library-port 1.2 §4a)
src/ui/state/libraryState.ts                 # isLevel incl. introduction; sectionId migration via formerIds
src/ui/i18n/en.ts                            # level 'Introduction', step names, key-change relation words
src/ui/styles/*.css                          # tree indentation / disclosure marker (existing library stylesheet)
tools/library/
|-- sections.ts                       # generated Learning tree from keys.ts (+ formerIds for old sections)
|-- build-exercises.ts                # dispatch pattern / key-change families; write into key folders
|-- build-index.ts                    # step-order check; supersedes copied from sidecars
|-- build-songs.ts                    # NEW: pnpm library:songs
|-- successors.ts                     # NEW: old id -> new id table (R12), feeds sidecar `supersedes`
`-- fidelity/
    |-- exercise-claims.ts            # claims for the four steps and key-change items
    |-- theory.ts                     # key segments (key change), scale claims per section
    `-- song-chords.ts                # NEW: song left-hand chords vs printed chord names, allowed chord set
content/library/
|-- exercises/                        # new definitions: step-introduction, step-beginner, step-intermediate,
|                                     #   step-advanced, key-change-relative, key-change-parallel; moved drills re-sectioned
|-- songs/                            # NEW: one song definition per song
|-- sources/<mutopia-...>/            # approved song sources (.ly, .mid, source.json) - owner decision D-1
`-- audit/learning/keys/..., audit/learning/key-changes/...   # records follow the items
public/library/learning/keys/<key>/..., public/library/learning/key-changes/<pair>/...   # generated shelf
public/library/README.md, THIRD_PARTY_NOTICES.md, docs/library-audit.md, docs/musicxml-support.md (unchanged rows)
tests/core/library/ (step-order, tree, levels, facts, filter), tests/core/library/exercise/ (goldens),
tests/tools/songs/, tests/tools/fidelity/ (claims, song-chords), tests/library/ (index, fidelity, licence),
tests/engine/storage/ (adoption), tests/ui/ (library tree, state), tests/e2e/library.spec.ts
```

**Structure Decision**: library content pipeline (core generator + tools + content) plus the library panel and the
settings adapter. No engine audio, worker or Electron change.

## Complexity Tracking

| Violation / Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Level criterion 10 (key changes) not applied to exercises tagged `key-changes` | A key-change exercise exists to practise the key change; at Introduction/Beginner level criterion 10 allows 0 changes, so the drill could never be levelled for the learners it is for | Levelling every key-change item Intermediate or above: hides the parallel-minor drills from the beginners who asked for them; the existing exemptions for exercises (criteria 9, 14, 20) follow the same reasoning |
| Criterion 3 hand-independence metric changed for all items (D-2 B1) | A scale over a held chord counts as fully independent today (~0.8 vs Beginner cap 0.35), so no Introduction/Beginner exercise of the requested shape can be levelled below Intermediate | Exempting exercises only: the metric is musically wrong for pieces too (a melody over held chords is a beginner texture); repertoire is re-checked and any re-levelled piece reported |
| Criterion 11 leading-tone exemption and span 38 / bounds 35-85 for exercises (D-2 B5, B7) | Harmonic minor writes the raised 7th on every occurrence; IV below I needs 38 semitones | Custom registers per key break FR-011; `raisedBecause` on 60+ items documents a mismatch instead of fixing it |
| Item ids change (`learning/chords/...` -> `learning/keys/...`) | The owner asked for the reorganisation; 005 contract §3 calls renaming breaking | Keeping old ids with new sections: the id is the path, so the file would not live in its folder; instead `supersedes` makes the rename non-breaking for settings |

## Phase 0: Research (`research.md`)

R1 layout and ids; R2 key order and naming; R3 step and ordering metadata; R4 Introduction level caps; R5 step-order
check; R6 generator pattern form and the four step shapes; R7 key-change exercises; R8 theory check v2; R9 songs
(sources, builder, audit); R10 continuity; R11 tree panel; R12 fate of the existing items; R13 index size.

## Phase 1: Design

- `data-model.md`: entities, the four step shapes, key table, fingering table, successor table, validation.
- `contracts/`: the five files above, each versioned.
- `quickstart.md`: commands and one manual verification per user story.
- `docs/agents/reference.md`: Recent Changes entry (no new technology).

## Owner decisions (answered 2026-09-26)

- **D-1 (licensing)**: approved - songs from the 8 new Mutopia public-domain sources of research R9 (1111, 905, 644,
  1223, 1220, 1295, 1121, 1300) plus the already approved Greensleeves source transposed to A minor. Each source is still
  downloaded unchanged with its `source.json` and a `THIRD_PARTY_NOTICES.md` entry.
- **D-2 (published level criteria)**: approved - B1 hand-independence metric for all items (repertoire re-checked,
  re-levelled pieces reported), B5 leading-tone exemption for exercises, B6 one key change in key-change exercises, B7
  span 38 / bounds 35-85 for exercises.
- **D-3 (scope)**: approved - A minor <-> A major pair (18 key-change folders); key-change folders have three steps.
