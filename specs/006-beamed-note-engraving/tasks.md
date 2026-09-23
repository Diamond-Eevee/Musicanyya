# Tasks: Beamed Notes and Complete Engraving

**Input**: Design documents from `specs/006-beamed-note-engraving/`
**Prerequisites**: plan.md, spec.md, research.md (R-1..R-9), data-model.md, contracts/engraving-completion.md,
quickstart.md

<!--
  Format: `- [ ] T001 [P] [US1] Description with exact file path`
  States: `[ ]` open, `[~]` in progress with ` (claimed: <agent-id> <date>)`, `[x]` done (AGENTS.md section 4)
  Tests come BEFORE implementation (Constitution IV) and must fail first.
  No task touches AudioWorklets, the scheduler, MIDI input timing or plugin callbacks, so there is no RT review.
-->

## Phase 1: Setup

- [x] T001 Create `src/core/musicxml/engraving/index.ts` exporting the contract types (`EngravingMode`,
  `ElementInsert`, `EngravingPlan`, `EngravingFinding`) from contracts/engraving-completion.md section 1, and
  `tests/core/musicxml/engraving/` (empty suite dir). Confirm the `core` Vitest project picks the folder up.
- [x] T002 [P] Add `"library:engrave": "tsx tools/library/engrave.ts"` to `package.json` (the script body comes in
  T019) and the command to `quickstart.md` / `docs/agents/reference.md` R7 / `README.md`.

---

## Phase 2: Foundational (blocks all user stories)

**Purpose**: the identity golden (must be captured before any library file changes), the parse-tree walk, the
insert splice, and the render-copy extension.

- [x] T003 Write `tools/library/identity.ts` (dev-only) that, for every `public/library/**/*.musicxml`, builds the
  Score and records per item a stable list of `{ id, measureIndex, onsetInMeasure, durationTicks, soundingKey }`
  plus the compiled schedule digest, and grades one recorded Performance log of *Für Elise (theme)* (saved to
  `tests/fixtures/performance-logs/fur-elise-theme.json`) into a golden Grade; write the result to
  `tests/fixtures/library-identity.json`. Run it on the
  **unchanged** library and commit the golden (SC-003, FR-005).
- [x] T004 Write `tests/library/identity.test.ts`: rebuilds the same list for every library file and deep-equals
  the golden from T003 (passes now; it is the guard for every later file change).
