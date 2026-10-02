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
