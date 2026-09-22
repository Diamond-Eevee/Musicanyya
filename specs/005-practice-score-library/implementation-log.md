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
- Problems / open questions: three decisions for the owner, all with a recommendation, listed at the
  end of `plan.md` (authored repertoire vs supplied files and what that means for FR-008's counts;
  narrowing FR-014/SC-010 because the project has no service worker; moving
  `musicxml/chords/c-major-scale-and-chords.musicxml` into the library).
- Handoff: next = answer D-1..D-3, then `/speckit.tasks`. Tree clean on `005-practice-score-library`.
