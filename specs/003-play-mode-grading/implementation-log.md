# Implementation log - feature 003 (Play Mode and Grading)

Newest entry at the bottom. One entry per session or checkpoint (AGENTS.md section 5).

## 2026-09-20 - claude-opus-5 (relay)

- Done: `/speckit.specify "Play mode / grading"`. Branch `003-play-mode-grading` created; `spec.md` and
  `checklists/requirements.md` written and validated (two iterations, all items pass).
- Scope as specified: four prioritised stories - US1 (P1) play to the Metronome with a count-in and get a Grade,
  US2 (P2) understand the Grade and hand a passage to Practice mode, US3 (P3) passage, tempo and hand selection,
  US4 (P4) keep and replay attempts. 48 functional requirements, 15 success criteria.
- Decisions (owner answered all three `[NEEDS CLARIFICATION]` markers on 2026-09-20, recorded in
  `## Clarifications`):
  1. **Live feedback**: pitch is marked while playing (correct / wrong pitch as a key claims a note), timing and
     extras only with the Grade. The live marking is display only and the Grade supersedes it - FR-011, FR-011a,
     SC-015. Keeps Constitution IV's "graded from the Performance log" intact while still telling the player
     something they can act on mid-piece.
  2. **Timing windows**: fractions of a beat at the tempo actually played, bounded by a named millisecond floor
     and cap - FR-020, SC-014. Fixed millisecond windows would make slow pieces far harder than fast ones, and at
     high tempos could reach a neighbouring note.
  3. **Grade summary**: two figures (notes correct, timing accuracy) plus plain counts. No combined score, stars,
     levels or pass marks - FR-028, Out of Scope. Avoids inventing a weighting and keeps "which skill to work on"
     visible.
- Continuity with feature 002 built into the spec rather than reinvented: expected notes, played-along keys, hand
  presets and part preselection follow Practice mode (FR-017, FR-024, FR-038), and FR-033 hands a passage from the
  Grade back to Practice mode as a loop.
- Problems / open questions: none blocking. Two things the plan step must settle, both flagged here rather than in
  the spec because they are design, not behaviour: where the Metronome's sample-accurate click lives (nothing in
  `src/` implements one yet - the first real Constitution I/II work of this feature), and the storage tier for
  Performance logs (the T046 MEDIUM finding about `PracticeSettings` in feature 002 is the same question one layer
  up).
- Handoff: next = `/speckit.plan` (no `[NEEDS CLARIFICATION]` markers remain, so `/speckit.clarify` is optional).
  Feature 001 still has three open tasks on its own branch (T138, T139, T141); they do not block this feature.
  Tree clean at the commit below; not pushed.

## 2026-09-20 - claude-opus-5 (relay)

- Done: `/speckit.clarify` on feature 003 - 5 questions asked and answered (user: "recommended" throughout),
  all integrated into `spec.md`. Session 2026-09-20 of `## Clarifications` now holds 8 entries.
- Decisions taken in this session (each applied to the requirements, not only recorded):
  1. **Two result axes**: every expected note carries a pitch result (correct / wrong pitch / missed); every note
     a key press claimed also carries a timing result (on time / early / late) with its signed difference -
     FR-018, FR-029, FR-032, `Note result`, SC-003. Resolves the conflict between FR-018's five-state enum and
     FR-028/FR-032, which only ever counted four states, and makes the two summary figures computable.
  2. **Matching is two passes**: same pitch first (correct), then same pitch class within the claim window
     (wrong pitch = octave error); everything left over is extra plus a missed note - FR-019, FR-030. FR-019
     previously described same-pitch matching only, under which no note could ever be marked wrong pitch. The
     app never guesses which written note a wrong letter was aiming at, which keeps FR-025 determinism and
     FR-030 explanations provable.
  3. **Timing-accuracy figure** = share of played notes whose timing result is on time, as a count out of a total
     and a percentage, with early/late counts beside it - FR-028. Millisecond detail stays per note (FR-030) and
     per measure (FR-032).
  4. **Strictness levels**: exactly three - Beginner (default, most forgiving), Standard, Strict - each a
     complete set of the FR-020 windows - FR-039, `Strictness level`.
  5. **Defaults named**: count-in one full measure of the meter where the run starts, never less than one
     measure (FR-003); 20 most recent attempts kept per Score, oldest dropped first, limit stated to the
     musician (FR-041).
- Problems / open questions: none blocking. Unchanged from the previous entry: the Metronome's sample-accurate
  click and the storage tier for Performance logs are for `/speckit.plan`. Decisions 1-5 all add named constants
  the plan must put in `data-model.md` (constants table = `src/core/defaults.ts`, `src/engine/config.ts`).
- Handoff: next = `/speckit.plan`. No `[NEEDS CLARIFICATION]` markers and no open owner decisions remain; a
  second `/speckit.clarify` pass is not needed. Tree clean at the commit below; not pushed.

