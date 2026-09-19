---
description: Generate a requirements-quality checklist ("unit tests for the spec") for a chosen domain, e.g. timing, grading, audio devices, MusicXML, UX.
argument-hint: "<domain, e.g. 'grading fairness' or 'audio device handling'>"
---

## User Input

```text
$ARGUMENTS
```

## Steps

1. Run and parse JSON (`FEATURE_DIR`, `FEATURE_SPEC`, `IMPL_PLAN`):
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File .specify/scripts/powershell/check-prerequisites.ps1 -Json -PathsOnly
   ```
2. If the domain or depth is unclear, ask up to 3 short questions (focus, depth: lightweight / release gate, audience:
   author / reviewer).
3. Read spec.md (and plan.md / tasks.md if present) and the constitution.
4. Create `FEATURE_DIR/checklists/<domain>.md` from `.specify/templates/checklist-template.md`. If it exists, append
   continuing the CHK numbering.
5. Items test the REQUIREMENTS, not the implementation:
   - Good: "Is the 'late' threshold quantified in ms and stated as configurable? [Clarity, Spec FR-004]"
   - Bad: "Verify the late note turns orange" (that is a test case, not a requirement check).
   Group by quality dimension: Completeness, Clarity, Consistency, Measurability, Scenario coverage (primary,
   alternate, error, recovery), Edge cases, Non-functional (latency, accessibility), Dependencies & assumptions.
   At least 80% of items reference a spec section or carry `[Gap]` / `[Ambiguity]` / `[Conflict]`.
6. Report: file path, item count, focus areas, and whether it was created or appended.
