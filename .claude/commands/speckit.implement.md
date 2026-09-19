---
description: Execute tasks.md phase by phase (tests first), marking tasks done, until the feature is complete.
argument-hint: "[optional: phase, story or task range to execute]"
---

## User Input

```text
$ARGUMENTS
```

If the input names a phase, story (e.g. `US1`) or task range, limit execution to it.

## Steps

1. Run and parse JSON (`FEATURE_DIR`, `AVAILABLE_DOCS`):
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File .specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks
   ```
2. If `FEATURE_DIR/checklists/` exists, summarise each checklist (total / done / open). If any has open items, show
   the table and ask whether to proceed anyway. Wait for the answer.
3. Load tasks.md, plan.md, and as available data-model.md, contracts/, research.md, quickstart.md, plus
   `.specify/memory/constitution.md`.
4. Ensure ignore files match the tech in the plan (`.gitignore` for `node_modules/`, `dist/`, `coverage/`,
   Playwright reports, Electron `out/`/`release/`, native build output, etc.). Only append missing patterns.
5. Execute phase by phase, respecting dependencies:
   - Setup -> Foundational -> stories in priority order -> Polish.
   - Tests before implementation: write the test, run it, confirm it FAILS for the right reason, then implement
     until it passes (Constitution IV).
   - `[P]` tasks may run in parallel only when they touch different files.
   - For RT review tasks, invoke the `rt-audio-reviewer` agent on the changed files and address every blocking finding.
   - After each task: run the relevant checks (`pnpm test -- <path>`, `pnpm typecheck`, `pnpm lint`) and mark it
     `- [x]` in tasks.md immediately.
   - At each Checkpoint: verify the story's Independent Test, run the full gate, append an entry to
     `FEATURE_DIR/implementation-log.md` (format in AGENTS.md section 6), and commit on the feature branch with a
     Conventional Commit referencing the task IDs (AGENTS.md section 9). Never push or merge unless asked.
6. On failure: stop the affected sequence, report the error with context, suggest a fix; continue only with
   independent tasks. Log the blocker in `implementation-log.md`.
7. Finish: run the full gate (`pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test:e2e` if present),
   confirm each completed story meets its independent test from the spec,
   write the final log entry, commit, and report completed/remaining tasks.
