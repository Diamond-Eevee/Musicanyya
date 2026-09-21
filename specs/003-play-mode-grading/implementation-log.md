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

## 2026-09-20 - claude-opus-5 (relay)

- Done: resolved **all four owner decisions** (the owner answered "use the recommendations") and **all 22
  `/speckit.analyze` findings**. Documents only - no source file was touched, nothing implemented.
  - T087 [x] D-3 softened: SC-015 is now "at least 95% over the reference fixtures"; FR-011 and AS-1.13 mark only
    "correct" live; `liveMark` lost its `pitch` field (play-run 1.1.0); T044 stays a cheap same-pitch test.
  - T088 [x] D-4 accepted: one count-in rule everywhere - matching reaches back by the first note's early claim
    window and forward by the last note's late claim window (FR-003, AS-1.1, data-model §1 and §2,
    performance-log rule 4). The four documents had contradicted each other on this (finding H2).
  - D-1 and D-2 accepted: the MusicXML subset grows by `<ornaments>` (`<trill-mark>`, `<mordent>`, `<turn>`,
    `<tremolo>`) and `<arpeggiate>`; `<glissando>` and `<slide>` stay unsupported and reported (R-17).
- Decisions (new, in research.md): **R-18** played-along keys are explicit `PlayedAlongSpan` data in `GradeInput`
  with a matcher pass 3 that runs after both claiming passes - without it FR-024 was not representable and every
  accompaniment press would have been reported as extra (finding H3). **R-19** `METRONOME_CHANNEL = 14` is
  reserved in `src/core/timeline/instruments.ts` (which reserves only 9 and 15 today), so no Score part can land
  on the click channel; `compilePlaySchedule` asserts rather than drops (finding H5).
- Contracts: `grading.md` 1.0.0 -> **1.1.0** (`playAlong` input and output, pass 3, arpeggio spread,
  `timingNotResolvable` under the absolute floor); `play-run.md` 1.0.0 -> **1.1.0** (`liveMark` without `pitch`,
  the channel-reservation rule). `performance-log.md` unchanged in version, rule 4 corrected.
- Other findings folded in: `PLAY_WINDOW_ABSOLUTE_FLOOR_MS` became a `timingNotResolvable` reporting rule instead
  of an unused constant contradicted by the neighbour clamp (M1); `COUNT_IN_MIN_SECONDS` is now in FR-003
  because it is user-visible (M2); `PLAY_GRADE_UNPLAYED_IS_MISSED` dropped (L7); FR-020, FR-039 and the Key
  Entities list four configured windows instead of six (M8).
- tasks.md: 88 -> **103 tasks**, IDs appended not renumbered (file order is execution order). New: T085/T086
  (ornament and arpeggio parsing, now scheduled in Phase 2) with T102; T089 (SC-003 and SC-004 had **no task at
  all** - the CRITICAL finding); T090/T091 (RT reviews of the timing path: T009, T011, T030, T032); T092/T093
  (played-along); T094/T095 (Metronome channel); T096 (grade worker), T097 (controller); T098 (audio loss
  raising `audioLost`); T099 (nothing modal, no graded on-screen keyboard); T100 (nothing uploaded); T101 (chord
  spread and arpeggio); T103 (10-minute run accounting). T045 moved into the US1 test block (test-first).
- Problems / open questions: none. All four owner questions are answered and written into the documents; no
  decision is waiting on anybody.
- Handoff: next = `/speckit.implement` from T001. Setup T001-T003, then Phase 2 (note the new order: T090, T094,
  T095, T102, T085, T086 close it), then US1. Nothing implemented yet; tree clean at the commit below, not
  pushed.

## 2026-09-20 20:15 - claude-sonnet-5 (relay)

- Done: Setup (T001-T003) and all of Foundational (T004-T015, T090, T094, T095, T102, T085, T086, plus T104,
  a task found missing mid-phase) - 24/104 tasks. Nothing in US1-US4 or Polish started.
- Built, in order: the Play run and Grade domain types (`src/core/play/types.ts`, `src/core/grade/types.ts`,
  T004-T005); grading test helpers and fakes (T006-T007); `tickAtAudioTime`/`audioTimeAtTick` in
  `src/core/tempo/rate.ts`, the single seconds<->ticks conversion site (T008-T009); `MidiClockMap` in
  `src/engine/midi/clock-map.ts` (T010-T011); an RT review of both timing-path changes (T090, pass with two
  non-blocking advisories logged below); the `PLAY_STRICTNESS_LEVELS` window record and its clamp-inertness
  invariant tests (T012-T013); 13 new MusicXML fixtures plus 2 recorded-performance JSON fixtures (T014-T015);
  `METRONOME_CHANNEL` reserved in `assignChannels` (T094-T095); `<ornaments>`/`<trill-mark>`/`<mordent>`/`<turn>`/
  `<tremolo>`/`<arpeggiate>` parsing with two more fixtures (T102, T085-T086, owner decisions D-1/D-2).
