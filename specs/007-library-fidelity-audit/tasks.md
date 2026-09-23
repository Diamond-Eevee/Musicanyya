# Tasks: Library Fidelity Audit

**Input**: Design documents from `specs/007-library-fidelity-audit/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

<!--
  Format: `- [ ] T001 [P] [US1] Description with exact file path`
  States: `[ ]` open, `[~]` in progress with ` (claimed: <agent-id> <date>)`, `[x]` done (AGENTS.md section 4)
-->

**No real-time code is touched** (plan.md, "Real-time Paths Touched: none"), so no task carries an RT review. If a
task turns out to edit an AudioWorklet, the scheduler, the metronome or MIDI timing, stop and add an
`rt-audio-reviewer` task next to it (Constitution I).

**Content rules for every item task** (spec FR-006, FR-020, FR-021, AGENTS.md section 4):

- **Sources**: only owner-approved sources (D-1) are downloaded into the repository. A source whose page shows
  any licence other than public domain or CC0 is never used, not even for reference.
- **Ids**: an item's id never changes.
- **Replacing an item**:
  - capture its identity golden from the converter output **before** `pnpm library:engrave`;
  - then run `pnpm library:engrave`, `pnpm library:index` and `pnpm tsx tools/library/probe.ts` on its folder;
  - update the sidecar (title/subtitle, level, provenance, `reviewedBy`/`reviewedOn`, `limitations`, `expected`)
    to follow the real music.
- **Checking**: an agent's impression never counts as a check. Only the fidelity tool's result or a recorded
  visual check against a named public-domain scan counts.
- **Planted errors**: a method may not produce a "0 differences" record before its planted-error test passes
  (FR-017).
- **When an item cannot be checked**: no placeholder files. Stop and ask the owner (AGENTS.md section 7).
- **When the source itself looks wrong** (spec edge case; for example a typo in the engraving):
  - record the difference;
  - check that passage against a second independent public-domain source (a first-edition or other PD scan), and
    record its URL and the bars compared;
  - the item follows the majority;
  - the decision goes in the record's `differenceNotes`, counted in `expectedDifferences`.

  A single source is never overruled by judgement alone.

---

## Phase 1: Setup

- [x] T001 Ask the owner D-1 to D-4 in one message (plan.md "Owner decisions"): approve the 12 Mutopia sources in
  research R11 table A; Schumann Op. 68 No. 10 (recommendation: remove); accept that level shortfalls are reported,
  not filled; `departures` display is a later UI feature. Record the answers in `plan.md` (Owner decisions,
  "Answer" column) and in `implementation-log.md`. Tasks that depend on an unanswered decision stay open. Their
  dependencies are listed at the end of this file.
- [x] T002 Add the scripts `library:fidelity` (`tsx tools/library/fidelity/cli.ts`) and `library:convert-ly`
  (`tsx tools/library/lilypond/cli.ts`) to `package.json`. Check that `tsconfig.tools.json` and `biome.json` already
  cover `tools/library/fidelity/**` and `tools/library/lilypond/**`, and add them if they do not.
- [x] T003 [P] Write `content/library/sources/README.md`. It covers:
  - what may be committed there: public domain or CC0 only, files unchanged, `source.json` per contract
    `source-manifest.md`;
  - how to add a source (the quickstart steps);
  - a **Rejected sources** table with two rows:
    - Mutopia 659 (Schumann Op. 68 No. 10), rejected because it is CC BY-SA 2.5;
    - `github.com/musetrainer/library`: no licence file, MuseScore.com uploads, one marked "All rights reserved",
      and copyrighted works (spec Clarifications 2026-09-23).
- [x] T004 [P] Write `content/library/audit/README.md`: one record per shelf item, what each outcome means, a
  pointer to contract `audit-record.md`, and "records are authored; `docs/library-audit.md` is generated".
- [x] T005 [P] Fold the sidecar change into the canonical contract
  `specs/005-practice-score-library/contracts/library-index.md` (version 1.0.0 -> 1.1.0):
  - add the optional `departures` field and its rules;
  - update the `reviewedBy` meaning;
  - add the rejected-items row format (from `contracts/library-index-1.1.md`).

  Then mark `contracts/library-index-1.1.md` "applied on <date>".

---

## Phase 2: Foundational (blocks all user stories)

**Purpose**: exact time, the three readers, the comparator, source manifests, audit records and the fidelity test
harness, proven on the one item that is already verified (Advanced Für Elise).

### Tests (write first, confirm they fail)

- [x] T006 [P] `tests/architecture/layers.test.ts`: add assertions that no file under `src/` imports
  `tools/library/fidelity/**` or `tools/library/lilypond/**`. Also assert that `tools/library/fidelity/theory.ts`
  exists and neither imports `src/core/library/exercise/**` nor reads `content/library/exercises` (research R8).
  Confirm the independence assertion fails, because `theory.ts` does not exist yet.
- [x] T007 [P] `tests/tools/fidelity/time.test.ts`: `q()` reduces; `add`/`cmp` work by cross-multiplication;
  `fromTicks(128, 384)` equals `fromTicks(1, 3)` (a triplet eighth at two resolutions); `show()` formats mixed
  numbers (`data-model.md` §1). Confirm it fails.
- [x] T008 [P] `tests/tools/fidelity/midi.test.ts`, built from hand-made byte arrays:
  - format 0 and format 1;
  - running status;
  - note-on with velocity 0 read as note-off;
  - overlapping same-pitch notes on different channels;
  - time-signature meta read, other meta skipped;
  - SMPTE division and a truncated chunk rejected with the byte offset (research R3);
  - `fromMidi` keeps only `midiNoteTracks` and converts to `QuarterTime`.

  Confirm it fails.
- [x] T009 [P] `tests/tools/fidelity/from-musicxml.test.ts`, on existing fixtures under
  `tests/fixtures/musicxml/`:
  - `tie-chain-three`: tied notes merged into one;
  - a grace-note fixture: grace notes kept apart;
  - an octave-shift fixture: sounding pitch;
  - `tuplet-triplet-eighths`: exact thirds;
  - a repeat/volta fixture: `repeatStart`/`repeatEnd`/`endings` per bar;
  - a pickup fixture: bar 0 with its short length and printed number "0";
  - spelling kept;
  - the played order of a repeat/volta fixture comes from the app's own `buildTimeline`
    (`src/core/timeline/timeline.ts`), not from a second unfolding written for the tool (research R6).

  Confirm it fails.
- [x] T010 [P] Own-work LilyPond fixtures in `tests/fixtures/lilypond/`, one construct per file and each a few bars
  long: `relative.ly`, `absolute.ly`, `chords.ly`, `ties.ly`, `tuplets.ly` (`\tuplet` and `\times`), `grace.ly`
  (all four grace commands), `volta.ly`, `unfold.ly`, `partial.ly`, `time-key-clef.ly`, `ottava.ly`,
  `voices.ly` (`<< \\ >>`, `\new Voice`, `\change Staff`), `variables.ly`, `pianostaff.ly`, `bar-check-wrong.ly`,
  `unsupported-transpose.ly`. Also write a `README.md` giving their origin as own work, CC0.
- [x] T011 `tests/tools/lilypond/read.test.ts`: one test per construct in contract `fidelity-tools.md` §3.1, over the
  T010 fixtures. The expected `ReferenceScore` is written by hand in each test. A misplaced bar check and
  `\transpose` throw `LyUnsupportedError` with line and column. Confirm it fails. (Depends on T010.)
- [x] T012 [P] `tests/tools/fidelity/compare.test.ts`:
  - each aspect of `data-model.md` §4.1 on small synthetic `ReferenceScore`s;
  - a same-onset wrong pitch reported once as `pitch`, not as missing + extra;
  - a declared alignment applied, never searched;
  - differences sorted by bar, then onset, so two runs give identical output;
  - the MIDI-step rules of research R5: a shorter note before a grace group is accepted only when the notation
    shows the grace group; the same for an articulated note; a unison merge only where the notation shows the
    unison; any other shortening is a `duration` difference;
  - for a source with `midiArticulate: true`, the MIDI step compares `pitch` and `onset` only, and the result says
    that durations were checked against the notation only.

  Confirm it fails.
- [x] T013 [P] `tests/tools/fidelity/sources.test.ts`: a valid manifest loads. The test also checks these failures:
  - a CC BY-SA licence fails;
  - a changed file fails its hash check;
  - `role: sound` without `midiOrder`/`midiNoteTracks`/`midiArticulate` fails;
  - a missing `approvedByOwner` fails;
  - a folder name that is not the `id` fails.

  Confirm it fails.
- [x] T014 [P] `tests/tools/fidelity/records.test.ts`: schema validation of contract `audit-record.md` §1, plus
  rules 2.2 to 2.7 on synthetic records and a temporary copy of a tiny library tree:
  - re-run count must equal `expectedDifferences`;
  - `differenceNotes` count must match;
  - a visual-only check can never report "mechanical";
  - `relabelled` requires a changed claim;
  - `removed` requires a README row;
  - `reviewedBy`/`reviewedOn` must equal the record;
  - an unknown source fails.

  Confirm it fails.

### Implementation

- [x] T015 [P] `tools/library/fidelity/time.ts` (makes T007 pass). (claimed: gemini-3.1-pro 2026-09-23)
- [x] T016 `tools/library/fidelity/midi.ts`: `readMidi` + `fromMidi` (makes T008 pass). (Depends on T015.) (claimed: gemini-3.1-pro 2026-09-23)
- [x] T017 `tools/library/fidelity/from-musicxml.ts`, through `src/core/musicxml/read.ts` + `build.ts` (makes T009
  pass). The played order always comes from `buildTimeline`, so the check proves what the app actually plays. If
  the Score model lacks something the written-bar reading needs (for example repeat barlines per bar or spelling),
  read it from the parse tree in this file. Do not change `src/core`. (Depends on T015.) (claimed: gemini-3.1-pro 2026-09-23)
- [x] T018 `tools/library/lilypond/lex.ts`, `parse.ts`, `read.ts`: `readLilyPond` + `fromLilyPond`, covering exactly
  contract §3.1 and throwing `LyUnsupportedError` on anything else (makes T011 pass). (Depends on T015.)
- [x] T019 `tools/library/fidelity/compare.ts`: `compare()` with every aspect, declared alignment, and the two-step
  chain of `data-model.md` §4.1a (makes T012 pass). (Depends on T015.)
- [ ] T020 [P] `tools/library/fidelity/sources.ts`: `loadSources` validates and re-hashes (makes T013 pass).
- [ ] T021 `tools/library/fidelity/records.ts`: `loadRecords` + `runRecord` (makes T014 pass). (Depends on T016-T020.)
- [ ] T022 `tools/library/fidelity/cli.ts`: `pnpm library:fidelity` with no arguments, `--item <id>`,
  `--item <id> --file <path>` and `--inspect-midi <path>`, per contract `fidelity-tools.md` §1. The exit code is 1
  on any unreproduced result. Report writing and `--check` come in US4 (T080). (Depends on T021.)
- [ ] T023 Commit the first source, `content/library/sources/mutopia-931-beethoven-woo59/`:
  - `fur_Elise_WoO59.ly` and `.mid`, byte-for-byte from the Mutopia piece page;
  - `source.json` with SHA-256 per file, `midiOrder`, `midiNoteTracks` and `midiArticulate` (found with
    `--inspect-midi` and a grep for `unfoldRepeats`/`articulate`), and `approvedByOwner` (D-1; the owner accepted this edition in the merge of
    `fix/fur-elise-mutopia`, but confirm it under D-1).

  Its `THIRD_PARTY_NOTICES.md` entry already exists; add the sentence that the source files are kept in
  `content/library/sources/`. (Depends on T001, T020.)
- [ ] T024 `tests/tools/fidelity/planted.test.ts`, repertoire part (contract `fidelity-tools.md` §5). It works on a
  temporary copy of `repertoire/advanced/fur-elise-complete.musicxml` against `mutopia-931` and asserts exactly one
  expected difference, in the right bar, for each mutation:
  - one pitch +1 semitone;
  - one duration halved;
  - one bar deleted;
  - one repeat barline removed (also a `playedOrder` difference);
  - one note respelled enharmonically;
  - one grace note removed;
  - one pitch changed in the `.ly` copy, so that the MIDI step reports it.

  Write it before T025 and confirm it fails until T019 and T021 are complete. Then it must pass (FR-017, SC-004).
  (Depends on T023.)
- [ ] T025 First record: `content/library/audit/repertoire/advanced/fur-elise-complete.json`:
  - claim `original`;
  - one mechanical check against `mutopia-931` with `sourceFiles` notation + sound and aspects `barCount`,
    `barLengths`, `repeats`, `playedOrder`, `pitch`, `onset`, `duration`, `spelling`, `graceNotes`;
  - `expectedDifferences` = the re-run result, which must be 0;
  - outcome `verified`;
  - an `outcomeNote` carrying the 2026-09-23 evidence (902 notes) (FR-001).

  Set the sidecar's `reviewedOn` to the record date. If the re-run is not 0, stop: the earlier one-off result was
  wrong, so log it and treat the item as a US1 item. The spec's assumption says this item "needs no new
  comparison". Re-running it anyway is deliberately stricter, because it turns a one-off result into a repeatable
  one; say so in the log (analyze A10). (Depends on T022, T024.)
- [ ] T026 `tests/library/fidelity.test.ts`, first part:
  - every source under `content/library/sources/` validates and its hashes match;
  - every record validates and re-runs to its recorded result;
  - each record's sidecar `reviewedBy`/`reviewedOn` equals the record.

  The coverage and report rules are added in US4 (T078). (Depends on T025.)

### Sidecar `departures` support (moved here from US2; US1's fallback paths in T042/T043 need it, analyze A4)

- [ ] T050 [P] `tests/core/library/index-model.test.ts`: `departures` is accepted and copied into `meta`. A
  non-array, an empty array, more than 8 entries, or an entry over 200 characters makes the item be skipped with a
  notice (contract 1.1.0). Confirm it fails. (Depends on T005.)
- [ ] T055 `departures?: string[]` in `src/core/library/types.ts` and its validation in
  `src/core/library/index-model.ts` (makes T050 pass). `tools/library/build-index.ts` copies it verbatim. Run
  `pnpm library:index`; no item carries the field yet, so `index.json` must be unchanged. (Depends on T050.)

### Delivering corrected items to browsers that cached the old ones (FR-024, SC-010, analyze A1)

These tasks do not depend on the fidelity tooling and can run as their own lane. They must be finished before any
replaced item is merged.

- [ ] T089 [P] Fold contract `contracts/library-port-1.1.md` into the canonical
  `specs/005-practice-score-library/contracts/library-port.md` (version 1.0.0 -> 1.1.0: the `item(file,
  expectedHash?)` signature, caching rules 1-5, the new tests, the performance note), and mark
  `library-port-1.1.md` "applied on <date>".
- [ ] T090 [P] Extend `tests/engine/library/http-catalog.test.ts` (contract `library-port-1.1.md` §3), with stubbed
  `fetch` and `caches`:
  - a cached `index.json` is ignored when the network answers;
  - the cached index is used when the network fails;
  - a cached item with a matching hash is served without a fetch;
  - a cached item with a different hash is deleted, then fetched and returned;
  - a fetched body with a mismatched hash is returned but not cached;
  - no `expectedHash` gives the old behaviour.

  Confirm the new cases fail.
- [ ] T091 [P] Extend `tests/engine/session-library.test.ts`: opening a library item passes the index entry's
  `hash` to `catalog.item()`, as recorded by `tests/fakes/fake-library-catalog.ts`. Confirm it fails.
- [ ] T092 `src/engine/ports.ts` (`item(file, expectedHash?)`), `src/engine/library/http-catalog.ts` (network-first
  index; hash-checked item cache with `hashFile` from `src/engine/files/hash.ts`; cache only matching bodies; every
  cache call still in `try`/`catch`), and `tests/fakes/fake-library-catalog.ts` (accepts and records the hash).
  Makes T090 pass. (Depends on T089, T090.)
- [ ] T093 `src/app/session.ts`: pass the opened index entry's `hash` to `catalog.item()` (makes T091 pass).
  (Depends on T091, T092.)
- [ ] T094 Extend `tests/e2e/library.spec.ts` (browser only; the `app://` shell has no Cache Storage):
  - seed the `musicanyya-library-v1` cache with an altered copy of one item file and a stale `index.json`;
  - reload, open the item, and assert that the loaded Score has the current file's note count (from `index.json`
    `facts.notes`), not the altered one;
  - then take the page offline and assert that the item still opens from the cache (FR-024, SC-010).

  (Depends on T093.)

**Checkpoint**: `pnpm library:fidelity --item repertoire/advanced/fur-elise-complete` reports 0 differences on every
aspect. `planted.test.ts` catches every repertoire mutation. `pnpm test -- tests/tools tests/library` is green.
`departures` is accepted by the index model (T050/T055). The cache tests T090, T091 and T094 pass.

---

## Phase 3: User Story 1 - Every piece that claims to be the original is the original (Priority: P1) MVP

**Goal**: every non-arrangement repertoire item is either compared mechanically with a named public-domain edition
and found identical, or replaced by a conversion of that edition. The alternatives are to be labelled honestly as
an excerpt, or to be removed.

**Independent Test** (spec US1): pick any non-arrangement repertoire item. Its record names the source edition,
the aspects compared, and 0 differences, or lists every difference and the action taken. Changing one pitch in a
copy makes `pnpm library:fidelity --item <id> --file <copy>` fail and name that bar.

### Tests (write first, confirm they fail)

- [ ] T027 [P] [US1] Extend `tests/core/musicxml/write.test.ts`. For each new optional writer element (research R13),
  write it, read it back with `readXml` + `buildScore`, and get the intended Score:
  - repeat barlines + `<ending>`;
  - `<grace/>`;
  - `<time-modification>`;
  - `<octave-shift>`;
  - mid-piece clef/key/time;
  - `16th`/`32nd`;
  - slur;
  - dynamics;
  - `<pedal>`;
  - tempo `<words>` + `<sound tempo>`.

  The existing exercise goldens (`tests/core/library/exercise/goldens.test.ts`) must stay byte-identical. Confirm
  the new cases fail.
- [ ] T028 [P] [US1] `tests/tools/lilypond/to-musicxml.test.ts`:
  - every T010 fixture that the converter supports converts to MusicXML, and `fromMusicXml(output)` equals
    `fromLilyPond(input)` on every aspect;
  - the output loads through the app with no unexpected notice;
  - `library:convert-ly` refuses an unapproved source;
  - it refuses an `authored` target without `--replace`;
  - it refuses when the MIDI cross-check finds a difference (a fixture `.ly` + `.mid` pair with one planted
    mismatch).

  Confirm it fails.

### Implementation - tooling

- [ ] T029 [US1] Extend `src/core/musicxml/write.ts` additively with the elements in T027, optional fields only
  (makes T027 pass; exercise goldens unchanged). (Depends on T027.)
- [ ] T030 [US1] `tools/library/lilypond/to-musicxml.ts` + `tools/library/lilypond/cli.ts`
  (`pnpm library:convert-ly <source-id> <item-id> [--replace]`, contract §1 and §3.3-3.4). Titles, composer and
  credit come from the sidecar, not from the `.ly` header (makes T028 pass). (Depends on T018, T021, T029.)

### Implementation - sources (each after D-1; [P] across sources)

Each source task does the same steps:

- download the `.ly` and `.mid` from the Mutopia piece page into `content/library/sources/<id>/` unchanged;
- write `source.json` with the edition as Mutopia states it, SHA-256 per file, `midiOrder`, `midiNoteTracks` and
  `midiArticulate` (from `--inspect-midi` and a grep for `unfoldRepeats`/`articulate`), and `approvedByOwner`;
- if the source is the first one with `midiArticulate: true`, add a planted duration error against it to
  `planted.test.ts`. The item-vs-notation step must catch it, even though the MIDI step does not compare durations
  (analyze A6);
- add a `THIRD_PARTY_NOTICES.md` entry: under "Reference sources" if the source is used only for comparison,
  otherwise in the library list when an item is converted from it (FR-023).

- [ ] T031 [P] [US1] `content/library/sources/mutopia-5-bach-bwv846/` (piece 5, edition "Unknown").
- [ ] T032 [P] [US1] `content/library/sources/mutopia-468-chopin-op28-no4/` (Peters, 1879).
- [ ] T033 [P] [US1] `content/library/sources/mutopia-472-chopin-op28-no20/` (Edition Peters).
- [ ] T034 [P] [US1] `content/library/sources/mutopia-37-satie-gymnopedie1/` (Dover Edition).
- [ ] T035 [P] [US1] `content/library/sources/mutopia-203-burgmuller-op100-no2/` (Collection Litolff).
- [ ] T036 [P] [US1] `content/library/sources/mutopia-214-burgmuller-op100-no5/` (Collection Litolff).
- [ ] T037 [P] [US1] `content/library/sources/mutopia-804-clementi-op36-no1/` (Schirmer, 1893). The MIDI is
  published zipped: record the zip's URL and hash, and commit only the movement-1 `.mid` with its own hash, noting
  the extraction in `source.json`.

### Implementation - items (one task per item; run the comparison first, then follow research R10)

- [ ] T038 [US1] `repertoire/advanced/bach-prelude-bwv846` against `mutopia-5`, whole piece.
  - **Edition**: establish it by a visual check of the bar count against the Bach-Gesellschaft Ausgabe vol. 14 scan
    (IMSLP, public domain). Is the Schwencke bar present or absent, 35 or 36 bars? Record it as a `visual` check with
    the URL; the CC0 Open Well-Tempered Clavier PDF is a second witness (research R11 table B, R15).
  - **Result**: 0 differences -> `verified`. Otherwise `replaced` by `pnpm library:convert-ly
    mutopia-5-bach-bwv846 repertoire/advanced/bach-prelude-bwv846 --replace`.
  - **Sidecar**: `provenance` becomes `downloaded` for a conversion. The old "pixel-by-pixel" note is removed.
  - **Record**: `content/library/audit/repertoire/advanced/bach-prelude-bwv846.json`.

  (Depends on T030, T031.)
- [ ] T039 [US1] `repertoire/advanced/chopin-prelude-op28-no4` against `mutopia-468`, whole piece.
  - **Settle**: the disclosed bar 23 bass octave and the bar 9 B3 fix are decided by the comparison, not by
    judgement.
  - **Result**: expected `replaced` (research R11 table C).
  - **Record**: `content/library/audit/repertoire/advanced/chopin-prelude-op28-no4.json`.

  (Depends on T030, T032.)
- [ ] T040 [US1] `repertoire/advanced/chopin-prelude-op28-no20` against `mutopia-472`, whole piece.
  - **Edition note**: the record names the bar 3 reading (E-flat or E natural) as the Peters edition's. It also
    names the bar count from the `.ly`.
  - **Pedal**: if the conversion encodes the pedal as written, remove the "single pedal press" limitation.
  - **Record**: `content/library/audit/repertoire/advanced/chopin-prelude-op28-no20.json`.

  (Depends on T030, T033.)
- [ ] T041 [US1] `repertoire/advanced/satie-gymnopedie-no1` against `mutopia-37`: `replaced` by the complete
  conversion.
  - **Remove** "our own close" from the subtitle and the provenance.
  - **Key**: the description names the key signature (two sharps), not "B minor".
  - **Other fields**: bar count and level follow the probe.
  - **Record**: `content/library/audit/repertoire/advanced/satie-gymnopedie-no1.json`, with `previous`.

  (Depends on T030, T034.)
- [ ] T042 [US1] `repertoire/intermediate/burgmuller-op100-no2` against `mutopia-203`, whole piece: `replaced`
  faithfully, including bar 31's written register.
  - **Level**: follow research R10. If the probe computes Advanced, the item moves to Advanced. Keep it at
    Intermediate as a labelled arrangement (bar 31 an octave higher, with `departures`) **only** if the move would
    break a level minimum (D-3), and then only after US2's `departures` support (T055) exists. Log the choice.
  - **Record**: `content/library/audit/repertoire/intermediate/burgmuller-op100-no2.json`.

  (Depends on T030, T035.)
- [ ] T043 [US1] `repertoire/intermediate/burgmuller-op100-no5` against `mutopia-214`.
  - **Convert** the complete piece. If the probe keeps it at Intermediate, it is `replaced`: `arrangement: false`,
    title without "arranged".
  - **Otherwise** it is `relabelled`: the current arrangement stays, bars 1-11 are compared mechanically (they must
    have 0 differences, or be `fixed` from the source), and `departures` names bars 12-16 as our own close. This
    path depends on T055.
  - **Record**: `content/library/audit/repertoire/intermediate/burgmuller-op100-no5.json`.

  (Depends on T030, T036.)
- [ ] T044 [US1] `repertoire/intermediate/clementi-sonatina-op36-no1-mvt1` against `mutopia-804`: convert the
  exposition (source bars 1-15) -> `replaced`, claim `excerpt`.
  - **Labels**: `arrangement: false`. The title/subtitle names "exposition". The metronome change (source mark
    editorial, file 144) goes in `limitations` and the provenance note, and says that "Spiritoso" is Clementi's
    marking and the metronome mark is the Schirmer editor's (research R15).
  - **Level**: `checkLevel` takes the `arrangement` flag into account, so re-run `pnpm tsx tools/library/probe.ts`
    and `pnpm library:index` **after** changing the flag. The level follows research R10 (analyze A7).
  - **Record**: `content/library/audit/repertoire/intermediate/clementi-sonatina-op36-no1-mvt1.json`.

  (Depends on T030, T037.)
- [ ] T045 [US1] `repertoire/intermediate/schumann-op68-no10` per owner decision D-2.
  - **Remove** (the recommendation):
    - delete the `.musicxml` and `.json`, and regenerate the index;
    - add a Rejected items row to `public/library/README.md`: "only machine-readable source Mutopia 659 is CC
      BY-SA 2.5; notes were derived from it; searched 2026-09-23";
    - write the record `content/library/audit/repertoire/intermediate/schumann-op68-no10.json`, outcome `removed`.
  - **Keep**: follow the owner's instruction exactly, and record the licence reasoning in the record and in
    `research.md`.

  (Depends on T001.)
- [ ] T046 [US1] Re-capture the identity golden for the replaced/removed items only:
  - run `pnpm tsx tools/library/identity.ts` on the pre-engraving converter outputs (the T087 procedure of feature
    005), then on the engraved files;
  - check with `git diff` that no unchanged item's entry moved;
  - update `tests/fixtures/library-identity.json`;
  - name every changed item in the log, with its reason.

  (Depends on T038-T045.)
- [ ] T047 [US1] Planted pitch check on a replaced item (the spec US1 Independent Test): run
  `pnpm library:fidelity --item repertoire/advanced/chopin-prelude-op28-no4 --file <scratch copy with one pitch
  +1>`. It must report exactly one `pitch` difference naming the bar. Log the output. Also look at
  `pnpm screenshot --item repertoire/advanced/satie-gymnopedie-no1 --full` and
  `--item repertoire/intermediate/clementi-sonatina-op36-no1-mvt1`, and describe the PNGs in the log (quickstart
  US1). (Depends on T046.)
- [ ] T048 [US1] Review with `music-domain-expert`: the US1 records' edition decisions (BWV 846 bar count,
  Op. 28 No. 20 bar 3, Clementi tempo wording), their `differenceNotes`, and the new titles and subtitles.
  Summarise the findings in the log. It judges wording and edition choices only; it never replaces a comparison.
  (Depends on T047.)
- [ ] T049 [US1] Level counts after US1: run `pnpm library:index` and count pieces per level. Put any shortfall
  against Beginner 7 / Intermediate 5 / Advanced 5 in the log as "needs owner: level gap" (FR-022, D-3); it is not
  filled. (Depends on T046.)

**Checkpoint**: every non-arrangement repertoire item has a record whose re-run reproduces 0 differences over the
bars it claims, or it is removed with a README row. T047 shows a planted pitch named by bar. Run the full gate
(`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`), write a log entry, and commit.

---

## Phase 4: User Story 2 - Arrangements say what they are, and what they quote is right (Priority: P2)

**Goal**: every arrangement is marked as one, lists its deliberate departures, and its quoted passages match a
named public-domain version of the tune in pitch and order.

**Independent Test** (spec US2): for any arrangement, its record lists which bars quote the original, what they
were compared against, and the result. The sidecar's `departures` names every deliberate departure.

### Tests (write first, confirm they fail)

- T050 moved to Phase 2, "Sidecar `departures` support" (analyze A4).
- [ ] T051 [P] [US2] `tests/library/licence.test.ts`: `arrangement: true` requires a non-empty `departures`, and
  `arrangement: false` forbids it. Confirm it fails on the current shelf; no arrangement has `departures` yet.
- [ ] T052 [P] [US2] Extend `tests/tools/fidelity/compare.test.ts` with `compareMelody` (research R7):
  - highest note per onset of the named staff, ties merged;
  - pitch order must match;
  - rhythm differences count unless the record allows them, and are listed as allowed when it does;
  - `transpose` (for example `-M2`) is applied to letters and alterations;
  - bars outside the declared range are not compared;
  - source staff and voice are selected by `sourceStaff`/`sourceVoice`.

  Confirm it fails.
- [ ] T053 [US2] Extend `tests/tools/fidelity/planted.test.ts`: one melody note changed in a copy of
  `repertoire/beginner/fur-elise-theme-16-bar` gives exactly one `melody` difference naming the bar. Confirm it
  fails. (Depends on T052.)

### Implementation - tooling

- [ ] T054 [US2] `compareMelody` in `tools/library/fidelity/compare.ts`, plus the `transpose`, `sourceStaff` and
  `sourceVoice` alignment fields in `records.ts` (makes T052 and T053 pass).
- T055 moved to Phase 2, "Sidecar `departures` support" (analyze A4).

### Implementation - sources (after D-1; [P])

- [ ] T056 [P] [US2] `content/library/sources/mutopia-1283-new-britain/`. Record which voice carries the tune and
  whether it is the E. O. Excell form (research R15). If it is not, Amazing Grace also needs the Excell hymnal scan
  as a visual check (T062).
- [ ] T057 [P] [US2] `content/library/sources/mutopia-1247-greensleeves-hymntune/`.
- [ ] T058 [P] [US2] `content/library/sources/mutopia-528-ode-to-joy/`.
- [ ] T059 [P] [US2] `content/library/sources/mutopia-2236-mozart-ah-vous-dirai-je/` (the `.ly` files are published
  zipped: record the zip's hash, commit the extracted `.ly` files with their own hashes, and record the theme's
  voice).

### Implementation - items

Each item task:

- adds `departures` to the sidecar, one entry per departure, naming the bars and never calling added material the
  composer's (FR-012);
- runs the melody or mechanical check over the quoted bars;
- fixes a wrong quoted note from the source (outcome `fixed`), or relabels (outcome `relabelled`), or records
  `verified` when nothing changed but the claims;
- writes the record under `content/library/audit/repertoire/...`;
- sets `reviewedBy`/`reviewedOn` from the record.

- [ ] T060 [US2] `repertoire/intermediate/fur-elise-theme` against `mutopia-931`, pickup and bars 1-8. Compare
  mechanically on all note aspects where the item claims Beethoven's notes. The simplifications become
  `departures`: the single-pass ending instead of the repeat, and anything else the comparison shows. If any note
  changes, re-capture `furEliseThemeGrade` in `tests/fixtures/library-identity.json` and log which notes changed
  and why (research R14). (Depends on T054, T055.)
- [ ] T061 [US2] `repertoire/beginner/fur-elise-theme-16-bar` against `mutopia-931`. Melody check over the pickup and
  bar 1, with the declared rhythmic departure. `departures` names:
  - the renotation from 3/8 to 3/4 with doubled values;
  - the quarter-note E5 in bar 1;
  - bars 2-16 as our own continuation;
  - bars 9-16 repeating bars 5-8;
  - the single-bass-note left hand.

  (Depends on T054, T055.)
- [ ] T062 [US2] `repertoire/beginner/amazing-grace` against `mutopia-1283`, melody, with the declared rhythm
  smoothing and the key if transposed. If 1283 is not the Excell form, add a visual check against a named
  public-domain Excell-form hymnal scan (research R11 table B). (Depends on T054-T056.)
- [ ] T063 [US2] `repertoire/beginner/greensleeves` against `mutopia-1247`, melody. Check the raised 6th and 7th
  degrees; the current claim is "natural A-minor throughout". Any wrong melody note is `fixed` from the source.
  `departures` names the 6/8 -> 3/4 renotation and the own bass line. Correct the provenance text where it is wrong.
  (Depends on T054, T055, T057.)
- [ ] T064 [US2] `repertoire/beginner/ode-to-joy`:
  - melody pitch order against `mutopia-528`, with `transpose` from the source key to C;
  - a visual check of the theme's rhythm against the Symphony No. 9 finale scan (Breitkopf Gesamtausgabe, IMSLP,
    public domain; research R11 table B).

  `departures` names the dotted rhythm of bars 4 and 8 made plain, the transposition to C and the own
  accompaniment. (Depends on T054, T055, T058.)
- [ ] T065 [US2] `repertoire/beginner/twinkle-twinkle-little-star` against `mutopia-2236` (the theme voice), melody.
  `departures` names the key, the 12-bar form and the own bass. (Depends on T054, T055, T059.)
- [ ] T066 [US2] `repertoire/beginner/jingle-bells`: a visual melody check against a named pre-1928 public-domain
  printing of the **modern** refrain, not the 1857 chorus (research R11 table B). Find the printing, record its URL
  and the bars compared, and list `departures`. If no public-domain printing of the modern refrain can be found,
  stop and ask the owner. Do not remove the item or leave it unverified without the owner's answer (FR-009,
  FR-011).
- [ ] T067 [US2] `repertoire/beginner/mary-had-a-little-lamb`: a visual melody check against a named 19th-century
  public-domain printing of the "Goodnight, Ladies" / "Merrily We Roll Along" tune (research R15; the E. P. Christy
  1847 attribution is to be verified). `departures` names the key (F major), the 8-bar form and the own bass. If no
  printing is found, stop and ask the owner, as in T066.
- [ ] T068 [US2] Review with `music-domain-expert`: every arrangement's `departures` wording (musician's words, bars
  named, nothing added presented as the composer's) and the chosen tune versions. Summarise the findings in the log.
  (Depends on T060-T067.)

**Checkpoint**: `licence.test.ts` passes: every arrangement has `departures`. Every arrangement has a record with a
melody or mechanical check over its quoted bars. `planted.test.ts` catches the melody mutation. Run the full gate,
write a log entry, and commit.

---

## Phase 5: User Story 3 - Every exercise is theoretically correct (Priority: P2)

**Goal**: all 41 exercises pass an independent theory check, and any error is fixed at its origin.

**Independent Test** (spec US3): the independent check derives the expected chords from each exercise's title and
key, and reports 0 differences on the shelf. A single wrongly spelled chord tone in a copy makes it fail and name
the chord.

### Tests (write first, confirm they fail)

- [ ] T069 [P] [US3] Own-work MusicXML fixtures in `tests/fixtures/musicxml/theory/`:
  - a correct G-sharp minor i-iv-V (V = D#, F##, A#);
  - E-flat minor iv (A-flat, C-flat, E-flat);
  - a first- and a second-inversion tonic;
  - a C major ii-V-I.

  Also write a `README.md` giving their origin (own work, CC0).
- [ ] T070 [US3] `tests/tools/fidelity/theory.test.ts`. The rules of `data-model.md` §5 on the T069 fixtures:
  - scale, root, third and fifth by letter arithmetic, quality by semitones;
  - spelling by `(step, alter)`, never MIDI number alone (C-flat 4 = MIDI 59, B-sharp 3 = MIDI 60);
  - inversion by lowest note per hand;
  - harmonic-minor V;
  - key signature and mode against the claim;
  - `<words>` labels.

  The keys that need care (research R8) are asserted explicitly. Confirm it fails. (Depends on T069.)
- [ ] T071 [US3] `tests/tools/fidelity/exercise-claims.test.ts`:
  - every exercise family on the shelf has a claim;
  - every generated title parses to its claim's key;
  - an ambiguous progression name (for example "turnaround") takes its sequence from the item's own description
    and fails if the description does not state it.

  Confirm it fails.
- [ ] T072 [US3] Extend `tests/tools/fidelity/planted.test.ts`. For each exercise family (triads, each chord-change
  drill shape, the scale-and-chords item), take a temporary copy and apply three mutations, one at a time:
  - one tone respelled to another letter with the same MIDI number (F## -> G);
  - one tone moved a semitone;
  - one inversion swapped.

  Each gives exactly one `TheoryDifference` naming the chord, bar and hand (FR-014, SC-005). Confirm it fails.

### Implementation

- [ ] T073 [US3] `tools/library/fidelity/exercise-claims.ts`: the Roman-numeral sequence per family, written by
  hand from each family's **title** and `trains` text. Never read `content/library/exercises/`. It includes the
  scale claim for `learning/chords/c-major-scale-and-chords` (makes T071 pass). Review the table with
  `music-domain-expert` against the titles and descriptions, and log the summary.
- [ ] T074 [US3] `tools/library/fidelity/theory.ts`: `checkExercise()` per `data-model.md` §5, using only its own
  tables and `readXml` (makes T070 and T072 pass, and T006's independence assertion).
- [ ] T075 [US3] Run the theory check over all 41 exercises. Fix every error at its origin (FR-015), in
  `content/library/exercises/*.json` or `src/core/library/exercise/**`, then run `pnpm library:exercises`,
  `pnpm library:engrave` (a no-op for generated files) and `pnpm library:index`. Review any exercise golden diff
  deliberately and explain it in the log. If there are no errors, log "0 differences in 41 exercises" with the
  command output.
- [ ] T076 [US3] Write 41 records under `content/library/audit/learning/chords/**`: claim `exercise`, one `theory`
  check, outcome `verified` or `fixed`. Set `reviewedBy`/`reviewedOn`:
  - for generated exercises, in each definition's `meta` in `content/library/exercises/*.json`, then regenerate;
  - for the hand-written item, in `public/library/learning/chords/c-major-scale-and-chords.json`.

  A throwaway script that writes the records belongs in scratch space, not the repository. (Depends on T075.)

**Checkpoint**: `pnpm library:fidelity` reports theory 0 for all 41 exercises. `planted.test.ts` catches all three
mutations in every family. Run the full gate, write a log entry, and commit.

---

## Phase 6: User Story 4 - The owner can read one report and trust the shelf (Priority: P3)

**Goal**: one generated report lists every item exactly once with its claim, source, method, result, outcome and
date, plus level counts and gaps.

**Independent Test** (spec US4): every shelf item appears in `docs/library-audit.md` exactly once. Every "verified"
row names a source and a method whose re-run reproduces its result.

### Tests (write first, confirm they fail)

- [ ] T077 [P] [US4] `tests/tools/fidelity/report.test.ts`: `renderReport` on synthetic records gives the layout of
  contract `audit-record.md` §3:
  - rows in shelf order, one per item;
  - "verified (visual)" for a visual-only record;
  - a Removed section;
  - level counts with a "short by N - reported to the owner" row;
  - a Notes section for `differenceNotes` and edition decisions, plus, for each replaced item, the Recents note
    (spec FR-020, contract §3);
  - byte-identical output on two runs.

  Confirm it fails.
- [ ] T078 [US4] Extend `tests/library/fidelity.test.ts`:
  - coverage: the record ids equal the shelf ids plus the removed ids, with nothing missing and nothing extra
    (FR-001, SC-001);
  - outcome/claim consistency: rules 2.3 and 2.4;
  - no sidecar `reviewedBy` names a review without a record (SC-006);
  - `docs/library-audit.md` equals a fresh render (report freshness).

  Confirm it fails.

### Implementation

- [ ] T079 [US4] `tools/library/fidelity/report.ts`: `renderReport` (makes T077 pass).
- [ ] T080 [US4] `tools/library/fidelity/cli.ts`:
  - with no arguments, write `docs/library-audit.md` only when every check reproduces;
  - `--check` compares the report with a fresh render and writes nothing.

  Then generate `docs/library-audit.md` (makes T078 pass).
- [ ] T081 [US4] SC-009 check: time finding three items in the report, one of each kind (an original, an
  arrangement, an exercise); each takes under one minute. Re-run one "verified" row with `--item` and compare its
  difference count with the report. Log both.

**Checkpoint**: `pnpm library:fidelity --check` exits 0. `fidelity.test.ts` enforces coverage, re-runs, the
reviewer rule and freshness. Run the full gate, write a log entry, and commit.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T082 [P] Document `pnpm library:fidelity` and `pnpm library:convert-ly`:
  - `README.md`;
  - `docs/agents/reference.md` R7 and `AGENTS.md` "Seeing the app" (commands, and the `pnpm screenshot --item`
    form without `--`, which is the one that works with this pnpm, per the 005 log). Keep `AGENTS.md` under
    12,000 characters (analyze A12);
  - `public/library/README.md`: an "Audit" section pointing to `content/library/audit/` and
    `docs/library-audit.md`, plus the rule "a replaced item is converted, never hand-fixed".
- [ ] T083 [P] Check `THIRD_PARTY_NOTICES.md` against `content/library/sources/`. Every committed source is listed
  once: under the library list if converted from, or under "Reference sources" if only compared against (contract
  `source-manifest.md` §3, FR-023).
- [ ] T084 [P] Check with `pnpm test -- tests/library/sweep.test.ts` and `tests/core/musicxml/support-doc-sync.test.ts`
  that converted files raise only the notices listed in `expected.notices`. If a converted file uses an element the
  parser does not list as supported, record it in `docs/musicxml-support.md` + `SUPPORT_MATRIX`, or leave the
  element out of the conversion. Never add an unexpected notice to `expected` without explaining it in
  `limitations`.
- [ ] T085 Run `quickstart.md` Manual verification US1-US4 and "App still works". Describe every screenshot looked
  at in the log.
- [ ] T086 Review with `constitution-auditor` of the branch diff. Summarise the findings in the log; CRITICAL/HIGH
  findings block the merge.
- [ ] T087 Full gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`. Also confirm
  `pnpm library:fidelity --check` exits 0, time a full `pnpm library:fidelity` run, and log the time against the
  plan's goal of under 30 s (analyze A8).
- [ ] T088 Final `implementation-log.md` entry: outcomes per item (a count per outcome), level counts, owner-facing
  gaps (FR-022), the resume point "ready to merge when the owner agrees", and a commit.

---

## Dependencies & Execution Order

- **Setup (T001-T005)** comes first.
  - T001, the owner decisions, gates every source download (T023, T031-T037, T056-T059) and T045.
  - T002-T005 do not depend on T001.
- **Foundational (T006-T026, T050, T055, T089-T094)** blocks every story:
  - tests T006-T014 first;
  - then T015 -> T016-T020 -> T021 -> T022;
  - T023 needs T001 + T020;
  - T024 needs T023 and is written before T025;
  - T026 needs T025;
  - T050 -> T055 needs T005 (`departures`, analyze A4);
  - the FR-024 cache lane: T089-T091 -> T092 -> T093 -> T094. It does not block the stories, but it must be done
    before any replaced item is merged (analyze A1).
- **US1 (T027-T049)**:
  - T029 needs T027; T030 needs T018 + T021 + T029;
  - item tasks T038-T044 each need T030 and their source task;
  - T045 needs only T001;
  - T046 needs T038-T045; T047-T049 need T046.
- **US2 (T050-T068)**: can start after Foundational, in parallel with US1 on different files.
  - T050/T055 now sit in Foundational, so US1's fallback paths in T042/T043 have `departures` support.
  - T060 shares `tests/fixtures/library-identity.json` with T046: run them one after the other, never in parallel.
- **US3 (T069-T076)**: independent of US1/US2 (different files) once Foundational is done.
  - T075 may change exercise goldens; nothing else touches them.
- **US4 (T077-T081)**:
  - T077 and T079 can be written any time after Foundational;
  - T078's coverage assertion and T080's report need every record from US1-US3.
- **Polish (T082-T088)** comes after all stories.

## Parallel Opportunities

- **Foundational tests**: T006, T007, T008, T009, T010, T012, T013 and T014 touch different files. T011 follows
  T010.
- **Foundational implementation**: T015 and T020 can go in parallel; T016-T019 can go in parallel after T015.
- **Sources**: T031-T037 and T056-T059 are all `[P]`: different folders, one notices entry each (append in turn).
- **US1 and US3**: they can run in parallel lanes (repertoire files vs exercise files) after Foundational. US2 can
  run as a third lane if it avoids `library-identity.json` at the same time as US1 (see above).
- **Story tests**: T027 + T028, T051 + T052, and T069 + T077 can be written together.
- **FR-024 cache lane**: T089, T090 and T091 can be written together, in parallel with the fidelity tooling.
- **Polish**: T082, T083 and T084 can go in parallel.

## Suggested MVP

Phase 1, Phase 2 and **US1**: every piece that says it is the original is either proven identical to a named
public-domain edition, replaced by a conversion, or removed. That closes the failure that already happened (Für
Elise) for the rest of the shelf. US2 and US3 then cover arrangements and exercises, and US4 adds the report.
