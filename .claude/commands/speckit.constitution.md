---
description: Create or amend the project constitution and propagate changes to templates and commands.
argument-hint: "[principle changes or amendment description]"
---

## User Input

```text
$ARGUMENTS
```

You MUST consider the user input before proceeding (if not empty). Only run this step when the user explicitly
asks for a constitution change (or approved one through an owner decision gate).

## Goal

Amend `.specify/memory/constitution.md` and keep every dependent artifact consistent.

## Steps

**Model fit**: this step is tier `deep` (`docs/agents/reference.md` R11). If your model does not fit it, ask the user
first: switch model, or continue with you? Switch: stop and say which model to use. Continue: note it in the report
(and in `implementation-log.md` when the feature has one).

1. Read `.specify/memory/constitution.md` fully. Identify the current version and every principle/section.
2. Derive the change set from the user input. If the input is ambiguous about intent (e.g. "relax latency"), ask at most 2 targeted questions before editing.
3. Determine the version bump (semantic):
   - MAJOR: principle removed or redefined incompatibly.
   - MINOR: principle/section added or materially expanded, or a Platform & Technology Constraints change (also requires a new ADR in `docs/adr/`).
   - PATCH: wording/clarification only.
   State the chosen bump and why.
4. Edit the constitution:
   - Principles stay declarative and testable: use MUST/SHOULD, include a **Rationale**.
   - Update `Last Amended` to today (ISO date); keep `Ratified` unchanged.
   - Replace the Sync Impact Report HTML comment at the top: version change, modified/added/removed principles, templates needing updates (OK / PENDING), deferred TODOs.
5. Propagate, then verify each file:
   - `.specify/templates/plan-template.md` - Constitution Check table rows mirror the principles exactly.
   - `.specify/templates/spec-template.md` - vocabulary and success-criteria prompts.
   - `.specify/templates/tasks-template.md` - required task types (e.g. RT review, test-first).
   - `.claude/commands/speckit.*.md` and `.claude/agents/*.md` - no stale principle names/numbers.
   - `AGENTS.md` section 8 - summary of principles (keep AGENTS.md under 12,000 characters) and
     `docs/agents/reference.md` R1 / Active Technologies - stack summary (CLAUDE.md and GEMINI.md only import AGENTS.md).
6. Validate: no leftover placeholders, dates ISO, version line matches report.
7. Commit (`docs: amend constitution to vX.Y.Z (<summary>)`) and report: new version, bump rationale, files changed,
   follow-ups.
