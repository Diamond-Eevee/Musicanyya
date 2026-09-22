# Implementation Plan: Practice Score Library

**Branch**: `005-practice-score-library` | **Date**: 2026-09-22 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/005-practice-score-library/spec.md`

## Summary

Ship a bundled, browsable shelf of practice Scores: *Learning* (24 per-key chord exercises and >= 12
chord-change drills) and *Repertoire* (Beginner / Intermediate / Advanced, with *Fur Elise*), every
item carrying metadata and a provenance record, every item verified to load, engrave and play.

The technical shape follows from one finding in Phase 0: **there is no fetchable corpus of CC0 solo
piano repertoire**. OpenScore - the one corpus whose CC0 status is verifiable file by file, and which
this repository already uses - contains Lieder and string quartets only; every general "public domain
MusicXML" collection reachable from here either asserts a licence it cannot support or mixes in
material that is plainly still in copyright (research R-1). So the library is **content we author**,
from public-domain music, plus OpenScore where it fits:

- the exercise families are **generated** from one definition per family, so all 24 keys share a
  structure by construction (R-7);
- the repertoire is **engraved by us** from public-domain works chosen to be short enough to
  transcribe accurately, and reviewed by the `music-domain-expert` role before it ships (R-1);
- every item is a plain MusicXML file under `public/library/` beside a small authored metadata file;
  a generated `index.json` (contract-versioned) is what the app reads (R-2, R-3);
- the app gains one pure core module (`src/core/library`: index model, filters, level checks), one
  engine adapter behind a new `LibraryCatalog` port (fetch + Cache Storage, the SoundFont pattern),
  and one custom element inside the existing *Scores* panel. Opening an item joins the existing
  `loadBytes` path, so Listen, Practice and Play behave exactly as for a user's own file.

No new runtime dependency. No real-time code is touched.

## Technical Context

**Language/Version**: TypeScript 7 (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`),
HTML5, CSS3; no UI frameworks
**Runtime Dependencies**: none added. The library is data (MusicXML + JSON) read through `fetch`;
parsing and engraving reuse the existing score worker, `@rgrove/parse-xml` and Verovio
**Storage**: no new IndexedDB store. `Cache Storage` for the fetched index and item bytes (the same
best-effort pattern as `soundfont-cache.ts`, which already tolerates the desktop shell's `app://`
origin refusing Cache writes); opened items continue to land in the existing `scores` store as
recents; one new `localStorage` key for the last library filter (`musicanyya.library.v1`)
**Testing**: Vitest - pure core tests for the index model, filters and level checks; golden snapshots
for every generated exercise; a library sweep test that loads **every** item through the real
`buildScore` path and asserts its recorded expectations; Playwright for browse -> open -> Listen in
the browser and under the Electron `app://` origin
**Shells / Delivery Targets**: browser (primary) and Electron. The library is static content under
`public/`, so `dist/` and the `app://` handler serve it with no shell-specific code. Native audio
plugin: untouched
**Target Browsers**: latest 2 Chrome + Edge (reference); Firefox; Safari lists and opens the library
and can Listen (no Web MIDI, unchanged)
**Performance Goals**: library list rendered <= 1 s for 200 items and filtered <= 200 ms (SC-007);
bundled library <= 10 MB added to the download (SC-008); no main-thread task > 50 ms while browsing;
opening an item is bounded by the existing score-load budget, not by this feature
**Real-time Paths Touched**: **none**. No AudioWorklet, scheduler, metronome or MIDI-timing code is
edited. (No RT review task is therefore required; the plan states this so the omission is deliberate.)
**Constraints**: `src/core/library` stays pure (no DOM, no `fetch`, Node-testable); the library panel
is a popover that `closeForRun()` already dismisses, so nothing covers the Score during a run
(Principle VI); library items are read-only; a missing or broken item degrades to a notice and never
breaks the list
**Scale/Scope**: ~40-60 items at first release, designed to stay correct at 200; each item 2-60 KB
(`.musicxml`), whole library well under 2 MB

## Constitution Check

*GATE: passed before Phase 0 research; re-checked after Phase 1 design (same verdict, notes added).*