- Found missing mid-T015: no existing fixture was both long and simple enough to name specific measures
  ("mistakes in measures 3 and 7", US2's Independent Test) or a range ("measures 5-8", US3's). Added task T104
  (`eight-measure-melody.musicxml`, 8 measures/4-4/quarter=100) and used it for both performance-log fixtures.
- Corrections made along the way (all fixed before their commit, not left as debt):
  1. T002 had overreached into T013's scope (`PLAY_STRICTNESS_LEVELS` needs `grade/types.ts`'s canonical
     `Window`/`StrictnessLevel`, which didn't exist yet at T002); reverted to T002's literal scope and redid it
     properly once T005 landed.
  2. `tests/architecture/layers.test.ts`'s DOM-global heuristic false-positived on the plain English word
     "window" inside comments once `grade/types.ts` (legitimately) added an interface named `Window`; it now
     strips comments before matching, so it checks code, not prose - a real fix, not a weakened check.
  3. `pnpm lint` (not run in full between T013 and T085-T086) had a Biome formatting error in the T015 JSON
     fixtures (an array Biome wants inline, not multi-line); reformatted and folded into the T085-T086 commit.
     Lesson for future sessions: run the full `pnpm lint`, not just `biome check <touched files>`, after adding
     new non-`.ts` files (JSON, etc.) that Biome also formats.
- RT review (T090) on `tickAtAudioTime`/`audioTimeAtTick` and `MidiClockMap`: **pass, no blocking findings**.
  Two non-blocking advisories for a later cleanup task: (a) `MidiClockMap.toAudioTime` duplicates
  `position-sync.ts`'s `contextTime`/`performanceTime` formula instead of sharing one helper; (b) `rate.ts`'s
  `ticksPerSecond` has no guard against a zero/malformed-QPM tempo segment reaching grading as `NaN`/`Infinity`.
- Full gate run at this checkpoint: `pnpm lint`, `pnpm typecheck`, `pnpm test` (565 passed, 2 skipped) and
  `pnpm test:e2e` (22 passed, 14 skipped, all three browsers plus Electron) - all green.
- Problems / open questions: none blocking. The two RT-review advisories above are open but non-blocking.
- Handoff: next = US1 (Phase 3) from T016, `tests/core/grade/expected.test.ts`. Tests-first through T016-T025 +
  T045/T089/T092/T096/T097/T101 (all `[P]`, independent files - a good place to split work), then the US1
  implementation block T026-T044/T046, with mandatory `rt-audio-reviewer` passes at T035, T037 and T091. Tree
  clean at the commit below, not pushed.

## 2026-09-20/21 - claude-sonnet-5 (relay)

- Done: T022, T032, T091 (the run schedule compiler) and T023, T033 (the run reducer) - 44/105 tasks now done.
  Two commits, both with the RT/quality gate green (`pnpm typecheck`, `pnpm lint` on touched files, full
  `pnpm vitest run`: 81 files / 643 tests passing).
- Built:
  - `src/core/schedule/play-schedule.ts` (`compilePlaySchedule`): the count-in (whole measures, extended to
    `COUNT_IN_MIN_SECONDS`, anacrusis beats clicked after it), Metronome clicks on `METRONOME_CHANNEL`, the
    graded-notes-dropped/range-sliced/shifted event list, reusing `compileSchedule` (`src/core/schedule/
    compile.ts`) for the actual `ScheduleMessage` encoding. Asserts (never silently drops) if a Score event ever
    lands on `METRONOME_CHANNEL` (R-19).
  - `src/core/timeline/beat.ts`: extracted `beatTicksAt` (and added `beatsPerMeasure`) out of
    `src/core/grade/windows.ts` so the grading windows and the Metronome's click spacing share one definition of
    "a beat" - they must never disagree about what a beat is, and this feature is the first caller that needed it
    in two places at once.
  - `src/core/play/run.ts` (`playRunReducer`, `createIdleRun`): the pure `idle -> countIn -> running ->
    finished/stopped/aborted` state machine, driven only by `position`/`ended`/`stop`/`audioLost`/`reliability`
    actions the controller passes in - never a timer. Emits `soundInput` from `input` actions so the musician's
    own key always sounds (FR-006); records every `input` regardless of phase (the count-in exclusion from
    grading is `gradePerformance`'s own window filter, D-4, not the reducer's job).
