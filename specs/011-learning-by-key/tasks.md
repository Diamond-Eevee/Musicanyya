# Tasks: Learning by key

**Input**: Design documents from `specs/011-learning-by-key/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

<!--
  Format: `- [ ] T001 [P] [US1] Description with exact file path`
  States: `[ ]` open, `[~]` in progress with ` (claimed: <agent-id> <date>)`, `[x]` done (AGENTS.md section 4)
  - [P]   = can run in parallel (different files, no dependency on unfinished tasks)
  - [USn] = user story the task belongs to (omit for Setup/Foundational/Polish)
  - Tests come BEFORE implementation (Constitution IV) and must fail first.
  - No task in this feature touches an AudioWorklet, the scheduler, MIDI input timing or plugin callbacks, so there is
    no RT review task (plan: "Real-time Paths Touched: none").
-->

Owner decisions D-1, D-2 and D-3 were answered on 2026-09-26 (plan.md); nothing in this list waits for the owner except
T083 (SC-005 learner test).

## Phase 1: Setup

- [ ] T001 Fold the change requests into the canonical contracts, keeping the 011 files as history: `contracts/library-index-1.2.md` into `specs/005-practice-score-library/contracts/library-index.md`, `contracts/library-port-1.2.md` into `specs/005-practice-score-library/contracts/library-port.md`, `contracts/exercise-definition-1.1.md` into `specs/005-practice-score-library/contracts/exercise-definition.md`, `contracts/audit-record-1.2.md` into `specs/007-library-fidelity-audit/contracts/audit-record.md` (and bump `specs/007-library-fidelity-audit/contracts/fidelity-tools.md` to 1.10.0: exercise-theory-v2 claims, `checkSongChords`); version lines updated in each
- [ ] T002 [P] Verify the scale fingering table of data-model §6 against a public-domain scale book fetched from the Internet Archive (search API, page images only; no IMSLP/LOC): record the edition id and page per row in `specs/011-learning-by-key/research.md` (new subsection "R6 fingering source"); correct data-model §6 where the book differs, and list every "verify" row's outcome. Stop and ask if no public-domain scale book with all 24 keys can be found

---

## Phase 2: Foundational (blocks all user stories)

Shared types, the Introduction level, the D-2 criteria changes, the new fact, the step-order check and the 24-key table.
Every story needs them.

### Tests (write first, confirm they fail)

- [ ] T003 [P] Level tests in `tests/core/library/levels.test.ts`: an `introduction` level exists below `beginner` with the caps of data-model §4 (one assertion per criterion row); nested caps hold (every Introduction cap within Beginner's); a key-change exercise (tag `key-changes`) with one key change passes criterion 10 at introduction and beginner, a piece with one key change fails at beginner; a minor exercise whose only explicit accidentals are the raised 7th (and raised 6th going up) passes criterion 11 at beginner while the same accidentals in a piece fail; an exercise spanning 38 semitones within MIDI 35-85 passes criteria 1-2 at beginner and a piece with the same range fails (D-2 B5, B6, B7)
- [ ] T004 [P] Fact tests in `tests/core/library/facts.test.ts`: hand independence under the B1 rule (a bar with RH quarters over a LH whole-note chord counts dependent; RH quarters over LH halves on beats 1 and 3 dependent; RH quarters over LH dotted rhythm with an onset on beat 2.5 independent; identical onsets dependent); `chordChangesPerBar` counts chord attacks per staff that differ from the previous chord attack (a repeated identical chord does not count; a broken chord counts no chord attacks; two staves sum); inline MusicXML fixtures in the test
- [ ] T005 [P] Step-order tests in new `tests/core/library/step-order.test.ts`: `checkStepOrder` passes a strictly rising sequence; fails with the message format of data-model §4 when one fact falls (one case per fact: tempoBpm, notesPerBeat, handIndependenceFraction, chordChangesPerBar); fails when all four facts are equal between two steps; ignores items with `stepOrder` > 0 and every `song` item; checks three-step key-change folders the same way
- [ ] T006 [P] Key table tests in new `tests/core/library/exercise/keys.test.ts`: 24 keys in the circle order of research R2 (C, Am, G, Em, ... F, Dm); each major's next entry is its relative minor; F# major is paired with Eb minor; slugs equal the generator's existing `keySlug` output; tonic octave per data-model §5 by tonic pitch class in both modes (octave 4 for C, Db/C#, D, Eb, E, F; octave 3 for F#, G, Ab/G#, A, Bb, B)
- [ ] T007 [P] Type-guard tests: `tests/core/library/index-model.test.ts` accepts `level: "introduction"`, `step`, `stepOrder`, `meta.supersedes`, section `formerIds`, fact `chordChangesPerBar`, skill tag `key-changes`, and still skips and reports an item with an unknown level or step (library-index 1.2 §3)

### Implementation

- [ ] T008 Types in `src/core/library/types.ts`: `Level` + `'introduction'`; `SKILL_TAGS` + `'key-changes'`; `ItemMetadata.step`, `stepOrder`, `supersedes`; `LibrarySection.formerIds`; `ItemFacts.chordChangesPerBar`; `Step` type and `STEP_RANK` order (library-index 1.2)
- [ ] T009 Introduction caps and D-2 exercise variants in `src/core/defaults.ts` (every `LEVEL_*` record gains `introduction`; `LEVEL_EXERCISE_PITCH_SPAN_SEMITONES_MAX`, `LEVEL_EXERCISE_PITCH_BOUNDS_MIDI` for introduction/beginner; `STEP_ORDER_FACTS`), and the data-model constants table in `specs/005-practice-score-library/data-model.md` §4 updated to match
- [ ] T010 Level check in `src/core/library/levels.ts`: `LEVELS_ORDER` starts at introduction; criterion 10 exemption for exercises tagged `key-changes` (max 1); criterion 11 leading-tone/raised-6th exemption for exercises (needs the key: count only accidentals that are not the raised 7th, or raised 6th, of a minor key in `facts.keys`); criteria 1-2 use the exercise span/bounds for exercises (T003 green)
- [ ] T011 Facts in `src/core/library/facts.ts`: B1 hand-independence rule and `chordChangesPerBar` (T004 green); regenerate `public/library/index.json` with `pnpm library:index` and record in `specs/011-learning-by-key/implementation-log.md` every repertoire item whose computed level changed (id, old, new). An item whose computed level is now **below** its assigned level keeps its assigned (reviewed) level and gets `raisedBecause` naming the reason from its audit record plus "computed level lowered by the 011 hand-independence rule"; the list goes into the hand-off for the owner. An item that now **fails** its assigned level is re-levelled only with the owner's agreement (AGENTS.md section 7): stop and ask (analyze A4)
- [ ] T012 [P] Step-order check in new `src/core/library/step-order.ts` (T005 green)
- [ ] T013 [P] Key table in new `src/core/library/exercise/keys.ts` (T006 green); `generate.ts` reuses its display names and slugs instead of its private helpers
- [ ] T014 Index model in `src/core/library/index-model.ts` and the level guard in `src/ui/state/libraryState.ts` (`isLevel`) accept the new values (T007 green)
- [ ] T086 [P] Build-index rule tests in `tests/library/index.test.ts` using a temporary tree (as `tests/library/extensibility.test.ts` does): one failing case per library-index 1.2 §1 rule (missing step under `learning/keys`, step outside it, step/level mismatch, duplicate `(step, stepOrder)`, duplicate or on-shelf `supersedes` id) and one per step-order failure; each names folder and cause (analyze A12)
- [ ] T015 `tools/library/build-index.ts`: copy `step`/`stepOrder`/`supersedes`; validate the library-index 1.2 §1 rules (step required under `learning/keys` and `learning/key-changes`, forbidden elsewhere; step/level pairing; `(step, stepOrder)` unique per folder; `supersedes` ids unique and not on the shelf); run `checkStepOrder` per key and key-change folder and refuse to write naming folder, steps and fact (T086 green)

**Checkpoint**: `pnpm test -- tests/core/library tests/library` green; the current shelf still indexes (no step fields yet, so no step-order checks run).

---

## Phase 3: User Story 1 - Find my key and start at the easiest step (Priority: P1) MVP

**Goal**: *Learning > Keys* with 24 key folders, each holding the four generated steps plus the C major extras; the old
*Chords* items replaced by their successors; the library panel shows the tree.
**Independent Test** (spec US1): open the library, *Learning > Keys*, any key: steps listed Introduction, Beginner,
Intermediate, Advanced; Introduction opens and plays in Listen mode; its accompanying hand has at most one chord per bar.

### Tests (write first, confirm they fail)

- [ ] T016 [P] [US1] Scale tests in new `tests/core/library/exercise/scales.test.ts`: letter-arithmetic spelling of the one-octave major, harmonic and melodic minor scales in all 24 keys (one table-driven assertion per key and form; F# major has E#, G# minor harmonic has F double sharp, Eb minor harmonic has D natural); melodic minor descending restores 6 and 7; fingering per data-model §6 (as corrected by T002) for both hands, ascending and descending
- [ ] T017 [P] [US1] Pattern-form generator tests in new `tests/core/library/exercise/pattern.test.ts`: section bar filling (throws naming definition and section when a hand under- or over-fills); `mirror` swaps hands with the scale an octave lower and chords an octave higher; register rule of data-model §5 (C major Beginner reproduces the notes of the hand-written `c-major-scale-and-chords` register: RH scale C4-C5, LH chords rooted C3 with IV/V below); every altered scale note carries `<accidental>`; fingering on every note; section labels as words directions; output needs no engraving inserts; 1.0.0 definitions still generate byte-identical output (existing `goldens.test.ts` unchanged and green)
- [ ] T018 [P] [US1] Step shape tests in new `tests/core/library/exercise/steps.test.ts`, run over the four `content/library/exercises/step-*.json` definitions in all 24 keys: Introduction = 10 bars, q=60, scale hand quarter notes, chord hand only I and V (i and V in minor) in root position, at most one chord onset per bar (FR-007, SC-003); Beginner = q=72, half-note chords I/IV/V, hands swap at bar 6 (FR-008); Intermediate = inversions present and a both-hands-chords section, melodic minor in minor keys (FR-009); Advanced = a four-chord progression containing vi or ii (VI or iv in minor) and eighth notes (FR-009); tempo of Introduction <= 0.9 x Beginner in every key (SC-003); identical rhythm and degree sequence across keys (FR-011); every item passes its own level (`checkLevel`) and `checkStepOrder` (FR-010, FR-022); hand independence is 0 in every step (B1); `raisedBecause` present exactly when the computed level is below the step's level (analyze A3); in minor keys the section labels name the scale form ("harmonic minor" / "melodic minor", spec edge case, analyze A8)
- [ ] T019 [P] [US1] Exercise goldens: add C major, F# major, G# minor and Eb minor for each of the four steps to `tests/core/library/exercise/goldens.test.ts` (new snapshots in `tests/core/library/exercise/__snapshots__/`)
- [ ] T020 [P] [US1] Theory check v2 tests in `tests/tools/fidelity/theory.test.ts` and `tests/tools/fidelity/exercise-claims.test.ts`: claims parsed from `{key} - introduction|beginner|intermediate|advanced` in all 24 keys; scale claims per section and hand (harmonic, melodic up/down); broken-chord and root-fifth voicings; planted errors each give one difference (wrong scale letter, missing raised 7th, wrong inversion, chord in the wrong hand); the architecture guard still passes (theory check imports neither the generator nor the definitions)
- [ ] T021 [P] [US1] Section tree tests in new `tests/core/library/tree.test.ts`: `buildSectionTree` orders roots and children by sibling `order`; omits sections with no items and no non-empty descendants; `filterItems` in `tests/core/library/filter.test.ts` sorts depth-first by tree, then step rank, `stepOrder`, title; filter by `level: 'introduction'`
- [ ] T022 [P] [US1] Panel tests in `tests/ui/mx-library.test.ts`: sections render as nested `<details>`; roots and their children open, key folders closed by default; a filter opens every folder with matches and omits the rest; user-toggled state survives a re-render and is restored when the filter clears; items show "1 Introduction" ... "4 Advanced" before the level chip; `tests/ui/mx-library-filters.test.ts` offers the Introduction level; synthetic 200-item 3-level tree renders within the library-port budget
- [ ] T023 [P] [US1] Shelf tests in `tests/library/index.test.ts`: 24 key folders in research R2 order with titles "C major", "A minor", ...; each has main introduction, beginner, intermediate, advanced; >= 96 step exercises; C major holds the three Advanced extras with stepOrder 10/20/30; no item remains under `learning/chords/` except the two drills US2 moves (`changes-same-tonic-c-major`, `changes-a-minor-major-a-minor`); every successor-table entry of data-model §7 handled so far appears in exactly one `supersedes` with the old file's SHA-256 (FR-005, FR-020)
- [ ] T024 [P] [US1] e2e in `tests/e2e/library.spec.ts`: open the Scores panel, open *Keys*, open *C major*, open "1 Introduction", the Score engraves and Listen plays (cursor moves); SC-001 counted as at most 3 selections from the open panel; the sample list of items per section uses new ids; `tests/e2e/piano-keyboard.spec.ts` `CMAJOR_ITEM` moves to `learning/keys/c-major/beginner` (log why: the item was superseded)

### Implementation

- [ ] T025 [US1] Definition types in `src/core/library/exercise/types.ts` (form, step, stepOrder, fileStem, section placeholders, sections, handPart, patternChord, supersedes; contract exercise-definition 1.1)
- [ ] T026 [US1] Scales and fingering in new `src/core/library/exercise/scales.ts` (T016 green)
- [ ] T027 [US1] `generatePatternFamily` in `src/core/library/exercise/generate.ts` plus broken and root-fifth voicings in `src/core/library/exercise/voicing.ts` (T017 green, existing goldens unchanged)
- [ ] T028 [US1] The four step definitions `content/library/exercises/step-introduction.json`, `step-beginner.json`, `step-intermediate.json`, `step-advanced.json` per research R6 (titles `{key} - introduction` ..., section `learning/keys/{key}`, `supersedes` per data-model §7, trains text naming the chords and "hands swap", section labels naming the scale form in minor keys, `meta.raisedBecause` where T018 requires it) (T018, T019 green)
- [ ] T029 [US1] `tools/library/build-exercises.ts`: dispatch by `form`; substitute `{key}` in `section`; write `fileStem`; look up the old file's SHA-256 for each `supersedes` id and write `supersedes: [{id, hash}]` into the sidecar; refuse a `supersedes` id whose file is missing
- [ ] T087 [P] [US1] Successor table test in `tests/library/identity.test.ts`: every old id of data-model §7 maps to exactly one new id; the definitions' `supersedes` agree with the table (analyze A12)
- [ ] T030 [US1] Successor table in new `tools/library/successors.ts` (data-model §7) (T087 green)
- [ ] T031 [US1] Move the C major extras: `content/library/exercises/changes-i-v-vi-iv.json`, `changes-turnaround.json`, `changes-diatonic-ladder.json` get section `learning/keys/c-major`, step `advanced`, stepOrder 10/20/30, fileStem `i-v-vi-iv` / `turnaround` / `diatonic-ladder`, `supersedes` the old ids
- [ ] T032 [US1] Retire the superseded definitions and files: delete `content/library/exercises/triads-major.json`, `triads-minor.json`, `changes-i-v-i.json`, `changes-i-iv-i.json`, `changes-plagal-perfect.json`, `changes-cadence.json`, `changes-tonic-inversions.json`, `changes-minor-cadence.json`, `changes-i-vi-iv-v.json`, `changes-ii-v-i.json`, the hand-written `public/library/learning/chords/c-major-scale-and-chords.{musicxml,json}` and every generated file they produced under `public/library/learning/chords/` (all created by this project's generator or agents - listed in the log); regenerate with `pnpm library:exercises`
- [ ] T033 [US1] Sections in `tools/library/sections.ts`: `learning/keys` (formerIds `learning/chords`) and 24 generated key sections from `keys.ts`; keep `learning/chords/changes` until US2; `order` = sibling position
- [ ] T034 [US1] Tree and sort in new `src/core/library/tree.ts` and `src/core/library/filter.ts` (T021 green)
- [ ] T035 [US1] Panel in `src/ui/elements/mx-library.ts`, open-folder state in `src/ui/state/libraryState.ts`, step and level words in `src/ui/i18n/en.ts`, disclosure styling in the library stylesheet under `src/ui/styles/` (T022 green)
- [ ] T036 [US1] Theory check v2 in `tools/library/fidelity/exercise-claims.ts` and `tools/library/fidelity/theory.ts` (T020 green)
- [ ] T037 [US1] Audit records: one `content/library/audit/learning/keys/<key>/<stem>.json` per new step item (claim `exercise`, `exercise-theory-v2`, `supersedes` = the sidecar's old ids) and moved records for the three C major extras (new `itemId`, `supersedes` = their old id, analyze A14); delete the records of the retired ids; sidecars' `reviewedBy`/`reviewedOn` equal the records; `pnpm library:fidelity` green and `docs/library-audit.md` regenerated with the "Replaced by feature 011" table (audit-record 1.2 §3, implemented in `tools/library/fidelity/report.ts`)
- [ ] T038 [US1] Regenerate and verify the shelf: `pnpm library:engrave`, `pnpm library:index` (step-order and levels pass for all 24 keys), `pnpm test -- tests/library` green (T023 green); screenshots of `learning/keys/c-major/introduction`, `learning/keys/f-sharp-major/introduction`, `learning/keys/g-sharp-minor/advanced` looked at and described in the log
- [ ] T039 [US1] Update the tests that name old ids (`tests/core/library/filter.test.ts`, `tests/core/timeline/position.test.ts`, `tests/tools/engrave.test.ts`, `tests/tools/fidelity/report.test.ts`, `tests/ui/library-state.test.ts`, `tests/verovio/engraving.test.ts`) to the successor ids, and the shelf-count assertions of `tests/library/` (>= 24 chord exercises, >= 12 chord-change drills) to the library-index 1.2 §4 counts, each change justified in the log (the file moved or was superseded; no expected value loosened) (T024 green)

**Checkpoint**: US1 Independent Test passes on the real shelf (quickstart US1 steps 1-5); full gate `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` green; log entry; commit.

---

## Phase 4: User Story 2 - Learn to move between keys (Priority: P2)

**Goal**: *Learning > Key changes* with 18 folders (relative and parallel pairs), three generated steps each, plus the
two same-tonic drills as extras.
**Independent Test** (spec US2): every item of any key-change folder starts in the first key, ends on the second key's
tonic, shows the change (new signature and/or double barline and key name), and the folder is ordered by difficulty.

### Tests (write first, confirm they fail)

- [ ] T040 [P] [US2] Key-change generator tests in new `tests/core/library/exercise/key-change.test.ts`: parallel change writes a light-light barline before the arrival bar and a `<key>` with the new fifths (and `<cancel>` when accidentals disappear, e.g. C minor -> C major) in the arrival bar; relative change keeps the signature, writes the barline and a words direction with the new key name; first chord = tonic of the first key, last chord = tonic of the second (FR-013); pivot of data-model §3 at the specified bar; notes tied across the change keep their pitch; output needs no engraving inserts
- [ ] T041 [P] [US2] Key-change step tests in `tests/core/library/exercise/steps.test.ts`: the three key-change definitions over all 18 pairs - Introduction q=60 12 bars whole-note chords; Beginner q=72 11 bars; Intermediate q=80 9 bars both hands on chords (research R7); each passes its level and `checkStepOrder`; same shape in every pair of the same relation (FR-011)
- [ ] T042 [P] [US2] Goldens for `c-major-to-a-minor`, `c-minor-to-c-major`, `d-major-to-b-minor` (all three steps) in `tests/core/library/exercise/goldens.test.ts`
- [ ] T043 [P] [US2] Theory v2 key-segment tests in `tests/tools/fidelity/theory.test.ts` / `exercise-claims.test.ts`: claims from `{from} to {to} - introduction|beginner|intermediate`; a key per bar range; planted errors (missing new signature, leading tone of the old key after the change, wrong final tonic) each give one difference
- [ ] T044 [P] [US2] Fact test in `tests/core/library/facts.test.ts`: a relative change with an unchanged signature yields one key name in `facts.keys` (not a key change); a parallel change yields two
- [ ] T045 [P] [US2] Shelf tests in `tests/library/index.test.ts`: 18 key-change folders titled "<from> -> <to>" with description relative/parallel, in data-model §2 order; each has main introduction, beginner, intermediate and the tag `key-changes`; `major-and-minor` extra in `c-major-to-c-minor` and `minor-and-major` in `a-minor-to-a-major`; nothing left under `learning/chords/`; >= 54 key-change exercises
- [ ] T046 [P] [US2] e2e in `tests/e2e/library.spec.ts`: open *Key changes > C major -> C minor > 1 Introduction*; it engraves with the three-flat signature mid-score (SVG key signature count) and Listen plays to the end

### Implementation

- [ ] T047 [US2] `generateKeyChangeFamily` in `src/core/library/exercise/generate.ts` (key segments, barline, `<key>`/`<cancel>` through the existing mid-measure attributes of `src/core/musicxml/write.ts`, key-name words) (T040 green)
- [ ] T048 [US2] Definitions `content/library/exercises/key-change-relative.json` and `key-change-parallel.json` (three steps each, or one file per step and relation as the schema requires) over the 18 pairs of data-model §2-3; section `learning/key-changes/{pair}` (T041, T042 green)
- [ ] T049 [US2] Move `content/library/exercises/changes-same-tonic.json` to section `learning/key-changes/c-major-to-c-minor`, fileStem `major-and-minor`, step intermediate, stepOrder 10, tag `key-changes`, `supersedes` the old id; `changes-a-minor-major.json` likewise to `learning/key-changes/a-minor-to-a-major` / `minor-and-major` (FR-014)
- [ ] T050 [US2] Sections in `tools/library/sections.ts`: `learning/key-changes` (formerIds `learning/chords/changes`) and the 18 pair sections with relation descriptions; drop `learning/chords` and `learning/chords/changes`
- [ ] T051 [US2] Theory v2 key segments in `tools/library/fidelity/theory.ts` / `exercise-claims.ts` (T043 green); facts fix if T044 fails in `src/core/library/facts.ts`
- [ ] T052 [US2] Regenerate (`pnpm library:exercises`, `pnpm library:engrave`, `pnpm library:index`), audit records under `content/library/audit/learning/key-changes/` (new and moved; retired ones deleted), `pnpm library:fidelity` green, report regenerated (T045 green); screenshots of `learning/key-changes/c-major-to-c-minor/introduction` and `learning/key-changes/c-major-to-a-minor/beginner` looked at and described in the log

**Checkpoint**: US2 Independent Test (quickstart US2) passes; US1 still passes; full gate green; log entry; commit.

---

## Phase 5: User Story 3 - Songs to try chords on (Priority: P2)

**Goal**: 9 songs (research R9) in the *Song* step of their key folders: public-domain melody right hand, our CC0
block chords left hand, chord names above.
**Independent Test** (spec US3): open any song, choose the left hand in Practice mode: only chords are expected, the
melody sounds as accompaniment, every chord is in the set its level promises.

### Tests (write first, confirm they fail)

- [ ] T053 [P] [US3] Song-definition schema tests in new `tests/tools/songs/definition.test.ts`: valid example accepted; id outside `learning/keys/<key>/song-*` rejected; missing chord plan rejected; unknown source rejected (contract song-definition §1)
- [ ] T054 [P] [US3] Song builder tests in new `tests/tools/songs/build-songs.test.ts` using a small approved test source in `tests/fixtures/` (an existing Mutopia fixture from feature 007 tests, or the approved Greensleeves source): refuses an unapproved source; melody taken from the named staff/voice and bars; `topVoice` takes the highest note per onset; `transpose` +P4 moves E minor to A minor with correct spelling; LH one block triad per chord entry in close position with root in C3-B3, held and tied to the next chord, fingering by inversion; chord names as `<words>` (never `<harmony>`); refuses when the plan leaves a full bar without a chord; sidecar fields per contract §2 step 6; output loads with no notices and needs no engraving inserts
- [ ] T055 [P] [US3] Song-chords check tests in new `tests/tools/fidelity/song-chords.test.ts`: every staff-2 chord equals the triad its name spells in the shelf key; a beginner song with a vi chord fails; two changes in one bar fail at beginner and pass at intermediate; planted wrong third gives one difference (research R9 allowed sets)
- [ ] T056 [P] [US3] Shelf tests in `tests/library/index.test.ts` and `tests/library/licence.test.ts`: >= 8 songs, >= 6 beginner, >= 4 keys, >= 2 minor keys (FR-016, SC-004); each song `kind: piece`, `step: song`, `arrangement: true`, `departures` present, `provenance.basedOn` names an approved source, `licence: CC0-1.0`; each approved source appears in `THIRD_PARTY_NOTICES.md`
- [ ] T057 [P] [US3] Practice test in `tests/engine/session-library.test.ts`: opening a song and selecting the left hand expects only staff-2 notes and schedules staff-1 notes as accompaniment (FR-019; existing 002 behaviour, asserted on a real song file)

### Implementation

- [ ] T058 [US3] Download the 8 approved Mutopia sources (1111, 905, 644, 1223, 1220, 1295, 1121, 1300) unchanged into `content/library/sources/mutopia-<id>-<slug>/` with `source.json` per `specs/007-library-fidelity-audit/contracts/source-manifest.md` (licence as the page states it, re-checked on the day; `approvedByOwner: "2026-09-26"`, SHA-256, MIDI fields via `pnpm library:fidelity --inspect-midi`); stop and ask if any page no longer says "Public Domain"
- [ ] T059 [US3] `THIRD_PARTY_NOTICES.md` entries for the 8 sources; `content/library/sources/README.md` "Rejected sources" rows for the rejected candidates of research R9
- [ ] T060 [US3] Song-definition schema and validator in new `tools/library/songs/definition.ts` (T053 green)
- [ ] T061 [US3] Builder in new `tools/library/build-songs.ts` (reusing `tools/library/lilypond/` reader and the MIDI cross-check) and `package.json` script `library:songs` (T054 green)
- [ ] T062 [US3] Song-chords check in new `tools/library/fidelity/song-chords.ts`, wired into `tools/library/fidelity/records.ts` as rule set `song-chords-v1` (T055 green)
- [ ] T063 [US3] The nine definitions in `content/library/songs/`: au-clair-de-la-lune (C), good-king-wenceslas (A), the-holly-and-the-ivy (F), joy-to-the-world (D), o-come-all-ye-faithful (G), silent-night (Bb), auld-lang-syne (D), o-come-o-come-emmanuel (E minor, intermediate), greensleeves (A minor, transposed +P4, intermediate), with good-king-wenceslas transposed -M2 to G major and silent-night intermediate (research R9, analyze A2); before committing a definition, level-check the built song and set its level to the level it passes (beginner songs must pass the beginner caps as pieces); if fewer than 6 songs pass beginner, stop and ask (the reserves need source approval); chord plans reviewed by the `music-domain-expert` agent (findings summarised in the log); build with `pnpm library:songs`
- [ ] T084 [P] [US3] Score-source test in `tests/ui/mx-score-source.test.ts` (new): an authored item with `provenance.basedOn` shows "Arrangement for this app (CC0)" and its `provenance.note` (source edition, link, public domain); an authored item without `basedOn` still shows only the authored line (library-port 1.2 §4a, spec US3 scenario 3)
- [ ] T085 [US3] Implement §4a in `src/ui/elements/mx-score-source.ts` and `src/ui/i18n/en.ts`; `tools/library/build-songs.ts` writes `provenance.note` (T084 green)
- [ ] T064 [US3] Audit records `content/library/audit/learning/keys/<key>/song-<slug>.json` (claim `arrangement`, mechanical `melody` check with `expectedDifferences: 0`, `song-chords-v1` check); `pnpm library:engrave`, `pnpm library:index`, `pnpm library:fidelity` green; report regenerated (T056, T057 green); screenshots of `learning/keys/c-major/song-au-clair-de-la-lune` and `learning/keys/a-minor/song-greensleeves` looked at and described in the log

**Checkpoint**: US3 Independent Test (quickstart US3) passes; US1 and US2 still pass; full gate green; log entry; commit.

---

## Phase 6: User Story 4 - Old links still work (Priority: P3)

**Goal**: settings remembered for an old item apply to its successor; a saved folder filter moves to the successor
folder; recent scores keep opening their copy.
**Independent Test** (spec US4): with settings stored for `learning/chords/triads-c-major`'s hash, opening
`learning/keys/c-major/intermediate` preselects them.

### Tests (write first, confirm they fail)

- [ ] T065 [P] [US4] Adoption tests in `tests/engine/storage/local-settings-store.test.ts`: `adoptScoreSettings(from, to)` copies Practice and Play per-Score settings from the first `from` hash with an entry; never overwrites an existing `to` entry; keeps the old entry; returns false and writes nothing when no `from` has an entry; swallows storage errors (library-port 1.2 §4); the fake settings store implements the same
- [ ] T066 [P] [US4] Session test in `tests/engine/session-library.test.ts`: `openItem` calls `adoptScoreSettings` with the item's `supersedes` hashes and its own hash before `loadBytes`; an item without `supersedes` calls it with `[]` (no copy)
- [ ] T067 [P] [US4] Filter migration tests in `tests/ui/library-state.test.ts`: a persisted `sectionId: "learning/chords"` becomes `learning/keys` once the index loads; `learning/chords/changes` becomes `learning/key-changes`; an unknown id becomes `null`
- [ ] T068 [P] [US4] Recents test in `tests/engine/storage/indexeddb-score-store.test.ts`: a stored recent whose bytes equal an old library file reopens without an error after the shelf changed (no lookup by library id)
- [ ] T069 [P] [US4] Successor coverage test in `tests/library/index.test.ts`: all 41 old ids of data-model §7 appear exactly once across the shelf's `supersedes`, each with the SHA-256 of the file as it was on `main` before this feature (hashes recorded in `tools/library/successors.ts`, SC-006)

### Implementation

- [ ] T070 [US4] `adoptScoreSettings` in `src/engine/storage/local-settings-store.ts`, the settings port in `src/engine/ports.ts`, and the fake used by the engine tests (T065 green)
- [ ] T071 [US4] Call it from `src/app/library-session.ts` `openItem` (T066 green)
- [ ] T072 [US4] Section-id migration via `formerIds` in `src/ui/state/libraryState.ts` (T067 green); `tools/library/build-index.ts` copies `formerIds` from `tools/library/sections.ts` into `index.json`
- [ ] T073 [US4] Old hashes in `tools/library/successors.ts` taken from the `main` commit before this feature (`git show e450501:public/library/...`), used by `build-exercises.ts` when the old file is already deleted; regenerate the index (T068, T069 green)

**Checkpoint**: US4 Independent Test (quickstart US4) passes; all stories pass; full gate green; log entry; commit.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T074 [P] `public/library/README.md`: the new shelf layout, the song builder, `supersedes`, the step-order check; the 24-key and chord-change paragraph rewritten for the step definitions
- [ ] T075 [P] `specs/005-practice-score-library/data-model.md` §2 shelf tree and §4 level table point to 011 (Introduction level, D-2 changes) so the canonical documents agree
- [ ] T076 [P] `docs/musicxml-support.md`: confirm no row changes (key changes mid-piece, `<cancel>` and light-light barlines already supported); if Verovio or the parser needed anything, update the row and `SUPPORT_MATRIX`
- [ ] T077 [P] `quickstart.md`, `README.md` and the toolchain section of `docs/agents/reference.md`: `pnpm library:songs`
- [ ] T078 Shelf size: `tests/library` budget test still passes with ~164 items; index size recorded in the log (research R13)
- [ ] T079 Run every quickstart.md manual verification with `pnpm screenshot`, look at each PNG, describe it in the log
- [ ] T080 Constitution review of the branch with the `constitution-auditor` agent; findings summarised in the log and fixed or turned into tasks
- [ ] T081 Music review of the step definitions, key-change definitions and song chord plans with the `music-domain-expert` agent (musical correctness, fingering, levels); findings summarised in the log and fixed or turned into tasks
- [ ] T088 Electron Shell (FR-023): `pnpm test:e2e` includes the Electron specs; add to `tests/e2e/electron-smoke.spec.ts` an assertion that the packaged shelf opens `learning/keys/c-major/introduction` from the library panel (analyze A7)
- [ ] T082 Full gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` - summary lines in the log
- [ ] T083 SC-005 learner test: the owner (or three people) plays the C major Introduction hands together in Practice mode once; wrong-note counts recorded in the log. Needs the owner; does not block merge readiness of the other tasks but SC-005 is unmet until done

