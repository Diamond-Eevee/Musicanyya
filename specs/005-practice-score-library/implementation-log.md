# Implementation Log: Practice Score Library

Feature `005-practice-score-library`. Newest entry at the bottom.

## 2026-09-22 - claude-opus-5 (/speckit.specify)

- Done: created branch `005-practice-score-library`, wrote `spec.md` (5 user stories, FR-001..FR-026,
  SC-001..SC-010) and `checklists/requirements.md` (PASS, 1 validation pass, 1 fix).
- In progress: none.
- Decisions:
  - Two top-level sections, *Learning* and *Repertoire*, with the owner's three levels
    (Beginner / Intermediate / Advanced) under *Repertoire*, and *Learning > Chords* holding both
    per-key exercises and chord-change drills - the structure the owner sketched, named in the spec
    as sections rather than paths.
  - Level names are not enough: FR-009 requires each level to publish objective criteria (range,
    hands, shortest note value, tempo, accidentals, length) and every item to satisfy them, so the
    levels can be checked rather than argued about.
  - Consistency across keys is a requirement (FR-005), not an implementation note: all exercises in
    a family share measure count, chord positions, rhythm and fingering convention.
  - The library doubles as a real-world regression corpus (US5), which is the second reason the
    owner wanted real exports - see the `practice-material-sourcing` note behind
    `Fur_Elise_Easy_Piano.mxl` exposing the depth-guard bug.
  - Licence sources were researched but **not chosen**: AGENTS.md section 7 makes that the owner's
    call, so the accepted-source list is an Assumption and the licence set is the FR-017 marker.
- Owner decisions (asked and answered in this session, 2026-09-22):
  - Licences: **CC0, clear public domain, or written for this project only**. CC BY, share-alike
    and non-commercial material is excluded from the bundled library - FR-017 and Out of Scope.
  - First-release scope: **the in-app library browser is included** (a folder-only drop would be
    invisible in the browser Shell, which is the primary track) - FR-011.
- Problems / open questions: none open. Both markers were folded into the spec; no
  `[NEEDS CLARIFICATION]` remains.
- Handoff: next = `/speckit.plan`. Tree clean on `005-practice-score-library`; nothing outside
  `specs/005-practice-score-library/` was touched.

## 2026-09-22 - claude-opus-5 (/speckit.plan)

- Done: `plan.md`, `research.md` (R-1..R-10), `data-model.md`, three contracts
  (`library-index.md`, `library-port.md`, `exercise-definition.md`), `quickstart.md`, and the
  Active Technologies / Recent Changes blocks of `docs/agents/reference.md`. Constitution Check:
  PASS on all eight principles before and after design; Complexity Tracking carries no violation and
  no new runtime dependency.
