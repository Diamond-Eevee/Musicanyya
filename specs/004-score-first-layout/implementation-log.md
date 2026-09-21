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

## 2026-09-21 - claude-opus-5 (/speckit.analyze)

- Analyze: 16 findings (CRITICAL 0, HIGH 4, MEDIUM 7, LOW 5); tasks.md as of 1a31af2. Read-only run;
  nothing in spec/plan/tasks/code was changed.
- Done: cross-artifact consistency and constitution check of spec.md, plan.md, tasks.md against
  constitution v1.1.1. Requirement coverage 100% nominal (22 FR + 10 SC, all mapped), 2 partial.
  No constitution principle violated; implementation is not blocked.
- Top recommendations (all four HIGH share one root cause - the `zoomPercent` -> `scale` rename reaches
  further into the existing suite than tasks.md accounts for; cheapest to fix before T014):
  - A1 HIGH: the existing zoom shortcut is bare `+`/`=`/`-`/`_` (`src/app/session.ts` `onKeyDown`), which
    `ui-shell.md` section 4 and T032/T024 replace with `Ctrl/Cmd` only. Spec Assumptions promise existing
    shortcuts keep working, and `tests/e2e/us1-open-view.spec.ts:32` presses bare `+`. Keep both forms.
  - A2 HIGH: `tests/e2e/us1-open-view.spec.ts:35` asserts `zoomPercent === 110` in localStorage; T037
    governs that file but says "selectors only, assertions unchanged", so it cannot fix the field rename.
    Split the rename into its own task worded as a correction.
  - A3 HIGH: `tests/fakes/memory-settings-store.ts` declares `UserSettings` v1 with `zoomPercent`; T014
    breaks typecheck and no task touches the fake.
  - A4 HIGH: `tests/engine/storage/local-settings-store.test.ts` (8 `zoomPercent` refs) fails after T015;
    T036 lists only three `tests/ui/` files.
  - A7 MEDIUM: `MIN_PAGE_UNITS` / `MAX_PAGE_UNITS` are referenced by `score-layout.md` section 2 with no
    value anywhere (Constitution II: no magic numbers).
  - A5/A9/A10/A11 MEDIUM: 175% scaling untested (FR-013 vs SC-006); no Electron-shell layout assertion;
    SC-007's 50 ms-during-run clause uncovered for panel open/close; malformed-MusicXML edge case has no task.
- Problems / open questions: none blocking. The owner has not yet said whether the recommended edits to
  tasks.md, `contracts/ui-shell.md`, `contracts/score-layout.md` and the spec's Assumptions should be applied.
- Handoff: next = apply the A1-A4 edits (manual, ~4 task edits plus two contract amendments), then
  `/speckit.implement` from T001; tree clean at 1a31af2 plus this log entry.

## 2026-09-21 - claude-sonnet-5 (/speckit.implement, analyze edits applied)

- Done: the owner approved "apply all recommendations" for the analyze findings; applied as an edit pass
  before any code. `tasks.md` 79 -> 82 tasks; no task renumbered.
  - A1: bare `+`/`=`/`-`/`_` Score-size keys are kept and `Ctrl/Cmd +/-/0` added beside them; all size keys
    now live in `src/ui/shortcuts.ts` (T024, T032, T034; `contracts/ui-shell.md` section 4; spec Assumptions).
    The contract's "Space: ignored while focus is in a form control" contradicted "unchanged" and was not
    tested, so it was dropped; the form-control guard applies to the bare `+`/`-` keys only.
  - A2: new T038 - the `zoomPercent` assertion in `us1-open-view.spec.ts` is corrected to `scale`
    (value unchanged); T037 now excludes it.
  - A3/A4: T014 also updates `tests/fakes/memory-settings-store.ts`, T015 also restates
    `tests/engine/storage/local-settings-store.test.ts` in v2 terms, so the tree typechecks after each task.
  - A7: `MIN_PAGE_UNITS` = 400 and `MAX_PAGE_UNITS` = 10000 (provisional until T001), in T003 and
    `contracts/score-layout.md` section 1. T003 pointed at a constants table in `data-model.md` that does
    not exist; it now points at the contract's table.
  - A5: T101 also asserts 175% scaling (FR-013). A9: new T111 (Electron layout assertion). A10: T041 also
    asserts no main-thread task over 50 ms while a panel opens and closes during a run. A11: new T039
    (malformed MusicXML keeps the layout score-first).
- Problems / open questions: the earlier analyze log recorded only findings A1-A5, A7, A9-A11 by name;
  A6, A8 and A12-A16 (MEDIUM/LOW) were not written down and are therefore not applied. Re-run
  `/speckit.analyze` to regenerate them if they matter.
- Handoff: next = T001 (`tests/verovio/page-units.test.ts`); tree clean at this commit.