- [x] T005 [P] Fixtures in `tests/fixtures/musicxml/engraving/` (origin + licence noted in the folder README, own
  work, CC0): `fur-elise-bare.musicxml` (the theme's pitches/durations, no `<beam>`, no `<accidental>`),
  `metres.musicxml` (one bar each of 2/4, 3/4, 4/4, 2/2, 3/8, 6/8, 9/8, 12/8, 5/8, 7/8, `3+2/8`, with eighth and
  sixteenth patterns), `rests-and-hooks.musicxml` (rests inside beats, dotted-eighth+sixteenth, sixteenth+dotted
  eighth, eighth+two sixteenths), `tuplets-grace.musicxml` (triplet eighths in 2/4 and 4/4, grace groups, a lone
  grace), `voices-cross-staff.musicxml` (two voices on one staff, a cross-staff beamed voice, chords),
  `partly-beamed.musicxml` (a voice with some encoded beams), `broken-beam.musicxml` (a `begin` with no `end`),
  `accidentals.musicxml` (key signatures with sharps and flats, altered/natural sequences in one bar, same pitch
  other octave, ties across a barline, key change mid-bar, F and F♯ in one chord, double sharp -> sharp, grace
  note accidental, volta ending 2), `prints-accidentals.musicxml` (a part that prints some accidentals but lacks
  one required sign, and one note printing a sharp sign with `<alter>` 0).
- [x] T006 [P] Test `tests/core/musicxml/engraving/walk.test.ts`: onsets across `<backup>`/`<forward>` and a
  `<divisions>` change; per-staff keys (`<key number>`), mid-bar key/time change; chords folded into heads; grace,
  tuplet, tie flags; end-aligned pickup (research B2); insert offsets per R-8 for notes with/without `type`, `dot`,
  `staff`, `notations`. Must fail (module missing).
- [x] T007 [P] Test `tests/core/musicxml/engraving/apply.test.ts`: `applyInserts` splices in one pass, orders
  accidental (0) before beam (1) at the same offset, leaves every other byte unchanged; empty insert list returns
  the input. Must fail.
- [x] T008 [P] Test in `tests/core/musicxml/render-copy.test.ts`: `createRenderCopy` with `elements` inserts inside
  note bodies alongside id rewrites; the render copy re-parses to the same Score (render-copy contract guarantee
  3). Must fail.
- [x] T009 Implement `src/core/musicxml/engraving/walk.ts` (data-model section 2) until T006 passes.
- [x] T010 [P] Implement `applyInserts` in `src/core/musicxml/engraving/plan.ts` until T007 passes.
- [x] T011 Extend `src/core/musicxml/render-copy.ts` with `elements: ElementInsert[]` until T008 passes; bump
  `specs/001-score-viewer-listen/contracts/render-copy.md` to 1.1.0 (additive).

**Checkpoint**: identity golden committed; walk, splice and render-copy extension green (`pnpm test --
tests/core/musicxml tests/library/identity`).

---

## Phase 3: User Story 1 - Beamed rhythms in the practice library (Priority: P1) MVP

**Goal**: every library piece shows eighth-and-shorter notes beamed by beat (FR-001..FR-005).
**Independent Test**: open *Für Elise (theme)*: pickup E-D♯ one double beam, bar 1 six sixteenths under one beam,
bar 2 bass A-E-A beamed, treble A keeps its flag; no flag where a beam group applies.

### Tests (write first, confirm they fail)

- [x] T012 [P] [US1] Test `tests/core/musicxml/engraving/beat-grouping.test.ts`: the R-2 B3 table for every metre
  row, B4 (4/4 half-bar fours only for four plain eighths; falls back per quarter with a sixteenth, dot, rest or
  tuplet; never across the middle; 2/2 split; 3/4 six eighths), pickup end-alignment.
- [x] T013 [P] [US1] Test `tests/core/musicxml/engraving/beams.test.ts` over T005 fixtures: B5-B11 - rests break
  (Für Elise bar 2), lone note keeps flag, levels and hooks (B9 examples), unbroken secondary beams in 3/8 (B10),
  tuplet groups, grace groups, per-voice grouping with cross-staff notes, chords beamed on the head, voices with
  any encoded `<beam>` skipped (B11), `beamGroupsAdded` counts.
- [x] T014 [P] [US1] Test `tests/verovio/engraving.test.ts` (real Verovio WASM): the completed
  `fur-elise-bare.musicxml` renders `g.beam` groups and no `g.flag` on notes inside a beam group; a grace note
  between beamed main notes renders (research B8 check - on failure, switch B8 to "grace breaks the group" and log
  it in research.md).
- [x] T015 [P] [US1] Test `tests/library/engraving-guard.test.ts` (beam part): for every library file,
  `planEngraving(doc, 'library')` yields no beam inserts; the failure message names item, bar, staff, voice.
  Fails now (427 beam-group findings, 0 measures with invalid encoded beam data).
- [x] T027 [P] [US1] Idempotence tests, written before the tool and the library runs: in
  `tests/core/musicxml/engraving/plan.test.ts`, for every T005 fixture, planning the completed text yields zero
  inserts, a second apply is byte-identical, two runs are equal; in `tests/tools/engrave.test.ts`, the exported
  `engraveFile` of `tools/library/engrave.ts` completes a temp copy, a second run changes nothing, and generated
  family files are skipped. Extended with accidentals in US2 (T022). Must fail (tool missing).

### Implementation

- [x] T016 [US1] Implement `src/core/musicxml/engraving/beat-grouping.ts` until T012 passes.
- [x] T017 [US1] Implement `src/core/musicxml/engraving/beams.ts` and the beam half of `planEngraving` in
  `plan.ts` (findings `missingBeam`, `invalidBeams` for `broken-beam.musicxml`) until T013 passes.
- [x] T018 [US1] Pipe generator output through `planEngraving(..., 'library')` + `applyInserts` in
  `src/core/library/exercise/generate.ts`; update `specs/005-practice-score-library/contracts/exercise-definition.md`
  section 2 (generated output is completed) and extend `tests/core/library/exercise/*.test.ts` with an
  idempotence check (a generated file plans zero inserts).
- [x] T019 [US1] Implement `tools/library/engrave.ts`: for each hand-written repertoire file (not generated
  families), read -> plan (`'library'`) -> apply -> write back; prints per file the counts; export
  `engraveFile`; until T027 passes.
- [x] T020 [US1] Run `pnpm library:exercises`, `pnpm library:engrave`, `pnpm library:index`; confirm T004 identity
  still passes and T014/T015 pass; commit the regenerated `public/library/**` and `index.json`.
- [x] T021 [US1] Extend `tests/e2e/library.spec.ts`: opening *Für Elise (theme)* shows `g.beam` elements in the
  score SVG and no load notice.

**Checkpoint**: US1 independent test passes in the browser; identity golden unchanged; guard (beams) green.

---

## Phase 4: User Story 2 - The printed pitch is the pitch the app expects (Priority: P1)

**Goal**: every note's printed pitch equals its played pitch; plain courtesy signs in the next bar
(FR-006..FR-009).
**Independent Test**: A-minor triad drill V chord shows G♯; *Für Elise* bar 1 D after D♯ shows a natural; the
library check reports 0 wrong-reading notes (today 117 in 21 items).

### Tests (write first, confirm they fail)

- [ ] T022 [P] [US2] Test `tests/core/musicxml/engraving/accidentals.test.ts` over `accidentals.musicxml`: R-3
  A1-A7 (cross-voice staff state, per-octave, ties across barline, key change mid-bar resets, chord F/F♯ both
  signed, double sharp -> sharp, grace accidental lasts the bar), C1-C4 (courtesy only first occurrence in the
  next bar, any octave, not on tied continuations, ending 2 considers the bar before ending 1), modes: `'library'`
  adds courtesy always, `'opened'` only in parts with no `<accidental>` (`prints-accidentals.musicxml` gets its
  required sign but no courtesy); existing `<accidental>` never changed.
- [ ] T023 [P] [US2] Extend `tests/verovio/engraving.test.ts`: completed `triads-a-minor` and `fur-elise-bare`
  render visible accidentals (MEI `accid`, not only `accid.ges`) on G♯ / D natural; a plain courtesy natural
  renders without parentheses (research C4 check).
- [ ] T024 [P] [US2] Extend `tests/library/engraving-guard.test.ts` with accidentals: zero `missingAccidental` /
  `missingCourtesy` findings per library file, message names item, bar, staff, pitch (e.g. `D5`). Fails now.

### Implementation

- [ ] T025 [US2] Implement `src/core/musicxml/engraving/accidentals.ts` and the accidental half of `planEngraving`
  until T022 passes.
- [ ] T026 [US2] Re-run `pnpm library:exercises`, `pnpm library:engrave`, `pnpm library:index`; T004 identity,
  T023, T024 and T027 pass; commit the library.
- [ ] T050 [US2] SC-003 grade identity in `tests/library/identity.test.ts`: grade the recorded Performance log
  `tests/fixtures/performance-logs/fur-elise-theme.json` (captured in T003) against the completed file; the Grade
  equals the golden Grade exactly.

**Checkpoint**: US2 independent test passes in the browser; SC-002 = 0; identity golden unchanged.

---

## Phase 5: User Story 3 - Scores the user opens (Priority: P2)

**Goal**: opened Scores are completed for display only, where the file gives no information, and the load report
says so (FR-010, FR-011).
**Independent Test**: dragging `fur-elise-bare.musicxml` shows the library version's beams and accidentals and
one info notice; a MuseScore export with its own beams shows no notice and unchanged beams.

### Tests (write first, confirm they fail)

- [ ] T028 [P] [US3] Test `tests/engine/score-worker-engraving.test.ts` (score worker `handleMessage` in Node):
  `fur-elise-bare` -> render copy contains inserts, `report` has one `engravingCompleted` info entry with the
  counts; `fullScore` Note IDs identical to loading the same file without completion; `partly-beamed` -> no beam
  inserts for that voice; `broken-beam` -> `beamDataInvalid` entry, its encoded beams unchanged and no beams added to that
  voice, still loads; a note printing a sharp sign with `<alter>` 0 -> `accidentalContradicts` entry, sign kept.
- [ ] T029 [P] [US3] Test in `tests/core/musicxml/real-scores.test.ts`: every real-score fixture (OpenScore,
  MusicXML test suite) that encodes beams gets zero beam inserts and keeps all its `<accidental>` elements (SC-006).
- [ ] T030 [P] [US3] Test `tests/ui/load-notices.test.ts`: every `LoadNoticeCode` (incl. the three new ones) has
  an English text in `src/ui/i18n/en.ts`.

### Implementation

- [ ] T031 [US3] Add `engravingCompleted`, `beamDataInvalid` and `accidentalContradicts` to `src/core/score/load-report.ts` and their texts
  to `src/ui/i18n/en.ts`; bump `specs/001-score-viewer-listen/contracts/worker-messages.md` to 1.1.0 and add the
  codes to `specs/001-score-viewer-listen/data-model.md` notice table.
- [ ] T032 [US3] Wire `planEngraving(parsed.doc, 'opened')` into `src/workers/score.worker.ts`: pass inserts to
  `createRenderCopy`, add report entries; until T028/T029/T030 pass.
- [ ] T033 [US3] Performance test in `tests/core/musicxml/engraving/perf.test.ts`: completion on the largest
  fixture (4.7 MB quartet) and complete *Für Elise* costs <= 10% of their `readXml`+`buildScore` time (research
  R-9); plus an end-to-end check in `tests/e2e/real-scores.spec.ts` (drop -> first page drawn) against the
  pre-feature baseline recorded in the log before T032 (SC-005).
- [ ] T034 [US3] e2e in `tests/e2e/real-scores.spec.ts`: dropping `fur-elise-bare.musicxml` shows `g.beam` and one
  info notice.

**Checkpoint**: US3 independent test passes; opened scores that encode beams/accidentals are unchanged.

---

## Phase 6: User Story 4 - The library stays correct (Priority: P2)

**Goal**: the publishing check refuses unbeamed rhythms and wrong-reading pitches (FR-012, FR-013).
**Independent Test**: removing the natural in *Für Elise* bar 1 in a scratch copy fails the guard with item, bar 1,
staff 1, `D5`; removing a beam group fails the same way; regenerating exercises passes with no hand edits.

- [ ] T035 [P] [US4] Test `tests/library/engraving-guard.test.ts`: a negative case that mutates an in-memory copy
  of *Für Elise (theme)* (drop one `<accidental>`, then one `<beam>` group) and asserts the exact failure
  messages; a positive case that regenerates every exercise family in memory and plans zero inserts.
- [ ] T036 [US4] Make `tools/library/build-index.ts` (the library publishing check used by `pnpm library:index`)
  refuse to write the index when any item has engraving findings, printing the guard message; test in
  `tests/library/index.test.ts` (where the existing build-index tests live).
- [ ] T037 [US4] Document the rule in `public/library/README.md` (how to add a piece: run `pnpm library:engrave`
  then `pnpm library:index`).

**Checkpoint**: guard fails on the scratch mutations and passes on the real library.

---

## Phase 7: User Story 5 - Engraving checklist and title block (Priority: P3)

**Goal**: a checked answer to "is anything else missing?" (FR-014, FR-015) and the title block (FR-017).
**Independent Test**: `engraving-audit.md` covers every repertoire piece and every FR-014 element, each gap has a
fix or a named follow-up; every Score shows title/composer/arranger above page 1 in all modes.

### Title block - tests first

- [ ] T038 [P] [US5] Test `tests/core/musicxml/build.test.ts`: `Score.arranger` from `<creator type="arranger">`;
  title falls back to `<movement-title>`; both null-safe.
- [ ] T039 [P] [US5] Test `tests/ui/title-block.test.ts` (happy-dom): the score view renders a title block before
  page 1 with title, composer, "arr. <name>"; file-name fallback without a title; missing lines omitted; a long
  title wraps (no horizontal overflow).
- [ ] T040 [P] [US5] Extend `tests/e2e/library.spec.ts`: *Für Elise (theme)* shows the title block text in Listen,
  Practice and Play; `tests/e2e/us1-layout.spec.ts` (feature 004) still passes with the block (SC-008).

### Title block - implementation

- [ ] T041 [US5] `src/core/score/model.ts` + `src/core/musicxml/build.ts`: `arranger`, movement-title fallback;
  `summary.arranger` in `src/workers/score.worker.ts` (worker-messages 1.1.0, same bump as T031) until T038 passes.
- [ ] T042 [US5] `src/ui/elements/mx-score-view.ts` + `src/ui/styles/`: title block above page 1 (serif, centred
  title, composer right, arranger below); `src/workers/verovio.worker.ts` and `tests/verovio/page-units.test.ts`:
  `header: 'none'`; until T039/T040 pass.

### Engraving audit

- [ ] T043 [US5] Write `tools/library/audit.ts` that counts, per
  repertoire piece, the FR-014 elements present in the file and in the rendered SVG (beams, accid, stems, rests,
  ties, slurs, dynamics/hairpins, tempo/expression, articulations, fingering, pedal, ornaments,
  repeats/voltas/jumps, title block, system-start bar numbers).
- [ ] T044 [US5] Review each piece against its cited source with the `music-domain-expert` role; write
  `specs/006-beamed-note-engraving/engraving-audit.md` (piece x element: present / missing (bars) / not used).
- [ ] T045 [US5] For each gap that contradicts playback or grading: fix it in this feature (new task numbers from
  T052); for purely visual gaps: list as named follow-ups and ask the owner (FR-015, AGENTS.md section 7).

**Checkpoint**: audit complete, every row resolved; title block visible in every mode.

---

## Phase 8: Polish & Cross-Cutting

- [ ] T046 [P] `docs/musicxml-support.md` and `SUPPORT_MATRIX` in `src/core/musicxml/support.ts`: rows for `<beam>`
  (shown as encoded; completed when a voice has none), `<accidental>` (shown as encoded; required and courtesy
  signs completed), `<creator type="arranger">`, `<movement-title>`, `<credit>` (not drawn; title block instead)
  (FR-016); keep `tests/core/musicxml/support-doc-sync.test.ts` green.
- [ ] T047 [P] `THIRD_PARTY_NOTICES.md` / `public/library/README.md`: note that library files were completed by the
  engraving tool (no licence change).
- [ ] T048 Run quickstart.md manual verification for US1-US5 in Chrome; screenshot *Für Elise (theme)* next to
  the owner's reference for SC-004.
- [ ] T049 Full gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`; constitution review with
  `constitution-auditor` before merge; implementation-log entry.

## Dependencies & Execution Order

- Setup (T001-T002) -> Foundational (T003-T011) -> US1 -> US2 -> US3 -> US4 -> US5 -> Polish.
- **T003/T004 must run before any change to `public/library/`** (T018-T020, T026): the golden is captured from the
  unchanged files.
- US1 and US2 both change library files; do US1's file run (T020) then US2's (T026), each followed by the
  identity test.
- US3 needs T011 (render-copy inserts) and the plan from US1+US2 (T017, T025).
- US4 needs US1+US2 (the guard asserts the finished rules). US5's title block (T038-T042) is independent of
  US1-US4 and can run any time after Setup; the audit (T043-T045) runs last because it audits the finished result.
- T031 and T041 both bump worker-messages to 1.1.0: do it once in whichever lands first, extend it in the other.

## Parallel Opportunities

- T027 is filed under US1 (before T019) although numbered later; T050 closes US2.
- Foundational tests T005, T006, T007, T008 together; then T010 alongside T009.
- US1 tests T012-T015 together. US2 tests T022-T024 together. US3 tests T028-T030 together.
- Title block (T038-T042) in a separate lane in parallel with US1-US3 (touches `build.ts`, `model.ts`, UI and the
  Verovio worker options only; coordinate the worker-messages bump).
- Polish T046, T047 together.

## Suggested MVP

US1 + US2 (both P1): the library shows beams and correct accidentals (tasks T001-T027, T050).
