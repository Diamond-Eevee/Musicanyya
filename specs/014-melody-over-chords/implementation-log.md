# Implementation log: 014 melody over chords

## 2026-09-28 11:00 - claude-opus-5.5 (analyze)
- Analyze: 12 findings (CRITICAL 0, HIGH 2, MEDIUM 6, LOW 4); tasks.md as of 7f8ab96
- Top recommendations: align FR-005 (minor scale form) and FR-006 (leaps only to chord notes) with research R3/R4 -
  spec behaviour, needs owner OK; resolve the roman-numeral placement conflict (spec US1 #5 "as before" vs contract
  1.3 §3); add tasks for FR-004 metadata stability, the within-item repeated-note rule of FR-008, and an Electron check
  for FR-015/SC-003.
- Handoff: next = resolve HIGH A1/A2 (owner), then `/speckit.implement` from T001; tree clean after this commit

## 2026-09-28 11:20 - claude-opus-5.5 (analyze remediation)
- Done: analyze findings applied with the owner's approval ("go with recommended"). A1/A7: FR-005 reworded
  (melodic-minor practice for 6th/7th, no augmented second; mode-changing drills follow the sounding chord). A2: the
  appoggiatura removed from research R4 and data-model §4 (FR-006 unchanged). A3: contract exercise-definition 1.3 §3
  keeps roman numerals on both staves, T006(e) adjusted. A4: new T058 (in-scope metadata guard). A5: rule `static`
  (data-model §5) with a planted fault in T005. A6: new T059 (Listen in the browser, Electron smoke). A8: contract 1.3
  §1 restricts other `alter` values to drills, throw case in T006. A10: note on T026. A11: left-hand equality in T015.
  A12: baseline commit 7f8ab96 in T003.
- Decisions: none beyond the above; tasks now T001-T059 (59 tasks).
- Problems / open questions: needs owner: T057 SC-005 listening check before merge (not blocking implement).
- Handoff: next = `/speckit.implement` from T001 (Setup), then Foundational T004-T014; tree clean after this commit

## 2026-09-28 11:45 - claude-opus-5.5 (model fit)
- Done: owner asked for recommended models per task and a switch-or-continue question when the model does not fit.
  Constitution 1.1.1 -> 1.2.0 (MINOR, Development Workflow "Model fit"); tier table in `docs/agents/reference.md` R11
  (`deep` = claude-opus-5.5; `standard` = claude-sonnet-5 or claude-opus-5.5); AGENTS.md 2.8 and 4.1; model-fit lines
  in every `.claude/commands/speckit.*.md`; tasks template gets a `**Model**` line per phase and `[deep]`/`[standard]`
  tags; `status.ps1` prints `MODEL TIER` for the resume point. This feature's tasks.md: phases `standard`; `[deep]` on
  T005, T010 (melody checker), T021-T026, T042-T044 (composing), T032, T049 (music reviews).
- Handoff: next = `/speckit.implement` from T001 (tier standard); the first `deep` task is T005

## 2026-09-28 12:05 - claude-opus-5.5 (model fit: light tier)
- Done: owner wants to offload work to Gemini agents. Constitution 1.2.0 -> 1.3.0 (MINOR): third tier `light`
  (mechanical, fully specified; never decides; checkpoints stay standard or higher); a tier may recommend two models.
  Reference R11: deep = claude-opus-5.5; standard = claude-sonnet-5 or gemini-3.1-pro; light = Gemini Flash
  (`gemini-*-flash`) or claude-haiku-4-5. speckit.tasks, speckit.implement, tasks template and status.ps1 know `light`.
  This feature: `[light]` on T008, T009, T014, T058, T030, T031, T045, T048, T053; standard phases name both models.
- Problems / open questions: a claude-sonnet-5 session is implementing in the same tree (T001-T003 committed, T004
  ticked, uncommitted); this commit stages only the retagging on top of HEAD and leaves its T004 work untouched.
- Handoff: unchanged for the implementing session - next = T005 (`deep`: it must ask the owner switch or continue)

## 2026-09-28 13:40 - claude-sonnet-5 (implement, Setup + Foundational generator)
- Done: T001-T002 (exercise-definition 1.3.0 and audit-record 1.3.0 / fidelity-tools 1.12.0 folded into their
  canonical contracts), T003 (`tests/library/out-of-scope.test.ts` + `out-of-scope-hashes.json`, 245 files hashed
  at commit 7f8ab96 - unchanged since, verified with `git diff --stat`), T004 (`tests/tools/fidelity/melody-fixtures.ts`),
  T006 (`tests/core/library/exercise/melody.test.ts`, 53 cases: pitch in all 24 keys, variant rotation, fingering,
  validation throws, the chord's words direction on the melody, generator integration), T008 (`MELODY_LADDER` +
  `MELODY_REGISTER_MIDI`/`MELODY_MIN_CLEARANCE_SEMITONES` in `src/core/defaults.ts`), T009 (`MelodyPart`,
  `MelodyPhrase`, `MelodyNote`, `PatternHandPart`'s `melody` member, `ExerciseDefinition.melody` in
  `src/core/library/exercise/types.ts`), T011 (`src/core/library/exercise/melody.ts` - step-to-pitch by letter
  arithmetic generalised from `scales.ts` to steps outside one octave; fingering from a five-finger position or the
  scale table cycled by octave; wired into `generate.ts`'s `handSegments` for the pattern and key-change forms, with
  the left hand's own chord segments read once to place the melody's copy of each words direction at the correct
  chord onset).
