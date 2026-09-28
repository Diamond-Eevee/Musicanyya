# Tasks: Melody over chords in Learning exercises

**Input**: Design documents from `specs/014-melody-over-chords/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (exercise-definition-1.3, audit-record-1.3),
quickstart.md

<!--
  Format: `- [ ] T001 [P] [US1] Description with exact file path`
  States: `[ ]` open, `[~]` in progress with ` (claimed: <agent-id> <date>)`, `[x]` done (AGENTS.md section 4)
  - [P]   = can run in parallel (different files, no dependency on unfinished tasks)
  - [USn] = user story the task belongs to (omit for Setup/Foundational/Polish)
  - Tests come BEFORE implementation (Constitution IV) and must fail first.
  - [deep] / [standard] / [light] = model tier when it differs from the phase's **Model** line (docs/agents/reference.md
    R11); `light` tasks can go to Gemini Flash or claude-haiku-4-5
  - No task touches AudioWorklets, the scheduler, MIDI input timing or plugin callbacks: no RT review is needed.
-->

Scope reminder: 59 items - 54 key-change items (`content/library/exercises/key-change-{relative,parallel}-
{introduction,beginner,intermediate}.json`) and 5 drills (`content/library/exercises/changes-*.json`). The per-key
steps, Songs and Repertoire must stay byte-identical (FR-003, SC-004).

## Phase 1: Setup

**Model**: standard (claude-sonnet-5 or gemini-3.1-pro)

- [x] T001 [P] Fold contract change `specs/014-melody-over-chords/contracts/exercise-definition-1.3.md` into the
  canonical `specs/005-practice-score-library/contracts/exercise-definition.md` (version line -> 1.3.0, new §1b/§2a
  text for `melody` and the drills' top-level `melody`)
- [x] T002 [P] Fold `specs/014-melody-over-chords/contracts/audit-record-1.3.md` into
  `specs/007-library-fidelity-audit/contracts/audit-record.md` (1.3.0, rule set `exercise-theory-v3`) and
  `specs/007-library-fidelity-audit/contracts/fidelity-tools.md` (1.12.0, `checkMelodyRules`, `checkMelodyVariation`)
- [x] T003 Write `tests/library/out-of-scope.test.ts`: for every file under `public/library/` that is not one of the
  59 in-scope items (their `.musicxml` + `.json`) and not `index.json`, assert its SHA-256 equals the value recorded
  in `tests/library/out-of-scope-hashes.json`; create that JSON by hashing the files at commit 7f8ab96 with a
  one-off script in the scratchpad (not committed). Passes now; guards SC-004 / FR-003 for every later task

---

## Phase 2: Foundational (blocks all user stories)

**Model**: standard (claude-sonnet-5 or gemini-3.1-pro); the melody checker (T005, T010) is `deep` (claude-opus-5.5): a wrong checker
lets bad melodies through

### Tests (write first, confirm they fail)

- [x] T004 [P] Write `tests/tools/fidelity/melody-fixtures.ts`: a small builder that writes two-staff MusicXML
  strings (right-hand single notes, left-hand block chords, key, metre, key change) for the checker tests - test
  helper only, no generator import
- [x] T005 [deep] Write `tests/tools/fidelity/melody-rules.test.ts` (depends on T004): (a) one clean fixture per level passes
  with 0 findings; (b) one planted fault per rule of data-model §5, each its own `it()` asserting exactly that `rule`
  with the right bar and beat - `key`, `chord-tone`, `non-chord-tone`, `minor-degree`, `augmented-second`,
  `cross-relation`, `clash`, `parallel-octaves` (fails at intermediate, allowed at beginner), `register`, `hand-gap`,
  `leap`, `range`, `value` (a dotted value at intermediate; an eighth at beginner), `shift`, `fingering` (thumb-under
  onto a black key; ascending step 3->2), `ending`, `key-change` (no new-key-only pitch class within two bars; old-key
  note after the change), `static` (one pitch held or repeated for more than two bars; the closing note exempt), `minor-degree` also for a
  raised 6th that is not in 5-♯6-♯7-1 and a raised 7th over VI, `doubled` (and a single closing tonic chord in both
  hands is NOT flagged); (c)
  `checkMelodyVariation` flags a family whose items share one degree sequence and passes one with two; (d) a repeated
  note is not a leap; (e) `tools/library/fidelity/melody-rules.ts` imports nothing from `src/core/library/exercise/`
  (read the source file's imports). Run: fails because the module does not exist
- [x] T006 [P] Write `tests/core/library/exercise/melody.test.ts`: (a) step -> pitch with the tonic in octave 4 in all
  24 keys, including steps -3..10 and the minor `alter` +1 on 6/7 (G♯ in A minor, E♯ in F♯ minor, F𝄪 in G♯ minor);
  (b) variant rotation `variants[i mod n]` per section; (c) throws naming family/section/variant/note when a part
  does not fill its section, a minor 6th/7th has no explicit `alter`, `melody` is in the left hand or in a mirrored
  section, a note has both `step` and `rest`, a non-zero `alter` other than +1 on a minor 6th/7th appears in a
  pattern or key-change definition (contract 1.3 §1); (d) fingering: finger = position index + 1 at introduction/beginner,
  scale-table fingers for runs at intermediate, `finger` override honoured, and `<fingering>` written only on a
  phrase's first note, a `shift` note and a thumb-under / finger-over; (e) the chord's words direction is written as
  today, above the right hand's staff (on the melody note at the chord start) and below the left hand's; (f) no `<chord/>` in the right hand of a melody section. Run:
  fails (no `melody` support)
- [x] T007 [P] Extend `tests/tools/fidelity/theory.test.ts` and `tests/tools/fidelity/records.test.ts`: a record with
  `exercise-theory-v3` and a right-hand claim `{ kind: 'melody', level }` runs `checkMelodyRules` and counts its
  findings in `expectedDifferences`; a v2 record re-runs unchanged; an unknown rule set is still refused. Run: fails

### Implementation

- [x] T008 [light] Add `MELODY_LADDER` (data-model §4) to `src/core/defaults.ts` and its row to the constants table in
  `specs/014-melody-over-chords/data-model.md` §4 if names differ
- [x] T009 [light] Add `MelodyPart`, `MelodyPhrase`, `MelodyNote`, the `{ melody }` member of `PatternHandPart` and
  `ExerciseDefinition.melody` (drills) to `src/core/library/exercise/types.ts`
- [x] T010 [deep] Implement `tools/library/fidelity/melody-rules.ts` (`checkMelodyRules`, `checkMelodyVariation`, research
  R3-R8, thresholds from `MELODY_LADDER`, reader shared with `theory.ts`) until T005 passes
- [x] T011 Implement `src/core/library/exercise/melody.ts` (pitch, variant choice, fingering, write events) and wire
  the `melody` part into `handSegments` in `src/core/library/exercise/generate.ts` until T006 passes; confirm the
  existing goldens (`tests/core/library/exercise/goldens.test.ts`) and `tests/library/regeneration.test.ts` are
  unchanged (contract 1.3 MINOR: no 1.2.0 output changes)
- [x] T012 Add `exercise-theory-v3` to `THEORY_RULE_SETS` in `tools/library/fidelity/records.ts` and the `melody`
  `SectionHand` to `tools/library/fidelity/theory.ts` until T007 passes
- [x] T013 Write `tests/tools/build-exercises-melody.test.ts` (fails first), then make
  `tools/library/build-exercises.ts` run `checkMelodyRules` on every generated item that has a melody and write
  nothing (exit code 1, findings listed per item, bar and rule) when any finding remains
- [x] T014 [light] `pnpm test -- tests/core/library tests/tools tests/library`, `pnpm typecheck`, `pnpm lint` green; commit

**Checkpoint**: the generator can write melodies, the checker catches every planted fault, and nothing on the shelf
has changed yet (T003 passes).

---

## Phase 3: User Stories 1 and 2 - Key-change items have a melody, and the ladder holds (Priority: P1) MVP

**Model**: standard (claude-sonnet-5 or gemini-3.1-pro); composing the melodies (T021-T026) and the music review (T032) are `deep`
(claude-opus-5.5)
**Goal**: all 54 key-change items have a right-hand melody over the unchanged left-hand chords (US1), each within
its level's Difficulty ladder row, levelled correctly and harder step by step (US2).
**Independent Test**: US1 - open *C major to A minor - introduction* in Listen mode: single notes moving by step in
C major, then A minor with G♯, over left-hand chords; complete it in Practice mode with the on-screen piano. US2 -
for one key pair, the introduction, beginner and intermediate items each satisfy their ladder row, each is at least
as demanding as the one before, and the level check passes.

### Tests (write first, confirm they fail)

- [x] T015 [P] [US1] Write `tests/library/melody-sweep.test.ts`: for every key-change item on the shelf (ids from
  `public/library/index.json`, section `learning/key-changes/*`, excluding the drills `major-and-minor` and
  `minor-and-major`), `checkMelodyRules` at the item's level returns 0 findings (so 0 `doubled` bars, chord tone at
  every chord start, minor degrees, ending, key-change audibility, register, fingering); `checkMelodyVariation` per
  definition returns 0; each item's left-hand notes equal those of the same item at 7f8ab96 (read from git or a
  recorded copy in `tests/library/key-change-left-hand.json`) (FR-002). Run: fails with `doubled` findings on all 54
  items
- [x] T016 [P] [US1] Update `tests/tools/fidelity/exercise-claims.test.ts` first: the key-change claims give the right
  hand as `{ kind: 'melody', level }` for every section and the left hand's chords unchanged. Run: fails
- [x] T017 [P] [US1] Write `tests/library/melody-practice.test.ts`: for every rewritten item, run the core Practice
  mode (`src/core/practice`) with a fake input that plays each expected note/chord in order and assert the session
  completes; run Play-mode grading (`src/core/grade`) on a perfect Performance log built from the schedule and assert
  every Note is graded correct (FR-015, SC-003). Run: passes on today's files (guard), must stay green after
  regeneration - log it as a guard, not a failing-first test
- [x] T018 [P] [US1] Write the FR-012 test in `tests/core/browser/items.test.ts` (and `tests/core/progress/suggest.test.ts`
  for Continue): a progress record keyed by the old hash of `learning/key-changes/c-major-to-a-minor/introduction`
  while the index lists a new hash -> the item shows status New with no results, the leftover record raises nothing,
  and other items' progress is unchanged. Run: record whether it fails (expected: passes by construction, research
  R9) and log the outcome
- [x] T019 [US2] Extend `tests/library/melody-sweep.test.ts`: for each key-change folder, `checkStepOrder` returns
  no message and, per MELODY_LADDER dimension (shortest value, range, largest leap, shifts), the beginner item is not
  easier than the introduction and the intermediate not easier than the beginner (US2 #3); `checkLevel` passes at the
  shelved level for all 54 items with no `raisedBecause` added (FR-011). Run: the ladder comparison fails (all three
  levels identical today)
- [x] T058 [P] [US1] [light] Write `tests/library/item-metadata.test.ts` (FR-004): for each of the 59 in-scope items, title,
  section, level, step, stepOrder, tempo, metre and bar count equal the values recorded in
  `tests/library/in-scope-metadata.json` (made from the sidecars and files at 7f8ab96 by a one-off scratchpad script,
  not committed). Passes now; a guard for T028 and T047 - log it as such

### Implementation

- [x] T020 [US1] Change the key-change claims in `tools/library/fidelity/exercise-claims.ts` (right hand -> melody,
  rule set v3) until T016 passes; still no read of definitions or generator
- [x] T060 [deep] (found during T021) Clash rule amendment (research R4): exempt a diatonic passing tone on the half
  bar, chord tone to chord tone in one direction, from `clash` in `tools/library/fidelity/melody-rules.ts`; test first in
  `tests/tools/fidelity/melody-rules.test.ts` (G F | E D | C over I and A B | C B | A over i pass; an upper neighbour
  and a passing shape landing outside the next chord still clash). Without it *A minor to C major - introduction* has
  no valid melody
- [x] T062 (found during T023) Fingering on every melody note (feature 005 FR-006; `pnpm library:index` refuses an
  exercise with `fingeringCoverage` below 1 - the introduction items came out at 0.68): contract exercise-definition
  1.3.1 and research R6 amendment first, then `tests/core/library/exercise/melody.test.ts` (every note prints its
  finger; fails), then `src/core/library/exercise/melody.ts` until it passes
- [x] T021 [P] [US1] [deep] Author the right-hand `melody` (major and minor variants, at least 2 per section and mode) in
  `content/library/exercises/key-change-relative-introduction.json` - half and whole notes, five-finger position,
  steps only
- [x] T022 [P] [US1] [deep] Same for `content/library/exercises/key-change-parallel-introduction.json`
- [x] T023 [P] [US2] [deep] Author the beginner melodies in `content/library/exercises/key-change-relative-beginner.json`
  (quarters, runs of at most 4 quarters, leaps up to a third, at most one shift at a section start)
- [x] T024 [P] [US2] [deep] Same for `content/library/exercises/key-change-parallel-beginner.json`
- [x] T025 [P] [US2] [deep] Author the intermediate melodies in `content/library/exercises/key-change-relative-intermediate.json`
  (eighth pairs on the beat, range up to an octave, thumb-under/finger-over, leaps up to a fifth to chord notes)
- [x] T026 [P] [US2] [deep] Same for `content/library/exercises/key-change-parallel-intermediate.json` (T025/T026: B major and
  B minor sit high with the tonic in octave 4 - use steps below the tonic to stay under A5, research R5)
- [x] T063 [US2] (found during T025) Drop the relative intermediate `raisedBecause` ("the minor-to-major pairs ... compute
  beginner on this content") from `content/library/exercises/key-change-relative-intermediate.json`: with the melodies
  every pair computes intermediate by itself (a run of three eighth pairs, level criterion 6), so the reason no longer
  holds; FR-011 and the sweep test allow an existing one to go
- [x] T027 [US1] Review each key-change definition's `meta.trains` and update the text where it no longer describes
  the music (US3 #3 applies here too), in the six files of T021-T026
- [x] T028 [US1] Regenerate: `pnpm library:exercises`, `pnpm library:index` (writes `public/library/learning/key-changes/**`
  and `public/library/index.json`); iterate T021-T026 until the build and index report nothing; T015, T019, T017, T003
  green
- [x] T029 [US1] Update the key-change goldens in `tests/core/library/exercise/__snapshots__/goldens.test.ts.snap` and
  any assertion of old right-hand notes in `tests/core/library/exercise/key-change.test.ts`; log each changed
  expectation with its reason (behaviour changed by FR-002)
- [x] T061 [US1] (found during T021) Update `tests/core/library/exercise/steps.test.ts`, which T029 does not name: the
  key-change assertions "whole-note chords throughout" (introduction), "identical rhythm and staves in every pair of
  the relation" and "Intermediate has a passage where both hands play chords in the same bar" describe the doubled
  right hand; keep them for the left hand (FR-002) and assert the right hand's single-note melody instead (its rhythm
  varies per variant, FR-008); log each changed expectation
- [x] T064 [US1] (found during T028) `tests/tools/fidelity/planted.test.ts` (feature 007) plants its spelling / pitch /
  inversion mutations in a right-hand chord of every shelf exercise; a melody item has none (the file fails to load:
  `group[0]` undefined). Plant them in the left hand's chord where the right hand plays a melody, and log the changed
  expectation (behaviour changed by FR-002)
- [x] T065 [US1] (found during T028) Regenerate `tests/fixtures/library-identity.json` with `pnpm exec tsx
  tools/library/identity.ts` for the 54 rewritten items; confirm by comparing old and new golden that every other item's
  entry is unchanged (SC-004) and the Für Elise grade golden is unchanged
- [x] T030 [US1] [light] Move the 54 audit records under `content/library/audit/learning/key-changes/` (all but the two drills)
  to `exercise-theory-v3` (`checkedBy`, `date` updated), run `pnpm library:fidelity` to regenerate
  `docs/library-audit.md`, `pnpm library:fidelity --check` green
- [x] T059 [US1] Add a Listen-mode check for a rewritten item in the browser (`tests/e2e/library.spec.ts`: open
  `learning/key-changes/c-major-to-a-minor/introduction`, press Listen, the cursor reaches the last bar with no console
  error) and in Electron (`tests/e2e/electron-smoke.spec.ts`: the same item loads and renders two staves) (FR-015,
  SC-003); run after T028
- [x] T031 [US1] [light] Run `pnpm test:e2e -- tests/e2e/library.spec.ts tests/e2e/tempo-field.spec.ts` (they open
  `c-major-to-c-minor/introduction` and `a-major-to-a-minor/beginner`); fix only assertions that read the old notes,
  logging why
- [x] T066 [US2] [deep] (found by the T032 review) Intermediate fingering: `computedFinger` reads the scale table per degree,
  so the printed fingers cross inside a five-finger span (E3 F1 G2 E3 C1), inside neighbour figures and finger leaps
  backwards or with the same finger; the checker passed it because a leap at intermediate was an unlimited shift.
  Done as: research R6 amendment (T066) first; tests first in `tests/tools/fidelity/melody-rules.test.ts` (five planted
  leap faults, two legal shifts); `melody-rules.ts` checks a leap that moves the hand (outside a chord start after at
  least a quarter: only the thumb crosses, at most a third, onto/from a white key; no same-finger jump; thumb to 2 at
  most a fourth); the 24 intermediate phrases in `key-change-{relative,parallel}-intermediate.json` carry an explicit
  finger on every note (the generator is unchanged - see R6 amendment for why); regenerate (T028 steps), goldens, audit
- [x] T067 [US1] [deep] (found by the T032 review) Parallel octaves on a weak beat: the leading tone in the melody
  over V6 (bass = leading tone) resolving with the bass to the tonic. Done as: test first in
  `tests/tools/fidelity/melody-rules.test.ts` (B over V6 on the last beat to C over I); `parallel-octaves` in
  `melody-rules.ts` also compares the melody's last note before a chord start; the clean intermediate fixture's bar 7
  moved to V6/4 (its G♯ over a G♯ bass was such an octave); the six phrases it found on the shelf (10 items, the
  review's four among them) rewritten in `key-change-{relative,parallel}-intermediate.json`; regenerate, goldens, audit
- [x] T068 [US2] [deep] (owner decision 2026-09-28, from the T032 review) Introduction allows one hand shift, at the key
  change only: spec Difficulty ladder and data-model ladder rows first (also: intermediate range is per section, owner
  decision); test first in `tests/tools/fidelity/melody-rules.test.ts` (a shift at the key change is no finding - the
  old expectation changed; a second shift mid-section is); `MELODY_LADDER.introduction.shiftsMax` 1 in
  `src/core/defaults.ts`, the section-start rule in `melody-rules.ts` for introduction as for beginner
- [x] T069 [US1] [deep] (T032 review finding 4, after T068) Relative introduction A minor -> C major and B minor -> D
  major: the minor section plays the tonic and the leading tone (thumb on the 6th: C B | A G♯ | A G | F), a finger-over
  from the thumb (the one shift) into a major section that opens on its third, in
  `key-change-relative-introduction.json`; regenerate, goldens, identity golden
- [x] T071 [US2] [deep] (T032 follow-up review) A step may also move the hand at a chord start after at least a
  quarter (research R6 amendment T071): test first in `tests/tools/fidelity/melody-rules.test.ts` (the old "ascending
  step 3 to 2" fault at bar 8's downbeat is now a legal shift; the fault moves to the middle of a bar), then
  `melody-rules.ts`; then the follow-up review's fingering fixes (thumb-pivot neighbour figures, needless crossings,
  5-4-3-2-1 cadences) in `key-change-{relative,parallel}-intermediate.json`; regenerate (only `<fingering>` changes)
- [x] T070 (owner decision 2026-09-28: accept - the left hand carries the minor key; the two items stay as they are,
  and `trains` still holds since it speaks of the new key's notes) relative introduction E minor -> G major and D minor -> F major still play neither the minor
  tonic nor its leading tone in the right hand. No melody within the introduction rules exists for them even with the
  one shift: the major section holds one tonic chord for 8 bars and must sound the new key's note (D / C natural)
  within two bars by steps, and every join into it needs a leap, a thumb on a black key, two non-chord tones in a row,
  or (E minor high) a pitch span of 40 semitones against the level's 38 (criterion 1). Options: accept (the left hand
  carries the minor), or change the harmony of those two items' major section (not allowed by FR-002)
- [x] T032 [US1] [deep] Music review of the authored key-change phrases with the `music-domain-expert` agent (readability,
  musicality, level fit, fingering); fix findings in the definitions, regenerate, summarise findings in
  `specs/014-melody-over-chords/implementation-log.md`
- [x] T033 [US1] Manual verification per `specs/014-melody-over-chords/quickstart.md` US1 and US2 (`pnpm screenshot
  --item ...` for c-major-to-a-minor/introduction, c-major-to-c-minor/beginner and the three g-major-to-e-minor items;
  open every PNG) and record what was seen in the log
- [x] T034 [US1] Checkpoint: full gate (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`), log entry, commit

**Checkpoint**: US1 and US2 verified by their Independent Tests; the drills and every other item are unchanged.

---

## Phase 4: User Story 3 - Chord-change drills lose their doubled bars (Priority: P2)

**Model**: standard (claude-sonnet-5 or gemini-3.1-pro); composing the drill melodies (T042-T044) and the music review (T049) are
`deep` (claude-opus-5.5)
**Goal**: the 5 drills keep their left hand exactly and get a right-hand melody that rests with the left hand.
**Independent Test**: open *C major - I-V-vi-IV*: no bar has both hands on the same block chord; the left hand plays
the same chords and inversions as before, the right hand a melody.

### Tests (write first, confirm they fail)

- [x] T035 [P] [US3] Extend `tests/core/library/exercise/changes.test.ts`: with a top-level `melody`, (a) the left
  hand's events equal those generated from the same definition without `melody` (chords, inversions, chained voicing,
  ties, quarter rests, repeat); (b) in section A the right hand has a quarter rest at the same onset as the left
  hand's; (c) no `<chord/>` on staff 1; (d) `melody` on a non-`changes` family throws; (e) a part that does not fill
  section A/B/final throws. Run: fails
- [x] T036 [P] [US3] Extend `tests/library/melody-sweep.test.ts` to the 5 drills
  (`learning/keys/c-major/{i-v-vi-iv,turnaround,diatonic-ladder}`,
  `learning/key-changes/c-major-to-c-minor/major-and-minor`, `learning/key-changes/a-minor-to-a-major/minor-and-major`):
  0 findings at each item's level, including the `alter: -1` third over minor chords of the same-tonic drills. Run:
  fails (`doubled`)
- [x] T037 [P] [US3] Update `tests/tools/fidelity/exercise-claims.test.ts` for the drill claims (right hand melody,
  rule set v3). Run: fails
- [x] T038 [P] [US3] Update `tests/library/identity.test.ts` and `tests/library/index.test.ts` first: the 5 successor
  entries whose `newId` is a drill carry `resetBy: '014'`, no shelf item claims their old ids in `supersedes`, and
  the feature-011 "every old id appears exactly once" invariants hold for the other 36; log the changed expectation
  (owner decision FR-012). Run: fails
- [x] T039 [P] [US3] Extend the FR-012 test of T018 to a drill: a record under the pre-011 id's hash (old `supersedes`
  hash) is no longer pooled into `learning/keys/c-major/turnaround`. Run: fails (still pooled today)

### Implementation

- [ ] T040 [US3] Implement the drills' top-level `melody` in `generateChangeItem`
  (`src/core/library/exercise/generate.ts`, using `melody.ts`) until T035 passes; per-key-step and key-change goldens
  unchanged
- [ ] T041 [US3] Change the drill claims in `tools/library/fidelity/exercise-claims.ts` until T037 passes
- [ ] T042 [P] [US3] [deep] Author `melody` and remove `supersedes` in `content/library/exercises/changes-i-v-vi-iv.json`
  and `content/library/exercises/changes-turnaround.json` (beginner)
- [ ] T043 [P] [US3] [deep] Same for `content/library/exercises/changes-diatonic-ladder.json` (intermediate)
- [ ] T044 [P] [US3] [deep] Same for `content/library/exercises/changes-same-tonic.json` and
  `content/library/exercises/changes-a-minor-major.json` (advanced; `alter: -1` on the third over the minor chords)
- [ ] T045 [US3] [light] Add `resetBy: '014'` to the 5 drill entries in `tools/library/successors.ts` (and the field to its
  `Successor` type) until T038 and T039 pass
- [ ] T046 [US3] Review the 5 drills' `meta.trains` texts and update where needed
- [ ] T047 [US3] Regenerate (`pnpm library:exercises`, `pnpm library:index`), update the drills' goldens and
  `tests/core/library/exercise/changes.test.ts` expectations with logged reasons; T036, T017, T003 green
- [ ] T048 [US3] [light] Move the 5 drills' audit records to `exercise-theory-v3`; `pnpm library:fidelity`,
  `pnpm library:fidelity --check` green
- [ ] T049 [US3] [deep] Music review of the drill phrases with the `music-domain-expert` agent; fix, regenerate, summarise in
  the log
- [ ] T050 [US3] Manual verification per quickstart US3 and FR-012 (screenshots of `c-major/i-v-vi-iv` and
  `c-major-to-c-minor/major-and-minor`; the FR-012 browser check with an old result) recorded in the log
- [ ] T051 [US3] Checkpoint: full gate, log entry, commit

**Checkpoint**: all 59 items rewritten; SC-001 holds on the whole Learning section.

---

## Phase 5: Polish & Cross-Cutting

**Model**: standard (claude-sonnet-5 or gemini-3.1-pro)

- [ ] T052 [P] Add an assertion to `tests/library/melody-sweep.test.ts` that no Learning item (all of
  `learning/**`) has a `doubled` finding apart from a single closing tonic chord (SC-001), and that the in-scope list
  has exactly 59 ids
- [ ] T053 [P] [light] Update `docs/agents/reference.md` Active Technologies line for 014 from "planned" to "implemented"; check
  `public/library/README.md` needs no change (generated exercises section) and `quickstart.md` still matches the commands
- [ ] T054 Constitution review of the branch diff with the `constitution-auditor` agent; findings summarised in the log
- [ ] T055 Run the whole `specs/014-melody-over-chords/quickstart.md` validation once more on the final build
- [ ] T056 Full gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` green; final log entry; commit
- [ ] T057 needs owner: SC-005 listening check - the owner listens to at least six rewritten items (one per group and
  level: relative and parallel introduction/beginner/intermediate, plus one drill) and judges each more interesting
  than the doubled version and fitting its level; any item judged too hard is simplified (back to its authoring task)
  before merge. Record the verdicts in the log

## Dependencies & Execution Order

- Setup (T001-T003) -> Foundational (T004-T014) -> Phase 3 (US1+US2) -> Phase 4 (US3) -> Polish.
- Phase 4 depends only on Foundational; it can run in parallel with Phase 3 if staffed, except that T020/T041 both
  edit `exercise-claims.ts` and T015/T036 both edit `melody-sweep.test.ts` (do them in sequence).
- Within Foundational: T004 -> T005 -> T010; T006 -> T009 -> T011; T007 -> T012; T010 + T011 -> T013.
- Within Phase 3: T015-T019 and T058 before T020-T026; T021-T026 -> T027 -> T028 -> T029/T061/T064/T065/T030/T059/T031 -> T032 -> T033 -> T034.
- Within Phase 4: T035-T039 before T040-T046; T040 + T042-T045 -> T047 -> T048 -> T049 -> T050 -> T051.
- T057 (owner) blocks merge only, not other tasks.

## Parallel Opportunities

- T001, T002 (different contract files); T003 alongside them.
- T004 + T006 + T007 (checker fixtures, generator tests, theory tests).
- T015-T019 and T058 (separate test files, except T019 after T015 in the same file).
- T021-T026: six definitions, one per agent/person.
- T035-T039; T042-T044.
- T052, T053.