## 2026-09-20 - claude-opus-5 (relay)

- Done: `/speckit.plan` for feature 003. Written: `plan.md`, `research.md` (R-01..R-17), `data-model.md`,
  `contracts/play-run.md`, `contracts/grading.md`, `contracts/performance-log.md`, `quickstart.md`; Active
  Technologies and Recent Changes updated in `docs/agents/reference.md`. Constitution Check passes before and
  after design, Complexity Tracking has no violations and no new runtime dependency.
- Decisions (full reasoning in `research.md`):
  1. **The Metronome is scheduled events, not new real-time code** (R-02): clicks are compiled into the run's
     `ScheduleMessage` on `METRONOME_CHANNEL = 14`, so they ride the existing dispatch path and follow the tempo
     map, the tempo percentage and every meter change with no drift (SC-002). Muting is a new `channelVolume`
     worklet message, so it cannot change the run or the Grade. This is what keeps the feature's RT surface to
     two small, reviewable changes.
  2. **One purpose-built schedule per run** (R-03): `compilePlaySchedule` drops the graded notes (FR-005), slices
     to the measure range (FR-036) and puts the count-in in front (FR-003); `PlayTickMap` is the only place run
     ticks and timeline ticks convert.
  3. **Grading is a pure synchronous function run in a new worker** (R-08), and **Performance logs go to a new
     IndexedDB store**, 20 per Score, without the Grade (R-09) - that last one answers the storage question
     feature 002's log left open. Not storing the Grade is what makes FR-027 and SC-011 structurally true.
  4. **Windows are fractions of a beat compared in integer ticks**, with a clamp-inertness invariant and a
     neighbour clamp at exactly 0.5 of the gap, applied after the millisecond floor (R-06). The values for
     Beginner / Standard / Strict are in `data-model.md` section 6.
  5. **The matcher is an order-preserving assignment per pitch, then per pitch class** (R-07), with the visiting
     order, the tie-breaks and the velocity-0 / debounce / sounding-pitch rules normative in
     `contracts/grading.md`. Determinism is then a property of the contract, not of the implementation.
  6. **Expected notes come from feature 002's `buildExpectedEvents`, flattened** (R-15), so Play expects exactly
     what Practice expects and Listen plays, and ties and chords come out right for free.
  7. Play wiring lives in a new `src/app/play-session.ts`, not in `session.ts` (832 lines, already two modes).
- Domain review: the `music-domain-expert` role reviewed the grading semantics on 2026-09-20 and supplied the
  window values and their derivation, the neighbour-clamp rule, the order-preserving matcher, and the count-in
  rules (R-16). Five of its nine findings against the spec are folded into the design; four are owner decisions
  below.
