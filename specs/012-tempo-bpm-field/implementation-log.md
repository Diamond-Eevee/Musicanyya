# Implementation Log: Tempo as an Editable BPM Number

## 2026-09-26 21:02 - claude-opus-5-5 (analyze)
- Analyze: 13 findings (CRITICAL 0, HIGH 1, MEDIUM 6, LOW 6); tasks.md as of 5ae63d9; coverage 22/22 FR, 6/6 SC
  (SC-003 only implied by T032).
- Top recommendations: (A1) the spec puts a Metronome in Listen and Practice (US2 Independent Test, US2 scenario 1,
  FR-013, SC-002, SC-006, Practice edge case) but only Play runs have one - reword to "the beat of the music" and
  measure SC-002 on scheduled beats; (A2) T029 passes on the old code - drive it from a typed BPM through
  `clampTempoPercent` so it fails first; (A3) T018 has an either-or expectation - fix one rule; (A4) the repeat in
  the `tempo-change-90-60` fixture must go back across the 60 change, or T005 and US2 scenario 9 prove nothing;
  (A5) derive the attempt BPM in core, not in the UI element (Constitution V); (A6) add Practice cases for FR-004
  and FR-013.
- Handoff: next = resolve A1-A6 (spec wording needs owner OK for A1), then `/speckit.implement` from T001.

## 2026-09-26 21:20 - claude-opus-5-5 (analyze remediation)
- Done: all 13 analyze findings resolved on the owner's "use the recommendations". Spec: A1 (no Metronome in Listen
  or Practice - US2, FR-013, SC-002, SC-006, Practice edge case reworded), A7 (qpm bounds 10-1000 stated as new), A9
  (four digits), A13 (extra `<metronome>` forms named); Clarifications record it. Tasks: A2 (T029 now driven through
  `clampTempoPercent`, fails on the current 5 % rounding), A3 (T018 one expected-value rule, computed from raw XML),
  A4 (`tempo-change-90-60` repeat goes back from m6 to m1; T005 expects 90/60/90/60), A5 (`attemptTempo` in core,
  tempo-display contract 1.1.0; T040/T046), A6 (Practice cases in T014 and T032), A8 (font-size check in T049),
  A10 (T039 asserts 75 exactly), A11 (dotted-quarter attempt in T040), A12 (SC-003 in T032). New constant
  `TEMPO_BPM_DIGITS_MAX` = 4 (data-model section 7, T007).
- In progress: none. No code written yet; 52 tasks open.
- Decisions: none beyond the findings above.
- Problems / open questions: none; no owner decision is open.
- Handoff: next = `/speckit.implement` from T001 (Setup: fold contract-changes.md into the 001/003/004 contracts),
  then T002 fixtures and the Foundational tests T003-T006; branch `012-tempo-bpm-field`, not pushed; run `pnpm test`
  and `pnpm lint` first (session start step 6).

## 2026-09-26 22:05 - claude-sonnet-5 (Setup + Foundational, T001-T011)

