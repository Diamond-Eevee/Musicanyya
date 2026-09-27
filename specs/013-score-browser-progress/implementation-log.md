# Implementation Log: Score browser with progress

## 2026-09-27 - claude-opus-5-5 (plan)
- Done: `/speckit.plan`. `plan.md`, `research.md` (R-1 to R-21), `data-model.md`, `contracts/progress-store.md`
  1.0.0, `contracts/score-browser.md` 1.0.0, `contracts/contract-changes.md` and `quickstart.md`. The Active
  Technologies and Recent Changes sections of `docs/agents/reference.md` are updated. The Constitution Check passes
  before and after design.
- Decisions: progress is an event-reduced record per content hash behind a new `ProgressStore` port (IndexedDB v3 +
  memory adapter). The browser is a modal `<dialog>`, never open during Play/Practice sessions, and it pauses Listen.
  Score identity no longer depends on a stored copy. Old attempts migrate with completeness "not recorded" (they count
  for best, not *Mastered*). The `music-domain-expert` review is summarised in research R-6 to R-10: whole-Score,
  all-hands scope for best/*Mastered*, exact integer comparison, floor display, a completed loop counts as *Practised*,
  and the *Suggested next* rules.
- Problems / open questions: the music-domain expert found that 003 FR-008's wording differs from the code (a stopped
  run is graded over all expected notes; the unplayed ones are missed). This is information only; it does not block
  013.
- needs owner: OD-1 best and *Mastered* only from whole-Score, all-hands runs (recommended: yes)
- needs owner: OD-2 *Mastered* also needs extra notes <= 10 % of the notes total; spec FR-024 gains it (recommended: yes)
- needs owner: OD-3 reset progress / remove file and progress also delete that Score's stored attempts (recommended: yes)
- needs owner: OD-4 deleting one attempt removes it from progress too (recommended: yes)
- needs owner: OD-5 add dev dependency `@axe-core/playwright` 4.13.0 (MPL-2.0, test only) for SC-007 (recommended: yes)
- needs owner: OD-6 delete retired `mx-library`, `mx-recent-list`, `IndexedDbScoreStore`/`ScoreStore` and their tests (recommended: yes)
- Handoff: next = `/speckit.tasks` (the plan assumes the recommendations; OD-2 changes spec FR-024 once approved).
  Nothing is implemented yet.

## 2026-09-27 - claude-opus-5-5 (tasks)
- Done: `/speckit.tasks`. `tasks.md` has 93 tasks: Setup 8, Foundational 4, US1 22, US2 24, US3 12, US4 6, US5 9,
  Polish 8. 57 of them are marked [P]. Tests come first in every story, and each story ends with a checkpoint that
  runs its Independent Test.
- Decisions: there is no RT review task, because no worklet, scheduler, MIDI-timing or plugin path is touched; the
  tasks.md header says to add one if that changes. App-controller tests go in `tests/engine/` (`tests/app/` is not a
  Vitest project), so the plan and quickstart paths are corrected.
- Problems / open questions: T001 is the owner decision gate for OD-1 to OD-6, still open. Tasks marked (OD-n) assume
  the recommendation.
- Handoff: next = `/speckit.analyze`, then `/speckit.implement` from T001 (ask OD-1 to OD-6 first).

## 2026-09-27 - claude-opus-5-5 (analyze)
- Analyze: 18 findings (CRITICAL 0, HIGH 3, MEDIUM 8, LOW 7); tasks.md as of be47c6d; coverage 31/31 FR, 8/8 SC.
- Top recommendations: (A1) US4 "opens on Continue" conflicts with FR-006/US1 #5 "restore the last view". Keep
  FR-006; *Continue* is the first-use default and sits at the top of the rail. (A2) T031 unmounts the Recent list in
  US1, but *My files* only arrives in US3, so own files cannot be reopened in between and the old recent e2e tests fail
  at the US1 checkpoint. Keep it mounted until T068. (A3) T048 has an either-or assertion; make it deterministic
  (k1/k2 correct notes of N). (A4) The rail's default expansion is unspecified, and SC-001's 3 actions depends on it.
  (A6) T052 stubs the file half of the port; add that half in US3 instead. (A7) the `e2e-progress-seed` seam is hidden
  inside the manual-check task T058, but earlier tasks need it.
- Handoff: next = apply the recommendations (the owner said "respond with recommended"), then `/speckit.implement`
  from T002.
