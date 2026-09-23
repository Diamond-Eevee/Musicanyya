# Implementation Plan: Beamed Notes and Complete Engraving

**Branch**: `006-beamed-note-engraving` | **Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/006-beamed-note-engraving/spec.md`

## Summary

Verovio draws exactly what the MusicXML encodes: without `<beam>` it draws flags, and a pitch given only as
`<alter>` becomes a *gestural* accidental that is never printed (both verified with the project's Verovio 6.3.0 on
2026-09-23, research R-1). The bundled library encodes neither. The app asks Verovio for `header: 'encoded'`, which
prints no header for MusicXML at all, and `'auto'` prints the title only - never composer or arranger, and
`<credit>` elements are ignored either way (R-4).

One pure core module, **engraving completion** (`src/core/musicxml/engraving/`), reads the parsed MusicXML tree
and plans element insertions: `<beam>` for every voice that encodes none, and `<accidental>` wherever the printed
pitch would otherwise differ from the sounding pitch (plus plain courtesy accidentals in the bar after a change,
FR-008). The same plan is used three ways:

1. **Opened Scores (US3)**: the score worker applies it to the render copy only (the source file and the Score
   model are untouched, so Note IDs, schedule and Grades cannot change) and adds one info entry to the load report.
2. **Library files (US1, US2)**: a dev tool applies it to the hand-written repertoire files on disk, and the
   exercise generator applies it to every file it writes, so the shipped files are correct for any viewer.
3. **Library guard (US4)**: a test runs the plan over every library file and fails, naming item/bar/staff/note, if
   it would add anything.

The title (FR-017) becomes a **title block** in the score view: an HTML element directly above page 1's first
system, set in the engraving's serif, showing title (work title, else movement title, else file name), composer
and arranger from the Score; Verovio is set to `header: 'none'` so nothing is drawn twice (R-4). US5 is a written
engraving checklist.

## Technical Context

**Language/Version**: TypeScript (strict), HTML5, CSS3; no UI frameworks
**Runtime Dependencies**: none new (verovio 6.3.0 and `@rgrove/parse-xml` already in use)
**Storage**: none new. Library files change on disk, so their content hashes change (R-7)
**Testing**: Vitest (pure rule tests, golden before/after identity, real-Verovio SVG checks, library guard);
Playwright (one e2e check: beams + title visible for *Für Elise*)
**Shells / Delivery Targets**: browser and Electron (same build); Native audio plugin not touched
**Target Browsers**: latest 2 Chrome + Edge; Firefox; Safari = view + Listen
**Performance Goals**: completion adds <= 10% to score open time for the largest library item (SC-005);
it is O(notes) over the already-parsed tree in the score worker
**Real-time Paths Touched**: none
**Constraints**: core stays DOM-free; completion never alters encoded beams/accidentals (FR-004, FR-009, FR-011);
never throws on malformed input (bad beam data -> left as encoded + report entry)
**Scale/Scope**: 58 library files (17 repertoire, 41 generated); scores up to ~11 000 notes (the 4.7 MB quartet
used by the 001 load-time tests)

## Constitution Check

*GATE: must pass before Phase 0 research; re-check after Phase 1 design.*

| # | Principle | Question | Status |
|---|---|---|---|
| I | Real-Time Safety | No AudioWorklet, scheduler or MIDI code changes. The completion pass runs in the score worker, off the main thread. | PASS |
| II | One Clock | No timing changes. Beaming reads onsets in divisions only to group notes; ticks/schedule untouched. | PASS |
| III | Score Fidelity | Seen = played = graded is the *goal* (FR-006). Opened files: only the render copy changes, the Score model and Note IDs are built from the untouched source. Library files: before/after identity golden (SC-003). Verovio stays the engraver. Bad beam data is left as encoded + notice. | PASS |
| IV | Test-First | Rule tables tested pure in Node first; golden identity for all 58 library items; guard test; real-Verovio SVG assertions. Deterministic (no randomness, stable order). | PASS |
| V | Layers | Module in `src/core` (no DOM, no Web APIs; works on the parse tree). Worker in `src/workers`, tool in `tools/library`. Browser works alone. | PASS |
| VI | Musician-First Feedback | Load report entry is an info notice, non-modal (existing notice tray). | PASS |
| VII | Pedagogy as Data | Not affected. | PASS |
| VIII | Simplicity | No dependency; one module reused by worker, tool, generator and guard. P1 (US1+US2) is the library fix alone. | PASS |

Re-check after Phase 1: still PASS (see end of this file).

## Project Structure

### Documentation (this feature)

```text
specs/006-beamed-note-engraving/
|-- spec.md, checklists/requirements.md
|-- plan.md                         # this file
|-- research.md                     # R-1..R-9
|-- data-model.md                   # EngravingPlan, BeatGrouping, AccidentalState, report entry
|-- contracts/engraving-completion.md   # v1.0.0 - the pure API, modes, insertion positions, guarantees
|-- quickstart.md                   # run + manual verification per story
|-- engraving-audit.md              # US5 deliverable (created during implement)
`-- tasks.md                        # /speckit.tasks
```