## Dependencies & Execution Order

- Setup (T001-T002) -> Foundational (T003-T015, T086) -> US1 (T016-T039, T087) -> US2 (T040-T052) / US3 (T053-T064, T084-T085) -> US4 (T065-T073) -> Polish (T074-T083, T088)
- Test-first pairs added by analyze: T086 before T015, T087 before T030, T084 before T085.
- T002 (fingering source) must finish before T016's fingering assertions are fixed; T016 spelling assertions can start earlier.
- T011 re-levels repertoire: its log entry must exist before any US1 index regeneration (T038) is committed.
- US2 depends on US1 for the panel tree (T034-T035), the theory check v2 base (T036) and the successor mechanism (T029-T030); its generator work (T040, T047) can start in parallel with US1's T027 once T025 is done.
- US3 depends only on Foundational and the panel (T035) for its checkpoint; T058-T062 can run in parallel with US1/US2.
- US4 needs the final successor set, so it follows US1 and US2 (T069 counts all 41 old ids); T065, T070 (settings store) can start any time after Foundational.
- Within each story: tests -> core -> tools/content -> UI -> regenerate and audit.

## Parallel Opportunities

- Foundational tests T003-T007 together; then T012 and T013 alongside T008-T011.
- US1 tests T016-T024 together; T026 (scales) and T034 (tree) in parallel after their tests.
- US2 tests T040-T046 together; US3 tests T053-T057 together, and US3's T058-T062 alongside US1/US2 implementation.
- US4 tests T065-T069 together; T070 as early as Phase 2 is done.
- Polish docs T074-T077 together.
