---
description: Generate a dependency-ordered, story-grouped tasks.md from the plan and design artifacts.
argument-hint: "[optional notes]"
---

## User Input

```text
$ARGUMENTS
```

## Steps

**Model fit**: this step is tier `standard` (`docs/agents/reference.md` R11). If your model does not fit it, ask the user
first: switch model, or continue with you? Switch: stop and say which model to use. Continue: note it in the report
(and in `implementation-log.md` when the feature has one).

1. Run and parse JSON (`FEATURE_DIR`, `AVAILABLE_DOCS`):
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File .specify/scripts/powershell/check-prerequisites.ps1 -Json
   ```
2. Load `plan.md` (required), `spec.md` (required: user stories + priorities) and any of `data-model.md`,
   `contracts/`, `research.md`, `quickstart.md` that exist.
3. Generate `FEATURE_DIR/tasks.md` from `.specify/templates/tasks-template.md`:
   - Phase 1 Setup, Phase 2 Foundational (blocking prerequisites incl. fakes: fake clock, fake MIDI input, offline rendering),
     then one phase per user story in priority order, then Polish.
   - Every task uses the strict format: `- [ ] T### [P?] [US#?] [tier?] Description with exact file path`.
     `[P]` only when it touches different files and has no dependency on unfinished tasks.
   - Model fit (constitution, `docs/agents/reference.md` R11): every phase gets a `**Model**: <tier> (<first model>
     or <second model>)` line with the tier's recommended models from R11; a task whose tier differs from its phase
     carries `[deep]`, `[standard]` or `[light]`. Composing or authoring music, intricate rule engines and music
     reviews are `deep`; code, tests and anything needing judgement are `standard`; mechanical, fully specified work
     with an exact expected result (folding contract text, version bumps, named constants, running a named command,
     doc updates) is `light`. Checkpoints are never `light`. Prefer `light` wherever the rules allow, so work can be
     offloaded to fast models.
   - Constitution IV: within each story, test tasks come first and must be written to fail before implementation.
     Grading changes get golden/snapshot tests. MusicXML behaviours get fixture tasks.
   - Constitution I: any task touching AudioWorklets, the scheduler, MIDI input timing or plugin callbacks is followed by an
     "RT review with `rt-audio-reviewer`" task.
   - Every open owner decision from the plan ("needs owner" in its Decisions and open items) becomes an
     "Owner decision gate" task that names what it blocks.
   - Map each entity, contract and requirement to the story that needs it; nothing orphaned.
   - Each story phase ends with a checkpoint describing its independent test.
4. Add a Dependencies section (phase order, story dependencies) and Parallel Opportunities.
5. Commit `tasks.md` (`docs(tasks): generate tasks for <feature>`) and add a log entry with a `Handoff` line.
6. Report: path, total tasks, tasks per story, tasks per model tier with the recommended models for each (reference
   R11), parallel opportunities, suggested MVP scope (usually US1 only), and next step `/speckit.analyze` then
   `/speckit.implement`.
