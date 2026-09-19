---
description: "Spec Kit step: read-only consistency and constitution check of spec, plan and tasks."
---

# /speckit.analyze

This repo uses a Spec Kit workflow made of plain Markdown instruction files. Nothing needs to be installed, and
you must not guess what this step means: follow the files below.

1. Read `AGENTS.md` completely (it is short) and do its "2. Session start" steps, including the announcement
   (your agent id, the instruction file you follow, the resume point, open decisions).
2. Open `.claude/commands/speckit.analyze.md`, read it completely, and follow it exactly. Ignore its YAML front
   matter. Treat any text the user wrote after `/speckit.analyze` as `$ARGUMENTS` (scope such as `US1` or
   `T030-T068`, or answers to open owner decisions such as `T011: approved`).
3. Keep the documents current as listed in `AGENTS.md` "6. Documents every agent keeps current" (task claims and
   ticks in `tasks.md`, entries in `implementation-log.md`, research/contracts/data-model when they change).
4. Finish with `AGENTS.md` "5. Session end and hand-off": log entry with a `Handoff` line, commit on the feature
   branch, no push unless asked.
