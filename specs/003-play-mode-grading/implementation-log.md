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
