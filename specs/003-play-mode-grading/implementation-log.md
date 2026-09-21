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

## 2026-09-21 - claude-sonnet-5 (relay)

- Done: T024, T034, T035, T025, T036, T037, T038 - 51/105 tasks now done. Both mandatory RT reviews (T035, T037)
  passed. Full gate (`pnpm lint`, `pnpm typecheck`, `pnpm vitest run`: 648 tests) green throughout.
- **T024/T034/T035 - sub-block rendering (research R-02, SC-002)**: `dispatch.ts`'s `DispatchState.splits` was
  already correct and tested but nothing consumed it - `processBlock` applied a whole block's events up front and
  rendered the block in one `synth.process()` call, so every event landed at the block boundary (up to ~2.7 ms
  error at 128 frames/48 kHz). `processBlock`'s signature changed from `(blockSize: number)` to `(left, right)`
  (buffers), and it now renders each sub-block in the pieces `splits` marks out, applying every event exactly at
  its own frame between two partial `synth.process()` calls. `SynthInterface` gained an optional `process()`
  method; the real `AudioWorkletProcessor.process()` no longer renders separately after `processBlock()` - it's
  the same call now. All three call sites of the old signature (`score-player.timing.test.ts`,
  `score-player.live.test.ts`, `synth-onset.test.ts`) updated. `tests/fakes/recording-synth.ts` gained a
  `process()` that logs `render:<framesSoFar>:<count>` and appends the cumulative frame count onto every
  `on:`/`off:` entry, which is the only way to observe sample-accurate sub-block placement from Node without real
  audio - used by the new T024 tests: one confirming a mid-block event fires at its exact frame (not frame 0 or
  the block edge), and a 10-minute simulated run (48 kHz, 128-frame blocks, four tempo/click-spacing segments
  standing in for tempo and meter changes) confirming every click lands within SC-002's 3 ms of an independently
  recomputed expected frame, with no growing error over the run. Confirming the new tests failed first surfaced a
  real trap: driving the *new* `processBlock(left, right)` call against the *old* `(blockSize: number)` signature
  doesn't fail cleanly - `blockSize` silently binds to the `Float32Array`, and `currentFrame += blockSize`
  string-coerces `currentFrame` into a string that concatenates on every call, producing quadratic blowup that
  hangs a 225 000-block loop. Confirmed the single-block test failed correctly instead (a clean assertion
  mismatch) rather than forcing the 10-minute test through the broken interface. T035 (`rt-audio-reviewer`):
  **pass**, no blocking findings; one advisory noted the pre-existing (not from this change) unused volume-ramp
  state (`currentGain` is computed every block but never multiplied into the rendered samples anywhere) - logged
  below, not fixed here, out of this task's scope.
