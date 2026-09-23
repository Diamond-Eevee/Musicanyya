# Implementation log: 007-library-fidelity-audit

## 2026-09-23 - claude-opus-5.5 (plan)
- Done: `/speckit.plan`. Wrote `plan.md`, `research.md` (R1-R15), `data-model.md`, `contracts/`
  (`source-manifest.md`, `audit-record.md`, `fidelity-tools.md`, `library-index-1.1.md`), `quickstart.md`. Updated
  Active Technologies and Recent Changes in `docs/agents/reference.md`.
- Decisions:
  - Each source is read two independent ways: LilyPond's own MIDI, and our own `.ly` reader. The item is compared
    with the `.ly` reading, and the `.ly` reading with the MIDI.
  - Comparisons use exact rationals with no tolerances.
  - Sources are committed unchanged and hash-pinned under `content/library/sources/`.
  - The LilyPond reader and converter and the MIDI reader are our own code, so no new dependency is added.
  - The theory check is kept independent of the exercise generator, and an architecture test enforces this.
  - Differing items follow the replace-first rule (R10).
- Problems / open questions:
  - **needs owner: D-1**: approve the 12 Mutopia public-domain sources in research R11 table A.
  - **needs owner: D-2**: Schumann Op. 68 No. 10. Its only machine-readable source, Mutopia 659, is **CC BY-SA
    2.5**, and the item's notes were extracted from it. I recommend removing it.
  - **needs owner: D-3**: accept that any level shortfall is reported, not filled.
  - **needs owner: D-4**: showing `departures` in the app is a later UI feature.
  - Phase 0 found problems that were not disclosed:
    - Satie bars 33-37 are invented, yet the item is marked `arrangement: false`.
    - Burgmüller No. 2 bar 31 has an octave change, yet the item is marked `arrangement: false`.
    - Bach BWV 846 was "verified" from one bar only.
    - Greensleeves claims natural minor, but the familiar tune raises the 6th and 7th.
  - Jingle Bells (modern refrain) and Mary Had a Little Lamb have no machine-readable PD source. They need a named
    PD printing (R11 table B).
- Reviews: I used `music-domain-expert` for the comparison semantics, editions, folk-tune versions and theory
  rules. Its findings are in research R5, R8, R11 and R15; the claims it did not check are marked "to verify". I did
  not run a constitution audit at plan stage; I did the Constitution Check in `plan.md` myself.
- Handoff: next = `/speckit.tasks`, then ask D-1 to D-4 at the start of implement. No code was changed.

## 2026-09-23 - claude-opus-5.5 (analyze)
- Analyze: 12 findings (CRITICAL 0, HIGH 1, MEDIUM 6, LOW 5); tasks.md as of 1a239e9. Requirement coverage 32/32.
- Top recommendations:
  - **A1 (HIGH)**: `src/engine/library/http-catalog.ts` serves `index.json` and every item file cache-first under a
    fixed cache name (`musicanyya-library-v1`), with no hash check. A returning user never receives a corrected
    item; this already affects the Für Elise fix on `main`. Add a task, and decide whether it needs a spec
    requirement (a cache-name bump or a hash-keyed cache; engine only, no UI).
  - **A2 (MEDIUM)**: Recents keep the old bytes by content hash. FR-020's "recent scores keep working" is true
    only for the old copy, so the spec wording should say so.
  - **A3 (MEDIUM)**: add a procedure for the edge case where the source itself is wrong (second source, majority).
  - **A4 (MEDIUM)**: move T055 (`departures` support) into Foundational, because US1's fallbacks in T042/T043 depend
    on it.
- Handoff: fix A1 (and optionally A2-A4) with the owner's OK, then `/speckit.implement` starting at T001.

## 2026-09-23 - claude-opus-5.5 (analyze remediation)
- Done: the owner said "resolve with recommended". All analyze findings are applied except A9 and A11, which were
  judged acceptable as they stand.
  - **A1**:
    - spec: FR-024, SC-010, an edge case and a Clarifications entry;
    - design: research R16, contract `library-port-1.1.md`, and the plan (Technical Context, Constitution V,
      structure);
    - tasks: T089-T094, the cache lane in Phase 2.
  - **A2**: FR-020 reworded; a Clarifications entry; a Recents follow-up in the plan's Open questions; a Recents note
    per replaced item in the report (contract `audit-record.md` §3, T077).
  - **A3**: a "source itself looks wrong" rule in the tasks' content rules.
  - **A4**: T050/T055 moved into Foundational.
  - **A5**: `buildTimeline` for played order in T009/T017.
  - **A6**: a `midiArticulate` manifest field; research R5 rule 5; T012/T013 cases; a planted duration error for the
    first articulated source.
  - **A7**: T044 re-probes after the flag change.
  - **A8**: T087 times the run.
  - **A10**: T025 log note.
  - **A12**: T082 also fixes the `AGENTS.md` screenshot form.
- Decisions: FR-024 uses network-first for the index and a hash-checked item cache, not a cache-name bump
  (research R16). The cache name stays, so valid offline copies survive.
- Problems / open questions: owner decisions D-1 to D-4 are still open (T001). Recents keeping the old copy is a
  follow-up feature, not part of 007.
- Handoff: next = `/speckit.implement` from T001. tasks.md now has 94 tasks.

## 2026-09-23 - claude-opus-5.5 (owner decisions)
- Done: T001. The owner answered "yes to D-1 to D-4". All four recommendations are accepted and recorded in
  `plan.md` under "Owner decisions -> Answers":
  - D-1: the 12 Mutopia sources are approved (`approvedByOwner` 2026-09-23);
  - D-2: Schumann Op. 68 No. 10 is removed;
  - D-3: level gaps are reported, not filled;
  - D-4: showing `departures` in the app is a follow-up.
- Handoff: next = T002 (package.json scripts), then the Phase 2 tests. No open owner decisions remain.

## 2026-09-23 - antigravity-1.0 (implement)
- Done: T015, T016, T017. Tools for time, midi, and from-musicxml are implemented.
- In progress: T018 [~], T019 [~]. For T018, the LilyPond parser compiles and passes lint/typecheck, and several tests pass (relative pitches, chords, ties, volta repeats, partial bars, transpose), but several remain (absolute pitches off by octave, tuplets timing, unfoldRepeats count, variables). I am leaving it as a partial compiling state per the spec instructions.
- Problems / open questions: T018 needs more parser debugging to fully implement LilyPond semantics (tuplets, grace notes, unfold repeats).
- Handoff: next = Finish T018, T019. The tree is clean, typecheck and lint pass. Run `pnpm vitest run tests/tools/lilypond/read.test.ts` to see the remaining parser errors.
