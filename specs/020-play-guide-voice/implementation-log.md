# Implementation Log: Guide Voice in Play Mode

## 2026-10-02 - claude-opus-5.5 (specify, plan)
- Done: spec (owner clarified FR-002: only the musician's own expected notes), requirements checklist (all pass), plan,
  research R-1..R-9, data-model, contracts guide-voice 1.0.0 + contract-changes (play-run 2.3.0, mixer-levels 1.1.0,
  worklet-protocol 1.6.2 wording), quickstart; reference Recent Changes. Model fit: `deep` steps on claude-opus-5.5 (fits).
- Decisions: the Guide voice is made in `compilePlaySchedule` by moving graded events to a free melodic channel
  (program 4, velocity x 0.6, CC7 100) marked into `orchestraMask`, so the existing Orchestra level, replay merge and
  device-loss re-send apply unchanged; no engine/worklet/setting change. Levels panel slider always enabled with a guide
  hint (spec FR-010 replaces 019 FR-010).
- Problems / open questions: needs owner: OD-1 listening check (SC-007) at the end - may tune `GUIDE_VELOCITY_SCALE` /
  `GUIDE_PROGRAM`. Observation outside scope: channel CC7 persists across schedules (plan, Decisions).
- Handoff: next = `/speckit:tasks`; gate not run (documents only); tree clean after the plan commit.

## 2026-10-02 - claude-opus-5.5 (tasks)
- Done: `tasks.md` generated: 26 tasks (Setup 3, Foundational 1, US1 8, US2 5, US3 3, Polish 6). Model fit: `standard`
  step on claude-opus-5.5 (listed under "also fits").
- Decisions: `guide` option added as a no-op first (T004) so every caller and test passes `guide: false` before any
  behaviour changes; US1 wires the live run, US3 the stored-run path (replay, regrade), so each story's test fails first;
  US2's render test (T013) has no code of its own (research R-4) and is therefore written before T009.
- Problems / open questions: needs owner: OD-1 listening check (T021), blocks T022 and the merge.
- Handoff: next = `/speckit:analyze`, then `/speckit:implement` from T001; gate not run (documents only).

## 2026-10-02 - claude-opus-5.5 (analyze)
- Analyze: 11 findings (CRITICAL 0, HIGH 0, MEDIUM 4, LOW 7); tasks.md as of 6873fb1. Model fit: `deep` step on
  claude-opus-5.5 (fits).
- Top recommendations: move T013 into US1's tests (file order puts it after T009, which it must precede); name the
  render-helper extension T007/T013 need (`renderPlayRun` reads `public/library` only, has no graded set, guide option
  or Orchestra level); add a stop/pause "guide notes released" assertion; reuse 019's level-sweep test for SC-006.
- Handoff: next = fix the MEDIUM findings in tasks.md (owner's call), then `/speckit:implement` from T001.
