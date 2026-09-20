---
description: Produce the technical implementation plan (research, data model, contracts, quickstart) for the current feature.
argument-hint: "[technical guidance or constraints]"
---

## User Input

```text
$ARGUMENTS
```

Treat the input as extra technical guidance (it must still comply with the constitution).

## Steps

1. Run and parse JSON (`FEATURE_SPEC`, `IMPL_PLAN`, `SPECS_DIR`, `BRANCH`, `CONSTITUTION`):
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File .specify/scripts/powershell/setup-plan.ps1 -Json
   ```
2. Load context: the spec, `.specify/memory/constitution.md`, `docs/adr/*.md`, `AGENTS.md`, `docs/agents/reference.md`, and the plan template
   already copied to `IMPL_PLAN`. If the spec still has `[NEEDS CLARIFICATION]` markers that affect design,
   stop and recommend `/speckit.clarify`.
3. Fill **Technical Context** (use the constitution's stack; mark genuine unknowns `NEEDS CLARIFICATION`).
4. Fill the **Constitution Check** table: for each principle, state how the design complies. Any violation must be
   justified in **Complexity Tracking** or the design changed. ERROR (stop) on unjustified violations.
5. **Phase 0 - `research.md`**: for every unknown and every new dependency: Decision / Rationale / Alternatives considered.
   Verify library and Web API facts (current versions, browser support incl. Safari/Firefox, licence) instead of
   assuming. Use the
   `music-domain-expert` agent for MusicXML/notation/grading-semantics questions.
6. **Phase 1 - design**:
   - `data-model.md`: entities, fields, validation, relationships, state machines (e.g. transport/session state).
   - `contracts/`: port interfaces, worker/worklet messages, Electron bridge / plugin protocol (payload, max rate), persisted formats
     (performance log, settings). Version every contract.
   - `quickstart.md`: build/run steps and a manual verification script per user story.
   - Update the `Active Technologies` and `Recent Changes` sections of `docs/agents/reference.md` (between the marker comments)
     with only NEW technology from this plan; keep manual content intact.
7. Re-evaluate the Constitution Check after design and update the table.
8. Fill **Project Structure** with concrete paths this feature touches.
9. Stop after Phase 1 (do NOT create tasks.md). Report: branch, plan path, generated artifacts, gate status, and next
   step `/speckit.tasks`.