| # | Principle | How this design complies | Status |
|---|---|---|---|
| I | Real-Time Safety | No code on an RT path changes. Library fetching and index parsing happen in ordinary async UI code; item bytes go through the existing score worker, so no parsing lands on the main thread. Generated exercises are files, produced by a dev script, never at run time. | PASS |
| II | One Clock, Measured Latency | No timing code changes. A library item becomes a Score through the same loader, so tempo map, ticks and latency compensation are untouched. Tempo and duration in the index are *derived facts for display and filtering only*, computed by the generator from the same tempo map - never a second source of truth (data-model SS3.3). | PASS |
| III | Score Fidelity & Note Identity | Items are MusicXML read by the one canonical loader; Note IDs, Verovio engraving and the load report are unchanged. FR-024 is enforced by a gate, not a hope: an item ships only when its sweep row (notices, measures, notes, pages) is recorded and reviewed. Authored transcriptions get a `music-domain-expert` review before they are committed. | PASS |
| IV | Test-First Core | Index model, filters, level checks and the exercise generator are pure functions written test-first and run in Node. Every generated exercise has a golden snapshot; the library sweep is a fixture-driven test over real files. | PASS |
| V | Layered, Framework-Free | `core/library` = types + validation + filters + level criteria (no DOM, no `fetch`). `engine/library` = the `LibraryCatalog` port and its `fetch`+Cache adapter. `ui/elements/mx-library.ts` = DOM only. The browser works alone; Electron needs no extra code because `public/` is already served under `app://`. Custom elements, no framework. | PASS |
| VI | Musician-First Feedback | The library is a popover panel in the existing *Scores* menu entry - non-modal, dismissed by `closeForRun()` when a run starts, never over the Score during a session. Levels and skill tags are words, not colour alone. A failed item is a notice in the tray, not a dialog. | PASS |
| VII | Pedagogy as Data | Library metadata is versioned JSON validated on load, invalid entries skipped and reported - the same rule Advice follows. Item ids are stable anchors, so Advice files can attach to library items later without a format change. Authoring Advice is out of scope. | PASS |
| VIII | Simplicity, Web-First | No new runtime dependency (Complexity Tracking is empty). `fetch` + Cache Storage + `<details>`-free plain DOM instead of a library. P1 (browse and open) is a usable MVP by itself; the drills, the level criteria and the licence check each add value on top. | PASS |

**Post-design re-check (after Phase 1)**: unchanged - PASS on all eight. Two notes:

- Principle VIII, offline: the spec's FR-014 asks for the library offline "once the app has been
  loaded". There is no service worker in this project, so the *app shell* is not offline-capable at
  all today; only the SoundFont survives a reload (Cache Storage). The design caches the index and
  fetched items the same way, which is all this feature can honestly deliver. Narrowing FR-014 and
  SC-010 is **owner decision D-2** below; nothing in the design changes either way.
- Principle III, authored content: hand-engraving public-domain repertoire is the one place this
  feature can introduce wrong notes. Mitigation is procedural (R-1): short works only, expert review,
  and the owner hears each piece in Listen mode before it is marked done.

## Project Structure

### Documentation (this feature)

```text
specs/005-practice-score-library/
|-- spec.md
|-- plan.md                      # this file
|-- research.md                  # Phase 0
|-- data-model.md                # Phase 1
|-- quickstart.md                # Phase 1
|-- contracts/
|   |-- library-index.md         # v1.0.0 authored item metadata + generated index.json
|   |-- library-port.md          # v1.0.0 LibraryCatalog port, UI events, filter state
|   `-- exercise-definition.md   # v1.0.0 the definition exercise families are generated from
|-- checklists/requirements.md
`-- implementation-log.md
```

### Source Code (repository root)

```text
public/library/                          # the shelf itself: served by Vite, dist/ and app:// alike
|-- index.json                           # GENERATED (tools/library/build-index.ts) - never hand-edited
|-- learning/
|   `-- chords/
|       |-- <key>-triads.musicxml        # GENERATED from exercise definitions (24 keys)
|       |-- <key>-triads.json            # authored metadata beside every score
|       `-- changes/<drill>.musicxml|.json
`-- repertoire/
    |-- beginner/<piece>.musicxml|.json
    |-- intermediate/<piece>.musicxml|.json
    `-- advanced/<piece>.musicxml|.json

content/library/exercises/*.json         # authored exercise definitions (source of the generated files)

src/core/library/
|-- types.ts        # LibraryIndex, LibraryItem, ItemMetadata, Provenance, Level, SkillTag
|-- index-model.ts  # parse + validate index.json; skip and report invalid entries
|-- filter.ts       # section / level / key / tag filtering + sorting (pure)
|-- levels.ts       # LEVEL_CRITERIA + checkLevel(facts) -> pass/fail per criterion
`-- facts.ts        # derive ItemFacts (range, span, hands, shortest value, density...) from a Score

src/core/musicxml/write.ts                # minimal MusicXML writer used by the generator (core, pure)
src/core/library/exercise/                # chord/chord-change generation from a definition (pure)