- Problems / open questions:
  - **Correction to the spec's Assumptions**: it says fairness "rests on the Latency profile from feature 001".
    Feature 001 has no Latency profile and no calibration - only a reported output latency and an unused
    key-to-sound estimate, applied to nothing. Feature 003 therefore builds the profile *and* the tap
    calibration FR-034 offers (R-05). No owner decision needed (the spec already requires the offer), but it is
    more work than the spec implied, and the tasks step should keep it off the P1 path.
  - needs owner: **D-1 ornaments** - a correctly played trill produces presses no expected note can claim, so
    FR-018 reports them as extra and an excellent trill becomes the worst-scoring thing in the piece, while the
    spec's own edge case says playing an ornament "is neutral". Closing it needs `<ornaments>` / `<trill-mark>` /
    `<tremolo>` parsing, which is new MusicXML scope (plan "Open owner decisions", R-17).
  - needs owner: **D-2 written arpeggios** - `<arpeggiate>` means the chord *should* be rolled, so FR-022 marks a
    correct performance late. Also new MusicXML scope (R-17).
  - needs owner: **D-3 SC-015** - it demands the live marks and the Grade agree for 100% of the notes they cover,
    but FR-011a exists because they can disagree, and with the order-preserving matcher they provably can.
    Recommendation: soften SC-015 to a measured rate. This one should be settled **before** `/speckit.tasks`,
    because it decides whether the live marker is a cheap pitch test or must mirror the matcher.
  - needs owner: **D-4 FR-003** - read literally, "nothing played during the count-in is graded" makes an early
    first note impossible. The design assumes the recommended fix (the exclusion is the count-in minus the first
    note's early claim window); if the owner prefers the literal reading it is one constant and one fixture.
- Handoff: next = `/speckit.tasks` (D-3 answered first if possible; D-1 and D-2 can be answered later, they only
  add tasks). Nothing implemented yet - no source file was touched. Tree clean at the commit below; not pushed.

## 2026-09-20 - claude-opus-5 (relay)

- Done: `/speckit.tasks` for feature 003. Written: `tasks.md` - 88 tasks (T001-T088), nothing implemented.
  Setup 3, Foundational 12, US1 31, US2 13, US3 10, US4 8, Polish 7, plus 4 parked on owner decisions.
- Structure: tests precede implementation in every story (Constitution IV); the two AudioWorklet tasks (T034
  sub-block rendering, T036 `channelVolume`) are each followed by a mandatory `rt-audio-reviewer` task (T035,
  T037) and are deliberately **not** parallel with each other, being the same file. The three contract bumps have
  their own tasks (T036 worklet-protocol 1.2.0, T038 ports 1.2.0, T077 storage schema 2), as feature 002 did in
  its T030.
- Decisions taken while ordering the work:
  1. **US1 carries the whole grading pipeline** (T016-T046). It is large because the spec's MVP is "play a piece
     and be told what happened", which needs expected notes, windows, matcher, summary, worker, run schedule, run
     reducer and both worklet changes. Splitting it would produce a checkpoint that cannot be tested on its own.
  2. **The assumed Latency profile is US1 (T038); the measured one and its calibration are US2 (T056-T058)**, per
     the plan's scope note. US1 grades honestly with an assumed profile that the Grade labels as assumed.
  3. **The ten US1 test files are independent** and marked `[P]`; they are the largest parallel opportunity in
     the feature.
  4. The new MusicXML fixtures (T014) and the recorded performance fixtures (T015) are Foundational, because
     three stories need them. They must be real files - AGENTS.md section 4 forbids placeholder assets.
- Problems / open questions: the four owner decisions from the plan are unchanged and now parked as T085-T088 so
  they cannot be lost. This list **assumes** the recommended answers to D-3 (T087) and D-4 (T088); D-1 and D-2
  add tasks if accepted and change nothing if not.
  - needs owner: **D-3 (T087)** should be answered before Phase 3 starts - it decides whether T044's live marker
    is a cheap pitch test (recommended) or has to mirror the matcher, which is a different set of tasks.
  - needs owner: **D-1 (T085) ornaments**, **D-2 (T086) arpeggios**, **D-4 (T088) count-in reach-back** - as
    recorded in the previous entry.
- Handoff: next = `/speckit.analyze` (read-only consistency check across spec, plan and tasks), then
  `/speckit.implement` starting at T001. Nothing implemented yet - no source file has been touched in this
  feature. Tree clean at the commit below; not pushed.

## 2026-09-20 - claude-opus-5 (relay)

- Done: `/speckit.analyze` (read-only). Nothing in `spec.md`, `plan.md`, `tasks.md` or any source file was changed.
- Analyze: 22 findings (CRITICAL 1, HIGH 5, MEDIUM 8, LOW 8); tasks.md as of edb12bf. FR coverage 45/48, SC
  coverage 11/15, no unmapped tasks, no duplicate requirements.
- Top recommendations (all need `tasks.md` or a design document, not code):
  1. **C1 (CRITICAL)**: SC-003 (a perfectly timed performance is on time at 40-208 bpm) and SC-004 (the reported
     difference is within 5 ms of an injected offset) have no task at all. They are US1 criteria and the only
     checks that latency compensation is applied correctly - add one synthetic-offset test task to Phase 3.
  2. **H1**: T009, T011, T030 and T032 are timing-path work (tick<->audio-time conversion, MIDI clock mapping,
     latency compensation, the schedule compiler) with no `rt-audio-reviewer` task, although `tasks.md`'s own
     rule and the reviewer's scope require one. Only T034/T036 have reviews (T035/T037).
  3. **H2**: the count-in reach-back contradicts itself - data-model section 1 and `contracts/performance-log.md`
     rule 4 say count-in input is excluded from matching, section 2 and `contracts/play-run.md` say the first
     note's early claim window reaches back into it (D-4).
  4. **H3**: FR-024 (played-along keys are never wrong or extra) has no representation in `contracts/grading.md`
     or `GradeInput`; step 3 turns every unclaimed press into an `ExtraNote`, so T062 cannot pass as written.
  5. **H4**: D-3 (SC-015 vs FR-011a, T087) is still open and the plan says it must be settled before Phase 3.
  6. **H5**: `METRONOME_CHANNEL = 14` is not reserved by `src/core/timeline/instruments.ts` (which reserves only
     9 and 15), so a Score can be allocated to it; `contracts/play-run.md` rule 5 and T022 have no implementing
     task.
- Problems / open questions: no remediation was applied (analyze is read-only); the user decides whether to fix
  the findings before `/speckit.implement`.
  - needs owner: **D-1 (T085)**, **D-2 (T086)**, **D-3 (T087)**, **D-4 (T088)** - unchanged, still open.
- Handoff: next = fix C1 and H1-H5 in `tasks.md` / the design documents (or accept them), then
  `/speckit.implement` from T001. Nothing implemented yet; tree clean at the commit below.