- **T025/T036/T037 - `channelVolume` message (research R-02, mute without touching the schedule)**: added to
  `receiveMessage`'s switch, handled entirely off the hot path exactly like `volume`; `gain` is 0..1 linear (same
  convention as `volume`) converted to CC7 via `round(gain * 127)`. `AudioEngine.setChannelVolume(channel,
  volume)` (0..100, matching `setVolume`) added to `web-audio-engine.ts` and to the `AudioEngine` port interface.
  `dispatch.test.ts` needed no change for this task despite being named in T025's line - `channelVolume` is a port
  message the pure dispatch/event layer never sees (R-02: "the events stay in the schedule, so muting cannot
  change a single tick of the run"); the test instead extends `score-player.live.test.ts`, where the file's other
  message-handling tests already live. T037 (`rt-audio-reviewer`): **pass**, three advisories, one applied before
  commit (both `volume` and `channelVolume` now guard non-finite `gain` with `Number.isFinite` before the clamp,
  since `Math.min(1, NaN)` survives the old clamp as `NaN`); the other two (validate `channel` once a real caller
  exists at T067; CC7 is an unramped step, unlike master volume - flag only if audible in manual/E2E testing) are
  logged here, not blocking, deferred to those later tasks.
- **T038 - the assumed Latency profile**: `AudioEngine.latencyProfile()` returns `{ outputLatencyMs: <from the
  existing latency() computation>, inputLatencyMs: 0, source: 'assumed', measuredAt: null }`. Checked first
  whether feature 001's R-12 dispatch-delay estimate (`LatencyInfo.keyToSoundMs`) had anything to reuse - it does
  not: `keyToSoundMs` is hard-coded `null` everywhere in the tree today (the `LATENCY_SAMPLES` constant exists,
  nothing populates it), which is not a feature-003 regression and is not on feature 001's own remaining task list
  (T138/T139/T141) either. `inputLatencyMs: 0` is data-model §8's own documented fallback for exactly this case
  ("0 where nothing is known"), and the dependency notes are explicit that T038's assumed profile, not the real
  R-12 estimate, is what US1 needs - T056-T058 (US2's tap calibration) produce the *measured* profile instead. No
  new task added; noted here so a future session does not mistake the always-0 `inputLatencyMs` for a bug.
- Contract bumps: `specs/001-score-viewer-listen/contracts/worklet-protocol.md` 1.1.0 -> 1.2.0 (sub-block
  rendering behaviour note, `channelVolume` row) and `specs/001-score-viewer-listen/contracts/ports.md` 1.1.0 ->
  1.2.0 (`AudioEngine.setChannelVolume`, and a note that T038's `latencyProfile` lands in the same 1.2.0 since
  both are additive and land in this feature); `WebAudioEngine`'s own `WORKLET_PROTOCOL_VERSION` constant bumped
  to match.
- Problems / open questions: none blocking. The unused volume-ramp state (T035's advisory) and the two T037
  advisories above are open but non-blocking, deferred to the tasks noted.
- **T096/T031 - the grade worker**: resolved the design question flagged above. `src/workers/grade.worker.ts`
  exports two things: `handleMessage` (the worker side, `grade` -> `graded`/`error`, identical pattern to
  `score.worker.ts`) and `requestGrade(worker, input, requestId, timeoutMs)` (the main-thread client "and its
  message handling in the controller" from T031's own task line) - a small `Promise`-based helper against a
  minimal `GradeWorkerLike` surface (`postMessage`/`addEventListener`/`removeEventListener`), matching replies by
  `requestId` (a stale reply after a timeout, or for an earlier request, is ignored) and resolving
  `{ ok: false, reason: 'timeout' }` after `timeoutMs` instead of hanging. Kept both in one file rather than
  inventing a new one, since `plan.md`'s file tree has no separate client module and this stays decoupled from
  `PlayNoticeCode`/`app/play-session.ts` - T039 is the only caller and turns a non-`ok` result into whatever
  notice fits the run. T096 (`tests/engine/workers/grade-worker.test.ts`, 8 tests) covers the round-trip
  (including a structured-clone check via `JSON.parse(JSON.stringify(...))`), a malformed input producing `error`
  not a throw, stale-`requestId` replies being ignored, and the timeout path with `vi.useFakeTimers()` (real
  5-second waits would make the suite slow for no benefit). Confirmed T096 failed first the honest way: wrote the
  implementation, then moved it aside, ran the test (`Cannot find module`), then restored it and reran (8/8 pass) -
  written together because the worker/client split was itself the open design question, but verified test-first
  rather than skipping the check now that the design was settled.
- Handoff: next = T039 (`src/app/play-session.ts` controller - compile the run schedule, drive the reducer from
  position reports, record MIDI through the clock map, grade through the worker via `requestGrade` when the run
  ends). T040-T044, T046 continue the US1 implementation block in file order after that; T045
  (`tests/ui/grade-marks.test.ts`) and T097 (`tests/engine/play-session.test.ts`) are independent `[P]` tests that
  can be written any time before the Checkpoint - T097 in particular should now be straightforward since
  `requestGrade`'s shape is settled. Tree clean at the commit below, not pushed.

## 2026-09-21 - claude-sonnet-5 (relay)

- Done: T097, T039 - 56/105 tasks now done. `tasks.md`'s own Dependencies section says "T097 blocks T039"
  (test-first, Constitution IV), so T097 was written and confirmed to fail (`Cannot find module`) before T039's
  implementation, even though the previous hand-off suggested T039 first - the log's suggestion was looser than
  the file's own recorded dependency, and the dependency wins. Full gate (`pnpm lint`, `pnpm typecheck`,
  `pnpm vitest run`: 662 tests) green throughout.
- **T039 - `PlaySessionController` design**: research R-01 names the file but not its shape; this session designed
  it against the existing contracts. `start(options)` builds `expected`/`playedAlong` (`src/core/grade/expected.ts`),
  compiles the run schedule (`compilePlaySchedule`), loads and plays it, and dispatches `start` to
  `playRunReducer`. `reportPosition(nowMs)` is the one place position reports enter - called every animation frame
  by whichever caller owns the rAF loop (T040, mirroring how `mx-score-view` already drives its own cursor tick;
  kept out of this controller so `tests/engine/play-session.test.ts` can run under vitest's `node` environment,
  which has no `requestAnimationFrame`). MIDI input is recorded through `MidiClockMap` on every `noteOn`/`noteOff`/
  `sustain` event. Grading goes through `requestGrade` (T031) when the reducer's `runEnded` effect appears, never
  `gradePerformance` called inline - this file does not import `src/core/grade/grade.js` at all.
- **R-16's recording tail, without a timer**: the run must keep recording past the worklet's own `ended` event
  until the last expected note's late claim window has passed. Rather than a `setTimeout` (unnecessary here, since
  `src/app` is not the RT path - Constitution I only forbids timers in `AudioWorklet.process()`), the controller
  tracks `audioEndedAtMs` (the `nowMs` of the last `reportPosition` call when the engine's `'ended'` event arrived)
  and keeps comparing later `reportPosition(nowMs)` calls against it, dispatching `ended` to the reducer once
  `nowMs - audioEndedAtMs >= tailMs`. This keeps the whole run genuinely "driven by position reports" (T097's own
  phrase) with no second clock, and makes the tail trivially testable: the test just calls `reportPosition` with a
  later `nowMs`, no `vi.useFakeTimers()` needed. `tailMs` is computed once at `start()` from the last expected
  note's `claimLateTicks` (`resolveWindows`), converted to ms at the local tempo.
- **`AudioEngine.clockPair()` - found missing (play-run.md 1.1.1 -> 1.1.2, ports.md 1.2.0 -> 1.3.0)**: `MidiClockMap`
  (T011) needs a fresh `(contextTime, performanceTime)` pair to convert a MIDI message's `timeStampMs`; research
  R-04 names `AudioContext.getOutputTimestamp()` as the source (the same pairing `position-sync.ts` already uses
  for the cursor) but nothing in `AudioEngine` exposed it. Added `clockPair(): ClockPair | null` to the port,
  `WebAudioEngine` (wraps `getOutputTimestamp()` directly) and `FakeAudioEngine`. Used both for MIDI timestamp
  mapping and, at `start()`, to anchor `startAudioTimeSec` ("audio time of run tick 0") to the real audio clock
  rather than guessing.
- **Tempo-space finding in `gradePerformance` (grading.md 1.1.1 -> 1.1.2, new task T106, not fixed here)**: working
  out what `GradeInput.tempo` the controller should pass surfaced a real mismatch already living in `grade.ts`
  (T030, RT-reviewed at T091, never caught because every existing test's `tickMap` has
  `countInTicks - rangeStartTick == 0`). Step 1's `tickAtAudioTime` call needs `tempo` in **run-tick space** (0 =
  count-in start) for the tickMap's additive shift to recover the right timeline tick - verified by hand: the
  compiled schedule's count-in duration is sized against the tempo *at rangeStart*, which only lines up with
  `tickAtAudioTime`'s first segment when `tempo`'s segment 0 also starts at run tick 0 with that same tempo (true
  for the shifted/run-tick tempo map, false in general for the raw timeline one). But `resolveWindows` and
  `passAtTick`, fed the same `tempo` value, key their lookups by `ExpectedNote.onsetTick`/`message.tick`, which are
  **timeline**-tick space - the opposite space. `src/app/play-session.ts` now passes the schedule's own shifted
  tempo (reconstructed from `ScheduleMessage.tempoTick`/`tempoQpmNum`/`tempoQpmDen`, `Constitution II` - reused,
  not recomputed) for `GradeInput.tempo`, which makes the primary matching axis correct in general; the
  controller's own tail-window computation (above) uses `timeline.tempo` directly instead, since it only needs
  the timeline-tick-space lookup. The latent bug inside `gradePerformance` itself - narrow (window sizing and
  reliability-pass attribution only, when a run has both a count-in/range shift and a mid-range tempo change) - is
  logged as T106 rather than fixed here, since it touches already-reviewed code outside this task's file.
- **T097** (`tests/engine/play-session.test.ts`, 6 tests) drives the controller with `FakeAudioEngine` (extended
  this session with `clockPair`/`latencyProfile`, both missing before - `latencyProfile`'s absence was silent
  because `tests/` is outside `tsc --build`'s project graph and nothing had called it yet), a new
  `tests/fakes/fake-midi-input.ts`, and a `FakeGradeWorker` mirroring T096's own double. Covers: `countIn` never
  advances except on a `position` report; `position` at the count-in boundary produces `runStarted`; a MIDI message
  round-trips through the clock map with both `audioTimeSec` and `timeStampMs`; the worklet's `ended` event alone
  is not enough to grade (still within the tail) and a later, later-`nowMs` `reportPosition` call is; grading goes
  through `FakeGradeWorker.posted`, compared against `gradePerformance(input)` run directly in the test for
  reference (never inside the controller); further frames after `finished` never post a second grade request;
  `stop()` produces `complete: false`; a worker that never replies resolves `onGradeFailed('timeout')` via
  `requestGrade`'s own timeout, not a hang.
- Handoff: next = T040 (`src/ui/elements/mx-mode-switch.ts` - add Play, the unavailable reason, the
  `playNothingToGrade` notice for a Score with nothing gradable, and `src/ui/state/playState.ts`). T040 is also
  where a `PlaySessionController` gets wired into `session.ts` for real (an rAF loop calling `reportPosition`,
  mirroring `mx-score-view`'s own `tick`) - nothing does that yet, so T039's controller is exercised only by
  T097's fakes so far. T041-T044, T046 continue the US1 implementation block after that; T045
  (`tests/ui/grade-marks.test.ts`) is still open and independent `[P]`, can be written any time before the
  Checkpoint. Tree clean at the commit below, not pushed.

## 2026-09-21 - claude-sonnet-5 (relay)

- Done: T040, T045, T041 - 59/107 tasks now done (T107 added below). Full gate (`pnpm typecheck`, `pnpm vitest
  run`: 670 tests) green throughout; `pnpm lint` has one pre-existing error (verovio worker, string concat) and
  220 pre-existing warnings unrelated to this session's files, confirmed by stashing and re-running before
  touching anything.
- **T045 written and confirmed to fail first the honest way**: `tests/ui/grade-marks.test.ts` imports
  `drawGradeMarks` from a module that did not exist yet (`Cannot find module`), then T041 made it pass.
- **T040 scope, decided narrower than the previous hand-off's guess**: the hand-off above suggested T040 also
  wires `PlaySessionController` into `session.ts` for real. `tasks.md`'s own T040 line names only
  `mx-mode-switch.ts` and `playState.ts` - same precedent as the 2026-09-21 T097/T039 entry ("the log's suggestion
  was looser than the file's own recorded dependency, and the dependency wins"). Implemented exactly that: `AppMode`
  in `practiceState.ts` gained `'play'`; `mx-mode-switch.ts` adds a Play radio gated by Web MIDI availability only
  (FR-045, same treatment as Practice's own radio - score content never disables a mode radio in this codebase);
  switching to Play with a score that has no pitched part (`ScoreSummary.parts.every(p => p.percussion)`) raises
  `playNothingToGrade` via `noticeState` rather than blocking the switch (the spec's edge case says the app
  "reports" nothing to grade, and `startPractice`'s identical `practiceNothingToPlay` case only reports too,
  on starting a session, never disables the Practice radio for an empty score); added its English wording to
  `en.ts` (one line, not the rest of T043's table) since `mx-notice-tray` otherwise shows the raw code.
  `playState.ts` is new, mirroring `practiceState.ts`'s store shape (`get`/`subscribe`/mutators/`__PLAY_STATE__`
  e2e seam) with `run: PlayRun | null` and `grade: Grade | null`, plus a `clear()` for FR-035 that nothing calls
  yet (T107 will).
- **Found missing while implementing T040 - new task T107**: no task from T040 to T046 names `src/app/session.ts`,
  but T046's e2e test ("starting a run from an open Score") and the US1 Checkpoint both need a working "switch to
  Play, press Play, get a Grade" path, which only wiring `PlaySessionController` into `session.ts` provides. Logged
  as T107 (`tasks.md`, before T046) rather than folded into T040, per AGENTS.md section 4 ("missing work becomes a
  new task") - it is a distinct, multi-file piece of work (constructing the controller and a real
  `GradeWorkerLike`, branching `handlePlay`/`pause`/`stop`/`measureclick` for `'play'`, an rAF loop, a default
  `RunSettings` before US3's panel exists, the `playNothingToGrade` check on actually starting a run). Not started
  this session.
- **T041 design decision - canvas, not DOM classes**: `plan.md`'s repo map calls `grade-marks.ts` "`NoteResult` ->
  mark classes", which read as CSS classList manipulation (`highlight.ts`'s pattern). Rejected: Verovio's rendered
  SVG note groups have no `getBBox()` support in the jsdom test environment, and `practice-marks.ts` already
  solved exactly this problem (a shape overlay on Score notes) with a canvas function taking caller-resolved
  `DOMRect`s - proven, already wired into `mx-score-view`'s render loop, and trivially testable with a recording
  `ctx` fake. `drawGradeMarks` follows that precedent instead: `wrongPitch` draws a cross strictly above the
  notehead, `missed` a hollow ring strictly outside it, `early`/`late` a caret strictly to the note's left/right
  (the one shape, mirrored - told apart by position, not a different primitive sequence, exactly R-11's own
  point), and an extra note a diamond at a caller-supplied lane rect. `visible: false` draws nothing at all
  (FR-035's "switchable off"). Colours are the Okabe-Ito palette, added as `--grade-*` tokens in `tokens.css` (not
  `score.css`, despite the task line naming that file - `tokens.css` is this codebase's one `:root` owner, and
  score.css gained a comment cross-referencing them plus documenting that the Grade layer shares `mx-score-cursor`'s
  canvas with the cursor and practice marks) and hardcoded as matching hex literals in `grade-marks.ts` itself
  (same treatment `practice-marks.ts` and `mx-piano-keys.ts` already give the same palette, for a pure,
  easily-tested draw function with no DOM/`getComputedStyle` dependency).
- Handoff: next = T042 (`mx-grade-panel.ts`), T043 (`en.ts` reason wording), T044 (live pitch marking in
  `play-session.ts`/`grade-marks.ts`), T046 (e2e test) - and **T107 must land before T046 can pass**, since T046
  drives a real run through the UI. `grade-marks.ts` is ready for T042/T044 to consume (`GradeMarksOptions`,
  `GradeMark`). Tree clean at the commit below, not pushed.

## 2026-09-21 - claude-sonnet-5 (relay)

- Done: T043, T042 - 61/108 tasks now done. Full gate (`pnpm typecheck`, `pnpm vitest run`: 675 tests) green
  throughout; the one `pnpm lint` error remains the same pre-existing verovio-worker one, confirmed unrelated
  again.
- **T043**: added `en.notices`' five remaining `PlayNoticeCode` strings and a new `en.play` section
  (`panel` labels, `reasons` templates keyed by `ResultReason['code']`). Followed the codebase's existing
  convention exactly (`mx-practice-panel.ts`'s `{n}`/`{from}`/`{to}` templates, filled by `.replace()` at the call
  site) rather than putting formatting logic in `en.ts` itself, even though R-13's own wording ("`en.ts` turns
  each into the plain words") reads as if `en.ts` should own the function - `en.ts` has no imports anywhere else
  in the tree and every other parameterised string is interpolated by its caller, so a new
  `src/ui/format/reason-text.ts` (beside the existing `note-name.ts`) does the interpolation, calling
  `midiNoteName()` for `expectedKey`/`playedKey` and writing the octave *count* ("one octave" / "two octaves"),
  not only its direction, into `{octaves}`. Checked all four FR-030 examples against the templates by hand; they
  match verbatim ("F3 played, F4 written - one octave too low.", etc).
- **T042**: `mx-grade-panel.ts`, a pure view of `playState`/`practiceState` (same treatment `mx-practice-panel.ts`
  documents - "it renders what it is given and decides nothing"). The two figures use `GradeSummary.notesCorrect`/
  `notesOnTime` through `en.play.panel.figure`'s template; the six counts are `GradeSummary.counts`' own fields;
  the reason line resolves `playState.selectedNoteId` against `grade.results` and calls `reasonText`. Added
  `selectedNoteId: NoteId | null` and a `selectNote()` mutator to `playState.ts` (T040's file) for this to read -
  `clear()` now resets it too. Wrote `tests/ui/grade-panel.test.ts` even though T042 has no assigned test task
  (unlike `mx-mode-switch.ts`/T040, this file has real logic - percent rounding, template filling, the reason
  lookup - and `tests/ui/practice-panel.test.ts` is this codebase's own precedent for testing a panel like this).
- **Extras have no reason shown here, on purpose**: an extra note has no notehead of its own (R-11, the same
  limitation `practice-marks.ts` already documents for wrong-pitch/wrong-octave/extra), so nothing on the Score
  can be clicked to select one under this task's "selected mark" wording. FR-031's mistake stepper (US2, T051) is
  the general way to step through every mistake including extras; not narrowing T042 further than that.
- **T107's scope grew by one more integration gap, found while writing T042**: `mx-grade-panel.ts` reads
  `playState.selectedNoteId`, but nothing sets it yet - that needs `mx-score-view.ts`'s `onClick` to resolve a
  `g.note` click to a `NoteId` in Play mode (today it only resolves `.measure` clicks) and its render loop to
  actually call `drawGradeMarks` when `mode === 'play'` (today only `drawPracticeState` is wired in that loop, T041
  built the pure function but nothing calls it). Folded both into T107's own description rather than opening a
  third integration task - it is the same "wire the finished pieces into the running app" work T107 already
  covers, just one more file (`mx-score-view.ts`) alongside `session.ts`.
- Handoff: next = T044 (live pitch marking in `play-session.ts`/`grade-marks.ts` - the cheap same-pitch test
  during the run, distinct from T107's post-run display wiring), then T107 (now the largest remaining piece of
  US1: `session.ts` construction/branching/rAF plus `mx-score-view.ts`'s Grade layer and note-click selection),
  then T046 (e2e, blocked on T107) and the US1 Checkpoint. Tree clean at the commit below, not pushed.

## 2026-09-21 - claude-sonnet-5 (relay)

- Done: T044 - 62/108 tasks now done. Full gate (`pnpm typecheck`, `pnpm vitest run`: 680 tests) green; `pnpm
  lint` unchanged (same one pre-existing verovio-worker error; the new test file's `controller.getRun()!` pattern
  only adds warnings, matching every other test already in that file, not a new class of issue).
- **`checkLiveMark` design**: no code anywhere produced `PlayEffect`'s `liveMark` variant yet - `playRunReducer`
  (T033) never touched it, confirming R-11's contract text ("cheap and approximate... says nothing about timing")
  describes controller-side logic, not the pure reducer's. `PlaySessionController.handleMidiEvent` now calls a new
  `checkLiveMark(key)` after dispatching every `noteOn` (never `noteOff`/`sustain`): it converts
  `run.positionRunTick` to timeline-tick space with the same `runTick - countInTicks + rangeStartTick` formula
  `PlayTickMap`'s own comment documents, finds the nearest same-key `ExpectedNote` within one quarter note
  (`this.ppq` ticks - generous and simple, not the real per-strictness claim window that `resolveWindows` computes
  for actual grading), and - once per onset (`liveMarkedOnsets`, cleared in `start()`) - calls
  `this.callbacks.onEffect({ type: 'liveMark', noteIds })` directly, bypassing `dispatch()`/`applyEffects()`
  entirely since this is deliberately outside the reducer's own state (FR-011a: only the Grade, never this marker,
  can be "wrong"). A press that matches nothing is silently ignored - D-3 again: the marker can only ever say
  "correct," never "wrong."
- **`drawLiveMarks` (`grade-marks.ts`)**: a dashed sky-blue ring, deliberately both a different shape (dashed vs
  solid) and colour from the Grade's own `missed` ring, so a musician who has both layers in view during the
  run->Grade transition never reads one as the other. No cross variant exists for this function at all - by
  construction, a live mark cannot represent a wrong pitch.
- Extended existing test files rather than opening new ones (neither T044 nor its two host files have their own
  test task): three cases in `tests/engine/play-session.test.ts` (match emits exactly one `liveMark`; a wrong
  pitch emits none; a held/repeated key at the same onset emits at most one, not one per press) and two in
  `tests/ui/grade-marks.test.ts` (`drawLiveMarks` draws a dashed ring and nothing else; `visible: false` draws
  nothing). Improved the test file's `recordingCtx` fake to capture `setLineDash`'s actual segments argument
  (previously hardcoded to `[]` regardless of what was passed) so "dashed" could be asserted for real rather than
  merely "`setLineDash` was called," which every existing shape already does.
- Handoff: next = T107 (`session.ts` construction/branching/rAF, `mx-score-view.ts`'s Grade layer and note-click
  selection - the largest remaining piece of US1), then T046 (e2e, blocked on T107) and the US1 Checkpoint (full
  gate, `quickstart.md`'s manual verification is Polish-phase T082, not required for the Checkpoint itself). Tree
  clean at the commit below, not pushed.

## 2026-09-21 - claude-sonnet-5 (relay)

- Done: T107 - 63/108 tasks now done. Full gate (`pnpm typecheck`, `pnpm vitest run`: 680 tests) green; `pnpm lint`
  unchanged (same one pre-existing verovio-worker error). No RT review: `session.ts`/`mx-score-view.ts` are app/ui
  layer, same reasoning T039/T044 already recorded - the new rAF work (`reportPosition`) runs on the main thread
  via `requestAnimationFrame`, not the audio thread.
- **`Session` gets a `PlaySessionController` field, built once** alongside a real `Worker`-backed `GradeWorkerLike`
  (`new Worker(new URL('../workers/grade.worker.ts', ...))`, same pattern as `scoreWorker`/`verovioWorker`).
  `startPlay()` mirrors `startPractice()` exactly: `partOptions`/`handOptions` pick the preselected pitched part,
  `buildExpectedNotes(...).length === 0` (not a lighter percussion-only check) is the authoritative
  `playNothingToGrade` gate per T107's own task text, and a default `RunSettings` (whole Score,
  `PLAY_STRICTNESS_DEFAULT` = `'beginner'`, `PLAY_COUNT_IN_MEASURES`) stands in until US3 (T065/T066) gives the
  musician a panel. `handlePlay()`, the transport's `stop` callback and the mode-change subscription
  (`leavePlay()`, symmetric to `leavePractice()`) all branch on `practiceState.get().mode === 'play'`.
  `mx-grade-panel` (T042, never appended anywhere until now) is created and prepended to `#side-panel`.
- **Double-sounding bug avoided, not just fixed**: `Session`'s own `midiInput.on(...)` handler already calls
  `audioEngine.liveNoteOn/liveNoteOff/liveSustain` unconditionally for FR-006's "own notes sound through the
  app's instrument" - but `PlaySessionController.applyEffects` does the exact same thing itself via the reducer's
  `soundInput` effect once a run is live. Traced this before writing any Play code (not found by testing) and
  gated all three calls on `mode !== 'play'`; `deviceLost`'s `liveAllOff()` stays unconditional since it is a
  safety action, not a per-message duplicate.
- **`mx-score-view.ts` keeps one rAF loop, not two**: T039's own doc comment already said `reportPosition` should
  be driven "exactly like `mx-score-view` drives the cursor" - added a `PlayPositionReporter` structural interface
  (`{ reportPosition(nowMs): void }`) defined locally in `mx-score-view.ts` rather than importing
  `PlaySessionController` from `src/app/` (Constitution V layering: `ui` must not depend on `app`); `setPlaySession()`
  stores it, `tick()` calls it every frame before `updateCursor()`. `updateCursor()` gained a `mode === 'play'`
  branch (`drawPlayState`, `playDrawn` flag) mirroring the existing Practice branch exactly, including clearing the
  canvas on the way out. `drawPlayState` draws `grade.results` through `drawGradeMarks` once a Grade exists,
  otherwise `playState.liveMarkedNoteIds` through `drawLiveMarks` - never both (matches FR-011a, `setGrade` already
  clears `liveMarkedNoteIds`). **Extras are not drawn on the Score yet** (no lane-rect geometry exists for a note
  that was never written) - still counted correctly in `mx-grade-panel`, just invisible on the canvas; logged as a
  known gap rather than a new task, since nothing in tasks.md through the Checkpoint needs it drawn.
- **Note selection**: `onClick` now checks, in Play mode only, whether the clicked element's id is one of
  `grade.results`' own `noteIds` (`isGradedNoteId`) before falling through to the existing `.measure` handling -
  authoritative against the actual Grade rather than guessing at a CSS class. A measure click during a Play run is
  now a deliberate no-op (`FR-002`: the clock never waits, and seeking would desync the controller's own tracked
  position from the audio engine it shares with the Listen transport).
- **Found and fixed by manual browser testing, not by any unit test**: loaded `eight-measure-melody.musicxml` in
  the real dev server (`pnpm dev` via `preview_start`), switched to Play, pressed Play, and watched a full
  count-in -> running -> graded run happen live, `mx-grade-panel` rendering the real two figures and six counts,
  and clicking a missed notehead correctly showing "C4 written, nothing played here." in both the panel and (via
  `drawGradeMarks`) the Score's own overlay - zero console errors the whole way. Then switched back to Listen and
  found the Grade panel and marks were still showing: `leavePlay()`'s first draft (written from the FR-035 text
  without re-reading it closely enough) only stopped an in-progress run and reasoned "`playState.clear()` at the
  next `startPlay()` is what actually discards it" - true for the *next run* half of FR-035, false for the *mode
  changes* half, which is the case that was actually on screen. Added the missing `playState.clear()` call to
  `leavePlay()`, confirmed live that switching to Listen now clears the panel and the canvas layer immediately,
  and confirmed MIDI input during a run (`e2e-midi` window event, the same seam `tests/e2e/*.spec.ts` uses) is
  recorded and reflected in the Grade without any console error - this is exactly the class of bug the unit test
  suite (fakes on both sides) could not have caught, since every existing test constructs a fresh `PlayState`, and
  it would only have shown up once T046's e2e test happened to switch modes after a Grade, which had not been
  written yet.
- Handoff: next = T046 (`tests/e2e/us1-play.spec.ts`), the last task before the US1 Checkpoint. Read
  `tests/e2e/us1-open-view.spec.ts` and the `e2e-ready`/`e2e-midi` window seams (`src/app/session.ts`'s
  constructor) for the pattern - this session's manual verification above already exercised every scenario T046
  needs to automate (count-in, a MIDI-driven run, a Grade with marks and a clickable reason, mode-change clearing)
  and found the one bug in doing so, so T046 should mostly be a matter of writing it down as Playwright, not
  further discovery. Tree clean at the commit below, not pushed.

## 2026-09-21 - claude-sonnet-5 (relay)

- Done: T046 (`tests/e2e/us1-play.spec.ts`, two tests) and T109 (found writing it) - **107/108 tasks now done,
  the US1 Checkpoint reached**. Full gate green: `pnpm typecheck`, `pnpm lint` (`biome check .`, exit 0, same
  pre-existing warnings as every prior session), `pnpm test` (680 Vitest tests), `pnpm test:e2e` (28 passed, 16
  skipped for WebKit's missing AudioContext/Web MIDI, one Chromium Listen-mode timing test flaked once under
  4-worker parallel load and passed clean in isolation and in a full clean re-run - not a regression, a `us2-listen.spec.ts`
  strict-timing assertion already noted as CI-sensitive).
- **`npm run preview` (Playwright's `webServer`) serves `dist/`, not live source** - the very first run of T046's
  new test failed with no "Play" radio in the DOM at all, because `dist/` was a stale build from 2026-09-20,
  predating this session's source changes entirely (T107's own Play-mode UI wasn't in it either, by luck that
  session never needed to rebuild). `pnpm build` before `pnpm test:e2e` from now on; not itself a code change, so
  no task for it, but worth the note since it cost real time to diagnose.
- **T109, gap 1 - `playState.run` was frozen from the moment a run started**: `startPlay()`
  (`src/app/session.ts`) calls `playState.setRun(this.playController.getRun())` exactly once, right after
  `start()`. Nothing else ever called it again as the run actually progressed - `PlaySessionController`'s own
  internal `run` field kept advancing correctly on every `reportPosition` (proven by `tests/engine/play-session.test.ts`'s
  fakes, which read the controller directly, never through `playState`), but the UI-facing snapshot stayed on
  `phase: 'countIn'`, `positionRunTick: 0` forever. Invisible to every existing consumer (`mx-grade-panel` only
  reads `grade`, not `run`), so nothing caught it until T046's own e2e test polled `run.phase` and saw a live
  grade panel (`grade.complete`, real `missed` counts) contradicting a `run` stuck at count-in - the run objects
  are simply two different snapshots once this is understood, but from outside it looked like the whole run had
  silently reset. Fixed by giving `PlayPositionReporter` (`src/ui/elements/mx-score-view.ts`) a `getRun()` method
  and having the one per-frame driver (`tick()`, T039's own "one rAF loop" design) call `playState.setRun(...)`
  right alongside `reportPosition` every frame - cheap even at 60 fps, since `createStore`'s `deepEqual` only
  notifies `mx-grade-panel`'s one subscriber when something in the run actually changed, and the panel's own
  `render()` is a one-line no-op while `grade` is still null.
- **T109, gap 2 - FR-007 (cursor follow) was never wired for Play mode at all**: `drawPlayState()` (T107) only
  ever drew marks; nothing called `followScrollTo` for a live run, and `startPlay()` never called `setPlayback()`,
  so `mx-score-view` had no `timeline` to convert ticks against even if it had tried. Added `followPlayCursor()`,
  called from `updateCursor()`'s Play branch: converts `run.positionRunTick` back to timeline-tick space via
  `run.tickMap` (contracts/play-run.md's own `timelineTick = runTick - countInTicks + rangeStartTick` formula,
  clamped to `rangeStartTick` during the count-in so it targets the range's first measure from the start rather
  than a meaningless negative tick), finds the covering pass the same way Listen's own cursor code already does,
  and calls the existing `followScrollTo` - no drawn cursor rectangle, mirroring `drawPracticeState`'s own
  follow-only treatment (Play's canvas is the marks layer). **Verified with a real scroll, not just "no error"**:
  drove the built app directly with Playwright (`chords/c-major-scale-and-chords.musicxml`'s own two measures sit
  at the very top of the printed page, so a naive "did scrollTop become nonzero" assertion would falsely pass or
  fail depending on unrelated layout - confirmed this by manually loading `eight-measure-melody.musicxml` and
  watching `scrollTop` stay 0 for the whole run even with follow-scroll correctly wired, because centering the
  current measure would have meant scrolling *up* from an already-0 position, which a browser clamps). The test
  instead pre-scrolls the container to 300px before starting the run, then asserts `scrollTop` moves back down
  towards 0 once the run starts - the only way to make the assertion fail if FR-007 were unwired again, using the
  Independent Test's own two-measure fixture rather than a new long one.
- **The two actual T046 tests**: `tests/e2e/us1-play.spec.ts`'s first test covers SC-009 (mode switch + Play
  click, nothing more, before a Grade exists), FR-003/FR-002 (count-in then running, both reached without any
  MIDI input), FR-006 (a well-timed press live-marks the note - the mark itself is Canvas, not DOM, so the live
  marker's appearance is the one DOM-visible proxy available for "the note sounded"), a completed Grade with a
  mix of results (the one played note plus several `missed`), and FR-030 (clicking a marked notehead's element id
  directly, via `getElementById` + a dispatched bubbling click rather than a CSS-escaped locator, since Note IDs
  are not guaranteed CSS-selector-safe) shows a non-empty plain-words reason. The second covers FR-007 (above) and
  FR-008 (`.stop-btn` mid-run yields `grade.complete === false` with a nonzero, genuinely partial `results` count).
  Both read `window.__PLAY_STATE__` (the same e2e/debugging seam `us1-practice.spec.ts` already reads through
  `__PRACTICE_STATE__`) rather than re-deriving state from pixels, since the actual marks are drawn on Canvas
  (R-11) and are not otherwise DOM-observable.
- Handoff: next = the US2 Checkpoint's first task, T047 (`tests/core/grade/overview.test.ts`). No open owner
  decisions block it. Tree clean at the commit below, not pushed. Remember to `pnpm build` before any future
  `pnpm test:e2e` run - the stale-`dist/` trap above will recur otherwise.

## 2026-09-21 17:30 - claude-sonnet-4.6 (relay)

- Done: T063, T065, T066, T067, T068 - all US3 implementation tasks complete; T069 (E2E) is next.
- **T063 (play-settings.test.ts)**: Rewrote the test to follow the pattern of practice-settings.test.ts
  exactly: i.stubGlobal('localStorage', new FakeStorage()) in eforeEach, i.useFakeTimers(), correct
  no-arg constructor for LocalSettingsStore. Tests: defaults returned for unknown score; round-trip at 85%;
  last-used tempo fallback; eviction beyond PLAY_SETTINGS_MAX verified by checking evicted id no longer
  returns its own saved value. All 5 previously broken US3 test tasks (T060-T064) now pass.
- **T065/T067 (play-session.ts)**: Already fully implemented from T107 in the last session. Range, tempo%,
  hand selection and metronomeMuted all flow through compilePlaySchedule and uildExpectedNotes exactly
  as required. Metronome mute via setChannelVolume(METRONOME_CHANNEL, 0) at line 153 was also already in
  place. Ticked both after confirming no further work needed.
- **T066 (mx-play-panel.ts)**: New src/ui/elements/mx-play-panel.ts - a pure view of playState, same
  structure as mx-practice-panel.ts. Covers: part select (multi-part scores), hand radio buttons, range
  fields (from/to measure, clear), tempo% dropdown (preset values), strictness dropdown (beginner/standard/
  strict), count-in number input, metronome mute checkbox, accompaniment checkbox. Emits playsetup custom
  events with PlaySetupChange details. Subscribes to both playState (for setup) and practiceState (for
  mode visibility). Added play.setup key group to en.ts.
- **T068 (PlaySetup state + session.ts wiring)**: Added PlaySetup interface and setSetup/updateSettings
  to playState.ts. Updated playState.clear() to preserve setup. Added setupPlay()/resolvePlaySettings()
  to session.ts (validates stored selection against Score, same logic as practice). Updated startPlay() to
  use stored RunSettings: resolves written measure range to a pass span via esolveLoop + loopRangeToPassIndices
  before passing to PlaySessionController.start(). Wires onPlaySetupChange() which saves via
  settingsStore.savePlay() and applies live metronome mute during an active run.
- **Bonus fix (mistake-stepper.ts / Grade.expected)**: mistake-stepper.test.ts was failing because the
  stepper iterated grade.results in result order (n1 tick=100, n2 tick=50), but FR-031 requires Score order
  (tick ascending). Fixed by adding expected: readonly ExpectedNote[] to the Grade interface and
  populating it in gradePerformance(); MistakeStepperStore.setGrade() now builds a tick-lookup map from
  grade.expected and sorts before storing. Updated 2 golden snapshots.
- **Gate**: pnpm typecheck clean; pnpm test 696 passed, 2 skipped (snapshot updates included). All US3
  unit tests pass. Lint has only pre-existing errors/warnings, none in files touched this session.
- Problems / open questions: none blocking.
- Handoff: next = T069 	ests/e2e/us3-play-setup.spec.ts (a range at a reduced tempo with one hand,
  settings surviving a reload). After T069, the US3 Checkpoint. Tree clean at commit ed631cb, not pushed.

## 2026-09-21 18:15 - claude-sonnet-5 (relay)

- Done: T069 `tests/e2e/us3-play-setup.spec.ts`. US3 Checkpoint reached.
- Two bugs found while writing the e2e test against the real browser (not just unit fakes), both fixed rather
  than worked around, per AGENTS.md section 4:
  - **`mx-play-panel.ts` never appeared**: its `connectedCallback` subscribed only to `playState`, but its own
    `render()` gates visibility on `practiceState.get().mode` too (line ~58). Switching to Play mode on an
    already-open Score touches no `PlayState`, so the panel stayed `hidden` forever - confirmed live in the
    Claude Browser pane before touching any source. The previous session's log entry (line 713-714 above)
    claimed the panel "subscribes to both playState... and practiceState", which the code did not actually do.
    Fixed by adding a second subscription to `practiceState`, mirroring `mx-practice-panel.ts`'s own pattern.
  - **`startPlay()` fed an inclusive `toPassIndex` where the pipeline expects exclusive**: `loopRangeToPassIndices`
    returns `ResolvedLoop`'s inclusive convention (`src/core/practice/loop.ts`), but `buildExpectedNotes` and
    `compilePlaySchedule` require the exclusive form documented in `contracts/play-run.md` ("`range.toPassIndex`
    is exclusive"). `session.ts::startPlay()` passed the inclusive value straight through, so any range
    (not just single-measure ones) silently graded the wrong notes, and a from===to range (the common case -
    looping one measure) graded *zero* notes and silently no-opped the whole run. `tests/core/play/range.test.ts`
    (T060, already `[x]`) had papered over this with a manual `+ 1` and a comment reading "Wait! ... The schedule
    compiler expects exclusive toPassIndex" - it exercised the core functions' contract but never the real
    `session.ts` call site. Fixed the actual conversion in `startPlay()` and cleaned up the test comment to state
    the contract instead of narrating the confusion.
- Verified live in the Claude Browser pane (dev server + manual file-drop, since Playwright's own `setInputFiles`
  isn't available there) before and after each fix, then confirmed with the real Playwright suite.
- **Gate**: `pnpm build` (fresh dist, per the stale-dist trap noted earlier in this log) + `pnpm typecheck` clean;
  `pnpm test` 696 passed, 2 skipped; `pnpm test:e2e --project=chromium` 12 passed, 1 skipped (electron-smoke,
  pre-existing skip); `pnpm lint` has only pre-existing errors, none on the lines this session touched in
  `session.ts` or `mx-play-panel.ts` (verified with a targeted `biome check` on just the touched files).
- Problems / open questions: none blocking. The `range.toPassIndex` inclusive/exclusive split between
  `src/core/practice/loop.ts` (inclusive) and `src/core/grade/expected.ts` / `compilePlaySchedule` (exclusive) is
  intentional per the contract but easy to get wrong again at a future call site - worth a glance if `startPlay`
  or `PlaySessionController.start` is ever refactored.
- Handoff: next = the US4 Checkpoint's first task, T070 (`tests/engine/storage/performance-store.test.ts`).
  No open owner decisions block it. Tree clean at the commit below, not pushed.

## 2026-09-21 - claude-sonnet-5 (relay)

- Done: T070-T077. US4 Checkpoint reached - all four user stories of feature 003 now work independently.
- **T070-T073 (storage)**: `StoredPerformance` (`src/core/grade/types.ts`) and a `PerformanceStore` port
  (`src/engine/ports.ts`). New `src/engine/storage/db.ts` centralises the `musicanyya` IndexedDB open/upgrade path
  (bumped 1 -> 2) so `IndexedDbScoreStore` (refactored to use it) and the new `IndexedDbPerformanceStore` share one
  upgrade regardless of which opens the database first - the version 2 `performances` store is added without ever
  touching `recentScores`.
- **T075 (replay)**: `src/core/play/replay.ts` (`compileReplay`) turns a stored log into a `ScheduleMessage` on
  the live channel, merged with the run's own accompaniment via a new `mergeSchedules` (`src/core/schedule/
  compile.ts`) that unions two schedules on disjoint channels.
- **Research R-20 (new decision, `research.md`)**: a stored performance's log is rebased to run-relative time
  (`audioTimeSec -= run.startAudioTimeSec`) at store time, in `src/app/play-session.ts`'s `storePerformance`/
  `rebaseToRunStart` - `PlayRun.startAudioTimeSec` is an `AudioContext` reading that does not outlive the run, and
  `StoredPerformanceRecord` (contracts/performance-log.md) was never given a field for it. Regrade and replay
  both always pass `startAudioTimeSec: 0` to a stored log. Documented in `contracts/performance-log.md` rule 6.
- **T074 (store on finish)**: `PlaySessionController` gains a `PerformanceStore` dependency and a `storePerformance`
  step after `onGraded`; a new `onStored()` callback fires once storage settles, so the UI refreshes its list after
  storage rather than racing it. A `scoreId === null` run (Score never itself stored) writes nothing; a storage
  failure still shows the Grade, with a new `playAttemptNotStored` `PlayNoticeCode` (contracts/play-run.md bumped
  to 1.1.3). `APP_VERSION` (new, `src/engine/config.ts`, from `package.json`) feeds `StoredPerformance.appVersion`.
- **T076 (attempts list)**: `src/ui/elements/mx-attempts-list.ts`, a pure view of a new `playState.attempts` field,
  with replay/re-grade/delete actions (`attemptreplay`/`attemptregrade`/`attemptdelete` events, wired in
  `session.ts`). New `src/app/replay-session.ts` (`ReplaySessionController`) drives `mx-score-view`'s existing
  `PlayPositionReporter` cursor-follow seam for a replay - discovered that `drawPlayState()` (marks) is already
  independent of any live run, keyed only on `playState.grade`, so replay only needed its own *position* source,
  not a second marks mechanism. Re-grade keeps every stored setting except `strictness`, taken from whatever the
  Play settings panel currently shows (AS-4.4); replay also re-grades with the stored settings unchanged, so marks
  are visible alongside the replayed audio (FR-042). A shared `session.ts::prepareStoredRun` recomputes
  `expected`/`playedAlong`/the accompaniment schedule/the tick map fresh from the current Score for both actions,
  the same way `startPlay` does for a live run - extracted `resolveRunRange` out of `startPlay` so both share it.
- **T077 (docs)**: bumped `specs/001-score-viewer-listen/contracts/storage.md` to IndexedDB schema 2 and indexed
  the `localStorage` keys features 002/003 added (`musicanyya.practice.v1`, `.play.v1`, `.latency.v1`),
  cross-referencing each feature's own contract rather than duplicating its shape.
- **Tests**: `tests/engine/storage/performance-store.test.ts`, `tests/core/play/replay.test.ts`,
  `tests/core/grade/regrade.test.ts` (T072 passed immediately - a purity/contract test of already-correct
  `gradePerformance`/`resolveWindows`, not paired with new production code), `tests/engine/replay-session.test.ts`,
  `tests/ui/attempts-list.test.ts`, and `tests/e2e/us4-attempts.spec.ts` (the Independent Test end to end: two
  attempts kept and listed with settings/summary, replayed with the cursor state transitioning correctly,
  re-graded at a different strictness without changing the stored count, deleted).
- **Gate**: `pnpm typecheck` clean; `pnpm test` 723 passed, 2 skipped; `pnpm lint` has pre-existing errors/warnings
  project-wide (28 errors, 264 warnings) but **none** on any file touched this session (checked explicitly file by
  file); `pnpm test:e2e` (all four projects, 56 tests) - 36 passed, 19 skipped (webkit has no Web MIDI/AudioContext,
  the established skip), 1 failed: `[firefox] us1-play.spec.ts`'s live-mark test (a real-time, 3-second-window
  assertion, untouched by this session) failed only under the full 16-way parallel run. Re-ran it alone (passed),
  then built and ran it against the session-start commit (2bc4d36) in a separate `git worktree` (also passed) -
  confirms CPU-contention flakiness under this machine's parallel load, not a regression from this session's work.
- Problems / open questions: none blocking. T106 (tracked, not this session's work) is the one place the
  `countInTicks - rangeStartTick` shift and a tempo change inside the graded range could still interact wrongly;
  still unaddressed. Phase 7 Polish (T078-T084, T099, T100, T103) is what remains for the whole feature.
- Handoff: next = Phase 7 Polish, starting wherever the next agent chooses among the `[P]` tasks (T078, T079, T080,
  T099, T100, T103 are independent files; T106 is also independent; T081-T084 depend on the feature otherwise
  being finished). No open owner decisions. Tree clean at the commit below, not pushed.

## 2026-09-21 17:55 - claude-sonnet-5 (relay)

- Done: T106, T100, T099, T103, T078, T080, T079, T081, T083, T084 - Phase 7 Polish, in full except T082 and the
  new T110 (below).
- **T106** (`src/core/grade/grade.ts`, `types.ts`): the fix `contracts/grading.md` 1.1.2 named - `GradeInput`
  gained `timelineTempo` (timeline-tick space), used for `resolveWindows` and the `deltaMs` qpm lookup, while
  `tempo` stays run-tick space for Step 1's `tickAtAudioTime` calls only. Both `src/app/play-session.ts` and
  `session.ts::prepareStoredRun` now pass both fields (bumped grading contract to 1.2.0). Test first
  (`tests/core/grade/tempo-space.test.ts`): a synthetic run with a non-zero count-in/range shift and a tempo
  change inside the range, asserting the note grades `onTime` only when the *timeline*-space tempo is used for
  window sizing - failed as `late` before the fix, passes after.
- **T100, T099, T103, T078, T080**: five polish tests, each a regression guard for an invariant already true by
  construction (matching the precedent T072 set) - no production code needed:
  - `tests/architecture/no-upload.test.ts`: static scan of every Play-path file for `fetch`/`XMLHttpRequest`/
    `sendBeacon`/`WebSocket` (FR-016).
  - `tests/ui/play-notices.test.ts`: `mx-notice-tray` renders no `<dialog>`/`aria-modal`/backdrop and never moves
    focus or touches `transportState` (FR-009); `mx-piano-keys` has no click handler and the only `keydown`
    listeners never touch `midiState` (FR-010).
  - `tests/core/play/long-run.test.ts`: 2080 notes (~10 minutes at 208 bpm) through the real `playRunReducer`
    then `gradePerformance` - `droppedMessages` stays 0 and the accounting invariant holds at scale (SC-007).
  - `tests/core/grade/perf.test.ts`: `gradePerformance` over the existing 500-measure fixture (2000 expected
    notes) - 25.7 ms observed against the 1 s budget (SC-006), logged not hard-asserted (this repo's perf-test
    convention, `tests/core/practice/perf.test.ts`); a second check confirms `play-session.ts`/`session.ts` never
    import `gradePerformance` directly, only `requestGrade` (the worker client).
  - `tests/core/play/device-loss.test.ts`: a `midiDeviceLost`/`midiDeviceBack` gap mid-run through
    `playRunReducer` - only the final `ended` action produces `runEnded` (SC-013: the run never stops), and the
    graded gap becomes `midiDeviceLost`/`midiDeviceBack` reliability warnings with the affected measures marked
    `unreliable`.
- **T079** (`tests/e2e/us2-grade.spec.ts`): writing this surfaced a real bug, not a test-only gap -
  `mistakeStepper.setGrade()` (FR-031's mistake stepper) was never called anywhere in `src/app/session.ts`, only
  in `mistake-stepper.test.ts`'s own isolated unit test, so `mx-grade-panel`'s stepper never had any mistakes to
  step through in the running app - `<div class="grade-stepper">` never rendered. Fixed by wiring
  `mistakeStepper.setGrade(grade)`/`setGrade(null)` alongside every `playState.setGrade`/`clear()` call (a live
  run's Grade, regrade, replay, and the three places a Grade is cleared). The e2e test itself stops a run right
  after it starts rather than timing live presses against the audio clock - `expected` stays the full configured
  range even for a stopped run (FR-008), so all 12 notes in a 3-measure range grade `missed` deterministically,
  enough to exercise the stepper, the measure overview and "practise this passage" -> Practice mode without any
  live-timing race (early attempts at live-timed multi-note presses, both wall-clock- and position-tick-anchored,
  were flaky under this machine's CPU load - the same class of flakiness already logged against
  `us1-play.spec.ts`). Stable over 5+ runs on chromium/firefox/electron (FR-047, SC-012); webkit skipped as
  every other Play spec is. Needed a `pnpm build` before the fix was visible to Playwright's `vite preview`
  server (`reuseExistingServer: true` was serving a stale `dist/`) - worth remembering for the next agent too.
- **T081**: checked `docs/agents/reference.md` and `quickstart.md` - no toolchain, command or dependency changed
  this session, nothing to update.
- **T083**: ran the `constitution-auditor` role. Verdict **compliant with notes**: the T106 fix, the RT surface
  (T034 sub-block rendering, T036 `channelVolume`) and the MusicXML/Note-ID fidelity of D-1/D-2 all check out.
  One new MEDIUM finding, logged as **T110** (below) rather than fixed inline, since a real fix touches the
  RT-reviewed timing path and deserves its own review cycle. Two LOW findings were already-tracked advisories
  from T035/T037 (worklet `currentGain` dead code, unramped/unvalidated `channelVolume`) - restated, not new.
- **T084**: full gate green - `pnpm typecheck` clean; `pnpm test` 757 passed, 2 skipped; `pnpm lint` 27 errors /
  266 warnings, all pre-existing project-wide debt except two `noExplicitAny` warnings in the new e2e file,
  matching the exact pattern `us1-play.spec.ts`/`us3-play-setup.spec.ts` already use for the same
  `window.__PLAY_STATE__` seam (net error count is *lower* than this session's start, 27 vs 28 - unrelated
  drift, not mine to explain); `pnpm test:e2e` (all four projects, 60 tests) - 40 passed, 20 skipped (the
  established webkit skip), 0 failed on this run. `us1-play.spec.ts`'s live-mark test did fail once under full
  16-way parallel load during this session (on electron, then again on firefox) and passed both times re-run
  alone - the same pre-existing CPU-contention flakiness a prior session's log already documented, not a
  regression from this session's work.
- Problems / open questions: **T110** (new, MEDIUM, not blocking) - `contracts/grading.md` and `research.md`
  document tick arithmetic as integer-only, but `tickAtAudioTime` and `resolveWindows`'s bound computations
  return floats never rounded; functionally harmless today but the contract and the code disagree - needs an
  owner/agent call on whether to round (RT review) or correct the documents. **T082** (manual MIDI-hardware
  verification) is still open - needs a person with a keyboard, not an agent.
- Handoff: next = T082 (manual, needs hardware) and T110 (decide round-vs-document, then implement). Every other
  task in `specs/003-play-mode-grading/tasks.md` is `[x]` - **feature 003 is functionally complete**. Tree clean
  at the commit below, not pushed.
