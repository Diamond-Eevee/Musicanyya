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
