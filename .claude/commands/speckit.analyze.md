---
description: Read-only cross-artifact consistency and constitution-compliance analysis of spec.md, plan.md and tasks.md.
argument-hint: "[optional focus]"
---

## User Input

```text
$ARGUMENTS
```

## Rules

STRICTLY READ-ONLY: do not modify any file. Output a report; offer remediation only if the user asks.
The constitution is non-negotiable within this command: conflicts with a MUST are always CRITICAL.

## Steps

1. Run and parse JSON (`FEATURE_DIR`, `AVAILABLE_DOCS`):
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File .specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks
   ```
2. Load spec.md, plan.md, tasks.md and `.specify/memory/constitution.md` (load only the sections you need).
3. Build internal inventories: requirements (FR/SC) with stable keys, user stories, tasks (mapped to requirements
   and stories), and constitution MUST rules.
4. Detect (max 50 findings):
   - **Duplication**: near-duplicate requirements.
   - **Ambiguity**: vague terms without measurable criteria; leftover placeholders / TODO / NEEDS CLARIFICATION.
   - **Underspecification**: requirements lacking measurable outcome; tasks referencing undefined files/components.
   - **Constitution alignment**: e.g. RT-path tasks without RT review (I); timing not on the single clock or
     hard-coded tolerances (II); rendering/grading not keyed by Note ID (III); implementation before tests, no
     fakes, no golden tests for grading (IV); UI frameworks, UI computing grades or timing, inward dependency
     violations, features without a browser fallback (V); colour-only feedback, modal interruptions (VI); Advice
     hard-coded instead of JSON (VII); unjustified new runtime deps (VIII).
   - **Coverage gaps**: requirements with no task; tasks with no requirement/story.
   - **Inconsistency**: terminology drift vs Domain Vocabulary, conflicting requirements, task ordering contradictions.
5. Severity: CRITICAL (constitution MUST violated, P1 requirement uncovered), HIGH, MEDIUM, LOW.
6. Output a Markdown report: findings table (ID, Category, Severity, Location, Summary, Recommendation), coverage
   table (requirement -> task IDs), constitution alignment issues, unmapped tasks, and metrics (requirements, tasks,
   coverage %, counts per severity).
7. Next actions: if CRITICAL issues exist, recommend resolving them before `/speckit.implement`, naming the command
   to use (`/speckit.specify`, `/speckit.plan` or manual edit of tasks.md). Ask whether the user wants concrete edits.
