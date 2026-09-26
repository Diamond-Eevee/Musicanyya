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

## 2026-09-26 - claude-sonnet-5 (implement: US1 checkpoint)
- Done: T016-T039 and T087 (User Story 1): the four generated steps in all 24 keys, the Learning > Keys tree, the C major extras,
  the successor table, the audit records, the tree panel. T024 (e2e) is ticked after the full e2e run below.
- Tests first: T016-T024 and T087 were written and run red before T025-T039 (scales, pattern generator, step shape, goldens, theory
  v2, tree, panel, shelf, successors). Each went green with its implementation task.
- **Owner decision asked and answered during implementation (D-2 B8)**: criterion 17 (leap) fails every generated step where the
  hands swap (right hand C4 -> chord topped G5 = 19 semitones; the chords cannot sit lower without colliding with the left-hand
  scale on the same keys). The owner chose "exempt exercises up to 19 at Introduction and Beginner"
  (`LEVEL_EXERCISE_MAX_LEAP_SEMITONES`); recorded in research R4 and the 005 data-model. Rejected: scales starting at the top;
  computing leaps per section.
- Decisions:
  - **Register rule changed** from "nearest to the previous chord" (drifts upward through I-I6-I64) to a fixed window: a chord's bass
    is the unique pitch of its pitch class in [anchor-7, anchor+4], anchor = the tonic chord's root (T-12 left, T+12 right)
    (`bassInWindow`). Roots IV/V land below I as before; data-model §5 updated.
  - `PatternChord.minor` override (I -> i, ii -> iv ...) so one definition serves both modes; scale `form` is harmonic|melodic
    (a major key ignores it); `{scale}` in a section label names the form ("harmonic minor scale").
  - `raisedBecause` exactly where the criteria compute a lower level than the step: Advanced computes Intermediate (eighths,
    root-fifth) and carries it; Introduction, Beginner and Intermediate compute their own level (Beginner also computes Introduction,
    which the clamp of `checkLevel` accepts), so they carry none. The Intermediate span (43) already needs Intermediate.
  - The step/level pairing rule of library-index 1.2 applies to main items (stepOrder 0); an extra keeps its own level (the C major
    Advanced extras are Beginner/Intermediate drills).
  - The eight retired `chords`-form definitions and the two triads definitions moved to `tests/fixtures/exercises/` (README there) so
    the 1.0.0 generator keeps its goldens and invariant tests; only their path changed, no expectation. `generateFamily` dispatches by form.
  - `tests/tools/fidelity/exercise-claims.test.ts` rebuilds the audited 41 items (fixtures through the 1.0.0 generator, the five kept
    drills under their old ids, the scale item's title/description) so every v1 claim assertion still runs unchanged; `planted.test.ts`
    plants the same overlap error in the C major Beginner step and finds a chord's index by time (both hands), so the 416 planted
    mutations now run over all 101 shelf exercises; `tests/fixtures/library-identity.json` gained the 101 new files and lost the 41 old
    ones (repertoire entries untouched); `position.test.ts` and the Verovio accidental test point at the successors.
  - Test changes justified: `tests/library/index.test.ts` replaced "at least 24 chord exercises and 12 drills" by "at least 96 step
    exercises" (library-index 1.2 §4; every old drill's skill lives on in its successor, asserted by the successor tests); the C major
    extras assertion sorts by stepOrder (the index is id-sorted). No expected value was loosened.
  - Independent theory check v2 (`exercise-theory-v2`, sections, scales with the melodic-minor direction rule, broken and root-fifth
    voicings, hand-attributed labels, two-octave hand distance) agrees with the generator on all 96 items with 0 differences. It found
    two real mismatches on the way (chord labels of the other hand at the same onset; the both-hands close chord is two octaves apart),
    both in the check's model, fixed there.
  - `library:exercises` now runs `biome format --write public/library` after generating (the sidecars are committed formatted).
    `tools/dev/screenshot.ts` opens the closed key folders before clicking an item.
- Level results (all 24 keys): Introduction computes introduction, Beginner introduction/beginner, Intermediate intermediate,
  Advanced intermediate (see raisedBecause above); every folder passes `checkStepOrder`; hand independence is 0 in every step.
- Screenshots looked at (`pnpm screenshot`, Chromium): `learning/keys/c-major/introduction` - tempo mark quarter = 60, the section label
  "A - right hand: major scale, left hand: chords", RH quarter scale with fingering 1 2 3 1 / 2 3 4 5 / 5 4 3 2 / 1 3 2 1, one whole-note
  I or V chord per bar in the bass with its figure below; `f-sharp-major/introduction` - six sharps in both staves, fingering 2 3 4 1 /
  2 3 1 2 (Taylor), chords F#-A#-C# / C#-E#-G# with the figures I and V; `g-sharp-minor/advanced` - five sharps, eighth-note scale beamed
  in groups of four with F double sharp engraved, fingering 2 3 1 2 3 1 2 3, chords i V i iv with root-and-fifth below.
- Index: 117 items, 31 sections (`pnpm library:index`); audit: `pnpm library:fidelity` 118 records, 0 failed, `docs/library-audit.md`
  regenerated with the "Replaced by feature 011" table.

## 2026-09-26 - claude-sonnet-5 (US1 checkpoint)
- Found on resuming: T016-T039, T086, T087 were all implemented and the working tree matched the prior log entry, but
  T024 was still `[ ]` and nothing was committed - the previous session's own "T024 green" claim (T039's note) was
  correct (verified by re-running `tests/e2e/library.spec.ts` and `tests/e2e/piano-keyboard.spec.ts` on chromium, both
  green) but the tick and commit never happened. Ticked T024.
