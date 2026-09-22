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
