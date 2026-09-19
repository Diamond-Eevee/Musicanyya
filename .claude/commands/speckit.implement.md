---
description: Execute tasks.md phase by phase (tests first), marking tasks done, until the feature is complete.
argument-hint: "[optional: phase, story or task range to execute, or answers to owner decisions]"
---

## User Input

```text
$ARGUMENTS
```

If the input names a phase, story (e.g. `US1`) or task range, limit execution to it. If it answers an open owner
decision (e.g. `T011: approved`), apply that first.

## Steps

0. **Session start**: follow AGENTS.md section 0 "Session start protocol" (agent id, `status.ps1`, working tree
   check, `git pull --ff-only` if there is an upstream, last two log entries, open owner decisions). Work continues
   from the **resume point** the status script prints; tasks already `[x]` are never redone.
1. Run and parse JSON (`FEATURE_DIR`, `AVAILABLE_DOCS`):
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File .specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks
   ```
2. If `FEATURE_DIR/checklists/` exists, summarise each checklist (total / done / open). If any has open items, show
   the table and ask whether to proceed anyway. Wait for the answer. (Skip this when resuming a feature whose
   implementation already started, i.e. at least one task is `[x]`.)
3. Load tasks.md, plan.md, and as available data-model.md, contracts/, research.md, quickstart.md, plus
   `.specify/memory/constitution.md`.
4. Ensure ignore files match the tech in the plan (`.gitignore` for `node_modules/`, `dist/`, `coverage/`,
   Playwright reports, Electron `out/`/`release/`, native build output, etc.). Only append missing patterns.
5. Execute phase by phase from the resume point, respecting dependencies:
   - Setup -> Foundational -> stories in priority order -> Polish.
   - Claim each task before starting it (`[~]` + `(claimed: <agent-id> <date>)`, AGENTS.md section 6.1).
   - Tests before implementation: write the test, run it, confirm it FAILS for the right reason, then implement
     until it passes (Constitution IV).
   - `[P]` tasks may run in parallel only when they touch different files.
   - Skip tasks blocked by an unanswered owner decision; do independent tasks instead.
   - For RT review tasks, invoke the `rt-audio-reviewer` agent on the changed files and address every blocking finding.
   - After each task: run the relevant checks (`pnpm test -- <path>`, `pnpm typecheck`, `pnpm lint`) and tick it
     `- [x]` (claim suffix removed) in tasks.md immediately. Commit after each completed task group at the latest.
   - At each Checkpoint: verify the story's Independent Test, run the full gate, append an entry to
     `FEATURE_DIR/implementation-log.md` (format in AGENTS.md section 6.2), and commit on the feature branch with a
     Conventional Commit referencing the task IDs (AGENTS.md section 9). Never push or merge unless asked.
6. On failure or any stop condition (AGENTS.md section 6.4): stop the affected sequence, report the error with
   context, suggest a fix; continue only with independent tasks. Log the blocker in `implementation-log.md`.
7. When stopping for any reason (done, stop condition, context/time running low): follow the **session end
   protocol** (AGENTS.md section 6.2). When everything in scope is done: run the full gate (`pnpm lint`,
   `pnpm typecheck`, `pnpm test`, and `pnpm test:e2e` if present), confirm each completed story meets its
   independent test from the spec, write the final log entry, commit, and report completed/remaining tasks and the
   resume point.
