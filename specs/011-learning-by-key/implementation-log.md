# Implementation Log: Learning by key

## 2026-09-26 - claude-opus-5-5 (analyze)
- Analyze: 16 findings (CRITICAL 0, HIGH 4, MEDIUM 4, LOW 8); tasks.md as of 1e0f28b; coverage 23/23 FR, 7/7 SC after
  remediation (FR-023 and US3 scenario 3 were uncovered before).
- Owner: "answer with recommended" - applied in 32e91f1: A1 songs name their source (library-port 1.2 §4a, T084-T085);
  A2 song levels vs beginner caps (Wenceslas -> G major, Silent Night intermediate, level-check before commit, stop if
  fewer than 6 beginner songs); A3 `raisedBecause` for steps computing below their name; A4 T011 keeps reviewed
  repertoire levels with `raisedBecause` when B1 lowers the computed level; A5 unique song `stepOrder`, songs outside the
  step-order check; A6 key-change Intermediate q=80, 9 bars; A7 Electron shelf check (T088); A8 minor scale form named;
  A9-A16 wording, test-first splits (T086, T087), paths, moved audit records, shelf counts.
- Handoff: next = `/speckit.implement` from T001; tasks.md now T001-T088 (88 tasks); T083 needs the owner.

## 2026-09-26 - claude-sonnet-5 (implement: Setup and Foundational)
- Done: T001-T002 (Setup), T003-T015 and T086 (Foundational). Tests first: T003-T007 and T086 were run and failed for the
  expected reasons (no `introduction` level, missing `chordChangesPerBar`, missing modules, old hand-independence rule)
  before T008-T015 were written.
- T001: the four change requests are folded into `specs/005-.../contracts/{library-index,library-port,exercise-definition}.md`
  and `specs/007-.../contracts/audit-record.md` (now 1.2.0), `fidelity-tools.md` at 1.10.0 (its `checkSongChords`
  signature is added with T062). The 011 files stay as history.
- T002 (fingering source): Franklin Taylor, *Scales and Arpeggios for the Pianoforte* (Novello, c. 1900; Internet Archive
  `scalesarpeggiosf00tayluoft`, page images read by eye, pp. 4-10). Result recorded in research R6 "fingering source" and
  data-model §6: 17 rows confirmed, **RH corrected** for Ab major, Eb major, Bb major, F# minor, C# minor, G# minor and
  Eb minor (the book starts them one finger lower than the draft), the two "verify" rows resolved, and three melodic minor
  overrides (F# minor RH, C# minor RH, Bb minor LH). Descending = reverse; spot-checked on printed groups, not every key.
- Decisions:
  - **Introduction caps nested**: tempo 50-72 (data-model said 40-72) and bars 8-16 (said 4-16), because T003 requires every
    Introduction cap within Beginner's and Beginner's tempo minimum is 50 / bar minimum is 8. Data-model tables (011 and 005)
    updated. The bar minimum never applies to exercises.
  - **Introduction is a sub-tier of Beginner** in `checkLevel`: an item assigned Beginner or higher whose facts also fit the
    Introduction caps is not treated as "raised" (no `raisedBecause` for being simpler than Introduction).
  - **B5 needs a new fact** `minorScaleAccidentalCount` (accidentals on degree 6 or 7 of the relative minor of a key signature in
    the score, raised or natural); `facts.keys` alone cannot tell, because the generator writes no `<mode>` for the old chord
    families. `levels.ts` applies it only to exercises whose `facts.keys` contain a minor key. Contracts updated.
  - `buildLibraryIndex(root, notices, sections)` takes the declared sections as a third argument (default: the shelf's), so the
    T086 tests can use a temporary tree; the index now lists ancestor sections of used ones (readers build the tree from
    `parent` + `order`).
  - `LEVEL_MINIMUMS` in the audit report keeps three levels (Introduction holds exercises only).
- T011 re-levelling: hand-independence (B1) and every other criterion were re-run over the whole shelf, old committed facts
  vs new facts under the same thresholds: **no item's computed level changed** (0 of 57 compared), so no repertoire item
  needed `raisedBecause` and none was re-levelled. `public/library/index.json` regenerated (new facts, ancestor sections).
- Evidence: `pnpm test` -> `Test Files 213 passed (213)`, `Tests 2720 passed (2720)`; `pnpm typecheck` exit 0; `pnpm lint`
  exit 0 (`Found 282 warnings`, same count as before this work; 0 errors).
- Handoff: next = T016 -> T024 (US1 tests), then T025-T039; run `pnpm test -- tests/core/library tests/library` first.