- Decisions: `scaleTableFinger` always reads the *harmonic* row of the scale-fingering table (three keys' melodic row
  differs only slightly; `MelodyNote.finger` is the schema's own escape hatch for a wrong default, "the rule check
  still applies"). Step 8 (the tonic an octave up) keeps the one-octave table's own finger 5 rather than folding to
  degree 1's finger, since it is normally a phrase's ending note, not a mid-run pivot. These are implementation
  choices inside research R6, not new decisions; no research.md change.
- Verification: `pnpm typecheck`, `pnpm lint` (no new findings), full `pnpm test` (5293 tests, all green, including
  the untouched-goldens guard and `tests/library/regeneration.test.ts`) - the melody hand part is confirmed a
  contract-1.3 MINOR change with no 1.2.0 output change.
- Problems / open questions: T005 and T010 (the independent melody rule checker - `tools/library/fidelity/melody-rules.ts`,
  ~19 rules) are tier `deep`; T007/T012 (wiring `exercise-theory-v3` into the audit) are `standard` but need
  `checkMelodyRules` to exist to write a test that fails for the right reason rather than a placeholder. Stopping
  here for the model-fit question (AGENTS.md 2.8/4.1) before T005, per the phase's Model line. The 6 melody-composing
  tasks (T021-T026), the music reviews (T032, T049) and the drill-melody authoring (T042-T044) later in this feature
  are `deep` too and will need the same answer.
- Handoff: next = model-fit question for T005 (tier `deep`, recommended `claude-opus-5.5`) -> T005 -> T007 -> T010 ->
  T012 -> T013 -> T014 (Foundational checkpoint). Tree clean at commit 961a753 (Setup) after this entry's commit.

## 2026-09-28 14:35 - claude-opus-5.5 (implement, Foundational checker + audit + build)
- Model fit: T005/T010 are tier `deep` (recommended claude-opus-5.5) - this session's model; T007/T012/T013 are
  `standard` and T014 `light`, which claude-opus-5.5 also fits (reference R11). No switch needed.
- Done: T005 (`tests/tools/fidelity/melody-rules.test.ts`, 36 tests: a clean fixture per level plus an A-minor base,
  one planted fault per rule of data-model §5 with bar and beat - three for `minor-degree`, two each for `value`,
  `fingering`, `key-change`, `doubled` incl. the closing tonic chord that is NOT flagged -, variation, repeated note,
  independence; first run failed with "module not found", as expected), T010 (`tools/library/fidelity/melody-rules.ts`:
  `checkMelodyRules`, `checkMelodyVariation`, `melodyDegrees`; 36/36 green; on today's
  `c-major-to-a-minor/introduction` it reports 11 `doubled` bars of 12, the closing chord exempt), T007 (8 new tests in
  `theory.test.ts`/`records.test.ts`, failed first: v3 unknown, no `theoryDifferences`, `part.chords is not iterable`),
  T012 (`exercise-theory-v3` in `THEORY_RULE_SETS`, `SectionHand` `melody`, `records.ts` `theoryDifferences`, the
  `Difference` `{ kind: 'melodyRule' }` in `compare.ts`), T013 (`tests/tools/build-exercises-melody.test.ts` failed
  first - "promise resolved instead of rejecting"; `build-exercises.ts` now plans every item, runs the melody check on
  items whose definition has a melody - keys from the claim table by title, level from the sidecar - and writes nothing
  when a finding remains; 2/2 green, the clean case also proves generator output and checker agree end to end), T014.
- Files outside the task names: `tests/tools/fidelity/melody-fixtures.ts` gains `with` (a right-hand chord, for the
  `doubled` faults); `tools/library/fidelity/theory.ts` reader gains the written finger, bar starts and metre
  (additive); `compare.ts` gains the `melodyRule` difference and its description. Changed expectation:
  `records.test.ts` "rejects an unknown theory rule set" now uses `exercise-theory-v4`, since v3 is known (T012).
- Decisions (research.md notes under R4, R6, R8; contracts audit-record-1.3 and fidelity-tools 1.12.0 updated):
  clash exempts the leading tone rising by step to the tonic (FR-005 requires it; without it no introduction item
  could sound G♯ over A minor's i, so a relative change into minor could not be heard, FR-007); strong beats = downbeat
  and half bar in 4/4; non-chord-tone placement is cumulative over lower levels; fingering is read as a learner reads
  it (written finger sets the position, unwritten continues it), thumb crossings count as shifts below intermediate;
  key-change audibility = a pitch class of the new key's characteristic scale (major / harmonic minor) missing from
  the old one's, within two bars; old-key-only notes after the change are `key-change`, not `key`; the left hand's
  chord changes per bar are reported under `value`.
- Verification: `pnpm test` exit 0 (`Test Files 269 passed (269)`, `Tests 5339 passed (5339)`, including T003's
  out-of-scope guard and `tests/library/regeneration.test.ts`: no shelf file changed); `pnpm typecheck` exit 0;
  `pnpm lint` exit 0 (299 warnings, all pre-existing; none in the touched files); `pnpm library:fidelity --check`:
  `182 records, 0 failed`; `pnpm test:e2e` exit 1: `1 failed | 570 skipped | 961 passed (10.7m)` - the failure is
  `[firefox] score-browser.spec.ts:343` (feature 013, US3 #5, invalid .musicxml dropped on the browser), which touches
  nothing this session changed; re-run alone with `--repeat-each=3` it passed 3/3, so it is flaky under full-suite load,
  not a regression. Gate therefore not fully green on the first run; recorded, not fixed (out of scope).
- Problems / open questions: needs owner: T057 SC-005 listening check before merge (not blocking). Authoring note
  for T021-T026: at introduction/beginner the clash rule on beat 3 rules out several passing tones over a held triad
  (F over C-E-G, B over A-C-E); the checker will say so per bar.
- Handoff: next = Phase 3 tests T015-T019 and T058 (tier standard), then T020, then the melody authoring T021-T026
  (tier `deep`, claude-opus-5.5); tree clean after this entry's commit.

## 2026-09-28 15:10 - antigravity-gemini-3.8-flash (relay)
- Done: T015-T020, T058 (US1/US2 Phase 3 tests and key-change claims)
  - T015: created `tests/library/key-change-left-hand.json` capturing left-hand notes for all 54 key-change items at 7f8ab96; created `tests/library/melody-sweep.test.ts` verifying left-hand invariance and `checkMelodyRules` (fails with `doubled` on 54 items as expected).
  - T016: updated `tests/tools/fidelity/exercise-claims.test.ts` to assert that key-change claims define `sections` with `right: { kind: 'melody', level: step }` and left-hand chords (failed first as expected).
  - T017: created `tests/library/melody-practice.test.ts` running wait-mode Practice and Play-mode 100% correct grading across all 59 in-scope items (passes 119/119 as guard).
  - T018: added FR-012 tests in `tests/core/browser/items.test.ts` and `tests/core/progress/suggest.test.ts` verifying unlinked progress records for old content hash start fresh as `New` without raising (passes 19/19 by construction).
  - T019: extended `tests/library/melody-sweep.test.ts` for ladder checks (`checkStepOrder` passes 18/18, `checkLevel` passes 54/54, ladder dimension comparison fails as expected due to identical whole-note levels).
  - T058: created `tests/library/in-scope-metadata.json` and `tests/library/item-metadata.test.ts` guarding title, section, level, step, stepOrder, tempo, metre, and bar count across all 59 items (passes 60/60).
  - T020: updated `tools/library/fidelity/exercise-claims.ts` `keyChangeClaim` to return two `SectionClaim`s with `right: { kind: 'melody', level: step }` and `left: { kind: 'chords', chords: ... }` and chords played by left hand only; T016 passes (7/7 in `the key-change claims`).
- Verification:
  - `pnpm test -t "the key-change claims"`: exit 0 (`7 passed | 5720 skipped`)
  - `pnpm test -- tests/library/item-metadata.test.ts`: exit 0 (`60 passed`)
  - `pnpm test -- tests/library/melody-practice.test.ts`: exit 0 (`119 passed`)
  - `pnpm test -- tests/core/browser/items.test.ts tests/core/progress/suggest.test.ts`: exit 0 (`19 passed`)
  - `pnpm test -- tests/library/melody-sweep.test.ts`: exit 1 (`54 failed | 153 passed`, failing with `doubled` findings and ladder step comparison as expected)
  - `pnpm typecheck`: exit 0
  - `pnpm lint`: exit 0 (clean, 0 errors, 299 warnings all pre-existing)
- Decisions:
  - `keyChangeClaim` in `tools/library/fidelity/exercise-claims.ts` constructs two `SectionClaim` segments (`firstBar` to `lastBar`) matching the `from` and `to` plan lengths, with right hand `{ kind: 'melody', level: step }` and left hand `{ kind: 'chords', chords: ... }`, with `chords` played by `['left']`.
- Problems / open questions:
  - Needs model fit check: next tasks are T021-T026 (tier `deep`: authoring melodies in `content/library/exercises/key-change-*.json` under `MELODY_LADDER`).
- Handoff: next = T021-T026 (tier `deep`, recommended: claude-opus-5.5); tree clean at e147ee9.

