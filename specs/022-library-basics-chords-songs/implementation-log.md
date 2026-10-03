# Implementation log: 022-library-basics-chords-songs

## 2026-10-03 16:00 - claude-opus-5.5 (specify + plan)
- Done: spec (owner answered 3 clarifications), plan, research, data-model, contracts (lesson-definition 1.0.0;
  change requests library-index 1.5.0, song-definition 1.2.0, audit-record 1.5.0, source-manifest 1.4.0), quickstart.
- Decisions: owner OD-1 during planning - the level check bans no notation; levels = hand reach + pace (tempo,
  length, density, hand independence, voices); Introduction keeps "one focus" (criterion 29). Spec FR-005 - FR-007
  added, FR-014 and SC-006 reworded (spec fixed first, as AGENTS.md section 3 requires). Dry run over today's index:
  16 existing items need `raisedBecause` to keep their level; all 42 Introduction items pass criterion 29 with the
  minor-scale and key-change counting rules (research R1). Section id `learning/chord-lessons` because
  `learning/chords` is a former id of Keys.
- Reviews: song-source search by the music-domain-expert sub-agent (findings in research R13: 10 public-domain SATB
  sources shortlisted; no familiar modal folk tune has a usable Mutopia source).
- Model fit: specify and plan are tier deep; claude-opus-5.5 fits.
- Problems / open questions: needs owner: OD-2 approve the 10 song sources (research R13) - blocks US3 only; OD-3
  staccato heard at half length for every Score, incl. Burgmüller Nos. 2 and 5 and both Morning Moods (recommended yes).
- Handoff: next = /speckit:tasks; tree clean after the plan commit.

## 2026-10-03 17:00 - claude-opus-5.5 (tasks)
- Done: tasks.md - 73 tasks (Setup 2, Foundation 25, US1 12, US2 11, US3 14, US4 2, Polish 7); tiers: deep 22,
  standard 37, light 14. Owner decision gates: T003 (OD-3 staccato, blocks T018-T021), T051 (OD-2 song sources, blocks
  T057-T066). No RT review task: no real-time path is touched (plan).
- Model fit: tasks is tier standard; claude-opus-5.5 fits (higher tier).
- Problems / open questions: needs owner: OD-2, OD-3 (unchanged from the plan entry).
- Handoff: next = /speckit:analyze, then /speckit:implement from T001; ask OD-3 at T003. Tree clean after the tasks commit.

## 2026-10-03 17:30 - claude-opus-5.5 (analyze)
- Analyze: 17 findings (CRITICAL 0, HIGH 3, MEDIUM 6, LOW 8); tasks.md as of 7bd7e1a.
- Top recommendations: (H1) FR-035 asks a simplified version for every Beginner chord lesson, data-model §5 has none -
  narrow FR-035 to Intermediate and harder (matches the owner's clarification) or add Introduction versions;
  (H2) criterion 29 counts dotted quarter + eighth (lesson 15) and 6/8 with dotted quarters (lesson 24) as two
  features - fold the implied values into one feature; (H3) T054 wants each simplified song directly before its full
  version, but `build-songs.ts` orders Beginner songs first - add a builder ordering task or drop the rule.
- Owner (2026-10-03, "go with recommended" with /speckit:analyze): OD-2 approve the 10 song sources of research R13;
  OD-3 staccato at half length for every Score - yes. T003 and T051 record these in research.md when implement starts.
- Handoff: next = fix H1-H3 (spec/plan/tasks edits), then /speckit:implement from T001.