- Done: T001 (contract bumps: worker-messages 1.3.0, worklet-protocol 1.4.1, view-settings 2.1.0, play-run 2.1.0,
  performance-log wording, grading 1.2.1, 001 data-model TempoMark/constants); T002 (5 new fixtures:
  `tempo-change-90-60`, `tempo-beat-inherit-6-8`, `tempo-circa-range`, `tempo-whole-unit`, `tempo-absurd`, rows in
  fixtures README); T003-T006 (Foundational tests, written first and confirmed failing - missing modules for
  beat-unit/tempo-display/timeline-dto, old parser behaviour for tempo-marks); T007 (`TEMPO_BPM_STEP`,
  `TEMPO_MARK_QPM_MIN/MAX`, `TEMPO_BEAT_DOTS_MAX`, `TEMPO_BPM_DIGITS_MAX` in defaults.ts + config.ts); T008
  (`TempoBeat`/`NoteTypeValue` and `TempoMark.beat`/`isDefault` in model.ts; new `beat-unit.ts` with `beatOf`,
  `metronomeBeatAt`, `parsePerMinute`, `beatLabel`); T009 (parser in build.ts: beat read from the direction's
  `<metronome>` unless it is a metric modulation/`<metronome-note>`/`<beat-unit-tied>`, qpm bounds
  [`TEMPO_MARK_QPM_MIN`,`TEMPO_MARK_QPM_MAX`], `parsePerMinute` for "c. 90"/ranges, x1-fallback bug removed so
  whole/16th/etc. units compute correctly, default mark gets `isDefault: true` and the Metronome's beat); T010
  (new `tempo-display.ts`: `buildTempoDisplayMap`, `displaySegmentIndexAt`, `writtenBpm`, `shownBpm`, `bpmLimits`,
  `percentForBpm`); T011 (new `timeline/dto.ts` `buildTimelineDto`, wired into `score.worker.ts`, `TimelineDto` in
  `mx-score-view.ts` gains `tempo`).
- Tests: `pnpm test -- tests/core/tempo tests/core/musicxml tests/core/timeline` - 664 passed, including the T005
  invariant (display-segment qpm equals the tempo map at every note onset) across all hand-written fixtures and
  all 18 real OpenScore corpora files. Full `pnpm test` - 4020 passed, 1 file failed only under full-suite load:
  `tests/library/regeneration.test.ts` times out at the default 5 s only when run alongside everything else
  (passes in 1.1 s standalone, `--testTimeout=60000` also green) - a pre-existing performance flake, not
  introduced by this branch, left unfixed as out of scope. `pnpm typecheck` (`tsc --build --force`) clean.
  `pnpm lint`: 2 pre-existing errors (`noNonNullAssertion` in `src/engine/worklets/dispatch.ts` and
  `src/ui/elements/mx-latency-panel.ts`, neither touched this session) confirmed present before this session's
  changes too (`git stash` + re-run reproduces them on the Setup-only commit); no new lint errors from T003-T011's
  own files.
- Snapshot review (T009): `tests/core/musicxml/__snapshots__/build.test.ts.snap` - 77 fixtures updated, every diff
  purely additive (`beat`, `isDefault` fields only, verified no existing `qpmNum`/`qpmDen` value changed - the
  x1-fallback fix does not affect any committed fixture, since none uses a non-quarter/eighth/half unit without a
  `<sound tempo>`). Two unrelated tests needed the same additive fields in an explicit `.toEqual` (not a snapshot):
  `tests/core/musicxml/write.test.ts` and `tests/tools/lilypond/to-musicxml.test.ts`.
- Decisions: `metronomeBeatAt` scans backward through `measures` for the meter in force itself (mirroring
  `beatTicksAt`'s `meterOf`/compound rule via the shared `METER_BEAT_TYPES`/`METER_BEATS_MAX` constants) rather
  than requiring callers to pre-fill it via `beat.ts`'s private `withMeterInForce`, so it is correct called
  directly with raw `Score.measures` from both `buildTempoDisplayMap` and unit tests. `buildTimelineDto` un-shifts
  `timeline.passes` by `leadInTicks` before calling `buildTempoDisplayMap` (which does its own shift), mirroring
  exactly what `timeline.ts` does for `buildTempoMap`/`shiftedTempo`, so the two tempo representations always
  agree (pinned by the T005 invariant test).
- Problems / open questions: none; no owner decision is open. The two pre-existing lint errors above are not
  feature-012 issues; flagging them here rather than silently claiming a clean `pnpm lint` at this checkpoint.
- Handoff: next = `/speckit.implement` from T012 (US1 tests: `tests/ui/tempo-field.test.ts`, `transport.test.ts`,
  `score-view-tempo-position.test.ts`, transport FR-015 tests, glyph harvest test, library tests, SC-001 real-data
  test, e2e); tree has the Setup+Foundational work uncommitted at this log entry (commit follows immediately);
  branch `012-tempo-bpm-field`, not pushed.
