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