- `pnpm test` (3338 passed), `pnpm typecheck` (clean) and `pnpm lint` (0 errors, 282 warnings - same baseline as the
  prior entry) all green before touching `test:e2e`.
- **Found and fixed a real regression while running the full gate**, unrelated to worker count: `tests/e2e/grade-marks-
  overlap.spec.ts` (feature 009, one test generated per library item) clicks `.library-item-open[data-id=...]` directly
  without opening the item's ancestor folders first. Feature 011's key folders are closed by default (T022), so every
  `learning/keys/*` item (all 96 step exercises + the three C major extras) failed with `Test timeout of 120000ms
  exceeded` - the element existed but was never visible. Confirmed with an isolated, clean-environment sample (fixture
  test and one repertoire item green, two `learning/keys/*` items red with the exact same error) before touching
  anything, so the cause is the collapsed folder, not resource contention or the worker change below. Fixed by reusing
  the `revealLibraryItem` helper `library.spec.ts` (T024) already has for the same reason. Re-verified 118/118 green on
  both chromium and electron.
- **`playwright.config.ts` tuning** (the user asked to speed up the ~90-minute full `test:e2e` run): `workers` raised
  4 -> 8, verified safe by running the audio-clock-sensitive specs (`us1-play`, `us2-grade`, `electron-playback`,
  `us1-layout`'s relayout-during-a-run) alongside heavier specs at forced 8 workers - all green, no flakiness (the
  documented 16-worker failure was this same machine's "half the cores" default, not tested at 8 before). Added
  `fullyParallel: true`: without it every test in one spec file runs on a single worker regardless of `workers` -
  this is what actually made `grade-marks-overlap.spec.ts` (118 generated tests, one file) crawl, not the collapsed-
  folder bug alone. Total worker budget stays at the proven-safe 8; `fullyParallel` only lets the suite spend it.
- Along the way, killed an orphaned `playwright test` (full suite, no filters) + `npm run preview` process pair that
  had been running since before this session started (12:35:36, checked against `Get-CimInstance Win32_Process`
  `CreationDate`) - not started by this session or explained by any file the user had open; treated as an unexplained
  running process per AGENTS.md step 4's spirit and confirmed with the user before removing it.
- Evidence: `pnpm test:e2e` (full suite, 23 files x 4 projects, `workers: 8` + `fullyParallel: true`) -> `681 passed
  (7.1m)`, 351 skipped (intentional per-project skips), 0 failed - down from an aborted ~90-minute run at the old
  settings. `pnpm test`, `pnpm typecheck`, `pnpm lint` re-confirmed green after the config and spec-file changes.
- **Checkpoint reached**: US1 Independent Test passes (T024, live); full gate green (lint, typecheck, test, test:e2e);
  this entry; commit follows.
- Handoff: next = US2 (T040 -> T053, key-change generator and steps), quickstart US2. Run `pnpm test -- tests/core/
  library/exercise/key-change` first (T040/T041, write first, expect red).

## 2026-09-26 - claude-sonnet-5 (US2: key-change generator, T040/T041/T047, T048 in progress)
- Consulted `music-domain-expert` for the actual bar-by-bar chord progressions (Introduction/Beginner/Intermediate,
  both relations) before writing any code - R7's Intermediate text ("I, vi, ii6 = iv6, ...") is ambiguous/has a real
  bug if read literally (see below), and inventing voice-leading myself risked exactly what the independent theory
  checker exists to catch. Full report not reproduced here; the concrete degree tables it gave are now the content
  files' `sections`.
- **Deviated from strict test-first** for T040: the mechanism (`PatternChord.minor` firing on a *section's own*
  resolved key, verified by reading `generate.ts:677` and tracing `chordTones`/`invertOrder` by hand) had to be
  understood before any assertion would mean anything, so implementation and the test file were built together, not
  test-then-implementation. Logged plainly rather than claiming a red-first cycle that did not happen.
- **T040 - `generateKeyChangeFamily` and its tests, both green**:
  - `src/core/musicxml/write.ts`: `WriteMeasureAttributes.key` gained `cancel?: number`, emitted before `<fifths>`
    (MusicXML 4.0 `<key>` child order) - needed for a parallel change's `<cancel>`.
  - `generate.ts`'s `renderPattern` (already shared with the not-yet-written key-change form per its own docstring)
    gained: (a) a mid-bar `<key>` attributes event whenever a bar's resolved key has different `fifths` from the
    previous bar - inert for the pattern form (one key throughout, `previousKey` never differs) so no regression
    risk to the 96 already-shipped step files; (b) an optional `applyTies` hook run on the finished per-bar note
    lists before they enter measures, likewise a no-op unless passed one (only key-change Intermediate does).
    `sectionLabel` gained a `{toKey}` placeholder (`displayKeyName(section.key)`) alongside the existing `{scale}`.
  - `cancelFifths(oldFifths, newFifths)`: cancel needed when old is 0->nothing to cancel; new is 0->always show it;
    same direction and fewer accidentals->show it; opposite direction->show it. Verified against all 10 parallel
    directions by hand before trusting it (5 mandatory, 3 none, 2 spec-optional-but-included-anyway).
  - `tieAdjacentChords`: ties any note whose pitch matches the same hand's note in the next bar - generic pitch
    matching (same idea `generateChangeItem`'s section-B already used), gated on `form==='key-change' &&
    step==='intermediate'`. Verified the tie fixture actually needs this: C major's tonic (C E G) and A minor's
    tonic (A C E) share two tones, and the *existing, unmodified* bass-window register rule places both chords on
    the same C5/E5 without any chained voice-leading - a real, reliable common tone, not a contrived one.
  - `generateKeyChangeFamily`: dispatches `keyPairs`, resolves each section's key via `inKey` ('from'/'to'), reuses
    `renderPattern` (contract 1.1 §3 already said key-change is "shared", though the mid-bar attributes/ties gaps
    above were still open). `pairSlug` and `identityOf`'s `{pair}` support added.
  - `tests/core/library/exercise/key-change.test.ts` (16 tests): identity/title/section resolution; relative change
    (first chord = tonic of the first key, pivot bar physically identical to bar 1's IV, arrival V is the raised-
    leading-tone dominant, exactly one `<key>` for the whole piece, words direction names the arrival); parallel
    change (tonic-to-tonic, a second `<key>` with the right fifths, `<cancel>` only on the arrival-simplifies
    direction); ties (Intermediate only, the C/E common-tone case above); no engraving inserts anywhere. My first
    draft's register-octave assumptions were wrong (assumed C4-anchored chords; the existing bass-window rule
    anchors right-hand chords near C5) - caught immediately by running the tests, not asserted around.
- **T041/T048 (18-pair content) - real register and metadata problems found and mostly fixed**:
  - Wrote `KEY_CHANGE_PAIRS` in `keys.ts` (the 18 pairs, data-model §2 order) as the one source both the content
    generation and `tests/core/library/exercise/steps.test.ts`'s new key-change section read.
  - Authored the 6 content files (`content/library/exercises/key-change-{relative,parallel}-{introduction,beginner,
    intermediate}.json`) with a throwaway `tsx` script (written to and deleted from `tools/library/`, never
    committed) rather than by hand - 18 pairs x up to 8 chords by hand invites transcription errors the checker
    would only catch one at a time.
  - **Span**: Introduction/Beginner initially failed `checkLevel` criterion 1 (pitch span) for most or all of the 8
    relative pairs (not parallel - same tonic, same table octave, no mismatch). Root cause: combining two keys'
    *independent* bass-window anchors in one piece can exceed even the existing "exercise" span exemption (38
    semitones) in a way a single-key step never could. Fixed by simplifying the `from` section to plain tonic
    repeats + the pivot (dropping an incidental V) and the `to` section to the arrival V once, then tonic repeats
    (dropping a second, unneeded IV) - closer to data-model §3's own "pivot, then V, then i" than my first, more
    elaborate draft.
  - **G major <-> E minor specifically span 47** (vs ~38-40 for the other three relative pairs): G's tonic lands in
    the key table's octave 3 while E's lands in octave 4 (the table's pc<=5 -> octave 4 rule, feature 011 US1) - the
    *only* relative pair where the two tonics fall on opposite sides of that boundary in the direction that adds a
    full extra octave instead of the usual 3-semitone gap. Fixed with a **scoped, additive contract change**:
    `octaveShift` (schema already allowed -1..1, `ExerciseKey.octaveShift`) is re-enabled for key-change pairs only
    (`tonicMidiOf` now adds it; a plain pattern section still never sets it, so this is a no-op everywhere else) -
    `specs/005-practice-score-library/contracts/exercise-definition.md` bumped 1.1.0 -> 1.2.0 (MINOR, additive) with
    the rule and rationale. `KEY_CHANGE_PAIRS` sets it only on the G major<->E minor entries (-1 one direction, the
    `from` key -1 the other - found by trial against the actual span, not derived in closed form).
  - **`raisedBecause` is per-file, not per-pair**: 3 of the 8 relative-Intermediate pairs (the reverse "minor to
    major" direction, minus G/E's reverse which needed the shift instead) compute simpler than Intermediate once the
    span fixes landed. `ExerciseDefinition.meta.raisedBecause` is one string for the whole file, shared by all 8/10
    pairs - T018's exact per-item convention ("present exactly when needed") cannot hold when one file covers many
    pairs with different facts. Added a uniform `raisedBecause` to `key-change-relative-intermediate.json` (true and
    accurate for the 3 pairs that need it, inert for the 5 that don't - `checkLevel` only fails on a *missing*
    `raisedBecause`, never an unneeded one) and wrote the key-change step test to check the realistic invariant
    ("every pair that needs it has it"), not the stricter single-file convention T018 could afford.
  - End state, verified with a throwaway script before writing it into the real test: **all 54 generated items (18
    pairs x 3 steps) pass their own level check and `checkStepOrder`, zero engraving inserts.**
  - `tests/core/library/exercise/steps.test.ts` gained a "key-change steps cover all 18 pairs (T041)" section: one
    item per pair per step; bar count/tempo/whole-note-chords per step; Intermediate has a both-hands bar; every
    item passes its level; `checkStepOrder` over all 18 folders; identical shape within each relation (FR-011); the
    realistic `raisedBecause` invariant above. 51/51 green.
- Evidence: `pnpm test` -> `3372 passed`; `pnpm typecheck` clean; `pnpm lint` -> 0 errors, 282 warnings (unchanged
  baseline). `test:e2e` not run this entry - no UI-visible change yet (T050's panel/index regeneration is what makes
  key-changes appear in the shelf) and US2's own checkpoint requires it later, not per-task.
- **Not yet done, left honestly open**: T042 (goldens for 3 named pairs - T048 needs this to be fully green per its
  own stated criterion, hence `[~]` not `[x]`); T043/T051 (theory-v2 key-segment claims - the mechanical, independent
  check nothing above substitutes for); T044 (a fact test for the "relative change yields one key name" claim - very
  likely passes for free, since a relative change's generator never writes a second `<key>` element at all, so the
  fact scanner never sees more than one - not yet written to confirm this); T045 (shelf tests in
  `tests/library/index.test.ts`); T046 (e2e in `library.spec.ts`); T049 (move the two same-tonic drills into their
  new homes); T050 (`tools/library/sections.ts` - `learning/key-changes` and the 18 pair sections; nothing shows in
  the actual library panel until this and a regenerate happen); T052 (regenerate, audit records, `pnpm library:index`
  / `pnpm library:fidelity`, screenshots).
- Handoff: next = T042 (goldens, quick - the content already exists and is stable) -> T043/T051 (theory-v2, the
  biggest remaining design piece - key segments per bar range) -> T044 -> T045 -> T046 -> T049 -> T050 -> T052
  (regenerate + audit + screenshots), still inside US2, before its Checkpoint (full gate incl. `test:e2e`, US1 still
  passing, log, commit). Nothing currently on disk is broken or half-applied: `pnpm test`/`typecheck`/`lint` are all
  green as committed; T048 stays `[~]` until T042 lands.
