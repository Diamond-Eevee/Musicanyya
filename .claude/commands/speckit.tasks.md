---
description: Generate a dependency-ordered, story-grouped tasks.md from the plan and design artifacts.
argument-hint: "[optional notes]"
---

## User Input

```text
$ARGUMENTS
```

## Steps

1. Run and parse JSON (`FEATURE_DIR`, `AVAILABLE_DOCS`):
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File .specify/scripts/powershell/check-prerequisites.ps1 -Json
   ```
2. Load `plan.md` (required), `spec.md` (required: user stories + priorities) and any of `data-model.md`,
   `contracts/`, `research.md`, `quickstart.md` that exist.
3. Generate `FEATURE_DIR/tasks.md` from `.specify/templates/tasks-template.md`:
   - Phase 1 Setup, Phase 2 Foundational (blocking prerequisites incl. fakes: fake clock, fake MIDI input, offline rendering),
     then one phase per user story in priority order, then Polish.
   - Every task uses the strict format: `- [ ] T### [P?] [US#?] Description with exact file path`.
     `[P]` only when it touches different files and has no dependency on unfinished tasks.
   - Constitution IV: within each story, test tasks come first and must be written to fail before implementation.
     Grading changes get golden/snapshot tests. MusicXML behaviours get fixture tasks.
   - Constitution I: any task touching AudioWorklets, the scheduler, MIDI input timing or plugin callbacks is followed by an
     "RT review with `rt-audio-reviewer`" task.
   - Map each entity, contract and requirement to the story that needs it; nothing orphaned.
   - Each story phase ends with a checkpoint describing its independent test.
4. Add a Dependencies section (phase order, story dependencies) and Parallel Opportunities.
5. Report: path, total tasks, tasks per story, parallel opportunities, suggested MVP scope (usually US1 only), and
   next step `/speckit.analyze` then `/speckit.implement`.