- Design corrections made along the way (documents fixed first, per AGENTS.md section 4, not worked around):
  - `contracts/play-run.md` 1.1.0 -> 1.1.1: `compilePlaySchedule` needs `Score.measures` as a parameter (meter,
    `nominalTicks`, `beatOffsetTicks` live there, not on `PlaybackTimeline`) - the signature in the contract was
    incomplete. Also documented that `PlayScheduleOptions.range.toPassIndex` is **exclusive**, matching
    `src/core/grade/expected.ts`'s use of `LoopPassSpan` (not `src/core/practice/loop.ts`'s inclusive
    `ResolvedLoop` convention) - the two range semantics disagree across the codebase and Play's two range
    consumers (the schedule and the expected notes) must use the same one.
  - `PlayScheduleOptions` gained `tempoPercent` (contract same bump): found by the mandatory T091
    `rt-audio-reviewer` pass - the count-in was being sized against nominal tempo while the worklet applies
    `RunSettings.tempoPercent` uniformly to the whole schedule including the count-in, so `COUNT_IN_MIN_SECONDS`
    would not actually hold at any tempo percentage other than 100. Fixed before commit, with a regression test
    (`tests/core/play/play-schedule.test.ts`, the 200%-tempo case) and reusing `src/core/tempo/rate.ts`'s
    `audioTimeAtTick` instead of a second tick-to-seconds formula (the reviewer's second, non-blocking finding).
- RT review (T091) on `src/core/grade/grade.ts` (latency compensation) and `src/core/schedule/play-schedule.ts`
  (schedule compiler): **pass**, one should-fix finding (the `tempoPercent` gap above, applied) and one advisory
  (the duplicate tick-to-seconds formula, also applied). A third finding was logged as informational only - a
  pre-existing, out-of-branch-scope allocation in `score-player.processor.ts`'s position-report path
  (`{ ...msg, ... }` inside the `onMessage` callback reached from `process()`) - flagged for a future RT ticket
  against features 001/002's worklet code, not fixed here (out of this task's scope).
- Not started this session, found while reading ahead: T024/T034 (sub-block rendering in
  `score-player.processor.ts`) needs more than the file it touches suggests. Checked `spessasynth_core`'s type
  declarations directly (`node_modules/.pnpm/spessasynth_core@4.3.22/.../dist/index.d.ts`): `SpessaSynthProcessor
  .noteOn`/`.noteOff` take no frame argument - only `.process(left, right, startIndex?, sampleCount?)` supports a
  partial-buffer offset. So "render each block in the sub-blocks `DispatchState.splits` already contains"
  (research R-02) means `processBlock` itself must call `synth.process(...)` between applying each sub-block's
  events, split by split - which means `SynthInterface` needs a `process` method added, `processBlock`'s
  signature must change to take the audio buffers, and **every existing call site** in
  `tests/engine/worklets/score-player.timing.test.ts` and `score-player.live.test.ts` (currently
  `proc.processBlock(BLOCK_SIZE)`, no buffers) needs updating, plus `tests/fakes/recording-synth.ts` needs a
  `process()` implementation that logs render calls so a test can assert an event landed between the right two
  render calls (there is no other way to observe "sample-accurate" from Node without real audio). This is real
  scope, not a one-line change, and it is the actual RT hot path (`AudioWorkletProcessor.process()`), so it
  deserves a session with room to write the test, implement, verify every pre-existing worklet test still passes,
  and run the mandatory `rt-audio-reviewer` pass (T035) without rushing - stopped here rather than starting it
  with too little runway left.
- Problems / open questions: none blocking. The out-of-scope worklet allocation noted above is a candidate for a
  separate task if the user wants it tracked; not added to `tasks.md` since it belongs to 001/002, not this
  feature.
- Handoff: next = T024 `tests/engine/worklets/score-player.timing.test.ts` (extend) for sub-block rendering, per
  the design note above - write the test first, confirm it fails, then T034 (`score-player.processor.ts`) and its
  mandatory RT review T035. After that: T025 (`channelVolume` message, `dispatch.test.ts`/`score-player.live
  .test.ts` extend) + T036 + its review T037, then the rest of the US1 implementation block (T038-T044, T046) and
  the two remaining US1 test files T096/T097/T045 (independent, `[P]`, could be done any time before the
  Checkpoint). Tree clean at the commit below, not pushed.
