# Implementation Log: Score-First Application Window

Feature `004-score-first-layout`. Newest entry at the bottom.

## 2026-09-21 - claude-opus-5 (/speckit.tasks)

- Done: generated `tasks.md` - 79 tasks in 7 phases (Setup 4, Foundational 15, US1 18, US2 11,
  US3 10, US4 10, Polish 11) from `plan.md`, `spec.md`, `research.md`, `data-model.md` and the three
  contracts.
- In progress: none.
- Decisions:
  - The Verovio unit spike (research R-2) is **T001**, the very first task, and **T002** corrects
    `contracts/score-layout.md` before any UI work if the measurement differs - as the plan requires.
  - No per-task RT review: this feature edits no AudioWorklet, scheduler, metronome or MIDI-timing
    code (plan "Real-time Paths Touched": none). The single RT-adjacent claim is contract guarantee
    G-4, reviewed once in Polish as **T104** with `rt-audio-reviewer`.
  - Research R-8 is honoured by **T004**, which re-checks the five inherited open tasks
    (001 T138/T139/T141, 003 T082/T110) against the new layout and records the verdict, rather than
    adopting or dropping them silently.
  - Existing suites are updated by **T036** (unit) and **T037** (e2e) with the rule "selectors only,
    no assertion weakened or skipped" (plan Risks).
  - Task numbering leaves gaps between phases (T037 -> T040, T050 -> T060, T069 -> T080, T089 -> T100)
    so new work found during implementation gets a free number inside its own phase.
- Problems / open questions: none. No owner decision is blocking.
- Handoff: next = `/speckit.analyze`, then `/speckit.implement` starting at T001
  (`tests/verovio/page-units.test.ts`); tree clean after this commit.
