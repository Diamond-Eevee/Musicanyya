---
description: Resume where the last agent stopped - session start, the next chunk of work, session end with a hand-off.
argument-hint: "[optional: scope or note, e.g. 'only US1' or 'T011: owner approves ...']"
---

## User Input

```text
$ARGUMENTS
```

Treat the input as extra scope or answers to open owner decisions (it must still comply with the constitution).

## Steps

1. **Session start**: follow AGENTS.md section 2 "Session start" exactly (read AGENTS.md and the constitution,
   pick your agent id, run `status.ps1`, check the working tree, `git pull --ff-only` if the branch has an upstream,
   read the feature documents and the last two log entries, ask about open owner decisions once, announce).
2. If the user input answers an owner decision (e.g. `T011: approved`), apply it first: do the gate task (update
   the ADR/plan/constitution it names, via `speckit.constitution.md` for constitution changes), tick it, and log it.
3. Do the **next chunk** based on the status NEXT STEP:
   - `specify` / `clarify` / `plan` / `tasks`: perform that one step by following its instruction file.
   - `implement`: follow `.claude/commands/speckit.implement.md`, starting at the **resume point** and stopping
     at the **next Checkpoint** in `tasks.md` (or earlier at a stop condition, AGENTS.md section 7).
   - `done`: run the full quality gate and the constitution audit, and report that the feature is ready to merge.
4. **Session end**: follow AGENTS.md section 5 (consistent state, checks, ticks, log entry with `Handoff`, commit;
   no push unless asked).
5. Report in a few lines: what was done, tests/gate status, the new resume point, and any decision the user must
   make. Suggest the next command (`continue` again, or `/speckit.implement` to run to the end).