- In progress: none.
- Decisions:
  - **Sourcing (R-1)**: there is no fetchable CC0 solo-piano corpus. OpenScore is CC0 and verifiable
    but holds only Lieder and string quartets; `musetrainer/library` has no LICENSE file, no
    per-score provenance and demonstrably contains copyrighted arrangements (it is also where the
    owner's `Fur_Elise_Easy_Piano.mxl` came from); PDMX ships 250k scores with a self-reported 12.29%
    licence-metadata conflict and no per-score download; `eduardomourar/music-scores-musicxml` is
    CC-BY-SA; the Humdrum piano corpora carry no licence at all. The shelf is therefore content we
    author, with OpenScore where it fits and owner-verified files as a bonus.
  - **Generation over hand-authoring (R-7)**: FR-005 makes cross-key consistency a requirement, so
    the 24 key exercises and the drills come from one definition per family plus a minimal MusicXML
    writer in the core, with golden snapshots and a write -> read -> build round-trip test.
  - **Content under `public/library/` (R-2)**, described by a generated `index.json` that the tests
    regenerate and compare - the only version of FR-025 that cannot rot.
  - **The library reuses `session.loadBytes` (R-5)**, which makes FR-013 true by construction, and
    lives in the existing Scores panel (R-10), inheriting feature 004's popover and run rules.
  - Level criteria (28 checkable thresholds, nested caps) and the content plan came from the
    `music-domain-expert` role. Two of its findings were checked against the code: `<harmony>` really
    does produce an `unsupportedElement` notice (so authored files label chords with
    `<direction><words>`), but its `<octave-shift>` "playback is an octave wrong" claim is **wrong** -
    MusicXML `<pitch>` is the sounding pitch, so ignoring the shift is correct. Recorded as
    corrections A and B in `data-model.md` SS4 rather than silently dropped.
  - Measuring chord-change gaps (the expert's proposed new Practice constants) is **out of scope**
    for this feature; noted as a follow-up.
- Problems / open questions: none open. D-1..D-3 were put to the owner in the same session and all
  answered as recommended: the repertoire is engraved for this project with owner-verified CC0 files
  welcome on top (FR-008's counts are the finished-feature target, not P1); FR-014/SC-010 narrowed to
  content already fetched, since there is no service worker; and
  `musicxml/chords/c-major-scale-and-chords.musicxml` moves into the library with a pointer left
  behind. `spec.md` carries all three.
- Handoff: next = `/speckit.tasks`. Tree clean on `005-practice-score-library`.

## 2026-09-22 - claude-opus-5 (/speckit.tasks)

- Done: generated `tasks.md` - 82 tasks in 8 phases (Setup 4, Foundational 8, US1 19, US2 13,
  US3 22, US4 4, US5 5, Polish 7) from `plan.md`, `spec.md`, `data-model.md` and the three contracts.
- In progress: none.
- Decisions:
  - **No RT review task anywhere**, stated explicitly at the top of `tasks.md`: this feature edits no
    AudioWorklet, scheduler, metronome or MIDI-timing code (plan "Real-time Paths Touched: none"),
    with an instruction to stop and add one if that turns out to be wrong.
  - **US1 carries a content seed** (T025-T029: the moved chords exercise plus one piece per
    repertoire level, including the Für Elise arrangement). Browsing machinery with an empty shelf
    would not satisfy the story's own Independent Test, and a section with no items is not emitted.
  - **Every authored score is followed by a `music-domain-expert` review task** (T029, T043, T056,
    T060, T065) before its sidecar records `reviewedBy`/`reviewedOn` - the level check is arithmetic
    and cannot hear a wrong note (data-model SS4.1).
  - The repertoire build-out (FR-008) sits in **US3**, not in a content phase of its own: the level
    criteria are what place a piece, so the pieces arrive with the checker that files them.
  - T064 keeps Chopin Op. 9 no. 2 conditional: it ships only if its 11:8 / 22:12 tuplets divide
    `<divisions>` evenly, otherwise it is dropped with the reason recorded.
  - Suggested lanes if the owner ever parallelises: *machinery* (US1 + US3 code) against *content*
    (US2 definitions + US3 repertoire) - disjoint files except `index.json`.
- Problems / open questions: none open.
- Handoff: next = `/speckit.analyze`, then `/speckit.implement` (MVP = US1, T001-T031). Tree clean on
  `005-practice-score-library`.

## 2026-09-22 - claude-opus-5 (/speckit.analyze)

- Analyze: 16 findings (CRITICAL 0, HIGH 1, MEDIUM 6, LOW 9); `tasks.md` as of f43c10a. Coverage
  34/36 requirements (94%); no unmapped tasks; no constitution MUST violated.
- Top recommendations, in order:
  1. **A1 (HIGH)**: `vitest.config.ts` uses explicit per-project include globs and has no project for
     `tests/library/**` or `tests/app/**`, so T016, T017, T067 and T071 - the suites carrying
     FR-017/020/022/023/025 - would never run. Add a `library` project (node) in Phase 1 and move
     T016 to `tests/engine/`, where the session tests already live.
  2. **A2 (MEDIUM)**: nothing asserts FR-005's family invariant across all 24 keys; T035 only
     snapshots four and checks determinism.
  3. **A4 (MEDIUM)**: SC-005 was not amended with owner decision D-1 while FR-008 was, so SC-005
     reads as failed at MVP.
  4. **A7 (MEDIUM)**: the FR-026/SC-008 size budget is only a manual Polish check; assert the byte
     total in the library suite.
  5. **A3 (MEDIUM)**: the 28 level thresholds sit in `src/core/library/levels.ts`, while the project
     records its constants table as `src/core/defaults.ts` / `src/engine/config.ts`.
- Nothing was changed: analyze is read-only apart from this entry.
- Handoff: next = apply the findings (owner's call), then `/speckit.implement` (MVP = US1,
  T001-T031). Tree clean on `005-practice-score-library`.

## 2026-09-22 - claude-opus-5 (analyze remediation)

- Done: applied **all 16** analyze findings in one pass (the owner answered "recommended").
  - `tasks.md`: four new tasks, keeping new numbers rather than renumbering - **T083** a `library`
    project in `vitest.config.ts` (A1, the HIGH one), **T084** the FR-016 extensibility test,
    **T085** the FR-005 family-invariant test across all 24 keys, **T086** an architecture guard so
    no app/ui/engine/worker file imports the dev-only generation code. T016 moved from
    `tests/app/` to `tests/engine/`, beside the session tests that already live there. T003, T031,
    T044, T048, T066, T067, T078 and T082 absorbed the smaller findings (rejected-items home,
    SC-001 timing and the offline reopen in e2e, exercise counts, `LEVEL_*` constants in
    `src/core/defaults.ts`, composer/key spread, arrangement label + silent-file + size-budget
    assertions, and SC-006's blind re-levelling sample). 82 -> **86 tasks**.
  - `spec.md`: SC-005 gained decision D-1's caveat (it read as failed at MVP); FR-021 defines
    "silent" measurably; FR-025 now references the rules it enforces instead of restating them.
  - `data-model.md`: the `LEVEL_*` thresholds move to `src/core/defaults.ts` (AGENTS.md SS6 names it
    as the constants table); two validation rows added (silent item, shelf size budget).
  - `contracts/library-index.md` SS4: the extra assertions written down - counts, shelf size, not
    silent, labelled arrangements, content-only extensibility - plus the note that `tests/library/`
    needs its own vitest project.
  - `plan.md`, `quickstart.md`, `checklists/requirements.md` updated to match.
- In progress: none. No task is claimed; nothing under `src/` was touched.
- Decisions: the HIGH finding was real - `vitest.config.ts` filters by explicit include globs, so
  `tests/library/**` and `tests/app/**` matched no project. Four suites carrying FR-017, FR-020,
  FR-022, FR-023 and FR-025 would have "passed" by never running, which is exactly the failure mode
  US4 and US5 exist to prevent.
- Handoff: next = `/speckit.implement` (MVP = US1: T001-T004, T083, T005-T031, T084). Tree clean on
  `005-practice-score-library`.

## 2026-09-22 - claude-opus-5 (/speckit.implement: Setup + Foundational)

- Done: T001-T004, T083 (Setup: scripts, shelf skeleton, README, section table, the `library` vitest
  project) and T005-T012 (Foundational: `src/core/library/types.ts` and `index-model.ts` with its
  test, `src/core/library/facts.ts` and its test against five real fixtures, the `LibraryCatalog` port
  in `src/engine/ports.ts`, `tests/fakes/fake-library-catalog.ts`, library strings in `src/ui/i18n/en.ts`).
- In progress: none. Full suite green (134 files, 1112 tests), `pnpm typecheck` and `pnpm lint` clean.
- Decisions:
  - **R-11 (research.md)**: `src/core/score/model.ts` carries no key signature - `build.ts` reads
    `<key>` only to avoid an `unsupportedElement` notice and discards it, since key signature does not
    affect playback timing (Principle II). `facts.ts` therefore also takes the parsed `XmlDocument`
    and reads `<key>`, `<time-modification>`, `<octave-shift>` and `<pedal>` directly - the one place
    `core/library` touches XML instead of the `Score` model - rather than widening `Score` for a type
    four already-shipped features depend on. `XmlDocument` (`@rgrove/parse-xml`) is a data structure,
    not a browser DOM, so this stays inside Principle V.
  - Added two facts fields beyond the v1.0.0 contract's required set (`voicesPerStaff`,
    `handIndependenceFraction`, criteria 3-4 of data-model SS4) - allowed as a MINOR addition since the
    contract's `facts` schema has no `additionalProperties: false`.
  - `MAX_FILE_BYTES` moved from `src/engine/config.ts` to `src/core/defaults.ts` (re-exported from
    `config.ts` unchanged for existing callers), following the project's established pattern for a
    constant both a core module and an engine module need (see `POSITION_REPORT_BLOCKS` in the same
    file) - `src/core/library/index-model.ts` needed it and core cannot import engine.
- Problems / open questions: none open.
- Handoff: next = US1 (Phase 3, T013 onward) toward the MVP checkpoint (T001-T004, T083, T005-T031,
  T084). Tree clean on `005-practice-score-library` after this commit.

## 2026-09-22 - claude-opus-5 (/speckit.implement: US1 checkpoint - MVP)

- Done: T013-T024, T025-T030 (content seed), T031, T084 - the whole US1 scope
  (T001-T004, T083, T005-T031, T084, 25 tasks). **US1 checkpoint reached**: a fresh profile can browse
  *Score > Scores*, open *Repertoire > Intermediate > Für Elise* and hear it via Listen, in both
  Shells, with its provenance on screen. Independent Test passed via `tests/e2e/library.spec.ts`.
- In progress: none.
- Content: moved the existing chords exercise into the library (owner decision D-3) and authored three
  repertoire pieces with the `music-domain-expert` agent (Für Elise theme, Ode to Joy, Chopin Prelude
  Op. 28 No. 4 complete), each independently reviewed by a second `music-domain-expert` pass - see the
  prior log entry's sibling commit for the detailed bug list that review surfaced (measure-numbering,
  `facts.ts` grace-note bug, a missing `<mode>minor</mode>`).
- Decisions / bugs found while making the e2e test pass (Constitution IV: an e2e test earns its keep
  by finding real bugs, not just confirming what unit tests already showed):
  - **`session.ts` never closed the *Scores* panel on a successful `openlibraryitem`** - data-model.md
    SS6 requires it (`openingItem` is the only state that can end with the panel closing, and only on
    success). Fixed with one `viewState.closePanel()` call in `Session.openLibraryItem`.
  - **All three authored MusicXML files had a leading `<!-- -->` comment** between `<?xml ...?>` and
    `<score-partwise>`. The app's own `readXml`/`buildScore` tolerate it (it round-trips through
    `@rgrove/parse-xml` fine), but Verovio's separate format-sniffing does not ("Trying to load unknown
    XML data which cannot be identified") - a gap no unit test could have caught, since nothing in the
    Vitest suite renders through the real Verovio worker end-to-end the way this e2e test does. Removed
    the leading comments (the provenance they held was already duplicated in each sidecar's
    `provenance.note`/`basedOn`; the two Mutopia typesetters' names were folded into the sidecars
    first, so nothing was lost) - regenerated `index.json` afterward.
  - The e2e test itself needed one real stabilisation fix, not a hack: reopening the *Scores* panel
    immediately after pressing Escape to stop a Listen run raced the stop transition (the menu button
    flickered visible/not-visible under Playwright's retry loop); waiting for `g.note.playing` to
    actually disappear before the next menu click fixed it cleanly.
  - WebKit (Playwright's build, not real Safari) has no AudioContext at all, same limitation every
    other run-needing e2e spec in this suite already documents and skips around - `library.spec.ts`
    smoke-checks the transport is enabled there instead of asserting a run starts.
- Full quality gate: `pnpm lint`, `pnpm typecheck`, `pnpm test` (141 files, 1144 tests) all green;
  `pnpm test:e2e` - `tests/e2e/library.spec.ts` green on all four projects (chromium, firefox, webkit,
  electron), and the full e2e suite green on chromium (80 passed, 4 skipped by design) as a broader
  regression check on the shared `session.ts` changes. Firefox/webkit/electron were not re-run for the
  *entire* suite (time budget for this session); nothing outside `library.spec.ts` and `session.ts`
  changed, so this is judged sufficient, but a full four-project run is worth doing before the feature
  branch merges.
- Problems / open questions: none open.
- Handoff: next = US2 (Phase 4, T032 onward) - the 24-key chord exercises and chord-change drills.
  Tree clean on `005-practice-score-library` after this commit.

## 2026-09-22 - claude-sonnet-5 (/speckit.continue: US2 checkpoint)

- Done: T032-T044, T085, T086 - the whole US2 scope (15 tasks). **US2 checkpoint reached**: the
  Chords shelf now has 24 per-key triad exercises and 16 chord-change drills (13 definition files),
  all generated code, all reviewed. Index grew from 4 to 44 items.
  - `src/core/musicxml/write.ts` (T036): the minimal MusicXML writer, contracts/exercise-definition.md
    §2 - never `<harmony>`, deterministic, no comment before the root element (avoids T031's Verovio
    bug by construction).
  - `src/core/library/exercise/` (T037): `degrees.ts` (roman-numeral degree -> spelled chord tones
    under a key signature, by letter-stacking + shortest-signed-distance accidentals, not a lookup
    table - correctly produces G# minor's V as D#-F##-A# and never a double flat across the whole key
    set), `voicing.ts` (the `[57, 68]` register-anchor rule, close-position ascending placement, and
    the MusicXML octave-vs-sounding-pitch fix below), `fingering.ts` (the fixed 1-3-5/5-3-1 /
    1-2-5/5-3-1 / 1-3-5/5-2-1 table), `range-guard.ts` (88-key bound), `generate.ts`
    (`generateTriadFamily`, `generateChangeFamily`).
  - `content/library/exercises/`: `triads-major.json` + `triads-minor.json` (T038, split by mode -
    research.md R-12 decision 1) and 13 `changes-*.json` files covering all 16 drills (T041 - research
    R-12 decision 2 records the written-measure-count deviation from data-model.md §5.2's illustrative
    numbers).
  - `tools/library/build-exercises.ts` (T039): reads every definition, writes the `.musicxml`/`.json`
    pairs, refuses to touch a `downloaded` item.
  - `tests/architecture/layers.test.ts` (T086): no `src/app`/`ui`/`engine`/`workers` file may import
    the dev-only writer or exercise generator.
  - `tests/library/index.test.ts` gained the US2 block (T044): every exercise has
    `fingeringCoverage == 1` and no notices; >= 24 chord exercises and >= 12 drills.
- In progress: none.
- Bugs found and fixed while making the generator round-trip and read correctly (Constitution IV):
  - **MusicXML octave vs. sounding pitch** (`voicing.ts`): a spelled tone's `<octave>` is the natural
    letter's octave, not the sounding one - `getMidiKey` in `src/core/pitch.ts` computes
    `(octave + 1) * 12 + step + alter` *without* wrapping, so B# needs `octave` one lower than its
    wrapped pitch class would suggest, or it sounds a semitone too high. Silently wrote B#4 where B#3
    sounds the same C as the rest of the chord - found by
    `tests/core/library/exercise/family-invariants.test.ts` failing only on C# minor and Eb minor
    (the two keys in the 24-key set whose harmonic-minor V third lands on a letter the alteration
    pushes out of its natural 0-11 range). Fixed with `rawOffset()` (the unwrapped natural-pc-plus-
    alter value) driving the octave arithmetic, while the wrapped pitch class still drives which MIDI
    candidate to search for.
  - **A `<forward>` element for a written rest** (`generate.ts`, chord-change drills): the drill's
    written quarter rest needs to render, so it has to be an explicit `<note><rest/></note>`, not a
    `<forward>` (which hides the time advance rather than notating it).
  - **A broken tie** (`generate.ts`, chord-change drills' section B): tying a common tone into the
    next chord across a barline needs the tie-start on the *last* note before the boundary; writing
    the joined chord as two tied half notes put tie-start on the first half instead, leaving nothing
    to close it. Fixed by writing section B as one whole note per chord (the two halves were always
    identical pitches anyway), so there is only ever one "last note" per measure. Found by
    `facts.ts`'s `brokenTie` notice on the first `pnpm library:index` run over the generated set.
  - **A fixed-anchor octave leap** (found by `music-domain-expert` review, T043): voicing every
    chord-change cycle chord independently nearest the exercise's fixed register anchor produced a
    backward octave leap in the middle of drill 14's 8-chord diatonic ladder, undercutting the one
    thing that drill claims to train. Fixed by chaining: chord 2 onward in a `changes` cycle voices
    nearest the *previous* chord's bass (research.md R-12); the triads family's fixed-anchor voicing
    was left as designed (reviewer judged it correct for a short I-IV-V-I phrase).
- Decisions: research.md R-12 records both deviations from data-model.md's illustrative content-plan
  numbers (two `triads-*.json` files instead of one; the `changes` family's actual written-measure
  count) and why neither affects any FR/SC.
- `music-domain-expert` review (T043): **PASS** on both families (spelling across the full circle of
  fifths including G# minor and Eb minor, the fixed fingering table, LH-an-octave-below-RH); one
  non-blocking finding (above), fixed and re-verified.
- Full quality gate: `pnpm lint` (0 errors - the generated `.json` sidecars needed one
  `biome check --write public/library/ content/library/` pass after generation, since only
  `index.json` itself is excluded from formatting), `pnpm typecheck`, `pnpm test` (147 files, 1221
  tests) all green; `pnpm test:e2e` - `tests/e2e/library.spec.ts` green (44-item index, no
  regression), full chromium suite green (80 passed, 4 skipped by design, matching the prior
  checkpoint's baseline).
- Problems / open questions: none open.
- Handoff: next = US3 (Phase 5, T045 onward) - level criteria, filters, and the repertoire build-out
  (FR-008: >= 6/5/4 pieces per level). Tree clean on `005-practice-score-library` after this commit.