Contract changes in earlier features (version bumps, made during implement):
`specs/001-score-viewer-listen/contracts/render-copy.md` 1.0.0 -> 1.1.0 (additive element inserts);
`specs/001-score-viewer-listen/contracts/worker-messages.md` 1.0.0 -> 1.1.0 (new load notice codes;
`summary.arranger`);
`specs/005-practice-score-library/contracts/exercise-definition.md` generation rules: output is completed.

### Source Code (repository root)

```text
src/core/musicxml/engraving/
|-- walk.ts              # NEW  parse tree -> per part/measure/staff/voice event lists (divisions, key, time, type,
|                        #      dots, rest, chord, grace, tuplet, tie, pitch, existing beam/accidental, insert points)
|-- beat-grouping.ts     # NEW  metre (+ implicit pickup) -> beam-group spans (R-2 table)
|-- beams.ts             # NEW  voice events -> <beam number=n> values (primary + secondary + hooks)
|-- accidentals.ts       # NEW  per-staff alteration state -> required + courtesy accidentals (R-3)
|-- plan.ts              # NEW  planEngraving(doc, mode) -> EngravingPlan; applyInserts(xml, inserts)
`-- index.ts             # NEW  public exports
src/core/musicxml/render-copy.ts   # CHANGE accepts element inserts (contract 1.1.0)
src/core/score/load-report.ts      # CHANGE new info codes engravingCompleted, beamDataInvalid, accidentalContradicts
src/core/library/exercise/generate.ts  # CHANGE pipe written XML through planEngraving('library') + applyInserts
src/workers/score.worker.ts        # CHANGE plan('opened') -> render copy inserts + report entries
src/workers/verovio.worker.ts      # CHANGE header 'none' (R-4)
src/core/musicxml/build.ts         # CHANGE title fallback to <movement-title>; read <creator type="arranger">
src/core/score/model.ts            # CHANGE Score.arranger: string | null
src/ui/elements/mx-score-view.ts   # CHANGE title block above page 1 (scrolls with the music, wraps long titles)
src/ui/styles/                     # CHANGE title block style (serif, centred title, composer/arranger right)
src/ui/i18n/en.ts                  # CHANGE notice texts for the three new codes
tools/library/engrave.ts           # NEW  `pnpm library:engrave`: completes hand-written repertoire files in place
tools/library/identity.ts          # NEW  captures the SC-003 identity golden (run once, before any library change)
tools/library/audit.ts             # NEW  US5 element counts per repertoire piece (file + rendered SVG)
package.json                       # CHANGE script library:engrave
public/library/**/*.musicxml       # REGENERATED/COMPLETED (content: beams + accidentals only)
public/library/index.json          # REGENERATED (bytes/hash)
docs/musicxml-support.md, src/core/musicxml/support.ts  # CHANGE rows for <beam>, <accidental>, title/credits
tests/core/musicxml/engraving/*.test.ts   # NEW  beat grouping, beams, accidentals, plan, apply, idempotence
tests/library/engraving-guard.test.ts     # NEW  FR-012 guard over every library file
tests/library/identity.test.ts            # NEW  SC-003 golden: note ids/ticks/keys per item (captured first)
tests/fixtures/library-identity.json      # NEW  golden captured from the files BEFORE completion
tests/verovio/engraving.test.ts           # NEW  real Verovio: beams drawn, accid visible
tests/ui/title-block.test.ts              # NEW  title/composer/arranger/fallback rendering
tests/ui/load-notices.test.ts             # NEW  every load notice code has an English text
tests/tools/engrave.test.ts               # NEW  the library tool: completes, idempotent, skips generated items
tests/e2e/library.spec.ts                 # CHANGE Für Elise shows beams and title block (all modes)
```

**Structure Decision**: all logic lives in one core module operating on the parse tree (not the Score model, which
has no rests, note types, tuplets or written alterations). The Score model and Note IDs are deliberately not
touched, which is what makes FR-005/SC-003 hold by construction for opened files.

## Complexity Tracking

No constitution violations, no new dependency, no new layer.

| Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Title block drawn in HTML, not by Verovio (Principle III names Verovio for engraving) | Verovio 6.3.0 draws no composer/arranger with any header option (R-4); title text is not notation | `header: 'auto'` shows the title only; MEI pgHead injection doubles load time |
| Changing 58 shipped library files (their hashes change) | FR-001/FR-006 want files correct for any viewer; guard test needs files to be the truth | Completing only at display time would leave the files wrong outside the app and make the guard test meaningless (R-6) |

## Phase 0: Research

See [research.md](research.md): R-1 Verovio behaviour (verified), R-2 beam rules, R-3 accidental rules, R-4 title
header, R-5 where completion runs, R-6 library files vs display-only, R-7 content hashes, R-8 insertion positions,
R-9 performance.

## Phase 1: Design

- [data-model.md](data-model.md)
- [contracts/engraving-completion.md](contracts/engraving-completion.md)
- [quickstart.md](quickstart.md)
- `docs/agents/reference.md`: no new technology; the `pnpm library:engrave` command is added to R7 during
  implement (with the script).

### Constitution Check after design

Unchanged: all eight principles PASS. The design adds no dependency, keeps the Score model and Note IDs untouched
for opened files, proves identity for library files with a golden captured before the change, and keeps all new
logic in DOM-free core code.