src/engine/library/http-catalog.ts        # LibraryCatalog adapter: fetch + Cache Storage
src/engine/ports.ts                       # + LibraryCatalog port

src/ui/elements/mx-library.ts             # the shelf inside the existing "scores" panel
src/ui/elements/mx-score-source.ts        # "where this Score came from" (source + licence, FR-019)
src/ui/state/libraryState.ts              # list, filter, selection, load status
src/ui/i18n/en.ts                         # + library strings
src/app/session.ts                        # wire openlibraryitem -> existing loadBytes()

tools/library/build-index.ts              # generate public/library/index.json (pnpm library:index)
tools/library/build-exercises.ts          # generate the exercise scores (pnpm library:exercises)

tests/core/library/*.test.ts              # index model, filters, levels, facts, generator goldens
tests/library/sweep.test.ts               # every item: loads, engraves, matches its recorded row
tests/library/licence.test.ts             # every item: metadata + provenance complete, licence allowed
tests/e2e/library.spec.ts                 # browse -> open -> Listen (browser + Electron app://)
THIRD_PARTY_NOTICES.md                    # entries for anything obtained rather than authored
docs/musicxml-support.md                  # only if an item makes us claim new coverage
```

**Structure Decision**: content lives under `public/` (not in `src/`, not in the existing root
`musicxml/` folder) because Vite copies `public/` verbatim into `dist/`, and the Electron `app://`
handler already serves `dist/` - so the same files reach both Shells with no packaging code, exactly
as the SoundFont does (R-2). The existing `musicxml/chords/c-major-scale-and-chords.musicxml` moves
into the library as a Learning item. Generation and indexing are **dev scripts under `tools/`**, not
runtime code: the app only ever reads finished files.

## Complexity Tracking

> No Constitution violations and no new runtime dependency. Recorded here only because two additions
> are worth naming.

| Violation / Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| A minimal MusicXML **writer** in `src/core/musicxml/write.ts` (dev-time use only) | 24 key exercises + 12 drills must be identical in structure; writing them by hand guarantees they drift, and a hand-written set cannot be regenerated when the template improves | Hand-authoring 36 files was rejected: FR-005 makes cross-key consistency a *requirement*, and a golden-snapshot generator is the only way to keep it true after an edit. A third-party MusicXML writer would be a new runtime dependency for a build-time job |
| A generated `index.json` instead of reading the folder tree at run time | A browser cannot list a directory; something must enumerate the shelf. Generating it also derives measure counts, keys and durations from the real loader, so metadata cannot drift from the files | A hand-maintained catalogue was rejected (it rots, and FR-025 then checks nothing); fetching every file to build the list in the browser was rejected (dozens of requests before the first paint, and it defeats SC-007) |

## Phase 0: Research (`research.md`)

Complete. Ten decisions: sourcing and licensing (R-1), where content lives and how it is served
(R-2), index generation and verification (R-3), what "offline" can honestly mean here (R-4), layering
and the new port (R-5), `.musicxml` vs `.mxl` for bundled items (R-6), generating the exercise
families (R-7), level criteria that a script can check (R-8), the repertoire shortlist and how
accuracy is assured (R-9), and where the library appears in the UI (R-10).

## Phase 1: Design

Complete: `data-model.md`, three contracts under `contracts/`, and `quickstart.md` with a manual
verification script per user story. `docs/agents/reference.md` updated (Active Technologies, Recent
Changes).

## Owner decisions raised by planning (all answered 2026-09-22)

| # | Decision | Answer |
|---|---|---|
| D-1 | With no fetchable CC0 piano corpus (R-1), the repertoire must be **engraved by us** from public-domain works - which caps how fast FR-008's 15 pieces arrive. Accept authored repertoire as the route, or supply licence-checked files yourself? | **Answered: as recommended.** We author the shelf from short public-domain works so the feature can finish on its own, and anything you verify as CC0 in your own browser is dropped in as an extra item. Keep FR-008's counts as the target for the finished feature, not for P1. |
| D-2 | FR-014 / SC-010 promise the library "offline once the app has been loaded". Without a service worker the app shell is not offline-capable at all (R-4). | Narrow both to "an item that has been opened stays available without the network" (Cache Storage + the existing recents), and record a full offline/PWA shell as a separate feature. |
| D-3 | `musicxml/chords/c-major-scale-and-chords.musicxml` (hand-written for feature 002, and its reference Score) moves into `public/library/learning/chords/`. | **Answered: as recommended.** Move it, keep its filename, and leave a pointer in `musicxml/README.md`; feature 002's quickstart is updated to the new path in the same task. |
